import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const [lane = 'native-chrome', transport = 'native', rawUrl, rawOutput, rawSha, rawMode] = process.argv.slice(2)
const url = rawUrl || 'http://127.0.0.1:3336/pitch-defender/retro-2'
const output = resolve(rawOutput || `data/retro-blaster-rework/runtime-logs/r8b-browser-proof/${lane}`)
const videoDir = resolve(output, 'video')
const deployedSha = rawSha || 'local-uncommitted'
const mode = rawMode || 'standard'
const INTRO_ORDER = ['C4', 'A4', 'G4', 'E4', 'D4', 'F4', 'B4', 'C5', 'A3', 'G3', 'E3', 'C3', 'D3', 'F3', 'B3']
mkdirSync(videoDir, { recursive: true })

function noteFrequency(note) {
  const match = /^([A-G])(#?)(-?\d+)$/.exec(note)
  if (!match) throw new Error(`invalid note ${note}`)
  const semitones = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
  const midi = (Number(match[3]) + 1) * 12 + semitones[match[1]] + (match[2] ? 1 : 0)
  return 440 * (2 ** ((midi - 69) / 12))
}

function assert(condition, message) {
  if (!condition) throw new Error(`${lane}: ${message}`)
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
  window.__r8AutoBlurOnCeremony = false
  window.__r8DidAutoBlur = false
  new MutationObserver(() => {
    if (!window.__r8AutoBlurOnCeremony || !document.querySelector('[data-retro-ceremony]')) return
    window.__r8AutoBlurOnCeremony = false
    window.__r8DidAutoBlur = true
    window.__setR8Activity('hidden', false)
  }).observe(document, { childList: true, subtree: true })

  window.__r8TemporalConsistency = {
    active: false,
    sampleCount: 0,
    mutationSampleCount: 0,
    mutationRecordCount: 0,
    mismatches: [],
  }
  window.__r8SampleTemporalConsistency = (source, mutationRecordCount = 0) => {
    const proof = window.__r8TemporalConsistency
    if (!proof.active) return
    const canvas = document.querySelector('canvas')
    let formation = {}
    try { formation = JSON.parse(canvas?.dataset.retroFormationState || '{}') } catch {}
    const ceremony = document.querySelector('[data-retro-ceremony]')
    const ceremonyHeader = document.getElementById('new-signal-title')
    proof.sampleCount += 1
    if (source === 'mutation') {
      proof.mutationSampleCount += 1
      proof.mutationRecordCount += mutationRecordCount
    }
    if (formation.phase === 'playing' && formation.wave >= 5 && (ceremony || ceremonyHeader)) {
      proof.mismatches.push({
        source,
        atMs: performance.now(),
        frame: window.__r8FrameCount,
        phase: formation.phase,
        wave: formation.wave,
        ceremonyPresent: Boolean(ceremony),
        ceremonyHeader: ceremonyHeader?.textContent?.trim() || null,
      })
    }
  }
  new MutationObserver(mutations => {
    window.__r8SampleTemporalConsistency('mutation', mutations.length)
  }).observe(document, {
    attributes: true,
    attributeFilter: ['data-retro-formation-state'],
    characterData: true,
    childList: true,
    subtree: true,
  })

  window.__r8CeremonyDraw = { panel: null, text: {} }
  const nativeFillText = CanvasRenderingContext2D.prototype.fillText
  CanvasRenderingContext2D.prototype.fillText = function(text, x, y, maxWidth) {
    const label = String(text)
    const key = label === 'PRE-FLIGHT'
      ? 'preflight'
      : ['SIGNAL INTRODUCED - NOT SCORED', 'INTRODUCTION ONLY - NOT SCORED'].includes(label)
        ? 'nonScored'
        : ['REFERENCE TONE DISPATCHED', 'SIGNAL PATH NOT READY', 'REFERENCE SIGNAL PENDING', 'REFERENCE INTRODUCTION'].includes(label)
          ? 'status'
          : null
    if (key) {
      const metrics = this.measureText(label)
      window.__r8CeremonyDraw.text[key] = {
        text: label,
        x,
        y,
        font: this.font,
        fontPx: Number(this.font.match(/([\d.]+)px/)?.[1]),
        ascent: metrics.actualBoundingBoxAscent,
        descent: metrics.actualBoundingBoxDescent,
      }
    }
    return maxWidth === undefined
      ? nativeFillText.call(this, text, x, y)
      : nativeFillText.call(this, text, x, y, maxWidth)
  }

  const nativeStrokeRect = CanvasRenderingContext2D.prototype.strokeRect
  CanvasRenderingContext2D.prototype.strokeRect = function(x, y, width, height) {
    if (x > 0 && y > 0 && width >= this.canvas.width * 0.7 && height >= this.canvas.height * 0.7) {
      window.__r8CeremonyDraw.panel = { x, y, width, height, lineWidth: this.lineWidth }
    }
    return nativeStrokeRect.call(this, x, y, width, height)
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
  const micProof = window.__r8MicProof = {
    sources: [],
    productContexts: [],
    matchingCalls: 0,
    gumCalls: 0,
  }
  NativeAudioContext.prototype.createMediaStreamSource = function(stream) {
    const matchingSourceIndex = micProof.sources.findIndex(source => source.stream === stream)
    if (matchingSourceIndex >= 0) {
      micProof.matchingCalls += 1
      micProof.productContexts.push(this)
      micProof.sources[matchingSourceIndex].productContext = this
    }
    return nativeCreateMediaStreamSource.call(this, stream)
  }
  navigator.mediaDevices.getUserMedia = async () => {
    micProof.gumCalls += 1
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
    micProof.sources.push(source)
    return source.stream
  }
  window.__r8MicStatus = () => ({
    gumCalls: micProof.gumCalls,
    matchingCalls: micProof.matchingCalls,
    sourceCount: micProof.sources.length,
    sourceContextStates: micProof.sources.map(source => source.sourceContext.state),
    sourceTrackStates: micProof.sources.map(source => source.stream.getAudioTracks()[0]?.readyState ?? 'missing'),
    productContextStates: micProof.productContexts.map(context => context.state),
    sourceIsProductContext: micProof.sources.some(source => source.sourceContext === source.productContext),
  })
  window.__r8SetFrequency = frequency => {
    const source = micProof.sources.at(-1)
    if (!source) throw new Error('no deterministic microphone source')
    source.oscillator.frequency.setValueAtTime(frequency, source.sourceContext.currentTime)
  }
  window.__r8SetGain = value => {
    const source = micProof.sources.at(-1)
    if (!source) throw new Error('no deterministic microphone source')
    source.gain.gain.setValueAtTime(value, source.sourceContext.currentTime)
  }

  window.__r8BufferStarts = 0
  const nativeBufferStart = AudioBufferSourceNode.prototype.start
  AudioBufferSourceNode.prototype.start = function(...args) {
    window.__r8BufferStarts += 1
    return nativeBufferStart.apply(this, args)
  }

  const nativeFetch = window.fetch.bind(window)
  const heldPianoFetches = []
  window.__r8HoldPianoReload = false
  window.__r8HeldPianoFetchCount = 0
  window.__r8ReleasePianoReload = () => {
    window.__r8HoldPianoReload = false
    for (const release of heldPianoFetches.splice(0)) release()
  }
  window.fetch = (input, init) => {
    const requestUrl = input instanceof Request ? input.url : String(input)
    if (window.__r8HoldPianoReload && /\/sounds\/nback\/piano\/[^/]+\.wav(?:\?|$)/.test(requestUrl)) {
      window.__r8HeldPianoFetchCount += 1
      return new Promise((resolveFetch, rejectFetch) => {
        heldPianoFetches.push(() => nativeFetch(input, init).then(resolveFetch, rejectFetch))
      })
    }
    return nativeFetch(input, init)
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
const behaviorManifest = []
const responsive = []
const responsiveFailures = []
let temporalConsistency = null
page.on('pageerror', error => pageErrors.push(error.message))

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
  if (elapsed < minimumDurationMs) await page.waitForTimeout(minimumDurationMs - elapsed + 25)
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
    const canvas = document.querySelector('canvas')
    const ceremony = document.querySelector('[data-retro-ceremony]')
    const rect = ceremony?.getBoundingClientRect()
    const canvasRect = canvas?.getBoundingClientRect()
    const toastRect = ceremony?.querySelector('[role="status"]')?.getBoundingClientRect()
    const draw = window.__r8CeremonyDraw
    const scaleX = canvasRect && canvas ? canvasRect.width / canvas.width : 0
    const scaleY = canvasRect && canvas ? canvasRect.height / canvas.height : 0
    const textCssRect = entry => entry && canvasRect ? {
      top: canvasRect.top + (entry.y - entry.ascent) * scaleY,
      bottom: canvasRect.top + (entry.y + entry.descent) * scaleY,
    } : null
    const statusCss = textCssRect(draw?.text.status)
    const nonScoredCss = textCssRect(draw?.text.nonScored)
    const preflightCss = textCssRect(draw?.text.preflight)
    const panelCss = draw?.panel && canvasRect ? {
      left: canvasRect.left + draw.panel.x * scaleX,
      top: canvasRect.top + draw.panel.y * scaleY,
      right: canvasRect.left + (draw.panel.x + draw.panel.width) * scaleX,
      bottom: canvasRect.top + (draw.panel.y + draw.panel.height) * scaleY,
    } : null
    const copyBottom = Math.max(statusCss?.bottom ?? -Infinity, nonScoredCss?.bottom ?? -Infinity)
    const actions = ceremony ? [...ceremony.querySelectorAll('button')].map(button => {
      const box = button.getBoundingClientRect()
      return {
        text: button.textContent?.trim(),
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        insideRegion: Boolean(rect && box.left >= rect.left - 1 && box.right <= rect.right + 1 && box.top >= rect.top - 1 && box.bottom <= rect.bottom + 1),
        insideViewport: box.left >= -1 && box.right <= innerWidth + 1 && box.top >= -1 && box.bottom <= innerHeight + 1,
        insidePanel: Boolean(panelCss && box.left >= panelCss.left && box.right <= panelCss.right && box.top >= panelCss.top && box.bottom <= panelCss.bottom),
      }
    }) : []
    let formation = {}
    try { formation = JSON.parse(canvas?.dataset.retroFormationState || '{}') } catch {}
    return {
      formation,
      formationRaw: canvas?.dataset.retroFormationState || '',
      ceremony: ceremony ? {
        id: ceremony.getAttribute('data-ceremony-id'),
        note: ceremony.getAttribute('data-ceremony-note'),
        status: ceremony.getAttribute('data-ceremony-status'),
        heading: ceremony.querySelector('h2')?.textContent?.trim(),
        live: ceremony.querySelector('[role="status"]')?.getAttribute('aria-live'),
        text: ceremony.textContent?.replace(/\s+/g, ' ').trim(),
        rect: rect ? [rect.x, rect.y, rect.width, rect.height] : null,
        actions,
        geometry: {
          canvasRect: canvasRect ? [canvasRect.x, canvasRect.y, canvasRect.width, canvasRect.height] : null,
          canvasScale: [scaleX, scaleY],
          toastRect: toastRect ? [toastRect.x, toastRect.y, toastRect.width, toastRect.height] : null,
          canvasCopyBottom: Number.isFinite(copyBottom) ? copyBottom : null,
          toastClearance: toastRect && Number.isFinite(copyBottom) ? toastRect.top - copyBottom : null,
          panelRect: panelCss ? [panelCss.left, panelCss.top, panelCss.right - panelCss.left, panelCss.bottom - panelCss.top] : null,
          panelBorderClearance: panelCss && actions.length ? panelCss.bottom - Math.max(...actions.map(action => action.y + action.height)) : null,
          preflightEffectiveFontPx: draw?.text.preflight ? draw.text.preflight.fontPx * scaleY : null,
          preflightInkHeight: preflightCss ? preflightCss.bottom - preflightCss.top : null,
        },
      } : null,
      bufferStarts: window.__r8BufferStarts,
      viewport: [innerWidth, innerHeight],
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      menu: [...document.querySelectorAll('button')].some(button => button.textContent?.trim() === 'INSERT COIN'),
    }
  })
}

async function capture(fileName, options = {}) {
  await page.bringToFront()
  await page.waitForTimeout(120)
  await page.screenshot({ path: resolve(output, fileName), ...options })
}

async function freshGame() {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('retro_tutorial_seen', '1')
    localStorage.setItem('retro_blaster_color_hints', '0')
    localStorage.setItem('retro_difficulty', 'easy')
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'INSERT COIN' }).click()
  await page.locator('[data-retro-readiness]').waitFor()
  const readiness = page.locator('[data-retro-readiness]')
  await page.waitForFunction(() => ['awaiting-ear', 'audio-error'].includes(
    document.querySelector('[data-retro-readiness]')?.getAttribute('data-readiness-status'),
  ))
  if (await readiness.getAttribute('data-readiness-status') === 'audio-error') {
    await page.getByRole('button', { name: 'RETRY AUDIO' }).click()
    await page.waitForFunction(() =>
      document.querySelector('[data-retro-readiness]')?.getAttribute('data-readiness-status') === 'awaiting-ear')
  }
  await page.locator('[data-retro-readiness] .grid button').nth(0).click()
  await page.locator('[data-retro-cabinet]').waitFor()
}

