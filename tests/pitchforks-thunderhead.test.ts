import assert from 'node:assert/strict'

import {
  advancePitchforksThunderhead,
  createPitchforksThunderheadState,
  getPitchforksThunderheadDebugProjection,
  PITCHFORKS_THUNDERHEAD_MAX_DIAGNOSTIC_EVENTS,
  PITCHFORKS_THUNDERHEAD_EVENT_SEQUENCE,
  transitionPitchforksThunderhead,
} from '../src/components/PitchDefender/pitchforksThunderhead'

let checks = 0
const check = (run: () => void) => {
  run()
  checks += 1
}

const receipt = (overrides: Partial<{
  bankId: string
  lockId: string
  targetKey: string
  pitchClass: string
  rune: string
  colorToken: string
  note: string
  octave: number
}> = {}) => ({
  bankId: 'bank-a',
  lockId: 'lock-a',
  targetKey: 'villager-a:tine-0',
  pitchClass: 'A',
  rune: 'ᚨ',
  colorToken: 'storm-blue',
  note: 'A4',
  octave: 4,
  ...overrides,
})

const event = (type: 'banked' | 'detached' | 'ceiling_travel' | 'strike' | 'consumed', logicalTimeMs: number) => ({
  type,
  logicalTimeMs,
})

const target = (overrides: Partial<{ targetKey: string; note: string; octave: number }> = {}) => ({
  targetKey: 'villager-a:tine-0',
  note: 'A4',
  octave: 4,
  ...overrides,
})

const runToTravel = () => {
  let state = createPitchforksThunderheadState()
  state = advancePitchforksThunderhead(state, {
    type: 'lock_confirmed',
    logicalTimeMs: 10,
    receipt: receipt(),
  }).state
  state = advancePitchforksThunderhead(state, event('banked', 20)).state
  state = advancePitchforksThunderhead(state, event('detached', 30)).state
  return advancePitchforksThunderhead(state, event('ceiling_travel', 40)).state
}

const runToConsumed = (
  initialState: ReturnType<typeof createPitchforksThunderheadState>,
  lifecycleReceipt: ReturnType<typeof receipt>,
  startTime: number,
) => {
  let state = advancePitchforksThunderhead(initialState, {
    type: 'lock_confirmed',
    logicalTimeMs: startTime,
    receipt: lifecycleReceipt,
  }).state
  state = advancePitchforksThunderhead(state, event('banked', startTime + 1)).state
  state = advancePitchforksThunderhead(state, event('detached', startTime + 2)).state
  state = advancePitchforksThunderhead(state, event('ceiling_travel', startTime + 3)).state
  state = advancePitchforksThunderhead(state, {
    type: 'target_match',
    logicalTimeMs: startTime + 4,
    target: target({
      targetKey: lifecycleReceipt.targetKey,
      note: lifecycleReceipt.note,
      octave: lifecycleReceipt.octave,
    }),
  }).state
  state = advancePitchforksThunderhead(state, event('strike', startTime + 5)).state
  return advancePitchforksThunderhead(state, event('consumed', startTime + 6)).state
}

check(() => {
  const initial = createPitchforksThunderheadState()
  assert.equal(initial.phase, 'idle')
  assert.equal(initial.bank, null)
  assert.equal(Object.isFrozen(initial), true)
  assert.equal(Object.isFrozen(initial.events), true)
  assert.equal(PITCHFORKS_THUNDERHEAD_EVENT_SEQUENCE.join('→'), 'lock_confirmed→banked→detached→ceiling_travel→target_match→strike→consumed')

  const noCharge = advancePitchforksThunderhead(initial, event('banked', 1))
  assert.equal(noCharge.accepted, false)
  assert.equal(noCharge.reason, 'insufficient-charge')
  assert.equal(noCharge.intent, null)
  assert.strictEqual(noCharge.state, initial)
})

check(() => {
  const initial = createPitchforksThunderheadState()
  const confirmation = advancePitchforksThunderhead(initial, {
    type: 'lock_confirmed',
    logicalTimeMs: 10,
    receipt: receipt(),
  })
  assert.equal(confirmation.accepted, true)
  assert.equal(confirmation.state.phase, 'lock_confirmed')
  assert.deepEqual(confirmation.state.receipt, receipt())
  assert.equal(confirmation.state.bank, null)

  const banked = advancePitchforksThunderhead(confirmation.state, event('banked', 20))
  assert.equal(banked.state.phase, 'banked')
  assert.deepEqual(banked.state.bank, { ...receipt(), consumedAt: null })
  assert.equal(Object.isFrozen(banked.state.bank), true)
  assert.equal(Object.isFrozen(banked.state.receipt), true)

  const duplicate = advancePitchforksThunderhead(banked.state, event('banked', 21))
  assert.equal(duplicate.accepted, false)
  assert.equal(duplicate.reason, 'already-banked')
  assert.strictEqual(duplicate.state, banked.state)
})

