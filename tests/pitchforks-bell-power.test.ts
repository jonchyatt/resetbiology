import assert from 'node:assert/strict'

import {
  acceptPitchforksBellPowerActivationNote,
  acceptPitchforksBellPowerCombatResponse,
  acknowledgePitchforksBellPowerWaveRelease,
  cancelPitchforksBellPowerActivation,
  createPitchforksBellPowerState,
  startPitchforksBellPowerActivation,
  type PitchforksBellPowerConfig,
  type PitchforksBellPowerState,
} from '../src/components/PitchDefender/pitchforksBellPower'

let checks = 0
const check = (run: () => void): void => {
  run()
  checks += 1
}

const config = (overrides: Partial<PitchforksBellPowerConfig> = {}): PitchforksBellPowerConfig => ({
  runId: 'run-1',
  requiredResponses: 2,
  admittedNotes: ['C4', 'D3', 'D4', 'E4', 'F4'],
  taughtPair: ['D4', 'E4'],
  ...overrides,
})

const response = (overrides: Record<string, unknown> = {}) => ({
  runId: 'run-1',
  eventId: 'combat-1',
  note: 'D4',
  lane: 'voice',
  source: 'combat',
  correct: true,
  ...overrides,
})

const activationNote = (eventId: string, note: string, overrides: Record<string, unknown> = {}) => ({
  runId: 'run-1',
  eventId,
  note,
  confirmed: true,
  ...overrides,
})

const acknowledge = (state: PitchforksBellPowerState, released: boolean, receiptId = state.pendingReceipt?.receiptId ?? '') =>
  acknowledgePitchforksBellPowerWaveRelease(state, { runId: state.runId, receiptId, released })

function earnReady(requiredResponses = 2): PitchforksBellPowerState {
  let state = createPitchforksBellPowerState(config({ requiredResponses }))
  for (let index = 0; index < requiredResponses; index += 1) {
    const decision = acceptPitchforksBellPowerCombatResponse(state, response({
      eventId: `combat-${index + 1}`,
      note: index % 2 === 0 ? 'D4' : 'E4',
    }))
    assert.equal(decision.accepted, true)
    state = decision.state
  }
  assert.equal(state.phase, 'ready')
  return state
}

function completeActivation(state: PitchforksBellPowerState, eventPrefix = 'activation'): {
  state: PitchforksBellPowerState
  receiptId: string
} {
  state = startPitchforksBellPowerActivation(state).state
  state = acceptPitchforksBellPowerActivationNote(state, activationNote(`${eventPrefix}-1`, 'D4')).state
  const completed = acceptPitchforksBellPowerActivationNote(state, activationNote(`${eventPrefix}-2`, 'E4'))
  assert.equal(completed.completed, true)
  assert.ok(completed.receipt)
  return { state: completed.state, receiptId: completed.receipt?.receiptId ?? '' }
}

check(() => {
  const initial = createPitchforksBellPowerState(config())
  assert.equal(initial.charge, 0)
  assert.equal(initial.phase, 'charging')
  assert.equal(Object.isFrozen(initial), true)
  assert.equal(Object.isFrozen(initial.admittedNotes), true)
  assert.equal(Object.isFrozen(initial.taughtPair), true)

  let state = acceptPitchforksBellPowerCombatResponse(initial, response()).state
  state = acceptPitchforksBellPowerCombatResponse(state, response({ eventId: 'combat-2', note: 'E4' })).state
  assert.equal(state.charge, 2)
  assert.equal(state.phase, 'ready')

  const started = startPitchforksBellPowerActivation(state)
  assert.equal(started.accepted, true)
  assert.equal(started.reason, 'started')
  state = started.state
  assert.equal(state.phase, 'activating')

  const first = acceptPitchforksBellPowerActivationNote(state, activationNote('activation-1', 'D4'))
  assert.equal(first.accepted, true)
  assert.equal(first.reason, 'first-note-confirmed')
  assert.deepEqual(first.state.activationNotes, ['D4'])

  const firstReplay = acceptPitchforksBellPowerActivationNote(first.state, activationNote('activation-1', 'D4'))
  assert.equal(firstReplay.reason, 'duplicate-event')
  assert.deepEqual(firstReplay.state.activationNotes, ['D4'])

  const second = acceptPitchforksBellPowerActivationNote(first.state, activationNote('activation-2', 'E4'))
  assert.equal(second.accepted, true)
  assert.equal(second.reason, 'receipt-pending')
  assert.equal(second.state.phase, 'pending')
  assert.equal(second.state.charge, 2)
  assert.deepEqual(second.receipt?.taughtPair, ['D4', 'E4'])
  assert.equal(second.receipt?.receiptId, 'bell-power:run-1:1')

  const released = acknowledge(second.state, true)
  assert.equal(released.accepted, true)
  assert.equal(released.spent, true)
  assert.equal(released.reason, 'acknowledged')
  assert.equal(released.state.charge, 0)
  assert.equal(released.state.phase, 'charging')
  assert.equal(released.state.pendingReceipt, null)
  assert.deepEqual(released.state.spentReceiptIds, ['bell-power:run-1:1'])
})

