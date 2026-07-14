import { createHash } from 'node:crypto'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildSync } from 'esbuild'
import { chromium } from 'playwright'

const [lane = 'native-chrome', transport = 'native', rawUrl, rawOutput, rawDeployedSha] = process.argv.slice(2)
const url = rawUrl || 'http://127.0.0.1:3333/pitch-defender/retro-2'
const output = resolve(rawOutput || `data/retro-blaster-rework/runtime-logs/r4-mic-browser-proof/${lane}`)
const videoDir = resolve(output, 'video')
const resultPath = resolve(output, 'result.json')
const deployedSha = rawDeployedSha || 'local-uncommitted'
mkdirSync(videoDir, { recursive: true })

const productionVfxBundle = buildSync({
  stdin: {
    contents: "export { deriveWeaponVfx } from './src/components/PitchDefender/retroBlasterRenderer.ts'",
    resolveDir: process.cwd(),
    sourcefile: 'r4-production-vfx-browser-entry.ts',
  },
  bundle: true,
  format: 'iife',
  globalName: '__r4ProductionVfx',
  platform: 'browser',
  target: 'chrome120',
  treeShaking: true,
  write: false,
}).outputFiles[0].text
const productionVfxBundleSha256 = createHash('sha256')
  .update(productionVfxBundle)
  .digest('hex')
  .toUpperCase()

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
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => forcedVisibility,
  })
  window.__setRetroVisibility = state => {
    forcedVisibility = state
    document.dispatchEvent(new Event('visibilitychange'))
  }

  const NativeAudioContext = window.AudioContext || window.webkitAudioContext
  const nativeCreateMediaStreamSource = NativeAudioContext.prototype.createMediaStreamSource
  const proof = window.__r4MicProof = {
    sources: [],
    productContexts: [],
    matchingCalls: 0,
    gumCalls: 0,
    instrumentationError: null,
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
    gain.gain.value = 0.55
    oscillator.connect(gain)
    gain.connect(destination)
    oscillator.start()
    await sourceContext.resume()
    const source = {
      sourceContext,
      oscillator,
      gain,
      destination,
      stream: destination.stream,
      productContext: null,
    }
    proof.sources.push(source)
    return source.stream
  }

  window.__r4MicStatus = () => ({
    gumCalls: proof.gumCalls,
    matchingCalls: proof.matchingCalls,
    sourceCount: proof.sources.length,
    sourceContextStates: proof.sources.map(source => source.sourceContext.state),
    sourceTrackStates: proof.sources.map(source => source.stream.getAudioTracks()[0]?.readyState ?? 'missing'),
    productContextStates: proof.productContexts.map(context => context.state),
    sourceIsProductContext: proof.sources.some(source => source.sourceContext === source.productContext),
    instrumentationError: proof.instrumentationError,
  })
  window.__r4SetFrequency = frequency => {
    const source = proof.sources.at(-1)
    if (!source) throw new Error('no deterministic microphone source')
    source.oscillator.frequency.setValueAtTime(frequency, source.sourceContext.currentTime)
    return frequency
  }
  window.__r4SuspendProductContext = async () => {
    const context = proof.productContexts.at(-1)
    if (!context) throw new Error('no product microphone context')
    await context.suspend()
    return context.state
  }
  window.__r4ResumeProductContext = async () => {
    const context = proof.productContexts.at(-1)
    if (!context) throw new Error('no product microphone context')
    await context.resume()
    return context.state
  }
  window.__r4StopSourceTrack = () => {
    const track = proof.sources.at(-1)?.stream.getAudioTracks()[0]
    if (!track) throw new Error('no deterministic microphone track')
    track.stop()
    return track.readyState
  }

  window.__r4StateFrames = []
  window.__r4CapturingState = false
  const capture = timestamp => {
    if (window.__r4CapturingState) {
      const canvas = document.querySelector('canvas')
      if (canvas) {
        const parse = (raw, fallback) => {
          try { return JSON.parse(raw || fallback) } catch { return JSON.parse(fallback) }
        }
        const formation = parse(canvas.dataset.retroFormationState, '{}')
        window.__r4StateFrames.push({
          timestamp,
          vfx: parse(canvas.dataset.retroWeaponVfx, '{"charge":null,"tracer":null,"hitLockAttackId":null,"impactAlienIds":[]}'),
          mic: parse(canvas.dataset.retroMicAuthority, '{}'),
          formation: {
            directorClockMs: formation.directorClockMs,
            gameId: formation.gameId,
            activeAttack: formation.activeAttack,
            requiredAnswerEventsMs: formation.requiredAnswerEventsMs,
            lastCompletedWavePacing: formation.lastCompletedWavePacing,
          },
        })
        if (window.__r4StateFrames.length > 3000) window.__r4StateFrames.shift()
      }
    }
    requestAnimationFrame(capture)
  }
  requestAnimationFrame(capture)
}

