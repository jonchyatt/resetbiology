import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const [lane, endpoint = 'native', outputRoot = 'data/retro-blaster-rework/runtime-logs/r4-prebuild-cadence-spike'] = process.argv.slice(2)
if (!lane) throw new Error('usage: node r4-prebuild-cadence-spike.mjs LANE [native|CDP_ENDPOINT] [OUTPUT_ROOT]')

const output = resolve(outputRoot, lane)
mkdirSync(output, { recursive: true })

const html = `<!doctype html><meta charset="utf-8"><button id="start">start</button><script>
  document.querySelector('#start').addEventListener('click', () => {
    window.__cadencePromise = (async () => {
      const sourceContext = new AudioContext();
      const analyzerContext = new AudioContext();
      const oscillator = sourceContext.createOscillator();
      const destination = sourceContext.createMediaStreamDestination();
      const source = analyzerContext.createMediaStreamSource(destination.stream);
      const analyzer = analyzerContext.createAnalyser();
      analyzer.fftSize = 2048;
      oscillator.frequency.value = 261.625565;
      oscillator.connect(destination);
      source.connect(analyzer);
      oscillator.start();
      await Promise.all([sourceContext.resume(), analyzerContext.resume()]);
      const buffer = new Float32Array(analyzer.fftSize);
      const intervals = [];
      const gameIntervals = [];
      let nonZeroPasses = 0;
      let previous = null;
      let previousGame = null;
      let passes = 0;
      let gameFrames = 0;
      let finished = false;
      const startedAt = performance.now();
      const result = await new Promise(resolveResult => {
        function gameFrame(now) {
          if (previousGame !== null) gameIntervals.push(now - previousGame);
          previousGame = now;
          gameFrames += 1;
          if (!finished) requestAnimationFrame(gameFrame);
        }
        function analyze(now) {
          analyzer.getFloatTimeDomainData(buffer);
          if (buffer.some(value => value !== 0)) nonZeroPasses += 1;
          if (previous !== null) intervals.push(now - previous);
          previous = now;
          passes += 1;
          if (now - startedAt >= 30000) {
            finished = true;
            resolveResult({
              durationMs: now - startedAt,
              passes,
              nonZeroPasses,
              sourceContextState: sourceContext.state,
              analyzerContextState: analyzerContext.state,
              intervals,
              gameIntervals,
              gameFrames,
              userAgent: navigator.userAgent,
            });
            return;
          }
          requestAnimationFrame(analyze);
        }
        requestAnimationFrame(gameFrame);
        requestAnimationFrame(analyze);
      });
      oscillator.stop();
      destination.stream.getTracks().forEach(track => track.stop());
      await Promise.all([sourceContext.close(), analyzerContext.close()]);
      return result;
    })();
  }, { once: true });
</script>`

function summarize(raw) {
  const sorted = [...raw.intervals].sort((a, b) => a - b)
  const sortedGame = [...raw.gameIntervals].sort((a, b) => a - b)
  const percentile = p => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))]
  const gamePercentile = p => sortedGame[Math.min(sortedGame.length - 1, Math.floor((sortedGame.length - 1) * p))]
  const pairedCount = Math.min(raw.intervals.length, raw.gameIntervals.length)
  const maxPairedDeltaMs = Math.max(0, ...Array.from(
    { length: pairedCount },
    (_, index) => Math.abs(raw.intervals[index] - raw.gameIntervals[index]),
  ))
  return {
    lane,
    endpoint,
    measuredAt: new Date().toISOString(),
    durationMs: raw.durationMs,
    passes: raw.passes,
    gameFrames: raw.gameFrames,
    nonZeroPasses: raw.nonZeroPasses,
    sourceContextState: raw.sourceContextState,
    analyzerContextState: raw.analyzerContextState,
    minMs: sorted[0],
    medianMs: percentile(0.5),
    p95Ms: percentile(0.95),
    p99Ms: percentile(0.99),
    maxMs: sorted.at(-1),
    gameMedianMs: gamePercentile(0.5),
    gameP95Ms: gamePercentile(0.95),
    gameMaxMs: sortedGame.at(-1),
    maxPairedDeltaMs,
    coStallPass: pairedCount > 0 && maxPairedDeltaMs <= 1,
    rejectedWallClockCandidateMs: 200,
    cadenceBenchmarkP95CeilingMs: 100,
    pass: raw.sourceContextState === 'running' &&
      raw.analyzerContextState === 'running' &&
      raw.nonZeroPasses > 0 && percentile(0.95) <= 100 &&
      maxPairedDeltaMs <= 1,
    userAgent: raw.userAgent,
    intervalCount: sorted.length,
  }
}

async function runNative() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  try {
    const page = await browser.newPage()
    await page.goto(`data:text/html,${encodeURIComponent(html)}`)
    await page.click('#start')
    return await page.evaluate(() => window.__cadencePromise)
  } finally {
    await browser.close()
  }
}

async function runCdp() {
  const target = await (await fetch(`${endpoint}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  const pending = new Map()
  let nextId = 1

  await new Promise((resolveOpen, reject) => {
    const timeout = setTimeout(() => reject(new Error(`${lane}: CDP open timeout`)), 5000)
    ws.onopen = () => { clearTimeout(timeout); resolveOpen() }
    ws.onerror = error => { clearTimeout(timeout); reject(error) }
  })
  ws.onmessage = event => {
    const message = JSON.parse(event.data)
    if (!message.id) return
    const waiter = pending.get(message.id)
    if (!waiter) return
    pending.delete(message.id)
    if (message.error) waiter.reject(new Error(message.error.message))
    else waiter.resolve(message.result)
  }
  const send = (method, params = {}, timeoutMs = 40000) => {
    const id = nextId++
    return new Promise((resolveMessage, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(id)
        reject(new Error(`${lane}: ${method} timeout`))
      }, timeoutMs)
      pending.set(id, {
        resolve: value => { clearTimeout(timeout); resolveMessage(value) },
        reject: error => { clearTimeout(timeout); reject(error) },
      })
      ws.send(JSON.stringify({ id, method, params }))
    })
  }

  try {
    await send('Page.enable')
    await send('Runtime.enable')
    await send('Emulation.setFocusEmulationEnabled', { enabled: true })
    await send('Page.bringToFront')
    await send('Page.navigate', { url: `data:text/html,${encodeURIComponent(html)}` })
    await send('Runtime.evaluate', {
      expression: `new Promise(resolve => document.readyState === 'complete' ? resolve() : addEventListener('load', resolve, { once:true }))`,
      awaitPromise: true,
    })
    await send('Page.bringToFront')
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 20, y: 12, button: 'left', clickCount: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 20, y: 12, button: 'left', clickCount: 1 })
    const result = await send('Runtime.evaluate', {
      expression: 'window.__cadencePromise',
      awaitPromise: true,
      returnByValue: true,
    }, 70000)
    if (result.exceptionDetails) throw new Error(`${lane}: evaluation failed`)
    return result.result.value
  } finally {
    ws.close()
    await fetch(`${endpoint}/json/close/${target.id}`).catch(() => {})
  }
}

const summary = summarize(endpoint === 'native' ? await runNative() : await runCdp())
writeFileSync(resolve(output, 'result.json'), `${JSON.stringify(summary, null, 2)}\n`)
console.log(JSON.stringify(summary))
if (!summary.pass) process.exitCode = 1
