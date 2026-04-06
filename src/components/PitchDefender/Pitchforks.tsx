'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// Pitchforks — Frankenstein Monster vs Villagers with Pitchforks
// ═══════════════════════════════════════════════════════════════════════════════
//
// Horror-comedy pixel art game. YOU are the Frankenstein monster.
// Villagers attack with musical "pitchforks" — interval patterns you must
// sing back correctly to survive. Progressive guided → unguided.
//
// KEY FEATURE: Load intervals from actual MusicXML. The villager attacks
// become the exact jumps from the audition piece. Practice by gaming.
//
// Canvas 2D, 320x240 logical, pixelated upscale.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useEffect } from 'react'
import { NOTE_COLORS } from '@/lib/fsrs'
import { PitchFusion, type FusedPitch } from './pitchFusion'
import { extractNotesFromXML, extractIntervals, type IntervalPattern } from './extractNotes'
import { initAudio, playPianoNote } from './audioEngine'

// ─── Constants ──────────────────────────────────────────────────────────────

const W = 480      // bigger canvas for readability
const H = 320
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

type Phase = 'menu' | 'tutorial' | 'playing' | 'level_intro' | 'game_over'
type GuideLevel = 'full' | 'partial' | 'none'

interface Villager {
  x: number
  y: number
  fromSemi: number
  toSemi: number
  fromName: string
  toName: string
  interval: number
  direction: 'up' | 'down' | 'same'
  alive: boolean
  hitTimer: number
  phase: 'approaching' | 'attacking' | 'defeated'
  attackTimer: number   // time before they reach the monster
  guideLevel: GuideLevel
}

interface GameState {
  villagers: Villager[]
  monsterHealth: number
  score: number
  combo: number
  maxCombo: number
  level: number
  villagersDefeated: number
  currentVillager: number  // index of active attacking villager
}

// ─── Pixel Sprites ──────────────────────────────────────────────────────────

const MONSTER_SPRITE = [
  '...1111111...',
  '..111111111..',
  '.11.11111.11.',
  '.1111111111..',
  '.11111111111.',
  '..111111111..',
  '...1.111.1...',
  '..111111111..',
  '.1111111111..',
  '.1.1111111.1.',
  '.1..11111..1.',
  '....1...1....',
  '...11...11...',
  '..111...111..',
]

const VILLAGER_SPRITE_A = [
  '....111....',
  '...11111...',
  '...1.1.1...',
  '...11111...',
  '....111....',
  '.....1.....',
  '..1111111..',
  '.1...1...1.',
  '.....1.....',
  '....1.1....',
  '...1...1...',
  '..1.....1..',
]

const PITCHFORK_SPRITE = [
  '.1.1.1.',
  '.11111.',
  '...1...',
  '...1...',
  '...1...',
  '...1...',
  '...1...',
  '...1...',
]

function drawSprite(ctx: CanvasRenderingContext2D, sprite: string[], x: number, y: number, color: string, scale = 2) {
  ctx.fillStyle = color
  for (let row = 0; row < sprite.length; row++) {
    for (let col = 0; col < sprite[row].length; col++) {
      if (sprite[row][col] === '1') {
        ctx.fillRect(Math.floor(x + col * scale), Math.floor(y + row * scale), scale, scale)
      }
    }
  }
}

// ─── Chiptune SFX ───────────────────────────────────────────────────────────

let _sfxCtx: AudioContext | null = null
function sfx(): AudioContext {
  if (!_sfxCtx) _sfxCtx = new AudioContext()
  if (_sfxCtx.state === 'suspended') _sfxCtx.resume()
  return _sfxCtx
}

function sfxVillagerAttack() {
  const c = sfx(); const n = c.currentTime
  const o = c.createOscillator(); const g = c.createGain()
  o.type = 'square'; o.frequency.setValueAtTime(300, n); o.frequency.linearRampToValueAtTime(150, n + 0.15)
  g.gain.setValueAtTime(0.1, n); g.gain.linearRampToValueAtTime(0, n + 0.15)
  o.connect(g); g.connect(c.destination); o.start(n); o.stop(n + 0.15)
}

