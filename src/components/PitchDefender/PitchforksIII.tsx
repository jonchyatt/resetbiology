'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePitchDetection, type PitchInfo } from './usePitchDetection'
import { noteToFreq, octaveFoldedCents } from './pitchMath'
import {
  initAudio,
  loadPianoSamples,
  markToneEmitted,
  playPianoNote,
  setPianoVolume,
  isWithinToneSuppressionWindow,
} from './audioEngine'
import { NOTE_COLORS } from '@/lib/fsrs'

const W = 720
const H = 405
const SPRITE_SCALE = 3
const ASSET_BASE = '/images/pitchforks'
const NOTE_POOL = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

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
const ECHO_TAIL_MS = 600
const TONE_SUPPRESS_MS = TONE_MS + ECHO_TAIL_MS
const TRAIL_MS = 1000
const PITCH_BAR_Y = H - 52
const PITCH_BAR_H = 12
const PITCH_BAR_X = 34
const PITCH_BAR_W = W - PITCH_BAR_X * 2

type Phase = 'menu' | 'tutorial' | 'playing' | 'game_over'
type TineCount = 2 | 3 | 4
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
}

type BurstKind = 'strike' | 'kill'

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

interface HudState {
  wave: number
  health: number
  score: number
  streak: number
}

type MicHudState = 'demo' | 'cue' | 'listening' | 'waiting' | 'blocked'

type Pf3ResetReason = 'confident-wrong' | 'silence' | null

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
}

