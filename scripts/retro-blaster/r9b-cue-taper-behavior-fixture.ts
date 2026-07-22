import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import {
  createInitialState,
  formationAnchor,
  requestFullCueHelp,
  resetOrdinaryCueSupport,
  resolveAttack,
  tick,
  toViewState,
  type Alien,
  type EngineInput,
  type GameState,
  type NoteSoulSnapshot,
} from '../../src/components/PitchDefender/retroBlasterEngine'

const OUTPUT = resolve(process.argv[2] ??
  'data/retro-blaster-rework/runtime-logs/r9b-green-local/behavior.json')
const rows: Array<{ id: string; contract: string; status: 'PASS'; evidence: unknown }> = []

function soul(note: string, overrides: Partial<NoteSoulSnapshot> = {}): NoteSoulSnapshot {
  return {
    note,
    reviewed: true,
    r: 0.9,
    calm: 0.8,
    due: false,
    agitation: 0.1,
    divePressure: 0.3,
    ...overrides,
  }
}

function alienFor(state: GameState, note: string, overrides: Partial<NoteSoulSnapshot> = {}): Alien {
  const anchor = formationAnchor(0)
  return {
    alienId: `${state.gameId}:alien:1:0`,
    visualId: '1:0',
    visualKind: 0,
    x: anchor.x,
    y: anchor.y,
    entering: false,
    entryT: 1,
    entryTargetX: anchor.x,
    formationSlot: 0,
    formationX: anchor.x,
    formationY: anchor.y,
    note,
    hue: note === 'C4' ? 174 : 276,
    soul: soul(note, overrides),
    diveServiceCount: 0,
    alive: true,
    frame: 0,
    hitTimer: 0,
  }
}

function stateFor(
  note = 'C4',
  overrides: Partial<NoteSoulSnapshot> = {},
  safeTryArms: GameState['safeTryArms'] = {},
  gameId = `r9b:${note}`,
): GameState {
  const state = createInitialState('easy', ['C4', 'A4'], 1_000, gameId)
  state.waveIntroTimer = 0
  state.nextAttackAtMs = state.directorClockMs
  state.alienCountThisWave = 1
  state.aliens = [alienFor(state, note, overrides)]
  state.safeTryArms = { ...safeTryArms }
  return state
}

function input(sampleReady = true, inputMode: EngineInput['inputMode'] = 'click'): EngineInput {
  return {
    inputMode,
    isListening: false,
    reducedMotion: true,
    pitch: null,
    isActive: true,
    fsrs: {},
    memoryEpochMs: 1_000,
    pianoReadiness: {
      observationId: 1,
      contextState: sampleReady ? 'running' : 'suspended',
      sampleReadyByNote: { C4: sampleReady, A4: sampleReady },
    },
  }
}

function start(state: GameState, sampleReady = true): GameState {
  const result = tick(state, input(sampleReady), 0, () => 0.5)
  assert(result.state.activeAttack, 'attack did not start')
  return result.state
}

function outbound(state: GameState): GameState {
  let current = state
  const events = [] as ReturnType<typeof tick>['events']
  for (let step = 0; step < 10 && current.activeAttack?.phase !== 'outbound'; step++) {
    const result = tick(current, input(true), 50, () => 0.5)
    current = result.state
    events.push(...result.events)
  }
  assert.equal(current.activeAttack?.phase, 'outbound')
  assert(events.some(event => event.kind === 'playNote'))
  return current
}

function pass(id: string, contract: string, run: () => unknown): void {
  rows.push({ id, contract, status: 'PASS', evidence: run() })
}

pass('B-01', 'a first ordinary EAR encounter is fully guided', () => {
  const state = start(stateFor())
  assert.deepEqual(state.activeAttack?.cue, { owner: 'ordinary', policy: 'guided' })
  assert.deepEqual(state.safeTryArms, {})
  return { cue: state.activeAttack?.cue }
})

