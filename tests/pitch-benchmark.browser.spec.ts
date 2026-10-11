import { test, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

test('runs two identical three-detector benchmark passes', async ({ page }) => {
  test.setTimeout(600_000)
  await page.goto('/pitch-defender/crepe-benchmark', { waitUntil: 'domcontentloaded', timeout: 300_000 })
  await expect(page.getByTestId('benchmark-status')).toHaveText('Ready')
  const result = await page.evaluate(async () => {
    if (!window.__runPitchBenchmark) throw new Error('benchmark runner was not installed')
    return window.__runPitchBenchmark()
  })

  expect(result.passes).toHaveLength(2)
  for (const pass of result.passes) {
    expect(pass.fixtureIds).toHaveLength(11)
    expect(pass.windowIds).toHaveLength(330)
    expect(pass.modelInputLengths.every((length) => length >= 1024)).toBe(true)
    expect(pass.observations).toHaveLength(990)
    expect(new Set(pass.observations.map((row) => row.detector))).toEqual(new Set(['pitchy', 'pesto', 'crepe']))
    expect(pass.observations.every((row) => Number.isFinite(row.latencyMs) && row.latencyMs >= 0)).toBe(true)
  }
  expect(result.passes[0].fixtureIds).toEqual(result.passes[1].fixtureIds)
  expect(result.passes[0].windowIds).toEqual(result.passes[1].windowIds)
  expect(result.nonTimingJson[0]).toBe(result.nonTimingJson[1])

  const outputDir = join(process.cwd(), 'test-results')
  await mkdir(outputDir, { recursive: true })
  await writeFile(join(outputDir, 'pf11-detector-benchmark.json'), JSON.stringify(result, null, 2) + '\n', 'utf8')
  console.log(JSON.stringify({ fixtures: 11, windows: 330, detectors: 3, rows: 990, pestoSamples: 1024 }))
})
