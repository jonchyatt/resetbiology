import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createNote, type NoteMemory } from '../../src/lib/fsrs'
import * as engine from '../../src/components/PitchDefender/retroBlasterEngine'
import type {
  Alien,
  BlindStimulusAck,
  BlindStimulusRequest,
  EngineEvent,
  EngineInput,
  GameState,
  InputMode,
  PianoReadinessObservation,
} from '../../src/components/PitchDefender/retroBlasterEngine'

const BASE = 'd34edf4090eacd8fd051361d27bec754033aac9c'
const EPOCH_MS = 1_800_000_000_000
const NOTES = ['C4', 'A4', 'G4', 'E4']
const SELF = fileURLToPath(import.meta.url)
const MODE = process.argv[2]
const OUTPUT = resolve(process.argv[3] ?? 'data/retro-blaster-rework/runtime-logs/r8c-green-local/result.json')
const PATHS = {
  engine: 'src/components/PitchDefender/retroBlasterEngine.ts',
  shell: 'src/components/PitchDefender/RetroBlasterII.tsx',
  renderer: 'src/components/PitchDefender/retroBlasterRenderer.ts',
  audio: 'src/components/PitchDefender/audioEngine.ts',
  family: 'src/lib/fsrsFamily.ts',
  detector: 'src/components/PitchDefender/usePitchDetection.ts',
} as const
const PROTECTED_HASHES = {
  audio: '68184AD29A2582212D6AEC8E74CF440EF13C764C4894CE4D08964484D20CC430',
  family: '8711C1C5E66427AE32C641D1C60E0B393894E828FEF85DD8579D643B3A078E46',
  detector: '9ED5801EF0D19EC65C73B639A70F3E11A394ADE4562D0442D8B375F25A651CC2',
} as const

type Evidence = Record<string, unknown>
type Row = { id: string; contract: string; status: 'PASS' | 'FAIL'; evidence: Evidence; error?: string }
const rows: Row[] = []
let observationId = 0

function sha256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex').toUpperCase()
}

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

const source = Object.fromEntries(
  Object.entries(PATHS).map(([key, path]) => [key, readFileSync(path, 'utf8')]),
) as Record<keyof typeof PATHS, string>
const hashes = Object.fromEntries(
  Object.entries(PATHS).map(([key, path]) => [key, sha256(readFileSync(path))]),
) as Record<keyof typeof PATHS, string>

function reviewedMemory(note: string): NoteMemory {
  return {
    ...createNote(note),
    S: 8,
    due: EPOCH_MS - 1,
    lastReview: EPOCH_MS - 86_400_000,
    phase: 'review',
    learningReps: 2,
  }
}

function readiness(ready = true, id = ++observationId): PianoReadinessObservation {
  return {
    observationId: id,
    contextState: ready ? 'running' : 'suspended',
    sampleReadyByNote: Object.fromEntries(NOTES.map(note => [note, ready])),
  }
}

function input(
  mode: InputMode = 'click',
  ready: PianoReadinessObservation | null = readiness(true),
  overrides: Partial<EngineInput> = {},
): EngineInput {
  return {
    inputMode: mode,
    isListening: false,
    reducedMotion: false,
    pitch: null,
    pendingAnswer: null,
    latencyMs: 321,
    fsrs: {},
    isActive: true,
    memoryEpochMs: EPOCH_MS,
    voiceTimeoutObservation: { healthy: false, heard: false },
    ceremonyToneAck: null,
    pianoReadiness: ready,
    blindStimulusAck: null,
    ...overrides,
  }
}

function makeAlien(state: GameState, note: string, reviewed: boolean, slot = 0): Alien {
  const anchor = engine.formationAnchor(slot)
  const memory = reviewed ? reviewedMemory(note) : createNote(note)
  return {
    alienId: `${state.gameId}:alien:${state.wave}:${slot}`,
    visualId: `${state.wave}:${slot}`,
    visualKind: (slot % 4) as 0 | 1 | 2 | 3,
    x: anchor.x,
    y: anchor.y,
    entering: false,
    entryT: 1,
    entryTargetX: anchor.x,
    formationSlot: slot,
    formationX: anchor.x,
    formationY: anchor.y,
    note,
    hue: note === 'C4' ? 18 : 218,
    soul: engine.snapshotNoteSoul(note, memory, EPOCH_MS),
    diveServiceCount: 0,
    alive: true,
    frame: 0,
    hitTimer: 0,
  }
}

