import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

import {
  ALIEN_H,
  DIVE_ATTACK_Y,
  DIVE_CHANNEL_X,
  DIVE_CLEAR_Y,
  DIVE_KNEE_X,
  DIVE_KNEE_Y,
  DIVE_OUTBOUND_MS,
  DIVE_RESPONSE_DEADLINE_MS,
  DIVE_RETURN_MS,
  DIVE_TELEGRAPH_MS,
  ENGINE_DEMAND_FLOOR_MS,
  FORMATION_SLOT_COUNT,
  H,
  HIT_LOCK_MAX_MS,
  LASER_SPEED,
  MAX_SIM_STEP_MS,
  MIC_HOLD_MS,
  NO_ELIGIBLE_RETRY_MS,
  NOTE_BUTTONS_Y,
  PLAYER_Y,
  POST_RESOLUTION_FLOOR_MS,
  SPACE_SCALE,
  STARTING_SHIELDS,
  W,
  beginWave,
  buildWaveQueue,
  chooseNextDiver,
  createInitialState,
  divePose,
  finalizeHitLockedDeath,
  flightStateOf,
  formationAnchor,
  noteForKeyboardInput,
  resolveAttack,
  tick,
  type Alien,
  type Difficulty,
  type EngineEvent,
  type EngineInput,
  type GameState,
  type PendingAttackAnswer,
  type TickResult,
} from '../../src/components/PitchDefender/retroBlasterEngine'
import { noteToFreq } from '../../src/components/PitchDefender/pitchMath'

const EPSILON = 1e-7
const NOTES = ['C4', 'D4', 'E4', 'F4']
const speedRows: Array<{ row: number; stepMs: number; peakPxPerSecond: number; peakStepPx: number }> = []

function input(overrides: Partial<EngineInput> = {}): EngineInput {
  return {
    inputMode: 'click',
    isListening: false,
    reducedMotion: false,
    pitch: null,
    fsrs: {},
    isActive: true,
    ...overrides,
  }
}

function alien(slot: number, note = NOTES[slot % NOTES.length]): Alien {
  const anchor = formationAnchor(slot)
  return {
    alienId: `fixture-game:alien:1:${slot}`,
    visualId: `fixture:${slot}`,
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
    hue: 180,
    alive: true,
    frame: 0,
    hitTimer: 0,
  }
}

function preparedState(
  difficulty: Difficulty = 'true',
  slots: number[] = [0],
): GameState {
  const state = createInitialState(difficulty, NOTES, 1000, 'fixture-game')
  state.waveIntroTimer = 0
  state.spawnQueue = []
  state.spawnedThisWave = slots.length
  state.alienCountThisWave = slots.length
  state.aliens = slots.map(slot => alien(slot))
  state.nextAttackAtMs = state.directorClockMs
  state.waveStartedAtMs = state.directorClockMs
  return state
}

function advance(
  state: GameState,
  totalMs: number,
  engineInput: EngineInput = input(),
  stepMs = 50,
): TickResult {
  let next = state
  const events: EngineEvent[] = []
  let elapsed = 0
  while (elapsed < totalMs) {
    const step = Math.min(stepMs, totalMs - elapsed)
    const result = tick(next, engineInput, step, () => 0.5)
    next = result.state
    events.push(...result.events)
    elapsed += step
  }
  return { state: next, viewState: tick(next, engineInput, 0, () => 0.5).viewState, events }
}

function openDemand(
  state = preparedState(),
  engineInput: EngineInput = input(),
): TickResult {
  const started = tick(state, engineInput, 0, () => 0.5)
  assert.equal(started.state.activeAttack?.phase, 'telegraph')
  const opened = advance(started.state, DIVE_TELEGRAPH_MS, engineInput)
  assert.equal(opened.state.activeAttack?.phase, 'outbound')
  assert.notEqual(opened.state.activeAttack?.demandAtMs, null)
  return { ...opened, events: [...started.events, ...opened.events] }
}

function pending(state: GameState, note: string): PendingAttackAnswer {
  const attack = state.activeAttack
  assert.ok(attack)
  return {
    note,
    inputMode: 'click',
    gameId: state.gameId,
    alienId: attack.alienId,
    attackId: attack.attackId,
  }
}

function gradeEvents(events: EngineEvent[]): Extract<EngineEvent, { kind: 'grade' }>[] {
  return events.filter((event): event is Extract<EngineEvent, { kind: 'grade' }> => event.kind === 'grade')
}

function validateCurveAndBottomRow(): void {
  const top = formationAnchor(0)
  assert.deepEqual(divePose(top.x, top.y, 0, 1), top)
  const knee = divePose(top.x, top.y, 0.28, 1)
  assert.ok(Math.abs(knee.x - top.x - DIVE_KNEE_X) < EPSILON)
  assert.ok(Math.abs(knee.y - top.y - DIVE_KNEE_Y) < EPSILON)
  const end = divePose(top.x, top.y, 1, 1)
  assert.ok(Math.abs(end.x - top.x - DIVE_CHANNEL_X) < EPSILON)
  assert.ok(Math.abs(end.y - DIVE_ATTACK_Y) < EPSILON)
  const mirrored = divePose(top.x, top.y, 1, -1)
  assert.ok(Math.abs(mirrored.x - top.x + DIVE_CHANNEL_X) < EPSILON)
  assert.ok(Math.abs(mirrored.y - end.y) < EPSILON)

  const bottomSlot = 10
  const bottomState = preparedState('true', [bottomSlot])
  assert.equal(chooseNextDiver(bottomState)?.formationSlot, bottomSlot)
  const opened = openDemand(preparedState('true', [bottomSlot])).state
  assert.equal(opened.activeAttack?.alienId, opened.aliens[0].alienId)
  const flown = advance(opened, DIVE_OUTBOUND_MS).state
  assert.ok(Math.abs(flown.aliens[0].y - DIVE_ATTACK_Y) < EPSILON)
  assert.equal(flightStateOf(flown.aliens[0], flown.activeAttack), 'outbound')
}