declare global {
  interface Window {
    __pf3?: {
      getState: () => Readonly<Pf3DebugState>
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
    villagerMeta: { 2: defaultVillagerMeta, 3: defaultVillagerMeta, 4: defaultVillagerMeta },
    forkMeta: { 2: defaultForkMeta, 3: defaultForkMeta, 4: defaultForkMeta },
    walkLeft: { 2: undefined, 3: undefined, 4: undefined },
    burnedLeft: {},
    ashLeft: { 2: undefined, 3: undefined, 4: undefined },
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

function pickNote(index: number, wave: number): string {
  return NOTE_POOL[(index * 3 + wave * 2) % NOTE_POOL.length]
}

function fixedWaveDirector(wave: number, demo: boolean): WavePlan {
  // ported shape from Pitchforks.tsx:326-341, adapted to III's tine waves.
  const speed = Math.min(60, 22 + (wave - 1) * 6)
  if (wave === 1) {
    return { wave, count: 3, spawnInterval: demo ? 0.01 : 0, speed, tineCounts: [2, 3, 4] }
  }

  const count = Math.min(2 + wave, 6)
  const spawnInterval = Math.max(0.9, 3.1 - (wave - 1) * 0.35)
  const p4 = Math.min(0.38, 0.2 + (wave - 1) * 0.035)
  const p2 = Math.max(0.24, 0.5 - (wave - 1) * 0.045)
  const tineCounts: TineCount[] = []
  for (let i = 0; i < count; i++) {
    if (wave === 1) {
      tineCounts.push(([2, 3, 4] as TineCount[])[i % 3])
      continue
    }
    const roll = Math.random()
    tineCounts.push(roll < p2 ? 2 : roll < p2 + (1 - p2 - p4) ? 3 : 4)
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function hueForNote(note: string | undefined): number {
  return note ? (NOTE_COLORS[note]?.hue ?? 0) : 0
}

function pitchDeviationSemis(source: PitchInfo, targetNote: string): number {
  return octaveFoldedCents(source.frequency, noteToFreq(targetNote)) / 100
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
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const lastTimeRef = useRef(0)
  const runtimeRef = useRef<Runtime>(makeInitialRuntime(false))
  const assetsRef = useRef<Assets>(emptyAssets())
  const nextIdRef = useRef(0)
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
  const lastStrikeNoteRef = useRef<string | null>(null)
  const lastStrikeHueRef = useRef<number | null>(null)
  const lastKillNoteRef = useRef<string | null>(null)
  const lastKillHueRef = useRef<number | null>(null)
  const roarFiredCountRef = useRef(0)
  const fullSequenceCompleteRef = useRef(false)
  const phaseRef = useRef<Phase>('menu')
  const cueVolumeRef = useRef(100)
  const sfxVolumeRef = useRef(100)
  const noteNamesRef = useRef(true)
  const audioCueRef = useRef(true)
  const currentPromptRef = useRef('')
  const cueTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const cuePlayingUntilRef = useRef(0)
  const matchingSuppressedUntilRef = useRef(0)
  const timersPausedRef = useRef(false)
  const firstLockGraceRef = useRef(false)
  const isListeningRef = useRef(false)
  const micErrorRef = useRef<string | null>(null)
  const pitchTrailRef = useRef<TrailPoint[]>([])
  const barDotDeviationRef = useRef<number | null>(null)
  const barOnTargetRef = useRef(false)
  const barVisibleRef = useRef(false)
  const activeVillagerIdRef = useRef<number | null>(null)
  const lockWhileSuppressedRef = useRef(false)
  const micHudStateRef = useRef<MicHudState>('waiting')

  const [phase, setPhase] = useState<Phase>('menu')
  const [assetsReady, setAssetsReady] = useState(false)
  const [assetError, setAssetError] = useState<string | null>(null)
  const [hud, setHud] = useState<HudState>({ wave: 1, health: STARTING_HEALTH, score: 0, streak: 0 })
  const [noteNamesOn, setNoteNamesOn] = useState(true)
  const [audioCueOn, setAudioCueOn] = useState(true)
  const [cueVolume, setCueVolume] = useState(100)
  const [sfxVolume, setSfxVolume] = useState(100)
  const [demoMode, setDemoMode] = useState(false)
  const [micHudState, setMicHudState] = useState<MicHudState>('waiting')

  const { isListening, pitch, pitchRef, startListening, stopListening, error: micError } = usePitchDetection({ noiseGateDb: -45 })

  useEffect(() => {
    noteNamesRef.current = noteNamesOn
  }, [noteNamesOn])

  useEffect(() => {
    audioCueRef.current = audioCueOn
  }, [audioCueOn])

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
    const isDemo = new URLSearchParams(window.location.search).get('demo') === '1'
    demoRef.current = isDemo
    setDemoMode(isDemo)
  }, [])

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
        if (!cancelled) setAssetsReady(true)
      } catch (err) {
        if (!cancelled) setAssetError(err instanceof Error ? err.message : 'Sprite load failed')
      }
    })()
    loadPianoSamples().catch(() => {})
    return () => { cancelled = true }
  }, [])

  const getActiveVillager = useCallback(() => {
    const walkers = runtimeRef.current.villagers.filter(v => v.state === 'walking' && v.burned < v.totalTines)
    if (walkers.length === 0) return null
    walkers.sort((a, b) => a.x - b.x)
    return walkers[0]
  }, [])

  const getActiveTarget = useCallback(() => {
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

  const playVillagerSequence = useCallback((villager: Villager, mode: 'cue' | 'replay') => {
    if (!villager.notes.length) return
    clearCueTimers()

    const now = performance.now()
    const toneWindowMs = (villager.notes.length - 1) * TONE_SPACING_MS + TONE_MS
    const suppressMs = toneWindowMs + ECHO_TAIL_MS
    cuePlayingUntilRef.current = now + toneWindowMs
    matchingSuppressedUntilRef.current = now + suppressMs
    timersPausedRef.current = true
    markToneEmitted(suppressMs)
    if (demoRef.current) demoStepRef.current = mode === 'replay' ? 'replay-cue' : 'auto-cue'

    villager.notes.forEach((note, index) => {
      const id = setTimeout(() => {
        setPromptText(index === 0 ? `Sing: ${note}` : `Now: ${note}`)
        if (mode === 'replay' || audioCueRef.current) {
          setPianoVolume(cueVolumeRef.current)
          try {
            playPianoNote(note, { exact: true })
          } finally {
            markToneEmitted(TONE_SUPPRESS_MS)
          }
        } else {
          markToneEmitted(TONE_SUPPRESS_MS)
        }
      }, index * TONE_SPACING_MS)
      cueTimeoutsRef.current.push(id)
    })

    const doneId = setTimeout(() => {
      if (
        phaseRef.current === 'playing' &&
        activeVillagerIdRef.current === villager.id &&
        villager.state === 'walking'
      ) {
        const note = villager.notes[villager.burned]
        if (note) setPromptText(villager.burned === 0 ? `Sing: ${note}` : `Now: ${note}`)
      }
    }, suppressMs)
    cueTimeoutsRef.current.push(doneId)
  }, [clearCueTimers, setPromptText])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!demoMode) {
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
      })
    }
    const hook = Object.freeze({ getState })

    Object.defineProperty(window, '__pf3', {
      configurable: true,
      value: hook,
    })

    return () => {
      if (window.__pf3 === hook) delete window.__pf3
    }
  }, [cuePlayingNow, demoMode, getActiveTarget, matchingSuppressedNow])

  const spawnVillager = useCallback(() => {
    const rt = runtimeRef.current
    if (rt.spawned >= rt.plan.count) return
    const spawnIndex = rt.spawned
    const totalTines = rt.plan.tineCounts[rt.spawned] ?? 2
    const lane = spawnIndex % 3
    const notes = Array.from({ length: totalTines }, (_, i) => pickNote(rt.spawned + i, rt.wave))
    const attackTimer = attackTimeForWave(rt.wave, spawnIndex)
    const v: Villager = {
      id: ++nextIdRef.current,
      totalTines,
      x: rt.wave === 1 ? W + 60 + spawnIndex * 70 : W + 42 + lane * 18,
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
  }, [])

  const startWave = useCallback((wave: number) => {
    const rt = runtimeRef.current
    rt.wave = wave
    rt.plan = fixedWaveDirector(wave, demoRef.current)
    rt.spawned = 0
    rt.spawnClock = 0
    rt.bannerTimer = 1.15
    rt.nextWavePending = false
    activeKeyRef.current = ''
    activeVillagerIdRef.current = null
    lockHeldMsRef.current = 0
    lockProgressRef.current = 0
    tintRef.current = null
    setPromptText('')
    if (demoRef.current) demoStepRef.current = 'wave-banner'
    setHud({ wave, health: rt.health, score: rt.score, streak: rt.streak })
  }, [setPromptText])

  const addBolt = useCallback((villager: Villager, tineIndex: number) => {
    const a = assetsRef.current
    const frankMeta = a.frankMeta
    const vMeta = a.villagerMeta[villager.totalTines]
    const tine = vMeta.tines[Math.max(0, Math.min(tineIndex, vMeta.tines.length - 1))]
    const pivotX = FRANK_X + frankMeta.rod_tip.x * SPRITE_SCALE
    const pivotY = FRANK_Y + frankMeta.rod_tip.y * SPRITE_SCALE
    const toX = villager.x + (vMeta.frame_w - tine.x) * SPRITE_SCALE
    const toY = villager.y + tine.y * SPRITE_SCALE
    runtimeRef.current.bolts.push({
      fromX: pivotX + 26,
      fromY: 18,
      pivotX,
      pivotY,
      toX,
      toY,
      life: 0,
      maxLife: 0.34,
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
      life: 0,
      maxLife: kind === 'kill' ? 0.58 : 0.26,
    })
  }, [])

  const strikeActiveTine = useCallback((target: NonNullable<ReturnType<typeof getActiveTarget>>) => {
    const rt = runtimeRef.current
    const { villager, tineIndex } = target
    const strikeNote = target.note ?? villager.notes[villager.burned]
    const strikeHue = hueForNote(strikeNote)
    lastStrikeNoteRef.current = strikeNote ?? null
    lastStrikeHueRef.current = strikeHue
    addBolt(villager, tineIndex)
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
      fullSequenceCompleteRef.current = true
      if (demoRef.current) demoStepRef.current = 'ash'
      rt.streak += 1
      const comboMult = rt.streak >= 10 ? 3 : rt.streak >= 5 ? 2 : 1
      rt.score += (100 + villager.totalTines * 20) * comboMult
      lastKillNoteRef.current = strikeNote ?? null
      lastKillHueRef.current = strikeHue
      addBurst(villager, strikeHue, 'kill')
      localSfx('ash', sfxVolumeRef.current)
      localSfx('roar', sfxVolumeRef.current)
      roarFiredCountRef.current += 1
      setHud({ wave: rt.wave, health: rt.health, score: rt.score, streak: rt.streak })
    } else {
      const nextNote = villager.notes[villager.burned]
      if (nextNote) setPromptText(`Now: ${nextNote}`)
    }
    if (firstLockGraceRef.current) firstLockGraceRef.current = false
  }, [addBolt, addBurst, matchingSuppressedNow, setPromptText])

  const demoPitchForTarget = useCallback((target: NonNullable<ReturnType<typeof getActiveTarget>>, now: number): PitchInfo | null => {
    if (demoTargetRef.current !== target.key) {
      demoTargetRef.current = target.key
      demoTargetStartedRef.current = now
    }
    const elapsed = now - demoTargetStartedRef.current
    const targetFreq = noteToFreq(target.note)
    const firstTargetScript = demoLockCountRef.current === 0

    if (ashCountRef.current > 0) {
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

    const cents = octaveFoldedCents(source.frequency, noteToFreq(target.note))
    const absCents = Math.abs(cents)
    tintRef.current = colorForCents(absCents)

    if (absCents <= MATCH_TOLERANCE_CENTS) {
      lockHeldMsRef.current = Math.min(HOLD_MS, lockHeldMsRef.current + dt * 1000)
      lockProgressRef.current = Math.min(1, lockHeldMsRef.current / HOLD_MS)
      if (lockProgressRef.current >= 1) {
        strikeActiveTine(target)
      }
    } else {
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
        if (rt.wave === 1) {
          while (rt.spawned < rt.plan.count) spawnVillager()
        } else {
          spawnVillager()
        }
      }
    } else {
      if (rt.wave === 1 && rt.spawned === 0) {
        while (rt.spawned < rt.plan.count) spawnVillager()
      } else {
        rt.spawnClock += dt
        if (rt.spawned < rt.plan.count && rt.spawnClock >= rt.plan.spawnInterval) {
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
    const timersPaused = timersPausedNow()
    const active = getActiveTarget()
    if (active?.villager.state === 'walking' && !timersPaused) {
      const v = active.villager
      v.attackTimer = Math.max(0, v.attackTimer - dt)
      if (v.attackTimer <= 0) {
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

    const waveClear = rt.spawned >= rt.plan.count && rt.villagers.every(v => v.state !== 'walking')
    if (waveClear && !rt.nextWavePending) {
      rt.nextWavePending = true
      setTimeout(() => {
        if (phaseRef.current !== 'playing') return
        startWave(runtimeRef.current.wave + 1)
      }, 900)
    }
  }, [getActiveTarget, processLock, setPromptText, spawnVillager, startWave, timersPausedNow])

  const drawBolt = useCallback((ctx: CanvasRenderingContext2D, b: Bolt) => {
    const t = 1 - b.life / b.maxLife
    ctx.save()
    ctx.globalAlpha = Math.max(0, t)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const jitter = () => (Math.random() - 0.5) * 10
    for (const width of [10, 5, 2]) {
      ctx.strokeStyle = width === 2 ? '#ffffff' : width === 5 ? '#9fe7ff' : 'rgba(80, 190, 255, 0.32)'
      ctx.lineWidth = width
      ctx.beginPath()
      ctx.moveTo(b.fromX, b.fromY)
      ctx.lineTo((b.fromX + b.pivotX) / 2 + jitter(), (b.fromY + b.pivotY) / 2 + jitter())
      ctx.lineTo(b.pivotX, b.pivotY)
      ctx.lineTo((b.pivotX + b.toX) / 2 + jitter(), (b.pivotY + b.toY) / 2 + jitter())
      ctx.lineTo(b.toX, b.toY)
      ctx.stroke()
    }
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.beginPath()
    ctx.arc(b.toX, b.toY, 5 + 10 * t, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }, [])

  const drawBurst = useCallback((ctx: CanvasRenderingContext2D, b: Burst) => {
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
  }, [])

  const drawVillager = useCallback((ctx: CanvasRenderingContext2D, v: Villager) => {
    const a = assetsRef.current
    const meta = a.villagerMeta[v.totalTines]
    const sw = meta.frame_w * SPRITE_SCALE
    const sh = meta.frame_h * SPRITE_SCALE
    let img: HTMLImageElement | undefined
    let strip = false
    if (v.state === 'ash' || v.burned >= v.totalTines) {
      img = a.ashLeft[v.totalTines]
    } else if (v.burned > 0) {
      img = a.burnedLeft[`${v.totalTines}_${v.burned}`]
    } else {
      img = a.walkLeft[v.totalTines]
      strip = true
    }
    if (!img) return

    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.beginPath()
    ctx.ellipse(v.x + sw / 2, v.y + sh - 4, sw * 0.38, 5, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.imageSmoothingEnabled = false
    if (strip) {
      ctx.drawImage(img, v.walkFrame * meta.frame_w, 0, meta.frame_w, meta.frame_h, v.x, v.y, sw, sh)
    } else {
      ctx.drawImage(img, v.x, v.y, sw, sh)
    }

    if (v.state !== 'walking') return
    const active = activeVillagerIdRef.current === v.id || activeKeyRef.current.startsWith(`${v.id}:`)
    const progress = active ? lockProgressRef.current : 0
    const displayBurn = active
      ? Math.max(v.burned, Math.min(v.totalTines, Math.round(progress * v.totalTines)))
      : v.burned
    const forkKey = `${v.totalTines}_${displayBurn}`
    const baseImg = a.fork[forkKey] ?? a.fork[`${v.totalTines}_${v.burned}`]
    const glowImg = a.forkGlow[forkKey] ?? a.forkGlow[`${v.totalTines}_${v.burned}`]
    const forkMeta = a.forkMeta[v.totalTines]
    const forkW = forkMeta.frame_w * SPRITE_SCALE
    const forkH = forkMeta.frame_h * SPRITE_SCALE
    const fx = v.x + (meta.frame_w - meta.fork_base.x) * SPRITE_SCALE - (forkMeta.frame_w - forkMeta.handle_base.x) * SPRITE_SCALE
    const fy = v.y + meta.fork_base.y * SPRITE_SCALE - forkMeta.handle_base.y * SPRITE_SCALE

    if (baseImg) {
      ctx.save()
      ctx.translate(fx + forkW, fy)
      ctx.scale(-1, 1)
      ctx.drawImage(baseImg, 0, 0, forkW, forkH)
      if (active && glowImg) {
        ctx.globalAlpha = 0.25 + progress * 0.75
        ctx.drawImage(glowImg, 0, 0, forkW, forkH)
      }
      ctx.restore()
    }

    if (active && tintRef.current) {
      ctx.save()
      ctx.globalAlpha = 0.48
      ctx.fillStyle = tintRef.current
      ctx.beginPath()
      ctx.ellipse(fx + forkW / 2, fy + 7, 19 + progress * 12, 18 + progress * 8, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    if (active && noteNamesRef.current) {
      const note = v.notes[v.burned]
      ctx.font = 'bold 14px monospace'
      ctx.textAlign = 'center'
      const lx = fx + forkW / 2
      const ly = fy - 7
      const tw = ctx.measureText(note).width + 12
      ctx.fillStyle = 'rgba(8, 10, 18, 0.86)'
      ctx.strokeStyle = tintRef.current ?? 'rgba(130,210,255,0.62)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(lx - tw / 2, ly - 14, tw, 18, 5)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#f4f7fb'
      ctx.fillText(note, lx, ly)
    }

    if (active) {
      // ported from Pitchforks.tsx:576-584, using III's per-villager timer.
      const pct = clamp(v.attackTimer / Math.max(0.001, v.attackTimerMax), 0, 1)
      const barW = 58
      const barH = 5
      const bx = v.x + sw / 2 - barW / 2
      const by = v.y - 25
      ctx.fillStyle = 'rgba(8, 10, 18, 0.88)'
      ctx.fillRect(bx, by, barW, barH)
      ctx.fillStyle = timersPausedRef.current ? '#7dd3fc' : pct > 0.3 ? '#fbbf24' : '#ef4444'
      ctx.fillRect(bx, by, barW * pct, barH)
      ctx.strokeStyle = timersPausedRef.current ? 'rgba(125,211,252,0.85)' : '#555'
      ctx.lineWidth = 1
      ctx.strokeRect(bx, by, barW, barH)
    }
  }, [])

  const drawPitchBar = useCallback((ctx: CanvasRenderingContext2D) => {
    // ported from Pitchforks.tsx:602-658, with a 1s convergence trail.
    barVisibleRef.current = phaseRef.current === 'playing'
    const active = getActiveTarget()
    const now = performance.now()
    const centerX = PITCH_BAR_X + PITCH_BAR_W / 2
    const centerY = PITCH_BAR_Y + PITCH_BAR_H / 2
    const targetZoneW = PITCH_BAR_W * (3 / 12)

    ctx.fillStyle = 'rgba(20,20,30,0.78)'
    ctx.fillRect(PITCH_BAR_X, PITCH_BAR_Y, PITCH_BAR_W, PITCH_BAR_H)
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1
    ctx.strokeRect(PITCH_BAR_X, PITCH_BAR_Y, PITCH_BAR_W, PITCH_BAR_H)
    ctx.fillStyle = 'rgba(74,222,128,0.16)'
    ctx.fillRect(centerX - targetZoneW / 2, PITCH_BAR_Y, targetZoneW, PITCH_BAR_H)

    pitchTrailRef.current = pitchTrailRef.current.filter(p => now - p.at <= TRAIL_MS)
    const source = demoRef.current ? demoPitchRef.current : pitchRef.current
    const canUseSource = !!active &&
      !matchingSuppressedNow() &&
      !!source?.isActive &&
      source.confidence >= CONFIDENCE_FLOOR &&
      source.frequency > 0

    const xForDeviation = (deviation: number) => {
      const clamped = clamp(deviation, -6, 6)
      return centerX + (clamped / 6) * (PITCH_BAR_W / 2)
    }

    if (canUseSource && active && source) {
      const deviation = pitchDeviationSemis(source, active.note)
      const clampedDeviation = clamp(deviation, -6, 6)
      const onTarget = Math.abs(deviation) <= 1.5
      barDotDeviationRef.current = clampedDeviation
      barOnTargetRef.current = onTarget
      pitchTrailRef.current.push({ at: now, deviation: clampedDeviation, onTarget, note: source.note })
    } else {
      barDotDeviationRef.current = null
      barOnTargetRef.current = false
    }

    const trail = pitchTrailRef.current
    if (trail.length > 1) {
      for (let i = 1; i < trail.length; i++) {
        const prev = trail[i - 1]
        const cur = trail[i]
        const alpha = clamp(1 - (now - cur.at) / TRAIL_MS, 0, 1)
        ctx.strokeStyle = `rgba(125, 211, 252, ${0.08 + alpha * 0.22})`
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(xForDeviation(prev.deviation), centerY)
        ctx.lineTo(xForDeviation(cur.deviation), centerY)
        ctx.stroke()
      }
    }
    for (const point of trail) {
      const alpha = clamp(1 - (now - point.at) / TRAIL_MS, 0, 1)
      ctx.fillStyle = point.onTarget
        ? `rgba(74, 222, 128, ${0.08 + alpha * 0.38})`
        : `rgba(248, 113, 113, ${0.08 + alpha * 0.34})`
      ctx.beginPath()
      ctx.arc(xForDeviation(point.deviation), centerY, 2 + alpha * 2, 0, Math.PI * 2)
      ctx.fill()
    }

    if (canUseSource && source) {
      const dotX = xForDeviation(barDotDeviationRef.current ?? 0)
      const onTarget = barOnTargetRef.current
      if (onTarget) {
        ctx.fillStyle = 'rgba(74,222,128,0.3)'
        ctx.beginPath()
        ctx.arc(dotX, centerY, 11, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = onTarget ? '#4ade80' : '#f87171'
      ctx.beginPath()
      ctx.arc(dotX, centerY, 5.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.font = 'bold 9px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(source.note || '', dotX, PITCH_BAR_Y - 4)
    } else {
      ctx.fillStyle = '#555'
      ctx.font = '8px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('sing...', centerX, centerY + 3)
    }

    if (active) {
      ctx.fillStyle = '#4ade80'
      ctx.font = '8px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`target: ${active.note}`, centerX, PITCH_BAR_Y + PITCH_BAR_H + 12)
    }
  }, [getActiveTarget, matchingSuppressedNow, pitchRef])

  const render = useCallback((ctx: CanvasRenderingContext2D) => {
    const rt = runtimeRef.current
    const a = assetsRef.current
    const sky = ctx.createLinearGradient(0, 0, 0, H)
    sky.addColorStop(0, '#070914')
    sky.addColorStop(0.58, '#171228')
    sky.addColorStop(1, '#151910')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, W, H)

    ctx.fillStyle = '#283019'
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y)
    ctx.fillStyle = 'rgba(255,255,255,0.38)'
    for (let i = 0; i < 34; i++) {
      ctx.fillRect((i * 89 + 17) % W, (i * 37 + 19) % 155, 1, 1)
    }

    const charging = lockProgressRef.current > 0 || rt.bolts.length > 0
    const frank = charging ? a.frankCharge : a.frankIdle
    if (frank) {
      const fm = a.frankMeta
      const frame = Math.floor(rt.animClock * (charging ? 8 : 4)) % fm.frames
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(
        frank,
        frame * fm.frame_w,
        0,
        fm.frame_w,
        fm.frame_h,
        FRANK_X,
        FRANK_Y,
        fm.frame_w * SPRITE_SCALE,
        fm.frame_h * SPRITE_SCALE,
      )
      ctx.fillStyle = 'rgba(0,0,0,0.48)'
      ctx.beginPath()
      ctx.ellipse(FRANK_X + 48, FRANK_Y + fm.frame_h * SPRITE_SCALE - 7, 35, 6, 0, 0, Math.PI * 2)
      ctx.fill()
      // ported from Pitchforks.tsx:518-523; health lives on the monster.
      for (let i = 0; i < STARTING_HEALTH; i++) {
        ctx.fillStyle = i < rt.health ? '#4ade80' : '#333'
        ctx.fillRect(FRANK_X + 7 + i * 13, FRANK_Y - 8, 10, 4)
      }
    }

    const ordered = [...rt.villagers].sort((x, y) => x.y - y.y)
    for (const v of ordered) drawVillager(ctx, v)
    for (const burst of rt.bursts) drawBurst(ctx, burst)
    for (const bolt of rt.bolts) drawBolt(ctx, bolt)

    if (rt.bannerTimer > 0) {
      const alpha = Math.min(1, rt.bannerTimer / 0.35)
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.fillStyle = 'rgba(0,0,0,0.44)'
      ctx.fillRect(0, 150, W, 72)
      ctx.fillStyle = '#f6f8ff'
      ctx.font = 'bold 30px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`WAVE ${rt.wave}`, W / 2, 195)
      ctx.restore()
    }

    if (rt.streak >= 3) {
      ctx.fillStyle = rt.streak >= 10 ? '#ff6090' : '#ffc83c'
      ctx.font = 'bold 14px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`${rt.streak}x COMBO`, W / 2, 18)
    }

    const prompt = currentPromptRef.current
    if (prompt && getActiveTarget()) {
      ctx.fillStyle = '#f4f7fb'
      ctx.font = 'bold 15px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(prompt, W / 2, 40)
    }

    const active = getActiveTarget()
    if (active) {
      const meta = a.villagerMeta[active.villager.totalTines]
      const tine = meta.tines[Math.max(0, Math.min(active.tineIndex, meta.tines.length - 1))]
      const x = active.villager.x + (meta.frame_w - tine.x) * SPRITE_SCALE
      const y = active.villager.y + tine.y * SPRITE_SCALE
      ctx.strokeStyle = tintRef.current ?? 'rgba(160,210,255,0.62)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(x, y, 12 + lockProgressRef.current * 8, 0, Math.PI * 2)
      ctx.stroke()
    }
    drawPitchBar(ctx)
  }, [drawBolt, drawBurst, drawPitchBar, drawVillager, getActiveTarget])

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
    render(ctx)
    if (!runtimeRef.current.gameOver) rafRef.current = requestAnimationFrame(loop)
  }, [render, syncMicHudState, updateGame])

  const startGame = useCallback(async () => {
    resumeCueAudioFromGesture()
    clearCueTimers()
    runtimeRef.current = makeInitialRuntime(demoRef.current)
    nextIdRef.current = 0
    activeKeyRef.current = ''
    activeVillagerIdRef.current = null
    demoTargetRef.current = ''
    demoLockCountRef.current = 0
    demoStepRef.current = 'idle'
    silenceFreezeObservedRef.current = false
    resetCountRef.current = 0
    lastResetReasonRef.current = null
    burnedTinesRef.current = 0
    ashCountRef.current = 0
    lastStrikeNoteRef.current = null
    lastStrikeHueRef.current = null
    lastKillNoteRef.current = null
    lastKillHueRef.current = null
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
    if (!demoRef.current) {
      await startListening()
    }
    setPhase('playing')
    phaseRef.current = 'playing'
    lastTimeRef.current = 0
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(loop)
  }, [clearCueTimers, loop, resumeCueAudioFromGesture, startListening])

  const quitToMenu = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    clearCueTimers()
    phaseRef.current = 'menu'
    stopListening()
    micHudStateRef.current = 'waiting'
    setMicHudState('waiting')
    setPhase('menu')
  }, [clearCueTimers, stopListening])

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    clearCueTimers()
    stopListening()
  }, [clearCueTimers, stopListening])

  const micHudView: Record<MicHudState, { label: string; className: string; dotClassName: string }> = {
    demo: {
      label: 'Demo mode',
      className: 'border-cyan-500/50 text-cyan-100 bg-cyan-950/45',
      dotClassName: 'bg-cyan-300',
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

  if (phase === 'menu') {
    return (
      <div className="fixed inset-0 bg-[#070914] text-gray-100 flex items-center justify-center px-4" style={{ fontFamily: 'monospace' }}>
        {demoMode && (
          <div className="absolute top-4 right-4 text-[11px] font-bold tracking-widest text-cyan-200 border border-cyan-500/50 px-2 py-1">
            DEMO
          </div>
        )}
        <div className="w-full max-w-lg border border-cyan-900/60 bg-black/30 p-5">
          <div className="flex items-center justify-between mb-4">
            <Link href="/pitch-defender" className="text-xs text-cyan-300 hover:text-cyan-100">
              Back
            </Link>
            <Link href="/pitch-defender/pitchforks" className="text-xs text-gray-500 hover:text-gray-300">
              V1
            </Link>
          </div>
          <h1 className="text-3xl font-black tracking-widest text-cyan-200 mb-1">PITCHFORKS III</h1>
          <div className="text-sm text-gray-400 mb-5">Frankenstein lightning ear trainer</div>
          {assetError && <div className="text-sm text-red-300 mb-4">{assetError}</div>}
          {micError && !demoMode && <div className="text-xs text-red-300 mb-4">{micError}</div>}
          <SettingsRow
            noteNamesOn={noteNamesOn}
            setNoteNamesOn={setNoteNamesOn}
            audioCueOn={audioCueOn}
            setAudioCueOn={setAudioCueOn}
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
              <div className="text-sm text-cyan-300 font-bold">Replay anytime</div>
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
          onClick={startGame}
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

  if (phase === 'game_over') {
    return (
      <div className="fixed inset-0 bg-[#070914] text-gray-100 flex items-center justify-center px-4" style={{ fontFamily: 'monospace' }}>
        {demoMode && <div className="absolute top-4 right-4 text-[11px] font-bold tracking-widest text-cyan-200">DEMO</div>}
        <div className="w-full max-w-md border border-red-900/60 bg-black/35 p-5 text-center">
          <div className="text-3xl font-black text-red-300 tracking-widest mb-4">GAME OVER</div>
          <div className="grid grid-cols-3 gap-3 mb-5 text-sm">
            <div><div className="text-gray-500">Score</div><div className="text-xl text-white">{hud.score}</div></div>
            <div><div className="text-gray-500">Wave</div><div className="text-xl text-cyan-200">{hud.wave}</div></div>
            <div><div className="text-gray-500">Streak</div><div className="text-xl text-green-200">{hud.streak}</div></div>
          </div>
          <div className="flex gap-3">
            <button onClick={startGame} className="flex-1 py-2 bg-cyan-200 text-[#071018] font-bold border border-cyan-100">
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
      <div className="relative flex-1 min-h-0 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="block w-full h-full max-w-[1280px] max-h-[720px] object-contain"
          style={{ imageRendering: 'pixelated' }}
        />

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
          <div className="absolute top-3 right-3 text-[11px] font-bold tracking-widest text-cyan-200 bg-black/60 border border-cyan-500/50 px-2 py-1">
            DEMO
          </div>
        )}
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
    </div>
  )
}

function SettingsRow(props: {
  noteNamesOn: boolean
  setNoteNamesOn: (value: boolean) => void
  audioCueOn: boolean
  setAudioCueOn: (value: boolean) => void
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
        className={`px-2 py-1 border ${props.noteNamesOn ? 'border-cyan-400 text-cyan-100 bg-cyan-950/40' : 'border-gray-700 text-gray-400'}`}
      >
        Note names {props.noteNamesOn ? 'ON' : 'OFF'}
      </button>
      <button
        onClick={() => props.setAudioCueOn(!props.audioCueOn)}
        className={`px-2 py-1 border ${props.audioCueOn ? 'border-cyan-400 text-cyan-100 bg-cyan-950/40' : 'border-gray-700 text-gray-400'}`}
      >
        Audio cue {props.audioCueOn ? 'ON' : 'OFF'}
      </button>
      <label className="flex items-center gap-2 text-gray-300">
        Cue
        <input
          type="range"
          min={0}
          max={200}
          value={props.cueVolume}
          onChange={e => props.setCueVolume(Number(e.target.value))}
          className="w-24 accent-cyan-300"
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
          className="w-24 accent-cyan-300"
        />
      </label>
    </div>
  )
}