function makeState(options: {
  wave?: number
  note?: string
  reviewed?: boolean
  gameId?: string
} = {}): GameState {
  const wave = options.wave ?? 2
  const note = options.note ?? 'C4'
  const reviewed = options.reviewed ?? true
  const gameId = options.gameId ?? `r8c-fixture:${wave}:${note}:${reviewed}`
  const state = engine.createInitialState('easy', NOTES, 1_000, gameId)
  state.wave = wave
  const store = Object.fromEntries(NOTES.map(item => [
    item,
    item === note && reviewed ? reviewedMemory(item) : createNote(item),
  ]))
  engine.beginWave(state, store, EPOCH_MS)
  state.waveIntroTimer = 0
  state.aliens = [makeAlien(state, note, reviewed)]
  state.spawnQueue = []
  state.spawnedThisWave = 1
  state.alienCountThisWave = 1
  state.nextAttackAtMs = state.directorClockMs
  return state
}

function selectFirst(
  state: GameState,
  mode: InputMode = 'click',
  ready: PianoReadinessObservation = readiness(true),
  rng: () => number = () => 0.5,
): { state: GameState; events: EngineEvent[] } {
  const result = engine.tick(state, input(mode, ready), 1, rng)
  assert(result.state.activeAttack, 'first attack did not start')
  return { state: result.state, events: result.events }
}

function reachTelegraphBoundary(
  state: GameState,
  mode: InputMode = 'click',
  readyFactory: (index: number) => PianoReadinessObservation | null = () => readiness(true),
): { state: GameState; events: EngineEvent[]; allEvents: EngineEvent[] } {
  let live = state
  let events: EngineEvent[] = []
  const allEvents: EngineEvent[] = []
  for (let index = 0; index < 7; index++) {
    const result = engine.tick(live, input(mode, readyFactory(index)), 50, () => 0.5)
    live = result.state
    events = result.events
    allEvents.push(...result.events)
  }
  return { state: live, events, allEvents }
}

function requestFrom(events: readonly EngineEvent[]): BlindStimulusRequest {
  const event = events.find(candidate => candidate.kind === 'blindStimulusRequest')
  assert(event?.kind === 'blindStimulusRequest', 'blind request missing')
  return event
}

function ack(request: BlindStimulusRequest, dispatched = true): BlindStimulusAck {
  return {
    ...request,
    dispatched,
    dispatchedAtDirectorClockMs: request.requestedAtDirectorClockMs,
  }
}

function blindAtRequest(gameId = 'r8c-blind'): { state: GameState; request: BlindStimulusRequest; allEvents: EngineEvent[] } {
  const selected = selectFirst(makeState({ gameId }), 'click', readiness(true))
  assert.equal(selected.state.activeAttack?.cuePolicy, 'blind')
  const boundary = reachTelegraphBoundary(selected.state)
  return { state: boundary.state, request: requestFrom(boundary.events), allEvents: boundary.allEvents }
}

function blindOutbound(gameId = 'r8c-outbound', dtMs = 50): {
  state: GameState
  request: BlindStimulusRequest
  events: EngineEvent[]
} {
  const pending = blindAtRequest(gameId)
  const result = engine.tick(
    pending.state,
    input('click', readiness(true), { blindStimulusAck: ack(pending.request) }),
    dtMs,
    () => 0.5,
  )
  assert.equal(result.state.activeAttack?.phase, 'outbound')
  return { state: result.state, request: pending.request, events: result.events }
}

function check(id: string, contract: string, run: () => Evidence | void): void {
  try {
    rows.push({ id, contract, status: 'PASS', evidence: run() ?? {} })
  } catch (error) {
    rows.push({
      id,
      contract,
      status: 'FAIL',
      evidence: {},
      error: error instanceof Error ? error.stack ?? error.message : String(error),
    })
  }
}

check('R8C-01', 'wave 1 is guided and never masked as a probe', () => {
  const selected = selectFirst(makeState({ wave: 1, reviewed: true, gameId: 'r8c-wave-1' }))
  assert.equal(selected.state.activeAttack?.cuePolicy, 'guided')
  assert.equal(engine.toViewState(selected.state, 'click').identityMaskActive, false)
  const boundary = reachTelegraphBoundary(selected.state)
  assert.equal(boundary.events.filter(event => event.kind === 'playNote').length, 1)
  return { cuePolicy: 'guided', mask: false }
})

check('R8C-02', 'wave 2+ opens one pending opportunity at beginWave', () => {
  const state = makeState({ wave: 2 })
  assert.equal(state.blindProbePending, true)
  assert.equal(state.signalCheckDisposition, 'pending')
  return { pending: state.blindProbePending }
})

check('R8C-03', 'first selected reviewed and ready EAR attack is blind', () => {
  const selected = selectFirst(makeState({ reviewed: true }))
  assert.equal(selected.state.activeAttack?.cuePolicy, 'blind')
  assert.equal(selected.state.blindProbePending, false)
  return { cuePolicy: selected.state.activeAttack?.cuePolicy }
})

