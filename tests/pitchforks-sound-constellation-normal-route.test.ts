import assert from 'node:assert/strict'
import { createPitchforksWaveReliefTrace, isPitchforksPitchedAudioForbidden } from '../src/components/PitchDefender/pitchforksAudioStateMap'
import { projectPitchforksMastery } from '../src/components/PitchDefender/pitchforksMasteryProjection'
import { projectPitchforksSoundConstellation } from '../src/components/PitchDefender/pitchforksSoundConstellation'
import type { NoteMemory } from '../src/lib/fsrs'

const nowMs = 1_000_000
const memory = (note: string, due: number): NoteMemory => ({ note, S: 3, D: 5, due, lastReview: nowMs - 10, lapses: 0, phase: 'review', learningReps: 2 })
const projection = projectPitchforksMastery({
  admittedNotes: ['C4', 'D4'],
  voiceMemory: { C4: memory('C4', nowMs - 1), D4: memory('D4', nowMs + 1000) },
  earMemory: { C4: memory('C4', nowMs + 1000), D4: memory('D4', nowMs - 1) },
  masteryRecords: { C4: { sessionIds: ['run-a', 'run-b', 'run-c'], masteredAt: nowMs - 1 } },
  nowMs,
})
const constellation = projectPitchforksSoundConstellation(projection)
assert.equal(constellation.dueNodes.length, 2)
assert.ok(constellation.dueNodes.every(node => node.evidenceIds.some(id => id.includes('-due:'))))
assert.equal(constellation.nodes.find(node => node.track === 'stormcraft')?.status, 'earned')
assert.equal(isPitchforksPitchedAudioForbidden('recall'), true)
assert.equal(isPitchforksPitchedAudioForbidden('blind_measurement'), true)
const relief = createPitchforksWaveReliefTrace(100, 120)
assert.equal(relief.safe, true)
assert.deepEqual(relief.events.map(event => event.kind), ['measurement_close', 'silence_start', 'silence_end', 'audio_start'])
assert.equal(relief.events[3].atMs - relief.events[1].atMs >= 180, true)
assert.equal(relief.events[3].pitched, true)
assert.equal(relief.events[1].pitched, false)
console.log('Sound Constellation normal-route projection, due evidence, audio exclusion, and wave relief PASS')
