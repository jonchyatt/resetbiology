import { writeFileSync } from 'node:fs'
import { createBenchmarkFixtures, windowFixtures } from '../src/components/PitchDefender/pitchBenchmark'

const fixtures = createBenchmarkFixtures()
const windows = windowFixtures(fixtures)
const manifest = {
  sampleRate: 48_000,
  sourceWindowSamples: 3_072,
  modelSampleRate: 16_000,
  fixtures: fixtures.map(({ id, kind, sampleRate, expectedVoiced }) => ({ id, kind, sampleRate, expectedVoiced })),
  windows: windows.map(({ id, fixtureId, kind, startSample, expectedFrequency, expectedVoiced, straddlesStep }) => ({ id, fixtureId, kind, startSample, expectedFrequency, expectedVoiced, straddlesStep })),
  detectorRowCount: windows.length * 3,
  detectors: ['pitchy', 'pesto', 'crepe'],
}
const output = process.argv[2] ?? 'data/pitchforks-rework/pf7-fixture-manifest.json'
writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(JSON.stringify({ output, fixtureCount: fixtures.length, windowCount: windows.length, detectorRowCount: manifest.detectorRowCount }))