check('R8C-04', 'first selected unreviewed EAR attack is guided and consumes the opportunity', () => {
  const selected = selectFirst(makeState({ reviewed: false }))
  assert.equal(selected.state.activeAttack?.cuePolicy, 'guided')
  assert.equal(selected.state.blindProbePending, false)
  assert.equal(selected.state.signalCheckDisposition, 'guided-unreviewed')
  return { disposition: selected.state.signalCheckDisposition }
})

check('R8C-05', 'first selected output-not-ready EAR attack is guided and consumes the opportunity', () => {
  const selected = selectFirst(makeState({ reviewed: true }), 'click', readiness(false))
  assert.equal(selected.state.activeAttack?.cuePolicy, 'guided')
  assert.equal(selected.state.blindProbePending, false)
  assert.equal(selected.state.signalCheckDisposition, 'guided-output-not-ready')
  return { disposition: selected.state.signalCheckDisposition }
})

check('R8C-06', 'first selected VOICE attack is guided and consumes the opportunity', () => {
  const selected = selectFirst(makeState({ reviewed: true }), 'mic', readiness(true))
  assert.equal(selected.state.activeAttack?.cuePolicy, 'guided')
  assert.equal(selected.state.signalCheckDisposition, 'guided-voice')
  return { disposition: selected.state.signalCheckDisposition }
})

check('R8C-07', 'no later attack is promoted after an ineligible first opportunity', () => {
  const first = selectFirst(makeState({ reviewed: false, gameId: 'r8c-no-promote' }))
  const state = first.state
  state.activeAttack = null
  state.aliens[0].soul = engine.snapshotNoteSoul('C4', reviewedMemory('C4'), EPOCH_MS)
  state.nextAttackAtMs = state.directorClockMs
  const second = engine.tick(state, input('click', readiness(true)), 1, () => 0.5)
  assert.equal(second.state.activeAttack?.cuePolicy, 'guided')
  assert.equal(second.state.blindProbePending, false)
  return { first: 'guided-unreviewed', second: second.state.activeAttack?.cuePolicy }
})

check('R8C-08', 'new startAttack input seam preserves selector queue review RNG and cadence counts', () => {
  const blindBase = makeState({ gameId: 'r8c-control' })
  const guidedBase = structuredClone(blindBase)
  guidedBase.blindProbePending = false
  let blindRng = 0
  let guidedRng = 0
  const blind = selectFirst(blindBase, 'click', readiness(true, 800), () => { blindRng++; return 0.5 })
  const guided = selectFirst(guidedBase, 'click', readiness(true, 800), () => { guidedRng++; return 0.5 })
  assert.equal(blind.state.activeAttack?.alienId, guided.state.activeAttack?.alienId)
  assert.equal(blind.state.nextAttackSerial, guided.state.nextAttackSerial)
  assert.deepEqual(blind.state.spawnQueue, guided.state.spawnQueue)
  assert.equal(blindRng, guidedRng)
  assert.deepEqual(blind.state.requiredAnswerEventsMs, guided.state.requiredAnswerEventsMs)
  return { selected: blind.state.activeAttack?.alienId, rngCalls: blindRng }
})

check('R8C-09', 'same seed reproduces the same selected and decorated attack', () => {
  const a = selectFirst(makeState({ gameId: 'r8c-seed' }), 'click', readiness(true, 900))
  const b = selectFirst(makeState({ gameId: 'r8c-seed' }), 'click', readiness(true, 900))
  assert.deepEqual(a.state.activeAttack, b.state.activeAttack)
  return { attack: a.state.activeAttack }
})

check('R8C-10', 'mask spans pending telegraph awaiting and unresolved outbound', () => {
  const initial = makeState({ gameId: 'r8c-mask-span' })
  const pending = engine.toViewState(initial, 'click').identityMaskActive
  const selected = selectFirst(initial)
  const telegraph = engine.toViewState(selected.state, 'click').identityMaskActive
  const request = reachTelegraphBoundary(selected.state)
  const awaiting = engine.toViewState(request.state, 'click').identityMaskActive
  const outbound = engine.tick(
    request.state,
    input('click', readiness(true), { blindStimulusAck: ack(requestFrom(request.events)) }),
    50,
    () => 0.5,
  )
  assert.deepEqual([pending, telegraph, awaiting, outbound.viewState.identityMaskActive], [true, true, true, true])
  return { pending, telegraph, awaiting, outbound: outbound.viewState.identityMaskActive }
})

