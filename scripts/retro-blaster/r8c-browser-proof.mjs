import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const [mode = 'core', rawUrl, rawOutput, rawSha] = process.argv.slice(2)
const url = rawUrl || 'http://127.0.0.1:3336/pitch-defender/retro-2?v=840efc3b'
const output = resolve(rawOutput || `data/retro-blaster-rework/runtime-logs/r9a-local-840efc3b/r8c-${mode}`)
const videoDir = resolve(output, 'video')
const productBase = rawSha || '840efc3b91111cda7657f33aad92f8019b90d3f4'
const transport = 'http://127.0.0.1:9224'
const NOTES = ['C4', 'A4', 'G4', 'E4']
const EXPECTED_HASHES = {
  engine: '201C37698C81277184BC38DC73BAB7E3372EF22A43949E07BFE2B607DD598A0E',
  shell: '579F1990C42DB09F61F77141B47357EC8310D4047FA4B6D08AA91594F0A4E317',
  renderer: '109BD3EDC642B17CD30E5C5B804BE60BC673604EB69793D7F95764AB51D8D1D3',
}
const SOURCE_PATHS = {
  engine: 'src/components/PitchDefender/retroBlasterEngine.ts',
  shell: 'src/components/PitchDefender/RetroBlasterII.tsx',
  renderer: 'src/components/PitchDefender/retroBlasterRenderer.ts',
}

mkdirSync(videoDir, { recursive: true })

function sha256(path) {
  return createHash('sha256').update(readFileSync(resolve(path))).digest('hex').toUpperCase()
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const sourceHashes = Object.fromEntries(Object.entries(SOURCE_PATHS).map(([key, path]) => [key, sha256(path)]))
for (const [key, expected] of Object.entries(EXPECTED_HASHES)) {
  assert(sourceHashes[key] === expected, `${key} hash drifted: ${sourceHashes[key]} != ${expected}`)
}

const initHarness = () => {
  let forcedVisibility = 'visible'
  let forcedFocus = true
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => forcedVisibility })
  Object.defineProperty(document, 'hasFocus', { configurable: true, value: () => forcedFocus })
  window.__r8cSetActivity = (visibility, focused) => {
    forcedVisibility = visibility
    forcedFocus = focused
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event(focused ? 'focus' : 'blur'))
  }

  const parse = (raw, fallback = null) => {
    try { return JSON.parse(raw || '') } catch { return fallback }
  }
  const now = () => performance.now()
  const trace = window.__r8cTrace = {
    startedAt: now(),
    frame: 0,
    receipts: [],
    sourceStarts: [],
    storageWrites: [],
    signalSamples: [],
    maskSamples: [],
    formationLabels: [],
    scoreSamples: [],
    ackDrops: [],
  }
  window.__r8cResetTrace = () => {
    trace.startedAt = now()
    trace.receipts = []
    trace.sourceStarts = []
    trace.storageWrites = []
    trace.signalSamples = []
    trace.maskSamples = []
    trace.formationLabels = []
    trace.scoreSamples = []
    trace.ackDrops = []
  }

  const frame = () => {
    trace.frame += 1
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)

  const nativeSetItem = Storage.prototype.setItem
  Storage.prototype.setItem = function(key, value) {
    trace.storageWrites.push({ atMs: now(), frame: trace.frame, key: String(key), value: String(value) })
    return nativeSetItem.call(this, key, value)
  }

  const receipt = () => parse(document.documentElement?.dataset.retroAudioReceipt, null)
  const installObservers = () => {
    if (!document.documentElement) return
    new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.target === document.documentElement && mutation.attributeName === 'data-retro-audio-receipt') {
          trace.receipts.push({ atMs: now(), frame: trace.frame, value: receipt() })
        }
        if (mutation.attributeName === 'data-retro-signal-check') {
          const value = parse(mutation.target.getAttribute('data-retro-signal-check'), null)
          trace.signalSamples.push({ atMs: now(), frame: trace.frame, value })
        }
        if (mutation.attributeName === 'data-retro-identity-mask') {
          trace.maskSamples.push({
            atMs: now(), frame: trace.frame,
            node: mutation.target.tagName?.toLowerCase() || 'unknown',
            value: mutation.target.getAttribute('data-retro-identity-mask'),
          })
        }
      }
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-retro-audio-receipt', 'data-retro-signal-check', 'data-retro-identity-mask'],
      childList: true,
      subtree: true,
    })
  }
  if (document.documentElement) installObservers()
  else addEventListener('DOMContentLoaded', installObservers, { once: true })

  const hookRefs = () => {
    const host = document.querySelector('[data-retro-cabinet]') || document.querySelector('[data-retro-readiness]') || document.body
    const key = host && Object.keys(host).find(name => name.startsWith('__reactFiber$'))
    const refs = []
    const seen = new Set()
    let fiber = key ? host[key] : null
    while (fiber) {
      for (const candidate of [fiber, fiber.alternate]) {
        if (!candidate || seen.has(candidate)) continue
        seen.add(candidate)
        let hook = candidate.memoizedState
        let guard = 0
        while (hook && guard++ < 160) {
          const value = hook.memoizedState
          if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'current')) refs.push(value)
          hook = hook.next
        }
      }
      fiber = fiber.return
    }
    return refs
  }
  window.__r8cDropPendingAck = requestId => {
    const ref = hookRefs().find(item => item.current?.requestId === requestId && item.current?.dispatched === true)
    if (!ref) return false
    ref.current = null
    trace.ackDrops.push({ atMs: now(), frame: trace.frame, requestId })
    return true
  }
  window.__r8cClearEarStoreRef = () => {
    const ref = hookRefs().find(item => item.current && typeof item.current === 'object' &&
      Object.prototype.hasOwnProperty.call(item.current, 'ear') && Object.prototype.hasOwnProperty.call(item.current, 'voice'))
    if (!ref) return false
    ref.current.ear = {}
    return true
  }
  window.__r8cSetShields = value => {
    const ref = hookRefs().find(item => item.current && typeof item.current === 'object' &&
      Array.isArray(item.current.aliens) && typeof item.current.gameId === 'string' && typeof item.current.cityHealth === 'number')
    if (!ref) return false
    ref.current.cityHealth = value
    return true
  }
  window.__r8cArmSyntheticReceipt = () => {
    const canvas = document.querySelector('canvas')
    const value = JSON.stringify({ sequence: 999999, kind: 'piano', note: 'C4', guard: 'cleanup-sentinel' })
    document.documentElement.dataset.retroAudioReceipt = value
    if (canvas) canvas.dataset.retroAudioReceipt = value
    window.__r8cCleanupCanvas = canvas
  }
  window.__r8cCleanupState = () => ({
    rootPresent: Object.prototype.hasOwnProperty.call(document.documentElement.dataset, 'retroAudioReceipt'),
    liveCanvasPresent: Object.prototype.hasOwnProperty.call(document.querySelector('canvas')?.dataset || {}, 'retroAudioReceipt'),
    priorCanvasPresent: Object.prototype.hasOwnProperty.call(window.__r8cCleanupCanvas?.dataset || {}, 'retroAudioReceipt'),
    priorCanvasConnected: window.__r8cCleanupCanvas?.isConnected ?? null,
  })

  window.__r8cDropNextBlindAck = false
  window.__r8cQuitOnNextBlindStart = false
  const nativeBufferStart = AudioBufferSourceNode.prototype.start
  AudioBufferSourceNode.prototype.start = function(...args) {
    const current = receipt()
    trace.sourceStarts.push({
      atMs: now(), frame: trace.frame, type: 'buffer',
      duration: this.buffer?.duration ?? null,
      playbackRate: this.playbackRate?.value ?? null,
      receipt: current,
    })
    if (current?.guard === 'blind-stimulus' && window.__r8cDropNextBlindAck) {
      window.__r8cDropNextBlindAck = false
      queueMicrotask(() => {
        if (window.__r8cDropPendingAck(current.requestId)) return
        setTimeout(() => window.__r8cDropPendingAck(current.requestId), 0)
      })
    }
    if (current?.guard === 'blind-stimulus' && window.__r8cQuitOnNextBlindStart) {
      window.__r8cQuitOnNextBlindStart = false
      document.querySelector('[data-retro-cabinet]')?.parentElement
        ?.querySelector('button:not([disabled])')
      const quit = [...document.querySelectorAll('button')].find(button => button.textContent?.trim() === 'QUIT')
      quit?.click()
    }
    return nativeBufferStart.apply(this, args)
  }

  const nativeOscillatorStart = OscillatorNode.prototype.start
  OscillatorNode.prototype.start = function(...args) {
    trace.sourceStarts.push({
      atMs: now(), frame: trace.frame, type: 'oscillator',
      frequency: this.frequency?.value ?? null,
      receipt: receipt(),
    })
    return nativeOscillatorStart.apply(this, args)
  }

  const nativeFillText = CanvasRenderingContext2D.prototype.fillText
  CanvasRenderingContext2D.prototype.fillText = function(text, x, y, maxWidth) {
    const label = String(text)
    if (/^SCORE\s+\d+$/i.test(label)) {
      trace.scoreSamples.push({ atMs: now(), frame: trace.frame, score: Number(label.match(/\d+/)?.[0] || 0) })
    }
    const mask = document.querySelector('[data-retro-identity-mask="active"]') ||
      document.querySelector('canvas[data-retro-identity-mask="active"]')
    if (mask && y < 260 && /^[A-G](?:#)?$/i.test(label) && trace.formationLabels.length < 5000) {
      trace.formationLabels.push({ atMs: now(), frame: trace.frame, text: label, x, y })
    }
    return maxWidth === undefined
      ? nativeFillText.call(this, text, x, y)
      : nativeFillText.call(this, text, x, y, maxWidth)
  }

  const NativeAudioContext = window.AudioContext || window.webkitAudioContext
  let owner = NativeAudioContext.prototype
  let descriptor = Object.getOwnPropertyDescriptor(owner, 'state')
  while (!descriptor && owner) {
    owner = Object.getPrototypeOf(owner)
    descriptor = owner ? Object.getOwnPropertyDescriptor(owner, 'state') : null
  }
  window.__r8cForceSuspended = false
  if (owner && descriptor?.get) {
    Object.defineProperty(owner, 'state', {
      ...descriptor,
      get() { return window.__r8cForceSuspended ? 'suspended' : descriptor.get.call(this) },
    })
  }
}

