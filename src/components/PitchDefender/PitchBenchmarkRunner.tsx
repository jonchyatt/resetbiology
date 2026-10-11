'use client'

import { useEffect, useState } from 'react'
import { PitchDetector } from 'pitchy'
import { createBenchmarkFixtures, windowFixtures, calculateMetrics, type DetectorObservation } from './pitchBenchmark'
import { loadCrepeModel, detectPitchCrepe } from './crepeDetector'
import { loadPestoModel, detectPitchPesto } from './pestoDetector'

type BenchmarkPass = {
  pass: number
  fixtureIds: string[]
  windowIds: string[]
  modelInputLengths: number[]
  observations: DetectorObservation[]
  metrics: ReturnType<typeof calculateMetrics>
}

type BenchmarkOutput = {
  passes: BenchmarkPass[]
  nonTimingJson: string[]
}

declare global {
  interface Window {
    __runPitchBenchmark?: () => Promise<BenchmarkOutput>
  }
}

function observation(detector: DetectorObservation['detector'], windowId: string, frequency: number | null, confidence: number, latencyMs: number): DetectorObservation {
  return { detector, windowId, frequency, confidence, voiced: frequency !== null, latencyMs }
}

async function runPass(pass: number): Promise<BenchmarkPass> {
  const fixtures = createBenchmarkFixtures()
  const windows = windowFixtures(fixtures)
  const pitchyDetector = PitchDetector.forFloat32Array(windows[0].source.length)
  const observations: DetectorObservation[] = []

  for (const window of windows) {
    const pitchyStart = performance.now()
    const [pitch, clarity] = pitchyDetector.findPitch(window.source, 48_000)
    const pitchyLatency = performance.now() - pitchyStart
    const pitchyFrequency = clarity > 0.85 && pitch > 60 && pitch < 2_000 ? pitch : null
    observations.push(observation('pitchy', window.id, pitchyFrequency, clarity, pitchyLatency))

    const crepeStart = performance.now()
    const crepe = detectPitchCrepe(window.source, 48_000)
    const crepeLatency = performance.now() - crepeStart
    const crepeAccepted = crepe && crepe.confidence >= 0.5 ? crepe : null
    observations.push(observation('crepe', window.id, crepeAccepted?.frequency ?? null, crepeAccepted?.confidence ?? 0, crepeLatency))

    const pestoStart = performance.now()
    const pesto = await detectPitchPesto(window.source, 48_000)
    const pestoLatency = performance.now() - pestoStart
    const pestoAccepted = pesto && pesto.confidence >= 0.3 ? pesto : null
    observations.push(observation('pesto', window.id, pestoAccepted?.frequency ?? null, pestoAccepted?.confidence ?? 0, pestoLatency))
  }

  return {
    pass,
    fixtureIds: fixtures.map((fixture) => fixture.id),
    windowIds: windows.map((window) => window.id),
    modelInputLengths: windows.map((window) => window.modelInput.length),
    observations,
    metrics: calculateMetrics(observations, windows),
  }
}

export default function PitchBenchmarkRunner() {
  const [status, setStatus] = useState('Ready')

  useEffect(() => {
    let active = true
    window.__runPitchBenchmark = async () => {
      setStatus('Loading CREPE and PESTO models…')
      await Promise.all([loadCrepeModel(), loadPestoModel()])
      if (active) setStatus('Running two passes…')
      const passes = [await runPass(1), await runPass(2)]
      const stripTiming = (pass: BenchmarkPass) => ({
        fixtureIds: pass.fixtureIds,
        windowIds: pass.windowIds,
        modelInputLengths: pass.modelInputLengths,
        observations: pass.observations.map(({ latencyMs: _latencyMs, ...row }) => row),
        metrics: pass.metrics.map(({ medianComputeMs: _median, p95ComputeMs: _p95, ...metric }) => metric),
      })
      const nonTimingJson = passes.map((pass) => JSON.stringify(stripTiming(pass)))
      if (active) setStatus('Complete')
      return { passes, nonTimingJson }
    }
    return () => {
      active = false
      delete window.__runPitchBenchmark
    }
  }, [])

  return (
    <main style={{ background: '#09090b', color: '#fafafa', minHeight: '100vh', padding: 32, fontFamily: 'monospace' }}>
      <h1>Pitchy / PESTO / CREPE benchmark harness</h1>
      <p data-testid="benchmark-status">{status}</p>
      <p>Measurement-only surface. No gameplay detector or fusion path is changed.</p>
    </main>
  )
}
