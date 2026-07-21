import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  PITCHFORKS_SPARK_MAX_AUTO_PULSES,
  PITCHFORKS_SPARK_QUIET_REPULSE_MS,
  PITCHFORKS_SPARK_WRONG_REPULSE_MS,
  advancePitchforksSparkGuide,
  createPitchforksSparkGuideState,
  pausePitchforksSparkGuide,
} from '../src/components/PitchDefender/pitchforksSparkGuide'

let checks = 0
const check = (fn: () => void) => {
  fn()
  checks += 1
}

const input = (
  nowMs: number,
  sample: 'suppressed' | 'silence' | 'confident-wrong' | 'progress',
  overrides: Partial<Parameters<typeof advancePitchforksSparkGuide>[1]> = {},
) => ({
  nowMs,
  targetKey: '7:0',
  targetNote: 'D4',
  eligible: true,
  sample,
  pulseWindowMs: 1350,
  ...overrides,
})

check(() => assert.equal(PITCHFORKS_SPARK_QUIET_REPULSE_MS, 3000))
check(() => assert.equal(PITCHFORKS_SPARK_WRONG_REPULSE_MS, 4000))
check(() => assert.equal(PITCHFORKS_SPARK_MAX_AUTO_PULSES, 3))

let state = createPitchforksSparkGuideState()
let step = advancePitchforksSparkGuide(state, input(0, 'suppressed'))
state = step.state
check(() => assert.equal(state.generation, 1))
check(() => assert.equal(state.autoPulseCount, 0, 'activation cue is outside the re-pulse cap'))
check(() => assert.equal(step.fire, null))

step = advancePitchforksSparkGuide(state, input(1350, 'silence'))
state = step.state
check(() => assert.equal(state.quietSinceMs, 1350))
check(() => assert.equal(state.wrongSinceMs, null))
step = advancePitchforksSparkGuide(state, input(4349, 'silence'))
state = step.state
check(() => assert.equal(step.fire, null))
step = advancePitchforksSparkGuide(state, input(4350, 'silence'))
state = step.state
check(() => assert.equal(step.fire?.reason, 'quiet'))
check(() => assert.equal(state.autoPulseCount, 1))
check(() => assert.equal(state.status, 'pulse'))
check(() => assert.equal(state.pulseUntilMs, 5700))

step = advancePitchforksSparkGuide(state, input(5700, 'confident-wrong'))
state = step.state
check(() => assert.equal(state.quietSinceMs, null))
check(() => assert.equal(state.wrongSinceMs, 5700))
step = advancePitchforksSparkGuide(state, input(9699, 'confident-wrong'))
state = step.state
check(() => assert.equal(step.fire, null))
step = advancePitchforksSparkGuide(state, input(9700, 'confident-wrong'))
state = step.state
check(() => assert.equal(step.fire?.reason, 'confident-wrong'))
check(() => assert.equal(state.autoPulseCount, 2))

step = advancePitchforksSparkGuide(state, input(11050, 'silence'))
state = step.state
step = advancePitchforksSparkGuide(state, input(12000, 'confident-wrong'))
state = step.state
check(() => assert.equal(state.quietSinceMs, null, 'usable wrong pitch cancels quiet eligibility'))
check(() => assert.equal(state.wrongSinceMs, 12000, 'wrong clock starts independently'))
step = advancePitchforksSparkGuide(state, input(13000, 'progress'))
state = step.state
check(() => assert.equal(state.wrongSinceMs, null, 'in-window progress resets the corrective clock'))
check(() => assert.equal(state.status, 'idle'))

step = advancePitchforksSparkGuide(state, input(14000, 'silence'))
state = step.state
step = advancePitchforksSparkGuide(state, input(17000, 'silence'))
state = step.state
check(() => assert.equal(step.fire?.reason, 'quiet'))
check(() => assert.equal(state.autoPulseCount, 3))
step = advancePitchforksSparkGuide(state, input(18350, 'silence'))
state = step.state
check(() => assert.equal(state.status, 'capped'))
step = advancePitchforksSparkGuide(state, input(30000, 'silence'))
state = step.state
check(() => assert.equal(step.fire, null, 'a fourth automatic re-pulse never fires'))
check(() => assert.equal(state.autoPulseCount, 3))

const generationBeforeTargetChange = state.generation
step = advancePitchforksSparkGuide(state, input(31000, 'suppressed', { targetKey: '8:0', targetNote: 'E4' }))
state = step.state
check(() => assert.equal(state.generation, generationBeforeTargetChange + 1))
check(() => assert.equal(state.autoPulseCount, 0))
check(() => assert.equal(state.targetNote, 'E4'))

step = advancePitchforksSparkGuide(state, input(32350, 'silence', { targetKey: '8:0', targetNote: 'E4' }))
state = step.state
const paused = pausePitchforksSparkGuide(state)
check(() => assert.equal(paused.targetKey, '8:0'))
check(() => assert.equal(paused.autoPulseCount, 0))
check(() => assert.equal(paused.quietSinceMs, null, 'Replay cancels the pending clock without resetting the cap'))

step = advancePitchforksSparkGuide(paused, input(33000, 'silence', { eligible: false, targetKey: '8:0', targetNote: 'E4' }))
check(() => assert.equal(step.fire, null))
check(() => assert.equal(step.state.quietSinceMs, null, 'Audio OFF, 0%, Recall, and Button lanes cannot retain a clock'))

step = advancePitchforksSparkGuide(step.state, input(34000, 'silence', { targetKey: null, targetNote: null }))
check(() => assert.equal(step.state.targetKey, null))
check(() => assert.equal(step.state.status, 'idle'))

const shell = readFileSync(new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url), 'utf8')
check(() => assert.match(shell, /advancePitchforksSparkGuide\(/))
check(() => assert.match(shell, /data-spark-guide-status=\{sparkGuideStatus\}/))
check(() => assert.match(shell, /PULSED GUIDE/))
check(() => assert.match(shell, /sparkGuideEvents:/))
check(() => assert.doesNotMatch(shell, /HEADPHONES CONNECTED|CONTINUOUS SPARK|startContinuousSpark/))
check(() => assert.match(shell, /TONE_SUPPRESS_MS = TONE_MS \+ ECHO_TAIL_MS/))

console.log(`pitchforks pulsed spark guide: ${checks}/${checks} PASS`)
