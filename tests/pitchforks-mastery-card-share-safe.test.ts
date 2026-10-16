import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createPitchforksPresentationJourney } from '../src/components/PitchDefender/pitchforksCurriculum'
import type { PitchforksMasteryProjection } from '../src/components/PitchDefender/pitchforksMasteryProjection'
import {
  buildPitchforksMasteryCard,
  serializePitchforksMasteryCardCsv,
  serializePitchforksMasteryCardJson,
} from '../src/components/PitchDefender/pitchforksMasteryCardModel'
import { PitchforksShareCard } from '../src/components/PitchDefender/PitchforksShareCard'

const nowMs = 10_000_000
const journey = createPitchforksPresentationJourney({
  rangeAssessedAt: '2026-10-01T00:00:00.000Z',
  startedAt: '2026-10-01T00:01:00.000Z',
  unlockedNotes: ['C4', 'D4'],
  guidedNotes: ['D4'],
  dungeonClear: {
    version: 1,
    rangeAssessedAt: '2026-10-01T00:00:00.000Z',
    startedAt: '2026-10-01T00:01:00.000Z',
    admittedNotes: ['C4', 'D4'],
    clearedAt: nowMs - 100,
  },
})

const projection: PitchforksMasteryProjection = {
  worldClear: true,
  notes: [
    {
      note: 'C4', voiceDue: true, voiceStatus: 'review', earDue: false, earStatus: 'review',
      voiceEverMastered: true,
      voiceMastery: { rawSourceKeys: ['pitch_fsrs_memory', 'pitchforks3_mastery_progress'], sessionIds: ['c-a', 'c-b', 'c-b', 'c-c'], masteredAt: nowMs - 1_000 },
    },
    {
      note: 'D4', voiceDue: false, voiceStatus: 'learning', earDue: true, earStatus: 'review',
      voiceEverMastered: false,
      voiceMastery: { rawSourceKeys: ['pitch_fsrs_memory', 'pitchforks3_mastery_progress'], sessionIds: ['d-guided'], masteredAt: null },
    },
  ],
}

const card = buildPitchforksMasteryCard({
  projection,
  journey,
  nowMs,
  abilityEvidence: [{ id: 'ability:living-circuit', label: 'Living Circuit', earned: true, evidenceIds: ['evidence:journey:dungeon:clear'] }],
})

assert.equal(card.schema, 'pitchforks-share-safe-mastery-card/v1')
assert.deepEqual(card.rows.map(row => row.note), ['C4', 'D4'])
assert.equal(card.rows[0].voice, 'review-due')
assert.equal(card.rows[0].retainedMastery, true)
assert.equal(card.rows[1].voice, 'guided-only')
assert.equal(card.rows[1].ear, 'review-due')
assert.equal(card.worlds.find(world => world.id === 'dungeon')?.status, 'completed')
assert.equal(card.worlds.find(world => world.id === 'village-gate')?.status, 'not-started')
assert.equal(card.abilities[0].status, 'earned')
assert.equal(new Set(card.rows[0].evidenceIds).size, card.rows[0].evidenceIds.length)
assert.ok(card.rows[0].evidenceIds.includes('evidence:voice-session:c-b'))
assert.ok(card.nextActions.some(action => action.includes('guided practice')))

const markup = renderToStaticMarkup(createElement(PitchforksShareCard, {
  projection,
  journey,
  nowMs,
  abilityEvidence: [{ id: 'ability:living-circuit', label: 'Living Circuit', earned: true, evidenceIds: ['evidence:journey:dungeon:clear'] }],
}))
assert.match(markup, /data-testid="pf3-share-safe-mastery-card"/)
assert.match(markup, /data-testid="pf3-share-card-voice-C4"/)
assert.match(markup, /VOICE · singing/)
assert.match(markup, /EAR · listening/)
assert.match(markup, /Retained mastery/)
assert.match(markup, /Guided practice only/)
assert.match(markup, /Nothing is posted or sent/)
assert.match(markup, /focus-visible:outline/)
assert.match(markup, /prefers-reduced-motion/)
assert.match(markup, /PRINT/)
assert.match(markup, /DOWNLOAD CSV/)
assert.match(markup, /DOWNLOAD CARD/)
for (const row of card.rows) {
  assert.match(markup, new RegExp(row.note))
  assert.match(markup, new RegExp(row.evidenceIds[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
}
for (const banned of ['surveillance', 'leaderboard', 'ranking', 'homework compliance', 'practice timestamp']) {
  assert.doesNotMatch(markup.toLowerCase(), new RegExp(`\\b${banned}\\b`), `${banned} must not appear in the share card`) 
}

const csv = serializePitchforksMasteryCardCsv(card)
assert.match(csv, /section/) 
assert.match(csv, /C4/) 
assert.match(csv, /D4/) 
assert.match(csv, /retained mastery/) 
assert.match(csv, /Guided practice only/) 
assert.match(csv, /Dungeon/) 
assert.match(csv, /Living Circuit/)
for (const row of card.rows) {
  assert.ok(csv.includes(row.note))
  assert.ok(csv.includes(row.evidenceIds.join(' | ')))
}
const reopened = JSON.parse(serializePitchforksMasteryCardJson(card))
assert.deepEqual(reopened, card)
assert.equal(serializePitchforksMasteryCardJson(card), serializePitchforksMasteryCardJson(buildPitchforksMasteryCard({
  projection, journey, nowMs,
  abilityEvidence: [{ id: 'ability:living-circuit', label: 'Living Circuit', earned: true, evidenceIds: ['evidence:journey:dungeon:clear'] }],
})))

console.log('pitchforks share-safe mastery card: PASS — evidence IDs, lane isolation, guided labels, privacy comprehension, stable reopen, and CSV parity')