async function answerUntilCeremony() {
  const deadline = Date.now() + 180_000
  let correctAnswers = 0
  while (Date.now() < deadline) {
    const snapshot = await state()
    if (snapshot.formation.phase === 'ceremony') return correctAnswers
    const attack = snapshot.formation.activeAttack
    if (attack?.phase === 'outbound') {
      const keyIndex = INTRO_ORDER.indexOf(attack.note)
      assert(keyIndex >= 0 && keyIndex < 9, `no direct gameplay key for ${attack.note}`)
      await page.keyboard.press(String(keyIndex + 1))
      await page.waitForFunction(attackId => {
        try {
          const active = JSON.parse(document.querySelector('canvas')?.dataset.retroFormationState || '{}').activeAttack
          return !active || active.attackId !== attackId || active.phase !== 'outbound'
        } catch { return false }
      }, attack.attackId, { timeout: 5000 })
      correctAnswers += 1
      if (correctAnswers === 9) await page.evaluate(() => {
        window.__r8ForceSuspended = true
        window.__r8AutoBlurOnCeremony = true
      })
      continue
    }
    if (snapshot.menu) throw new Error(`${lane}: game returned to menu before NEW SIGNAL`)
    await page.waitForTimeout(35)
  }
  throw new Error(`${lane}: timed out earning the first NEW SIGNAL`)
}