check('R8C-11', 'guided selection drops the mask in the selection frame', () => {
  const initial = makeState({ reviewed: false })
  assert.equal(engine.toViewState(initial, 'click').identityMaskActive, true)
  const selected = selectFirst(initial)
  assert.equal(engine.toViewState(selected.state, 'click').identityMaskActive, false)
  return { before: true, after: false }
})

let noteSwapEqual = false
check('R8C-12', 'note swap is whole-view neutral while response controls stay operable', () => {
  const ready = readiness(true, 1_200)
  const pendingC = makeState({ note: 'C4', gameId: 'r8c-note-swap' })
  const pendingA = makeState({ note: 'A4', gameId: 'r8c-note-swap' })
  const telegraphC = selectFirst(pendingC, 'click', ready)
  const telegraphA = selectFirst(pendingA, 'click', ready)
  const awaitingC = reachTelegraphBoundary(telegraphC.state)
  const awaitingA = reachTelegraphBoundary(telegraphA.state)
  const outboundC = engine.tick(
    awaitingC.state,
    input('click', ready, { blindStimulusAck: ack(requestFrom(awaitingC.events)) }),
    50,
    () => 0.5,
  )
  const outboundA = engine.tick(
    awaitingA.state,
    input('click', ready, { blindStimulusAck: ack(requestFrom(awaitingA.events)) }),
    50,
    () => 0.5,
  )
  const phases = [
    ['pending', engine.toViewState(pendingC, 'click'), engine.toViewState(pendingA, 'click')],
    ['telegraph', engine.toViewState(telegraphC.state, 'click'), engine.toViewState(telegraphA.state, 'click')],
    ['awaiting-stimulus', engine.toViewState(awaitingC.state, 'click'), engine.toViewState(awaitingA.state, 'click')],
    ['outbound', outboundC.viewState, outboundA.viewState],
  ] as const
  for (const [phase, viewC, viewA] of phases) {
    assert.deepEqual(viewC, viewA, `${phase} player-facing ViewState leaked the target note`)
    assert.equal(viewC.identityMaskActive, true)
    assert.deepEqual(viewC.noteButtons.map(button => [button.note, button.keyNum]), NOTES.map((note, index) => [note, index + 1]))
    assert(viewC.noteButtons.every(button => !button.active))
    assert.equal(viewC.charge.targetNote, null)
    if (viewC.activeAttack) {
      assert.equal(viewC.activeAttack.note, '?')
      assert.equal(viewC.activeAttack.stimulusRequest, null)
    }
  }
  noteSwapEqual = true
  assert(source.renderer.includes('identityMaskActive'))
  assert(source.shell.includes('data-retro-identity-mask'))
  return {
    deepEqual: noteSwapEqual,
    phases: phases.map(([phase]) => phase),
    stimulusRequestNeutralized: true,
    responseNotes: outboundC.viewState.noteButtons.map(button => button.note),
  }
})

check('R8C-13', 'stale or missing readiness cancels before request and demand', () => {
  let state = selectFirst(makeState({ gameId: 'r8c-stale-ready' })).state
  let finalEvents: EngineEvent[] = []
  for (let index = 0; index < 7; index++) {
    const result = engine.tick(state, input('click', index === 6 ? null : readiness(true)), 50, () => 0.5)
    state = result.state
    finalEvents = result.events
  }
  assert.equal(state.activeAttack, null)
  assert.equal(finalEvents.some(event => event.kind === 'blindStimulusRequest'), false)
  assert.deepEqual(state.requiredAnswerEventsMs, [])
  return { activeAttack: null, requests: 0 }
})

check('R8C-14', 'exactly one request emits and awaiting emits no second request', () => {
  const pending = blindAtRequest('r8c-one-request')
  assert.equal(pending.allEvents.filter(event => event.kind === 'blindStimulusRequest').length, 1)
  const next = engine.tick(pending.state, input(), 50, () => 0.5)
  assert.equal(next.events.filter(event => event.kind === 'blindStimulusRequest').length, 0)
  assert.equal(next.state.activeAttack?.phase, 'awaiting-stimulus')
  return { first: 1, next: 0 }
})

check('R8C-15', 'positive next-tick ack splits request cadence from full ack-time response', () => {
  const outbound = blindOutbound('r8c-positive')
  const attack = outbound.state.activeAttack!
  assert.equal(outbound.state.lastDemandAtMs, outbound.request.requestedAtDirectorClockMs)
  assert.deepEqual(outbound.state.requiredAnswerEventsMs, [outbound.request.requestedAtDirectorClockMs])
  assert.equal(attack.demandAtMs, outbound.request.requestedAtDirectorClockMs + 50)
  assert.equal(attack.deadlineAtMs, attack.demandAtMs! + engine.DIVE_RESPONSE_DEADLINE_MS)
  return { requestAt: outbound.request.requestedAtDirectorClockMs, demandAt: attack.demandAtMs, deadlineAt: attack.deadlineAtMs }
})