const guidedOutbound = outbound(start(stateFor('C4', {}, {}, 'r9b:recovery')))
pass('B-02', 'a qualifying guided recovery arms only its reviewed not-due output-ready note', () => {
  const attack = guidedOutbound.activeAttack!
  assert(resolveAttack(guidedOutbound, attack.attackId, 'correct', 900, [], 'click'))
  assert.deepEqual(guidedOutbound.safeTryArms, { C4: true })
  return { arms: guidedOutbound.safeTryArms }
})

function nextAttackAfterResolution(state: GameState): GameState {
  state.activeAttack = null
  state.lasers = []
  state.particles = []
  state.answerCooldownMs = 0
  state.aliens[0].alive = true
  state.aliens[0].hitTimer = 0
  state.nextAttackAtMs = state.directorClockMs
  return start(state)
}

const safeTelegraph = nextAttackAfterResolution(guidedOutbound)
pass('B-03', 'the armed note gets one ordinary safe try and clears the entire map before telegraph', () => {
  assert.deepEqual(safeTelegraph.activeAttack?.cue, { owner: 'ordinary', policy: 'safe-try' })
  assert.deepEqual(safeTelegraph.safeTryArms, {})
  assert.equal(toViewState(safeTelegraph, 'click').answerMaskActive, true)
  return { cue: safeTelegraph.activeAttack?.cue, arms: safeTelegraph.safeTryArms }
})

const safeOutbound = outbound(safeTelegraph)
pass('B-04', 'the safe-try projection is target-invariant and contains no target association', () => {
  const cState = structuredClone(safeOutbound)
  const aState = structuredClone(safeOutbound)
  aState.activeAttack!.note = 'A4'
  aState.aliens[0].note = 'A4'
  aState.aliens[0].hue = 276
  aState.aliens[0].soul = soul('A4')
  const cView = toViewState(cState, 'click')
  const aView = toViewState(aState, 'click')
  assert.deepEqual(cView, aView)
  assert.equal(cView.supportMode, 'safe-try')
  assert.equal(cView.identityMaskActive, false)
  assert.equal(cView.spotlightIdx, -1)
  assert.equal(cView.activeAttack?.alienId, '?')
  assert.equal(cView.activeAttack?.note, '?')
  assert.equal(cView.lasers.length, 0)
  assert.equal(cView.particles.length, 0)
  assert(cView.noteButtons.every(button => button.active === false))
  return { supportMode: cView.supportMode, spotlightIdx: cView.spotlightIdx }
})

pass('B-05', 'Full Help reveals the same attack without extending its deadline or submitting', () => {
  const state = structuredClone(safeOutbound)
  const attackId = state.activeAttack!.attackId
  const demandAtMs = state.activeAttack!.demandAtMs
  const deadlineAtMs = state.activeAttack!.deadlineAtMs
  assert(requestFullCueHelp(state, attackId))
  assert.equal(state.activeAttack?.attackId, attackId)
  assert.equal(state.activeAttack?.demandAtMs, demandAtMs)
  assert.equal(state.activeAttack?.deadlineAtMs, deadlineAtMs)
  assert.equal(state.activeAttack?.answerHelpUsed, true)
  assert.deepEqual(state.activeAttack?.cue, { owner: 'ordinary', policy: 'guided' })
  assert.equal(toViewState(state, 'click').answerMaskActive, false)
  assert.equal(requestFullCueHelp(state, attackId), false)
  return { attackId, demandAtMs, deadlineAtMs }
})

pass('B-06', 'resolving a safe try never arms a replacement', () => {
  const state = structuredClone(safeOutbound)
  assert(resolveAttack(state, state.activeAttack!.attackId, 'correct', 850, [], 'click'))
  assert.deepEqual(state.safeTryArms, {})
  return { arms: state.safeTryArms, outcome: state.activeAttack?.outcome }
})

