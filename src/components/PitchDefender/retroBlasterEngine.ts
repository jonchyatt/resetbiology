import { NOTE_COLORS, retrievability, type NoteMemory } from '../../lib/fsrs'
import { INTRO_ORDER, UNLOCK_THRESHOLDS } from './types'
import { noteToFreq, octaveFoldedCents } from './pitchMath'

// Pure engine extraction from RetroBlaster v1. R0 changes only the view seam.

export const BASE_W = 480
export const BASE_H = 320
export const W = 640
export const H = 360
export const SPACE_SCALE = H / BASE_H
export const ALIEN_W = 24 * SPACE_SCALE
export const ALIEN_H = 18 * SPACE_SCALE
export const PLAYER_W = 28 * SPACE_SCALE
export const PLAYER_H = 14 * SPACE_SCALE
export const LASER_W = 3 * SPACE_SCALE
export const LASER_H = 12 * SPACE_SCALE
export const LASER_SPEED = 480 * SPACE_SCALE
export const NOTE_BUTTONS_Y = 290 * SPACE_SCALE
export const PLAYER_Y = 270 * SPACE_SCALE
export const INITIAL_UNLOCK = 4
export const STARTING_SHIELDS = 5
export const MIC_HOLD_MS = 300
export const MIC_TOLERANCE_CENTS = 70
export const MIC_CONFIDENCE_FLOOR = 0.75
export const CHARGE_FULL_MS = MIC_HOLD_MS
export const MAX_SIM_STEP_MS = 50
export const INTRODUCTION_DURATION_MS = 2400

export const FORMATION_COLUMNS = 5
export const FORMATION_ROWS = 3
export const FORMATION_SLOT_COUNT = FORMATION_COLUMNS * FORMATION_ROWS
export const FORMATION_CENTER_X = W / 2 - ALIEN_W / 2
export const FORMATION_TOP_Y = 68 * SPACE_SCALE
export const FORMATION_PITCH_X = 80 * SPACE_SCALE
export const FORMATION_PITCH_Y = 60 * SPACE_SCALE
export const FORMATION_BREATH_PERIOD_MS = 2400
export const FORMATION_BREATH_X = 2 * SPACE_SCALE
export const FORMATION_BREATH_Y = 3 * SPACE_SCALE
export const DIVE_TELEGRAPH_MS = 350
export const DIVE_OUTBOUND_MS = 1250
export const DIVE_RESPONSE_DEADLINE_MS = 2000
export const DIVE_RETURN_MS = 1000
export const HIT_LOCK_MAX_MS = 450
export const POST_RESOLUTION_FLOOR_MS = 500
export const NO_ELIGIBLE_RETRY_MS = 250
export const DIVE_ATTACK_Y = 206 * SPACE_SCALE
export const DIVE_CHANNEL_X = 40 * SPACE_SCALE
export const DIVE_KNEE_X = 32 * SPACE_SCALE
export const DIVE_KNEE_Y = 14 * SPACE_SCALE
export const DIVE_CLEAR_Y = 28 * SPACE_SCALE
export const ENGINE_DEMAND_FLOOR_MS: Record<Difficulty, number> = { easy: 1101, true: 800 }
export const FORMATION_SLOT_ORDER = [
  [2, 0], [1, 0], [3, 0], [0, 0], [4, 0],
  [2, 1], [1, 1], [3, 1], [0, 1], [4, 1],
  [2, 2], [1, 2], [3, 2], [0, 2], [4, 2],
] as const

const LETTER_KEY_NOTES: Record<string, string> = {
  c: 'C4', d: 'D4', e: 'E4', f: 'F4', g: 'G4', a: 'A4', b: 'B4',
}

export function noteForKeyboardInput(key: string, unlockedNotes: readonly string[]): string | undefined {
  const digitIndex = /^[1-8]$/.test(key) ? Number(key) - 1 : -1
  return digitIndex >= 0 ? unlockedNotes[digitIndex] : LETTER_KEY_NOTES[key.toLowerCase()]
}

export function formationAnchor(slot: number): { x: number; y: number } {
  const cell = FORMATION_SLOT_ORDER[slot]
  // ponytail: Act I is deliberately capped at 15 authored slots; Act-II roster
  // growth must replace this table through a re-consulted geometry contract.
  if (!cell) throw new RangeError(`Retro Blaster formation slot ${slot} exceeds ${FORMATION_SLOT_COUNT}`)
  const [column, row] = cell
  return {
    x: FORMATION_CENTER_X + (column - 2) * FORMATION_PITCH_X,
    y: FORMATION_TOP_Y + row * FORMATION_PITCH_Y,
  }
}

export function formationPose(
  formationX: number,
  formationY: number,
  directorClockMs: number,
  reducedMotion: boolean,
): { x: number; y: number } {
  if (reducedMotion) return { x: formationX, y: formationY }
  const phase = (directorClockMs % FORMATION_BREATH_PERIOD_MS) /
    FORMATION_BREATH_PERIOD_MS * Math.PI * 2
  const offset = Math.sin(phase)
  return {
    x: formationX + offset * FORMATION_BREATH_X,
    y: formationY + offset * FORMATION_BREATH_Y,
  }
}

function smoothstep(value: number): number {
  const t = Math.max(0, Math.min(1, value))
  return t * t * (3 - 2 * t)
}

function segmentValue(
  u: number,
  startU: number,
  endU: number,
  startValue: number,
  endValue: number,
): number {
  if (u <= startU) return startValue
  if (u >= endU) return endValue
  const q = smoothstep((u - startU) / (endU - startU))
  return startValue + (endValue - startValue) * q
}