async function voiceState() {
  return page.evaluate(() => {
    const parse = (raw, fallback = '{}') => {
      try { return JSON.parse(raw || fallback) } catch { return JSON.parse(fallback) }
    }
    const canvas = document.querySelector('canvas')
    const meter = document.querySelector('[data-retro-vocal-meter]')
    const fill = meter?.querySelector('.h-full.rounded-full')
    return {
      formation: parse(canvas?.dataset.retroFormationState),
      signalCheck: parse(canvas?.dataset.retroSignalCheck),
      micAuthority: parse(canvas?.dataset.retroMicAuthority),
      mic: window.__r8MicStatus?.() ?? null,
      vocalMeter: {
        present: Boolean(meter),
        visible: Boolean(meter && getComputedStyle(meter).display !== 'none'),
        widthPct: Number.parseFloat(fill?.style.width || '0'),
      },
      toneAgeMs: typeof window.__pdLastToneAt === 'number' ? performance.now() - window.__pdLastToneAt : null,
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      colorHintsLabel: [...document.querySelectorAll('button')]
        .map(button => button.textContent?.trim())
        .find(label => label?.startsWith('COLOR HINTS')) ?? null,
      gainRanges: [...document.querySelectorAll('[data-retro-cabinet] input[type="range"]')].map(input => ({
        min: input.min,
        max: input.max,
        value: input.value,
      })),
    }
  })
}

