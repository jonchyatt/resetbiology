'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// RetroBlaster — Pixel-Art Space Invaders Note Identification
// ═══════════════════════════════════════════════════════════════════════════════
//
// Classic space invaders aesthetic: 256x224 logical resolution, pixelated upscale,
// sprite-based aliens, pixel lasers, retro SFX. Same FSRS engine as Note Blaster.
//
// All rendering in a single Canvas 2D — no DOM elements, no React re-renders
// for game entities. Pure game loop.
//
// SIBLING to Note Blaster. Does NOT replace it.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  NOTE_COLORS, createNote, reviewNote, autoGrade, pickNextNote,
  currentR, type NoteMemory,
} from '@/lib/fsrs'
import { INTRO_ORDER, UNLOCK_THRESHOLDS } from './types'
import { usePitchDetection, notesMatch } from './usePitchDetection'
import { initAudio, loadPianoSamples, playPianoNote } from './audioEngine'

// ─── Constants ──────────────────────────────────────────────────────────────

const FSRS_KEY = 'pitch_fsrs_memory'
const W = 256      // logical width
const H = 224      // logical height
const ALIEN_W = 16
const ALIEN_H = 12
const PLAYER_W = 18
const PLAYER_H = 8
const LASER_W = 2
const LASER_H = 8
const COLS = 5     // aliens per row
const ROWS_PER_WAVE = 3
const DESCENT_SPEED = 8 // pixels per second
const LASER_SPEED = 180 // pixels per second

type InputMode = 'click' | 'mic'
type Phase = 'menu' | 'playing' | 'wave_intro' | 'game_over'

interface Alien {
  x: number
  y: number
  note: string
  hue: number
  alive: boolean
  frame: number     // animation frame 0 or 1
  hitTimer: number   // >0 = exploding
}

interface Laser {
  x: number
  y: number
  hue: number
  active: boolean
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
  laser: Laser | null
  particles: Particle[]
  playerX: number
  score: number
  combo: number
  maxCombo: number
  wave: number
  cityHealth: number
  activeIdx: number   // which alien is "current" (plays note)
  unlockedNotes: string[]
  consecutiveCorrect: number
  selectedNote: string | null
  waveIntroTimer: number
}

// ─── Pixel Sprite Data (1-bit bitmaps) ──────────────────────────────────────

// Classic space invader shape (16x12, 1=pixel on)
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
  '..11....11..',
  '.1..1111..1.',
  '............',
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
  '...1....1...',
  '..1......1..',
  '............',
]

// Player ship
const PLAYER_SPRITE = [
  '........11........',
  '.......1111.......',
  '.......1111.......',
  '.1111111111111111.',
  '111111111111111111',
  '111111111111111111',
  '111111111111111111',
  '.1111111111111111.',
]

// Explosion sprite
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

