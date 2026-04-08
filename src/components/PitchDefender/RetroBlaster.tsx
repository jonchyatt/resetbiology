'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// RetroBlaster — Pixel-Art Space Invaders Note Identification
// ═══════════════════════════════════════════════════════════════════════════════
//
// Classic space invaders aesthetic: 480x320 logical resolution, pixelated upscale,
// sprite-based aliens, pixel lasers, retro SFX. Same FSRS engine as Note Blaster.
//
// All rendering in a single Canvas 2D — no DOM elements, no React re-renders
// for game entities. Pure game loop.
//
// SIBLING to Note Blaster. Does NOT replace it.
//
// REBUILD (2026-04-06): bigger canvas, tutorial level, on-screen instructions,
// progressive waves (1→2→3...), wrong-answer feedback, replay button, variety.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  NOTE_COLORS, createNote, reviewNote, autoGrade, currentR,
  type NoteMemory,
} from '@/lib/fsrs'
import { INTRO_ORDER, UNLOCK_THRESHOLDS } from './types'
import { usePitchDetection } from './usePitchDetection'
import { initAudio, loadPianoSamples, playPianoNote } from './audioEngine'
import { noteToFreq, octaveFoldedCents } from './pitchMath'

// ─── Constants ──────────────────────────────────────────────────────────────

const FSRS_KEY = 'pitch_fsrs_memory'
const TUTORIAL_KEY = 'retro_tutorial_seen'
const RETRO_DIFFICULTY_KEY = 'retro_difficulty'
const W = 480      // logical width — bigger for readability
const H = 320      // logical height
const ALIEN_W = 24
const ALIEN_H = 18
const PLAYER_W = 28
const PLAYER_H = 14
const LASER_W = 3
const LASER_H = 12
const LASER_SPEED = 480   // pixels per second

// Vertical layout (canvas-relative). Order from bottom up:
//   note buttons (290-312)  →  player ship (270-284)  →  charge bar (258-262)
// Keeping these as constants so we never accidentally render the ship under
// the note buttons again.
const NOTE_BUTTONS_Y = 290         // matches H - 30 in old code
const PLAYER_Y = 270               // ship sprite top — was H - PLAYER_H - 8 = 298 (overlapped buttons)
const INITIAL_UNLOCK = 4  // start with 4 notes (C4, D4, E4, F4)
const STARTING_SHIELDS = 5

// Mic match mechanic — ported from PITCHFORKS v1 (Pitchforks.tsx:418-493).
// Time-based hold. Silent/flickering frames preserve the in-progress lock.
// Only a CONFIDENTLY WRONG note resets it. See:
//   memory/reference/reference_pitch_charge_decay_pattern.md
const MIC_HOLD_MS = 300            // sustained on-pitch time before fire (Pitchforks v1)
const MIC_TOLERANCE_CENTS = 70     // 0.7 semitones — ear-training standard
const MIC_CONFIDENCE_FLOOR = 0.75  // pitchy clarity required to consider matching
const CHARGE_FULL_MS = MIC_HOLD_MS // alias kept so existing render code works

type InputMode = 'click' | 'mic'
type Phase = 'menu' | 'tutorial' | 'playing' | 'game_over'

interface Alien {
  x: number
  y: number
  note: string
  hue: number
  alive: boolean
  frame: number     // animation frame 0 or 1
  hitTimer: number  // >0 = exploding
}

interface Laser {
  x: number
  y: number
  hue: number
  active: boolean
  hits: boolean      // true = will hit (correct), false = miss visual only
  targetY: number    // for misses, where it stops
  targetIdx: number  // index of the specific alien this laser is flying toward (-1 for misses)
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  hue: number
}

type Difficulty = 'easy' | 'true'

interface WaveParams {
  alienCount: number
  maxConcurrent: number
  descentSpeed: number   // px/sec
  spawnInterval: number  // ms between spawns
}

interface GameState {
  aliens: Alien[]
  lasers: Laser[]
  particles: Particle[]
  playerX: number
  score: number
  combo: number
  maxCombo: number
  wave: number
  cityHealth: number
  activeIdx: number
  unlockedNotes: string[]
  consecutiveCorrect: number
  selectedNote: string | null
  waveIntroTimer: number
  flashTimer: number     // red screen flash on wrong
  wrongMessage: string   // "WRONG! That was D" text
  wrongTimer: number     // how long to show the wrong message
  // Mic charge mechanic (visualization only — actual lock state lives in matchStartRef)
  chargeProgress: number // 0..CHARGE_FULL_MS — for the HUD bar fill animation
  // Difficulty + staggered spawner (Phase 3)
  difficulty: Difficulty
  spawnQueue: string[]         // notes still to spawn this wave
  spawnedThisWave: number      // total aliens spawned so far this wave
  alienCountThisWave: number   // total this wave will spawn
  nextSpawnAt: number          // performance.now() target for next spawn
  // Fail-safe unlock (Phase 4 — EASY mode only)
  lastProgressAt: number       // performance.now() of last processHit or wave start
  hintCount: number            // number of hints shown this wave (debug/stats)
}

// ─── Pixel Sprite Data (1-bit bitmaps) ──────────────────────────────────────

// Classic space invader shape (12x9 source, drawn at 2x scale = 24x18)
const ALIEN_SPRITE_A = [
  '....1111....',
  '..11111111..',
  '.1111111111.',
  '.11.1111.11.',
  '.1111111111.',
  '...11..11...',
  '..11.11.11..',
  '.11......11.',
  '....1111....',
]

const ALIEN_SPRITE_B = [
  '....1111....',
  '..11111111..',
  '.1111111111.',
  '.11.1111.11.',
  '.1111111111.',
  '..1..11..1..',
  '.11.1..1.11.',
  '..11....11..',
  '....1111....',
]

// Player ship (14x7 source, 2x scale = 28x14)
const PLAYER_SPRITE = [
  '......11......',
  '.....1111.....',
  '.....1111.....',
  '.111111111111.',
  '11111111111111',
  '11111111111111',
  '.111.1111.111.',
]

// Explosion sprite (11x9, drawn at 2x)
const EXPLOSION_SPRITE = [
  '.1...1...1.',
  '..1.111.1..',
  '...11111...',
  '.111.1.111.',
  '1111.1.1111',
  '.111.1.111.',
  '...11111...',
  '..1.111.1..',
  '.1...1...1.',
]

function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: string[],
  x: number,
  y: number,
  color: string,
  scale = 2,
) {
  ctx.fillStyle = color
  for (let row = 0; row < sprite.length; row++) {
    for (let col = 0; col < sprite[row].length; col++) {
      if (sprite[row][col] === '1') {
        ctx.fillRect(Math.floor(x + col * scale), Math.floor(y + row * scale), scale, scale)
      }
    }
  }
}

// ─── Retro SFX (Web Audio chiptune) ────────────────────────────────────────

let _sfxCtx: AudioContext | null = null
function sfxCtx(): AudioContext {
  if (!_sfxCtx) _sfxCtx = new AudioContext()
  if (_sfxCtx.state === 'suspended') _sfxCtx.resume()
  return _sfxCtx
}

function sfxShoot() {
  const c = sfxCtx(); const now = c.currentTime
  const o = c.createOscillator(); const g = c.createGain()
  o.type = 'square'; o.frequency.setValueAtTime(880, now)
  o.frequency.exponentialRampToValueAtTime(110, now + 0.1)
  g.gain.setValueAtTime(0.15, now); g.gain.linearRampToValueAtTime(0, now + 0.1)
  o.connect(g); g.connect(c.destination); o.start(now); o.stop(now + 0.1)
}

