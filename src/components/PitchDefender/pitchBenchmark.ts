export const BENCHMARK_SAMPLE_RATE = 48_000
export const MODEL_SAMPLE_RATE = 16_000
export const SOURCE_WINDOW_SAMPLES = 3_072
export const WINDOW_HOP_SAMPLES = 1_536
export const WINDOW_DURATION_SECONDS = 1

export type FixtureKind = 'steady' | 'step' | 'octave-leap' | 'glide' | 'silence' | 'reference-only' | 'reference-plus-singer'

export interface BenchmarkFixture {
  id: string
  kind: FixtureKind
  sampleRate: number
  samples: Float32Array
  expectedVoiced: boolean
  frequencyAt(sampleIndex: number): number | null
}

export interface BenchmarkWindow {
  id: string
  fixtureId: string
  kind: FixtureKind
  startSample: number
  centerSample: number
  source: Float32Array
  modelInput: Float32Array
  expectedFrequency: number | null
  expectedVoiced: boolean
  straddlesStep: boolean
}

export interface DetectorObservation {
  detector: 'pitchy' | 'pesto' | 'crepe'
  windowId: string
  frequency: number | null
  confidence: number
  voiced: boolean
  latencyMs: number
}

export interface DetectorMetrics {
  detector: DetectorObservation['detector']
  voicedWindows: number
  missedVoiced: number
  medianCentsError: number | null
  p95CentsError: number | null
  octaveErrors: number
  octaveErrorRate: number
  silenceFalseVoicedRate: number
  medianComputeMs: number
  p95ComputeMs: number
}

const NOTE: Record<string, number> = {
  C2: 65.40639132514966,
  'C#4': 277.1826309768721,
  C3: 130.8127826502993,
  C4: 261.6255653005986,
  D4: 293.6647679174076,
  C5: 523.2511306011972,
  C6: 1046.5022612023946,
}

function sineClip(frequencyAt: (i: number) => number, voiced = true): Float32Array {
  const output = new Float32Array(BENCHMARK_SAMPLE_RATE)
  if (!voiced) return output
  let phase = 0
  for (let i = 0; i < output.length; i += 1) {
    const frequency = frequencyAt(i)
    phase += (2 * Math.PI * frequency) / BENCHMARK_SAMPLE_RATE
    const edge = Math.min(1, i / 480, (output.length - i) / 480)
    output[i] = Math.cos(phase) * Math.max(0, edge)
  }
  return output
}

function fixedFixture(id: string, kind: FixtureKind, samples: Float32Array, expectedVoiced: boolean, frequencyAt: (i: number) => number | null): BenchmarkFixture {
  return { id, kind, samples, sampleRate: BENCHMARK_SAMPLE_RATE, expectedVoiced, frequencyAt }
}

export function createBenchmarkFixtures(): BenchmarkFixture[] {
  const c4 = NOTE.C4
  const c3 = NOTE.C3
  const cSharp4 = NOTE['C#4']
  const d4 = NOTE.D4
  const fixtures: BenchmarkFixture[] = [
    ...(['C2', 'C3', 'C4', 'C5', 'C6'] as const).map((id) => fixedFixture(`steady-${id}`, 'steady', sineClip(() => NOTE[id]), true, () => NOTE[id])),
    fixedFixture('step-c4-csharp4', 'step', sineClip((i) => i < 24_000 ? c4 : cSharp4), true, (i) => i < 24_000 ? c4 : cSharp4),
    fixedFixture('octave-leap-c3-c4', 'octave-leap', sineClip((i) => i < 24_000 ? c3 : c4), true, (i) => i < 24_000 ? c3 : c4),
    fixedFixture('glide-c3-c4', 'glide', sineClip((i) => c3 * Math.pow(2, (i / 47_999) * 1)), true, (i) => c3 * Math.pow(2, (i / 47_999))),
    fixedFixture('silence', 'silence', new Float32Array(BENCHMARK_SAMPLE_RATE), false, () => null),
    fixedFixture('reference-only-c4', 'reference-only', sineClip(() => c4, true).map((sample) => sample * 0.02), false, () => null),
    fixedFixture('reference-plus-singer-d4', 'reference-plus-singer', sineClip(() => d4, true).map((sample, i) => sample * 0.8 + Math.cos((2 * Math.PI * c4 * i) / BENCHMARK_SAMPLE_RATE) * 0.08), true, () => d4),
  ]
  return fixtures
}

