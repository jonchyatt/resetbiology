import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

type Point = Readonly<{ x: number; y: number }>
type Provenance = Readonly<{
  receipt: string
  archive: string
  sourceSha256: string
  sourceStatus: string
  adaptation: string
}>
type VillagerMetaFixture = {
  frame_w: number
  frame_h: number
  walk_frames: number
  fork_base: Point
  tines: Point[]
  burnFrameCount: number
  ashOnStrike: number
  sourceProvenance: Provenance
  status?: unknown
}
type ForkMetaFixture = {
  frame_w: number
  frame_h: number
  handle_base: Point
  tine_tips: Point[]
  burnFrameCount: number
  burnLadder: string[]
  sourceProvenance: Provenance
  status?: unknown
}

const PRODUCT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ASSET_ROOT = join(PRODUCT_ROOT, 'public', 'images', 'pitchforks')
const SOURCE_ROOT = 'C:/Users/jonch/Projects/jarvis/data/codex-sidequests/worktrees/ed29b5a5-rb-vision/data/pitchforks-rework/art-tests/villager-p4-1-5/native-codex-1-final'
const COMPONENT_SOURCE = readFileSync(join(PRODUCT_ROOT, 'src', 'components', 'PitchDefender', 'PitchforksIII.tsx'), 'utf8').replaceAll('\r\n', '\n')

const acceptedAssets = [
  {
    file: 'villager_1tine_walk_left.png',
    source: join(SOURCE_ROOT, 'villager_1tine_walk_left.png'),
    width: 64,
    height: 24,
    sha256: 'CD4C4CA90F8868416CCFF1A2CEF0BD2C2112CEEB305C2409774E5F0FCB54857E',
  },
  {
    file: 'villager_1tine_ash_left.png',
    source: join(SOURCE_ROOT, 'villager_1tine_ash_left.png'),
    width: 16,
    height: 24,
    sha256: '09B105D7ADEDEA55DB75216DBBFD8D052BEEE4E1F6F4A2790A00939E854ED343',
  },
  {
    file: 'fork_1tine_b0.png',
    source: join(SOURCE_ROOT, 'forks', 'fork_1tine_b0.png'),
    width: 8,
    height: 16,
    sha256: 'E5347A7E44BFB3286F74CEE3419CBAB4F20851FF9B2E7641F4A16E36FEB36ABD',
  },
  {
    file: 'fork_1tine_b1.png',
    source: join(SOURCE_ROOT, 'forks', 'fork_1tine_b1.png'),
    width: 8,
    height: 16,
    sha256: '58E1C953B294F910C7043C100466C5B6ADD661EC552DB1D59E6A32AA5137EFF5',
  },
  {
    file: 'fork_1tine_b0_glow.png',
    source: join(SOURCE_ROOT, 'forks', 'fork_1tine_b0_glow.png'),
    width: 8,
    height: 16,
    sha256: 'F9E93A1E351A28FBF3868C65B343E5F86C7A76C2EAA5D74603993902A6435AAD',
  },
  {
    file: 'fork_1tine_b1_glow.png',
    source: join(SOURCE_ROOT, 'forks', 'fork_1tine_b1_glow.png'),
    width: 8,
    height: 16,
    sha256: '58E1C953B294F910C7043C100466C5B6ADD661EC552DB1D59E6A32AA5137EFF5',
  },
] as const

function sha256(path: string) {
  return createHash('sha256').update(readFileSync(path)).digest('hex').toUpperCase()
}