export function divePose(
  formationX: number,
  formationY: number,
  normalizedT: number,
  side: -1 | 1,
): { x: number; y: number } {
  const u = Math.max(0, Math.min(1, normalizedT))
  const distanceY = DIVE_ATTACK_Y - formationY
  const points = [
    { u: 0, dx: 0, dy: 0 },
    { u: 0.28, dx: DIVE_KNEE_X, dy: DIVE_KNEE_Y },
    { u: 0.40, dx: DIVE_CHANNEL_X, dy: Math.min(DIVE_CLEAR_Y, distanceY) },
    { u: 1, dx: DIVE_CHANNEL_X, dy: distanceY },
  ]
  let index = 0
  while (index < points.length - 2 && u > points[index + 1].u) index++
  const start = points[index]
  const end = points[index + 1]
  return {
    x: formationX + side * segmentValue(u, start.u, end.u, start.dx, end.dx),
    y: formationY + segmentValue(u, start.u, end.u, start.dy, end.dy),
  }
}

export interface NoteButtonRect {
  x: number
  y: number
  width: number
  height: number
}

export function noteButtonRects(noteCount: number, width = W, height = H): NoteButtonRect[] {
  if (noteCount <= 0) return []
  const scale = height / BASE_H
  const gap = 4 * scale
  const maxWidth = 50 * scale
  const availableWidth = width - 16 * scale
  const buttonWidth = Math.min(
    maxWidth,
    Math.floor((availableWidth - (noteCount - 1) * gap) / noteCount),
  )
  const buttonHeight = 22 * scale
  const totalWidth = noteCount * buttonWidth + (noteCount - 1) * gap
  const startX = (width - totalWidth) / 2
  const y = 290 * scale
  return Array.from({ length: noteCount }, (_, index) => ({
    x: startX + index * (buttonWidth + gap),
    y,
    width: buttonWidth,
    height: buttonHeight,
  }))
}

export type InputMode = 'click' | 'mic'
export type Phase = 'menu' | 'tutorial' | 'playing' | 'ceremony' | 'game_over'
export type VisualKind = 0 | 1 | 2 | 3
export const VISUAL_KIND_COUNT = 4

export interface NoteSoulSnapshot {
  note: string
  r: number
  calm: number
  due: boolean
  agitation: number
  divePressure: number
}

