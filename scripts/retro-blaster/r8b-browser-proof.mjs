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

try {
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
  const responsive = []
  for (const [name, width, height] of [
    ['portrait-390x844', 390, 844],
    ['landscape-844x390', 844, 390],
    ['desktop-1280x800', 1280, 800],
    ['zoom-200-equivalent-640x400', 640, 400],
  ]) {
    await page.setViewportSize({ width, height })
    await page.waitForTimeout(180)
    const layout = await state()
    assert(layout.horizontalOverflow <= 1, `${name} horizontal overflow ${layout.horizontalOverflow}px`)
    assert(layout.ceremony?.actions.every(action => action.insideRegion && action.insideViewport), `${name} clips a ceremony action`)
    responsive.push({ name, viewport: layout.viewport, rect: layout.ceremony?.rect, actions: layout.ceremony?.actions })
    await capture(`responsive-${name}.png`, { fullPage: true })
  }
  await page.setViewportSize({ width: 1280, height: 800 })
  await finishSegment(blockedSegment)
  await capture('01-new-signal-blocked.png')

  if (mode === 'quit') {
    const startsBeforeQuitRetry = (await state()).bufferStarts
    await page.evaluate(() => { window.__r8HoldPianoReload = true })
    await page.getByRole('button', { name: 'RETRY SIGNAL' }).click()
    await page.waitForFunction(() => window.__r8HeldPianoFetchCount > 0)
    await page.getByRole('button', { name: 'QUIT' }).click()
    await page.getByRole('button', { name: 'INSERT COIN' }).waitFor()
    await page.evaluate(() => window.__r8ReleasePianoReload())
    const quitSegment = await startSegment('ceremony-quit-no-resurrection')
    await finishSegment(quitSegment)
    const afterQuit = await state()
    assert(afterQuit.menu && !afterQuit.ceremony, 'ceremony resurrected after QUIT')
    assert(afterQuit.bufferStarts === startsBeforeQuitRetry, 'in-flight retry played a stale tone after QUIT')
    assert(await storageSnapshot() === ceremonyStorage, 'ceremony QUIT wrote family storage')
    await capture('02-ceremony-quit-clean.png')
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
} catch (error) {
  const result = { verdict: 'FAIL', lane, transport, mode, url, deployedSha, pageErrors, temporalConsistency, behaviorManifest, error: String(error?.stack || error) }
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
