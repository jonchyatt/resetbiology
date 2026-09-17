import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { createNote, type NoteMemory } from '../src/lib/fsrs'
import { projectPitchforksMastery } from '../src/components/PitchDefender/pitchforksMasteryProjection'
import { createPitchforksSongcraftPractice } from '../src/components/PitchDefender/pitchforksSongcraftPractice'
import { type SongcraftPhrase } from '../src/components/PitchDefender/pitchforksSongcraftPhrase'
import { advanceTempoEncore, canEnterTempoEncore, startTempoEncore, tempoEncoreCurrent,
  tempoEncoreInitialBpm, tempoEncoreRawOffsets, tempoEncoreReceipt } from '../src/components/PitchDefender/pitchforksTempoEncore'
import { advancePitchforksSongcraftVoiceSample, observePitchforksSongcraftGeneration,
  pitchforksSongcraftTargetFrequency, resetPitchforksSongcraftVisibilityState } from '../src/components/PitchDefender/PitchforksSongcraft'

const phrase: SongcraftPhrase = {
  sourceKey: 'pd_composed_tempo_test', title: 'Synthetic timing fixture', sourceSha256: 'a'.repeat(64),
  sourceTempoBpm: 96,
  provenance: { source: 'composer', normalizationVersion: 'songcraft-phrase/1' },
  occurrences: [
    { ordinal: 0, isRest: false, pitchName: 'C4', midi: 60, semi: 0, octave: 4, beats: 1, measureIdx: 1, beatOffset: 0 },
    { ordinal: 1, isRest: true, pitchName: null, midi: null, semi: null, octave: null, beats: 0.5, measureIdx: 1, beatOffset: 1 },
    { ordinal: 2, isRest: false, pitchName: 'C4', midi: 60, semi: 0, octave: 4, beats: 2, measureIdx: 1, beatOffset: 1.5 },
  ],
}

function fixture(assisted = false, source = phrase) {
  let store: Record<string, NoteMemory> = {}
  let writes = 0
  const controller = createPitchforksSongcraftPractice({ phrase: source, attemptId: 'synthetic-untimed', lane: 'voice', admittedNotes: ['C4'], storage: {
    loadStore: () => structuredClone(store),
    saveStore: (_lane, next) => { store = structuredClone(next); writes++; return true },
    readback: (_lane, note) => structuredClone(store[note] ?? null),
  } })
  while (controller.state().status === 'active') {
    const current = controller.state().current
    if (current.kind === 'rest' || current.kind === 'unsupported') controller.acknowledge(current.identity)
    else if (current.kind === 'note') {
      if (assisted) controller.hint(current.identity)
      controller.resolve({ ...current.identity, note: current.occurrence.pitchName!, correct: true })
    } else break
  }
  return { completed: controller.state(), writes: () => writes, store: () => structuredClone(store) }
}

const mastery = projectPitchforksMastery({ admittedNotes: ['C4', 'D4'], nowMs: 100,
  voiceMemory: { C4: createNote('C4') },
  masteryRecords: { C4: { sessionIds: ['one', 'two', 'three'], masteredAt: 50 } },
})
const complete = fixture().completed
const begin = () => startTempoEncore(phrase, complete, mastery, 60, 1000)

test('gate uses real unaided controller summary and per-phrase existing mastery, not unrelated worldClear', () => {
  assert.equal(mastery.worldClear, false)
  assert.equal(canEnterTempoEncore(phrase, complete, mastery), true)
  assert.equal(canEnterTempoEncore(phrase, complete), false)
  assert.equal(canEnterTempoEncore(phrase, null, mastery), false)
  assert.equal(canEnterTempoEncore(phrase, fixture(true).completed, mastery), false)
  for (const flag of ['unaidedComplete', 'masteryEligible', 'traversalComplete'] as const) {
    assert.equal(canEnterTempoEncore(phrase, { ...complete, summary: { ...complete.summary, [flag]: false } }, mastery), false)
  }
  for (const status of ['active', 'pending-save', 'cancelled'] as const) {
    assert.equal(canEnterTempoEncore(phrase, { ...complete, status }, mastery), false)
  }
})

test('source key, hash, normalization, occurrence order, exact octave and duration stay bound', () => {
  assert.equal(canEnterTempoEncore({ ...phrase, sourceKey: 'another' }, complete, mastery), false)
  assert.equal(canEnterTempoEncore({ ...phrase, sourceSha256: 'b'.repeat(64) }, complete, mastery), false)
  assert.equal(canEnterTempoEncore({ ...phrase, occurrences: [...phrase.occurrences].reverse() }, complete, mastery), false)
  for (const change of [{ pitchName: 'C5' }, { midi: 72 }, { beats: 3 }]) {
    const changed = { ...phrase, occurrences: phrase.occurrences.map((note, index) => index === 0 ? { ...note, ...change } : note) }
    assert.equal(canEnterTempoEncore(changed, complete, mastery), false)
  }
})

