import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { exactCents, noteToFreq, octaveFoldedCents } from '../src/components/PitchDefender/pitchMath'

const c4 = noteToFreq('C4')
const atCents = (base: number, cents: number) => base * Math.pow(2, cents / 1200)
const closeTo = (actual: number, expected: number, epsilon = 1e-8) => {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} was not within ${epsilon} of ${expected}`)
}

closeTo(exactCents(c4, c4), 0)
closeTo(exactCents(noteToFreq('C3'), c4), -1200)
closeTo(exactCents(noteToFreq('C5'), c4), 1200)
closeTo(exactCents(atCents(c4, -70), c4), -70)
closeTo(exactCents(atCents(c4, 70), c4), 70)

// Shared forgiving behavior remains available for sibling games.
closeTo(octaveFoldedCents(noteToFreq('C3'), c4), 0)
closeTo(octaveFoldedCents(noteToFreq('C5'), c4), 0)

const source = readFileSync(new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url), 'utf8')
assert.doesNotMatch(source, /octaveFoldedCents/)
assert.match(source, /exactCents\(source\.frequency, noteToFreq\(target\.note\)\)/)
assert.match(source, /Math\.abs\(deviation\) <= MATCH_TOLERANCE_CENTS \/ 100/)
assert.match(source, /PITCH_BAR_W \* \(\(MATCH_TOLERANCE_CENTS \/ 100\) \/ 6\)/)
assert.match(source, /const CONFIDENCE_FLOOR = 0\.75/)
assert.match(source, /const MATCH_TOLERANCE_CENTS = 70/)
assert.match(source, /const HOLD_MS = 300/)
assert.match(source, /source\.confidence < CONFIDENCE_FLOOR \|\| source\.frequency <= 0/)

console.log('pitchforks exact-octave truth: 15/15 PASS')
