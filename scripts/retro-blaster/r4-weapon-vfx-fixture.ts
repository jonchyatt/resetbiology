import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import {
  ALIEN_H,
  ALIEN_W,
  DIVE_ATTACK_Y,
  FORMATION_SLOT_COUNT,
  LASER_SPEED,
  MAX_SIM_STEP_MS,
  MIC_CONFIDENCE_FLOOR,
  MIC_TOLERANCE_CENTS,
  PLAYER_Y,
  SPACE_SCALE,
  createInitialState,
  finalizeHitLockedDeath,
  formationAnchor,
  tick,
  toViewState,
  type Alien,
  type EngineInput,
  type EnginePitch,
  type GameState,
  type ViewState,
} from '../../src/components/PitchDefender/retroBlasterEngine'
import { noteToFreq, octaveFoldedCents } from '../../src/components/PitchDefender/pitchMath'
import {
  MIC_VFX_STALE_FRAME_GRACE,
  advanceMicVfxFreshness,
  deriveMicLockSignalActive,
  deriveWeaponVfx,
  render,
  type MicLockSignalInput,
  type MicVfxFreshnessState,
} from '../../src/components/PitchDefender/retroBlasterRenderer'

const ROOT = process.cwd()
const BASE_SHA = process.env.RETRO_PROTECTED_BASE || '510a85288c1b86233175e94ce295253749febb46'
const TARGET_NOTE = 'C4'
const TARGET_ID = 'r4-fixture:alien:1:14'
const ATTACK_ID = 'r4-fixture:attack:1'
const HUE = 180
const assertions: string[] = []

