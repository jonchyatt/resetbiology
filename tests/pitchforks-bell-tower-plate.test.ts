import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { selectPitchforksPrivatePlateAsset } from '../src/components/PitchDefender/PitchforksIII'

const selectorCases = [
  ['demo=1&worldProof=village-gate', 'village_gate_plate.png'],
  ['demo=1&worldProof=bell-tower', 'bell_tower_plate.png'],
  ['demo=1', null],
  ['worldProof=bell-tower', null],
  ['demo=0&worldProof=bell-tower', null],
  ['demo=1&worldProof=unknown', null],
] as const

for (const [query, expected] of selectorCases) {
  assert.equal(selectPitchforksPrivatePlateAsset(new URLSearchParams(query)), expected, query)
}

const source = readFileSync(new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url), 'utf8')
assert.match(source, /ctx\.imageSmoothingEnabled = false[\s\S]*?ctx\.drawImage\(assets\.privatePlate, 0, 0, W, H\)/)
assert.match(source, /if \(assets\.privatePlate\) \{[\s\S]*?\} else \{\s*drawDungeonBackground\(ctx, view\.animClock\)/)
assert.match(source, /a\.privatePlate = await loadImage\(`\$\{ASSET_BASE\}\/\$\{privatePlateAsset\}`\)\.catch\(\(\) => undefined\)/)

const plate = readFileSync(new URL('../public/images/pitchforks/bell_tower_plate.png', import.meta.url))
assert.equal(plate.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
assert.equal(plate.readUInt32BE(16), 240)
assert.equal(plate.readUInt32BE(20), 135)
assert.equal(createHash('sha256').update(plate).digest('hex'), '4f5aa9a808d708e308970701f399d53d49deacaa1c83a60d9cb845df1ef7ea22')

console.log('Bell Tower private plate selector, dungeon fallback, and native asset checks PASS; runtime/browser acceptance not claimed')
