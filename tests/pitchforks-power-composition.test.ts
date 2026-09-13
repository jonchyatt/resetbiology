import assert from 'node:assert/strict'

import {
  acceptPitchforksBellPowerActivationNote,
  acceptPitchforksBellPowerCombatResponse,
  acknowledgePitchforksBellPowerWaveRelease,
  cancelPitchforksBellPowerActivation,
  createPitchforksBellPowerState,
  startPitchforksBellPowerActivation,
  type PitchforksBellPowerCombatResponse,
  type PitchforksBellPowerConfig,
} from '../src/components/PitchDefender/pitchforksBellPower'
import {
  acceptPitchforksRainCombatResponse,
  createRainState,
  MAX_RAIN_STEP_MS,
  RAINCALL_REQUIRED_RESPONSES,
  stepRain,
  type PitchforksRainCombatResponse,
} from '../src/components/PitchDefender/pitchforksRainEcology'

/** Pure helper-composition harness: no mounted game, singing, learning, tine, or persistence path. */

let checks = 0
const check = (run: () => void): void => {
  run()
  checks += 1
}

const bellConfig = (runId: string): PitchforksBellPowerConfig => ({
  runId,
  requiredResponses: 3,
  admittedNotes: ['D4', 'E4'],
  taughtPair: ['D4', 'E4'],
})

const combatEvent = (
  eventId: string,
  overrides: Record<string, unknown> = {},
): PitchforksBellPowerCombatResponse & PitchforksRainCombatResponse => Object.freeze({
  runId: 'run-composition-1',
  eventId,
  note: 'D4',
  lane: 'voice',
  source: 'combat',
  correct: true,
  ...overrides,
}) as PitchforksBellPowerCombatResponse & PitchforksRainCombatResponse

