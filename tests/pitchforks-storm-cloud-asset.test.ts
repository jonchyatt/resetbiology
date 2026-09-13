import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const PRODUCT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ASSET = resolve(PRODUCT_ROOT, 'public/images/pitchforks/storm_heart_nano.png')
const EXPECTED_SHA256 = 'b00308fd376b0cc30bef34d8346ebd319a9db2dd9eac2d816760e0e750af789a'

async function main() {
  const bytes = readFileSync(ASSET)
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'storm cloud must be a PNG')
  assert.equal(createHash('sha256').update(bytes).digest('hex'), EXPECTED_SHA256, 'storm cloud export hash changed')

  const metadata = await sharp(bytes).metadata()
  assert.equal(metadata.format, 'png', 'storm cloud format')
  assert.equal(metadata.width, 112, 'storm cloud width')
  assert.equal(metadata.height, 64, 'storm cloud height')
  assert.equal(metadata.channels, 4, 'storm cloud must retain RGBA channels')
  assert.equal(metadata.hasAlpha, true, 'storm cloud must retain transparency')

  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  assert.equal(info.width, 112, 'decoded storm cloud width')
  assert.equal(info.height, 64, 'decoded storm cloud height')
  assert.equal(info.channels, 4, 'decoded storm cloud channels')

  const alphaValues = new Set<number>()
  let transparent = 0
  let opaque = 0
  for (let offset = 3; offset < data.length; offset += info.channels) {
    const alpha = data[offset]
    alphaValues.add(alpha)
    if (alpha === 0) transparent += 1
    if (alpha > 0) opaque += 1
  }
  assert.deepEqual([...alphaValues].sort((a, b) => a - b), [0, 255], 'storm cloud alpha must be binary')
  assert.ok(transparent > 0, 'storm cloud must include transparent padding')
  assert.ok(opaque > 0, 'storm cloud alpha must contain artwork')
  assert.ok(transparent < data.length / info.channels, 'storm cloud must not be fully transparent')

  console.log(`PASS pitchforks-storm-cloud-asset (PNG header, ${metadata.width}x${metadata.height}, hash, and alpha checked; runtime acceptance not claimed)`)
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