let complete = false
const browser = await chromium.connectOverCDP(transport, { timeout: 60_000 })
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  reducedMotion: 'reduce',
  recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
})
const page = await context.newPage()
await page.addInitScript(initHarness)
const pageErrors = []
page.on('pageerror', error => pageErrors.push(error.message))

function reviewedStore() {
  const now = Date.now()
  return Object.fromEntries(NOTES.map((note, index) => [note, {
    note, S: 4 + index, D: 5, due: now + 86_400_000,
    lastReview: now - 86_400_000, lapses: 0, phase: 'review', learningReps: 2,
  }]))
}

async function snapshot() {
  return page.evaluate(() => {
    const parse = (raw, fallback = null) => { try { return JSON.parse(raw || '') } catch { return fallback } }
    const canvas = document.querySelector('canvas')
    const shell = document.querySelector('[data-retro-active-lane]')
    const rect = canvas?.getBoundingClientRect()
    const replay = [...document.querySelectorAll('button')].find(button =>
      button.textContent?.includes('REPLAY') || button.textContent?.includes('PLAY NOTE'))
    const responseButtons = [...document.querySelectorAll('[data-retro-response-button]')].map(button => {
      const buttonRect = button.getBoundingClientRect()
      return {
        note: button.getAttribute('data-note'),
        ariaLabel: button.getAttribute('aria-label'),
        disabled: button.disabled,
        x: buttonRect.x,
        y: buttonRect.y,
        width: buttonRect.width,
        height: buttonRect.height,
        right: buttonRect.right,
        bottom: buttonRect.bottom,
      }
    })
    const trace = window.__r8cTrace
    return {
      url: location.href,
      formationRaw: canvas?.dataset.retroFormationState || '',
      formation: parse(canvas?.dataset.retroFormationState, {}),
      signalCheck: parse(canvas?.dataset.retroSignalCheck || shell?.getAttribute('data-retro-signal-check'), {}),
      mask: canvas?.dataset.retroIdentityMask || shell?.getAttribute('data-retro-identity-mask') || null,
      instruction: document.querySelector('[data-retro-instruction]')?.textContent?.replace(/\s+/g, ' ').trim() || null,
      helper: document.querySelector('[data-retro-helper]')?.textContent?.replace(/\s+/g, ' ').trim() || null,
      replay: replay ? {
        text: replay.textContent?.replace(/\s+/g, ' ').trim(),
        disabled: replay.disabled,
        ariaLabel: replay.getAttribute('aria-label'),
      } : null,
      responseButtons,
      receipt: parse(document.documentElement.dataset.retroAudioReceipt, null),
      receiptPresence: {
        root: Object.prototype.hasOwnProperty.call(document.documentElement.dataset, 'retroAudioReceipt'),
        canvas: Object.prototype.hasOwnProperty.call(canvas?.dataset || {}, 'retroAudioReceipt'),
      },
      score: trace.scoreSamples.at(-1)?.score ?? null,
      storage: {
        ear: localStorage.getItem('pitch_fsrs_memory_ear'),
        voice: localStorage.getItem('pitch_fsrs_memory'),
      },
      trace: structuredClone(trace),
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      canvasRect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom } : null,
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      colorHints: document.querySelector('[data-retro-color-hints]')?.textContent?.replace(/\s+/g, ' ').trim() || null,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      menu: [...document.querySelectorAll('button')].some(button => button.textContent?.trim() === 'INSERT COIN'),
      gameOver: document.body.textContent?.includes('GAME OVER') || false,
    }
  })
}

