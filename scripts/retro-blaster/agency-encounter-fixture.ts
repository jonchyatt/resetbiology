import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import {
  AGENCY_NOTES,
  MIC_CONFIDENCE_FLOOR,
  STIMULUS_ACK_ACCEPT_MAX_MS,
  agencyAckMatches,
  agencyActionPlan,
  agencyAnswerCorrect,
  beginAgencyEncounter,
  createInitialState,
  invalidateAgencyCueForLifecycle,
  pickAgencyPromptNote,
  tick,
  toViewState,
  type AgencyActionKind,
  type AgencyStimulusAck,
  type AgencyStimulusRequest,
  type EngineEvent,
  type EngineInput,
  type GameState,
  type ViewState,
} from '../../src/components/PitchDefender/retroBlasterEngine'
import { noteToFreq } from '../../src/components/PitchDefender/pitchMath'
import {
  applyRetroBlasterFamilyEvent,
  deferAgencyStimulusReceipt,
  flushAgencyStimulusReceiptAfterReveal,
  type DeferredAgencyAudioReceipt,
  type RetroBlasterFamilyStores,
} from '../../src/components/PitchDefender/RetroBlasterII'

const BASE_COMMIT = process.env.RETRO_PROTECTED_BASE || 'dbdc3e77ce8b9e945a685513128de4a8cb05c3e4'
const results: Array<{ name: string; status: 'PASS' | 'FAIL'; detail?: string }> = []

const baseInput: EngineInput = {
  inputMode: 'click',
  isListening: false,
  reducedMotion: true,
  pitch: null,
  isActive: true,
  memoryEpochMs: 0,
}

function run(name: string, check: () => void): void {
  try {
    check()
    results.push({ name, status: 'PASS' })
    console.log(`[PASS] ${name}`)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    results.push({ name, status: 'FAIL', detail })
    console.log(`[FAIL] ${name}: ${detail}`)
  }
}

function input(overrides: Partial<EngineInput> = {}): EngineInput {
  return { ...baseInput, ...overrides }
}

function agencyState(note: 'C4' | 'A4' = 'C4', gameId = `fixture:${note}`): GameState {
  const state = createInitialState('easy', [...AGENCY_NOTES], 1, gameId, null, 'agency-prototype')
  beginAgencyEncounter(state, note)
  return state
}

function eventOf<T extends EngineEvent['kind']>(events: EngineEvent[], kind: T): Extract<EngineEvent, { kind: T }> {
  const event = events.find(candidate => candidate.kind === kind)
  assert.ok(event, `expected ${kind} event`)
  return event as Extract<EngineEvent, { kind: T }>
}

function openCue(note: 'C4' | 'A4' = 'C4', inputMode: 'click' | 'mic' = 'click') {
  const result = tick(
    agencyState(note, `fixture:${note}:${inputMode}`),
    input({ inputMode, isListening: inputMode === 'mic' }),
    0,
    () => 0.5,
  )
  const request = eventOf(result.events, 'agencyStimulusRequest')
  return { state: result.state, request }
}

function validAck(request: AgencyStimulusRequest): AgencyStimulusAck {
  return {
    ...request,
    dispatched: true,
    dispatchedAtDirectorClockMs: request.requestedAtDirectorClockMs,
  }
}

function acceptCue(state: GameState, request: AgencyStimulusRequest, inputMode: 'click' | 'mic' = 'click') {
  return tick(
    state,
    input({
      inputMode,
      isListening: inputMode === 'mic',
      agencyStimulusAck: validAck(request),
    }),
    0,
    () => 0.5,
  )
}

function answerCommand(state: GameState, answeredNote: 'C4' | 'A4') {
  const agency = state.agency!
  return {
    kind: 'answer' as const,
    gameId: state.gameId,
    encounterId: agency.encounterId,
    promptId: agency.prompt.promptId,
    cueAttemptId: agency.prompt.cueAttemptId,
    answeredNote,
    inputMode: 'click' as const,
  }
}

function guideCommand(state: GameState) {
  const agency = state.agency!
  return {
    kind: 'guide' as const,
    gameId: state.gameId,
    encounterId: agency.encounterId,
    promptId: agency.prompt.promptId,
    cueAttemptId: agency.prompt.cueAttemptId,
  }
}

