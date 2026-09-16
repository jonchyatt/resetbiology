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
const FIVE_TINE_SOURCE_ROOT = 'C:/Users/jonch/Projects/rb-pitchforks-release-20260913/data/pitchforks-rework/art-tests/villager-p4-1-5/native-codex-5-final'
const COMPONENT_SOURCE = readFileSync(join(PRODUCT_ROOT, 'src', 'components', 'PitchDefender', 'PitchforksIII.tsx'), 'utf8').replaceAll('\r\n', '\n')

// Handoff #18 (2026-09-16): 8-frame alternating walk strips for the whole roster and a
// full-detail 48x72 Forge Elder lifecycle replaced the coarse 4-frame / 16x24 art.
// Build receipts: scripts/pitchforks-art-repair/{walk-pose-guide,build-walk-strip,build-lifecycle-cells}.py
const WALK8_SOURCE_ROOT = join(PRODUCT_ROOT, 'data', 'pitchforks-rework', 'art-tests', 'villager-h18-walk8')
function walk8Asset(file: string, width: number, height: number, sha256: string) {
  return { file, source: join(WALK8_SOURCE_ROOT, file), width, height, sha256 }
}

function fiveTineAsset(file: string, width: number, height: number, sha256: string, sourceDirectory = '') {
  return { file, source: join(FIVE_TINE_SOURCE_ROOT, sourceDirectory, file), width, height, sha256 }
}

const fiveTineAssets = [
  walk8Asset('villager_5tine_walk.png', 384, 72, '3F1909FF29E799CBBBD29026AD8263CB80F201E08CB2260AD9D6C3D6F85F3919'),
  walk8Asset('villager_5tine_walk_left.png', 384, 72, '2EECF95251CFD97A4904C60BE47A1FAA6086453632108D0945BD9C977FAAA294'),
  walk8Asset('villager_5tine_burned_1.png', 48, 72, '001A138424ED4355CA8155B002F6073DF037110FA3D9371F0CA38E8057CA64FF'),
  walk8Asset('villager_5tine_burned_1_left.png', 48, 72, 'E021E94BC642139065A0B6FA84FEF29D2C5ADDCC25EEF54719D1ED0C299B9D52'),
  walk8Asset('villager_5tine_burned_2.png', 48, 72, '313D353CD7ECE99F41CCD16C82B5FA4F443A9311C74692A42EE67B535D0CC00A'),
  walk8Asset('villager_5tine_burned_2_left.png', 48, 72, '4C738E4CDAA3910E1296C652C96B30260A2AC6512B302E4771A4262AABC138DC'),
  walk8Asset('villager_5tine_burned_3.png', 48, 72, '600B35E28308C4306B17116EFC0CCC8727E10856FA6ABC5012FCEBE81ADFDE6C'),
  walk8Asset('villager_5tine_burned_3_left.png', 48, 72, '2B619F9F6AA1B71A209F4CAFB4784B3C998C74B4811F6524323167DA752D6D32'),
  walk8Asset('villager_5tine_burned_4.png', 48, 72, 'ECA8BBCAC118B27FC3211B48A7D71DA128B052ED668F4D5694F251DE9AD45908'),
  walk8Asset('villager_5tine_burned_4_left.png', 48, 72, 'A90FB4E2F33F5D71D8084A5B66974797F543E2DCEEA3E17A3A1429613253668F'),
  walk8Asset('villager_5tine_ash.png', 48, 72, 'A57AD57D151D22F6174342C452306E31A4C001E38FDCC72A94515FFA1E96899C'),
  walk8Asset('villager_5tine_ash_left.png', 48, 72, '12AD066B8561D780883139C9B5DAF34DC099F57AF3C90AE1A663F7B07511C36E'),
  fiveTineAsset('fork_5tine_b0.png', 12, 16, '3B4A4544CDB5E378BCE24D2F2DB857C003D255195B279E5FC85D0BD4E0293696', 'forks'),
  fiveTineAsset('fork_5tine_b0_glow.png', 12, 16, '14E22E44F1B2230FF3A8CADDC1DA240047698EDE5550875338DEA6209B1294BB', 'forks'),
  fiveTineAsset('fork_5tine_b1.png', 12, 16, '258AA30DB0FE0999A8FDF1B01D10B0304364D10D9ED274304A647C8168A88E97', 'forks'),
  fiveTineAsset('fork_5tine_b1_glow.png', 12, 16, '47E654378D10BBBA76D1266EE9C0B8F0471C5799CDE28FD063854AEBE135AD95', 'forks'),
  fiveTineAsset('fork_5tine_b2.png', 12, 16, '8A20745C112103AACF602647DCFE3A937DD73217802B6F3A9ECBD81F3DC01E39', 'forks'),
  fiveTineAsset('fork_5tine_b2_glow.png', 12, 16, 'E65A5939C284486D523575961E12A01DE3D08F6E9E79B110B3C88C58A0F77A64', 'forks'),
  fiveTineAsset('fork_5tine_b3.png', 12, 16, '924213E4BD98B8EF17AE649936FA0F807738A33A05A08FC916A4876600701B98', 'forks'),
  fiveTineAsset('fork_5tine_b3_glow.png', 12, 16, '7C0139A2DDF70A0CA44E3D0724487A9EFA494ACD6FFDE76DA3845924846868F3', 'forks'),
  fiveTineAsset('fork_5tine_b4.png', 12, 16, '6633EC531F5A70841A67BEF735F1134BB3217B4D3BA6F00A58BB5E84A01392B9', 'forks'),
  fiveTineAsset('fork_5tine_b4_glow.png', 12, 16, 'EE1BF83016B947D0A2D72D2A3D51F3CF67FBA0B96B8E7180E3B49167F3032A56', 'forks'),
  fiveTineAsset('fork_5tine_b5.png', 12, 16, '99A0EE9439965664A8B24872449EED5F6AD07434DA044AECC82EC95E929B04F7', 'forks'),
  fiveTineAsset('fork_5tine_b5_glow.png', 12, 16, '99A0EE9439965664A8B24872449EED5F6AD07434DA044AECC82EC95E929B04F7', 'forks'),
] as const