function check(name: string, run: () => void): void {
  run()
  assertions.push(name)
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

function normalizedSource(value: string | Buffer): string {
  return value.toString().replace(/\r\n/g, '\n')
}

function frequencyAtCents(cents: number, octave = 0): number {
  return noteToFreq(TARGET_NOTE) * Math.pow(2, octave + cents / 1200)
}

function targetAlien(overrides: Partial<Alien> = {}): Alien {
  const anchor = formationAnchor(FORMATION_SLOT_COUNT - 1)
  return {
    alienId: TARGET_ID,
    visualId: 'r4-fixture:visual:14',
    visualKind: 3,
    x: anchor.x,
    y: DIVE_ATTACK_Y,
    entering: false,
    entryT: 1,
    entryTargetX: anchor.x,
    formationSlot: FORMATION_SLOT_COUNT - 1,
    formationX: anchor.x,
    formationY: anchor.y,
    note: TARGET_NOTE,
    hue: HUE,
    alive: true,
    frame: 0,
    hitTimer: 0,
    ...overrides,
  }
}

function activeAttack(phase: 'telegraph' | 'outbound' | 'hit-locked' | 'returning' = 'outbound') {
  return {
    attackId: ATTACK_ID,
    alienId: TARGET_ID,
    note: TARGET_NOTE,
    side: 1 as const,
    phase,
    telegraphStartedAtMs: 100,
    demandAtMs: 200,
    deadlineAtMs: 100_000,
    outboundT: 1,
    returnFromT: 1,
    returnStartedAtMs: phase === 'returning' ? 500 : null,
    outcome: phase === 'hit-locked' ? 'correct' as const : null,
    resolvedAtMs: phase === 'hit-locked' ? 500 : null,
  }
}

function view(overrides: Partial<ViewState> = {}): ViewState {
  return {
    aliens: [targetAlien()],
    lasers: [],
    particles: [],
    playerX: 320,
    charge: { fraction: 0, targetNote: null },
    hud: { score: 0, combo: 0, wave: 1, shields: 5, unlockedNotes: [TARGET_NOTE] },
    phase: 'playing',
    inputMode: 'mic',
    waveIntroTimer: 0,
    alienCountThisWave: 1,
    flashTimer: 0,
    wrongMessage: '',
    wrongTimer: 0,
    spotlightIdx: 0,
    nowMs: 160,
    activeAttack: activeAttack(),
    requiredAnswerEventsMs: [],
    lastCompletedWavePacing: null,
    noteButtons: [],
    ...overrides,
  }
}

function pitch(overrides: Partial<EnginePitch> = {}): EnginePitch {
  return {
    note: TARGET_NOTE,
    frequency: noteToFreq(TARGET_NOTE),
    cents: 0,
    confidence: 1,
    isActive: true,
    ...overrides,
  }
}

const healthySource = {
  audioContextState: 'running',
  trackReadyState: 'live' as const,
  trackMuted: false,
}

function signalInput(overrides: Partial<MicLockSignalInput> = {}): MicLockSignalInput {
  return {
    inputMode: 'mic',
    isListening: true,
    isVisible: true,
    targetNote: TARGET_NOTE,
    micSourceHealth: healthySource,
    hasFreshGeneration: true,
    pitch: pitch(),
    ...overrides,
  }
}

function engineState(): GameState {
  const state = createInitialState('easy', [TARGET_NOTE, 'D4', 'E4', 'F4'], 1000, 'r4-fixture')
  state.phase = 'playing'
  state.clockMs = 1000
  state.directorClockMs = 1000
  state.waveIntroTimer = 0
  state.aliens = [targetAlien()]
  state.spawnQueue = ['G4']
  state.activeAttack = activeAttack()
  state.matchStartAt = 0
  state.matchTargetAlienId = null
  return state
}

function engineInput(candidate: EnginePitch | null): EngineInput {
  return {
    inputMode: 'mic',
    isListening: true,
    reducedMotion: false,
    pitch: candidate,
    fsrs: {},
    isActive: true,
  }
}

function engineAccepts(candidate: EnginePitch | null): boolean {
  const result = tick(engineState(), engineInput(candidate), 16, () => 0.5)
  return result.state.matchTargetAlienId === TARGET_ID
}

check('protected engine remains byte-identical to the ratified base', () => {
  const relative = 'src/components/PitchDefender/retroBlasterEngine.ts'
  const current = readFileSync(resolve(ROOT, relative))
  const base = execFileSync('git', ['show', `${BASE_SHA}:${relative}`], { cwd: ROOT })
  assert.equal(sha256(normalizedSource(current)), sha256(normalizedSource(base)))
})

check('mic authority predicate closes every independent failure gate', () => {
  assert.equal(deriveMicLockSignalActive(signalInput()), true)
  const falseCases: MicLockSignalInput[] = [
    signalInput({ inputMode: 'click' }),
    signalInput({ isListening: false }),
    signalInput({ isVisible: false }),
    signalInput({ targetNote: null }),
    signalInput({ micSourceHealth: { ...healthySource, audioContextState: 'suspended' } }),
    signalInput({ micSourceHealth: { ...healthySource, audioContextState: 'interrupted' } }),
    signalInput({ micSourceHealth: { ...healthySource, audioContextState: 'closed' } }),
    signalInput({ micSourceHealth: { ...healthySource, trackMuted: true } }),
    signalInput({ micSourceHealth: { ...healthySource, trackReadyState: 'ended' } }),
    signalInput({ micSourceHealth: { ...healthySource, trackReadyState: 'unavailable' } }),
    signalInput({ hasFreshGeneration: false }),
    signalInput({ pitch: null }),
    signalInput({ pitch: pitch({ isActive: false }) }),
    signalInput({ pitch: pitch({ confidence: MIC_CONFIDENCE_FLOOR - 0.0001 }) }),
    signalInput({ pitch: pitch({ frequency: 0 }) }),
    signalInput({ pitch: pitch({ frequency: frequencyAtCents(MIC_TOLERANCE_CENTS + 0.01) }) }),
  ]
  for (const candidate of falseCases) assert.equal(deriveMicLockSignalActive(candidate), false)
  assert.equal(deriveMicLockSignalActive(signalInput({
    pitch: pitch({ confidence: MIC_CONFIDENCE_FLOOR }),
  })), true)
  assert.equal(deriveMicLockSignalActive(signalInput({
    pitch: pitch({ frequency: frequencyAtCents(MIC_TOLERANCE_CENTS - 1e-9) }),
  })), true)
  assert.equal(deriveMicLockSignalActive(signalInput({
    pitch: pitch({ frequency: frequencyAtCents(0, 1) }),
  })), true)
})

check('freshness schedules stay lit through 3:1 and fail closed on frame four', () => {
  const initial = (): MicVfxFreshnessState => ({
    lastGeneration: 0,
    hasObservedMicGeneration: false,
    staleGameFrames: 0,
  })
  for (const gamesPerAnalyzer of [1, 2, 3]) {
    let state = initial()
    let generation = 0
    for (let cycle = 0; cycle < 12; cycle++) {
      generation += 1
      for (let frame = 0; frame < gamesPerAnalyzer; frame++) {
        const next = advanceMicVfxFreshness(state, generation, true)
        state = next.state
        assert.equal(next.hasFreshGeneration, true)
      }
    }
  }

  let state = initial()
  let next = advanceMicVfxFreshness(state, 1, true)
  state = next.state
  assert.equal(next.hasFreshGeneration, true)
  for (let staleFrame = 1; staleFrame <= MIC_VFX_STALE_FRAME_GRACE; staleFrame++) {
    next = advanceMicVfxFreshness(state, 1, true)
    state = next.state
    assert.equal(next.hasFreshGeneration, true)
    assert.equal(state.staleGameFrames, staleFrame)
  }
  next = advanceMicVfxFreshness(state, 1, true)
  assert.equal(next.state.staleGameFrames, MIC_VFX_STALE_FRAME_GRACE + 1)
  assert.equal(next.hasFreshGeneration, false)

  const reset = advanceMicVfxFreshness(next.state, 1, false)
  assert.equal(reset.hasFreshGeneration, false)
  assert.equal(advanceMicVfxFreshness(reset.state, 1, true).hasFreshGeneration, false)
  assert.equal(advanceMicVfxFreshness(reset.state, 2, true).hasFreshGeneration, true)
  const wallTimeDoesNotExistInFrameCausalApi = advanceMicVfxFreshness(state, 2, true)
  assert.equal(wallTimeDoesNotExistInFrameCausalApi.hasFreshGeneration, true)
})

check('presentation predicate agrees with the frozen engine qualifier', () => {
  const boundaryCases = [
    pitch(),
    pitch({ confidence: MIC_CONFIDENCE_FLOOR }),
    pitch({ confidence: MIC_CONFIDENCE_FLOOR - 0.0001 }),
    pitch({ frequency: 0 }),
    pitch({ frequency: frequencyAtCents(MIC_TOLERANCE_CENTS - 1e-9) }),
    pitch({ frequency: frequencyAtCents(MIC_TOLERANCE_CENTS + 0.01) }),
    pitch({ frequency: frequencyAtCents(-MIC_TOLERANCE_CENTS + 1e-9) }),
    pitch({ frequency: frequencyAtCents(-MIC_TOLERANCE_CENTS - 0.01) }),
    pitch({ frequency: frequencyAtCents(0, 1) }),
    pitch({ isActive: false }),
  ]
  for (const candidate of boundaryCases) {
    assert.equal(
      deriveMicLockSignalActive(signalInput({ pitch: candidate })),
      engineAccepts(candidate),
    )
  }

  let seed = 0x5eedc0de
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0
    return seed / 0x1_0000_0000
  }
  for (let index = 0; index < 1000; index++) {
    const cents = -800 + random() * 1600
    const octave = Math.floor(random() * 3) - 1
    const candidate = pitch({
      frequency: frequencyAtCents(cents, octave),
      confidence: 0.5 + random() * 0.5,
      isActive: random() > 0.15,
    })
    assert.equal(
      deriveMicLockSignalActive(signalInput({ pitch: candidate })),
      engineAccepts(candidate),
      `random concordance case ${index}`,
    )
  }
})