function replayCommand(state: GameState) {
  const agency = state.agency!
  return {
    kind: 'replay' as const,
    gameId: state.gameId,
    encounterId: agency.encounterId,
    promptId: agency.prompt.promptId,
    cueAttemptId: agency.prompt.cueAttemptId,
  }
}

function continueCommand(state: GameState, encounterId = state.agency!.encounterId) {
  return {
    kind: 'continue' as const,
    gameId: state.gameId,
    encounterId,
  }
}

function spendCommand(state: GameState, action: AgencyActionKind, overrides: Partial<{
  gameId: string
  encounterId: string
  decisionId: string
  chargeId: string
}> = {}) {
  const agency = state.agency!
  return {
    kind: 'spend' as const,
    gameId: overrides.gameId ?? state.gameId,
    encounterId: overrides.encounterId ?? agency.encounterId,
    decisionId: overrides.decisionId ?? agency.decisionId!,
    chargeId: overrides.chargeId ?? agency.charge!.chargeId,
    action,
  }
}

function micPitch(note: 'C4' | 'A4', confidence = 0.95) {
  return {
    note,
    frequency: noteToFreq(note),
    cents: 0,
    confidence,
    isActive: confidence >= MIC_CONFIDENCE_FLOOR,
  }
}

function micTick(state: GameState, pitch: EngineInput['pitch'], healthy = true, suppressed = false, dtMs = 50) {
  return tick(state, input({
    inputMode: 'mic',
    isListening: true,
    pitch,
    voiceTimeoutObservation: { healthy, heard: pitch?.isActive === true },
    agencyToneSuppressed: suppressed,
  }), dtMs, () => 0.5)
}

function stableView(view: ViewState) {
  return {
    phase: view.phase,
    hud: view.hud,
    aliens: view.aliens.map(alien => ({
      formationSlot: alien.formationSlot,
      x: alien.x,
      y: alien.y,
      alive: alien.alive,
      note: alien.note,
      hue: alien.hue,
      soul: alien.soul,
    })),
    agency: view.agency && {
      stage: view.agency.stage,
      prompt: {
        note: view.agency.prompt.note,
        assisted: view.agency.prompt.assisted,
        revealNote: view.agency.prompt.revealNote,
        gradeRecorded: view.agency.prompt.gradeRecorded,
        responseOpenedAtDirectorClockMs: view.agency.prompt.responseOpenedAtDirectorClockMs,
        stimulusRequest: view.agency.prompt.stimulusRequest,
      },
      charge: view.agency.charge,
      decisionId: view.agency.decisionId,
      resolution: view.agency.resolution,
    },
  }
}

run('classic remains the default and does not enter agency', () => {
  const classic = createInitialState('easy', ['C4'], 1, 'fixture:classic')
  assert.equal(classic.playStyle, undefined)
  assert.equal(classic.agency, undefined)
  const result = tick(classic, input(), 0, () => 0.5)
  assert.equal(result.events.some(event => event.kind === 'agencyStimulusRequest'), false)
})

run('agency construction is exactly C/A with three authored ships and sanitized views', () => {
  const c = agencyState('C4', 'fixture:view:c')
  const a = agencyState('A4', 'fixture:view:a')
  assert.equal(c.aliens.length, 3)
  assert.deepEqual(c.aliens.map(alien => alien.formationSlot).sort((x, y) => x - y), [6, 7, 10])
  assert.deepEqual([...new Set(c.aliens.map(alien => alien.note))].sort(), ['A4', 'C4'])
  assert.deepEqual(c.agency?.blockerAlienIds, ['fixture:view:c:agency:blocker:0', 'fixture:view:c:agency:blocker:1'])
  assert.equal(c.agency?.prompt.note, 'C4')
  assert.equal(a.agency?.prompt.note, 'A4')
  const cView = toViewState(c, 'click')
  const aView = toViewState(a, 'click')
  assert.equal(cView.agency?.prompt.note, '?')
  assert.equal(aView.agency?.prompt.note, '?')
  assert.equal(cView.agency?.prompt.stimulusRequest, null)
  assert.equal(aView.agency?.prompt.stimulusRequest, null)
  assert.ok(cView.aliens.every(alien => alien.note === '?' && alien.soul.note === '?'))
  assert.deepEqual(stableView(cView), stableView(aView))
})

