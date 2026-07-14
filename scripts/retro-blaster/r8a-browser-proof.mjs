import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const [lane = 'native-chrome', transport = 'native', rawUrl, rawOutput, rawSha] = process.argv.slice(2)
const url = rawUrl || 'http://127.0.0.1:3334/pitch-defender/retro-2'
const output = resolve(rawOutput || `data/retro-blaster-rework/runtime-logs/r8a-browser-proof/${lane}`)
const videoDir = resolve(output, 'video')
const deployedSha = rawSha || 'local-uncommitted'
mkdirSync(videoDir, { recursive: true })

function assert(condition, message) {
  if (!condition) throw new Error(`${lane}: ${message}`)
}

function noteFrequency(note) {
  const match = /^([A-G])(#?)(\d+)$/.exec(note)
  assert(match, `invalid target note ${note}`)
  const chroma = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1]] + (match[2] ? 1 : 0)
  const midi = (Number(match[3]) + 1) * 12 + chroma
  return 440 * Math.pow(2, (midi - 69) / 12)
}

const initHarness = () => {
  let forcedVisibility = 'visible'
  let forcedFocus = true
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => forcedVisibility,
  })
  Object.defineProperty(document, 'hasFocus', {
    configurable: true,
    value: () => forcedFocus,
  })
  window.__setR8Activity = (visibility, focused) => {
    forcedVisibility = visibility
    forcedFocus = focused
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event(focused ? 'focus' : 'blur'))
  }

  const NativeAudioContext = window.AudioContext || window.webkitAudioContext
  let stateOwner = NativeAudioContext.prototype
  let stateDescriptor = Object.getOwnPropertyDescriptor(stateOwner, 'state')
  while (!stateDescriptor && stateOwner) {
    stateOwner = Object.getPrototypeOf(stateOwner)
    stateDescriptor = stateOwner ? Object.getOwnPropertyDescriptor(stateOwner, 'state') : null
  }
  window.__r8ForceSuspended = false
  if (stateOwner && stateDescriptor?.get) {
    Object.defineProperty(stateOwner, 'state', {
      ...stateDescriptor,
      get() {
        return window.__r8ForceSuspended ? 'suspended' : stateDescriptor.get.call(this)
      },
    })
  }

  const nativeCreateMediaStreamSource = NativeAudioContext.prototype.createMediaStreamSource
  const proof = window.__r8MicProof = {
    sources: [],
    productContexts: [],
    matchingCalls: 0,
    gumCalls: 0,
  }
  NativeAudioContext.prototype.createMediaStreamSource = function(stream) {
    const matchingSourceIndex = proof.sources.findIndex(source => source.stream === stream)
    if (matchingSourceIndex >= 0) {
      proof.matchingCalls += 1
      proof.productContexts.push(this)
      proof.sources[matchingSourceIndex].productContext = this
    }
    return nativeCreateMediaStreamSource.call(this, stream)
  }
  navigator.mediaDevices.getUserMedia = async () => {
    proof.gumCalls += 1
    const sourceContext = new NativeAudioContext()
    const oscillator = sourceContext.createOscillator()
    const gain = sourceContext.createGain()
    const destination = sourceContext.createMediaStreamDestination()
    oscillator.type = 'sine'
    oscillator.frequency.value = 110
    gain.gain.value = 0
    oscillator.connect(gain)
    gain.connect(destination)
    oscillator.start()
    await sourceContext.resume()
    const source = { sourceContext, oscillator, gain, destination, stream: destination.stream, productContext: null }
    proof.sources.push(source)
    return source.stream
  }
  window.__r8MicStatus = () => ({
    gumCalls: proof.gumCalls,
    matchingCalls: proof.matchingCalls,
    sourceCount: proof.sources.length,
    sourceContextStates: proof.sources.map(source => source.sourceContext.state),
    sourceTrackStates: proof.sources.map(source => source.stream.getAudioTracks()[0]?.readyState ?? 'missing'),
    productContextStates: proof.productContexts.map(context => context.state),
    sourceIsProductContext: proof.sources.some(source => source.sourceContext === source.productContext),
  })
  window.__r8SetFrequency = frequency => {
    const source = proof.sources.at(-1)
    if (!source) throw new Error('no deterministic microphone source')
    source.oscillator.frequency.setValueAtTime(frequency, source.sourceContext.currentTime)
  }
  window.__r8SetGain = value => {
    const source = proof.sources.at(-1)
    if (!source) throw new Error('no deterministic microphone source')
    source.gain.gain.setValueAtTime(value, source.sourceContext.currentTime)
  }
  window.__r8StopSourceTrack = () => {
    const track = proof.sources.at(-1)?.stream.getAudioTracks()[0]
    if (!track) throw new Error('no deterministic microphone track')
    track.stop()
    return track.readyState
  }

  window.__r8FrameCount = 0
  const countFrame = () => {
    window.__r8FrameCount += 1
    requestAnimationFrame(countFrame)
  }
  requestAnimationFrame(countFrame)
}

