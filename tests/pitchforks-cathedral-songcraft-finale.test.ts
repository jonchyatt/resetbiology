import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { normalizeComposerPhrase, loadSongcraftPhrases } from '../src/components/PitchDefender/pitchforksSongcraftPhrase'
import { createPitchforksPresentationJourney } from '../src/components/PitchDefender/pitchforksCurriculum'
import {
  createPitchforksCathedralSongcraftFinale,
  hasPitchforksCathedralVoiceEvidence,
  reopenPitchforksCathedralSongcraftFinale,
  savePitchforksCathedralSongcraftFinale,
} from '../src/components/PitchDefender/pitchforksCathedralSongcraftFinale'

const raw = readFileSync(new URL('./fixtures/pd_composed_pitchforks_seed.json', import.meta.url), 'utf8')
const sourceKey = 'pd_composed_pitchforks_seed'

function storage(rawValue = raw) {
  const writes: string[] = []
  return {
    writes,
    length: 1,
    key: (index: number) => index === 0 ? sourceKey : null,
    getItem: (key: string) => key === sourceKey ? rawValue : null,
    setItem: () => writes.push('setItem'),
    removeItem: () => writes.push('removeItem'),
  }
}

function journey() {
  const base = createPitchforksPresentationJourney({
    rangeAssessedAt: '2026-10-16T00:00:00.000Z',
    startedAt: '2026-10-16T00:01:00.000Z',
    unlockedNotes: ['E4', 'F4', 'G4'],
  })
  return {
    ...base,
    cathedralClear: {
      version: 1 as const,
      rangeAssessedAt: base.rangeAssessedAt,
      startedAt: base.startedAt,
      admittedNotes: [...base.unlockedNotes],
      clearedAt: 1234,
    },
  }
}

test('Composer read-side is deterministic, hash-bound, and write-free', async () => {
  const first = await normalizeComposerPhrase(raw, sourceKey)
  const second = await normalizeComposerPhrase(raw, sourceKey)
  assert.ok(first)
  assert.deepEqual(first, second)
  assert.equal(first?.sourceSha256.length, 64)
  assert.deepEqual(first?.occurrences.map(note => note.pitchName), ['E4', 'F4', 'G4', 'E4'])

  const mutated = await normalizeComposerPhrase(raw.replace('"g/4"', '"a/4"'), sourceKey)
  assert.ok(mutated)
  assert.notEqual(mutated?.sourceSha256, first?.sourceSha256)

  const source = storage()
  const loaded = await loadSongcraftPhrases(source)
  assert.equal(loaded.length, 1)
  assert.equal(source.writes.length, 0)
})

test('Cathedral finale requires earned untimed unaided practice and preserves lane evidence', async () => {
  const phrase = await normalizeComposerPhrase(raw, sourceKey)
  assert.ok(phrase)
  const practice = {
    phrase,
    lane: 'voice' as const,
    status: 'complete' as const,
    summary: { traversalComplete: true, masteryEligible: true, unaidedComplete: true, assisted: false, traversedCount: 4, eligibleNoteCount: 4, unaidedNoteCount: 4 },
  } as const
  const finale = createPitchforksCathedralSongcraftFinale({ journey: journey(), phrase, practice })
  assert.ok(finale)
  assert.equal(finale?.phase, 'celebration')
  assert.equal(hasPitchforksCathedralVoiceEvidence(finale), true)

  const saved = savePitchforksCathedralSongcraftFinale(finale!)
  assert.equal(saved.phase, 'saved')
  assert.equal(reopenPitchforksCathedralSongcraftFinale(saved).phase, 'return-practice')

  const earPractice = { ...practice, lane: 'ear' as const }
  const earFinale = createPitchforksCathedralSongcraftFinale({ journey: journey(), phrase, practice: earPractice })
  assert.ok(earFinale)
  assert.equal(earFinale?.earEvidence, true)
  assert.equal(earFinale?.voiceEvidence, false)
  assert.equal(hasPitchforksCathedralVoiceEvidence(earFinale), false)

  assert.equal(createPitchforksCathedralSongcraftFinale({ journey: journey(), phrase, practice: { ...practice, summary: { ...practice.summary, assisted: true } } }), null)
  assert.equal(createPitchforksCathedralSongcraftFinale({ journey: { ...journey(), cathedralClear: undefined }, phrase, practice }), null)
})

console.log('pitchforks Cathedral Songcraft finale: deterministic Composer read-side, lane isolation, celebration/save/reopen PASS')
