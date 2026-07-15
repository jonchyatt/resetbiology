import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import {
  DIVE_RESPONSE_DEADLINE_MS,
  FORMATION_SLOT_COUNT,
  buildWaveQueue,
  chooseNextDiver,
  createInitialState,
  formationAnchor,
  resolveAttack,
  snapshotNoteSoul,
  tick,
  type Alien,
  type EngineEvent,
  type EngineInput,
  type GameState,
  type NoteSoulSnapshot,
  type PendingAttackAnswer,
} from '../../src/components/PitchDefender/retroBlasterEngine'
import {
  SOUL_CALM_DAMPING,
  SOUL_SLOT_PHASE_RADIANS,
  SOUL_VERTICAL_RATIO,
  SOUL_WOBBLE_PX,
  SOUL_WOBBLE_RADIANS_PER_SECOND,
  advanceMicVfxFreshness,
  deriveSoulRenderOffset,
} from '../../src/components/PitchDefender/retroBlasterRenderer'
import {
  activeLaneStore,
  applyRetroBlasterFamilyEvent,
  type RetroBlasterFamilyStores,
} from '../../src/components/PitchDefender/RetroBlasterII'
import { createNote, retrievability, type NoteMemory } from '../../src/lib/fsrs'
import { INTRO_ORDER } from '../../src/components/PitchDefender/types'

const EPOCH = 1_800_000_000_000
const PROTECTED_BASE = '6f4c8da158b9773bbda90eef0cc51334e6fa636b'
const NOTES = ['C4', 'D4', 'E4', 'F4']
const assertions: string[] = []
const check = (name: string, run: () => void) => { run(); assertions.push(name) }