test('missing/invalid mastery memory, unmastered notes and duplicate projections fail closed', () => {
  const c4 = mastery.notes[0]
  for (const voiceStatus of ['missing', 'invalid'] as const) {
    assert.equal(canEnterTempoEncore(phrase, complete, { notes: [{ ...c4, voiceStatus }], worldClear: true }), false)
  }
  assert.equal(canEnterTempoEncore(phrase, complete, { notes: [{ ...c4, voiceEverMastered: false }], worldClear: true }), false)
  assert.equal(canEnterTempoEncore(phrase, complete, { notes: [c4, c4], worldClear: true }), false)
  assert.equal(canEnterTempoEncore(phrase, complete, { notes: [], worldClear: true }), false)
  assert.equal(canEnterTempoEncore(phrase, { ...complete, admittedNotes: [] }, mastery), false)
})

test('rests-only and unsupported authored phrases cannot acquire eligibility', () => {
  const rests = { ...phrase, occurrences: [phrase.occurrences[1]] }
  assert.equal(canEnterTempoEncore(rests, fixture(false, rests).completed, mastery), false)
  const unsupported = { ...phrase, occurrences: [{ ...phrase.occurrences[0], pitchName: 'C6', midi: 84, semi: 24, octave: 6 }] }
  assert.equal(canEnterTempoEncore(unsupported, fixture(false, unsupported).completed, mastery), false)
  assert.equal(pitchforksSongcraftTargetFrequency(unsupported.occurrences[0], ['C6']), null)
})

test('authored durations and four-beat count-in follow chosen tempo without source mutation', () => {
  const before = JSON.stringify(phrase)
  const state = begin()
  assert.deepEqual(state.observations.map(row => [row.cueAt, row.endAt]), [[5000, 6000], [6000, 6500], [6500, 8500]])
  assert.equal(startTempoEncore(phrase, complete, mastery, 120, 1000).observations[0].cueAt, 3000)
  assert.equal(JSON.stringify(phrase), before)
  assert.equal(tempoEncoreCurrent(state), undefined)
  assert.equal(tempoEncoreCurrent(advanceTempoEncore(state, { type: 'tick', now: 5000 }))?.ordinal, 0)
  assert.equal(Object.isFrozen(state.observations[0]), true)
})

test('panel contract starts from authored tempo and receipt preserves it', () => {
  assert.equal(complete.phrase.sourceTempoBpm, 96)
  assert.equal(tempoEncoreInitialBpm(phrase), 96)
  assert.equal(tempoEncoreInitialBpm({ ...phrase, sourceTempoBpm: undefined }), 60)
  const receipt = JSON.parse(tempoEncoreReceipt(startTempoEncore(phrase, complete, mastery, 96, 1000), 'authored-tempo'))
  assert.equal(receipt.bpm, 96)
  assert.equal(receipt.sourceTempoBpm, 96)
  const ui = readFileSync(new URL('../src/components/PitchDefender/PitchforksTempoEncorePanel.tsx', import.meta.url), 'utf8')
  assert.match(ui, /useState\(\(\) => tempoEncoreInitialBpm\(phrase\)\)/)
  assert.match(ui, /Song tempo \{phrase\.sourceTempoBpm\} BPM/)
})

test('finite monotonic time and bounded tempo/phrase length are enforced', () => {
  for (const value of [NaN, Infinity, -1, 0, 29, 181]) assert.throws(() => startTempoEncore(phrase, complete, mastery, value, 0))
  for (const value of [NaN, Infinity, -1]) assert.throws(() => startTempoEncore(phrase, complete, mastery, 60, value))
  assert.throws(() => advanceTempoEncore(begin(), { type: 'tick', now: 999 }))
  assert.throws(() => advanceTempoEncore(begin(), { type: 'cancel', now: NaN }))
  const huge = { ...phrase, occurrences: [{ ...phrase.occurrences[0], beats: 10000 }] }
  assert.throws(() => startTempoEncore(huge, { ...complete, phrase: huge }, mastery, 60, 0))
})

/** A retained synthetic receipt, reproducible on disk by this test; never device evidence. */
function syntheticReceipt() {
  let state = begin()
  state = advanceTempoEncore(state, { type: 'visual', ordinal: 0, now: 5012 })
  state = advanceTempoEncore(state, { type: 'detector', ordinal: 0, now: 5040, matching: true, held: false })
  state = advanceTempoEncore(state, { type: 'detector', ordinal: 0, now: 5340, matching: true, held: true })
  state = advanceTempoEncore(state, { type: 'tick', now: 6001 })
  state = advanceTempoEncore(state, { type: 'visual', ordinal: 1, now: 6010 })
  state = advanceTempoEncore(state, { type: 'tick', now: 8505 })
  return { state, json: tempoEncoreReceipt(state, 'synthetic-test-take', 'synthetic-test') }
}

