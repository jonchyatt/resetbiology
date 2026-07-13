#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')

const CELL_W = 344
const CELL_H = 384
const FRAME_W = 48
const FRAME_H = 36
const ATLAS_W = FRAME_W * 6
const ATLAS_H = FRAME_H
const ALPHA_CUTOFF = 128
const MIN_ALPHA_RATIO = 0.05
const MAX_ALPHA_RATIO = 0.95
const KEY_LOW = 40
const KEY_HIGH = 70
const SOCKET_LUMA_CEILING = 110
const SOCKET_SATURATION_CEILING = 0.45

const FRAME_SPECS = [
  { name: 'idle-a', col: 0, row: 0 },
  { name: 'idle-b', col: 1, row: 0 },
  { name: 'dive-down', col: 2, row: 0 },
  { name: 'dive-bank', col: 2, row: 1 },
  { name: 'explode-a', col: 3, row: 0 },
  { name: 'explode-b', col: 3, row: 1 },
]

class AlphaRatioGuardError extends Error {}

function parseArgs(argv) {
  const options = {
    source: resolve(root, 'src/components/PitchDefender/sprite-sources/enemy-scout-sheet-v3.png'),
    outDir: resolve(root, 'public/sprites'),
    receipt: resolve(root, 'data/retro-blaster-rework/runtime-logs/r2-atlas-build-hashes.txt'),
    name: 'enemy-scout',
    displayName: 'Signal Scout',
    currentCapacity: 1,
    futureCapacity: 1,
    chipAnchors: [[0.5, 0.5]],
    proveGuard: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--prove-guard') options.proveGuard = true
    else if (['--source', '--out-dir', '--receipt', '--name', '--display-name', '--future-capacity', '--chip-anchors'].includes(arg)) {
      const value = argv[++i]
      if (!value) throw new Error(`${arg} requires a path`)
      if (arg === '--source') options.source = resolve(root, value)
      else if (arg === '--out-dir') options.outDir = resolve(root, value)
      else if (arg === '--receipt') options.receipt = resolve(root, value)
      else if (arg === '--name') options.name = value
      else if (arg === '--display-name') options.displayName = value
      else if (arg === '--future-capacity') options.futureCapacity = Number(value)
      else if (arg === '--chip-anchors') {
        options.chipAnchors = value.split(';').map(pair => pair.split(',').map(Number))
      }
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }
  if (!/^[a-z0-9-]+$/.test(options.name)) throw new Error('--name must use lowercase letters, numbers, and hyphens')
  if (!Number.isInteger(options.futureCapacity) || options.futureCapacity < 1 || options.futureCapacity > 4) {
    throw new Error('--future-capacity must be an integer from 1 to 4')
  }
  if (options.chipAnchors.length !== options.futureCapacity || options.chipAnchors.some(anchor => (
    anchor.length !== 2 || anchor.some(value => !Number.isFinite(value) || value < 0 || value > 1)
  ))) {
    throw new Error('--chip-anchors must provide one normalized x,y pair per future-capacity slot')
  }
  return options
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

async function sha256File(path) {
  return sha256(await readFile(path))
}

function alphaForDistance(distance, keyLow, keyHigh) {
  if (distance < keyLow) return 0
  if (distance > keyHigh) return 255
  return Math.round(((distance - keyLow) / (keyHigh - keyLow)) * 255)
}

async function cropAndKey(source, spec, keyLow, keyHigh) {
  const rect = { left: spec.col * CELL_W, top: spec.row * CELL_H, width: CELL_W, height: CELL_H }
  if (!Object.values(rect).every(Number.isInteger)) throw new Error(`Non-integer crop rect for ${spec.name}`)

  const { data, info } = await sharp(source)
    .extract(rect)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  if (info.width !== CELL_W || info.height !== CELL_H || info.channels < 3) {
    throw new Error(`Unexpected raw crop for ${spec.name}`)
  }

  const corner = (2 * info.width + 2) * info.channels
  const background = [data[corner], data[corner + 1], data[corner + 2]]
  const rgba = Buffer.alloc(info.width * info.height * 4)
  let minX = info.width
  let minY = info.height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const sourceIndex = (y * info.width + x) * info.channels
      const outputIndex = (y * info.width + x) * 4
      const r = data[sourceIndex]
      const g = data[sourceIndex + 1]
      const b = data[sourceIndex + 2]
      const distance = Math.hypot(r - background[0], g - background[1], b - background[2])
      const alpha = alphaForDistance(distance, keyLow, keyHigh)
      rgba[outputIndex] = r
      rgba[outputIndex + 1] = g
      rgba[outputIndex + 2] = b
      rgba[outputIndex + 3] = alpha
      if (alpha >= ALPHA_CUTOFF) {
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }
  }

  if (maxX < minX || maxY < minY) throw new Error(`${spec.name} has no content at alpha >= ${ALPHA_CUTOFF}`)
  return {
    name: spec.name,
    rgba,
    bbox: { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
  }
}

async function makePaddedFrame(frame, globalScale) {
  const width = Math.max(1, Math.round(frame.bbox.width * globalScale))
  const height = Math.max(1, Math.round(frame.bbox.height * globalScale))
  if (width > FRAME_W || height > FRAME_H) {
    throw new Error(`${frame.name} scaled to ${width}x${height}, beyond ${FRAME_W}x${FRAME_H}`)
  }

  const left = Math.floor((FRAME_W - width) / 2)
  const right = FRAME_W - width - left
  const top = FRAME_H - height
  const png = await sharp(frame.rgba, { raw: { width: CELL_W, height: CELL_H, channels: 4 } })
    .extract(frame.bbox)
    .resize(width, height, { kernel: sharp.kernel.nearest })
    .extend({
      top,
      bottom: 0,
      left,
      right,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toBuffer()

  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let contentPixels = 0
  for (let i = 3; i < data.length; i += info.channels) {
    if (data[i] >= ALPHA_CUTOFF) contentPixels++
  }
  return {
    ...frame,
    png,
    scaled: { width, height },
    alphaRatio: contentPixels / (FRAME_W * FRAME_H),
  }
}

async function sampleSocket(frame, anchor, slot) {
  const { data, info } = await sharp(frame.png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const centerX = Math.round(anchor[0] * (info.width - 1))
  const centerY = Math.round(anchor[1] * (info.height - 1))
  let count = 0
  let luma = 0
  let saturation = 0
  for (let y = Math.max(0, centerY - 2); y <= Math.min(info.height - 1, centerY + 2); y++) {
    for (let x = Math.max(0, centerX - 2); x <= Math.min(info.width - 1, centerX + 2); x++) {
      const offset = (y * info.width + x) * info.channels
      if (data[offset + 3] < ALPHA_CUTOFF) continue
      const r = data[offset]
      const g = data[offset + 1]
      const b = data[offset + 2]
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      luma += 0.2126 * r + 0.7152 * g + 0.0722 * b
      saturation += max === 0 ? 0 : (max - min) / max
      count++
    }
  }
  if (count === 0) throw new Error(`${frame.name} future socket ${slot} is transparent or outside the hull`)
  const sample = { frame: frame.name, slot, x: centerX, y: centerY, avgLuma: luma / count, avgSaturation: saturation / count }
  if (sample.avgLuma > SOCKET_LUMA_CEILING || sample.avgSaturation > SOCKET_SATURATION_CEILING) {
    throw new Error(
      `${frame.name} future socket ${slot} is visibly lit: luma=${sample.avgLuma.toFixed(2)}, saturation=${sample.avgSaturation.toFixed(4)}`,
    )
  }
  return sample
}

function validatePackedFrames(frames) {
  for (let i = 0; i < frames.length; i++) {
    const rect = { x: i * FRAME_W, y: 0, w: FRAME_W, h: FRAME_H }
    const integerRect = Object.values(rect).every(Number.isInteger)
    const inBounds = rect.x >= 0 && rect.y >= 0 && rect.w > 0 && rect.h > 0
      && rect.x + rect.w <= ATLAS_W && rect.y + rect.h <= ATLAS_H
    if (!integerRect || !inBounds) throw new Error(`Invalid packed rect for ${frames[i].name}`)
  }
}

async function assembleAtlas(options, keyLow, keyHigh) {
  const { source } = options
  const sourceBuffer = await readFile(source)
  const metadata = await sharp(sourceBuffer).metadata()
  if (metadata.width !== CELL_W * 4 || metadata.height !== CELL_H * 2) {
    throw new Error(`Source must be ${CELL_W * 4}x${CELL_H * 2}; got ${metadata.width}x${metadata.height}`)
  }

  const keyed = []
  for (const spec of FRAME_SPECS) keyed.push(await cropAndKey(sourceBuffer, spec, keyLow, keyHigh))

  const maxWidth = Math.max(...keyed.map(frame => frame.bbox.width))
  const maxHeight = Math.max(...keyed.map(frame => frame.bbox.height))
  const globalScale = Math.min(FRAME_W / maxWidth, FRAME_H / maxHeight)
  const frames = []
  for (const frame of keyed) frames.push(await makePaddedFrame(frame, globalScale))

  const rejected = frames.filter(frame => (
    frame.alphaRatio < MIN_ALPHA_RATIO || frame.alphaRatio > MAX_ALPHA_RATIO
  ))
  if (rejected.length > 0) {
    const details = rejected.map(frame => `${frame.name}=${frame.alphaRatio.toFixed(6)}`).join(', ')
    throw new AlphaRatioGuardError(
      `Alpha-ratio guard rejected final ${FRAME_W}x${FRAME_H} frame(s): ${details}; allowed ${MIN_ALPHA_RATIO}-${MAX_ALPHA_RATIO}`,
    )
  }

  validatePackedFrames(frames)
  const atlasPng = await sharp({
    create: { width: ATLAS_W, height: ATLAS_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(frames.map((frame, index) => ({ input: frame.png, left: index * FRAME_W, top: 0 })))
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toBuffer()

  const contract = {
    frames: Object.fromEntries(frames.map((frame, index) => [
      frame.name,
      { x: index * FRAME_W, y: 0, w: FRAME_W, h: FRAME_H },
    ])),
    frameW: FRAME_W,
    frameH: FRAME_H,
  }
  const socketSamples = []
  if (options.name !== 'enemy-scout') {
    contract.meta = {
      id: options.name,
      displayName: options.displayName,
      currentCapacity: options.currentCapacity,
      futureCapacity: options.futureCapacity,
      chipAnchors: options.chipAnchors,
    }
    for (const frame of frames.filter(value => value.name === 'idle-a' || value.name === 'idle-b')) {
      for (let slot = 1; slot < options.chipAnchors.length; slot++) {
        socketSamples.push(await sampleSocket(frame, options.chipAnchors[slot], slot))
      }
    }
  }
  const atlasJson = Buffer.from(`${JSON.stringify(contract, null, 2)}\n`)
  return { sourceBuffer, frames, globalScale, atlasPng, atlasJson, socketSamples }
}

function formatReceipt(result) {
  const lines = [
    'R2 sprite atlas deterministic build receipt',
    `source_sha256=${sha256(result.sourceBuffer)}`,
    `atlas_png_sha256=${sha256(result.atlasPng)}`,
    `atlas_json_sha256=${sha256(result.atlasJson)}`,
    `global_scale_factor=${result.globalScale.toFixed(12)}`,
    `frame_size=${FRAME_W}x${FRAME_H}`,
    `atlas_size=${ATLAS_W}x${ATLAS_H}`,
  ]
  for (const frame of result.frames) {
    lines.push(
      `${frame.name}_bbox=${frame.bbox.left},${frame.bbox.top},${frame.bbox.width},${frame.bbox.height}`,
      `${frame.name}_scaled=${frame.scaled.width}x${frame.scaled.height}`,
      `${frame.name}_alpha_ratio=${frame.alphaRatio.toFixed(6)}`,
    )
  }
  for (const sample of result.socketSamples) {
    lines.push(
      `${sample.frame}_future_socket_${sample.slot}=x${sample.x},y${sample.y},avg_luma${sample.avgLuma.toFixed(3)},avg_saturation${sample.avgSaturation.toFixed(5)},ceilings${SOCKET_LUMA_CEILING}/${SOCKET_SATURATION_CEILING}`,
    )
  }
  return `${lines.join('\n')}\n`
}

async function writeAtlas(options, result) {
  const atlasPath = join(options.outDir, `${options.name}-atlas.png`)
  const jsonPath = join(options.outDir, `${options.name}-atlas.json`)
  const receipt = formatReceipt(result)
  await mkdir(options.outDir, { recursive: true })
  await mkdir(dirname(options.receipt), { recursive: true })
  await Promise.all([
    writeFile(atlasPath, result.atlasPng),
    writeFile(jsonPath, result.atlasJson),
    writeFile(options.receipt, receipt),
  ])
  process.stdout.write(receipt)
  console.log(`wrote=${atlasPath}`)
  console.log(`wrote=${jsonPath}`)
  console.log(`wrote=${options.receipt}`)
}

async function pathExists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function proveGuard(options) {
  const deployedAtlas = resolve(root, `public/sprites/${options.name}-atlas.png`)
  if (!(await pathExists(deployedAtlas))) throw new Error('Run the real atlas build before --prove-guard')
  const beforeHash = await sha256File(deployedAtlas)
  const scratchDir = join(tmpdir(), `r2-atlas-reject-test-${process.pid}-${Date.now()}`)
  const scratchPng = join(scratchDir, 'enemy-scout-atlas.png')
  const scratchJson = join(scratchDir, 'enemy-scout-atlas.json')
  const scratchReceipt = join(scratchDir, 'r2-atlas-build-hashes.txt')

  try {
    const result = await assembleAtlas(options, 200, 230)
    await writeAtlas({ ...options, outDir: scratchDir, receipt: scratchReceipt }, result)
    throw new Error('Guard proof unexpectedly passed with the absurd 200-230 chroma-key tolerance')
  } catch (error) {
    if (!(error instanceof AlphaRatioGuardError)) throw error
    console.log(`guard_proof=rejected (${error.message})`)
  }

  if (await pathExists(scratchPng) || await pathExists(scratchJson) || await pathExists(scratchReceipt)) {
    throw new Error(`Guard proof wrote an output under ${scratchDir}`)
  }
  const afterHash = await sha256File(deployedAtlas)
  if (beforeHash !== afterHash) throw new Error('Guard proof changed the deployable atlas')
  console.log(`guard_proof_scratch_outputs=none (${scratchDir})`)
  console.log(`guard_proof_deployable_sha256_unchanged=${afterHash}`)
}

try {
  const options = parseArgs(process.argv.slice(2))
  if (options.proveGuard) await proveGuard(options)
  else await writeAtlas(options, await assembleAtlas(options, KEY_LOW, KEY_HIGH))
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
