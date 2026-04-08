'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// PitchforksII — Frankenstein the Lightning Conductor (sprite-based v2)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Built ALONGSIDE the original Pitchforks. The legacy game at
// /pitch-defender/pitchforks is untouched and still works.
//
// Concept: YOU are the storm. Frankenstein stands center-back as a lightning
// rod. Villagers approach from both sides carrying pitchforks. Each fork has
// 2/3/4 tines, each labeled with a target note. Sing the note → lightning
// bolts arc from the cloud, BOUNCE through Frankenstein's rod_tip, and burn
// the matching tine off the villager's fork. All tines burned = villager flees.
//
// View modes:
//   side  — arcade default. Frankenstein center-back, villagers walk in from L/R
//   fps   — first-person. Camera looks at Frankenstein, villagers approach from depth
//
// All sprites loaded from /images/pitchforks/  (see scripts/generate-pitchforks-sprites.py)
// Anchor data (rod_tip, fork_base, tine positions) lives in sibling .json files.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { PitchFusion, type FusedPitch } from './pitchFusion'
import { initAudio, playPianoNote } from './audioEngine'

// ─── Constants ──────────────────────────────────────────────────────────────

const W = 640
const H = 360
const SPRITE_SCALE = 3                  // native pixel art scaled 3x in canvas
const TOLERANCE_SEMI = 1.5              // pitch-match tolerance
const HOLD_MS = 220                     // must hold correct pitch this long to fire
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const ASSET_BASE = '/images/pitchforks'
const FILES = {
  frankIdle:    `${ASSET_BASE}/frankenstein_idle.png`,
  frankCharge:  `${ASSET_BASE}/frankenstein_charging.png`,
  frankFps:     `${ASSET_BASE}/frankenstein_fps.png`,
  villagerWalkR: (n: 2|3|4) => `${ASSET_BASE}/villager_${n}tine_walk.png`,
  villagerWalkL: (n: 2|3|4) => `${ASSET_BASE}/villager_${n}tine_walk_left.png`,
  villagerBurned: (n: 2|3|4, k: number, dir: 'r'|'l') =>
    `${ASSET_BASE}/villager_${n}tine_burned_${k}${dir==='l'?'_left':''}.png`,
  villagerAsh: (n: 2|3|4, dir: 'r'|'l') =>
    `${ASSET_BASE}/villager_${n}tine_ash${dir==='l'?'_left':''}.png`,
  fork:    (n: 2|3|4, b: number) => `${ASSET_BASE}/fork_${n}tine_b${b}.png`,
  forkGlow:(n: 2|3|4, b: number) => `${ASSET_BASE}/fork_${n}tine_b${b}_glow.png`,
  villagerFps: (s: 'far'|'mid'|'near') => `${ASSET_BASE}/villager_fps_${s}.png`,
}

// ─── Anchor metadata (defaults; overridden by /images/pitchforks/*.json fetch) ──

interface FrankMeta {
  frame_w: number; frame_h: number; frames: number
  rod_tip: { x: number; y: number }
  left_bolt: { x: number; y: number }
  right_bolt: { x: number; y: number }
}
interface VillagerMeta {
  frame_w: number; frame_h: number; walk_frames: number
  fork_base: { x: number; y: number }
  fork_tip:  { x: number; y: number }
  tines: Array<{ x: number; y: number }>
}
interface ForkMeta {
  frame_w: number; frame_h: number
  handle_base: { x: number; y: number }
  tine_tips: Array<{ x: number; y: number }>
}

const DEFAULT_FRANK_META: FrankMeta = {
  frame_w: 32, frame_h: 48, frames: 4,
  rod_tip: { x: 16, y: 0 },
  left_bolt: { x: 8, y: 23 },
  right_bolt: { x: 23, y: 23 },
}
const DEFAULT_VILLAGER_META: VillagerMeta = {
  frame_w: 16, frame_h: 24, walk_frames: 4,
  fork_base: { x: 14, y: 11 },
  fork_tip:  { x: 14, y: 2 },
  tines: [{x:14,y:4},{x:14,y:6},{x:14,y:8},{x:14,y:10}],
}

// ─── Types ──────────────────────────────────────────────────────────────────

