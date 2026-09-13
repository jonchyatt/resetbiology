import assert from 'node:assert/strict'
import {
  PITCHFORKS_LEVEL_ACCURACY_GOAL,
  PITCHFORKS_MIN_TARGETS_FOR_NEW_NOTE,
  createPitchforksLevelProgress,
  pitchforksLevelAccuracy,
  pitchforksLevelAccuracyPercent,
  pitchforksLevelHasPassingAccuracy,
  pitchforksLevelResult,
  pitchforksNewNoteAccuracyEligible,
  recordPitchforksLevelOutcome,
} from '../src/components/PitchDefender/pitchforksLevelProgress'

const record = (
  progress: ReturnType<typeof createPitchforksLevelProgress>,
  targetKey: string,
  correct: boolean,
  credit: 'guided-practice' | 'hinted' | 'recall' | 'ear' = 'recall',
  lane: 'voice' | 'buttons' = 'voice',
) => recordPitchforksLevelOutcome(progress, {
  targetKey,
  correct,
  lane,
  credit,
})

assert.equal(PITCHFORKS_LEVEL_ACCURACY_GOAL, 0.95)
assert.equal(PITCHFORKS_MIN_TARGETS_FOR_NEW_NOTE, 6)

let levelOne = createPitchforksLevelProgress(1)
for (let i = 0; i < 6; i++) levelOne = record(levelOne, `v1:${i}`, true, 'guided-practice')
assert.equal(levelOne.completedTargets, 6)
assert.equal(levelOne.correctTargets, 6)
assert.equal(levelOne.voiceTargets, 6)
assert.equal(levelOne.voiceCorrectTargets, 6)
assert.equal(levelOne.supportedPracticeTargets, 6)
assert.equal(levelOne.supportedPracticeCorrectTargets, 6)
assert.equal(levelOne.unaidedTargets, 0)
assert.equal(pitchforksLevelAccuracy(levelOne), 1)
assert.equal(pitchforksLevelAccuracyPercent(levelOne), 100)
assert.equal(pitchforksLevelHasPassingAccuracy(levelOne), true)
assert.equal(pitchforksNewNoteAccuracyEligible(levelOne), true)

// The first outcome for an encounter+tine key owns the score. Echoes and
// duplicate callbacks cannot turn one target into two attempts.
const afterDuplicate = record(levelOne, 'v1:0', false, 'recall')
assert.strictEqual(afterDuplicate, levelOne)
assert.equal(afterDuplicate.completedTargets, 6)
assert.equal(afterDuplicate.correctTargets, 6)

// Missing and invalid detector samples are not outcomes at all.
const afterMissing = recordPitchforksLevelOutcome(levelOne, {
  targetKey: 'v1:missing', correct: true, lane: 'voice', credit: 'recall', sampleState: 'missing',
})
const afterInvalid = recordPitchforksLevelOutcome(levelOne, {
  targetKey: 'v1:invalid', correct: false, lane: 'voice', credit: 'recall', sampleState: 'invalid',
})
assert.strictEqual(afterMissing, levelOne)
assert.strictEqual(afterInvalid, levelOne)

// Later levels measure unaided recall. Guided and hinted successes remain
// visible as supported practice but never become unaided credit.
let levelTwo = createPitchforksLevelProgress(2)
levelTwo = record(levelTwo, 'v2:guided-a', true, 'guided-practice')
levelTwo = record(levelTwo, 'v2:guided-b', true, 'guided-practice')
levelTwo = record(levelTwo, 'v2:hinted', true, 'hinted')
for (let i = 0; i < 4; i++) levelTwo = record(levelTwo, `v2:recall-${i}`, true, 'recall')
assert.equal(levelTwo.completedTargets, 7)
assert.equal(levelTwo.supportedPracticeCorrectTargets, 2)
assert.equal(levelTwo.hintedCorrectTargets, 1)
assert.equal(levelTwo.unaidedTargets, 4)
assert.equal(levelTwo.unaidedCorrectTargets, 4)
assert.equal(pitchforksLevelAccuracyPercent(levelTwo), 57)
assert.equal(pitchforksLevelHasPassingAccuracy(levelTwo), false)

let recallLevel = createPitchforksLevelProgress(2)
for (let i = 0; i < 19; i++) recallLevel = record(recallLevel, `v2b:${i}`, true, 'recall')
recallLevel = record(recallLevel, 'v2b:19', false, 'hinted')
assert.equal(recallLevel.voiceTargets, 20)
assert.equal(recallLevel.unaidedCorrectTargets, 19)
assert.equal(pitchforksLevelAccuracy(recallLevel), 0.95)
assert.equal(pitchforksLevelAccuracyPercent(recallLevel), 95)
assert.equal(pitchforksLevelHasPassingAccuracy(recallLevel), true)

// Six completed targets is necessary for admission even when the accuracy is
// passing; a single miss is still recorded and prevents a false 95% claim.
let belowMinimum = createPitchforksLevelProgress(3)
for (let i = 0; i < 5; i++) belowMinimum = record(belowMinimum, `v3:${i}`, true, 'recall')
assert.equal(pitchforksLevelAccuracyPercent(belowMinimum), 100)
assert.equal(pitchforksNewNoteAccuracyEligible(belowMinimum), false)
let withMiss = record(belowMinimum, 'v3:5', false, 'recall')
assert.equal(withMiss.completedTargets, 6)
assert.equal(pitchforksLevelAccuracyPercent(withMiss), 83)
assert.equal(pitchforksNewNoteAccuracyEligible(withMiss), false)
assert.equal(pitchforksLevelResult(withMiss).cleared, false)
assert.match(pitchforksLevelResult(withMiss).nextStep, /supportive retry/i)

// Button answers are a separate EAR lane and cannot be relabeled as voice
// recall evidence by a caller.
let ear = createPitchforksLevelProgress(1)
ear = record(ear, 'ear:C4', true, 'recall', 'buttons')
ear = record(ear, 'ear:C5', false, 'recall', 'buttons')
assert.equal(ear.earTargets, 2)
assert.equal(ear.earCorrectTargets, 1)
assert.equal(ear.voiceTargets, 0)
assert.equal(ear.unaidedTargets, 0)
assert.equal(pitchforksLevelAccuracyPercent(ear, 'buttons'), 50)
assert.equal(pitchforksNewNoteAccuracyEligible(ear, 'buttons'), false)

const clear = pitchforksLevelResult(levelOne)
assert.equal(clear.cleared, true)
assert.equal(clear.accuracyPercent, 100)
assert.equal(clear.nextLevel, 2)
assert.match(clear.nextStep, /Level 2/)

console.log('pitchforks level progress: 32/32 PASS')
