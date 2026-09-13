import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import {
  PITCHFORKS_VICTORY_ACTIVE_END_MS,
  PITCHFORKS_VICTORY_CLEAR_MS,
  PITCHFORKS_VICTORY_EYE_LIFT_START_MS,
  PITCHFORKS_VICTORY_REDUCED_MOTION_END_MS,
  PITCHFORKS_VICTORY_START_MS,
  selectPitchforksVictoryPose,
} from '../src/components/PitchDefender/pitchforksVictoryPose'

let checks = 0
const check = (fn: () => void) => {
  fn()
  checks += 1
}

const neutralPath = new URL('../public/images/pitchforks/frankenstein_victory_neutral.png', import.meta.url)
const eyeLiftPath = new URL('../public/images/pitchforks/frankenstein_victory_eye_lift.png', import.meta.url)
const neutral = readFileSync(neutralPath)
const eyeLift = readFileSync(eyeLiftPath)

check(() => assert.equal(createHash('sha256').update(neutral).digest('hex').toUpperCase(), 'C1285FA995C4DE8754A7C831EFD8C343A5F550D451952281E1A3DA4C1B5DAE13'))
check(() => assert.equal(createHash('sha256').update(eyeLift).digest('hex').toUpperCase(), '770287C0B714EF71A73B7A09ACCBA1F97FAE023C02CFAB8E1BE33E50CBBD373B'))
check(() => assert.equal(neutral.readUInt32BE(16), 96))
check(() => assert.equal(neutral.readUInt32BE(20), 144))
check(() => assert.equal(eyeLift.readUInt32BE(16), 96))
check(() => assert.equal(eyeLift.readUInt32BE(20), 144))

const normal = (elapsedMs: number, ordinal = 1) =>
  selectPitchforksVictoryPose(elapsedMs, true, false, ordinal)

check(() => assert.equal(normal(PITCHFORKS_VICTORY_START_MS - 1), 'none'))
check(() => assert.equal(normal(PITCHFORKS_VICTORY_START_MS), 'neutral'))
check(() => assert.equal(normal(PITCHFORKS_VICTORY_EYE_LIFT_START_MS - 1), 'neutral'))
check(() => assert.equal(normal(PITCHFORKS_VICTORY_EYE_LIFT_START_MS), 'eyeLift'))
check(() => assert.equal(normal(PITCHFORKS_VICTORY_ACTIVE_END_MS - 1), 'eyeLift'))
check(() => assert.equal(normal(PITCHFORKS_VICTORY_ACTIVE_END_MS), 'neutral'))
check(() => assert.equal(normal(PITCHFORKS_VICTORY_CLEAR_MS - 1), 'neutral'))
check(() => assert.equal(normal(PITCHFORKS_VICTORY_CLEAR_MS), 'none'))

check(() => {
  assert.equal(selectPitchforksVictoryPose(PITCHFORKS_VICTORY_START_MS, true, true, 1), 'neutral')
  assert.equal(selectPitchforksVictoryPose(PITCHFORKS_VICTORY_REDUCED_MOTION_END_MS - 1, true, true, 1), 'neutral')
  assert.equal(selectPitchforksVictoryPose(PITCHFORKS_VICTORY_REDUCED_MOTION_END_MS, true, true, 1), 'none')
  assert.equal(selectPitchforksVictoryPose(PITCHFORKS_VICTORY_START_MS, false, false, 1), 'none')
})

check(() => {
  const variants = [0, 1, 2, 3, 4].map(ordinal => normal(PITCHFORKS_VICTORY_EYE_LIFT_START_MS, ordinal))
  assert.deepEqual(variants, ['neutral', 'eyeLift', 'neutral', 'eyeLift', 'neutral'])
  assert.equal(variants.every((pose, index) => index === 0 || pose !== variants[index - 1]), true)
})

check(() => {
  assert.equal(selectPitchforksVictoryPose(PITCHFORKS_VICTORY_EYE_LIFT_START_MS, true, false, 1, { neutral: false, eyeLift: true }), 'none')
  assert.equal(selectPitchforksVictoryPose(PITCHFORKS_VICTORY_EYE_LIFT_START_MS, true, false, 1, { neutral: true, eyeLift: false }), 'neutral')
  assert.equal(selectPitchforksVictoryPose(PITCHFORKS_VICTORY_START_MS, true, true, 1, { neutral: true, eyeLift: false }), 'neutral')
})

check(() => {
  assert.equal(selectPitchforksVictoryPose({ elapsedMs: 850, eligible: true, reducedMotion: false, receiptOrdinal: 1 }), 'eyeLift')
  assert.equal(selectPitchforksVictoryPose({ elapsedMs: 850, eligible: true, reducedMotion: false, wave: 0 }), 'neutral')
  assert.equal(selectPitchforksVictoryPose(Number.NaN, true, false, 1), 'none')
  assert.equal(selectPitchforksVictoryPose(Number.POSITIVE_INFINITY, true, false, 1), 'none')
  assert.equal(selectPitchforksVictoryPose(-1, true, false, 1), 'none')
  assert.equal(selectPitchforksVictoryPose(850, true, false, 1.5), 'none')
  assert.equal(selectPitchforksVictoryPose(850, 'yes' as unknown as boolean, false, 1), 'none')
  assert.equal(selectPitchforksVictoryPose(850, true, 'yes' as unknown as boolean, 1), 'none')
})

console.log(`pitchforks victory pose selector and accepted art: ${checks}/${checks} PASS`)
