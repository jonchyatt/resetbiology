import assert from 'node:assert/strict'
import type { NoteMemory } from '../src/lib/fsrs'
import {
  advancePitchforksCampaignProgress,
  advancePitchforksVillageProgress,
  advancePitchforksExaminationProgress,
  bindPitchforksVillageCurriculum,
  projectPitchforksWorldGates,
  type PitchforksVillageProgressInput,
} from '../src/components/PitchDefender/pitchforksCampaignProgress'
import {
  createPitchforksPresentationJourney,
  parsePitchforksPresentationJourney,
  type PitchforksPresentationJourney,
} from '../src/components/PitchDefender/pitchforksCurriculum'
import { getVillageLessonCandidates } from '../src/components/PitchDefender/villageLessonSelector'
import { recordVillagePractice, type VillagePracticeReceipt } from '../src/components/PitchDefender/villagePractice'
import { isWorldUnlocked } from '../src/components/PitchDefender/pitchforks3WorldRegistry'

let checks = 0
function check(name: string, run: () => void) {
  try { run(); checks += 1 } catch (error) { throw new Error(name, { cause: error }) }
}
const nowMs = 1_000_000
const rangeAssessedAt = '2026-09-13T18:00:00.000Z'
const startedAt = '2026-09-13T18:01:00.000Z'
const notes = ['C4', 'E4', 'G4']
const comfortableRange = { lowNote: 'C4', highNote: 'G4' }
const base = { ...createPitchforksPresentationJourney({
  rangeAssessedAt, startedAt, unlockedNotes: notes, guidedNotes: ['C4'],
}), currentLevel: 7 }
const voiceMemory: Record<string, NoteMemory> = Object.fromEntries(notes.map(note => [note, {
  note, S: 21, D: 5, due: nowMs - 1, lastReview: nowMs - 10,
  lapses: 0, phase: 'review', learningReps: 2,
}]))
const masteryRecords = Object.fromEntries(notes.map(note => [note, {
  sessionIds: ['one', 'two', 'three'], masteredAt: nowMs - 10,
}]))
function input(journey: PitchforksPresentationJourney = base): PitchforksVillageProgressInput {
  return { journey, rangeAssessedAt, startedAt, normalVoice: true, demo: false,
    simulated: false, comfortableRange, voiceMemory, masteryRecords, nowMs }
}
function reparse(journey: PitchforksPresentationJourney) {
  const parsed = parsePitchforksPresentationJourney(JSON.stringify(journey), rangeAssessedAt, journey.unlockedNotes)
  assert.ok(parsed)
  assert.deepEqual(parsed, journey)
  return parsed
}
function withPractice(journey: PitchforksPresentationJourney) {
  assert.ok(journey.villageCurriculum)
  const villagePractice = journey.villageCurriculum.bindings.reduce<readonly VillagePracticeReceipt[]>((previous, binding, index) =>
    recordVillagePractice(previous, {
      ...binding, eventId: `return-${index}`, journeyId: startedAt, sessionId: 'practice',
      introducedEncounterIndex: index, encounterIndex: index + 5, timestampMs: nowMs - 1,
      support: 'UNAIDED_RETURN', correct: true, cueFree: true, normalVoice: true,
      demo: false, simulated: false,
      candidateEligibility: { admittedNotes: notes, introducedNotes: notes, comfortableRange },
    }), [])
  assert.equal(villagePractice.length, journey.villageCurriculum.bindings.length)
  return { ...journey, villagePractice }
}

