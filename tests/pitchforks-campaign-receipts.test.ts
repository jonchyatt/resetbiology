import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createPitchforksPresentationJourney,
  parsePitchforksPresentationJourney,
  type PitchforksVillageBinding,
  type PitchforksVillageCurriculum,
  type PitchforksVillageClearReceipt,
  type PitchforksBellTowerClearReceipt,
  type PitchforksCathedralClearReceipt,
} from '../src/components/PitchDefender/pitchforksCurriculum'

const identity = { version: 1 as const, rangeAssessedAt: '2026-09-13T00:00:00Z', startedAt: '2026-09-13T01:00:00Z' }
const order = ['C4', 'D4', 'F4', 'E4', 'G4', 'A4']
const bindings: PitchforksVillageBinding[] = [
  { objective: 'perfect-fifth', contextNote: 'G4', targetNote: 'C4' },
  { objective: 'minor-third', contextNote: 'D4', targetNote: 'F4' },
  { objective: 'major-third', contextNote: 'C4', targetNote: 'E4' },
]
const villageCurriculum: PitchforksVillageCurriculum = { ...identity, bindings, boundAt: 0 }
const villageClear: PitchforksVillageClearReceipt = { ...identity, bindings: bindings.slice(0, 1), clearedAt: 1.5 }
const bellTowerClear: PitchforksBellTowerClearReceipt = { ...identity, admittedNotes: ['E4', 'G4'], clearedAt: 2 }
const cathedralClear: PitchforksCathedralClearReceipt = { ...identity, admittedNotes: ['G4', 'C4'], clearedAt: 3 }
const dungeonClear = { ...identity, admittedNotes: order.slice(0, 2), clearedAt: 1 }
const base = createPitchforksPresentationJourney({ ...identity, unlockedNotes: order, guidedNotes: ['C4'], dungeonClear, villagePractice: [] })
const fields = { villageCurriculum, villageClear, bellTowerClear, cathedralClear }
const full = { ...base, ...fields, currentLevel: 9 }
const parse = (value: unknown) => parsePitchforksPresentationJourney(JSON.stringify(value), identity.rangeAssessedAt, order)

test('old saves remain unchanged and current level survives parsing', () => {
  assert.deepEqual(parse(base), base)
  assert.deepEqual(parse(full), full)
})

test('create and parse retain every optional field and clone frozen evidence', () => {
  const created = createPitchforksPresentationJourney({ ...base, ...fields })
  assert.deepEqual(created, { ...full, currentLevel: 1 })
  assert.deepEqual(parse(created), created)
  assert.notEqual(created.villageCurriculum!.bindings, bindings)
  assert.notEqual(created.villageCurriculum!.bindings[0], bindings[0])
  assert.notEqual(created.bellTowerClear!.admittedNotes, bellTowerClear.admittedNotes)
})

test('append-only curriculum order and earlier clear subset survive expansion', () => {
  const earlier = { ...full, unlockedNotes: order.slice(0, 5) }
  assert.deepEqual(parse(earlier), earlier)
  assert.deepEqual(parse(full)!.villageClear, villageClear)
  assert.deepEqual(parse(full)!.villageCurriculum!.bindings, bindings)
})

for (const field of Object.keys(fields) as (keyof typeof fields)[]) {
  test(`${field}: malformed identity/version/timestamp omits only that field`, () => {
    const timestamp = field === 'villageCurriculum' ? 'boundAt' : 'clearedAt'
    const malformed = [null, [], 'receipt', {},
      { ...fields[field], version: 2 },
      { ...fields[field], rangeAssessedAt: 'another range' },
      { ...fields[field], startedAt: 'another journey' },
      ...[-1, NaN, Infinity, '2', null, undefined].map(value => ({ ...fields[field], [timestamp]: value })),
    ]
    for (const value of malformed) {
      const expected = { ...full }
      delete expected[field]
      assert.deepEqual(parse({ ...full, [field]: value }), expected)
      const created = createPitchforksPresentationJourney({ ...full, [field]: value } as never)
      assert.deepEqual(created, { ...expected, currentLevel: 1 })
    }
  })
}

for (const field of ['villageCurriculum', 'villageClear'] as const) {
  test(`${field}: dense nonempty unique objectives and exact admitted triples required`, () => {
    const badBindings = [[], new Array(1), [null], [bindings[0], bindings[0]],
      [{ ...bindings[0], objective: 'minor-third' }],
      [{ ...bindings[0], contextNote: 'G5' }],
      [{ ...bindings[0], targetNote: 'B4' }],
      [{ ...bindings[0], objective: 'octave' }],
      [{ objective: 'major-third', contextNote: 'D4', targetNote: 'F#4' }],
    ]
    for (const invalid of badBindings) {
      const value = { ...full, [field]: { ...fields[field], bindings: invalid } }
      const expected = { ...full }
      delete expected[field]
      assert.deepEqual(parse(value), expected)
      assert.deepEqual(createPitchforksPresentationJourney(value as never), { ...expected, currentLevel: 1 })
    }
  })
}

for (const field of ['bellTowerClear', 'cathedralClear'] as const) {
  test(`${field}: frozen subset accepted; empty, sparse, duplicate, and outside notes omitted`, () => {
    for (const admittedNotes of [[], ['C4'], new Array(2), ['C4', 'C4'], ['C4', 'B4'], ['C4', 4]]) {
      const value = { ...full, [field]: { ...fields[field], admittedNotes } }
      const expected = { ...full }
      delete expected[field]
      assert.deepEqual(parse(value), expected)
      assert.deepEqual(createPitchforksPresentationJourney(value as never), { ...expected, currentLevel: 1 })
    }
  })
}

test('unadmitted assessed endpoints rejected; malformed practice does not erase clears', () => {
  const limited = { ...base, unlockedNotes: ['C4', 'D4'], villageCurriculum }
  assert.equal(parse(limited)!.villageCurriculum, undefined)
  const malformedPractice = parse({ ...full, villagePractice: [null] })!
  assert.equal(malformedPractice.villagePractice, undefined)
  for (const field of Object.keys(fields) as (keyof typeof fields)[]) assert.deepEqual(malformedPractice[field], fields[field])
  assert.deepEqual(malformedPractice.dungeonClear, dungeonClear)
})

test('normalization strips extraneous data without reselecting or sorting evidence', () => {
  const normalized = parse({ ...full, villageCurriculum: { ...villageCurriculum, extra: true,
    bindings: bindings.map(binding => ({ ...binding, bothVoiceAdmitted: false, extra: true })) } })!
  assert.deepEqual(normalized.villageCurriculum, villageCurriculum)
})
