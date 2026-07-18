import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const [name, endpoint, rawUrl, rawOutput] = process.argv.slice(2)
if (!name || !endpoint) throw new Error('usage: node r8a-hawkeye-visual.mjs NAME CDP_ENDPOINT [URL] [OUTPUT]')
const url = rawUrl || 'http://127.0.0.1:3334/pitch-defender/retro-2'
const output = resolve(rawOutput || `data/retro-blaster-rework/runtime-logs/r8a-hawkeye-visual/${name}`)
mkdirSync(output, { recursive: true })

function assert(condition, message) {
  if (!condition) throw new Error(`${name}: ${message}`)
}

const target = await (await fetch(`${endpoint}/json/new?about:blank`, { method: 'PUT' })).json()
const ws = new WebSocket(target.webSocketDebuggerUrl)
const pending = new Map()
let nextId = 1
const pageErrors = []

await new Promise((resolveOpen, reject) => {
  const timeout = setTimeout(() => reject(new Error(`${name}: target WebSocket open timed out`)), 5000)
  ws.onopen = () => { clearTimeout(timeout); resolveOpen() }
  ws.onerror = error => { clearTimeout(timeout); reject(error) }
})

ws.onmessage = event => {
  const message = JSON.parse(event.data)
  if (message.method === 'Runtime.exceptionThrown') {
    pageErrors.push(message.params?.exceptionDetails?.text ?? 'Runtime.exceptionThrown')
  }
  if (!message.id) return
  const waiter = pending.get(message.id)
  if (!waiter) return
  pending.delete(message.id)
  if (message.error) waiter.reject(new Error(message.error.message))
  else waiter.resolve(message.result)
}

function send(method, params = {}) {
  const id = nextId++
  return new Promise((resolveMessage, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`${name}: ${method} timed out`))
    }, 12_000)
    pending.set(id, {
      resolve: value => { clearTimeout(timeout); resolveMessage(value) },
      reject: error => { clearTimeout(timeout); reject(error) },
    })
    ws.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) throw new Error(`${name}: evaluation failed: ${result.exceptionDetails.text}`)
  return result.result?.value
}

async function waitFor(expression, label, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return
    await new Promise(resolveWait => setTimeout(resolveWait, 50))
  }
  throw new Error(`${name}: timed out waiting for ${label}`)
}

async function trustedClick(label) {
  const point = await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find(candidate => candidate.textContent?.trim() === ${JSON.stringify(label)});
    if (!button) return null;
    const rect = button.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`)
  assert(point, `${label} button missing`)
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y })
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 })
}

async function screenshot(fileName) {
  await send('Page.bringToFront')
  await new Promise(resolveWait => setTimeout(resolveWait, 150))
  const result = await send('Page.captureScreenshot', { format: 'png', fromSurface: false, captureBeyondViewport: false })
  writeFileSync(resolve(output, fileName), Buffer.from(result.data, 'base64'))
}

async function layout() {
  return evaluate(`(() => ({
    status: document.querySelector('[data-retro-readiness]')?.getAttribute('data-readiness-status') ?? null,
    activation: navigator.userActivation ? { hasBeenActive: navigator.userActivation.hasBeenActive, isActive: navigator.userActivation.isActive } : null,
    viewport: [innerWidth, innerHeight],
    overflow: [document.documentElement.scrollWidth - innerWidth, document.documentElement.scrollHeight - innerHeight],
    actions: [...document.querySelectorAll('button')].map(button => {
      const rect = button.getBoundingClientRect();
      return { text: button.textContent?.trim(), x: rect.x, y: rect.y, width: rect.width, height: rect.height, inView: rect.top >= -1 && rect.left >= -1 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1 };
    }),
  }))()`)
}

try {
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url })
  await send('Page.bringToFront')
  await waitFor(`document.readyState === 'complete'`, 'page load')
  await evaluate(`(() => {
    localStorage.setItem('retro_tutorial_seen', '1');
    localStorage.setItem('retro_difficulty', 'easy');
    localStorage.setItem('retro_blaster_color_hints', '0');
    return true;
  })()`)
  await send('Page.reload', { ignoreCache: false })
  await waitFor(`[...document.querySelectorAll('button')].some(button => button.textContent?.trim() === 'INSERT COIN')`, 'menu')
  await trustedClick('INSERT COIN')
  await waitFor(`Boolean(document.querySelector('[data-retro-readiness]'))`, 'readiness')
  await waitFor(`['awaiting-ear','audio-error'].includes(document.querySelector('[data-retro-readiness]')?.getAttribute('data-readiness-status'))`, 'EAR readiness')
  if ((await layout()).status === 'audio-error') {
    await trustedClick('RETRY AUDIO')
    await waitFor(`document.querySelector('[data-retro-readiness]')?.getAttribute('data-readiness-status') === 'awaiting-ear'`, 'EAR retry')
  }
  const desktop = await layout()
  assert(desktop.status === 'awaiting-ear', 'desktop did not reach named EAR readiness')
  assert(desktop.actions.every(action => action.inView), 'desktop has an offscreen action')
  await screenshot('hawkeye-direct-desktop.png')

  await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 1, mobile: false })
  await new Promise(resolveWait => setTimeout(resolveWait, 180))
  const landscape = await layout()
  assert(landscape.actions.every(action => action.inView), 'short landscape has an offscreen action')
  await screenshot('hawkeye-direct-landscape-844x390.png')
  assert(pageErrors.length === 0, `page errors: ${pageErrors.join('; ')}`)
  writeFileSync(resolve(output, 'visual-result.json'), `${JSON.stringify({ status: 'PASS', name, endpoint, url, pageErrors, desktop, landscape }, null, 2)}\n`)
  console.log(`PASS R8a direct Hawkeye visual: ${name}`)
} finally {
  ws.close()
  await fetch(`${endpoint}/json/close/${target.id}`, { method: 'PUT' }).catch(() => {})
}
