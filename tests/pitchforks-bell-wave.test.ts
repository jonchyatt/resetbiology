import assert from 'node:assert/strict'

import {
  advancePitchforksBellWave,
  createPitchforksBellWaveState,
  getPitchforksBellWaveProjection,
  projectPitchforksBellWave,
  releasePitchforksBellWave,
  resetPitchforksBellWaveState,
} from '../src/components/PitchDefender/pitchforksBellWave'

let checks = 0
const check = (run: () => void) => {
  run()
  checks += 1
}

const releaseInput = (overrides: Record<string, unknown> = {}) => ({
  receipt: { receiptId: 'wave-receipt:run-1:1' },
  releaseEligible: true,
  logicalTimeMs: 100,
  bellOrigin: { x: 10, y: 20 },
  waveSpeed: 0.5,
  waveDurationMs: 200,
  walkingVillagers: [
    { stableID: 'villager-near', x: 14, y: 20 },
    { stableID: 'villager-far', x: 20, y: 20 },
  ],
  ...overrides,
})

const villagers = (...entries: Array<{
  stableID: string
  x: number
  y: number
  walking?: boolean
  alive?: boolean
  spent?: boolean
}>) => entries

check(() => {
  const initial = createPitchforksBellWaveState()
  assert.equal(initial.phase, 'idle')
  assert.equal(initial.wave, null)
  assert.deepEqual(initial.consumedReceiptIds, [])
  assert.equal(Object.isFrozen(initial), true)
  assert.equal(Object.isFrozen(initial.consumedReceiptIds), true)

  const released = releasePitchforksBellWave(initial, releaseInput())
  assert.equal(released.accepted, true)
  assert.equal(released.reason, 'released')
  assert.equal(released.intent?.kind, 'bell-wave-release')
  assert.equal(released.intent?.receiptId, 'wave-receipt:run-1:1')
  assert.equal(released.state.phase, 'active')
  assert.deepEqual(released.state.wave?.bellOrigin, { x: 10, y: 20 })
  assert.deepEqual(released.state.consumedReceiptIds, ['wave-receipt:run-1:1'])
  assert.deepEqual(released.state.eligibleStableIDs, ['villager-near', 'villager-far'])
  assert.deepEqual(released.state.previousObservations, [
    { stableID: 'villager-near', x: 14, y: 20 },
    { stableID: 'villager-far', x: 20, y: 20 },
  ])
  assert.strictEqual(initial.consumedReceiptIds.length, 0)
})

check(() => {
  let state = releasePitchforksBellWave(createPitchforksBellWaveState(), releaseInput()).state
  const first = advancePitchforksBellWave(state, {
    logicalTimeMs: 110,
    walkingVillagers: villagers(
      { stableID: 'villager-near', x: 14, y: 20 },
      { stableID: 'villager-far', x: 20, y: 20 },
    ),
  })
  assert.deepEqual(first.intents.map(intent => [intent.stableID, intent.contactAtMs]), [
    ['villager-near', 108],
  ])
  assert.deepEqual(first.state.contactedStableIDs, ['villager-near'])
  state = first.state

  const second = advancePitchforksBellWave(state, {
    logicalTimeMs: 130,
    walkingVillagers: villagers(
      { stableID: 'villager-near', x: 14, y: 20 },
      { stableID: 'villager-far', x: 20, y: 20 },
    ),
  })
  assert.deepEqual(second.intents.map(intent => intent.stableID), ['villager-far'])
  assert.deepEqual(second.state.contactedStableIDs, ['villager-near', 'villager-far'])

  const replay = advancePitchforksBellWave(second.state, {
    logicalTimeMs: 130,
    walkingVillagers: villagers(
      { stableID: 'villager-near', x: 14, y: 20 },
      { stableID: 'villager-far', x: 20, y: 20 },
    ),
  })
  assert.deepEqual(replay.intents, [])
  assert.strictEqual(replay.state, second.state)
})

check(() => {
  // A villager introduced after release is not eligible for this wave, even
  // when its eventual position would be inside the already-passed front.
  const released = releasePitchforksBellWave(createPitchforksBellWaveState(), releaseInput({
    walkingVillagers: villagers({ stableID: 'release-only', x: 20, y: 20 }),
  })).state
  const absent = advancePitchforksBellWave(released, {
    logicalTimeMs: 110,
    walkingVillagers: villagers(),
  })
  const late = advancePitchforksBellWave(absent.state, {
    logicalTimeMs: 130,
    walkingVillagers: villagers({ stableID: 'newID', x: 20, y: 20 }),
  })
  assert.deepEqual(late.intents, [])
  assert.deepEqual(late.state.eligibleStableIDs, ['release-only'])
  assert.deepEqual(late.state.contactedStableIDs, [])
})