async function freshVoiceGame() {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('retro_tutorial_seen', '1')
    localStorage.setItem('retro_blaster_color_hints', '0')
    localStorage.setItem('retro_difficulty', 'easy')
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'MICROPHONE' }).click()
  await page.getByRole('button', { name: 'EASY' }).click()
  await page.getByRole('button', { name: 'INSERT COIN' }).click()
  await page.locator('[data-retro-readiness][data-readiness-lane="voice"]').waitFor()
  await page.waitForFunction(() => (
    document.querySelector('[data-retro-readiness]')?.getAttribute('data-readiness-status') === 'awaiting-voice' &&
    window.__r8MicStatus?.().gumCalls === 1 &&
    window.__r8MicStatus?.().matchingCalls === 1
  ), null, { timeout: 15_000 })
  await page.evaluate(() => {
    window.__r8SetFrequency(110)
    window.__r8SetGain(0.55)
  })
  await page.locator('[data-retro-cabinet]').waitFor({ timeout: 15_000 })
  await page.evaluate(() => window.__r8SetGain(0))
  const started = await voiceState()
  assert(started.mic.gumCalls === 1 && started.mic.matchingCalls === 1 && started.mic.sourceCount === 1,
    'VOICE readiness did not create exactly one matched source')
  assert(started.mic.sourceTrackStates[0] === 'live' && started.mic.productContextStates[0] === 'running',
    'VOICE source was not live/running at gameplay transfer')
  assert(started.mic.sourceIsProductContext === false, 'source oscillator context was mistaken for product context')
  assert(started.reducedMotion === true, 'reduced-motion parity was not active')
  assert(started.colorHintsLabel === 'COLOR HINTS OFF', `color-hints-off parity drifted (${started.colorHintsLabel})`)
  assert(started.gainRanges.length === 0, 'R14 gain deferral is no longer truthful')
  return started
}

async function answerVoiceUntilCeremony() {
  const deadline = Date.now() + 240_000
  const answers = []
  let suppressionReceipt = null
  let octaveReceipt = null
  let firstWave2SignalCheck = null
  while (Date.now() < deadline) {
    const snapshot = await voiceState()
    if (!firstWave2SignalCheck && snapshot.formation.wave >= 2 && snapshot.signalCheck?.cuePolicy) {
      firstWave2SignalCheck = snapshot.signalCheck
    }
    if (snapshot.formation.phase === 'ceremony') return { answers, suppressionReceipt, octaveReceipt, firstWave2SignalCheck }
    const attack = snapshot.formation.activeAttack
    if (attack?.phase !== 'outbound' || answers.some(answer => answer.attackId === attack.attackId)) {
      await page.waitForTimeout(25)
      continue
    }

    const octaveProbe = answers.length === 1
    const frequency = noteFrequency(attack.note) * (octaveProbe ? 2 * (2 ** (60 / 1200)) : 1)
    await page.evaluate(value => {
      window.__r8SetFrequency(value)
      window.__r8SetGain(0.55)
    }, frequency)

    if (!suppressionReceipt) {
      await page.waitForFunction(() => {
        const canvas = document.querySelector('canvas')
        const mic = JSON.parse(canvas?.dataset.retroMicAuthority || '{}')
        const age = typeof window.__pdLastToneAt === 'number' ? performance.now() - window.__pdLastToneAt : Infinity
        return age >= 0 && age < 350 && mic.signalActive === false
      }, null, { timeout: 1000, polling: 'raf' })
      suppressionReceipt = await voiceState()
      assert(suppressionReceipt.toneAgeMs < 350 && suppressionReceipt.micAuthority.signalActive === false,
        '350ms post-tone suppression did not hold signal authority inactive')
    }

    await page.waitForFunction(attackId => {
      const canvas = document.querySelector('canvas')
      const formation = JSON.parse(canvas?.dataset.retroFormationState || '{}')
      const mic = JSON.parse(canvas?.dataset.retroMicAuthority || '{}')
      const meter = document.querySelector('[data-retro-vocal-meter]')
      const fill = meter?.querySelector('.h-full.rounded-full')
      return formation.activeAttack?.attackId === attackId && mic.signalActive === true &&
        Boolean(meter && getComputedStyle(meter).display !== 'none') && Number.parseFloat(fill?.style.width || '0') > 0
    }, attack.attackId, { timeout: 2500, polling: 'raf' })
    const live = await voiceState()
    assert(live.micAuthority.signalActive === true && live.vocalMeter.present && live.vocalMeter.visible && live.vocalMeter.widthPct > 0,
      `VOICE proof-of-hearing was not visible for ${attack.attackId}`)
    if (octaveProbe) octaveReceipt = { attack, injectedFrequency: frequency, live }

    await page.waitForFunction(attackId => {
      const active = JSON.parse(document.querySelector('canvas')?.dataset.retroFormationState || '{}').activeAttack
      return active?.attackId === attackId && active.outcome === 'correct'
    }, attack.attackId, { timeout: 3000, polling: 'raf' })
    const resolved = await voiceState()
    answers.push({ attackId: attack.attackId, note: attack.note, octaveProbe, injectedFrequency: frequency, resolved: resolved.formation.activeAttack })
    await page.evaluate(() => window.__r8SetGain(0))
  }
  throw new Error(`${lane}: timed out earning NEW SIGNAL through VOICE`)
}

