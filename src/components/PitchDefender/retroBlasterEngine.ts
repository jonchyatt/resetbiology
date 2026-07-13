import { NOTE_COLORS, currentR, type NoteMemory } from '../../lib/fsrs'
import { INTRO_ORDER, UNLOCK_THRESHOLDS } from './types'
import { noteToFreq, octaveFoldedCents } from './pitchMath'

// Pure engine extraction from RetroBlaster v1. R0 changes only the view seam.

export const W = 480
export const H = 320
export const ALIEN_W = 24
export const ALIEN_H = 18
export const PLAYER_W = 28
export const PLAYER_H = 14
export const LASER_W = 3
export const LASER_H = 12
export const LASER_SPEED = 480
export const NOTE_BUTTONS_Y = 290
export const PLAYER_Y = 270
export const INITIAL_UNLOCK = 4
export const STARTING_SHIELDS = 5
export const MIC_HOLD_MS = 300
export const MIC_TOLERANCE_CENTS = 70
export const MIC_CONFIDENCE_FLOOR = 0.75
export const CHARGE_FULL_MS = MIC_HOLD_MS

export type InputMode = 'click' | 'mic'
export type Phase = 'menu' | 'tutorial' | 'playing' | 'game_over'

export interface Alien {
  x: number
  y: number
  note: string
  hue: number
  alive: boolean
  frame: number
  hitTimer: number
}

export interface Laser {
  x: number
  y: number
  hue: number
  active: boolean
  hits: boolean
  targetY: number
  targetIdx: number
}

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  hue: number
}

export type Difficulty = 'easy' | 'true'

export interface WaveParams {
  alienCount: number
  maxConcurrent: number
  descentSpeed: number
  spawnInterval: number
}

export interface EnginePitch {
  note: string
  frequency: number
  cents: number
  confidence: number
  isActive: boolean
}

export interface EngineInput {
  inputMode: InputMode
  isListening: boolean
  pitch: EnginePitch | null
  answeredNote?: string | null
  latencyMs?: number
  fsrs?: Record<string, NoteMemory>
}

export type EngineEvent =
  | { kind: 'grade'; note: string; correct: boolean; latencyMs: number }
  | { kind: 'sfx'; name: 'shoot' | 'wrong' | 'explosion' }
  | { kind: 'playNote'; note: string; delayMs: number; guard: 'alive' | 'spotlight' | 'none'; targetIdx: number }
  | { kind: 'unlock'; note: string }
  | { kind: 'spawn'; note: string; x: number }
  | { kind: 'waveComplete' }
  | { kind: 'gameOver' }

export interface GameState {
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
  flashTimer: number
  wrongMessage: string
  wrongTimer: number
  chargeProgress: number
  difficulty: Difficulty
  spawnQueue: string[]
  spawnedThisWave: number
  alienCountThisWave: number
  nextSpawnAt: number
  lastProgressAt: number
  hintCount: number
  phase: Phase
  clockMs: number
  matchStartAt: number
  matchTargetIdx: number
  micCooldownMs: number
  answerCooldownMs: number
}

export interface ViewState {
  aliens: Alien[]
  lasers: Laser[]
  particles: Particle[]
  playerX: number
  charge: { fraction: number; targetNote: string | null }
  hud: {
    score: number
    combo: number
    wave: number
    shields: number
    unlockedNotes: string[]
  }
  phase: Phase
  inputMode: InputMode
  waveIntroTimer: number
  alienCountThisWave: number
  flashTimer: number
  wrongMessage: string
  wrongTimer: number
  spotlightIdx: number
  nowMs: number
  noteButtons: Array<{ note: string; hue: number; active: boolean; keyNum: number }>
}

export interface TickResult {
  state: GameState
  viewState: ViewState
  events: EngineEvent[]
}

export function noteClass(name: string): string {
  return name.replace(/\d+$/, '')
}

