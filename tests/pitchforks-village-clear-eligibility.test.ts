import assert from 'node:assert/strict'
import type { NoteMemory } from '../src/lib/fsrs'
import { recordVillagePractice, type VillagePracticeReceipt } from '../src/components/PitchDefender/villagePractice'
import { projectPitchforksMastery } from '../src/components/PitchDefender/pitchforksMasteryProjection'
import {
  projectVillageClearEligibility,
  type VillageClearBinding,
  type VillageClearEligibilityInput,
} from '../src/components/PitchDefender/villageClearEligibility'

const nowMs = 1_000_000
const journeyId = '2026-09-13T13:00:00.000Z'
const admittedNotes = ['C4', 'E4', 'G4']
const comfortableRange = { lowNote: 'C4', highNote: 'G4' }
const bindings: readonly VillageClearBinding[] = [
  { objective: 'major-third', contextNote: 'C4', targetNote: 'E4' },
  { objective: 'minor-third', contextNote: 'E4', targetNote: 'G4' },
  { objective: 'perfect-fifth', contextNote: 'G4', targetNote: 'C4' },
]

function memory(note: string, overrides: Partial<NoteMemory> = {}): NoteMemory {
  return { note, S: 21, D: 5, due: nowMs + 1, lastReview: nowMs - 1,
    lapses: 0, phase: 'review', learningReps: 2, ...overrides }
}

// Positive evidence comes from the existing validated writer, not hand-shaped
// success fixtures. Both ascending and descending directed objectives occur.
const practiceReceipts = bindings.reduce<readonly VillagePracticeReceipt[]>((previous, binding, index) =>
  recordVillagePractice(previous, {
    ...binding, eventId: `event-${index}`, journeyId, sessionId: 'practice-session',
    introducedEncounterIndex: index, encounterIndex: index + 5,
    timestampMs: nowMs - 1, support: 'UNAIDED_RETURN', correct: true,
    normalVoice: true, demo: false, simulated: false, cueFree: true,
    candidateEligibility: { admittedNotes, introducedNotes: admittedNotes, comfortableRange },
  }), [])
assert.equal(practiceReceipts.length, bindings.length)

function input(overrides: Partial<VillageClearEligibilityInput> = {}): VillageClearEligibilityInput {
  return {
    journeyId, bindings, admittedNotes, comfortableRange, practiceReceipts,
    voiceMemory: Object.fromEntries(admittedNotes.map(note => [note, memory(note)])),
    masteryRecords: Object.fromEntries(admittedNotes.map(note => [note,
      { sessionIds: ['one', 'two', 'three'], masteredAt: nowMs - 1 }])),
    nowMs, normalVoice: true, demo: false, simulated: false, ...overrides,
  }
}

let checks = 0
function check(name: string, value: VillageClearEligibilityInput, expected = false): void {
  const result = projectVillageClearEligibility(value)
  assert.equal(result.eligible, expected, name)
  assert.ok(result.reason.length > 0, `${name}: plain reason`)
  assert.ok(Object.isFrozen(result))
  checks += 1
}

check('complete current directed coverage', input(), true)
check('no bindings', input({ bindings: [] }))
check('no receipts (Dungeon-only history)', input({ practiceReceipts: [] }))
check('missing one objective', input({ practiceReceipts: practiceReceipts.slice(1) }))
check('duplicates cannot replace missing objectives', input({
  practiceReceipts: [practiceReceipts[0], practiceReceipts[0], practiceReceipts[0]],
}))
check('reused event identity across objectives', input({
  practiceReceipts: practiceReceipts.map(receipt => ({ ...receipt, eventId: 'replayed' })),
}))
check('fresh event ids on one pair cannot fill other pairs', input({
  practiceReceipts: practiceReceipts.map((_, index) => ({ ...practiceReceipts[0], eventId: `copy-${index}` })),
}))
check('supported-only', input({ practiceReceipts: practiceReceipts.map(receipt => ({ ...receipt, support: 'SUPPORTED' })) }))
check('different journey', input({ journeyId: 'other-journey' }))
check('opposite direction is a different objective', input({
  bindings: [{ ...bindings[0], contextNote: 'E4', targetNote: 'C4' }],
}))
check('wrong objective for same literal pair', input({ bindings: [{ ...bindings[0], objective: 'perfect-fifth' }] }))
check('unadmitted context', input({ admittedNotes: ['E4', 'G4'] }))
check('unadmitted target', input({ admittedNotes: ['C4', 'G4'] }))
check('outside assessed range', input({ comfortableRange: { lowNote: 'D4', highNote: 'G4' } }))
check('reversed range', input({ comfortableRange: { lowNote: 'G4', highNote: 'C4' } }))
check('enharmonic alias does not substitute for literal endpoint', input({
  bindings: [{ ...bindings[0], contextNote: 'B#3' }],
}))
check('unbound notes do not enlarge caller curriculum', input({ admittedNotes: [...admittedNotes, 'F4'] }), true)
check('demo input', input({ demo: true }))
check('simulated input', input({ simulated: true }))
check('ear input', input({ normalVoice: false }))