check(() => {
  let state = runToTravel()
  for (const [time, transition] of [
    [50, { type: 'target_match' as const, target: target() }],
    [60, event('strike', 60)],
    [70, event('consumed', 70)],
  ] as const) {
    state = advancePitchforksThunderhead(state, {
      ...transition,
      logicalTimeMs: time,
    }).state
  }

  assert.equal(state.phase, 'consumed')
  assert.equal(state.bank?.consumedAt, 70)
  assert.deepEqual(state.consumedLockIds, ['lock-a'])
  assert.deepEqual(state.consumedBankIds, ['bank-a'])
  assert.deepEqual(state.events.map(item => item.type), [...PITCHFORKS_THUNDERHEAD_EVENT_SEQUENCE])

  const projection = getPitchforksThunderheadDebugProjection(state)
  assert.equal(projection.capacity, 1)
  assert.deepEqual(projection.bank, {
    ...receipt(),
    consumedAt: 70,
  })
  assert.equal(projection.bank?.note, 'A4')
  assert.equal(projection.bank?.octave, 4)
  assert.equal(projection.bank?.rune, 'ᚨ')
  assert.equal(projection.bank?.colorToken, 'storm-blue')
  assert.deepEqual(projection.eventSequence, PITCHFORKS_THUNDERHEAD_EVENT_SEQUENCE)
  assert.equal(Object.isFrozen(projection), true)
  assert.equal(Object.isFrozen(projection.eventSequence), true)
})

check(() => {
  const base = runToTravel()
  const wrongNote = advancePitchforksThunderhead(base, {
    type: 'target_match',
    logicalTimeMs: 50,
    target: target({ note: 'B4' }),
  })
  assert.equal(wrongNote.intent, null)
  assert.equal(wrongNote.reason, 'note-mismatch')
  assert.strictEqual(wrongNote.state, base)

  const wrongOctave = advancePitchforksThunderhead(base, {
    type: 'target_match',
    logicalTimeMs: 50,
    target: target({ octave: 5 }),
  })
  assert.equal(wrongOctave.intent, null)
  assert.equal(wrongOctave.reason, 'invalid-target')
  assert.strictEqual(wrongOctave.state, base)

  const stale = advancePitchforksThunderhead(base, {
    type: 'target_match',
    logicalTimeMs: 50,
    target: target({ targetKey: 'villager-b:tine-0' }),
  })
  assert.equal(stale.intent, null)
  assert.equal(stale.reason, 'stale-target')
  assert.strictEqual(stale.state, base)
})

check(() => {
  const base = runToTravel()
  const matched = advancePitchforksThunderhead(base, {
    type: 'target_match',
    logicalTimeMs: 50,
    target: target(),
  })
  const beforeMatchStrike = advancePitchforksThunderhead(base, event('strike', 50))
  assert.equal(beforeMatchStrike.intent, null)
  assert.equal(beforeMatchStrike.reason, 'not-ready')
  assert.strictEqual(beforeMatchStrike.state, base)

  const first = advancePitchforksThunderhead(matched.state, event('strike', 60))
  assert.equal(first.intent?.kind, 'thunderhead-strike')
  assert.equal(first.intent?.lockId, 'lock-a')
  assert.equal(first.state.phase, 'strike')
  const second = advancePitchforksThunderhead(first.state, event('strike', 61))
  assert.equal(second.intent, null)
  assert.equal(second.reason, 'already-consumed')
  assert.strictEqual(second.state, first.state)

  const consumed = advancePitchforksThunderhead(first.state, event('consumed', 70))
  const duplicateConsumed = advancePitchforksThunderhead(consumed.state, event('consumed', 71))
  assert.equal(duplicateConsumed.intent, null)
  assert.equal(duplicateConsumed.reason, 'already-consumed')
  assert.strictEqual(duplicateConsumed.state, consumed.state)
})

check(() => {
  const initial = createPitchforksThunderheadState()
  for (const logicalTimeMs of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    const rejected = advancePitchforksThunderhead(initial, {
      type: 'lock_confirmed',
      logicalTimeMs,
      receipt: receipt(),
    })
    assert.equal(rejected.accepted, false)
    assert.equal(rejected.reason, 'invalid-time')
    assert.strictEqual(rejected.state, initial)
  }

  const negative = advancePitchforksThunderhead(initial, {
    type: 'lock_confirmed',
    logicalTimeMs: -1,
    receipt: receipt(),
  })
  assert.equal(negative.accepted, false)
  assert.equal(negative.reason, 'invalid-time')
  assert.strictEqual(negative.state, initial)

  const valid = advancePitchforksThunderhead(initial, {
    type: 'lock_confirmed',
    logicalTimeMs: 10,
    receipt: receipt(),
  }).state
  const regressed = advancePitchforksThunderhead(valid, event('banked', 9))
  assert.equal(regressed.reason, 'time-regressed')
  assert.strictEqual(regressed.state, valid)
})

