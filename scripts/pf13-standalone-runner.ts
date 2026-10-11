import { PitchDetector } from 'pitchy'
import { createBenchmarkFixtures, windowFixtures, calculateMetrics, type DetectorObservation } from '../src/components/PitchDefender/pitchBenchmark'
import { loadCrepeModel, detectPitchCrepe } from '../src/components/PitchDefender/crepeDetector'
import { loadPestoModel, detectPitchPesto } from '../src/components/PitchDefender/pestoDetector'
import * as ort from 'onnxruntime-web'

ort.env.wasm.wasmPaths = '/onnxruntime-web/'
type Pass = {
  pass: number
  fixtureIds: string[]
  windowIds: string[]
  modelInputLengths: number[]
  observations: DetectorObservation[]
  metrics: ReturnType<typeof calculateMetrics>
}

function row(detector: DetectorObservation['detector'], windowId: string, frequency: number | null, confidence: number, latencyMs: number): DetectorObservation {
  return { detector, windowId, frequency, confidence, voiced: frequency !== null, latencyMs }
}

async function runPass(pass: number): Promise<Pass> {
  const fixtures = createBenchmarkFixtures()
  const windows = windowFixtures(fixtures)
  const pitchy = PitchDetector.forFloat32Array(windows[0].source.length)
  const observations: DetectorObservation[] = []
  for (const window of windows) {
    let started = performance.now()
    const [pitch, clarity] = pitchy.findPitch(window.source, 48_000)
    let latency = performance.now() - started
    observations.push(row('pitchy', window.id, clarity > 0.85 && pitch > 60 && pitch < 2_000 ? pitch : null, clarity, latency))

    started = performance.now()
    const crepe = detectPitchCrepe(window.source, 48_000)
    latency = performance.now() - started
    const acceptedCrepe = crepe && crepe.confidence >= 0.5 ? crepe : null
    observations.push(row('crepe', window.id, acceptedCrepe?.frequency ?? null, acceptedCrepe?.confidence ?? 0, latency))

    started = performance.now()
    const pesto = await detectPitchPesto(window.source, 48_000)
    latency = performance.now() - started
    const acceptedPesto = pesto && pesto.confidence >= 0.3 ? pesto : null
    observations.push(row('pesto', window.id, acceptedPesto?.frequency ?? null, acceptedPesto?.confidence ?? 0, latency))
  }
  return {
    pass,
    fixtureIds: fixtures.map(({ id }) => id),
    windowIds: windows.map(({ id }) => id),
    modelInputLengths: windows.map(({ modelInput }) => modelInput.length),
    observations,
    metrics: calculateMetrics(observations, windows),
  }
}

const stripTiming = (pass: Pass) => ({
  fixtureIds: pass.fixtureIds,
  windowIds: pass.windowIds,
  modelInputLengths: pass.modelInputLengths,
  observations: pass.observations.map(({ latencyMs: _latencyMs, ...observation }) => observation),
  metrics: pass.metrics.map(({ medianComputeMs: _median, p95ComputeMs: _p95, ...metric }) => metric),
})

export async function runPf13Benchmark() {
  await Promise.all([loadCrepeModel(), loadPestoModel()])
  const passes = [await runPass(1), await runPass(2)]
  const nonTimingJson = passes.map((pass) => JSON.stringify(stripTiming(pass)))
  const summary = {
    fixtures: passes[0].fixtureIds.length,
    windows: passes[0].windowIds.length,
    detectorSlots: passes[0].observations.length,
    pestoMinSamples: Math.min(...passes.flatMap(({ modelInputLengths }) => modelInputLengths)),
    byteIdenticalNonTiming: nonTimingJson[0] === nonTimingJson[1],
    passes,
    nonTimingJson,
  }
  if (summary.fixtures !== 11 || summary.windows !== 330 || summary.detectorSlots !== 990 || summary.pestoMinSamples < 1024 || !summary.byteIdenticalNonTiming) {
    throw new Error(`PF13 contract failed: ${JSON.stringify({ fixtures: summary.fixtures, windows: summary.windows, detectorSlots: summary.detectorSlots, pestoMinSamples: summary.pestoMinSamples, byteIdenticalNonTiming: summary.byteIdenticalNonTiming })}`)
  }
  return summary
}

declare global {
  interface Window { __runPf13Benchmark?: () => Promise<Awaited<ReturnType<typeof runPf13Benchmark>>> }
}

window.__runPf13Benchmark = runPf13Benchmark