const connected = transport !== 'native'
let complete = false
const browser = connected
  ? await chromium.connectOverCDP(transport, { timeout: 60_000 })
  : await chromium.launch({ headless: true, channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] })
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  reducedMotion: 'reduce',
  recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
})
const page = await context.newPage()
await page.addInitScript(initHarness)
const pageErrors = []
page.on('pageerror', error => pageErrors.push(error.message))
const behaviorManifest = []

function storageSnapshot() {
  return page.evaluate(() => JSON.stringify(
    Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])),
  ))
}

async function startSegment(behaviorId) {
  const start = await page.evaluate(() => ({ at: performance.now(), frame: window.__r8FrameCount }))
  return { behaviorId, startedAtMs: start.at, startFrame: start.frame, endedAtMs: null, endFrame: null, durationMs: null, frameDelta: null }
}

async function finishSegment(segment, minimumDurationMs = 6000) {
  const elapsed = await page.evaluate(startedAt => performance.now() - startedAt, segment.startedAtMs)
  if (elapsed < minimumDurationMs) await page.waitForTimeout(minimumDurationMs - elapsed)
  const end = await page.evaluate(() => ({ at: performance.now(), frame: window.__r8FrameCount }))
  segment.endedAtMs = end.at
  segment.endFrame = end.frame
  segment.durationMs = end.at - segment.startedAtMs
  segment.frameDelta = end.frame - segment.startFrame
  assert(segment.durationMs >= minimumDurationMs, `${segment.behaviorId} evidence shorter than ${minimumDurationMs}ms`)
  assert(segment.frameDelta >= 30, `${segment.behaviorId} did not retain live frame evidence`)
  behaviorManifest.push(segment)
}

