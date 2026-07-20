import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { pitchforksTunerFeedback } from '../src/components/PitchDefender/pitchforksTunerFeedback'

const feedback = (sourceNote: string | null, targetNote: string | null, deviationSemis: number | null, lockProgress = 0) =>
  pitchforksTunerFeedback({
    sourceNote,
    targetNote,
    deviationSemis,
    matchingSuppressed: false,
    lockProgress,
    toleranceSemis: 0.7,
  })

assert.equal(feedback(null, null, null).kind, 'waiting')
assert.equal(feedback(null, 'D4', null).kind, 'searching')
assert.equal(feedback('D3', 'D4', -12).kind, 'octave-low')
assert.match(feedback('D3', 'D4', -12).detail, /OCTAVE LOW · GO HIGHER/)
assert.equal(feedback('D5', 'D4', 12).kind, 'octave-high')
assert.match(feedback('D5', 'D4', 12).detail, /OCTAVE HIGH · GO LOWER/)
assert.equal(feedback('C4', 'D4', -2).kind, 'low')
assert.equal(feedback('E4', 'D4', 2).kind, 'high')
assert.equal(feedback('D4', 'D4', 0.69).kind, 'on-target')
assert.equal(feedback('D4', 'D4', 0, 1).kind, 'locked')

const listen = pitchforksTunerFeedback({
  sourceNote: 'D4',
  targetNote: 'D4',
  deviationSemis: 0,
  matchingSuppressed: true,
  lockProgress: 0,
  toleranceSemis: 0.7,
})
assert.equal(listen.kind, 'listen')

const source = readFileSync(new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url), 'utf8')
assert.match(source, /const tunerTargetKeyRef = useRef\(''\)/)
assert.match(source, /const tunerNeedsRebaseRef = useRef\(false\)/)
assert.match(source, /if \(targetChanged\) \{[\s\S]*?pitchTrailRef\.current = \[\][\s\S]*?barDotDeviationRef\.current = null/)
assert.match(source, /smoothDevRef\.current = tunerNeedsRebaseRef\.current[\s\S]*?\? clampedDeviation[\s\S]*?tunerNeedsRebaseRef\.current = false/)
assert.match(source, /data-testid="pf3-tuner-feedback"/)
assert.match(source, /aria-live="polite"/)
assert.match(source, /matchingSuppressedUntilRef\.current = now \+ suppressMs/)
assert.match(source, /setPromptText\(`\$\{mode === 'replay' \? 'Replay' : 'Listen'\}: \$\{liveNotes\[0\]\}`\)/)
assert.match(source, /const finishCue = \(\) => \{[\s\S]*?if \(matchingSuppressedNow\(\)\)[\s\S]*?setTimeout\(finishCue, 25\)/)
assert.match(source, /flushSync\(\(\) => setTunerFeedback\(feedback\)\)/)

console.log('pitchforks octave feedback: 21/21 PASS')