run('agency prompt selection is injectable and covers both C/A outcomes', () => {
  assert.equal(pickAgencyPromptNote(() => 0), 'C4')
  assert.equal(pickAgencyPromptNote(() => 0.999999), 'A4')
})

run('agency acknowledgement requires the complete live tuple and bounded dispatch', () => {
  const { request } = openCue('C4')
  assert.equal(agencyAckMatches(request, validAck(request)), true)
  assert.equal(agencyAckMatches(request, { ...validAck(request), promptId: `${request.promptId}:other` }), false)
  assert.equal(agencyAckMatches(request, { ...validAck(request), cueAttemptId: request.cueAttemptId + 1 }), false)
  const cross = tick(
    openCue('C4').state,
    input({ agencyStimulusAck: { ...validAck(request), encounterId: `${request.encounterId}:other` } }),
    0,
    () => 0.5,
  )
  assert.equal(cross.state.agency?.stage, 'awaiting-ack')

  const negativeOpen = openCue('C4')
  const negative = tick(
    negativeOpen.state,
    input({ agencyStimulusAck: { ...validAck(negativeOpen.request), dispatched: false } }),
    0,
    () => 0.5,
  )
  assert.equal(negative.state.agency?.stage, 'awaiting-replay')
  assert.equal(negative.state.agency?.prompt.assisted, true)

  const skewOpen = openCue('C4')
  const skew = tick(
    skewOpen.state,
    input({ agencyStimulusAck: { ...validAck(skewOpen.request), dispatchedAtDirectorClockMs: skewOpen.request.requestedAtDirectorClockMs + 1 } }),
    0,
    () => 0.5,
  )
  assert.equal(skew.state.agency?.stage, 'awaiting-replay')

  const staleOpen = openCue('C4')
  const late = tick(staleOpen.state, input(), 50, () => 0.5)
  const stale = tick(late.state, input({ agencyStimulusAck: validAck(staleOpen.request) }), 50, () => 0.5)
  assert.equal(stale.state.agency?.stage, 'awaiting-replay')
  assert.equal(stale.state.agency?.prompt.assisted, true)

  const timeoutOpen = openCue('C4')
  let timeoutState = timeoutOpen.state
  for (let i = 0; i < 21; i++) timeoutState = tick(timeoutState, input(), 50, () => 0.5).state
  assert.equal(timeoutState.agency?.stage, 'awaiting-replay')

  const lifecycleOpen = openCue('C4')
  assert.equal(invalidateAgencyCueForLifecycle(lifecycleOpen.state), true)
  assert.equal(lifecycleOpen.state.agency?.stage, 'awaiting-replay')
  const postBlurAck = tick(lifecycleOpen.state, input({ agencyStimulusAck: validAck(lifecycleOpen.request) }), 0, () => 0.5)
  assert.equal(postBlurAck.state.agency?.stage, 'awaiting-replay')
  assert.ok(STIMULUS_ACK_ACCEPT_MAX_MS > 0)
})

