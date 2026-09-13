import assert from 'node:assert/strict'

import type { NoteMemory } from '../src/lib/fsrs'
import {
  projectPitchforksMastery,
  type PitchforksMasteryProjectionInput,
} from '../src/components/PitchDefender/pitchforksMasteryProjection'
import {
  WORLD_REGISTRY,
  isBossAvailable,
  isWorldUnlocked,
  type WorldGateInput,
  type WorldId,
} from '../src/components/PitchDefender/pitchforks3WorldRegistry'

const nowMs = 1_000_000

function memory(note: string, overrides: Partial<NoteMemory> = {}): NoteMemory {
  return {
    note,
    S: 3,
    D: 5,
    due: nowMs + 10_000,
    lastReview: nowMs - 10_000,
    lapses: 0,
    phase: 'review',
    learningReps: 2,
    ...overrides,
  }
}

function projectionInput(
  overrides: Partial<PitchforksMasteryProjectionInput> = {},
): PitchforksMasteryProjectionInput {
  return {
    admittedNotes: ['C4'],
    voiceMemory: { C4: memory('C4') },
    earMemory: { C4: memory('C4') },
    masteryRecords: {
      C4: { sessionIds: ['session-a', 'session-b', 'session-c'], masteredAt: nowMs },
    },
    nowMs,
    ...overrides,
  }
}

const clearPrefixes: readonly (readonly WorldId[])[] = [
  [],
  ['dungeon'],
  ['dungeon', 'village-gate'],
  ['dungeon', 'village-gate', 'bell-tower'],
  ['dungeon', 'village-gate', 'bell-tower', 'cathedral'],
]

// Content acceptance stays separate from progression unlocks: only Dungeon is
// playable in this candidate registry.
assert.deepEqual(WORLD_REGISTRY.map(world => world.playable), [true, false, false, false])

// The old renderer call remains Dungeon-only when no journey snapshot is
// supplied, preserving its current behavior until policy wiring is approved.
assert.deepEqual(
  WORLD_REGISTRY.map(world => isWorldUnlocked(world.id)),
  [true, false, false, false],
)

// Every world unlocks only from the ordered prefix immediately before it.
for (let index = 0; index < WORLD_REGISTRY.length; index += 1) {
  const world = WORLD_REGISTRY[index]
  const prefix = clearPrefixes[index]
  assert.equal(isWorldUnlocked(world.id, { bossClears: prefix }), true, world.id)

  for (const laterWorld of WORLD_REGISTRY.slice(index + 1)) {
    assert.equal(isWorldUnlocked(laterWorld.id, { bossClears: prefix }), false, laterWorld.id)
  }
}

// Unknown, malformed, out-of-order, duplicate, and sparse clears are treated
// as absent, so they cannot skip ahead in the ladder.
const malformedInputs: readonly unknown[] = [
  { bossClears: ['village-gate'] },
  { bossClears: ['dungeon', 'bell-tower'] },
  { bossClears: ['dungeon', 'dungeon'] },
  { bossClears: ['dungeon', 'village-gate', 'cathedral'] },
  { bossClears: ['dungeon', 'unknown-world'] },
  { bossClears: ['dungeon', null] },
  { bossClears: ['dungeon', , 'bell-tower'] },
  { bossClears: 'dungeon' },
  {},
  null,
]

for (const malformed of malformedInputs) {
  const input = malformed as WorldGateInput
  assert.equal(isWorldUnlocked('village-gate', input), false)
  assert.equal(isWorldUnlocked('bell-tower', input), false)
  assert.equal(isWorldUnlocked('cathedral', input), false)
}

assert.equal(isWorldUnlocked('not-a-world' as WorldId), false)

const clearProjection = projectPitchforksMastery(projectionInput())
assert.equal(clearProjection.worldClear, true)

// A boss is available only at the current frontier, after the projection's
// existing worldClear receipt. Clearing all four leaves no boss frontier.
for (let index = 0; index < clearPrefixes.length; index += 1) {
  const input = { bossClears: clearPrefixes[index] }
  const frontier = WORLD_REGISTRY[index]?.id

  for (const world of WORLD_REGISTRY) {
    assert.equal(
      isBossAvailable(world.id, clearProjection, input),
      world.id === frontier,
      `${world.id} at prefix ${index}`,
    )
  }
}

// Empty admitted notes, corrupt snapshots, and an invalid snapshot time all
// remain closed when evaluated through the actual mastery projection.
const emptyProjection = projectPitchforksMastery(projectionInput({ admittedNotes: [] }))
assert.equal(emptyProjection.worldClear, false)
assert.equal(isBossAvailable('dungeon', emptyProjection), false)

const corruptProjection = projectPitchforksMastery(projectorInputWithCorruptVoice())
assert.equal(corruptProjection.worldClear, false)
assert.equal(isBossAvailable('dungeon', corruptProjection), false)

const invalidNowProjection = projectPitchforksMastery(projectionInput({ nowMs: -1 }))
assert.equal(invalidNowProjection.worldClear, false)
assert.equal(isBossAvailable('dungeon', invalidNowProjection), false)

for (const malformed of malformedInputs) {
  assert.equal(isBossAvailable('dungeon', clearProjection, malformed as WorldGateInput), false)
  assert.equal(isBossAvailable('village-gate', clearProjection, malformed as WorldGateInput), false)
  assert.equal(isBossAvailable('bell-tower', clearProjection, malformed as WorldGateInput), false)
  assert.equal(isBossAvailable('cathedral', clearProjection, malformed as WorldGateInput), false)
}

assert.equal(isBossAvailable('not-a-world' as WorldId, clearProjection), false)

console.log('pitchforks world gates: PASS — ordered prefix, fail-closed journey data, and mastery frontier')

function projectorInputWithCorruptVoice(): PitchforksMasteryProjectionInput {
  return projectionInput({
    voiceMemory: { C4: memory('C4', { D: Number.NaN }) },
  })
}