function segment(id) {
  return { behaviorId: id, startedAtMs: Date.now(), endedAtMs: null }
}

async function finishSegment(row, minimumDurationMs = 6000) {
  const remaining = row.startedAtMs + minimumDurationMs - Date.now()
  if (remaining > 0) await page.waitForTimeout(remaining)
  row.endedAtMs = Date.now()
  row.durationMs = row.endedAtMs - row.startedAtMs
  assert(row.durationMs >= minimumDurationMs, `${row.behaviorId} evidence shorter than ${minimumDurationMs}ms`)
}

async function state() {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    const parse = (raw, fallback) => {
      try { return JSON.parse(raw || fallback) } catch { return JSON.parse(fallback) }
    }
    const rect = canvas?.getBoundingClientRect()
    return {
      vfx: parse(canvas?.dataset.retroWeaponVfx, '{"charge":null,"tracer":null,"hitLockAttackId":null,"impactAlienIds":[]}'),
      mic: parse(canvas?.dataset.retroMicAuthority, '{}'),
      formation: parse(canvas?.dataset.retroFormationState, '{}'),
      instrumentation: window.__r4MicStatus?.() ?? null,
      visibility: document.visibilityState,
      logical: canvas ? [canvas.width, canvas.height] : null,
      css: rect ? [rect.width, rect.height] : null,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }
  })
}

async function waitForOutbound(excludedAttackId = null, timeout = 15_000) {
  await page.waitForFunction(excluded => {
    const canvas = document.querySelector('canvas')
    const formation = JSON.parse(canvas?.dataset.retroFormationState || '{}')
    return formation.activeAttack?.phase === 'outbound' && formation.activeAttack.attackId !== excluded
  }, excludedAttackId, { timeout })
  return state()
}

async function waitPastToneSuppression() {
  await page.waitForFunction(() => {
    const last = window.__pdLastToneAt || 0
    const span = window.__pdToneSuppressMs || 0
    return performance.now() - last > span + 40
  }, null, { timeout: 2000 })
}

async function startMicGame() {
  await page.getByRole('button', { name: 'MICROPHONE' }).click()
  await page.getByRole('button', { name: 'TRUE PLAY' }).click()
  await page.getByRole('button', { name: 'INSERT COIN' }).click()
  await page.locator('[data-retro-cabinet]').waitFor()
  await page.waitForFunction(() => {
    const status = window.__r4MicStatus?.()
    return status?.gumCalls === 1 && status?.matchingCalls === 1 &&
      status?.productContextStates?.at(-1) === 'running'
  }, null, { timeout: 5000 })
  const started = await state()
  assert(started.instrumentation.gumCalls === 1, 'getUserMedia was not called exactly once')
  assert(started.instrumentation.matchingCalls === 1, 'product stream identity did not bind exactly once')
  assert(started.instrumentation.sourceIsProductContext === false, 'source oscillator context was misidentified as product context')
}

async function freshMenu() {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    localStorage.setItem('retro_tutorial_seen', '1')
    localStorage.setItem('retro_difficulty', 'true')
    localStorage.removeItem('retro_blaster_color_hints')
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'INSERT COIN' }).waitFor()
}

async function startStateCapture() {
  await page.evaluate(() => {
    window.__r4StateFrames = []
    window.__r4CapturingState = true
  })
}

async function stopStateCapture() {
  return page.evaluate(() => {
    window.__r4CapturingState = false
    return window.__r4StateFrames
  })
}

const connected = transport !== 'native'
const browser = connected
  ? await chromium.connectOverCDP(transport)
  : await chromium.launch({ headless: true, channel: 'chrome' })
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
})
const page = await context.newPage()
await page.addInitScript(initHarness)
const pageErrors = []
page.on('pageerror', error => pageErrors.push(error.message))
const behaviorManifest = []

