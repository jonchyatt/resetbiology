import assert from 'node:assert/strict'

import type { NoteMemory } from '../src/lib/fsrs'
import {
  advancePitchforksCampaignProgress,
  type PitchforksCampaignProgressInput,
} from '../src/components/PitchDefender/pitchforksCampaignProgress'
import {
  createPitchforksPresentationJourney,
  parsePitchforksPresentationJourney,
  type PitchforksDungeonClearReceipt,
} from '../src/components/PitchDefender/pitchforksCurriculum'

let checks = 0
const check = (run: () => void) => {
  run()
  checks += 1
}

const order = ['D4', 'E4', 'C4', 'F4']
const rangeAssessedAt = '2026-09-12T18:00:00.000Z'
const startedAt = '2026-09-12T18:01:00.000Z'
const admittedNotes = ['D4', 'E4']
const receipt: PitchforksDungeonClearReceipt = {
  version: 1,
  rangeAssessedAt,
  startedAt,
  admittedNotes,
  clearedAt: 1234.5,
}

const journey = createPitchforksPresentationJourney({
  rangeAssessedAt,
  startedAt,
  unlockedNotes: order.slice(0, 3),
  guidedNotes: ['D4'],
  dungeonClear: receipt,
})

check(() => assert.deepEqual(journey.dungeonClear, receipt))
check(() => assert.notStrictEqual(journey.dungeonClear, receipt))
check(() => assert.notStrictEqual(journey.dungeonClear?.admittedNotes, receipt.admittedNotes))
check(() => {
  receipt.admittedNotes.push('C4')
  assert.deepEqual(journey.dungeonClear?.admittedNotes, ['D4', 'E4'])
})

const roundTrip = parsePitchforksPresentationJourney(
  JSON.stringify(journey),
  rangeAssessedAt,
  order,
)
check(() => assert.deepEqual(roundTrip, journey))

const legacy = createPitchforksPresentationJourney({
  rangeAssessedAt,
  startedAt,
  unlockedNotes: order.slice(0, 3),
  guidedNotes: ['D4'],
})
check(() => assert.equal('dungeonClear' in legacy, false))
check(() => assert.deepEqual(
  parsePitchforksPresentationJourney(JSON.stringify(legacy), rangeAssessedAt, order),
  legacy,
))

function parseWithReceipt(value: unknown) {
  return parsePitchforksPresentationJourney(
    JSON.stringify({ ...legacy, dungeonClear: value }),
    rangeAssessedAt,
    order,
  )
}

const malformedReceipts: readonly unknown[] = [
  null,
  1,
  { ...receipt, version: 2 },
  { ...receipt, rangeAssessedAt: '2026-09-13T18:00:00.000Z' },
  { ...receipt, startedAt: '2026-09-13T18:01:00.000Z' },
  { ...receipt, admittedNotes: [] },
  { ...receipt, admittedNotes: ['D4'] },
  { ...receipt, admittedNotes: ['D4', 'D4'] },
  { ...receipt, admittedNotes: ['E4', 'D4'] },
  { ...receipt, admittedNotes: ['D4', 'C4'] },
  { ...receipt, admittedNotes: ['A4'] },
  { ...receipt, admittedNotes: [null] },
  { ...receipt, admittedNotes: [, 'D4'] },
  { ...receipt, admittedNotes: 'D4' },
  { ...receipt, clearedAt: -1 },
  { ...receipt, clearedAt: null },
  { ...receipt, clearedAt: '1234' },
]

for (const malformed of malformedReceipts) {
  check(() => assert.deepEqual(
    parseWithReceipt(malformed),
    legacy,
    `invalid optional Dungeon receipt must be discarded: ${JSON.stringify(malformed)}`,
  ))
}

const sparseNotes: string[] = []
sparseNotes[1] = 'D4'
const sparseCreated = createPitchforksPresentationJourney({
  rangeAssessedAt,
  startedAt,
  unlockedNotes: order.slice(0, 3),
  dungeonClear: { ...receipt, admittedNotes: sparseNotes },
})
check(() => assert.equal(sparseCreated.dungeonClear, undefined))