check('R8C-16', 'negative ack commits no demand timestamp or grade', () => {
  const pending = blindAtRequest('r8c-negative')
  const result = engine.tick(
    pending.state,
    input('click', readiness(true), { blindStimulusAck: ack(pending.request, false) }),
    50,
    () => 0.5,
  )
  assert.equal(result.state.activeAttack, null)
  assert.equal(result.state.lastDemandAtMs, null)
  assert.deepEqual(result.state.requiredAnswerEventsMs, [])
  assert.equal(result.events.some(event => event.kind === 'grade'), false)
  return { disposition: result.state.signalCheckDisposition }
})

check('R8C-17', 'missing ack times out at 1000ms active clamped time with zero grade', () => {
  let state = blindAtRequest('r8c-timeout').state
  let gradeCount = 0
  for (let index = 1; index <= 19; index++) {
    const result = engine.tick(state, input(), 50, () => 0.5)
    state = result.state
    gradeCount += result.events.filter(event => event.kind === 'grade').length
    assert.equal(state.activeAttack?.phase, 'awaiting-stimulus')
  }
  const timeout = engine.tick(state, input(), 50, () => 0.5)
  gradeCount += timeout.events.filter(event => event.kind === 'grade').length
  assert.equal(timeout.state.activeAttack, null)
  assert.equal(timeout.state.signalCheckDisposition, 'cancelled-ack-timeout')
  assert.equal(gradeCount, 0)
  return { timeoutMs: engine.STIMULUS_ACK_TIMEOUT_MS, gradeCount }
})

check('R8C-18', 'hidden time advances neither timeout nor demand', () => {
  const pending = blindAtRequest('r8c-hidden')
  const before = structuredClone(pending.state)
  const result = engine.tick(pending.state, input('click', readiness(true), { isActive: false }), 900, () => 0.5)
  assert.deepEqual(result.state, before)
  assert.deepEqual(result.events, [])
  return { frozenMs: 900 }
})

check('R8C-19', 'positive ack outside one clamped active step cancels with zero demand and grade', () => {
  const pending = blindAtRequest('r8c-skew')
  const first = engine.tick(pending.state, input(), 50, () => 0.5)
  const late = engine.tick(first.state, input('click', readiness(true), { blindStimulusAck: ack(pending.request) }), 50, () => 0.5)
  assert.equal(late.state.activeAttack, null)
  assert.equal(late.state.signalCheckDisposition, 'cancelled-ack-skew')
  assert.deepEqual(late.state.requiredAnswerEventsMs, [])
  assert.equal(late.events.some(event => event.kind === 'grade'), false)
  return { deltaMs: 100, acceptMaxMs: engine.STIMULUS_ACK_ACCEPT_MAX_MS }
})

check('R8C-20', 'stale duplicate wrong-tuple and post-cancel acknowledgments are inert', () => {
  const pending = blindAtRequest('r8c-ack-inert')
  const wrong = { ...ack(pending.request), requestId: 'wrong' }
  const stale = engine.tick(pending.state, input('click', readiness(true), { blindStimulusAck: wrong }), 50, () => 0.5)
  assert.equal(stale.state.activeAttack?.phase, 'awaiting-stimulus')
  assert.deepEqual(stale.state.requiredAnswerEventsMs, [])
  const accepted = engine.tick(stale.state, input('click', readiness(true), { blindStimulusAck: ack(pending.request) }), 0, () => 0.5)
  assert.equal(accepted.state.activeAttack?.phase, 'outbound')
  const duplicate = engine.tick(accepted.state, input('click', readiness(true), { blindStimulusAck: ack(pending.request) }), 0, () => 0.5)
  assert.deepEqual(duplicate.state.requiredAnswerEventsMs, accepted.state.requiredAnswerEventsMs)
  return { staleIgnored: true, duplicateIgnored: true }
})

check('R8C-21', 'route or new-game stale acknowledgment is inert by game ID', () => {
  const old = blindAtRequest('r8c-old-game')
  const fresh = blindAtRequest('r8c-new-game')
  const result = engine.tick(
    fresh.state,
    input('click', readiness(true), { blindStimulusAck: ack(old.request) }),
    50,
    () => 0.5,
  )
  assert.equal(result.state.activeAttack?.phase, 'awaiting-stimulus')
  assert.deepEqual(result.state.requiredAnswerEventsMs, [])
  return { oldGameId: old.request.gameId, liveGameId: fresh.request.gameId }
})