check(() => {
  let state = earnReady()
  const first = acceptPitchforksBellPowerCombatResponse(state, response())
  state = first.state
  const duplicateBeforeSpend = acceptPitchforksBellPowerCombatResponse(state, response())
  assert.equal(duplicateBeforeSpend.accepted, false)
  assert.equal(duplicateBeforeSpend.reason, 'duplicate-event')
  assert.strictEqual(duplicateBeforeSpend.state, state)

  const completed = completeActivation(state)
  const failed = acknowledge(completed.state, false)
  const repeatedFailed = acknowledge(failed.state, false, completed.receiptId)
  assert.equal(failed.state.charge, 2)
  assert.equal(repeatedFailed.state.charge, 2)
  assert.equal(repeatedFailed.state.pendingReceipt?.receiptId, completed.receiptId)

  const spent = acknowledge(failed.state, true, completed.receiptId)
  const duplicateAfterSpend = acceptPitchforksBellPowerCombatResponse(
    spent.state,
    response({ eventId: 'combat-1', note: 'F4' }),
  )
  assert.equal(duplicateAfterSpend.reason, 'duplicate-event')
  assert.equal(duplicateAfterSpend.state.charge, 0)
})

check(() => {
  let state = earnReady()
  state = startPitchforksBellPowerActivation(state).state
  const wrongOctave = acceptPitchforksBellPowerActivationNote(state, activationNote('activation-octave', 'D3'))
  assert.equal(wrongOctave.accepted, false)
  assert.equal(wrongOctave.reason, 'wrong-octave')
  assert.equal(wrongOctave.state.phase, 'ready')
  assert.equal(wrongOctave.state.charge, 2)
  assert.deepEqual(wrongOctave.state.activationNotes, [])
})

check(() => {
  let state = earnReady()
  state = startPitchforksBellPowerActivation(state).state
  const wrongOrder = acceptPitchforksBellPowerActivationNote(state, activationNote('activation-order', 'E4'))
  assert.equal(wrongOrder.accepted, false)
  assert.equal(wrongOrder.reason, 'wrong-order')
  assert.equal(wrongOrder.state.phase, 'ready')
  assert.equal(wrongOrder.state.charge, 2)

  state = startPitchforksBellPowerActivation(wrongOrder.state).state
  state = acceptPitchforksBellPowerActivationNote(state, activationNote('activation-order-1', 'D4')).state
  const complete = acceptPitchforksBellPowerActivationNote(state, activationNote('activation-order-2', 'E4'))
  assert.equal(complete.completed, true)
})

check(() => {
  let state = earnReady()
  state = startPitchforksBellPowerActivation(state).state
  state = acceptPitchforksBellPowerActivationNote(state, activationNote('activation-cancelled', 'D4')).state
  const cancelled = cancelPitchforksBellPowerActivation(state)
  assert.equal(cancelled.accepted, true)
  assert.equal(cancelled.reason, 'cancelled')
  assert.equal(cancelled.state.phase, 'ready')
  assert.equal(cancelled.state.charge, 2)
  assert.deepEqual(cancelled.state.activationNotes, [])
  assert.equal(cancelled.state.pendingReceipt, null)
})

check(() => {
  const state = earnReady()
  const staleCombat = acceptPitchforksBellPowerCombatResponse(state, response({ runId: 'run-old' }))
  assert.equal(staleCombat.reason, 'stale-run')
  assert.strictEqual(staleCombat.state, state)

  const active = startPitchforksBellPowerActivation(state).state
  const staleActivation = acceptPitchforksBellPowerActivationNote(
    active,
    activationNote('activation-stale', 'D4', { runId: 'run-old' }),
  )
  assert.equal(staleActivation.reason, 'stale-run')
  assert.strictEqual(staleActivation.state, active)

  const pending = completeActivation(state)
  const staleAck = acknowledge(pending.state, true, pending.receiptId)
  // The helper above uses the state's run ID, so exercise the explicit stale input directly.
  const staleRelease = acknowledgePitchforksBellPowerWaveRelease(pending.state, {
    runId: 'run-old',
    receiptId: pending.receiptId,
    released: true,
  })
  assert.equal(staleAck.reason, 'acknowledged')
  assert.equal(staleRelease.reason, 'stale-run')
  assert.strictEqual(staleRelease.state, pending.state)
})

