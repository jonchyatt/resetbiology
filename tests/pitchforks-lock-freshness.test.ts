import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { observePitchforksSongcraftGeneration } from '../src/components/PitchDefender/PitchforksSongcraft'
import { pitchforksMicUnreliable } from '../src/components/PitchDefender/pitchforksTunerFeedback'
import { exactCents, noteToFreq } from '../src/components/PitchDefender/pitchMath'

/**
 * This is deliberately an extracted runtime check, not a copy of processLock.
 * The callback body is read from the mounted component and executed in a
 * controlled lexical environment. That keeps this regression attached to the
 * real lock gates while avoiding React, canvas, and browser setup.
 */
const source = readFileSync(
  resolve(process.cwd(), 'src/components/PitchDefender/PitchforksIII.tsx'),
  'utf8',
)
const processLockStart = source.indexOf('const processLock = useCallback((dt: number) => {')
assert.ok(processLockStart >= 0, 'mounted processLock callback is present')
const processLockBodyStart = source.indexOf('{', processLockStart) + 1
const processLockBodyEnd = source.indexOf('\n  }, [', processLockBodyStart)
assert.ok(processLockBodyStart > 0 && processLockBodyEnd > processLockBodyStart, 'mounted processLock body has a dependency boundary')
const processLockBody = source.slice(processLockBodyStart, processLockBodyEnd)
// The callback body is ordinary runtime JavaScript apart from this one local
// arrow parameter annotation. Strip only that known annotation; do not build a
// second implementation or broadly rewrite the component source.
const executableProcessLockBody = processLockBody.replace(
  /(confirmedExactHold): boolean/g,
  '$1',
)

const visibilityHandlerStart = source.indexOf('const handleVisibilityChange = () => {')
assert.ok(visibilityHandlerStart >= 0, 'mounted visibility handler is present')
const visibilityHandlerBodyStart = source.indexOf('{', visibilityHandlerStart) + 1
const visibilityHandlerBodyEnd = source.indexOf(
  '\n    }\n    document.addEventListener',
  visibilityHandlerBodyStart,
)
assert.ok(
  visibilityHandlerBodyStart > 0 && visibilityHandlerBodyEnd > visibilityHandlerBodyStart,
  'mounted visibility handler has a cleanup boundary',
)
const visibilityHandlerBody = source.slice(visibilityHandlerBodyStart, visibilityHandlerBodyEnd)

type Ref<T> = { current: T }
type VillagerState = 'walking' | 'ash'
type Pitch = {
  note: string
  frequency: number
  cents: number
  confidence: number
  isActive: boolean
}
type Target = {
  key: string
  note: string
  villager: {
    id: string
    state: VillagerState
    burned: number
    totalTines: number
    torchBearer: boolean
    torch: { phase: 'spent' }
    sequenceCued: boolean
  }
}

type Harness = {
  env: Record<string, unknown>
  target: Target
  strikeCalls: number
  bellChargeCalls: number
  run: (dt: number, now: number, generation: number) => void
}

const healthyPitch: Pitch = {
  note: 'C4',
  frequency: 261.6255653005986,
  cents: 0,
  confidence: 0.98,
  isActive: true,
}

const makeRef = <T,>(current: T): Ref<T> => ({ current })