type Phase = 'menu' | 'playing' | 'game_over'
type ViewMode = 'side' | 'fps'

interface Villager {
  id: number
  side: 'l' | 'r'             // entering from left or right
  x: number                   // current position (canvas px, top-left of sprite at native scale)
  y: number                   // baseline y
  speed: number               // px / sec (negative if moving left)
  totalTines: 2|3|4
  tinesBurned: number         // how many burned off so far
  intervals: number[]         // semitone targets, one per tine, in burn order (rightmost first)
  walkFrame: number           // animation frame
  walkClock: number           // accumulator
  state: 'walking' | 'fleeing' | 'dead'
  ashTimer: number            // seconds remaining as ash before despawn
  fpsZ: number                // 0..1 depth for fps view (1 = at frank)
}

interface Bolt {
  // A bolt is rendered in two segments: cloud → rod_tip, then rod_tip → tine_tip
  // It crackles for a short time then fades
  fromX: number; fromY: number
  pivotX: number; pivotY: number
  toX: number; toY: number
  life: number; maxLife: number
  hue: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function semiToName(s: number): string {
  const oct = Math.floor(s / 12) + 4
  return `${NOTE_NAMES[((s % 12) + 12) % 12]}${oct}`
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// Generate a random interval target — for now a small palette of common
// audition intervals. Replace later by reading the loaded composition.
function rollInterval(): number {
  const intervals = [2, 3, 4, 5, 7, 8, 12] // M2, m3, M3, P4, P5, m6, P8 — rough mix
  return intervals[Math.floor(Math.random() * intervals.length)]
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function PitchforksII() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fusionRef = useRef<PitchFusion | null>(null)
  const pitchRef = useRef<FusedPitch | null>(null)
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef(0)

  // Game state (refs — game loop reads these without re-rendering)
  const villagersRef = useRef<Villager[]>([])
  const boltsRef = useRef<Bolt[]>([])
  const scoreRef = useRef(0)
  const livesRef = useRef(3)
  const phaseRef = useRef<Phase>('menu')
  const viewRef = useRef<ViewMode>('side')
  const matchProgressRef = useRef(0) // ms held on the current target tine
  const targetRef = useRef<{ villagerId: number; tineIdx: number; semi: number } | null>(null)
  const villagerIdRef = useRef(0)
  const spawnClockRef = useRef(0)
  const animClockRef = useRef(0)
  const baseSemiRef = useRef(60) // C4 — root used to compute interval targets

  // UI state
  const [phase, setPhase] = useState<Phase>('menu')
  const [view, setView] = useState<ViewMode>('side')
  const [hud, setHud] = useState({ score: 0, lives: 3, target: '' })
  const [pitchHint, setPitchHint] = useState<'low' | 'on' | 'high' | null>(null)
  const [assetsReady, setAssetsReady] = useState(false)
  const [assetError, setAssetError] = useState<string | null>(null)

  // Asset cache
  const assetsRef = useRef<{
    frankIdle?: HTMLImageElement
    frankCharge?: HTMLImageElement
    frankFps?: HTMLImageElement
    villagerWalkR: Record<number, HTMLImageElement>
    villagerWalkL: Record<number, HTMLImageElement>
    villagerBurnedR: Record<string, HTMLImageElement>
    villagerBurnedL: Record<string, HTMLImageElement>
    villagerAshR: Record<number, HTMLImageElement>
    villagerAshL: Record<number, HTMLImageElement>
    fork: Record<string, HTMLImageElement>
    forkGlow: Record<string, HTMLImageElement>
    villagerFps: Record<string, HTMLImageElement>
    frankMeta: FrankMeta
    villagerMeta: Record<number, VillagerMeta>
  }>({
    villagerWalkR: {}, villagerWalkL: {},
    villagerBurnedR: {}, villagerBurnedL: {},
    villagerAshR: {}, villagerAshL: {},
    fork: {}, forkGlow: {},
    villagerFps: {},
    frankMeta: DEFAULT_FRANK_META,
    villagerMeta: { 2: DEFAULT_VILLAGER_META, 3: DEFAULT_VILLAGER_META, 4: DEFAULT_VILLAGER_META },
  })

  // ─── Asset loader ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const a = assetsRef.current
        // Frankenstein
        a.frankIdle   = await loadImage(FILES.frankIdle)
        a.frankCharge = await loadImage(FILES.frankCharge)
        a.frankFps    = await loadImage(FILES.frankFps)
        // Villagers
        for (const n of [2,3,4] as const) {
          a.villagerWalkR[n] = await loadImage(FILES.villagerWalkR(n))
          a.villagerWalkL[n] = await loadImage(FILES.villagerWalkL(n))
          a.villagerAshR[n]  = await loadImage(FILES.villagerAsh(n,'r'))
          a.villagerAshL[n]  = await loadImage(FILES.villagerAsh(n,'l'))
          for (let k = 1; k < n; k++) {
            a.villagerBurnedR[`${n}_${k}`] = await loadImage(FILES.villagerBurned(n,k,'r'))
            a.villagerBurnedL[`${n}_${k}`] = await loadImage(FILES.villagerBurned(n,k,'l'))
          }
          // Forks for this tine count
          for (let b = 0; b <= n; b++) {
            a.fork[`${n}_${b}`]     = await loadImage(FILES.fork(n,b))
            a.forkGlow[`${n}_${b}`] = await loadImage(FILES.forkGlow(n,b))
          }
        }
        // FPS villagers
        for (const s of ['far','mid','near'] as const) {
          a.villagerFps[s] = await loadImage(FILES.villagerFps(s))
        }
        // Anchor JSON (best-effort — fall back to defaults if missing)
        try {
          const fr = await fetch(`${ASSET_BASE}/frankenstein.json`)
          if (fr.ok) a.frankMeta = await fr.json()
        } catch {}
        for (const n of [2,3,4] as const) {
          try {
            const r = await fetch(`${ASSET_BASE}/villager_${n}tine.json`)
            if (r.ok) a.villagerMeta[n] = await r.json()
          } catch {}
        }
        if (!cancelled) setAssetsReady(true)
      } catch (err) {
        if (!cancelled) setAssetError(`Sprite load failed: ${(err as Error).message}`)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Sync ref → state
  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { viewRef.current = view }, [view])

  // ─── Spawn a villager ─────────────────────────────────────────────────────
  const spawnVillager = useCallback(() => {
    const a = assetsRef.current
    const totalTines = ([2,3,4] as const)[Math.floor(Math.random()*3)]
    const meta = a.villagerMeta[totalTines]
    const fromLeft = Math.random() < 0.5
    const baseSemi = baseSemiRef.current
    // Interval targets — one per tine, burn order is RIGHTMOST FIRST
    const intervals: number[] = []
    for (let i = 0; i < totalTines; i++) {
      const dir = Math.random() < 0.5 ? 1 : -1
      intervals.push(baseSemi + dir * rollInterval())
    }
    const baselineY = viewRef.current === 'fps'
      ? H * 0.55
      : H - meta.frame_h * SPRITE_SCALE - 30
    const v: Villager = {
      id: ++villagerIdRef.current,
      side: fromLeft ? 'l' : 'r',
      x: fromLeft ? -meta.frame_w * SPRITE_SCALE : W,
      y: baselineY,
      speed: fromLeft ? 22 : -22,
      totalTines,
      tinesBurned: 0,
      intervals,
      walkFrame: 0,
      walkClock: 0,
      state: 'walking',
      ashTimer: 0,
      fpsZ: 0,
    }
    villagersRef.current.push(v)
  }, [])

  // ─── Pick the active target tine across all villagers ────────────────────
  // Always target the FRONT-most villager, rightmost remaining tine.
  const pickTarget = useCallback(() => {
    const vs = villagersRef.current.filter(v => v.state === 'walking' && v.tinesBurned < v.totalTines)
    if (vs.length === 0) { targetRef.current = null; setHud(h => ({ ...h, target: '' })); return }
    // Front-most = closest to center (smallest distance to W/2)
    vs.sort((a,b) => Math.abs(a.x - W/2) - Math.abs(b.x - W/2))
    const v = vs[0]
    const tineIdx = v.totalTines - 1 - v.tinesBurned // rightmost remaining
    const semi = v.intervals[tineIdx]
    targetRef.current = { villagerId: v.id, tineIdx, semi }
    setHud(h => ({ ...h, target: semiToName(semi) }))
  }, [])

  // ─── Fire a bolt at the targeted tine ────────────────────────────────────
  const fireBolt = useCallback((villager: Villager, tineIdx: number) => {
    const a = assetsRef.current
    const fm = a.frankMeta
    // Frank is rendered center-back at:
    const frankPx = (W - fm.frame_w * SPRITE_SCALE) / 2
    const frankPy = viewRef.current === 'fps'
      ? H * 0.15
      : H - fm.frame_h * SPRITE_SCALE - 20 - 60
    const pivotX = frankPx + fm.rod_tip.x * SPRITE_SCALE
    const pivotY = frankPy + fm.rod_tip.y * SPRITE_SCALE
    // Tine endpoint = villager position + tine anchor offset
    const vmeta = a.villagerMeta[villager.totalTines]
    const tineAnchor = vmeta.tines[Math.min(tineIdx, vmeta.tines.length-1)] || vmeta.tines[0]
    const toX = villager.x + tineAnchor.x * SPRITE_SCALE
    const toY = villager.y + tineAnchor.y * SPRITE_SCALE
    boltsRef.current.push({
      fromX: Math.random() * W * 0.6 + W * 0.2,
      fromY: 0,
      pivotX, pivotY,
      toX, toY,
      life: 0, maxLife: 0.45,
      hue: 190 + Math.random() * 40,
    })
    // Burn the tine
    villager.tinesBurned += 1
    scoreRef.current += 100
    setHud(h => ({ ...h, score: scoreRef.current }))
    if (villager.tinesBurned >= villager.totalTines) {
      villager.state = 'fleeing'
      villager.ashTimer = 1.4
    }
  }, [])

  // ─── Game loop ────────────────────────────────────────────────────────────
  const loop = useCallback((ts: number) => {
    if (!canvasRef.current) return
    if (phaseRef.current !== 'playing') return
    const ctx = canvasRef.current.getContext('2d')!
    const dt = lastTimeRef.current ? Math.min(0.05, (ts - lastTimeRef.current)/1000) : 0
    lastTimeRef.current = ts
    animClockRef.current += dt
    spawnClockRef.current += dt

    // Spawn cadence — slower at start, ramps up by score
    const spawnInterval = Math.max(2.5, 5.5 - scoreRef.current / 600)
    if (spawnClockRef.current >= spawnInterval && villagersRef.current.length < 4) {
      spawnClockRef.current = 0
      spawnVillager()
    }

    // Update villagers
    for (const v of villagersRef.current) {
      if (v.state === 'walking') {
        v.x += v.speed * dt
        v.walkClock += dt
        if (v.walkClock > 0.18) { v.walkClock = 0; v.walkFrame = (v.walkFrame + 1) % 4 }
        // Reach center → damage player
        if (Math.abs(v.x - W/2) < 30) {
          v.state = 'dead'
          v.ashTimer = 0.8
          livesRef.current -= 1
          setHud(h => ({ ...h, lives: livesRef.current }))
          if (livesRef.current <= 0) {
            setPhase('game_over'); fusionRef.current?.stop()
          }
        }
      } else if (v.state === 'fleeing' || v.state === 'dead') {
        v.ashTimer -= dt
      }
    }
    // Cleanup
    villagersRef.current = villagersRef.current.filter(v => !(v.ashTimer < 0))

    // Pick target if missing
    if (!targetRef.current || !villagersRef.current.find(v => v.id === targetRef.current!.villagerId && v.state === 'walking')) {
      pickTarget()
    }

    // Pitch matching
    const tgt = targetRef.current
    const p = pitchRef.current
    if (tgt && p?.isActive) {
      const dev = p.staffPosition - tgt.semi
      const absDev = Math.abs(dev)
      // Octave-flexible: also allow ±12, ±24
      const folded = Math.min(absDev, Math.abs(absDev - 12), Math.abs(absDev - 24))
      if (folded <= TOLERANCE_SEMI) {
        setPitchHint('on')
        matchProgressRef.current += dt * 1000
        if (matchProgressRef.current >= HOLD_MS) {
          // FIRE BOLT
          const villager = villagersRef.current.find(v => v.id === tgt.villagerId)
          if (villager) fireBolt(villager, tgt.tineIdx)
          matchProgressRef.current = 0
          targetRef.current = null
          // Brief reference tone
          try { playPianoNote(semiToName(tgt.semi)) } catch {}
        }
      } else {
        setPitchHint(dev < 0 ? 'low' : 'high')
        matchProgressRef.current = Math.max(0, matchProgressRef.current - dt * 400)
      }
    } else {
      setPitchHint(null)
      matchProgressRef.current = Math.max(0, matchProgressRef.current - dt * 200)
    }

    // Update bolts
    for (let i = boltsRef.current.length - 1; i >= 0; i--) {
      const b = boltsRef.current[i]
      b.life += dt
      if (b.life >= b.maxLife) boltsRef.current.splice(i, 1)
    }

    // ── Render ──
    render(ctx)

    rafRef.current = requestAnimationFrame(loop)
  }, [pickTarget, spawnVillager, fireBolt])

  // ─── Render ───────────────────────────────────────────────────────────────
  const render = useCallback((ctx: CanvasRenderingContext2D) => {
    const a = assetsRef.current
    // Sky / background
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#0a0a18')
    grad.addColorStop(0.5, '#1a1530')
    grad.addColorStop(1, '#221540')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)

    // Storm cloud band at top
    ctx.fillStyle = 'rgba(50,50,80,0.6)'
    ctx.fillRect(0, 0, W, 60)
    ctx.fillStyle = 'rgba(80,80,120,0.3)'
    for (let i = 0; i < 12; i++) {
      const cx = (i * W / 12) + (animClockRef.current * 8 % (W/12))
      ctx.beginPath()
      ctx.arc(cx, 30 + Math.sin(animClockRef.current + i) * 6, 28, 0, Math.PI * 2)
      ctx.fill()
    }

    // Ground
    ctx.fillStyle = '#08110a'
    ctx.fillRect(0, H - 30, W, 30)
    ctx.strokeStyle = 'rgba(70,90,60,0.6)'
    ctx.beginPath()
    ctx.moveTo(0, H - 30); ctx.lineTo(W, H - 30); ctx.stroke()

    if (viewRef.current === 'side') {
      renderSide(ctx)
    } else {
      renderFps(ctx)
    }

    // Bolts (drawn LAST, on top of everything)
    for (const b of boltsRef.current) {
      drawLightningBolt(ctx, b)
    }

    // HUD overlay (canvas-drawn so it can't be hidden by other UI)
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, 0, W, 24)
    ctx.fillStyle = '#cce6ff'
    ctx.font = 'bold 13px monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(`SCORE ${scoreRef.current}`, 10, 12)
    ctx.fillText(`LIVES ${'♥'.repeat(Math.max(0,livesRef.current))}`, 130, 12)
    if (targetRef.current) {
      ctx.textAlign = 'right'
      ctx.fillStyle = pitchHint === 'on' ? '#7dffb0' : pitchHint === 'low' ? '#ffd166' : pitchHint === 'high' ? '#ff8a8a' : '#cce6ff'
      ctx.fillText(`SING ${semiToName(targetRef.current.semi)}`, W - 10, 12)
      // hold meter
      const pct = Math.min(1, matchProgressRef.current / HOLD_MS)
      ctx.fillStyle = 'rgba(120,255,160,0.8)'
      ctx.fillRect(W - 110, 18, 100 * pct, 3)
    }
  }, [pitchHint])

  // ─── Side view render ─────────────────────────────────────────────────────
  const renderSide = useCallback((ctx: CanvasRenderingContext2D) => {
    const a = assetsRef.current
    const fm = a.frankMeta
    const charging = matchProgressRef.current > HOLD_MS * 0.4 || boltsRef.current.length > 0
    const sheet = charging ? a.frankCharge : a.frankIdle
    if (!sheet) return
    const frame = Math.floor(animClockRef.current * 4) % fm.frames
    const frankPx = (W - fm.frame_w * SPRITE_SCALE) / 2
    const frankPy = H - fm.frame_h * SPRITE_SCALE - 20 - 60 // raised so villagers walk to him
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(
      sheet,
      frame * fm.frame_w, 0, fm.frame_w, fm.frame_h,
      frankPx, frankPy, fm.frame_w * SPRITE_SCALE, fm.frame_h * SPRITE_SCALE
    )

    // Frankenstein shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)'
    ctx.beginPath()
    ctx.ellipse(W/2, H - 28, 30, 5, 0, 0, Math.PI * 2)
    ctx.fill()

    // Villagers + their forks (drawn back-to-front by Y)
    const sorted = [...villagersRef.current].sort((a,b) => a.y - b.y)
    for (const v of sorted) {
      drawVillagerSide(ctx, v)
    }
  }, [])

  // Side villager + separate fork sprite
  const drawVillagerSide = useCallback((ctx: CanvasRenderingContext2D, v: Villager) => {
    const a = assetsRef.current
    const meta = a.villagerMeta[v.totalTines]
    const sw = meta.frame_w * SPRITE_SCALE
    const sh = meta.frame_h * SPRITE_SCALE
    ctx.imageSmoothingEnabled = false

    // Pick the right sprite
    let img: HTMLImageElement | undefined
    let isStrip = false
    if (v.state === 'dead' || (v.state === 'fleeing' && v.tinesBurned >= v.totalTines)) {
      img = v.side === 'l' ? a.villagerAshL[v.totalTines] : a.villagerAshR[v.totalTines]
    } else if (v.tinesBurned > 0 && v.tinesBurned < v.totalTines) {
      const k = v.tinesBurned
      img = v.side === 'l'
        ? a.villagerBurnedL[`${v.totalTines}_${k}`]
        : a.villagerBurnedR[`${v.totalTines}_${k}`]
    } else {
      img = v.side === 'l' ? a.villagerWalkL[v.totalTines] : a.villagerWalkR[v.totalTines]
      isStrip = true
    }
    if (!img) return

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.beginPath()
    ctx.ellipse(v.x + sw/2, v.y + sh - 4, sw*0.4, 4, 0, 0, Math.PI*2)
    ctx.fill()

    // Walk strip frame OR static sprite
    if (isStrip) {
      ctx.drawImage(
        img,
        v.walkFrame * meta.frame_w, 0, meta.frame_w, meta.frame_h,
        v.x, v.y, sw, sh
      )
    } else {
      ctx.drawImage(img, v.x, v.y, sw, sh)
    }

    // Fork (separate layer) — uses fork_base anchor on the villager
    if (v.state === 'walking' || v.state === 'fleeing') {
      const forkKey = `${v.totalTines}_${v.tinesBurned}`
      const isTarget = targetRef.current?.villagerId === v.id
      const forkImg = isTarget
        ? a.forkGlow[forkKey] || a.fork[forkKey]
        : a.fork[forkKey]
      if (forkImg) {
        // Position: villager.x + fork_base.x*scale - fork.handle_base.x*scale
        // For simplicity assume handle_base ≈ (3,15) in fork sprite (matches generator)
        const forkW = 8 * SPRITE_SCALE
        const forkH = 16 * SPRITE_SCALE
        const fbx = meta.fork_base.x * SPRITE_SCALE
        const fby = meta.fork_base.y * SPRITE_SCALE
        const fx = v.x + fbx - 3 * SPRITE_SCALE
        const fy = v.y + fby - 15 * SPRITE_SCALE
        // mirror fork if villager faces left
        if (v.side === 'l') {
          ctx.save()
          ctx.translate(fx + forkW, fy)
          ctx.scale(-1, 1)
          ctx.drawImage(forkImg, 0, 0, forkW, forkH)
          ctx.restore()
        } else {
          ctx.drawImage(forkImg, fx, fy, forkW, forkH)
        }
      }
    }

    // Note label above fork (the target tine value)
    if (v.state === 'walking' && targetRef.current?.villagerId === v.id) {
      const label = semiToName(v.intervals[v.totalTines - 1 - v.tinesBurned])
      ctx.font = 'bold 14px monospace'
      ctx.textAlign = 'center'
      ctx.fillStyle = 'rgba(255,255,200,0.95)'
      ctx.strokeStyle = 'rgba(0,0,0,0.85)'
      ctx.lineWidth = 3
      const lx = v.x + sw/2
      const ly = v.y - 6
      ctx.strokeText(label, lx, ly)
      ctx.fillText(label, lx, ly)
    }
  }, [])

  // ─── FPS view render ──────────────────────────────────────────────────────
  const renderFps = useCallback((ctx: CanvasRenderingContext2D) => {
    const a = assetsRef.current
    if (!a.frankFps) return
    // Frank centered, big — fpsZ-independent
    const fw = 64 * SPRITE_SCALE
    const fh = 96 * SPRITE_SCALE
    const fx = (W - fw) / 2
    const fy = 30
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(a.frankFps, fx, fy, fw, fh)

    // Villagers — draw each at a depth-scaled size
    // Use distance-from-center as depth proxy: closer to center = farther
    for (const v of villagersRef.current) {
      const distFromCenter = Math.abs(v.x - W/2)
      const z = 1 - Math.min(1, distFromCenter / (W/2))
      const scaleKey = z < 0.33 ? 'far' : z < 0.66 ? 'mid' : 'near'
      const img = a.villagerFps[scaleKey]
      if (!img) continue
      const sizes = { far: [16,24], mid: [24,32], near: [32,48] } as const
      const [nw, nh] = sizes[scaleKey]
      const sw = nw * SPRITE_SCALE * 0.7
      const sh = nh * SPRITE_SCALE * 0.7
      const drawY = H * 0.55 + z * 60
      const drawX = v.x - sw/2
      // 4-frame walk strip
      const fr = v.walkFrame
      ctx.drawImage(img, fr * nw, 0, nw, nh, drawX, drawY, sw, sh)
      // Note label
      if (v.state === 'walking' && targetRef.current?.villagerId === v.id) {
        const label = semiToName(v.intervals[v.totalTines - 1 - v.tinesBurned])
        ctx.font = 'bold 16px monospace'
        ctx.textAlign = 'center'
        ctx.fillStyle = 'rgba(255,255,200,0.95)'
        ctx.strokeStyle = 'rgba(0,0,0,0.85)'
        ctx.lineWidth = 3
        ctx.strokeText(label, drawX + sw/2, drawY - 8)
        ctx.fillText(label, drawX + sw/2, drawY - 8)
      }
    }
  }, [])

  // ─── Lightning bolt drawing primitive ─────────────────────────────────────
  const drawLightningBolt = useCallback((ctx: CanvasRenderingContext2D, b: Bolt) => {
    const t = 1 - b.life / b.maxLife
    if (t <= 0) return
    ctx.save()
    ctx.globalAlpha = t

    const drawSeg = (x0: number, y0: number, x1: number, y1: number) => {
      // Bresenham-ish jittered polyline
      const segs = 8
      const pts: [number, number][] = [[x0, y0]]
      for (let i = 1; i < segs; i++) {
        const tt = i / segs
        const jx = (Math.random() - 0.5) * 22
        const jy = (Math.random() - 0.5) * 12
        pts.push([x0 + (x1 - x0) * tt + jx, y0 + (y1 - y0) * tt + jy])
      }
      pts.push([x1, y1])
      // Outer glow pass
      ctx.strokeStyle = `hsla(${b.hue}, 100%, 65%, 0.6)`
      ctx.lineWidth = 8
      ctx.beginPath()
      ctx.moveTo(pts[0][0], pts[0][1])
      for (const [x,y] of pts.slice(1)) ctx.lineTo(x, y)
      ctx.stroke()
      // White core pass
      ctx.strokeStyle = `rgba(255,255,255,0.95)`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(pts[0][0], pts[0][1])
      for (const [x,y] of pts.slice(1)) ctx.lineTo(x, y)
      ctx.stroke()
    }

    // Cloud → rod tip
    drawSeg(b.fromX, b.fromY, b.pivotX, b.pivotY)
    // Rod tip → tine
    drawSeg(b.pivotX, b.pivotY, b.toX, b.toY)

    // Impact flash
    ctx.fillStyle = `hsla(${b.hue}, 100%, 80%, ${t})`
    ctx.beginPath()
    ctx.arc(b.toX, b.toY, 10 * t + 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }, [])

  // ─── Start/stop game ──────────────────────────────────────────────────────
  const startGame = useCallback(async () => {
    initAudio()
    villagersRef.current = []
    boltsRef.current = []
    scoreRef.current = 0
    livesRef.current = 3
    matchProgressRef.current = 0
    targetRef.current = null
    spawnClockRef.current = 0
    animClockRef.current = 0
    villagerIdRef.current = 0
    setHud({ score: 0, lives: 3, target: '' })
    setPhase('playing')
    phaseRef.current = 'playing'
    if (!fusionRef.current) {
      fusionRef.current = new PitchFusion({ enableML: false, noiseGateDb: -45 })
      await fusionRef.current.start(p => { pitchRef.current = p })
    }
    spawnVillager()
    spawnVillager()
    lastTimeRef.current = 0
    rafRef.current = requestAnimationFrame(loop)
  }, [loop, spawnVillager])

  useEffect(() => () => {
    fusionRef.current?.stop()
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }, [])

  // ─── UI ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#08080f] text-gray-100 p-4 flex flex-col items-center">
      <div className="w-full max-w-3xl flex items-center justify-between mb-3">
        <Link href="/pitch-defender" className="text-xs text-indigo-400 hover:text-indigo-200">
          ← Back to Pitch Defender
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/pitch-defender/pitchforks" className="text-[11px] px-2 py-1 rounded text-amber-300 border border-amber-700/60 hover:bg-amber-950/30">
            ⮌ Original Pitchforks (V1)
          </Link>
          <button
            onClick={() => setView(v => v === 'side' ? 'fps' : 'side')}
            className="text-[11px] px-2 py-1 rounded text-cyan-300 border border-cyan-700/60 hover:bg-cyan-950/30"
            title="Toggle camera view (mid-game ok)"
          >
            View: {view === 'side' ? 'SIDE' : 'FPS'}
          </button>
        </div>
      </div>

      <h1 className="text-2xl font-black tracking-wider text-cyan-300 mb-1" style={{ textShadow: '0 0 12px rgba(120,200,255,0.5)' }}>
        PITCHFORKS II
      </h1>
      <p className="text-[11px] text-gray-500 mb-3">Frankenstein the Lightning Conductor — sing to strike</p>

      {assetError && (
        <div className="text-xs text-red-400 mb-2">{assetError}</div>
      )}
      {!assetsReady && !assetError && (
        <div className="text-xs text-gray-500 mb-2">Loading sprite atlas…</div>
      )}

      <div className="relative" style={{ width: W, maxWidth: '100%' }}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          style={{
            display: 'block',
            width: '100%',
            border: '1px solid rgba(80,80,120,0.4)',
            borderRadius: 12,
            boxShadow: '0 0 40px rgba(120,180,255,0.15)',
            imageRendering: 'pixelated',
            background: '#0a0a18',
          }}
        />
        {phase === 'menu' && assetsReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-xl">
            <button
              onClick={startGame}
              className="px-6 py-3 rounded-lg text-base font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
            >
              ⚡ START
            </button>
            <p className="text-[11px] text-gray-400 mt-3 max-w-sm text-center px-4">
              Sing the labeled note to strike a tine. Burn all tines → villager flees.
              Let one reach Frankenstein and you lose a life. Toggle SIDE / FPS view any time.
            </p>
          </div>
        )}
        {phase === 'game_over' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 rounded-xl">
            <div className="text-3xl font-black text-red-400 mb-2">GAME OVER</div>
            <div className="text-sm text-gray-300 mb-4">Score: {hud.score}</div>
            <button
              onClick={startGame}
              className="px-5 py-2 rounded-lg text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
            >
              Try again
            </button>
          </div>
        )}
      </div>

      <div className="mt-3 text-[11px] text-gray-500 max-w-md text-center">
        <strong className="text-gray-300">PitchforksII</strong> is the new sprite-based version.
        The original procedural Pitchforks game is still live at{' '}
        <Link href="/pitch-defender/pitchforks" className="text-amber-400 hover:text-amber-200">
          /pitch-defender/pitchforks
        </Link>{' '}
        — both ship side-by-side until V2 is proven.
      </div>
    </div>
  )
}