function pacingReceipt(formation) {
  const completed = formation.lastCompletedWavePacing
  assert(completed && completed.requiredAnswerEventsMs.length > 0, 'completed wave pacing receipt is missing')
  const gaps = completed.requiredAnswerEventsMs.slice(1)
    .map((value, index) => value - completed.requiredAnswerEventsMs[index])
  const minimumGapMs = gaps.length ? Math.min(...gaps) : null
  const measuredApm = completed.requiredAnswerEventsMs.length / (completed.waveDurationMs / 60_000)
  assert(gaps.every(gap => gap >= 1100), `easy cadence gap fell below 1100ms (${minimumGapMs})`)
  assert(measuredApm <= 54.55, `easy cadence exceeded 54.55 APM (${measuredApm})`)
  return { ...completed, demandCount: completed.requiredAnswerEventsMs.length, measuredApm, minimumGapMs }
}

async function runVoiceProof() {
  const startState = await freshVoiceGame()
  const beforeGameplayStorage = await storageSnapshot()
  const approach = await startSegment('voice-live-to-new-signal')
  const earned = await answerVoiceUntilCeremony()
  assert(earned.answers.length >= 10, `NEW SIGNAL arrived after only ${earned.answers.length} VOICE answers`)
  assert(earned.octaveReceipt?.live.micAuthority.signalActive === true,
    'octave-folded +60-cent live probe never acquired mic authority')
  assert(earned.firstWave2SignalCheck?.cuePolicy === 'guided' &&
    earned.firstWave2SignalCheck?.disposition === 'guided-voice' && earned.firstWave2SignalCheck?.maskActive === false,
  `R8c VOICE opportunity was not guided-voice: ${JSON.stringify(earned.firstWave2SignalCheck)}`)
  await page.waitForFunction(() => {
    const formation = JSON.parse(document.querySelector('canvas')?.dataset.retroFormationState || '{}')
    return formation.phase === 'ceremony' && formation.introductionCeremony?.toneStatus === 'acknowledged'
  }, null, { timeout: 10_000 })
  await finishSegment(approach)

  const ceremonyEntry = await voiceState()
  const ceremonyStorage = await storageSnapshot()
  const pacing = pacingReceipt(ceremonyEntry.formation)
  const completedPacingBytes = JSON.stringify(ceremonyEntry.formation.lastCompletedWavePacing)
  const currentDemandBytes = JSON.stringify(ceremonyEntry.formation.requiredAnswerEventsMs)
  assert(ceremonyEntry.mic.sourceCount === 1 && ceremonyEntry.mic.gumCalls === 1 && ceremonyEntry.mic.matchingCalls === 1,
    'ceremony reopened or duplicated the VOICE source')
  assert(ceremonyEntry.vocalMeter.present === false, 'protected gameplay vocal meter rendered inside ceremony')
  await capture('01-voice-new-signal.png')

  const ceremonySegment = await startSegment('voice-ceremony-to-live-meter-resume')
  await page.waitForTimeout(800)
  const ceremonyHeld = await voiceState()
  assert(JSON.stringify(ceremonyHeld.formation.lastCompletedWavePacing) === completedPacingBytes,
    'ceremony altered the completed-wave pacing receipt')
  assert(JSON.stringify(ceremonyHeld.formation.requiredAnswerEventsMs) === currentDemandBytes,
    'ceremony emitted a required demand timestamp')
  assert(await storageSnapshot() === ceremonyStorage, 'VOICE ceremony wrote family storage')
  assert(ceremonyHeld.mic.sourceCount === 1 && ceremonyHeld.mic.gumCalls === 1 && ceremonyHeld.mic.matchingCalls === 1,
    'VOICE source count changed during ceremony')

  await page.waitForFunction(() => {
    const formation = JSON.parse(document.querySelector('canvas')?.dataset.retroFormationState || '{}')
    return formation.phase === 'playing' && formation.wave >= 5 && !formation.introductionCeremony
  }, null, { timeout: 10_000 })
  const resumed = await voiceState()
  assert(resumed.formation.requiredAnswerEventsMs.length === 0, 'next wave did not reset its demand array after ceremony')
  assert(JSON.stringify(resumed.formation.lastCompletedWavePacing) === completedPacingBytes,
    'ceremony resume altered the completed-wave pacing receipt')
  assert(await storageSnapshot() === ceremonyStorage, 'ceremony resume wrote family storage')
  assert(resumed.mic.sourceCount === 1 && resumed.mic.gumCalls === 1 && resumed.mic.matchingCalls === 1,
    'VOICE resume did not preserve exactly one inherited source')

  await page.waitForFunction(() => {
    const formation = JSON.parse(document.querySelector('canvas')?.dataset.retroFormationState || '{}')
    return formation.activeAttack?.phase === 'outbound'
  }, null, { timeout: 20_000, polling: 'raf' })
  const resumeAttack = (await voiceState()).formation.activeAttack
  await page.evaluate(frequency => {
    window.__r8SetFrequency(frequency)
    window.__r8SetGain(0.55)
  }, noteFrequency(resumeAttack.note))
  await page.waitForFunction(attackId => {
    const canvas = document.querySelector('canvas')
    const formation = JSON.parse(canvas?.dataset.retroFormationState || '{}')
    const mic = JSON.parse(canvas?.dataset.retroMicAuthority || '{}')
    const meter = document.querySelector('[data-retro-vocal-meter]')
    const fill = meter?.querySelector('.h-full.rounded-full')
    return formation.activeAttack?.attackId === attackId && mic.signalActive === true &&
      Boolean(meter && getComputedStyle(meter).display !== 'none') && Number.parseFloat(fill?.style.width || '0') > 0
  }, resumeAttack.attackId, { timeout: 2500, polling: 'raf' })
  const resumedLiveMeter = await voiceState()
  await page.evaluate(() => window.__r8SetGain(0))
  assert(resumedLiveMeter.vocalMeter.present && resumedLiveMeter.vocalMeter.visible && resumedLiveMeter.vocalMeter.widthPct > 0,
    'protected live meter did not function immediately after ceremony resume')
  assert(resumedLiveMeter.mic.sourceCount === 1 && resumedLiveMeter.mic.matchingCalls === 1,
    'VOICE meter resume used a duplicate source')
  assert(resumedLiveMeter.reducedMotion === true && resumedLiveMeter.colorHintsLabel === 'COLOR HINTS OFF',
    'reduced-motion/color-hints-off parity regressed after resume')
  assert(resumedLiveMeter.gainRanges.length === 0, 'R14 gain controls appeared after ceremony resume')
  await capture('02-voice-resumed-live-meter.png')
  await finishSegment(ceremonySegment)

  assert(pageErrors.length === 0, `page errors: ${pageErrors.join('; ')}`)
  const videoPath = await page.video().path()
  const result = {
    verdict: 'PASS', lane, transport, mode, url, deployedSha, pageErrors, beforeGameplayStorage, ceremonyStorage,
    behaviorManifest, videoPath, startState, earned, ceremonyEntry, ceremonyHeld, resumed, resumedLiveMeter,
    contract: {
      voiceResume: 'PASS - exactly one inherited live source before, during, and after NEW SIGNAL; protected meter resumed on the next real demand',
      micBaselines: {
        oneStartListeningTransition: 'PASS - one getUserMedia, one matched MediaStreamSource, one live source',
        isActiveAuthority: 'PASS - runtime mic authority and visible meter require signalActive=true; no settled-state proxy',
        octaveFoldedTolerance: 'PASS - one-octave +60-cent injected frequency acquired authority and resolved correct inside inherited +/-70-cent law',
        postToneSuppression: `PASS - signal authority remained false at ${earned.suppressionReceipt.toneAgeMs.toFixed(2)}ms after the inherited tone`,
        visibleProofOfHearing: `PASS - protected meter reached ${resumedLiveMeter.vocalMeter.widthPct}% immediately after ceremony resume`,
      },
      pacing,
      ceremonyDemandTimestamps: 'PASS - byte-identical during ceremony; next wave reset to zero',
      ceremonyPersistence: 'PASS - storage byte-identical from ceremony entry through next-wave resume',
      accessibilityParity: 'PASS - prefers-reduced-motion active and COLOR HINTS OFF before and after ceremony',
      gains: 'deferred-r14 - zero cabinet range controls',
      jonEar: 'pending-act-boundary',
      r8c: 'PASS - VOICE remains guided and mask-inactive; no blind SIGNAL CHECK is exercised',
      r8cVoiceOpportunity: 'PASS - first observed wave-2+ opportunity was guided-voice with mask inactive',
    },
  }
  writeFileSync(resolve(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
}

try {
  if (mode === 'voice') {
    await runVoiceProof()
    complete = true
    console.log(`PASS R8b VOICE resume proof: ${lane}/${mode}; ${behaviorManifest.length} sustained behaviors; 0 page errors`)
  } else {
  await freshGame()
  const beforeGameplayStorage = await storageSnapshot()
  const approach = await startSegment('real-unlock-to-new-signal')
  const correctAnswers = await answerUntilCeremony()
  assert(correctAnswers >= 10, `NEW SIGNAL arrived after only ${correctAnswers} correct answers`)
  await page.waitForFunction(() => window.__r8DidAutoBlur === true, null, { timeout: 5000 })
  const preAckBefore = (await state()).formationRaw
  const preAckSegment = await startSegment('pre-ack-hidden-freeze')
  await finishSegment(preAckSegment)
  assert((await state()).formationRaw === preAckBefore, 'pre-ack hidden ceremony did not freeze exactly')
  await page.evaluate(() => window.__setR8Activity('visible', true))
  await page.waitForFunction(() => {
    try { return JSON.parse(document.querySelector('canvas')?.dataset.retroFormationState || '{}').introductionCeremony?.toneStatus === 'blocked' } catch { return false }
  }, null, { timeout: 5000 })
  const blocked = await state()
  assert(blocked.ceremony?.heading === 'NEW SIGNAL', 'accessible NEW SIGNAL heading missing')
  assert(blocked.ceremony?.live === 'polite', 'ceremony status is not aria-live polite')
  assert(blocked.ceremony?.note === 'D4', `first introduced signal was ${blocked.ceremony?.note}, expected D4`)
  assert(blocked.ceremony?.text.includes('SIGNAL PATH NOT READY'), 'returned blocked ceremony retained stale paused copy')
  assert(blocked.ceremony?.actions.length === 3, 'ceremony does not expose exactly three actions')
  assert(blocked.ceremony.actions.every(action => action.height >= 44), 'ceremony has a sub-44px action')
  await finishSegment(approach)

  const ceremonyStorage = await storageSnapshot()
  const frozenBefore = (await state()).formationRaw
  await page.keyboard.press('Space')
  await page.keyboard.press('1')
  await page.keyboard.press('R')
  await page.waitForTimeout(500)
  const frozenAfter = (await state()).formationRaw
  assert(frozenAfter === frozenBefore, 'gameplay keys mutated blocked ceremony state')
  assert(await storageSnapshot() === ceremonyStorage, 'ceremony gameplay keys wrote family storage')

  const blockedSegment = await startSegment('blocked-output-freeze-and-responsive-actions')
  for (const [name, width, height, compactContract] of [
    ['portrait-390x844', 390, 844, true],
    ['landscape-844x390', 844, 390, true],
    ['desktop-1280x800', 1280, 800, false],
    ['zoom-200-equivalent-640x400', 640, 400, true],
  ]) {
    await page.setViewportSize({ width, height })
    await page.waitForTimeout(180)
    const layout = await state()
    assert(layout.horizontalOverflow <= 1, `${name} horizontal overflow ${layout.horizontalOverflow}px`)
    assert(layout.ceremony?.actions.every(action => action.insideRegion && action.insideViewport), `${name} clips a ceremony action`)
    assert(layout.ceremony?.actions.every(action => action.height >= 44), `${name} has a sub-44px ceremony action`)
    const geometry = layout.ceremony?.geometry
    assert(geometry && Number.isFinite(geometry.toastClearance), `${name} did not expose rendered toast/canvas-copy geometry`)
    assert(geometry && Number.isFinite(geometry.panelBorderClearance), `${name} did not expose rendered panel/action geometry`)
    assert(geometry && Number.isFinite(geometry.preflightEffectiveFontPx), `${name} did not expose rendered PRE-FLIGHT size`)
    if (compactContract) {
      if (geometry.toastClearance < 2) responsiveFailures.push(
        `${name} toastClearance=${geometry.toastClearance.toFixed(2)}px (minimum 2px)`,
      )
      if (geometry.panelBorderClearance < 1) responsiveFailures.push(
        `${name} panelBorderClearance=${geometry.panelBorderClearance.toFixed(2)}px (minimum 1px)`,
      )
      if (geometry.preflightEffectiveFontPx < 9) responsiveFailures.push(
        `${name} PRE-FLIGHT=${geometry.preflightEffectiveFontPx.toFixed(2)}px (minimum 9px)`,
      )
      if (!layout.ceremony.actions.every(action => action.insidePanel)) responsiveFailures.push(
        `${name} places an action outside the rendered ceremony panel`,
      )
    }
    responsive.push({ name, viewport: layout.viewport, rect: layout.ceremony?.rect, actions: layout.ceremony?.actions, geometry })
    await capture(`responsive-${name}.png`, { fullPage: true })
  }
  assert(responsiveFailures.length === 0, `responsive ceremony geometry failed: ${responsiveFailures.join('; ')}`)
  await page.setViewportSize({ width: 1280, height: 800 })
  await finishSegment(blockedSegment)
  await capture('01-new-signal-blocked.png')

  if (mode === 'quit') {
    const startsBeforeQuitRetry = (await state()).bufferStarts
    await page.evaluate(() => { window.__r8HoldPianoReload = true })
    await page.getByRole('button', { name: 'RETRY SIGNAL' }).click()
    await page.waitForFunction(() => window.__r8HeldPianoFetchCount > 0)
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas')
      const sentinel = JSON.stringify({ sequence: 999999, guard: 'cleanup-sentinel' })
      document.documentElement.dataset.retroAudioReceipt = sentinel
      if (canvas) canvas.dataset.retroAudioReceipt = sentinel
      window.__r8QuitCanvas = canvas
    })
    await page.getByRole('button', { name: 'QUIT' }).click()
    await page.getByRole('button', { name: 'INSERT COIN' }).waitFor()
    await page.evaluate(() => window.__r8ReleasePianoReload())
    const quitSegment = await startSegment('ceremony-quit-no-resurrection')
    await finishSegment(quitSegment)
    const afterQuit = await state()
    assert(afterQuit.menu && !afterQuit.ceremony, 'ceremony resurrected after QUIT')
    assert(afterQuit.bufferStarts === startsBeforeQuitRetry, 'in-flight retry played a stale tone after QUIT')
    const cleanup = await page.evaluate(() => ({
      rootPresent: Object.prototype.hasOwnProperty.call(document.documentElement.dataset, 'retroAudioReceipt'),
      priorCanvasPresent: Object.prototype.hasOwnProperty.call(window.__r8QuitCanvas?.dataset || {}, 'retroAudioReceipt'),
      priorCanvasConnected: window.__r8QuitCanvas?.isConnected ?? null,
    }))
    assert(!cleanup.rootPresent && !cleanup.priorCanvasPresent,
      `ceremony QUIT retained the audio receipt: ${JSON.stringify(cleanup)}`)
    assert(await storageSnapshot() === ceremonyStorage, 'ceremony QUIT wrote family storage')
    await capture('02-ceremony-quit-clean.png')
    responsive.push({ name: 'ceremony-quit-receipt-cleanup', cleanup })
  } else {
    const startsBeforeRetry = (await state()).bufferStarts
    await page.evaluate(() => { window.__r8ForceSuspended = false })
    await page.getByRole('button', { name: 'RETRY SIGNAL' }).click()
    await page.waitForFunction(() => {
      try { return JSON.parse(document.querySelector('canvas')?.dataset.retroFormationState || '{}').introductionCeremony?.toneStatus === 'acknowledged' } catch { return false }
    }, null, { timeout: 10_000 })
    const acknowledged = await state()
    assert(acknowledged.bufferStarts === startsBeforeRetry + 1, 'successful retry did not dispatch exactly one reference tone')

    await page.evaluate(() => window.__setR8Activity('hidden', false))
    const frozenAcknowledged = (await state()).formationRaw
    const blurSegment = await startSegment('post-ack-hidden-freeze')
    await finishSegment(blurSegment)
    assert((await state()).formationRaw === frozenAcknowledged, 'post-ack hidden ceremony did not freeze exactly')
    await capture('02-new-signal-acknowledged-hidden.png')

    await page.evaluate(() => {
      const proof = window.__r8TemporalConsistency
      proof.active = true
      proof.sampleCount = 0
      proof.mutationSampleCount = 0
      proof.mutationRecordCount = 0
      proof.mismatches = []
      window.__r8SampleTemporalConsistency('armed')
      window.__setR8Activity('visible', true)
    })
    const resumeSegment = await startSegment('acknowledged-resume-to-one-next-wave')
    await page.waitForFunction(() => {
      try {
        const formation = JSON.parse(document.querySelector('canvas')?.dataset.retroFormationState || '{}')
        return formation.phase === 'playing' && formation.wave >= 5 && !formation.introductionCeremony
      } catch { return false }
    }, null, { timeout: 10_000 })
    temporalConsistency = await page.evaluate(() => {
      window.__r8SampleTemporalConsistency('playing-observed')
      window.__r8TemporalConsistency.active = false
      return { ...window.__r8TemporalConsistency }
    })
    temporalConsistency.status = temporalConsistency.mismatches.length === 0 ? 'PASS' : 'FAIL'
    assert(temporalConsistency.mutationSampleCount > 0, 'ceremony-to-playing mutation watcher observed no transition mutations')
    assert(temporalConsistency.mismatches.length === 0,
      `ceremony-to-playing temporal contradiction: ${JSON.stringify(temporalConsistency.mismatches[0])}`)
    assert(await storageSnapshot() === ceremonyStorage, 'NEW SIGNAL ceremony changed family storage')
    await finishSegment(resumeSegment)
    await capture('03-next-wave-resumed.png')
  }

  assert(pageErrors.length === 0, `page errors: ${pageErrors.join('; ')}`)
  const videoPath = await page.video().path()
  const result = {
    verdict: 'PASS', lane, transport, mode, url, deployedSha, pageErrors,
    correctAnswers, beforeGameplayStorage, ceremonyStorage, responsive, temporalConsistency, behaviorManifest, videoPath,
    contract: {
      firstSignal: 'D4 after >=10 real correct attacks',
      blockedOutput: 'PASS - forced suspended observer produced blocked elapsed-zero ceremony',
      keyInertness: 'PASS - whole exposed engine snapshot and family storage exact',
      hiddenFreeze: mode === 'standard' ? 'PASS - acknowledged ceremony whole snapshot exact for >=6s' : 'not-run-in-quit-mode',
      toneDispatch: mode === 'standard' ? 'PASS - exactly one AudioBufferSource start on retry' : 'not-run-in-quit-mode',
      ceremonyToPlayingAtomicity: mode === 'standard'
        ? `PASS - ${temporalConsistency.mismatches.length} mismatches across ${temporalConsistency.mutationSampleCount} mutation samples`
        : 'not-run-in-quit-mode',
      quitCleanup: mode === 'quit' ? 'PASS - menu stable for >=6s, no state resurrection or storage write' : 'covered by native quit lane',
      r8c: 'CLOSED - no SIGNAL CHECK behavior exercised',
    },
  }
  writeFileSync(resolve(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
  complete = true
  console.log(`PASS R8b browser proof: ${lane}/${mode}; ${behaviorManifest.length} sustained behaviors; 0 page errors`)
  }
} catch (error) {
  const result = { verdict: 'FAIL', lane, transport, mode, url, deployedSha, pageErrors, responsive, responsiveFailures, temporalConsistency, behaviorManifest, error: String(error?.stack || error) }
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
  if (!contextClosed) console.error(`${lane}: proof context close timed out; disconnecting runner only`)
  if (!connected) await browser.close()
  else {
    if (!complete) console.error(`${lane}: connected browser left running after proof failure`)
    process.exit(process.exitCode ?? 0)
  }
}
