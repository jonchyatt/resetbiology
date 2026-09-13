import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  PitchforksMasteryPanel,
} from '../src/components/PitchDefender/PitchforksMasteryPanel'
import type {
  PitchforksMasteryNoteProjection,
  PitchforksMasteryProjection,
} from '../src/components/PitchDefender/pitchforksMasteryProjection'

function note(overrides: Partial<PitchforksMasteryNoteProjection> = {}): PitchforksMasteryNoteProjection {
  return {
    note: 'C4',
    voiceDue: false,
    voiceStatus: 'review',
    earDue: false,
    earStatus: 'review',
    voiceEverMastered: false,
    voiceMastery: {
      rawSourceKeys: ['pitch_fsrs_memory', 'pitchforks3_mastery_progress'],
      sessionIds: [],
      masteredAt: null,
    },
    ...overrides,
  }
}

function projection(notes: readonly PitchforksMasteryNoteProjection[]): PitchforksMasteryProjection {
  return { notes, worldClear: false }
}

function render(value: PitchforksMasteryProjection | null | undefined): string {
  return renderToStaticMarkup(createElement(PitchforksMasteryPanel, { projection: value }))
}

function region(markup: string, testId: string, endMarker?: string): string {
  const start = markup.indexOf(`data-testid="${testId}"`)
  assert.ok(start >= 0, `expected ${testId} in server markup`)
  const end = endMarker ? markup.indexOf(endMarker, start) : -1
  return markup.slice(start, end > start ? end : markup.length)
}

// Every admitted exact note appears once, with independent Voice and Ear
// status cards. A due state in one lane does not rewrite the other lane.
const bothTracksDue = render(projection([note({
  voiceDue: true,
  voiceStatus: 'review',
  earDue: true,
  earStatus: 'review',
})]))
assert.match(bothTracksDue, /data-testid="pitchforks-mastery-note-C4"/)
assert.match(bothTracksDue, /Voice \(singing\)/)
assert.match(bothTracksDue, /Ear \(listening\)/)
assert.match(region(bothTracksDue, 'pitchforks-mastery-voice-C4', 'data-testid="pitchforks-mastery-ear-C4"'), /Review due/)
assert.match(region(bothTracksDue, 'pitchforks-mastery-ear-C4', '</li>'), /Review due/)
assert.match(bothTracksDue, /data-track="voice"[^>]*data-due="true"/)
assert.match(bothTracksDue, /data-track="ear"[^>]*data-due="true"/)

// Durable VOICE history remains visible when its current memory is due. EAR
// has no mastery receipt and therefore never renders a mastered claim.
const durableMasteredDue = render(projection([note({
  voiceDue: true,
  voiceStatus: 'review',
  earDue: false,
  earStatus: 'review',
  voiceEverMastered: true,
})]))
const durableVoice = region(durableMasteredDue, 'pitchforks-mastery-voice-C4', 'data-testid="pitchforks-mastery-ear-C4"')
const durableEar = region(durableMasteredDue, 'pitchforks-mastery-ear-C4', '</li>')
assert.match(durableVoice, /Singing milestone: earned/i)
assert.match(durableVoice, /Review due/i)
assert.match(durableVoice, /data-voice-ever-mastered="true"/)
assert.match(durableEar, /Listening practice is tracked separately/i)
assert.doesNotMatch(durableEar, /mastered/i)

// Missing data asks for practice; malformed data is unavailable. A durable
// crossing does not turn a missing current snapshot into false completion.
const safeFailures = render(projection([
  note({ note: 'C4', voiceStatus: 'missing', voiceDue: false }),
  note({ note: 'B4', voiceStatus: 'invalid', voiceDue: false }),
  note({ note: 'A4', voiceStatus: 'review', voiceDue: false, voiceEverMastered: true, earStatus: 'invalid', earDue: false }),
]))
const missingVoice = region(safeFailures, 'pitchforks-mastery-voice-C4', 'data-testid="pitchforks-mastery-ear-C4"')
const invalidVoice = region(safeFailures, 'pitchforks-mastery-voice-B4', 'data-testid="pitchforks-mastery-ear-B4"')
const invalidEar = region(safeFailures, 'pitchforks-mastery-ear-A4', '</li>')
assert.match(missingVoice, /Practice needed/i)
assert.match(missingVoice, /Singing milestone: unavailable/i)
assert.doesNotMatch(missingVoice, /Singing milestone: (?:still learning|earned)/i)
assert.match(invalidVoice, /Unavailable/i)
assert.match(invalidVoice, /Singing milestone: unavailable/i)
assert.doesNotMatch(invalidVoice, /Singing milestone: (?:still learning|earned)/i)
assert.match(invalidEar, /Unavailable/i)
assert.match(safeFailures, /data-status="missing"/)
assert.match(safeFailures, /data-status="invalid"/)
assert.match(safeFailures, /data-voice-mastered="true"/)

// An empty admission is an assessment state, not a clear state or a blank
// panel. Null/undefined caller snapshots use the same safe empty affordance.
const empty = render(projection([]))
assert.match(empty, /data-testid="pitchforks-mastery-empty"/)
assert.match(empty, /Assessment needed/i)
assert.doesNotMatch(empty, /data-testid="pitchforks-mastery-note-/)
assert.match(render(undefined), /Assessment needed/i)
assert.match(render(null), /Assessment needed/i)

// EAR review status remains a current listening state only; the panel does
// not invent an EAR mastery ledger from phase or due values.
const noEarMastery = render(projection([note({
  earStatus: 'review',
  earDue: false,
  voiceStatus: 'new',
  voiceDue: false,
})]))
const earOnly = region(noEarMastery, 'pitchforks-mastery-ear-C4', '</li>')
assert.match(earOnly, /Listening practice is tracked separately/i)
assert.match(earOnly, /In review/i)
assert.doesNotMatch(earOnly, /mastered/i)

console.log('pitchforks mastery panel: PASS — separate Voice/Ear status, durable voice history, and safe assessment states')