check('R8C-22', 'guided and blind healthy controls preserve cadence and full blind deadline', () => {
  const blindBase = makeState({ gameId: 'r8c-paired' })
  const guidedBase = structuredClone(blindBase)
  guidedBase.blindProbePending = false
  const blindSelected = selectFirst(blindBase, 'click', readiness(true, 2_200))
  const guidedSelected = selectFirst(guidedBase, 'click', readiness(true, 2_200))
  const blindRequest = reachTelegraphBoundary(blindSelected.state, 'click', () => readiness(true, 2_201))
  const guidedDemand = reachTelegraphBoundary(guidedSelected.state, 'click', () => readiness(true, 2_201))
  const request = requestFrom(blindRequest.events)
  const blindDemand = engine.tick(
    blindRequest.state,
    input('click', readiness(true), { blindStimulusAck: ack(request) }),
    50,
    () => 0.5,
  )
  assert.deepEqual(blindDemand.state.requiredAnswerEventsMs, guidedDemand.state.requiredAnswerEventsMs)
  assert.equal(blindDemand.state.activeAttack!.deadlineAtMs! - blindDemand.state.activeAttack!.demandAtMs!, 2_000)
  return { cadence: blindDemand.state.requiredAnswerEventsMs, responseMs: 2_000 }
})

check('R8C-23', 'replay and easy hint emit zero pre-terminal blind pitch', () => {
  const outbound = blindOutbound('r8c-replay-hint')
  outbound.state.lastProgressAt = outbound.state.directorClockMs - 60_001
  const hint = engine.tick(outbound.state, input(), 0, () => 0.5)
  assert.equal(hint.events.some(event => event.kind === 'playNote'), false)
  assert.equal(hint.state.hintCount, 0)
  assert(/attack\.cuePolicy === 'blind'/.test(source.shell))
  assert(source.shell.includes("guard: 'blind-stimulus'"))
  return { engineHintPitches: 0, replayGuard: true, requestPlayNoteEvents: outbound.events.filter(event => event.kind === 'playNote').length }
})

check('R8C-24', 'blind correct wrong and timeout produce one inherited terminal and at most one EAR grade', () => {
  const gradeCounts: Record<string, number> = {}
  for (const outcome of ['correct', 'wrong', 'timeout'] as const) {
    const outbound = blindOutbound(`r8c-terminal-${outcome}`)
    const attack = outbound.state.activeAttack!
    let result
    if (outcome === 'timeout') {
      outbound.state.directorClockMs = attack.deadlineAtMs!
      result = engine.tick(outbound.state, input(), 0, () => 0.5)
    } else {
      result = engine.tick(outbound.state, input('click', readiness(true), {
        pendingAnswer: {
          note: outcome === 'correct' ? attack.note : 'A4',
          inputMode: 'click',
          gameId: outbound.state.gameId,
          alienId: attack.alienId,
          attackId: attack.attackId,
        },
      }), 0, () => 0.5)
    }
    gradeCounts[outcome] = result.events.filter(event => event.kind === 'grade').length
    assert.equal(gradeCounts[outcome], 1)
    assert.equal(result.state.signalCheckDisposition, 'terminal')
  }
  return { gradeCounts }
})

check('R8C-25', 'post-terminal teaching is marked and latency begins at actual dispatch', () => {
  const outbound = blindOutbound('r8c-terminal-receipt')
  const attack = outbound.state.activeAttack!
  const result = engine.tick(outbound.state, input('click', readiness(true), {
    latencyMs: 321,
    pendingAnswer: {
      note: 'A4', inputMode: 'click', gameId: outbound.state.gameId,
      alienId: attack.alienId, attackId: attack.attackId,
    },
  }), 0, () => 0.5)
  const grade = result.events.find(event => event.kind === 'grade')
  const teaching = result.events.find(event => event.kind === 'playNote')
  assert.equal(grade?.kind === 'grade' ? grade.latencyMs : null, 321)
  assert.equal(teaching?.kind === 'playNote' ? teaching.terminalAlreadyRecorded : false, true)
  assert(source.shell.includes('notePlayTimeRef.current = Date.now()'))
  assert(source.shell.includes('terminalAlreadyRecorded'))
  return { latencyMs: 321, terminalAlreadyRecorded: true }
})

check('R8C-26', 'non-click input cancels blind before lane authority changes', () => {
  const pending = blindAtRequest('r8c-mode-change')
  const result = engine.tick(pending.state, input('mic', readiness(true)), 50, () => 0.5)
  assert.equal(result.state.activeAttack, null)
  assert.equal(result.state.signalCheckDisposition, 'cancelled-mode-change')
  assert.equal(result.events.some(event => event.kind === 'grade'), false)
  return { disposition: result.state.signalCheckDisposition }
})

