import assert from 'node:assert/strict'

import { selectPitchforksCuePrompt } from '../src/components/PitchDefender/PitchforksIII'

let checks = 0
const check = (run: () => void) => {
  run()
  checks += 1
}

// These are the existing authored cue and echo windows. The test drives the
// same two booleans independently so a cue/echo boundary cannot be rounded up.
const CUE_MS = 1_000
const ECHO_TAIL_MS = 350
const SUPPRESSION_MS = CUE_MS + ECHO_TAIL_MS
const promptAt = (nowMs: number, burned = 0) => selectPitchforksCuePrompt('C4', burned, {
  cuePlaying: nowMs < CUE_MS,
  matchingSuppressed: nowMs < SUPPRESSION_MS,
})

check(() => assert.equal(promptAt(0), null, 'the first cue frame remains Listen-owned'))
check(() => assert.equal(promptAt(CUE_MS - 1), null, 'an audible cue never asks the player to sing'))
check(() => assert.equal(promptAt(CUE_MS), null, 'cue end is still inside the echo tail'))
check(() => assert.equal(promptAt(SUPPRESSION_MS - 1), null, 'the full echo tail remains suppressed'))
check(() => assert.equal(promptAt(SUPPRESSION_MS), 'Sing: C4', 'finished timing hands the target back to the singer'))
check(() => assert.equal(promptAt(SUPPRESSION_MS + 1, 1), 'Now: C4', 'the next tine keeps Now semantics after suppression'))

check(() => assert.equal(
  selectPitchforksCuePrompt('E4', 0, { cuePlaying: true, matchingSuppressed: false }),
  null,
  'actual cue playback blocks the action prompt even without the echo flag',
))
check(() => assert.equal(
  selectPitchforksCuePrompt('E4', 0, { cuePlaying: false, matchingSuppressed: true }),
  null,
  'echo suppression blocks the action prompt after playback ends',
))
check(() => assert.equal(
  selectPitchforksCuePrompt('E4', 0, { cuePlaying: false, matchingSuppressed: false }),
  'Sing: E4',
  'only finished timing publishes Sing',
))

console.log(`pitchforks cue/prompt sync: ${checks}/${checks} PASS`)
