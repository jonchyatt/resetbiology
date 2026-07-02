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
const STARTING_HEARTS = 3
const TONE_SUPPRESS_MS = 350

type Phase = 'menu' | 'playing' | 'game_over'
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
  wave: number
  hearts: number
  score: number
  streak: number
  spawned: number
  plan: WavePlan
  spawnClock: number
  bannerTimer: number
  nextWavePending: boolean
  animClock: number
  gameOver: boolean
}

interface HudState {
  wave: number
  hearts: number
  score: number
  streak: number
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
  const count = Math.min(2 + wave, 6)
  const spawnInterval = Math.max(0.75, 1.55 - wave * 0.11)
  const speed = 21 + Math.min(wave, 8) * 3.3
  if (demo && wave === 1) {
    return { wave, count: 3, spawnInterval: 0.45, speed: 16, tineCounts: [2, 3, 4] }
  }

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

function makeInitialRuntime(demo: boolean): Runtime {
  const plan = fixedWaveDirector(1, demo)
  return {
    villagers: [],
    bolts: [],
    wave: 1,
    hearts: STARTING_HEARTS,
    score: 0,
    streak: 0,
    spawned: 0,
    plan,
    spawnClock: 0,
    bannerTimer: 1.1,
    nextWavePending: false,
    animClock: 0,
    gameOver: false,
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

function localSfx(kind: 'strike' | 'ash' | 'hurt', volumePct: number) {
  if (typeof window === 'undefined') return
  const AudioCtor = window.AudioContext || (window as any).webkitAudioContext
  if (!AudioCtor) return
  const ctx = new AudioCtor() as AudioContext
  const master = ctx.createGain()
  master.gain.value = Math.max(0, Math.min(2, volumePct / 100))
  master.connect(ctx.destination)
  const now = ctx.currentTime

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

  window.setTimeout(() => ctx.close().catch(() => {}), 450)
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
  const phaseRef = useRef<Phase>('menu')
  const cueVolumeRef = useRef(100)
  const sfxVolumeRef = useRef(100)
  const noteNamesRef = useRef(true)
  const audioCueRef = useRef(true)

  const [phase, setPhase] = useState<Phase>('menu')
  const [assetsReady, setAssetsReady] = useState(false)
  const [assetError, setAssetError] = useState<string | null>(null)
  const [hud, setHud] = useState<HudState>({ wave: 1, hearts: STARTING_HEARTS, score: 0, streak: 0 })
  const [noteNamesOn, setNoteNamesOn] = useState(true)
  const [audioCueOn, setAudioCueOn] = useState(true)
  const [cueVolume, setCueVolume] = useState(100)
  const [sfxVolume, setSfxVolume] = useState(100)
  const [demoMode, setDemoMode] = useState(false)

  const { pitch, pitchRef, startListening, stopListening, error: micError } = usePitchDetection({ noiseGateDb: -45 })

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

  const playCue = useCallback((note: string) => {
    if (!audioCueRef.current) return
    setPianoVolume(cueVolumeRef.current)
    try {
      playPianoNote(note, { exact: true })
    } catch {
      markToneEmitted(TONE_SUPPRESS_MS)
    }
  }, [])

  const spawnVillager = useCallback(() => {
    const rt = runtimeRef.current
    if (rt.spawned >= rt.plan.count) return
    const totalTines = rt.plan.tineCounts[rt.spawned] ?? 2
    const lane = rt.spawned % 3
    const notes = Array.from({ length: totalTines }, (_, i) => pickNote(rt.spawned + i, rt.wave))
    const v: Villager = {
      id: ++nextIdRef.current,
      totalTines,
      x: W + 26 + lane * 16,
      y: GROUND_Y - defaultVillagerMeta.frame_h * SPRITE_SCALE - lane * 6,
      speed: rt.plan.speed + lane * 1.8,
      notes,
      burned: 0,
      state: 'walking',
      walkFrame: 0,
      walkClock: 0,
      ashTimer: 0,
    }
    rt.villagers.push(v)
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
    lockHeldMsRef.current = 0
    lockProgressRef.current = 0
    tintRef.current = null
    setHud({ wave, hearts: rt.hearts, score: rt.score, streak: rt.streak })
  }, [])

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

  const strikeActiveTine = useCallback((target: NonNullable<ReturnType<typeof getActiveTarget>>) => {
    const rt = runtimeRef.current
    const { villager, tineIndex } = target
    addBolt(villager, tineIndex)
    villager.burned += 1
    lockHeldMsRef.current = 0
    lockProgressRef.current = 0
    tintRef.current = null
    activeKeyRef.current = ''
    demoLockCountRef.current += 1
    localSfx('strike', sfxVolumeRef.current)

    if (villager.burned >= villager.totalTines) {
      villager.state = 'ash'
      villager.ashTimer = 1.1
      rt.streak += 1
      rt.score += 120 + villager.totalTines * 60 + Math.min(rt.streak, 12) * 15
      localSfx('ash', sfxVolumeRef.current)
      setHud({ wave: rt.wave, hearts: rt.hearts, score: rt.score, streak: rt.streak })
    }
  }, [addBolt])

  const demoPitchForTarget = useCallback((target: NonNullable<ReturnType<typeof getActiveTarget>>, now: number): PitchInfo | null => {
    if (demoTargetRef.current !== target.key) {
      demoTargetRef.current = target.key
      demoTargetStartedRef.current = now
    }
    const elapsed = now - demoTargetStartedRef.current
    const targetFreq = noteToFreq(target.note)
    const firstTargetScript = demoLockCountRef.current === 0

    if (firstTargetScript) {
      if (elapsed < 160) {
        return { note: target.note, frequency: targetFreq, cents: 0, confidence: 0.96, isActive: true }
      }
      if (elapsed < 650) {
        return { note: target.note, frequency: 0, cents: 0, confidence: 0, isActive: false }
      }
      if (elapsed < 900) {
        const wrong = semiToName(nameToSemi(target.note) + 2)
        return { note: wrong, frequency: noteToFreq(wrong), cents: 0, confidence: 0.98, isActive: true }
      }
      return { note: target.note, frequency: targetFreq, cents: 0, confidence: 0.98, isActive: true }
    }

    if (elapsed < 90) {
      return { note: target.note, frequency: 0, cents: 0, confidence: 0, isActive: false }
    }
    return { note: target.note, frequency: targetFreq, cents: 0, confidence: 0.98, isActive: true }
  }, [])

  const processLock = useCallback((dt: number) => {
    const target = getActiveTarget()
    if (!target) {
      activeKeyRef.current = ''
      lockHeldMsRef.current = 0
      lockProgressRef.current = 0
      tintRef.current = null
      return
    }

    if (activeKeyRef.current !== target.key) {
      activeKeyRef.current = target.key
      lockHeldMsRef.current = 0
      lockProgressRef.current = 0
      tintRef.current = null
      playCue(target.note)
    }

    if (isWithinToneSuppressionWindow()) {
      return
    }

    const now = performance.now()
    if (demoRef.current) {
      demoPitchRef.current = demoPitchForTarget(target, now)
    }

    const source = demoRef.current ? demoPitchRef.current : pitchRef.current
    if (!source?.isActive || source.confidence < CONFIDENCE_FLOOR || source.frequency <= 0) {
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
      lockHeldMsRef.current = 0
      lockProgressRef.current = 0
    }
  }, [demoPitchForTarget, getActiveTarget, pitchRef, playCue, strikeActiveTine])

  const updateGame = useCallback((dt: number) => {
    const rt = runtimeRef.current
    rt.animClock += dt

    if (rt.bannerTimer > 0) {
      rt.bannerTimer = Math.max(0, rt.bannerTimer - dt)
      if (rt.bannerTimer === 0 && rt.spawned === 0) {
        spawnVillager()
      }
    } else {
      rt.spawnClock += dt
      if (rt.spawned < rt.plan.count && rt.spawnClock >= rt.plan.spawnInterval) {
        rt.spawnClock = 0
        spawnVillager()
      }
    }

    for (const v of rt.villagers) {
      if (v.state === 'walking') {
        v.x -= v.speed * dt
        v.walkClock += dt
        if (v.walkClock >= 0.16) {
          v.walkClock = 0
          v.walkFrame = (v.walkFrame + 1) % 4
        }
        if (v.x <= FRANK_REACH_X) {
          v.state = 'ash'
          v.ashTimer = 0.9
          rt.hearts = Math.max(0, rt.hearts - 1)
          rt.streak = 0
          activeKeyRef.current = ''
          lockHeldMsRef.current = 0
          lockProgressRef.current = 0
          tintRef.current = null
          localSfx('hurt', sfxVolumeRef.current)
          setHud({ wave: rt.wave, hearts: rt.hearts, score: rt.score, streak: rt.streak })
          if (rt.hearts <= 0) {
            rt.gameOver = true
            phaseRef.current = 'game_over'
            setPhase('game_over')
            return
          }
        }
      } else if (v.state === 'ash') {
        v.ashTimer -= dt
      }
    }

    rt.villagers = rt.villagers.filter(v => v.state !== 'ash' || v.ashTimer > 0)
    for (let i = rt.bolts.length - 1; i >= 0; i--) {
      rt.bolts[i].life += dt
      if (rt.bolts[i].life >= rt.bolts[i].maxLife) rt.bolts.splice(i, 1)
    }

    processLock(dt)

    const waveClear = rt.spawned >= rt.plan.count && rt.villagers.every(v => v.state !== 'walking')
    if (waveClear && !rt.nextWavePending) {
      rt.nextWavePending = true
      setTimeout(() => {
        if (phaseRef.current !== 'playing') return
        startWave(runtimeRef.current.wave + 1)
      }, 900)
    }
  }, [processLock, spawnVillager, startWave])

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
    const active = activeKeyRef.current.startsWith(`${v.id}:`)
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
  }, [])

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
    }