const nonFiniteReceipts: readonly PitchforksDungeonClearReceipt[] = [
  { ...receipt, clearedAt: Number.NaN },
  { ...receipt, clearedAt: Number.POSITIVE_INFINITY },
]
for (const malformed of nonFiniteReceipts) {
  check(() => assert.equal(
    createPitchforksPresentationJourney({
      rangeAssessedAt,
      startedAt,
      unlockedNotes: order.slice(0, 3),
      dungeonClear: malformed,
    }).dungeonClear,
    undefined,
  ))
}

const campaignNowMs = 2_000_000
const campaignRangeAssessedAt = '2026-09-12T19:00:00.000Z'
const campaignStartedAt = '2026-09-12T19:01:00.000Z'
const campaignNotes = ['D4', 'E4']

function campaignMemory(note: string, overrides: Partial<NoteMemory> = {}): NoteMemory {
  return {
    note,
    S: 21,
    D: 5,
    due: campaignNowMs + 10_000,
    lastReview: campaignNowMs - 10_000,
    lapses: 0,
    phase: 'review',
    learningReps: 3,
    ...overrides,
  }
}

function campaignJourney(unlockedNotes: readonly string[] = campaignNotes) {
  return createPitchforksPresentationJourney({
    rangeAssessedAt: campaignRangeAssessedAt,
    startedAt: campaignStartedAt,
    unlockedNotes,
    guidedNotes: [],
  })
}

function campaignVoiceMemory(notes: readonly string[] = campaignNotes): Record<string, NoteMemory> {
  return Object.fromEntries(notes.map(note => [note, campaignMemory(note)]))
}

function campaignMasteryRecords(
  masteredNotes: readonly string[] = campaignNotes,
): Record<string, { sessionIds: string[]; masteredAt: number | null }> {
  return Object.fromEntries(masteredNotes.map(note => [note, {
    sessionIds: [`${note}-session-a`, `${note}-session-b`, `${note}-session-c`],
    masteredAt: campaignNowMs,
  }]))
}

function campaignInput(
  overrides: Partial<PitchforksCampaignProgressInput> = {},
): PitchforksCampaignProgressInput {
  return {
    journey: campaignJourney(),
    rangeAssessedAt: campaignRangeAssessedAt,
    startedAt: campaignStartedAt,
    demo: false,
    simulated: false,
    voiceMemory: campaignVoiceMemory(),
    masteryRecords: campaignMasteryRecords(),
    nowMs: campaignNowMs,
    ...overrides,
  }
}

const allMastered = advancePitchforksCampaignProgress(campaignInput())
check(() => assert.equal(allMastered.changed, true))
check(() => assert.equal(allMastered.reason, 'dungeon-cleared'))
check(() => assert.deepEqual(allMastered.journey.dungeonClear, {
  version: 1,
  rangeAssessedAt: campaignRangeAssessedAt,
  startedAt: campaignStartedAt,
  admittedNotes: campaignNotes,
  clearedAt: campaignNowMs,
}))
check(() => assert.notStrictEqual(allMastered.journey, campaignInput().journey))
check(() => assert.notStrictEqual(
  allMastered.journey.dungeonClear?.admittedNotes,
  allMastered.journey.unlockedNotes,
))

const oneUnmastered = advancePitchforksCampaignProgress(campaignInput({
  masteryRecords: campaignMasteryRecords(['D4']),
}))
check(() => assert.equal(oneUnmastered.changed, false))
check(() => assert.equal(oneUnmastered.reason, 'not-world-clear'))
check(() => assert.equal(oneUnmastered.journey.dungeonClear, undefined))

const missingVoice = advancePitchforksCampaignProgress(campaignInput({ voiceMemory: undefined }))
check(() => assert.equal(missingVoice.changed, false))
check(() => assert.equal(missingVoice.reason, 'not-world-clear'))