function makeHarness(options: {
  demo?: boolean
  hidden?: boolean
  listening?: boolean
  suppressed?: boolean
  trackMuted?: boolean
  audioContextState?: string
  trackReadyState?: string
  micError?: string | null
} = {}): Harness {
  const target: Target = {
    key: 'villager-a:0',
    note: 'C4',
    villager: {
      id: 'villager-a',
      state: 'walking',
      burned: 0,
      totalTines: 1,
      torchBearer: false,
      torch: { phase: 'spent' },
      sequenceCued: true,
    },
  }
  const pitchRef = makeRef<Pitch | null>(healthyPitch)
  const pitchGenerationRef = makeRef(0)
  const lockGenerationRef = makeRef({
    lastGeneration: null as number | null,
    generationObserved: false,
    generationObservedAt: 0,
  })
  const activeKeyRef = makeRef('')
  const activeVillagerIdRef = makeRef<string | null>(null)
  const lockHeldMsRef = makeRef(0)
  const lockProgressRef = makeRef(0)
  const tintRef = makeRef<string | null>(null)
  const ceremonyRef = makeRef({ active: false })
  const bellWaveStateRef = makeRef({ phase: 'idle' })
  const bellChargeReceiptRef = makeRef<unknown>(null)
  const bellReleaseRequestedRef = makeRef(false)
  const bellProofRef = makeRef(true)
  const phaseRef = makeRef('playing')
  const bellChargeSequenceRef = makeRef(0)
  const closeSmashStateRef = makeRef({ phase: 'idle' })
  const thunderheadStateRef = makeRef({ phase: 'idle' })
  const bellArmRequestedRef = makeRef(false)
  const bellArmedTargetKeyRef = makeRef('')
  const bellLastReasonRef = makeRef('')
  const galvanicArmRequestedRef = makeRef(false)
  const galvanicArmedTargetKeyRef = makeRef('')
  const galvanicLastReasonRef = makeRef('')
  const galvanicAwaitingSilenceRef = makeRef(false)
  const galvanicBanksRef = makeRef<unknown[]>([])
  const galvanicProofRef = makeRef(false)
  const thunderheadArmRequestedRef = makeRef(false)
  const thunderheadClockMsRef = makeRef(0)
  const closeSmashReonsetNoteRef = makeRef<string | null>(null)
  const closeSmashReonsetStartedAtRef = makeRef(0)
  const demoRef = makeRef(options.demo === true)
  const demoPitchRef = makeRef<Pitch | null>(options.demo ? healthyPitch : null)
  const demoStepRef = makeRef('idle')
  const inputModeRef = makeRef('voice')
  const audioCueRef = makeRef(false)
  const buttonTrialRef = makeRef<unknown>(null)
  const runtimeRef = makeRef({ animClock: 0, firstVillagerId: 'villager-other' })
  const micSourceHealthRef = makeRef({
    audioContextState: options.audioContextState ?? 'running',
    trackReadyState: options.trackReadyState ?? 'live',
    trackMuted: options.trackMuted === true,
  })
  const isListeningRef = makeRef(options.listening !== false)
  const micErrorRef = makeRef<string | null>(options.micError ?? null)
  const firstMinuteCoachRef = makeRef({ beat: 'complete' })
  const firstMinuteBeatStartedAtRef = makeRef(0)
  const silenceFreezeObservedRef = makeRef(false)
  const resetCountRef = makeRef(0)
  const lastResetReasonRef = makeRef('')
  const torchSteppedTargetKeyRef = makeRef('')
  const waveReceiptRef = makeRef<{ claim: null }>({ claim: null })
  const victoryCancelledReceiptIdRef = makeRef<string | null>(null)
  const documentRef = { visibilityState: options.hidden ? 'hidden' : 'visible' }
  let suppressed = options.suppressed === true
  let strikeCalls = 0
  let bellChargeCalls = 0
  let nowMs = 0

  const getActiveTarget = () => target.villager.state === 'walking' ? target : null
  const strikeActiveTine = () => {
    strikeCalls += 1
    // Mimic the real resolution boundary enough to make repeated callback
    // frames observe a new target rather than counting one strike repeatedly.
    target.villager.state = 'ash'
  }
  const confirmBellCharge = (chargedTarget: Target, logicalNowMs: number) => {
    // This is the callback's injected authority boundary: processLock must
    // reach it only after a fresh exact hold, and the boundary consumes the arm
    // and publishes a receipt so later frames cannot invoke it again.
    if (
      !bellProofRef.current ||
      phaseRef.current !== 'playing' ||
      inputModeRef.current !== 'voice' ||
      !bellArmRequestedRef.current ||
      bellChargeReceiptRef.current !== null ||
      (bellWaveStateRef.current.phase !== 'idle' && bellWaveStateRef.current.phase !== 'finished') ||
      bellArmedTargetKeyRef.current !== chargedTarget.key
    ) return false
    bellChargeCalls += 1
    bellChargeSequenceRef.current += 1
    bellArmRequestedRef.current = false
    bellArmedTargetKeyRef.current = ''
    bellChargeReceiptRef.current = {
      receiptId: `bell-test:${bellChargeSequenceRef.current}`,
      targetKey: chargedTarget.key,
      note: chargedTarget.note,
      chargedAtMs: logicalNowMs,
    }
    lockHeldMsRef.current = 0
    lockProgressRef.current = 0
    tintRef.current = null
    activeKeyRef.current = ''
    return true
  }
  const env: Record<string, unknown> = {
    ceremonyRef,
    pauseSparkGuide: () => undefined,
    activeKeyRef,
    lockHeldMsRef,
    lockProgressRef,
    tintRef,
    bellWaveStateRef,
    bellChargeReceiptRef,
    bellReleaseRequestedRef,
    bellProofRef,
    phaseRef,
    bellChargeSequenceRef,
    closeSmashStateRef,
    thunderheadStateRef,
    strikePresentationPending: () => false,
    getActiveTarget,
    flushPendingMusicalPrompt: () => undefined,
    bellArmRequestedRef,
    bellArmedTargetKeyRef,
    bellLastReasonRef,
    galvanicArmRequestedRef,
    galvanicArmedTargetKeyRef,
    galvanicLastReasonRef,
    publishGalvanicProjection: () => undefined,
    resetSparkGuide: () => undefined,
    activeVillagerIdRef,
    setPromptText: () => undefined,
    setActiveCueContextSnapshot: () => undefined,
    buttonTrialRef,
    demoRef,
    demoStepRef,
    runtimeRef,
    advanceActiveTorch: undefined,
    stepTorch: (state: { phase: 'spent' }) => state,
    deriveRainEffects: () => ({ extinguish: false }),
    environmentalClockPausedNow: () => false,
    torchSteppedTargetKeyRef,
    presentMusicalPrompt: () => undefined,
    inputModeRef,
    playVillagerSequence: () => undefined,
    cueContextForVillager: () => ({ support: 'guided' }),
    audioCueRef,
    firstMinuteCoachRef,
    firstMinuteBeatStartedAtRef,
    setFirstMinuteCoachSnapshot: () => undefined,
    pitchGenerationRef,
    pitchRef,
    performance: { now: () => nowMs },
    demoPitchRef,
    demoPitchForTarget: () => healthyPitch,
    updateSparkGuide: () => undefined,
    lockGenerationRef,
    observePitchforksSongcraftGeneration,
    TRAIL_MS: 1000,
    micSourceHealthRef,
    matchingSuppressedNow: () => suppressed,
    pitchforksMicUnreliable,
    isListeningRef,
    micErrorRef,
    CONFIDENCE_FLOOR: 0.75,
    exactCents,
    noteToFreq,
    colorForCents: () => '#9fe8ff',
    MATCH_TOLERANCE_CENTS: 70,
    galvanicAwaitingSilenceRef,
    closeSmashReonsetNoteRef,
    closeSmashReonsetStartedAtRef,
    galvanicProofRef,
    galvanicBanksRef,
    GALVANIC_BANK_CAPACITY: 2,
    HOLD_MS: 300,
    confirmBellCharge,
    confirmGalvanicLock: () => undefined,
    thunderheadArmRequestedRef,
    confirmThunderheadLock: () => undefined,
    thunderheadClockMsRef,
    armCloseSmash: () => false,
    strikeActiveTine,
    resetCountRef,
    lastResetReasonRef,
    setButtonFeedback: () => undefined,
    silenceFreezeObservedRef,
    document: documentRef,
    waveReceiptRef,
    victoryCancelledReceiptIdRef,
  }

  // A Proxy is only used to make missing closure names fail naturally as
  // `undefined` instead of turning this test into a second hand-maintained
  // parameter list. All behavior-bearing names above are explicit stubs.
  const lexicalEnv = new Proxy(env, {
    has: (object, property) => Reflect.has(object, property),
    get: (object, property, receiver) => Reflect.get(object, property, receiver),
  })
  const factory = new Function(
    'env',
    [
      'return function extractedProcessLock(dt) {',
      '  with (env) {',
      executableProcessLockBody,
      '  }',
      '}',
    ].join('\n'),
  ) as (env: Record<string, unknown>) => (dt: number) => void
  const processLock = factory(lexicalEnv)

  return {
    env,
    target,
    get strikeCalls() { return strikeCalls },
    get bellChargeCalls() { return bellChargeCalls },
    run: (dt, now, generation) => {
      nowMs = now
      runtimeRef.current.animClock = now / 1000
      pitchGenerationRef.current = generation
      processLock(dt)
    },
  }
}

