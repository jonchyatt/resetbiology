import assert from 'node:assert/strict'
import test from 'node:test'
import {
  playPitchforksSfx,
  stopPitchforksMusic,
  syncPitchforksMusic,
} from '../src/components/PitchDefender/pitchforksSoundtrack'

class FakeAudio {
  static instances: FakeAudio[] = []
  src: string
  loop = false
  preload = ''
  volume = 1
  paused = false
  plays = 0

  constructor(src: string) {
    this.src = src
    FakeAudio.instances.push(this)
  }

  play(): Promise<void> {
    this.plays += 1
    this.paused = false
    return Promise.resolve()
  }

  pause(): void {
    this.paused = true
  }
}

Object.assign(globalThis, { Audio: FakeAudio })

test('world beds switch, loop, scale volume, and stop', () => {
  syncPitchforksMusic('dungeon', true, 100)
  const dungeon = FakeAudio.instances.at(-1)!
  assert.equal(dungeon.src, '/audio/pitchforks/music_dungeon.wav')
  assert.equal(dungeon.loop, true)
  assert.equal(dungeon.volume, 0.34)
  assert.equal(dungeon.plays, 1)

  syncPitchforksMusic('dungeon', true, 50)
  assert.equal(FakeAudio.instances.at(-1), dungeon)
  assert.equal(dungeon.volume, 0.17)

  syncPitchforksMusic('cathedral', true, 100)
  const cathedral = FakeAudio.instances.at(-1)!
  assert.equal(dungeon.paused, true)
  assert.equal(cathedral.src, '/audio/pitchforks/music_cathedral.wav')

  stopPitchforksMusic()
  assert.equal(cathedral.paused, true)
})

test('file-backed SFX use the licensed asset paths', () => {
  for (const kind of ['fire', 'hit', 'villager-death', 'lightning', 'ui'] as const) {
    playPitchforksSfx(kind, 100)
    const effect = FakeAudio.instances.at(-1)!
    assert.equal(effect.src, `/audio/pitchforks/sfx_${kind.replace('-', '_')}.wav`)
    assert.equal(effect.plays, 1)
    assert.ok(effect.volume > 0 && effect.volume <= 0.72)
  }
})
