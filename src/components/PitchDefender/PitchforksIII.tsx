'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { Mic, RotateCcw } from 'lucide-react'
import { usePitchDetection, type PitchInfo } from './usePitchDetection'
import { exactCents, noteToFreq } from './pitchMath'
import {
  initAudio,
  loadPianoSamples,
  markToneEmitted,
  playPianoNote,
  setPianoVolume,
  isWithinToneSuppressionWindow,
} from './audioEngine'
import {
  NOTE_COLORS,
  autoGrade,
  createNote,
  currentR,
  pickNextNote,
  retrievability,
  reviewNote,
  type NoteMemory,
} from '@/lib/fsrs'
import { INTRO_ORDER, UNLOCK_THRESHOLDS } from './types'
import { WORLD_REGISTRY, isWorldUnlocked } from './pitchforks3WorldRegistry'

const W = 720
const H = 405
const MAX_CANVAS_DISPLAY_W = 1280
const MAX_CANVAS_DISPLAY_H = 720
const STAFF_BAND_RENDER_SCALE = 3
const SPRITE_SCALE = 3
// Frankenstein's native sprite resolution was bumped 3x (32x48 -> 96x144, C11
// 2026-07-09) to hold more detail while rendering at the SAME on-screen size as
// before -- so Frankenstein-specific anchor/draw math divides SPRITE_SCALE by 3
// instead of using it directly. Villager sprites are UNCHANGED native resolution
// and must keep using SPRITE_SCALE directly. Do not use FRANK_SPRITE_SCALE for
// anything villager-related, and do not use SPRITE_SCALE directly for anything
// that reads from assets.frankMeta / frankMeta.
const FRANK_SPRITE_SCALE = SPRITE_SCALE / 3
const ASSET_BASE = '/images/pitchforks'
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FSRS_KEY = 'pitch_fsrs_memory'
const FSRS_DEBUG_KEY = 'pitch_fsrs_debug'
const MASTERY_PROGRESS_KEY = 'pitchforks3_mastery_progress'
const MASTERY_PROGRESS_DEBUG_KEY = 'pitchforks3_mastery_progress_debug'
const STARTING_NOTES = [INTRO_ORDER[0], INTRO_ORDER[1]]

// ported from Pitchforks.tsx:430-432
const CONFIDENCE_FLOOR = 0.75
// ported from Pitchforks.tsx:440-448
const MATCH_TOLERANCE_CENTS = 70
const HOLD_MS = 300

const FRANK_X = 54
const FRANK_Y = 196
const FRANK_REACH_X = 138
const GROUND_Y = 330
const STARTING_HEALTH = 5
const TONE_MS = 1000
const TONE_SPACING_MS = 1200
const ECHO_TAIL_MS = 350
const TONE_SUPPRESS_MS = TONE_MS + ECHO_TAIL_MS
const NEW_NOTE_CEREMONY_MS = 2400
const NOTE_MASTERED_CEREMONY_MS = 2400
const WAVE_RECEIPT_MS = 1900
const SHAKE_PEAK_PX = 4
const SHAKE_MS = 200
const BOLT_LIFE_S = 0.72
const STRIKE_LEADER_END = 0.24
const STRIKE_RECEIPT_END = 0.48
const STRIKE_IMPACT_START = 0.74
const CHARGE_LEADER_START = 0.18
const CHARGE_DISCHARGE_START = 0.42
const CHARGE_PRELOCK_REVEAL_MAX = 0.86
const CIRCUIT_RELAY_X = 18
const CIRCUIT_RELAY_Y = 2
const CIRCUIT_BUCKET_S = 0.05
const FRANK_CLOUD_X_OFFSET = 26
const FRANK_CLOUD_Y = 88
const FRANK_REACTION_MS = 260
const MASTERY_STABILITY_DAYS = 21
const MASTERY_SESSION_COUNT = 3
const TRAIL_MS = 1000
const PITCH_BAR_Y = H - 52
const PITCH_BAR_H = 12
const PITCH_BAR_X = 34
const PITCH_BAR_W = W - PITCH_BAR_X * 2
const DUNGEON_FLOOR_Y = GROUND_Y - 42
const DUNGEON_TORCHES = [
  { x: 126, y: 126, phase: 0.2 },
  { x: 358, y: 104, phase: 1.9 },
  { x: 594, y: 132, phase: 3.4 },
] as const

type LayoutMode = 'portrait' | 'stage'

function layoutModeForViewport(width: number, height: number): LayoutMode {
  return height > width && width <= 768 ? 'portrait' : 'stage'
}

// C3: fork pose lean. Villagers face/advance toward Frankenstein (FRANK_X, left side),
// so a negative angle here tips the tine end toward him — "gripped forward," not a
// vertical rod. Pivots around the villager's own fork_base anchor (rotation-invariant;
// strike/tineIndex targeting never reads rendered fork pixels, only villagerMeta.tines).
const FORK_LEAN_DEG = -18

function rotateAroundPivot(px: number, py: number, cx: number, cy: number, deg: number) {
  const rad = (deg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = px - cx
  const dy = py - cy
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos }
}

// C4: continuous charge-arc render cache. Pre-allocated once and mutated in place
// (CW consult-28, 0.86 conf: zero per-frame allocation is the single most important
// mobile-Safari perf rule for a per-frame polyline). Purely a rendering jitter cache,
// not gameplay state — renderView still emits everything logic-observable from
// (view, assets) only, same C0 render-seam guarantee.
const CHARGE_ARC_MAX_SEGMENTS = 16
const chargeArcPoints: { x: number; y: number }[] = Array.from(
  { length: CHARGE_ARC_MAX_SEGMENTS + 1 },
  () => ({ x: 0, y: 0 }),
)
const CHARGE_ARC_MAX_BRANCHES = 4
const CHARGE_ARC_MAX_BRANCH_SEGMENTS = 3
const chargeArcBranchPoints: { x: number; y: number }[][] = Array.from(
  { length: CHARGE_ARC_MAX_BRANCHES },
  () => Array.from({ length: CHARGE_ARC_MAX_BRANCH_SEGMENTS + 1 }, () => ({ x: 0, y: 0 })),
)
let chargeArcBranchCount = 0
let chargeArcBranchSegments = 0
let chargeArcJitterBucket = -1
let chargeArcSegmentCount = -1
// Structural degrade hook per CW's ask — no auto-detection wired yet (nothing to
// measure from; iPhone is the real gate at C13). Set to 'lite' manually if a device
// needs the cheaper path before C13 lands real detection.
let chargeArcQuality: 'full' | 'lite' = 'full'

// C5: Frankenstein neck-bolt/fist spark arcs while charging. Two short jittered
// polylines anchored near frankMeta.rod_tip (same anchor C4's lightning already
// terminates at) — pre-allocated, mutated in place, same zero-per-frame-allocation
// discipline as chargeArcPoints above.
const FRANK_SPARK_SEGMENTS = 5
const frankSparkPoints: { x: number; y: number }[][] = [0, 1].map(() =>
  Array.from({ length: FRANK_SPARK_SEGMENTS + 1 }, () => ({ x: 0, y: 0 })),
)
let frankSparkJitterBucket = -1

type Phase = 'menu' | 'tutorial' | 'calibrating' | 'playing' | 'game_over'
type LightningPhase = 'idle' | 'charge-cloud' | 'charge-leader' | 'charge-discharge' | 'strike-leader' | 'strike-receipt' | 'strike-discharge' | 'strike-impact'
type TineCount = 1 | 2 | 3 | 4
type VillagerState = 'waiting' | 'walking' | 'ash'

interface FrankMeta {
  frame_w: number
  frame_h: number
  frames: number
  rod_tip: { x: number; y: number }
}

interface VillagerMeta {
  frame_w: number
  frame_h: number
  walk_frames: number
  fork_base: { x: number; y: number }
  tines: Array<{ x: number; y: number }>
}

interface ForkMeta {
  frame_w: number
  frame_h: number
  handle_base: { x: number; y: number }
  tine_tips: Array<{ x: number; y: number }>
}

interface Assets {
  frankIdle?: HTMLImageElement
  frankCharge?: HTMLImageElement
  frankMeta: FrankMeta
  villagerMeta: Record<TineCount, VillagerMeta>
  forkMeta: Record<TineCount, ForkMeta>
  walkLeft: Record<TineCount, HTMLImageElement | undefined>
  burnedLeft: Record<string, HTMLImageElement | undefined>
  ashLeft: Record<TineCount, HTMLImageElement | undefined>
  fork: Record<string, HTMLImageElement | undefined>
  forkGlow: Record<string, HTMLImageElement | undefined>
}

interface Villager {
  id: number
  totalTines: TineCount
  x: number
  y: number
  speed: number
  notes: string[]
  burned: number
  state: VillagerState
  spawnIndex: number
  attackTimer: number
  attackTimerMax: number
  sequenceCued: boolean
  walkFrame: number
  walkClock: number
  ashTimer: number
}

interface Bolt {
  fromX: number
  fromY: number
  pivotX: number
  pivotY: number
  toX: number
  toY: number
  life: number
  maxLife: number
  seed: number
  hue: number
  note: string
  villagerId: number
  tineIndex: number
}

interface LightningPhaseTransition {
  phase: LightningPhase
  logicalMs: number
  chargeProgress: number
}

type BurstKind = 'strike' | 'kill'
type FrankReactionKind = 'kill' | 'miss'

interface Burst {
  x: number
  y: number
  hue: number
  kind: BurstKind
  seed: number
  life: number
  maxLife: number
}

interface TrailPoint {
  at: number
  deviation: number
  onTarget: boolean
  note: string
}

interface WavePlan {
  wave: number
  count: number
  spawnInterval: number
  speed: number
  tineCounts: TineCount[]
}

interface Runtime {
  villagers: Villager[]
  bolts: Bolt[]
  bursts: Burst[]
  wave: number
  health: number
  score: number
  streak: number
  spawned: number
  plan: WavePlan
  spawnClock: number
  bannerTimer: number
  nextWavePending: boolean
  animClock: number
  gameOver: boolean
  firstVillagerId: number | null
}

interface ActiveTarget {
  villager: Villager
  tineIndex: number
  note: string
  key: string
}

interface HudState {
  wave: number
  health: number
  score: number
  streak: number
}

type MicHudState = 'demo' | 'cue' | 'listening' | 'waiting' | 'blocked'

type Pf3ResetReason = 'confident-wrong' | 'silence' | null

type CeremonyToneAttempt = 'played' | 'suppressed' | 'pending' | 'disabled'

interface NewNoteCeremonyState {
  active: boolean
  note: string | null
  toneFired: boolean
  tonePulseKey: number
}

type WaveReceiptState = Readonly<{
  visible: boolean
  timer: number
  heard: readonly string[]
  sung: readonly string[]
  mastered: readonly string[]
}>

type MasteryProgress = Record<string, {
  sessionIds: string[]
  masteredAt: number | null
}>

type NoteChipPalette = Readonly<{
  hue: number
  saturation: number
  fillLight: number
  borderLight: number
  textLight: number
  glowPx: number
  glowAlpha: number
}>

type WaveReceiptView = WaveReceiptState & Readonly<{
  noteStyles: Readonly<Record<string, NoteChipPalette>>
}>

const EMPTY_WAVE_RECEIPT: WaveReceiptState = {
  visible: false,
  timer: 0,
  heard: [],
  sung: [],
  mastered: [],
}

type VillagerView = Readonly<{
  id: number
  totalTines: TineCount
  x: number
  y: number
  lane: number
  speed: number
  notes: ReadonlyArray<string>
  burned: number
  state: VillagerState
  visualBurn: number
  visualState: VillagerState
  spawnIndex: number
  attackTimer: number
  attackTimerMax: number
  sequenceCued: boolean
  walkFrame: number
  ashTimer: number
  active: boolean
  displayBurn: number
  timerPct: number
  soulR: number      // 0-1, currentR() for this villager's active note (notes[burned])
  soulCalm: number   // 0-1, retrievability(1, mem.S) for the same note, fixed 1-day-out reference
  soulHue: number     // hueForNote() for the same note
}>

type BoltView = Readonly<Bolt>
type BurstView = Readonly<Burst>
type TrailPointView = Readonly<TrailPoint>

type ShakeView = Readonly<{
  x: number
  y: number
}>

type ActiveView = Readonly<{
  villagerId: number
  tineIndex: number
  note: string
  key: string
}>

type TunerView = Readonly<{
  visible: boolean
  now: number
  targetNote: string | null
  sourceNote: string | null
  canUseSource: boolean
  dotDeviation: number | null
  renderDeviation: number | null
  onTarget: boolean
  trail: ReadonlyArray<TrailPointView>
}>

type ViewState = Readonly<{
  phase: Phase
  animClock: number
  gameOver: boolean
  villagers: ReadonlyArray<VillagerView>
  active: ActiveView | null
  charge: Readonly<{
    progress: number
    level: number
    tint: string | null
    charging: boolean
  }>
  bolts: ReadonlyArray<BoltView>
  bursts: ReadonlyArray<BurstView>
  frankReaction: Readonly<{
    kind: FrankReactionKind
    ageMs: number
  }> | null
  shake: ShakeView
  hud: Readonly<{
    wave: number
    health: number
    score: number
    streak: number
  }>
  waveBanner: Readonly<{
    visible: boolean
    timer: number
  }>
  waveReceipt: WaveReceiptView
  prompt: Readonly<{
    visible: boolean
    text: string
  }>
  noteNamesVisible: boolean
  staffNotationVisible: boolean
  synesthesiaOn: boolean
  reducedMotion: boolean
  timersPaused: boolean
  tuner: TunerView
  ceremony: Readonly<NewNoteCeremonyState>
  noteMastered: string | null
  noteMasteredAgeMs: number
}>

interface NoteHealthDebug {
  hue: number
  r: number
  intensity: number
}

interface Pf3DebugState {
  demoStep: string
  chargeProgress: number
  chargeLevel: number
  silenceFreezeObserved: boolean
  resetCount: number
  lastResetReason: Pf3ResetReason
  strikeCount: number
  burnedTines: number
  ashCount: number
  wave: number
  waveBannerVisible: boolean
  fullSequenceComplete: boolean
  barVisible: boolean
  barDotDeviation: number | null
  barOnTarget: boolean
  trailLength: number
  replayVisible: boolean
  cuePlaying: boolean
  matchingSuppressed: boolean
  timersPaused: boolean
  timerBarVisible: boolean
  activeAttackTimerPct: number | null
  lockWhileSuppressed: boolean
  tutorialAvailable: boolean
  healthPips: number
  burstCount: number
  lastStrikeNote: string | null
  lastStrikeHue: number | null
  lastKillNote: string | null
  lastKillHue: number | null
  roarFiredCount: number
  unlockedCount: number
  unlockedNotes: string[]
  noteR: Record<string, number>
  noteHealth: Record<string, NoteHealthDebug>
  ceremonyActive: boolean
  ceremonyNote: string | null
  ceremonyToneFired: boolean
  noteMastered: string | null
  masteredNotes: string[]
  selectedNotes: string[]
  activeNote: string | null
  activeSequence: string[]
  fsrsDebug: boolean
  fsrsStoreKey: string
  newNoteUnlocked: string | null
  layoutMode: LayoutMode
  lightningPhase: LightningPhase
  boltCount: number
  lightningBendDeg: number | null
  lightningPhaseTrace: LightningPhaseTransition[]
}

declare global {
  interface Window {
    __pf3?: {
      getState: () => Readonly<Pf3DebugState>
      readonly viewState: Readonly<ViewState> | null
    }
  }
}

const defaultFrankMeta: FrankMeta = {
  frame_w: 32,
  frame_h: 48,
  frames: 4,
  rod_tip: { x: 16, y: 0 },
}

const defaultVillagerMeta: VillagerMeta = {
  frame_w: 16,
  frame_h: 24,
  walk_frames: 4,
  fork_base: { x: 14, y: 11 },
  tines: [{ x: 14, y: 4 }, { x: 14, y: 6 }, { x: 14, y: 8 }, { x: 14, y: 10 }],
}

const defaultForkMeta: ForkMeta = {
  frame_w: 8,
  frame_h: 16,
  handle_base: { x: 3, y: 15 },
  tine_tips: [{ x: 1, y: 0 }, { x: 3, y: 0 }, { x: 6, y: 0 }, { x: 7, y: 0 }],
}