check('charge is real-mic-only and bound to the open attack target', () => {
  for (const fraction of [0, 0.2, 0.8, 1]) {
    const snapshot = deriveWeaponVfx(view({
      charge: { fraction, targetNote: TARGET_NOTE },
    }), true)
    assert.equal(snapshot.charge !== null, fraction > 0)
    if (snapshot.charge) {
      assert.deepEqual(Object.keys(snapshot.charge), ['attackId', 'alienId', 'fraction', 'hue'])
      assert.equal(snapshot.charge.attackId, ATTACK_ID)
      assert.equal(snapshot.charge.alienId, TARGET_ID)
      assert.equal(snapshot.charge.fraction, fraction)
    }
  }
  assert.equal(deriveWeaponVfx(view({
    inputMode: 'click', charge: { fraction: 0.8, targetNote: TARGET_NOTE },
  }), true).charge, null)
  assert.equal(deriveWeaponVfx(view({
    charge: { fraction: 0.8, targetNote: TARGET_NOTE },
  }), false).charge, null)
  assert.equal(deriveWeaponVfx(view({
    charge: { fraction: 0.8, targetNote: 'D4' },
  }), true).charge, null)
  assert.equal(deriveWeaponVfx(view({
    charge: { fraction: 0.8, targetNote: TARGET_NOTE }, activeAttack: activeAttack('returning'),
  }), true).charge, null)
  assert.equal(deriveWeaponVfx(view({
    aliens: [targetAlien({ alive: false })],
    charge: { fraction: 0.8, targetNote: TARGET_NOTE },
  }), true).charge, null)
})