export function resampleLinear(source: Float32Array, sourceRate: number, targetRate = MODEL_SAMPLE_RATE): Float32Array {
  if (sourceRate === targetRate) return source.slice()
  const ratio = sourceRate / targetRate
  const output = new Float32Array(Math.ceil(source.length / ratio))
  for (let i = 0; i < output.length; i += 1) {
    const position = i * ratio
    const lo = Math.floor(position)
    const hi = Math.min(lo + 1, source.length - 1)
    const fraction = position - lo
    output[i] = source[lo] * (1 - fraction) + source[hi] * fraction
  }
  return output
}

export function windowFixtures(fixtures: BenchmarkFixture[]): BenchmarkWindow[] {
  const windows: BenchmarkWindow[] = []
  for (const fixture of fixtures) {
    for (let start = 0; start + SOURCE_WINDOW_SAMPLES <= fixture.samples.length; start += WINDOW_HOP_SAMPLES) {
      const center = start + SOURCE_WINDOW_SAMPLES / 2
      const expectedFrequency = fixture.frequencyAt(center)
      windows.push({
        id: `${fixture.id}:w${String(windows.filter((window) => window.fixtureId === fixture.id).length).padStart(3, '0')}`,
        fixtureId: fixture.id,
        kind: fixture.kind,
        startSample: start,
        centerSample: center,
        source: fixture.samples.slice(start, start + SOURCE_WINDOW_SAMPLES),
        modelInput: resampleLinear(fixture.samples.slice(start, start + SOURCE_WINDOW_SAMPLES), fixture.sampleRate),
        expectedFrequency,
        expectedVoiced: fixture.expectedVoiced,
        straddlesStep: fixture.kind === 'step' || fixture.kind === 'octave-leap' ? Math.abs(center - 24_000) < SOURCE_WINDOW_SAMPLES / 2 : false,
      })
    }
  }
  return windows
}

export function centsError(detectedHz: number, expectedHz: number): number {
  return Math.abs(1_200 * Math.log2(detectedHz / expectedHz))
}

export function octaveDisplacement(detectedHz: number, expectedHz: number): number | null {
  const displacement = Math.round(Math.log2(detectedHz / expectedHz))
  const residual = Math.abs(1_200 * Math.log2(detectedHz / (expectedHz * Math.pow(2, displacement))))
  return displacement !== 0 && residual <= 50 ? displacement : null
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)]
}

export function calculateMetrics(observations: DetectorObservation[], windows: BenchmarkWindow[]): DetectorMetrics[] {
  return (['pitchy', 'pesto', 'crepe'] as const).map((detector) => {
    const rows = observations.filter((observation) => observation.detector === detector)
    const byWindow = new Map(rows.map((row) => [row.windowId, row]))
    const voicedWindows = windows.filter((window) => window.expectedVoiced && !window.straddlesStep)
    const errors = voicedWindows.flatMap((window) => {
      const row = byWindow.get(window.id)
      return row?.voiced && row.frequency && window.expectedFrequency ? [centsError(row.frequency, window.expectedFrequency)] : []
    })
    const octaveErrors = voicedWindows.filter((window) => {
      const row = byWindow.get(window.id)
      return Boolean(row?.voiced && row.frequency && window.expectedFrequency && octaveDisplacement(row.frequency, window.expectedFrequency) !== null)
    }).length
    const silence = windows.filter((window) => window.kind === 'silence')
    const falseVoiced = silence.filter((window) => byWindow.get(window.id)?.voiced).length
    const timings = rows.map((row) => row.latencyMs)
    return {
      detector,
      voicedWindows: errors.length,
      missedVoiced: voicedWindows.length - errors.length,
      medianCentsError: percentile(errors, 0.5),
      p95CentsError: percentile(errors, 0.95),
      octaveErrors,
      octaveErrorRate: voicedWindows.length ? octaveErrors / voicedWindows.length : 0,
      silenceFalseVoicedRate: silence.length ? falseVoiced / silence.length : 0,
      medianComputeMs: percentile(timings, 0.5) ?? 0,
      p95ComputeMs: percentile(timings, 0.95) ?? 0,
    }
  })
}