run('click grading names the heard prompt, caps at one grade, and guided recharge is assisted', () => {
  const opened = openCue('C4')
  const recognized = acceptCue(opened.state, opened.request)
  assert.equal(recognized.state.agency?.stage, 'recognizing')
  const wrong = tick(recognized.state, input({ pendingAgencyCommand: answerCommand(recognized.state, 'A4') }), 0, () => 0.5)
  const wrongGrade = eventOf(wrong.events, 'grade')
  assert.deepEqual(wrongGrade, { kind: 'grade', note: 'C4', correct: false, latencyMs: 2000, inputMode: 'click' })
  assert.equal(wrong.state.agency?.stage, 'awaiting-replay')
  assert.equal(wrong.state.cityHealth, 5)
  assert.equal(wrong.state.score, 0)
  const pausedWrong = tick(wrong.state, input({ isActive: false }), 10_000, () => 0.5)
  assert.equal(pausedWrong.state.wrongTimer, wrong.state.wrongTimer)
  assert.equal(pausedWrong.state.wrongMessage, wrong.state.wrongMessage)
  pausedWrong.state.flashTimer = 0.5
  let expiredWrong = pausedWrong.state
  for (let i = 0; i < 41; i++) expiredWrong = tick(expiredWrong, input(), 50, () => 0.5).state
  assert.equal(expiredWrong.wrongTimer, 0)
  assert.equal(expiredWrong.wrongMessage, '')
  assert.equal(expiredWrong.flashTimer, 0)
  const repeatedWrong = tick(wrong.state, input({ pendingAgencyCommand: answerCommand(wrong.state, 'A4') }), 0, () => 0.5)
  assert.equal(repeatedWrong.events.some(event => event.kind === 'grade'), false)

  const guided = tick(wrong.state, input({ pendingAgencyCommand: guideCommand(wrong.state) }), 0, () => 0.5)
  assert.equal(guided.state.agency?.stage, 'recognizing')
  assert.equal(guided.state.agency?.prompt.note, 'C4')
  assert.equal(toViewState(guided.state, 'click').agency?.prompt.note, 'C4')
  const charged = tick(guided.state, input({ pendingAgencyCommand: answerCommand(guided.state, 'C4') }), 0, () => 0.5)
  assert.equal(charged.state.agency?.stage, 'charged')
  assert.equal(charged.state.agency?.charge?.assisted, true)
  assert.equal(charged.events.some(event => event.kind === 'grade'), false)
  const repeated = tick(charged.state, input({ pendingAgencyCommand: answerCommand(guided.state, 'C4') }), 0, () => 0.5)
  assert.equal(repeated.events.some(event => event.kind === 'grade'), false)
  assert.equal(repeated.state.agency?.charge?.chargeId, charged.state.agency?.charge?.chargeId)

  const aOpened = openCue('A4')
  const aRecognized = acceptCue(aOpened.state, aOpened.request)
  const aWrong = tick(aRecognized.state, input({ pendingAgencyCommand: answerCommand(aRecognized.state, 'C4') }), 0, () => 0.5)
  assert.equal(eventOf(aWrong.events, 'grade').note, 'A4')
  assert.equal(agencyAnswerCorrect(aRecognized.state.agency!.prompt, 'A4'), true)
  assert.equal(agencyAnswerCorrect(aRecognized.state.agency!.prompt, 'C4'), false)
})

run('unassisted correct click earns one charge and one EAR grade', () => {
  const opened = openCue('C4')
  const recognized = acceptCue(opened.state, opened.request)
  const charged = tick(recognized.state, input({ pendingAgencyCommand: answerCommand(recognized.state, 'C4') }), 0, () => 0.5)
  assert.equal(charged.state.agency?.charge?.assisted, false)
  assert.equal(charged.events.filter(event => event.kind === 'grade').length, 1)
  assert.equal(charged.events.find(event => event.kind === 'grade')?.inputMode, 'click')
})