const bound = bindPitchforksVillageCurriculum(base, comfortableRange, nowMs)
check('canonical binding and idempotence', () => {
  const candidates = getVillageLessonCandidates({ admittedNotes: notes, introducedNotes: notes, comfortableRange })
  assert.equal(bound.villageCurriculum?.bindings.length, 3)
  for (const binding of bound.villageCurriculum!.bindings) {
    const first = candidates.find(candidate => candidate.objective === binding.objective && candidate.bothVoiceAdmitted)!
    assert.deepEqual(binding, { objective: first.objective, contextNote: first.contextNote, targetNote: first.targetNote })
  }
  assert.equal(base.villageCurriculum, undefined)
  assert.strictEqual(bindPitchforksVillageCurriculum(bound, comfortableRange, nowMs + 1), bound)
  reparse(bound)
})
check('append absent objectives without changing old binding or timestamp', () => {
  const small = createPitchforksPresentationJourney({ rangeAssessedAt, startedAt, unlockedNotes: ['C4', 'G4'] })
  const first = bindPitchforksVillageCurriculum(small, comfortableRange, 10)
  assert.equal(first.villageCurriculum?.bindings.length, 1)
  const snapshot = structuredClone(first)
  const expanded = bindPitchforksVillageCurriculum({ ...first, unlockedNotes: ['C4', 'G4', 'E4'] }, comfortableRange, 20)
  assert.equal(expanded.villageCurriculum?.bindings.length, 3)
  assert.deepEqual(expanded.villageCurriculum?.bindings[0], first.villageCurriculum?.bindings[0])
  assert.equal(expanded.villageCurriculum?.boundAt, 10)
  assert.deepEqual(first, snapshot)
  reparse(expanded)
})
check('no fabricated binding for empty candidate set or invalid time/range', () => {
  const pair = createPitchforksPresentationJourney({ rangeAssessedAt, startedAt, unlockedNotes: ['C4', 'D4'] })
  assert.strictEqual(bindPitchforksVillageCurriculum(pair, comfortableRange, nowMs), pair)
  for (const time of [-1, NaN, Infinity]) assert.strictEqual(bindPitchforksVillageCurriculum(base, comfortableRange, time), base)
  assert.strictEqual(bindPitchforksVillageCurriculum(base, { lowNote: 'G4', highNote: 'C4' }, nowMs), base)
})

const practiced = withPractice(bound)
const dungeon = advancePitchforksCampaignProgress(input(practiced))
check('Dungeon adds receipt without destroying curriculum, practice, or level', () => {
  assert.equal(dungeon.reason, 'dungeon-cleared')
  assert.deepEqual(dungeon.journey.villagePractice, practiced.villagePractice)
  assert.deepEqual(dungeon.journey.villageCurriculum, practiced.villageCurriculum)
  assert.equal(dungeon.journey.currentLevel, 7)
  assert.deepEqual(dungeon.journey.guidedNotes, ['C4'])
  reparse(dungeon.journey)
})
const village = advancePitchforksVillageProgress(input(dungeon.journey))
check('due mastered notes and directed unaided practice earn Village clear', () => {
  assert.equal(village.reason, 'village-cleared')
  assert.equal(village.changed, true)
  assert.deepEqual(village.journey.villageClear?.bindings, bound.villageCurriculum?.bindings)
  assert.deepEqual(village.journey.dungeonClear, dungeon.journey.dungeonClear)
  assert.deepEqual(projectPitchforksWorldGates(reparse(village.journey)).bossClears, ['dungeon', 'village-gate'])
  assert.equal(isWorldUnlocked('bell-tower', projectPitchforksWorldGates(village.journey)), true)
})

for (const [name, changes] of Object.entries({
  demo: { demo: true }, simulation: { simulated: true }, keyboard: { normalVoice: false },
  missingVoice: { voiceMemory: {} }, missingMastery: { masteryRecords: {} },
  corruptVoice: { voiceMemory: { ...voiceMemory, C4: { ...voiceMemory.C4, D: NaN } } },
  badTime: { nowMs: NaN }, wrongJourney: { startedAt: 'other' },
  wrongRange: { rangeAssessedAt: 'other' },
  outsideRange: { comfortableRange: { lowNote: 'E4', highNote: 'G4' } },
})) check(`Village rejects ${name}`, () => {
  const result = advancePitchforksVillageProgress({ ...input(dungeon.journey), ...changes })
  assert.equal(result.changed, false)
  assert.strictEqual(result.journey, dungeon.journey)
})
for (const [name, journey] of Object.entries({
  noDungeon: practiced,
  noCurriculum: { ...dungeon.journey, villageCurriculum: undefined },
  noPractice: { ...dungeon.journey, villagePractice: [] },
  missingObjective: { ...dungeon.journey, villagePractice: practiced.villagePractice.slice(1) },
  supportedOnly: { ...dungeon.journey, villagePractice: practiced.villagePractice.map(receipt => ({ ...receipt, support: 'SUPPORTED' as const })) },
})) check(`Village rejects ${name}`, () => {
  assert.equal(advancePitchforksVillageProgress(input(journey)).changed, false)
})

