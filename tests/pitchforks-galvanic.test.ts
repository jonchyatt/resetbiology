import assert from 'node:assert/strict'

import {
  createPitchforksGalvanicState,
  planPitchforksGalvanicSweep,
  type PitchforksGalvanicLock,
  type PitchforksGalvanicRequest,
  type PitchforksGalvanicTarget,
} from '../src/components/PitchDefender/pitchforksGalvanic'
import {
  createPitchforksThunderheadState,
  PITCHFORKS_THUNDERHEAD_MAX_BANK_CAPACITY,
} from '../src/components/PitchDefender/pitchforksThunderhead'

let checks = 0

const check = (name: string, run: () => void) => {
  try {
    run()
    checks += 1
  } catch (error) {
    throw new Error(`${name} failed`, { cause: error })
  }
}

const tine = (overrides: Partial<PitchforksGalvanicTarget> = {}): PitchforksGalvanicTarget => ({
  targetKey: 'villager-a:tine-0',
  note: 'A4',
  octave: 4,
  ...overrides,
})

const lock = (overrides: Partial<PitchforksGalvanicLock> = {}): PitchforksGalvanicLock => ({
  lockId: 'lock-a',
  battleId: 'battle-a',
  targetKey: 'villager-a:tine-0',
  note: 'A4',
  octave: 4,
  ...overrides,
})

const requestFor = (
  state: ReturnType<typeof createPitchforksGalvanicState>,
  overrides: Partial<PitchforksGalvanicRequest> = {},
): PitchforksGalvanicRequest => ({
  battleId: state.battleId,
  attackId: 'attack-1',
  expectedVersion: state.version,
  tines: [tine()],
  locks: [lock()],
  ...overrides,
})

check('constructor and exact two-target success', () => {
  assert.throws(() => createPitchforksGalvanicState(''))
  assert.throws(() => createPitchforksGalvanicState('   '))

  const initial = createPitchforksGalvanicState('battle-a')
  assert.deepEqual(initial, {
    battleId: 'battle-a',
    version: 0,
    consumedLockIds: [],
    processedAttackIds: [],
  })

  const result = planPitchforksGalvanicSweep(initial, requestFor(initial, {
    tines: [
      tine({ targetKey: 'villager-b:tine-0', note: 'B4' }),
      tine(),
    ],
    locks: [
      lock({ lockId: 'lock-b', targetKey: 'villager-b:tine-0', note: 'B4' }),
      lock({ lockId: 'lock-a' }),
    ],
  }))

  assert.equal(result.accepted, true)
  assert.equal(result.reason, 'accepted')
  assert.equal(result.expectedVersion, 0)
  assert.deepEqual(result.outcomes, [
    { kind: 'strike', targetKey: 'villager-b:tine-0', note: 'B4', octave: 4, lockId: 'lock-b' },
    { kind: 'strike', targetKey: 'villager-a:tine-0', note: 'A4', octave: 4, lockId: 'lock-a' },
  ])
  assert.deepEqual(result.nextState, {
    battleId: 'battle-a',
    version: 1,
    consumedLockIds: ['lock-b', 'lock-a'],
    processedAttackIds: ['attack-1'],
  })
})

check('partial charge records recoil and still commits the attack', () => {
  const initial = createPitchforksGalvanicState('battle-a')
  const result = planPitchforksGalvanicSweep(initial, requestFor(initial, {
    tines: [tine(), tine({ targetKey: 'villager-b:tine-0', note: 'B4' })],
  }))

  assert.equal(result.accepted, true)
  assert.deepEqual(result.outcomes, [
    { kind: 'strike', targetKey: 'villager-a:tine-0', note: 'A4', octave: 4, lockId: 'lock-a' },
    { kind: 'recoil', targetKey: 'villager-b:tine-0', note: 'B4', octave: 4, reason: 'unbacked' },
  ])
  assert.deepEqual(result.nextState.consumedLockIds, ['lock-a'])
  assert.deepEqual(result.nextState.processedAttackIds, ['attack-1'])
})

