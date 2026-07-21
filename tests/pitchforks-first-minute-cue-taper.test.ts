import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  cueSupportForNote,
  firstMinuteCoachCopy,
  parseCueSupportProfile,
  recordCueSupportOutcome,
  replayLabelForCueSupport,
  type CueSupportEvidence,
} from '../src/components/PitchDefender/pitchforksCurriculum'

const fresh: CueSupportEvidence = { guidedSuccesses: 0, independentRecalls: 0, needsGuidedRecovery: false }
const newMemory = { phase: 'new' as const, lastReview: 0 }
const learningMemory = { phase: 'learning' as const, lastReview: 1 }
const reviewMemory = { phase: 'review' as const, lastReview: 1 }

assert.equal(cueSupportForNote(newMemory, fresh, false, false), 'guided')
assert.equal(cueSupportForNote(learningMemory, fresh, false, false), 'guided')
assert.equal(cueSupportForNote(reviewMemory, fresh, false, false), 'recall')
assert.equal(cueSupportForNote(reviewMemory, fresh, true, false), 'guided')
assert.equal(cueSupportForNote(reviewMemory, fresh, false, true), 'guided')

const afterMiss = recordCueSupportOutcome(fresh, 'miss')
assert.deepEqual(afterMiss, { guidedSuccesses: 0, independentRecalls: 0, needsGuidedRecovery: true })
assert.equal(cueSupportForNote(reviewMemory, afterMiss, false, false), 'guided')

const afterRecovery = recordCueSupportOutcome(afterMiss, 'guided-success')
assert.deepEqual(afterRecovery, { guidedSuccesses: 2, independentRecalls: 0, needsGuidedRecovery: false })
assert.equal(cueSupportForNote(learningMemory, afterRecovery, false, false), 'recall')
assert.equal(cueSupportForNote(reviewMemory, afterRecovery, false, false), 'recall')

const afterHint = recordCueSupportOutcome(fresh, 'hinted-success')
assert.deepEqual(afterHint, { guidedSuccesses: 0, independentRecalls: 0, needsGuidedRecovery: true })

const afterRecall = recordCueSupportOutcome(fresh, 'recall-success')
assert.deepEqual(afterRecall, { guidedSuccesses: 0, independentRecalls: 1, needsGuidedRecovery: false })

const profile = parseCueSupportProfile(JSON.stringify({
  version: 1,
  notes: {
    D4: afterRecall,
    E4: { guidedSuccesses: 2, independentRecalls: -2, needsGuidedRecovery: 'yes' },
  },
}))
assert.deepEqual(profile.notes.D4, afterRecall)
assert.equal(profile.notes.E4, undefined)
assert.deepEqual(parseCueSupportProfile('{bad json'), { version: 1, notes: {} })

assert.equal(replayLabelForCueSupport('guided', 1), '🔊 REPLAY NOTE')
assert.equal(replayLabelForCueSupport('guided', 2), '🔊 REPLAY NOTES')
assert.equal(replayLabelForCueSupport('recall', 1), '💡 HINT · HEAR NOTE')
assert.equal(replayLabelForCueSupport('recall', 2), '💡 HINT · HEAR CHAIN')
assert.equal(replayLabelForCueSupport('recall', 1, true), '🔊 HINT PLAYING · NOTE')
assert.equal(replayLabelForCueSupport('recall', 2, true), '🔊 HINT PLAYING · CHAIN')

assert.equal(firstMinuteCoachCopy('threat', null), 'THE MOB IS COMING · YOUR VOICE WILL ARM THE LIGHTNING')
assert.equal(firstMinuteCoachCopy('listen', 'D4'), 'LISTEN TO D4 · THEN MATCH IT')
assert.equal(firstMinuteCoachCopy('sing', 'D4'), 'SING D4 · HUM TO ARM THE LIGHTNING')
assert.equal(firstMinuteCoachCopy('charge', 'D4'), 'HOLD D4 · THE CLOUD IS CHARGING')
assert.equal(firstMinuteCoachCopy('strike', 'D4'), 'LIGHTNING RELEASED · WATCH THE FORK')
assert.equal(firstMinuteCoachCopy('victory', 'D4'), 'FIRST FORK STOPPED · THE DUNGEON EXHALES')
assert.equal(firstMinuteCoachCopy('complete', null), null)

const source = readFileSync(new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url), 'utf8')
assert.match(source, /cueSupportForNote\(/)
assert.match(source, /recordCueSupportOutcome\(/)
assert.match(source, /data-testid="pf3-first-minute-coach"/)
assert.match(source, /aria-live="polite"/)
assert.doesNotMatch(source, /automaticCueForWave\(/)

const coachIndex = source.indexOf('data-testid="pf3-first-minute-coach"')
const replayIndex = source.indexOf('data-testid="pf3-replay-notes"')
assert.ok(coachIndex > 0 && replayIndex > coachIndex, 'coach must live in the learning dock before Replay/Hint')

console.log('pitchforks first-minute cue taper: 38/38 PASS')
