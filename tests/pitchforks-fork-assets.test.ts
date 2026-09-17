import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

import type { ForkMetaDocument } from '../src/components/PitchDefender/pitchforksForkGeometry'

const PRODUCT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ASSET_ROOT = join(PRODUCT_ROOT, 'public', 'images', 'pitchforks')
const metadata = JSON.parse(readFileSync(join(ASSET_ROOT, 'forks.json'), 'utf8')) as ForkMetaDocument

type Raster = Readonly<{ data: Buffer; width: number; height: number; channels: number }>

async function raster(file: string, expectedWidth: number, expectedHeight: number): Promise<Raster> {
  const path = join(ASSET_ROOT, file)
  const imageMetadata = await sharp(path).metadata()
  assert.equal(imageMetadata.format, 'png', `${file}: PNG format`)
  assert.equal(imageMetadata.width, expectedWidth, `${file}: width`)
  assert.equal(imageMetadata.height, expectedHeight, `${file}: height`)
  assert.equal(imageMetadata.channels, 4, `${file}: RGBA channels`)
  assert.equal(imageMetadata.hasAlpha, true, `${file}: alpha channel`)
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  for (let index = 3; index < data.length; index += info.channels) {
    assert.ok(data[index] === 0 || data[index] === 255, `${file}: alpha must be binary`)
  }
  return { data, width: info.width, height: info.height, channels: info.channels }
}

function alphaAt(image: Raster, x: number, y: number): number {
  const pixelX = Math.floor(x)
  const pixelY = Math.floor(y)
  assert.ok(pixelX >= 0 && pixelX < image.width && pixelY >= 0 && pixelY < image.height, `pixel ${x},${y} is in bounds`)
  return image.data[(pixelY * image.width + pixelX) * image.channels + 3]
}

function removedMask(before: Raster, after: Raster): number[] {
  const pixels: number[] = []
  for (let pixel = 0; pixel < before.width * before.height; pixel += 1) {
    const alphaIndex = pixel * before.channels + 3
    if (before.data[alphaIndex] === 255 && after.data[alphaIndex] === 0) pixels.push(pixel)
  }
  return pixels
}

async function main() {
  assert.equal(metadata.schemaVersion, 2)
  assert.deepEqual(Object.keys(metadata.families), ['1tine', '2tine', '3tine', '4tine', '5tine'])

  let checkedStates = 0
  for (let tineCount = 1; tineCount <= 5; tineCount += 1) {
    const family = metadata.families[`${tineCount as 1 | 2 | 3 | 4 | 5}tine`]
    assert.deepEqual(family.source_size, { w: 48, h: 62 }, `${tineCount}-tine source size`)
    assert.equal(family.lean_deg, 0, `${tineCount}-tine runtime lean`)
    assert.equal(family.states.length, tineCount + 1, `${tineCount}-tine state count`)

    const bases = new Map<number, Raster>()
    const glows = new Map<number, Raster>()
    for (const state of family.states) {
      bases.set(state.burn, await raster(state.image, family.source_size.w, family.source_size.h))
      glows.set(state.burn, await raster(state.glow, family.source_size.w, family.source_size.h))
    }

    const tineMasks = new Map<number, number[]>()
    for (let tineId = 0; tineId < tineCount; tineId += 1) {
      const beforeBurn = tineCount - 1 - tineId
      tineMasks.set(tineId, removedMask(bases.get(beforeBurn)!, bases.get(beforeBurn + 1)!))
      assert.ok(tineMasks.get(tineId)!.length > 0, `${tineCount}-tine id ${tineId}: removable raster mask`)
    }

    const originalTips = family.states[0].remaining_tines
    for (const state of family.states) {
      checkedStates += 1
      const base = bases.get(state.burn)!
      const glow = glows.get(state.burn)!
      assert.equal(state.remaining_tines.length, tineCount - state.burn, `${tineCount}-tine b${state.burn}: remaining count`)
      assert.equal(state.active_tine_id, state.burn < tineCount ? tineCount - 1 - state.burn : null)

      for (const tine of state.remaining_tines) {
        assert.equal(alphaAt(base, tine.tip.x, tine.tip.y), 255, `${state.image}: emitted tip ${tine.id} is opaque`)
      }
      for (const tine of originalTips.filter(candidate => candidate.id >= tineCount - state.burn)) {
        assert.equal(alphaAt(base, tine.tip.x, tine.tip.y), 0, `${state.image}: removed tip ${tine.id} is transparent`)
      }

      if (state.active_tine_id === null) {
        for (let index = 3; index < glow.data.length; index += glow.channels) {
          assert.equal(glow.data[index], 0, `${state.glow}: terminal glow is transparent`)
        }
        continue
      }

      const activeTip = state.remaining_tines.find(tine => tine.id === state.active_tine_id)
      assert.ok(activeTip, `${state.glow}: active tip metadata exists`)
      assert.ok(alphaAt(glow, activeTip!.tip.x, activeTip!.tip.y) > 0, `${state.glow}: active tip glows`)
      for (const tine of state.remaining_tines.filter(candidate => candidate.id !== state.active_tine_id)) {
        assert.equal(alphaAt(glow, tine.tip.x, tine.tip.y), 0, `${state.glow}: inactive tip ${tine.id} does not glow`)
        for (const pixel of tineMasks.get(tine.id)!) {
          assert.equal(glow.data[pixel * glow.channels + 3], 0, `${state.glow}: inactive tine ${tine.id} mask does not glow`)
        }
      }
    }
  }

  assert.equal(checkedStates, 20)
  console.log('PASS pitchforks-fork-assets (20 family/burn states; native RGBA, opacity, removal and active-only glow checked)')
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
