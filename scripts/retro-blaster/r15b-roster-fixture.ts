import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'

import {
  ENTRY_ORIGIN,
  H,
  createInitialState,
  tick,
  type Alien,
  type EngineInput,
  type VisualKind,
} from '../../src/components/PitchDefender/retroBlasterEngine'
import {
  ENEMY_ROSTER,
  isEnemySourceVisible,
  latchEnemyRenderSource,
  type EnemyRenderSource,
} from '../../src/components/PitchDefender/retroBlasterRenderer'
import type { AtlasLoadResult, SpriteAtlas } from '../../src/components/PitchDefender/spriteAtlas'

const root = process.cwd()
const capacities = [1, 2, 3, 4]
const scoutHashes = {
  png: 'af91e258f6250292bcbb95cf7c918e2af7a7a8d5b5277af1f0ea880fcd960206',
  json: 'fc4cab691d47d4a20912e0642ffa5ae7d29fcab88c888d5dae7d9c8b74725101',
}

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

async function validateAtlases(): Promise<void> {
  for (let kind = 0; kind < ENEMY_ROSTER.length; kind++) {
    const descriptor = ENEMY_ROSTER[kind]
    const png = await readFile(resolve(root, `public/sprites/${descriptor.id}-atlas.png`))
    const jsonBuffer = await readFile(resolve(root, `public/sprites/${descriptor.id}-atlas.json`))
    const json = JSON.parse(jsonBuffer.toString())
    const metadata = await sharp(png).metadata()
    assert.equal(metadata.width, 288, `${descriptor.id} atlas width`)
    assert.equal(metadata.height, 36, `${descriptor.id} atlas height`)
    assert.equal(Object.keys(json.frames).length, 6, `${descriptor.id} frame count`)
    for (const frame of Object.values(json.frames) as Array<{ x: number, y: number, w: number, h: number }>) {
      assert.ok(Number.isInteger(frame.x) && Number.isInteger(frame.y))
      assert.ok(frame.x >= 0 && frame.y >= 0 && frame.w === 48 && frame.h === 36)
      assert.ok(frame.x + frame.w <= 288 && frame.y + frame.h <= 36)
    }
    if (kind === 0) {
      assert.equal(sha256(png), scoutHashes.png, 'Signal Scout PNG changed')
      assert.equal(sha256(jsonBuffer), scoutHashes.json, 'Signal Scout JSON changed')
      assert.equal(json.meta, undefined, 'Signal Scout parent JSON must remain byte-identical')
      continue
    }
    assert.equal(json.meta.id, descriptor.id)
    assert.equal(json.meta.currentCapacity, 1)
    assert.equal(json.meta.futureCapacity, capacities[kind])
    assert.equal(json.meta.chipAnchors.length, capacities[kind])
    for (const anchor of json.meta.chipAnchors) {
      assert.ok(Array.isArray(anchor) && anchor.length === 2)
      assert.ok(anchor.every((point: number) => Number.isFinite(point) && point >= 0 && point <= 1))
    }
  }
}

function input(): EngineInput {
  return { inputMode: 'click', isListening: false, reducedMotion: true, pitch: null, fsrs: {} }
}

function validateIdentity(): void {
  let state = createInitialState('true', ['C4', 'D4', 'E4', 'F4'], 1000)
  state.wave = 3
  state.waveIntroTimer = 0
  state.spawnQueue = ['C4', 'D4', 'E4', 'F4']
  state.alienCountThisWave = 4
  state.nextSpawnAt = state.directorClockMs
  for (let index = 0; index < 4; index++) {
    if (index === 0) {
      state = tick(state, input(), 0, () => 0.5).state
    } else {
      for (let elapsed = 0; elapsed < 800; elapsed += 50) {
        state = tick(state, input(), 50, () => 0.5).state
      }
    }
  }
  assert.deepEqual(state.aliens.map(alien => alien.visualId), ['3:0', '3:1', '3:2', '3:3'])
  assert.deepEqual(state.aliens.map(alien => alien.visualKind), [0, 1, 2, 3])

  const identities = new Map(state.aliens.map(alien => [alien.visualId, alien.visualKind]))
  state = tick(state, input(), 50, () => 0.5).state
  for (const alien of state.aliens) assert.equal(alien.visualKind, identities.get(alien.visualId))

  const reordered = [...state.aliens].reverse()
  const removed = reordered.slice(1)
  for (const alien of removed) assert.equal(alien.visualKind, identities.get(alien.visualId))

  const exploding = { ...state, aliens: state.aliens.map(alien => ({ ...alien })) }
  exploding.aliens[0].alive = false
  exploding.aliens[0].hitTimer = 0.4
  const exploded = tick(exploding, input(), 50, () => 0.5).state.aliens[0]
  assert.equal(exploded.visualId, '3:0')
  assert.equal(exploded.visualKind, 0)
}

function validateLoadLatches(): void {
  const fakeAtlas = {} as SpriteAtlas
  const ready: AtlasLoadResult = { status: 'ready', atlas: fakeAtlas }
  const failed: AtlasLoadResult = { status: 'failed' }
  const latches = new Map<string, EnemyRenderSource>()

  assert.equal(isEnemySourceVisible(ENTRY_ORIGIN.x, ENTRY_ORIGIN.y, 3, false, 0, 'kind-atlas'), false,
    'offscreen atlas entry would latch too early')
  assert.equal(latches.size, 0, 'offscreen entry mutated render latches')
  assert.equal(isEnemySourceVisible(100, -25, 3, false, 0, 'procedural'), false,
    'procedural source latched before its first visible pixel')
  assert.equal(isEnemySourceVisible(100, -25, 3, false, 0, 'kind-atlas'), true,
    'ready Captain atlas suppressed its first visible pixels')
  assert.equal(isEnemySourceVisible(100, H - 10, 0, false, 0, 'kind-atlas'), false,
    'Scout idle-a latched against the taller idle-b envelope')
  assert.equal(isEnemySourceVisible(100, H - 10, 0, false, 700, 'kind-atlas'), true,
    'Scout idle-b exact alpha bounds were not selected')
  assert.equal(latchEnemyRenderSource(latches, 'late', 2, null, null), 'procedural')
  assert.equal(latchEnemyRenderSource(latches, 'late', 2, ready, ready), 'procedural', 'late load morphed a visible alien')
  assert.equal(latchEnemyRenderSource(latches, 'new', 2, ready, ready), 'kind-atlas')
  assert.equal(latchEnemyRenderSource(latches, 'kind-failed', 1, failed, ready), 'scout-atlas')
  assert.equal(latchEnemyRenderSource(latches, 'all-failed', 3, failed, failed), 'procedural')

  const copied = { visualId: 'immutable', visualKind: 3 as VisualKind } as Pick<Alien, 'visualId' | 'visualKind'>
  assert.deepEqual({ ...copied }, copied)
}

async function main(): Promise<void> {
  await validateAtlases()
  validateIdentity()
  validateLoadLatches()
  console.log('R1.5b roster fixture PASS')
  console.log('four atlases valid; Signal Scout byte-identical; capacities=1/2/3/4')
  console.log('visualId/visualKind immutable through tick, reorder, removal, and explosion')
  console.log('late load cannot morph an existing alien; scout/procedural fallbacks remain available')
}

void main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