async function capture(name, fullPage = true) {
  await page.bringToFront()
  await page.waitForTimeout(80)
  await page.screenshot({ path: resolve(output, name), fullPage })
}

async function resetTrace() {
  await page.evaluate(() => window.__r8cResetTrace())
}

async function freshEarGame({ reviewed = true, colorHints = false, reducedMotion = 'reduce', tutorialSeen = true } = {}) {
  await page.emulateMedia({ reducedMotion })
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 })
  await page.evaluate(({ reviewed, colorHints, tutorialSeen, store }) => {
    localStorage.clear()
    if (tutorialSeen) localStorage.setItem('retro_tutorial_seen', '1')
    localStorage.setItem('retro_blaster_color_hints', colorHints ? '1' : '0')
    localStorage.setItem('retro_difficulty', 'easy')
    if (reviewed) localStorage.setItem('pitch_fsrs_memory_ear', JSON.stringify(store))
  }, { reviewed, colorHints, tutorialSeen, store: reviewedStore() })
  await page.reload({ waitUntil: 'networkidle', timeout: 60_000 })
  await page.getByRole('button', { name: 'INSERT COIN' }).click()
  if (!tutorialSeen) return
  await page.locator('[data-retro-readiness][data-readiness-lane="ear"]').waitFor({ timeout: 30_000 })
  await page.waitForFunction(() => ['awaiting-ear', 'audio-error'].includes(
    document.querySelector('[data-retro-readiness]')?.getAttribute('data-readiness-status'),
  ), null, { timeout: 30_000 })
  if (await page.locator('[data-retro-readiness]').getAttribute('data-readiness-status') === 'audio-error') {
    await page.getByRole('button', { name: 'RETRY AUDIO' }).click()
    await page.waitForFunction(() =>
      document.querySelector('[data-retro-readiness]')?.getAttribute('data-readiness-status') === 'awaiting-ear',
    null, { timeout: 30_000 })
  }
  await page.locator('[data-retro-readiness] .grid button').nth(0).click()
  await page.locator('[data-retro-cabinet]').waitFor({ timeout: 30_000 })
}

async function answerAttack(attack, correct = true) {
  const index = NOTES.indexOf(attack.note)
  assert(index >= 0, `attack note ${attack.note} is outside four-note opening`)
  const key = correct ? String(index + 1) : String(((index + 1) % NOTES.length) + 1)
  await page.keyboard.press(key)
}

async function advanceToWave2({ clearEarBeforeWave2 = false } = {}) {
  const deadline = Date.now() + 180_000
  const answered = new Set()
  let cleared = false
  while (Date.now() < deadline) {
    const state = await snapshot()
    if (state.formation.wave >= 2) return state
    const attack = state.formation.activeAttack
    const alive = state.formation.ships?.filter(ship => ship.alive).length ?? 0
    if (attack?.phase === 'outbound' && !answered.has(attack.attackId)) {
      answered.add(attack.attackId)
      await answerAttack(attack, true)
      if (clearEarBeforeWave2 && alive === 1) {
        await page.waitForFunction(attackId => {
          try {
            return JSON.parse(document.querySelector('canvas')?.dataset.retroFormationState || '{}')
              .activeAttack?.attackId === attackId &&
              JSON.parse(document.querySelector('canvas')?.dataset.retroFormationState || '{}')
                .activeAttack?.outcome === 'correct'
          } catch { return false }
        }, attack.attackId, { timeout: 5000, polling: 'raf' })
        cleared = await page.evaluate(() => window.__r8cClearEarStoreRef())
        assert(cleared, 'could not clear the in-memory EAR store before wave-2 snapshot')
      }
      continue
    }
    await page.waitForTimeout(20)
  }
  throw new Error('timed out reaching wave 2')
}

async function waitForAttack(predicate, timeout = 30_000) {
  await page.waitForFunction(predicate, null, { timeout, polling: 'raf' })
  return snapshot()
}