run('mic path uses healthy fresh input, suppresses cue bleed, and has no deadline', () => {
  const opened = openCue('C4', 'mic')
  let state = acceptCue(opened.state, opened.request, 'mic').state
  const match = micPitch('C4')
  state = micTick(state, match, true, true).state
  assert.equal(state.agency?.stage, 'recognizing')
  assert.equal(state.chargeProgress, 0)

  for (let i = 0; i < 5; i++) state = micTick(state, match).state
  assert.equal(state.agency?.stage, 'recognizing')
  assert.equal(state.agency?.charge, null)
  state = micTick(state, null).state
  state = micTick(state, micPitch('C4', 0.2)).state
  assert.equal(state.agency?.charge, null)
  state = micTick(state, match, false).state
  assert.equal(state.chargeProgress, 0)
  state = micTick(state, micPitch('A4')).state
  assert.equal(state.chargeProgress, 0)

  const noDeadline = micTick(state, null, true, false, 10_000_000)
  assert.equal(noDeadline.state.agency?.stage, 'recognizing')
  assert.equal(noDeadline.state.cityHealth, 5)
  assert.equal(noDeadline.events.some(event => event.kind === 'grade'), false)

  const healthyOpened = openCue('C4', 'mic')
  state = acceptCue(healthyOpened.state, healthyOpened.request, 'mic').state
  state = micTick(state, match, true, true).state
  const micGradeEvents: EngineEvent[] = []
  let finalMicTick = micTick(state, match)
  state = finalMicTick.state
  micGradeEvents.push(...finalMicTick.events.filter(event => event.kind === 'grade'))
  for (let i = 0; i < 6; i++) {
    finalMicTick = micTick(state, match)
    state = finalMicTick.state
    micGradeEvents.push(...finalMicTick.events.filter(event => event.kind === 'grade'))
  }
  for (let i = 0; i < 3; i++) {
    finalMicTick = micTick(state, match)
    state = finalMicTick.state
    micGradeEvents.push(...finalMicTick.events.filter(event => event.kind === 'grade'))
  }
  assert.equal(state.agency?.stage, 'charged')
  assert.equal(state.agency?.charge?.assisted, false)
  assert.equal(micGradeEvents.length, 1)
  assert.equal(micGradeEvents[0]?.inputMode, 'mic')
})

run('agency mic charge requires an uninterrupted eligible hold after silence or low confidence', () => {
  const opened = openCue('C4', 'mic')
  const recognized = acceptCue(opened.state, opened.request, 'mic')
  const match = micPitch('C4')
  let state = recognized.state

  state = micTick(state, match).state
  for (let i = 0; i < 10; i++) state = micTick(state, null).state
  assert.equal(state.matchStartAt, 0)
  assert.equal(state.chargeProgress, 0)
  state = micTick(state, match).state
  assert.equal(state.agency?.charge, null)
  assert.equal(state.chargeProgress, 0)
  for (let i = 0; i < 6; i++) state = micTick(state, match).state
  assert.equal(state.agency?.stage, 'charged')
  const chargeId = state.agency?.charge?.chargeId
  const repeated = micTick(state, match)
  assert.equal(repeated.events.length, 0)
  assert.equal(repeated.state.agency?.charge?.chargeId, chargeId)

  const lowOpened = openCue('C4', 'mic')
  let lowState = acceptCue(lowOpened.state, lowOpened.request, 'mic').state
  const lowConfidence = { ...match, confidence: MIC_CONFIDENCE_FLOOR - 0.01, isActive: true }
  lowState = micTick(lowState, match).state
  for (let i = 0; i < 10; i++) lowState = micTick(lowState, lowConfidence).state
  assert.equal(lowState.matchStartAt, 0)
  assert.equal(lowState.chargeProgress, 0)
  lowState = micTick(lowState, match).state
  assert.equal(lowState.agency?.stage, 'recognizing')
  assert.equal(lowState.agency?.charge, null)
})

run('agency mic rejects nonfinite and nonpositive pitch values before cents math, then recovers finitely', () => {
  const opened = openCue('C4', 'mic')
  let state = acceptCue(opened.state, opened.request, 'mic').state
  const match = micPitch('C4')
  const invalidPitches: NonNullable<EngineInput['pitch']>[] = [
    { ...match, frequency: Number.NaN },
    { ...match, frequency: Number.POSITIVE_INFINITY },
    { ...match, confidence: Number.NaN },
    { ...match, confidence: Number.POSITIVE_INFINITY },
    { ...match, frequency: 0 },
  ]
  for (const invalidPitch of invalidPitches) {
    state = micTick(state, match).state
    state = micTick(state, invalidPitch).state
    assert.equal(state.matchStartAt, 0)
    assert.equal(state.chargeProgress, 0)
    assert.equal(state.agency?.charge, null)
  }

  let gradeCount = 0
  for (let i = 0; i < 7; i++) {
    const result = micTick(state, match)
    state = result.state
    gradeCount += result.events.filter(event => event.kind === 'grade').length
  }
  assert.equal(state.agency?.stage, 'charged')
  assert.equal(gradeCount, 1)
  const chargeId = state.agency?.charge?.chargeId
  const repeated = micTick(state, match)
  assert.equal(repeated.events.length, 0)
  assert.equal(repeated.state.agency?.charge?.chargeId, chargeId)
})