function tracerView(progress: number, duplicates = 1): ViewState {
  const targetY = DIVE_ATTACK_Y + ALIEN_H / 2
  const y = PLAYER_Y - progress * (PLAYER_Y - targetY)
  return view({
    activeAttack: activeAttack('hit-locked'),
    lasers: Array.from({ length: duplicates }, () => ({
      x: 320,
      y,
      hue: HUE,
      active: true,
      hits: true,
      targetY,
      targetAlienId: TARGET_ID,
      attackId: ATTACK_ID,
    })),
  })
}

check('canonical tracer and hit-lock are unique, ID-bound, and threshold exact', () => {
  for (const progress of [0, 0.5499, 0.55, 1]) {
    const snapshot = deriveWeaponVfx(tracerView(progress), false)
    assert.ok(snapshot.tracer)
    assert.deepEqual(
      Object.keys(snapshot.tracer),
      ['attackId', 'alienId', 'laserIndex', 'flightProgress'],
    )
    assert.ok(Math.abs(snapshot.tracer.flightProgress - progress) < 1e-9)
    assert.equal(snapshot.hitLockAttackId, progress >= 0.55 ? ATTACK_ID : null)
  }
  for (const duplicateCount of [0, 2, 3]) {
    const snapshot = deriveWeaponVfx(tracerView(0.8, duplicateCount), false)
    assert.equal(snapshot.tracer, null)
    assert.equal(snapshot.hitLockAttackId, null)
  }
  const mutations: Array<(state: ViewState) => void> = [
    state => { state.lasers[0].hits = false },
    state => { state.lasers[0].attackId = null },
    state => { state.lasers[0].targetAlienId = null },
    state => { state.lasers[0].attackId = 'stale' },
    state => { state.lasers[0].targetAlienId = 'stale' },
    state => { state.activeAttack = activeAttack('returning') },
    state => { state.activeAttack = null },
  ]
  for (const mutate of mutations) {
    const state = tracerView(0.8)
    mutate(state)
    const snapshot = deriveWeaponVfx(state, false)
    assert.equal(snapshot.tracer, null)
    assert.equal(snapshot.hitLockAttackId, null)
  }
})

check('deepest legal dive retains an observable pre-lock tracer frame', () => {
  const deepestFormationY = Math.max(...Array.from(
    { length: FORMATION_SLOT_COUNT },
    (_, slot) => formationAnchor(slot).y,
  ))
  assert.ok(DIVE_ATTACK_Y >= deepestFormationY)
  const targetCenter = DIVE_ATTACK_Y + ALIEN_H / 2
  const maximumFirstStep = LASER_SPEED * (MAX_SIM_STEP_MS / 1000)
  const maximumFirstProgress = maximumFirstStep / (PLAYER_Y - targetCenter)
  assert.ok(maximumFirstProgress < 0.55)
})