export interface WaveMemoryObservation {
  epochMs: number
  store: Readonly<Record<string, NoteMemory>>
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

export function snapshotNoteSoul(
  note: string,
  memory: NoteMemory | undefined,
  epochMs: number,
): NoteSoulSnapshot {
  const unreviewed = !memory || memory.phase === 'new' || memory.lastReview === 0
  const elapsedDays = memory
    ? Math.max(0, epochMs - memory.lastReview) / 86_400_000
    : 0
  const r = unreviewed ? 0.95 : clamp01(retrievability(elapsedDays, memory.S))
  const calm = memory && memory.S > 0 ? clamp01(retrievability(1, memory.S)) : 0
  const due = !memory || memory.due <= epochMs
  const agitation = 1 - r
  return {
    note,
    r,
    calm,
    due,
    agitation,
    divePressure: Number(due) + agitation + (1 - calm),
  }
}

export interface Alien {
  /** Functional identity for attack ownership. */
  alienId: string
  /** Cosmetic-only identity. It never participates in grading, targeting, or pacing. */
  visualId: string
  visualKind: VisualKind
  x: number
  y: number
  entering: boolean
  entryT: number
  entryTargetX: number
  formationSlot: number
  formationX: number
  formationY: number
  note: string
  hue: number
  soul: NoteSoulSnapshot
  diveServiceCount: number
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
  targetAlienId: string | null
  attackId: string | null
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
export type AttackPhase = 'telegraph' | 'outbound' | 'hit-locked' | 'returning'
export type AttackOutcome = 'correct' | 'wrong' | 'timeout' | 'death' | 'cancelled'

export interface ActiveAttack {
  readonly attackId: string
  readonly alienId: string
  readonly note: string
  readonly side: -1 | 1
  phase: AttackPhase
  telegraphStartedAtMs: number
  demandAtMs: number | null
  deadlineAtMs: number | null
  outboundT: number
  returnFromT: number
  returnStartedAtMs: number | null
  outcome: AttackOutcome | null
  resolvedAtMs: number | null
  voiceWindowEligible: boolean | null
  voiceHeardPhonation: boolean
}

export interface PendingAttackAnswer {
  note: string
  inputMode: 'click'
  gameId: string
  alienId: string
  attackId: string
}

export interface WavePacingReceipt {
  difficulty: Difficulty
  wave: number
  waveStartedAtMs: number
  waveEndedAtMs: number
  waveDurationMs: number
  requiredAnswerEventsMs: number[]
}

export type CeremonyToneStatus = 'pending' | 'acknowledged' | 'blocked'

export interface IntroductionCeremony {
  readonly ceremonyId: string
  readonly note: string
  elapsedMs: number
  readonly durationMs: typeof INTRODUCTION_DURATION_MS
  toneStatus: CeremonyToneStatus
}

export interface CeremonyToneAck {
  readonly ceremonyId: string
  readonly note: string
  readonly dispatched: boolean
}

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
  reducedMotion: boolean
  pitch: EnginePitch | null
  pendingAnswer?: PendingAttackAnswer | null
  latencyMs?: number
  fsrs?: Record<string, NoteMemory>
  isActive?: boolean
  memoryEpochMs?: number
  voiceTimeoutObservation?: Readonly<{ healthy: boolean; heard: boolean }>
  ceremonyToneAck?: CeremonyToneAck | null
}

export type EngineEvent =
  | { kind: 'grade'; note: string; correct: boolean; latencyMs: number; inputMode: InputMode }
  | { kind: 'sfx'; name: 'shoot' | 'wrong' | 'explosion' }
  | { kind: 'playNote'; note: string; delayMs: number; guard: 'attack' | 'none'; targetAlienId: string; attackId: string | null }
  | { kind: 'unlock'; note: string; inputMode: InputMode }
  | { kind: 'spawn'; note: string; x: number }
  | { kind: 'waveComplete' }
  | { kind: 'ceremonyToneRequest'; ceremonyId: string; note: string }
  | { kind: 'gameOver' }

export interface GameState {
  gameId: string
  aliens: Alien[]
  lasers: Laser[]
  particles: Particle[]
  playerX: number
  score: number
  combo: number
  maxCombo: number
  wave: number
  cityHealth: number
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
  directorClockMs: number
  matchStartAt: number
  matchTargetAlienId: string | null
  micCooldownMs: number
  answerCooldownMs: number
  nextAttackSerial: number
  activeAttack: ActiveAttack | null
  nextAttackAtMs: number
  directorCursorSlot: number
  lastDemandAtMs: number | null
  requiredAnswerEventsMs: number[]
  waveStartedAtMs: number
  lastCompletedWavePacing: WavePacingReceipt | null
  waveSoulByNote: Record<string, NoteSoulSnapshot>
  rosterServiceCount: Record<string, number>
  pendingIntroductions: string[]
  introductionCeremony: IntroductionCeremony | null
  nextCeremonySerial: number
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
  activeAttack: ActiveAttack | null
  requiredAnswerEventsMs: number[]
  lastCompletedWavePacing: WavePacingReceipt | null
  introductionCeremony: IntroductionCeremony | null
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

export function isTargetableAlien(alien: Alien | null | undefined): alien is Alien {
  return Boolean(alien?.alive && !alien.entering)
}

export function pickTargetForNote(aliens: Alien[], answeredNote: string, playerX: number): { alien: Alien; index: number } | null {
  const targetClass = noteClass(answeredNote)
  let best: Alien | null = null
  let bestIdx = -1
  for (let i = 0; i < aliens.length; i++) {
    const a = aliens[i]
    if (!isTargetableAlien(a) || noteClass(a.note) !== targetClass) continue
    if (!best) { best = a; bestIdx = i; continue }
    // Y delta > 4px → use urgency. Otherwise → use x proximity.
    const dy = a.y - best.y
    if (Math.abs(dy) > 4 * SPACE_SCALE) {
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
    if (!isTargetableAlien(a)) continue
    const dy = a.y - bestY
    if (dy > 4 * SPACE_SCALE) {
      bestIdx = i; bestY = a.y; bestDx = Math.abs(a.x - playerX)
    } else if (Math.abs(dy) <= 4 * SPACE_SCALE) {
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
export const SPAWN_Y = 70 * SPACE_SCALE
export const SPAWN_LANE_GAP = 16 * SPACE_SCALE
export const ENTRY_ORIGIN = { x: W / 2, y: SPAWN_Y - 140 * SPACE_SCALE }
export const ENTRY_DURATION_MS = 500

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

export function buildWaveQueue(
  gs: GameState,
  fsrs: Record<string, NoteMemory>,
  memoryEpochMs = 0,
): void {
  const params = waveParams(gs.wave, gs.difficulty)
  const pool = gs.unlockedNotes
  const count = params.alienCount

  const observation: WaveMemoryObservation = { epochMs: memoryEpochMs, store: fsrs }
  const profiles = Object.fromEntries(pool.map(note => [
    note,
    snapshotNoteSoul(note, observation.store[note], observation.epochMs),
  ]))
  gs.waveSoulByNote = profiles

  const introIndex = new Map<string, number>(
    INTRO_ORDER.map((note, index) => [note, index] as [string, number]),
  )
  const due = pool
    .filter(note => profiles[note].due)
    .sort((left, right) =>
      (gs.rosterServiceCount[left] ?? 0) - (gs.rosterServiceCount[right] ?? 0) ||
      profiles[left].r - profiles[right].r ||
      (introIndex.get(left) ?? Number.MAX_SAFE_INTEGER) -
        (introIndex.get(right) ?? Number.MAX_SAFE_INTEGER))
  const must = due.slice(0, count)
  if (count >= pool.length) {
    for (const note of pool) {
      if (!must.includes(note)) must.push(note)
    }
  }
  const remaining = Math.max(0, count - must.length)

  const weights = pool.map(n => {
    return Math.max(0.2, 1.2 - profiles[n].r)
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
  for (const note of combined) {
    gs.rosterServiceCount[note] = (gs.rosterServiceCount[note] ?? 0) + 1
  }
  gs.spawnedThisWave = 0
  gs.alienCountThisWave = combined.length
  gs.nextSpawnAt = gs.directorClockMs + (gs.waveIntroTimer * 1000) + 600
}

export function createInitialState(
  difficulty: Difficulty,
  unlockedNotes: string[],
  clockMs = 1,
  gameId = `fixture:${clockMs}`,
): GameState {
  return {
    gameId,
    aliens: [], lasers: [], particles: [], playerX: W / 2,
    score: 0, combo: 0, maxCombo: 0, wave: 1,
    cityHealth: STARTING_SHIELDS,
    unlockedNotes: [...unlockedNotes], consecutiveCorrect: 0,
    selectedNote: null, waveIntroTimer: 1.5, flashTimer: 0,
    wrongMessage: '', wrongTimer: 0, chargeProgress: 0, difficulty,
    spawnQueue: [], spawnedThisWave: 0, alienCountThisWave: 0,
    nextSpawnAt: 0, lastProgressAt: 0, hintCount: 0,
    phase: 'playing', clockMs, directorClockMs: clockMs, matchStartAt: 0, matchTargetAlienId: null,
    micCooldownMs: 0, answerCooldownMs: 0,
    nextAttackSerial: 1, activeAttack: null,
    nextAttackAtMs: clockMs + ENGINE_DEMAND_FLOOR_MS[difficulty] - DIVE_TELEGRAPH_MS,
    directorCursorSlot: 0, lastDemandAtMs: null,
    requiredAnswerEventsMs: [], waveStartedAtMs: clockMs,
    lastCompletedWavePacing: null,
    waveSoulByNote: {}, rosterServiceCount: {},
    pendingIntroductions: [], introductionCeremony: null, nextCeremonySerial: 0,
  }
}

export function beginWave(
  gs: GameState,
  fsrs: Record<string, NoteMemory>,
  memoryEpochMs = 0,
): void {
  gs.aliens = []
  gs.activeAttack = null
  gs.lasers = []
  gs.chargeProgress = 0
  gs.matchStartAt = 0
  gs.matchTargetAlienId = null
  gs.micCooldownMs = 0
  gs.lastProgressAt = gs.directorClockMs
  gs.hintCount = 0
  gs.directorCursorSlot = 0
  gs.lastDemandAtMs = null
  gs.requiredAnswerEventsMs = []
  gs.waveStartedAtMs = gs.directorClockMs
  gs.nextAttackAtMs = gs.waveStartedAtMs + ENGINE_DEMAND_FLOOR_MS[gs.difficulty] - DIVE_TELEGRAPH_MS
  buildWaveQueue(gs, fsrs, memoryEpochMs)
}

function cloneState(state: GameState): GameState {
  return {
    ...state,
    aliens: state.aliens.map(a => ({ ...a, soul: { ...a.soul } })),
    lasers: state.lasers.map(l => ({ ...l })),
    particles: state.particles.map(p => ({ ...p })),
    activeAttack: state.activeAttack ? { ...state.activeAttack } : null,
    unlockedNotes: [...state.unlockedNotes],
    spawnQueue: [...state.spawnQueue],
    waveSoulByNote: Object.fromEntries(
      Object.entries(state.waveSoulByNote).map(([note, soul]) => [note, { ...soul }]),
    ),
    rosterServiceCount: { ...state.rosterServiceCount },
    requiredAnswerEventsMs: [...state.requiredAnswerEventsMs],
    pendingIntroductions: [...state.pendingIntroductions],
    introductionCeremony: state.introductionCeremony ? { ...state.introductionCeremony } : null,
    lastCompletedWavePacing: state.lastCompletedWavePacing
      ? { ...state.lastCompletedWavePacing, requiredAnswerEventsMs: [...state.lastCompletedWavePacing.requiredAnswerEventsMs] }
      : null,
  }
}

export function toViewState(gs: GameState, inputMode: InputMode): ViewState {
  const target = gs.matchTargetAlienId ? gs.aliens.find(item => item.alienId === gs.matchTargetAlienId) : null
  const spotlightIdx = gs.activeAttack
    ? gs.aliens.findIndex(item => item.alienId === gs.activeAttack?.alienId)
    : -1
  const answerOpen = gs.activeAttack?.phase === 'outbound' && gs.activeAttack.outcome === null
  return {
    aliens: gs.aliens.map(a => ({ ...a, soul: { ...a.soul } })),
    lasers: gs.lasers.map(l => ({ ...l })),
    particles: gs.particles.map(p => ({ ...p })),
    playerX: gs.playerX,
    charge: {
      fraction: Math.min(1, gs.chargeProgress / CHARGE_FULL_MS),
      targetNote: isTargetableAlien(target) ? target.note : null,
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
    spotlightIdx,
    nowMs: gs.directorClockMs,
    activeAttack: gs.activeAttack ? { ...gs.activeAttack } : null,
    requiredAnswerEventsMs: [...gs.requiredAnswerEventsMs],
    lastCompletedWavePacing: gs.lastCompletedWavePacing
      ? { ...gs.lastCompletedWavePacing, requiredAnswerEventsMs: [...gs.lastCompletedWavePacing.requiredAnswerEventsMs] }
      : null,
    introductionCeremony: gs.introductionCeremony ? { ...gs.introductionCeremony } : null,
    noteButtons: gs.unlockedNotes.map((note, i) => ({
      note,
      hue: NOTE_COLORS[note]?.hue ?? 0,
      active: Boolean(answerOpen && gs.activeAttack && noteClass(gs.activeAttack.note) === noteClass(note)),
      keyNum: i + 1,
    })),
  }
}

export function findAlienById(gs: GameState, alienId: string): Alien | undefined {
  return gs.aliens.find(item => item.alienId === alienId)
}

export function flightStateOf(alien: Alien, activeAttack: ActiveAttack | null): 'formation' | AttackPhase {
  return activeAttack?.alienId === alien.alienId ? activeAttack.phase : 'formation'
}

function clearMicTarget(gs: GameState): void {
  gs.matchStartAt = 0
  gs.matchTargetAlienId = null
  gs.chargeProgress = 0
}

function cadenceTelegraphFloorMs(gs: GameState): number {
  const floor = ENGINE_DEMAND_FLOOR_MS[gs.difficulty]
  return (gs.lastDemandAtMs ?? gs.waveStartedAtMs) + floor - DIVE_TELEGRAPH_MS
}

function armAfterResolution(gs: GameState): void {
  gs.nextAttackAtMs = Math.max(
    gs.directorClockMs + POST_RESOLUTION_FLOOR_MS,
    cadenceTelegraphFloorMs(gs),
  )
}

function diveSideForSlot(slot: number, attackSerial: number): -1 | 1 {
  const column = FORMATION_SLOT_ORDER[slot]?.[0] ?? 2
  if (column < 2) return -1
  if (column > 2) return 1
  return attackSerial % 2 === 0 ? -1 : 1
}

export function chooseNextDiver(gs: GameState): Alien | null {
  let best: Alien | null = null
  let bestScore = -Infinity
  for (let offset = 0; offset < FORMATION_SLOT_COUNT; offset++) {
    const slot = (gs.directorCursorSlot + offset) % FORMATION_SLOT_COUNT
    const alien = gs.aliens.find(item => item.formationSlot === slot)
    if (!isTargetableAlien(alien)) continue
    // ponytail: tolerate pre-R7 in-memory fixture/hot-reload entities as neutral;
    // the next spawned wave always carries the canonical immutable snapshot.
    const pressure = alien.soul?.divePressure ?? 0
    const serviceCount = alien.diveServiceCount ?? 0
    const score = (1 + pressure) / (1 + serviceCount)
    if (score > bestScore) {
      best = alien
      bestScore = score
    }
  }
  if (!best) return null
  best.diveServiceCount = (best.diveServiceCount ?? 0) + 1
  gs.directorCursorSlot = (best.formationSlot + 1) % FORMATION_SLOT_COUNT
  return best
}

function startAttack(gs: GameState): boolean {
  if (gs.activeAttack || gs.directorClockMs < gs.nextAttackAtMs) return false
  const alien = chooseNextDiver(gs)
  if (!alien) {
    gs.nextAttackAtMs = gs.directorClockMs + NO_ELIGIBLE_RETRY_MS
    return false
  }
  const serial = gs.nextAttackSerial++
  alien.x = alien.formationX
  alien.y = alien.formationY
  gs.activeAttack = {
    attackId: `${gs.gameId}:attack:${serial}`,
    alienId: alien.alienId,
    note: alien.note,
    side: diveSideForSlot(alien.formationSlot, serial),
    phase: 'telegraph',
    telegraphStartedAtMs: gs.directorClockMs,
    demandAtMs: null,
    deadlineAtMs: null,
    outboundT: 0,
    returnFromT: 0,
    returnStartedAtMs: null,
    outcome: null,
    resolvedAtMs: null,
    voiceWindowEligible: null,
    voiceHeardPhonation: false,
  }
  clearMicTarget(gs)
  return true
}

function deactivateAttackLasers(gs: GameState, attackId: string): void {
  for (const laser of gs.lasers) {
    if (laser.attackId === attackId) laser.active = false
  }
}

export function teardownResolvedAttackForGameOver(
  gs: GameState,
  attackId: string,
  events: EngineEvent[],
): boolean {
  const attack = gs.activeAttack
  if (!attack || attack.attackId !== attackId || attack.outcome === null || gs.phase === 'game_over') return false
  deactivateAttackLasers(gs, attackId)
  gs.activeAttack = null
  clearMicTarget(gs)
  gs.phase = 'game_over'
  events.push({ kind: 'gameOver' })
  return true
}

export function resolveAttack(
  gs: GameState,
  attackId: string,
  outcome: AttackOutcome,
  latencyMs: number,
  events: EngineEvent[],
  inputMode: InputMode,
): boolean {
  const attack = gs.activeAttack
  if (!attack || attack.attackId !== attackId || attack.outcome !== null) return false
  const target = findAlienById(gs, attack.alienId)
  attack.outcome = outcome
  attack.resolvedAtMs = gs.directorClockMs
  gs.lastProgressAt = gs.directorClockMs
  armAfterResolution(gs)
  clearMicTarget(gs)

  if (outcome === 'death' || outcome === 'cancelled') {
    deactivateAttackLasers(gs, attackId)
    if (target?.alive) {
      target.x = target.formationX
      target.y = target.formationY
    }
    gs.activeAttack = null
    return true
  }

  if (!target?.alive) {
    deactivateAttackLasers(gs, attackId)
    gs.activeAttack = null
    return true
  }

  if (outcome === 'correct') {
    events.push({ kind: 'grade', note: target.note, correct: true, latencyMs, inputMode })
    events.push({ kind: 'sfx', name: 'shoot' })
    const aimX = target.x + ALIEN_W / 2
    gs.playerX = aimX
    gs.lasers.push({
      x: aimX, y: PLAYER_Y, hue: target.hue, active: true,
      hits: true, targetY: target.y + ALIEN_H / 2,
      targetAlienId: target.alienId, attackId,
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
      if (gs.introductionCeremony?.note !== newNote && !gs.pendingIntroductions.includes(newNote)) {
        gs.pendingIntroductions.push(newNote)
      }
      events.push({ kind: 'unlock', note: newNote, inputMode })
    }
    gs.answerCooldownMs = 150
    attack.phase = 'hit-locked'
    return true
  }

  const gradesFailure = outcome === 'wrong'
    ? inputMode === 'click'
    : outcome === 'timeout' && (
      inputMode === 'click' ||
      (inputMode === 'mic' && attack.voiceWindowEligible === true && attack.voiceHeardPhonation)
    )
  if (gradesFailure) {
    events.push({ kind: 'grade', note: target.note, correct: false, latencyMs, inputMode })
  }
  events.push({ kind: 'sfx', name: 'wrong' })
  gs.combo = 0
  gs.consecutiveCorrect = 0
  gs.cityHealth = Math.max(0, gs.cityHealth - 1)
  gs.flashTimer = 0.4
  const correctName = NOTE_COLORS[target.note]?.name ?? target.note
  gs.wrongMessage = outcome === 'timeout'
    ? `TIME OUT! Signal was ${target.note.replace(/\d/, '')} (${correctName})`
    : `WRONG! Try ${target.note.replace(/\d/, '')} (${correctName})`
  gs.wrongTimer = 1.8
  const aimX = target.x + ALIEN_W / 2
  gs.playerX = aimX
  gs.lasers.push({
    x: aimX, y: PLAYER_Y, hue: 0, active: true,
    hits: false, targetY: target.y + ALIEN_H + 30 * SPACE_SCALE,
    targetAlienId: target.alienId, attackId,
  })
  events.push({
    kind: 'playNote', note: target.note, delayMs: 350, guard: 'attack',
    targetAlienId: target.alienId, attackId,
  })
  attack.phase = 'returning'
  attack.returnFromT = attack.outboundT
  attack.returnStartedAtMs = gs.directorClockMs
  if (gs.cityHealth <= 0) teardownResolvedAttackForGameOver(gs, attackId, events)
  return true
}

function processPendingAnswer(
  gs: GameState,
  answer: PendingAttackAnswer | null | undefined,
  latencyMs: number,
  events: EngineEvent[],
): void {
  if (!answer || gs.answerCooldownMs > 0 || gs.phase !== 'playing') return
  const attack = gs.activeAttack
  if (!attack || attack.phase !== 'outbound' || attack.outcome !== null || attack.demandAtMs === null) return
  if (answer.gameId !== gs.gameId || answer.attackId !== attack.attackId || answer.alienId !== attack.alienId) return
  gs.lastProgressAt = gs.directorClockMs
  const outcome: AttackOutcome = noteClass(answer.note) === noteClass(attack.note) ? 'correct' : 'wrong'
  resolveAttack(gs, attack.attackId, outcome, latencyMs, events, 'click')
}

export function finalizeHitLockedDeath(
  gs: GameState,
  attackId: string,
  events: EngineEvent[],
  rng: () => number,
): boolean {
  const attack = gs.activeAttack
  if (!attack || attack.attackId !== attackId || attack.outcome !== 'correct' || attack.phase !== 'hit-locked') return false
  const target = findAlienById(gs, attack.alienId)
  deactivateAttackLasers(gs, attackId)
  if (target?.alive) {
    events.push({ kind: 'sfx', name: 'explosion' })
    target.alive = false
    target.hitTimer = 0.4
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2
      gs.particles.push({
        x: target.x + ALIEN_W / 2,
        y: target.y + ALIEN_H / 2,
        vx: Math.cos(angle) * (40 + rng() * 60) * SPACE_SCALE,
        vy: Math.sin(angle) * (40 + rng() * 60) * SPACE_SCALE,
        life: 0.5 + rng() * 0.4,
        hue: target.hue,
      })
    }
  }
  gs.activeAttack = null
  clearMicTarget(gs)
  return true
}

function beginNextIntroduction(gs: GameState, events: EngineEvent[]): boolean {
  const note = gs.pendingIntroductions.shift()
  if (!note) return false
  const ceremonyId = `${gs.gameId}:ceremony:${gs.nextCeremonySerial}`
  gs.nextCeremonySerial++
  gs.phase = 'ceremony'
  gs.introductionCeremony = {
    ceremonyId,
    note,
    elapsedMs: 0,
    durationMs: INTRODUCTION_DURATION_MS,
    toneStatus: 'pending',
  }
  events.push({ kind: 'ceremonyToneRequest', ceremonyId, note })
  return true
}

export function tick(state: GameState, input: EngineInput, dtMs: number, rng: () => number): TickResult {
  const gs = cloneState(state)
  const events: EngineEvent[] = []
  const elapsedMs = Math.max(0, dtMs)
  const isActive = input.isActive !== false
  const stepMs = isActive ? Math.min(elapsedMs, MAX_SIM_STEP_MS) : 0

  if (gs.phase === 'ceremony') {
    const activeCeremony = gs.introductionCeremony
    if (!isActive || !activeCeremony) {
      return { state: gs, viewState: toViewState(gs, input.inputMode), events }
    }
    const toneAck = input.ceremonyToneAck
    if (toneAck && toneAck.ceremonyId === activeCeremony.ceremonyId && toneAck.note === activeCeremony.note) {
      if (toneAck.dispatched) activeCeremony.toneStatus = 'acknowledged'
      else if (activeCeremony.toneStatus !== 'acknowledged') activeCeremony.toneStatus = 'blocked'
    }
    if (activeCeremony.toneStatus === 'acknowledged') {
      activeCeremony.elapsedMs = Math.min(activeCeremony.durationMs, activeCeremony.elapsedMs + stepMs)
    }
    if (activeCeremony.elapsedMs >= activeCeremony.durationMs) {
      if (beginNextIntroduction(gs, events)) {
        return { state: gs, viewState: toViewState(gs, input.inputMode), events }
      }
      gs.introductionCeremony = null
      gs.phase = 'playing'
      gs.wave++
      gs.waveIntroTimer = 1.6
      beginWave(gs, input.fsrs ?? {}, input.memoryEpochMs ?? 0)
    }
    return { state: gs, viewState: toViewState(gs, input.inputMode), events }
  }

  const dt = stepMs / 1000
  gs.clockMs += isActive ? elapsedMs : 0
  gs.directorClockMs += stepMs
  gs.answerCooldownMs = Math.max(0, gs.answerCooldownMs - stepMs)
  gs.micCooldownMs = Math.max(0, gs.micCooldownMs - (isActive ? elapsedMs : 0))
  if (gs.micCooldownMs === 0 && gs.matchStartAt === -1) gs.matchStartAt = 0

  if (gs.phase !== 'playing' || !isActive) {
    return { state: gs, viewState: toViewState(gs, input.inputMode), events }
  }

  if (gs.waveIntroTimer > 0) gs.waveIntroTimer -= dt
  if (gs.flashTimer > 0) gs.flashTimer -= dt
  if (gs.wrongTimer > 0) {
    gs.wrongTimer -= dt
    if (gs.wrongTimer <= 0) gs.wrongMessage = ''
  }

  const params = waveParams(gs.wave, gs.difficulty)
  if (gs.spawnQueue.length > 0 && gs.waveIntroTimer <= 0 && gs.directorClockMs >= gs.nextSpawnAt) {
    const aliveCount = gs.aliens.filter(a => a.alive).length
    if (aliveCount < params.maxConcurrent) {
      const formationSlot = gs.spawnedThisWave
      const anchor = formationAnchor(formationSlot)
      const pose = formationPose(anchor.x, anchor.y, gs.directorClockMs, input.reducedMotion)
      const note = gs.spawnQueue.shift()!
      const colorInfo = NOTE_COLORS[note]
      const soul = gs.waveSoulByNote[note] ?? snapshotNoteSoul(
        note,
        input.fsrs?.[note],
        input.memoryEpochMs ?? 0,
      )
      const entering = !input.reducedMotion
      const visualKind = (formationSlot % VISUAL_KIND_COUNT) as VisualKind
      gs.aliens.push({
        alienId: gs.gameId + ':alien:' + gs.wave + ':' + formationSlot,
        visualId: `${gs.wave}:${formationSlot}`,
        visualKind,
        x: entering ? ENTRY_ORIGIN.x : pose.x,
        y: entering ? ENTRY_ORIGIN.y : pose.y,
        entering,
        entryT: entering ? 0 : 1,
        entryTargetX: anchor.x,
        formationSlot,
        formationX: anchor.x,
        formationY: anchor.y,
        note, hue: colorInfo?.hue ?? 0, soul: { ...soul }, diveServiceCount: 0, alive: true,
        frame: formationSlot % 2, hitTimer: 0,
      })
      gs.spawnedThisWave++
      gs.nextSpawnAt = gs.directorClockMs + params.spawnInterval
      events.push({ kind: 'spawn', note, x: anchor.x })
    }
  }

  for (const alien of gs.aliens) {
    if (!alien.alive && alien.hitTimer <= 0) continue
    if (alien.hitTimer > 0) {
      alien.hitTimer -= dt
      continue
    }
    const pose = formationPose(
      alien.formationX,
      alien.formationY,
      gs.directorClockMs,
      input.reducedMotion,
    )
    if (alien.entering) {
      if (input.reducedMotion) {
        alien.entryT = 1
      } else {
        const remainingMs = (1 - alien.entryT) * ENTRY_DURATION_MS
        alien.entryT = stepMs + Number.EPSILON * ENTRY_DURATION_MS >= remainingMs
          ? 1
          : alien.entryT + stepMs / ENTRY_DURATION_MS
      }

      if (alien.entryT >= 1) {
        alien.x = pose.x
        alien.y = pose.y
        alien.entering = false
      } else {
        const t = 1 - (1 - alien.entryT) ** 2
        const u = 1 - t
        const controlX = ENTRY_ORIGIN.x + (pose.x - ENTRY_ORIGIN.x) * 1.4
        const controlY = ENTRY_ORIGIN.y + (pose.y - ENTRY_ORIGIN.y) * 0.5
        alien.x = u * u * ENTRY_ORIGIN.x + 2 * u * t * controlX + t * t * pose.x
        alien.y = u * u * ENTRY_ORIGIN.y + 2 * u * t * controlY + t * t * pose.y
      }
      continue
    }
    if (gs.activeAttack?.alienId === alien.alienId) continue
    alien.x = pose.x
    alien.y = pose.y
  }

  const activeTarget = gs.activeAttack ? findAlienById(gs, gs.activeAttack.alienId) : null
  if (gs.activeAttack && !activeTarget?.alive) {
    const attack = gs.activeAttack
    if (attack.outcome === null) {
      resolveAttack(gs, attack.attackId, 'death', 0, events, input.inputMode)
    } else if (attack.outcome === 'correct') {
      finalizeHitLockedDeath(gs, attack.attackId, events, rng)
    } else {
      deactivateAttackLasers(gs, attack.attackId)
      gs.activeAttack = null
      clearMicTarget(gs)
    }
  }

  if (!gs.activeAttack) startAttack(gs)
  const attack = gs.activeAttack
  const attackTarget = attack ? findAlienById(gs, attack.alienId) : null
  if (attack && attackTarget?.alive) {
    if (attack.phase === 'telegraph') {
      attackTarget.x = attackTarget.formationX
      attackTarget.y = attackTarget.formationY
      if (gs.directorClockMs - attack.telegraphStartedAtMs >= DIVE_TELEGRAPH_MS) {
        attack.phase = 'outbound'
        attack.demandAtMs = gs.directorClockMs
        attack.deadlineAtMs = gs.directorClockMs + DIVE_RESPONSE_DEADLINE_MS
        attack.outboundT = 0
        gs.lastDemandAtMs = gs.directorClockMs
        gs.requiredAnswerEventsMs.push(gs.directorClockMs)
        events.push({
          kind: 'playNote', note: attack.note, delayMs: 0, guard: 'attack',
          targetAlienId: attack.alienId, attackId: attack.attackId,
        })
      }
    }
    if (attack.phase === 'outbound' && input.inputMode === 'mic' && attack.outcome === null) {
      const observation = input.voiceTimeoutObservation
      const healthy = observation?.healthy === true
      const heard = observation?.heard === true
      attack.voiceWindowEligible = attack.voiceWindowEligible === null
        ? healthy
        : attack.voiceWindowEligible && healthy
      attack.voiceHeardPhonation = attack.voiceHeardPhonation || heard
    }
    if (attack.phase === 'outbound' && attack.demandAtMs !== null) {
      attack.outboundT = Math.min(1, (gs.directorClockMs - attack.demandAtMs) / DIVE_OUTBOUND_MS)
      if (input.reducedMotion) {
        attackTarget.x = attackTarget.formationX
        attackTarget.y = attackTarget.formationY
      } else {
        const pose = divePose(attackTarget.formationX, attackTarget.formationY, attack.outboundT, attack.side)
        attackTarget.x = pose.x
        attackTarget.y = pose.y
      }
    } else if (attack.phase === 'returning' && attack.returnStartedAtMs !== null) {
      const returnProgress = Math.min(1, (gs.directorClockMs - attack.returnStartedAtMs) / DIVE_RETURN_MS)
      const returnT = attack.returnFromT * (1 - returnProgress)
      if (input.reducedMotion) {
        attackTarget.x = attackTarget.formationX
        attackTarget.y = attackTarget.formationY
      } else {
        const pose = divePose(attackTarget.formationX, attackTarget.formationY, returnT, attack.side)
        attackTarget.x = pose.x
        attackTarget.y = pose.y
      }
      if (returnProgress >= 1) {
        attackTarget.x = attackTarget.formationX
        attackTarget.y = attackTarget.formationY
        gs.activeAttack = null
        clearMicTarget(gs)
      }
    }
  }

  if (gs.difficulty === 'easy' && gs.directorClockMs - gs.lastProgressAt > 60000) {
    const hintAttack = gs.activeAttack
    const hintTarget = hintAttack ? findAlienById(gs, hintAttack.alienId) : null
    if (hintAttack?.phase === 'outbound' && hintAttack.outcome === null && hintTarget?.alive) {
      events.push({
        kind: 'playNote', note: hintAttack.note, delayMs: 0, guard: 'attack',
        targetAlienId: hintAttack.alienId, attackId: hintAttack.attackId,
      })
      gs.wrongMessage = `Hint: try ${hintAttack.note.replace(/\d/, '')}`
      gs.wrongTimer = 2.5
      gs.hintCount++
    }
    gs.lastProgressAt = gs.directorClockMs
  }

  for (const alien of gs.aliens) {
    if (alien.alive) alien.frame = Math.floor(gs.directorClockMs / 500) % 2
  }

  processPendingAnswer(gs, input.pendingAnswer, input.latencyMs ?? 2000, events)

  const micAttack = gs.activeAttack
  const micTarget = micAttack ? findAlienById(gs, micAttack.alienId) : null
  if (gs.phase === 'playing' && input.inputMode === 'mic' && input.isListening &&
      micAttack?.phase === 'outbound' && micAttack.outcome === null &&
      micAttack.demandAtMs !== null && micTarget?.alive) {
    const p = input.pitch
    if (p?.isActive && p.confidence >= MIC_CONFIDENCE_FLOOR && p.frequency > 0) {
      const centsOff = octaveFoldedCents(p.frequency, noteToFreq(micTarget.note))
      if (Math.abs(centsOff) <= MIC_TOLERANCE_CENTS) {
        if (gs.matchStartAt === -1) {
          // Frozen-v1 post-fire cooldown: do nothing.
        } else if (gs.matchTargetAlienId !== micTarget.alienId || gs.matchStartAt === 0) {
          gs.matchTargetAlienId = micTarget.alienId
          gs.matchStartAt = gs.clockMs
        }
        if (gs.matchStartAt > 0) {
          const held = gs.clockMs - gs.matchStartAt
          const progress = Math.min(1, held / MIC_HOLD_MS)
          gs.chargeProgress = progress * CHARGE_FULL_MS
          if (progress >= 1) {
            gs.matchStartAt = -1
            gs.matchTargetAlienId = null
            gs.micCooldownMs = 600
            gs.chargeProgress = 0
            resolveAttack(gs, micAttack.attackId, 'correct', input.latencyMs ?? 2000, events, 'mic')
          }
        }
      } else if (gs.matchStartAt > 0) {
        // Frozen-v1 confident-wrong semantics: reset hold only.
        clearMicTarget(gs)
      }
    }
    // Silent or low confidence preserves an in-progress lock.
  }

  const timeoutAttack = gs.activeAttack
  if (timeoutAttack?.phase === 'outbound' && timeoutAttack.outcome === null &&
      timeoutAttack.deadlineAtMs !== null &&
      gs.directorClockMs >= timeoutAttack.deadlineAtMs) {
    resolveAttack(gs, timeoutAttack.attackId, 'timeout', 0, events, input.inputMode)
  }

  for (const laser of gs.lasers) {
    if (!laser.active) continue
    laser.y -= LASER_SPEED * dt
    if (laser.hits) {
      const target = laser.targetAlienId ? findAlienById(gs, laser.targetAlienId) : null
      if (target?.alive && laser.y <= target.y + ALIEN_H &&
          laser.x >= target.x - 4 * SPACE_SCALE && laser.x <= target.x + ALIEN_W + 4 * SPACE_SCALE) {
        if (laser.attackId) finalizeHitLockedDeath(gs, laser.attackId, events, rng)
      }
    } else if (laser.y <= laser.targetY) {
      laser.active = false
    }
    if (laser.y < -LASER_H) laser.active = false
  }

  const hitLock = gs.activeAttack
  if (hitLock?.phase === 'hit-locked' && hitLock.outcome === 'correct' &&
      hitLock.resolvedAtMs !== null &&
      gs.directorClockMs - hitLock.resolvedAtMs >= HIT_LOCK_MAX_MS) {
    finalizeHitLockedDeath(gs, hitLock.attackId, events, rng)
  }
  gs.lasers = gs.lasers.filter(l => l.active)

  gs.particles = gs.particles.filter(p => {
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.life -= dt
    return p.life > 0
  })

  if (gs.phase === 'playing' && gs.spawnQueue.length === 0 && gs.activeAttack === null &&
      gs.aliens.length > 0 && gs.aliens.every(a => !a.alive && a.hitTimer <= 0)) {
    const waveEndedAtMs = gs.directorClockMs
    gs.lastCompletedWavePacing = {
      difficulty: gs.difficulty,
      wave: gs.wave,
      waveStartedAtMs: gs.waveStartedAtMs,
      waveEndedAtMs,
      waveDurationMs: waveEndedAtMs - gs.waveStartedAtMs,
      requiredAnswerEventsMs: [...gs.requiredAnswerEventsMs],
    }
    if (gs.pendingIntroductions.length > 0) {
      events.push({ kind: 'waveComplete' })
      beginNextIntroduction(gs, events)
    } else {
      gs.wave++
      gs.waveIntroTimer = 1.6
      beginWave(gs, input.fsrs ?? {}, input.memoryEpochMs ?? 0)
      events.push({ kind: 'waveComplete' })
    }
  }

  return { state: gs, viewState: toViewState(gs, input.inputMode), events }
}
