import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  PITCHFORKS_RANGE_NOTES,
  PITCHFORKS_RANGE_PROFILE_KEY,
  adjacentRangeNote,
  createPitchforksRangeProfile,
  isNoteInsideRange,
  nearestPitchforksRangeNote,
  parsePitchforksRangeProfile,
  presentationOrderForRange,
  starterPairForRange,
} from '../src/components/PitchDefender/pitchforksRange'
import { noteToFreq } from '../src/components/PitchDefender/pitchMath'

let checks = 0
const check = (run: () => void) => {
  run()
  checks += 1
}

check(() => assert.equal(PITCHFORKS_RANGE_PROFILE_KEY, 'pitchforks3_comfortable_range_v1'))
check(() => assert.deepEqual(PITCHFORKS_RANGE_NOTES, [
  'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3',
  'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5',
]))
check(() => assert.equal(nearestPitchforksRangeNote(noteToFreq('C4')), 'C4'))
check(() => assert.equal(nearestPitchforksRangeNote(noteToFreq('D#4')), 'E4'))
check(() => assert.equal(nearestPitchforksRangeNote(0), null))
check(() => assert.equal(adjacentRangeNote('C4', 'lower'), 'B3'))
check(() => assert.equal(adjacentRangeNote('C4', 'higher'), 'D4'))
check(() => assert.equal(adjacentRangeNote('C3', 'lower'), null))
check(() => assert.equal(adjacentRangeNote('C5', 'higher'), null))

const profile = createPitchforksRangeProfile({
  lowNote: 'A3',
  highNote: 'A4',
  anchorNote: 'D4',
  source: 'guided',
  assessedAt: '2026-07-18T00:00:00.000Z',
})
assert.ok(profile)
check(() => assert.deepEqual(starterPairForRange(profile), ['D4', 'E4']))
check(() => assert.equal(isNoteInsideRange('A3', profile), true))
check(() => assert.equal(isNoteInsideRange('A4', profile), true))
check(() => assert.equal(isNoteInsideRange('G3', profile), false))
check(() => assert.equal(isNoteInsideRange('B4', profile), false))

const order = presentationOrderForRange(profile)
check(() => assert.equal(new Set(order).size, order.length))
check(() => assert.deepEqual(new Set(order), new Set(['A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4'])))
check(() => {
  const indexes = order.map(note => PITCHFORKS_RANGE_NOTES.indexOf(note))
  for (let index = 2; index < indexes.length; index++) {
    const prior = indexes.slice(0, index)
    assert.ok(indexes[index] === Math.min(...prior) - 1 || indexes[index] === Math.max(...prior) + 1)
  }
})

check(() => assert.equal(createPitchforksRangeProfile({ lowNote: 'C4', highNote: 'C4', source: 'manual' }), null))
check(() => assert.equal(createPitchforksRangeProfile({ lowNote: 'C2', highNote: 'C4', source: 'manual' }), null))
check(() => assert.deepEqual(parsePitchforksRangeProfile(JSON.stringify(profile)), profile))
check(() => assert.equal(parsePitchforksRangeProfile('{not json'), null))
check(() => assert.equal(parsePitchforksRangeProfile(JSON.stringify({ ...profile, version: 2 })), null))

const component = readFileSync(new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url), 'utf8')
check(() => assert.match(component, /PITCHFORKS_RANGE_PROFILE_KEY/))
check(() => assert.match(component, /presentationOrderForRange/))
check(() => assert.match(component, /Pitch is analyzed on this device/))
check(() => assert.match(component, /We (?:do not|don't) record or upload your voice/))
check(() => assert.match(component, /data-testid="pf3-range-check"/))
check(() => assert.match(component, /data-testid="pf3-range-manual"/))
check(() => assert.match(component, /data-testid="pf3-range-not-now"/))
check(() => assert.match(component, /data-testid="pf3-range-comfortable"/))
check(() => assert.match(component, /data-testid="pf3-range-stop-limit"/))
check(() => assert.match(component, /exactPitchSampleState\(source, noteToFreq\(candidate\), CONFIDENCE_FLOOR, MATCH_TOLERANCE_CENTS\)/))
check(() => assert.match(component, /advanceExactPitchHold\([\s\S]*?rangeHeldMsRef\.current[\s\S]*?rangeMatched[\s\S]*?HOLD_MS/))
check(() => assert.match(component, /localStorage\.setItem\(PITCHFORKS_RANGE_PROFILE_KEY, JSON\.stringify\(profile\)\)/))
check(() => assert.doesNotMatch(component, /localStorage\.setItem\([^\n]*(?:frequency|samples|audio|recording)/i))
check(() => assert.match(component, /const CONFIDENCE_FLOOR = 0\.75/))
check(() => assert.match(component, /const MATCH_TOLERANCE_CENTS = 70/))
check(() => assert.match(component, /const HOLD_MS = 300/))

console.log(`pitchforks comfortable-range contract: ${checks}/${checks} PASS`)