check(() => {
  // Sweeping the trusted position from t100 to t106 catches an inward-moving
  // villager even though the front crossed between delivered frames.
  const released = releasePitchforksBellWave(createPitchforksBellWaveState(), releaseInput({
    logicalTimeMs: 0,
    bellOrigin: { x: 0, y: 0 },
    waveSpeed: 1,
    waveDurationMs: 200,
    walkingVillagers: villagers({ stableID: 'inward', x: 102, y: 0 }),
  })).state
  const at100 = advancePitchforksBellWave(released, {
    logicalTimeMs: 100,
    walkingVillagers: villagers({ stableID: 'inward', x: 102, y: 0 }),
  })
  assert.deepEqual(at100.intents, [])
  const at106 = advancePitchforksBellWave(at100.state, {
    logicalTimeMs: 106,
    walkingVillagers: villagers({ stableID: 'inward', x: 98, y: 0 }),
  })
  assert.equal(at106.intents.length, 1)
  assert.equal(at106.intents[0]?.stableID, 'inward')
  assert.ok(Math.abs((at106.intents[0]?.contactAtMs ?? 0) - 101.2) < 1e-9)
  assert.ok(Math.abs((at106.intents[0]?.position.x ?? 0) - 101.2) < 1e-9)
})

check(() => {
  // When a dropped frame is beyond the ring lifetime, interpolate the current
  // position at the end of the lifetime rather than using the later endpoint.
  const released = releasePitchforksBellWave(createPitchforksBellWaveState(), releaseInput({
    logicalTimeMs: 0,
    bellOrigin: { x: 0, y: 0 },
    waveSpeed: 1,
    waveDurationMs: 10,
    walkingVillagers: villagers({ stableID: 'clamped', x: 20, y: 0 }),
  })).state
  const finished = advancePitchforksBellWave(released, {
    logicalTimeMs: 100,
    walkingVillagers: villagers({ stableID: 'clamped', x: 0, y: 0 }),
  })
  assert.equal(finished.state.phase, 'finished')
  assert.deepEqual(finished.intents, [])
  assert.deepEqual(finished.state.previousObservations, [{ stableID: 'clamped', x: 18, y: 0 }])
})

check(() => {
  const stationary = releasePitchforksBellWave(createPitchforksBellWaveState(), releaseInput({
    logicalTimeMs: 0,
    bellOrigin: { x: 0, y: 0 },
    waveSpeed: 1,
    waveDurationMs: 20,
    walkingVillagers: villagers({ stableID: 'stationary', x: 10, y: 0 }),
  })).state
  const stationaryContact = advancePitchforksBellWave(stationary, {
    logicalTimeMs: 20,
    walkingVillagers: villagers({ stableID: 'stationary', x: 10, y: 0 }),
  })
  assert.equal(stationaryContact.intents[0]?.contactAtMs, 10)

  // Linear-degenerate quadratic: villager walks inward at exactly wave speed.
  const linear = releasePitchforksBellWave(createPitchforksBellWaveState(), releaseInput({
    logicalTimeMs: 0,
    bellOrigin: { x: 0, y: 0 },
    waveSpeed: 1,
    waveDurationMs: 20,
    walkingVillagers: villagers({ stableID: 'linear', x: 20, y: 0 }),
  })).state
  const linearContact = advancePitchforksBellWave(linear, {
    logicalTimeMs: 20,
    walkingVillagers: villagers({ stableID: 'linear', x: 0, y: 0 }),
  })
  assert.equal(linearContact.intents[0]?.contactAtMs, 10)

  // Tangent contact is still a reached front and must emit once.
  const tangent = releasePitchforksBellWave(createPitchforksBellWaveState(), releaseInput({
    logicalTimeMs: 0,
    bellOrigin: { x: 0, y: 0 },
    waveSpeed: 1,
    waveDurationMs: 2,
    walkingVillagers: villagers({ stableID: 'tangent', x: -1, y: 1 }),
  })).state
  const tangentContact = advancePitchforksBellWave(tangent, {
    logicalTimeMs: 2,
    walkingVillagers: villagers({ stableID: 'tangent', x: -1 + 2 * Math.SQRT2, y: 1 }),
  })
  assert.equal(tangentContact.intents.length, 1)
  assert.ok(Math.abs((tangentContact.intents[0]?.contactAtMs ?? 0) - Math.SQRT2) < 1e-8)
})

