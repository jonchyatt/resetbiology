import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import {
  PITCHFORKS_CHARGE_FRAME_DWELL_SECONDS,
  PITCHFORKS_IDLE_FPS,
  selectPitchforksChargePose,
} from '../src/components/PitchDefender/pitchforksChargePose'

let checks = 0
const check = (fn: () => void) => {
  fn()
  checks += 1
}

const asset = readFileSync(new URL('../public/images/pitchforks/frankenstein_conductor_coil.png', import.meta.url))
const assetHash = createHash('sha256').update(asset).digest('hex').toUpperCase()

check(() => assert.equal(assetHash, '3CE58A60AEB805AD89EECBF2A809B4B7F3B91F26D8F913440D00CD2A4F2FB0F6'))
check(() => assert.equal(asset.subarray(0, 8).toString('hex'), '89504e470d0a1a0a'))
check(() => assert.equal(asset.readUInt32BE(16), 384))
check(() => assert.equal(asset.readUInt32BE(20), 144))
check(() => assert.equal(asset.readUInt32BE(16) / 4, 96))
check(() => assert.equal(asset.readUInt32BE(20), 144))

check(() => assert.equal(PITCHFORKS_IDLE_FPS, 4))
check(() => assert.equal(PITCHFORKS_CHARGE_FRAME_DWELL_SECONDS, 1.5))

check(() => assert.deepEqual(selectPitchforksChargePose(0.01, 0, false, true), { pose: 'charge', frame: 0 }))
check(() => assert.deepEqual(selectPitchforksChargePose(0.01, 1.5, false, true), { pose: 'charge', frame: 1 }))
check(() => assert.deepEqual(selectPitchforksChargePose(0.01, 4.5, false, true), { pose: 'charge', frame: 3 }))
check(() => assert.deepEqual(selectPitchforksChargePose(0.01, 6, false, true), { pose: 'charge', frame: 0 }))

check(() => assert.deepEqual(selectPitchforksChargePose(0, 0.5, false, true), { pose: 'idle', frame: 2 }))
check(() => assert.deepEqual(selectPitchforksChargePose(-1, 0.75, false, true), { pose: 'idle', frame: 3 }))
check(() => assert.deepEqual(selectPitchforksChargePose(0.5, 0.75, false, false), { pose: 'idle', frame: 3 }))
check(() => assert.deepEqual(selectPitchforksChargePose(0.5, 2, true, true), { pose: 'charge', frame: 0 }))
check(() => assert.deepEqual(selectPitchforksChargePose(0, 2, true, true), { pose: 'idle', frame: 0 }))

check(() => assert.deepEqual(selectPitchforksChargePose(Number.NaN, 2, false, true), { pose: 'idle', frame: 0 }))
check(() => assert.deepEqual(selectPitchforksChargePose(0.5, Number.POSITIVE_INFINITY, false, true), { pose: 'idle', frame: 0 }))
check(() => assert.deepEqual(selectPitchforksChargePose(Number.NEGATIVE_INFINITY, 2, false, true), { pose: 'idle', frame: 0 }))
check(() => assert.deepEqual(selectPitchforksChargePose(0.5, 2, 'yes' as unknown as boolean, true), { pose: 'idle', frame: 0 }))
check(() => assert.deepEqual(selectPitchforksChargePose(0.5, 2, false, 'yes' as unknown as boolean), { pose: 'idle', frame: 0 }))

console.log(`pitchforks conductor-coil asset and charge pose: ${checks}/${checks} PASS`)