async function state() {
  return page.evaluate(() => {
    const readiness = document.querySelector('[data-retro-readiness]')
    const canvas = document.querySelector('canvas')
    const meter = document.querySelector('[data-retro-vocal-meter]')
    const fill = meter?.querySelector('.h-full.rounded-full')
    const rect = readiness?.getBoundingClientRect()
    const buttons = [...document.querySelectorAll('button')]
    return {
      readiness: readiness ? {
        lane: readiness.getAttribute('data-readiness-lane'),
        status: readiness.getAttribute('data-readiness-status'),
        toneArmed: readiness.getAttribute('data-readiness-tone-armed'),
      } : null,
      message: document.querySelector('[role="status"]')?.textContent?.trim() ?? null,
      canvas: Boolean(canvas),
      formation: (() => { try { return JSON.parse(canvas?.dataset.retroFormationState || '{}') } catch { return {} } })(),
      mic: window.__r8MicStatus?.() ?? null,
      vocalMeter: {
        present: Boolean(meter),
        visible: Boolean(meter && getComputedStyle(meter).display !== 'none'),
        widthPct: Number.parseFloat(fill?.style.width || '0'),
      },
      accessibility: {
        ariaLive: document.querySelector('[role="status"]')?.getAttribute('aria-live') ?? null,
        heading: document.querySelector('#radio-check-title')?.textContent?.trim() ?? null,
        buttonMinHeights: buttons.map(button => Math.round(button.getBoundingClientRect().height)),
      },
      layout: {
        viewport: [innerWidth, innerHeight],
        readinessRect: rect ? [rect.x, rect.y, rect.width, rect.height] : null,
        horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        verticalOverflow: document.documentElement.scrollHeight - document.documentElement.clientHeight,
        clippedButtons: buttons.filter(button => {
          const box = button.getBoundingClientRect()
          return box.width <= 0 || box.height <= 0 || box.left < -1 || box.right > innerWidth + 1
        }).map(button => button.textContent?.trim()),
        belowFoldButtons: buttons.filter(button => {
          const box = button.getBoundingClientRect()
          return box.top < -1 || box.bottom > innerHeight + 1
        }).map(button => button.textContent?.trim()),
      },
      resources: performance.getEntriesByType('resource')
        .filter(entry => /\/sounds\/nback\/piano\/C4\.wav$/.test(new URL(entry.name).pathname))
        .map(entry => ({ name: entry.name, durationMs: entry.duration, transferSize: entry.transferSize })),
      userActivation: navigator.userActivation ? {
        hasBeenActive: navigator.userActivation.hasBeenActive,
        isActive: navigator.userActivation.isActive,
      } : null,
    }
  })
}

async function freshMenu() {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('retro_tutorial_seen', '1')
    localStorage.setItem('retro_blaster_color_hints', '0')
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'INSERT COIN' }).waitFor()
}

async function waitReadinessStatus(status, timeout = 15_000) {
  await page.waitForFunction(expected =>
    document.querySelector('[data-retro-readiness]')?.getAttribute('data-readiness-status') === expected,
  status, { timeout })
}

async function capture(path, options = {}) {
  await page.bringToFront()
  await page.waitForTimeout(120)
  await page.screenshot({ path: resolve(output, path), ...options })
}

