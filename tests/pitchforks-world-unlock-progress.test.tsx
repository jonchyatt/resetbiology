import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import type { NoteMemory } from '../src/lib/fsrs'
import PitchforksWorldUnlockProgress from '../src/components/PitchDefender/PitchforksWorldUnlockProgress'
import { projectPitchforksMastery } from '../src/components/PitchDefender/pitchforksMasteryProjection'
import { pitchforksMicReadyActionLabel } from '../src/components/PitchDefender/PitchforksIII'

const nowMs = 1_000_000

function memory(note: string): NoteMemory {
  return {
    note,
    S: 21,
    D: 5,
    due: nowMs + 10_000,
    lastReview: nowMs - 10_000,
    lapses: 0,
    phase: 'review',
    learningReps: 2,
  }
}

const projection = projectPitchforksMastery({
  admittedNotes: ['D4', 'G4'],
  voiceMemory: { D4: memory('D4'), G4: memory('G4') },
  masteryRecords: {
    D4: { sessionIds: ['d4-session-a', 'd4-session-b'], masteredAt: null },
    G4: { sessionIds: [], masteredAt: null },
  },
  nowMs,
})
const markup = renderToStaticMarkup(createElement(PitchforksWorldUnlockProgress, { projection }))

assert.equal(projection.worldClear, false)
assert.match(markup, /data-testid="pf3-world-unlock-progress"/)
assert.match(markup, /data-testid="pf3-world-unlock-progress-input-note"/)
assert.match(markup, /Listen &amp; Tap builds recognition practice; those sessions do not currently count toward World Map unlocks\. Voice Lightning sessions are required for campaign progress and new-area unlocks\./)
assert.match(markup, /2\/6 voice mastery sessions/)
assert.match(markup, /D4.*2\/3 sessions/)
assert.match(markup, /G4.*0\/3 sessions/)
assert.doesNotMatch(markup, /D4.*3\/3 sessions/)

assert.equal(pitchforksMicReadyActionLabel('guided', 'dungeon'), 'Begin comfortable range check')
assert.equal(pitchforksMicReadyActionLabel('saved', 'dungeon'), 'Enter the Dungeon')
assert.equal(pitchforksMicReadyActionLabel('saved', 'village-gate'), 'Enter the Village Gate')

console.log('pitchforks world unlock progress: PASS — real session counts and selected-chamber mic copy')
