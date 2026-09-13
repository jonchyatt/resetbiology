import assert from 'node:assert/strict'

import {
  getVillageLessonCandidates,
  selectVillageLessonCandidate,
} from '../src/components/PitchDefender/villageLessonSelector'

const range = { lowNote: 'D4', highNote: 'A4' }
const allNotes = ['D4', 'E4', 'F4', 'A4'] as const

let checks = 0
const check = (run: () => void) => {
  run()
  checks += 1
}

const candidates = getVillageLessonCandidates({
  admittedNotes: allNotes,
  introducedNotes: allNotes,
  comfortableRange: range,
})

check(() => assert.deepEqual(candidates, [
  { objective: 'minor-third', contextNote: 'F4', targetNote: 'D4', bothVoiceAdmitted: true },
  { objective: 'minor-third', contextNote: 'D4', targetNote: 'F4', bothVoiceAdmitted: true },
  { objective: 'major-third', contextNote: 'A4', targetNote: 'F4', bothVoiceAdmitted: true },
  { objective: 'major-third', contextNote: 'F4', targetNote: 'A4', bothVoiceAdmitted: true },
  { objective: 'perfect-fifth', contextNote: 'A4', targetNote: 'D4', bothVoiceAdmitted: true },
  { objective: 'perfect-fifth', contextNote: 'D4', targetNote: 'A4', bothVoiceAdmitted: true },
]))

check(() => assert.deepEqual(
  getVillageLessonCandidates({
    admittedNotes: ['D4', 'F4', 'A4'],
    introducedNotes: ['D4', 'E4', 'F4', 'A4'],
    comfortableRange: range,
  }),
  [
    { objective: 'minor-third', contextNote: 'F4', targetNote: 'D4', bothVoiceAdmitted: true },
    { objective: 'minor-third', contextNote: 'D4', targetNote: 'F4', bothVoiceAdmitted: true },
    { objective: 'major-third', contextNote: 'A4', targetNote: 'F4', bothVoiceAdmitted: true },
    { objective: 'major-third', contextNote: 'F4', targetNote: 'A4', bothVoiceAdmitted: true },
    { objective: 'perfect-fifth', contextNote: 'A4', targetNote: 'D4', bothVoiceAdmitted: true },
    { objective: 'perfect-fifth', contextNote: 'D4', targetNote: 'A4', bothVoiceAdmitted: true },
  ],
))

check(() => assert.deepEqual(
  getVillageLessonCandidates({
    admittedNotes: ['D4', 'F4'],
    introducedNotes: ['D4', 'E4', 'F4'],
    comfortableRange: range,
  }),
  [{ objective: 'minor-third', contextNote: 'F4', targetNote: 'D4', bothVoiceAdmitted: true },
    { objective: 'minor-third', contextNote: 'D4', targetNote: 'F4', bothVoiceAdmitted: true }],
))

check(() => assert.deepEqual(
  getVillageLessonCandidates({
    admittedNotes: ['F4'],
    introducedNotes: ['D4', 'F4'],
    comfortableRange: range,
  }),
  [{ objective: 'minor-third', contextNote: 'D4', targetNote: 'F4', bothVoiceAdmitted: false }],
))

check(() => assert.deepEqual(
  getVillageLessonCandidates({
    admittedNotes: ['F4'],
    introducedNotes: [],
    comfortableRange: range,
  }),
  [],
))

check(() => assert.deepEqual(
  getVillageLessonCandidates({
    admittedNotes: ['D3', 'D4', 'F4', 'A4', 'A5'],
    introducedNotes: ['D3', 'D4', 'F4', 'A4', 'A5'],
    comfortableRange: range,
  }),
  [
    { objective: 'minor-third', contextNote: 'F4', targetNote: 'D4', bothVoiceAdmitted: true },
    { objective: 'minor-third', contextNote: 'D4', targetNote: 'F4', bothVoiceAdmitted: true },
    { objective: 'major-third', contextNote: 'A4', targetNote: 'F4', bothVoiceAdmitted: true },
    { objective: 'major-third', contextNote: 'F4', targetNote: 'A4', bothVoiceAdmitted: true },
    { objective: 'perfect-fifth', contextNote: 'A4', targetNote: 'D4', bothVoiceAdmitted: true },
    { objective: 'perfect-fifth', contextNote: 'D4', targetNote: 'A4', bothVoiceAdmitted: true },
  ],
))

