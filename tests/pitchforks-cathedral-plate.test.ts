import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { WORLD_REGISTRY } from '../src/components/PitchDefender/pitchforks3WorldRegistry'
import { selectPitchforksPrivatePlateAsset } from '../src/components/PitchDefender/PitchforksIII'

const selectorCases = [
  ['demo=1&worldProof=cathedral', 'cathedral_plate.png'],
  ['demo=1&worldProof=village-gate', 'village_gate_plate.png'],
  ['demo=1&worldProof=bell-tower', 'bell_tower_plate.png'],
  ['demo=1', null],
  ['worldProof=cathedral', null],
  ['demo=0&worldProof=cathedral', null],
  ['demo=1&worldProof=unknown', null],
  ['demo=1&worldProof=../cathedral_plate.png', null],
] as const

for (const [query, expected] of selectorCases) {
  assert.equal(selectPitchforksPrivatePlateAsset(new URLSearchParams(query)), expected, query)
}

const source = readFileSync(new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url), 'utf8')
assert.match(source, /ctx\.imageSmoothingEnabled = false[\s\S]*?ctx\.drawImage\(assets\.privatePlate, 0, 0, W, H\)/)
assert.match(source, /if \(assets\.privatePlate\) \{[\s\S]*?\} else \{\s*drawDungeonBackground\(ctx, view\.animClock\)/)
assert.match(source, /a\.privatePlate = await loadImage\(`\$\{ASSET_BASE\}\/\$\{privatePlateAsset\}`\)\.catch\(\(\) => undefined\)/)

const plate = readFileSync(new URL('../public/images/pitchforks/cathedral_plate.png', import.meta.url))
assert.equal(plate.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
assert.equal(plate.readUInt32BE(16), 240)
assert.equal(plate.readUInt32BE(20), 135)
assert.equal(createHash('sha256').update(plate).digest('hex'), 'c135b7ca814a2b5d7de12ef2e0cd3c899bab62730d996e2f82052b8a617abddf')

assert.deepEqual(WORLD_REGISTRY.map(world => world.playable), [true, false, false, false])

console.log('Cathedral private plate selector, existing private routes, fallback, registry playability, and native asset checks PASS; runtime/browser acceptance not claimed')