check('wrong note, wrong octave, wrong target, and cross-battle lock recoil', () => {
  const cases: Array<{ tine: PitchforksGalvanicTarget; supplied: PitchforksGalvanicLock }> = [
    { tine: tine({ note: 'B4' }), supplied: lock({ note: 'A4' }) },
    { tine: tine({ note: 'A5', octave: 5 }), supplied: lock({ note: 'A4' }) },
    { tine: tine({ targetKey: 'villager-b:tine-0' }), supplied: lock() },
    { tine: tine(), supplied: lock({ battleId: 'battle-b' }) },
  ]

  for (const [index, item] of cases.entries()) {
    const initial = createPitchforksGalvanicState('battle-a')
    const result = planPitchforksGalvanicSweep(initial, requestFor(initial, {
      attackId: `attack-${index}`,
      tines: [item.tine],
      locks: [item.supplied],
    }))
    assert.equal(result.accepted, true)
    assert.deepEqual(result.outcomes, [{
      kind: 'recoil',
      targetKey: item.tine.targetKey,
      note: item.tine.note,
      octave: item.tine.octave,
      reason: 'unbacked',
    }])
    assert.deepEqual(result.nextState.consumedLockIds, [])
  }
})

check('contradictory octave is rejected without publication', () => {
  const initial = createPitchforksGalvanicState('battle-a')
  const result = planPitchforksGalvanicSweep(initial, requestFor(initial, {
    tines: [tine({ note: 'A5', octave: 4 })],
  }))
  assert.equal(result.accepted, false)
  assert.equal(result.reason, 'invalid-target')
  assert.strictEqual(result.nextState, initial)
  assert.deepEqual(result.outcomes, [])
})

check('signed octave exact matching is accepted', () => {
  const initial = createPitchforksGalvanicState('battle-a')
  const negativeOctave = tine({ targetKey: 'villager-c:tine-0', note: 'C-1', octave: -1 })
  const result = planPitchforksGalvanicSweep(initial, requestFor(initial, {
    tines: [negativeOctave],
    locks: [lock({ lockId: 'lock-c', targetKey: 'villager-c:tine-0', note: 'C-1', octave: -1 })],
  }))

  assert.equal(result.accepted, true)
  assert.deepEqual(result.outcomes, [{
    kind: 'strike', targetKey: 'villager-c:tine-0', note: 'C-1', octave: -1, lockId: 'lock-c',
  }])
})

check('wrong request battle preserves state identity', () => {
  const initial = createPitchforksGalvanicState('battle-a')
  const result = planPitchforksGalvanicSweep(initial, requestFor(initial, { battleId: 'battle-b' }))
  assert.equal(result.accepted, false)
  assert.equal(result.reason, 'battle-mismatch')
  assert.strictEqual(result.nextState, initial)
  assert.deepEqual(result.outcomes, [])
})

check('duplicate attack is rejected', () => {
  const initial = createPitchforksGalvanicState('battle-a')
  const first = planPitchforksGalvanicSweep(initial, requestFor(initial))
  const retry = planPitchforksGalvanicSweep(first.nextState, requestFor(first.nextState, {
    attackId: 'attack-1',
  }))
  assert.equal(first.accepted, true)
  assert.equal(retry.accepted, false)
  assert.equal(retry.reason, 'duplicate-attack')
  assert.strictEqual(retry.nextState, first.nextState)
  assert.deepEqual(retry.outcomes, [])
})

check('a consumed lock cannot be reused by a new attack', () => {
  const initial = createPitchforksGalvanicState('battle-a')
  const first = planPitchforksGalvanicSweep(initial, requestFor(initial))
  const second = planPitchforksGalvanicSweep(first.nextState, requestFor(first.nextState, {
    attackId: 'attack-2',
  }))
  assert.equal(second.accepted, true)
  assert.deepEqual(second.outcomes, [{
    kind: 'recoil',
    targetKey: 'villager-a:tine-0',
    note: 'A4',
    octave: 4,
    reason: 'unbacked',
  }])
  assert.deepEqual(second.nextState.consumedLockIds, ['lock-a'])
  assert.deepEqual(second.nextState.processedAttackIds, ['attack-1', 'attack-2'])
})

check('stale version is rejected', () => {
  const initial = createPitchforksGalvanicState('battle-a')
  const first = planPitchforksGalvanicSweep(initial, requestFor(initial))
  const stale = planPitchforksGalvanicSweep(first.nextState, requestFor(first.nextState, {
    attackId: 'attack-2',
    expectedVersion: 0,
  }))
  assert.equal(stale.accepted, false)
  assert.equal(stale.reason, 'stale-version')
  assert.strictEqual(stale.nextState, first.nextState)
})