function emptyAssets(): Assets {
  return {
    frankMeta: defaultFrankMeta,
    villagerMeta: { 1: defaultVillagerMeta, 2: defaultVillagerMeta, 3: defaultVillagerMeta, 4: defaultVillagerMeta },
    forkMeta: { 1: defaultForkMeta, 2: defaultForkMeta, 3: defaultForkMeta, 4: defaultForkMeta },
    walkLeft: { 1: undefined, 2: undefined, 3: undefined, 4: undefined },
    burnedLeft: {},
    ashLeft: { 1: undefined, 2: undefined, 3: undefined, 4: undefined },
    fork: {},
    forkGlow: {},
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function semiToName(semiFromC4: number): string {
  const rounded = Math.round(semiFromC4)
  const name = NOTE_NAMES[((rounded % 12) + 12) % 12]
  const octave = 4 + Math.floor(rounded / 12)
  return `${name}${octave}`
}

function nameToSemi(name: string): number {
  const match = name.match(/^([A-G]#?)(\d)$/)
  if (!match) return 0
  return (parseInt(match[2], 10) - 4) * 12 + NOTE_NAMES.indexOf(match[1])
}

function noteRSnapshot(notes: string[], memory: Record<string, NoteMemory>): Record<string, number> {
  const result: Record<string, number> = {}
  for (const note of notes) {
    result[note] = Number(currentR(memory[note] ?? createNote(note)).toFixed(4))
  }
  return result
}

function noteHealthIntensity(r: number): number {
  // Low retrievability should look more urgent; high retrievability stays calm but legible.
  return Number(clamp(0.2 + (1 - clamp(r, 0, 1)) * 0.8, 0.2, 1).toFixed(4))
}

function noteHealthFor(note: string, memory: Readonly<Record<string, NoteMemory>>): NoteHealthDebug {
  const r = clamp(currentR(memory[note] ?? createNote(note)), 0, 1)
  return {
    hue: hueForNote(note),
    r: Number(r.toFixed(4)),
    intensity: noteHealthIntensity(r),
  }
}

function noteHealthSnapshot(notes: string[], memory: Readonly<Record<string, NoteMemory>>): Record<string, NoteHealthDebug> {
  const result: Record<string, NoteHealthDebug> = {}
  for (const note of notes) result[note] = noteHealthFor(note, memory)
  return result
}

function noteChipPalette(note: string, memory: Readonly<Record<string, NoteMemory>>): NoteChipPalette {
  const { hue, intensity } = noteHealthFor(note, memory)
  return {
    hue,
    saturation: Math.round(34 + intensity * 56),
    fillLight: Math.round(12 + intensity * 18),
    borderLight: Math.round(38 + intensity * 24),
    textLight: Math.round(72 + intensity * 12),
    glowPx: Math.round(4 + intensity * 12),
    glowAlpha: 0.12 + intensity * 0.22,
  }
}

function noteChipStyle(note: string, memory: Readonly<Record<string, NoteMemory>>): CSSProperties {
  const { hue, saturation, fillLight, borderLight, textLight, glowPx, glowAlpha } = noteChipPalette(note, memory)
  return {
    color: `hsl(${hue}, ${saturation}%, ${textLight}%)`,
    background: `linear-gradient(180deg, hsla(${hue}, ${saturation}%, ${fillLight + 7}%, 0.88), hsla(${hue}, ${saturation}%, ${fillLight}%, 0.72))`,
    borderColor: `hsla(${hue}, ${saturation}%, ${borderLight}%, 0.86)`,
    boxShadow: `0 0 ${glowPx}px hsla(${hue}, ${saturation}%, ${borderLight}%, ${glowAlpha})`,
  }
}

function ceremonyBannerStyle(note: string): CSSProperties {
  const hue = hueForNote(note)
  return {
    borderColor: `hsla(${hue}, 88%, 68%, 0.78)`,
    background: `linear-gradient(180deg, hsla(${hue}, 62%, 17%, 0.94), rgba(6, 8, 18, 0.9))`,
    boxShadow: `0 0 28px hsla(${hue}, 82%, 58%, 0.34)`,
  }
}

function ceremonyNoteStyle(note: string, memory: Readonly<Record<string, NoteMemory>>, toneFired: boolean): CSSProperties {
  const base = noteChipStyle(note, memory)
  const hue = hueForNote(note)
  return {
    ...base,
    boxShadow: toneFired
      ? `${base.boxShadow ?? ''}, 0 0 22px hsla(${hue}, 90%, 66%, 0.44)`
      : base.boxShadow,
  }
}

function ceremonyReplayButtonStyle(note: string): CSSProperties {
  const hue = hueForNote(note)
  return {
    color: `hsl(${hue}, 88%, 82%)`,
    borderColor: `hsla(${hue}, 78%, 64%, 0.72)`,
    background: `hsla(${hue}, 56%, 18%, 0.72)`,
    boxShadow: `0 0 12px hsla(${hue}, 78%, 56%, 0.24)`,
  }
}

// Hand-tuned onboarding — "levels within levels, slow advances." Level 1 is
// four single notes then one 2-note; tine count climbs one wave at a time.
const EARLY_WAVES: Record<number, TineCount[]> = {
  1: [1, 1, 1, 1, 2],
  2: [1, 1, 2, 2, 2],
  3: [2, 2, 2, 2, 3],
  4: [2, 2, 3, 3, 3],
  5: [2, 3, 3, 3, 4],
}
function fixedWaveDirector(wave: number, demo: boolean): WavePlan {
  const speed = Math.min(56, 15 + (wave - 1) * 5)
  const early = EARLY_WAVES[wave]
  if (early) {
    // Spawn one villager at a time so a new player faces a single note, then the next.
    return { wave, count: early.length, spawnInterval: demo ? 0.01 : Math.max(1.4, 3.2 - (wave - 1) * 0.3), speed, tineCounts: early }
  }
  // Wave 6+: probabilistic, slowly harder; 4-tine stays rare.
  const count = Math.min(4 + Math.floor((wave - 5) / 2), 6)
  const spawnInterval = demo ? 0.01 : Math.max(0.9, 2.2 - (wave - 6) * 0.15)
  const p4 = Math.min(0.34, 0.12 + (wave - 6) * 0.03)
  const tineCounts: TineCount[] = []
  for (let i = 0; i < count; i++) {
    const roll = Math.random()
    tineCounts.push(roll < 0.45 ? 2 : roll < 1 - p4 ? 3 : 4)
  }
  return { wave, count, spawnInterval, speed, tineCounts }
}

function attackTimeForWave(wave: number, index: number): number {
  const base = wave <= 1 ? 25 : wave <= 2 ? 18 : wave <= 4 ? 12 : 8
  const stagger = wave <= 2 ? 6 : 4
  return base + index * stagger
}

function makeInitialRuntime(demo: boolean): Runtime {
  const plan = fixedWaveDirector(1, demo)
  return {
    villagers: [],
    bolts: [],
    bursts: [],
    wave: 1,
    health: STARTING_HEALTH,
    score: 0,
    streak: 0,
    spawned: 0,
    plan,
    spawnClock: 0,
    bannerTimer: 1.1,
    nextWavePending: false,
    animClock: 0,
    gameOver: false,
    firstVillagerId: null,
  }
}

function colorForCents(absCents: number): string | null {
  if (absCents > 300) return null
  if (absCents <= 25) return '#62ff9f'
  const t = Math.min(1, (absCents - 25) / 275)
  const r = Math.round(98 + (245 - 98) * t)
  const g = Math.round(255 + (205 - 255) * t)
  const b = Math.round(159 + (70 - 159) * t)
  return `rgb(${r}, ${g}, ${b})`
}

function drawForkAccuracyRibbon(
  ctx: CanvasRenderingContext2D,
  anchor: Readonly<{ x: number; y: number }>,
  tint: string | null,
  progress: number,
) {
  if (!tint) return

  const width = 26 + progress * 8
  const height = 6 + progress * 3
  const x = anchor.x - width / 2
  const y = anchor.y - height / 2

  ctx.save()
  ctx.shadowColor = tint
  ctx.shadowBlur = 10 + progress * 8
  ctx.globalAlpha = 0.64
  ctx.fillStyle = tint
  ctx.beginPath()
  ctx.roundRect(x, y, width, height, height / 2)
  ctx.fill()
  // bright near-white core (SimplySing "current" pattern) so the ribbon reads as a
  // distinct meter and doesn't camouflage against other same-hue green UI nearby
  // (note-name label outline, fork-glow sprite) -- Argus HIGH finding, C6 refinement.
  ctx.shadowBlur = 4
  ctx.globalAlpha = 0.92
  ctx.fillStyle = '#f4fff9'
  ctx.beginPath()
  ctx.roundRect(anchor.x - width * 0.22, y + height * 0.28, width * 0.44, height * 0.44, height * 0.22)
  ctx.fill()
  ctx.globalAlpha = 0.86
  ctx.shadowBlur = 10 + progress * 8
  ctx.lineWidth = 1
  ctx.strokeStyle = tint
  ctx.beginPath()
  ctx.moveTo(anchor.x - width * 0.5, anchor.y)
  ctx.lineTo(anchor.x - width * 0.28, anchor.y)
  ctx.moveTo(anchor.x + width * 0.28, anchor.y)
  ctx.lineTo(anchor.x + width * 0.5, anchor.y)
  ctx.stroke()
  ctx.restore()
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function hueForNote(note: string | undefined): number {
  return note ? (NOTE_COLORS[note]?.hue ?? 0) : 0
}

function pitchDeviationSemis(source: PitchInfo, targetNote: string): number {
  return exactCents(source.frequency, noteToFreq(targetNote)) / 100
}

type BuildViewStateArgs = Readonly<{
  runtime: Runtime
  phase: Phase
  active: ActiveTarget | null
  activeVillagerId: number | null
  activeKey: string
  chargeProgress: number
  tint: string | null
  noteNamesVisible: boolean
  staffNotationVisible: boolean
  synesthesiaOn: boolean
  reducedMotion: boolean
  timersPaused: boolean
  prompt: string
  tuner: TunerView
  ceremony: NewNoteCeremonyState
  noteMastered: string | null
  noteMasteredAgeMs: number
  waveReceipt: WaveReceiptState
  frankReaction: ViewState['frankReaction']
  shake: ShakeView
  fsrsMemory: Readonly<Record<string, NoteMemory>>
}>

function buildViewState(args: BuildViewStateArgs): ViewState {
  const {
    runtime,
    phase,
    active,
    activeVillagerId,
    activeKey,
    chargeProgress,
    tint,
    noteNamesVisible,
    staffNotationVisible,
    synesthesiaOn,
    reducedMotion,
    timersPaused,
    prompt,
    tuner,
    ceremony,
    noteMastered,
    noteMasteredAgeMs,
    waveReceipt,
    frankReaction,
    shake,
    fsrsMemory,
  } = args
  const newestBolt = runtime.bolts[runtime.bolts.length - 1]
  const ownershipBolt = newestBolt && newestBolt.life / newestBolt.maxLife < STRIKE_IMPACT_START
    ? newestBolt
    : null
  const visualActive = ownershipBolt
    ? {
        villagerId: ownershipBolt.villagerId,
        tineIndex: ownershipBolt.tineIndex,
        note: ownershipBolt.note,
        key: `${ownershipBolt.villagerId}:${ownershipBolt.tineIndex}`,
      }
    : active
      ? {
          villagerId: active.villager.id,
          tineIndex: active.tineIndex,
          note: active.note,
          key: active.key,
        }
      : null
  const promptMatch = /^(Listen|Replay|Sing|Now|Strike):\s+(.+)$/.exec(prompt)
  const visualPrompt = ownershipBolt
    ? `Strike: ${ownershipBolt.note}`
    : visualActive && promptMatch
      ? `${promptMatch[1]}: ${visualActive.note}`
      : prompt
  const chargeLevel = active
    ? Math.max(
        active.villager.burned,
        Math.min(active.villager.totalTines, Math.round(chargeProgress * active.villager.totalTines)),
      )
    : 0
  const receiptNoteStyles: Record<string, NoteChipPalette> = {}
  if (waveReceipt.visible) {
    for (const note of new Set([...waveReceipt.heard, ...waveReceipt.sung, ...waveReceipt.mastered])) {
      receiptNoteStyles[note] = noteChipPalette(note, fsrsMemory)
    }
  }

  return {
    phase,
    animClock: runtime.animClock,
    gameOver: runtime.gameOver,
    villagers: runtime.villagers.map(v => {
      const isActive = ownershipBolt
        ? ownershipBolt.villagerId === v.id
        : activeVillagerId === v.id || activeKey.startsWith(`${v.id}:`)
      const awaitingImpact = runtime.bolts.some(b => (
        b.villagerId === v.id && b.life / b.maxLife < STRIKE_IMPACT_START
      ))
      const visualBurn = awaitingImpact ? Math.max(0, v.burned - 1) : v.burned
      const visualState = awaitingImpact && v.state === 'ash' ? 'walking' : v.state
      const displayBurn = isActive
        ? Math.max(visualBurn, Math.min(v.totalTines, Math.round(chargeProgress * v.totalTines)))
        : visualBurn
      const activeNote = v.notes[Math.min(v.burned, v.notes.length - 1)]
      const mem = fsrsMemory[activeNote] ?? createNote(activeNote)
      const soulR = currentR(mem)
      const soulCalm = retrievability(1, mem.S)
      const soulHue = hueForNote(activeNote)
      return {
        id: v.id,
        totalTines: v.totalTines,
        x: v.x,
        y: v.y,
        lane: v.spawnIndex % 3,
        speed: v.speed,
        notes: [...v.notes],
        burned: v.burned,
        state: v.state,
        visualBurn,
        visualState,
        spawnIndex: v.spawnIndex,
        attackTimer: v.attackTimer,
        attackTimerMax: v.attackTimerMax,
        sequenceCued: v.sequenceCued,
        walkFrame: v.walkFrame,
        ashTimer: v.ashTimer,
        active: isActive,
        displayBurn,
        timerPct: clamp(v.attackTimer / Math.max(0.001, v.attackTimerMax), 0, 1),
        soulR,
        soulCalm,
        soulHue,
      }
    }),
    active: visualActive,
    charge: {
      progress: chargeProgress,
      level: chargeLevel,
      tint,
      charging: chargeProgress > 0 || runtime.bolts.length > 0,
    },
    bolts: runtime.bolts.map(b => ({ ...b })),
    bursts: runtime.bursts.map(b => ({ ...b })),
    frankReaction,
    shake,
    hud: {
      wave: runtime.wave,
      health: runtime.health,
      score: runtime.score,
      streak: runtime.streak,
    },
    waveBanner: {
      visible: runtime.bannerTimer > 0,
      timer: runtime.bannerTimer,
    },
    waveReceipt: {
      ...waveReceipt,
      noteStyles: receiptNoteStyles,
    },
    prompt: {
      visible: !!visualPrompt && !!visualActive,
      text: visualPrompt,
    },
    noteNamesVisible,
    staffNotationVisible,
    synesthesiaOn,
    reducedMotion,
    timersPaused,
    tuner: {
      ...tuner,
      targetNote: ownershipBolt?.note ?? visualActive?.note ?? null,
      sourceNote: ownershipBolt ? null : tuner.sourceNote,
      canUseSource: ownershipBolt ? false : tuner.canUseSource,
      dotDeviation: ownershipBolt ? null : tuner.dotDeviation,
      renderDeviation: ownershipBolt ? null : tuner.renderDeviation,
      onTarget: ownershipBolt ? false : tuner.onTarget,
      trail: tuner.trail.map(point => ({ ...point })),
    },
    ceremony: {
      active: ceremony.active,
      note: ceremony.note,
      toneFired: ceremony.toneFired,
      tonePulseKey: ceremony.tonePulseKey,
    },
    noteMastered,
    noteMasteredAgeMs,
  }
}

function freezeViewStateForDebug(view: ViewState, debug: boolean): ViewState {
  if (debug || process.env.NODE_ENV !== 'production') return Object.freeze(view)
  return view
}

function lightningPhaseFor(chargeProgress: number, bolt?: BoltView): LightningPhase {
  if (bolt) {
    const age = clamp(bolt.life / bolt.maxLife, 0, 1)
    if (age < STRIKE_LEADER_END) return 'strike-leader'
    if (age < STRIKE_RECEIPT_END) return 'strike-receipt'
    if (age < STRIKE_IMPACT_START) return 'strike-discharge'
    return 'strike-impact'
  }
  if (chargeProgress <= 0) return 'idle'
  if (chargeProgress < CHARGE_LEADER_START) return 'charge-cloud'
  if (chargeProgress < CHARGE_DISCHARGE_START) return 'charge-leader'
  return 'charge-discharge'
}

function circuitNoise(seed: number, index: number, bucket: number) {
  const wave = Math.sin(seed * 12.9898 + index * 78.233 + bucket * 37.719) * 43758.5453
  return wave - Math.floor(wave)
}

function lightningBendDeg(bolt?: BoltView): number | null {
  if (!bolt) return null
  const inX = bolt.pivotX - bolt.fromX
  const inY = bolt.pivotY - bolt.fromY
  const outX = CIRCUIT_RELAY_X
  const outY = CIRCUIT_RELAY_Y
  const lengths = Math.hypot(inX, inY) * Math.hypot(outX, outY)
  if (lengths <= 0) return null
  const cos = clamp((inX * outX + inY * outY) / lengths, -1, 1)
  return Math.acos(cos) * (180 / Math.PI)
}

function drawCircuitLeg(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  reveal: number,
  seed: number,
  bucket: number,
  alpha: number,
  hot: boolean,
  branched: boolean,
  reducedMotion: boolean,
) {
  const shown = clamp(reveal, 0, 1)
  if (shown <= 0 || alpha <= 0) return
  const dx = toX - fromX
  const dy = toY - fromY
  const distance = Math.max(1, Math.hypot(dx, dy))
  const nx = -dy / distance
  const ny = dx / distance
  const segments = Math.max(5, Math.min(14, Math.round(distance / 24)))
  const visibleSegments = Math.max(1, Math.ceil(segments * shown))
  const jitter = reducedMotion
    ? 0
    : hot
      ? Math.min(38, Math.max(19, distance * 0.068))
      : Math.min(16, Math.max(7, distance * 0.08))

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (let pass = 0; pass < 3; pass++) {
    let wander = (circuitNoise(seed + 73, 0, bucket) - 0.5) * 0.8
    let priorT = 0
    let priorOffset = 0
    ctx.beginPath()
    ctx.moveTo(fromX, fromY)
    for (let i = 1; i <= visibleSegments; i++) {
      const spacing = (circuitNoise(seed + 29, i, bucket) - 0.5) * 0.7
      const naturalT = clamp((i + spacing) / segments, 0, 1)
      const minT = priorT + 0.24 / segments
      const maxT = shown - ((visibleSegments - i) * 0.44) / segments
      const t = i === visibleSegments ? shown : clamp(naturalT, minT, Math.max(minT, maxT))
      const envelope = Math.sin(Math.PI * t)
      wander = clamp(wander * 0.22 + (circuitNoise(seed + 41, i, bucket) - 0.5) * 1.58, -1, 1)
      const drift = (circuitNoise(seed + 19, i, bucket) - 0.5) * 0.24
      const harmonic = Math.sin(i * 1.47 + seed * 0.07 + bucket * 0.31) * 0.3
      const candidateOffset = (wander * 0.95 + harmonic + drift) * jitter * envelope
      const maxOffsetDelta = Math.max(4, (t - priorT) * distance * (hot ? 1.1 : 0.9))
      const offset = t >= 0.999
        ? 0
        : clamp(candidateOffset, priorOffset - maxOffsetDelta, priorOffset + maxOffsetDelta)
      ctx.lineTo(fromX + dx * t + nx * offset, fromY + dy * t + ny * offset)
      priorT = t
      priorOffset = offset
    }
    if (pass === 0) {
      ctx.strokeStyle = hot ? `rgba(14,165,233,${alpha * 0.46})` : `rgba(59,130,246,${alpha * 0.28})`
      ctx.lineWidth = hot ? 11 : 7
    } else if (pass === 1) {
      ctx.strokeStyle = hot ? `rgba(125,211,252,${alpha * 0.88})` : `rgba(147,197,253,${alpha * 0.62})`
      ctx.lineWidth = hot ? 4.5 : 3
    } else {
      ctx.strokeStyle = `rgba(255,255,255,${alpha * (hot ? 0.94 : 0.72)})`
      ctx.lineWidth = hot ? 1.6 : 1
    }
    ctx.stroke()
  }

  if (hot && branched && !reducedMotion && shown > 0.58) {
    for (let branch = 0; branch < 4; branch++) {
      const t = Math.min(shown, 0.48 + branch * 0.12)
      if (t >= shown) continue
      const envelope = Math.sin(Math.PI * t)
      const offset = (circuitNoise(seed, 30 + branch, bucket) - 0.5) * jitter * envelope
      const ax = fromX + dx * t + nx * offset
      const ay = fromY + dy * t + ny * offset
      const direction = circuitNoise(seed, 40 + branch, bucket) < 0.5 ? -1 : 1
      const length = 20 + circuitNoise(seed, 50 + branch, bucket) * 18
      const along = 4 + circuitNoise(seed, 60 + branch, bucket) * 8
      const midX = ax + nx * length * 0.58 * direction + (dx / distance) * along
      const midY = ay + ny * length * 0.58 * direction + (dy / distance) * along
      const bend = (circuitNoise(seed, 70 + branch, bucket) - 0.5) * 0.8
      const bx = midX + nx * length * 0.42 * (direction + bend) + (dx / distance) * along * 0.7
      const by = midY + ny * length * 0.42 * (direction + bend) + (dy / distance) * along * 0.7
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(midX, midY)
      ctx.lineTo(bx, by)
      ctx.strokeStyle = `rgba(125,211,252,${alpha * 0.62})`
      ctx.lineWidth = 3
      ctx.stroke()
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.76})`
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }
  ctx.restore()
}

function drawStormCloudView(ctx: CanvasRenderingContext2D, view: ViewState, assets: Assets) {
  const bolt = view.bolts[view.bolts.length - 1]
  const charge = view.charge.progress
  if (charge <= 0 && !bolt) return
  const pivotX = FRANK_X + assets.frankMeta.rod_tip.x * FRANK_SPRITE_SCALE
  const pivotY = FRANK_Y + assets.frankMeta.rod_tip.y * FRANK_SPRITE_SCALE
  const cloudX = bolt?.fromX ?? pivotX + FRANK_CLOUD_X_OFFSET
  const cloudY = bolt?.fromY ?? FRANK_CLOUD_Y
  const boltAge = bolt ? clamp(bolt.life / bolt.maxLife, 0, 1) : 0
  const spent = bolt ? clamp((boltAge - STRIKE_RECEIPT_END) / (1 - STRIKE_RECEIPT_END), 0, 1) : 0
  const power = Math.max(charge, bolt ? 1 - boltAge * 0.45 : 0)
  const cloudAlpha = (0.24 + power * 0.58) * (1 - spent * 0.62)
  const bucket = bolt ? Math.floor(bolt.life / CIRCUIT_BUCKET_S) : Math.floor(charge * 20)

  ctx.save()
  const glow = ctx.createRadialGradient(cloudX, cloudY - 8, 2, cloudX, cloudY - 8, 54)
  glow.addColorStop(0, `rgba(125,211,252,${cloudAlpha * 0.34})`)
  glow.addColorStop(1, 'rgba(30,64,175,0)')
  ctx.fillStyle = glow
  ctx.fillRect(cloudX - 56, cloudY - 58, 112, 92)
  for (let i = 0; i < 5; i++) {
    const x = cloudX + (i - 2) * 12
    const y = cloudY - 11 - (i % 2) * 5
    const radiusX = 17 - Math.abs(i - 2) * 1.5
    const radiusY = 10 + (i % 2) * 2
    ctx.fillStyle = `rgba(${30 + i * 4},${38 + i * 4},${61 + i * 6},${cloudAlpha})`
    ctx.beginPath()
    ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = `rgba(8,15,30,${cloudAlpha * 0.94})`
  ctx.beginPath()
  ctx.ellipse(cloudX, cloudY - 4, 37, 11, 0, 0, Math.PI * 2)
  ctx.fill()

  if (charge >= CHARGE_LEADER_START) {
    const reveal = clamp((charge - CHARGE_LEADER_START) / (CHARGE_DISCHARGE_START - CHARGE_LEADER_START), 0, 1)
    drawCircuitLeg(ctx, cloudX, cloudY, pivotX, pivotY, reveal, 71, bucket, 0.2 + charge * 0.48, false, false, view.reducedMotion)
  }
  ctx.restore()
}

function drawBoltView(ctx: CanvasRenderingContext2D, b: BoltView, reducedMotion: boolean) {
  const age = clamp(b.life / b.maxLife, 0, 1)
  const bucket = Math.floor(b.life / CIRCUIT_BUCKET_S)
  const relayX = b.pivotX + CIRCUIT_RELAY_X
  const relayY = b.pivotY + CIRCUIT_RELAY_Y
  const phase = lightningPhaseFor(0, b)
  const fade = 1 - Math.pow(age, 2.2)
  const leaderReveal = reducedMotion ? 1 : clamp(age / STRIKE_LEADER_END, 0, 1)
  const receiptProgress = clamp((age - STRIKE_LEADER_END) / (STRIKE_RECEIPT_END - STRIKE_LEADER_END), 0, 1)
  const dischargeReveal = reducedMotion ? 1 : clamp((age - STRIKE_RECEIPT_END) / (STRIKE_IMPACT_START - STRIKE_RECEIPT_END), 0, 1)
  const impactProgress = clamp((age - STRIKE_IMPACT_START) / (1 - STRIKE_IMPACT_START), 0, 1)
  const incomingAlpha = phase === 'strike-leader' ? 0.95 : phase === 'strike-receipt' ? 0.62 : 0.2 * fade
  const outgoingAlpha = phase === 'strike-impact' ? 0.42 * fade : 0.98

  ctx.save()
  drawCircuitLeg(ctx, b.fromX, b.fromY, b.pivotX, b.pivotY, leaderReveal, b.seed, bucket, incomingAlpha, false, false, reducedMotion)

  if (phase !== 'strike-leader' || reducedMotion) {
    const relayAlpha = reducedMotion ? 0.9 : phase === 'strike-receipt' ? Math.sin(receiptProgress * Math.PI) * 0.95 : 0.5 * fade
    if (relayAlpha > 0.02) {
      const relayGlow = ctx.createRadialGradient(b.pivotX, b.pivotY, 1, b.pivotX, b.pivotY, 24)
      relayGlow.addColorStop(0, `hsla(${b.hue},100%,88%,${relayAlpha * 0.72})`)
      relayGlow.addColorStop(0.35, `hsla(${b.hue},100%,62%,${relayAlpha * 0.38})`)
      relayGlow.addColorStop(1, `hsla(${b.hue},100%,50%,0)`)
      ctx.fillStyle = relayGlow
      ctx.beginPath()
      ctx.arc(b.pivotX, b.pivotY, 24, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.strokeStyle = `rgba(255,255,255,${relayAlpha})`
    ctx.lineWidth = 3.4
    ctx.beginPath()
    ctx.moveTo(b.pivotX, b.pivotY)
    ctx.lineTo(relayX, relayY)
    ctx.stroke()
    ctx.strokeStyle = `hsla(${b.hue},100%,72%,${relayAlpha * 0.92})`
    ctx.lineWidth = 2.8
    ctx.beginPath()
    ctx.arc(b.pivotX, b.pivotY, 7 + receiptProgress * 5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(b.pivotX - 8, b.pivotY)
    ctx.lineTo(b.pivotX + 8, b.pivotY)
    ctx.moveTo(b.pivotX, b.pivotY - 8)
    ctx.lineTo(b.pivotX, b.pivotY + 8)
    ctx.stroke()
  }

  if (phase === 'strike-discharge' || phase === 'strike-impact' || reducedMotion) {
    drawCircuitLeg(ctx, relayX, relayY, b.toX, b.toY, dischargeReveal, b.seed + 97, bucket, outgoingAlpha, true, true, reducedMotion)
  }

  if (phase === 'strike-impact' || reducedMotion) {
    const impactAlpha = reducedMotion ? 0.9 : Math.max(0, (1 - impactProgress) * 0.92)
    const impactRadius = reducedMotion ? 10 : 6 + impactProgress * 22
    const impact = ctx.createRadialGradient(b.toX, b.toY, 0, b.toX, b.toY, impactRadius)
    impact.addColorStop(0, `hsla(${b.hue},100%,92%,${impactAlpha})`)
    impact.addColorStop(0.35, `hsla(${b.hue},100%,65%,${impactAlpha * 0.72})`)
    impact.addColorStop(1, `hsla(${b.hue},100%,50%,0)`)
    ctx.fillStyle = impact
    ctx.beginPath()
    ctx.arc(b.toX, b.toY, impactRadius, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

// C4: reactive lightning while the player HOLDS a note (the buildup), distinct from
// drawBoltView above (the one-shot strike flash). Gated strictly on charge.progress > 0
// — NOT charge.charging, which stays true for ~0.34s after a strike via
// `bolts.length > 0` (FLW consult-20 HIGH finding) and would relight this arc with no
// real hold in progress. Duplicates the tine-position math from the target-glow-ring
// block below rather than extracting a shared helper — CW consult-28: HARD BLOCKER 4 +
// the C0-frozen-core guarantee outweigh DRY on a function this small; a shared helper
// would touch code the ring-render path already ships verified.
function drawChargeArcView(ctx: CanvasRenderingContext2D, view: ViewState, assets: Assets) {
  const progress = view.charge.progress
  if (!view.active || progress < CHARGE_DISCHARGE_START) return
  const villager = view.villagers.find(v => v.id === view.active?.villagerId)
  if (!villager) return
  const meta = assets.villagerMeta[villager.totalTines]
  const tine = meta.tines[Math.max(0, Math.min(view.active.tineIndex, meta.tines.length - 1))]
  const forkPivotX = villager.x + (meta.frame_w - meta.fork_base.x) * SPRITE_SCALE
  const forkPivotY = villager.y + meta.fork_base.y * SPRITE_SCALE
  const rawX = villager.x + (meta.frame_w - tine.x) * SPRITE_SCALE
  const rawY = villager.y + tine.y * SPRITE_SCALE
  const target = rotateAroundPivot(rawX, rawY, forkPivotX, forkPivotY, FORK_LEAN_DEG)

  const pivotX = FRANK_X + assets.frankMeta.rod_tip.x * FRANK_SPRITE_SCALE
  const pivotY = FRANK_Y + assets.frankMeta.rod_tip.y * FRANK_SPRITE_SCALE
  const originX = pivotX + CIRCUIT_RELAY_X
  const originY = pivotY + CIRCUIT_RELAY_Y
  const dischargeProgress = clamp((progress - CHARGE_DISCHARGE_START) / (1 - CHARGE_DISCHARGE_START), 0, 1)
  const reveal = dischargeProgress * CHARGE_PRELOCK_REVEAL_MAX
  const shownTargetX = originX + (target.x - originX) * reveal
  const shownTargetY = originY + (target.y - originY) * reveal

  const lite = chargeArcQuality === 'lite'
  const maxSegments = lite ? 8 : CHARGE_ARC_MAX_SEGMENTS
  const minSegments = lite ? 3 : 4
  const segments = Math.max(minSegments, Math.min(maxSegments, Math.round(minSegments + dischargeProgress * (maxSegments - minSegments))))
  const jitterMag = 7 + dischargeProgress * 20
  const jitterBucket = Math.floor(progress * 20)
  const activeDx = shownTargetX - originX
  const activeDy = shownTargetY - originY
  const activeDistance = Math.max(1, Math.hypot(activeDx, activeDy))
  const activeNx = -activeDy / activeDistance
  const activeNy = activeDx / activeDistance

  // Jitter refresh is quantized to 20 logical charge buckets. The bucket derives
  // from real charge progress rather than rAF time, so identical
  // held states reproduce across devices. The pre-allocated buffer remains hot-path safe.
  const stale = chargeArcPoints[0].x === 0 && chargeArcPoints[0].y === 0
  if (stale || chargeArcJitterBucket !== jitterBucket || chargeArcSegmentCount !== segments) {
    chargeArcJitterBucket = jitterBucket
    chargeArcSegmentCount = segments
    chargeArcPoints[0].x = originX
    chargeArcPoints[0].y = originY
    let wander = (circuitNoise(433, 0, jitterBucket) - 0.5) * 0.8
    for (let i = 1; i < segments; i++) {
      const spacing = (circuitNoise(271, i, jitterBucket) - 0.5) * 0.7
      const t = clamp((i + spacing) / segments, 0, 1)
      wander = clamp(wander * 0.2 + (circuitNoise(419, i, jitterBucket) - 0.5) * 1.58, -1, 1)
      const harmonic = Math.sin(i * 1.53 + jitterBucket * 0.37) * 0.3
      const offset = (wander * 0.96 + harmonic) * jitterMag * Math.sin(Math.PI * t)
      chargeArcPoints[i].x = originX + activeDx * t + activeNx * offset
      chargeArcPoints[i].y = originY + activeDy * t + activeNy * offset
    }
    chargeArcPoints[segments].x = shownTargetX
    chargeArcPoints[segments].y = shownTargetY

    // Branch density, length, and detail all ride the existing segment scale so the
    // forks build with the real charge. Lite/reduced-motion paths pay no branch draw.
    if (lite || view.reducedMotion) {
      chargeArcBranchCount = 0
    } else {
      const segmentScale = (segments - minSegments) / (maxSegments - minSegments)
      chargeArcBranchCount = 2 + Math.round(segmentScale * (CHARGE_ARC_MAX_BRANCHES - 2))
      chargeArcBranchSegments = 2 + Math.round(segmentScale * (CHARGE_ARC_MAX_BRANCH_SEGMENTS - 2))
      const branchLengthScale = 0.55 + segmentScale * 0.4

      for (let branch = 0; branch < chargeArcBranchCount; branch++) {
        const anchorIndex = Math.max(
          1,
          Math.min(segments - 1, Math.round(((branch + 1) * segments) / (chargeArcBranchCount + 1))),
        )
        const before = chargeArcPoints[anchorIndex - 1]
        const after = chargeArcPoints[anchorIndex + 1]
        const anchor = chargeArcPoints[anchorIndex]
        const localDx = after.x - before.x
        const localDy = after.y - before.y
        const localSegmentLength = Math.hypot(localDx, localDy) / 2
        const forkDirection = circuitNoise(401, branch, jitterBucket) < 0.5 ? -1 : 1
        const forkAngle =
          Math.atan2(localDy, localDx) +
          forkDirection * (20 + circuitNoise(503, branch, jitterBucket) * 25) * (Math.PI / 180)
        const branchSegmentLength = localSegmentLength * branchLengthScale
        const points = chargeArcBranchPoints[branch]
        points[0].x = anchor.x
        points[0].y = anchor.y
        for (let point = 1; point <= chargeArcBranchSegments; point++) {
          const stepAngle = forkAngle + (circuitNoise(601 + branch, point, jitterBucket) - 0.5) * 0.32
          points[point].x = points[point - 1].x + Math.cos(stepAngle) * branchSegmentLength
          points[point].y = points[point - 1].y + Math.sin(stepAngle) * branchSegmentLength
        }
      }
    }
  }

  // Peak alpha kept below the strike-flash's (drawBoltView) so the release still
  // reads as the event, not lost in the buildup (CW: strike-swallow risk).
  const alpha = 0.18 + dischargeProgress * 0.52
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const relayAlpha = 0.34 + dischargeProgress * 0.5
  ctx.strokeStyle = `rgba(255,255,255,${relayAlpha})`
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(pivotX, pivotY)
  ctx.lineTo(originX, originY)
  ctx.stroke()
  ctx.strokeStyle = `rgba(125,211,252,${relayAlpha * 0.8})`
  ctx.beginPath()
  ctx.arc(pivotX, pivotY, 5 + dischargeProgress * 3, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(chargeArcPoints[0].x, chargeArcPoints[0].y)
  for (let i = 1; i <= segments; i++) ctx.lineTo(chargeArcPoints[i].x, chargeArcPoints[i].y)

  ctx.globalCompositeOperation = 'source-over'
  ctx.shadowColor = `rgba(80,190,255,${alpha * 0.72})`
  ctx.shadowBlur = lite ? 4 : 9
  ctx.strokeStyle = `rgba(80,190,255,${alpha * 0.5})`
  ctx.lineWidth = lite ? 5 : 11
  ctx.stroke()

  ctx.shadowBlur = lite ? 2 : 5
  ctx.strokeStyle = `rgba(159,231,255,${alpha * 0.82})`
  ctx.lineWidth = lite ? 2.5 : 4.5
  ctx.stroke()

  if (!lite) {
    // additive-blend white core, limited to this one layer only (CW: cost control)
    ctx.globalCompositeOperation = 'lighter'
    ctx.shadowBlur = 0
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`
    ctx.lineWidth = 1.6
    ctx.stroke()
  }

  if (!lite && !view.reducedMotion && chargeArcBranchCount > 0) {
    ctx.beginPath()
    for (let branch = 0; branch < chargeArcBranchCount; branch++) {
      const points = chargeArcBranchPoints[branch]
      ctx.moveTo(points[0].x, points[0].y)
      for (let point = 1; point <= chargeArcBranchSegments; point++) {
        ctx.lineTo(points[point].x, points[point].y)
      }
    }
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = `rgba(80,190,255,${alpha * 0.42})`
    ctx.lineWidth = 4
    ctx.stroke()
    ctx.strokeStyle = `rgba(159,231,255,${alpha * 0.68})`
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.globalCompositeOperation = 'lighter'
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.7})`
    ctx.lineWidth = 0.85
    ctx.stroke()
  }
  ctx.restore()
}

// C5: Frankenstein charging overlay — torso glow + neck-bolt spark arcs, code-only,
// reusing the idle art. Strictly gated on progress>0 (never `charging`, which per
// row-25/FLW stays true post-strike via bolts.length>0 — that would relight this
// with no real hold, the exact fake-feedback failure mode HARD BLOCKER checklist
// item 1 bans). Same 20Hz-jitter-refresh / pre-allocated-buffer discipline as C4's
// drawChargeArcView above (CW: zero per-frame allocation).
function drawFrankChargeView(ctx: CanvasRenderingContext2D, view: ViewState, assets: Assets) {
  const progress = view.charge.progress
  if (progress <= 0) return

  const fm = assets.frankMeta
  const spriteW = fm.frame_w * FRANK_SPRITE_SCALE
  const spriteH = fm.frame_h * FRANK_SPRITE_SCALE
  const cx = FRANK_X + spriteW / 2
  const cy = FRANK_Y + spriteH * 0.42

  // Torso glow — screen-blend radial, same recipe as drawBurstView, scaled by progress.
  // Deliberately supplemental (FLW consult-22 MED): the fork-path feedback stays the
  // primary training surface, this is a secondary reactive read on Frank himself.
  // Argus video-review consult: alpha now ramps on a power curve (progress^1.6), not
  // linear — reads as faint-then-building rather than a near-binary on/off flip.
  const glowRadius = 18 + progress * 28
  const glowAlpha = 0.06 + Math.pow(progress, 1.6) * 0.32
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius)
  gradient.addColorStop(0, `rgba(159,231,255,${glowAlpha})`)
  gradient.addColorStop(1, 'rgba(159,231,255,0)')
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Neck-bolt spark arcs — two short jittered pixel-block trails (Argus consult:
  // snapped to a SPRITE_SCALE-sized grid + filled squares instead of a stroked line,
  // so the effect reads as native pixel-art crackle rather than a smooth vector
  // clashing with the 6x-upscaled sprite; angle skews upward with per-refresh
  // random variance so it crackles rather than reading as a static outward pin).
  const boltY = FRANK_Y + spriteH * 0.31
  const anchors = [
    { x: FRANK_X + spriteW * 0.26, y: boltY, outDir: -1 },
    { x: FRANK_X + spriteW * 0.74, y: boltY, outDir: 1 },
  ]
  const sparkReach = 5 + progress * 11
  const sparkAlpha = 0.16 + Math.pow(progress, 1.4) * 0.68
  const pixelUnit = SPRITE_SCALE
  const snap = (v: number) => Math.round(v / pixelUnit) * pixelUnit

  // R3: logical charge buckets keep the relay crackle reproducible across devices.
  const sparkBucket = Math.floor(progress * 20)
  const refresh = frankSparkJitterBucket !== sparkBucket || frankSparkPoints[0][0].x === 0
  if (refresh) frankSparkJitterBucket = sparkBucket

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let a = 0; a < anchors.length; a++) {
    const anchor = anchors[a]
    const points = frankSparkPoints[a]
    if (refresh) {
      // mostly-upward direction (-90deg) with per-refresh random lean, not a fixed
      // near-horizontal shape — reads as actively arcing, not a static wing/pin.
      const angle = -Math.PI / 2 + anchor.outDir * (0.35 + circuitNoise(701 + a, 0, sparkBucket) * 0.5)
      const dx = Math.cos(angle)
      const dy = Math.sin(angle)
      points[0].x = anchor.x
      points[0].y = anchor.y
      for (let i = 1; i <= FRANK_SPARK_SEGMENTS; i++) {
        const t = i / FRANK_SPARK_SEGMENTS
        points[i].x = anchor.x + dx * t * sparkReach + (circuitNoise(809 + a, i, sparkBucket) - 0.5) * pixelUnit * 1.5
        points[i].y = anchor.y + dy * t * sparkReach + (circuitNoise(907 + a, i, sparkBucket) - 0.5) * pixelUnit * 1.5
      }
    }
    ctx.fillStyle = `rgba(159,231,255,${sparkAlpha})`
    for (let i = 0; i <= FRANK_SPARK_SEGMENTS; i++) {
      const px = snap(points[i].x)
      const py = snap(points[i].y)
      ctx.fillRect(px - pixelUnit / 2, py - pixelUnit / 2, pixelUnit, pixelUnit)
    }
  }
  ctx.restore()
}

function drawBurstView(ctx: CanvasRenderingContext2D, b: BurstView) {
  if (b.life < 0) return
  const progress = clamp(b.life / b.maxLife, 0, 1)
  const fade = Math.max(0, 1 - progress)
  const ease = 1 - Math.pow(1 - progress, 3)
  const kill = b.kind === 'kill'
  const radius = kill ? 18 + ease * 58 : 9 + ease * 24
  const flashAlpha = kill ? 0.46 * fade : 0.28 * fade

  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  const gradient = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, radius)
  gradient.addColorStop(0, `hsla(${b.hue}, 100%, 70%, ${flashAlpha})`)
  gradient.addColorStop(0.42, `hsla(${b.hue}, 95%, 52%, ${flashAlpha * 0.5})`)
  gradient.addColorStop(1, `hsla(${b.hue}, 90%, 45%, 0)`)
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(b.x, b.y, radius, 0, Math.PI * 2)
  ctx.fill()

  ctx.globalAlpha = fade
  ctx.strokeStyle = `hsla(${b.hue}, 100%, ${kill ? 68 : 62}%, ${kill ? 0.82 : 0.58})`
  ctx.lineWidth = kill ? 3 : 1.8
  ctx.beginPath()
  ctx.arc(b.x, b.y, radius * (kill ? 0.76 : 0.62), 0, Math.PI * 2)
  ctx.stroke()

  const sparkCount = kill ? 10 : 5
  for (let i = 0; i < sparkCount; i++) {
    const turn = (i / sparkCount) * Math.PI * 2 + b.seed * 0.019
    const spread = (kill ? 28 : 15) * ease * (0.82 + ((b.seed + i * 23) % 17) / 60)
    const sx = b.x + Math.cos(turn) * spread
    const sy = b.y + Math.sin(turn) * spread * 0.72
    const tail = kill ? 8 : 4
    ctx.strokeStyle = `hsla(${b.hue}, 100%, 72%, ${fade * (kill ? 0.9 : 0.62)})`
    ctx.lineWidth = kill ? 2 : 1.2
    ctx.beginPath()
    ctx.moveTo(sx - Math.cos(turn) * tail, sy - Math.sin(turn) * tail * 0.72)
    ctx.lineTo(sx, sy)
    ctx.stroke()
  }
  ctx.restore()
}

function drawVillagerView(ctx: CanvasRenderingContext2D, v: VillagerView, view: ViewState, assets: Assets) {
  const meta = assets.villagerMeta[v.totalTines]
  const sw = meta.frame_w * SPRITE_SCALE
  const sh = meta.frame_h * SPRITE_SCALE
  let img: HTMLImageElement | undefined
  let strip = false
  if (v.visualState === 'ash' || v.visualBurn >= v.totalTines) {
    img = assets.ashLeft[v.totalTines]
  } else if (v.visualBurn > 0) {
    img = assets.burnedLeft[`${v.totalTines}_${v.visualBurn}`]
  } else {
    img = assets.walkLeft[v.totalTines]
    strip = true
  }
  if (!img) return

  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.beginPath()
  ctx.ellipse(v.x + sw / 2, v.y + sh - 4, sw * 0.38, 5, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.imageSmoothingEnabled = false
  const agitation = clamp(1 - v.soulR, 0, 1)
  const calm = clamp(v.soulCalm, 0, 1)
  let offsetPx = agitation * 1.0 * Math.sin(view.animClock * 1.35 + v.spawnIndex * 0.73)
  offsetPx *= 1 - calm * 0.7
  if (view.reducedMotion) offsetPx = 0
  const spriteX = v.x + offsetPx
  const spriteY = v.y + offsetPx * 0.35
  if (strip) {
    ctx.drawImage(img, v.walkFrame * meta.frame_w, 0, meta.frame_w, meta.frame_h, spriteX, spriteY, sw, sh)
  } else {
    ctx.drawImage(img, spriteX, spriteY, sw, sh)
  }

  if (v.visualState !== 'walking') return
  const progress = v.active ? view.charge.progress : 0
  const forkKey = `${v.totalTines}_${v.displayBurn}`
  const baseImg = assets.fork[forkKey] ?? assets.fork[`${v.totalTines}_${v.visualBurn}`]
  const glowImg = assets.forkGlow[forkKey] ?? assets.forkGlow[`${v.totalTines}_${v.visualBurn}`]
  const forkMeta = assets.forkMeta[v.totalTines]
  const forkW = forkMeta.frame_w * SPRITE_SCALE
  const forkH = forkMeta.frame_h * SPRITE_SCALE
  const fx = v.x + (meta.frame_w - meta.fork_base.x) * SPRITE_SCALE - (forkMeta.frame_w - forkMeta.handle_base.x) * SPRITE_SCALE
  const fy = v.y + meta.fork_base.y * SPRITE_SCALE - forkMeta.handle_base.y * SPRITE_SCALE
  const forkPivotX = v.x + (meta.frame_w - meta.fork_base.x) * SPRITE_SCALE
  const forkPivotY = v.y + meta.fork_base.y * SPRITE_SCALE

  if (baseImg) {
    ctx.save()
    ctx.translate(forkPivotX, forkPivotY)
    ctx.rotate((FORK_LEAN_DEG * Math.PI) / 180)
    ctx.translate(-forkPivotX, -forkPivotY)
    ctx.translate(fx + forkW, fy)
    ctx.scale(-1, 1)
    ctx.drawImage(baseImg, 0, 0, forkW, forkH)
    if (v.active && glowImg) {
      ctx.globalAlpha = clamp(0.25 + progress * 0.75 + agitation * 0.15 * (1 - calm * 0.5), 0, 1)
      ctx.drawImage(glowImg, 0, 0, forkW, forkH)
    }
    ctx.restore()
  }

  const tineTipAnchor = rotateAroundPivot(fx + forkW / 2, fy + 7, forkPivotX, forkPivotY, FORK_LEAN_DEG)
  const noteLabelAnchor = rotateAroundPivot(fx + forkW / 2, fy - 7, forkPivotX, forkPivotY, FORK_LEAN_DEG)

  if (view.synesthesiaOn) {
    // Argus MED (C7 same-session): a flat same-alpha wash camouflages against
    // UI elements sharing this note's hue family (e.g. the cyan G4 note-name
    // badge). Fix mirrors C6's white-core-pip pattern: a bright saturated
    // core fading through the note hue to transparent reads as a distinct
    // aura instead of a flat color bleed.
    const auraRadius = 6 + progress * 3
    const auraGradient = ctx.createRadialGradient(
      tineTipAnchor.x, tineTipAnchor.y, 0,
      tineTipAnchor.x, tineTipAnchor.y, auraRadius,
    )
    auraGradient.addColorStop(0, `hsla(${v.soulHue}, 90%, 88%, 0.55)`)
    auraGradient.addColorStop(0.45, `hsla(${v.soulHue}, 80%, 65%, 0.32)`)
    auraGradient.addColorStop(1, `hsla(${v.soulHue}, 70%, 60%, 0)`)
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = auraGradient
    ctx.beginPath()
    ctx.arc(tineTipAnchor.x, tineTipAnchor.y, auraRadius, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  if (v.active && view.charge.tint) {
    drawForkAccuracyRibbon(ctx, tineTipAnchor, view.charge.tint, progress)
  }

  if (v.active && view.noteNamesVisible) {
    const note = v.notes[Math.min(v.visualBurn, v.notes.length - 1)]
    ctx.font = 'bold 14px monospace'
    ctx.textAlign = 'center'
    const lx = noteLabelAnchor.x
    const ly = noteLabelAnchor.y
    const tw = ctx.measureText(note).width + 12
    ctx.fillStyle = 'rgba(8, 10, 18, 0.86)'
    ctx.strokeStyle = view.charge.tint ?? 'rgba(130,210,255,0.62)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(lx - tw / 2, ly - 14, tw, 18, 5)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#f4f7fb'
    ctx.fillText(note, lx, ly)
  }

  if (v.active) {
    // ported from Pitchforks.tsx:576-584, using III's per-villager timer.
    const barW = 58
    const barH = 5
    const bx = v.x + sw / 2 - barW / 2
    const by = v.y - 25
    ctx.fillStyle = 'rgba(8, 10, 18, 0.88)'
    ctx.fillRect(bx, by, barW, barH)
    ctx.fillStyle = view.timersPaused ? '#7dd3fc' : v.timerPct > 0.3 ? '#fbbf24' : '#ef4444'
    ctx.fillRect(bx, by, barW * v.timerPct, barH)
    ctx.strokeStyle = view.timersPaused ? 'rgba(125,211,252,0.85)' : '#555'
    ctx.lineWidth = 1
    ctx.strokeRect(bx, by, barW, barH)
  }
}

function drawPitchBarView(ctx: CanvasRenderingContext2D, tuner: TunerView) {
  // ported from Pitchforks.tsx:602-658, with a 1s convergence trail.
  const centerX = PITCH_BAR_X + PITCH_BAR_W / 2
  const centerY = PITCH_BAR_Y + PITCH_BAR_H / 2
  const targetZoneW = PITCH_BAR_W * ((MATCH_TOLERANCE_CENTS / 100) / 6)

  ctx.fillStyle = 'rgba(20,20,30,0.78)'
  ctx.fillRect(PITCH_BAR_X, PITCH_BAR_Y, PITCH_BAR_W, PITCH_BAR_H)
  ctx.strokeStyle = '#333'
  ctx.lineWidth = 1
  ctx.strokeRect(PITCH_BAR_X, PITCH_BAR_Y, PITCH_BAR_W, PITCH_BAR_H)
  ctx.save()
  ctx.strokeStyle = 'rgba(253, 186, 116, 0.62)'
  ctx.fillStyle = 'rgba(253, 186, 116, 0.48)'
  ctx.shadowColor = '#fdba74'
  ctx.shadowBlur = 4
  ctx.lineWidth = 1
  ctx.lineCap = 'round'
  const left = PITCH_BAR_X
  const right = PITCH_BAR_X + PITCH_BAR_W
  const top = PITCH_BAR_Y
  const bottom = PITCH_BAR_Y + PITCH_BAR_H
  const drawCornerRune = (x: number, y: number, sx: 1 | -1, sy: 1 | -1) => {
    ctx.beginPath()
    ctx.moveTo(x + sx * 4, y + sy * 1)
    ctx.lineTo(x + sx * 12, y + sy * 1)
    ctx.moveTo(x + sx * 1, y + sy * 4)
    ctx.lineTo(x + sx * 1, y + sy * 12)
    ctx.moveTo(x + sx * 7, y + sy * 4)
    ctx.lineTo(x + sx * 13, y + sy * 10)
    ctx.moveTo(x + sx * 4, y + sy * 7)
    ctx.lineTo(x + sx * 10, y + sy * 13)
    ctx.stroke()
  }
  const drawDiamond = (x: number, y: number) => {
    ctx.beginPath()
    ctx.moveTo(x, y - 3)
    ctx.lineTo(x + 3, y)
    ctx.lineTo(x, y + 3)
    ctx.lineTo(x - 3, y)
    ctx.closePath()
    ctx.fill()
  }
  drawCornerRune(left, top, 1, 1)
  drawCornerRune(right, top, -1, 1)
  drawCornerRune(left, bottom, 1, -1)
  drawCornerRune(right, bottom, -1, -1)
  drawDiamond(centerX, top)
  drawDiamond(centerX, bottom)
  drawDiamond(left, centerY)
  drawDiamond(right, centerY)
  ctx.restore()
  ctx.fillStyle = 'rgba(74,222,128,0.16)'
  ctx.fillRect(centerX - targetZoneW / 2, PITCH_BAR_Y, targetZoneW, PITCH_BAR_H)

  const semisToCents = (semis: number) => Math.min(300, Math.abs(semis) * 100)
  const xForDeviation = (deviation: number) => {
    const clamped = clamp(deviation, -6, 6)
    return centerX + (clamped / 6) * (PITCH_BAR_W / 2)
  }

  const trail = tuner.trail
  if (trail.length > 1) {
    for (let i = 1; i < trail.length; i++) {
      const prev = trail[i - 1]
      const cur = trail[i]
      const alpha = clamp(1 - (tuner.now - cur.at) / TRAIL_MS, 0, 1)
      ctx.strokeStyle = `rgba(125, 211, 252, ${0.08 + alpha * 0.22})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(xForDeviation(prev.deviation), centerY)
      ctx.lineTo(xForDeviation(cur.deviation), centerY)
      ctx.stroke()
    }
  }
  for (const point of trail) {
    const alpha = clamp(1 - (tuner.now - point.at) / TRAIL_MS, 0, 1)
    ctx.save()
    ctx.globalAlpha = 0.08 + alpha * 0.36
    ctx.fillStyle = colorForCents(semisToCents(point.deviation)) ?? '#f87171'
    ctx.beginPath()
    ctx.arc(xForDeviation(point.deviation), centerY, 2 + alpha * 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  if (tuner.canUseSource && tuner.renderDeviation !== null) {
    const dotX = xForDeviation(tuner.renderDeviation)
    const dotColor = colorForCents(semisToCents(tuner.renderDeviation)) ?? '#f87171'
    if (tuner.onTarget) {
      ctx.save()
      ctx.globalAlpha = 0.3
      ctx.fillStyle = dotColor
      ctx.beginPath()
      ctx.arc(dotX, centerY, 11, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    ctx.fillStyle = dotColor
    ctx.beginPath()
    ctx.arc(dotX, centerY, 5.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.font = 'bold 9px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(tuner.sourceNote || '', dotX, PITCH_BAR_Y - 4)
  } else {
    ctx.fillStyle = '#555'
    ctx.font = '8px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('sing...', centerX, centerY + 3)
  }

  if (tuner.targetNote) {
    // Argus video-review consult: low contrast against the dark dungeon floor in green;
    // switched to the brand-orange highlight (matches the C5 UI-reskin palette) for
    // readability under duress, per the explicit suggested fix.
    ctx.fillStyle = '#fdba74'
    ctx.font = '8px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`target: ${tuner.targetNote}`, centerX, PITCH_BAR_Y + PITCH_BAR_H + 12)
  }
}

const STAFF_PANEL_X = 430
const STAFF_PANEL_Y = 54
const STAFF_PANEL_W = 274
const STAFF_PANEL_H = 112
const STAFF_LEFT = STAFF_PANEL_X + 42
const STAFF_RIGHT = STAFF_PANEL_X + STAFF_PANEL_W - 12
const STAFF_BOTTOM_LINE_Y = STAFF_PANEL_Y + 55
const STAFF_LINE_GAP = 8
const STAFF_LETTER_STEP = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 } as const

type StaffNote = Readonly<{
  name: string
  letter: keyof typeof STAFF_LETTER_STEP
  accidental: '' | '#' | 'b'
  octave: number
  stepFromE4: number
}>

function staffNote(note: string | null): StaffNote | null {
  if (!note) return null
  const match = /^([A-G])([#b]?)(-?\d+)$/.exec(note)
  if (!match) return null
  const letter = match[1] as StaffNote['letter']
  const accidental = match[2] as StaffNote['accidental']
  const octave = Number(match[3])
  return {
    name: note,
    letter,
    accidental,
    octave,
    stepFromE4: octave * 7 + STAFF_LETTER_STEP[letter] - (4 * 7 + STAFF_LETTER_STEP.E),
  }
}

function staffY(note: StaffNote): number {
  return STAFF_BOTTOM_LINE_Y - note.stepFromE4 * (STAFF_LINE_GAP / 2)
}

function drawLedgerLines(ctx: CanvasRenderingContext2D, x: number, note: StaffNote) {
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.72)'
  ctx.lineWidth = 1
  if (note.stepFromE4 < 0) {
    for (let step = -2; step >= note.stepFromE4; step -= 2) {
      const y = STAFF_BOTTOM_LINE_Y - step * (STAFF_LINE_GAP / 2)
      ctx.beginPath()
      ctx.moveTo(x - 11, y)
      ctx.lineTo(x + 11, y)
      ctx.stroke()
    }
  } else if (note.stepFromE4 > 8) {
    for (let step = 10; step <= note.stepFromE4; step += 2) {
      const y = STAFF_BOTTOM_LINE_Y - step * (STAFF_LINE_GAP / 2)
      ctx.beginPath()
      ctx.moveTo(x - 11, y)
      ctx.lineTo(x + 11, y)
      ctx.stroke()
    }
  }
}

function drawStaffNoteHead(
  ctx: CanvasRenderingContext2D,
  note: StaffNote,
  x: number,
  spent: boolean,
  target: boolean,
) {
  const y = staffY(note)
  drawLedgerLines(ctx, x, note)

  ctx.save()
  ctx.globalAlpha = spent ? 0.42 : 1
  ctx.fillStyle = spent ? '#9ca3af' : '#86efac'
  ctx.strokeStyle = spent ? '#4b5563' : '#166534'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.ellipse(x, y, 7, 4.5, -0.28, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  const stemDown = note.stepFromE4 >= 4
  ctx.beginPath()
  ctx.moveTo(x + (stemDown ? -6 : 6), y + (stemDown ? 1 : -1))
  ctx.lineTo(x + (stemDown ? -6 : 6), y + (stemDown ? 22 : -22))
  ctx.stroke()
  if (note.accidental) {
    ctx.fillStyle = spent ? '#9ca3af' : '#e5e7eb'
    ctx.font = '15px "Segoe UI Symbol", serif'
    ctx.textAlign = 'center'
    ctx.fillText(note.accidental === '#' ? '♯' : '♭', x - 12, y + 5)
  }
  ctx.restore()

  if (spent) {
    ctx.save()
    ctx.strokeStyle = '#d1d5db'
    ctx.lineWidth = 2
    ctx.globalAlpha = 0.82
    ctx.beginPath()
    ctx.moveTo(x - 10, y + 8)
    ctx.lineTo(x + 10, y - 8)
    ctx.stroke()
    ctx.restore()
  } else if (target) {
    ctx.save()
    ctx.strokeStyle = '#fdba74'
    ctx.shadowColor = '#fdba74'
    ctx.shadowBlur = 8
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(x, y, 11, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
}

function drawStaffNotationView(ctx: CanvasRenderingContext2D, view: ViewState) {
  if (!view.tuner.visible) return

  ctx.save()
  ctx.fillStyle = 'rgba(7, 9, 20, 0.9)'
  ctx.strokeStyle = 'rgba(253, 186, 116, 0.48)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(STAFF_PANEL_X, STAFF_PANEL_Y, STAFF_PANEL_W, STAFF_PANEL_H, 8)
  ctx.fill()
  ctx.stroke()

  ctx.strokeStyle = 'rgba(226, 232, 240, 0.72)'
  for (let line = 0; line < 5; line++) {
    const y = STAFF_BOTTOM_LINE_Y - line * STAFF_LINE_GAP
    ctx.beginPath()
    ctx.moveTo(STAFF_LEFT, y)
    ctx.lineTo(STAFF_RIGHT, y)
    ctx.stroke()
  }

  ctx.fillStyle = '#e5e7eb'
  ctx.font = '54px "Segoe UI Symbol", "Noto Music", serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('𝄞', STAFF_PANEL_X + 25, STAFF_BOTTOM_LINE_Y + 17)

  const activeVillager = view.active
    ? view.villagers.find(villager => villager.id === view.active?.villagerId)
    : null
  const queue = activeVillager?.notes ?? []
  const queueLeft = STAFF_LEFT + 42
  const queueRight = STAFF_RIGHT - 24
  const stepX = queue.length > 1 ? (queueRight - queueLeft) / (queue.length - 1) : 0

  for (let index = 0; index < queue.length; index++) {
    const note = staffNote(queue[index])
    if (!note) continue
    const x = queue.length === 1 ? (queueLeft + queueRight) / 2 : queueLeft + stepX * index
    const spent = !!activeVillager && index < activeVillager.visualBurn
    const target = !!activeVillager && index === activeVillager.visualBurn
    drawStaffNoteHead(ctx, note, x, spent, target)

    if (view.noteNamesVisible) {
      ctx.save()
      ctx.globalAlpha = spent ? 0.45 : 1
      ctx.fillStyle = spent ? '#9ca3af' : '#bbf7d0'
      ctx.font = 'bold 9px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(note.name, x, STAFF_PANEL_Y + STAFF_PANEL_H - 7)
      if (spent) {
        const width = ctx.measureText(note.name).width + 4
        ctx.strokeStyle = '#d1d5db'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(x - width / 2, STAFF_PANEL_Y + STAFF_PANEL_H - 10)
        ctx.lineTo(x + width / 2, STAFF_PANEL_Y + STAFF_PANEL_H - 10)
        ctx.stroke()
      }
      ctx.restore()
    }
  }

  const source = staffNote(view.tuner.sourceNote)
  if (
    source &&
    activeVillager &&
    view.tuner.canUseSource &&
    view.tuner.renderDeviation !== null &&
    activeVillager.burned < queue.length
  ) {
    const targetX = queue.length === 1
      ? (queueLeft + queueRight) / 2
      : queueLeft + stepX * activeVillager.burned
    const rawSourceY = staffY(source)
    const sourceY = clamp(rawSourceY, STAFF_PANEL_Y + 8, STAFF_PANEL_Y + STAFF_PANEL_H - 16)
    const cents = Math.min(300, Math.abs(view.tuner.renderDeviation) * 100)
    const color = colorForCents(cents) ?? '#f87171'
    if (sourceY === rawSourceY) drawLedgerLines(ctx, targetX, source)
    ctx.save()
    ctx.fillStyle = color
    ctx.strokeStyle = '#071018'
    ctx.lineWidth = 1.5
    ctx.shadowColor = color
    ctx.shadowBlur = view.tuner.onTarget ? 10 : 4
    ctx.beginPath()
    ctx.moveTo(targetX, sourceY - 5)
    ctx.lineTo(targetX + 5, sourceY)
    ctx.lineTo(targetX, sourceY + 5)
    ctx.lineTo(targetX - 5, sourceY)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    if (view.noteNamesVisible) {
      ctx.shadowBlur = 0
      ctx.fillStyle = '#f4f7fb'
      ctx.font = 'bold 9px monospace'
      ctx.textAlign = 'left'
      ctx.fillText(source.name, targetX + 8, sourceY + 3)
    }
    ctx.restore()
  }

  ctx.restore()
}

function drawDungeonArch(ctx: CanvasRenderingContext2D, cx: number, topY: number, width: number, bottomY: number) {
  const radius = width / 2

  ctx.save()
  ctx.beginPath()
  ctx.moveTo(cx - radius, bottomY)
  ctx.lineTo(cx - radius, topY + radius)
  ctx.arc(cx, topY + radius, radius, Math.PI, 0)
  ctx.lineTo(cx + radius, bottomY)
  ctx.closePath()
  const recess = ctx.createLinearGradient(cx, topY, cx, bottomY)
  recess.addColorStop(0, '#050608')
  recess.addColorStop(0.58, '#10110d')
  recess.addColorStop(1, '#18180f')
  ctx.fillStyle = recess
  ctx.fill()

  ctx.lineWidth = 9
  ctx.strokeStyle = 'rgba(52, 49, 39, 0.76)'
  ctx.stroke()
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(168, 139, 86, 0.16)'
  ctx.stroke()
  ctx.restore()
}

function drawDungeonFloor(ctx: CanvasRenderingContext2D) {
  const floor = ctx.createLinearGradient(0, DUNGEON_FLOOR_Y, 0, H)
  floor.addColorStop(0, '#202018')
  floor.addColorStop(0.55, '#29251a')
  floor.addColorStop(1, '#15140f')
  ctx.fillStyle = floor
  ctx.fillRect(0, DUNGEON_FLOOR_Y, W, H - DUNGEON_FLOOR_Y)

  const path = ctx.createLinearGradient(0, DUNGEON_FLOOR_Y, 0, H)
  path.addColorStop(0, 'rgba(79, 72, 52, 0.32)')
  path.addColorStop(1, 'rgba(35, 31, 23, 0.72)')
  ctx.beginPath()
  ctx.moveTo(82, DUNGEON_FLOOR_Y)
  ctx.lineTo(W - 82, DUNGEON_FLOOR_Y)
  ctx.lineTo(W + 64, H)
  ctx.lineTo(-64, H)
  ctx.closePath()
  ctx.fillStyle = path
  ctx.fill()

  ctx.save()
  ctx.lineWidth = 1
  ctx.strokeStyle = 'rgba(238, 221, 166, 0.08)'
  for (let i = 1; i <= 5; i++) {
    const t = i / 5
    const y = DUNGEON_FLOOR_Y + Math.pow(t, 1.45) * (H - DUNGEON_FLOOR_Y)
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)'
  for (let i = -4; i <= 4; i++) {
    const bottomX = W / 2 + i * 92
    ctx.beginPath()
    ctx.moveTo(W / 2, DUNGEON_FLOOR_Y - 22)
    ctx.lineTo(bottomX, H)
    ctx.stroke()
  }
  ctx.restore()
}

function drawDungeonTorchGlow(
  ctx: CanvasRenderingContext2D,
  torch: (typeof DUNGEON_TORCHES)[number],
  animClock: number,
) {
  const flicker =
    Math.sin(animClock * 5.7 + torch.phase) * 0.55 +
    Math.sin(animClock * 12.3 + torch.phase * 1.6) * 0.45
  const radius = 54 + flicker * 7
  const alpha = 0.15 + flicker * 0.025

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const glow = ctx.createRadialGradient(torch.x, torch.y, 0, torch.x, torch.y, radius)
  glow.addColorStop(0, `rgba(255, 179, 72, ${alpha})`)
  glow.addColorStop(0.38, `rgba(205, 91, 32, ${alpha * 0.42})`)
  glow.addColorStop(1, 'rgba(105, 45, 20, 0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(torch.x, torch.y, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawDungeonTorchFixture(
  ctx: CanvasRenderingContext2D,
  torch: (typeof DUNGEON_TORCHES)[number],
  animClock: number,
) {
  const flameShift = Math.sin(animClock * 9.2 + torch.phase) * 2

  ctx.save()
  ctx.strokeStyle = 'rgba(61, 46, 32, 0.78)'
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(torch.x - 10, torch.y + 19)
  ctx.lineTo(torch.x + 7, torch.y + 6)
  ctx.stroke()

  ctx.fillStyle = '#3b2c20'
  ctx.fillRect(torch.x - 14, torch.y + 17, 18, 5)

  ctx.globalCompositeOperation = 'lighter'
  ctx.fillStyle = 'rgba(255, 130, 38, 0.8)'
  ctx.beginPath()
  ctx.ellipse(torch.x, torch.y + 2, 7, 12 + flameShift, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255, 230, 128, 0.86)'
  ctx.beginPath()
  ctx.ellipse(torch.x + 1, torch.y + 1, 3.5, 7 + flameShift * 0.45, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawDungeonBackground(ctx: CanvasRenderingContext2D, animClock: number) {
  const wall = ctx.createLinearGradient(0, 0, 0, H)
  wall.addColorStop(0, '#07080c')
  wall.addColorStop(0.32, '#171816')
  wall.addColorStop(0.72, '#222016')
  wall.addColorStop(1, '#11130d')
  ctx.fillStyle = wall
  ctx.fillRect(0, 0, W, H)

  ctx.save()
  ctx.lineWidth = 1
  for (let row = 0; row < 12; row++) {
    const y = 12 + row * 24
    ctx.strokeStyle = 'rgba(238, 226, 178, 0.06)'
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)'
    const offset = row % 2 === 0 ? 0 : 45
    for (let x = offset; x < W + 92; x += 92) {
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - 5 + (row % 3) * 3, Math.min(DUNGEON_FLOOR_Y, y + 23))
      ctx.stroke()
    }
  }

  ctx.fillStyle = 'rgba(122, 141, 74, 0.12)'
  ctx.fillRect(0, DUNGEON_FLOOR_Y - 18, W, 18)
  for (let i = 0; i < 42; i++) {
    const x = (i * 67 + 19) % W
    const y = 28 + ((i * 41 + 11) % 226)
    ctx.fillStyle = i % 3 === 0 ? 'rgba(205, 197, 155, 0.1)' : 'rgba(0, 0, 0, 0.16)'
    ctx.fillRect(x, y, 2 + (i % 2), 1)
  }
  ctx.restore()

  drawDungeonArch(ctx, 96, 72, 92, DUNGEON_FLOOR_Y + 8)
  drawDungeonArch(ctx, 274, 54, 122, DUNGEON_FLOOR_Y + 18)
  drawDungeonArch(ctx, 462, 58, 112, DUNGEON_FLOOR_Y + 14)
  drawDungeonArch(ctx, 642, 84, 82, DUNGEON_FLOOR_Y + 6)
  drawDungeonFloor(ctx)

  for (const torch of DUNGEON_TORCHES) drawDungeonTorchGlow(ctx, torch, animClock)
  for (const torch of DUNGEON_TORCHES) drawDungeonTorchFixture(ctx, torch, animClock)

  const vignette = ctx.createRadialGradient(W / 2, GROUND_Y - 78, 160, W / 2, GROUND_Y - 78, 430)
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)')
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.44)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, W, H)
}

function drawNoteMasteredCeremony(
  ctx: CanvasRenderingContext2D,
  note: string,
  ageMs: number,
  animClock: number,
  reducedMotion: boolean,
) {
  const progress = clamp(ageMs / NOTE_MASTERED_CEREMONY_MS, 0, 1)
  const alpha = Math.min(clamp(progress / 0.18, 0, 1), clamp((1 - progress) / 0.24, 0, 1))
  if (alpha <= 0) return

  const hue = hueForNote(note)
  const cx = W / 2
  const cy = 190
  const settle = 1 - Math.pow(1 - progress, 3)
  const pulse = reducedMotion ? 0 : Math.sin(animClock * 2.4) * 2.5

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = 'rgba(2, 7, 14, 0.64)'
  ctx.fillRect(0, 128, W, 124)

  const glow = ctx.createRadialGradient(cx, cy, 8, cx, cy, 164)
  glow.addColorStop(0, `hsla(${hue}, 96%, 70%, 0.34)`)
  glow.addColorStop(0.42, `hsla(${hue}, 82%, 42%, 0.16)`)
  glow.addColorStop(1, `hsla(${hue}, 70%, 18%, 0)`)
  ctx.fillStyle = glow
  ctx.fillRect(0, 72, W, 236)

  ctx.lineCap = 'round'
  for (let i = 0; i < 3; i++) {
    const ringProgress = clamp(settle - i * 0.12, 0, 1)
    const radius = 76 - ringProgress * 30 + i * 10 + pulse
    ctx.strokeStyle = `hsla(${hue}, ${92 - i * 10}%, ${68 - i * 6}%, ${0.38 - i * 0.08})`
    ctx.lineWidth = 2.4 - i * 0.35
    ctx.beginPath()
    ctx.arc(cx, cy, radius, Math.PI * 0.08, Math.PI * 1.92)
    ctx.stroke()
  }

  ctx.fillStyle = `hsla(${hue}, 92%, 78%, 0.92)`
  ctx.font = 'bold 15px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('NOTE MASTERED', cx, cy - 32)

  ctx.fillStyle = '#f7fbff'
  ctx.shadowColor = `hsla(${hue}, 96%, 70%, 0.72)`
  ctx.shadowBlur = 18
  ctx.font = 'bold 42px monospace'
  ctx.fillText(note, cx, cy + 16)

  ctx.shadowBlur = 0
  ctx.strokeStyle = `hsla(${hue}, 90%, 72%, 0.72)`
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(cx - 68, cy + 36)
  ctx.lineTo(cx - 18, cy + 36)
  ctx.moveTo(cx + 18, cy + 36)
  ctx.lineTo(cx + 68, cy + 36)
  ctx.stroke()
  ctx.restore()
}

function waveReceiptChipWidth(ctx: CanvasRenderingContext2D, note: string, noteNamesVisible: boolean) {
  ctx.font = 'bold 13px monospace'
  return noteNamesVisible ? Math.max(36, Math.ceil(ctx.measureText(note).width) + 18) : 24
}

function measureWaveReceiptRows(
  ctx: CanvasRenderingContext2D,
  notes: readonly string[],
  noteNamesVisible: boolean,
  startX: number,
  maxX: number,
) {
  if (notes.length === 0) return 1
  let rows = 1
  let x = startX
  for (const note of notes) {
    const width = waveReceiptChipWidth(ctx, note, noteNamesVisible)
    if (x > startX && x + width > maxX) {
      rows += 1
      x = startX
    }
    x += width + 8
  }
  return rows
}

function drawWaveReceiptChip(
  ctx: CanvasRenderingContext2D,
  note: string,
  x: number,
  y: number,
  noteNamesVisible: boolean,
  palette: NoteChipPalette,
  mastered: boolean,
) {
  const width = waveReceiptChipWidth(ctx, note, noteNamesVisible)
  const height = 24
  const gradient = ctx.createLinearGradient(0, y - height / 2, 0, y + height / 2)
  gradient.addColorStop(0, `hsla(${palette.hue}, ${palette.saturation}%, ${palette.fillLight + 7}%, 0.88)`)
  gradient.addColorStop(1, `hsla(${palette.hue}, ${palette.saturation}%, ${palette.fillLight}%, 0.72)`)

  ctx.save()
  ctx.shadowColor = `hsla(${palette.hue}, ${palette.saturation}%, ${palette.borderLight}%, ${mastered ? 0.44 : palette.glowAlpha})`
  ctx.shadowBlur = mastered ? Math.max(16, palette.glowPx + 6) : palette.glowPx
  ctx.fillStyle = gradient
  ctx.strokeStyle = `hsla(${palette.hue}, ${palette.saturation}%, ${mastered ? 72 : palette.borderLight}%, ${mastered ? 0.9 : 0.86})`
  ctx.lineWidth = mastered ? 1.6 : 1
  ctx.beginPath()
  ctx.roundRect(x, y - height / 2, width, height, 6)
  ctx.fill()
  ctx.stroke()

  if (noteNamesVisible) {
    ctx.shadowBlur = 0
    ctx.fillStyle = mastered ? '#f7fbff' : `hsl(${palette.hue}, ${palette.saturation}%, ${palette.textLight}%)`
    ctx.font = 'bold 13px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(note, x + width / 2, y + 1)
  }
  ctx.restore()
  return width
}

function drawWaveReceiptRow(
  ctx: CanvasRenderingContext2D,
  receipt: WaveReceiptView,
  label: string,
  notes: readonly string[],
  y: number,
  noteNamesVisible: boolean,
  mastered: boolean,
) {
  const labelX = 112
  const chipStartX = 228
  const maxX = W - 112
  let x = chipStartX
  let chipY = y + 12

  ctx.font = 'bold 12px monospace'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = mastered ? '#f7fbff' : '#a9b5c8'
  ctx.fillText(label, labelX, chipY)

  if (notes.length === 0) {
    ctx.fillStyle = 'rgba(211, 222, 238, 0.5)'
    ctx.font = 'bold 11px monospace'
    ctx.fillText('NONE', chipStartX, chipY)
    return y + 30
  }

  for (const note of notes) {
    const palette = receipt.noteStyles[note] ?? noteChipPalette(note, {})
    const width = waveReceiptChipWidth(ctx, note, noteNamesVisible)
    if (x > chipStartX && x + width > maxX) {
      x = chipStartX
      chipY += 30
    }
    drawWaveReceiptChip(ctx, note, x, chipY, noteNamesVisible, palette, mastered)
    x += width + 8
  }

  return chipY + 18
}

function drawWaveReceipt(
  ctx: CanvasRenderingContext2D,
  receipt: WaveReceiptView,
  noteNamesVisible: boolean,
  animClock: number,
  reducedMotion: boolean,
) {
  if (!receipt.visible) return

  const durationSeconds = WAVE_RECEIPT_MS / 1000
  const alpha = Math.min(1, receipt.timer / 0.18, (durationSeconds - receipt.timer) / 0.22)
  if (alpha <= 0) return

  const cardX = 80
  const cardW = W - cardX * 2
  const chipStartX = 228
  const maxX = W - 112
  const heardRows = measureWaveReceiptRows(ctx, receipt.heard, noteNamesVisible, chipStartX, maxX)
  const sungRows = measureWaveReceiptRows(ctx, receipt.sung, noteNamesVisible, chipStartX, maxX)
  const masteredRows = receipt.mastered.length > 0
    ? measureWaveReceiptRows(ctx, receipt.mastered, noteNamesVisible, chipStartX, maxX)
    : 0
  const cardH = 92 + heardRows * 30 + sungRows * 30 + (receipt.mastered.length > 0 ? 18 + masteredRows * 30 : 0)
  const cardY = Math.max(74, 192 - cardH / 2)
  const pulse = reducedMotion ? 0 : Math.sin(animClock * 2.6) * 2

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = 'rgba(2, 7, 14, 0.72)'
  ctx.fillRect(0, cardY - 20, W, cardH + 40)

  ctx.shadowColor = 'rgba(125, 211, 252, 0.28)'
  ctx.shadowBlur = 18 + Math.max(0, pulse)
  ctx.fillStyle = 'rgba(8, 13, 24, 0.9)'
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.48)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(cardX, cardY, cardW, cardH, 8)
  ctx.fill()
  ctx.stroke()

  ctx.shadowBlur = 0
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#f6f8ff'
  ctx.font = 'bold 22px monospace'
  ctx.fillText('WAVE CLEAR', W / 2, cardY + 28)

  ctx.fillStyle = 'rgba(211, 222, 238, 0.72)'
  ctx.font = 'bold 11px monospace'
  const summary = `${receipt.heard.length} heard | ${receipt.sung.length} sung${receipt.mastered.length > 0 ? ` | ${receipt.mastered.length} mastered` : ''}`
  ctx.fillText(summary, W / 2, cardY + 50)

  let rowY = cardY + 66
  rowY = drawWaveReceiptRow(ctx, receipt, 'HEARD', receipt.heard, rowY, noteNamesVisible, false)
  rowY = drawWaveReceiptRow(ctx, receipt, 'SUNG', receipt.sung, rowY, noteNamesVisible, false)

  if (receipt.mastered.length > 0) {
    const glowY = rowY + 19
    const glow = ctx.createRadialGradient(W / 2, glowY, 8, W / 2, glowY, 210)
    glow.addColorStop(0, 'rgba(191, 239, 255, 0.22)')
    glow.addColorStop(0.46, 'rgba(96, 165, 250, 0.1)')
    glow.addColorStop(1, 'rgba(96, 165, 250, 0)')
    ctx.fillStyle = glow
    ctx.fillRect(cardX, rowY - 6, cardW, 54 + masteredRows * 12)
    drawWaveReceiptRow(ctx, receipt, 'MASTERED', receipt.mastered, rowY + 8, noteNamesVisible, true)
  }

  ctx.restore()
}

function renderView(ctx: CanvasRenderingContext2D, view: ViewState, assets: Assets) {
  ctx.save()
  ctx.translate(view.shake.x, view.shake.y)
  drawDungeonBackground(ctx, view.animClock)
  drawStormCloudView(ctx, view, assets)

  // C5: always the real AI-sourced idle art. The prior charging?frankCharge:frankIdle
  // swap pointed at a stale session-1 placeholder (frankenstein_charging.png never got
  // the C5 art pass) — every held note was flashing Frankenstein back to the ugly
  // green-blob sprite. Charging is now a code-only overlay on the SAME idle art
  // (drawFrankChargeView below), not an asset swap. frankCharge stays loaded but
  // inert this pass (FLW consult-22 LOW: real 2nd pose is a later art-lane item).
  const frank = assets.frankIdle
  if (frank) {
    const fm = assets.frankMeta
    const frame = Math.floor(view.animClock * (view.charge.progress > 0 ? 8 : 4)) % fm.frames
    const spriteW = fm.frame_w * FRANK_SPRITE_SCALE
    const spriteH = fm.frame_h * FRANK_SPRITE_SCALE
    const reaction = view.frankReaction
    const reactionPhase = reaction ? clamp(reaction.ageMs / FRANK_REACTION_MS, 0, 1) : 1
    const reactionBeat = reaction ? Math.sin(reactionPhase * Math.PI) : 0
    const reactionFade = reaction ? 1 - reactionPhase : 0
    const motionBeat = view.reducedMotion ? 0 : reactionBeat
    const scaleX = reaction?.kind === 'kill' ? 1 + motionBeat * 0.08 : reaction?.kind === 'miss' ? 1 - motionBeat * 0.05 : 1
    const scaleY = reaction?.kind === 'kill' ? 1 + motionBeat * 0.08 : reaction?.kind === 'miss' ? 1 + motionBeat * 0.035 : 1
    const drawW = spriteW * scaleX
    const drawH = spriteH * scaleY
    const drawX = FRANK_X - (drawW - spriteW) / 2 + (reaction?.kind === 'miss' ? -5 * motionBeat : 0)
    const drawY = FRANK_Y - (drawH - spriteH) + (reaction?.kind === 'kill' ? -4 * motionBeat : 0)
    ctx.imageSmoothingEnabled = false
    if (reaction?.kind === 'kill') {
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.globalAlpha = 0.36 * reactionFade
      const glowX = FRANK_X + spriteW / 2
      const glowY = FRANK_Y + spriteH * 0.42
      const glow = ctx.createRadialGradient(glowX, glowY, 5, glowX, glowY, 42 + 18 * reactionBeat)
      glow.addColorStop(0, 'rgba(250, 204, 21, 0.9)')
      glow.addColorStop(0.54, 'rgba(74, 222, 128, 0.24)')
      glow.addColorStop(1, 'rgba(250, 204, 21, 0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(glowX, glowY, 46 + 18 * reactionBeat, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    ctx.save()
    ctx.globalAlpha = reaction?.kind === 'miss' ? 1 - reactionFade * 0.34 : 1
    ctx.drawImage(
      frank,
      frame * fm.frame_w,
      0,
      fm.frame_w,
      fm.frame_h,
      drawX,
      drawY,
      drawW,
      drawH,
    )
    if (reaction?.kind === 'kill') {
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = 0.28 * reactionFade
      ctx.drawImage(
        frank,
        frame * fm.frame_w,
        0,
        fm.frame_w,
        fm.frame_h,
        drawX,
        drawY,
        drawW,
        drawH,
      )
    }
    ctx.restore()
    ctx.fillStyle = 'rgba(0,0,0,0.48)'
    ctx.beginPath()
    ctx.ellipse(FRANK_X + 48, FRANK_Y + fm.frame_h * FRANK_SPRITE_SCALE - 7, 35, 6, 0, 0, Math.PI * 2)
    ctx.fill()
    drawFrankChargeView(ctx, view, assets)
    // ported from Pitchforks.tsx:518-523; health lives on the monster.
    for (let i = 0; i < STARTING_HEALTH; i++) {
      ctx.fillStyle = i < view.hud.health ? '#4ade80' : '#333'
      ctx.fillRect(FRANK_X + 7 + i * 13, FRANK_Y - 8, 10, 4)
    }
  }

  const ordered = [...view.villagers].sort((x, y) => x.y - y.y)
  for (const v of ordered) drawVillagerView(ctx, v, view, assets)
  drawChargeArcView(ctx, view, assets)
  for (const burst of view.bursts) drawBurstView(ctx, burst)
  for (const bolt of view.bolts) drawBoltView(ctx, bolt, view.reducedMotion)
  ctx.restore()

  if (view.noteMastered) {
    drawNoteMasteredCeremony(ctx, view.noteMastered, view.noteMasteredAgeMs, view.animClock, view.reducedMotion)
  }

  if (view.waveReceipt.visible) {
    drawWaveReceipt(ctx, view.waveReceipt, view.noteNamesVisible, view.animClock, view.reducedMotion)
  }

  if (view.waveBanner.visible) {
    const alpha = Math.min(1, view.waveBanner.timer / 0.35)
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = 'rgba(0,0,0,0.44)'
    ctx.fillRect(0, 150, W, 72)
    ctx.fillStyle = '#f6f8ff'
    ctx.font = 'bold 30px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`WAVE ${view.hud.wave}`, W / 2, 195)
    ctx.restore()
  }

  if (view.hud.streak >= 3) {
    ctx.fillStyle = view.hud.streak >= 10 ? '#ff6090' : '#ffc83c'
    ctx.font = 'bold 14px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`${view.hud.streak}x COMBO`, W / 2, 18)
  }

  if (view.prompt.visible) {
    ctx.fillStyle = '#f4f7fb'
    ctx.font = 'bold 15px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(view.prompt.text, W / 2, 40)
  }

  if (view.active) {
    const villager = view.villagers.find(v => v.id === view.active?.villagerId)
    if (villager) {
      const meta = assets.villagerMeta[villager.totalTines]
      const tine = meta.tines[Math.max(0, Math.min(view.active.tineIndex, meta.tines.length - 1))]
      const forkPivotX = villager.x + (meta.frame_w - meta.fork_base.x) * SPRITE_SCALE
      const forkPivotY = villager.y + meta.fork_base.y * SPRITE_SCALE
      const rawX = villager.x + (meta.frame_w - tine.x) * SPRITE_SCALE
      const rawY = villager.y + tine.y * SPRITE_SCALE
      const { x, y } = rotateAroundPivot(rawX, rawY, forkPivotX, forkPivotY, FORK_LEAN_DEG)
      ctx.strokeStyle = view.charge.tint ?? 'rgba(160,210,255,0.62)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(x, y, 12 + view.charge.progress * 8, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
  drawPitchBarView(ctx, view.tuner)
  if (view.staffNotationVisible) drawStaffNotationView(ctx, view)
}

function localSfx(kind: 'strike' | 'ash' | 'hurt' | 'roar', volumePct: number) {
  if (typeof window === 'undefined') return
  const AudioCtor = window.AudioContext || (window as any).webkitAudioContext
  if (!AudioCtor) return
  const ctx = new AudioCtor() as AudioContext
  const master = ctx.createGain()
  master.gain.value = Math.max(0, Math.min(2, volumePct / 100))
  master.connect(ctx.destination)
  const now = ctx.currentTime
  let closeAfterMs = 450

  if (kind === 'strike') {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(740, now)
    osc.frequency.exponentialRampToValueAtTime(1480, now + 0.07)
    gain.gain.setValueAtTime(0.13, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
    osc.connect(gain)
    gain.connect(master)
    osc.start(now)
    osc.stop(now + 0.19)
  } else if (kind === 'ash') {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(520, now)
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.28)
    gain.gain.setValueAtTime(0.11, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
    osc.connect(gain)
    gain.connect(master)
    osc.start(now)
    osc.stop(now + 0.31)
  } else if (kind === 'roar') {
    closeAfterMs = 780
    const low = ctx.createOscillator()
    const detuned = ctx.createOscillator()
    const filter = ctx.createBiquadFilter()
    const growl = ctx.createGain()

    low.type = 'sawtooth'
    low.frequency.setValueAtTime(92, now)
    low.frequency.exponentialRampToValueAtTime(58, now + 0.56)
    detuned.type = 'sawtooth'
    detuned.frequency.setValueAtTime(77, now)
    detuned.frequency.exponentialRampToValueAtTime(51, now + 0.58)
    detuned.detune.setValueAtTime(-18, now)
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(480, now)
    filter.frequency.exponentialRampToValueAtTime(145, now + 0.58)
    filter.Q.value = 2.5
    growl.gain.setValueAtTime(0.001, now)
    growl.gain.linearRampToValueAtTime(0.18, now + 0.045)
    growl.gain.exponentialRampToValueAtTime(0.001, now + 0.6)

    low.connect(filter)
    detuned.connect(filter)
    filter.connect(growl)
    growl.connect(master)
    low.start(now)
    detuned.start(now)
    low.stop(now + 0.62)
    detuned.stop(now + 0.62)

    const noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.16), ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      const fade = 1 - i / data.length
      data[i] = (Math.random() * 2 - 1) * fade
    }
    const noise = ctx.createBufferSource()
    const noiseFilter = ctx.createBiquadFilter()
    const noiseGain = ctx.createGain()
    noise.buffer = noiseBuffer
    noiseFilter.type = 'bandpass'
    noiseFilter.frequency.setValueAtTime(170, now)
    noiseFilter.Q.value = 0.8
    noiseGain.gain.setValueAtTime(0.07, now)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14)
    noise.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(master)
    noise.start(now)
  } else {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(190, now)
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.16)
    gain.gain.setValueAtTime(0.12, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
    osc.connect(gain)
    gain.connect(master)
    osc.start(now)
    osc.stop(now + 0.19)
  }

  window.setTimeout(() => ctx.close().catch(() => {}), closeAfterMs)
}

export default function PitchforksIII() {
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const staffCanvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const lastTimeRef = useRef(0)
  const runtimeRef = useRef<Runtime>(makeInitialRuntime(false))
  const assetsRef = useRef<Assets>(emptyAssets())
  const nextIdRef = useRef(0)
  const fsrsRef = useRef<Record<string, NoteMemory>>({})
  const masteryProgressRef = useRef<MasteryProgress>({})
  const waveNotesHeardRef = useRef<Set<string>>(new Set())
  const waveNotesSungRef = useRef<Set<string>>(new Set())
  const waveStartedAtRef = useRef<number>(0)
  const masterySessionIdRef = useRef('')
  const unlockedNotesRef = useRef<string[]>([...STARTING_NOTES])
  const consecutiveCorrectRef = useRef(0)
  const fsrsDebugRef = useRef(false)
  const promptStartedAtRef = useRef(0)
  const activePromptKeyRef = useRef('')
  const failureGradedKeysRef = useRef<Set<string>>(new Set())
  const newNoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const noteMasteredTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const waveReceiptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const noteMasteredRef = useRef<string | null>(null)
  const noteMasteredStartedAtRef = useRef(0)
  const waveReceiptRef = useRef<WaveReceiptState>(EMPTY_WAVE_RECEIPT)
  const waveReceiptStartedAtRef = useRef(0)
  const ceremonyToneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ceremonyRef = useRef<NewNoteCeremonyState>({ active: false, note: null, toneFired: false, tonePulseKey: 0 })
  const pianoSamplesReadyRef = useRef(false)
  const lockHeldMsRef = useRef(0)
  const lockProgressRef = useRef(0)
  const activeKeyRef = useRef('')
  const tintRef = useRef<string | null>(null)
  const demoRef = useRef(false)
  const demoPitchRef = useRef<PitchInfo | null>(null)
  const demoTargetRef = useRef('')
  const demoTargetStartedRef = useRef(0)
  const demoLockCountRef = useRef(0)
  const demoStepRef = useRef('idle')
  const silenceFreezeObservedRef = useRef(false)
  const resetCountRef = useRef(0)
  const lastResetReasonRef = useRef<Pf3ResetReason>(null)
  const burnedTinesRef = useRef(0)
  const ashCountRef = useRef(0)
  const lastAshAtRef = useRef(0)
  const lastStrikeNoteRef = useRef<string | null>(null)
  const lastStrikeHueRef = useRef<number | null>(null)
  const lastKillNoteRef = useRef<string | null>(null)
  const lastKillHueRef = useRef<number | null>(null)
  const shakeStartedAtRef = useRef<number>(0)
  // Event-only mascot flash; future blind lanes should keep it on the resolved game event.
  const frankReactionKindRef = useRef<FrankReactionKind | null>(null)
  const frankReactionStartedAtRef = useRef(0)
  const roarFiredCountRef = useRef(0)
  const fullSequenceCompleteRef = useRef(false)
  const phaseRef = useRef<Phase>('menu')
  const cueVolumeRef = useRef(100)
  const sfxVolumeRef = useRef(100)
  const noteNamesRef = useRef(true)
  const audioCueRef = useRef(true)
  const staffNotationRef = useRef(false)
  const synesthesiaRef = useRef(false)
  const reducedMotionRef = useRef(false)
  const currentPromptRef = useRef('')
  const promptMismatchWarnedRef = useRef('')
  const layoutModeRef = useRef<LayoutMode>('stage')
  const cueTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const cuePlayingUntilRef = useRef(0)
  const matchingSuppressedUntilRef = useRef(0)
  const timersPausedRef = useRef(false)
  const firstLockGraceRef = useRef(false)
  const isListeningRef = useRef(false)
  const micErrorRef = useRef<string | null>(null)
  const heardYouRef = useRef(false)
  const pitchTrailRef = useRef<TrailPoint[]>([])
  const barDotDeviationRef = useRef<number | null>(null)
  const smoothDevRef = useRef(0)
  const barOnTargetRef = useRef(false)
  const barVisibleRef = useRef(false)
  const activeVillagerIdRef = useRef<number | null>(null)
  const lockWhileSuppressedRef = useRef(false)
  const micHudStateRef = useRef<MicHudState>('waiting')
  const viewStateRef = useRef<ViewState | null>(null)
  const lightningPhaseTraceRef = useRef<LightningPhaseTransition[]>([])

  const [phase, setPhase] = useState<Phase>('menu')
  const [assetsReady, setAssetsReady] = useState(false)
  const [assetError, setAssetError] = useState<string | null>(null)
  const [hud, setHud] = useState<HudState>({ wave: 1, health: STARTING_HEALTH, score: 0, streak: 0 })
  const [noteNamesOn, setNoteNamesOn] = useState(true)
  const [audioCueOn, setAudioCueOn] = useState(true)
  const [staffNotationOn, setStaffNotationOn] = useState(false)
  const [synesthesiaOn, setSynesthesiaOn] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [cueVolume, setCueVolume] = useState(100)
  const [sfxVolume, setSfxVolume] = useState(100)
  const [demoMode, setDemoMode] = useState(false)
  const [fsrsDebugMode, setFsrsDebugMode] = useState(false)
  const [geometryDebug, setGeometryDebug] = useState(false)
  const [unlockedNotes, setUnlockedNotes] = useState<string[]>([...STARTING_NOTES])
  const [newNoteUnlocked, setNewNoteUnlocked] = useState<string | null>(null)
  const [noteMastered, setNoteMastered] = useState<string | null>(null)
  const [, setWaveReceipt] = useState<WaveReceiptState>(EMPTY_WAVE_RECEIPT)
  const [ceremony, setCeremony] = useState<NewNoteCeremonyState>({ active: false, note: null, toneFired: false, tonePulseKey: 0 })
  const [micHudState, setMicHudState] = useState<MicHudState>('waiting')
  const [heardYou, setHeardYou] = useState(false)
  const [canvasDisplaySize, setCanvasDisplaySize] = useState(() => ({ width: W, height: H }))
  const [portraitStaffDisplaySize, setPortraitStaffDisplaySize] = useState(() => ({ width: STAFF_PANEL_W, height: STAFF_PANEL_H }))
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('stage')
  const [viewportGeometry, setViewportGeometry] = useState(() => ({
    width: 0,
    height: 0,
    dpr: 1,
    visualScale: 1,
    containerWidth: 0,
    containerHeight: 0,
  }))

  const { isListening, pitch, pitchRef, startListening, stopListening, error: micError } = usePitchDetection({ noiseGateDb: -45 })

  useEffect(() => {
    noteNamesRef.current = noteNamesOn
  }, [noteNamesOn])

  useEffect(() => {
    audioCueRef.current = audioCueOn
  }, [audioCueOn])

  useEffect(() => {
    staffNotationRef.current = staffNotationOn
  }, [staffNotationOn])

  useEffect(() => {
    synesthesiaRef.current = synesthesiaOn
  }, [synesthesiaOn])

  useEffect(() => {
    reducedMotionRef.current = reducedMotion
  }, [reducedMotion])

  useEffect(() => {
    cueVolumeRef.current = cueVolume
    setPianoVolume(cueVolume)
  }, [cueVolume])

  useEffect(() => {
    sfxVolumeRef.current = sfxVolume
  }, [sfxVolume])

  useEffect(() => {
    isListeningRef.current = isListening
  }, [isListening])

  useEffect(() => {
    micErrorRef.current = micError
  }, [micError])

  useEffect(() => {
    if (phase !== 'calibrating' || !pitch?.isActive || heardYouRef.current) return
    heardYouRef.current = true
    setHeardYou(true)
  }, [phase, pitch?.isActive])

  useLayoutEffect(() => {
    if (phase !== 'playing') return
    const container = canvasContainerRef.current
    if (!container) return

    const gameAspect = W / H
    const updateCanvasDisplaySize = () => {
      const { width: containerWidth, height: containerHeight } = container.getBoundingClientRect()
      if (containerWidth <= 0 || containerHeight <= 0) return

      const nextViewportGeometry = {
        width: window.innerWidth,
        height: window.innerHeight,
        dpr: window.devicePixelRatio,
        visualScale: window.visualViewport?.scale ?? 1,
        containerWidth,
        containerHeight,
      }
      setViewportGeometry((prev) => (
        Math.abs(prev.width - nextViewportGeometry.width) < 0.01 &&
        Math.abs(prev.height - nextViewportGeometry.height) < 0.01 &&
        Math.abs(prev.dpr - nextViewportGeometry.dpr) < 0.01 &&
        Math.abs(prev.visualScale - nextViewportGeometry.visualScale) < 0.01 &&
        Math.abs(prev.containerWidth - nextViewportGeometry.containerWidth) < 0.01 &&
        Math.abs(prev.containerHeight - nextViewportGeometry.containerHeight) < 0.01
      ) ? prev : nextViewportGeometry)

      const nextLayoutMode = layoutModeForViewport(window.innerWidth, window.innerHeight)
      if (layoutModeRef.current !== nextLayoutMode) {
        layoutModeRef.current = nextLayoutMode
        setLayoutMode(nextLayoutMode)
      }

      const availableWidth = Math.min(containerWidth, MAX_CANVAS_DISPLAY_W)
      const availableHeight = Math.min(containerHeight, MAX_CANVAS_DISPLAY_H)
      const containerAspect = availableWidth / availableHeight
      const nextSize = containerAspect > gameAspect
        ? { height: availableHeight, width: availableHeight * gameAspect }
        : { width: availableWidth, height: availableWidth / gameAspect }

      setCanvasDisplaySize((prev) => {
        if (Math.abs(prev.width - nextSize.width) < 0.5 && Math.abs(prev.height - nextSize.height) < 0.5) return prev
        return nextSize
      })

      if (nextLayoutMode === 'portrait') {
        const lowerLetterboxHeight = Math.max(0, (containerHeight - nextSize.height) / 2 - 12)
        const nextStaffWidth = Math.max(0, Math.min(containerWidth - 24, lowerLetterboxHeight * (STAFF_PANEL_W / STAFF_PANEL_H)))
        const nextStaffSize = { width: nextStaffWidth, height: nextStaffWidth * (STAFF_PANEL_H / STAFF_PANEL_W) }
        setPortraitStaffDisplaySize((prev) => {
          if (Math.abs(prev.width - nextStaffSize.width) < 0.5 && Math.abs(prev.height - nextStaffSize.height) < 0.5) return prev
          return nextStaffSize
        })
      }
    }

    updateCanvasDisplaySize()

    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateCanvasDisplaySize)
      observer.observe(container)
    }

    window.addEventListener('resize', updateCanvasDisplaySize)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', updateCanvasDisplaySize)
    }
  }, [phase])

  const fsrsStorageKey = useCallback(() => {
    return demoRef.current || fsrsDebugRef.current ? FSRS_DEBUG_KEY : FSRS_KEY
  }, [])

  const masteryStorageKey = useCallback(() => {
    return demoRef.current || fsrsDebugRef.current ? MASTERY_PROGRESS_DEBUG_KEY : MASTERY_PROGRESS_KEY
  }, [])

  const saveFsrs = useCallback(() => {
    try {
      localStorage.setItem(fsrsStorageKey(), JSON.stringify(fsrsRef.current))
    } catch {}
  }, [fsrsStorageKey])

  const saveMasteryProgress = useCallback(() => {
    try {
      localStorage.setItem(masteryStorageKey(), JSON.stringify(masteryProgressRef.current))
    } catch {}
  }, [masteryStorageKey])

  const getMasterySessionId = useCallback(() => {
    if (!masterySessionIdRef.current) {
      masterySessionIdRef.current = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    }
    return masterySessionIdRef.current
  }, [])

  const ensureNoteMemory = useCallback((note: string) => {
    if (!fsrsRef.current[note]) fsrsRef.current[note] = createNote(note)
    return fsrsRef.current[note]
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const isDemo = params.get('demo') === '1'
    const isFsrsDebug = params.get('fsrsDebug') === '1'
    demoRef.current = isDemo
    fsrsDebugRef.current = isFsrsDebug
    setDemoMode(isDemo)
    setFsrsDebugMode(isFsrsDebug)
    setGeometryDebug(params.get('geom') === '1')
    getMasterySessionId()

    try {
      const raw = localStorage.getItem(isDemo || isFsrsDebug ? FSRS_DEBUG_KEY : FSRS_KEY)
      if (raw) fsrsRef.current = JSON.parse(raw)
    } catch { /* fresh start */ }

    try {
      const rawMastery = localStorage.getItem(isDemo || isFsrsDebug ? MASTERY_PROGRESS_DEBUG_KEY : MASTERY_PROGRESS_KEY)
      if (rawMastery) {
        const parsed = JSON.parse(rawMastery)
        if (parsed && typeof parsed === 'object') masteryProgressRef.current = parsed as MasteryProgress
      }
    } catch { /* fresh mastery progress */ }

    // Restore unlocked notes: only notes that have been REVIEWED (lastReview > 0)
    // AND that appear in INTRO_ORDER in sequence (no gaps from other modes pre-seeding)
    const reviewed = new Set(
      Object.entries(fsrsRef.current)
        .filter(([, m]) => m.lastReview > 0)
        .map(([k]) => k)
    )
    const restored: string[] = []
    for (const note of INTRO_ORDER) {
      if (reviewed.has(note)) restored.push(note)
      else break // stop at first unreviewed — no gaps
    }
    if (restored.length >= 2) {
      setUnlockedNotes(restored)
      unlockedNotesRef.current = restored
    }

    for (const note of unlockedNotesRef.current) ensureNoteMemory(note)
  }, [ensureNoteMemory, getMasterySessionId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const a = assetsRef.current
        a.frankIdle = await loadImage(`${ASSET_BASE}/frankenstein_idle.png`)
        a.frankCharge = await loadImage(`${ASSET_BASE}/frankenstein_charging.png`)
        try {
          const frank = await fetch(`${ASSET_BASE}/frankenstein.json`)
          if (frank.ok) a.frankMeta = await frank.json()
        } catch {}
        try {
          const forks = await fetch(`${ASSET_BASE}/forks.json`)
          if (forks.ok) {
            const parsed = await forks.json()
            a.forkMeta = {
              1: parsed['2tine'] ?? defaultForkMeta,
              2: parsed['2tine'] ?? defaultForkMeta,
              3: parsed['3tine'] ?? defaultForkMeta,
              4: parsed['4tine'] ?? defaultForkMeta,
            }
          }
        } catch {}

        for (const n of [2, 3, 4] as const) {
          a.walkLeft[n] = await loadImage(`${ASSET_BASE}/villager_${n}tine_walk_left.png`)
          a.ashLeft[n] = await loadImage(`${ASSET_BASE}/villager_${n}tine_ash_left.png`)
          for (let k = 1; k < n; k++) {
            a.burnedLeft[`${n}_${k}`] = await loadImage(`${ASSET_BASE}/villager_${n}tine_burned_${k}_left.png`)
          }
          for (let b = 0; b <= n; b++) {
            a.fork[`${n}_${b}`] = await loadImage(`${ASSET_BASE}/fork_${n}tine_b${b}.png`)
            a.forkGlow[`${n}_${b}`] = await loadImage(`${ASSET_BASE}/fork_${n}tine_b${b}_glow.png`)
          }
          try {
            const meta = await fetch(`${ASSET_BASE}/villager_${n}tine.json`)
            if (meta.ok) a.villagerMeta[n] = await meta.json()
          } catch {}
        }
        // 1-tine (single-note) tier reuses 2-tine art for now (real 1-tine sprite = art gate).
        a.walkLeft[1] = a.walkLeft[2]
        a.ashLeft[1] = a.ashLeft[2]
        a.villagerMeta[1] = a.villagerMeta[2]
        a.forkMeta[1] = a.forkMeta[2]
        a.fork['1_0'] = a.fork['2_0']
        a.fork['1_1'] = a.fork['2_1']
        a.forkGlow['1_0'] = a.forkGlow['2_0']
        a.forkGlow['1_1'] = a.forkGlow['2_1']
        if (!cancelled) setAssetsReady(true)
      } catch (err) {
        if (!cancelled) setAssetError(err instanceof Error ? err.message : 'Sprite load failed')
      }
    })()
    loadPianoSamples()
      .then(() => { pianoSamplesReadyRef.current = true })
      .catch(() => { pianoSamplesReadyRef.current = false })
    return () => { cancelled = true }
  }, [])

  const getActiveVillager = useCallback(() => {
    const walkers = runtimeRef.current.villagers.filter(v => v.state === 'walking' && v.burned < v.totalTines)
    if (walkers.length === 0) return null
    walkers.sort((a, b) => a.x - b.x)
    return walkers[0]
  }, [])

  const getActiveTarget = useCallback((): ActiveTarget | null => {
    const villager = getActiveVillager()
    if (!villager) return null
    const tineIndex = villager.totalTines - 1 - villager.burned
    return {
      villager,
      tineIndex,
      note: villager.notes[villager.burned],
      key: `${villager.id}:${villager.burned}`,
    }
  }, [getActiveVillager])

  const setPromptText = useCallback((text: string) => {
    currentPromptRef.current = text
  }, [])

  const clearCueTimers = useCallback(() => {
    for (const id of cueTimeoutsRef.current) clearTimeout(id)
    cueTimeoutsRef.current = []
    cuePlayingUntilRef.current = 0
    matchingSuppressedUntilRef.current = 0
  }, [])

  const cuePlayingNow = useCallback(() => performance.now() < cuePlayingUntilRef.current, [])

  const matchingSuppressedNow = useCallback(() => {
    return performance.now() < matchingSuppressedUntilRef.current || isWithinToneSuppressionWindow()
  }, [])

  const syncMicHudState = useCallback(() => {
    const next: MicHudState = demoRef.current
      ? 'demo'
      : micErrorRef.current
        ? 'blocked'
        : matchingSuppressedNow()
          ? 'cue'
          : isListeningRef.current
            ? 'listening'
            : 'waiting'
    if (micHudStateRef.current !== next) {
      micHudStateRef.current = next
      setMicHudState(next)
    }
  }, [matchingSuppressedNow])

  useEffect(() => {
    syncMicHudState()
  }, [isListening, micError, syncMicHudState])

  const resumeCueAudioFromGesture = useCallback(() => {
    try {
      initAudio()
      setPianoVolume(cueVolumeRef.current)
    } catch {}
  }, [])

  const timersPausedNow = useCallback(() => {
    const active = getActiveTarget()
    const micUnavailable = !demoRef.current && (!isListeningRef.current || !!micErrorRef.current)
    const firstLockGrace = firstLockGraceRef.current &&
      !!active &&
      active.villager.id === runtimeRef.current.firstVillagerId
    const paused = matchingSuppressedNow() || micUnavailable || firstLockGrace
    timersPausedRef.current = paused
    return paused
  }, [getActiveTarget, matchingSuppressedNow])

  const setCeremonySnapshot = useCallback((next: NewNoteCeremonyState) => {
    ceremonyRef.current = next
    setCeremony(next)
  }, [])

  const clearCeremonyTimers = useCallback(() => {
    if (newNoteTimerRef.current) {
      clearTimeout(newNoteTimerRef.current)
      newNoteTimerRef.current = null
    }
    if (ceremonyToneTimerRef.current) {
      clearTimeout(ceremonyToneTimerRef.current)
      ceremonyToneTimerRef.current = null
    }
  }, [])

  const clearNewNoteCeremony = useCallback(() => {
    clearCeremonyTimers()
    setNewNoteUnlocked(null)
    setCeremonySnapshot({ active: false, note: null, toneFired: false, tonePulseKey: 0 })
  }, [clearCeremonyTimers, setCeremonySnapshot])

  const clearNoteMasteredTimer = useCallback(() => {
    if (noteMasteredTimerRef.current) {
      clearTimeout(noteMasteredTimerRef.current)
      noteMasteredTimerRef.current = null
    }
  }, [])

  const clearNoteMasteredCeremony = useCallback(() => {
    clearNoteMasteredTimer()
    noteMasteredRef.current = null
    noteMasteredStartedAtRef.current = 0
    setNoteMastered(null)
  }, [clearNoteMasteredTimer])

  const clearWaveReceiptTimer = useCallback(() => {
    if (waveReceiptTimerRef.current) {
      clearTimeout(waveReceiptTimerRef.current)
      waveReceiptTimerRef.current = null
    }
  }, [])

  const setWaveReceiptSnapshot = useCallback((next: WaveReceiptState) => {
    waveReceiptRef.current = next
    setWaveReceipt(next)
  }, [])

  const clearWaveReceipt = useCallback(() => {
    clearWaveReceiptTimer()
    waveReceiptStartedAtRef.current = 0
    setWaveReceiptSnapshot(EMPTY_WAVE_RECEIPT)
  }, [clearWaveReceiptTimer, setWaveReceiptSnapshot])

  const showWaveReceipt = useCallback((snapshot: WaveReceiptState) => {
    clearWaveReceiptTimer()
    waveReceiptStartedAtRef.current = performance.now()
    setWaveReceiptSnapshot(snapshot)
    waveReceiptTimerRef.current = setTimeout(() => {
      clearWaveReceipt()
    }, WAVE_RECEIPT_MS)
  }, [clearWaveReceipt, clearWaveReceiptTimer, setWaveReceiptSnapshot])

  const snapshotWaveReceipt = useCallback((): WaveReceiptState => {
    const mastered = Object.entries(masteryProgressRef.current)
      .filter(([, progress]) => progress.masteredAt !== null && progress.masteredAt >= waveStartedAtRef.current)
      .map(([note]) => note)

    return {
      visible: true,
      timer: 0,
      heard: [...waveNotesHeardRef.current],
      sung: [...waveNotesSungRef.current],
      mastered,
    }
  }, [])

  const showNoteMastered = useCallback((note: string) => {
    clearNoteMasteredCeremony()
    noteMasteredRef.current = note
    noteMasteredStartedAtRef.current = performance.now()
    setNoteMastered(note)
    noteMasteredTimerRef.current = setTimeout(() => {
      clearNoteMasteredCeremony()
    }, NOTE_MASTERED_CEREMONY_MS)
  }, [clearNoteMasteredCeremony])

  const recordMasteryProgressForReview = useCallback((note: string) => {
    const reviewed = fsrsRef.current[note]
    if (!reviewed || reviewed.S < MASTERY_STABILITY_DAYS) return

    const current = masteryProgressRef.current[note] ?? { sessionIds: [], masteredAt: null }
    const priorSessionIds = Array.isArray(current.sessionIds) ? current.sessionIds : []
    const masteredAt = current.masteredAt ?? null
    const sessionId = getMasterySessionId()
    const sessionIds = priorSessionIds.includes(sessionId)
      ? priorSessionIds
      : [...priorSessionIds, sessionId]
    const crossedNow = masteredAt === null && sessionIds.length >= MASTERY_SESSION_COUNT
    if (sessionIds === priorSessionIds && !crossedNow) return

    masteryProgressRef.current[note] = {
      sessionIds,
      masteredAt: crossedNow ? Date.now() : masteredAt,
    }
    saveMasteryProgress()
    if (crossedNow) showNoteMastered(note)
  }, [getMasterySessionId, saveMasteryProgress, showNoteMastered])

  const tryPlayCeremonyTone = useCallback((note: string): CeremonyToneAttempt => {
    if (!audioCueRef.current || cueVolumeRef.current <= 0) return 'disabled'
    if (!pianoSamplesReadyRef.current) return 'pending'
    if (matchingSuppressedNow()) return 'suppressed'
    try {
      initAudio()
      setPianoVolume(cueVolumeRef.current)
      playPianoNote(note, { exact: true })
      markToneEmitted(TONE_SUPPRESS_MS)
      return 'played'
    } catch {
      return 'disabled'
    }
  }, [matchingSuppressedNow])

  const markCeremonyToneFired = useCallback((note: string) => {
    const current = ceremonyRef.current
    if (!current.active || current.note !== note) return
    setCeremonySnapshot({ ...current, toneFired: true, tonePulseKey: current.tonePulseKey + 1 })
  }, [setCeremonySnapshot])

  const scheduleCeremonyTone = useCallback((note: string, replay = false) => {
    const scheduledFor = ceremonyRef.current
    if (!scheduledFor.active || scheduledFor.note !== note || (!replay && scheduledFor.toneFired)) return
    if (ceremonyToneTimerRef.current) {
      clearTimeout(ceremonyToneTimerRef.current)
      ceremonyToneTimerRef.current = null
    }

    const attempt = tryPlayCeremonyTone(note)
    if (attempt === 'played') {
      markCeremonyToneFired(note)
      return
    }
    if (attempt !== 'suppressed' && attempt !== 'pending') return

    const localSuppressionRemaining = Math.max(0, matchingSuppressedUntilRef.current - performance.now())
    const waitMs = attempt === 'pending'
      ? 250
      : Math.max(180, localSuppressionRemaining + 80, TONE_SUPPRESS_MS + 80)

    ceremonyToneTimerRef.current = setTimeout(() => {
      ceremonyToneTimerRef.current = null
      const current = ceremonyRef.current
      if (!current.active || current.note !== note || (!replay && current.toneFired)) return
      if (tryPlayCeremonyTone(note) === 'played') markCeremonyToneFired(note)
    }, waitMs)
  }, [markCeremonyToneFired, tryPlayCeremonyTone])

  const showNewNoteUnlocked = useCallback((note: string) => {
    clearCeremonyTimers()
    setNewNoteUnlocked(note)
    setCeremonySnapshot({ active: true, note, toneFired: false, tonePulseKey: 0 })
    scheduleCeremonyTone(note)
    newNoteTimerRef.current = setTimeout(() => {
      clearNewNoteCeremony()
    }, NEW_NOTE_CEREMONY_MS)
  }, [clearCeremonyTimers, clearNewNoteCeremony, scheduleCeremonyTone, setCeremonySnapshot])

  const replayNewNoteCeremonyTone = useCallback((note: string) => {
    const current = ceremonyRef.current
    if (!current.active || current.note !== note) return
    if (phaseRef.current === 'playing' && lockProgressRef.current > 0 && lockProgressRef.current < 1) return
    scheduleCeremonyTone(note, true)
  }, [scheduleCeremonyTone])

  const maybeUnlockNextNote = useCallback((consecutive: number) => {
    const currentPool = unlockedNotesRef.current
    const currentPoolSize = currentPool.length
    const threshold = UNLOCK_THRESHOLDS[currentPoolSize]
    if (threshold && consecutive >= threshold && currentPoolSize < INTRO_ORDER.length) {
      const nextNote = INTRO_ORDER[currentPoolSize]
      const newPool = [...currentPool, nextNote]
      unlockedNotesRef.current = newPool
      setUnlockedNotes(newPool)
      ensureNoteMemory(nextNote)
      saveFsrs()
      showNewNoteUnlocked(nextNote)
    }
  }, [ensureNoteMemory, saveFsrs, showNewNoteUnlocked])

  const latencyForTarget = useCallback((target: NonNullable<ReturnType<typeof getActiveTarget>>) => {
    if (activePromptKeyRef.current === target.key && promptStartedAtRef.current > 0) {
      return Math.max(0, performance.now() - promptStartedAtRef.current)
    }
    return 2000
  }, [])

  const reviewTargetNote = useCallback((
    target: NonNullable<ReturnType<typeof getActiveTarget>>,
    correct: boolean,
  ) => {
    if (!target.note) return false
    if (matchingSuppressedNow()) return false
    if (!demoRef.current && !isListeningRef.current) return false

    if (!correct) {
      if (failureGradedKeysRef.current.has(target.key)) return false
      failureGradedKeysRef.current.add(target.key)
    }

    const mem = ensureNoteMemory(target.note)
    const grade = autoGrade(correct, latencyForTarget(target))
    fsrsRef.current[target.note] = reviewNote(mem, grade)
    saveFsrs()
    if (correct) recordMasteryProgressForReview(target.note)

    if (correct) {
      waveNotesSungRef.current.add(target.note)
      const nextConsecutive = consecutiveCorrectRef.current + 1
      consecutiveCorrectRef.current = nextConsecutive
      maybeUnlockNextNote(nextConsecutive)
    } else {
      consecutiveCorrectRef.current = 0
    }
    return true
  }, [ensureNoteMemory, latencyForTarget, matchingSuppressedNow, maybeUnlockNextNote, recordMasteryProgressForReview, saveFsrs])

  const playVillagerSequence = useCallback((villager: Villager, mode: 'cue' | 'replay') => {
    if (!villager.notes.length) return
    clearCueTimers()
    if (mode === 'cue') {
      for (const note of villager.notes) waveNotesHeardRef.current.add(note)
    }
    const liveNotes = villager.notes.slice(villager.burned)
    if (!liveNotes.length) return

    const now = performance.now()
    const toneWindowMs = (liveNotes.length - 1) * TONE_SPACING_MS + TONE_MS
    const suppressMs = toneWindowMs + ECHO_TAIL_MS
    cuePlayingUntilRef.current = now + toneWindowMs
    timersPausedRef.current = true
    if (demoRef.current) demoStepRef.current = mode === 'replay' ? 'replay-cue' : 'auto-cue'

    liveNotes.forEach((note, i) => {
      const index = villager.burned + i
      const id = setTimeout(() => {
        const promptOwnerKey = `${villager.id}:${index}`
        if (phaseRef.current === 'playing' && getActiveTarget()?.key === promptOwnerKey) {
          setPromptText(`${mode === 'replay' ? 'Replay' : 'Listen'}: ${note}`)
          activePromptKeyRef.current = `${villager.id}:${index}`
          promptStartedAtRef.current = performance.now()
        }
        if (mode === 'replay' || audioCueRef.current) {
          setPianoVolume(cueVolumeRef.current)
          try {
            playPianoNote(note, { exact: true })
          } finally {
            matchingSuppressedUntilRef.current = performance.now() + TONE_SUPPRESS_MS
            markToneEmitted(TONE_SUPPRESS_MS)
          }
        } else {
          matchingSuppressedUntilRef.current = performance.now() + TONE_SUPPRESS_MS
          markToneEmitted(TONE_SUPPRESS_MS)
        }
      }, i * TONE_SPACING_MS)
      cueTimeoutsRef.current.push(id)
    })

    const doneId = setTimeout(() => {
      if (
        phaseRef.current === 'playing' &&
        activeVillagerIdRef.current === villager.id &&
        villager.state === 'walking'
      ) {
        const note = villager.notes[villager.burned]
        if (note) {
          activePromptKeyRef.current = `${villager.id}:${villager.burned}`
          promptStartedAtRef.current = performance.now()
          setPromptText(villager.burned === 0 ? `Sing: ${note}` : `Now: ${note}`)
        }
      }
    }, suppressMs)
    cueTimeoutsRef.current.push(doneId)
  }, [clearCueTimers, getActiveTarget, setPromptText])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!demoMode && !fsrsDebugMode) {
      delete window.__pf3
      return
    }

    const getState = (): Readonly<Pf3DebugState> => {
      const rt = runtimeRef.current
      const active = getActiveTarget()
      const chargeLevel = active
        ? Math.max(
            active.villager.burned,
            Math.min(active.villager.totalTines, Math.round(lockProgressRef.current * active.villager.totalTines)),
          )
        : 0
      const newestBolt = rt.bolts[rt.bolts.length - 1]

      return Object.freeze({
        demoStep: demoStepRef.current,
        chargeProgress: lockProgressRef.current,
        chargeLevel,
        silenceFreezeObserved: silenceFreezeObservedRef.current,
        resetCount: resetCountRef.current,
        lastResetReason: lastResetReasonRef.current,
        strikeCount: demoLockCountRef.current,
        burnedTines: burnedTinesRef.current,
        ashCount: ashCountRef.current,
        wave: rt.wave,
        waveBannerVisible: rt.bannerTimer > 0,
        fullSequenceComplete: fullSequenceCompleteRef.current,
        barVisible: barVisibleRef.current,
        barDotDeviation: barDotDeviationRef.current,
        barOnTarget: barOnTargetRef.current,
        trailLength: pitchTrailRef.current.length,
        replayVisible: phaseRef.current === 'playing',
        cuePlaying: cuePlayingNow(),
        matchingSuppressed: matchingSuppressedNow(),
        timersPaused: timersPausedRef.current,
        timerBarVisible: phaseRef.current === 'playing' && !!active,
        activeAttackTimerPct: active
          ? clamp(active.villager.attackTimer / Math.max(0.001, active.villager.attackTimerMax), 0, 1)
          : null,
        lockWhileSuppressed: lockWhileSuppressedRef.current,
        tutorialAvailable: true,
        healthPips: rt.health,
        burstCount: rt.bursts.length,
        lastStrikeNote: lastStrikeNoteRef.current,
        lastStrikeHue: lastStrikeHueRef.current,
        lastKillNote: lastKillNoteRef.current,
        lastKillHue: lastKillHueRef.current,
        roarFiredCount: roarFiredCountRef.current,
        unlockedCount: unlockedNotesRef.current.length,
        unlockedNotes: [...unlockedNotesRef.current],
        noteR: noteRSnapshot(unlockedNotesRef.current, fsrsRef.current),
        noteHealth: noteHealthSnapshot(unlockedNotesRef.current, fsrsRef.current),
        ceremonyActive: ceremonyRef.current.active,
        ceremonyNote: ceremonyRef.current.note,
        ceremonyToneFired: ceremonyRef.current.toneFired,
        noteMastered,
        masteredNotes: Object.entries(masteryProgressRef.current)
          .filter(([, progress]) => progress.masteredAt !== null)
          .map(([masteredNote]) => masteredNote),
        selectedNotes: rt.villagers.flatMap(v => v.notes),
        activeNote: active?.note ?? null,
        activeSequence: active ? [...active.villager.notes] : [],
        fsrsDebug: demoRef.current || fsrsDebugRef.current,
        fsrsStoreKey: fsrsStorageKey(),
        newNoteUnlocked,
        layoutMode: layoutModeRef.current,
        lightningPhase: lightningPhaseFor(lockProgressRef.current, newestBolt),
        boltCount: rt.bolts.length,
        lightningBendDeg: lightningBendDeg(newestBolt),
        lightningPhaseTrace: lightningPhaseTraceRef.current.map(entry => ({ ...entry })),
      })
    }
    // fsrsDebug-gated test hook: drives the REAL grade/unlock path (autoGrade →
    // reviewNote → maybeUnlockNextNote) so the behavioral FLW receipts (unlock
    // progression, one-review-per-resolution, failure resets streak) are
    // machine-provable without the scripted single-villager demo. Inert in normal
    // play — this whole effect only runs when demo/fsrsDebug is on.
    const review = (note: string, correct: boolean) => {
      const mem = ensureNoteMemory(note)
      const grade = autoGrade(correct, correct ? 800 : 2000)
      fsrsRef.current[note] = reviewNote(mem, grade)
      saveFsrs()
      if (correct) recordMasteryProgressForReview(note)
      if (correct) {
        consecutiveCorrectRef.current += 1
        maybeUnlockNextNote(consecutiveCorrectRef.current)
      } else {
        consecutiveCorrectRef.current = 0
      }
      return {
        note,
        grade,
        consecutive: consecutiveCorrectRef.current,
        unlockedCount: unlockedNotesRef.current.length,
        unlockedNotes: [...unlockedNotesRef.current],
        phase: fsrsRef.current[note].phase,
        lapses: fsrsRef.current[note].lapses,
      }
    }
    const resetDebug = () => {
      clearNewNoteCeremony()
      clearNoteMasteredCeremony()
      fsrsRef.current = {}
      masteryProgressRef.current = {}
      unlockedNotesRef.current = [...STARTING_NOTES]
      setUnlockedNotes([...STARTING_NOTES])
      consecutiveCorrectRef.current = 0
      for (const n of unlockedNotesRef.current) ensureNoteMemory(n)
      saveFsrs()
      saveMasteryProgress()
      return { unlockedCount: unlockedNotesRef.current.length, notes: [...unlockedNotesRef.current] }
    }
    const showMasteryCeremony = (note: string) => {
      showNoteMastered(note)
      return { note, noteMastered: noteMasteredRef.current }
    }
    const forceMasteryForTest = (note: string) => {
      ensureNoteMemory(note)
      const prior = masteryProgressRef.current[note] ?? { sessionIds: [], masteredAt: null }
      masteryProgressRef.current[note] = {
        sessionIds: prior.sessionIds.length > 0 ? prior.sessionIds : ['debug-forced-session'],
        masteredAt: Date.now(),
      }
      saveMasteryProgress()
      return { note, masteredAt: masteryProgressRef.current[note].masteredAt }
    }
    const simulateHeardYouForTest = () => {
      heardYouRef.current = true
      setHeardYou(true)
      return { heardYou: true }
    }
    const forceMissForTest = () => {
      getActiveTarget()
      frankReactionKindRef.current = 'miss'
      frankReactionStartedAtRef.current = performance.now()
      return { triggered: true }
    }
    const hook = Object.freeze({
      getState,
      get viewState() {
        return viewStateRef.current
      },
      review,
      resetDebug,
      showMasteryCeremony,
      forceMasteryForTest,
      simulateHeardYouForTest,
      forceMissForTest,
    })

    Object.defineProperty(window, '__pf3', {
      configurable: true,
      value: hook,
    })

    return () => {
      if (window.__pf3 === hook) delete window.__pf3
    }
  }, [clearNewNoteCeremony, clearNoteMasteredCeremony, cuePlayingNow, demoMode, ensureNoteMemory, fsrsDebugMode, fsrsStorageKey, getActiveTarget, matchingSuppressedNow, maybeUnlockNextNote, newNoteUnlocked, noteMastered, recordMasteryProgressForReview, saveFsrs, saveMasteryProgress, showNoteMastered])

  const pickVillagerNotes = useCallback((totalTines: TineCount) => {
    const pool = unlockedNotesRef.current.length > 0 ? unlockedNotesRef.current : [...STARTING_NOTES]
    for (const note of pool) ensureNoteMemory(note)

    if (totalTines > 1) {
      const isMasteredNote = (note: string) => {
        const masteredAt = masteryProgressRef.current[note]?.masteredAt
        return masteredAt !== null && masteredAt !== undefined
      }
      const masteredPool = pool.filter(isMasteredNote)

      if (masteredPool.length > 0) {
        const weakPool = pool.filter(note => !isMasteredNote(note))
        const notes: string[] = []
        let exclude: string | null = null

        if (weakPool.length > 0) {
          const weakNote = pickNextNote(weakPool, fsrsRef.current, exclude)
          ensureNoteMemory(weakNote)
          notes.push(weakNote)
          exclude = weakNote
        }

        while (notes.length < totalTines) {
          const masteredNote = pickNextNote(masteredPool, fsrsRef.current, exclude)
          ensureNoteMemory(masteredNote)
          notes.push(masteredNote)
          exclude = masteredNote
        }

        return notes
      }
    }

    const notes: string[] = []
    let exclude: string | null = null
    for (let i = 0; i < totalTines; i++) {
      const nextNote = pickNextNote(pool, fsrsRef.current, exclude)
      ensureNoteMemory(nextNote)
      notes.push(nextNote)
      exclude = nextNote
    }
    return notes
  }, [ensureNoteMemory])

  const spawnVillager = useCallback(() => {
    const rt = runtimeRef.current
    if (rt.spawned >= rt.plan.count) return
    const spawnIndex = rt.spawned
    const totalTines = rt.plan.tineCounts[rt.spawned] ?? 2
    const lane = spawnIndex % 3
    const notes = pickVillagerNotes(totalTines)
    const attackTimer = attackTimeForWave(rt.wave, spawnIndex)
    const v: Villager = {
      id: ++nextIdRef.current,
      totalTines,
      x: demoRef.current ? W - 150 : rt.wave === 1 ? W + 60 + spawnIndex * 70 : W + 42 + lane * 18,
      y: GROUND_Y - defaultVillagerMeta.frame_h * SPRITE_SCALE - lane * 6,
      speed: rt.plan.speed + lane * 1.8,
      notes,
      burned: 0,
      state: 'walking',
      spawnIndex,
      attackTimer,
      attackTimerMax: attackTimer,
      sequenceCued: false,
      walkFrame: 0,
      walkClock: 0,
      ashTimer: 0,
    }
    rt.villagers.push(v)
    if (rt.firstVillagerId === null) rt.firstVillagerId = v.id
    rt.spawned += 1
  }, [pickVillagerNotes])

  const startWave = useCallback((wave: number) => {
    const rt = runtimeRef.current
    waveNotesHeardRef.current = new Set()
    waveNotesSungRef.current = new Set()
    waveStartedAtRef.current = Date.now()
    clearWaveReceipt()
    rt.wave = wave
    rt.plan = fixedWaveDirector(wave, demoRef.current)
    rt.spawned = 0
    rt.spawnClock = 0
    rt.bannerTimer = 1.15
    rt.nextWavePending = false
    activeKeyRef.current = ''
    activeVillagerIdRef.current = null
    activePromptKeyRef.current = ''
    promptStartedAtRef.current = 0
    lockHeldMsRef.current = 0
    lockProgressRef.current = 0
    tintRef.current = null
    setPromptText('')
    if (demoRef.current) demoStepRef.current = 'wave-banner'
    setHud({ wave, health: rt.health, score: rt.score, streak: rt.streak })
  }, [clearWaveReceipt, setPromptText])

  const addBolt = useCallback((villager: Villager, tineIndex: number, hue: number, note: string) => {
    const a = assetsRef.current
    const frankMeta = a.frankMeta
    const vMeta = a.villagerMeta[villager.totalTines]
    const tine = vMeta.tines[Math.max(0, Math.min(tineIndex, vMeta.tines.length - 1))]
    const pivotX = FRANK_X + frankMeta.rod_tip.x * FRANK_SPRITE_SCALE
    const pivotY = FRANK_Y + frankMeta.rod_tip.y * FRANK_SPRITE_SCALE
    const forkPivotX = villager.x + (vMeta.frame_w - vMeta.fork_base.x) * SPRITE_SCALE
    const forkPivotY = villager.y + vMeta.fork_base.y * SPRITE_SCALE
    const rawToX = villager.x + (vMeta.frame_w - tine.x) * SPRITE_SCALE
    const rawToY = villager.y + tine.y * SPRITE_SCALE
    const { x: toX, y: toY } = rotateAroundPivot(rawToX, rawToY, forkPivotX, forkPivotY, FORK_LEAN_DEG)
    runtimeRef.current.bolts.push({
      fromX: pivotX + FRANK_CLOUD_X_OFFSET,
      fromY: FRANK_CLOUD_Y,
      pivotX,
      pivotY,
      toX,
      toY,
      life: 0,
      maxLife: BOLT_LIFE_S,
      seed: villager.id * 131 + tineIndex * 37 + Math.round(hue),
      hue,
      note,
      villagerId: villager.id,
      tineIndex,
    })
  }, [])

  const addBurst = useCallback((villager: Villager, hue: number, kind: BurstKind) => {
    const meta = assetsRef.current.villagerMeta[villager.totalTines]
    const sw = meta.frame_w * SPRITE_SCALE
    const sh = meta.frame_h * SPRITE_SCALE
    runtimeRef.current.bursts.push({
      x: villager.x + sw / 2,
      y: villager.y + sh / 2,
      hue,
      kind,
      seed: (villager.id * 37 + villager.burned * 19 + hue * 3 + (kind === 'kill' ? 137 : 0)) % 997,
      life: -(BOLT_LIFE_S * STRIKE_IMPACT_START),
      maxLife: kind === 'kill' ? 0.58 : 0.26,
    })
  }, [])

  const strikeActiveTine = useCallback((target: NonNullable<ReturnType<typeof getActiveTarget>>) => {
    const rt = runtimeRef.current
    const { villager, tineIndex } = target
    const strikeNote = target.note ?? villager.notes[villager.burned]
    const strikeHue = hueForNote(strikeNote)
    reviewTargetNote(target, true)
    lastStrikeNoteRef.current = strikeNote ?? null
    lastStrikeHueRef.current = strikeHue
    addBolt(villager, tineIndex, strikeHue, strikeNote)
    addBurst(villager, strikeHue, 'strike')
    villager.burned += 1
    burnedTinesRef.current += 1
    lockHeldMsRef.current = 0
    lockProgressRef.current = 0
    tintRef.current = null
    activeKeyRef.current = ''
    demoLockCountRef.current += 1
    if (matchingSuppressedNow()) lockWhileSuppressedRef.current = true
    if (demoRef.current) demoStepRef.current = 'strike'
    localSfx('strike', sfxVolumeRef.current)

    if (villager.burned >= villager.totalTines) {
      villager.state = 'ash'
      villager.ashTimer = 1.1
      ashCountRef.current += 1
      lastAshAtRef.current = performance.now()
      fullSequenceCompleteRef.current = true
      if (demoRef.current) demoStepRef.current = 'ash'
      rt.streak += 1
      const comboMult = rt.streak >= 10 ? 3 : rt.streak >= 5 ? 2 : 1
      rt.score += (100 + villager.totalTines * 20) * comboMult
      lastKillNoteRef.current = strikeNote ?? null
      lastKillHueRef.current = strikeHue
      addBurst(villager, strikeHue, 'kill')
      shakeStartedAtRef.current = performance.now()
      frankReactionKindRef.current = 'kill'
      frankReactionStartedAtRef.current = performance.now()
      localSfx('ash', sfxVolumeRef.current)
      localSfx('roar', sfxVolumeRef.current)
      roarFiredCountRef.current += 1
      setHud({ wave: rt.wave, health: rt.health, score: rt.score, streak: rt.streak })
    } else {
      const nextNote = villager.notes[villager.burned]
      if (nextNote) {
        activePromptKeyRef.current = `${villager.id}:${villager.burned}`
        promptStartedAtRef.current = performance.now()
        setPromptText(`Now: ${nextNote}`)
      }
    }
    if (firstLockGraceRef.current) firstLockGraceRef.current = false
  }, [addBolt, addBurst, matchingSuppressedNow, reviewTargetNote, setPromptText])

  const demoPitchForTarget = useCallback((target: NonNullable<ReturnType<typeof getActiveTarget>>, now: number): PitchInfo | null => {
    if (demoTargetRef.current !== target.key) {
      demoTargetRef.current = target.key
      demoTargetStartedRef.current = now
    }
    const elapsed = now - demoTargetStartedRef.current
    const targetFreq = noteToFreq(target.note)
    const firstTargetScript = demoLockCountRef.current === 0

    if (now - lastAshAtRef.current < 220) {
      demoStepRef.current = 'attack-countdown'
      return { note: target.note, frequency: 0, cents: 0, confidence: 0, isActive: false }
    }

    if (firstTargetScript) {
      if (elapsed < 160) {
        demoStepRef.current = 'charge-start'
        return { note: target.note, frequency: targetFreq, cents: 0, confidence: 0.96, isActive: true }
      }
      if (elapsed < 900) {
        demoStepRef.current = lockProgressRef.current > 0 ? 'silence-freeze' : 'silence-prime'
        return { note: target.note, frequency: 0, cents: 0, confidence: 0, isActive: false }
      }
      if (elapsed < 1700) {
        const wrong = semiToName(nameToSemi(target.note) + 2)
        demoStepRef.current = 'confident-wrong'
        return { note: wrong, frequency: noteToFreq(wrong), cents: 0, confidence: 0.98, isActive: true }
      }
      demoStepRef.current = 'charge-recover'
      return { note: target.note, frequency: targetFreq, cents: 0, confidence: 0.98, isActive: true }
    }

    if (elapsed < 90) {
      demoStepRef.current = 'target-silence-prime'
      return { note: target.note, frequency: 0, cents: 0, confidence: 0, isActive: false }
    }
    demoStepRef.current = 'charge-hold'
    return { note: target.note, frequency: targetFreq, cents: 0, confidence: 0.98, isActive: true }
  }, [])

  const processLock = useCallback((dt: number) => {
    const target = getActiveTarget()
    if (!target) {
      activeKeyRef.current = ''
      activeVillagerIdRef.current = null
      lockHeldMsRef.current = 0
      lockProgressRef.current = 0
      tintRef.current = null
      setPromptText('')
      if (demoRef.current) demoStepRef.current = 'idle'
      return
    }

    if (activeVillagerIdRef.current !== target.villager.id) {
      activeVillagerIdRef.current = target.villager.id
      activeKeyRef.current = ''
      lockHeldMsRef.current = 0
      lockProgressRef.current = 0
      tintRef.current = null
      setPromptText(`Sing: ${target.villager.notes[0]}`)
      if (!target.villager.sequenceCued) {
        target.villager.sequenceCued = true
        playVillagerSequence(target.villager, 'cue')
      }
    }

    if (activeKeyRef.current !== target.key) {
      activeKeyRef.current = target.key
      lockHeldMsRef.current = 0
      lockProgressRef.current = 0
      tintRef.current = null
      if (!cuePlayingNow()) {
        setPromptText(target.villager.burned === 0 ? `Sing: ${target.note}` : `Now: ${target.note}`)
      }
    }

    if (matchingSuppressedNow()) {
      return
    }

    const now = performance.now()
    if (demoRef.current) {
      demoPitchRef.current = demoPitchForTarget(target, now)
    }

    const source = demoRef.current ? demoPitchRef.current : pitchRef.current
    if (!source?.isActive || source.confidence < CONFIDENCE_FLOOR || source.frequency <= 0) {
      if (demoRef.current && lockProgressRef.current > 0) {
        silenceFreezeObservedRef.current = true
        demoStepRef.current = 'silence-freeze'
      }
      tintRef.current = null
      return
    }

    const cents = exactCents(source.frequency, noteToFreq(target.note))
    const absCents = Math.abs(cents)
    tintRef.current = colorForCents(absCents)

    if (absCents <= MATCH_TOLERANCE_CENTS) {
      lockHeldMsRef.current = Math.min(HOLD_MS, lockHeldMsRef.current + dt * 1000)
      lockProgressRef.current = Math.min(1, lockHeldMsRef.current / HOLD_MS)
      if (lockProgressRef.current >= 1) {
        strikeActiveTine(target)
      }
    } else {
      // v1 confident-wrong = charge RESET only, NO FSRS review (FLW GREEN-LIGHT option A,
      // flw-out-9b). FSRS grades exactly once per villager-tine encounter at resolution:
      // strike = correct (latency-graded), timeout = failure. A beginner's approach wobble
      // is not a recall failure — the real failure is not resolving the tine in time.
      const hadCharge = lockHeldMsRef.current > 0 || lockProgressRef.current > 0
      lockHeldMsRef.current = 0
      lockProgressRef.current = 0
      if (demoRef.current && hadCharge) {
        resetCountRef.current += 1
        lastResetReasonRef.current = 'confident-wrong'
        demoStepRef.current = 'confident-wrong-reset'
      }
    }
  }, [
    cuePlayingNow,
    demoPitchForTarget,
    getActiveTarget,
    matchingSuppressedNow,
    pitchRef,
    playVillagerSequence,
    setPromptText,
    strikeActiveTine,
  ])

  const updateGame = useCallback((dt: number) => {
    const rt = runtimeRef.current
    rt.animClock += dt

    if (rt.bannerTimer > 0) {
      rt.bannerTimer = Math.max(0, rt.bannerTimer - dt)
      if (rt.bannerTimer === 0 && rt.spawned === 0) {
        if (rt.wave === 1 && !demoRef.current) {
          while (rt.spawned < rt.plan.count) spawnVillager()
        } else {
          spawnVillager()
        }
      }
    } else {
      if (rt.wave === 1 && rt.spawned === 0 && !demoRef.current) {
        while (rt.spawned < rt.plan.count) spawnVillager()
      } else {
        rt.spawnClock += dt
        const demoReady = !demoRef.current || !rt.villagers.some(v => v.state === 'walking')
        if (demoReady && rt.spawned < rt.plan.count && rt.spawnClock >= rt.plan.spawnInterval) {
          rt.spawnClock = 0
          spawnVillager()
        }
      }
    }

    for (const v of rt.villagers) {
      if (v.state === 'walking') {
        v.x = Math.max(FRANK_REACH_X, v.x - v.speed * dt)
        v.walkClock += dt
        if (v.walkClock >= 0.16) {
          v.walkClock = 0
          v.walkFrame = (v.walkFrame + 1) % 4
        }
      } else if (v.state === 'ash') {
        v.ashTimer -= dt
      }
    }

    for (let i = rt.bolts.length - 1; i >= 0; i--) {
      rt.bolts[i].life += dt
      if (rt.bolts[i].life >= rt.bolts[i].maxLife) rt.bolts.splice(i, 1)
    }
    for (let i = rt.bursts.length - 1; i >= 0; i--) {
      rt.bursts[i].life += dt
      if (rt.bursts[i].life >= rt.bursts[i].maxLife) rt.bursts.splice(i, 1)
    }

    processLock(dt)
    const newestBolt = rt.bolts[rt.bolts.length - 1]
    const lightningPhase = lightningPhaseFor(lockProgressRef.current, newestBolt)
    const priorLightningPhase = lightningPhaseTraceRef.current[lightningPhaseTraceRef.current.length - 1]?.phase
    if (priorLightningPhase !== lightningPhase) {
      lightningPhaseTraceRef.current.push({
        phase: lightningPhase,
        logicalMs: Math.round(newestBolt ? newestBolt.life * 1000 : lockProgressRef.current * HOLD_MS),
        chargeProgress: lockProgressRef.current,
      })
      if (lightningPhaseTraceRef.current.length > 80) lightningPhaseTraceRef.current.shift()
    }
    const timersPaused = timersPausedNow()
    const active = getActiveTarget()
    if (active?.villager.state === 'walking' && !timersPaused) {
      const v = active.villager
      v.attackTimer = Math.max(0, v.attackTimer - dt)
      if (v.attackTimer <= 0) {
        reviewTargetNote(active, false)
        frankReactionKindRef.current = 'miss'
        frankReactionStartedAtRef.current = performance.now()
        v.state = 'ash'
        v.ashTimer = 0.9
        rt.health = Math.max(0, rt.health - 1)
        rt.streak = 0
        activeKeyRef.current = ''
        activeVillagerIdRef.current = null
        lockHeldMsRef.current = 0
        lockProgressRef.current = 0
        tintRef.current = null
        setPromptText('')
        localSfx('hurt', sfxVolumeRef.current)
        setHud({ wave: rt.wave, health: rt.health, score: rt.score, streak: rt.streak })
        if (rt.health <= 0) {
          rt.gameOver = true
          phaseRef.current = 'game_over'
          setPhase('game_over')
          return
        }
      }
    }

    rt.villagers = rt.villagers.filter(v => v.state !== 'ash' || v.ashTimer > 0)

    const waveClear = rt.spawned >= rt.plan.count && rt.villagers.every(v => v.state !== 'walking') && rt.bolts.length === 0
    if (waveClear && !rt.nextWavePending) {
      showWaveReceipt(snapshotWaveReceipt())
      rt.nextWavePending = true
      setTimeout(() => {
        if (phaseRef.current !== 'playing') return
        startWave(runtimeRef.current.wave + 1)
      }, WAVE_RECEIPT_MS)
    }
  }, [getActiveTarget, processLock, reviewTargetNote, setPromptText, showWaveReceipt, snapshotWaveReceipt, spawnVillager, startWave, timersPausedNow])

  const updatePitchBarState = useCallback((active: ActiveTarget | null): TunerView => {
    const visible = phaseRef.current === 'playing'
    barVisibleRef.current = visible
    const now = performance.now()
    pitchTrailRef.current = pitchTrailRef.current.filter(p => now - p.at <= TRAIL_MS)
    const source = demoRef.current ? demoPitchRef.current : pitchRef.current
    const canUseSource = !!active &&
      !matchingSuppressedNow() &&
      !!source?.isActive &&
      source.confidence >= CONFIDENCE_FLOOR &&
      source.frequency > 0

    let sourceNote: string | null = null
    let renderDeviation: number | null = null

    if (canUseSource && active && source) {
      const deviation = pitchDeviationSemis(source, active.note)
      const clampedDeviation = clamp(deviation, -6, 6)
      const onTarget = Math.abs(deviation) <= MATCH_TOLERANCE_CENTS / 100
      barDotDeviationRef.current = clampedDeviation
      barOnTargetRef.current = onTarget
      // Ease the readout toward the detected pitch so it glides instead of jittering frame-to-frame.
      smoothDevRef.current += (clampedDeviation - smoothDevRef.current) * 0.28
      pitchTrailRef.current.push({ at: now, deviation: smoothDevRef.current, onTarget, note: source.note })
      sourceNote = source.note || ''
      renderDeviation = smoothDevRef.current
    } else {
      barDotDeviationRef.current = null
      barOnTargetRef.current = false
    }

    return {
      visible,
      now,
      targetNote: active?.note ?? null,
      sourceNote,
      canUseSource,
      dotDeviation: barDotDeviationRef.current,
      renderDeviation,
      onTarget: barOnTargetRef.current,
      trail: pitchTrailRef.current,
    }
  }, [matchingSuppressedNow, pitchRef])

  const loop = useCallback((ts: number) => {
    if (phaseRef.current !== 'playing') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dt = lastTimeRef.current ? Math.min(0.05, (ts - lastTimeRef.current) / 1000) : 0
    lastTimeRef.current = ts
    updateGame(dt)
    syncMicHudState()
    const active = getActiveTarget()
    const tuner = updatePitchBarState(active)
    const frameNow = performance.now()
    const shakeElapsedMs = frameNow - shakeStartedAtRef.current
    const shakeProgress = !reducedMotionRef.current && shakeStartedAtRef.current > 0 && shakeElapsedMs < SHAKE_MS
      ? 1 - Math.max(0, shakeElapsedMs) / SHAKE_MS
      : 0
    const shake: ShakeView = shakeProgress > 0
      ? {
          x: Math.sin(runtimeRef.current.animClock * 47) * SHAKE_PEAK_PX * shakeProgress,
          y: Math.sin(runtimeRef.current.animClock * 61) * SHAKE_PEAK_PX * shakeProgress * 0.6,
        }
      : { x: 0, y: 0 }
    let frankReaction: ViewState['frankReaction'] = null
    const frankReactionKind = frankReactionKindRef.current
    if (frankReactionKind && frankReactionStartedAtRef.current > 0) {
      const ageMs = frameNow - frankReactionStartedAtRef.current
      if (ageMs < FRANK_REACTION_MS) {
        frankReaction = { kind: frankReactionKind, ageMs }
      } else {
        frankReactionKindRef.current = null
        frankReactionStartedAtRef.current = 0
      }
    }
    const view = freezeViewStateForDebug(buildViewState({
      runtime: runtimeRef.current,
      phase: phaseRef.current,
      active,
      activeVillagerId: activeVillagerIdRef.current,
      activeKey: activeKeyRef.current,
      chargeProgress: lockProgressRef.current,
      tint: tintRef.current,
      noteNamesVisible: noteNamesRef.current,
      staffNotationVisible: staffNotationRef.current && layoutModeRef.current !== 'portrait',
      synesthesiaOn: synesthesiaRef.current,
      reducedMotion: reducedMotionRef.current,
      timersPaused: timersPausedRef.current,
      prompt: currentPromptRef.current,
      tuner,
      ceremony: ceremonyRef.current,
      noteMastered: noteMasteredRef.current,
      noteMasteredAgeMs: noteMasteredStartedAtRef.current > 0
        ? performance.now() - noteMasteredStartedAtRef.current
        : 0,
      waveReceipt: waveReceiptRef.current.visible
        ? {
            ...waveReceiptRef.current,
            timer: waveReceiptStartedAtRef.current > 0
              ? (performance.now() - waveReceiptStartedAtRef.current) / 1000
              : 0,
          }
        : waveReceiptRef.current,
      frankReaction,
      shake,
      fsrsMemory: fsrsRef.current,
    }), demoRef.current || fsrsDebugRef.current)
    viewStateRef.current = view
    renderView(ctx, view, assetsRef.current)

    const staffCanvas = staffCanvasRef.current
    if (staffCanvas) {
      const staffCtx = staffCanvas.getContext('2d')
      if (staffCtx) {
        staffCtx.setTransform(1, 0, 0, 1, 0, 0)
        staffCtx.clearRect(0, 0, staffCanvas.width, staffCanvas.height)
        if (layoutModeRef.current === 'portrait' && staffNotationRef.current && view.tuner.visible) {
          staffCtx.setTransform(
            STAFF_BAND_RENDER_SCALE,
            0,
            0,
            STAFF_BAND_RENDER_SCALE,
            -STAFF_PANEL_X * STAFF_BAND_RENDER_SCALE,
            -STAFF_PANEL_Y * STAFF_BAND_RENDER_SCALE,
          )
          drawStaffNotationView(staffCtx, view)
        }
      }
    }

    const actionPrompt = /^(?:Sing|Now):\s+(.+)$/.exec(currentPromptRef.current)
    if ((demoRef.current || fsrsDebugRef.current) && actionPrompt && active && actionPrompt[1] !== active.note) {
      const warningKey = `${actionPrompt[1]}:${active.note}:${active.key}`
      if (promptMismatchWarnedRef.current !== warningKey) {
        promptMismatchWarnedRef.current = warningKey
        console.warn(`[PitchforksIII] action prompt ${actionPrompt[1]} does not match active target ${active.note}`)
      }
    } else {
      promptMismatchWarnedRef.current = ''
    }
    if (!runtimeRef.current.gameOver) rafRef.current = requestAnimationFrame(loop)
  }, [getActiveTarget, syncMicHudState, updateGame, updatePitchBarState])

  const beginPlaying = useCallback(() => {
    resumeCueAudioFromGesture()
    clearCueTimers()
    clearNewNoteCeremony()
    clearNoteMasteredCeremony()
    clearWaveReceipt()
    runtimeRef.current = makeInitialRuntime(demoRef.current)
    viewStateRef.current = null
    lightningPhaseTraceRef.current = []
    nextIdRef.current = 0
    waveNotesHeardRef.current = new Set()
    waveNotesSungRef.current = new Set()
    waveStartedAtRef.current = Date.now()
    activeKeyRef.current = ''
    activeVillagerIdRef.current = null
    activePromptKeyRef.current = ''
    promptStartedAtRef.current = 0
    failureGradedKeysRef.current = new Set()
    consecutiveCorrectRef.current = 0
    for (const note of unlockedNotesRef.current) ensureNoteMemory(note)
    demoTargetRef.current = ''
    demoLockCountRef.current = 0
    demoStepRef.current = 'idle'
    silenceFreezeObservedRef.current = false
    resetCountRef.current = 0
    lastResetReasonRef.current = null
    burnedTinesRef.current = 0
    ashCountRef.current = 0
    lastAshAtRef.current = 0
    lastStrikeNoteRef.current = null
    lastStrikeHueRef.current = null
    lastKillNoteRef.current = null
    lastKillHueRef.current = null
    shakeStartedAtRef.current = 0
    frankReactionKindRef.current = null
    frankReactionStartedAtRef.current = 0
    roarFiredCountRef.current = 0
    fullSequenceCompleteRef.current = false
    lockHeldMsRef.current = 0
    lockProgressRef.current = 0
    tintRef.current = null
    currentPromptRef.current = ''
    timersPausedRef.current = false
    firstLockGraceRef.current = true
    pitchTrailRef.current = []
    barDotDeviationRef.current = null
    barOnTargetRef.current = false
    barVisibleRef.current = false
    lockWhileSuppressedRef.current = false
    micHudStateRef.current = demoRef.current ? 'demo' : 'waiting'
    setMicHudState(micHudStateRef.current)
    setHud({ wave: 1, health: STARTING_HEALTH, score: 0, streak: 0 })
    setPhase('playing')
    phaseRef.current = 'playing'
    lastTimeRef.current = 0
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(loop)
  }, [clearCueTimers, clearNewNoteCeremony, clearNoteMasteredCeremony, clearWaveReceipt, ensureNoteMemory, loop, resumeCueAudioFromGesture])

  const startGame = useCallback(() => {
    beginPlaying()
  }, [beginPlaying])

  const beginCalibration = useCallback(async () => {
    if (demoRef.current) {
      beginPlaying()
      return
    }
    heardYouRef.current = false
    setHeardYou(false)
    phaseRef.current = 'calibrating'
    setPhase('calibrating')
    await startListening()
  }, [beginPlaying, startListening])

  const quitToMenu = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    clearCueTimers()
    clearNewNoteCeremony()
    clearNoteMasteredCeremony()
    clearWaveReceipt()
    phaseRef.current = 'menu'
    viewStateRef.current = null
    stopListening()
    micHudStateRef.current = 'waiting'
    setMicHudState('waiting')
    setPhase('menu')
  }, [clearCueTimers, clearNewNoteCeremony, clearNoteMasteredCeremony, clearWaveReceipt, stopListening])

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    clearCueTimers()
    clearCeremonyTimers()
    clearNoteMasteredTimer()
    clearWaveReceiptTimer()
    stopListening()
  }, [clearCeremonyTimers, clearCueTimers, clearNoteMasteredTimer, clearWaveReceiptTimer, stopListening])

  const micHudView: Record<MicHudState, { label: string; className: string; dotClassName: string }> = {
    demo: {
      label: 'Demo mode',
      className: 'border-orange-500/50 text-orange-100 bg-orange-950/45',
      dotClassName: 'bg-orange-300',
    },
    cue: {
      label: 'Cue...',
      className: 'border-amber-500/60 text-amber-100 bg-amber-950/45',
      dotClassName: 'bg-amber-300 animate-pulse',
    },
    listening: {
      label: 'Mic listening',
      className: 'border-green-500/60 text-green-100 bg-green-950/45',
      dotClassName: pitch?.isActive ? 'bg-green-300 animate-ping' : 'bg-green-500',
    },
    waiting: {
      label: 'Mic waiting',
      className: 'border-gray-700 text-gray-300 bg-black/35',
      dotClassName: 'bg-gray-500',
    },
    blocked: {
      label: 'Mic blocked',
      className: 'border-red-500/60 text-red-100 bg-red-950/45',
      dotClassName: 'bg-red-400',
    },
  }
  const activeMicHud = micHudView[micHudState]
  const calibrationReady = heardYou && !micError
  const calibrationHudLabel = micError
    ? activeMicHud.label
    : heardYou
      ? 'We hear you!'
      : micHudState === 'waiting'
        ? 'Connecting mic...'
        : activeMicHud.label
  const newNoteCeremonyBanner = ceremony.active && ceremony.note ? (
    <div
      className="absolute top-16 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 border px-4 py-2 text-sm font-black tracking-widest text-gray-100"
      style={ceremonyBannerStyle(ceremony.note)}
      data-testid="pf3-new-note-ceremony"
    >
      <span>New note</span>
      <span
        key={ceremony.tonePulseKey}
        className={`inline-flex min-h-7 min-w-12 items-center justify-center border px-2 py-1 text-[12px] font-black tracking-widest${ceremony.toneFired ? ' animate-pulse' : ''}`}
        style={ceremonyNoteStyle(ceremony.note, fsrsRef.current, ceremony.toneFired)}
      >
        {ceremony.note}
      </span>
      <button
        type="button"
        onClick={() => replayNewNoteCeremonyTone(ceremony.note!)}
        className="inline-flex min-h-7 min-w-7 items-center justify-center border p-1 transition hover:brightness-125 hover:scale-105 active:scale-95"
        style={ceremonyReplayButtonStyle(ceremony.note)}
        aria-label="Replay note tone"
      >
        <RotateCcw size={14} strokeWidth={3} aria-hidden="true" />
      </button>
    </div>
  ) : null

  if (phase === 'menu') {
    return (
      <div className="fixed inset-0 bg-[#070914] text-gray-100 flex items-center justify-center px-4" style={{ fontFamily: 'monospace' }}>
        {newNoteCeremonyBanner}
        {demoMode && (
          <div className="absolute top-4 right-4 text-[11px] font-bold tracking-widest text-orange-200 border border-orange-500/50 px-2 py-1">
            DEMO
          </div>
        )}
        <div className="w-full max-w-lg border border-orange-900/60 bg-black/30 p-5">
          <div className="flex items-center justify-between mb-4">
            <Link href="/pitch-defender" className="text-xs text-orange-300 hover:text-orange-100">
              Back
            </Link>
            <Link href="/pitch-defender/pitchforks" className="text-xs text-gray-500 hover:text-gray-300">
              V1
            </Link>
          </div>
          <h1 className="text-3xl font-black tracking-widest text-orange-200 mb-1">PITCHFORKS III</h1>
          <div className="text-sm text-gray-400 mb-2">Frankenstein lightning ear trainer</div>
          <div className="mb-5 grid grid-cols-2 sm:grid-cols-4 gap-1.5" aria-label="World Map">
            {WORLD_REGISTRY.map(world => {
              const unlocked = isWorldUnlocked(world.id)
              const current = world.playable && unlocked

              return (
                <div
                  key={world.id}
                  className={[
                    'min-h-28 border px-2 py-2 text-left',
                    current
                      ? 'border-orange-200 bg-orange-500/10 text-orange-100'
                      : 'border-gray-700/80 bg-black/20 text-gray-400',
                  ].join(' ')}
                  aria-disabled={unlocked ? undefined : true}
                >
                  <div className="min-h-8">
                    {current ? (
                      <span className="inline-flex border border-orange-200/60 px-1 py-0.5 text-[9px] font-black text-orange-100">
                        PLAYING
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500" aria-hidden="true">
                        &#128274;
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] font-black uppercase leading-tight">
                    {world.name}
                  </div>
                  {!current && (
                    <div className="mt-2 text-[10px] leading-snug text-gray-500">
                      {world.gateLabel}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="mb-5">
            <div className="text-xs text-green-200/80 mb-2">{unlockedNotes.length} notes unlocked</div>
            <div className="flex flex-wrap gap-1.5" aria-label="Unlocked notes">
              {unlockedNotes.map(note => (
                <span
                  key={note}
                  className="inline-flex min-h-6 min-w-10 items-center justify-center border px-2 py-1 text-[11px] font-black tracking-widest"
                  style={noteChipStyle(note, fsrsRef.current)}
                >
                  {note}
                </span>
              ))}
            </div>
          </div>
          {assetError && <div className="text-sm text-red-300 mb-4">{assetError}</div>}
          {micError && !demoMode && <div className="text-xs text-red-300 mb-4">{micError}</div>}
          <SettingsRow
            noteNamesOn={noteNamesOn}
            setNoteNamesOn={setNoteNamesOn}
            audioCueOn={audioCueOn}
            setAudioCueOn={setAudioCueOn}
            staffNotationOn={staffNotationOn}
            setStaffNotationOn={setStaffNotationOn}
            synesthesiaOn={synesthesiaOn}
            setSynesthesiaOn={setSynesthesiaOn}
            reducedMotion={reducedMotion}
            setReducedMotion={setReducedMotion}
            cueVolume={cueVolume}
            setCueVolume={setCueVolume}
            sfxVolume={sfxVolume}
            setSfxVolume={setSfxVolume}
          />
          <button
            onClick={() => {
              if (demoMode) {
                startGame()
              } else {
                phaseRef.current = 'tutorial'
                setPhase('tutorial')
              }
            }}
            disabled={!assetsReady}
            data-testid="pf3-how-to-play"
            className="mt-5 w-full py-3 text-lg font-black tracking-widest border transition active:scale-[0.99] disabled:opacity-50"
            style={{
              background: assetsReady ? '#bfefff' : '#25313c',
              color: '#071018',
              borderColor: '#e8fbff',
            }}
          >
            {demoMode ? 'START DEMO' : 'HOW TO PLAY'}
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'tutorial') {
    return (
      <div className="fixed inset-0 bg-[#070914] text-gray-100 flex flex-col items-center justify-center px-6" style={{ fontFamily: 'monospace' }}>
        <h2 className="text-2xl font-black text-[#4ade80] mb-4 tracking-widest" style={{ textShadow: '0 0 15px rgba(74,222,128,0.3)' }}>
          HOW TO PLAY
        </h2>

        <div className="max-w-md space-y-4 mb-8">
          <div className="flex items-start gap-3">
            <div className="text-2xl">🧟</div>
            <div>
              <div className="text-sm text-green-300 font-bold">You are the monster</div>
              <div className="text-xs text-gray-400">Defend yourself by singing the notes carried by the villagers.</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="text-2xl">🔱</div>
            <div>
              <div className="text-sm text-yellow-300 font-bold">Forks and tines</div>
              <div className="text-xs text-gray-400">Each tine is one note. Multi-tine forks are sung in order.</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="text-2xl">🔊</div>
            <div>
              <div className="text-sm text-orange-300 font-bold">Replay anytime</div>
              <div className="text-xs text-gray-400">Use REPLAY NOTES to hear the active villager again.</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="text-2xl">📊</div>
            <div>
              <div className="text-sm text-purple-300 font-bold">Watch the pitch bar</div>
              <div className="text-xs text-gray-400">Dot left is too low, dot right is too high, green is on target.</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="text-2xl">🐢</div>
            <div>
              <div className="text-sm text-gray-300 font-bold">Level 1 is slow</div>
              <div className="text-xs text-gray-400">Few villagers, generous spacing, and lots of time.</div>
            </div>
          </div>
        </div>

        <button
          onClick={beginCalibration}
          className="px-10 py-4 text-lg font-bold tracking-widest transition-all active:scale-95"
          style={{
            background: '#4ade80',
            color: '#0a0812',
            border: '2px solid #6ee7a0',
            boxShadow: '0 0 20px rgba(74,222,128,0.3)',
          }}
        >
          START GAME
        </button>

        <button
          onClick={() => {
            phaseRef.current = 'menu'
            setPhase('menu')
          }}
          className="mt-4 text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          Back to menu
        </button>
      </div>
    )
  }

  if (phase === 'calibrating') {
    return (
      <div className="fixed inset-0 bg-[#070914] text-gray-100 flex flex-col items-center justify-center px-6" style={{ fontFamily: 'monospace' }}>
        <div className="w-full max-w-md border border-green-900/60 bg-black/35 p-6 text-center">
          <div className={`mx-auto mb-5 inline-flex items-center gap-3 border px-5 py-3 text-sm font-black tracking-widest ${activeMicHud.className}`}>
            <Mic size={28} strokeWidth={2.5} aria-hidden="true" />
            <span className={`h-4 w-4 rounded-full ${activeMicHud.dotClassName}`} aria-hidden="true" />
            <span>{calibrationHudLabel}</span>
          </div>

          <h2 className="mb-3 text-xl font-black tracking-widest text-green-200">MIC CHECK</h2>
          <p className="mb-5 text-sm text-gray-300">Hum or sing anything. We just need to hear your voice.</p>

          {micError && <div className="mb-5 text-xs text-red-300">{micError}</div>}

          <button
            type="button"
            onClick={beginPlaying}
            disabled={!calibrationReady}
            className="w-full py-3 text-sm font-black tracking-widest border border-green-200 bg-green-300 text-[#071018] transition active:scale-[0.99] disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-500 disabled:opacity-70"
          >
            Enter the Village
          </button>

          <button
            type="button"
            onClick={quitToMenu}
            className="mt-4 text-xs text-gray-500 transition-colors hover:text-gray-300"
          >
            Back to menu
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'game_over') {
    return (
      <div className="fixed inset-0 bg-[#070914] text-gray-100 flex items-center justify-center px-4" style={{ fontFamily: 'monospace' }}>
        {demoMode && <div className="absolute top-4 right-4 text-[11px] font-bold tracking-widest text-orange-200">DEMO</div>}
        <div className="w-full max-w-md border border-red-900/60 bg-black/35 p-5 text-center">
          <div className="text-3xl font-black text-red-300 tracking-widest mb-4">GAME OVER</div>
          <div className="grid grid-cols-3 gap-3 mb-5 text-sm">
            <div><div className="text-gray-500">Score</div><div className="text-xl text-white">{hud.score}</div></div>
            <div><div className="text-gray-500">Wave</div><div className="text-xl text-orange-200">{hud.wave}</div></div>
            <div><div className="text-gray-500">Streak</div><div className="text-xl text-green-200">{hud.streak}</div></div>
          </div>
          <div className="flex gap-3">
            <button onClick={beginCalibration} className="flex-1 py-2 bg-orange-200 text-[#071018] font-bold border border-orange-100">
              AGAIN
            </button>
            <button onClick={quitToMenu} className="flex-1 py-2 border border-gray-700 text-gray-300">
              MENU
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-gray-100 flex flex-col" style={{ fontFamily: 'monospace' }}>
      <div ref={canvasContainerRef} className="relative flex-1 min-h-0 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="block object-contain mx-auto"
          style={{ width: canvasDisplaySize.width, height: canvasDisplaySize.height, imageRendering: 'pixelated' }}
        />

        {layoutMode === 'portrait' && staffNotationOn && portraitStaffDisplaySize.height >= 64 && (
          <div
            data-testid="pf3-portrait-staff-band"
            className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-lg bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.12),rgba(7,9,20,0)_72%)] shadow-[0_0_28px_rgba(34,211,238,0.10)]"
            style={{ width: portraitStaffDisplaySize.width, height: portraitStaffDisplaySize.height }}
          >
            <canvas
              ref={staffCanvasRef}
              width={STAFF_PANEL_W * STAFF_BAND_RENDER_SCALE}
              height={STAFF_PANEL_H * STAFF_BAND_RENDER_SCALE}
              className="block h-full w-full"
              role="img"
              aria-label="Staff notation for the active pitch sequence"
            >
              Staff notation for the active pitch sequence.
            </canvas>
          </div>
        )}

        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2 text-xs bg-black/60 border border-gray-800 px-3 py-2">
          <span>Score {hud.score}</span>
          <span>Wave {hud.wave}</span>
          {hud.streak >= 3 && <span>Combo {hud.streak}x</span>}
          <span
            className={`inline-flex min-h-7 items-center gap-2 border px-2 py-1 font-bold ${activeMicHud.className}`}
            title={activeMicHud.label}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${activeMicHud.dotClassName}`} />
            {activeMicHud.label}
          </span>
        </div>

        {demoMode && (
          <div className="absolute top-3 right-3 text-[11px] font-bold tracking-widest text-orange-200 bg-black/60 border border-orange-500/50 px-2 py-1">
            DEMO
          </div>
        )}
        {newNoteCeremonyBanner}
      </div>

      <div
        className="w-full shrink-0 bg-[#070914] border-t border-gray-800 flex flex-col items-center gap-2 px-3 pt-3"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
      >
        <button
          onClick={() => {
            const active = getActiveTarget()
            if (active) playVillagerSequence(active.villager, 'replay')
          }}
          data-testid="pf3-replay-notes"
          className="min-h-[44px] w-full max-w-[360px] px-5 py-2 text-sm font-black tracking-widest text-yellow-200 border border-yellow-500 bg-yellow-950/45 active:scale-95 transition-all hover:bg-yellow-900/50"
        >
          🔊 REPLAY NOTES
        </button>
        <div className="flex w-full max-w-[760px] flex-wrap items-center justify-center gap-2">
          <SettingsRow
            noteNamesOn={noteNamesOn}
            setNoteNamesOn={setNoteNamesOn}
            audioCueOn={audioCueOn}
            setAudioCueOn={setAudioCueOn}
            staffNotationOn={staffNotationOn}
            setStaffNotationOn={setStaffNotationOn}
            synesthesiaOn={synesthesiaOn}
            setSynesthesiaOn={setSynesthesiaOn}
            reducedMotion={reducedMotion}
            setReducedMotion={setReducedMotion}
            cueVolume={cueVolume}
            setCueVolume={setCueVolume}
            sfxVolume={sfxVolume}
            setSfxVolume={setSfxVolume}
            compact
          />
          <button onClick={quitToMenu} className="min-h-8 text-xs text-gray-300 hover:text-gray-100 border border-gray-700 px-3 py-1">
            Quit
          </button>
        </div>
      </div>
      {geometryDebug && (
        <div
          data-testid="pf3-geometry-debug"
          className="absolute bottom-2 right-2 z-50 border border-cyan-500/70 bg-black/90 px-2 py-1 text-[10px] leading-4 text-cyan-100"
        >
          <div>viewport {viewportGeometry.width}x{viewportGeometry.height}</div>
          <div>dpr {viewportGeometry.dpr.toFixed(2)} · visual {viewportGeometry.visualScale.toFixed(2)}</div>
          <div>container {viewportGeometry.containerWidth.toFixed(1)}x{viewportGeometry.containerHeight.toFixed(1)}</div>
          <div>canvas {canvasDisplaySize.width.toFixed(1)}x{canvasDisplaySize.height.toFixed(1)}</div>
          <div>mode {layoutMode}</div>
        </div>
      )}
    </div>
  )
}

function SettingsRow(props: {
  noteNamesOn: boolean
  setNoteNamesOn: (value: boolean) => void
  audioCueOn: boolean
  setAudioCueOn: (value: boolean) => void
  staffNotationOn: boolean
  setStaffNotationOn: (value: boolean) => void
  synesthesiaOn: boolean
  setSynesthesiaOn: (value: boolean) => void
  reducedMotion: boolean
  setReducedMotion: (value: boolean) => void
  cueVolume: number
  setCueVolume: (value: number) => void
  sfxVolume: number
  setSfxVolume: (value: number) => void
  compact?: boolean
}) {
  return (
    <div className={`flex max-w-full flex-wrap items-center justify-center ${props.compact ? 'gap-2 text-[11px]' : 'gap-3 text-xs'}`}>
      <button
        onClick={() => props.setNoteNamesOn(!props.noteNamesOn)}
        className={`px-2 py-1 border ${props.noteNamesOn ? 'border-orange-400 text-orange-100 bg-orange-950/40' : 'border-gray-700 text-gray-400'}`}
      >
        Note names {props.noteNamesOn ? 'ON' : 'OFF'}
      </button>
      <button
        onClick={() => props.setAudioCueOn(!props.audioCueOn)}
        className={`px-2 py-1 border ${props.audioCueOn ? 'border-orange-400 text-orange-100 bg-orange-950/40' : 'border-gray-700 text-gray-400'}`}
      >
        Audio cue {props.audioCueOn ? 'ON' : 'OFF'}
      </button>
      <button
        onClick={() => props.setStaffNotationOn(!props.staffNotationOn)}
        aria-pressed={props.staffNotationOn}
        data-testid="pf3-staff-notation-toggle"
        className={`px-2 py-1 border ${props.staffNotationOn ? 'border-orange-400 text-orange-100 bg-orange-950/40' : 'border-gray-700 text-gray-400'}`}
      >
        Staff notation {props.staffNotationOn ? 'ON' : 'OFF'}
      </button>
      <button
        onClick={() => props.setSynesthesiaOn(!props.synesthesiaOn)}
        className={`px-2 py-1 border ${props.synesthesiaOn ? 'border-orange-400 text-orange-100 bg-orange-950/40' : 'border-gray-700 text-gray-400'}`}
      >
        Note colors {props.synesthesiaOn ? 'ON' : 'OFF'}
      </button>
      <button
        onClick={() => props.setReducedMotion(!props.reducedMotion)}
        className={`px-2 py-1 border ${props.reducedMotion ? 'border-orange-400 text-orange-100 bg-orange-950/40' : 'border-gray-700 text-gray-400'}`}
      >
        Reduced motion {props.reducedMotion ? 'ON' : 'OFF'}
      </button>
      <label className="flex items-center gap-2 text-gray-300">
        Cue
        <input
          type="range"
          min={0}
          max={200}
          value={props.cueVolume}
          onChange={e => props.setCueVolume(Number(e.target.value))}
          className="w-24 accent-orange-300"
        />
      </label>
      <label className="flex items-center gap-2 text-gray-300">
        SFX
        <input
          type="range"
          min={0}
          max={200}
          value={props.sfxVolume}
          onChange={e => props.setSfxVolume(Number(e.target.value))}
          className="w-24 accent-orange-300"
        />
      </label>
    </div>
  )
}