function receiptSequence(trace) {
  const values = trace.receipts.map(row => row.value?.sequence).filter(Number.isFinite)
  for (let index = 1; index < values.length; index += 1) {
    assert(values[index] === values[index - 1] + 1,
      `audio receipt sequence gap ${values[index - 1]} -> ${values[index]}`)
  }
  return values
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

function verifyBlindOutbound(state) {
  const attack = state.formation.activeAttack
  assert(attack?.cuePolicy === 'blind' && attack.phase === 'outbound', 'blind attack did not reach outbound')
  assert(state.mask === 'active' && state.signalCheck.maskActive === true, 'identity mask was not active outbound')
  assert(attack.stimulusRequest, 'outbound blind attack lost its stimulus request')
  assert(attack.demandAtMs !== null && attack.deadlineAtMs - attack.demandAtMs === 2000,
    'blind response window is not the full 2000ms')
  const delta = attack.demandAtMs - attack.stimulusRequest.requestedAtDirectorClockMs
  assert(delta >= 0 && delta <= 50, `dispatch-to-demand delta ${delta}ms is outside 0..50ms`)
  assert(state.instruction?.includes('PRESS THE MATCHING KEY') && state.helper?.includes('REPLAY LOCKED'),
    'SIGNAL CHECK copy is not truthful during blind response')
  assert(state.responseButtons.length === 4 && state.responseButtons.every(button => button.disabled === false),
    'blind response controls were not visibly armed with the answer invitation')
  assert(state.replay?.disabled === true && state.replay?.text?.includes('REPLAY LOCKED'),
    'blind replay is not native-disabled with truthful copy')
  const blindStarts = state.trace.sourceStarts.filter(row => row.type === 'buffer' && row.receipt?.guard === 'blind-stimulus')
  assert(blindStarts.length === 1, `expected one blind buffer start, saw ${blindStarts.length}`)
  assert(blindStarts[0].receipt.requestId === attack.stimulusRequest.requestId,
    'blind source start is not bound to the active request')
  assert(state.trace.formationLabels.length === 0,
    `formation-region note label leaked while masked: ${JSON.stringify(state.trace.formationLabels[0])}`)
  return { attack, delta, blindStart: blindStarts[0], pacing: pacingReceipt(state.formation) }
}

async function waitForOutcome(attackId, outcome, timeout = 8000) {
  await page.waitForFunction(({ attackId, outcome }) => {
    try {
      const formation = JSON.parse(document.querySelector('canvas')?.dataset.retroFormationState || '{}')
      return formation.activeAttack?.attackId === attackId && formation.activeAttack?.outcome === outcome
    } catch { return false }
  }, { attackId, outcome }, { timeout, polling: 'raf' })
  return snapshot()
}

async function genuineZoomReceipt() {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.bringToFront()
  const originalTitle = await page.title()
  await page.evaluate(() => { document.title = 'R8C HELIUM PROOF ZOOM' })
  const sendHeliumKeys = keys => {
    const commands = keys.map(key => key === 'reset'
      ? "$shell.SendKeys('^0')"
      : "$shell.SendKeys('^{+}')")
    const script = [
      "$shell = New-Object -ComObject WScript.Shell",
      "if (-not $shell.AppActivate('R8C HELIUM PROOF ZOOM')) { exit 2 }",
      'Start-Sleep -Milliseconds 180',
      ...commands.flatMap(command => [command, 'Start-Sleep -Milliseconds 140']),
    ].join('; ')
    execFileSync('powershell.exe', ['-NoProfile', '-Command', script], { stdio: 'pipe' })
  }
  const read = () => page.evaluate(() => {
    const geometry = selector => {
      const element = document.querySelector(selector)
      if (!element) return null
      const rect = element.getBoundingClientRect()
      return {
        x: rect.x, y: rect.y, width: rect.width, height: rect.height,
        right: rect.right, bottom: rect.bottom,
        clientWidth: element.clientWidth, scrollWidth: element.scrollWidth,
      }
    }
    const responseButtons = [...document.querySelectorAll('[data-retro-response-button]')].map(button => {
      const rect = button.getBoundingClientRect()
      return {
        note: button.getAttribute('data-note'), disabled: button.disabled,
        x: rect.x, y: rect.y, width: rect.width, height: rect.height,
        right: rect.right, bottom: rect.bottom,
      }
    })
    return {
      innerWidth, innerHeight, dpr: devicePixelRatio,
      visualViewport: visualViewport ? { width: visualViewport.width, height: visualViewport.height, scale: visualViewport.scale } : null,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      layout: {
        document: { clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
        instructionRail: geometry('[data-retro-instruction-rail]'),
        instruction: geometry('[data-retro-instruction]'),
        helper: geometry('[data-retro-helper]'),
        cabinet: geometry('[data-retro-cabinet]'),
        canvas: geometry('canvas'),
        responseButtons,
      },
    }
  })
  sendHeliumKeys(['reset'])
  await page.waitForTimeout(220)
  const before = await read()
  let presses = 0
  let zoomed = before
  while (zoomed.dpr < before.dpr * 1.95 && presses < 15) {
    sendHeliumKeys(['plus'])
    presses += 1
    await page.waitForTimeout(220)
    zoomed = await read()
  }
  assert(zoomed.dpr >= before.dpr * 1.95 && zoomed.dpr <= before.dpr * 2.05,
    `genuine zoom did not reach exactly 200% (${before.dpr} -> ${zoomed.dpr})`)
  assert(zoomed.overflow <= 1, `genuine 200% zoom introduced ${zoomed.overflow}px horizontal overflow`)
  assert(zoomed.layout.document.scrollWidth <= zoomed.layout.document.clientWidth + 1,
    `genuine 200% zoom document width escaped: ${JSON.stringify(zoomed.layout.document)}`)
  for (const [name, box] of Object.entries(zoomed.layout).filter(([name]) => name !== 'document' && name !== 'responseButtons')) {
    if (!box) continue
    assert(box.scrollWidth <= box.clientWidth + 1, `genuine 200% zoom ${name} content overflowed: ${JSON.stringify(box)}`)
    assert(box.x >= -1 && box.right <= zoomed.innerWidth + 1,
      `genuine 200% zoom ${name} escaped viewport: ${JSON.stringify(box)}`)
  }
  assert(zoomed.layout.responseButtons.length === NOTES.length,
    `genuine 200% zoom expected ${NOTES.length} EAR response buttons, saw ${zoomed.layout.responseButtons.length}`)
  for (const button of zoomed.layout.responseButtons) {
    assert(button.width >= 44 && button.height >= 44,
      `genuine 200% zoom ${button.note} tap target is ${button.width}x${button.height}`)
    assert(button.x >= -1 && button.right <= zoomed.innerWidth + 1,
      `genuine 200% zoom ${button.note} tap target escaped viewport: ${JSON.stringify(button)}`)
    assert(button.disabled === false, `genuine 200% zoom ${button.note} response button is disabled during the answer window`)
  }
  await capture('masked-zoom-200.png')
  sendHeliumKeys(['reset'])
  await page.waitForTimeout(260)
  const reset = await read()
  assert(reset.innerWidth === before.innerWidth && reset.innerHeight === before.innerHeight && reset.dpr === before.dpr,
    `zoom reset drifted: ${JSON.stringify({ before, reset })}`)
  await page.evaluate(title => { document.title = title }, originalTitle)
  return {
    method: 'activated the uniquely titled existing Helium proof page and sent genuine browser-chrome Control+0 / one-at-a-time Control+Plus shortcuts until observed 200%',
    screenshotCaveat: 'The CDP page screenshot at DPR 2 is a cropped capture-surface artifact; acceptance is based on genuine browser shortcut telemetry plus live zero-overflow DOM geometry.',
    before, zoomed, reset, presses,
  }
}

async function responsiveMatrix() {
  const rows = []
  for (const [name, width, height] of [
    ['desktop-1280x800', 1280, 800],
    ['portrait-390x844', 390, 844],
    ['landscape-844x390', 844, 390],
    ['compact-640x400', 640, 400],
  ]) {
    await page.setViewportSize({ width, height })
    await page.waitForTimeout(160)
    const state = await snapshot()
    assert(state.mask === 'active', `${name} lost the identity mask`)
    assert(state.horizontalOverflow <= 1, `${name} horizontal overflow ${state.horizontalOverflow}px`)
    assert(state.canvasRect && state.canvasRect.x >= -1 && state.canvasRect.right <= state.viewport.width + 1,
      `${name} canvas escaped horizontal viewport (${JSON.stringify({ viewport: state.viewport, canvasRect: state.canvasRect })})`)
    assert(state.replay?.disabled === true, `${name} replay became enabled while masked`)
    assert(state.responseButtons.length === NOTES.length,
      `${name} expected ${NOTES.length} EAR response buttons, saw ${state.responseButtons.length}`)
    for (const button of state.responseButtons) {
      assert(button.width >= 44 && button.height >= 44,
        `${name} ${button.note} tap target is ${button.width}x${button.height}`)
      assert(button.x >= -1 && button.right <= state.viewport.width + 1,
        `${name} ${button.note} tap target escaped viewport: ${JSON.stringify(button)}`)
      assert(button.disabled === false, `${name} ${button.note} response button is disabled during the answer window`)
    }
    await capture(`masked-${name}.png`)
    rows.push({ name, viewport: state.viewport, canvasRect: state.canvasRect, instruction: state.instruction, helper: state.helper, replay: state.replay, responseButtons: state.responseButtons })
  }
  await page.setViewportSize({ width: 1280, height: 800 })
  return rows
}

async function runBlindOutcome(outcome, { hold = false, responsive = false, colorHints = false, reducedMotion = 'reduce' } = {}) {
  await freshEarGame({ reviewed: true, colorHints, reducedMotion })
  const pending = await advanceToWave2()
  assert(pending.signalCheck.pending === true && pending.mask === 'active', `${outcome}: wave-2 pending mask missing`)
  await resetTrace()
  const segmentStart = await page.evaluate(() => ({ atMs: performance.now(), frame: window.__r8cTrace.frame }))
  const outbound = await waitForAttack(() => {
    try {
      const f = JSON.parse(document.querySelector('canvas')?.dataset.retroFormationState || '{}')
      return f.wave === 2 && f.activeAttack?.cuePolicy === 'blind' && f.activeAttack?.phase === 'outbound'
    } catch { return false }
  })
  const authority = verifyBlindOutbound(outbound)
  const scoreBefore = outbound.score
  let freeze = null
  let responsiveRows = null
  let zoom = null
  if (hold) {
    await page.evaluate(() => window.__r8cSetActivity('hidden', false))
    const before = await snapshot()
    if (responsive) {
      responsiveRows = await responsiveMatrix()
      zoom = await genuineZoomReceipt()
    }
    const elapsed = await page.evaluate(startedAt => performance.now() - startedAt, segmentStart.atMs)
    if (elapsed < 6000) await page.waitForTimeout(6000 - elapsed + 40)
    const after = await snapshot()
    assert(after.formationRaw === before.formationRaw, `${outcome}: focus-loss freeze changed the engine snapshot`)
    assert(after.trace.sourceStarts.filter(row => row.receipt?.guard === 'blind-stimulus').length === 1,
      `${outcome}: focus freeze duplicated the target source`)
    freeze = { before: before.formation, after: after.formation }
    await page.evaluate(() => window.__r8cSetActivity('visible', true))
  }

  if (outcome === 'correct') await answerAttack(authority.attack, true)
  else if (outcome === 'wrong') await answerAttack(authority.attack, false)
  const terminal = await waitForOutcome(authority.attack.attackId, outcome, outcome === 'timeout' ? 7000 : 5000)
  await capture(`blind-${outcome}-terminal.png`)
  await page.waitForTimeout(500)
  const final = await snapshot()
  const gradeWrites = final.trace.storageWrites.filter(row => row.key === 'pitch_fsrs_memory_ear')
  assert(gradeWrites.length === 1, `${outcome}: expected one EAR family write, saw ${gradeWrites.length}`)
  const terminalAt = final.trace.signalSamples.find(row => row.value?.disposition === 'terminal')?.atMs
  assert(Number.isFinite(terminalAt), `${outcome}: terminal signal sample missing`)
  const preTerminalStarts = final.trace.sourceStarts.filter(row => row.atMs < terminalAt)
  const protectedPitches = preTerminalStarts.filter(row => row.receipt?.kind === 'piano')
  assert(protectedPitches.length === 1 && protectedPitches[0].receipt?.guard === 'blind-stimulus',
    `${outcome}: protected pitch count/type drifted (${JSON.stringify(preTerminalStarts)})`)
  assert(preTerminalStarts.filter(row => row.receipt?.terminalAlreadyRecorded === false).length === 1,
    `${outcome}: a second pre-terminal source escaped (${JSON.stringify(preTerminalStarts)})`)
  assert(preTerminalStarts.every(row => row.receipt?.guard === 'blind-stimulus'
    || (row.receipt?.kind === 'sfx' && row.receipt?.terminalAlreadyRecorded === true)),
  `${outcome}: non-terminal teaching source escaped (${JSON.stringify(preTerminalStarts)})`)
  assert(final.trace.sourceStarts.filter(row => row.receipt?.guard === 'manual-replay').length === 0,
    `${outcome}: manual replay source leaked`)
  receiptSequence(final.trace)
  if (outcome === 'correct') assert(final.score > scoreBefore, 'correct blind terminal did not increase score')
  else assert(final.score === scoreBefore, `${outcome}: score changed across non-correct terminal`)
  assert(terminal.mask === 'inactive' && terminal.signalCheck.disposition === 'terminal',
    `${outcome}: mask did not drop only after terminal recording`)
  const segmentEnd = await page.evaluate(() => ({ atMs: performance.now(), frame: window.__r8cTrace.frame }))
  return {
    outcome,
    pending: { signalCheck: pending.signalCheck, mask: pending.mask },
    authority,
    terminal: { formation: terminal.formation, signalCheck: terminal.signalCheck, mask: terminal.mask },
    scoreBefore,
    scoreAfter: final.score,
    gradeWrites: gradeWrites.map(row => ({ atMs: row.atMs, frame: row.frame, key: row.key })),
    sourceStarts: final.trace.sourceStarts,
    receipts: final.trace.receipts,
    freeze,
    responsive: responsiveRows,
    zoom,
    colorHints: final.colorHints,
    reducedMotion: final.reducedMotion,
    segment: { start: segmentStart, end: segmentEnd, durationMs: segmentEnd.atMs - segmentStart.atMs, frameDelta: segmentEnd.frame - segmentStart.frame },
  }
}

async function runCancellation() {
  await freshEarGame({ reviewed: true, colorHints: false, reducedMotion: 'reduce' })
  const pending = await advanceToWave2()
  assert(pending.signalCheck.pending && pending.mask === 'active', 'cancel: pending mask missing')
  await resetTrace()
  await page.evaluate(() => { window.__r8cDropNextBlindAck = true })
  const segmentStart = await page.evaluate(() => ({ atMs: performance.now(), frame: window.__r8cTrace.frame }))
  await page.waitForFunction(() => window.__r8cTrace.sourceStarts.some(row => row.receipt?.guard === 'blind-stimulus') &&
    window.__r8cTrace.ackDrops.length === 1, null, { timeout: 30_000, polling: 'raf' })
  const unresolved = await snapshot()
  assert(unresolved.mask === 'active' && unresolved.formation.activeAttack?.phase === 'awaiting-stimulus',
    'cancel: mask/awaiting state missing after dispatched ack was dropped')
  assert(unresolved.instruction?.includes('BUTTONS ARM AFTER THE TONE'),
    `cancel: pre-ack instruction invited an unavailable answer: ${unresolved.instruction}`)
  assert(unresolved.responseButtons.length === 4 && unresolved.responseButtons.every(button => button.disabled === true),
    'cancel: response controls armed before the stimulus acknowledgment')
  await capture('blind-cancel-before-boundary.png')
  const scoreBefore = unresolved.score
  await page.waitForFunction(() => {
    try {
      const canvas = document.querySelector('canvas')
      const signal = JSON.parse(canvas?.dataset.retroSignalCheck || '{}')
      const formation = JSON.parse(canvas?.dataset.retroFormationState || '{}')
      return signal.disposition === 'cancelled-ack-timeout' && !formation.activeAttack
    } catch { return false }
  }, null, { timeout: 8000, polling: 'raf' })
  const cancelled = await snapshot()
  await page.evaluate(() => window.__r8cSetActivity('hidden', false))
  const elapsed = await page.evaluate(startedAt => performance.now() - startedAt, segmentStart.atMs)
  if (elapsed < 6000) await page.waitForTimeout(6000 - elapsed + 40)
  const held = await snapshot()
  await capture('blind-cancel-after-boundary.png')
  const blindStarts = held.trace.sourceStarts.filter(row => row.receipt?.guard === 'blind-stimulus')
  assert(blindStarts.length === 1 && blindStarts[0].type === 'buffer', `cancel: expected one pitched source, saw ${blindStarts.length}`)
  assert(held.trace.sourceStarts.length === 1, `cancel: second source started before/at cancellation (${held.trace.sourceStarts.length})`)
  assert(held.trace.storageWrites.filter(row => row.key === 'pitch_fsrs_memory_ear').length === 0,
    'cancel: family grade/write occurred')
  assert(held.score === scoreBefore, 'cancel: score changed')
  assert(cancelled.mask === 'inactive' && cancelled.signalCheck.disposition === 'cancelled-ack-timeout',
    'cancel: exact cancellation/unmask boundary missing')
  const cancelAt = held.trace.signalSamples.find(row => row.value?.disposition === 'cancelled-ack-timeout')?.atMs
  assert(Number.isFinite(cancelAt), 'cancel: signal cancellation timestamp missing')
  assert(held.trace.maskSamples.filter(row => row.atMs < cancelAt).every(row => row.value === 'active'),
    'cancel: identity mask dropped before cancellation')
  receiptSequence(held.trace)
  await page.evaluate(() => window.__r8cSetActivity('visible', true))
  const later = await waitForAttack(() => {
    try {
      const f = JSON.parse(document.querySelector('canvas')?.dataset.retroFormationState || '{}')
      return f.activeAttack?.phase === 'telegraph' || f.activeAttack?.phase === 'outbound'
    } catch { return false }
  })
  assert(later.formation.activeAttack?.cuePolicy === 'guided', 'cancel: a replacement blind probe was promoted')
  const segmentEnd = await page.evaluate(() => ({ atMs: performance.now(), frame: window.__r8cTrace.frame }))
  return {
    pending: pending.signalCheck,
    unresolved: { formation: unresolved.formation, signalCheck: unresolved.signalCheck, mask: unresolved.mask },
    cancelled: { formation: cancelled.formation, signalCheck: cancelled.signalCheck, mask: cancelled.mask },
    laterAttack: later.formation.activeAttack,
    trace: held.trace,
    segment: { start: segmentStart, end: segmentEnd, durationMs: segmentEnd.atMs - segmentStart.atMs, frameDelta: segmentEnd.frame - segmentStart.frame },
  }
}

async function runGuidedNegative(kind) {
  await freshEarGame({ reviewed: true, colorHints: false, reducedMotion: 'reduce' })
  const pending = await advanceToWave2({ clearEarBeforeWave2: kind === 'unreviewed' })
  assert(pending.signalCheck.pending === true, `${kind}: wave-2 opportunity missing`)
  if (kind === 'output-not-ready') await page.evaluate(() => { window.__r8cForceSuspended = true })
  const first = await waitForAttack(() => {
    try {
      const canvas = document.querySelector('canvas')
      const f = JSON.parse(canvas?.dataset.retroFormationState || '{}')
      const s = JSON.parse(canvas?.dataset.retroSignalCheck || '{}')
      return f.wave === 2 && f.activeAttack && s.pending === false
    } catch { return false }
  })
  if (kind === 'output-not-ready') await page.evaluate(() => { window.__r8cForceSuspended = false })
  const expected = kind === 'unreviewed' ? 'guided-unreviewed' : 'guided-output-not-ready'
  assert(first.formation.activeAttack?.cuePolicy === 'guided' && first.signalCheck.disposition === expected,
    `${kind}: first selection did not fail guided (${JSON.stringify(first.signalCheck)})`)
  assert(first.mask === 'inactive', `${kind}: guided selection left mask active`)
  await page.waitForFunction(attackId => {
    try {
      const a = JSON.parse(document.querySelector('canvas')?.dataset.retroFormationState || '{}').activeAttack
      return a?.attackId === attackId && a.phase === 'outbound'
    } catch { return false }
  }, first.formation.activeAttack.attackId, { timeout: 10_000, polling: 'raf' })
  await answerAttack((await snapshot()).formation.activeAttack, true)
  const firstAttackId = first.formation.activeAttack.attackId
  await page.waitForFunction(firstId => {
    try {
      const f = JSON.parse(document.querySelector('canvas')?.dataset.retroFormationState || '{}')
      return f.activeAttack && f.activeAttack.attackId !== firstId
    } catch { return false }
  }, firstAttackId, { timeout: 20_000, polling: 'raf' })
  const second = await snapshot()
  assert(second.formation.activeAttack?.cuePolicy === 'guided' && second.signalCheck.pending === false,
    `${kind}: later attack was promoted to blind`)
  return { kind, first: { attack: first.formation.activeAttack, signalCheck: first.signalCheck }, second: { attack: second.formation.activeAttack, signalCheck: second.signalCheck } }
}

async function armCleanupSentinel() {
  await page.evaluate(() => window.__r8cArmSyntheticReceipt())
  const armed = await page.evaluate(() => window.__r8cCleanupState())
  assert(armed.rootPresent && armed.priorCanvasPresent, 'cleanup sentinel was not armed on root and canvas')
}

async function assertCleanup(label) {
  await page.waitForTimeout(80)
  const state = await page.evaluate(() => window.__r8cCleanupState())
  assert(!state.rootPresent && !state.priorCanvasPresent, `${label}: receipt survived (${JSON.stringify(state)})`)
  return { label, ...state }
}

async function forceGameOver() {
  const changed = await page.evaluate(() => window.__r8cSetShields(1))
  assert(changed, 'could not set one shield for cleanup-path proof')
  const state = await waitForAttack(() => {
    try { return JSON.parse(document.querySelector('canvas')?.dataset.retroFormationState || '{}').activeAttack?.phase === 'outbound' } catch { return false }
  })
  await answerAttack(state.formation.activeAttack, false)
  await page.getByText('GAME OVER', { exact: true }).waitFor({ timeout: 10_000 })
}

async function runCleanupProof() {
  const rows = []

  // Tutorial back.
  await freshEarGame({ tutorialSeen: false })
  await page.getByRole('button', { name: 'BACK TO MENU' }).waitFor()
  await page.evaluate(() => {
    const value = JSON.stringify({ sequence: 999999, guard: 'cleanup-sentinel' })
    document.documentElement.dataset.retroAudioReceipt = value
  })
  await page.getByRole('button', { name: 'BACK TO MENU' }).click()
  await page.getByRole('button', { name: 'INSERT COIN' }).waitFor()
  const tutorial = await page.evaluate(() => ({ rootPresent: Object.prototype.hasOwnProperty.call(document.documentElement.dataset, 'retroAudioReceipt') }))
  assert(!tutorial.rootPresent, 'tutorial-back: root receipt survived')
  rows.push({ label: 'tutorial-back', rootPresent: false, priorCanvasPresent: false, priorCanvasConnected: null })

  // Exit readiness.
  await page.evaluate(() => localStorage.setItem('retro_tutorial_seen', '1'))
  await page.getByRole('button', { name: 'INSERT COIN' }).click()
  await page.locator('[data-retro-readiness]').waitFor()
  await page.evaluate(() => {
    const value = JSON.stringify({ sequence: 999999, guard: 'cleanup-sentinel' })
    document.documentElement.dataset.retroAudioReceipt = value
  })
  await page.getByRole('button', { name: 'BACK TO MENU' }).click()
  await page.getByRole('button', { name: 'INSERT COIN' }).waitFor()
  const exit = await page.evaluate(() => ({ rootPresent: Object.prototype.hasOwnProperty.call(document.documentElement.dataset, 'retroAudioReceipt') }))
  assert(!exit.rootPresent, 'exit-readiness: root receipt survived')
  rows.push({ label: 'exit-readiness', rootPresent: false, priorCanvasPresent: false, priorCanvasConnected: null })

  // New game from readiness.
  await page.getByRole('button', { name: 'INSERT COIN' }).click()
  await page.locator('[data-retro-readiness]').waitFor()
  await page.waitForFunction(() => document.querySelector('[data-retro-readiness]')?.getAttribute('data-readiness-status') === 'awaiting-ear', null, { timeout: 30_000 })
  await page.evaluate(() => {
    const value = JSON.stringify({ sequence: 999999, guard: 'cleanup-sentinel' })
    document.documentElement.dataset.retroAudioReceipt = value
  })
  await page.locator('[data-retro-readiness] .grid button').nth(0).click()
  await page.locator('[data-retro-cabinet]').waitFor()
  const newGame = await page.evaluate(() => ({ rootPresent: Object.prototype.hasOwnProperty.call(document.documentElement.dataset, 'retroAudioReceipt') }))
  assert(!newGame.rootPresent, 'new-game: root receipt survived')
  rows.push({ label: 'new-game', rootPresent: false, priorCanvasPresent: false, priorCanvasConnected: null })

  // Gameplay quit.
  await armCleanupSentinel()
  await page.getByRole('button', { name: 'QUIT' }).click()
  await page.getByRole('button', { name: 'INSERT COIN' }).waitFor()
  rows.push(await assertCleanup('gameplay-quit'))

  // Game-over menu.
  await freshEarGame({ reviewed: true })
  await armCleanupSentinel()
  await forceGameOver()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'MENU' }).click()
  await page.getByRole('button', { name: 'INSERT COIN' }).waitFor()
  rows.push(await assertCleanup('game-over-menu'))

  // Enter readiness from game over.
  await freshEarGame({ reviewed: true })
  await armCleanupSentinel()
  await forceGameOver()
  await page.waitForTimeout(500)
  const enterBoundary = await page.getByRole('button', { name: 'CONTINUE?' }).evaluate(button => {
    button.click()
    return window.__r8cCleanupState()
  })
  assert(!enterBoundary.rootPresent && !enterBoundary.priorCanvasPresent,
    `enter-readiness: stale receipt survived synchronous boundary (${JSON.stringify(enterBoundary)})`)
  await page.locator('[data-retro-readiness]').waitFor()
  const successorReceipt = await page.evaluate(() => {
    try { return JSON.parse(document.documentElement.dataset.retroAudioReceipt || 'null') } catch { return null }
  })
  assert(successorReceipt === null || (successorReceipt.guard === 'radio-check'
    && successorReceipt.gameId === null && successorReceipt.attackId === null),
  `enter-readiness: unexpected successor receipt (${JSON.stringify(successorReceipt)})`)
  rows.push({ label: 'enter-readiness', ...enterBoundary, successorReceipt })

  // Route exit / component unmount via Next history navigation. Preserve the detached canvas reference.
  await page.getByRole('button', { name: 'BACK TO MENU' }).click()
  await page.getByRole('button', { name: 'INSERT COIN' }).click()
  await page.locator('[data-retro-readiness]').waitFor()
  await page.waitForFunction(() => document.querySelector('[data-retro-readiness]')?.getAttribute('data-readiness-status') === 'awaiting-ear', null, { timeout: 30_000 })
  await page.locator('[data-retro-readiness] .grid button').nth(0).click()
  await page.locator('[data-retro-cabinet]').waitFor()
  await armCleanupSentinel()
  const routed = await page.evaluate(() => {
    if (!window.next?.router?.push) return false
    window.next.router.push('/pitch-defender')
    return true
  })
  assert(routed, 'component-unmount: live Next App Router was unavailable')
  await page.waitForURL(current => current.pathname === '/pitch-defender', { timeout: 30_000 })
  await page.locator('[data-retro-cabinet]').waitFor({ state: 'detached', timeout: 30_000 })
  const routeMethod = await page.evaluate(() => ({
    href: location.href,
    cabinet: Boolean(document.querySelector('[data-retro-cabinet]')),
    method: 'live Next 15 App Router push',
  }))
  assert(!routeMethod.cabinet && routeMethod.href.endsWith('/pitch-defender'),
    `component-unmount client navigation failed (${JSON.stringify(routeMethod)})`)
  rows.push(await assertCleanup('component-unmount'))

  assert(pageErrors.length === 0, `cleanup page errors: ${pageErrors.join('; ')}`)
  return rows
}

