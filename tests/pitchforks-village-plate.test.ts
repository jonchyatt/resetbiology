import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

for (const [name, hash] of [
  ['village_gate_plate.png', 'cb6dab40d81998018741893eded9cb1b52469ee214891a6a4bb377ce58ff35a5'],
  ['torchmaster_chamber_plate.png', 'd0ee1c2eb89ed040df8e65599f5399d1ea2612ac482f0fa44b5596c758940641'],
]) {
  const plate = readFileSync(new URL(`../public/images/pitchforks/${name}`, import.meta.url))
  assert.equal(plate.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', name)
  assert.equal(plate.readUInt32BE(16), 240, name)
  assert.equal(plate.readUInt32BE(20), 135, name)
  assert.equal(createHash('sha256').update(plate).digest('hex'), hash, name)
}
assert.equal(240 * 3, 720)
assert.equal(135 * 3, 405)
console.log('Village Gate and Torchmaster plate asset checks PASS; runtime and visual acceptance not claimed')