class StorageMock implements Storage {
  #values = new Map<string, string>()
  get length() { return this.#values.size }
  clear() { this.#values.clear() }
  getItem(key: string) { return this.#values.get(key) ?? null }
  key(index: number) { return [...this.#values.keys()][index] ?? null }
  removeItem(key: string) { this.#values.delete(key) }
  setItem(key: string, value: string) { this.#values.set(key, String(value)) }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: new StorageMock(), configurable: true, writable: true,
})

function memory(
  note: string,
  overrides: Partial<NoteMemory> = {},
): NoteMemory {
  return {
    ...createNote(note),
    phase: 'review',
    S: 4,
    due: EPOCH,
    lastReview: EPOCH - 4 * 86_400_000,
    learningReps: 2,
    ...overrides,
  }
}

function soul(note = 'C4', overrides: Partial<NoteSoulSnapshot> = {}): NoteSoulSnapshot {
  return {
    note, r: 0.5, calm: 0.5, due: true, agitation: 0.5, divePressure: 2,
    ...overrides,
  }
}

function alien(slot: number, profile = soul(NOTES[slot % NOTES.length])): Alien {
  const anchor = formationAnchor(slot)
  return {
    alienId: `r7-game:alien:1:${slot}`,
    visualId: `r7:${slot}`,
    visualKind: (slot % 4) as 0 | 1 | 2 | 3,
    x: anchor.x,
    y: anchor.y,
    entering: false,
    entryT: 1,
    entryTargetX: anchor.x,
    formationSlot: slot,
    formationX: anchor.x,
    formationY: anchor.y,
    note: profile.note,
    hue: 180,
    soul: { ...profile },
    diveServiceCount: 0,
    alive: true,
    frame: 0,
    hitTimer: 0,
  }
}

function openAttack(inputMode: 'click' | 'mic' = 'click'): GameState {
  const state = createInitialState('easy', NOTES, 1000, 'r7-game')
  const target = alien(0)
  state.waveIntroTimer = 0
  state.spawnQueue = []
  state.aliens = [target]
  state.spawnedThisWave = 1
  state.alienCountThisWave = 1
  state.activeAttack = {
    attackId: 'r7-game:attack:1',
    alienId: target.alienId,
    note: target.note,
    side: 1,
    phase: 'outbound',
    telegraphStartedAtMs: state.directorClockMs - 350,
    demandAtMs: state.directorClockMs,
    deadlineAtMs: state.directorClockMs + DIVE_RESPONSE_DEADLINE_MS,
    outboundT: 0,
    returnFromT: 0,
    returnStartedAtMs: null,
    outcome: null,
    resolvedAtMs: null,
    voiceWindowEligible: inputMode === 'mic' ? null : null,
    voiceHeardPhonation: false,
  }
  state.nextAttackAtMs = Number.POSITIVE_INFINITY
  return state
}

function engineInput(overrides: Partial<EngineInput> = {}): EngineInput {
  return {
    inputMode: 'click',
    isListening: false,
    reducedMotion: false,
    pitch: null,
    fsrs: {},
    isActive: true,
    memoryEpochMs: EPOCH,
    voiceTimeoutObservation: { healthy: false, heard: false },
    ...overrides,
  }
}

function pending(state: GameState, note: string): PendingAttackAnswer {
  return {
    note,
    inputMode: 'click',
    gameId: state.gameId,
    alienId: state.activeAttack!.alienId,
    attackId: state.activeAttack!.attackId,
  }
}

function grades(events: readonly EngineEvent[]) {
  return events.filter((event): event is Extract<EngineEvent, { kind: 'grade' }> => event.kind === 'grade')
}

function apply(events: readonly EngineEvent[], stores: RetroBlasterFamilyStores): void {
  for (const event of events) applyRetroBlasterFamilyEvent(event, 'click', stores)
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0
  return () => {
    value += 0x6D2B79F5
    let t = value
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const originalNow = Date.now
Date.now = () => EPOCH
try {
  check('S1 explicit epoch produces exact bounded R S due soul', () => {
    const mem = memory('C4')
    const profile = snapshotNoteSoul('C4', mem, EPOCH)
    assert.equal(profile.r, retrievability(4, 4))
    assert.equal(profile.calm, retrievability(1, 4))
    assert.equal(profile.due, true)
    assert.equal(profile.agitation, 1 - profile.r)
    assert.equal(profile.divePressure, 1 + profile.agitation + (1 - profile.calm))
    const fresh = snapshotNoteSoul('C4', undefined, EPOCH)
    assert.equal(fresh.note, 'C4'); assert.equal(fresh.r, 0.95); assert.equal(fresh.calm, 0)
    assert.equal(fresh.due, true); assert(Math.abs(fresh.agitation - 0.05) < 1e-12)
    assert(Math.abs(fresh.divePressure - 2.05) < 1e-12)
  })

  check('S2 due boundary and future lastReview remain deterministic', () => {
    assert.equal(snapshotNoteSoul('C4', memory('C4', { due: EPOCH - 1 }), EPOCH).due, true)
    assert.equal(snapshotNoteSoul('C4', memory('C4', { due: EPOCH }), EPOCH).due, true)
    assert.equal(snapshotNoteSoul('C4', memory('C4', { due: EPOCH + 1 }), EPOCH).due, false)
    const future = snapshotNoteSoul('C4', memory('C4', { lastReview: EPOCH + 1000 }), EPOCH)
    assert.equal(future.r, 1); assert(Number.isFinite(future.divePressure))
  })

  check('S3 one captured epoch drives snapshot due and roster despite external mutation', () => {
    let externalEpoch = EPOCH
    const store = new Proxy<Record<string, NoteMemory>>({
      C4: memory('C4', { due: EPOCH + 1 }),
    }, {
      get(target, key, receiver) {
        externalEpoch += 10_000
        return Reflect.get(target, key, receiver)
      },
    })
    const state = createInitialState('easy', ['C4'], 1000, 'epoch-fixture')
    buildWaveQueue(state, store, EPOCH)
    assert(externalEpoch > EPOCH)
    assert.equal(state.waveSoulByNote.C4.due, false)
    assert.deepEqual(state.spawnQueue, ['C4', 'C4'])
  })

  check('S4 due overflow is due-only and fair across consecutive waves', () => {
    assert.equal(INTRO_ORDER.length, 15)
    assert.equal(FORMATION_SLOT_COUNT, INTRO_ORDER.length)
    const state = createInitialState('easy', NOTES, 1000, 'overflow')
    buildWaveQueue(state, {}, EPOCH)
    const first = [...state.spawnQueue]
    assert.equal(first.length, 2)
    state.wave++
    buildWaveQueue(state, {}, EPOCH)
    const second = [...state.spawnQueue]
    assert.equal(new Set([...first, ...second]).size, NOTES.length)
    assert.deepEqual(
      Object.fromEntries(NOTES.map(note => [note, state.rosterServiceCount[note]])),
      Object.fromEntries(NOTES.map(note => [note, 1])),
    )
    for (let eligibleCount = 2; eligibleCount <= INTRO_ORDER.length; eligibleCount++) {
      const pool = Array.from({ length: eligibleCount }, (_, index) => `R${index}`)
      const bounded = createInitialState('easy', pool, 1000, `roster-bound-${eligibleCount}`)
      const seen = new Set<string>()
      const waveBound = Math.ceil(eligibleCount / 2)
      for (let wave = 0; wave < waveBound; wave++) {
        buildWaveQueue(bounded, {}, EPOCH)
        bounded.spawnQueue.forEach(note => seen.add(note))
        bounded.wave++
      }
      assert.equal(seen.size, eligibleCount,
        `${eligibleCount} eligible due notes exceeded the ${waveBound}-wave hard roster bound`)
    }
  })

  check('S5 final queue occurrences pay real roster service debt', () => {
    const state = createInitialState('true', NOTES, 1000, 'debt')
    state.wave = 7
    buildWaveQueue(state, {}, EPOCH)
    const histogram: Record<string, number> = {}
    for (const note of state.spawnQueue) histogram[note] = (histogram[note] ?? 0) + 1
    assert.deepEqual(state.rosterServiceCount, histogram)
    for (let index = 2; index < state.spawnQueue.length; index++) {
      assert(!(state.spawnQueue[index] === state.spawnQueue[index - 1] &&
        state.spawnQueue[index] === state.spawnQueue[index - 2]))
    }
  })

  check('S6 active lane alone controls roster and opposite bytes remain unchanged', () => {
    const stores: RetroBlasterFamilyStores = {
      ear: Object.fromEntries(NOTES.map(note => [note, memory(note, { due: note === 'C4' ? EPOCH : EPOCH + 1 })])),
      voice: Object.fromEntries(NOTES.map(note => [note, memory(note, { due: note === 'F4' ? EPOCH : EPOCH + 1 })])),
    }
    const voiceBefore = JSON.stringify(stores.voice)
    const earState = createInitialState('easy', NOTES, 1000, 'ear')
    buildWaveQueue(earState, activeLaneStore(stores, 'click'), EPOCH)
    assert(earState.spawnQueue.includes('C4'))
    assert.equal(JSON.stringify(stores.voice), voiceBefore)
    const voiceState = createInitialState('easy', NOTES, 1000, 'voice')
    buildWaveQueue(voiceState, activeLaneStore(stores, 'mic'), EPOCH)
    assert(voiceState.spawnQueue.includes('F4'))
  })

  check('S7 weighted fair diver property holds across 10000 seeded distributions', () => {
    const random = mulberry32(0x7f5a2026)
    let worstFirstGap = 0
    for (let seed = 0; seed < 10_000; seed++) {
      const count = 1 + Math.floor(random() * Math.min(12, FORMATION_SLOT_COUNT))
      const state = createInitialState('true', NOTES, 1000, `fair-${seed}`)
      state.aliens = Array.from({ length: count }, (_, slot) => alien(slot, soul(
        NOTES[slot % NOTES.length],
        { divePressure: random() * 3 },
      )))
      state.directorCursorSlot = seed % FORMATION_SLOT_COUNT
      const firstSeen = new Map<string, number>()
      for (let choice = 0; choice < 4 * count; choice++) {
        const selected = chooseNextDiver(state)
        assert(selected)
        if (!firstSeen.has(selected.alienId)) firstSeen.set(selected.alienId, choice + 1)
      }
      assert.equal(firstSeen.size, count)
      const seedWorstGap = Math.max(...firstSeen.values())
      worstFirstGap = Math.max(worstFirstGap, seedWorstGap)
      assert(seedWorstGap <= 4 * count)
    }
    assert(worstFirstGap > 0)
  })

  check('S8 low R due low S wins first but service debt prevents monopoly', () => {
    const state = createInitialState('true', NOTES, 1000, 'priority')
    const weak = alien(0, soul('C4', { r: 0.1, agitation: 0.9, calm: 0.1, due: true, divePressure: 2.8 }))
    const calm = alien(1, soul('D4', { r: 0.99, agitation: 0.01, calm: 0.99, due: false, divePressure: 0.02 }))
    state.aliens = [weak, calm]
    assert.equal(chooseNextDiver(state)?.alienId, weak.alienId)
    const selected = Array.from({ length: 8 }, () => chooseNextDiver(state)!.alienId)
    assert(selected.includes(calm.alienId))
    assert(weak.diveServiceCount > calm.diveServiceCount)
  })

  check('S9 wrong EAR terminal grades exactly one Again through real event store seam', () => {
    const stores: RetroBlasterFamilyStores = { ear: {}, voice: {} }
    const state = openAttack('click')
    const result = tick(state, engineInput({ pendingAnswer: pending(state, 'D4') }), 16, () => 0.5)
    assert.deepEqual(grades(result.events).map(event => [event.correct, event.inputMode]), [[false, 'click']])
    apply(result.events, stores)
    assert.equal(stores.ear.C4.phase, 'learning')
    assert.equal(stores.voice.C4, undefined)
  })

  check('S10 eligible EAR timeout grades once and stale tuple grades zero', () => {
    const stores: RetroBlasterFamilyStores = { ear: {}, voice: {} }
    let state = openAttack('click')
    const stale = { ...pending(state, 'D4'), gameId: 'stale' }
    let result = tick(state, engineInput({ pendingAnswer: stale }), 16, () => 0.5)
    assert.equal(grades(result.events).length, 0)
    state = result.state
    state.activeAttack!.deadlineAtMs = state.directorClockMs
    result = tick(state, engineInput(), 0, () => 0.5)
    assert.deepEqual(grades(result.events).map(event => [event.correct, event.inputMode]), [[false, 'click']])
    apply(result.events, stores)
    assert.equal(stores.ear.C4.phase, 'learning')
  })

  check('S11 continuously healthy heard VOICE timeout grades one VOICE Again', () => {
    const stores: RetroBlasterFamilyStores = { ear: {}, voice: {} }
    const state = openAttack('mic')
    state.activeAttack!.deadlineAtMs = state.directorClockMs
    const result = tick(state, engineInput({
      inputMode: 'mic', isListening: true,
      voiceTimeoutObservation: { healthy: true, heard: true },
    }), 0, () => 0.5)
    assert.deepEqual(grades(result.events).map(event => [event.correct, event.inputMode]), [[false, 'mic']])
    apply(result.events, stores)
    assert.equal(stores.voice.C4.phase, 'learning')
    assert.equal(stores.ear.C4, undefined)
  })

  check('S12 healthy silence and mid-window source break recovery produce zero VOICE grade', () => {
    for (const observation of [
      { healthy: true, heard: false },
      { healthy: false, heard: true },
      { healthy: false, heard: false },
    ]) {
      const state = openAttack('mic')
      state.activeAttack!.deadlineAtMs = state.directorClockMs
      const result = tick(state, engineInput({
        inputMode: 'mic', isListening: true, voiceTimeoutObservation: observation,
      }), 0, () => 0.5)
      assert.equal(grades(result.events).length, 0)
      assert.equal(result.state.activeAttack?.outcome, 'timeout')
    }

    let silent = openAttack('mic')
    for (let frame = 0; frame < 6; frame++) {
      silent = tick(silent, engineInput({
        inputMode: 'mic', isListening: true,
        voiceTimeoutObservation: { healthy: true, heard: false },
      }), 16, () => 0.5).state
    }
    silent.activeAttack!.deadlineAtMs = silent.directorClockMs
    const silentTimeout = tick(silent, engineInput({
      inputMode: 'mic', isListening: true,
      voiceTimeoutObservation: { healthy: true, heard: false },
    }), 0, () => 0.5)
    assert.equal(grades(silentTimeout.events).length, 0,
      'continuously healthy but silent VOICE window must not grade Again')

    let recovered = openAttack('mic')
    recovered = tick(recovered, engineInput({
      inputMode: 'mic', isListening: true,
      voiceTimeoutObservation: { healthy: true, heard: true },
    }), 16, () => 0.5).state
    recovered = tick(recovered, engineInput({
      inputMode: 'mic', isListening: true,
      voiceTimeoutObservation: { healthy: false, heard: true },
    }), 16, () => 0.5).state
    recovered = tick(recovered, engineInput({
      inputMode: 'mic', isListening: true,
      voiceTimeoutObservation: { healthy: true, heard: true },
    }), 16, () => 0.5).state
    recovered.activeAttack!.deadlineAtMs = recovered.directorClockMs
    const recoveredTimeout = tick(recovered, engineInput({
      inputMode: 'mic', isListening: true,
      voiceTimeoutObservation: { healthy: true, heard: true },
    }), 0, () => 0.5)
    assert.equal(grades(recoveredTimeout.events).length, 0,
      'mid-window source break must remain disqualifying after recovery')
  })

  check('S13 R4 stale frames 1-3 eligible fourth permanently disqualifies current attack', () => {
    let freshness = { lastGeneration: 7, hasObservedMicGeneration: true, staleGameFrames: 0 }
    let state = openAttack('mic')
    for (let frame = 1; frame <= 4; frame++) {
      const advanced = advanceMicVfxFreshness(freshness, 7, true)
      freshness = advanced.state
      assert.equal(advanced.hasFreshGeneration, frame <= 3)
      state = tick(state, engineInput({
        inputMode: 'mic', isListening: true,
        voiceTimeoutObservation: { healthy: advanced.hasFreshGeneration, heard: true },
      }), 0, () => 0.5).state
    }
    assert.equal(state.activeAttack?.voiceWindowEligible, false)
    const recovered = advanceMicVfxFreshness(freshness, 8, true)
    state = tick(state, engineInput({
      inputMode: 'mic', isListening: true,
      voiceTimeoutObservation: { healthy: recovered.hasFreshGeneration, heard: true },
    }), 0, () => 0.5).state
    assert.equal(state.activeAttack?.voiceWindowEligible, false)
    state.activeAttack!.deadlineAtMs = state.directorClockMs
    const timedOut = tick(state, engineInput({
      inputMode: 'mic', isListening: true,
      voiceTimeoutObservation: { healthy: true, heard: true },
    }), 0, () => 0.5)
    assert.equal(grades(timedOut.events).length, 0)

    const later = openAttack('mic')
    later.activeAttack!.deadlineAtMs = later.directorClockMs
    const laterResult = tick(later, engineInput({
      inputMode: 'mic', isListening: true,
      voiceTimeoutObservation: { healthy: true, heard: true },
    }), 0, () => 0.5)
    assert.equal(grades(laterResult.events).length, 1)
  })

  check('S14 non-grading cancellation closes terminal against late callbacks', () => {
    const state = openAttack('click')
    const events: EngineEvent[] = []
    const attackId = state.activeAttack!.attackId
    assert(resolveAttack(state, attackId, 'cancelled', 0, events, 'click'))
    assert.equal(grades(events).length, 0)
    assert.equal(resolveAttack(state, attackId, 'wrong', 0, events, 'click'), false)
    assert.equal(grades(events).length, 0)
  })

  check('S15 soul offset is frame-clock pure calm-damped and reduced-safe', () => {
    const profile = soul('C4', { agitation: 1, calm: 0, due: true, divePressure: 3 })
    const target = alien(0, profile)
    const nowMs = Math.PI / 2 / SOUL_WOBBLE_RADIANS_PER_SECOND * 1000
    const offset = deriveSoulRenderOffset(target, nowMs, false, false)
    const expectedX = profile.agitation * SOUL_WOBBLE_PX * Math.sin(
      (nowMs / 1000) * SOUL_WOBBLE_RADIANS_PER_SECOND +
        target.formationSlot * SOUL_SLOT_PHASE_RADIANS,
    ) * (1 - profile.calm * SOUL_CALM_DAMPING)
    assert.equal(offset.x, expectedX)
    assert.equal(offset.y, expectedX * SOUL_VERTICAL_RATIO)
    assert.deepEqual(deriveSoulRenderOffset(target, nowMs, true, false), { x: 0, y: 0 })
    assert.deepEqual(deriveSoulRenderOffset(target, nowMs, false, true), { x: 0, y: 0 })
  })

  check('S16 renderer has no hidden clock and shell soul dataset is change-only', () => {
    const renderer = readFileSync('src/components/PitchDefender/retroBlasterRenderer.ts', 'utf8')
    const helperStart = renderer.indexOf('export function deriveSoulRenderOffset')
    const helperEnd = renderer.indexOf('\n}', helperStart) + 2
    assert.doesNotMatch(renderer.slice(helperStart, helperEnd), /Date\.now|performance\.now/)
    assert.match(renderer, /if \(reducedMotion \|\| isActive \|\| alien\.entering/)
    assert.match(renderer, /if \(alien\.soul\.due\)/)
    const shell = readFileSync('src/components/PitchDefender/RetroBlasterII.tsx', 'utf8')
    assert.match(shell, /if \(soulDataset !== lastSoulDatasetRef\.current\)/)
    assert.match(shell, /document\.hasFocus\(\)/)
  })

  check('S17 R4 hook canon v1 and all sibling consumers remain re-frozen at protected base', () => {
    const normalize = (value: Buffer | string) => value.toString().replace(/\r\n/g, '\n')
    const current = (relative: string) => normalize(readFileSync(relative))
    const base = (relative: string) => normalize(execFileSync('git', ['show', `${PROTECTED_BASE}:${relative}`]))
    for (const relative of [
      'src/components/PitchDefender/usePitchDetection.ts',
      'src/components/PitchDefender/RetroBlaster.tsx',
      'src/lib/fsrs.ts',
      'src/lib/fsrsFamily.ts',
    ]) {
      assert.equal(current(relative), base(relative), `${relative} drifted from the R4 protected base`)
    }
    assert.equal(
      createHash('sha256').update(current('src/components/PitchDefender/usePitchDetection.ts')).digest('hex').toUpperCase(),
      '8D16B74B2D2001BB11971A85C84DF301EAC053C22A3CAA66BC142FF95BAFEAC6',
    )

    const consumerArgs = ['grep', '-l', '-F', 'usePitchDetection(', '--', 'src/components/PitchDefender']
    const currentConsumers = execFileSync('git', consumerArgs, { encoding: 'utf8' }).trim().split(/\r?\n/).sort()
    const baseConsumers = execFileSync('git', [
      'grep', '-l', '-F', 'usePitchDetection(', PROTECTED_BASE, '--', 'src/components/PitchDefender',
    ], { encoding: 'utf8' }).trim().split(/\r?\n/)
      .map(path => path.replace(`${PROTECTED_BASE}:`, ''))
      .sort()
    assert.deepEqual(currentConsumers, baseConsumers)
    assert.equal(currentConsumers.filter(path => !path.endsWith('usePitchDetection.ts')).length, 10)
    for (const relative of currentConsumers.filter(path => !path.endsWith('RetroBlasterII.tsx'))) {
      assert.equal(current(relative), base(relative), `${relative} changed around the shared hook`)
    }

    const hookConsumerBlock = (source: string) => {
      const start = source.indexOf('  const {\n    isListening,')
      const end = source.indexOf('\n\n  useEffect', start)
      assert(start >= 0 && end > start)
      return source.slice(start, end)
    }
    const shellPath = 'src/components/PitchDefender/RetroBlasterII.tsx'
    const currentHookBlock = hookConsumerBlock(current(shellPath))
    const r8ObserverOnlyHookBlock = currentHookBlock.replace('    pitch,\n    error: micError,\n', '')
    assert.equal(r8ObserverOnlyHookBlock, hookConsumerBlock(base(shellPath)))
  })

  console.log(JSON.stringify({
    status: 'PASS',
    fixture: 'R7 FSRS soul-binding',
    assertions: assertions.length,
    rows: assertions,
  }, null, 2))
} finally {
  Date.now = originalNow
}