pass('B-07', 'clearing dual arms creates a global guided barrier across notes', () => {
  const c = start(stateFor('C4', {}, { C4: true, A4: true }, 'r9b:dual-c'))
  assert.equal(c.activeAttack?.cue.policy, 'safe-try')
  assert.deepEqual(c.safeTryArms, {})
  const a = start(stateFor('A4', {}, c.safeTryArms, 'r9b:dual-a'))
  assert.deepEqual(a.activeAttack?.cue, { owner: 'ordinary', policy: 'guided' })
  return { first: c.activeAttack?.cue, next: a.activeAttack?.cue }
})

pass('B-08', 'R8c blind ownership freezes pre-existing ordinary arms', () => {
  const state = stateFor('C4', {}, { C4: true }, 'r9b:r8c-blind')
  state.wave = 2
  state.blindProbePending = true
  state.signalCheckDisposition = 'pending'
  const selected = start(state)
  assert.deepEqual(selected.activeAttack?.cue, { owner: 'r8c-probe', policy: 'blind' })
  assert.deepEqual(selected.safeTryArms, { C4: true })
  assert.equal(toViewState(selected, 'click').identityMaskActive, true)
  return { cue: selected.activeAttack?.cue, arms: selected.safeTryArms }
})

pass('B-09', 'R8c fail-soft guidance also freezes ordinary arms', () => {
  const state = stateFor('C4', {}, { C4: true }, 'r9b:r8c-fail-soft')
  state.wave = 2
  state.blindProbePending = true
  state.signalCheckDisposition = 'pending'
  const selected = start(state, false)
  assert.deepEqual(selected.activeAttack?.cue, { owner: 'r8c-probe', policy: 'guided' })
  assert.deepEqual(selected.safeTryArms, { C4: true })
  return { cue: selected.activeAttack?.cue, arms: selected.safeTryArms }
})

pass('B-10', 'a stale due arm clears and fails safely to ordinary guidance', () => {
  const selected = start(stateFor('C4', { due: true }, { C4: true }, 'r9b:stale'))
  assert.deepEqual(selected.activeAttack?.cue, { owner: 'ordinary', policy: 'guided' })
  assert.deepEqual(selected.safeTryArms, {})
  return { cue: selected.activeAttack?.cue, arms: selected.safeTryArms }
})

pass('B-11', 'mode or activity reset reveals guidance without changing the attack deadline', () => {
  const state = structuredClone(safeOutbound)
  const deadlineAtMs = state.activeAttack!.deadlineAtMs
  assert(resetOrdinaryCueSupport(state))
  assert.equal(state.activeAttack?.deadlineAtMs, deadlineAtMs)
  assert.equal(state.activeAttack?.answerHelpUsed, true)
  assert.equal(state.activeAttack?.cue.policy, 'guided')
  assert.equal(toViewState(state, 'click').answerMaskActive, false)
  return { deadlineAtMs, cue: state.activeAttack?.cue }
})

pass('B-12', 'the timed exact-answer hint first lifts the answer mask and marks help', () => {
  const state = structuredClone(safeOutbound)
  state.lastProgressAt = 0
  state.directorClockMs = 65_000
  state.clockMs = 65_000
  state.activeAttack!.deadlineAtMs = 120_000
  const result = tick(state, input(true), 0, () => 0.5)
  assert.equal(result.state.activeAttack?.answerHelpUsed, true)
  assert.equal(result.state.activeAttack?.cue.policy, 'guided')
  assert.equal(result.viewState.answerMaskActive, false)
  assert(result.events.some(event => event.kind === 'playNote'))
  return { hintCount: result.state.hintCount, cue: result.state.activeAttack?.cue }
})

const result = {
  schema: 'retro-blaster-r9b-cue-taper/behavior-v1',
  generatedAt: new Date().toISOString(),
  status: 'PASS',
  counts: { total: rows.length, passed: rows.length, failed: 0 },
  rows,
}
mkdirSync(dirname(OUTPUT), { recursive: true })
writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify(result, null, 2))