const visibilityFactory = new Function(
  'env',
  [
    'return function extractedVisibilityChange() {',
    '  with (env) {',
    visibilityHandlerBody,
    '  }',
    '}',
  ].join('\n'),
) as (env: Record<string, unknown>) => () => void

const runFreshFrames = (harness: Harness, frames: number, startGeneration = 1, startMs = 0, stepMs = 100) => {
  for (let index = 0; index < frames; index += 1) {
    harness.run(0.1, startMs + index * stepMs, startGeneration + index)
  }
}

const armBell = (harness: Harness): void => {
  (harness.env.bellArmRequestedRef as Ref<boolean>).current = true;
  (harness.env.bellArmedTargetKeyRef as Ref<string>).current = harness.target.key;
}

let checks = 0
const check = (run: () => void): void => {
  run()
  checks += 1
}

check(() => {
  assert.match(source, /observePitchforksSongcraftGeneration\(lockGenerationRef\.current/)
  assert.match(source, /holdElapsedMs = observation\.freshElapsedMs/)
  assert.match(source, /const unreliable = !pageVisible \|\| pitchforksMicUnreliable/)
  assert.match(visibilityHandlerBody, /lockGenerationRef\.current = \{ lastGeneration: pitchGenerationRef\.current/)
  assert.ok(processLockBody.includes('strikeActiveTine(target)'))
})

check(() => {
  const harness = makeHarness()
  // The exact source remains present and matching, but this is one detector
  // generation observed by more than 300 ms of render frames.
  for (let now = 0; now <= 400; now += 100) harness.run(0.1, now, 7)
  assert.equal(harness.strikeCalls, 0, 'unchanged generation cannot earn a strike')
  assert.equal((harness.env.lockHeldMsRef as Ref<number>).current, 0, 'unchanged generation does not accumulate hold')
})

check(() => {
  const harness = makeHarness()
  // First observation establishes the baseline; the first fresh generation
  // after that baseline is fenced, then three bounded fresh deltas reach 300ms.
  runFreshFrames(harness, 5)
  assert.equal(harness.strikeCalls, 1, 'fresh detector generations earn one strike')
})

check(() => {
  const harness = makeHarness()
  armBell(harness)
  // Bell is an armed exact-hold consumer, but an unchanged detector ref is
  // still only a cached sample and cannot charge the private route.
  for (let now = 0; now <= 400; now += 100) harness.run(0.1, now, 7)
  assert.equal(harness.bellChargeCalls, 0, 'unchanged generation cannot charge Bell')
  assert.equal(harness.strikeCalls, 0, 'failed Bell freshness cannot fall through to ordinary strike')
  assert.equal((harness.env.bellArmRequestedRef as Ref<boolean>).current, true, 'unresolved Bell arm remains pending')
  assert.equal((harness.env.bellChargeReceiptRef as Ref<unknown>).current, null)
})

check(() => {
  const harness = makeHarness()
  armBell(harness)
  runFreshFrames(harness, 5)
  assert.equal(harness.bellChargeCalls, 1, 'fresh exact generations charge Bell once')
  assert.equal(harness.strikeCalls, 0, 'Bell charge does not burn an ordinary tine')
  assert.equal((harness.env.bellArmRequestedRef as Ref<boolean>).current, false, 'Bell arm is consumed by the charge boundary')
  assert.notEqual((harness.env.bellChargeReceiptRef as Ref<unknown>).current, null, 'Bell charge publishes a receipt')

  // The receipt gate owns subsequent frames, even when fresh generations keep
  // arriving. No second charge or ordinary strike may leak through.
  runFreshFrames(harness, 5, 6, 500)
  assert.equal(harness.bellChargeCalls, 1, 'one accepted exact hold has one Bell charge')
  assert.equal(harness.strikeCalls, 0, 'receipt-owned Bell route blocks ordinary strike fallback')
})

for (const [label, options] of [
  ['unhealthy microphone', { listening: false }],
  ['muted track', { trackMuted: true }],
  ['ended track', { trackReadyState: 'ended' }],
  ['closed audio context', { audioContextState: 'closed' }],
  ['microphone error', { micError: 'permission denied' }],
  ['hidden page', { hidden: true }],
  ['suppressed matching window', { suppressed: true }],
] as const) {
  check(() => {
    const harness = makeHarness(options)
    runFreshFrames(harness, 6)
    assert.equal(harness.strikeCalls, 0, `${label} cannot earn a strike`)
    assert.equal((harness.env.lockHeldMsRef as Ref<number>).current, 0, `${label} clears hold state`)
  })
}

check(() => {
  const harness = makeHarness()
  harness.run(0.1, 0, 1)
  harness.run(0.1, 100, 2)
  harness.run(0.1, 200, 3)
  assert.equal((harness.env.lockHeldMsRef as Ref<number>).current, 100)

  // The detector stays unchanged across a stale gap. Recovery must fence the
  // next fresh sample instead of converting the old elapsed time into a hit.
  harness.run(0.1, 2_000, 3)
  harness.run(0.1, 2_100, 4)
  assert.equal(harness.strikeCalls, 0, 'stale-gap recovery cannot strike instantly')
  assert.equal((harness.env.lockHeldMsRef as Ref<number>).current, 0, 'stale-gap recovery resets hold')

  harness.run(0.1, 2_200, 5)
  harness.run(0.1, 2_300, 6)
  harness.run(0.1, 2_400, 7)
  assert.equal(harness.strikeCalls, 1, 'fresh samples after recovery can earn normally')
})

check(() => {
  const harness = makeHarness()
  harness.run(0.1, 0, 1)
  harness.run(0.1, 100, 2)
  harness.run(0.1, 200, 3)
  harness.run(0.1, 300, 4)
  assert.equal((harness.env.lockHeldMsRef as Ref<number>).current, 200)

  // RAF can stop while hidden, so exercise the real visibility event handler
  // instead of relying on a later processLock frame to notice the page state.
  const documentRef = harness.env.document as { visibilityState: string }
  documentRef.visibilityState = 'hidden'
  visibilityFactory(harness.env)()
  assert.equal((harness.env.lockHeldMsRef as Ref<number>).current, 0, 'visibility event clears a held lock')
  assert.equal((harness.env.lockProgressRef as Ref<number>).current, 0, 'visibility event clears lock progress')
  assert.equal((harness.env.tintRef as Ref<string | null>).current, null, 'visibility event clears tuner tint')

  documentRef.visibilityState = 'visible'
  // No processLock call occurs during the hidden 500ms interval. The resumed
  // frame has the same detector generation and cannot inherit pre-hide proof.
  harness.run(0.1, 800, 4)
  assert.equal(harness.strikeCalls, 0, 'resuming after hidden gap cannot strike from stale hold')
  assert.equal((harness.env.lockHeldMsRef as Ref<number>).current, 0)
  harness.run(0.1, 900, 5)
  assert.equal(harness.strikeCalls, 0, 'first fresh sample after hidden recovery is fenced')
  assert.equal((harness.env.lockHeldMsRef as Ref<number>).current, 0)
})

check(() => {
  const harness = makeHarness()
  harness.run(0.1, 0, 1)
  harness.run(0.1, 100, 2)

  const reonsetNoteRef = harness.env.closeSmashReonsetNoteRef as Ref<string | null>
  const reonsetStartedAtRef = harness.env.closeSmashReonsetStartedAtRef as Ref<number>
  const pitchRef = harness.env.pitchRef as Ref<Pitch | null>
  reonsetNoteRef.current = 'C4'
  reonsetStartedAtRef.current = 123
  pitchRef.current = { ...healthyPitch, frequency: 0, confidence: 0, isActive: false }

  // A cached inactive ref is not a new detector observation. processLock must
  // return at the freshness fence and leave the re-onset guard intact.
  harness.run(0.1, 200, 2)
  assert.equal(reonsetNoteRef.current, 'C4', 'cached inactive sample cannot clear re-onset guard')
  assert.equal(reonsetStartedAtRef.current, 123)

  // The next genuinely fresh inactive sample may clear the guard, but it still
  // earns no lock or ordinary strike.
  harness.run(0.1, 300, 3)
  assert.equal(reonsetNoteRef.current, null, 'fresh inactive sample clears re-onset guard')
  assert.equal(reonsetStartedAtRef.current, 0)
  assert.equal(harness.strikeCalls, 0)
  assert.equal((harness.env.lockHeldMsRef as Ref<number>).current, 0)
})

check(() => {
  const harness = makeHarness({ demo: true })
  // Demo uses the same callback but its authored pitch source is independent
  // of microphone-generation freshness; preserve that shipped path.
  runFreshFrames(harness, 3)
  assert.equal(harness.strikeCalls, 1, 'demo still resolves its authored exact hold')
})

console.log(`pitchforks lock freshness runtime regression: ${checks}/${checks} PASS (extracted processLock callback)`)