check(() => {
  const state = releasePitchforksBellWave(createPitchforksBellWaveState(), releaseInput({
    waveSpeed: 1,
    waveDurationMs: 20,
    walkingVillagers: villagers(
      { stableID: 'zeta', x: 15, y: 20 },
      { stableID: 'alpha', x: 15, y: 20 },
      { stableID: 'middle', x: 12, y: 20 },
    ),
  })).state
  // One dropped frame crosses all three villagers. Time ordering is primary;
  // stableID is the deterministic tie-breaker.
  const largeStep = advancePitchforksBellWave(state, {
    logicalTimeMs: 120,
    walkingVillagers: villagers(
      { stableID: 'zeta', x: 15, y: 20 },
      { stableID: 'alpha', x: 15, y: 20 },
      { stableID: 'middle', x: 12, y: 20 },
    ),
  })
  assert.deepEqual(largeStep.intents.map(intent => [intent.stableID, intent.contactAtMs]), [
    ['middle', 102],
    ['alpha', 105],
    ['zeta', 105],
  ])
  assert.equal(largeStep.state.phase, 'finished')
  assert.deepEqual(largeStep.state.consumedReceiptIds, ['wave-receipt:run-1:1'])

  const duplicateRelease = releasePitchforksBellWave(largeStep.state, releaseInput({ logicalTimeMs: 120 }))
  assert.equal(duplicateRelease.accepted, false)
  assert.equal(duplicateRelease.reason, 'duplicate-receipt')
  assert.strictEqual(duplicateRelease.state, largeStep.state)
})

check(() => {
  const initial = createPitchforksBellWaveState()
  const first = releasePitchforksBellWave(initial, releaseInput()).state
  const activeReplay = releasePitchforksBellWave(first, releaseInput({
    receipt: { receiptId: 'wave-receipt:run-1:2' },
    logicalTimeMs: 101,
  }))
  assert.equal(activeReplay.accepted, false)
  assert.equal(activeReplay.reason, 'active-wave')
  assert.strictEqual(activeReplay.state, first)

  const finished = advancePitchforksBellWave(first, {
    logicalTimeMs: 400,
    walkingVillagers: villagers(),
  }).state
  assert.equal(finished.phase, 'finished')
  const next = releasePitchforksBellWave(finished, releaseInput({
    receipt: { receiptId: 'wave-receipt:run-1:2' },
    logicalTimeMs: 400,
  }))
  assert.equal(next.accepted, true)
  assert.deepEqual(next.state.consumedReceiptIds, [
    'wave-receipt:run-1:1',
    'wave-receipt:run-1:2',
  ])

  const reset = resetPitchforksBellWaveState(next.state)
  assert.equal(reset.phase, 'idle')
  assert.equal(reset.wave, null)
  assert.deepEqual(reset.consumedReceiptIds, [])
})

check(() => {
  const initial = createPitchforksBellWaveState()
  const released = releasePitchforksBellWave(initial, releaseInput())
  const before = released.state
  const stale = advancePitchforksBellWave(before, {
    logicalTimeMs: 111,
    walkingVillagers: villagers({ stableID: 'villager-near', x: 14, y: 20, alive: false }),
  })
  assert.deepEqual(stale.intents, [])
  assert.equal(stale.state.lastLogicalTimeMs, 111)
  assert.deepEqual(stale.state.contactedStableIDs, [])
  assert.deepEqual(stale.state.invalidatedStableIDs, ['villager-near', 'villager-far'])

  const deadThenLive = advancePitchforksBellWave(stale.state, {
    logicalTimeMs: 112,
    walkingVillagers: villagers({ stableID: 'villager-near', x: 14, y: 20 }),
  })
  assert.deepEqual(deadThenLive.intents, [])
  // The crossing was at 108, before the current live roster returned; no late
  // replay is allowed for a stale/dead target.
  assert.deepEqual(deadThenLive.state.contactedStableIDs, [])

  const stopped = advancePitchforksBellWave(deadThenLive.state, {
    logicalTimeMs: 120,
    walkingVillagers: villagers({ stableID: 'villager-stopped', x: 20, y: 20, walking: false }),
  })
  assert.deepEqual(stopped.intents, [])
})

check(() => {
  const released = releasePitchforksBellWave(createPitchforksBellWaveState(), releaseInput({
    logicalTimeMs: 0,
    bellOrigin: { x: 0, y: 0 },
    waveSpeed: 1,
    waveDurationMs: 20,
    walkingVillagers: villagers({ stableID: 'mutated', x: 0, y: 0 }),
  })).state
  const equalTimeMutation = advancePitchforksBellWave(released, {
    logicalTimeMs: 0,
    walkingVillagers: villagers({ stableID: 'mutated', x: 10, y: 0 }),
  })
  assert.deepEqual(equalTimeMutation.intents, [])
  assert.deepEqual(equalTimeMutation.state.invalidatedStableIDs, ['mutated'])
  const laterResurrection = advancePitchforksBellWave(equalTimeMutation.state, {
    logicalTimeMs: 1,
    walkingVillagers: villagers({ stableID: 'mutated', x: 0, y: 0 }),
  })
  assert.deepEqual(laterResurrection.intents, [])
})

