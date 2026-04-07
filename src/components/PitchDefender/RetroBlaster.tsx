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
  NOTE_COLORS, createNote, reviewNote, autoGrade,
  type NoteMemory,
} from '@/lib/fsrs'
import { INTRO_ORDER, UNLOCK_THRESHOLDS } from './types'
import { usePitchDetection, notesMatch } from './usePitchDetection'
import { initAudio, loadPianoSamples, playPianoNote } from './audioEngine'

// ─── Constants ──────────────────────────────────────────────────────────────

const FSRS_KEY = 'pitch_fsrs_memory'
const TUTORIAL_KEY = 'retro_tutorial_seen'
const W = 480      // logical width — bigger for readability
const H = 320      // logical height
const ALIEN_W = 24
const ALIEN_H = 18
const PLAYER_W = 28
const PLAYER_H = 14
const LASER_W = 3
const LASER_H = 12
const DESCENT_SPEED = 6   // pixels per second base
const LASER_SPEED = 480   // pixels per second
const INITIAL_UNLOCK = 4  // start with 4 notes (C4, D4, E4, F4)
const MAX_ALIENS = 15
const STARTING_SHIELDS = 5

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
  hits: boolean    // true = will hit (correct), false = miss visual only
  targetY: number  // for misses, where it stops
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  hue: number
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
  const [displayScore, setDisplayScore] = useState(0)
  const [displayWave, setDisplayWave] = useState(0)
  const [displayCombo, setDisplayCombo] = useState(0)
  const [displayHealth, setDisplayHealth] = useState(STARTING_SHIELDS)
  const [displayUnlocked, setDisplayUnlocked] = useState<string[]>([])
  const [finalStats, setFinalStats] = useState({ score: 0, wave: 0, maxCombo: 0 })

  // Mic detection
  const { isListening, startListening, stopListening, pitchRef: livePitchRef } = usePitchDetection({ noiseGateDb: -45 })
  const lockStartRef = useRef(0)
  const hitProcessingRef = useRef(false)

  // Load FSRS + piano samples
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FSRS_KEY)
      if (raw) fsrsRef.current = JSON.parse(raw)
    } catch {}
    loadPianoSamples()
  }, [])

  // ─── Spawn Wave ───────────────────────────────────────────────────────
  // Wave 1 = 1 alien, wave 2 = 2 aliens, etc, capped at MAX_ALIENS.
  // Variety: ensure all unlocked notes appear (round-robin) before repeats.
  const spawnWave = useCallback((gs: GameState) => {
    const aliens: Alien[] = []
    const count = Math.min(gs.wave, MAX_ALIENS)
    const pool = gs.unlockedNotes

    // Build a deterministic varied note sequence:
    // 1. Take all unlocked notes (each once)
    // 2. Pad with shuffled extras until count is met
    // 3. Shuffle the whole list with a wave-seeded RNG
    const notes: string[] = []
    if (count <= pool.length) {
      // Fewer aliens than notes — just pick a varied subset
      const shuffled = shuffle(pool, gs.wave * 7919)
      for (let i = 0; i < count; i++) notes.push(shuffled[i])
    } else {
      // More aliens than notes — start with one of each, then fill
      notes.push(...pool)
      while (notes.length < count) {
        const extra = shuffle(pool, gs.wave * 7919 + notes.length)
        for (let i = 0; i < extra.length && notes.length < count; i++) {
          notes.push(extra[i])
        }
      }
      // Final shuffle for visual variety (active alien won't always be leftmost)
      const finalOrder = shuffle(notes, gs.wave * 104729)
      notes.length = 0
      notes.push(...finalOrder)
    }

    // Layout: try to fit in rows of 5; vertical position scales with wave
    const cols = Math.min(5, count)
    const rows = Math.ceil(count / cols)
    const rowSpacing = ALIEN_H + 14
    const colSpacing = ALIEN_W + 22
    const totalW = cols * colSpacing - 22
    const startX = Math.floor((W - totalW) / 2)
    const startY = 70

    for (let i = 0; i < count; i++) {
      const r = Math.floor(i / cols)
      const c = i % cols
      const note = notes[i]
      const color = NOTE_COLORS[note]
      aliens.push({
        x: startX + c * colSpacing,
        y: startY + r * rowSpacing,
        note,
        hue: color?.hue ?? 0,
        alive: true,
        frame: (r + c) % 2,
        hitTimer: 0,
      })
    }

    gs.aliens = aliens
    gs.activeIdx = 0
    // Play first alien's note
    if (aliens.length > 0) {
      setTimeout(() => {
        playPianoNote(aliens[0].note)
        notePlayTimeRef.current = Date.now()
      }, 600)
    }
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
      activeIdx: 0,
      unlockedNotes: unlocked,
      consecutiveCorrect: 0,
      selectedNote: null,
      waveIntroTimer: 1.5,
      flashTimer: 0,
      wrongMessage: '',
      wrongTimer: 0,
    }
  }, [])

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

    spawnWave(gs)
    lastTimeRef.current = performance.now()
    gameLoop()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputMode, spawnWave, buildInitialState])

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

  // ─── Answer Logic ─────────────────────────────────────────────────────
  const processHit = useCallback((answeredNote: string) => {
    if (hitProcessingRef.current) return
    hitProcessingRef.current = true

    const gs = stateRef.current
    if (!gs) { hitProcessingRef.current = false; return }
    const alien = gs.aliens[gs.activeIdx]
    if (!alien?.alive) { hitProcessingRef.current = false; return }

    const correct = answeredNote === alien.note
    const latency = notePlayTimeRef.current > 0 ? Date.now() - notePlayTimeRef.current : 2000
    const grade = autoGrade(correct, latency)

    // FSRS update
    if (!fsrsRef.current[alien.note]) fsrsRef.current[alien.note] = createNote(alien.note)
    fsrsRef.current[alien.note] = reviewNote(fsrsRef.current[alien.note], grade)
    try { localStorage.setItem(FSRS_KEY, JSON.stringify(fsrsRef.current)) } catch {}

    if (correct) {
      sfxShoot()
      // AUTO-AIM: slide the player ship under the active alien before firing,
      // then push the laser from that position so it visually connects.
      const aimX = alien.x + ALIEN_W / 2
      gs.playerX = aimX
      gs.lasers.push({
        x: aimX,
        y: H - PLAYER_H - 8,
        hue: alien.hue,
        active: true,
        hits: true,
        targetY: alien.y + ALIEN_H / 2,
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
      sfxWrong()
      gs.combo = 0
      gs.consecutiveCorrect = 0
      gs.cityHealth = Math.max(0, gs.cityHealth - 1)
      gs.flashTimer = 0.4
      const correctName = NOTE_COLORS[alien.note]?.name ?? alien.note
      gs.wrongMessage = `WRONG! That was ${alien.note.replace(/\d/, '')} (${correctName})`
      gs.wrongTimer = 1.8
      setDisplayHealth(gs.cityHealth)
      setDisplayCombo(0)

      // Visual: laser fires but stops short (miss visual) — also auto-aim so it goes under the alien
      const aimX = alien.x + ALIEN_W / 2
      gs.playerX = aimX
      gs.lasers.push({
        x: aimX,
        y: H - PLAYER_H - 8,
        hue: 0,
        active: true,
        hits: false,
        targetY: alien.y + ALIEN_H + 30, // stops below alien
      })

      // Play correct note so they learn
      setTimeout(() => playPianoNote(alien.note), 350)

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

    // Alien descent
    const speed = DESCENT_SPEED + gs.wave * 1.5
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

    // Lasers
    for (const laser of gs.lasers) {
      if (!laser.active) continue
      laser.y -= LASER_SPEED * dt

      if (laser.hits) {
        const target = gs.aliens[gs.activeIdx]
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

          // Advance to next alive alien
          let nextIdx = -1
          for (let i = 0; i < gs.aliens.length; i++) {
            if (gs.aliens[i].alive) { nextIdx = i; break }
          }
          gs.activeIdx = nextIdx

          if (nextIdx >= 0) {
            setTimeout(() => {
              const cur = stateRef.current
              if (cur && cur.aliens[nextIdx]?.alive) {
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
      if (alien.alive && alien.y >= H - PLAYER_H - 18) {
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

    // Wave complete check
    if (gs.aliens.length > 0 && gs.aliens.every(a => !a.alive && a.hitTimer <= 0)) {
      gs.wave++
      gs.waveIntroTimer = 1.6
      setDisplayWave(gs.wave)
      spawnWave(gs)
    }

    // Mic mode — pitch check
    if (inputMode === 'mic' && isListening) {
      const p = livePitchRef.current
      const target = gs.aliens[gs.activeIdx]
      if (p?.isActive && target?.alive) {
        const match = notesMatch(p.note, target.note, { octaveFlexible: true }) && Math.abs(p.cents) <= 50
        if (match) {
          if (lockStartRef.current === 0) lockStartRef.current = Date.now()
          if (Date.now() - lockStartRef.current >= 500) {
            lockStartRef.current = 0
            processHit(target.note)
          }
        } else {
          lockStartRef.current = 0
        }
      }
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
      const count = Math.min(gs.wave, MAX_ALIENS)
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

    // Player ship
    drawSprite(ctx, PLAYER_SPRITE, gs.playerX - PLAYER_W / 2, H - PLAYER_H - 8, '#3FBFB5', 2)

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
  }, [inputMode, isListening, spawnWave, processHit, livePitchRef])

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
        <div className="flex gap-2 mb-6">
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
              <div className="text-sm text-gray-300 font-bold">Wave 1 is just one alien</div>
              <div className="text-xs text-gray-400">Take your time. Wave 2 has 2 aliens, wave 3 has 3, and so on. The notes get faster as you progress.</div>
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