function drawSprite(ctx: CanvasRenderingContext2D, sprite: string[], x: number, y: number, color: string) {
  ctx.fillStyle = color
  for (let row = 0; row < sprite.length; row++) {
    for (let col = 0; col < sprite[row].length; col++) {
      if (sprite[row][col] === '1') {
        ctx.fillRect(Math.floor(x + col), Math.floor(y + row), 1, 1)
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

function sfxHit() {
  const c = sfxCtx(); const now = c.currentTime
  const o = c.createOscillator(); const g = c.createGain()
  o.type = 'square'; o.frequency.setValueAtTime(200, now)
  o.frequency.exponentialRampToValueAtTime(50, now + 0.15)
  g.gain.setValueAtTime(0.2, now); g.gain.linearRampToValueAtTime(0, now + 0.15)
  o.connect(g); g.connect(c.destination); o.start(now); o.stop(now + 0.15)
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
  // White noise burst via buffer
  const dur = 0.2; const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.max(0, 1 - i / data.length)
  const src = c.createBufferSource(); src.buffer = buf
  const g = c.createGain(); g.gain.setValueAtTime(0.15, now); g.gain.linearRampToValueAtTime(0, now + dur)
  src.connect(g); g.connect(c.destination); src.start(now)
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function RetroBlaster() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<GameState | null>(null)
  const fsrsRef = useRef<Record<string, NoteMemory>>({})
  const rafRef = useRef(0)
  const lastTimeRef = useRef(0)
  const notePlayTimeRef = useRef(0)
  const keysRef = useRef<Set<string>>(new Set())

  const [phase, setPhase] = useState<Phase>('menu')
  const [inputMode, setInputMode] = useState<InputMode>('click')
  const [displayScore, setDisplayScore] = useState(0)
  const [displayWave, setDisplayWave] = useState(0)
  const [displayCombo, setDisplayCombo] = useState(0)
  const [displayHealth, setDisplayHealth] = useState(5)
  const [finalStats, setFinalStats] = useState({ score: 0, wave: 0, maxCombo: 0 })

  // Mic detection
  const { isListening, pitch, startListening, stopListening, pitchRef: livePitchRef } = usePitchDetection({ noiseGateDb: -45 })
  const lockStartRef = useRef(0)
  const hitProcessingRef = useRef(false) // [FIX CRITICAL] prevents double-scoring

  // Load FSRS
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FSRS_KEY)
      if (raw) fsrsRef.current = JSON.parse(raw)
    } catch {}
    loadPianoSamples()
  }, [])

  // Keyboard input
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => keysRef.current.add(e.key.toLowerCase())
    const onUp = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase())
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp) }
  }, [])

  // ─── Spawn Wave ───────────────────────────────────────────────────────
  const spawnWave = useCallback((gs: GameState) => {
    const aliens: Alien[] = []
    const rows = Math.min(ROWS_PER_WAVE + Math.floor(gs.wave / 3), 5)
    const cols = Math.min(COLS + Math.floor(gs.wave / 4), 8)

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const note = pickNextNote(gs.unlockedNotes, fsrsRef.current, null)
        const color = NOTE_COLORS[note]
        aliens.push({
          x: 30 + c * (ALIEN_W + 6),
          y: 20 + r * (ALIEN_H + 6),
          note,
          hue: color?.hue ?? 0,
          alive: true,
          frame: (r + c) % 2,
          hitTimer: 0,
        })
      }
    }

    gs.aliens = aliens
    gs.activeIdx = 0
    // Play first alien's note
    if (aliens.length > 0) {
      setTimeout(() => {
        playPianoNote(aliens[0].note)
        notePlayTimeRef.current = Date.now()
      }, 500)
    }
  }, [])

  // ─── Start Game ───────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    // [FIX CRITICAL] Cancel any prior game loop to prevent rAF stacking
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0 }

    initAudio()
    if (inputMode === 'mic') startListening()

    // Restore unlocked notes
    const reviewed = new Set(
      Object.entries(fsrsRef.current).filter(([, m]) => m.lastReview > 0).map(([k]) => k)
    )
    const restored: string[] = []
    for (const note of INTRO_ORDER) {
      if (reviewed.has(note)) restored.push(note)
      else break
    }
    const unlocked = restored.length >= 2 ? restored : [INTRO_ORDER[0], INTRO_ORDER[1]]

    // Ensure FSRS
    for (const n of unlocked) {
      if (!fsrsRef.current[n]) fsrsRef.current[n] = createNote(n)
    }

    const gs: GameState = {
      aliens: [],
      laser: null,
      particles: [],
      playerX: W / 2,
      score: 0,
      combo: 0,
      maxCombo: 0,
      wave: 1,
      cityHealth: 5,
      activeIdx: 0,
      unlockedNotes: unlocked,
      consecutiveCorrect: 0,
      selectedNote: null,
      waveIntroTimer: 2,
    }

    stateRef.current = gs
    setPhase('playing')
    setDisplayScore(0)
    setDisplayWave(1)
    setDisplayHealth(5)
    setDisplayCombo(0)

    spawnWave(gs)
    lastTimeRef.current = performance.now()
    gameLoop()
  }, [inputMode, spawnWave])

  // ─── Answer Logic ─────────────────────────────────────────────────────
  const processHit = useCallback((answeredNote: string) => {
    // [FIX CRITICAL] Processing lock — one answer at a time
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
      // Fire laser — aim at the active alien's center column
      sfxShoot()
      gs.laser = { x: alien.x + ALIEN_W / 2, y: H - PLAYER_H - 4, hue: alien.hue, active: true }
      gs.combo++
      gs.maxCombo = Math.max(gs.maxCombo, gs.combo)
      const mult = gs.combo >= 10 ? 3 : gs.combo >= 5 ? 2 : 1
      gs.score += 100 * mult
      gs.consecutiveCorrect++

      // Check unlock
      const poolSize = gs.unlockedNotes.length
      const threshold = UNLOCK_THRESHOLDS[poolSize]
      if (threshold && gs.consecutiveCorrect >= threshold && poolSize < INTRO_ORDER.length) {
        const newNote = INTRO_ORDER[poolSize]
        gs.unlockedNotes = [...gs.unlockedNotes, newNote]
        if (!fsrsRef.current[newNote]) fsrsRef.current[newNote] = createNote(newNote)
        gs.consecutiveCorrect = 0
      }

      setDisplayScore(gs.score)
      setDisplayCombo(gs.combo)
      // Unlock after laser fires — game loop handles the kill
      setTimeout(() => { hitProcessingRef.current = false }, 150)
    } else {
      sfxWrong()
      gs.combo = 0
      gs.consecutiveCorrect = 0
      gs.cityHealth = Math.max(0, gs.cityHealth - 1)
      setDisplayHealth(gs.cityHealth)
      setDisplayCombo(0)

      // Play correct note so they learn
      setTimeout(() => playPianoNote(alien.note), 200)

      hitProcessingRef.current = false

      if (gs.cityHealth <= 0) {
        setFinalStats({ score: gs.score, wave: gs.wave, maxCombo: gs.maxCombo })
        if (inputMode === 'mic') stopListening()
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0 }
        setPhase('game_over')
        return
      }
    }
  }, [inputMode])

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

    // Wave intro countdown
    if (gs.waveIntroTimer > 0) {
      gs.waveIntroTimer -= dt
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

    // Alien animation (toggle frames every 0.5s)
    for (const alien of gs.aliens) {
      if (alien.alive) alien.frame = Math.floor(now / 500) % 2
    }

    // Laser travel
    if (gs.laser?.active) {
      gs.laser.y -= LASER_SPEED * dt
      // Check hit on active alien
      const target = gs.aliens[gs.activeIdx]
      if (target?.alive &&
          gs.laser.y <= target.y + ALIEN_H &&
          gs.laser.x >= target.x && gs.laser.x <= target.x + ALIEN_W) {
        // HIT!
        sfxExplosion()
        target.alive = false
        target.hitTimer = 0.3
        gs.laser.active = false

        // Spawn particles
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2
          gs.particles.push({
            x: target.x + ALIEN_W / 2,
            y: target.y + ALIEN_H / 2,
            vx: Math.cos(angle) * (30 + Math.random() * 40),
            vy: Math.sin(angle) * (30 + Math.random() * 40),
            life: 0.4 + Math.random() * 0.3,
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
          // Play next alien's note
          setTimeout(() => {
            if (gs.aliens[nextIdx]?.alive) {
              playPianoNote(gs.aliens[nextIdx].note)
              notePlayTimeRef.current = Date.now()
            }
          }, 300)
        }
      }

      if (gs.laser.y < -LASER_H) gs.laser.active = false
    }

    // Particles
    gs.particles = gs.particles.filter(p => {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.life -= dt
      return p.life > 0
    })

    // Check alien escape (reached bottom)
    for (const alien of gs.aliens) {
      if (alien.alive && alien.y >= H - PLAYER_H - 10) {
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
    if (gs.aliens.every(a => !a.alive && a.hitTimer <= 0)) {
      gs.wave++
      gs.waveIntroTimer = 1.5
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

    // Stars (static, seeded by position)
    ctx.fillStyle = '#333'
    for (let i = 0; i < 30; i++) {
      const sx = (i * 97 + 13) % W
      const sy = (i * 53 + 7) % (H - 30)
      ctx.fillRect(sx, sy, 1, 1)
    }

    // Wave intro text
    if (gs.waveIntroTimer > 0) {
      ctx.fillStyle = '#fff'
      ctx.font = '8px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`WAVE ${gs.wave}`, W / 2, H / 2 - 4)
    }

    // Aliens
    for (const alien of gs.aliens) {
      if (!alien.alive && alien.hitTimer <= 0) continue

      if (alien.hitTimer > 0) {
        // Explosion
        const alpha = alien.hitTimer / 0.3
        ctx.globalAlpha = alpha
        drawSprite(ctx, EXPLOSION_SPRITE, alien.x + 2, alien.y + 1, `hsl(${alien.hue}, 80%, 60%)`)
        ctx.globalAlpha = 1
        continue
      }

      const isActive = gs.aliens.indexOf(alien) === gs.activeIdx
      const sprite = alien.frame === 0 ? ALIEN_SPRITE_A : ALIEN_SPRITE_B
      const color = isActive
        ? `hsl(${alien.hue}, 90%, 70%)`
        : `hsl(${alien.hue}, 40%, 30%)`

      // Draw alien — active ones slightly bigger
      if (isActive) {
        // Glow behind active alien
        ctx.fillStyle = `hsla(${alien.hue}, 80%, 50%, 0.15)`
        ctx.fillRect(alien.x - 3, alien.y - 3, ALIEN_W + 6, ALIEN_H + 6)
      }
      drawSprite(ctx, sprite, alien.x, alien.y, color)

      // Note label — always show note name, bigger on active
      if (isActive) {
        // Big "?" above + pulsing border
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 8px monospace'
        ctx.textAlign = 'center'
        ctx.fillText('?', alien.x + ALIEN_W / 2, alien.y - 4)

        const pulse = Math.sin(now / 200) * 0.3 + 0.7
        ctx.strokeStyle = `hsla(${alien.hue}, 80%, 60%, ${pulse})`
        ctx.lineWidth = 1
        ctx.strokeRect(alien.x - 2, alien.y - 2, ALIEN_W + 4, ALIEN_H + 4)
      } else {
        // Show note name on inactive aliens too (dimmed)
        ctx.fillStyle = `hsla(${alien.hue}, 50%, 50%, 0.5)`
        ctx.font = '5px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(alien.note.replace(/\d/, ''), alien.x + ALIEN_W / 2, alien.y - 1)
      }
    }

    // Laser
    if (gs.laser?.active) {
      ctx.fillStyle = `hsl(${gs.laser.hue}, 90%, 70%)`
      ctx.fillRect(gs.laser.x - 1, gs.laser.y, LASER_W, LASER_H)
      // Glow
      ctx.fillStyle = `hsla(${gs.laser.hue}, 90%, 80%, 0.4)`
      ctx.fillRect(gs.laser.x - 2, gs.laser.y - 1, LASER_W + 2, LASER_H + 2)
    }

    // Particles
    for (const p of gs.particles) {
      const alpha = Math.max(0, p.life * 3)
      ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${alpha})`
      ctx.fillRect(Math.floor(p.x), Math.floor(p.y), 2, 2)
    }

    // Player ship
    drawSprite(ctx, PLAYER_SPRITE, gs.playerX - PLAYER_W / 2, H - PLAYER_H - 2, '#3FBFB5')

    // City health (shield blocks at bottom)
    for (let i = 0; i < 5; i++) {
      const sx = 40 + i * 38
      ctx.fillStyle = i < gs.cityHealth ? '#3FBFB5' : '#222'
      ctx.fillRect(sx, H - 2, 30, 2)
    }

    // HUD text — bigger and readable
    ctx.fillStyle = '#aaa'
    ctx.font = 'bold 9px monospace'
    ctx.textAlign = 'left'
    ctx.fillText(`SCORE ${gs.score}`, 4, 10)
    ctx.textAlign = 'right'
    ctx.fillText(`WAVE ${gs.wave}`, W - 4, 10)
    if (gs.combo >= 3) {
      ctx.fillStyle = gs.combo >= 10 ? '#ff6090' : '#ffc83c'
      ctx.textAlign = 'center'
      ctx.font = 'bold 10px monospace'
      ctx.fillText(`${gs.combo}x COMBO`, W / 2, 10)
    }
    // Health display
    ctx.fillStyle = '#888'
    ctx.font = '7px monospace'
    ctx.textAlign = 'left'
    ctx.fillText(`SHIELDS`, 4, H - 22)
    for (let h = 0; h < 5; h++) {
      ctx.fillStyle = h < gs.cityHealth ? '#3FBFB5' : '#333'
      ctx.fillRect(50 + h * 14, H - 26, 12, 5)
    }

    // Note buttons at bottom (rendered in canvas for retro feel)
    const unlocked = gs.unlockedNotes
    const btnW = Math.min(26, (W - 20) / unlocked.length - 2)
    const btnStartX = (W - unlocked.length * (btnW + 2)) / 2
    const btnY = H - 18

    for (let i = 0; i < unlocked.length; i++) {
      const note = unlocked[i]
      const hue = NOTE_COLORS[note]?.hue ?? 0
      const bx = btnStartX + i * (btnW + 2)

      // Button background
      ctx.fillStyle = gs.selectedNote === note
        ? `hsl(${hue}, 60%, 40%)`
        : `hsl(${hue}, 40%, 15%)`
      ctx.fillRect(bx, btnY, btnW, 10)

      // Border
      ctx.strokeStyle = `hsl(${hue}, 60%, 50%)`
      ctx.lineWidth = 0.5
      ctx.strokeRect(bx, btnY, btnW, 10)

      // Label — readable
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 7px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(note.replace(/\d/, ''), bx + btnW / 2, btnY + 8)
    }

    rafRef.current = requestAnimationFrame(gameLoop)
  }, [inputMode, isListening, spawnWave, processHit])

  // ─── Canvas click handler (note selection) ────────────────────────────
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const gs = stateRef.current
    if (!gs || !canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const scaleX = W / rect.width
    const scaleY = H / rect.height
    const cx = (e.clientX - rect.left) * scaleX
    const cy = (e.clientY - rect.top) * scaleY

    // Check if clicked on a note button
    const unlocked = gs.unlockedNotes
    const btnW = Math.min(20, (W - 20) / unlocked.length - 2)
    const btnStartX = (W - unlocked.length * (btnW + 2)) / 2
    const btnY = H - 18

    for (let i = 0; i < unlocked.length; i++) {
      const bx = btnStartX + i * (btnW + 2)
      if (cx >= bx && cx <= bx + btnW && cy >= btnY && cy <= btnY + 12) {
        processHit(unlocked[i])
        return
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
      const note = keyMap[ev.key.toLowerCase()]
      if (note && gs.unlockedNotes.includes(note)) processHit(note)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [processHit])

  // Cleanup
  useEffect(() => {
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  // ─── MENU ─────────────────────────────────────────────────────────────
  if (phase === 'menu') {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center px-6"
        style={{ fontFamily: 'monospace' }}>
        <h1 className="text-3xl font-black text-[#3FBFB5] mb-2"
          style={{ textShadow: '0 0 20px rgba(60,191,181,0.4)', letterSpacing: '0.2em' }}>
          RETRO BLASTER
        </h1>
        <p className="text-gray-600 text-xs mb-6 tracking-wider">PIXEL-ART EAR TRAINING</p>

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

        <button onClick={startGame}
          className="px-8 py-3 text-lg font-bold tracking-widest transition-all active:scale-95"
          style={{
            background: '#3FBFB5',
            color: '#000',
            border: '2px solid #5dddd3',
            boxShadow: '0 0 20px rgba(60,191,181,0.3)',
          }}>
          INSERT COIN
        </button>

        <a href="/pitch-defender" className="mt-8 text-xs text-gray-700 hover:text-gray-500 transition-colors tracking-wider">
          ← BACK TO PITCH DEFENDER
        </a>
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
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onClick={handleCanvasClick}
        className="w-full h-full max-w-[768px] max-h-[672px]"
        style={{ imageRendering: 'pixelated', cursor: 'pointer' }}
      />
    </div>
  )
}