const permutations = getVillageLessonCandidates({
  admittedNotes: ['A4', 'F4', 'D4', 'F4'],
  introducedNotes: ['A4', 'E4', 'D4', 'F4', 'E4'],
  comfortableRange: range,
})
check(() => assert.deepEqual(permutations, getVillageLessonCandidates({
  admittedNotes: ['D4', 'F4', 'A4'],
  introducedNotes: ['D4', 'E4', 'F4', 'A4'],
  comfortableRange: range,
})))

const admitted = ['A4', 'D4', 'D4']
const introduced = ['F4', 'D4', 'F4']
const limits = { lowNote: 'D4', highNote: 'A4' }
const admittedSnapshot = [...admitted]
const introducedSnapshot = [...introduced]
const limitsSnapshot = { ...limits }
getVillageLessonCandidates({ admittedNotes: admitted, introducedNotes: introduced, comfortableRange: limits })
check(() => {
  assert.deepEqual(admitted, admittedSnapshot)
  assert.deepEqual(introduced, introducedSnapshot)
  assert.deepEqual(limits, limitsSnapshot)
})

for (const value of [
  null,
  undefined,
  {},
  { admittedNotes: 'D4', introducedNotes: ['D4'], comfortableRange: range },
  { admittedNotes: ['D4', undefined], introducedNotes: ['D4'], comfortableRange: range },
  { admittedNotes: [, 'D4'], introducedNotes: ['D4'], comfortableRange: range },
  { admittedNotes: ['D4'], introducedNotes: ['D4'], comfortableRange: null },
  { admittedNotes: ['D4'], introducedNotes: ['D4'], comfortableRange: { lowNote: 'A4', highNote: 'D4' } },
  { admittedNotes: ['D4'], introducedNotes: ['D4'], comfortableRange: { lowNote: 'D4', highNote: 'D4' } },
  { admittedNotes: ['D4'], introducedNotes: ['D4'], comfortableRange: { lowNote: 'C2', highNote: 'A4' } },
]) {
  check(() => assert.deepEqual(getVillageLessonCandidates(value as never), []))
}

check(() => assert.deepEqual(getVillageLessonCandidates({
  admittedNotes: ['D4', 'H4'],
  introducedNotes: ['D4', 'H4'],
  comfortableRange: range,
}), []))

const varietyArgs = {
  admittedNotes: ['F4'],
  introducedNotes: ['D4', 'A4', 'C5'],
  comfortableRange: { lowNote: 'D4', highNote: 'C5' },
  targetNote: 'F4',
} as const
const varietyCandidates = getVillageLessonCandidates(varietyArgs)
check(() => {
  assert.deepEqual(varietyCandidates.map(candidate => candidate.objective), [
    'minor-third', 'major-third', 'perfect-fifth',
  ])
  assert.deepEqual(varietyCandidates.map(candidate => candidate.targetNote), ['F4', 'F4', 'F4'])
})
check(() => assert.deepEqual(
  [0, 1, 2, 3, 4, 5].map(encounterIndex => selectVillageLessonCandidate({
    ...varietyArgs,
    encounterIndex,
  })),
  [
    varietyCandidates[0], varietyCandidates[1], varietyCandidates[2],
    varietyCandidates[0], varietyCandidates[1], varietyCandidates[2],
  ],
))

check(() => {
  for (const encounterIndex of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(selectVillageLessonCandidate({ ...varietyArgs, encounterIndex }), undefined)
  }
  assert.equal(selectVillageLessonCandidate({ ...varietyArgs, targetNote: 'H4', encounterIndex: 0 }), undefined)
  assert.equal(selectVillageLessonCandidate({
    ...varietyArgs,
    introducedNotes: ['D3'],
    encounterIndex: 0,
  }), undefined)
})

const varietyAdmittedSnapshot = [...varietyArgs.admittedNotes]
const varietyIntroducedSnapshot = [...varietyArgs.introducedNotes]
const varietyRangeSnapshot = { ...varietyArgs.comfortableRange }
selectVillageLessonCandidate({ ...varietyArgs, encounterIndex: 0 })
check(() => {
  assert.deepEqual(varietyArgs.admittedNotes, varietyAdmittedSnapshot)
  assert.deepEqual(varietyArgs.introducedNotes, varietyIntroducedSnapshot)
  assert.deepEqual(varietyArgs.comfortableRange, varietyRangeSnapshot)
})

console.log(`village lesson selector contract: ${checks}/${checks} PASS`)
