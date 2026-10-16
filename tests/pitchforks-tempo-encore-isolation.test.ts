import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { exactPitchSampleState, advanceExactPitchHold, noteToFreq } from '../src/components/PitchDefender/pitchMath'
import {
  advanceTempoEncore,
  canEnterTempoEncore,
  startTempoEncore,
  tempoEncoreReceipt,
  type TempoEncoreState,
} from '../src/components/PitchDefender/pitchforksTempoEncore'
import { type SongcraftPhrase } from '../src/components/PitchDefender/pitchforksSongcraftPhrase'

const phrase: SongcraftPhrase = {
  sourceKey: 'pd_composed_pf27_fixture',
  title: 'PF-27 deterministic phrase',
  sourceSha256: 'b'.repeat(64),
  sourceTempoBpm: 96,
  provenance: { source: 'composer', normalizationVersion: 'songcraft-phrase/1' },
  occurrences: [
    { ordinal: 0, isRest: false, semi: 0, pitchName: 'C4', octave: 4, midi: 60, beats: 1, measureIdx: 1, beatOffset: 0 },
    { ordinal: 1, isRest: true, semi: null, pitchName: null, octave: null, midi: null, beats: 1, measureIdx: 1, beatOffset: 1 },
    { ordinal: 2, isRest: false, semi: 2, pitchName: 'D4', octave: 4, midi: 62, beats: 2, measureIdx: 1, beatOffset: 2 },
  ],
}

const completed = {
  attemptId: 'pf27-untimed', lane: 'voice' as const, phrase, admittedNotes: ['C4', 'D4'], cursor: 3,
  current: { kind: 'complete' as const, occurrence: null, identity: null }, status: 'complete' as const,
  outcomes: [], recitalState: null,
  summary: { traversalComplete: true, masteryEligible: true, unaidedComplete: true, assisted: false, traversedCount: 3, eligibleNoteCount: 2, unaidedNoteCount: 2 },
}
const mastery = { worldClear: false, notes: [
  { note: 'C4', voiceEverMastered: true, voiceStatus: 'review' },
  { note: 'D4', voiceEverMastered: true, voiceStatus: 'learning' },
] }

function source(file: string): string {
  return readFileSync(new URL(`../src/components/PitchDefender/${file}`, import.meta.url), 'utf8')
}

function complete(state: TempoEncoreState): TempoEncoreState {
  let next = state
  next = advanceTempoEncore(next, { type: 'visual', ordinal: 0, now: 3510 })
  next = advanceTempoEncore(next, { type: 'detector', ordinal: 0, now: 3520, matching: true, held: false })
  next = advanceTempoEncore(next, { type: 'detector', ordinal: 0, now: 3820, matching: true, held: true })
  next = advanceTempoEncore(next, { type: 'tick', now: 4500 })
  next = advanceTempoEncore(next, { type: 'visual', ordinal: 1, now: 4510 })
  next = advanceTempoEncore(next, { type: 'tick', now: 6501 })
  return next
}

test('opt-in is gated by the completed unaided exact phrase and existing voice mastery', () => {
  assert.equal(canEnterTempoEncore(phrase, completed, mastery), true)
  assert.equal(canEnterTempoEncore(phrase, { ...completed, summary: { ...completed.summary, assisted: true } }, mastery), false)
  assert.equal(canEnterTempoEncore(phrase, { ...completed, status: 'active' }, mastery), false)
  assert.equal(canEnterTempoEncore(phrase, completed, undefined), false)
  assert.equal(canEnterTempoEncore({ ...phrase, sourceSha256: 'c'.repeat(64) }, completed, mastery), false)
})

test('one monotonic clock orders cue, visual, detector window, hold, and outcome timestamps', () => {
  const state = startTempoEncore(phrase, completed, mastery, 120, 1000)
  assert.deepEqual(state.observations.map(row => [row.cueAt, row.endAt]), [[3000, 3500], [3500, 4000], [4000, 5000]])
  const finished = complete(state)
  const first = finished.observations[0]
  assert.equal(first.visualAt, null, 'late visual belongs to the next occurrence, not the expired cue')
  assert.equal(finished.status, 'complete')
  for (const row of finished.observations) {
    const values = [row.cueAt, row.visualAt, row.inputAt, row.holdAt, row.outcomeAt].filter((value): value is number => value !== null)
    assert.deepEqual(values, [...values].sort((a, b) => a - b))
  }
})

test('cue silence and ordinary-wave isolation are explicit', () => {
  let state = startTempoEncore(phrase, completed, mastery, 60, 0)
  state = advanceTempoEncore(state, { type: 'detector', ordinal: 0, now: 4050, matching: true, held: true })
  assert.equal(state.observations[0].inputAt, null, 'detector cannot score before visual cue commit')
  assert.doesNotMatch(source('PitchforksTempoEncorePanel.tsx'), /playReference|AudioContext|\.play\(/)
  assert.doesNotMatch(source('pitchforksTempoEncore.ts'), /localStorage|sessionStorage|saveStore|setItem|removeItem|FSRS|progression|ordinary wave/i)
})

test('exact octave and fresh 300 ms holds remain the only voice truth', () => {
  const target = noteToFreq('C4')
  assert.equal(exactPitchSampleState({ frequency: noteToFreq('C3'), confidence: 0.99, isActive: true }, target, 0.75, 70), 'wrong')
  assert.equal(exactPitchSampleState({ frequency: target, confidence: 0.99, isActive: true }, target, 0.75, 70), 'match')
  let hold = { heldMs: 0, matched: false }
  hold = advanceExactPitchHold(hold, 'match', 299, 300)
  assert.deepEqual(hold, { heldMs: 299, matched: false })
  hold = advanceExactPitchHold(hold, 'match', 1, 300)
  assert.deepEqual(hold, { heldMs: 300, matched: true })
  assert.deepEqual(advanceExactPitchHold(hold, 'wrong', 500, 300), hold)
})

test('EAR and VOICE remain separate, and save/reopen is a read-only receipt operation', () => {
  const songcraft = source('PitchforksSongcraft.tsx')
  assert.match(songcraft, /EAR challenges must not reveal the target/)
  assert.match(songcraft, /state\.lane === 'voice'/)
  assert.match(songcraft, /state\.lane === 'ear'/)
  const receipt = JSON.parse(tempoEncoreReceipt(complete(startTempoEncore(phrase, completed, mastery, 96, 1000)), 'pf27-reopen'))
  assert.equal(receipt.schema, 'pitchforks-tempo-encore/1')
  assert.equal(receipt.physicalRhythmVerification, false)
  assert.equal(receipt.deviceLatency, 'unmeasured')
  assert.equal(receipt.sourceSha256, phrase.sourceSha256)
  assert.doesNotMatch(JSON.stringify(receipt), /FSRS|mastery|progression|pass|fail|grade/i)
  assert.doesNotMatch(source('PitchforksTempoEncorePanel.tsx'), /localStorage|sessionStorage|saveStore|setItem|removeItem|fetch\(/)
})

console.log('pitchforks-tempo-encore-isolation: deterministic checks declared')
