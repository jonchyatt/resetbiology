import assert from 'node:assert/strict'

import {
  PITCHFORKS_VICTORY_NEXT_WAVE_MS,
  advancePitchforksLogicalClock,
  canSealPitchforksWaveReceipt,
  pitchforksWaveReceiptAgeMs,
  pitchforksWaveReceiptDue,
  selectPitchforksVictoryPoseForClaim,
  type PitchforksVictoryReceiptClaim,
} from '../src/components/PitchDefender/PitchforksIII'
import {
  PITCHFORKS_VICTORY_ACTIVE_END_MS,
  PITCHFORKS_VICTORY_CLEAR_MS,
  PITCHFORKS_VICTORY_REDUCED_MOTION_END_MS,
  PITCHFORKS_VICTORY_START_MS,
} from '../src/components/PitchDefender/pitchforksVictoryPose'

let checks = 0
const check = (fn: () => void) => {
  fn()
  checks += 1
}

const normalClaim: PitchforksVictoryReceiptClaim = Object.freeze({
  receiptId: 'wave-receipt:test:1',
  receiptOrdinal: 1,
  variant: 'eyeLift',
  reducedMotion: false,
  assetAvailability: Object.freeze({ neutral: true, eyeLift: true }),
  claimedAtMs: 10_000,
})

check(() => {
  assert.equal(canSealPitchforksWaveReceipt({
    spawned: 2,
    required: 2,
    villagers: [{ state: 'ash' }],
    bolts: [],
  }), false, 'ash villagers keep the authoritative receipt open')
  assert.equal(canSealPitchforksWaveReceipt({
    spawned: 2,
    required: 2,
    villagers: [],
    bolts: [{}],
  }), false, 'active bolts keep the authoritative receipt open')
  assert.equal(canSealPitchforksWaveReceipt({
    spawned: 2,
    required: 2,
    villagers: [],
    bolts: [],
  }), true)
})

check(() => {
  assert.equal(advancePitchforksLogicalClock(1_000, 250, true), 1_000, 'pause freezes the shared clock')
  assert.equal(advancePitchforksLogicalClock(1_000, 250, false), 1_250)
  assert.equal(advancePitchforksLogicalClock(1_000, Number.NaN, false), 1_000)
})

check(() => {
  const at = (ageMs: number) => pitchforksWaveReceiptAgeMs({
    logicalNowMs: normalClaim.claimedAtMs + ageMs,
    receiptStartedAtMs: normalClaim.claimedAtMs,
  })
  assert.equal(at(PITCHFORKS_VICTORY_START_MS - 1), PITCHFORKS_VICTORY_START_MS - 1)
  assert.equal(at(PITCHFORKS_VICTORY_START_MS), PITCHFORKS_VICTORY_START_MS)
  assert.equal(at(PITCHFORKS_VICTORY_ACTIVE_END_MS), PITCHFORKS_VICTORY_ACTIVE_END_MS)
  assert.equal(at(PITCHFORKS_VICTORY_CLEAR_MS), PITCHFORKS_VICTORY_CLEAR_MS)
  assert.equal(at(PITCHFORKS_VICTORY_NEXT_WAVE_MS + 500), PITCHFORKS_VICTORY_NEXT_WAVE_MS, 'debug age is bounded at the schedule')
})

check(() => {
  assert.equal(selectPitchforksVictoryPoseForClaim(normalClaim, PITCHFORKS_VICTORY_START_MS - 1), 'none')
  assert.equal(selectPitchforksVictoryPoseForClaim(normalClaim, PITCHFORKS_VICTORY_START_MS), 'neutral')
  assert.equal(selectPitchforksVictoryPoseForClaim(normalClaim, 850), 'eyeLift')
  assert.equal(selectPitchforksVictoryPoseForClaim(normalClaim, PITCHFORKS_VICTORY_ACTIVE_END_MS), 'neutral')
  assert.equal(selectPitchforksVictoryPoseForClaim(normalClaim, PITCHFORKS_VICTORY_CLEAR_MS), 'none')
  const snapshottedVariant = Object.freeze({ ...normalClaim, receiptOrdinal: 0 })
  assert.equal(selectPitchforksVictoryPoseForClaim(snapshottedVariant, 850), 'eyeLift', 'render uses the claimed variant, not a rerender-time ordinal')
})

check(() => {
  assert.equal(selectPitchforksVictoryPoseForClaim(null, 850), 'none', 'failed/retry receipts never celebrate')
  assert.equal(selectPitchforksVictoryPoseForClaim(normalClaim, 850, true), 'none', 'visibility cancellation cannot replay the pose')
  assert.equal(selectPitchforksVictoryPoseForClaim(normalClaim, 850, true), 'none')
})

check(() => {
  const reducedClaim: PitchforksVictoryReceiptClaim = Object.freeze({
    ...normalClaim,
    receiptId: 'wave-receipt:test:reduced',
    reducedMotion: true,
  })
  assert.equal(selectPitchforksVictoryPoseForClaim(reducedClaim, PITCHFORKS_VICTORY_START_MS), 'neutral')
  assert.equal(selectPitchforksVictoryPoseForClaim(reducedClaim, PITCHFORKS_VICTORY_REDUCED_MOTION_END_MS - 1), 'neutral')
  assert.equal(selectPitchforksVictoryPoseForClaim(reducedClaim, PITCHFORKS_VICTORY_REDUCED_MOTION_END_MS), 'none')
  assert.equal(reducedClaim.reducedMotion, true, 'reduced-motion is receipt-snapshotted')
  assert.equal(Object.isFrozen(reducedClaim), true)
})

check(() => {
  const startedAtMs = normalClaim.claimedAtMs
  let logicalNowMs = startedAtMs
  let advances = 0
  for (const dtMs of [400, 400, 400, 400, 300]) {
    logicalNowMs = advancePitchforksLogicalClock(logicalNowMs, dtMs, false)
    if (pitchforksWaveReceiptDue({ logicalNowMs, receiptStartedAtMs: startedAtMs })) advances += 1
  }
  assert.equal(logicalNowMs, startedAtMs + PITCHFORKS_VICTORY_NEXT_WAVE_MS)
  assert.equal(advances, 1, 'one shared clock reaches the schedule once')
  assert.equal(pitchforksWaveReceiptDue({ logicalNowMs, receiptStartedAtMs: startedAtMs }), true)
})

check(() => {
  const startedAtMs = normalClaim.claimedAtMs
  const pausedNow = advancePitchforksLogicalClock(startedAtMs, 900, true)
  assert.equal(pausedNow, startedAtMs)
  const resumedNow = advancePitchforksLogicalClock(pausedNow, PITCHFORKS_VICTORY_NEXT_WAVE_MS, false)
  assert.equal(pitchforksWaveReceiptDue({ logicalNowMs: resumedNow, receiptStartedAtMs: startedAtMs }), true)
  assert.equal(resumedNow, startedAtMs + PITCHFORKS_VICTORY_NEXT_WAVE_MS)
})

console.log(`pitchforks victory integration timing and receipt gates: ${checks}/${checks} PASS`)