check('last safe version increments once and exhaustion is refused', () => {
  const nearExhaustion = {
    battleId: 'battle-a',
    version: Number.MAX_SAFE_INTEGER - 1,
    consumedLockIds: [],
    processedAttackIds: [],
  } as ReturnType<typeof createPitchforksGalvanicState>
  const lastSafe = planPitchforksGalvanicSweep(nearExhaustion, requestFor(nearExhaustion, {
    tines: [],
    locks: [],
  }))

  assert.equal(lastSafe.accepted, true)
  assert.equal(lastSafe.nextState.version, Number.MAX_SAFE_INTEGER)
  assert.equal(Number.isSafeInteger(lastSafe.nextState.version), true)

  const exhausted = planPitchforksGalvanicSweep(lastSafe.nextState, requestFor(lastSafe.nextState, {
    attackId: 'attack-2',
    tines: [],
    locks: [],
  }))
  assert.equal(exhausted.accepted, false)
  assert.equal(exhausted.reason, 'version-exhausted')
  assert.strictEqual(exhausted.nextState, lastSafe.nextState)
  assert.deepEqual(exhausted.outcomes, [])
})

check('cancellation is rejected with no outcomes', () => {
  const initial = createPitchforksGalvanicState('battle-a')
  const result = planPitchforksGalvanicSweep(initial, requestFor(initial, { cancelled: true }))
  assert.equal(result.accepted, false)
  assert.equal(result.reason, 'cancelled')
  assert.strictEqual(result.nextState, initial)
  assert.deepEqual(result.outcomes, [])
})

check('duplicate targets and duplicate conflicting lock IDs are rejected', () => {
  const initial = createPitchforksGalvanicState('battle-a')
  const duplicateTargets = planPitchforksGalvanicSweep(initial, requestFor(initial, {
    tines: [tine(), tine({ note: 'B4' })],
  }))
  assert.equal(duplicateTargets.accepted, false)
  assert.equal(duplicateTargets.reason, 'duplicate-target')
  assert.strictEqual(duplicateTargets.nextState, initial)

  const duplicateLocks = planPitchforksGalvanicSweep(initial, requestFor(initial, {
    locks: [lock(), lock({ targetKey: 'villager-b:tine-0', note: 'B4' })],
  }))
  assert.equal(duplicateLocks.accepted, false)
  assert.equal(duplicateLocks.reason, 'duplicate-lock')
  assert.strictEqual(duplicateLocks.nextState, initial)
})

check('malformed identifiers, numbers, and pitches are rejected', () => {
  const initial = createPitchforksGalvanicState('battle-a')
  const invalidRequest = planPitchforksGalvanicSweep(initial, requestFor(initial, {
    attackId: ' ',
  }))
  assert.equal(invalidRequest.reason, 'invalid-attack-id')

  const invalidNumber = planPitchforksGalvanicSweep(initial, requestFor(initial, {
    expectedVersion: Number.NaN,
  }))
  assert.equal(invalidNumber.reason, 'invalid-version')

  const invalidLock = planPitchforksGalvanicSweep(initial, requestFor(initial, {
    locks: [lock({ note: 'a4' })],
  }))
  assert.equal(invalidLock.reason, 'invalid-lock')
})

check('caller inputs are not mutated or frozen', () => {
  const initial = createPitchforksGalvanicState('battle-a')
  const input = requestFor(initial, {
    tines: [tine()],
    locks: [lock()],
  })
  const before = structuredClone(input)
  assert.equal(Object.isFrozen(input), false)
  assert.equal(Object.isFrozen(input.tines), false)
  assert.equal(Object.isFrozen(input.locks), false)
  planPitchforksGalvanicSweep(initial, input)
  assert.deepEqual(input, before)
  assert.equal(Object.isFrozen(input.tines[0]), false)
  assert.equal(Object.isFrozen(input.locks[0]), false)
})

check('plan, state, arrays, and outcomes are immutable helper-owned records', () => {
  const initial = createPitchforksGalvanicState('battle-a')
  const result = planPitchforksGalvanicSweep(initial, requestFor(initial))
  assert.equal(Object.isFrozen(result), true)
  assert.equal(Object.isFrozen(result.nextState), true)
  assert.equal(Object.isFrozen(result.nextState.consumedLockIds), true)
  assert.equal(Object.isFrozen(result.nextState.processedAttackIds), true)
  assert.equal(Object.isFrozen(result.outcomes), true)
  assert.equal(Object.isFrozen(result.outcomes[0]), true)
  assert.equal(Reflect.set(result.outcomes[0] as object, 'lockId', 'forged-lock'), false)
  assert.equal(Reflect.set(result.nextState.consumedLockIds, 0, 'forged-lock'), false)
  assert.equal(result.outcomes[0]?.kind, 'strike')
  assert.equal(result.outcomes[0]?.kind === 'strike' ? result.outcomes[0].lockId : null, 'lock-a')
  assert.deepEqual(result.nextState.consumedLockIds, ['lock-a'])
})

