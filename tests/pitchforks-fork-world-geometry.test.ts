import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

import {
  forkWorldGeometry,
  type ForkGeometryAssets,
  type ForkMetaDocument,
  type ForkVillagerMeta,
} from '../src/components/PitchDefender/pitchforksForkGeometry'
import type { TineCount } from '../src/components/PitchDefender/pitchforksCurriculum'

const PRODUCT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ASSET_ROOT = join(PRODUCT_ROOT, 'public', 'images', 'pitchforks')
const forkDocument = JSON.parse(readFileSync(join(ASSET_ROOT, 'forks.json'), 'utf8')) as ForkMetaDocument
const tineCounts = [1, 2, 3, 4, 5] as const

async function main() {
  const villagerMeta = Object.fromEntries(tineCounts.map(tineCount => [
    tineCount,
    JSON.parse(readFileSync(join(ASSET_ROOT, `villager_${tineCount}tine.json`), 'utf8')) as ForkVillagerMeta,
  ])) as Record<TineCount, ForkVillagerMeta>
  const forkMeta = Object.fromEntries(tineCounts.map(tineCount => [
    tineCount,
    forkDocument.families[`${tineCount}tine`],
  ])) as ForkGeometryAssets['forkMeta']
  const assets: ForkGeometryAssets = { villagerMeta, forkMeta }
  const baseRasters = new Map<string, Readonly<{ data: Buffer; width: number; channels: number }>>()

  let checkedPoses = 0
  for (const totalTines of tineCounts) {
    const family = forkMeta[totalTines]
    const villager = villagerMeta[totalTines]
    assert.equal(villager.fork_base_frames?.length, 8, `${totalTines}-tine walk grips`)

    for (const state of family.states) {
      const decoded = await sharp(join(ASSET_ROOT, state.image)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      baseRasters.set(state.image, { data: decoded.data, width: decoded.info.width, channels: decoded.info.channels })

      let staticReference: ReturnType<typeof forkWorldGeometry> | null = null
      for (let walkFrame = 0; walkFrame < 8; walkFrame += 1) {
        checkedPoses += 1
        const geometry = forkWorldGeometry({
          x: 101.25,
          y: 203.75,
          totalTines,
          burn: state.burn,
          walkFrame,
          useWalkGrip: true,
          tineIndex: state.active_tine_id,
        }, assets)
        const staticGeometry = forkWorldGeometry({
          x: 101.25,
          y: 203.75,
          totalTines,
          burn: state.burn,
          walkFrame,
          useWalkGrip: false,
          tineIndex: state.active_tine_id,
        }, assets)

        assert.deepEqual(
          geometry.grip,
          state.burn === 0 ? villager.fork_base_frames![walkFrame] : (villager.fork_base_burned?.[state.burn - 1] ?? villager.fork_base),
          `${totalTines}-tine b${state.burn} frame ${walkFrame}: selected grip`,
        )
        assert.deepEqual(staticGeometry.grip, state.burn > 0 ? (villager.fork_base_burned?.[state.burn - 1] ?? villager.fork_base) : villager.fork_base, `${totalTines}-tine b${state.burn}: static grip`)
        if (staticReference) assert.deepEqual(staticGeometry.draw, staticReference.draw, `${totalTines}-tine b${state.burn}: static draw ignores walk frame`)
        staticReference = staticGeometry

        assert.equal(geometry.assetKey, state.image)
        assert.equal(geometry.glowKey, state.glow)
        assert.equal(geometry.draw.width, 48)
        assert.equal(geometry.draw.height, 62)
        assert.equal(geometry.draw.rotationRad, 0)
        assert.equal(geometry.draw.mirrorX, false)
        assert.deepEqual(
          geometry.draw,
          forkWorldGeometry({
            x: 101.25,
            y: 203.75,
            totalTines,
            burn: state.burn,
            walkFrame,
            useWalkGrip: true,
            tineIndex: null,
          }, assets).draw,
          `${totalTines}-tine b${state.burn}: base and glow share one draw transform`,
        )
        assert.equal(geometry.activeTip?.id ?? null, state.active_tine_id)

        const raster = baseRasters.get(state.image)!
        for (const tip of geometry.remainingTips) {
          assert.equal(tip.world.x - geometry.draw.x, tip.source.x, 'world-to-source inverse x')
          assert.equal(tip.world.y - geometry.draw.y, tip.source.y, 'world-to-source inverse y')
          const pixel = (Math.floor(tip.source.y) * raster.width + Math.floor(tip.source.x)) * raster.channels
          assert.equal(raster.data[pixel + 3], 255, `${state.image}: transformed tip ${tip.id} resolves to opaque source pixel`)
        }
      }
    }
  }

  assert.equal(checkedPoses, 160)
  console.log('PASS pitchforks-fork-world-geometry (20 states x 8 frames; grip, native draw and opaque tip transforms checked)')
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
