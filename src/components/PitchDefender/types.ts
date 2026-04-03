// Pitch Defender — Type Definitions

export type GamePhase =
  | 'menu'
  | 'countdown'
  | 'wave_intro'
  | 'wave_active'
  | 'wave_complete'
  | 'game_over'

export type AlienLifecycle =
  | 'spawning'
  | 'descending'
  | 'hit'
  | 'exploding'
  | 'escaped'

export interface AlienState {
  id: string
  note: string
  lifecycle: AlienLifecycle
  spawnTime: number
  descentDuration: number
  lane: number            // horizontal position 0-4
  noteHue: number         // from synesthesia color map
  // Sequence Assault: multi-note aliens
  sequence?: string[]     // ordered notes (e.g., ['C4', 'E4', 'G4'])
  coresDestroyed?: number // how many cores have been answered correctly
}

export interface WaveConfig {
  waveNumber: number
  alienCount: number
  descentDuration: number  // seconds to reach bottom
  spawnInterval: number    // ms between alien spawns
  worldName: string
  worldColor: string       // accent color for the world
}

export interface GameState {
  phase: GamePhase
  wave: number
  score: number
  combo: number
  maxCombo: number
  cityHealth: number
  maxCityHealth: number
  aliens: AlienState[]
  activeAlienIndex: number
  unlockedNotes: string[]
  consecutiveCorrect: number
  totalCorrect: number
  totalAttempts: number
  notePlayedAt: number | null
  aliensSpawned: number
  aliensInWave: number
  lastAnswerCorrect: boolean | null
  newNoteUnlocked: string | null
  waveScore: number
  didWin: boolean
  isNewHighScore: boolean
}

export interface GameProgress {
  highScore: number
  bestWave: number
  bestCombo: number
  totalGamesPlayed: number
  totalAliensDestroyed: number
}

// Unlock order: start with octave 4, then expand to octave 3 for absolute pitch training
export const INTRO_ORDER = [
  'C4', 'A4', 'G4', 'E4', 'D4', 'F4', 'B4', 'C5',
  'A3', 'G3', 'E3', 'C3', 'D3', 'F3', 'B3',
] as const
export const KEYBOARD_ORDER = [
  'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3',
  'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5',
] as const

export const NOTE_LABELS: Record<string, string> = {
  'C3': 'C3', 'D3': 'D3', 'E3': 'E3', 'F3': 'F3',
  'G3': 'G3', 'A3': 'A3', 'B3': 'B3',
  'C4': 'C4', 'D4': 'D4', 'E4': 'E4', 'F4': 'F4',
  'G4': 'G4', 'A4': 'A4', 'B4': 'B4', 'C5': 'C5',
}

// Unlock thresholds: poolSize -> consecutive correct needed
// Octave 4 unlocks first (2-8), then octave 3 notes (9-15)
export const UNLOCK_THRESHOLDS: Record<number, number> = {
  2: 5, 3: 7, 4: 10, 5: 13, 6: 16, 7: 20,
  // Cross-octave: harder thresholds since distinguishing octaves is advanced
  8: 8, 9: 10, 10: 12, 11: 14, 12: 16, 13: 18, 14: 20,
}

export const WORLD_CONFIG: { name: string; color: string; waves: [number, number] }[] = [
  { name: 'Sound Scouts',       color: '#3FBFB5', waves: [1, 2] },
  { name: 'Frequency Fighters', color: '#72C247', waves: [3, 4] },
  { name: 'Echo Station',       color: '#E8A838', waves: [5, 6] },
  { name: 'Harmonic Ridge',     color: '#C060E0', waves: [7, 8] },
  { name: 'The Frontier',       color: '#E04060', waves: [9, 99] },
]
