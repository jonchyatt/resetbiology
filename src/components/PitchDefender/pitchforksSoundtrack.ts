import type { WorldId } from './pitchforks3WorldRegistry'

const AUDIO_BASE = '/audio/pitchforks'

const MUSIC_BY_WORLD: Record<WorldId, string> = {
  dungeon: `${AUDIO_BASE}/music_dungeon.wav`,
  'village-gate': `${AUDIO_BASE}/music_village_gate.wav`,
  'bell-tower': `${AUDIO_BASE}/music_bell_tower.wav`,
  cathedral: `${AUDIO_BASE}/music_cathedral.wav`,
}

export type PitchforksSfx = 'fire' | 'hit' | 'villager-death' | 'lightning' | 'ui'

const SFX_FILES: Record<PitchforksSfx, string> = {
  fire: `${AUDIO_BASE}/sfx_fire.wav`,
  hit: `${AUDIO_BASE}/sfx_hit.wav`,
  'villager-death': `${AUDIO_BASE}/sfx_villager_death.wav`,
  lightning: `${AUDIO_BASE}/sfx_lightning.wav`,
  ui: `${AUDIO_BASE}/sfx_ui.wav`,
}

let activeMusic: HTMLAudioElement | null = null
let activeWorld: WorldId | null = null

function scaledVolume(volumePct: number, ceiling: number): number {
  if (!Number.isFinite(volumePct)) return 0
  return Math.max(0, Math.min(1, volumePct / 100 * ceiling))
}

export function syncPitchforksMusic(world: WorldId, playing: boolean, volumePct: number): void {
  if (typeof Audio === 'undefined') return
  if (!playing || volumePct <= 0) {
    activeMusic?.pause()
    return
  }
  if (!activeMusic || activeWorld !== world) {
    activeMusic?.pause()
    activeMusic = new Audio(MUSIC_BY_WORLD[world])
    activeMusic.loop = true
    activeMusic.preload = 'auto'
    activeWorld = world
  }
  activeMusic.volume = scaledVolume(volumePct, 0.34)
  void activeMusic.play().catch(() => {
    // Mobile autoplay policy can defer the bed until the next player gesture.
    // The next settings/world/phase sync retries without changing game state.
  })
}

export function stopPitchforksMusic(): void {
  activeMusic?.pause()
  activeMusic = null
  activeWorld = null
}

export function playPitchforksSfx(kind: PitchforksSfx, volumePct: number): void {
  if (typeof Audio === 'undefined' || volumePct <= 0) return
  const audio = new Audio(SFX_FILES[kind])
  audio.preload = 'auto'
  audio.volume = scaledVolume(volumePct, kind === 'fire' ? 0.22 : 0.72)
  void audio.play().catch(() => {})
}