const corruptVoice = advancePitchforksCampaignProgress(campaignInput({
  voiceMemory: {
    D4: campaignMemory('D4', { D: Number.NaN }),
    E4: campaignMemory('E4'),
  },
}))
check(() => assert.equal(corruptVoice.changed, false))
check(() => assert.equal(corruptVoice.reason, 'not-world-clear'))

for (const identity of [
  { rangeAssessedAt: '2026-09-13T19:00:00.000Z', startedAt: campaignStartedAt },
  { rangeAssessedAt: campaignRangeAssessedAt, startedAt: '2026-09-13T19:01:00.000Z' },
]) {
  const wrongIdentity = advancePitchforksCampaignProgress(campaignInput(identity))
  check(() => assert.equal(wrongIdentity.changed, false))
  check(() => assert.equal(wrongIdentity.reason, 'identity-mismatch'))
}

const demo = advancePitchforksCampaignProgress(campaignInput({ demo: true }))
check(() => assert.equal(demo.changed, false))
check(() => assert.equal(demo.reason, 'demo'))
const simulated = advancePitchforksCampaignProgress(campaignInput({ simulated: true }))
check(() => assert.equal(simulated.changed, false))
check(() => assert.equal(simulated.reason, 'simulated'))

for (const nowMs of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
  const invalidTime = advancePitchforksCampaignProgress(campaignInput({ nowMs }))
  check(() => assert.equal(invalidTime.changed, false))
  check(() => assert.equal(invalidTime.reason, 'invalid-time'))
}

const sparsePool: string[] = []
sparsePool[1] = 'E4'
for (const unlockedNotes of [[], ['D4', 'D4'], sparsePool]) {
  const invalidPool = advancePitchforksCampaignProgress(campaignInput({
    journey: campaignJourney(unlockedNotes),
  }))
  check(() => assert.equal(invalidPool.changed, false))
  check(() => assert.equal(invalidPool.reason, 'invalid-unlocked-notes'))
}

const first = advancePitchforksCampaignProgress(campaignInput())
const repeated = advancePitchforksCampaignProgress(campaignInput({ journey: first.journey }))
check(() => assert.equal(repeated.changed, false))
check(() => assert.equal(repeated.reason, 'already-cleared'))
check(() => assert.deepEqual(repeated.journey, first.journey))

const immutableJourney = campaignJourney()
const immutableVoiceMemory = campaignVoiceMemory()
const immutableMasteryRecords = campaignMasteryRecords()
const beforeJourney = structuredClone(immutableJourney)
const beforeVoiceMemory = structuredClone(immutableVoiceMemory)
const beforeMasteryRecords = structuredClone(immutableMasteryRecords)
const immutableResult = advancePitchforksCampaignProgress(campaignInput({
  journey: immutableJourney,
  voiceMemory: immutableVoiceMemory,
  masteryRecords: immutableMasteryRecords,
}))
check(() => assert.deepEqual(immutableJourney, beforeJourney))
check(() => assert.deepEqual(immutableVoiceMemory, beforeVoiceMemory))
check(() => assert.deepEqual(immutableMasteryRecords, beforeMasteryRecords))
check(() => assert.equal(immutableResult.journey.dungeonClear?.clearedAt, campaignNowMs))

const dueEarned = advancePitchforksCampaignProgress(campaignInput({
  journey: first.journey,
  voiceMemory: {
    D4: campaignMemory('D4', { S: 0.1, due: campaignNowMs - 1 }),
    E4: campaignMemory('E4', { S: 0.1, due: campaignNowMs - 1 }),
  },
  masteryRecords: {},
  nowMs: campaignNowMs + 100,
}))
check(() => assert.equal(dueEarned.changed, false))
check(() => assert.equal(dueEarned.reason, 'already-cleared'))
check(() => assert.deepEqual(dueEarned.journey.dungeonClear, first.journey.dungeonClear))

console.log(`pitchforks campaign-progress contract: ${checks}/${checks} PASS`)