check(() => {
  let bell = createPitchforksBellPowerState(bellConfig('run-composition-1'))
  let rain = createRainState()

  assert.equal(Object.isFrozen(bell), true)
  assert.equal(Object.isFrozen(bell.consumedEventIds), true)

  for (let index = 1; index <= RAINCALL_REQUIRED_RESPONSES; index += 1) {
    const event = combatEvent(`shared-combat-${index}`, { note: index % 2 === 0 ? 'E4' : 'D4' })
    const eventBefore = JSON.stringify(event)
    const bellBefore = JSON.stringify(bell)
    const rainBefore = JSON.stringify(rain)
    const bellDecision = acceptPitchforksBellPowerCombatResponse(bell, event)
    const rainDecision = acceptPitchforksRainCombatResponse(rain, event)

    assert.equal(JSON.stringify(event), eventBefore)
    assert.equal(JSON.stringify(bell), bellBefore)
    assert.equal(JSON.stringify(rain), rainBefore)
    assert.equal(bellDecision.accepted, true)
    assert.equal(rainDecision.accepted, true)
    assert.equal(bellDecision.charged, index <= 3)
    assert.equal(rainDecision.charged, true)
    bell = bellDecision.state
    rain = rainDecision.state

    assert.equal(bell.charge, Math.min(index, 3))
    assert.equal(rain.charge, index)
    if (index === 3) {
      assert.equal(bell.phase, 'ready')
      assert.equal(rain.phase, 'charging')
    }
  }

  assert.equal(bell.phase, 'ready')
  assert.equal(bell.charge, 3)
  assert.equal(rain.phase, 'ready')
  assert.equal(rain.charge, 4)
  assert.deepEqual(bell.consumedEventIds, rain.consumedEventIds)

  const rainBeforeBellSpend = rain
  const bellReadyCharge = bell.charge
  const rainReadyCharge = rain.charge

  let activation = startPitchforksBellPowerActivation(bell).state
  const wrongNote = acceptPitchforksBellPowerActivationNote(activation, {
    runId: bell.runId,
    eventId: 'bell-wrong-note',
    note: 'F4',
    confirmed: true,
  })
  assert.equal(wrongNote.accepted, false)
  assert.equal(wrongNote.reason, 'wrong-note')
  assert.equal(wrongNote.state.phase, 'ready')
  assert.equal(wrongNote.state.charge, bellReadyCharge)
  assert.deepEqual(wrongNote.state.activationNotes, [])
  assert.equal(rain.charge, rainReadyCharge)
  assert.deepEqual(rain, rainBeforeBellSpend)

  activation = startPitchforksBellPowerActivation(wrongNote.state).state
  activation = acceptPitchforksBellPowerActivationNote(activation, {
    runId: bell.runId,
    eventId: 'bell-cancelled-first-note',
    note: 'D4',
    confirmed: true,
  }).state
  const cancelled = cancelPitchforksBellPowerActivation(activation)
  assert.equal(cancelled.accepted, true)
  assert.equal(cancelled.reason, 'cancelled')
  assert.equal(cancelled.state.phase, 'ready')
  assert.equal(cancelled.state.charge, bellReadyCharge)
  assert.deepEqual(cancelled.state.activationNotes, [])
  assert.equal(rain.charge, rainReadyCharge)
  assert.deepEqual(rain, rainBeforeBellSpend)

  activation = startPitchforksBellPowerActivation(cancelled.state).state
  activation = acceptPitchforksBellPowerActivationNote(activation, {
    runId: bell.runId,
    eventId: 'bell-activation-1',
    note: 'D4',
    confirmed: true,
  }).state
  const completed = acceptPitchforksBellPowerActivationNote(activation, {
    runId: bell.runId,
    eventId: 'bell-activation-2',
    note: 'E4',
    confirmed: true,
  })
  assert.equal(completed.completed, true)
  assert.ok(completed.receipt)
  const bellReceipt = completed.receipt
  const spent = acknowledgePitchforksBellPowerWaveRelease(completed.state, {
    runId: bell.runId,
    receiptId: bellReceipt?.receiptId ?? '',
    released: true,
  })
  assert.equal(spent.reason, 'acknowledged')
  assert.equal(spent.spent, true)
  assert.equal(spent.state.charge, 0)
  assert.equal(spent.state.phase, 'charging')
  assert.deepEqual(rain, rainBeforeBellSpend)

  const bellBeforeRain = JSON.stringify(spent.state)
  const tapped = stepRain(rain, 250, { mode: 'normal', activated: true })
  assert.equal(tapped.phase, 'gutter_fill')
  assert.equal(tapped.charge, 0)
  assert.deepEqual(rain, rainBeforeBellSpend)
  assert.equal(JSON.stringify(spent.state), bellBeforeRain)

  let cycled = tapped
  let steps = 0
  while (cycled.cycleID === rainBeforeBellSpend.cycleID) {
    cycled = stepRain(cycled, MAX_RAIN_STEP_MS, { mode: 'normal' })
    assert.equal(JSON.stringify(spent.state), bellBeforeRain)
    steps += 1
    assert.ok(steps < 100)
  }
  assert.equal(cycled.phase, 'charging')
  assert.equal(cycled.charge, 0)
  assert.deepEqual(cycled.recentTransitions.map(({ source, target }) => [source, target]), [
    ['charging', 'ready'],
    ['ready', 'gutter_fill'],
    ['gutter_fill', 'gargoyle_release'],
    ['gargoyle_release', 'raining'],
    ['raining', 'cooldown'],
    ['cooldown', 'charging'],
  ])
})