try {
  let payload
  if (mode === 'core') {
    const healthy = await runBlindOutcome('correct', { hold: true, responsive: true, colorHints: false, reducedMotion: 'reduce' })
    const wrong = await runBlindOutcome('wrong', { colorHints: true, reducedMotion: 'no-preference' })
    const timeout = await runBlindOutcome('timeout', { colorHints: false, reducedMotion: 'reduce' })
    const cancellation = await runCancellation()
    const outputNotReady = await runGuidedNegative('output-not-ready')
    const unreviewed = await runGuidedNegative('unreviewed')
    assert(healthy.segment.durationMs >= 6000 && healthy.segment.frameDelta >= 30,
      'healthy blind sustained sequence is shorter than 6s/live frames')
    assert(cancellation.segment.durationMs >= 6000 && cancellation.segment.frameDelta >= 30,
      'fail-closed sustained sequence is shorter than 6s/live frames')
    payload = { healthy, wrong, timeout, cancellation, outputNotReady, unreviewed }
  } else if (mode === 'cleanup') {
    payload = { rows: await runCleanupProof() }
  } else {
    throw new Error(`unknown mode ${mode}`)
  }

  assert(pageErrors.length === 0, `page errors: ${pageErrors.join('; ')}`)
  const videoPath = await page.video().path()
  const result = {
    verdict: 'PASS', schema: 'retro-blaster-r8c-helium/v1', mode,
    browserLane: 'existing-helium-hawkeye-only', transport, url, productBase,
    sourceHashes, pageErrors, videoPath, payload,
  }
  writeFileSync(resolve(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
  complete = true
  console.log(`PASS R8c Helium ${mode}: zero page errors`)
} catch (error) {
  const result = {
    verdict: 'FAIL', schema: 'retro-blaster-r8c-helium/v1', mode,
    browserLane: 'existing-helium-hawkeye-only', transport, url, productBase,
    sourceHashes, pageErrors, error: String(error?.stack || error),
  }
  writeFileSync(resolve(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`)
  console.error(result.error)
  process.exitCode = 1
} finally {
  let timer
  const closed = await Promise.race([
    context.close().then(() => true),
    new Promise(resolveClose => { timer = setTimeout(() => resolveClose(false), 15_000) }),
  ])
  clearTimeout(timer)
  if (!closed) console.error('R8c proof context close timed out; runner is disconnecting only')
  if (!complete) console.error('Helium browser process remains running after proof failure')
  process.exit(process.exitCode ?? 0)
}
