import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import type { ForkMetaDocument } from '../src/components/PitchDefender/pitchforksForkGeometry'

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
  burnFrameCount: number
  ashOnStrike: number
  sourceProvenance: Provenance
  status?: unknown
}

const PRODUCT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ASSET_ROOT = join(PRODUCT_ROOT, 'public', 'images', 'pitchforks')
const COMPONENT_SOURCE = readFileSync(join(PRODUCT_ROOT, 'src', 'components', 'PitchDefender', 'PitchforksIII.tsx'), 'utf8').replaceAll('\r\n', '\n')

// Handoff #18 (2026-09-16): 8-frame alternating walk strips for the whole roster and a
// full-detail 48x72 Forge Elder lifecycle replaced the coarse 4-frame / 16x24 art.
// Build receipts: scripts/pitchforks-art-repair/{walk-pose-guide,build-walk-strip,build-lifecycle-cells}.py
const WALK8_SOURCE_ROOT = join(PRODUCT_ROOT, 'data', 'pitchforks-rework', 'art-tests', 'villager-h18-walk8')
function walk8Asset(file: string, width: number, height: number, sha256: string) {
  return { file, source: join(WALK8_SOURCE_ROOT, file), width, height, sha256 }
}

function forkFamilyAsset(file: string, sha256: string) {
  return { file, source: join(PRODUCT_ROOT, 'scripts', 'pitchforks-art-repair', 'generated-assets', file), width: 48, height: 62, sha256 }
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
  forkFamilyAsset('fork_5tine_b0.png', '2D992ECEFEF574AF9F21365737BA045A11278272DE9F31FD1BD98D3F6F7EC345'),
  forkFamilyAsset('fork_5tine_b0_glow.png', 'A2A029B41860EE0C54ACB483D07FC27EA7F52A7E7C6982CBBFA07A162A4C7090'),
  forkFamilyAsset('fork_5tine_b1.png', 'A70592E4BD96B756C28AE19C2587538E10D0A3CA67022A2E6E99EBDD395EF7E2'),
  forkFamilyAsset('fork_5tine_b1_glow.png', 'E0995D9B2E81A2CC0C17213BE68D0AEB857043294148C1CA58DA28920672B42D'),
  forkFamilyAsset('fork_5tine_b2.png', '8DFCF2F6479C964682164A4323D960AAFDE043D696D9F9FFF1D8DD35992C76A3'),
  forkFamilyAsset('fork_5tine_b2_glow.png', 'BE2E2266CB4083FA92BD0BEB14652F65BD48BD3E660080FC967C65DD2A880077'),
  forkFamilyAsset('fork_5tine_b3.png', 'C065077CFB0A8DA4C44CEF719EF18885EC0B83707C69890DC69AF253E265BBAB'),
  forkFamilyAsset('fork_5tine_b3_glow.png', 'C103CAB26235F411B9F7045715E78840BF4B93B5D266E27E1B95BD4B3DEEAFEF'),
  forkFamilyAsset('fork_5tine_b4.png', '04E58FF483E2C344B62C5E5D7AF5ABFA80D938286F1DB45D4A6E520BDB687AD0'),
  forkFamilyAsset('fork_5tine_b4_glow.png', 'A53D582049A6C54C1C99AFE3A8804156FCEF5ABEF0AC72CA1CDC65B685B67D6D'),
  forkFamilyAsset('fork_5tine_b5.png', 'B5D26E234BB6342D9B03E1CEEABE497DF76063E74A1D690EF827EC71F3002F60'),
  forkFamilyAsset('fork_5tine_b5_glow.png', '3F7305450F109AEAA02728555E32067C93B8019B7CEF61FA9DADB132DE70CF81'),
] as const

const acceptedAssets = [
  ...fiveTineAssets,
  walk8Asset('villager_1tine_walk_left.png', 384, 72, '93BEE029D647F982CADEBD5F6F8B1BE565C6AEA903407090DBC0E08CA111E527'),
  // current shipped ash (recovered roster, 0a3d6bf04) — the old 16x24 pin predated it
  walk8Asset('villager_1tine_ash_left.png', 48, 72, 'CF6FC145AFB79B222A16542734C50F97B04CBF80D3472DA4AF6FC822B9E075C8'),
  forkFamilyAsset('fork_1tine_b0.png', 'F07C7BC23D5FB20DA59E9AD07A78C396E5FB4794B50EE7545A0DB98B0A21BADE'),
  forkFamilyAsset('fork_1tine_b1.png', 'DBC26E16407588140279728FC939278A896F1DA644BBB929D4C499900E014570'),
  forkFamilyAsset('fork_1tine_b0_glow.png', 'DC6B9A3C8E968680B78141958A35B63D6D15DB137E7291611B11FA0EC4A3307E'),
  forkFamilyAsset('fork_1tine_b1_glow.png', '3F7305450F109AEAA02728555E32067C93B8019B7CEF61FA9DADB132DE70CF81'),
] as const