export function pickTargetForNote(aliens: Alien[], answeredNote: string, playerX: number): { alien: Alien; index: number } | null {
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

export function pickSpotlightIdx(aliens: Alien[], playerX: number): number {
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

export function shuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr]
  let s = seed
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) % 0x100000000
    const j = Math.floor((s / 0x100000000) * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function waveParams(wave: number, difficulty: Difficulty): WaveParams {
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

export const SPAWN_LANES_X = [W * 0.14, W * 0.30, W * 0.46, W * 0.62, W * 0.86]
export const SPAWN_Y = 70
export const SPAWN_LANE_GAP = 16

export function pickSpawnX(aliens: Alien[], laneOrderSeed: number): number | null {
  // Score each lane by topmost alien y (or H if empty). Higher score = more room.
  // Randomize the iteration order for visual variety so equal-score lanes don't always win the same way.
  const order = shuffle([0, 1, 2, 3, 4], laneOrderSeed)
  let bestLane = -1
  let bestY = -Infinity
  for (const i of order) {
    const lx = SPAWN_LANES_X[i]
    let topY = H
    for (const a of aliens) {
      if (!a.alive) continue
      if (Math.abs(a.x + ALIEN_W / 2 - lx) < ALIEN_W) {
        if (a.y < topY) topY = a.y
      }
    }
    if (topY < SPAWN_Y + ALIEN_H + SPAWN_LANE_GAP) continue
    if (topY > bestY) { bestY = topY; bestLane = i }
  }
  if (bestLane < 0) return null
  return Math.floor(SPAWN_LANES_X[bestLane] - ALIEN_W / 2)
}

export function buildWaveQueue(gs: GameState, fsrs: Record<string, NoteMemory>): void {
  const params = waveParams(gs.wave, gs.difficulty)
  const pool = gs.unlockedNotes
  const count = params.alienCount

  const must: string[] = count >= pool.length ? [...pool] : []
  const remaining = Math.max(0, count - must.length)

  const weights = pool.map(n => {
    const m = fsrs[n]
    const r = m ? currentR(m) : 0
    return Math.max(0.2, 1.2 - r)
  })
  const totalWeight = weights.reduce((a, b) => a + b, 0)

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

  const combined = shuffle([...must, ...sampled], gs.wave * 104729)
  for (let i = 2; i < combined.length; i++) {
    if (combined[i] === combined[i - 1] && combined[i] === combined[i - 2]) {
      const alt = pool.find(p => p !== combined[i])
      if (alt) combined[i] = alt
    }
  }

  gs.spawnQueue = combined
  gs.spawnedThisWave = 0
  gs.alienCountThisWave = combined.length
  gs.nextSpawnAt = gs.clockMs + (gs.waveIntroTimer * 1000) + 600
}

export function createInitialState(
  difficulty: Difficulty,
  unlockedNotes: string[],
  clockMs = 1,
): GameState {
  return {
    aliens: [], lasers: [], particles: [], playerX: W / 2,
    score: 0, combo: 0, maxCombo: 0, wave: 1,
    cityHealth: STARTING_SHIELDS, activeIdx: -1,
    unlockedNotes: [...unlockedNotes], consecutiveCorrect: 0,
    selectedNote: null, waveIntroTimer: 1.5, flashTimer: 0,
    wrongMessage: '', wrongTimer: 0, chargeProgress: 0, difficulty,
    spawnQueue: [], spawnedThisWave: 0, alienCountThisWave: 0,
    nextSpawnAt: 0, lastProgressAt: 0, hintCount: 0,
    phase: 'playing', clockMs, matchStartAt: 0, matchTargetIdx: -1,
    micCooldownMs: 0, answerCooldownMs: 0,
  }
}

export function beginWave(gs: GameState, fsrs: Record<string, NoteMemory>): void {
  gs.aliens = []
  gs.activeIdx = -1
  gs.chargeProgress = 0
  gs.matchStartAt = 0
  gs.matchTargetIdx = -1
  gs.micCooldownMs = 0
  gs.lastProgressAt = gs.clockMs
  gs.hintCount = 0
  buildWaveQueue(gs, fsrs)
}

function cloneState(state: GameState): GameState {
  return {
    ...state,
    aliens: state.aliens.map(a => ({ ...a })),
    lasers: state.lasers.map(l => ({ ...l })),
    particles: state.particles.map(p => ({ ...p })),
    unlockedNotes: [...state.unlockedNotes],
    spawnQueue: [...state.spawnQueue],
  }
}

export function toViewState(gs: GameState, inputMode: InputMode): ViewState {
  const target = gs.matchTargetIdx >= 0 ? gs.aliens[gs.matchTargetIdx] : null
  return {
    aliens: gs.aliens.map(a => ({ ...a })),
    lasers: gs.lasers.map(l => ({ ...l })),
    particles: gs.particles.map(p => ({ ...p })),
    playerX: gs.playerX,
    charge: {
      fraction: Math.min(1, gs.chargeProgress / CHARGE_FULL_MS),
      targetNote: target?.alive ? target.note : null,
    },
    hud: {
      score: gs.score, combo: gs.combo, wave: gs.wave,
      shields: gs.cityHealth, unlockedNotes: [...gs.unlockedNotes],
    },
    phase: gs.phase,
    inputMode,
    waveIntroTimer: gs.waveIntroTimer,
    alienCountThisWave: gs.alienCountThisWave,
    flashTimer: gs.flashTimer,
    wrongMessage: gs.wrongMessage,
    wrongTimer: gs.wrongTimer,
    spotlightIdx: gs.activeIdx,
    nowMs: gs.clockMs,
    noteButtons: gs.unlockedNotes.map((note, i) => ({
      note,
      hue: NOTE_COLORS[note]?.hue ?? 0,
      active: gs.aliens[gs.activeIdx]?.note === note && Boolean(gs.aliens[gs.activeIdx]?.alive),
      keyNum: i + 1,
    })),
  }
}

function processHit(gs: GameState, answeredNote: string, latencyMs: number, events: EngineEvent[]): void {
  if (gs.answerCooldownMs > 0 || gs.phase !== 'playing') return
  gs.lastProgressAt = gs.clockMs

  const pick = pickTargetForNote(gs.aliens, answeredNote, gs.playerX)
  if (pick) {
    const { alien: target, index: targetIdx } = pick
    events.push({ kind: 'grade', note: target.note, correct: true, latencyMs })
    events.push({ kind: 'sfx', name: 'shoot' })
    const aimX = target.x + ALIEN_W / 2
    gs.playerX = aimX
    gs.lasers.push({
      x: aimX, y: PLAYER_Y, hue: target.hue, active: true,
      hits: true, targetY: target.y + ALIEN_H / 2, targetIdx,
    })
    gs.combo++
    gs.maxCombo = Math.max(gs.maxCombo, gs.combo)
    const mult = gs.combo >= 10 ? 3 : gs.combo >= 5 ? 2 : 1
    gs.score += 100 * mult
    gs.consecutiveCorrect++

    const poolSize = gs.unlockedNotes.length
    const threshold = UNLOCK_THRESHOLDS[poolSize]
    if (threshold && gs.consecutiveCorrect >= threshold && poolSize < INTRO_ORDER.length) {
      const newNote = INTRO_ORDER[poolSize]
      gs.unlockedNotes = [...gs.unlockedNotes, newNote]
      gs.consecutiveCorrect = 0
      events.push({ kind: 'unlock', note: newNote })
    }
    gs.answerCooldownMs = 150
  } else {
    events.push({ kind: 'sfx', name: 'wrong' })
    gs.combo = 0
    gs.consecutiveCorrect = 0
    gs.cityHealth = Math.max(0, gs.cityHealth - 1)
    gs.flashTimer = 0.4
    const spotlight = gs.aliens[gs.activeIdx]
    if (spotlight?.alive) {
      const correctName = NOTE_COLORS[spotlight.note]?.name ?? spotlight.note
      gs.wrongMessage = `WRONG! Try ${spotlight.note.replace(/\d/, '')} (${correctName})`
      gs.wrongTimer = 1.8
      const aimX = spotlight.x + ALIEN_W / 2
      gs.playerX = aimX
      gs.lasers.push({
        x: aimX, y: PLAYER_Y, hue: 0, active: true,
        hits: false, targetY: spotlight.y + ALIEN_H + 30, targetIdx: -1,
      })
      events.push({ kind: 'playNote', note: spotlight.note, delayMs: 350, guard: 'alive', targetIdx: gs.activeIdx })
    } else {
      gs.wrongMessage = 'WRONG!'
      gs.wrongTimer = 1.0
    }
    if (gs.cityHealth <= 0) {
      gs.phase = 'game_over'
      events.push({ kind: 'gameOver' })
    }
  }
}

export function tick(state: GameState, input: EngineInput, dtMs: number, rng: () => number): TickResult {
  const gs = cloneState(state)
  const events: EngineEvent[] = []
  const elapsedMs = Math.max(0, dtMs)
  const dt = Math.min(elapsedMs / 1000, 0.05)
  gs.clockMs += elapsedMs
  gs.answerCooldownMs = Math.max(0, gs.answerCooldownMs - elapsedMs)
  gs.micCooldownMs = Math.max(0, gs.micCooldownMs - elapsedMs)
  if (gs.micCooldownMs === 0 && gs.matchStartAt === -1) gs.matchStartAt = 0

  if (gs.phase !== 'playing') return { state: gs, viewState: toViewState(gs, input.inputMode), events }

  if (gs.waveIntroTimer > 0) gs.waveIntroTimer -= dt
  if (gs.flashTimer > 0) gs.flashTimer -= dt
  if (gs.wrongTimer > 0) {
    gs.wrongTimer -= dt
    if (gs.wrongTimer <= 0) gs.wrongMessage = ''
  }

  const params = waveParams(gs.wave, gs.difficulty)
  if (gs.spawnQueue.length > 0 && gs.waveIntroTimer <= 0 && gs.clockMs >= gs.nextSpawnAt) {
    const aliveCount = gs.aliens.filter(a => a.alive).length
    if (aliveCount < params.maxConcurrent) {
      const x = pickSpawnX(gs.aliens, gs.wave * 31 + gs.spawnedThisWave)
      if (x !== null) {
        const note = gs.spawnQueue.shift()!
        const colorInfo = NOTE_COLORS[note]
        gs.aliens.push({
          x, y: SPAWN_Y, note, hue: colorInfo?.hue ?? 0, alive: true,
          frame: gs.spawnedThisWave % 2, hitTimer: 0,
        })
        gs.spawnedThisWave++
        gs.nextSpawnAt = gs.clockMs + params.spawnInterval
        events.push({ kind: 'spawn', note, x })
        if (gs.spawnedThisWave === 1) {
          gs.activeIdx = gs.aliens.length - 1
          events.push({ kind: 'playNote', note, delayMs: 200, guard: 'alive', targetIdx: gs.activeIdx })
        }
      }
    }
  }

  if (gs.difficulty === 'easy' && gs.clockMs - gs.lastProgressAt > 60000) {
    const spotlight = gs.aliens[gs.activeIdx]
    if (spotlight?.alive) {
      events.push({ kind: 'playNote', note: spotlight.note, delayMs: 0, guard: 'alive', targetIdx: gs.activeIdx })
      gs.wrongMessage = `Hint: try ${spotlight.note.replace(/\d/, '')}`
      gs.wrongTimer = 2.5
      gs.hintCount++
    }
    gs.lastProgressAt = gs.clockMs
  }

  const speed = params.descentSpeed
  for (const alien of gs.aliens) {
    if (!alien.alive && alien.hitTimer <= 0) continue
    if (alien.hitTimer > 0) {
      alien.hitTimer -= dt
      continue
    }
    if (gs.waveIntroTimer <= 0) alien.y += speed * dt
  }

  for (const alien of gs.aliens) {
    if (alien.alive) alien.frame = Math.floor(gs.clockMs / 500) % 2
  }

  for (const laser of gs.lasers) {
    if (!laser.active) continue
    laser.y -= LASER_SPEED * dt
    if (laser.hits) {
      const target = gs.aliens[laser.targetIdx]
      if (target?.alive && laser.y <= target.y + ALIEN_H &&
          laser.x >= target.x - 4 && laser.x <= target.x + ALIEN_W + 4) {
        events.push({ kind: 'sfx', name: 'explosion' })
        target.alive = false
        target.hitTimer = 0.4
        laser.active = false
        for (let i = 0; i < 12; i++) {
          const angle = (i / 12) * Math.PI * 2
          gs.particles.push({
            x: target.x + ALIEN_W / 2,
            y: target.y + ALIEN_H / 2,
            vx: Math.cos(angle) * (40 + rng() * 60),
            vy: Math.sin(angle) * (40 + rng() * 60),
            life: 0.5 + rng() * 0.4,
            hue: target.hue,
          })
        }
        const nextIdx = pickSpotlightIdx(gs.aliens, gs.playerX)
        gs.activeIdx = nextIdx
        if (nextIdx >= 0) {
          events.push({ kind: 'playNote', note: gs.aliens[nextIdx].note, delayMs: 350, guard: 'spotlight', targetIdx: nextIdx })
        }
      }
    } else if (laser.y <= laser.targetY) {
      laser.active = false
    }
    if (laser.y < -LASER_H) laser.active = false
  }
  gs.lasers = gs.lasers.filter(l => l.active)

  gs.particles = gs.particles.filter(p => {
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.life -= dt
    return p.life > 0
  })

  for (const alien of gs.aliens) {
    if (alien.alive && alien.y >= PLAYER_Y - 10) {
      alien.alive = false
      gs.cityHealth = Math.max(0, gs.cityHealth - 1)
      gs.combo = 0
      events.push({ kind: 'sfx', name: 'wrong' })
      if (gs.cityHealth <= 0) {
        gs.phase = 'game_over'
        events.push({ kind: 'gameOver' })
        break
      }
    }
  }

  if (gs.phase === 'playing' && gs.spawnQueue.length === 0 && gs.aliens.length > 0 &&
      gs.aliens.every(a => !a.alive && a.hitTimer <= 0)) {
    gs.wave++
    gs.waveIntroTimer = 1.6
    beginWave(gs, input.fsrs ?? {})
    events.push({ kind: 'waveComplete' })
  }

  if (input.answeredNote) processHit(gs, input.answeredNote, input.latencyMs ?? 2000, events)

  if (gs.phase === 'playing' && input.inputMode === 'mic' && input.isListening) {
    const p = input.pitch
    if (p?.isActive && p.confidence >= MIC_CONFIDENCE_FLOOR && p.frequency > 0) {
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
        if (gs.matchStartAt === -1) {
          // post-fire cooldown — do nothing
        } else if (gs.matchTargetIdx !== bestIdx) {
          gs.matchTargetIdx = bestIdx
          gs.matchStartAt = gs.clockMs
        } else if (gs.matchStartAt === 0) {
          gs.matchStartAt = gs.clockMs
          gs.matchTargetIdx = bestIdx
        }
        if (gs.matchStartAt > 0) gs.activeIdx = bestIdx
        if (gs.matchStartAt > 0) {
          const held = gs.clockMs - gs.matchStartAt
          const progress = Math.min(1, held / MIC_HOLD_MS)
          gs.chargeProgress = progress * CHARGE_FULL_MS
          if (progress >= 1) {
            const target = gs.aliens[bestIdx]
            gs.matchStartAt = -1
            gs.matchTargetIdx = -1
            gs.micCooldownMs = 600
            gs.chargeProgress = 0
            processHit(gs, target.note, input.latencyMs ?? 2000, events)
          }
        }
      } else if (gs.matchStartAt > 0) {
        gs.matchStartAt = 0
        gs.matchTargetIdx = -1
        gs.chargeProgress = 0
      }
    }
    // Silent or low confidence: preserve the in-progress lock.
  }

  return { state: gs, viewState: toViewState(gs, input.inputMode), events }
}