for (const note of admittedNotes) {
  for (const overrides of [
    { lastReview: nowMs + 1 }, { S: Number.NaN },
  ]) check(`${note} lacks current retained mastery: ${JSON.stringify(overrides)}`, input({
    voiceMemory: { ...input().voiceMemory, [note]: memory(note, overrides) },
  }))
  check(`${note} missing memory`, input({
    voiceMemory: Object.fromEntries(admittedNotes.filter(value => value !== note).map(value => [value, memory(value)])),
  }))
  check(`${note} has only repeated historical sessions`, input({
    masteryRecords: { ...input().masteryRecords, [note]: { sessionIds: ['one', 'one', 'two'], masteredAt: nowMs - 1 } },
  }))
}
check('missing mastery records', input({ masteryRecords: undefined }))
check('future mastery', input({ masteryRecords: {
  ...input().masteryRecords, C4: { sessionIds: ['one', 'two', 'three'], masteredAt: nowMs + 1 },
} }))
check('existing exact due boundary remains current', input({
  voiceMemory: Object.fromEntries(admittedNotes.map(note => [note, memory(note, { due: nowMs })])),
}), true)
check('evaluation time advances beyond due', input({ nowMs: nowMs + 2 }), true)
const lapsed = input({ voiceMemory: { ...input().voiceMemory, C4: memory('C4', { phase: 'learning', due: nowMs - 1 }) } })
assert.equal(projectPitchforksMastery(lapsed).worldClear, true, 'existing mastery authority retained under Fable157')
check('due review preserves earned mastery authority', lapsed, true)

for (const patch of [
  { cueFree: false }, { encounterIndex: 0 }, { introducedEncounterIndex: -1 },
  { encounterIndex: 1.5 }, { timestampMs: nowMs + 1 }, { timestampMs: Number.NaN },
  { sessionId: ' ' }, { eventId: '' }, { kind: 'dungeon' }, { demo: true },
  { simulated: true }, { correct: false }, { objective: 'minor-third' },
]) check(`invalid receipt ${JSON.stringify(patch)}`, input({
  practiceReceipts: [{ ...practiceReceipts[0], ...patch }, ...practiceReceipts.slice(1)] as readonly VillagePracticeReceipt[],
}))

for (const malformed of [null, undefined, {}, {
  ...input(), bindings: new Array(1),
}, { ...input(), bindings: [null] }, { ...input(), admittedNotes: new Array(3) },
{ ...input(), practiceReceipts: [null] }, { ...input(), comfortableRange: null },
{ ...input(), nowMs: Number.NaN }, { ...input(), nowMs: -1 },
{ ...input(), journeyId: ' whitespace ' }, { ...input(), demo: undefined },
]) check('malformed runtime input fails closed', malformed as VillageClearEligibilityInput)

const frozenInput = input()
const before = structuredClone(frozenInput)
function freezeDeep(value: unknown): void {
  if (value === null || typeof value !== 'object') return
  Object.values(value).forEach(freezeDeep)
  Object.freeze(value)
}
freezeDeep(frozenInput)
check('deeply frozen snapshots are accepted', frozenInput, true)
assert.deepEqual(frozenInput, before, 'projection leaves all caller snapshots unchanged')
console.log(`pitchforks village clear eligibility: PASS (${checks} checks)`)
