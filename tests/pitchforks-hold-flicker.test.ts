import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { advanceExactPitchHold, exactPitchSampleState, noteToFreq } from '../src/components/PitchDefender/pitchMath'

let checks = 0
const check = (run: () => void) => {
  run()
  checks += 1
}

const c4 = noteToFreq('C4')
const sample = (frequency: number, confidence = 0.9, isActive = true) => ({ frequency, confidence, isActive })

check(() => assert.equal(exactPitchSampleState(null, c4, 0.75, 70), 'unavailable'))
check(() => assert.equal(exactPitchSampleState(sample(c4, 0.7), c4, 0.75, 70), 'unavailable'))
check(() => assert.equal(exactPitchSampleState(sample(c4, 0.9, false), c4, 0.75, 70), 'unavailable'))
check(() => assert.equal(exactPitchSampleState(sample(c4), c4, 0.75, 70), 'match'))
check(() => assert.equal(exactPitchSampleState(sample(noteToFreq('C3')), c4, 0.75, 70), 'wrong'))

check(() => assert.deepEqual(
  advanceExactPitchHold({ heldMs: 120, matched: false }, 'unavailable', 100, 300),
  { heldMs: 120, matched: false },
))
check(() => assert.deepEqual(
  advanceExactPitchHold({ heldMs: 120, matched: false }, 'wrong', 100, 300),
  { heldMs: 0, matched: false },
))
check(() => assert.deepEqual(
  advanceExactPitchHold({ heldMs: 120, matched: false }, 'match', 100, 300),
  { heldMs: 220, matched: false },
))
check(() => assert.deepEqual(
  advanceExactPitchHold({ heldMs: 250, matched: false }, 'match', 100, 300),
  { heldMs: 300, matched: true },
))
check(() => assert.deepEqual(
  advanceExactPitchHold({ heldMs: 300, matched: true }, 'wrong', 100, 300),
  { heldMs: 300, matched: true },
))

const source = readFileSync(new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url), 'utf8')
check(() => assert.match(source, /advanceExactPitchHold\([\s\S]*?rangeHeldMsRef\.current[\s\S]*?rangeMatched/))
check(() => assert.match(source, /advanceExactPitchHold\([\s\S]*?admissionHeldMsRef\.current[\s\S]*?admissionMatched/))

console.log(`pitchforks hold flicker survival: ${checks}/${checks} PASS`)