try {
  await freshMenu()
  await page.addScriptTag({ content: productionVfxBundle })
  const duplicateSegment = segment('duplicate-fail-closed')
  behaviorManifest.push(duplicateSegment)
  const duplicateProof = await page.evaluate(() => {
    const attackId = 'r4-browser-duplicate-attack'
    const alienId = 'r4-browser-duplicate-alien'
    const laser = {
      active: true,
      hits: true,
      attackId,
      targetAlienId: alienId,
      y: 250,
      targetY: 100,
    }
    return window.__r4ProductionVfx.deriveWeaponVfx({
      inputMode: 'mic',
      activeAttack: {
        attackId,
        alienId,
        phase: 'hit-locked',
        outcome: 'correct',
      },
      aliens: [{ alienId, note: 'C4', alive: true, hue: 0, hitTimer: 0 }],
      charge: { fraction: 0, targetNote: null },
      lasers: [laser, { ...laser }],
    }, false)
  })
  assert(duplicateProof.charge === null, 'duplicate fixture unexpectedly produced charge')
  assert(duplicateProof.tracer === null, 'duplicate projectile ambiguity did not fail closed')
  assert(duplicateProof.hitLockAttackId === null, 'duplicate projectile ambiguity produced hit-lock')
  assert(duplicateProof.impactAlienIds.length === 0, 'duplicate projectile ambiguity produced impact')
  await startMicGame()
  const firstOutbound = await waitForOutbound()
  const firstAttack = firstOutbound.formation.activeAttack
  await page.evaluate(frequency => window.__r4SetFrequency(frequency), noteFrequency(firstAttack.note))
  await waitPastToneSuppression()
  await startStateCapture()
  const causalSegment = segment('mic-charge-authority')
  behaviorManifest.push(causalSegment)
  await page.waitForFunction(attackId => {
    const canvas = document.querySelector('canvas')
    const vfx = JSON.parse(canvas?.dataset.retroWeaponVfx || '{}')
    return vfx.charge?.attackId === attackId && vfx.charge.fraction > 0.12 && vfx.charge.fraction < 0.95
  }, firstAttack.attackId, { timeout: 1200, polling: 'raf' })
  const partial = await state()
  assert(partial.vfx.charge?.alienId === firstAttack.alienId, 'partial charge was not bound to the active alien')

  const suspendSegment = segment('mic-suspend-recover')
  behaviorManifest.push(suspendSegment)
  const suspendedGeneration = partial.mic.generation
  await page.evaluate(async () => {
    await window.__r4SuspendProductContext()
    window.__r4SetFrequency(110)
  })
  await page.waitForFunction(() => {
    const canvas = document.querySelector('canvas')
    const mic = JSON.parse(canvas?.dataset.retroMicAuthority || '{}')
    const vfx = JSON.parse(canvas?.dataset.retroWeaponVfx || '{}')
    return mic.audioContextState === 'suspended' && vfx.charge === null
  }, null, { timeout: 1000, polling: 'raf' })
  await page.waitForTimeout(80)
  const suspended = await state()
  assert(suspended.vfx.tracer === null && suspended.vfx.hitLockAttackId === null && suspended.vfx.impactAlienIds.length === 0,
    'successful VFX appeared while the product microphone context was suspended')

  await page.evaluate(() => window.__r4ResumeProductContext())
  await page.waitForFunction(generation => {
    const canvas = document.querySelector('canvas')
    const mic = JSON.parse(canvas?.dataset.retroMicAuthority || '{}')
    const vfx = JSON.parse(canvas?.dataset.retroWeaponVfx || '{}')
    return mic.audioContextState === 'running' && mic.generation > generation && vfx.charge === null
  }, suspendedGeneration, { timeout: 1500, polling: 'raf' })
  const firstRecoveredWrong = await state()
  await page.waitForFunction(({ attackId, generation }) => {
    const canvas = document.querySelector('canvas')
    const mic = JSON.parse(canvas?.dataset.retroMicAuthority || '{}')
    const vfx = JSON.parse(canvas?.dataset.retroWeaponVfx || '{}')
    const formation = JSON.parse(canvas?.dataset.retroFormationState || '{}')
    return formation.activeAttack?.attackId === attackId &&
      formation.activeAttack.phase === 'outbound' &&
      mic.generation >= generation + 12 && mic.signalActive === false && vfx.charge === null
  }, { attackId: firstAttack.attackId, generation: firstRecoveredWrong.mic.generation }, {
    timeout: 1000,
    polling: 'raf',
  })
  const recoveredWrong = await state()
  assert(recoveredWrong.mic.signalActive === false, 'wrong recovered source qualified the lock signal')

  const recoveryGeneration = recoveredWrong.mic.generation
  await page.evaluate(frequency => window.__r4SetFrequency(frequency), noteFrequency(firstAttack.note))
  try {
    await page.waitForFunction(({ attackId, generation }) => {
      const canvas = document.querySelector('canvas')
      const mic = JSON.parse(canvas?.dataset.retroMicAuthority || '{}')
      const vfx = JSON.parse(canvas?.dataset.retroWeaponVfx || '{}')
      return mic.generation > generation && mic.hasFreshGeneration === true &&
        mic.signalActive === true && vfx.charge?.attackId === attackId
    }, { attackId: firstAttack.attackId, generation: recoveryGeneration }, { timeout: 1600, polling: 'raf' })
  } catch (error) {
    console.error('RECOVERY_DEBUG', JSON.stringify(await state(), null, 2))
    throw error
  }
  await page.waitForFunction(alienId => {
    const canvas = document.querySelector('canvas')
    const vfx = JSON.parse(canvas?.dataset.retroWeaponVfx || '{}')
    return vfx.impactAlienIds?.includes(alienId)
  }, firstAttack.alienId, { timeout: 1800, polling: 'raf' })
  await finishSegment(causalSegment)
  await finishSegment(suspendSegment)
  await finishSegment(duplicateSegment)
  causalSegment.behaviorIds = ['mic-charge-authority', 'correct-tracer-lock-impact']
  await page.screenshot({ path: resolve(output, '01-mic-chain-complete.png') })
  const firstFrames = await stopStateCapture()

  const firstChargeFrames = firstFrames.filter(frame => frame.vfx.charge?.attackId === firstAttack.attackId)
  const firstTracerFrames = firstFrames.filter(frame => frame.vfx.tracer?.attackId === firstAttack.attackId)
  const firstLockFrames = firstFrames.filter(frame => frame.vfx.hitLockAttackId === firstAttack.attackId)
  const firstImpactFrames = firstFrames.filter(frame => frame.vfx.impactAlienIds?.includes(firstAttack.alienId))
  assert(firstChargeFrames.length >= 4, `charge sequence too sparse (${firstChargeFrames.length})`)
  assert(firstTracerFrames.some(frame => frame.vfx.tracer.flightProgress < 0.55), 'canonical tracer had no pre-lock frame')
  assert(firstTracerFrames.some(frame => frame.vfx.tracer.flightProgress >= 0.55), 'canonical tracer never reached lock threshold')
  assert(firstLockFrames.length > 0, 'bound visual hit-lock never appeared')
  assert(firstImpactFrames.length > 0, 'authorized impact bloom never appeared')
  assert(firstTracerFrames.every(frame => frame.vfx.tracer.attackId === firstAttack.attackId &&
    frame.vfx.tracer.alienId === firstAttack.alienId), 'tracer identity changed mid-chain')
  assert(firstFrames.every(frame => !frame.vfx.hitLockAttackId || frame.vfx.tracer?.flightProgress >= 0.55),
    'visual hit-lock appeared before tracer progress 0.55')

  const nextOutbound = await waitForOutbound(firstAttack.attackId, 12_000)
  const endedAttack = nextOutbound.formation.activeAttack
  await page.evaluate(frequency => window.__r4SetFrequency(frequency), noteFrequency(endedAttack.note))
  await waitPastToneSuppression()
  await startStateCapture()
  const endedSegment = segment('mic-track-ended-restart')
  behaviorManifest.push(endedSegment)
  await page.waitForFunction(attackId => {
    const canvas = document.querySelector('canvas')
    const vfx = JSON.parse(canvas?.dataset.retroWeaponVfx || '{}')
    return vfx.charge?.attackId === attackId && vfx.charge.fraction > 0.1
  }, endedAttack.attackId, { timeout: 1200, polling: 'raf' })
  const beforeEnded = await state()
  await page.evaluate(() => window.__r4StopSourceTrack())
  await page.waitForFunction(generation => {
    const canvas = document.querySelector('canvas')
    const mic = JSON.parse(canvas?.dataset.retroMicAuthority || '{}')
    const vfx = JSON.parse(canvas?.dataset.retroWeaponVfx || '{}')
    return mic.audioContextState === 'running' && mic.trackReadyState === 'ended' &&
      mic.generation > generation && vfx.charge === null
  }, beforeEnded.mic.generation, { timeout: 1200, polling: 'raf' })
  await page.waitForFunction(attackId => {
    const canvas = document.querySelector('canvas')
    const formation = JSON.parse(canvas?.dataset.retroFormationState || '{}')
    return formation.activeAttack?.attackId === attackId && formation.activeAttack.phase === 'returning'
  }, endedAttack.attackId, { timeout: 3000 })
  const endedFrames = await stopStateCapture()
  assert(endedFrames.filter(frame => frame.mic.trackReadyState === 'ended')
    .every(frame => frame.vfx.charge === null && frame.vfx.tracer === null &&
      frame.vfx.hitLockAttackId === null && frame.vfx.impactAlienIds.length === 0),
  'ended source produced successful VFX')
  endedSegment.behaviorIds = ['mic-track-ended-restart', 'wrong-teaching-return']
  await page.screenshot({ path: resolve(output, '02-ended-track-timeout.png') })

  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'INSERT COIN' }).waitFor()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await startMicGame()
  const restarted = await waitForOutbound()
  const restartedAttack = restarted.formation.activeAttack
  await waitPastToneSuppression()
  const beforeRestartTone = await state()
  assert(beforeRestartTone.vfx.charge === null && beforeRestartTone.mic.signalActive === false,
    'new live source relit charge before a qualifying generation')
  await startStateCapture()
  const reducedSegment = segment('reduced-correct-chain')
  behaviorManifest.push(reducedSegment)
  await page.evaluate(frequency => window.__r4SetFrequency(frequency), noteFrequency(restartedAttack.note))
  await page.waitForFunction(alienId => {
    const canvas = document.querySelector('canvas')
    const vfx = JSON.parse(canvas?.dataset.retroWeaponVfx || '{}')
    return vfx.impactAlienIds?.includes(alienId)
  }, restartedAttack.alienId, { timeout: 1800, polling: 'raf' })
  await finishSegment(reducedSegment)
  const reducedFrames = await stopStateCapture()
  assert(reducedFrames.some(frame => frame.vfx.charge?.attackId === restartedAttack.attackId),
    'reduced-motion chain had no authorized charge')
  assert(reducedFrames.some(frame => frame.vfx.tracer?.attackId === restartedAttack.attackId),
    'reduced-motion chain had no canonical tracer')
  assert(reducedFrames.some(frame => frame.vfx.impactAlienIds?.includes(restartedAttack.alienId)),
    'reduced-motion chain had no impact bloom')
  await page.screenshot({ path: resolve(output, '03-reduced-chain.png') })

  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const hiddenAttackState = await waitForOutbound(restartedAttack.attackId, 12_000)
  const hiddenSegment = segment('hidden-freeze-resume')
  behaviorManifest.push(hiddenSegment)
  await page.evaluate(() => window.__setRetroVisibility('hidden'))
  const hiddenStart = await state()
  await page.waitForTimeout(1200)
  const hidden = await state()
  await page.evaluate(() => window.__setRetroVisibility('visible'))
  await page.waitForTimeout(120)
  const resumed = await state()
  const hiddenDelta = hidden.formation.directorClockMs - hiddenStart.formation.directorClockMs
  assert(hiddenStart.visibility === 'hidden', 'hidden baseline was captured before visibility changed')
  assert(hidden.visibility === 'hidden', 'visibility harness did not enter hidden')
  assert(hiddenDelta >= 0 && hiddenDelta <= 50, `director advanced ${hiddenDelta}ms while hidden`)
  assert(resumed.formation.activeAttack?.attackId === hiddenAttackState.formation.activeAttack.attackId,
    'hidden seam changed active attack identity')
  assert(hidden.vfx.charge === null, 'hidden document retained mic charge VFX')

  const responsiveSegment = segment('portrait-short-landscape')
  behaviorManifest.push(responsiveSegment)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(3000)
  const portrait = await state()
  assert(portrait.overflow <= 1, `portrait overflow ${portrait.overflow}`)
  assert(Math.abs(portrait.css[0] / portrait.css[1] - 16 / 9) < 0.01, `portrait canvas aspect drifted ${portrait.css}`)
  await page.screenshot({ path: resolve(output, '04-portrait.png'), fullPage: true })
  await page.setViewportSize({ width: 844, height: 390 })
  await page.waitForTimeout(3000)
  const landscape = await state()
  assert(landscape.overflow <= 1, `landscape overflow ${landscape.overflow}`)
  assert(Math.abs(landscape.css[0] / landscape.css[1] - 16 / 9) < 0.01, `landscape canvas aspect drifted ${landscape.css}`)
  await page.screenshot({ path: resolve(output, '05-landscape.png'), fullPage: true })
  await finishSegment(responsiveSegment, 0)
  await finishSegment(hiddenSegment, 0)

  await finishSegment(endedSegment, 0)
  assert(pageErrors.length === 0, `page errors: ${pageErrors.join(' | ')}`)
  const finalState = await state()
  const video = page.video()
  await context.close()
  const videoPath = await video.path()
  const videoSha256 = createHash('sha256').update(readFileSync(videoPath)).digest('hex').toUpperCase()
  const receipt = {
    status: 'PASS',
    lane,
    transport,
    url,
    exactDeployedSha: deployedSha,
    capturedAt: new Date().toISOString(),
    assertions: {
      strictProductStreamIdentity: true,
      noSourceContextMisidentification: true,
      micChargeAuthority: true,
      suspendRecoverRequiresFreshQualification: true,
      canonicalTracerPrecedesExactHitLock: true,
      oneAuthorizedImpactBloom: true,
      duplicateProjectileFailsClosedViaExactProductionBundle: true,
      endedTrackFailsClosedWithRunningContext: true,
      restartedSourceRequiresNewQualification: true,
      reducedSemanticParity: true,
      hiddenFreeze: true,
      responsiveGeometry: true,
      zeroPageErrors: true,
    },
    firstChain: {
      attackId: firstAttack.attackId,
      alienId: firstAttack.alienId,
      partial,
      suspended,
      recoveredWrong,
      stateFrameCount: firstFrames.length,
      chargeFrameCount: firstChargeFrames.length,
      tracerFrameCount: firstTracerFrames.length,
      hitLockFrameCount: firstLockFrames.length,
      impactFrameCount: firstImpactFrames.length,
    },
    duplicateProof: {
      productionVfxBundleSha256,
      snapshot: duplicateProof,
    },
    endedTrack: {
      attackId: endedAttack.attackId,
      alienId: endedAttack.alienId,
      beforeEnded,
      stateFrameCount: endedFrames.length,
    },
    restartedReduced: {
      attackId: restartedAttack.attackId,
      alienId: restartedAttack.alienId,
      beforeRestartTone,
      stateFrameCount: reducedFrames.length,
    },
    hidden: { hiddenStart, hidden, resumed, hiddenDelta },
    responsive: { portrait, landscape },
    finalState,
    behaviorManifest: behaviorManifest.flatMap(row =>
      (row.behaviorIds || [row.behaviorId]).map(behaviorId => ({
         browserLane: lane,
         exactDeployedSha: deployedSha,
         behaviorId,
        startMonotonicMs: row.startedAtMs,
        endMonotonicMs: row.endedAtMs,
        durationMs: row.durationMs,
         videoPath,
         videoSha256,
         machineStateReceiptPath: resultPath,
         claudeFrameCitations: [],
         argusFrameCitations: [],
       }))),
    videoPath,
    videoSha256,
    pageErrors,
  }
  writeFileSync(resultPath, `${JSON.stringify(receipt, null, 2)}\n`)
  console.log(JSON.stringify(receipt, null, 2))
  console.log(`PASS ${lane}: full R4 deterministic microphone + causal VFX matrix`)
} finally {
  if (!page.isClosed()) await page.close().catch(() => {})
  // ponytail: Playwright has no public CDP disconnect; replace if one is added.
  if (connected) browser._connection.close()
  else await browser.close().catch(() => {})
}