check(() => {
  let state = runToTravel()
  state = advancePitchforksThunderhead(state, {
    type: 'target_match',
    logicalTimeMs: 50,
    target: target(),
  }).state
  state = advancePitchforksThunderhead(state, event('strike', 60)).state
  state = advancePitchforksThunderhead(state, event('consumed', 70)).state

  const replayLock = advancePitchforksThunderhead(state, {
    type: 'lock_confirmed',
    logicalTimeMs: 80,
    receipt: receipt(),
  })
  assert.equal(replayLock.reason, 'duplicate-lock')
  assert.strictEqual(replayLock.state, state)

  const nextLock = advancePitchforksThunderhead(state, {
    type: 'lock_confirmed',
    logicalTimeMs: 80,
    receipt: receipt({ bankId: 'bank-b', lockId: 'lock-b' }),
  })
  assert.equal(nextLock.accepted, true)
  const consumedFreshBank = runToConsumed(nextLock.state, receipt({ bankId: 'bank-b', lockId: 'lock-b' }), 81)
  assert.equal(consumedFreshBank.phase, 'consumed')

  const sameBank = advancePitchforksThunderhead(consumedFreshBank, {
    type: 'lock_confirmed',
    logicalTimeMs: 88,
    receipt: receipt({ bankId: 'bank-a', lockId: 'lock-c' }),
  })
  assert.equal(sameBank.reason, 'duplicate-bank')
  assert.strictEqual(sameBank.state, consumedFreshBank)
})

check(() => {
  const malformedNotes = ['A', 'A#', 'H4', 'a4', 'A+4', 'A4.0', 'A 4', 'A#4#']
  for (const note of malformedNotes) {
    const rejected = advancePitchforksThunderhead(createPitchforksThunderheadState(), {
      type: 'lock_confirmed',
      logicalTimeMs: 1,
      receipt: receipt({ note }),
    })
    assert.equal(rejected.accepted, false)
    assert.equal(rejected.reason, 'invalid-receipt')
  }

  const contradictoryPitchClass = advancePitchforksThunderhead(createPitchforksThunderheadState(), {
    type: 'lock_confirmed',
    logicalTimeMs: 1,
    receipt: receipt({ pitchClass: 'B', note: 'A5', octave: 5 }),
  })
  assert.equal(contradictoryPitchClass.reason, 'invalid-receipt')

  const contradictoryOctave = advancePitchforksThunderhead(createPitchforksThunderheadState(), {
    type: 'lock_confirmed',
    logicalTimeMs: 1,
    receipt: receipt({ note: 'A5', octave: 4 }),
  })
  assert.equal(contradictoryOctave.reason, 'invalid-receipt')

  const targetBase = runToTravel()
  const contradictoryTarget = advancePitchforksThunderhead(targetBase, {
    type: 'target_match',
    logicalTimeMs: 50,
    target: target({ note: 'A5', octave: 4 }),
  })
  assert.equal(contradictoryTarget.reason, 'invalid-target')
  assert.strictEqual(contradictoryTarget.state, targetBase)
})

check(() => {
  let state = createPitchforksThunderheadState()
  for (let index = 0; index < 10; index += 1) {
    state = runToConsumed(
      state,
      receipt({ bankId: `bank-${index}`, lockId: `lock-${index}` }),
      index * 10 + 1,
    )
  }

  assert.equal(state.phase, 'consumed')
  assert.ok(state.events.length <= PITCHFORKS_THUNDERHEAD_MAX_DIAGNOSTIC_EVENTS)
  assert.equal(state.events[0]?.type, 'lock_confirmed')
  assert.equal(state.events[state.events.length - 1]?.type, 'consumed')
  assert.equal(state.consumedLockIds.length, 10)
  assert.equal(state.consumedBankIds.length, 10)
  assert.equal(state.consumedBankIds[0], 'bank-0')
  const projection = getPitchforksThunderheadDebugProjection(state)
  assert.deepEqual(projection.eventSequence, state.events.map(item => item.type))
  assert.equal(projection.events.length, state.events.length)

  const replay = advancePitchforksThunderhead(state, {
    type: 'lock_confirmed',
    logicalTimeMs: 100,
    receipt: receipt({ bankId: 'bank-0', lockId: 'lock-replay' }),
  })
  assert.equal(replay.reason, 'duplicate-bank')
  assert.strictEqual(replay.state, state)
})

check(() => {
  // The alias is the same pure reducer, and no event can emit before travel+match.
  assert.strictEqual(transitionPitchforksThunderhead, advancePitchforksThunderhead)
  const initial = createPitchforksThunderheadState()
  const early = transitionPitchforksThunderhead(initial, event('strike', 1))
  assert.equal(early.intent, null)
  assert.equal(early.reason, 'not-ready')
})

console.log(`pitchforks Thunderhead single-charge lifecycle: ${checks}/${checks} PASS`)