function sfxWrong() {
  const c = sfxCtx(); const now = c.currentTime
  const o = c.createOscillator(); const g = c.createGain()
  o.type = 'sawtooth'; o.frequency.setValueAtTime(150, now)
  o.frequency.linearRampToValueAtTime(80, now + 0.2)
  g.gain.setValueAtTime(0.12, now); g.gain.linearRampToValueAtTime(0, now + 0.2)
  o.connect(g); g.connect(c.destination); o.start(now); o.stop(now + 0.2)
}

function sfxExplosion() {
  const c = sfxCtx(); const now = c.currentTime
  const dur = 0.2; const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.max(0, 1 - i / data.length)
  const src = c.createBufferSource(); src.buffer = buf
  const g = c.createGain(); g.gain.setValueAtTime(0.15, now); g.gain.linearRampToValueAtTime(0, now + dur)
  src.connect(g); g.connect(c.destination); src.start(now)
}

// ─── Target arbitration (any-target aim) ────────────────────────────────────
//
// When the player answers a note (click, key, or sing), find the most urgent
// alive alien with that note class. Hybrid rule per Codex boardroom verdict:
//   primary    = highest y on screen (closest to bottom = most urgent)
//   tiebreaker = nearest to player's current x (spatial continuity)
//
// FSRS difficulty intentionally NOT used here — learning intelligence lives in
// spawning, not in real-time combat arbitration.
function noteClass(name: string): string {
  return name.replace(/\d+$/, '')
}
function pickTargetForNote(aliens: Alien[], answeredNote: string, playerX: number): { alien: Alien; index: number } | null {
  const targetClass = noteClass(answeredNote)
  let best: Alien | null = null
  let bestIdx = -1
  for (let i = 0; i < aliens.length; i++) {
    const a = aliens[i]
    if (!a.alive || noteClass(a.note) !== targetClass) continue
    if (!best) { best = a; bestIdx = i; continue }
    // Y delta > 4px → use urgency. Otherwise → use x proximity.
    const dy = a.y - best.y
    if (Math.abs(dy) > 4) {
      if (dy > 0) { best = a; bestIdx = i }
    } else if (Math.abs(a.x - playerX) < Math.abs(best.x - playerX)) {
      best = a; bestIdx = i
    }
  }
  return best ? { alien: best, index: bestIdx } : null
}
// Recommended-next spotlight: just the most-urgent alive alien (any note).
// Used to drive the active highlight + the auto-replay piano cue.
function pickSpotlightIdx(aliens: Alien[], playerX: number): number {
  let bestIdx = -1
  let bestY = -Infinity
  let bestDx = Infinity
  for (let i = 0; i < aliens.length; i++) {
    const a = aliens[i]
    if (!a.alive) continue
    const dy = a.y - bestY
    if (dy > 4) {
      bestIdx = i; bestY = a.y; bestDx = Math.abs(a.x - playerX)
    } else if (Math.abs(dy) <= 4) {
      const dx = Math.abs(a.x - playerX)
      if (dx < bestDx) { bestIdx = i; bestY = a.y; bestDx = dx }
    }
  }
  return bestIdx
}

// ─── Deterministic shuffle (Fisher-Yates with seed) ─────────────────────────

function shuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr]
  let s = seed
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) % 0x100000000
    const j = Math.floor((s / 0x100000000) * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─── Difficulty curve (Codex boardroom verdict) ─────────────────────────────
// EASY: gentle training. Every wave must be beatable. Caps concurrency AND
//       descent speed instead of compounding both.
// TRUE: harder play mode. Faster ramp, more concurrent, no fail-safe.
function waveParams(wave: number, difficulty: Difficulty): WaveParams {
  if (difficulty === 'easy') {
    return {
      alienCount:    Math.min(2 + Math.floor((wave - 1) / 2), 7),
      maxConcurrent: Math.min(2 + Math.floor((wave - 1) / 3), 4),
      descentSpeed:  Math.min(4 + 0.6 * (wave - 1), 8),
      spawnInterval: 1100,
    }
  }
  return {
    alienCount:    Math.min(3 + wave, 12),
    maxConcurrent: Math.min(3 + Math.floor((wave - 1) / 2), 7),
    descentSpeed:  Math.min(5.5 + 1.1 * (wave - 1), 14),
    spawnInterval: 800,
  }
}

// ─── Spawn lane picker ──────────────────────────────────────────────────────
// Aliens spawn one at a time (not in formation). 5 evenly-spaced lanes; pick
// the lane whose topmost alien is FARTHEST DOWN (or empty). Skip lanes whose
// topmost alien is still too close to the spawn point to avoid overlap.
const SPAWN_LANES_X = [W * 0.14, W * 0.30, W * 0.46, W * 0.62, W * 0.86]
const SPAWN_Y = 70
const SPAWN_LANE_GAP = 16  // min vertical clearance from existing alien in lane

function pickSpawnX(aliens: Alien[], laneOrderSeed: number): number | null {
  // Score each lane by topmost alien y (or H if empty). Higher score = more room.
  // Randomize the iteration order for visual variety so equal-score lanes don't always win the same way.
  const order = shuffle([0, 1, 2, 3, 4], laneOrderSeed)
  let bestLane = -1
  let bestY = -Infinity
  for (const i of order) {
    const lx = SPAWN_LANES_X[i]
    let topY = H  // empty lane = no obstruction
    for (const a of aliens) {
      if (!a.alive) continue
      if (Math.abs(a.x + ALIEN_W / 2 - lx) < ALIEN_W) {
        if (a.y < topY) topY = a.y
      }
    }
    // Disallow lanes where the topmost alien is still too fresh
    if (topY < SPAWN_Y + ALIEN_H + SPAWN_LANE_GAP) continue
    if (topY > bestY) { bestY = topY; bestLane = i }
  }
  if (bestLane < 0) return null
  return Math.floor(SPAWN_LANES_X[bestLane] - ALIEN_W / 2)
}

// ─── Wave queue builder (FSRS-weighted) ─────────────────────────────────────
// Codex's hard line: FSRS belongs in spawning, not in real-time arbitration.
// Notes the player struggles with (low retention R) appear MORE often. Notes
// they've mastered (high R) still appear occasionally so they don't decay.
//
// Variety guarantees:
//   - If alienCount >= unlockedPool.length, every unlocked note appears at
//     least once (so no note gets fully starved out)
//   - No 3 consecutive identical notes (rotating the offender out)
function buildWaveQueue(
  gs: GameState,
  fsrs: Record<string, NoteMemory>,
): void {
  const params = waveParams(gs.wave, gs.difficulty)
  const pool = gs.unlockedNotes
  const count = params.alienCount

  // Guarantee at-least-once for variety on full-pool waves
  const must: string[] = count >= pool.length ? [...pool] : []
  const remaining = Math.max(0, count - must.length)

  // Inverse-R weights (clamped to [0.2, 1.2] so even mastered notes still appear)
  const weights = pool.map(n => {
    const m = fsrs[n]
    const r = m ? currentR(m) : 0
    return Math.max(0.2, 1.2 - r)
  })
  const totalWeight = weights.reduce((a, b) => a + b, 0)

  // Weighted samples with replacement
  const sampled: string[] = []
  let rng = gs.wave * 1000003 + 17
  for (let i = 0; i < remaining; i++) {
    rng = (rng * 1664525 + 1013904223) % 0x100000000
    const target = (rng / 0x100000000) * totalWeight
    let acc = 0
    let chosen = pool[0]
    for (let j = 0; j < pool.length; j++) {
      acc += weights[j]
      if (target <= acc) { chosen = pool[j]; break }
    }
    sampled.push(chosen)
  }

  // Combine + shuffle so guaranteed-once notes aren't always at the start
  const combined = shuffle([...must, ...sampled], gs.wave * 104729)

  // No 3-in-a-row constraint
  for (let i = 2; i < combined.length; i++) {
    if (combined[i] === combined[i - 1] && combined[i] === combined[i - 2]) {
      const alt = pool.find(p => p !== combined[i])
      if (alt) combined[i] = alt
    }
  }

  gs.spawnQueue = combined
  gs.spawnedThisWave = 0
  gs.alienCountThisWave = combined.length
  gs.nextSpawnAt = performance.now() + (gs.waveIntroTimer * 1000) + 600
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function RetroBlaster() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<GameState | null>(null)
  const fsrsRef = useRef<Record<string, NoteMemory>>({})
  const rafRef = useRef(0)
  const lastTimeRef = useRef(0)
  const notePlayTimeRef = useRef(0)

  const [phase, setPhase] = useState<Phase>('menu')
  const [inputMode, setInputMode] = useState<InputMode>('click')
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [displayScore, setDisplayScore] = useState(0)
  const [displayWave, setDisplayWave] = useState(0)
  const [displayCombo, setDisplayCombo] = useState(0)
  const [displayHealth, setDisplayHealth] = useState(STARTING_SHIELDS)
  const [displayUnlocked, setDisplayUnlocked] = useState<string[]>([])
  const [finalStats, setFinalStats] = useState({ score: 0, wave: 0, maxCombo: 0 })

  // Mic detection
  const { isListening, startListening, stopListening, pitchRef: livePitchRef } = usePitchDetection({ noiseGateDb: -45 })
  const hitProcessingRef = useRef(false)
  // Pitchforks v1 lock pattern: matchStartRef holds the time the current
  // in-tolerance hold began (ms timestamp from performance.now()), or 0 when
  // not locking, or -1 during the post-fire cooldown. matchTargetIdxRef tracks
  // which alien the lock is currently against (any-target aim).
  const matchStartRef = useRef(0)
  const matchTargetIdxRef = useRef(-1)

  // Load FSRS + piano samples + persisted difficulty
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FSRS_KEY)
      if (raw) fsrsRef.current = JSON.parse(raw)
    } catch {}
    try {
      const d = localStorage.getItem(RETRO_DIFFICULTY_KEY)
      if (d === 'easy' || d === 'true') setDifficulty(d)
    } catch {}
    loadPianoSamples()
  }, [])

  // ─── Begin Wave ────────────────────────────────────────────────────────
  // Builds the wave queue (notes still to spawn) and clears any dead bodies
  // from the previous wave. Aliens are NOT spawned here — the spawner tick
  // inside gameLoop handles that staggered over time per waveParams().
  // FSRS-weighted note selection happens inside buildWaveQueue.
  const beginWave = useCallback((gs: GameState) => {
    gs.aliens = []
    gs.activeIdx = -1
    gs.chargeProgress = 0
    matchStartRef.current = 0
    matchTargetIdxRef.current = -1
    gs.lastProgressAt = performance.now()
    gs.hintCount = 0
    buildWaveQueue(gs, fsrsRef.current)
  }, [])

  // ─── Build Initial Game State ──────────────────────────────────────────
  const buildInitialState = useCallback((): GameState => {
    // Restore unlocked notes from FSRS history
    const reviewed = new Set(
      Object.entries(fsrsRef.current).filter(([, m]) => m.lastReview > 0).map(([k]) => k)
    )
    const restored: string[] = []
    for (const note of INTRO_ORDER) {
      if (reviewed.has(note)) restored.push(note)
      else break
    }
    // Always start with at least INITIAL_UNLOCK notes
    const unlocked = restored.length >= INITIAL_UNLOCK
      ? restored
      : INTRO_ORDER.slice(0, INITIAL_UNLOCK) as unknown as string[]

    // Ensure FSRS entries exist
    for (const n of unlocked) {
      if (!fsrsRef.current[n]) fsrsRef.current[n] = createNote(n)
    }

    return {
      aliens: [],
      lasers: [],
      particles: [],
      playerX: W / 2,
      score: 0,
      combo: 0,
      maxCombo: 0,
      wave: 1,
      cityHealth: STARTING_SHIELDS,
      activeIdx: -1,
      unlockedNotes: unlocked,
      consecutiveCorrect: 0,
      selectedNote: null,
      waveIntroTimer: 1.5,
      flashTimer: 0,
      wrongMessage: '',
      wrongTimer: 0,
      chargeProgress: 0,
      difficulty,
      spawnQueue: [],
      spawnedThisWave: 0,
      alienCountThisWave: 0,
      nextSpawnAt: 0,
      lastProgressAt: 0,
      hintCount: 0,
    }
  }, [difficulty])

  // ─── Start Game ───────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0 }
    initAudio()
    if (inputMode === 'mic') startListening()

    const gs = buildInitialState()
    stateRef.current = gs
    setPhase('playing')
    setDisplayScore(0)
    setDisplayWave(1)
    setDisplayHealth(STARTING_SHIELDS)
    setDisplayCombo(0)
    setDisplayUnlocked(gs.unlockedNotes)

    beginWave(gs)
    lastTimeRef.current = performance.now()
    gameLoop()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputMode, beginWave, buildInitialState])

  const handleInsertCoin = useCallback(() => {
    let seen = false
    try { seen = localStorage.getItem(TUTORIAL_KEY) === '1' } catch {}
    if (seen) startGame()
    else setPhase('tutorial')
  }, [startGame])

  const finishTutorial = useCallback(() => {
    try { localStorage.setItem(TUTORIAL_KEY, '1') } catch {}
    startGame()
  }, [startGame])

  // ─── Replay current alien's note ──────────────────────────────────────
  const replayActiveNote = useCallback(() => {
    const gs = stateRef.current
    if (!gs) return
    const alien = gs.aliens[gs.activeIdx]
    if (!alien?.alive) return
    playPianoNote(alien.note)
    notePlayTimeRef.current = Date.now()
  }, [])

  // ─── Answer Logic (any-target aim) ────────────────────────────────────
  // Player answers a note → scan ALL alive aliens for a match → pick most-urgent
  // matching alien (highest y, tiebreak nearest x) → fire at it. If no alien
  // matches the answered note → wrong answer, lose a shield, replay the
  // currently-spotlighted alien's correct note as a learning cue.
  const processHit = useCallback((answeredNote: string) => {
    if (hitProcessingRef.current) return
    hitProcessingRef.current = true

    const gs = stateRef.current
    if (!gs) { hitProcessingRef.current = false; return }

    // Engagement = progress (resets the EASY-mode fail-safe hint timer)
    gs.lastProgressAt = performance.now()

    const pick = pickTargetForNote(gs.aliens, answeredNote, gs.playerX)
    const latency = notePlayTimeRef.current > 0 ? Date.now() - notePlayTimeRef.current : 2000

    if (pick) {
      const { alien: target, index: targetIdx } = pick
      const grade = autoGrade(true, latency)
      // FSRS update against the alien actually shot
      if (!fsrsRef.current[target.note]) fsrsRef.current[target.note] = createNote(target.note)
      fsrsRef.current[target.note] = reviewNote(fsrsRef.current[target.note], grade)
      try { localStorage.setItem(FSRS_KEY, JSON.stringify(fsrsRef.current)) } catch {}

      sfxShoot()
      // Auto-aim: slide ship under the chosen alien, fire from there
      const aimX = target.x + ALIEN_W / 2
      gs.playerX = aimX
      gs.lasers.push({
        x: aimX,
        y: PLAYER_Y,
        hue: target.hue,
        active: true,
        hits: true,
        targetY: target.y + ALIEN_H / 2,
        targetIdx,
      })
      gs.combo++
      gs.maxCombo = Math.max(gs.maxCombo, gs.combo)
      const mult = gs.combo >= 10 ? 3 : gs.combo >= 5 ? 2 : 1
      gs.score += 100 * mult
      gs.consecutiveCorrect++

      // Unlock check
      const poolSize = gs.unlockedNotes.length
      const threshold = UNLOCK_THRESHOLDS[poolSize]
      if (threshold && gs.consecutiveCorrect >= threshold && poolSize < INTRO_ORDER.length) {
        const newNote = INTRO_ORDER[poolSize]
        gs.unlockedNotes = [...gs.unlockedNotes, newNote]
        if (!fsrsRef.current[newNote]) fsrsRef.current[newNote] = createNote(newNote)
        gs.consecutiveCorrect = 0
        setDisplayUnlocked(gs.unlockedNotes)
      }

      setDisplayScore(gs.score)
      setDisplayCombo(gs.combo)
      setTimeout(() => { hitProcessingRef.current = false }, 150)
    } else {
      // No alive alien matches that note → wrong
      sfxWrong()
      gs.combo = 0
      gs.consecutiveCorrect = 0
      gs.cityHealth = Math.max(0, gs.cityHealth - 1)
      gs.flashTimer = 0.4
      // Use the spotlighted alien (most urgent) as the "correct answer" cue
      const spotlight = gs.aliens[gs.activeIdx]
      if (spotlight?.alive) {
        const correctName = NOTE_COLORS[spotlight.note]?.name ?? spotlight.note
        gs.wrongMessage = `WRONG! Try ${spotlight.note.replace(/\d/, '')} (${correctName})`
        gs.wrongTimer = 1.8

        // Visual: aim a miss-laser at the spotlighted alien
        const aimX = spotlight.x + ALIEN_W / 2
        gs.playerX = aimX
        gs.lasers.push({
          x: aimX,
          y: PLAYER_Y,
          hue: 0,
          active: true,
          hits: false,
          targetY: spotlight.y + ALIEN_H + 30,
          targetIdx: -1,
        })

        // Replay the correct note so they learn
        setTimeout(() => playPianoNote(spotlight.note), 350)
      } else {
        gs.wrongMessage = 'WRONG!'
        gs.wrongTimer = 1.0
      }
      setDisplayHealth(gs.cityHealth)
      setDisplayCombo(0)

      hitProcessingRef.current = false

      if (gs.cityHealth <= 0) {
        setFinalStats({ score: gs.score, wave: gs.wave, maxCombo: gs.maxCombo })
        if (inputMode === 'mic') stopListening()
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0 }
        setPhase('game_over')
        return
      }
    }
  }, [inputMode, stopListening])

  // ─── Game Loop ────────────────────────────────────────────────────────
  const gameLoop = useCallback(() => {
    const gs = stateRef.current
    if (!gs) return
    const now = performance.now()
    const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05)
    lastTimeRef.current = now

    const canvas = canvasRef.current
    if (!canvas) { rafRef.current = requestAnimationFrame(gameLoop); return }
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // ── Update ──

    if (gs.waveIntroTimer > 0) gs.waveIntroTimer -= dt
    if (gs.flashTimer > 0) gs.flashTimer -= dt
    if (gs.wrongTimer > 0) {
      gs.wrongTimer -= dt
      if (gs.wrongTimer <= 0) gs.wrongMessage = ''
    }

    // ── Spawner tick: stagger aliens into the field per waveParams ──
    // Spawns one alien at a time when the field is below maxConcurrent and the
    // next-spawn cooldown has elapsed. The first alien of each wave plays its
    // note and becomes the spotlight so the player has an immediate target.
    const params = waveParams(gs.wave, gs.difficulty)
    if (gs.spawnQueue.length > 0 && gs.waveIntroTimer <= 0 && now >= gs.nextSpawnAt) {
      const aliveCount = gs.aliens.filter(a => a.alive).length
      if (aliveCount < params.maxConcurrent) {
        const x = pickSpawnX(gs.aliens, gs.wave * 31 + gs.spawnedThisWave)
        if (x !== null) {
          const note = gs.spawnQueue.shift()!
          const colorInfo = NOTE_COLORS[note]
          gs.aliens.push({
            x,
            y: SPAWN_Y,
            note,
            hue: colorInfo?.hue ?? 0,
            alive: true,
            frame: gs.spawnedThisWave % 2,
            hitTimer: 0,
          })
          gs.spawnedThisWave++
          gs.nextSpawnAt = now + params.spawnInterval

          // First spawn of the wave: refresh spotlight + play the piano cue
          if (gs.spawnedThisWave === 1) {
            gs.activeIdx = gs.aliens.length - 1
            const cueNote = note
            setTimeout(() => {
              const cur = stateRef.current
              if (cur && cur.aliens.some(a => a.alive && a.note === cueNote)) {
                playPianoNote(cueNote)
                notePlayTimeRef.current = Date.now()
              }
            }, 200)
          }
        }
      }
    }

    // ── Fail-safe unlock (EASY mode only) ──
    // If 60 seconds elapse with no engagement (no answer attempts) while there
    // are alive aliens, replay the spotlight's note as a hint and reset the
    // timer. Helps a stuck child get unstuck without nuking the score.
    if (gs.difficulty === 'easy' && now - gs.lastProgressAt > 60000) {
      const spotlight = gs.aliens[gs.activeIdx]
      if (spotlight?.alive) {
        playPianoNote(spotlight.note)
        notePlayTimeRef.current = Date.now()
        gs.wrongMessage = `Hint: try ${spotlight.note.replace(/\d/, '')}`
        gs.wrongTimer = 2.5
        gs.hintCount++
      }
      gs.lastProgressAt = now
    }

    // Alien descent (uses difficulty-aware speed from waveParams)
    const speed = params.descentSpeed
    for (const alien of gs.aliens) {
      if (!alien.alive && alien.hitTimer <= 0) continue
      if (alien.hitTimer > 0) {
        alien.hitTimer -= dt
        continue
      }
      if (gs.waveIntroTimer <= 0) {
        alien.y += speed * dt
      }
    }

    // Alien animation
    for (const alien of gs.aliens) {
      if (alien.alive) alien.frame = Math.floor(now / 500) % 2
    }

    // Active alien bobbing — handled in render via sin()

    // Lasers — each carries its own targetIdx (any-target aim)
    for (const laser of gs.lasers) {
      if (!laser.active) continue
      laser.y -= LASER_SPEED * dt

      if (laser.hits) {
        const target = gs.aliens[laser.targetIdx]
        if (target?.alive &&
            laser.y <= target.y + ALIEN_H &&
            laser.x >= target.x - 4 && laser.x <= target.x + ALIEN_W + 4) {
          // HIT!
          sfxExplosion()
          target.alive = false
          target.hitTimer = 0.4
          laser.active = false

          for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2
            gs.particles.push({
              x: target.x + ALIEN_W / 2,
              y: target.y + ALIEN_H / 2,
              vx: Math.cos(angle) * (40 + Math.random() * 60),
              vy: Math.sin(angle) * (40 + Math.random() * 60),
              life: 0.5 + Math.random() * 0.4,
              hue: target.hue,
            })
          }

          // Recompute spotlight (most-urgent alive alien) and replay its note
          const nextIdx = pickSpotlightIdx(gs.aliens, gs.playerX)
          gs.activeIdx = nextIdx
          if (nextIdx >= 0) {
            setTimeout(() => {
              const cur = stateRef.current
              if (cur && cur.aliens[nextIdx]?.alive && cur.activeIdx === nextIdx) {
                playPianoNote(cur.aliens[nextIdx].note)
                notePlayTimeRef.current = Date.now()
              }
            }, 350)
          }
        }
      } else {
        // Miss — stop at targetY
        if (laser.y <= laser.targetY) laser.active = false
      }

      if (laser.y < -LASER_H) laser.active = false
    }
    // Cleanup dead lasers
    gs.lasers = gs.lasers.filter(l => l.active)

    // Particles
    gs.particles = gs.particles.filter(p => {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.life -= dt
      return p.life > 0
    })

    // Check alien escape (reached bottom)
    for (const alien of gs.aliens) {
      if (alien.alive && alien.y >= PLAYER_Y - 10) {
        alien.alive = false
        gs.cityHealth = Math.max(0, gs.cityHealth - 1)
        gs.combo = 0
        setDisplayHealth(gs.cityHealth)
        sfxWrong()

        if (gs.cityHealth <= 0) {
          setFinalStats({ score: gs.score, wave: gs.wave, maxCombo: gs.maxCombo })
          if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0 }
          setPhase('game_over')
          return
        }
      }
    }

    // Wave complete check — queue empty AND no alive aliens AND no exploding ones
    if (gs.spawnQueue.length === 0 && gs.aliens.length > 0 &&
        gs.aliens.every(a => !a.alive && a.hitTimer <= 0)) {
      gs.wave++
      gs.waveIntroTimer = 1.6
      setDisplayWave(gs.wave)
      beginWave(gs)
    }

    // ── Mic mode — Pitchforks v1 pattern (THE canonical reference) ──
    // Port from src/components/PitchDefender/Pitchforks.tsx:418-493.
    // Two principles, both learned the hard way:
    //   1. The "match doesn't fire" bug was pitch.isActive flickering between
    //      frames and resetting the lock. Fix: silent/low-confidence frames
    //      preserve the in-progress lock — DO NOTHING.
    //   2. The "false hits" bug was loose tolerance. Fix: 70-cent tolerance,
    //      confidence floor 0.75, ONLY hard-reset on a confidently wrong note.
    //
    // Any-target aim variant: each frame we pick the alive alien with the
    // smallest cents-off, then lock against that one. Switching target aliens
    // resets the lock so build-up doesn't bleed across aliens.
    if (inputMode === 'mic' && isListening) {
      const p = livePitchRef.current
      if (p?.isActive && p.confidence >= MIC_CONFIDENCE_FLOOR && p.frequency > 0) {
        // Find the alive alien with smallest cents-off
        let bestIdx = -1
        let bestCentsOff = Infinity
        for (let i = 0; i < gs.aliens.length; i++) {
          const a = gs.aliens[i]
          if (!a.alive) continue
          const cents = octaveFoldedCents(p.frequency, noteToFreq(a.note))
          if (Math.abs(cents) < Math.abs(bestCentsOff)) {
            bestCentsOff = cents
            bestIdx = i
          }
        }

        if (bestIdx >= 0 && Math.abs(bestCentsOff) <= MIC_TOLERANCE_CENTS) {
          // IN TOLERANCE — start or continue lock against this alien
          if (matchStartRef.current === -1) {
            // post-fire cooldown — do nothing
          } else if (matchTargetIdxRef.current !== bestIdx) {
            // Switching target → reset and re-lock against the new alien
            matchTargetIdxRef.current = bestIdx
            matchStartRef.current = performance.now()
          } else if (matchStartRef.current === 0) {
            matchStartRef.current = performance.now()
            matchTargetIdxRef.current = bestIdx
          }

          // Spotlight follows the locked target (visual feedback)
          if (matchStartRef.current > 0) gs.activeIdx = bestIdx

          if (matchStartRef.current > 0) {
            const held = performance.now() - matchStartRef.current
            const progress = Math.min(1, held / MIC_HOLD_MS)
            gs.chargeProgress = progress * CHARGE_FULL_MS

            if (progress >= 1) {
              const target = gs.aliens[bestIdx]
              matchStartRef.current = -1
              matchTargetIdxRef.current = -1
              gs.chargeProgress = 0
              setTimeout(() => { matchStartRef.current = 0 }, 600)
              processHit(target.note)
            }
          }
        } else {
          // CONFIDENTLY WRONG — singer is voicing a note that doesn't match
          // any alive alien within tolerance. Hard reset.
          if (matchStartRef.current > 0) {
            matchStartRef.current = 0
            matchTargetIdxRef.current = -1
            gs.chargeProgress = 0
          }
        }
      }
      // else: silent or low confidence — DO NOTHING. preserve in-progress lock.
      // (This is the load-bearing flicker fix from Pitchforks v1.)
    }

    // ── Render ──
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, W, H)

    // Stars
    ctx.fillStyle = '#333'
    for (let i = 0; i < 50; i++) {
      const sx = (i * 97 + 13) % W
      const sy = (i * 53 + 7) % (H - 60)
      ctx.fillRect(sx, sy, 1, 1)
    }

    // Wave intro text
    if (gs.waveIntroTimer > 0) {
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 24px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`WAVE ${gs.wave}`, W / 2, H / 2 - 8)
      ctx.fillStyle = '#3FBFB5'
      ctx.font = 'bold 12px monospace'
      const count = gs.alienCountThisWave
      ctx.fillText(`${count} ${count === 1 ? 'ALIEN' : 'ALIENS'}`, W / 2, H / 2 + 10)
    }

    // Aliens
    for (let i = 0; i < gs.aliens.length; i++) {
      const alien = gs.aliens[i]
      if (!alien.alive && alien.hitTimer <= 0) continue

      if (alien.hitTimer > 0) {
        const alpha = alien.hitTimer / 0.4
        ctx.globalAlpha = alpha
        drawSprite(ctx, EXPLOSION_SPRITE, alien.x + 1, alien.y, `hsl(${alien.hue}, 80%, 60%)`, 2)
        ctx.globalAlpha = 1
        continue
      }

      const isActive = i === gs.activeIdx
      const sprite = alien.frame === 0 ? ALIEN_SPRITE_A : ALIEN_SPRITE_B
      const color = isActive
        ? `hsl(${alien.hue}, 95%, 70%)`
        : `hsl(${alien.hue}, 50%, 40%)`

      // Active alien: scaled 1.2x with bobbing motion
      if (isActive) {
        const bob = Math.sin(now / 200) * 3
        const scale = 2.4 // 1.2x relative to inactive (which are at 2)
        const offsetX = (ALIEN_W * 0.2) / 2
        const offsetY = (ALIEN_H * 0.2) / 2

        // Pulsing glow halo
        const pulse = Math.sin(now / 150) * 0.3 + 0.6
        ctx.fillStyle = `hsla(${alien.hue}, 90%, 55%, ${pulse * 0.25})`
        ctx.fillRect(alien.x - 8, alien.y - 8 + bob, ALIEN_W + 16, ALIEN_H + 16)

        drawSprite(ctx, sprite, alien.x - offsetX, alien.y - offsetY + bob, color, scale)

        // Big "?" above
        ctx.fillStyle = '#ffe34c'
        ctx.font = 'bold 20px monospace'
        ctx.textAlign = 'center'
        const qBob = Math.sin(now / 180) * 2
        ctx.fillText('?', alien.x + ALIEN_W / 2, alien.y - 14 + qBob)

        // Pulsing border
        ctx.strokeStyle = `hsla(${alien.hue}, 90%, 65%, ${pulse})`
        ctx.lineWidth = 2
        ctx.strokeRect(alien.x - 6, alien.y - 6 + bob, ALIEN_W + 12 + offsetX * 2, ALIEN_H + 12 + offsetY * 2)
      } else {
        drawSprite(ctx, sprite, alien.x, alien.y, color, 2)
        // Dim note label on inactive aliens
        ctx.fillStyle = `hsla(${alien.hue}, 50%, 55%, 0.6)`
        ctx.font = 'bold 9px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(alien.note.replace(/\d/, ''), alien.x + ALIEN_W / 2, alien.y - 3)
      }
    }

    // Lasers
    for (const laser of gs.lasers) {
      if (!laser.active) continue
      const col = laser.hits ? `hsl(${laser.hue}, 95%, 70%)` : '#ff5555'
      const glow = laser.hits ? `hsla(${laser.hue}, 95%, 80%, 0.4)` : 'rgba(255,80,80,0.4)'
      ctx.fillStyle = col
      ctx.fillRect(laser.x - 1, laser.y, LASER_W, LASER_H)
      ctx.fillStyle = glow
      ctx.fillRect(laser.x - 2, laser.y - 1, LASER_W + 2, LASER_H + 2)
    }

    // Particles
    for (const p of gs.particles) {
      const alpha = Math.max(0, p.life * 2)
      ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${alpha})`
      ctx.fillRect(Math.floor(p.x), Math.floor(p.y), 3, 3)
    }

    // Player ship — cannon-tip glow when mic charge is near full
    if (inputMode === 'mic' && gs.chargeProgress > CHARGE_FULL_MS * 0.7) {
      const chargePct = gs.chargeProgress / CHARGE_FULL_MS
      const glowAlpha = (chargePct - 0.7) / 0.3   // 0..1 from 70%..100%
      // Outer halo
      ctx.fillStyle = `rgba(74,222,128,${glowAlpha * 0.35})`
      ctx.fillRect(gs.playerX - 6, PLAYER_Y - 6, 12, 6)
      // Inner pulse
      const pulse = 0.5 + Math.sin(now / 80) * 0.3
      ctx.fillStyle = `rgba(74,222,128,${glowAlpha * pulse})`
      ctx.fillRect(gs.playerX - 3, PLAYER_Y - 4, 6, 4)
    }
    drawSprite(ctx, PLAYER_SPRITE, gs.playerX - PLAYER_W / 2, PLAYER_Y, '#3FBFB5', 2)

    // HUD bar background
    ctx.fillStyle = 'rgba(0,0,0,0.7)'
    ctx.fillRect(0, 0, W, 24)
    ctx.strokeStyle = '#222'
    ctx.lineWidth = 1
    ctx.strokeRect(0, 0, W, 24)

    // HUD text
    ctx.fillStyle = '#aaa'
    ctx.font = 'bold 14px monospace'
    ctx.textAlign = 'left'
    ctx.fillText(`SCORE ${gs.score}`, 8, 16)
    ctx.textAlign = 'right'
    ctx.fillText(`WAVE ${gs.wave}`, W - 8, 16)
    if (gs.combo >= 3) {
      ctx.fillStyle = gs.combo >= 10 ? '#ff6090' : '#ffc83c'
      ctx.textAlign = 'center'
      ctx.font = 'bold 14px monospace'
      ctx.fillText(`${gs.combo}x COMBO`, W / 2, 16)
    }

    // Shields display (top-left, under HUD)
    ctx.fillStyle = '#888'
    ctx.font = 'bold 9px monospace'
    ctx.textAlign = 'left'
    ctx.fillText('SHIELDS', 8, 36)
    for (let h = 0; h < STARTING_SHIELDS; h++) {
      ctx.fillStyle = h < gs.cityHealth ? '#3FBFB5' : '#222'
      ctx.fillRect(64 + h * 16, 28, 12, 8)
      ctx.strokeStyle = '#3FBFB5'
      ctx.lineWidth = 0.5
      ctx.strokeRect(64 + h * 16, 28, 12, 8)
    }

    // Wrong message (big, center)
    if (gs.wrongMessage && gs.wrongTimer > 0) {
      const fade = Math.min(1, gs.wrongTimer / 0.5)
      ctx.fillStyle = `rgba(0,0,0,${0.7 * fade})`
      ctx.fillRect(0, H / 2 - 24, W, 40)
      ctx.fillStyle = `rgba(255,80,80,${fade})`
      ctx.font = 'bold 14px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(gs.wrongMessage, W / 2, H / 2 + 4)
    }

    // Red flash overlay on wrong
    if (gs.flashTimer > 0) {
      ctx.fillStyle = `rgba(255,0,0,${(gs.flashTimer / 0.4) * 0.3})`
      ctx.fillRect(0, 0, W, H)
    }

    // ── Mic charge slider bar (Pitchforks v1 style) ──
    // Visible only when matchStart > 0 (gated, like Pitchforks v1's bar).
    // Yellow under 80%, green at/above 80%. No note+cents readout, no hint
    // text — Pitchforks v1 doesn't have those. The active alien glow + the
    // cannon-tip glow are the rest of the feedback.
    if (inputMode === 'mic') {
      const pct = Math.min(1, gs.chargeProgress / CHARGE_FULL_MS)
      if (pct > 0) {
        const barY = PLAYER_Y - 12
        const barW = 100
        const barH = 4
        const barX = Math.floor((W - barW) / 2)
        ctx.fillStyle = 'rgba(0,0,0,0.6)'
        ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4)
        ctx.strokeStyle = '#3a3a4a'
        ctx.lineWidth = 1
        ctx.strokeRect(barX - 2, barY - 2, barW + 4, barH + 4)
        const fillColor = pct >= 0.8 ? '#4ade80' : '#fbbf24'
        ctx.fillStyle = fillColor
        ctx.fillRect(barX, barY, barW * pct, barH)
        if (pct > 0.7) {
          ctx.fillStyle = `rgba(74,222,128,${(pct - 0.7) * 0.6})`
          ctx.fillRect(barX - 1, barY - 1, barW * pct + 2, barH + 2)
        }
      }
    }

    // Note buttons at bottom — bigger and clearly labelled
    const unlocked = gs.unlockedNotes
    const btnGap = 4
    const maxBtnW = 50
    const availW = W - 16
    const btnW = Math.min(maxBtnW, Math.floor((availW - (unlocked.length - 1) * btnGap) / unlocked.length))
    const btnH = 22
    const totalBtnW = unlocked.length * btnW + (unlocked.length - 1) * btnGap
    const btnStartX = Math.floor((W - totalBtnW) / 2)
    const btnY = H - 30

    for (let i = 0; i < unlocked.length; i++) {
      const note = unlocked[i]
      const hue = NOTE_COLORS[note]?.hue ?? 0
      const bx = btnStartX + i * (btnW + btnGap)
      const isActive = gs.aliens[gs.activeIdx]?.note === note && gs.aliens[gs.activeIdx]?.alive
      const keyNum = i + 1

      // Button background
      ctx.fillStyle = `hsl(${hue}, 50%, ${isActive ? 35 : 22}%)`
      ctx.fillRect(bx, btnY, btnW, btnH)
      // Border
      ctx.strokeStyle = `hsl(${hue}, 80%, 65%)`
      ctx.lineWidth = isActive ? 2 : 1
      ctx.strokeRect(bx, btnY, btnW, btnH)

      // Note name (top)
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 11px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(note.replace(/\d/, ''), bx + btnW / 2, btnY + 12)
      // Key number (bottom small)
      ctx.fillStyle = '#888'
      ctx.font = 'bold 7px monospace'
      ctx.fillText(`[${keyNum}]`, bx + btnW / 2, btnY + 20)
    }

    rafRef.current = requestAnimationFrame(gameLoop)
  }, [inputMode, isListening, beginWave, processHit, livePitchRef])

  // ─── Canvas click handler (note buttons + replay button) ──────────────
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const gs = stateRef.current
    if (!gs || !canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const scaleX = W / rect.width
    const scaleY = H / rect.height
    const cx = (e.clientX - rect.left) * scaleX
    const cy = (e.clientY - rect.top) * scaleY

    // Note buttons
    const unlocked = gs.unlockedNotes
    const btnGap = 4
    const maxBtnW = 50
    const availW = W - 16
    const btnW = Math.min(maxBtnW, Math.floor((availW - (unlocked.length - 1) * btnGap) / unlocked.length))
    const btnH = 22
    const totalBtnW = unlocked.length * btnW + (unlocked.length - 1) * btnGap
    const btnStartX = Math.floor((W - totalBtnW) / 2)
    const btnY = H - 30

    if (cy >= btnY && cy <= btnY + btnH) {
      for (let i = 0; i < unlocked.length; i++) {
        const bx = btnStartX + i * (btnW + btnGap)
        if (cx >= bx && cx <= bx + btnW) {
          processHit(unlocked[i])
          return
        }
      }
    }
  }, [processHit])

  // Keyboard note input
  useEffect(() => {
    const keyMap: Record<string, string> = {
      '1': 'C4', '2': 'D4', '3': 'E4', '4': 'F4',
      '5': 'G4', '6': 'A4', '7': 'B4', '8': 'C5',
      'c': 'C4', 'd': 'D4', 'e': 'E4', 'f': 'F4',
      'g': 'G4', 'a': 'A4', 'b': 'B4',
    }
    function onKey(ev: KeyboardEvent) {
      const gs = stateRef.current
      if (!gs) return
      // Replay shortcut
      if (ev.key === ' ' || ev.key === 'r' || ev.key === 'R') {
        ev.preventDefault()
        replayActiveNote()
        return
      }
      const note = keyMap[ev.key.toLowerCase()]
      if (note && gs.unlockedNotes.includes(note)) processHit(note)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [processHit, replayActiveNote])

  // Cleanup
  useEffect(() => {
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  // ─── MENU ─────────────────────────────────────────────────────────────
  if (phase === 'menu') {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center px-6"
        style={{ fontFamily: 'monospace' }}>
        <h1 className="text-4xl font-black text-[#3FBFB5] mb-2"
          style={{ textShadow: '0 0 20px rgba(60,191,181,0.5)', letterSpacing: '0.2em' }}>
          RETRO BLASTER
        </h1>
        <p className="text-gray-500 text-xs mb-8 tracking-wider">PIXEL-ART EAR TRAINING</p>

        {/* Input toggle */}
        <div className="flex gap-2 mb-3">
          <button onClick={() => setInputMode('click')}
            className="px-4 py-2 text-xs tracking-wider transition-all"
            style={{
              background: inputMode === 'click' ? '#3FBFB5' : '#111',
              color: inputMode === 'click' ? '#000' : '#555',
              border: `1px solid ${inputMode === 'click' ? '#3FBFB5' : '#333'}`,
            }}>
            KEYBOARD
          </button>
          <button onClick={() => setInputMode('mic')}
            className="px-4 py-2 text-xs tracking-wider transition-all"
            style={{
              background: inputMode === 'mic' ? '#8b5cf6' : '#111',
              color: inputMode === 'mic' ? '#fff' : '#555',
              border: `1px solid ${inputMode === 'mic' ? '#8b5cf6' : '#333'}`,
            }}>
            MICROPHONE
          </button>
        </div>

        {/* Difficulty selector — EASY = gentle training, TRUE = full speed */}
        <div className="flex gap-2 mb-1">
          <button
            onClick={() => {
              setDifficulty('easy')
              try { localStorage.setItem(RETRO_DIFFICULTY_KEY, 'easy') } catch {}
            }}
            className="px-4 py-2 text-xs tracking-wider transition-all"
            style={{
              background: difficulty === 'easy' ? '#7dffb0' : '#111',
              color: difficulty === 'easy' ? '#000' : '#555',
              border: `1px solid ${difficulty === 'easy' ? '#7dffb0' : '#333'}`,
            }}
          >
            EASY
          </button>
          <button
            onClick={() => {
              setDifficulty('true')
              try { localStorage.setItem(RETRO_DIFFICULTY_KEY, 'true') } catch {}
            }}
            className="px-4 py-2 text-xs tracking-wider transition-all"
            style={{
              background: difficulty === 'true' ? '#ff6090' : '#111',
              color: difficulty === 'true' ? '#fff' : '#555',
              border: `1px solid ${difficulty === 'true' ? '#ff6090' : '#333'}`,
            }}
          >
            TRUE PLAY
          </button>
        </div>
        <p className="text-[10px] text-gray-600 mb-6 tracking-wider text-center max-w-xs">
          {difficulty === 'easy'
            ? 'Gentle training — slower descent, fewer aliens, every wave beatable.'
            : 'Full speed — faster ramp, more aliens, harder formations. No mercy.'}
        </p>

        <button onClick={handleInsertCoin}
          className="px-10 py-3 text-lg font-bold tracking-widest transition-all active:scale-95"
          style={{
            background: '#3FBFB5',
            color: '#000',
            border: '2px solid #5dddd3',
            boxShadow: '0 0 24px rgba(60,191,181,0.4)',
          }}>
          INSERT COIN
        </button>

        <button onClick={() => { try { localStorage.removeItem(TUTORIAL_KEY) } catch {}; setPhase('tutorial') }}
          className="mt-4 text-xs text-gray-600 hover:text-gray-400 tracking-wider">
          HOW TO PLAY
        </button>

        <a href="/pitch-defender" className="mt-8 text-xs text-gray-700 hover:text-gray-500 transition-colors tracking-wider">
          ← BACK TO PITCH DEFENDER
        </a>
      </div>
    )
  }

  // ─── TUTORIAL ─────────────────────────────────────────────────────────
  if (phase === 'tutorial') {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center px-6 overflow-y-auto py-8"
        style={{ fontFamily: 'monospace' }}>
        <h2 className="text-3xl font-black text-[#3FBFB5] mb-2"
          style={{ textShadow: '0 0 20px rgba(60,191,181,0.4)', letterSpacing: '0.15em' }}>
          WELCOME TO RETRO BLASTER
        </h2>
        <p className="text-xs text-gray-500 mb-6 tracking-widest">HOW TO PLAY</p>

        <div className="max-w-lg space-y-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="text-2xl">👾</div>
            <div>
              <div className="text-sm text-[#3FBFB5] font-bold">Aliens are descending</div>
              <div className="text-xs text-gray-400">Each alien plays a musical note. The alien with the glowing <span className="text-yellow-300 font-bold">?</span> is your active target.</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="text-2xl">🔊</div>
            <div>
              <div className="text-sm text-yellow-300 font-bold">Listen, then press the matching key</div>
              <div className="text-xs text-gray-400">When the active alien plays its note, hit the matching number key (or click its colored button) to fire your laser. Press <span className="text-white font-bold">SPACE</span> any time to replay the note.</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="text-2xl">⌨️</div>
            <div>
              <div className="text-sm text-purple-300 font-bold">Keyboard layout</div>
              <div className="mt-1 grid grid-cols-8 gap-1 text-center">
                {[
                  { k: '1', n: 'C' }, { k: '2', n: 'D' }, { k: '3', n: 'E' }, { k: '4', n: 'F' },
                  { k: '5', n: 'G' }, { k: '6', n: 'A' }, { k: '7', n: 'B' }, { k: '8', n: 'C' },
                ].map((x) => (
                  <div key={x.k} className="px-2 py-1 border border-cyan-700 rounded">
                    <div className="text-cyan-300 text-sm font-bold">{x.n}</div>
                    <div className="text-gray-500 text-[9px]">[{x.k}]</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="text-2xl">🛡️</div>
            <div>
              <div className="text-sm text-red-300 font-bold">Wrong answers cost a shield</div>
              <div className="text-xs text-gray-400">You start with 5 shields. A wrong key drops one shield AND replays the correct note so you learn it. Lose all 5 = game over.</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="text-2xl">🐢</div>
            <div>
              <div className="text-sm text-gray-300 font-bold">Aliens come one at a time</div>
              <div className="text-xs text-gray-400">Aliens drop in slowly. EASY mode caps how many are on screen so every wave is beatable. TRUE PLAY ramps up faster — try EASY first.</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="text-2xl">🎯</div>
            <div>
              <div className="text-sm text-cyan-300 font-bold">Aim is automatic</div>
              <div className="text-xs text-gray-400">Sing or click ANY alien&apos;s note — the cannon swings to the most-urgent matching alien and fires. The glowing alien is the one to beat.</div>
            </div>
          </div>
        </div>

        <button onClick={finishTutorial}
          className="px-12 py-4 text-lg font-bold tracking-widest transition-all active:scale-95"
          style={{
            background: '#3FBFB5',
            color: '#000',
            border: '2px solid #5dddd3',
            boxShadow: '0 0 24px rgba(60,191,181,0.4)',
          }}>
          START GAME
        </button>

        <button onClick={() => setPhase('menu')}
          className="mt-3 text-xs text-gray-600 hover:text-gray-400 transition-colors">
          ← BACK TO MENU
        </button>
      </div>
    )
  }

  // ─── GAME OVER ────────────────────────────────────────────────────────
  if (phase === 'game_over') {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center px-6"
        style={{ fontFamily: 'monospace' }}>
        <div className="text-4xl font-black text-red-500 mb-4 tracking-widest"
          style={{ textShadow: '0 0 20px rgba(255,60,60,0.4)' }}>
          GAME OVER
        </div>
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="text-center">
            <div className="text-xs text-gray-600">SCORE</div>
            <div className="text-2xl text-white font-bold">{finalStats.score}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600">WAVE</div>
            <div className="text-2xl text-[#3FBFB5] font-bold">{finalStats.wave}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600">MAX COMBO</div>
            <div className="text-2xl text-purple-400 font-bold">{finalStats.maxCombo}</div>
          </div>
        </div>
        <div className="flex gap-4">
          <button onClick={startGame}
            className="px-6 py-2 text-sm font-bold tracking-widest active:scale-95 transition-all"
            style={{ background: '#3FBFB5', color: '#000', border: '2px solid #5dddd3' }}>
            CONTINUE?
          </button>
          <button onClick={() => setPhase('menu')}
            className="px-6 py-2 text-sm text-gray-500 border border-gray-700 tracking-wider active:scale-95 transition-all">
            MENU
          </button>
        </div>
      </div>
    )
  }

  // ─── PLAYING ──────────────────────────────────────────────────────────
  const activeAlien = stateRef.current?.aliens[stateRef.current.activeIdx]
  const activeNoteName = activeAlien?.alive ? activeAlien.note.replace(/\d/, '') : null

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-start pt-3 px-3"
      style={{ fontFamily: 'monospace' }}>

      {/* Top instructions bar (HTML, not in canvas) */}
      <div className="w-full max-w-[960px] mb-2 text-center">
        <div className="text-[11px] text-cyan-300 tracking-wider mb-1">
          LISTEN FOR THE NOTE → PRESS THE MATCHING KEY (or click its button)
        </div>
        <div className="flex justify-center gap-2 flex-wrap text-[10px]">
          {displayUnlocked.map((note, i) => {
            const hue = NOTE_COLORS[note]?.hue ?? 0
            const isActiveNote = activeNoteName === note.replace(/\d/, '')
            return (
              <span key={note}
                className="px-2 py-0.5 rounded border"
                style={{
                  borderColor: `hsl(${hue}, 70%, 55%)`,
                  background: isActiveNote ? `hsla(${hue}, 70%, 35%, 0.6)` : 'transparent',
                  color: `hsl(${hue}, 90%, 75%)`,
                  fontWeight: isActiveNote ? 700 : 400,
                }}>
                {note.replace(/\d/, '')}={i + 1}
              </span>
            )
          })}
        </div>
        <div className="text-[10px] text-gray-500 mt-1">
          Active alien is highlighted with <span className="text-yellow-300 font-bold">?</span> · SPACE to replay note
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onClick={handleCanvasClick}
        className="w-full max-w-[960px]"
        style={{
          imageRendering: 'pixelated',
          cursor: 'pointer',
          aspectRatio: `${W} / ${H}`,
          maxHeight: 'calc(100vh - 180px)',
        }}
      />

      {/* Replay button + quit */}
      <div className="mt-3 flex gap-3">
        <button onClick={replayActiveNote}
          className="px-4 py-2 text-xs font-bold tracking-widest active:scale-95 transition-all"
          style={{
            background: 'rgba(255,227,76,0.15)',
            color: '#ffe34c',
            border: '1px solid #ffe34c',
          }}>
          🔊 PLAY NOTE [SPACE]
        </button>
        <button onClick={() => {
          if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0 }
          if (inputMode === 'mic') stopListening()
          setPhase('menu')
        }} className="px-4 py-2 text-xs text-gray-500 border border-gray-700 tracking-wider active:scale-95">
          QUIT
        </button>
      </div>

      {/* Suppress lint: displayScore/Wave/Combo/Health used implicitly via re-render */}
      <div className="hidden">{displayScore}{displayWave}{displayCombo}{displayHealth}</div>
    </div>
  )
}