check('finalizer authorizes bloom even when presentation projectile is missing', () => {
  const state = engineState()
  state.activeAttack = activeAttack('hit-locked')
  const acceptedMapping = `${state.activeAttack.attackId}->${state.activeAttack.alienId}`
  assert.equal(acceptedMapping, `${ATTACK_ID}->${TARGET_ID}`)
  assert.equal(finalizeHitLockedDeath(state, ATTACK_ID, [], () => 0.5), true)
  const impact = deriveWeaponVfx(toViewState(state, 'mic'), false)
  assert.equal(impact.tracer, null)
  assert.equal(impact.hitLockAttackId, null)
  assert.deepEqual(impact.impactAlienIds, [TARGET_ID])
  assert.equal(finalizeHitLockedDeath(state, ATTACK_ID, [], () => 0.5), false)

  const hiddenTimer = state.aliens[0].hitTimer
  const hidden = tick(state, { ...engineInput(null), isActive: false }, 1000, () => 0.5).state
  assert.equal(hidden.aliens[0].hitTimer, hiddenTimer)
  let visible = hidden
  for (let frame = 0; frame < 9; frame++) {
    visible = tick(visible, engineInput(null), MAX_SIM_STEP_MS, () => 0.5).state
  }
  assert.deepEqual(deriveWeaponVfx(toViewState(visible, 'mic'), false).impactAlienIds, [])

  const missingTarget = engineState()
  missingTarget.activeAttack = activeAttack('hit-locked')
  missingTarget.aliens = []
  assert.equal(finalizeHitLockedDeath(missingTarget, ATTACK_ID, [], () => 0.5), true)
  assert.deepEqual(deriveWeaponVfx(toViewState(missingTarget, 'mic'), false).impactAlienIds, [])

  const wrong = engineState()
  wrong.activeAttack = { ...activeAttack('hit-locked'), outcome: 'wrong' }
  assert.equal(finalizeHitLockedDeath(wrong, ATTACK_ID, [], () => 0.5), false)
  assert.equal(finalizeHitLockedDeath(engineState(), 'stale', [], () => 0.5), false)
})

type DrawCall = {
  op: string
  style: string
  lineWidth?: number
  args: number[]
  path?: number[][]
}

class RecordingContext {
  fillStyle = ''
  strokeStyle = ''
  lineWidth = 1
  globalAlpha = 1
  font = ''
  textAlign = 'left'
  calls: DrawCall[] = []
  path: number[][] = []

  fillRect(...args: number[]) { this.calls.push({ op: 'fillRect', style: String(this.fillStyle), args }) }
  strokeRect(...args: number[]) {
    this.calls.push({ op: 'strokeRect', style: String(this.strokeStyle), lineWidth: this.lineWidth, args })
  }
  beginPath() { this.path = [] }
  moveTo(...args: number[]) { this.path.push(args) }
  lineTo(...args: number[]) { this.path.push(args) }
  stroke() {
    this.calls.push({
      op: 'stroke', style: String(this.strokeStyle), lineWidth: this.lineWidth,
      args: [], path: this.path.map(point => [...point]),
    })
  }
  fillText() {}
  drawImage() {}
  save() {}
  restore() {}
  translate() {}
  scale() {}
}

function rendered(state: ViewState, options: Parameters<typeof render>[2]) {
  const context = new RecordingContext()
  const snapshot = render(context as unknown as CanvasRenderingContext2D, state, options)
  return { context, snapshot }
}

function callByStyle(context: RecordingContext, style: string, op: string): DrawCall {
  const call = context.calls.find(candidate => candidate.style === style && candidate.op === op)
  assert.ok(call, `missing ${op} call with ${style}`)
  return call
}

