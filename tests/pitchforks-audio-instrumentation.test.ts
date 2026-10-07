import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  createPitchforksAudioDebugBuffer,
  interpolatePitchforksMarker,
  pitchforksMarkerOpacity,
} from '../src/components/PitchDefender/pitchforksAudioDiagnostics'
import {
  advanceExactPitchHold,
  exactPitchSampleState,
  noteToFreq,
} from '../src/components/PitchDefender/pitchMath'

const here = dirname(fileURLToPath(import.meta.url))
const componentSource = readFileSync(join(here, '../src/components/PitchDefender/PitchforksIII.tsx'), 'utf8')
const detectorSource = readFileSync(join(here, '../src/components/PitchDefender/usePitchDetection.ts'), 'utf8')

let at60 = 0
for (let frame = 0; frame < 6; frame += 1) at60 = interpolatePitchforksMarker(at60, 10, 1000 / 60)
let at30 = 0
for (let frame = 0; frame < 3; frame += 1) at30 = interpolatePitchforksMarker(at30, 10, 1000 / 30)
assert.ok(Math.abs(at60 - at30) < 1e-10, 'marker response must depend on elapsed time, not frame count')

assert.equal(pitchforksMarkerOpacity(0, 1000), 1)
assert.equal(pitchforksMarkerOpacity(500, 1000), 0.5)
assert.equal(pitchforksMarkerOpacity(1000, 1000), 0)
assert.equal(pitchforksMarkerOpacity(1500, 1000), 0)

const debug = createPitchforksAudioDebugBuffer(3)
for (let index = 0; index < 4; index += 1) {
  debug.recordEstimate({
    capturedAtMs: index * 20,
    estimatedAtMs: index * 20 + 10,
    sampleAgeMs: 10 + index,
    estimateIntervalMs: index === 0 ? null : 20,
    computeMs: 1 + index,
    valid: index % 2 === 0,
    dropout: index % 2 !== 0,
    frameIntervalMs: index === 0 ? null : 20,
    frameStallMs: null,
  })
}
assert.equal(debug.events().length, 3, 'diagnostic ring buffer must remain bounded')
assert.equal(debug.summary().estimateCount, 3)
debug.recordFrameStall(100, 33)
assert.equal(debug.events().length, 3)
assert.equal(debug.summary().frameStallCount, 1)

const held = { heldMs: 100, matched: false }
assert.deepEqual(advanceExactPitchHold(held, 'unavailable', 100, 300), held, 'dropout must award no hold credit')
assert.deepEqual(advanceExactPitchHold(held, 'wrong', 16, 300), { heldMs: 0, matched: false }, 'confident wrong note must reset hold')
let lock = { heldMs: 0, matched: false }
lock = advanceExactPitchHold(lock, 'match', 100, 300)
lock = advanceExactPitchHold(lock, 'match', 100, 300)
lock = advanceExactPitchHold(lock, 'match', 100, 300)
assert.deepEqual(lock, { heldMs: 300, matched: true }, 'hold threshold remains 300 ms')
assert.equal(exactPitchSampleState({
  frequency: noteToFreq('C3'),
  confidence: 1,
  isActive: true,
}, noteToFreq('C4'), 0.75, 70), 'wrong', 'octave-equivalent note must not earn exact-octave credit')

assert.match(detectorSource, /import \{ PitchDetector \} from 'pitchy'/, 'Pitchy must remain the detector')
assert.match(detectorSource, /onEstimate\?: \(measurement: PitchforksEstimateMeasurement\)/)
assert.match(componentSource, /get\('pfdebug'\) === '1'/, 'diagnostics must require exactly ?pfdebug=1')
assert.match(componentSource, /onEstimate: pfDebugEnabled \? recordPitchforksEstimate : undefined/)
assert.match(componentSource, /const HOLD_MS = 300/)
assert.match(componentSource, /pitchforksMarkerOpacity\(ageMs, TRAIL_MS\)/, 'dropouts must retain a fading presentation marker')
assert.match(componentSource, /const frameIntervalMs = lastTimeRef\.current \? ts - lastTimeRef\.current : 0/)

console.log('pitchforks audio instrumentation: 20/20 PASS')