function sfxMonsterRoar() {
  const c = sfx(); const n = c.currentTime
  const o = c.createOscillator(); const g = c.createGain()
  o.type = 'sawtooth'; o.frequency.setValueAtTime(80, n); o.frequency.linearRampToValueAtTime(120, n + 0.2)
  g.gain.setValueAtTime(0.15, n); g.gain.linearRampToValueAtTime(0, n + 0.3)
  o.connect(g); g.connect(c.destination); o.start(n); o.stop(n + 0.3)
}

function sfxDefeat() {
  const c = sfx(); const n = c.currentTime
  const o = c.createOscillator(); const g = c.createGain()
  o.type = 'square'; o.frequency.setValueAtTime(440, n)
  o.frequency.setValueAtTime(550, n + 0.08); o.frequency.setValueAtTime(660, n + 0.16)
  g.gain.setValueAtTime(0.12, n); g.gain.linearRampToValueAtTime(0, n + 0.25)
  o.connect(g); g.connect(c.destination); o.start(n); o.stop(n + 0.25)
}

function sfxDamage() {
  const c = sfx(); const n = c.currentTime
  const buf = c.createBuffer(1, c.sampleRate * 0.15, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length)
  const s = c.createBufferSource(); s.buffer = buf
  const g = c.createGain(); g.gain.setValueAtTime(0.15, n); g.gain.linearRampToValueAtTime(0, n + 0.15)
  s.connect(g); g.connect(c.destination); s.start(n)
}

// ─── Tone player ────────────────────────────────────────────────────────────

function playTone(semi: number, durationMs: number) {
  const c = sfx(); const n = c.currentTime
  const freq = 261.63 * Math.pow(2, semi / 12)
  const o = c.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(freq, n)
  const g = c.createGain()
  g.gain.setValueAtTime(0, n); g.gain.linearRampToValueAtTime(0.15, n + 0.02)
  g.gain.setValueAtTime(0.12, n + durationMs / 1000 * 0.8)
  g.gain.exponentialRampToValueAtTime(0.001, n + durationMs / 1000)
  o.connect(g); g.connect(c.destination); o.start(n); o.stop(n + durationMs / 1000)
}

function semiToName(s: number): string {
  const idx = ((Math.round(s) % 12) + 12) % 12
  const oct = 4 + Math.floor(s / 12)
  return `${NOTE_NAMES[idx]}${oct}`
}

// ─── Default interval patterns (when no MusicXML loaded) ────────────────────