test('five timestamps and raw offsets serialize with explicit missing observations and no grade', () => {
  const { state, json } = syntheticReceipt()
  const row = state.observations[0]
  assert.deepEqual([row.cueAt, row.visualAt, row.inputAt, row.detectorWindow, row.outcomeAt], [5000, 5012, 5040, [5040, 5340], 6001])
  assert.deepEqual(tempoEncoreRawOffsets(row), { visualOffsetMs: 12, inputOffsetMs: 40, holdOffsetMs: 340 })
  assert.equal(state.status, 'complete')
  const receipt = JSON.parse(json)
  assert.equal(receipt.evidence, 'synthetic-test')
  assert.equal(receipt.physicalRhythmVerification, false)
  assert.equal(receipt.deviceLatency, 'unmeasured')
  for (const record of receipt.observations) {
    for (const key of ['cueAt', 'visualAt', 'inputAt', 'detectorWindow', 'outcomeAt']) assert.ok(key in record)
  }
  assert.equal(receipt.observations[2].visualAt, null)
  assert.doesNotMatch(json, /"(?:pass|fail|grade|latencyCompensation|timingScore)"/)
})

test('unseen cues, stale ordinals, rest samples, and late detector events never become input', () => {
  let state = advanceTempoEncore(begin(), { type: 'detector', ordinal: 0, now: 5050, matching: true, held: true })
  assert.equal(state.observations[0].inputAt, null)
  state = advanceTempoEncore(state, { type: 'visual', ordinal: 0, now: 5060 })
  state = advanceTempoEncore(state, { type: 'detector', ordinal: 2, now: 5070, matching: true, held: true })
  assert.equal(state.observations[2].inputAt, null)
  state = advanceTempoEncore(state, { type: 'visual', ordinal: 1, now: 6000 })
  state = advanceTempoEncore(state, { type: 'detector', ordinal: 1, now: 6010, matching: true, held: true })
  state = advanceTempoEncore(state, { type: 'detector', ordinal: 0, now: 6020, matching: true, held: true })
  assert.equal(state.observations[0].inputAt, null)
  assert.equal(state.observations[1].detectorWindow, null)
})

test('cancelled and completed takes are terminal and never synthesize missing input', () => {
  const cancelled = advanceTempoEncore(begin(), { type: 'cancel', now: 1100 })
  assert.equal(cancelled.status, 'cancelled')
  assert.ok(cancelled.observations.every(row => row.inputAt === null && row.outcomeAt === 1100))
  assert.strictEqual(advanceTempoEncore(cancelled, { type: 'visual', ordinal: 0, now: 5100 }), cancelled)
  const { state } = syntheticReceipt()
  assert.strictEqual(advanceTempoEncore(state, { type: 'tick', now: 9000 }), state)
})

test('actual reused microphone helper needs fresh generations and exact octave; no stale hold credit', () => {
  const pitch = { note: 'C4', frequency: 261.6255653005986, confidence: 0.95, cents: 0, isActive: true }
  let gen = resetPitchforksSongcraftVisibilityState(10).generation
  let hold = { heldMs: 0, matched: false }
  const sample = (generation: number, now: number, frequency = pitch.frequency, ready = true) => {
    const observation = observePitchforksSongcraftGeneration(gen, generation, now)
    gen = observation.state
    hold = advancePitchforksSongcraftVoiceSample(hold, observation, { ...pitch, frequency }, pitch.frequency, ready).hold
  }
  sample(10, 5000); sample(10, 5500)
  assert.equal(hold.heldMs, 0)
  sample(11, 5600); sample(12, 5700); sample(13, 5800)
  assert.equal(hold.heldMs, 200)
  sample(14, 5900, pitch.frequency * 2)
  assert.equal(hold.heldMs, 0)
  sample(15, 6000); sample(16, 6100); sample(17, 6200)
  assert.equal(hold.matched, true)
  sample(18, 9000)
  assert.equal(hold.heldMs, 0)
  sample(19, 9100, pitch.frequency, false)
  assert.equal(hold.heldMs, 0)
})

test('tempo performs zero persistence calls and UI owns no ordinary-world or reference-playback ports', () => {
  const context = fixture()
  const before = { writes: context.writes(), store: context.store(), source: JSON.stringify(phrase) }
  const state = startTempoEncore(phrase, context.completed, mastery, 60, 0)
  tempoEncoreReceipt(advanceTempoEncore(state, { type: 'tick', now: 10000 }), 'isolation')
  assert.deepEqual({ writes: context.writes(), store: context.store(), source: JSON.stringify(phrase) }, before)
  for (const file of ['pitchforksTempoEncore.ts', 'PitchforksTempoEncorePanel.tsx']) {
    const source = readFileSync(new URL(`../src/components/PitchDefender/${file}`, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /localStorage|sessionStorage|saveStore|setItem|removeItem|fetch\(|playReference|AudioContext|Date\.now/)
  }
  const ui = readFileSync(new URL('../src/components/PitchDefender/PitchforksTempoEncorePanel.tsx', import.meta.url), 'utf8')
  assert.match(ui, /tempoEncoreReceipt/)
  assert.match(ui, /link\.download/)
  assert.match(ui, /visibilitychange/)
  assert.match(ui, /matchingSuppressed\(\)/)
})

if (process.argv.includes('--receipt')) process.stdout.write(`${syntheticReceipt().json}\n`)