function exam(journey: PitchforksPresentationJourney, world: 'bell-tower' | 'cathedral') {
  const admittedNotes = world === 'bell-tower'
    ? [...new Set(journey.villageClear?.bindings.flatMap(binding => [binding.contextNote, binding.targetNote]) ?? [])]
    : [...journey.unlockedNotes]
  return { ...input(journey), world, passed: true, admittedNotes }
}
const bell = advancePitchforksExaminationProgress(exam(village.journey, 'bell-tower'))
const cathedral = advancePitchforksExaminationProgress(exam(bell.journey, 'cathedral'))
check('connected examinations persist their own frozen admitted-note set', () => {
  assert.equal(bell.reason, 'bell-tower-cleared')
  assert.equal(cathedral.reason, 'cathedral-cleared')
  assert.deepEqual(bell.journey.bellTowerClear?.admittedNotes, ['G4', 'E4', 'C4'])
  assert.deepEqual(cathedral.journey.cathedralClear?.admittedNotes, notes)
  assert.deepEqual(cathedral.journey.villagePractice, practiced.villagePractice)
  assert.deepEqual(cathedral.journey.bellTowerClear, bell.journey.bellTowerClear)
  assert.equal(cathedral.journey.currentLevel, 7)
  assert.deepEqual(projectPitchforksWorldGates(reparse(cathedral.journey)).bossClears,
    ['dungeon', 'village-gate', 'bell-tower', 'cathedral'])
})
for (const world of ['bell-tower', 'cathedral'] as const) {
  const prior = world === 'bell-tower' ? village.journey : bell.journey
  for (const [name, changes] of Object.entries({
    demo: { demo: true }, simulation: { simulated: true }, keyboard: { normalVoice: false },
    failed: { passed: false }, missingVoice: { voiceMemory: {} }, missingMastery: { masteryRecords: {} },
    emptyNotes: { admittedNotes: [] }, duplicateNotes: { admittedNotes: ['C4', 'C4'] },
    easierSubset: { admittedNotes: ['G4', 'C4'] },
    wrongOrder: { admittedNotes: [...exam(prior, world).admittedNotes].reverse() },
    sparseNotes: { admittedNotes: [, 'C4'] as string[] }, outsideNotes: { admittedNotes: ['C4', 'D4'] },
    time: { nowMs: -1 }, identity: { startedAt: 'other' },
  })) check(`${world} rejects ${name}`, () => {
    const result = advancePitchforksExaminationProgress({ ...exam(prior, world), ...changes })
    assert.equal(result.changed, false)
    assert.strictEqual(result.journey, prior)
  })
}
check('receipt gaps and malformed prior receipts cannot unlock examinations', () => {
  for (const journey of [
    { ...village.journey, dungeonClear: undefined },
    { ...bell.journey, villageClear: undefined },
    { ...bell.journey, dungeonClear: { ...dungeon.journey.dungeonClear!, startedAt: 'other' } },
  ]) {
    assert.equal(isWorldUnlocked('bell-tower', projectPitchforksWorldGates(journey)), false)
    assert.equal(advancePitchforksExaminationProgress(exam(journey, 'cathedral')).changed, false)
  }
  assert.equal(advancePitchforksExaminationProgress(exam(village.journey, 'cathedral')).changed, false)
  assert.equal(advancePitchforksExaminationProgress(exam(dungeon.journey, 'bell-tower')).changed, false)
})
check('save/reparse repetitions never re-award or revoke on lapse', () => {
  const saved = reparse(cathedral.journey)
  for (const result of [
    advancePitchforksCampaignProgress({ ...input(saved), voiceMemory: {}, masteryRecords: {}, nowMs: nowMs + 100 }),
    advancePitchforksVillageProgress({ ...input(saved), voiceMemory: {}, masteryRecords: {}, nowMs: nowMs + 100 }),
    advancePitchforksExaminationProgress({ ...exam(saved, 'bell-tower'), passed: false, voiceMemory: {}, nowMs: nowMs + 100 }),
    advancePitchforksExaminationProgress({ ...exam(saved, 'cathedral'), passed: false, voiceMemory: {}, nowMs: nowMs + 100 }),
  ]) {
    assert.equal(result.reason, 'already-cleared')
    assert.equal(result.changed, false)
    assert.strictEqual(result.journey, saved)
  }
})
check('all transitions are pure and keep first awards after arsenal expansion', () => {
  const snapshot = structuredClone(cathedral.journey)
  Object.freeze(cathedral.journey)
  advancePitchforksVillageProgress(input(cathedral.journey))
  advancePitchforksExaminationProgress(exam(cathedral.journey, 'cathedral'))
  assert.deepEqual(cathedral.journey, snapshot)
  const expanded = reparse({ ...cathedral.journey, unlockedNotes: [...notes, 'A4'] })
  assert.deepEqual(expanded.villageClear, snapshot.villageClear)
  assert.deepEqual(expanded.cathedralClear, snapshot.cathedralClear)
})
console.log(`pitchforks connected-campaign contract: ${checks}/${checks} PASS`)