const acceptedAssets = [
  ...fiveTineAssets,
  walk8Asset('villager_1tine_walk_left.png', 384, 72, '93BEE029D647F982CADEBD5F6F8B1BE565C6AEA903407090DBC0E08CA111E527'),
  // current shipped ash (recovered roster, 0a3d6bf04) — the old 16x24 pin predated it
  walk8Asset('villager_1tine_ash_left.png', 48, 72, 'CF6FC145AFB79B222A16542734C50F97B04CBF80D3472DA4AF6FC822B9E075C8'),
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
  const fiveVillagerMeta = JSON.parse(readFileSync(join(ASSET_ROOT, 'villager_5tine.json'), 'utf8')) as VillagerMetaFixture
  const fiveForkMeta = JSON.parse(readFileSync(join(ASSET_ROOT, 'fork_5tine.json'), 'utf8')) as ForkMetaFixture

  assert.deepEqual(
    { frame_w: villagerMeta.frame_w, frame_h: villagerMeta.frame_h, walk_frames: villagerMeta.walk_frames, fork_base: villagerMeta.fork_base },
    { frame_w: 16, frame_h: 24, walk_frames: 8, fork_base: { x: 14, y: 11 } },
  )
  for (const [label, meta] of [['1tine', villagerMeta], ['5tine', fiveVillagerMeta]] as const) {
    const grips = (meta as VillagerMetaFixture & { fork_base_frames?: Point[] }).fork_base_frames
    assert.equal(grips?.length, 8, `${label}: one fork grip per walk frame`)
    for (const grip of grips ?? []) assert.ok(grip.x > 6 && grip.x < 16 && grip.y > 6 && grip.y < 18, `${label}: grip stays in the hand zone`)
  }
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

  assert.deepEqual(
    { frame_w: fiveVillagerMeta.frame_w, frame_h: fiveVillagerMeta.frame_h, walk_frames: fiveVillagerMeta.walk_frames, fork_base: fiveVillagerMeta.fork_base },
    { frame_w: 16, frame_h: 24, walk_frames: 8, fork_base: { x: 14, y: 11 } },
  )
  assert.deepEqual(fiveVillagerMeta.tines, [
    { x: 10, y: -4 },
    { x: 12, y: -4 },
    { x: 14, y: -4 },
    { x: 16, y: -4 },
    { x: 18, y: -4 },
  ])
  assert.equal(fiveVillagerMeta.burnFrameCount, 4)
  assert.equal(fiveVillagerMeta.ashOnStrike, 5)
  assert.equal(fiveVillagerMeta.sourceProvenance.sourceSha256, 'B737C5AB1B699BA865741963A63B407621B187624A0E4DAF8D7110C5175CB500')

  assert.deepEqual(
    { frame_w: fiveForkMeta.frame_w, frame_h: fiveForkMeta.frame_h, handle_base: fiveForkMeta.handle_base, tine_tips: fiveForkMeta.tine_tips },
    {
      frame_w: 12,
      frame_h: 16,
      handle_base: { x: 5, y: 15 },
      tine_tips: [{ x: 1, y: 0 }, { x: 3, y: 0 }, { x: 5, y: 0 }, { x: 7, y: 0 }, { x: 9, y: 0 }],
    },
  )
  assert.equal(fiveForkMeta.burnFrameCount, 4)
  assert.deepEqual(fiveForkMeta.burnLadder, ['b0', 'b1', 'b2', 'b3', 'b4', 'b5'])
  assert.notEqual(typeof fiveForkMeta.tine_tips, 'number')
  assert.equal(fiveForkMeta.sourceProvenance.sourceSha256, 'A36792D482D611CFDCE92A049EA20E091E3375AE78443520EFC4151D0CCB43C4')

  for (const metadata of [villagerMeta, forkMeta, fiveVillagerMeta, fiveForkMeta]) {
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
  assert.match(COMPONENT_SOURCE, /for \(const n of \[1, 2, 3, 4, 5\] as const\)/)
  assert.match(COMPONENT_SOURCE, /fork_1tine\.json/)
  assert.match(COMPONENT_SOURCE, /parsed\['5tine'\]/)
  assert.doesNotMatch(COMPONENT_SOURCE, /a\.(?:walkLeft|ashLeft|villagerMeta|forkMeta)\[1\] = a\.[a-zA-Z]+\[2\]/)

  const atlas = JSON.parse(readFileSync(join(ASSET_ROOT, 'atlas.json'), 'utf8')) as {
    views: { side: { supported_tine_counts: number[]; concrete_coverage: { '5tine': { villagers: { burned: string[]; burned_left: string[]; ash: string; ash_left: string }; forks: { normal: string[]; glow: string[]; meta: string; concreteMeta: string } } } } }
  }
  const fiveCoverage = atlas.views.side.concrete_coverage['5tine']
  assert.deepEqual(atlas.views.side.supported_tine_counts, [1, 2, 3, 4, 5])
  assert.deepEqual(fiveCoverage.villagers.burned, [
    'villager_5tine_burned_1.png',
    'villager_5tine_burned_2.png',
    'villager_5tine_burned_3.png',
    'villager_5tine_burned_4.png',
  ])
  assert.deepEqual(fiveCoverage.villagers.burned_left, [
    'villager_5tine_burned_1_left.png',
    'villager_5tine_burned_2_left.png',
    'villager_5tine_burned_3_left.png',
    'villager_5tine_burned_4_left.png',
  ])
  assert.equal(fiveCoverage.villagers.ash, 'villager_5tine_ash.png')
  assert.equal(fiveCoverage.villagers.ash_left, 'villager_5tine_ash_left.png')
  assert.deepEqual(fiveCoverage.forks.normal, Array.from({ length: 6 }, (_, index) => `fork_5tine_b${index}.png`))
  assert.deepEqual(fiveCoverage.forks.glow, Array.from({ length: 6 }, (_, index) => `fork_5tine_b${index}_glow.png`))
  assert.equal(fiveCoverage.forks.meta, 'forks.json')
  assert.equal(fiveCoverage.forks.concreteMeta, 'fork_5tine.json')

  const forks = JSON.parse(readFileSync(join(ASSET_ROOT, 'forks.json'), 'utf8')) as Record<string, ForkMetaFixture>
  assert.deepEqual(forks['5tine'], {
    frame_w: 12,
    frame_h: 16,
    handle_base: { x: 5, y: 15 },
    tine_tips: [{ x: 1, y: 0 }, { x: 3, y: 0 }, { x: 5, y: 0 }, { x: 7, y: 0 }, { x: 9, y: 0 }],
  })

  // Keep this test bound to the real renderer's left-mirror + lean path and
  // the addBolt path's authoritative villagerMeta.tines endpoint. This is a
  // contract check only; it does not modify the protected component.
  assert.match(COMPONENT_SOURCE, /const grip = villagerForkOffset\(meta, v\.walkFrame, strip\)/)
  assert.match(COMPONENT_SOURCE, /const forkPivotX = v\.x \+ grip\.x \+ \(meta\.frame_w - meta\.fork_base\.x\) \* SPRITE_SCALE/)
  assert.match(COMPONENT_SOURCE, /const forkPivotY = v\.y \+ grip\.y \+ meta\.fork_base\.y \* SPRITE_SCALE/)
  assert.match(COMPONENT_SOURCE, /ctx\.translate\(fx \+ forkW, fy\)\s*ctx\.scale\(-1, 1\)/)
  assert.match(COMPONENT_SOURCE, /const rawToX = villager\.x \+ grip\.x \+ \(vMeta\.frame_w - tine\.x\) \* SPRITE_SCALE/)
  assert.match(COMPONENT_SOURCE, /const rawToY = villager\.y \+ grip\.y \+ tine\.y \* SPRITE_SCALE/)
  assert.match(COMPONENT_SOURCE, /rotateAroundPivot\(rawToX, rawToY, forkPivotX, forkPivotY, FORK_LEAN_DEG\)/)

  const scale = 3
  // A walk frame's grip is one shared translation of pivot, fork art and tine
  // endpoint (source pins above), so the frame-0 geometry proves every frame.
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
