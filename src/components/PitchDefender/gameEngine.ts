// Pitch Defender — Game Engine (pure logic, no React)

import { NOTE_COLORS, createNote, pickNextNote, type NoteMemory } from '@/lib/fsrs'
import {
  type AlienState, type WaveConfig, type GameState,
  INTRO_ORDER, UNLOCK_THRESHOLDS, WORLD_CONFIG,
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
  }
}

// ─── Alien Spawning ──────────────────────────────────────────────────────────

export function spawnAlien(
  state: GameState,
  waveConfig: WaveConfig,
  fsrsMemory: Record<string, NoteMemory>,
): AlienState {
  // Pick note via FSRS — prioritizes overdue/weak notes
  const lastNote = state.aliens.length > 0
    ? state.aliens[state.aliens.length - 1].note
    : null
  const note = pickNextNote(state.unlockedNotes, fsrsMemory, lastNote)
  const color = NOTE_COLORS[note] ?? { hue: 0, name: 'Unknown' }

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
    descentDuration: waveConfig.descentDuration,
    lane,
    noteHue: color.hue,
  }
}

// ─── Answer Processing ───────────────────────────────────────────────────────

export interface AnswerResult {
  correct: boolean
  scoreGained: number
  newCombo: number
  comboMultiplier: number
  cityDamage: number
  noteUnlocked: string | null
}

export function processAnswer(
  state: GameState,
  alienId: string,
  answeredNote: string,
): AnswerResult {
  const alien = state.aliens.find(a => a.id === alienId)
  if (!alien) return { correct: false, scoreGained: 0, newCombo: 0, comboMultiplier: 1, cityDamage: 0, noteUnlocked: null }

  const correct = answeredNote === alien.note
  const comboMultiplier = state.combo >= 20 ? 4 : state.combo >= 10 ? 3 : state.combo >= 5 ? 2 : 1
  const newCombo = correct ? state.combo + 1 : 0

  // Score: base 100 + combo bonus
  const baseScore = 100
  const scoreGained = correct ? baseScore * comboMultiplier : 0
  const cityDamage = correct ? 0 : 0 // wrong answers don't damage city (only escapes do)

  // Check note unlock
  let noteUnlocked: string | null = null
  if (correct) {
    const newConsecutive = state.consecutiveCorrect + 1
    const currentPool = state.unlockedNotes.length
    if (currentPool < INTRO_ORDER.length) {
      const threshold = UNLOCK_THRESHOLDS[currentPool] ?? 5
      if (newConsecutive >= threshold) {
        noteUnlocked = INTRO_ORDER[currentPool]
      }
    }
  }

  return { correct, scoreGained, newCombo, comboMultiplier, cityDamage, noteUnlocked }
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