check(() => {
  let bell = createPitchforksBellPowerState(bellConfig('run-invalid'))
  let rain = createRainState()
  const valid = combatEvent('duplicate-event', { runId: 'run-invalid' })
  bell = acceptPitchforksBellPowerCombatResponse(bell, valid).state
  rain = acceptPitchforksRainCombatResponse(rain, valid).state

  const duplicateBell = acceptPitchforksBellPowerCombatResponse(bell, valid)
  const duplicateRain = acceptPitchforksRainCombatResponse(rain, valid)
  assert.equal(duplicateBell.reason, 'duplicate-event')
  assert.equal(duplicateRain.reason, 'duplicate-event')
  assert.equal(duplicateBell.charged, false)
  assert.equal(duplicateRain.charged, false)
  assert.strictEqual(duplicateBell.state, bell)
  assert.strictEqual(duplicateRain.state, rain)

  const invalidCases: Array<[string, Record<string, unknown>, string, string]> = [
    ['wrong', { correct: false }, 'not-correct', 'not-correct'],
    ['demo', { demo: true }, 'not-correct', 'not-correct'],
    ['simulated', { simulated: true }, 'not-correct', 'not-correct'],
    ['ear', { lane: 'ear', inputMode: 'ear', ear: true }, 'not-normal-voice', 'not-normal-voice'],
  ]
  for (const [eventId, overrides, bellReason, rainReason] of invalidCases) {
    const event = combatEvent(eventId, { runId: 'run-invalid', ...overrides })
    const bellBefore = bell.charge
    const rainBefore = rain.charge
    const bellDecision = acceptPitchforksBellPowerCombatResponse(
      bell,
      event as unknown as PitchforksBellPowerCombatResponse,
    )
    const rainDecision = acceptPitchforksRainCombatResponse(
      rain,
      event as unknown as PitchforksRainCombatResponse,
    )
    assert.equal(bellDecision.reason, bellReason)
    assert.equal(rainDecision.reason, rainReason)
    assert.equal(bellDecision.accepted, false)
    assert.equal(rainDecision.accepted, false)
    assert.equal(bellDecision.charged, false)
    assert.equal(rainDecision.charged, false)
    assert.equal(bellDecision.state.charge, bellBefore)
    assert.equal(rainDecision.state.charge, rainBefore)
    bell = bellDecision.state
    rain = rainDecision.state
  }

  assert.equal(bell.charge, 1)
  assert.equal(rain.charge, 1)
})

check(() => {
  // Pure helper new-run isolation only; mounted quit/level-end reset and its separate lifecycle gate are not exercised here.
  const oldEvent = combatEvent('same-event-id', { runId: 'run-old' })
  const oldBell = acceptPitchforksBellPowerCombatResponse(
    createPitchforksBellPowerState(bellConfig('run-old')),
    oldEvent as unknown as PitchforksBellPowerCombatResponse,
  ).state
  const oldRain = acceptPitchforksRainCombatResponse(createRainState(), oldEvent).state
  assert.equal(oldBell.charge, 1)
  assert.equal(oldRain.charge, 1)

  const freshBell = createPitchforksBellPowerState(bellConfig('run-new'))
  const freshRain = createRainState()
  assert.equal(freshBell.charge, 0)
  assert.equal(freshRain.charge, 0)

  const staleBell = acceptPitchforksBellPowerCombatResponse(freshBell, oldEvent)
  assert.equal(staleBell.reason, 'stale-run')
  assert.equal(staleBell.state.charge, 0)
  assert.strictEqual(staleBell.state, freshBell)

  const freshEvent = combatEvent('same-event-id', { runId: 'run-new' })
  const freshBellDecision = acceptPitchforksBellPowerCombatResponse(freshBell, freshEvent)
  const freshRainDecision = acceptPitchforksRainCombatResponse(freshRain, freshEvent)
  assert.equal(freshBellDecision.accepted, true)
  assert.equal(freshRainDecision.accepted, true)
  assert.equal(freshBellDecision.state.charge, 1)
  assert.equal(freshRainDecision.state.charge, 1)
  assert.deepEqual(freshBellDecision.state.consumedEventIds, ['same-event-id'])
  assert.deepEqual(freshRainDecision.state.consumedEventIds, ['same-event-id'])
  assert.equal(oldBell.charge, 1)
  assert.equal(oldRain.charge, 1)
  assert.equal(JSON.stringify(oldEvent), JSON.stringify(combatEvent('same-event-id', { runId: 'run-old' })))
  assert.equal(JSON.stringify(freshEvent), JSON.stringify(combatEvent('same-event-id', { runId: 'run-new' })))
})

console.log(`pitchforks power composition pure helpers: ${checks}/${checks} PASS (harness only; fresh-state case is pure new-run isolation, not mounted quit/level-end proof; not mounted normal integration or physical singing)`)
