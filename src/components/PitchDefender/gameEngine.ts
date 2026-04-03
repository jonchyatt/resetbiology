// Pitch Defender — Game Engine (pure logic, no React)

import { NOTE_COLORS, createNote, pickNextNote, type NoteMemory } from '@/lib/fsrs'
import {
  type AlienState, type WaveConfig, type GameState,
  INTRO_ORDER, WORLD_CONFIG,
} from './types'

let _nextId = 0
function uid(): string { return `alien_${++_nextId}_${Date.now()}` }

// ─── Wave Configuration ──────────────────────────────────────────────────────

export function getWaveConfig(wave: number): WaveConfig {
  const alienCount = Math.min(2 + wave, 12)
  const descentDuration = Math.max(14 - wave * 0.8, 6)
  const spawnInterval = Math.max(3000 - wave * 150, 1200)

  const world = WORLD_CONFIG.find(w => wave >= w.waves[0] && wave <= w.waves[1])
    ?? WORLD_CONFIG[WORLD_CONFIG.length - 1]

  return {
    waveNumber: wave,
    alienCount,
    descentDuration,
    spawnInterval,
    worldName: world.name,
    worldColor: world.color,
  }
}

// ─── Initial State ───────────────────────────────────────────────────────────

export function createInitialState(): GameState {
  return {
    phase: 'menu',
    wave: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    cityHealth: 5,
    maxCityHealth: 5,
    aliens: [],
    activeAlienIndex: -1,
    unlockedNotes: [INTRO_ORDER[0], INTRO_ORDER[1]], // Start with C4 + A4
    consecutiveCorrect: 0,
    totalCorrect: 0,
    totalAttempts: 0,
    notePlayedAt: null,
    aliensSpawned: 0,
    aliensInWave: 0,
    lastAnswerCorrect: null,
    newNoteUnlocked: null,
    waveScore: 0,
    didWin: false,
    isNewHighScore: false,
  }
}

// ─── Alien Spawning ──────────────────────────────────────────────────────────

export function spawnAlien(
  state: GameState,
  waveConfig: WaveConfig,
  fsrsMemory: Record<string, NoteMemory>,
  sequenceLength: number = 1,
): AlienState {
  // Pick note via FSRS — prioritizes overdue/weak notes
  const lastNote = state.aliens.length > 0
    ? state.aliens[state.aliens.length - 1].note
    : null
  const note = pickNextNote(state.unlockedNotes, fsrsMemory, lastNote)
  const color = NOTE_COLORS[note] ?? { hue: 0, name: 'Unknown' }

  // Build sequence for multi-note aliens
  let sequence: string[] | undefined
  if (sequenceLength > 1) {
    sequence = [note]
    let prev = note
    for (let i = 1; i < sequenceLength; i++) {
      const next = pickNextNote(state.unlockedNotes, fsrsMemory, prev)
      sequence.push(next)
      prev = next
    }
  }

  // Random lane (0-4) avoiding last alien's lane
  let lane = Math.floor(Math.random() * 5)
  if (state.aliens.length > 0) {
    const lastLane = state.aliens[state.aliens.length - 1].lane
    while (lane === lastLane && state.unlockedNotes.length > 1) {
      lane = Math.floor(Math.random() * 5)
    }
  }

  return {
    id: uid(),
    note,
    lifecycle: 'spawning',
    spawnTime: Date.now(),
    descentDuration: waveConfig.descentDuration + (sequenceLength > 1 ? sequenceLength * 2 : 0), // extra time for sequences
    lane,
    noteHue: color.hue,
    ...(sequence ? { sequence, coresDestroyed: 0 } : {}),
  }
}

// ─── Alien Lifecycle ─────────────────────────────────────────────────────────

export function checkAlienEscaped(alien: AlienState): boolean {
  if (alien.lifecycle === 'exploding' || alien.lifecycle === 'escaped' || alien.lifecycle === 'hit') {
    return false
  }
  const elapsed = (Date.now() - alien.spawnTime) / 1000
  return elapsed >= alien.descentDuration
}

// ─── FSRS Memory Helpers ─────────────────────────────────────────────────────

export function ensureNoteMemory(
  memory: Record<string, NoteMemory>,
  notes: string[],
): Record<string, NoteMemory> {
  const updated = { ...memory }
  for (const note of notes) {
    if (!updated[note]) {
      updated[note] = createNote(note)
    }
  }
  return updated
}