try {
  await freshMenu()
  await page.evaluate(() => { window.__r8ForceSuspended = true })
  await page.getByRole('button', { name: 'KEYBOARD' }).click()
  await page.getByRole('button', { name: 'EASY' }).click()
  const baseline = await storageSnapshot()
  await page.getByRole('button', { name: 'INSERT COIN' }).click()
  await page.locator('[data-retro-readiness]').waitFor()
  await waitReadinessStatus('audio-error')
  const audioFailure = await startSegment('ear-failure-retry')
  await capture('01-ear-audio-failure.png')
  await finishSegment(audioFailure)
  assert(await storageSnapshot() === baseline, 'EAR audio failure wrote localStorage')

  await page.evaluate(() => { window.__r8ForceSuspended = false })
  await page.getByRole('button', { name: 'RETRY AUDIO' }).click()
  await waitReadinessStatus('awaiting-ear')
  const readyState = await state()
  assert(readyState.readiness?.toneArmed === 'true', 'EAR retry did not arm the named C signal')
  assert(readyState.resources.length >= 1, 'EAR retry has no C4 sample network trace')
  assert(readyState.accessibility.ariaLive === 'polite', 'readiness status is not aria-live polite')
  assert(readyState.accessibility.buttonMinHeights.every(height => height >= 44), 'readiness has a sub-44px action target')
  await capture('02-ear-ready.png')

  await page.locator('[data-retro-readiness] .grid button').nth(1).click()
  const wrong = await startSegment('ear-wrong-no-write')
  assert((await state()).message?.includes('no score'), 'wrong EAR response did not stay neutral')
  await finishSegment(wrong)
  assert(await storageSnapshot() === baseline, 'wrong EAR response wrote localStorage')

  await page.evaluate(() => window.__setR8Activity('visible', false))
  await page.waitForFunction(() => document.querySelector('[data-retro-readiness]')?.getAttribute('data-readiness-tone-armed') === 'false')
  await page.keyboard.press('1')
  assert((await state()).readiness !== null, 'blurred EAR response passed readiness')
  await page.evaluate(() => window.__setR8Activity('visible', true))
  await page.getByRole('button', { name: 'PLAY C SIGNAL' }).click()
  await waitReadinessStatus('awaiting-ear')
  const beforeEarPass = await storageSnapshot()
  await page.locator('[data-retro-readiness] .grid button').nth(0).click()
  await page.locator('[data-retro-cabinet]').waitFor()
  const afterEarPass = await storageSnapshot()
  assert(afterEarPass === beforeEarPass, 'EAR readiness pass wrote localStorage')
  const earPass = await state()
  assert(earPass.canvas, 'EAR readiness did not transfer to gameplay')
  await capture('03-ear-pass.png')
  await page.getByRole('button', { name: 'QUIT' }).click()
  await page.getByRole('button', { name: 'INSERT COIN' }).waitFor()

  await page.getByRole('button', { name: 'MICROPHONE' }).click()
  await page.getByRole('button', { name: 'TRUE PLAY' }).click()
  const beforeVoice = await storageSnapshot()
  await page.getByRole('button', { name: 'INSERT COIN' }).click()
  await page.locator('[data-retro-readiness][data-readiness-lane="voice"]').waitFor()
  await waitReadinessStatus('awaiting-voice')
  await page.waitForFunction(() => window.__r8MicStatus?.().gumCalls === 1 && window.__r8MicStatus?.().matchingCalls === 1)
  const stale = await startSegment('voice-stale-silence-blocked')
  await capture('04-voice-waiting.png')
  await finishSegment(stale)
  assert((await state()).readiness?.status === 'awaiting-voice', 'silent/stale VOICE source passed readiness')
  assert(await storageSnapshot() === beforeVoice, 'silent/stale VOICE source wrote localStorage')

  await page.evaluate(() => window.__r8StopSourceTrack())
  const dead = await startSegment('voice-dead-track-blocked')
  await finishSegment(dead)
  assert((await state()).readiness !== null, 'dead VOICE track passed readiness')
  assert(await storageSnapshot() === beforeVoice, 'dead VOICE track wrote localStorage')

  await page.getByRole('button', { name: 'RETRY MIC' }).click()
  await page.waitForFunction(() => window.__r8MicStatus?.().gumCalls === 2 && window.__r8MicStatus?.().matchingCalls === 2)
  await page.evaluate(() => {
    window.__r8SetFrequency(110)
    window.__r8SetGain(0.55)
  })
  const beforeVoicePass = await storageSnapshot()
  await page.locator('[data-retro-cabinet]').waitFor({ timeout: 10_000 })
  const afterVoicePass = await storageSnapshot()
  assert(afterVoicePass === beforeVoicePass, 'VOICE readiness pass wrote localStorage')
  const voicePass = await state()
  assert(voicePass.mic.gumCalls === 2 && voicePass.mic.matchingCalls === 2,
    'VOICE pass opened a duplicate microphone source')
  assert(voicePass.mic.sourceIsProductContext === false, 'VOICE source oscillator context was mistaken for product context')

  await page.waitForFunction(() => {
    const canvas = document.querySelector('canvas')
    try { return JSON.parse(canvas?.dataset.retroFormationState || '{}').activeAttack?.phase === 'outbound' } catch { return false }
  }, null, { timeout: 15_000 })
  const attack = (await state()).formation.activeAttack
  await page.evaluate(frequency => window.__r8SetFrequency(frequency), noteFrequency(attack.note))
  await page.waitForFunction(() => {
    const meter = document.querySelector('[data-retro-vocal-meter]')
    const fill = meter?.querySelector('.h-full.rounded-full')
    return Boolean(meter && getComputedStyle(meter).display !== 'none' && Number.parseFloat(fill?.style.width || '0') > 0)
  }, null, { timeout: 3000 })
  const liveMeterState = await state()
  assert(liveMeterState.vocalMeter.present && liveMeterState.vocalMeter.visible && liveMeterState.vocalMeter.widthPct > 0,
    'protected vocal meter did not respond during a live demand after RADIO CHECK')
  await capture('05-voice-pass-meter.png')
  const voiceGameplay = await startSegment('voice-pass-live-meter')
  await finishSegment(voiceGameplay)
  const meterState = await state()
  if (await page.getByRole('button', { name: 'QUIT' }).count()) await page.getByRole('button', { name: 'QUIT' }).click()
  else await page.getByRole('button', { name: 'MENU' }).click()
  await page.getByRole('button', { name: 'INSERT COIN' }).waitFor()

  await page.getByRole('button', { name: 'KEYBOARD' }).click()
  await page.getByRole('button', { name: 'INSERT COIN' }).click()
  await page.locator('[data-retro-readiness]').waitFor()
  if ((await state()).readiness?.status === 'audio-error') {
    await page.getByRole('button', { name: 'RETRY AUDIO' }).click()
  }
  await waitReadinessStatus('awaiting-ear')
  const responsive = []
  for (const [name, width, height] of [
    ['portrait-390x844', 390, 844],
    ['landscape-844x390', 844, 390],
    ['desktop-1280x800', 1280, 800],
    ['zoom-200-equivalent-640x400', 640, 400],
  ]) {
    await page.setViewportSize({ width, height })
    await page.waitForTimeout(150)
    const layout = (await state()).layout
    assert(layout.horizontalOverflow <= 1, `${name} horizontal overflow ${layout.horizontalOverflow}px`)
    assert(layout.clippedButtons.length === 0, `${name} clipped actions: ${layout.clippedButtons.join(', ')}`)
    assert(layout.belowFoldButtons.length === 0, `${name} actions below the initial fold: ${layout.belowFoldButtons.join(', ')}`)
    responsive.push({ name, ...layout })
    await capture(`responsive-${name}.png`, { fullPage: true })
  }

  assert(pageErrors.length === 0, `page errors: ${pageErrors.join('; ')}`)
  const videoPath = await page.video().path()
  const result = {
    verdict: 'PASS',
    lane,
    transport,
    url,
    deployedSha,
    pageErrors,
    behaviorManifest,
    ear: { baseline, readyState, passState: earPass },
    voice: { baseline: beforeVoice, passState: voicePass, liveMeterState, meterState },
    responsive,
    inherited: {
      micBaselines: 'PASS - one source per explicit start/retry; fresh isActive phonation required',
      vocalMeter: 'PASS - present, visible, and responding after RADIO CHECK',
      gains: 'deferred-r14',
      jonEar: 'pending-act-boundary',
      tutorialAndControls: 'PASS - deterministic fixture plus named/non-scored on-screen copy',
      requiredApm: 'inherited R7 cadence; RADIO CHECK emits no engine demand timestamps',
    },
    videoPath,
  }
  writeFileSync(resolve(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
  complete = true
  console.log(`PASS R8a browser proof: ${lane}; ${behaviorManifest.length} causal behaviors; 0 page errors`)
} catch (error) {
  const result = { verdict: 'FAIL', lane, transport, url, deployedSha, pageErrors, behaviorManifest, error: String(error?.stack || error) }
  writeFileSync(resolve(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
  console.error(result.error)
  process.exitCode = 1
} finally {
  let closeTimer
  const contextClosed = await Promise.race([
    context.close().then(() => true),
    new Promise(resolveClose => { closeTimer = setTimeout(() => resolveClose(false), 15_000) }),
  ])
  clearTimeout(closeTimer)
  if (!contextClosed) console.error(`${lane}: proof context close timed out; disconnecting the runner only`)
  if (!connected) await browser.close()
  else {
    if (!complete) console.error(`${lane}: connected browser left running after proof failure`)
    // ponytail: Playwright exposes no disconnect-only API for CDP; exit after the
    // isolated proof context closes rather than closing the operator's browser.
    process.exit(process.exitCode ?? 0)
  }
}