function generateDefaultIntervals(level: number): IntervalPattern[] {
  const patterns: IntervalPattern[] = []
  const count = level <= 1 ? 3 : level <= 2 ? 4 : 4 + level  // fewer villagers on early levels

  // Level 1: unison + steps only (easiest possible)
  // Level 2: steps (1-2 semitones)
  // Level 3-4: skips (3-4 semitones)
  // Level 5+: leaps (5+ semitones)
  const maxInterval = level <= 1 ? 1 : level <= 2 ? 2 : level <= 4 ? 4 : 7 + level

  for (let i = 0; i < count; i++) {
    const interval = Math.floor(Math.random() * maxInterval) + 1
    const direction = Math.random() < 0.5 ? 1 : -1
    const from = Math.floor(Math.random() * 12) - 6 // centered around C4
    const to = from + interval * direction

    patterns.push({
      from, to,
      interval,
      direction: direction > 0 ? 'up' : 'down',
      fromName: semiToName(from),
      toName: semiToName(to),
      measure: 0,
    })
  }
  return patterns
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function Pitchforks() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [phase, setPhase] = useState<Phase>('menu')
  const [customIntervals, setCustomIntervals] = useState<IntervalPattern[]>([])
  const [sourceName, setSourceName] = useState<string>('')
  const [loadingXML, setLoadingXML] = useState(false)

  const stateRef = useRef<GameState | null>(null)
  const fusionRef = useRef<PitchFusion | null>(null)
  const pitchRef = useRef<FusedPitch | null>(null)
  const rafRef = useRef(0)
  const lastTimeRef = useRef(0)
  const matchStartRef = useRef(0)
  const attackPhaseRef = useRef<'from' | 'to'>('from') // which note of the interval to sing

  const [displayScore, setDisplayScore] = useState(0)
  const [displayHealth, setDisplayHealth] = useState(5)
  const [displayLevel, setDisplayLevel] = useState(1)
  const [displayCombo, setDisplayCombo] = useState(0)
  const [currentPrompt, setCurrentPrompt] = useState('')
  const [matchProgress, setMatchProgress] = useState(0)

  // ─── Load MusicXML intervals ──────────────────────────────────────────
  const handleMusicXML = useCallback(async (file: File) => {
    setLoadingXML(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase()
      let data: string | Uint8Array
      if (ext === 'mxl') data = new Uint8Array(await file.arrayBuffer())
      else data = await file.text()
      const result = await extractNotesFromXML(data)
      // Use first part by default, or pick the one with most notes
      const partIdx = result.parts.length > 1
        ? result.notes.reduce((best: number, _, i) => {
            const count = result.notes.filter(n => n.partIndex === i && !n.isRest).length
            const bestCount = result.notes.filter(n => n.partIndex === best && !n.isRest).length
            return count > bestCount ? i : best
          }, 0)
        : 0
      const intervals = extractIntervals(result.notes, partIdx)
      setCustomIntervals(intervals)
      setSourceName(`${result.title} (${result.parts[partIdx]})`)
    } catch (err) {
      console.error('Parse error:', err)
    }
    setLoadingXML(false)
  }, [])

  const loadSample = useCallback(async (url: string) => {
    setLoadingXML(true)
    try {
      const resp = await fetch(url)
      const text = await resp.text()
      const result = await extractNotesFromXML(text)
      const intervals = extractIntervals(result.notes, 0)
      setCustomIntervals(intervals)
      setSourceName(result.title)
    } catch (err) {
      console.error('Load error:', err)
    }
    setLoadingXML(false)
  }, [])

  // ─── Start Game ───────────────────────────────────────────────────────
  const startGame = useCallback(async () => {
    initAudio()

    // Start pitch detection
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const fusion = new PitchFusion({ enableML: true, noiseGateDb: -45 })
    fusionRef.current = fusion
    await fusion.start(p => { pitchRef.current = p })

    const gs: GameState = {
      villagers: [],
      monsterHealth: 5,
      score: 0,
      combo: 0,
      maxCombo: 0,
      level: 1,
      villagersDefeated: 0,
      currentVillager: -1,
    }
    stateRef.current = gs
    setDisplayScore(0)
    setDisplayHealth(5)
    setDisplayLevel(1)
    setDisplayCombo(0)

    spawnLevel(gs, 1)
    setPhase('playing')
    lastTimeRef.current = performance.now()
    gameLoop()
  }, [])

  // ─── Spawn Level ──────────────────────────────────────────────────────
  const spawnLevel = useCallback((gs: GameState, level: number) => {
    const intervals = customIntervals.length > 0
      ? customIntervals.slice(0, 4 + level * 2) // progressively more from the piece
      : generateDefaultIntervals(level)

    // Determine guide level based on level progression
    const guide: GuideLevel = level <= 2 ? 'full' : level <= 5 ? 'partial' : 'none'

    // Level 1-2: very slow, lots of time. Level 3+: gradually faster.
    const baseAttackTime = level <= 1 ? 25 : level <= 2 ? 18 : level <= 4 ? 12 : 8
    const stagger = level <= 2 ? 6 : 4

    const villagers: Villager[] = intervals.map((intv, i) => ({
      x: W + 60 + i * 70,
      y: 140 + Math.sin(i * 1.3) * 50,
      fromSemi: intv.from,
      toSemi: intv.to,
      fromName: intv.fromName,
      toName: intv.toName,
      interval: intv.interval,
      direction: intv.direction,
      alive: true,
      hitTimer: 0,
      phase: 'approaching' as const,
      attackTimer: baseAttackTime + i * stagger,
      guideLevel: guide,
    }))

    gs.villagers = villagers
    gs.currentVillager = 0
    gs.level = level
    setDisplayLevel(level)

    // Play the first interval as a hint if guided — 1 second each, clear gap
    if (guide !== 'none' && villagers.length > 0) {
      const v = villagers[0]
      setTimeout(() => {
        playTone(v.fromSemi, 1000)
        setTimeout(() => playTone(v.toSemi, 1000), 1200)
      }, 500)
    }
    attackPhaseRef.current = 'from'
    setCurrentPrompt(villagers[0] ? `Sing: ${villagers[0].fromName}` : '')
  }, [customIntervals])

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

    const pitch = pitchRef.current
    const cv = gs.villagers[gs.currentVillager]

    // ── Update villagers ──
    for (const v of gs.villagers) {
      if (!v.alive) {
        if (v.hitTimer > 0) v.hitTimer -= dt
        continue
      }
      // Approach monster — slow walk, not a sprint
      if (v.phase === 'approaching') {
        v.x -= 10 * dt  // slower approach
        if (v.x <= 120) {
          v.phase = 'attacking'
          sfxVillagerAttack()
        }
      }
      // Attack countdown
      if (v.phase === 'attacking') {
        v.attackTimer -= dt
        if (v.attackTimer <= 0) {
          // Villager hits monster!
          v.alive = false
          v.hitTimer = 0.3
          gs.monsterHealth = Math.max(0, gs.monsterHealth - 1)
          gs.combo = 0
          setDisplayHealth(gs.monsterHealth)
          setDisplayCombo(0)
          sfxDamage()

          if (gs.monsterHealth <= 0) {
            fusionRef.current?.stop()
            setPhase('game_over')
            return
          }
          // Advance to next villager
          advanceVillager(gs)
        }
      }
    }

    // ── Pitch matching for current attacking villager ──
    if (cv?.alive && cv.phase === 'attacking' && pitch?.isActive && pitch.isSettled) {
      const targetSemi = attackPhaseRef.current === 'from' ? cv.fromSemi : cv.toSemi
      const deviation = Math.abs(pitch.staffPosition - targetSemi)

      if (deviation <= 1.5) {
        if (matchStartRef.current === 0) matchStartRef.current = performance.now()
        const held = performance.now() - matchStartRef.current
        const progress = Math.min(1, held / 400)
        setMatchProgress(progress)

        if (progress >= 1) {
          matchStartRef.current = 0
          setMatchProgress(0)

          if (attackPhaseRef.current === 'from') {
            // First note matched — now sing the target note
            attackPhaseRef.current = 'to'
            setCurrentPrompt(cv.guideLevel === 'none' ? 'Sing the next note!' : `Now: ${cv.toName}`)
            if (cv.guideLevel === 'full') playTone(cv.toSemi, 1000)
          } else {
            // Both notes matched — villager defeated!
            cv.alive = false
            cv.phase = 'defeated'
            cv.hitTimer = 0.5
            sfxDefeat()
            sfxMonsterRoar()
            gs.combo++
            gs.maxCombo = Math.max(gs.maxCombo, gs.combo)
            const mult = gs.combo >= 10 ? 3 : gs.combo >= 5 ? 2 : 1
            gs.score += (100 + cv.interval * 20) * mult
            gs.villagersDefeated++
            setDisplayScore(gs.score)
            setDisplayCombo(gs.combo)
            advanceVillager(gs)
          }
        }
      } else {
        matchStartRef.current = 0
        setMatchProgress(prev => Math.max(0, prev - dt * 3))
      }
    } else if (cv?.alive) {
      matchStartRef.current = 0
      setMatchProgress(prev => Math.max(0, prev - dt * 2))
    }

    // ── Render ──
    ctx.fillStyle = '#0a0812'
    ctx.fillRect(0, 0, W, H)

    // Night sky
    ctx.fillStyle = '#1a1028'
    ctx.fillRect(0, 0, W, H * 0.6)

    // Stars
    ctx.fillStyle = '#444'
    for (let i = 0; i < 20; i++) {
      ctx.fillRect((i * 73 + 11) % W, (i * 41 + 3) % (H * 0.5), 1, 1)
    }

    // Ground
    ctx.fillStyle = '#1a2810'
    ctx.fillRect(0, H * 0.75, W, H * 0.25)

    // Monster (left side) — scaled 2x
    const monsterY = H * 0.7 - 28
    drawSprite(ctx, MONSTER_SPRITE, 30, monsterY, '#4a8a3a', 2)
    // Monster health bar
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < gs.monsterHealth ? '#4ade80' : '#333'
      ctx.fillRect(28 + i * 12, monsterY - 6, 10, 4)
    }

    // Villagers
    for (const v of gs.villagers) {
      if (!v.alive && v.hitTimer <= 0) continue

      if (v.hitTimer > 0 && !v.alive) {
        // Defeat animation
        const alpha = v.hitTimer / 0.5
        ctx.globalAlpha = alpha
        const hue = NOTE_COLORS[v.toName]?.hue ?? 0
        drawSprite(ctx, VILLAGER_SPRITE_A, v.x, v.y, `hsl(${hue}, 60%, 50%)`)
        ctx.globalAlpha = 1
        continue
      }

      const isActive = gs.villagers.indexOf(v) === gs.currentVillager
      const hue = NOTE_COLORS[v.toName]?.hue ?? 0
      const color = isActive
        ? `hsl(${hue}, 80%, 65%)`
        : v.phase === 'attacking'
        ? `hsl(0, 70%, 60%)`
        : `hsl(${hue}, 40%, 40%)`

      // 2x scaled sprites
      drawSprite(ctx, VILLAGER_SPRITE_A, v.x, v.y, color, 2)

      // Pitchfork (2x)
      if (v.alive) {
        drawSprite(ctx, PITCHFORK_SPRITE, v.x - 16, v.y + 4, isActive ? '#fbbf24' : '#888', 2)
      }

      // Interval label on active villager — BIG readable text
      if (isActive && v.phase === 'attacking') {
        ctx.textAlign = 'center'
        const labelX = v.x + 11 // center of 2x sprite

        if (v.guideLevel !== 'none') {
          // From note
          ctx.fillStyle = attackPhaseRef.current === 'from' ? '#fff' : '#888'
          ctx.font = 'bold 12px monospace'
          ctx.fillText(v.fromName, labelX - 20, v.y - 12)
          // Arrow
          ctx.fillStyle = '#fbbf24'
          ctx.font = '10px monospace'
          ctx.fillText('→', labelX, v.y - 12)
          // To note
          ctx.fillStyle = attackPhaseRef.current === 'to' ? '#fff' : '#888'
          ctx.font = 'bold 12px monospace'
          ctx.fillText(v.toName, labelX + 20, v.y - 12)
        } else {
          ctx.fillStyle = '#888'
          ctx.font = 'bold 10px monospace'
          ctx.fillText('? → ?', labelX, v.y - 10)
        }

        // Attack timer bar — wider, more visible
        const barW = 40
        const baseTime = gs.level <= 1 ? 25 : gs.level <= 2 ? 18 : 12
        const barPct = Math.max(0, v.attackTimer / (baseTime + gs.villagers.indexOf(v) * (gs.level <= 2 ? 6 : 4)))
        ctx.fillStyle = barPct > 0.3 ? '#fbbf24' : '#ef4444'
        ctx.fillRect(v.x - 5, v.y - 3, barW * barPct, 3)
        ctx.strokeStyle = '#555'
        ctx.lineWidth = 0.5
        ctx.strokeRect(v.x - 5, v.y - 3, barW, 3)
      }
    }

    // HUD — bigger text
    ctx.fillStyle = '#888'
    ctx.font = 'bold 10px monospace'
    ctx.textAlign = 'left'
    ctx.fillText(`SCORE ${gs.score}`, 8, 14)
    ctx.textAlign = 'right'
    ctx.fillText(`LEVEL ${gs.level}`, W - 8, 14)
    if (gs.combo >= 3) {
      ctx.fillStyle = gs.combo >= 10 ? '#ff6090' : '#ffc83c'
      ctx.textAlign = 'center'
      ctx.font = 'bold 12px monospace'
      ctx.fillText(`${gs.combo}x COMBO`, W / 2, 14)
    }

    // ── Pitch feedback bar at bottom ──
    const pitchBarY = H - 30
    const pitchBarH = 12
    ctx.fillStyle = 'rgba(20,20,30,0.7)'
    ctx.fillRect(20, pitchBarY, W - 40, pitchBarH)
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1
    ctx.strokeRect(20, pitchBarY, W - 40, pitchBarH)

    // Target zone (center)
    ctx.fillStyle = 'rgba(74,222,128,0.15)'
    ctx.fillRect(W / 2 - 30, pitchBarY, 60, pitchBarH)

    if (pitch?.isActive && cv?.alive) {
      const targetSemi = attackPhaseRef.current === 'from' ? cv.fromSemi : cv.toSemi
      const deviation = pitch.staffPosition - targetSemi
      // Map deviation to bar position (clamp to ±6 semitones)
      const clampedDev = Math.max(-6, Math.min(6, deviation))
      const barCenter = W / 2
      const barRange = (W - 40) / 2
      const dotX = barCenter + (clampedDev / 6) * barRange
      const onTarget = Math.abs(deviation) <= 1.5

      // Dot
      ctx.fillStyle = onTarget ? '#4ade80' : '#f87171'
      ctx.beginPath()
      ctx.arc(dotX, pitchBarY + pitchBarH / 2, 5, 0, Math.PI * 2)
      ctx.fill()

      // Glow
      if (onTarget) {
        ctx.fillStyle = 'rgba(74,222,128,0.3)'
        ctx.beginPath()
        ctx.arc(dotX, pitchBarY + pitchBarH / 2, 10, 0, Math.PI * 2)
        ctx.fill()
      }

      // Label
      ctx.fillStyle = onTarget ? '#4ade80' : '#f87171'
      ctx.font = 'bold 8px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(pitch.note || '', dotX, pitchBarY - 3)
    } else {
      ctx.fillStyle = '#555'
      ctx.font = '7px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('sing...', W / 2, pitchBarY + pitchBarH / 2 + 3)
    }

    // Center label
    if (cv?.alive) {
      const targetSemi = attackPhaseRef.current === 'from' ? cv.fromSemi : cv.toSemi
      const targetName = semiToName(targetSemi)
      ctx.fillStyle = '#4ade80'
      ctx.font = '7px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`target: ${targetName}`, W / 2, pitchBarY + pitchBarH + 10)
    }

    // Current prompt — bigger
    if (currentPrompt && cv?.alive) {
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 10px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(currentPrompt, W / 2, H - 50)
    }

    rafRef.current = requestAnimationFrame(gameLoop)
  }, [currentPrompt])

  // ─── Advance to Next Villager ─────────────────────────────────────────
  const advanceVillager = useCallback((gs: GameState) => {
    let nextIdx = -1
    for (let i = 0; i < gs.villagers.length; i++) {
      if (gs.villagers[i].alive) { nextIdx = i; break }
    }

    if (nextIdx < 0) {
      // Level complete — next level
      const nextLevel = gs.level + 1
      setTimeout(() => {
        spawnLevel(gs, nextLevel)
      }, 1000)
      return
    }

    gs.currentVillager = nextIdx
    attackPhaseRef.current = 'from'
    matchStartRef.current = 0
    setMatchProgress(0)

    const v = gs.villagers[nextIdx]
    if (v.guideLevel === 'full') {
      playTone(v.fromSemi, 1000)
      setTimeout(() => playTone(v.toSemi, 1000), 1200)
    } else if (v.guideLevel === 'partial') {
      playTone(v.fromSemi, 1000)
    }
    setCurrentPrompt(v.guideLevel === 'none' ? 'Listen and respond!' : `Sing: ${v.fromName}`)
  }, [spawnLevel])

  // Cleanup
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      fusionRef.current?.stop()
    }
  }, [])

  // ─── MENU ─────────────────────────────────────────────────────────────
  if (phase === 'menu') {
    return (
      <div className="fixed inset-0 bg-[#0a0812] flex flex-col items-center justify-center px-6"
        style={{ fontFamily: 'monospace' }}>
        <h1 className="text-3xl font-black text-[#4ade80] mb-1"
          style={{ textShadow: '0 0 20px rgba(74,222,128,0.4)', letterSpacing: '0.15em' }}>
          PITCHFORKS
        </h1>
        <p className="text-gray-600 text-xs mb-6 tracking-wider">SURVIVE THE VILLAGERS. SING TO DEFEND.</p>

        {/* Source selection */}
        <div className="mb-6 w-full max-w-sm">
          <div className="text-xs text-gray-600 uppercase tracking-wider mb-2">Interval Source</div>

          <div className="flex gap-2 mb-2">
            <button onClick={() => { setCustomIntervals([]); setSourceName('') }}
              className="flex-1 px-3 py-2 rounded-xl text-xs transition-all"
              style={{
                background: customIntervals.length === 0 ? 'rgba(74,222,128,0.15)' : 'rgba(20,20,30,0.6)',
                border: `1px solid ${customIntervals.length === 0 ? 'rgba(74,222,128,0.4)' : 'rgba(40,40,50,0.3)'}`,
                color: customIntervals.length === 0 ? '#4ade80' : '#666',
              }}>
              Random Intervals
              <div className="text-[10px] opacity-60">Generated by level</div>
            </button>
            <label className="flex-1 px-3 py-2 rounded-xl text-xs text-center cursor-pointer transition-all hover:bg-indigo-500/10"
              style={{
                background: customIntervals.length > 0 ? 'rgba(99,102,241,0.15)' : 'rgba(20,20,30,0.6)',
                border: `1px solid ${customIntervals.length > 0 ? 'rgba(99,102,241,0.4)' : 'rgba(40,40,50,0.3)'}`,
                color: customIntervals.length > 0 ? '#a5b4fc' : '#666',
              }}>
              {customIntervals.length > 0 ? `🎵 ${sourceName}` : 'Load MusicXML'}
              <div className="text-[10px] opacity-60">
                {customIntervals.length > 0 ? `${customIntervals.length} intervals` : 'From your piece'}
              </div>
              <input type="file" accept=".xml,.musicxml,.mxl" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleMusicXML(f); e.target.value = '' }} />
            </label>
          </div>

          {/* Sample scores */}
          <div className="flex gap-1">
            {[
              { url: '/musicxml/barnby-crossing-the-bar-satb.musicxml', label: 'Crossing the Bar' },
              { url: '/musicxml/amazing-grace-hymn.xml', label: 'Amazing Grace' },
            ].map(s => (
              <button key={s.url} onClick={() => loadSample(s.url)}
                className="flex-1 px-2 py-1 rounded text-[10px] text-gray-600 hover:text-gray-400 transition-all"
                style={{ border: '1px solid rgba(40,40,50,0.3)' }}>
                {s.label}
              </button>
            ))}
          </div>
          {loadingXML && <div className="text-xs text-indigo-400 mt-1 animate-pulse">Parsing...</div>}
        </div>

        <button onClick={() => setPhase('tutorial')}
          className="px-8 py-3 text-lg font-bold tracking-widest transition-all active:scale-95"
          style={{
            background: '#4ade80',
            color: '#0a0812',
            border: '2px solid #6ee7a0',
            boxShadow: '0 0 20px rgba(74,222,128,0.3)',
          }}>
          RISE, MONSTER
        </button>

        <a href="/pitch-defender" className="mt-8 text-xs text-gray-700 hover:text-gray-500 transition-colors tracking-wider">
          ← BACK TO PITCH DEFENDER
        </a>
      </div>
    )
  }

  // ─── TUTORIAL ──────────────────────────────────────────────────────────
  if (phase === 'tutorial') {
    return (
      <div className="fixed inset-0 bg-[#0a0812] flex flex-col items-center justify-center px-6"
        style={{ fontFamily: 'monospace' }}>
        <h2 className="text-2xl font-black text-[#4ade80] mb-4" style={{ textShadow: '0 0 15px rgba(74,222,128,0.3)' }}>
          HOW TO PLAY
        </h2>

        <div className="max-w-md space-y-4 mb-8">
          <div className="flex items-start gap-3">
            <div className="text-2xl">🧟</div>
            <div>
              <div className="text-sm text-green-300 font-bold">You are the Monster</div>
              <div className="text-xs text-gray-400">Villagers attack with musical pitchforks. Defend yourself by singing!</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="text-2xl">🔊</div>
            <div>
              <div className="text-sm text-yellow-300 font-bold">Listen to the Two Notes</div>
              <div className="text-xs text-gray-400">Each villager attacks with an interval — two notes played in sequence. Listen carefully! You can click "Replay" anytime to hear them again.</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="text-2xl">🎤</div>
            <div>
              <div className="text-sm text-purple-300 font-bold">Sing Both Notes Back</div>
              <div className="text-xs text-gray-400">First sing the starting note and hold it until the ring fills. Then sing the target note. Match the pitch to defeat the villager!</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="text-2xl">📊</div>
            <div>
              <div className="text-sm text-cyan-300 font-bold">Watch the Pitch Bar</div>
              <div className="text-xs text-gray-400">The bar at the bottom shows your current pitch. Green = on target. Keep it steady!</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="text-2xl">🐢</div>
            <div>
              <div className="text-sm text-gray-300 font-bold">Level 1 is Slow</div>
              <div className="text-xs text-gray-400">Only 3 villagers, simple steps, lots of time. Take it easy. Levels get harder gradually.</div>
            </div>
          </div>
        </div>

        <button onClick={startGame}
          className="px-10 py-4 text-lg font-bold tracking-widest transition-all active:scale-95"
          style={{
            background: '#4ade80',
            color: '#0a0812',
            border: '2px solid #6ee7a0',
            boxShadow: '0 0 20px rgba(74,222,128,0.3)',
          }}>
          START GAME
        </button>

        <button onClick={() => setPhase('menu')}
          className="mt-4 text-xs text-gray-600 hover:text-gray-400 transition-colors">
          ← Back to menu
        </button>
      </div>
    )
  }

  // ─── GAME OVER ────────────────────────────────────────────────────────
  if (phase === 'game_over') {
    const gs = stateRef.current
    return (
      <div className="fixed inset-0 bg-[#0a0812] flex flex-col items-center justify-center px-6"
        style={{ fontFamily: 'monospace' }}>
        <div className="text-4xl font-black text-red-500 mb-4 tracking-widest"
          style={{ textShadow: '0 0 20px rgba(255,60,60,0.4)' }}>
          THE VILLAGERS WIN
        </div>
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="text-center">
            <div className="text-xs text-gray-600">SCORE</div>
            <div className="text-2xl text-white font-bold">{gs?.score ?? 0}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600">LEVEL</div>
            <div className="text-2xl text-[#4ade80] font-bold">{gs?.level ?? 1}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600">DEFEATED</div>
            <div className="text-2xl text-purple-400 font-bold">{gs?.villagersDefeated ?? 0}</div>
          </div>
        </div>
        <div className="flex gap-4">
          <button onClick={startGame}
            className="px-6 py-2 text-sm font-bold tracking-widest active:scale-95 transition-all"
            style={{ background: '#4ade80', color: '#0a0812', border: '2px solid #6ee7a0' }}>
            RISE AGAIN
          </button>
          <button onClick={() => { fusionRef.current?.stop(); setPhase('menu') }}
            className="px-6 py-2 text-sm text-gray-500 border border-gray-700 tracking-wider active:scale-95 transition-all">
            MENU
          </button>
        </div>
      </div>
    )
  }

  // ─── PLAYING ──────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="w-full h-full max-w-[960px] max-h-[720px]"
        style={{ imageRendering: 'pixelated' }}
      />

      {/* Overlay: replay + match progress */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-center" style={{ fontFamily: 'monospace' }}>
        {matchProgress > 0 && (
          <div className="w-40 h-2 mx-auto rounded-full overflow-hidden mb-2" style={{ background: 'rgba(40,40,60,0.6)' }}>
            <div className="h-full rounded-full" style={{
              width: `${matchProgress * 100}%`,
              background: matchProgress >= 0.8 ? '#4ade80' : '#fbbf24',
              transition: 'width 0.1s linear',
            }} />
          </div>
        )}
        {/* Replay button — always visible during play */}
        <button onClick={() => {
          const gs = stateRef.current
          if (!gs) return
          const v = gs.villagers[gs.currentVillager]
          if (v?.alive) {
            playTone(v.fromSemi, 1000)
            setTimeout(() => playTone(v.toSemi, 1000), 1200)
          }
        }}
          className="px-4 py-2 rounded-lg text-xs font-bold text-yellow-300 border border-yellow-600 active:scale-95 transition-all hover:bg-yellow-600/20"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          🔊 REPLAY NOTES
        </button>
      </div>

      {/* Bottom buttons */}
      <div className="absolute bottom-4 flex gap-3 left-1/2 -translate-x-1/2">
        <button onClick={() => {
          if (rafRef.current) cancelAnimationFrame(rafRef.current)
          fusionRef.current?.stop()
          setPhase('menu')
        }} className="px-3 py-1 rounded text-xs text-gray-600 border border-gray-800 active:scale-95"
          style={{ fontFamily: 'monospace' }}>
          QUIT
        </button>
      </div>
    </div>
  )
}