check('R8C-27', 'missing wave soul fails reviewed closed without live per-tick FSRS eligibility', () => {
  const state = engine.createInitialState('easy', NOTES, 1_000, 'r8c-missing-soul')
  state.wave = 2
  state.blindProbePending = true
  state.waveIntroTimer = 0
  state.spawnQueue = ['C4']
  state.waveSoulByNote = {}
  state.nextSpawnAt = 0
  state.nextAttackAtMs = Number.POSITIVE_INFINITY
  const result = engine.tick(state, input('click', readiness(true), { fsrs: { C4: reviewedMemory('C4') } }), 1, () => 0.5)
  assert.equal(result.state.aliens[0]?.soul.reviewed, false)
  assert(source.engine.includes('snapshotNoteSoul(note, undefined'))
  return { reviewed: result.state.aliens[0]?.soul.reviewed }
})

check('R8C-28', 'awaiting-stimulus holds the neutral telegraph at the formation anchor', () => {
  const pending = blindAtRequest('r8c-awaiting-pose')
  const target = pending.state.aliens.find(alien => alien.alienId === pending.request.alienId)!
  assert.equal(target.x, target.formationX)
  assert.equal(target.y, target.formationY)
  const next = engine.tick(pending.state, input(), 50, () => 0.5)
  const held = next.state.aliens.find(alien => alien.alienId === pending.request.alienId)!
  assert.equal(held.x, held.formationX)
  assert.equal(held.y, held.formationY)
  const unavailable = blindAtRequest('r8c-awaiting-target-unavailable')
  const unavailableTarget = unavailable.state.aliens.find(alien => alien.alienId === unavailable.request.alienId)!
  unavailableTarget.alive = false
  const cancelled = engine.tick(unavailable.state, input(), 50, () => 0.5)
  assert.equal(cancelled.state.activeAttack, null)
  assert.equal(cancelled.events.filter(event => event.kind === 'grade').length, 0)
  return { x: held.x, y: held.y, unavailableTargetFailsClosed: true }
})

check('R8C-29', 'negative skew and timeout cancellation re-arm cadence without a replacement probe', () => {
  const pending = blindAtRequest('r8c-rearm')
  const result = engine.tick(
    pending.state,
    input('click', readiness(true), { blindStimulusAck: ack(pending.request, false) }),
    50,
    () => 0.5,
  )
  assert.equal(result.state.blindProbePending, false)
  assert(result.state.nextAttackAtMs >= result.state.directorClockMs + engine.POST_RESOLUTION_FLOOR_MS)
  const beforeFloor = engine.tick(result.state, input(), engine.MAX_SIM_STEP_MS, () => 0.5)
  assert.equal(beforeFloor.events.some(event => event.kind === 'blindStimulusRequest'), false)
  return { nextAttackAtMs: result.state.nextAttackAtMs, pending: result.state.blindProbePending }
})

check('R8C-30', 'machine answer seam drives input only and player-facing invariance is independent', () => {
  assert.equal(noteSwapEqual, true)
  assert(source.shell.includes('data-retro-signal-check'))
  assert(source.shell.includes('data-retro-identity-mask'))
  assert(source.shell.includes('retroFormationState'))
  assert(source.shell.includes('retroSoulState'))
  assert(source.shell.includes('retroAudioReceipt'))
  return { noteSwapWholeViewIndependent: noteSwapEqual, proofDatasetsPresent: true }
})

check('R8C-31', 'VOICE source meter and timeout eligibility remain unchanged', () => {
  const selected = selectFirst(makeState({ gameId: 'r8c-voice' }), 'mic', readiness(true))
  const boundary = reachTelegraphBoundary(selected.state, 'mic')
  assert.equal(selected.state.activeAttack?.cuePolicy, 'guided')
  assert.equal(boundary.events.filter(event => event.kind === 'playNote').length, 1)
  assert.equal(engine.toViewState(boundary.state, 'mic').identityMaskActive, false)
  assert.equal(hashes.audio, PROTECTED_HASHES.audio)
  assert.equal(hashes.detector, PROTECTED_HASHES.detector)
  assert(source.shell.includes('data-retro-vocal-meter'))
  return { cuePolicy: 'guided', audioHash: hashes.audio, detectorHash: hashes.detector }
})

check('R8C-32', 'fresh two-note curriculum contract replaces the four-note policy constant', () => {
  const curriculumSource = readFileSync('src/components/PitchDefender/retroBlasterCurriculum.ts', 'utf8')
  assert.equal('INITIAL_UNLOCK' in engine, false)
  assert.equal(source.engine.includes('INITIAL_UNLOCK'), false)
  assert.equal(curriculumSource.includes('INTRO_ORDER.slice(0, 2)'), true)
  assert.equal(`${source.engine}\n${source.shell}`.includes('retro_blaster_curriculum_v1'), false)
  return { freshRoster: ['C4', 'A4'], policyModuleOnlyKey: true }
})