check('geometry oracle pins charge, tracer, lock, bloom, motion, and hint neutrality', () => {
  const chargeState = view({ charge: { fraction: 0.5, targetNote: TARGET_NOTE } })
  const chargeResult = rendered(chargeState, {
    micLockSignalActive: true, reducedMotion: true, colorHints: true,
  })
  const outer = callByStyle(chargeResult.context, `hsla(${HUE}, 92%, 72%, 0.15)`, 'fillRect')
  const outerWidth = (12 + 18 * 0.5) * SPACE_SCALE
  assert.deepEqual(outer.args, [
    Math.floor(chargeState.playerX - outerWidth / 2),
    Math.floor(PLAYER_Y - (7 + 2 * 0.5) * SPACE_SCALE),
    Math.max(1, Math.round(outerWidth)),
    Math.max(1, Math.round((7 + 4 * 0.5) * SPACE_SCALE)),
  ])
  assert.equal(chargeResult.context.calls.filter(call =>
    call.style.startsWith(`hsla(${HUE}, 92%, 72%`)).length, 4)

  const neutralCharge = rendered(chargeState, {
    micLockSignalActive: true, reducedMotion: true, colorHints: false,
  })
  assert.ok(neutralCharge.context.calls.some(call => call.style === 'rgba(200,245,255,0.15)'))
  assert.deepEqual(neutralCharge.snapshot, chargeResult.snapshot)

  const tracerState = tracerView(0.8)
  const tracerResult = rendered(tracerState, { reducedMotion: true, colorHints: true })
  const outerTail = callByStyle(tracerResult.context, `hsla(${HUE},95%,78%,0.16)`, 'fillRect')
  const laser = tracerState.lasers[0]
  const tail = Math.min(24 * SPACE_SCALE, Math.max(12 * SPACE_SCALE, PLAYER_Y - laser.y))
  assert.deepEqual(outerTail.args, [
    Math.floor(laser.x - 3.5 * SPACE_SCALE),
    Math.floor(laser.y),
    Math.max(1, Math.round(7 * SPACE_SCALE)),
    Math.max(1, Math.round(Math.min(PLAYER_Y, laser.y + tail) - laser.y)),
  ])
  callByStyle(tracerResult.context, `hsla(${HUE},98%,86%,0.72)`, 'fillRect')
  const lock = callByStyle(tracerResult.context, `hsla(${HUE},96%,82%,0.84)`, 'stroke')
  assert.equal(lock.path?.length, 6)
  assert.deepEqual(tracerResult.snapshot, deriveWeaponVfx(tracerState, false))

  const impactState = view({
    aliens: [targetAlien({ alive: false, hitTimer: 0.2 })],
    activeAttack: null,
  })
  const expandingBloom = rendered(impactState, { reducedMotion: false, colorHints: true })
  const outerBloom = callByStyle(expandingBloom.context, `hsla(${HUE},92%,68%,0.17)`, 'strokeRect')
  assert.equal(outerBloom.args[2], Math.max(1, Math.round(2 * (9 + 18 * 0.5) * SPACE_SCALE)))
  const fixedBloom = rendered(impactState, { reducedMotion: true, colorHints: false })
  const fixedOuter = callByStyle(fixedBloom.context, 'rgba(174,220,237,0.17)', 'strokeRect')
  assert.equal(fixedOuter.args[2], Math.max(1, Math.round(2 * 18 * SPACE_SCALE)))
  callByStyle(fixedBloom.context, 'rgba(220,250,255,0.34)', 'strokeRect')
  assert.deepEqual(fixedBloom.snapshot, expandingBloom.snapshot)
})