    const ordered = [...rt.villagers].sort((x, y) => x.y - y.y)
    for (const v of ordered) drawVillager(ctx, v)
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
  }, [drawBolt, drawVillager, getActiveTarget])

  const loop = useCallback((ts: number) => {
    if (phaseRef.current !== 'playing') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dt = lastTimeRef.current ? Math.min(0.05, (ts - lastTimeRef.current) / 1000) : 0
    lastTimeRef.current = ts
    updateGame(dt)
    render(ctx)
    if (!runtimeRef.current.gameOver) rafRef.current = requestAnimationFrame(loop)
  }, [render, updateGame])

  const startGame = useCallback(async () => {
    initAudio()
    setPianoVolume(cueVolumeRef.current)
    runtimeRef.current = makeInitialRuntime(demoRef.current)
    nextIdRef.current = 0
    activeKeyRef.current = ''
    demoTargetRef.current = ''
    demoLockCountRef.current = 0
    lockHeldMsRef.current = 0
    lockProgressRef.current = 0
    tintRef.current = null
    setHud({ wave: 1, hearts: STARTING_HEARTS, score: 0, streak: 0 })
    if (!demoRef.current) {
      await startListening()
    }
    setPhase('playing')
    phaseRef.current = 'playing'
    lastTimeRef.current = 0
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(loop)
  }, [loop, startListening])

  const quitToMenu = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    phaseRef.current = 'menu'
    stopListening()
    setPhase('menu')
  }, [stopListening])

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    stopListening()
  }, [stopListening])

  const hearingActive = demoMode ? !!demoPitchRef.current?.isActive : !!pitch?.isActive

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
            onClick={startGame}
            disabled={!assetsReady}
            className="mt-5 w-full py-3 text-lg font-black tracking-widest border transition active:scale-[0.99] disabled:opacity-50"
            style={{
              background: assetsReady ? '#bfefff' : '#25313c',
              color: '#071018',
              borderColor: '#e8fbff',
            }}
          >
            START
          </button>
        </div>
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
    <div className="fixed inset-0 bg-black text-gray-100 flex items-center justify-center" style={{ fontFamily: 'monospace' }}>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="w-full h-full max-w-[1280px] max-h-[720px]"
        style={{ imageRendering: 'pixelated' }}
      />

      <div className="absolute top-3 left-3 flex items-center gap-3 text-xs bg-black/45 border border-gray-800 px-3 py-2">
        <div className="flex gap-1" aria-label="hearts">
          {Array.from({ length: STARTING_HEARTS }, (_, i) => (
            <span key={i} className={i < hud.hearts ? 'w-3 h-3 bg-red-400 inline-block' : 'w-3 h-3 bg-gray-700 inline-block'} />
          ))}
        </div>
        <span>Score {hud.score}</span>
        <span>Streak {hud.streak}</span>
        <span>Wave {hud.wave}</span>
        <span
          className={`w-3 h-3 rounded-full inline-block ${hearingActive ? 'bg-green-300 animate-ping' : 'bg-gray-600'}`}
          title="Mic activity"
        />
      </div>

      {demoMode && (
        <div className="absolute top-3 right-3 text-[11px] font-bold tracking-widest text-cyan-200 bg-black/45 border border-cyan-500/50 px-2 py-1">
          DEMO
        </div>
      )}

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[min(96vw,760px)] bg-black/55 border border-gray-800 px-3 py-2">
        <div className="flex flex-wrap items-center justify-center gap-3">
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
          <button onClick={quitToMenu} className="text-xs text-gray-400 hover:text-gray-100 border border-gray-700 px-2 py-1">
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
    <div className={`flex flex-wrap items-center ${props.compact ? 'gap-2 text-[11px]' : 'gap-3 text-xs'}`}>
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