run('paused ticks preserve agency clocks, holds, actions, score, and shields', () => {
  const opened = openCue('C4')
  const before = opened.state
  const paused = tick(before, input({ isActive: false, agencyStimulusAck: validAck(opened.request) }), 10_000, () => 0.5)
  assert.equal(paused.events.length, 0)
  assert.equal(paused.state.clockMs, before.clockMs)
  assert.equal(paused.state.directorClockMs, before.directorClockMs)
  assert.equal(paused.state.agency?.stage, 'awaiting-ack')
  assert.equal(paused.state.score, before.score)
  assert.equal(paused.state.cityHealth, before.cityHealth)
  assert.notEqual(paused.state.agency, before.agency)
  assert.notEqual(paused.state.agency?.prompt, before.agency?.prompt)
  assert.notEqual(paused.state.agency?.blockerAlienIds, before.agency?.blockerAlienIds)
})

function chargedState(inputMode: 'click' | 'mic' = 'click') {
  const opened = openCue('C4', inputMode)
  const recognized = acceptCue(opened.state, opened.request, inputMode)
  if (inputMode === 'mic') {
    let state = recognized.state
    const pitch = micPitch('C4')
    state = micTick(state, pitch, true, true).state
    for (let i = 0; i < 7; i++) state = micTick(state, pitch).state
    return state
  }
  return tick(recognized.state, input({ pendingAgencyCommand: answerCommand(recognized.state, 'C4') }), 0, () => 0.5).state
}

run('agency actions require exact charge identity and produce opposing payoff vectors without grades', () => {
  const interceptState = chargedState()
  const interceptSpend = spendCommand(interceptState, 'intercept')
  assert.deepEqual(agencyActionPlan(interceptState, 'intercept'), {
    action: 'intercept',
    destroyedAlienIds: [interceptState.agency!.threatAlienId],
    escapedAlienIds: [...interceptState.agency!.blockerAlienIds],
    scoreDelta: 100,
    shieldDelta: 0,
  })
  const inert = tick(interceptState, input({ pendingAgencyCommand: spendCommand(interceptState, 'intercept', { chargeId: 'stale-charge' }) }), 0, () => 0.5)
  assert.equal(inert.state.agency?.stage, 'charged')
  assert.equal(inert.state.score, 0)
  assert.equal(inert.events.length, 0)

  const intercepted = tick(interceptState, input({ pendingAgencyCommand: interceptSpend }), 0, () => 0.5)
  assert.equal(intercepted.state.agency?.stage, 'resolved')
  assert.equal(intercepted.state.score, 100)
  assert.equal(intercepted.state.cityHealth, 5)
  assert.deepEqual(intercepted.state.agency?.resolution?.destroyedAlienIds, [interceptState.agency!.threatAlienId])
  assert.deepEqual(intercepted.state.agency?.resolution?.escapedAlienIds, [...interceptState.agency!.blockerAlienIds])
  assert.equal(intercepted.events.some(event => event.kind === 'grade'), false)
  const repeated = tick(intercepted.state, input({ pendingAgencyCommand: interceptSpend }), 0, () => 0.5)
  assert.equal(repeated.events.length, 0)
  assert.equal(repeated.state.score, 100)

  const chainState = chargedState()
  const chain = tick(chainState, input({ pendingAgencyCommand: spendCommand(chainState, 'chain-break') }), 0, () => 0.5)
  assert.equal(chain.state.score, 250)
  assert.equal(chain.state.cityHealth, 4)
  assert.deepEqual(chain.state.agency?.resolution?.destroyedAlienIds, [...chainState.agency!.blockerAlienIds])
  assert.deepEqual(chain.state.agency?.resolution?.escapedAlienIds, [chainState.agency!.threatAlienId])
  assert.equal(chain.events.some(event => event.kind === 'grade'), false)
  assert.equal(chain.state.agency?.stage, 'resolved')
})

