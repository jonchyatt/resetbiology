import assert from 'node:assert/strict'

import type { NoteMemory } from '../src/lib/fsrs'
import {
  projectPitchforksMastery,
  type PitchforksMasteryProjectionInput,
} from '../src/components/PitchDefender/pitchforksMasteryProjection'

const nowMs = 1_000_000

function memory(
  note: string,
  overrides: Partial<NoteMemory> = {},
): NoteMemory {
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

function input(overrides: Partial<PitchforksMasteryProjectionInput> = {}): PitchforksMasteryProjectionInput {
  return {
    admittedNotes: ['C4'],
    voiceMemory: { C4: memory('C4') },
    earMemory: { C4: memory('C4') },
    masteryRecords: {},
    nowMs,
    ...overrides,
  }
}

// VOICE and EAR are separate snapshots. Their due and phase values never
// collapse into one lane.
const separate = projectPitchforksMastery(input({
  voiceMemory: { C4: memory('C4', { due: nowMs - 1, phase: 'review' }) },
  earMemory: { C4: memory('C4', { due: nowMs + 1, phase: 'learning' }) },
}))
assert.deepEqual(separate.notes[0], {
  note: 'C4',
  voiceDue: true,
  voiceStatus: 'review',
  earDue: false,
  earStatus: 'learning',
  voiceEverMastered: false,
  voiceMastery: {
    rawSourceKeys: ['pitch_fsrs_memory', 'pitchforks3_mastery_progress'],
    sessionIds: [],
    masteredAt: null,
  },
})
assert.equal(separate.worldClear, false)

// Missing/malformed snapshots fail closed without throwing, and missing EAR
// data cannot be mistaken for an EAR mastery receipt.
const missing = projectPitchforksMastery(input({
  voiceMemory: undefined,
  earMemory: { C4: { note: 'C4', phase: 'review' } as unknown as NoteMemory },
  masteryRecords: {
    C4: { sessionIds: ['s1', 's2'], masteredAt: Number.NaN },
  },
}))
assert.equal(missing.notes[0].voiceStatus, 'missing')
assert.equal(missing.notes[0].earStatus, 'invalid')
assert.equal(missing.notes[0].voiceDue, false)
assert.equal(missing.notes[0].earDue, false)
assert.equal(missing.notes[0].voiceEverMastered, false)
assert.deepEqual(missing.notes[0].voiceMastery.sessionIds, ['s1', 's2'])
assert.equal(missing.notes[0].voiceMastery.masteredAt, null)
assert.equal(missing.worldClear, false)

const receiptWithoutCurrentVoice = projectPitchforksMastery(input({
  voiceMemory: undefined,
  masteryRecords: {
    C4: { sessionIds: ['session-a', 'session-b', 'session-c'], masteredAt: 500_000 },
  },
}))
assert.equal(receiptWithoutCurrentVoice.notes[0].voiceEverMastered, true)
assert.equal(receiptWithoutCurrentVoice.worldClear, false)

// Duplicate notes render once, and duplicate/empty session IDs never inflate
// the three-distinct-session crossing requirement.
const deduped = projectPitchforksMastery(input({
  admittedNotes: ['C4', 'C4', 'D4'],
  voiceMemory: {
    C4: memory('C4', { S: 21 }),
    D4: memory('D4', { S: 21 }),
  },
  earMemory: {
    C4: memory('C4'),
    D4: memory('D4'),
  },
  masteryRecords: {
    C4: { sessionIds: ['session-a', 'session-a', 'session-b', 'session-c'], masteredAt: 900_000 },
    D4: { sessionIds: ['session-a', 'session-a', ''], masteredAt: 900_001 },
  },
}))
assert.deepEqual(deduped.notes.map(note => note.note), ['C4', 'D4'])
assert.deepEqual(deduped.notes[0].voiceMastery.sessionIds, ['session-a', 'session-b', 'session-c'])
assert.equal(deduped.notes[0].voiceEverMastered, true)
assert.equal(deduped.notes[1].voiceEverMastered, false)
assert.equal(deduped.worldClear, false)

// An empty admitted list is not world clear.
const empty = projectPitchforksMastery(input({ admittedNotes: [] }))
assert.deepEqual(empty.notes, [])
assert.equal(empty.worldClear, false)

// The admitted list uses Pitchforks note syntax, not arbitrary non-empty
// strings. Malformed names are omitted and make the projection fail closed.
const malformedNote = projectPitchforksMastery(input({ admittedNotes: ['not-a-note'] }))
assert.deepEqual(malformedNote.notes, [])
assert.equal(malformedNote.worldClear, false)
const supportedNoteSyntax = projectPitchforksMastery(input({ admittedNotes: ['C#4', 'Cb4'] }))
assert.deepEqual(supportedNoteSyntax.notes.map(note => note.note), ['C#4', 'Cb4'])
assert.equal(supportedNoteSyntax.worldClear, false)

// Valid FSRS states include a fresh note (S=0, lastReview=0), a mature review,
// and a current lapse. Only impossible negative values and future review
// timestamps fail validation.
const validNew = projectPitchforksMastery(input({
  voiceMemory: { C4: memory('C4', { S: 0, due: nowMs, lastReview: 0, phase: 'new', learningReps: 0 }) },
}))
assert.equal(validNew.notes[0].voiceStatus, 'new')
assert.equal(validNew.notes[0].voiceDue, false)
const validMature = projectPitchforksMastery(input({
  masteryRecords: { C4: { sessionIds: ['session-a', 'session-b', 'session-c'], masteredAt: nowMs } },
  voiceMemory: { C4: memory('C4', { S: 21, due: nowMs + 1, lastReview: nowMs - 1, phase: 'review' }) },
}))
assert.equal(validMature.notes[0].voiceStatus, 'review')
assert.equal(validMature.notes[0].voiceEverMastered, true)
assert.equal(validMature.worldClear, true)
const validLapse = projectPitchforksMastery(input({
  voiceMemory: { C4: memory('C4', { S: 0.1, due: nowMs - 1, lastReview: nowMs - 1, phase: 'learning', lapses: 1, learningReps: 0 }) },
}))
assert.equal(validLapse.notes[0].voiceStatus, 'learning')
assert.equal(validLapse.notes[0].voiceDue, true)

for (const field of ['S', 'D', 'due', 'lastReview', 'lapses', 'learningReps'] as const) {
  const invalid = projectPitchforksMastery(input({
    voiceMemory: { C4: memory('C4', { [field]: -1 } as Partial<NoteMemory>) },
  }))
  assert.equal(invalid.notes[0].voiceStatus, 'invalid', `negative ${field} must fail closed`)
  assert.equal(invalid.notes[0].voiceDue, false)
  assert.equal(invalid.worldClear, false)
}
const futureReview = projectPitchforksMastery(input({
  voiceMemory: { C4: memory('C4', { lastReview: nowMs + 1 }) },
}))
assert.equal(futureReview.notes[0].voiceStatus, 'invalid')
assert.equal(futureReview.worldClear, false)

// A future durable receipt is evidence in the raw snapshot but cannot count
// as a historical crossing at the supplied nowMs.
const futureMastery = projectPitchforksMastery(input({
  masteryRecords: {
    C4: { sessionIds: ['session-a', 'session-b', 'session-c'], masteredAt: nowMs + 1 },
  },
}))
assert.equal(futureMastery.notes[0].voiceMastery.masteredAt, nowMs + 1)
assert.equal(futureMastery.notes[0].voiceEverMastered, false)
assert.equal(futureMastery.worldClear, false)
const negativeNow = projectPitchforksMastery(input({
  nowMs: -1,
  masteryRecords: {
    C4: { sessionIds: ['session-a', 'session-b', 'session-c'], masteredAt: 0 },
  },
}))
assert.equal(negativeNow.notes[0].voiceStatus, 'invalid')
assert.equal(negativeNow.notes[0].voiceDue, false)
assert.equal(negativeNow.notes[0].voiceEverMastered, false)
assert.equal(negativeNow.worldClear, false)

// A durable crossing remains earned even when its current VOICE memory is due
// and below the current stability threshold. Due is a separate present-state
// question; no EAR receipt is fabricated from its review phase.
const dueVsDurable = projectPitchforksMastery(input({
  voiceMemory: { C4: memory('C4', { S: 2, due: nowMs - 100 }) },
  earMemory: { C4: memory('C4', { phase: 'review', due: nowMs - 100 }) },
  masteryRecords: {
    C4: { sessionIds: ['session-a', 'session-b', 'session-c'], masteredAt: 700_000 },
  },
}))
assert.equal(dueVsDurable.notes[0].voiceDue, true)
assert.equal(dueVsDurable.notes[0].voiceStatus, 'review')
assert.equal(dueVsDurable.notes[0].voiceEverMastered, true)
assert.equal(dueVsDurable.notes[0].voiceMastery.masteredAt, 700_000)
assert.equal(dueVsDurable.notes[0].earDue, true)
assert.equal(dueVsDurable.notes[0].earStatus, 'review')
assert.equal(dueVsDurable.worldClear, true)

// The projection is pure: no input array, map, record, or session list is
// rewritten while snapshots are normalized for the read model.
const immutableInput = input({
  admittedNotes: ['C4', 'C4'],
  voiceMemory: { C4: memory('C4', { due: nowMs - 1 }) },
  earMemory: { C4: memory('C4') },
  masteryRecords: {
    C4: { sessionIds: ['s1', 's1', 's2', 's3'], masteredAt: 800_000 },
  },
})
const before = structuredClone(immutableInput)
const immutableProjection = projectPitchforksMastery(immutableInput)
assert.deepEqual(immutableInput, before)
assert.equal(Object.isFrozen(immutableProjection), true)
assert.equal(Object.isFrozen(immutableProjection.notes), true)
assert.equal(Object.isFrozen(immutableProjection.notes[0].voiceMastery), true)

const whitespaceSessions = projectPitchforksMastery(input({
  masteryRecords: { C4: { sessionIds: ['same', ' same', 'same '], masteredAt: nowMs - 1 } },
}))
assert.equal(whitespaceSessions.worldClear, false)
assert.equal(whitespaceSessions.notes[0].voiceEverMastered, false)
assert.deepEqual(whitespaceSessions.notes[0].voiceMastery.sessionIds, ['same'])
for (const counter of ['lapses', 'learningReps'] as const) {
  for (const invalid of [0.5, Number.MAX_SAFE_INTEGER + 1]) {
    const fractionalCounter = projectPitchforksMastery(input({
      voiceMemory: { C4: memory('C4', { [counter]: invalid }) },
      masteryRecords: { C4: { sessionIds: ['a', 'b', 'c'], masteredAt: nowMs - 1 } },
    }))
    assert.equal(fractionalCounter.worldClear, false)
    assert.equal(fractionalCounter.notes[0].voiceStatus, 'invalid')
  }
}

console.log('pitchforks mastery projection: PASS — separate lanes, durable progress, and malformed-data controls')