function rotateAroundPivot(point: Point, pivot: Point, degrees: number): Point {
  const radians = (degrees * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const dx = point.x - pivot.x
  const dy = point.y - pivot.y
  return {
    x: pivot.x + dx * cos - dy * sin,
    y: pivot.y + dx * sin + dy * cos,
  }
}

function assertNear(actual: number, expected: number, message: string) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} !== ${expected}`)
}

async function main() {
  let comparedWithArchive = 0
  for (const asset of acceptedAssets) {
    const productPath = join(ASSET_ROOT, asset.file)
    assert.ok(existsSync(productPath), `missing accepted asset: ${asset.file}`)
    assert.equal(sha256(productPath), asset.sha256, `${asset.file} product hash`)

    // The archival mirror is a local provenance source, not a product runtime
    // dependency. When present, prove the destination is an exact bytecopy;
    // receipt hashes still keep this test deterministic on a clean checkout.
    if (existsSync(asset.source)) {
      assert.equal(sha256(asset.source), asset.sha256, `${asset.file} source hash`)
      assert.deepEqual(readFileSync(productPath), readFileSync(asset.source), `${asset.file} differs from source bytecopy`)
      comparedWithArchive += 1
    }

    const metadata = await sharp(productPath).metadata()
    assert.equal(metadata.format, 'png', `${asset.file} format`)
    assert.equal(metadata.width, asset.width, `${asset.file} width`)
    assert.equal(metadata.height, asset.height, `${asset.file} height`)
    assert.equal(metadata.channels, 4, `${asset.file} RGBA channels`)
    assert.equal(metadata.hasAlpha, true, `${asset.file} alpha channel`)
    const { data, info } = await sharp(productPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    assert.equal(info.channels, 4, `${asset.file} decoded RGBA channels`)
    const alphaValues = new Set<number>()
    for (let index = 3; index < data.length; index += info.channels) alphaValues.add(data[index])
    assert.deepEqual([...alphaValues].sort((a, b) => a - b), [0, 255], `${asset.file} binary alpha`)
  }

  const villagerMeta = JSON.parse(readFileSync(join(ASSET_ROOT, 'villager_1tine.json'), 'utf8')) as VillagerMetaFixture
  const forkMeta = JSON.parse(readFileSync(join(ASSET_ROOT, 'fork_1tine.json'), 'utf8')) as ForkMetaFixture

  assert.deepEqual(
    { frame_w: villagerMeta.frame_w, frame_h: villagerMeta.frame_h, walk_frames: villagerMeta.walk_frames, fork_base: villagerMeta.fork_base },
    { frame_w: 16, frame_h: 24, walk_frames: 4, fork_base: { x: 14, y: 11 } },
  )
  assert.deepEqual(villagerMeta.tines, [{ x: 14, y: -4 }])
  assert.notEqual(typeof villagerMeta.tines, 'number')
  assert.equal(villagerMeta.burnFrameCount, 0)
  assert.equal(villagerMeta.ashOnStrike, 1)
  assert.equal(villagerMeta.sourceProvenance.sourceSha256, '7725FBBDE33277712145C7B9E019ADB23A31CD365ED2A1CF6173FF74B264A59F')

  assert.deepEqual(
    { frame_w: forkMeta.frame_w, frame_h: forkMeta.frame_h, handle_base: forkMeta.handle_base, tine_tips: forkMeta.tine_tips },
    { frame_w: 8, frame_h: 16, handle_base: { x: 3, y: 15 }, tine_tips: [{ x: 3, y: 0 }] },
  )
  assert.equal(forkMeta.burnFrameCount, 0)
  assert.deepEqual(forkMeta.burnLadder, ['b0', 'b1'])
  assert.notEqual(typeof forkMeta.tine_tips, 'number')
  assert.equal(forkMeta.sourceProvenance.sourceSha256, '1445B54A9CDCF98E40FB486962C5AF3EC19CECE0DEC714726AA6CCD5361B8621')

  for (const metadata of [villagerMeta, forkMeta]) {
    assert.equal(metadata.status, undefined, 'staging status must not be emitted as runtime status')
    assert.equal(metadata.sourceProvenance.sourceStatus, 'STAGING_ONLY_NOT_INTEGRATED')
    assert.match(metadata.sourceProvenance.receipt, /P4-ART-PROOF-RECEIPT\.md$/)
    assert.match(metadata.sourceProvenance.adaptation, /provenance only/i)
  }

  // The single tine is the exact attachment point of the fork's centered tip:
  // villager fork_base + fork tine_tip - fork handle_base.
  const derivedTine = {
    x: villagerMeta.fork_base.x + forkMeta.tine_tips[0].x - forkMeta.handle_base.x,
    y: villagerMeta.fork_base.y + forkMeta.tine_tips[0].y - forkMeta.handle_base.y,
  }
  assert.deepEqual(derivedTine, villagerMeta.tines[0])
  assert.deepEqual(derivedTine, { x: 14, y: -4 })
  assert.match(COMPONENT_SOURCE, /for \(const n of \[1, 2, 3, 4\] as const\)/)
  assert.match(COMPONENT_SOURCE, /fork_1tine\.json/)
  assert.doesNotMatch(COMPONENT_SOURCE, /a\.(?:walkLeft|ashLeft|villagerMeta|forkMeta)\[1\] = a\.[a-zA-Z]+\[2\]/)

  // Keep this test bound to the real renderer's left-mirror + lean path and
  // the addBolt path's authoritative villagerMeta.tines endpoint. This is a
  // contract check only; it does not modify the protected component.
  assert.match(COMPONENT_SOURCE, /const forkPivotX = v\.x \+ \(meta\.frame_w - meta\.fork_base\.x\) \* SPRITE_SCALE/)
  assert.match(COMPONENT_SOURCE, /const forkPivotY = v\.y \+ meta\.fork_base\.y \* SPRITE_SCALE/)
  assert.match(COMPONENT_SOURCE, /ctx\.translate\(fx \+ forkW, fy\)\s*ctx\.scale\(-1, 1\)/)
  assert.match(COMPONENT_SOURCE, /const rawToX = villager\.x \+ \(vMeta\.frame_w - tine\.x\) \* SPRITE_SCALE/)
  assert.match(COMPONENT_SOURCE, /const rawToY = villager\.y \+ tine\.y \* SPRITE_SCALE/)
  assert.match(COMPONENT_SOURCE, /rotateAroundPivot\(rawToX, rawToY, forkPivotX, forkPivotY, FORK_LEAN_DEG\)/)

  const scale = 3
  const villager = { x: 100, y: 200 }
  const forkPivot = {
    x: villager.x + (villagerMeta.frame_w - villagerMeta.fork_base.x) * scale,
    y: villager.y + villagerMeta.fork_base.y * scale,
  }
  const forkOrigin = {
    x: villager.x + (villagerMeta.frame_w - villagerMeta.fork_base.x) * scale - (forkMeta.frame_w - forkMeta.handle_base.x) * scale,
    y: villager.y + villagerMeta.fork_base.y * scale - forkMeta.handle_base.y * scale,
  }
  const rawEndpoint = {
    x: villager.x + (villagerMeta.frame_w - villagerMeta.tines[0].x) * scale,
    y: villager.y + villagerMeta.tines[0].y * scale,
  }
  const mirroredForkTip = {
    x: forkOrigin.x + forkMeta.frame_w * scale - forkMeta.tine_tips[0].x * scale,
    y: forkOrigin.y + forkMeta.tine_tips[0].y * scale,
  }
  assert.deepEqual(mirroredForkTip, rawEndpoint)
  const leanedEndpoint = rotateAroundPivot(rawEndpoint, forkPivot, -18)
  const expectedLean = rotateAroundPivot(mirroredForkTip, forkPivot, -18)
  assertNear(leanedEndpoint.x, expectedLean.x, 'left-mirrored tine x after lean')
  assertNear(leanedEndpoint.y, expectedLean.y, 'left-mirrored tine y after lean')

  console.log(`PASS pitchforks-one-tine-assets (${acceptedAssets.length} assets; ${comparedWithArchive}/${acceptedAssets.length} archive bytecopies; metadata and renderer geometry checked)`)
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