check('lexicographic lock tie is deterministic regardless of lock input order', () => {
  const firstState = createPitchforksGalvanicState('battle-a')
  const first = planPitchforksGalvanicSweep(firstState, requestFor(firstState, {
    locks: [lock({ lockId: 'lock-z' }), lock({ lockId: 'lock-a' })],
  }))
  const secondState = createPitchforksGalvanicState('battle-a')
  const second = planPitchforksGalvanicSweep(secondState, requestFor(secondState, {
    locks: [lock({ lockId: 'lock-a' }), lock({ lockId: 'lock-z' })],
  }))
  assert.deepEqual(first.outcomes, second.outcomes)
  assert.deepEqual(first.nextState, second.nextState)
  assert.equal(first.outcomes[0]?.kind, 'strike')
  assert.equal(first.outcomes[0]?.kind === 'strike' ? first.outcomes[0].lockId : null, 'lock-a')
})

check('tine input order is preserved even when locks arrive in another order', () => {
  const initial = createPitchforksGalvanicState('battle-a')
  const result = planPitchforksGalvanicSweep(initial, requestFor(initial, {
    tines: [
      tine({ targetKey: 'villager-b:tine-0', note: 'B4' }),
      tine({ targetKey: 'villager-c:tine-0', note: 'C4' }),
    ],
    locks: [
      lock({ lockId: 'lock-c', targetKey: 'villager-c:tine-0', note: 'C4' }),
      lock({ lockId: 'lock-b', targetKey: 'villager-b:tine-0', note: 'B4' }),
    ],
  }))
  assert.deepEqual(result.outcomes.map(outcome => outcome.targetKey), [
    'villager-b:tine-0',
    'villager-c:tine-0',
  ])
  assert.deepEqual(result.nextState.consumedLockIds, ['lock-b', 'lock-c'])
})

check('publish-first reentrant planning produces no effects', () => {
  let current = createPitchforksGalvanicState('battle-a')
  let effects = 0
  const firstRequest = requestFor(current)
  const first = planPitchforksGalvanicSweep(current, firstRequest)
  assert.equal(first.accepted, true)

  current = first.nextState
  const reentrant = planPitchforksGalvanicSweep(current, requestFor(current, {
    attackId: firstRequest.attackId,
  }))
  assert.equal(reentrant.accepted, false)
  assert.equal(reentrant.reason, 'duplicate-attack')
  if (reentrant.accepted) effects += reentrant.outcomes.length
  assert.equal(effects, 0)
})

check('rejected plans preserve original state identity', () => {
  const initial = createPitchforksGalvanicState('battle-a')
  const rejected = planPitchforksGalvanicSweep(initial, requestFor(initial, { cancelled: true }))
  assert.strictEqual(rejected.nextState, initial)
  assert.strictEqual(rejected.nextState.consumedLockIds, initial.consumedLockIds)
  assert.strictEqual(rejected.nextState.processedAttackIds, initial.processedAttackIds)
})

check('sparse consumed lock provenance is rejected', () => {
  const initial = createPitchforksGalvanicState('battle-a')
  const sparse = {
    ...initial,
    consumedLockIds: new Array<string>(1),
  } as ReturnType<typeof createPitchforksGalvanicState>
  const result = planPitchforksGalvanicSweep(sparse, requestFor(initial, { tines: [], locks: [] }))

  assert.equal(result.accepted, false)
  assert.equal(result.reason, 'invalid-state')
  assert.strictEqual(result.nextState, sparse)
  assert.deepEqual(result.outcomes, [])
})

check('sparse processed attack provenance is rejected', () => {
  const initial = createPitchforksGalvanicState('battle-a')
  const sparse = {
    ...initial,
    processedAttackIds: new Array<string>(1),
  } as ReturnType<typeof createPitchforksGalvanicState>
  const result = planPitchforksGalvanicSweep(sparse, requestFor(initial, { tines: [], locks: [] }))

  assert.equal(result.accepted, false)
  assert.equal(result.reason, 'invalid-state')
  assert.strictEqual(result.nextState, sparse)
  assert.deepEqual(result.outcomes, [])
})

check('Galvanic planning does not mutate Thunderhead or alter capacity one', () => {
  const thunderhead = createPitchforksThunderheadState()
  const before = structuredClone(thunderhead)
  const galvanic = createPitchforksGalvanicState('battle-a')
  planPitchforksGalvanicSweep(galvanic, requestFor(galvanic))
  assert.deepEqual(thunderhead, before)
  assert.equal(PITCHFORKS_THUNDERHEAD_MAX_BANK_CAPACITY, 1)
})

console.log(`pitchforks Galvanic accounting: ${checks}/${checks} PASS`)
