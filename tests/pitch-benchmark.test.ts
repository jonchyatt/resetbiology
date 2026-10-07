import assert from 'node:assert/strict'
import {
  BENCHMARK_SAMPLE_RATE,
  MODEL_SAMPLE_RATE,
  SOURCE_WINDOW_SAMPLES,
  calculateMetrics,
  centsError,
  createBenchmarkFixtures,
  octaveDisplacement,
  resampleLinear,
  windowFixtures,
  type DetectorObservation,
} from '../src/components/PitchDefender/pitchBenchmark'

const fixtures = createBenchmarkFixtures()
assert.equal(fixtures.length, 11)
assert.ok(fixtures.every((fixture) => fixture.sampleRate === BENCHMARK_SAMPLE_RATE && fixture.samples.length === BENCHMARK_SAMPLE_RATE))
assert.equal(fixtures.find((fixture) => fixture.id === 'silence')?.samples.some(Boolean), false)

const windows = windowFixtures(fixtures)
assert.ok(windows.length > 0)
assert.ok(windows.every((window) => window.source.length === SOURCE_WINDOW_SAMPLES))
assert.ok(windows.every((window) => window.modelInput.length === SOURCE_WINDOW_SAMPLES / 3))
assert.equal(new Set(windows.map((window) => window.id)).size, windows.length)
assert.equal(windows.filter((window) => window.fixtureId === 'silence').length, 30)

const resampled = resampleLinear(new Float32Array(SOURCE_WINDOW_SAMPLES), BENCHMARK_SAMPLE_RATE)
assert.equal(resampled.length, 1024)
assert.equal(centsError(523.2511306, 261.6255653), 1200)
assert.equal(octaveDisplacement(523.2511306, 261.6255653), 1)
assert.equal(octaveDisplacement(277.1826, 261.6255653), null)

const observations: DetectorObservation[] = windows.flatMap((window) => (['pitchy', 'pesto', 'crepe'] as const).map((detector) => ({
  detector,
  windowId: window.id,
  frequency: window.expectedFrequency,
  confidence: window.expectedVoiced ? 1 : 0,
  voiced: window.expectedVoiced,
  latencyMs: detector === 'pitchy' ? 1 : detector === 'pesto' ? 2 : 3,
})))
const metrics = calculateMetrics(observations, windows)
assert.deepEqual(metrics.map((metric) => metric.detector), ['pitchy', 'pesto', 'crepe'])
assert.ok(metrics.every((metric) => metric.octaveErrors === 0 && metric.silenceFalseVoicedRate === 0 && metric.missedVoiced === 0))
assert.equal(MODEL_SAMPLE_RATE, 16_000)
console.log(`pitch benchmark fixture contract: ${fixtures.length} fixtures, ${windows.length} windows, 3 detectors PASS`)