check('shell uses one captured tuple and change-only derive-once datasets', () => {
  const shell = readFileSync(resolve(ROOT, 'src/components/PitchDefender/RetroBlasterII.tsx'), 'utf8')
  const renderer = readFileSync(
    resolve(ROOT, 'src/components/PitchDefender/retroBlasterRenderer.ts'), 'utf8',
  )
  assert.match(shell, /const capturedPitch = livePitchRef\.current/)
  assert.match(shell, /const capturedMicSourceHealth = micSourceHealthRef\.current/)
  assert.match(shell, /const capturedPitchGeneration = pitchGenerationRef\.current/)
  assert.match(shell, /pitch: capturedPitch/)
  assert.match(shell, /const weaponVfx = render\(/)
  assert.match(shell, /JSON\.stringify\(weaponVfx\)/)
  assert.match(shell, /weaponVfxDataset !== lastWeaponVfxDatasetRef\.current/)
  assert.doesNotMatch(shell, /pitch:\s*pitch\b/)
  assert.equal((renderer.match(/deriveWeaponVfx\(viewState,/g) ?? []).length, 1)
  assert.match(renderer, /const weaponVfx = deriveWeaponVfx\(viewState,/)
  assert.match(renderer, /return weaponVfx\s*\n}/)
  assert.doesNotMatch(renderer, /Date\.now\(\)|performance\.now\(\)/)
})

check('hook observer extension preserves ten destructuring consumers', () => {
  const files = execFileSync(
    'git', ['grep', '-l', 'usePitchDetection(', '--', 'src', 'app'],
    { cwd: ROOT, encoding: 'utf8' },
  ).trim().split(/\r?\n/).filter(Boolean)
  const consumers = files.filter(file => !file.endsWith('usePitchDetection.ts'))
  assert.equal(consumers.length, 10)
  for (const file of consumers) {
    const source = readFileSync(resolve(ROOT, file), 'utf8')
    assert.match(source, /const\s*{[\s\S]{0,500}}\s*=\s*usePitchDetection\s*\(/)
    assert.doesNotMatch(source, /const\s+[A-Za-z_$][\w$]*\s*=\s*usePitchDetection\s*\(/)
    assert.doesNotMatch(source, /\.\.\.\s*usePitchDetection\s*\(/)
  }
  const hook = readFileSync(resolve(ROOT, 'src/components/PitchDefender/usePitchDetection.ts'), 'utf8')
  for (const event of ['statechange', 'mute', 'unmute', 'ended']) {
    assert.match(hook, new RegExp(`addEventListener\\('${event}'`))
    assert.match(hook, new RegExp(`removeEventListener\\('${event}'`))
  }
  assert.equal((hook.match(/pitchGenerationRef\.current \+= 1/g) ?? []).length, 1)
  assert.match(hook, /syncMicSourceHealth\(\)\s*\n\s*pitchGenerationRef\.current \+= 1/)
})

check('adversarial ended-track interleaving always defeats an advanced generation', () => {
  const previous: MicVfxFreshnessState = {
    lastGeneration: 10,
    hasObservedMicGeneration: true,
    staleGameFrames: 0,
  }
  const healthAfterEnded = { ...healthySource, trackReadyState: 'ended' as const }
  const sourceEligible = healthAfterEnded.audioContextState === 'running' &&
    healthAfterEnded.trackReadyState === 'live' &&
    healthAfterEnded.trackMuted === false
  const freshness = advanceMicVfxFreshness(previous, 11, sourceEligible)
  assert.equal(freshness.hasFreshGeneration, false)
  assert.equal(deriveMicLockSignalActive(signalInput({
    micSourceHealth: healthAfterEnded,
    hasFreshGeneration: freshness.hasFreshGeneration,
  })), false)
  assert.equal(deriveWeaponVfx(view({
    charge: { fraction: 0.8, targetNote: TARGET_NOTE },
  }), false).charge, null)
})

const hookPath = resolve(ROOT, 'src/components/PitchDefender/usePitchDetection.ts')
const baseHook = execFileSync('git', [
  'show', `${BASE_SHA}:src/components/PitchDefender/usePitchDetection.ts`,
], { cwd: ROOT })
const receipt = {
  status: 'PASS',
  baseSha: BASE_SHA,
  assertionCount: assertions.length,
  assertions,
  protectedEngineSha256: sha256(normalizedSource(readFileSync(resolve(
    ROOT, 'src/components/PitchDefender/retroBlasterEngine.ts',
  )))),
  hookBeforeSha256: sha256(baseHook),
  hookAfterSha256: sha256(readFileSync(hookPath)),
  constants: {
    micConfidenceFloor: MIC_CONFIDENCE_FLOOR,
    micToleranceCents: MIC_TOLERANCE_CENTS,
    staleFrameGrace: MIC_VFX_STALE_FRAME_GRACE,
    maxSimStepMs: MAX_SIM_STEP_MS,
    laserSpeed: LASER_SPEED,
    playerY: PLAYER_Y,
    diveAttackY: DIVE_ATTACK_Y,
    alienHeight: ALIEN_H,
    alienWidth: ALIEN_W,
  },
  targetFrequency: noteToFreq(TARGET_NOTE),
  foldedBoundaryCheck: octaveFoldedCents(
    frequencyAtCents(MIC_TOLERANCE_CENTS - 1e-9), noteToFreq(TARGET_NOTE),
  ),
}
const receiptPath = resolve(
  ROOT,
  'data/retro-blaster-rework/runtime-logs/r4-weapon-vfx-fixture/result.json',
)
mkdirSync(dirname(receiptPath), { recursive: true })
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)
console.log(JSON.stringify({ ...receipt, receiptPath }, null, 2))