check(() => {
  const invalidConfigs: unknown[] = [
    { requiredResponses: 2, admittedNotes: ['D4', 'E4'], taughtPair: ['D4', 'E4'] },
    config({ requiredResponses: 0 }),
    config({ requiredResponses: 1.5 }),
    config({ taughtPair: ['D4'] as unknown as [string, string] }),
    config({ taughtPair: ['D4', 'D4'] }),
    config({ taughtPair: ['D4', 'G5'] }),
    config({ taughtPair: ['D4', 'D5'] }),
    config({ taughtPair: ['D4', 'C#4'] }),
    config({ admittedNotes: ['D4', 'D4'], taughtPair: ['D4', 'D4'] }),
  ]
  for (const invalid of invalidConfigs) {
    assert.throws(() => createPitchforksBellPowerState(invalid as PitchforksBellPowerConfig), TypeError)
  }
})

check(() => {
  let state = createPitchforksBellPowerState(config())
  const excluded: Array<Record<string, unknown>> = [
    { eventId: 'excluded-demo', demo: true },
    { eventId: 'excluded-simulated', simulated: true },
    { eventId: 'excluded-ear', lane: 'ear' },
    { eventId: 'excluded-wrong', correct: false },
    { eventId: 'excluded-stale', stale: true },
    { eventId: 'excluded-unadmitted', note: 'G4' },
  ]
  for (const overrides of excluded) {
    const decision = acceptPitchforksBellPowerCombatResponse(state, response(overrides))
    assert.equal(decision.charged, false)
    assert.notEqual(decision.reason, 'accepted')
    assert.notEqual(decision.reason, 'saturated')
    state = decision.state
  }
  assert.equal(state.charge, 0)
})

check(() => {
  let state = createPitchforksBellPowerState(config({ requiredResponses: 1 }))
  const first = acceptPitchforksBellPowerCombatResponse(state, response())
  assert.equal(first.charged, true)
  state = first.state
  const overbank = acceptPitchforksBellPowerCombatResponse(state, response({ eventId: 'combat-over-cap', note: 'E4' }))
  assert.equal(overbank.accepted, true)
  assert.equal(overbank.charged, false)
  assert.equal(overbank.reason, 'saturated')
  assert.equal(overbank.state.charge, 1)
  assert.deepEqual(overbank.state.consumedEventIds, ['combat-1', 'combat-over-cap'])

  const completed = completeActivation(overbank.state)
  const spent = acknowledge(completed.state, true, completed.receiptId)
  const replay = acceptPitchforksBellPowerCombatResponse(
    spent.state,
    response({ eventId: 'combat-over-cap', note: 'F4' }),
  )
  assert.equal(replay.reason, 'duplicate-event')
  assert.equal(replay.state.charge, 0)
})

check(() => {
  let state = earnReady()
  const completed = completeActivation(state)
  const failed = acknowledge(completed.state, false, completed.receiptId)
  assert.equal(failed.reason, 'release-failed')
  assert.equal(failed.state.charge, 2)
  assert.equal(failed.state.phase, 'pending')
  assert.equal(failed.state.pendingReceipt?.receiptId, completed.receiptId)

  const blocked = startPitchforksBellPowerActivation(failed.state)
  assert.equal(blocked.accepted, false)
  assert.equal(blocked.reason, 'pending-receipt')
  assert.equal(blocked.state.pendingReceipt?.receiptId, completed.receiptId)

  const released = acknowledge(failed.state, true, completed.receiptId)
  const repeated = acknowledge(released.state, true, completed.receiptId)
  assert.equal(repeated.reason, 'duplicate-acknowledgement')
  assert.equal(repeated.spent, false)
  assert.strictEqual(repeated.state, released.state)

  state = acceptPitchforksBellPowerCombatResponse(released.state, response({ eventId: 'combat-next' })).state
  state = acceptPitchforksBellPowerCombatResponse(state, response({ eventId: 'combat-next-2', note: 'E4' })).state
  const next = completeActivation(state, 'activation-next')
  assert.notEqual(next.receiptId, completed.receiptId)
  assert.equal(next.receiptId, 'bell-power:run-1:2')
})

console.log(`pitchforks Bell Power pure controller: ${checks}/${checks} PASS`)