run('agency rejects click commands in mic mode and unknown runtime actions', () => {
  const opened = openCue('C4', 'mic')
  const recognized = acceptCue(opened.state, opened.request, 'mic')
  const clickInMic = tick(recognized.state, input({
    inputMode: 'mic',
    isListening: true,
    pendingAgencyCommand: answerCommand(recognized.state, 'C4'),
    voiceTimeoutObservation: { healthy: false, heard: false },
  }), 0, () => 0.5)
  assert.equal(clickInMic.state.agency?.stage, 'recognizing')
  assert.equal(clickInMic.events.some(event => event.kind === 'grade'), false)
  assert.equal(clickInMic.state.cityHealth, 5)

  const charged = chargedState()
  const unknownAction = {
    ...spendCommand(charged, 'intercept'),
    action: 'not-a-real-action',
  } as unknown as EngineInput['pendingAgencyCommand']
  const inert = tick(charged, input({ pendingAgencyCommand: unknownAction }), 0, () => 0.5)
  assert.equal(inert.state.agency?.stage, 'charged')
  assert.equal(inert.state.agency?.charge?.chargeId, charged.agency?.charge?.chargeId)
  assert.equal(inert.state.score, 0)
  assert.equal(inert.events.length, 0)
})

run('agency action effects advance while active and settle without classic mutations', () => {
  const charged = chargedState()
  const spent = tick(charged, input({ pendingAgencyCommand: spendCommand(charged, 'chain-break') }), 0, () => 0.5)
  assert.ok(spent.state.lasers.length > 0)
  assert.ok(spent.state.particles.length > 0)

  const paused = tick(spent.state, input({ isActive: false }), 10_000, () => 0.5)
  assert.deepEqual(paused.state.lasers, spent.state.lasers)
  assert.deepEqual(paused.state.particles, spent.state.particles)
  assert.deepEqual(paused.state.aliens.map(alien => alien.hitTimer), spent.state.aliens.map(alien => alien.hitTimer))

  const advanced = tick(spent.state, input(), 50, () => 0.5)
  assert.ok(advanced.state.lasers[0]!.y < spent.state.lasers[0]!.y)
  assert.ok(advanced.state.particles[0]!.life < spent.state.particles[0]!.life)
  assert.equal(advanced.events.some(event => event.kind === 'waveComplete' || event.kind === 'unlock' || event.kind === 'grade'), false)

  let settled = advanced.state
  for (let i = 0; i < 20; i++) settled = tick(settled, input(), 50, () => 0.5).state
  assert.equal(settled.lasers.length, 0)
  assert.equal(settled.particles.length, 0)
  assert.equal(settled.aliens.every(alien => alien.hitTimer === 0), true)
})

run('resolved agency encounters continue with carried score/shields and new identities; zero shields end once', () => {
  const charged = chargedState()
  const oldEncounterId = charged.agency!.encounterId
  const oldPromptId = charged.agency!.prompt.promptId
  const oldChargeId = charged.agency!.charge!.chargeId
  const spend = spendCommand(charged, 'intercept')
  const resolved = tick(charged, input({ pendingAgencyCommand: spend }), 0, () => 0.5)

  const rejected = tick(resolved.state, input({
    pendingAgencyCommand: continueCommand(resolved.state, `${oldEncounterId}:stale`),
  }), 0, () => 0.5)
  assert.equal(rejected.state.agency?.encounterId, oldEncounterId)
  assert.equal(rejected.state.agency?.stage, 'resolved')

  const next = tick(resolved.state, input({ pendingAgencyCommand: continueCommand(resolved.state) }), 0, () => 0.999999)
  assert.equal(next.state.agency?.stage, 'awaiting-cue')
  assert.notEqual(next.state.agency?.encounterId, oldEncounterId)
  assert.notEqual(next.state.agency?.prompt.promptId, oldPromptId)
  assert.equal(next.state.agency?.prompt.note, 'A4')
  assert.equal(next.state.agency?.charge, null)
  assert.equal(next.state.score, 100)
  assert.equal(next.state.cityHealth, 5)

  const nextOpened = tick(next.state, input(), 0, () => 0.5)
  const nextRequest = eventOf(nextOpened.events, 'agencyStimulusRequest')
  const nextRecognized = acceptCue(nextOpened.state, nextRequest)
  const nextCharged = tick(nextRecognized.state, input({ pendingAgencyCommand: answerCommand(nextRecognized.state, 'A4') }), 0, () => 0.5)
  assert.equal(nextCharged.state.agency?.stage, 'charged')
  assert.notEqual(nextCharged.state.agency?.charge?.chargeId, oldChargeId)

  const lethal = chargedState()
  lethal.cityHealth = 1
  const lethalSpend = spendCommand(lethal, 'chain-break')
  const over = tick(lethal, input({ pendingAgencyCommand: lethalSpend }), 0, () => 0.5)
  assert.equal(over.state.phase, 'game_over')
  assert.equal(over.events.filter(event => event.kind === 'gameOver').length, 1)
  const after = tick(over.state, input({ pendingAgencyCommand: lethalSpend }), 50, () => 0.5)
  assert.equal(after.state.phase, 'game_over')
  assert.equal(after.events.filter(event => event.kind === 'gameOver').length, 0)
})

