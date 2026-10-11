#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const artDir = path.join(root, 'public', 'images', 'pitchforks')
const audioDir = path.join(root, 'public', 'audio', 'pitchforks')
const manifest = JSON.parse(await readFile(path.join(artDir, 'style_manifest.json'), 'utf8'))
const palette = new Set(manifest.palette.map(value => value.toLowerCase()))
const pngs = (await readdir(artDir)).filter(name => name.endsWith('.png') && name !== 'preview.png')
assert.equal(manifest.styleReference, 'style_reference.png')
assert.equal(manifest.pngCount, pngs.length)
assert.ok(pngs.length >= 100, `expected full atlas, found ${pngs.length} PNGs`)

for (const name of pngs) {
  const { data, info } = await sharp(path.join(artDir, name)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  for (let index = 0; index < data.length; index += info.channels) {
    const alpha = data[index + 3]
    assert.ok(alpha === 0 || alpha === 255, `${name} has soft alpha ${alpha}`)
    if (alpha === 0) continue
    const color = `#${data[index].toString(16).padStart(2, '0')}${data[index + 1].toString(16).padStart(2, '0')}${data[index + 2].toString(16).padStart(2, '0')}`
    assert.ok(palette.has(color), `${name} uses non-reference color ${color}`)
  }
}

for (const tines of [1, 2, 3, 4, 5]) {
  const file = path.join(artDir, `villager_${tines}tine_walk.png`)
  const image = sharp(file)
  const metadata = await image.metadata()
  assert.equal(metadata.width, 64)
  assert.equal(metadata.height, 24)
  const frameHashes = []
  for (let frame = 0; frame < 4; frame += 1) {
    const raw = await sharp(file).extract({ left: frame * 16, top: 0, width: 16, height: 24 }).raw().toBuffer()
    frameHashes.push(raw.toString('base64'))
  }
  assert.equal(new Set(frameHashes).size, 4, `${tines}-tine walk must contain four distinct gait frames`)
}

for (const name of ['rain_gutter.png', 'rain_gutter_village-gate.png', 'rain_gutter_bell-tower.png', 'rain_gutter_cathedral.png']) {
  const { data, info } = await sharp(path.join(artDir, name)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let transparent = 0
  let opaque = 0
  for (let index = 3; index < data.length; index += info.channels) data[index] === 0 ? transparent += 1 : opaque += 1
  assert.ok(transparent > 0 && opaque > 0, `${name} must have open channel and carved silhouette`)
}

const expectedAudio = [
  'music_dungeon.wav', 'music_village_gate.wav', 'music_bell_tower.wav', 'music_cathedral.wav',
  'sfx_fire.wav', 'sfx_hit.wav', 'sfx_villager_death.wav', 'sfx_lightning.wav', 'sfx_ui.wav',
]
for (const name of expectedAudio) {
  const bytes = await readFile(path.join(audioDir, name))
  assert.equal(bytes.subarray(0, 4).toString('ascii'), 'RIFF', `${name} is not RIFF/WAV`)
  assert.equal(bytes.subarray(8, 12).toString('ascii'), 'WAVE', `${name} is not WAVE`)
  assert.ok(bytes.length > 4_000, `${name} is suspiciously small`)
}
const license = await readFile(path.join(audioDir, 'LICENSE.md'), 'utf8')
assert.match(license, /CC0 1\.0 Universal/)
for (const name of expectedAudio) assert.ok(license.includes(name), `license omits ${name}`)

console.log(`Pitchforks art/audio gate PASS: ${pngs.length} palette-locked PNGs, 5 four-pose gait strips, 4 carved gutters, ${expectedAudio.length} licensed WAVs`)