function validateIdentitySelectionAndTelegraph(): void {
  let state = preparedState('true', [0, 1])
  state.aliens[1].note = state.aliens[0].note
  let started = tick(state, input(), 0, () => 0.5)
  const attackedId = started.state.activeAttack!.alienId
  assert.equal(started.state.requiredAnswerEventsMs.length, 0)
  const preDemand = advance(started.state, DIVE_TELEGRAPH_MS - 1)
  assert.equal(preDemand.state.activeAttack?.phase, 'telegraph')
  assert.equal(preDemand.state.activeAttack?.demandAtMs, null)
  assert.equal(preDemand.events.some(event => event.kind === 'playNote'), false)
  const discarded = tick(
    preDemand.state,
    input({ pendingAnswer: pending(preDemand.state, preDemand.state.activeAttack!.note) }),
    0,
    () => 0.5,
  )
  const demand = tick(discarded.state, input(), 1, () => 0.5)
  assert.equal(demand.state.activeAttack?.phase, 'outbound')
  assert.equal(demand.state.requiredAnswerEventsMs.length, 1)
  assert.equal(demand.events.filter(event => event.kind === 'playNote').length, 1)
  assert.equal(demand.state.activeAttack?.outcome, null, 'pre-demand answer must not buffer into the open demand')

  state = demand.state
  state.aliens.reverse()
  const correct = tick(state, input({ pendingAnswer: pending(state, state.activeAttack!.note) }), 16, () => 0.5)
  assert.equal(correct.state.activeAttack?.alienId, attackedId)
  assert.equal(correct.state.activeAttack?.phase, 'hit-locked')
  assert.equal(correct.state.aliens.find(candidate => candidate.alienId !== attackedId)?.alive, true)
  assert.equal(correct.state.aliens.filter(candidate => flightStateOf(candidate, correct.state.activeAttack) !== 'formation').length, 1)

  state = openDemand(preparedState('true', [0, 1])).state
  const decoyId = state.aliens.find(candidate => candidate.alienId !== state.activeAttack!.alienId)!.alienId
  const wrongNote = state.aliens.find(candidate => candidate.alienId === decoyId)!.note
  const wrong = tick(state, input({ pendingAnswer: pending(state, wrongNote) }), 16, () => 0.5)
  assert.equal(wrong.state.activeAttack?.outcome, 'wrong')
  assert.equal(wrong.state.aliens.find(candidate => candidate.alienId === decoyId)?.alive, true)

  const selector = preparedState('true', [0, 1, 2, 3])
  selector.aliens[0].alive = false
  selector.aliens[1].entering = true
  selector.directorCursorSlot = 0
  assert.equal(chooseNextDiver(selector)?.formationSlot, 2)
  assert.equal(chooseNextDiver(selector)?.formationSlot, 3)

  state = openDemand(preparedState('true', [0, 1])).state
  const firstId = state.activeAttack!.attackId
  state = tick(state, input({ pendingAnswer: pending(state, 'D4') }), 16, () => 0.5).state
  state = advance(state, DIVE_RETURN_MS).state
  state.nextAttackAtMs = state.directorClockMs
  started = tick(state, input(), 0, () => 0.5)
  assert.notEqual(started.state.activeAttack?.attackId, firstId)
  const restarted = preparedState('true', [0])
  restarted.gameId = 'second-game'
  restarted.aliens[0].alienId = 'second-game:alien:1:0'
  const restartAttack = tick(restarted, input(), 0, () => 0.5).state.activeAttack!
  assert.notEqual(restartAttack.attackId, firstId)
  const oldGameAnswer = {
    ...pending(demand.state, demand.state.activeAttack!.note),
    attackId: restartAttack.attackId,
  }
  const staleResult = tick(
    { ...started.state, gameId: 'second-game' },
    input({ pendingAnswer: oldGameAnswer }),
    0,
    () => 0.5,
  )
  assert.equal(staleResult.state.activeAttack?.outcome, null)
}