function sha256(path: string) {
  return createHash('sha256').update(readFileSync(path)).digest('hex').toUpperCase()
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
    assert.ok([...alphaValues].every(alpha => alpha === 0 || alpha === 255), `${asset.file} binary alpha`)
  }

  const villagerMeta = JSON.parse(readFileSync(join(ASSET_ROOT, 'villager_1tine.json'), 'utf8')) as VillagerMetaFixture
  const fiveVillagerMeta = JSON.parse(readFileSync(join(ASSET_ROOT, 'villager_5tine.json'), 'utf8')) as VillagerMetaFixture
  const forkDocument = JSON.parse(readFileSync(join(ASSET_ROOT, 'forks.json'), 'utf8')) as ForkMetaDocument

  assert.deepEqual(
    { frame_w: villagerMeta.frame_w, frame_h: villagerMeta.frame_h, walk_frames: villagerMeta.walk_frames, fork_base: villagerMeta.fork_base },
    { frame_w: 16, frame_h: 24, walk_frames: 8, fork_base: { x: 14, y: 11 } },
  )
  for (const [label, meta] of [['1tine', villagerMeta], ['5tine', fiveVillagerMeta]] as const) {
    const grips = (meta as VillagerMetaFixture & { fork_base_frames?: Point[] }).fork_base_frames
    assert.equal(grips?.length, 8, `${label}: one fork grip per walk frame`)
    for (const grip of grips ?? []) assert.ok(grip.x > 6 && grip.x < 16 && grip.y > 6 && grip.y < 18, `${label}: grip stays in the hand zone`)
  }
  assert.equal(villagerMeta.burnFrameCount, 0)
  assert.equal(villagerMeta.ashOnStrike, 1)
  assert.equal(villagerMeta.sourceProvenance.sourceSha256, '7725FBBDE33277712145C7B9E019ADB23A31CD365ED2A1CF6173FF74B264A59F')

  assert.deepEqual(
    { frame_w: fiveVillagerMeta.frame_w, frame_h: fiveVillagerMeta.frame_h, walk_frames: fiveVillagerMeta.walk_frames, fork_base: fiveVillagerMeta.fork_base },
    { frame_w: 16, frame_h: 24, walk_frames: 8, fork_base: { x: 14, y: 11 } },
  )
  assert.equal(fiveVillagerMeta.burnFrameCount, 4)
  assert.equal(fiveVillagerMeta.ashOnStrike, 5)
  assert.equal(fiveVillagerMeta.sourceProvenance.sourceSha256, 'B737C5AB1B699BA865741963A63B407621B187624A0E4DAF8D7110C5175CB500')

  for (const metadata of [villagerMeta, fiveVillagerMeta]) {
    assert.equal(metadata.status, undefined, 'staging status must not be emitted as runtime status')
    assert.equal(metadata.sourceProvenance.sourceStatus, 'STAGING_ONLY_NOT_INTEGRATED')
    assert.match(metadata.sourceProvenance.receipt, /P4-ART-PROOF-RECEIPT\.md$/)
    assert.match(metadata.sourceProvenance.adaptation, /provenance only/i)
  }

  assert.equal(forkDocument.schemaVersion, 2)
  assert.deepEqual(forkDocument.families['1tine'].source_size, { w: 48, h: 62 })
  assert.deepEqual(forkDocument.families['5tine'].source_size, { w: 48, h: 62 })
  assert.equal(forkDocument.families['1tine'].states.length, 2)
  assert.equal(forkDocument.families['5tine'].states.length, 6)
  assert.equal('tines' in villagerMeta, false)
  assert.equal('tines' in fiveVillagerMeta, false)
  assert.equal('fork_tip' in villagerMeta, false)
  assert.equal('fork_tip' in fiveVillagerMeta, false)
  assert.match(COMPONENT_SOURCE, /for \(const n of \[1, 2, 3, 4, 5\] as const\)/)
  assert.match(COMPONENT_SOURCE, /forks\.schemaVersion !== 2/)
  assert.match(COMPONENT_SOURCE, /forks\.families\[`\$\{n\}tine`\]/)
  assert.doesNotMatch(COMPONENT_SOURCE, /fork_1tine\.json/)
  assert.doesNotMatch(COMPONENT_SOURCE, /villagerMeta\.tines|\.tines\[/)
  assert.doesNotMatch(COMPONENT_SOURCE, /a\.(?:walkLeft|ashLeft|villagerMeta|forkMeta)\[1\] = a\.[a-zA-Z]+\[2\]/)

  const atlas = JSON.parse(readFileSync(join(ASSET_ROOT, 'atlas.json'), 'utf8')) as {
    views: { side: { supported_tine_counts: number[]; concrete_coverage: { '5tine': { villagers: { burned: string[]; burned_left: string[]; ash: string; ash_left: string }; forks: { normal: string[]; glow: string[]; meta: string } } } } }
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
  assert.match(COMPONENT_SOURCE, /const geometry = forkWorldGeometry\(/)
  assert.match(COMPONENT_SOURCE, /ctx\.drawImage\(baseImg, geometry\.draw\.x, geometry\.draw\.y, geometry\.draw\.width, geometry\.draw\.height\)/)
  assert.match(COMPONENT_SOURCE, /ctx\.globalCompositeOperation = 'lighter'/)
  assert.match(COMPONENT_SOURCE, /view\.reducedMotion \? 0\.48 : 0\.42 \+ 0\.16 \* Math\.sin\(view\.animClock \* 8\)/)
  assert.doesNotMatch(COMPONENT_SOURCE, /FORK_LEAN_DEG|villagerForkOffset|displayBurn/)

  console.log(`PASS pitchforks-one-tine-assets (${acceptedAssets.length} assets; ${comparedWithArchive}/${acceptedAssets.length} archive bytecopies; metadata and renderer geometry checked)`)
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