run('agency stimulus receipts stay out of pre-answer DOM until guidance or resolution', () => {
  const pending: { current: DeferredAgencyAudioReceipt | null } = { current: null }
  const published: DeferredAgencyAudioReceipt[] = []
  const receipt: DeferredAgencyAudioReceipt = {
    kind: 'piano', note: 'C4', guard: 'agency-stimulus', requestId: 'agency:cue:0',
    gameId: 'fixture:receipt', attackId: null, ceremonyId: null, terminalAlreadyRecorded: false,
  }
  deferAgencyStimulusReceipt(pending, receipt, true)
  assert.equal(published.length, 0)
  assert.equal(pending.current?.note, 'C4')
  assert.equal(flushAgencyStimulusReceiptAfterReveal(pending, value => published.push(value), false), false)
  assert.equal(published.length, 0)
  assert.equal(flushAgencyStimulusReceiptAfterReveal(pending, value => published.push(value), true), true)
  assert.deepEqual(published, [receipt])
})

run('agency grades route to the existing EAR and VOICE stores only', () => {
  const stores: RetroBlasterFamilyStores = { voice: {}, ear: {} }
  const clickGrade: EngineEvent = { kind: 'grade', note: 'C4', correct: true, latencyMs: 1, inputMode: 'click' }
  const micGrade: EngineEvent = { kind: 'grade', note: 'A4', correct: true, latencyMs: 1, inputMode: 'mic' }
  assert.equal(applyRetroBlasterFamilyEvent(clickGrade, 'click', stores), true)
  assert.ok(stores.ear.C4)
  assert.equal(stores.voice.C4, undefined)
  assert.equal(applyRetroBlasterFamilyEvent(micGrade, 'mic', stores), true)
  assert.ok(stores.voice.A4)
  assert.equal(stores.ear.A4, undefined)
})

run('protected renderer/audio/detection/family files remain source-content-identical to the pinned source', () => {
  const protectedPaths = [
    'src/components/PitchDefender/retroBlasterRenderer.ts',
    'src/components/PitchDefender/retroBlasterPlacement.ts',
    'src/components/PitchDefender/retroBlasterCurriculum.ts',
    'src/components/PitchDefender/usePitchDetection.ts',
    'src/components/PitchDefender/audioEngine.ts',
    'src/components/PitchDefender/types.ts',
    'src/lib/fsrsFamily.ts',
    'src/components/PitchDefender/RetroBlaster.tsx',
  ]
  const normalizeSourceContent = (content: Buffer) => content.toString('utf8').replace(/\r\n/g, '\n')
  for (const path of protectedPaths) {
    const expected = execFileSync('git', ['show', `${BASE_COMMIT}:${path}`])
    const actual = readFileSync(path)
    assert.equal(normalizeSourceContent(actual), normalizeSourceContent(expected), `${path} source content differs from ${BASE_COMMIT}`)
  }
})

const failed = results.filter(result => result.status === 'FAIL')
console.log(JSON.stringify({ status: failed.length === 0 ? 'PASS' : 'FAIL', results }, null, 2))
if (failed.length > 0) process.exitCode = 1
