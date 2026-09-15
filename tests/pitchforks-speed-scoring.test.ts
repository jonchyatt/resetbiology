import assert from 'node:assert/strict'
import test from 'node:test'
import { speedBonusForLatencyMs } from '../src/components/PitchDefender/pitchforksScoring'

test('speed bonus tiers honor fast, medium, slow, and exact boundaries', () => {
  assert.equal(speedBonusForLatencyMs(799), 15)
  assert.equal(speedBonusForLatencyMs(800), 8)
  assert.equal(speedBonusForLatencyMs(1499), 8)
  assert.equal(speedBonusForLatencyMs(1500), 0)
  assert.equal(speedBonusForLatencyMs(2000), 0)
})