check('R8C-33', 'protected Retro source audio detector family dependencies and lockfiles remain exact across sibling commits', () => {
  assert.equal(hashes.audio, PROTECTED_HASHES.audio)
  assert.equal(hashes.family, PROTECTED_HASHES.family)
  assert.equal(hashes.detector, PROTECTED_HASHES.detector)
  const trackedSource = git('diff', '--name-only', BASE, '--', 'src/components/PitchDefender')
    .split(/\r?\n/).filter(Boolean)
  const untrackedSource = git('ls-files', '--others', '--exclude-standard', '--', 'src/components/PitchDefender')
    .split(/\r?\n/).filter(Boolean)
  const changedSource = [...new Set([...trackedSource, ...untrackedSource])].sort()
  assert.deepEqual(changedSource, [
    'src/components/PitchDefender/RetroBlasterII.tsx',
    'src/components/PitchDefender/retroBlasterCurriculum.ts',
    'src/components/PitchDefender/retroBlasterEngine.ts',
    'src/components/PitchDefender/retroBlasterRenderer.ts',
  ])
  assert.equal(git('diff', '--name-only', BASE, '--', 'package.json', 'package-lock.json'), '')
  return { changedSource, protected: PROTECTED_HASHES }
})

check('R8C-34', '900ms RAF starvation advances one step and grants the full response window', () => {
  const pending = blindAtRequest('r8c-starvation')
  const result = engine.tick(
    pending.state,
    input('click', readiness(true), { blindStimulusAck: ack(pending.request) }),
    900,
    () => 0.5,
  )
  const attack = result.state.activeAttack!
  assert.equal(attack.phase, 'outbound')
  assert.equal(attack.demandAtMs! - pending.request.requestedAtDirectorClockMs, engine.MAX_SIM_STEP_MS)
  assert.equal(attack.deadlineAtMs! - attack.demandAtMs!, engine.DIVE_RESPONSE_DEADLINE_MS)
  assert.equal(result.events.some(event => event.kind === 'grade'), false)
  return { requestedWallDtMs: 900, directorDeltaMs: 50, responseMs: 2_000 }
})

check('R8C-35', 'ceremony may reveal its reviewed-false note and is playing-mask exempt', () => {
  const state = makeState({ gameId: 'r8c-ceremony', reviewed: false })
  state.phase = 'ceremony'
  state.blindProbePending = true
  state.activeAttack = null
  state.introductionCeremony = {
    ceremonyId: `${state.gameId}:ceremony:0`,
    note: 'D4', elapsedMs: 0, durationMs: engine.INTRODUCTION_DURATION_MS, toneStatus: 'pending',
  }
  const introduced = engine.snapshotNoteSoul('D4', createNote('D4'), EPOCH_MS)
  const view = engine.toViewState(state, 'click')
  assert.equal(introduced.reviewed, false)
  assert.equal(view.identityMaskActive, false)
  assert.equal(view.introductionCeremony?.note, 'D4')
  assert.equal(view.activeAttack, null)
  return { reviewed: introduced.reviewed, mask: view.identityMaskActive, note: view.introductionCeremony?.note }
})

const expectedIds = Array.from({ length: 35 }, (_, index) => `R8C-${String(index + 1).padStart(2, '0')}`)
const ids = rows.map(row => row.id)
const shapeValid = rows.length === 35 && new Set(ids).size === 35 && JSON.stringify(ids) === JSON.stringify(expectedIds)
const failures = rows.filter(row => row.status === 'FAIL')
const status = MODE === '--green' && shapeValid && failures.length === 0 ? 'PASS' : 'FAIL'
const result = {
  schema: 'retro-blaster-r8c-signal-check/v2',
  generatedAt: new Date().toISOString(),
  mode: MODE ?? '(missing)',
  exactBase: BASE,
  head: git('rev-parse', 'HEAD'),
  originMaster: git('rev-parse', 'origin/master'),
  fixture: { path: 'scripts/retro-blaster/r8c-signal-check-fixture.ts', sha256: sha256(readFileSync(SELF)) },
  inspectedSourceHashes: hashes,
  counts: { total: rows.length, pass: rows.length - failures.length, fail: failures.length },
  shapeValid,
  status,
  rows,
}

mkdirSync(dirname(OUTPUT), { recursive: true })
writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify(result, null, 2))
process.exitCode = status === 'PASS' ? 0 : 1