function validateSpeedSafeBoundsAndRendererLaw(): void {
  for (const [row, slot] of [0, 5, 10].entries()) {
    const anchor = formationAnchor(slot)
    for (const stepMs of [1000 / 60, MAX_SIM_STEP_MS]) {
      let elapsed = 0
      let previous = divePose(anchor.x, anchor.y, 0, 1)
      let peakStepPx = 0
      while (elapsed < DIVE_OUTBOUND_MS) {
        const nextElapsed = Math.min(DIVE_OUTBOUND_MS, elapsed + stepMs)
        const pose = divePose(anchor.x, anchor.y, nextElapsed / DIVE_OUTBOUND_MS, 1)
        peakStepPx = Math.max(peakStepPx, Math.hypot(pose.x - previous.x, pose.y - previous.y))
        previous = pose
        elapsed = nextElapsed
      }
      speedRows.push({
        row,
        stepMs,
        peakPxPerSecond: peakStepPx / (stepMs / 1000),
        peakStepPx,
      })
      assert.ok(peakStepPx <= (stepMs === MAX_SIM_STEP_MS ? 12.5 : 4.25) + EPSILON)
    }
    for (const side of [-1, 1] as const) {
      for (let sample = 0; sample <= 1000; sample++) {
        const pose = divePose(anchor.x, anchor.y, sample / 1000, side)
        const atlasLeft = pose.x - 12 * SPACE_SCALE
        const atlasTop = pose.y - 9 * SPACE_SCALE
        const atlasRight = atlasLeft + 48 * SPACE_SCALE
        const atlasBottom = atlasTop + 36 * SPACE_SCALE
        assert.ok(atlasLeft >= 0 && atlasRight <= W)
        assert.ok(atlasTop >= 42 * SPACE_SCALE && atlasBottom < PLAYER_Y - 20 * SPACE_SCALE)
        assert.ok(atlasBottom < NOTE_BUTTONS_Y && atlasBottom <= H)
      }
    }
  }
  const top = formationAnchor(0)
  const continuousImpactMs = (PLAYER_Y - (top.y + ALIEN_H)) / LASER_SPEED * 1000
  const cappedImpactMs = Math.ceil(continuousImpactMs / MAX_SIM_STEP_MS) * MAX_SIM_STEP_MS
  assert.ok(continuousImpactMs < 400 && cappedImpactMs === 400 && cappedImpactMs < HIT_LOCK_MAX_MS)
  assert.ok(DIVE_CLEAR_Y > 0)

  const renderer = readFileSync('src/components/PitchDefender/retroBlasterRenderer.ts', 'utf8')
  assert.match(renderer, /attack\.phase === 'returning' \? 'dive-bank' : 'dive-down'/)
  assert.match(renderer, /drawAtlasFacing\([\s\S]*?frameName[\s\S]*?s, attack\.side/)
  assert.match(renderer, /attack\.side === -1 \? 1 - anchor\[0\] : anchor\[0\]/)
  assert.match(renderer, /const orderedAliens = \[\.\.\.viewState\.aliens\]/)
  assert.ok(renderer.indexOf('if (isFlightPose && attack)') < renderer.indexOf('} else if (isActive)'))
}

function validateCorrectAndIdentityGuards(): void {
  let state = openDemand().state
  const attack = state.activeAttack!
  const target = state.aliens.find(candidate => candidate.alienId === attack.alienId)!
  const stale = { ...pending(state, target.note), gameId: 'stale-game' }
  let result = tick(state, input({ pendingAnswer: stale }), 16, () => 0.5)
  assert.equal(result.state.activeAttack?.outcome, null)
  assert.equal(gradeEvents(result.events).length, 0)

  result = tick(result.state, input({ inputMode: 'mic', pendingAnswer: pending(result.state, target.note) }), 16, () => 0.5)
  state = result.state
  const grades = gradeEvents(result.events)
  assert.equal(grades.length, 1)
  assert.equal(grades[0].inputMode, 'click', 'click/key input must persist in the ear lane even in mic mode')
  assert.equal(state.activeAttack?.phase, 'hit-locked')
  assert.equal(state.activeAttack?.resolvedAtMs, state.directorClockMs)
  assert.equal(state.cityHealth, STARTING_SHIELDS)
  assert.equal(state.lasers.filter(laser => laser.active && laser.attackId === attack.attackId).length, 1)
  assert.equal(state.lasers[0].targetAlienId, target.alienId)
  assert.ok(state.lasers[0].y < PLAYER_Y, 'presentation projectile may advance after the immediate grade')

  const duplicateEvents: EngineEvent[] = []
  assert.equal(resolveAttack(state, attack.attackId, 'correct', 1, duplicateEvents, 'click'), false)
  assert.equal(duplicateEvents.length, 0)

  const resolvedAt = state.activeAttack!.resolvedAtMs!
  const finalized = advance(state, HIT_LOCK_MAX_MS).state
  assert.equal(finalized.activeAttack, null)
  assert.equal(finalized.aliens.find(candidate => candidate.alienId === target.alienId)?.alive, false)
  assert.ok(finalized.directorClockMs - resolvedAt <= HIT_LOCK_MAX_MS)
}

function validateWrongTimeoutAndGameOver(): void {
  let state = openDemand().state
  const attack = state.activeAttack!
  let result = tick(state, input({ pendingAnswer: pending(state, 'D4') }), 16, () => 0.5)
  assert.equal(result.state.cityHealth, STARTING_SHIELDS - 1)
  assert.equal(result.state.activeAttack?.phase, 'returning')
  assert.deepEqual(gradeEvents(result.events).map(event => ({ correct: event.correct, inputMode: event.inputMode })), [
    { correct: false, inputMode: 'click' },
  ])
  assert.equal(result.state.lasers.filter(laser => laser.attackId === attack.attackId).length, 1)
  state = advance(result.state, DIVE_RETURN_MS).state
  assert.equal(state.activeAttack, null)
  assert.ok(Math.abs(state.aliens[0].x - state.aliens[0].formationX) < EPSILON)
  assert.ok(Math.abs(state.aliens[0].y - state.aliens[0].formationY) < EPSILON)

  state = openDemand().state
  result = advance(state, DIVE_RESPONSE_DEADLINE_MS)
  assert.equal(result.state.cityHealth, STARTING_SHIELDS - 1)
  assert.equal(result.state.activeAttack?.outcome, 'timeout')
  assert.deepEqual(gradeEvents(result.events).map(event => ({ correct: event.correct, inputMode: event.inputMode })), [
    { correct: false, inputMode: 'click' },
  ])

  state = openDemand().state
  state.cityHealth = 1
  result = tick(state, input({ pendingAnswer: pending(state, 'D4') }), 16, () => 0.5)
  assert.equal(result.state.phase, 'game_over')
  assert.equal(result.state.activeAttack, null)
  assert.equal(result.state.lasers.some(laser => laser.active), false)
  assert.equal(result.events.filter(event => event.kind === 'gameOver').length, 1)
}

function validateDeadlineDuplicateAndFinalizerRaces(): void {
  let state = openDemand().state
  state.activeAttack!.deadlineAtMs = state.directorClockMs + 16
  let result = tick(state, input({ pendingAnswer: pending(state, state.activeAttack!.note) }), 16, () => 0.5)
  assert.equal(gradeEvents(result.events).length, 1)
  assert.equal(result.state.cityHealth, STARTING_SHIELDS, 'click at the deadline must beat timeout')
  const scoreAfterFirst = result.state.score
  const projectilesAfterFirst = result.state.lasers.length
  const duplicate = tick(
    result.state,
    input({ pendingAnswer: pending(result.state, result.state.activeAttack!.note) }),
    0,
    () => 0.5,
  )
  assert.equal(gradeEvents(duplicate.events).length, 0)
  assert.equal(duplicate.state.score, scoreAfterFirst)
  assert.equal(duplicate.state.lasers.length, projectilesAfterFirst)

  state = openDemand(preparedState(), input({ inputMode: 'mic', isListening: true })).state
  const micTarget = state.aliens.find(candidate => candidate.alienId === state.activeAttack!.alienId)!
  state.matchTargetAlienId = micTarget.alienId
  state.matchStartAt = state.clockMs - MIC_HOLD_MS
  state.activeAttack!.deadlineAtMs = state.directorClockMs + 16
  result = tick(state, input({
    inputMode: 'mic',
    isListening: true,
    pitch: { note: micTarget.note, frequency: noteToFreq(micTarget.note), cents: 0, confidence: 1, isActive: true },
  }), 16, () => 0.5)
  assert.equal(gradeEvents(result.events).length, 1)
  assert.equal(result.state.cityHealth, STARTING_SHIELDS, 'mic completion at the deadline must beat timeout')

  state = openDemand().state
  result = tick(state, input({ pendingAnswer: pending(state, 'D4') }), 16, () => 0.5)
  const shieldsAfterWrong = result.state.cityHealth
  result.state.directorClockMs = result.state.activeAttack!.deadlineAtMs!
  const laterTimeout = tick(result.state, input(), 0, () => 0.5)
  assert.equal(laterTimeout.state.cityHealth, shieldsAfterWrong)

  state = openDemand().state
  const lateAnswer = pending(state, state.activeAttack!.note)
  result = advance(state, DIVE_RESPONSE_DEADLINE_MS)
  const shieldsAfterTimeout = result.state.cityHealth
  const afterTimeoutInput = tick(result.state, input({ pendingAnswer: lateAnswer }), 0, () => 0.5)
  assert.equal(afterTimeoutInput.state.cityHealth, shieldsAfterTimeout)
  assert.equal(gradeEvents(afterTimeoutInput.events).length, 0)

  state = openDemand(preparedState('true', [0])).state
  result = tick(state, input({ pendingAnswer: pending(state, state.activeAttack!.note) }), 0, () => 0.5)
  const impactAttackId = result.state.activeAttack!.attackId
  const impact = advance(result.state, 400)
  assert.equal(impact.events.filter(event => event.kind === 'sfx' && event.name === 'explosion').length, 1)
  const postImpactEvents: EngineEvent[] = []
  assert.equal(finalizeHitLockedDeath(impact.state, impactAttackId, postImpactEvents, () => 0.5), false)
  assert.equal(postImpactEvents.length, 0)

  state = openDemand(preparedState('true', [0])).state
  result = tick(state, input({ pendingAnswer: pending(state, state.activeAttack!.note) }), 0, () => 0.5)
  const lostAttackId = result.state.activeAttack!.attackId
  result.state.lasers.forEach(laser => { laser.active = false })
  const fallback = advance(result.state, HIT_LOCK_MAX_MS)
  assert.equal(fallback.state.activeAttack, null)
  assert.equal(fallback.state.aliens[0].alive, false)
  assert.equal(gradeEvents(fallback.events).length, 0)
  assert.equal(fallback.events.filter(event => event.kind === 'sfx' && event.name === 'explosion').length, 1)
  assert.equal(fallback.state.lasers.some(laser => laser.attackId === lostAttackId && laser.active), false)

  state = openDemand(preparedState('true', [0])).state
  result = tick(state, input({ pendingAnswer: pending(state, state.activeAttack!.note) }), 0, () => 0.5)
  result.state.aliens[0].alive = false
  const removed = tick(result.state, input(), 0, () => 0.5)
  assert.equal(removed.state.activeAttack, null)
  assert.equal(removed.state.cityHealth, STARTING_SHIELDS)
  assert.equal(removed.events.filter(event => event.kind === 'sfx' && event.name === 'explosion').length, 0)
}

function validatePauseBufferAndMicBoundaries(): void {
  let state = openDemand().state
  const hiddenAnswer = pending(state, state.activeAttack!.note)
  const directorBeforeHidden = state.directorClockMs
  const clockBeforeHidden = state.clockMs
  let result = tick(state, input({ pendingAnswer: hiddenAnswer, isActive: false }), 5000, () => 0.5)
  assert.equal(result.state.directorClockMs, directorBeforeHidden)
  assert.equal(result.state.clockMs, clockBeforeHidden)
  result = tick(result.state, input(), 0, () => 0.5)
  assert.equal(result.state.activeAttack?.outcome, null)
  assert.equal(gradeEvents(result.events).length, 0)

  const activeLargeDt = tick(result.state, input(), 5000, () => 0.5)
  assert.equal(activeLargeDt.state.directorClockMs, result.state.directorClockMs + MAX_SIM_STEP_MS)

  const micPitch = {
    note: 'C4', frequency: noteToFreq('C4'), cents: 0, confidence: 1, isActive: true,
  }
  state = preparedState()
  result = tick(state, input({ inputMode: 'mic', isListening: true, pitch: micPitch }), 0, () => 0.5)
  result = advance(result.state, DIVE_TELEGRAPH_MS - 1, input({ inputMode: 'mic', isListening: true, pitch: micPitch }))
  assert.equal(result.state.matchStartAt, 0)
  result = tick(result.state, input({ inputMode: 'mic', isListening: true, pitch: micPitch }), 1, () => 0.5)
  assert.equal(result.state.activeAttack?.phase, 'outbound')
  assert.equal(result.state.chargeProgress, 0)
  result = advance(result.state, MIC_HOLD_MS - 1, input({ inputMode: 'mic', isListening: true, pitch: micPitch }))
  assert.equal(gradeEvents(result.events).length, 0)
  result = tick(result.state, input({ inputMode: 'mic', isListening: true, pitch: micPitch }), 1, () => 0.5)
  assert.equal(gradeEvents(result.events).length, 1)

  state = openDemand(preparedState(), input({ inputMode: 'mic', isListening: true })).state
  const target = state.aliens.find(candidate => candidate.alienId === state.activeAttack!.alienId)!
  state.matchTargetAlienId = target.alienId
  state.matchStartAt = state.clockMs - MIC_HOLD_MS
  state.activeAttack!.deadlineAtMs = state.directorClockMs
  const frozen = tick(state, input({
    inputMode: 'mic', isListening: true, isActive: false,
    pitch: { ...micPitch, note: target.note, frequency: noteToFreq(target.note) },
  }), 5000, () => 0.5)
  assert.equal(frozen.state.activeAttack?.outcome, null)
  const resumed = tick(frozen.state, input({
    inputMode: 'mic', isListening: true,
    pitch: { ...micPitch, note: target.note, frequency: noteToFreq(target.note) },
  }), 0, () => 0.5)
  assert.equal(gradeEvents(resumed.events).length, 1)
  assert.equal(resumed.state.cityHealth, STARTING_SHIELDS)
}

function validateClickBeforeMicAndMicSemantics(): void {
  let state = openDemand(preparedState(), input({ inputMode: 'mic', isListening: true })).state
  const attack = state.activeAttack!
  const target = state.aliens.find(candidate => candidate.alienId === attack.alienId)!
  state.matchTargetAlienId = target.alienId
  state.matchStartAt = state.clockMs - MIC_HOLD_MS
  const result = tick(state, input({
    inputMode: 'mic',
    isListening: true,
    pendingAnswer: pending(state, 'D4'),
    pitch: { note: target.note, frequency: noteToFreq(target.note), cents: 0, confidence: 1, isActive: true },
  }), 16, () => 0.5)
  assert.equal(result.state.cityHealth, STARTING_SHIELDS - 1)
  assert.equal(result.state.activeAttack?.outcome, 'wrong')
  assert.deepEqual(gradeEvents(result.events).map(event => ({ correct: event.correct, inputMode: event.inputMode })), [
    { correct: false, inputMode: 'click' },
  ], 'wrong click must grade EAR and win before correct mic completion in the same tick')

  state = openDemand(preparedState(), input({ inputMode: 'mic', isListening: true })).state
  const micTarget = state.aliens.find(candidate => candidate.alienId === state.activeAttack!.alienId)!
  state.matchTargetAlienId = micTarget.alienId
  state.matchStartAt = state.clockMs - 100
  state.chargeProgress = 100
  const wrongMic = tick(state, input({
    inputMode: 'mic',
    isListening: true,
    pitch: { note: 'D4', frequency: noteToFreq('D4'), cents: 0, confidence: 1, isActive: true },
  }), 16, () => 0.5)
  assert.equal(wrongMic.state.cityHealth, STARTING_SHIELDS)
  assert.equal(wrongMic.state.activeAttack?.outcome, null)
  assert.equal(wrongMic.state.matchStartAt, 0)
  assert.equal(wrongMic.state.chargeProgress, 0)
  assert.equal(gradeEvents(wrongMic.events).length, 0)

  const micInput = input({
    inputMode: 'mic',
    isListening: true,
    pitch: { note: micTarget.note, frequency: noteToFreq(micTarget.note), cents: 0, confidence: 1, isActive: true },
  })
  state = tick(wrongMic.state, micInput, 50, () => 0.5).state
  assert.ok(state.matchStartAt > 0)
  const clockBeforeHidden = state.clockMs
  const directorBeforeHidden = state.directorClockMs
  const chargeBeforeHidden = state.chargeProgress
  state = tick(state, { ...micInput, isActive: false }, 5000, () => 0.5).state
  assert.equal(state.clockMs, clockBeforeHidden)
  assert.equal(state.directorClockMs, directorBeforeHidden)
  assert.equal(state.chargeProgress, chargeBeforeHidden)
  const completed = advance(state, MIC_HOLD_MS, micInput)
  const grades = gradeEvents(completed.events)
  assert.equal(grades.length, 1)
  assert.equal(grades[0].inputMode, 'mic')
}

function validateStructuralOrderAndReducedMotion(): void {
  const state = openDemand().state
  const attack = state.activeAttack!
  state.aliens.find(candidate => candidate.alienId === attack.alienId)!.alive = false
  const result = tick(state, input({ pendingAnswer: pending(state, attack.note) }), 16, () => 0.5)
  assert.equal(result.state.activeAttack, null)
  assert.equal(result.state.cityHealth, STARTING_SHIELDS)
  assert.equal(gradeEvents(result.events).length, 0)

  const normal = openDemand(preparedState('true', [0, 1])).state
  const reduced = openDemand(preparedState('true', [0, 1]), input({ reducedMotion: true })).state
  const normalTick = tick(normal, input(), 400, () => 0.5)
  const reducedTick = tick(reduced, input({ reducedMotion: true }), 400, () => 0.5)
  assert.deepEqual(
    normalTick.events.map(event => event.kind),
    reducedTick.events.map(event => event.kind),
  )
  assert.equal(normalTick.state.activeAttack?.outboundT, reducedTick.state.activeAttack?.outboundT)
  const reducedTarget = reducedTick.state.aliens.find(
    candidate => candidate.alienId === reducedTick.state.activeAttack?.alienId,
  )!
  assert.equal(reducedTarget.x, reducedTarget.formationX)
  assert.equal(reducedTarget.y, reducedTarget.formationY)
}

function validateUnlockedOrderKeyboardMapping(): void {
  const reordered = ['A4', 'C4', 'G4', 'E4']
  assert.equal(noteForKeyboardInput('1', reordered), 'A4')
  assert.equal(noteForKeyboardInput('2', reordered), 'C4')
  assert.equal(noteForKeyboardInput('a', reordered), 'A4')

  const state = openDemand(preparedState('true', [0])).state
  state.unlockedNotes = reordered
  state.activeAttack!.note = 'A4'
  const target = state.aliens.find(candidate => candidate.alienId === state.activeAttack!.alienId)!
  target.note = 'A4'
  const mapped = noteForKeyboardInput('1', state.unlockedNotes)
  const result = tick(state, input({ pendingAnswer: pending(state, mapped!) }), 16, () => 0.5)
  const grades = gradeEvents(result.events)
  assert.equal(grades.length, 1)
  assert.equal(grades[0].note, 'A4')
  assert.equal(result.state.activeAttack?.outcome, 'correct')
}

function validateRecoveryCadenceWaveWaitAndReducedParity(): void {
  let state = openDemand(preparedState('true', [0, 1])).state
  const attackedId = state.activeAttack!.alienId
  state.aliens = state.aliens.filter(candidate => candidate.alienId !== attackedId)
  let result = tick(state, input(), 0, () => 0.5)
  assert.equal(result.state.activeAttack, null)
  assert.equal(result.state.cityHealth, STARTING_SHIELDS)
  assert.equal(gradeEvents(result.events).length, 0)

  state = preparedState('easy', [0, 1])
  result = tick(state, input(), 0, () => 0.5)
  const cancelledId = result.state.activeAttack!.alienId
  result.state.aliens.find(candidate => candidate.alienId === cancelledId)!.alive = false
  result = tick(result.state, input(), 0, () => 0.5)
  assert.equal(result.state.activeAttack, null)
  assert.ok(result.state.nextAttackAtMs >= result.state.directorClockMs + POST_RESOLUTION_FLOOR_MS)
  let guard = 0
  while (result.state.activeAttack?.phase !== 'outbound' && guard++ < 100) {
    result = tick(result.state, input(), 50, () => 0.5)
  }
  assert.equal(result.state.activeAttack?.phase, 'outbound')
  assert.ok(result.state.activeAttack!.demandAtMs! >= result.state.waveStartedAtMs + ENGINE_DEMAND_FLOOR_MS.easy)

  state = preparedState('true', [])
  state.nextAttackAtMs = state.directorClockMs
  result = tick(state, input(), 0, () => 0.5)
  assert.equal(result.state.activeAttack, null)
  assert.equal(result.state.nextAttackAtMs, state.directorClockMs + NO_ELIGIBLE_RETRY_MS)
  assert.equal(result.events.length, 0)
  const beforeRetry = result.state.nextAttackAtMs
  result = tick(result.state, input(), NO_ELIGIBLE_RETRY_MS - 1, () => 0.5)
  assert.equal(result.state.nextAttackAtMs, beforeRetry)

  state = openDemand(preparedState('true', [0])).state
  const wave = state.wave
  result = tick(state, input({ pendingAnswer: pending(state, state.activeAttack!.note) }), 0, () => 0.5)
  assert.equal(result.state.wave, wave)
  assert.equal(result.state.activeAttack?.phase, 'hit-locked')
  result = advance(result.state, HIT_LOCK_MAX_MS - MAX_SIM_STEP_MS)
  assert.equal(result.state.wave, wave)
  const completed = advance(result.state, MAX_SIM_STEP_MS + 500)
  assert.equal(completed.events.filter(event => event.kind === 'waveComplete').length, 1)
  assert.equal(completed.state.wave, wave + 1)

  const normalOpen = openDemand(preparedState('true', [0, 1]), input())
  const reducedOpen = openDemand(preparedState('true', [0, 1]), input({ reducedMotion: true }))
  assert.deepEqual(normalOpen.state.activeAttack, reducedOpen.state.activeAttack)
  assert.deepEqual(normalOpen.events, reducedOpen.events)
  const normalWrong = tick(
    normalOpen.state,
    input({ pendingAnswer: pending(normalOpen.state, 'D4') }),
    16,
    () => 0.5,
  )
  const reducedWrong = tick(
    reducedOpen.state,
    input({ reducedMotion: true, pendingAnswer: pending(reducedOpen.state, 'D4') }),
    16,
    () => 0.5,
  )
  assert.deepEqual(normalWrong.events, reducedWrong.events)
  assert.deepEqual(normalWrong.state.activeAttack, reducedWrong.state.activeAttack)
  assert.equal(normalWrong.state.cityHealth, reducedWrong.state.cityHealth)
  const returningAlienId = normalWrong.state.activeAttack!.alienId
  const normalReturned = advance(normalWrong.state, DIVE_RETURN_MS, input())
  const reducedReturned = advance(reducedWrong.state, DIVE_RETURN_MS, input({ reducedMotion: true }))
  assert.deepEqual(normalReturned.events, reducedReturned.events)
  assert.equal(normalReturned.state.activeAttack, null)
  assert.equal(reducedReturned.state.activeAttack, null)
  for (const returned of [normalReturned.state, reducedReturned.state]) {
    const candidate = returned.aliens.find(item => item.alienId === returningAlienId)!
    assert.equal(candidate.x, candidate.formationX)
    assert.equal(candidate.y, candidate.formationY)
  }
}

function answerCurrentCorrectly(state: GameState): TickResult {
  const attack = state.activeAttack
  assert.ok(attack?.demandAtMs !== null && attack?.phase === 'outbound')
  return tick(state, input({ pendingAnswer: pending(state, attack.note) }), 16, () => 0.5)
}

function measuredWave(
  difficulty: Difficulty,
  slots: number[],
  injectHiddenWallTime = false,
): { state: GameState; events: EngineEvent[] } {
  let state = preparedState(difficulty, slots)
  state.nextAttackAtMs = state.waveStartedAtMs + ENGINE_DEMAND_FLOOR_MS[difficulty] - DIVE_TELEGRAPH_MS
  const collectedEvents: EngineEvent[] = []
  let hiddenInjected = false
  let guard = 0
  while (!state.lastCompletedWavePacing && guard++ < 1000) {
    const attack = state.activeAttack
    let result: TickResult
    if (attack?.phase === 'outbound' && attack.outcome === null && attack.demandAtMs !== null) {
      if (injectHiddenWallTime && !hiddenInjected) {
        const hidden = tick(state, input({ isActive: false }), 5000, () => 0.5)
        assert.deepEqual(hidden.events, [])
        state = hidden.state
        hiddenInjected = true
      }
      result = answerCurrentCorrectly(state)
    } else {
      result = tick(state, input(), 50, () => 0.5)
    }
    state = result.state
    collectedEvents.push(...result.events)
  }
  return { state, events: collectedEvents }
}

const pacingRows: Array<{
  difficulty: Difficulty
  wave: number
  publishedDenominatorMs: number
  publishedCeilingApm: number
  engineSchedulingFloorMs: number
  waveStartedAtMs: number
  waveEndedAtMs: number
  waveDurationMs: number
  demandCount: number
  timestampsMs: number[]
  measuredApm: number
  minimumGapMs: number | null
}> = []

function validatePacing(difficulty: Difficulty): void {
  for (const slots of [[0], [0, 1, FORMATION_SLOT_COUNT - 1]]) {
    const measured = measuredWave(difficulty, slots)
    const state = measured.state
    const collectedEvents = measured.events
    assert.ok(state.lastCompletedWavePacing, `${difficulty} pacing fixture did not finish its measured wave`)
    const receipt = state.lastCompletedWavePacing
    assert.ok(receipt.waveDurationMs > 0)
    assert.equal(receipt.requiredAnswerEventsMs.length, slots.length)
    assert.ok(receipt.requiredAnswerEventsMs[0] >= receipt.waveStartedAtMs + ENGINE_DEMAND_FLOOR_MS[difficulty])
    const eventGaps = receipt.requiredAnswerEventsMs.slice(1)
      .map((value, index) => value - receipt.requiredAnswerEventsMs[index])
    const minimumGapMs = eventGaps.length ? Math.min(...eventGaps) : null
    for (const gap of eventGaps) {
      assert.ok(gap >= (difficulty === 'easy' ? 1100 : 800), `${difficulty} demand gap ${gap}ms is below published floor`)
    }
    const measuredApm = slots.length / (receipt.waveDurationMs / 60000)
    const publishedCeilingApm = difficulty === 'easy' ? 54.5 : 75
    assert.ok(measuredApm <= publishedCeilingApm, `${difficulty} ${measuredApm.toFixed(2)} APM exceeds ceiling`)
    assert.equal(gradeEvents(collectedEvents).length, slots.length)
    assert.equal(state.requiredAnswerEventsMs.length, 0, 'new wave demand array must reset after receipt snapshot')
    pacingRows.push({
      difficulty,
      wave: receipt.wave,
      publishedDenominatorMs: difficulty === 'easy' ? 1100 : 800,
      publishedCeilingApm,
      engineSchedulingFloorMs: ENGINE_DEMAND_FLOOR_MS[difficulty],
      waveStartedAtMs: receipt.waveStartedAtMs,
      waveEndedAtMs: receipt.waveEndedAtMs,
      waveDurationMs: receipt.waveDurationMs,
      demandCount: receipt.requiredAnswerEventsMs.length,
      timestampsMs: receipt.requiredAnswerEventsMs,
      measuredApm,
      minimumGapMs,
    })
  }

  const unpaused = measuredWave(difficulty, [0, 1])
  const paused = measuredWave(difficulty, [0, 1], true)
  assert.deepEqual(paused.state.lastCompletedWavePacing, unpaused.state.lastCompletedWavePacing)
  assert.deepEqual(
    paused.events.map(event => event.kind),
    unpaused.events.map(event => event.kind),
  )
}

function validateFinalizerIdempotence(): void {
  const state = openDemand().state
  const attackId = state.activeAttack!.attackId
  const events: EngineEvent[] = []
  assert.equal(resolveAttack(state, attackId, 'correct', 100, events, 'click'), true)
  assert.equal(finalizeHitLockedDeath(state, attackId, events, () => 0.5), true)
  const eventCount = events.length
  assert.equal(finalizeHitLockedDeath(state, attackId, events, () => 0.5), false)
  assert.equal(events.length, eventCount)
}

function validateRosterShellAndProtectedSourceContracts(): void {
  const easy = createInitialState('easy', NOTES, 1000, 'queue-easy')
  buildWaveQueue(easy, {})
  assert.deepEqual(easy.spawnQueue, ['C4', 'E4'])
  const trueTier = createInitialState('true', NOTES, 1000, 'queue-true')
  trueTier.wave = 7
  beginWave(trueTier, {})
  assert.deepEqual(trueTier.spawnQueue, ['E4', 'D4', 'C4', 'C4', 'E4', 'E4', 'C4', 'E4', 'C4', 'F4'])

  const engineSource = readFileSync('src/components/PitchDefender/retroBlasterEngine.ts', 'utf8')
  const selectorStart = engineSource.indexOf('export function chooseNextDiver')
  const selectorEnd = engineSource.indexOf('\nfunction startAttack', selectorStart)
  const selectorSource = engineSource.slice(selectorStart, selectorEnd)
  assert.ok(selectorStart >= 0 && selectorEnd > selectorStart)
  assert.match(selectorSource, /alien\.soul\?\.divePressure/)
  assert.doesNotMatch(selectorSource, /currentR|retrievability|lastReview|Date\./)
  assert.doesNotMatch(engineSource, /Date\.|performance\./, 'receipt/director engine must not read wall time')

  const shell = readFileSync('src/components/PitchDefender/RetroBlasterII.tsx', 'utf8')
  assert.match(shell, /crypto\.randomUUID\(\)/)
  assert.match(shell, /attack\.attackId !== event\.attackId/)
  assert.match(shell, /attack\.alienId !== event\.targetAlienId/)
  assert.match(shell, /visibilityActiveRef\.current/)

  const v1 = readFileSync('src/components/PitchDefender/RetroBlaster.tsx', 'utf8')
  assert.equal(v1.match(/autoGrade\(true/g)?.length, 1)
  assert.equal(v1.match(/reviewNote\(/g)?.length, 1)
  assert.equal(v1.includes('autoGrade(false'), false)
  const correctBranch = v1.slice(v1.indexOf('if (pick) {'), v1.indexOf('    } else {', v1.indexOf('if (pick) {')))
  assert.match(correctBranch, /autoGrade\(true/)
  assert.match(correctBranch, /reviewNote\(/)
}

validateCurveAndBottomRow()
validateIdentitySelectionAndTelegraph()
validateSpeedSafeBoundsAndRendererLaw()
validateCorrectAndIdentityGuards()
validateWrongTimeoutAndGameOver()
validateDeadlineDuplicateAndFinalizerRaces()
validateClickBeforeMicAndMicSemantics()
validatePauseBufferAndMicBoundaries()
validateStructuralOrderAndReducedMotion()
validateUnlockedOrderKeyboardMapping()
validateRecoveryCadenceWaveWaitAndReducedParity()
validatePacing('easy')
validatePacing('true')
validateFinalizerIdempotence()
validateRosterShellAndProtectedSourceContracts()

console.log(JSON.stringify({
  status: 'PASS',
  fixture: 'R3c authored dives',
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  speedRows,
  pacingRows,
  constants: {
    telegraphMs: DIVE_TELEGRAPH_MS,
    outboundMs: DIVE_OUTBOUND_MS,
    deadlineMs: DIVE_RESPONSE_DEADLINE_MS,
    returnMs: DIVE_RETURN_MS,
    hitLockMaxMs: HIT_LOCK_MAX_MS,
    demandFloorMs: ENGINE_DEMAND_FLOOR_MS,
    alienHeight: ALIEN_H,
  },
}, null, 2))