check(() => {
  const initial = createPitchforksBellWaveState()
  for (const input of [
    releaseInput({ logicalTimeMs: Number.NaN }),
    releaseInput({ waveSpeed: 0 }),
    releaseInput({ waveDurationMs: Number.POSITIVE_INFINITY }),
    releaseInput({ bellOrigin: { x: Number.NaN, y: 20 } }),
    releaseInput({ receipt: { receiptId: '' } }),
    releaseInput({ releaseEligible: false }),
    releaseInput({ walkingVillagers: undefined }),
  ]) {
    const rejected = releasePitchforksBellWave(initial, input as never)
    assert.equal(rejected.accepted, false)
    assert.strictEqual(rejected.state, initial)
    assert.equal(rejected.intent, null)
  }

  const released = releasePitchforksBellWave(initial, releaseInput()).state
  const badVillagerInput = advancePitchforksBellWave(released, {
    logicalTimeMs: 110,
    walkingVillagers: [{ stableID: 'bad', x: Number.NaN, y: 20 }],
  })
  assert.equal(badVillagerInput.reason, 'invalid-input')
  assert.strictEqual(badVillagerInput.state, released)
  assert.deepEqual(badVillagerInput.intents, [])

  const badRoster = advancePitchforksBellWave(released, {
    logicalTimeMs: 110,
    walkingVillagers: [{ stableID: 'dup', x: 1, y: 1 }, { stableID: 'dup', x: 2, y: 2 }],
  })
  assert.equal(badRoster.reason, 'invalid-input')
  assert.strictEqual(badRoster.state, released)

  const reversed = advancePitchforksBellWave(released, {
    logicalTimeMs: 99,
    walkingVillagers: villagers(),
  })
  assert.equal(reversed.reason, 'clock-reversed')
  assert.strictEqual(reversed.state, released)
})

check(() => {
  const initial = createPitchforksBellWaveState()
  const observedIdle = advancePitchforksBellWave(initial, {
    logicalTimeMs: 100,
    walkingVillagers: villagers(),
  })
  assert.equal(observedIdle.accepted, true)
  assert.equal(observedIdle.reason, 'not-active')
  assert.equal(observedIdle.state.lastLogicalTimeMs, 100)
  const backwardRelease = releasePitchforksBellWave(observedIdle.state, releaseInput({
    logicalTimeMs: 99,
    walkingVillagers: villagers(),
  }))
  assert.equal(backwardRelease.reason, 'clock-reversed')
  assert.strictEqual(backwardRelease.state, observedIdle.state)
})

check(() => {
  let state = releasePitchforksBellWave(createPitchforksBellWaveState(), releaseInput({
    waveSpeed: 1,
    waveDurationMs: 20,
    walkingVillagers: villagers({ stableID: 'origin', x: 10, y: 20 }),
  })).state
  const pause = advancePitchforksBellWave(state, {
    logicalTimeMs: 100,
    walkingVillagers: villagers({ stableID: 'origin', x: 10, y: 20 }),
  })
  assert.equal(pause.intents.length, 0)
  state = pause.state
  const repeatedPause = advancePitchforksBellWave(state, {
    logicalTimeMs: 100,
    walkingVillagers: villagers({ stableID: 'origin', x: 10, y: 20 }),
  })
  assert.deepEqual(repeatedPause.intents, [])
  assert.strictEqual(repeatedPause.state, state)

  const firstAdvance = advancePitchforksBellWave(state, {
    logicalTimeMs: 101,
    walkingVillagers: villagers({ stableID: 'origin', x: 10, y: 20 }),
  })
  assert.equal(firstAdvance.intents.length, 1)
  assert.equal(firstAdvance.intents[0]?.stableID, 'origin')
  state = firstAdvance.state
  assert.deepEqual(advancePitchforksBellWave(state, {
    logicalTimeMs: 102,
    walkingVillagers: villagers({ stableID: 'origin', x: 10, y: 20 }),
  }).intents, [])

  const projection = getPitchforksBellWaveProjection(state, 110)
  assert.strictEqual(projectPitchforksBellWave, getPitchforksBellWaveProjection)
  assert.equal(projection.visible, true)
  assert.equal(projection.radius, 10)
  assert.equal(projection.maxRadius, 20)
  assert.equal(projection.progress, 0.5)
  assert.deepEqual(projection.bellOrigin, { x: 10, y: 20 })
  assert.equal(Object.isFrozen(projection), true)
})

console.log(`pitchforks Bell Wave pure lifecycle: ${checks}/${checks} PASS`)
