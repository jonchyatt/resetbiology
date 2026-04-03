'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// NoteRunner — Synesthesia Pause-Mode Staff Game
// ═══════════════════════════════════════════════════════════════════════════════
//
// Notes scroll right-to-left along the musical staff. When a note reaches the
// target zone, scrolling PAUSES until the player sings the correct pitch.
// Self-paced learning: no time pressure, just accuracy.
//
// Synesthesia colors: each note has its unique color identity.
// Difficulty layers control how much help the player gets.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useEffect } from 'react'
import { PitchFusion, type FusedPitch, DEFAULT_FUSION_CONFIG } from './pitchFusion'
import { computeLayout, renderStaff, drawTargetNote, drawVoiceOrb, drawCentsIndicator, drawNoteHeadWithStem, staffPositionToY, type TrailPoint, type StaffLayout } from './staffRenderer'
import { NOTE_COLORS } from '@/lib/fsrs'
import { initAudio, playPianoNote } from './audioEngine'

// ─── Types ──────────────────────────────────────────────────────────────────

type Difficulty = 'easy' | 'medium' | 'hard'

interface GameNote {
  id: number
  semitones: number    // from C4
  name: string
  scrollX: number      // 0 = left edge, 1 = right edge (normalized)
  state: 'scrolling' | 'waiting' | 'matched' | 'cleared'
  matchProgress: number // 0-1, how long the player has held the correct pitch
}

interface RunnerState {
  phase: 'menu' | 'playing' | 'complete'
  notes: GameNote[]
  currentIdx: number
  score: number
  streak: number
  maxStreak: number
  notesHit: number
  totalNotes: number
}

// ─── Song Data ──────────────────────────────────────────────────────────────

const SONGS: { name: string; notes: number[]; description: string }[] = [
  { name: 'C Major Scale', notes: [0, 2, 4, 5, 7, 9, 11, 12], description: 'The foundation — ascending C major' },
  { name: 'C Major Descending', notes: [12, 11, 9, 7, 5, 4, 2, 0], description: 'Come back down' },
  { name: 'Ode to Joy', notes: [4, 4, 5, 7, 7, 5, 4, 2, 0, 0, 2, 4, 4, 2, 2], description: 'Beethoven\'s 9th — simple melody' },
  { name: 'Twinkle Twinkle', notes: [0, 0, 7, 7, 9, 9, 7, 5, 5, 4, 4, 2, 2, 0], description: 'The classic' },
  { name: 'Interval Jumps', notes: [0, 4, 0, 7, 0, 12, 12, 7, 12, 4, 12, 0], description: 'Practice leaping between intervals' },
  { name: 'Chromatic Climb', notes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], description: 'Every semitone — the ultimate test' },
  { name: 'Pentatonic', notes: [0, 2, 4, 7, 9, 12, 9, 7, 4, 2, 0], description: 'The scale that always sounds good' },
  { name: 'Mary Had a Little Lamb', notes: [4, 2, 0, 2, 4, 4, 4, 2, 2, 2, 4, 7, 7], description: 'Simple and familiar' },
]

const NOTE_NAMES_ALL = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

function semiToName(semi: number): string {
  const idx = ((Math.round(semi) % 12) + 12) % 12
  const oct = 4 + Math.floor(semi / 12)
  return `${NOTE_NAMES_ALL[idx]}${oct}`
}

function semiToFreq(semi: number): number {
  return 261.63 * Math.pow(2, semi / 12)
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function NoteRunner() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fusionRef = useRef<PitchFusion | null>(null)
  const stateRef = useRef<RunnerState>({
    phase: 'menu', notes: [], currentIdx: 0,
    score: 0, streak: 0, maxStreak: 0, notesHit: 0, totalNotes: 0,
  })
  const pitchRef = useRef<FusedPitch | null>(null)
  const trailRef = useRef<TrailPoint[]>([])
  const layoutRef = useRef<StaffLayout | null>(null)
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef(0)

  const [phase, setPhase] = useState<'menu' | 'playing' | 'complete'>('menu')
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [selectedSong, setSelectedSong] = useState(0)
  const [displayState, setDisplayState] = useState({ score: 0, streak: 0, notesHit: 0, totalNotes: 0 })
  const [currentNoteName, setCurrentNoteName] = useState('')
  const [matchProgress, setMatchProgress] = useState(0)

  // Difficulty settings
  const HOLD_DURATION: Record<Difficulty, number> = { easy: 400, medium: 600, hard: 800 }
  const TOLERANCE: Record<Difficulty, number> = { easy: 1.5, medium: 1.0, hard: 0.6 } // semitones
  const SCROLL_SPEED: Record<Difficulty, number> = { easy: 0.08, medium: 0.12, hard: 0.15 } // per second

  // ─── Canvas Setup ───────────────────────────────────────────────────────
  const updateLayout = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.scale(dpr, dpr)
    layoutRef.current = computeLayout(rect.width, rect.height)
  }, [])

  useEffect(() => {
    updateLayout()
    window.addEventListener('resize', updateLayout)
    return () => window.removeEventListener('resize', updateLayout)
  }, [updateLayout])

  // ─── Start Game ─────────────────────────────────────────────────────────
  const startGame = useCallback(async () => {
    const song = SONGS[selectedSong]
    initAudio()

    // Build note objects
    const notes: GameNote[] = song.notes.map((semi, i) => ({
      id: i,
      semitones: semi,
      name: semiToName(semi),
      scrollX: 1.0 + i * 0.15, // stagger start positions
      state: i === 0 ? 'scrolling' : 'scrolling',
      matchProgress: 0,
    }))

    stateRef.current = {
      phase: 'playing',
      notes,
      currentIdx: 0,
      score: 0, streak: 0, maxStreak: 0,
      notesHit: 0, totalNotes: notes.length,
    }

    setPhase('playing')
    setDisplayState({ score: 0, streak: 0, notesHit: 0, totalNotes: notes.length })

    // Start fusion engine (ML enabled, no Star Nest competition)
    const fusion = new PitchFusion({ enableML: true, noiseGateDb: -45 })
    fusionRef.current = fusion
    await fusion.start((pitch) => {
      pitchRef.current = pitch
      if (pitch.isActive) {
        trailRef.current.push({
          staffPosition: pitch.staffPosition,
          confidence: pitch.confidence,
          timestamp: performance.now(),
        })
        if (trailRef.current.length > 200) trailRef.current.shift()
      }
    })

    lastTimeRef.current = performance.now()
    gameLoop()
  }, [selectedSong, difficulty])

  // ─── Game Loop ──────────────────────────────────────────────────────────
  const gameLoop = useCallback(() => {
    const now = performance.now()
    const dt = (now - lastTimeRef.current) / 1000
    lastTimeRef.current = now

    const s = stateRef.current
    if (s.phase !== 'playing') return

    const canvas = canvasRef.current
    const layout = layoutRef.current
    if (!canvas || !layout) { rafRef.current = requestAnimationFrame(gameLoop); return }
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const pitch = pitchRef.current
    const currentNote = s.notes[s.currentIdx]
    const targetZoneX = 0.2 // normalized X where notes "arrive" (20% from left)

    // ── Update note positions ──
    let paused = false

    for (const note of s.notes) {
      if (note.state === 'cleared') continue

      if (note.state === 'scrolling') {
        note.scrollX -= SCROLL_SPEED[difficulty] * dt

        // Note reached target zone → PAUSE
        if (note.scrollX <= targetZoneX && note === currentNote) {
          note.scrollX = targetZoneX
          note.state = 'waiting'
          paused = true

          // Play reference tone on easy difficulty
          if (difficulty === 'easy') {
            const noteName = semiToName(note.semitones)
            // Only play natural notes that exist in our piano samples
            if (!noteName.includes('#')) {
              playPianoNote(noteName)
            }
          }
        }
      }

      if (note.state === 'waiting') {
        paused = true
        setCurrentNoteName(note.name)

        // Check if player is singing the right pitch
        if (pitch?.isActive && pitch.isSettled) {
          const deviation = Math.abs(pitch.staffPosition - note.semitones)
          if (deviation <= TOLERANCE[difficulty]) {
            // Correct pitch — accumulate match progress
            note.matchProgress += dt * 1000
            setMatchProgress(Math.min(1, note.matchProgress / HOLD_DURATION[difficulty]))

            if (note.matchProgress >= HOLD_DURATION[difficulty]) {
              // NOTE MATCHED!
              note.state = 'matched'
              s.notesHit++
              s.streak++
              s.maxStreak = Math.max(s.maxStreak, s.streak)
              s.score += Math.round(100 * (1 + s.streak * 0.1))
              s.currentIdx++
              setMatchProgress(0)
              setDisplayState({ score: s.score, streak: s.streak, notesHit: s.notesHit, totalNotes: s.totalNotes })

              // Clear after brief celebration
              setTimeout(() => { note.state = 'cleared' }, 300)

              // Check song complete
              if (s.currentIdx >= s.notes.length) {
                s.phase = 'complete'
                setPhase('complete')
                fusionRef.current?.stop()
              }
            }
          } else {
            // Wrong pitch — decay progress
            note.matchProgress = Math.max(0, note.matchProgress - dt * 500)
            setMatchProgress(Math.max(0, note.matchProgress / HOLD_DURATION[difficulty]))
          }
        } else {
          // Not singing — slow decay
          note.matchProgress = Math.max(0, note.matchProgress - dt * 200)
          setMatchProgress(Math.max(0, note.matchProgress / HOLD_DURATION[difficulty]))
        }
      }
    }

    // ── Render ──
    const trail = trailRef.current
    const trailNow = Date.now()
    while (trail.length > 0 && trailNow - trail[0].timestamp > 3000) trail.shift()

    // Draw background + staff
    renderStaff(ctx, layout, {
      voiceActive: pitch?.isActive ?? false,
      staffPosition: pitch?.staffPosition ?? 0,
      confidence: pitch?.confidence ?? 0,
      cents: pitch?.cents ?? 0,
      isSettled: pitch?.isSettled ?? false,
      isVibrato: pitch?.isVibrato ?? false,
      trail,
    })

    // Draw scrolling notes
    const staffX = layout.staffX
    const staffW = layout.staffRight - layout.staffX

    for (const note of s.notes) {
      if (note.state === 'cleared') continue

      const noteX = staffX + note.scrollX * staffW
      const noteY = staffPositionToY(note.semitones, layout)
      const noteColor = NOTE_COLORS[note.name]
      const hue = noteColor?.hue ?? 0
      const isWaiting = note.state === 'waiting'
      const isMatched = note.state === 'matched'

      // Note head (proper musical notation shape)
      const noteScale = isWaiting ? 1.2 : 0.9
      const alpha = isMatched ? 0.3 : note.state === 'waiting' ? 1 : 0.7
      const noteRx = layout.noteHeadRx * noteScale
      const noteRy = layout.noteHeadRy * noteScale

      // Glow
      if (isWaiting || isMatched) {
        const glowR = Math.max(noteRx, noteRy) * 3.5
        const glow = ctx.createRadialGradient(noteX, noteY, 0, noteX, noteY, glowR)
        glow.addColorStop(0, `hsla(${hue}, 80%, 60%, ${0.3 * alpha})`)
        glow.addColorStop(1, 'hsla(0, 0%, 0%, 0)')
        ctx.fillStyle = glow
        ctx.fillRect(noteX - glowR, noteY - glowR, glowR * 2, glowR * 2)
      }

      // Note head with stem
      const fillColor = isMatched
        ? `hsla(120, 80%, 60%, 0.8)`
        : `hsla(${hue}, 80%, 55%, ${alpha})`
      const strokeColor = `hsla(${hue}, 70%, 70%, ${alpha * 0.8})`
      drawNoteHeadWithStem(ctx, noteX, noteY, layout, fillColor, strokeColor, {
        filled: true,
        showStem: !isMatched,
        scale: noteScale,
        alpha: 1,  // alpha already encoded in color strings
      })

      // Match progress ring
      if (isWaiting && note.matchProgress > 0) {
        const progress = note.matchProgress / HOLD_DURATION[difficulty]
        const ringR = Math.max(noteRx, noteRy) + 5
        ctx.strokeStyle = `hsla(120, 80%, 60%, ${0.8 * progress})`
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(noteX, noteY, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress)
        ctx.stroke()
      }

      // Note name label (easy + medium difficulty)
      if (difficulty !== 'hard') {
        ctx.font = 'bold 11px monospace'
        ctx.fillStyle = `hsla(${hue}, 70%, 85%, ${alpha * 0.9})`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillText(note.name, noteX, noteY + noteRy + 6)
      }
    }

    // Target zone indicator (vertical line where notes pause)
    const tzX = staffX + targetZoneX * staffW
    ctx.strokeStyle = 'rgba(100, 200, 255, 0.15)'
    ctx.lineWidth = 2
    ctx.setLineDash([8, 6])
    ctx.beginPath()
    ctx.moveTo(tzX, layout.trebleLines[0] - 20)
    ctx.lineTo(tzX, layout.bassLines[4] + 20)
    ctx.stroke()
    ctx.setLineDash([])

    // Voice orb (drawn last, on top)
    if (pitch?.isActive) {
      drawVoiceOrb(ctx, layout, pitch.staffPosition, pitch.confidence, pitch.isSettled, pitch.isVibrato)
      drawCentsIndicator(ctx, layout, pitch.cents, pitch.confidence)
    }

    rafRef.current = requestAnimationFrame(gameLoop)
  }, [difficulty])

  // Cleanup
  useEffect(() => () => {
    fusionRef.current?.stop()
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }, [])

  // ─── Menu ───────────────────────────────────────────────────────────────
  if (phase === 'menu') {
    return (
      <div className="fixed inset-0 bg-[#08080f] flex flex-col items-center justify-center px-6">
        <h1 className="text-4xl font-black text-white mb-2" style={{ textShadow: '0 0 40px rgba(139,92,246,0.3)' }}>
          NOTE RUNNER
        </h1>
        <p className="text-gray-400 mb-8">Sing the notes as they scroll across the staff</p>

        {/* Song selector */}
        <div className="w-full max-w-md mb-6">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Choose a Song</div>
          <div className="space-y-1.5">
            {SONGS.map((song, i) => (
              <button
                key={i}
                onClick={() => setSelectedSong(i)}
                className="w-full text-left px-4 py-2.5 rounded-xl transition-all"
                style={{
                  background: selectedSong === i ? 'rgba(139,92,246,0.15)' : 'rgba(20,20,35,0.6)',
                  border: `1px solid ${selectedSong === i ? 'rgba(139,92,246,0.4)' : 'rgba(40,40,60,0.3)'}`,
                }}
              >
                <div className="font-medium" style={{ color: selectedSong === i ? '#c4b5fd' : '#aaa' }}>
                  {song.name}
                </div>
                <div className="text-xs" style={{ color: selectedSong === i ? '#8b8b9e' : '#555' }}>
                  {song.description} · {song.notes.length} notes
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty */}
        <div className="flex gap-3 mb-8">
          {(['easy', 'medium', 'hard'] as const).map(d => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className="px-5 py-2 rounded-xl text-sm font-medium capitalize transition-all"
              style={{
                background: difficulty === d ? 'rgba(63,191,181,0.15)' : 'rgba(40,40,60,0.4)',
                border: `2px solid ${difficulty === d ? '#3FBFB5' : 'rgba(60,60,80,0.3)'}`,
                color: difficulty === d ? '#3FBFB5' : '#888',
              }}
            >
              {d}
              <div className="text-xs opacity-60 mt-0.5">
                {d === 'easy' ? 'Name + sound' : d === 'medium' ? 'Name only' : 'Staff only'}
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={startGame}
          className="px-10 py-4 rounded-2xl text-xl font-bold text-white transition-all active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
            boxShadow: '0 0 30px rgba(139,92,246,0.3), 0 4px 20px rgba(0,0,0,0.4)',
          }}
        >
          START
        </button>

        <a href="/pitch-defender" className="mt-6 text-xs text-gray-600 hover:text-gray-400 transition-colors">
          ← Back to Pitch Defender
        </a>
      </div>
    )
  }

  // ─── Complete ───────────────────────────────────────────────────────────
  if (phase === 'complete') {
    const accuracy = displayState.totalNotes > 0 ? Math.round((displayState.notesHit / displayState.totalNotes) * 100) : 0
    return (
      <div className="fixed inset-0 bg-[#08080f] flex flex-col items-center justify-center px-6">
        <div className="text-5xl font-black text-white mb-4" style={{ textShadow: '0 0 30px rgba(100,255,160,0.3)' }}>
          {accuracy === 100 ? 'PERFECT!' : accuracy >= 80 ? 'GREAT!' : 'COMPLETE'}
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-8">
          <div className="text-center">
            <div className="text-xs text-gray-500">SCORE</div>
            <div className="text-2xl font-bold text-white">{displayState.score}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">ACCURACY</div>
            <div className="text-2xl font-bold" style={{ color: accuracy >= 80 ? '#64ffa0' : '#ffc83c' }}>{accuracy}%</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">BEST STREAK</div>
            <div className="text-2xl font-bold text-purple-400">{stateRef.current.maxStreak}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">SONG</div>
            <div className="text-lg font-medium text-gray-300">{SONGS[selectedSong].name}</div>
          </div>
        </div>
        <div className="flex gap-4">
          <button onClick={startGame} className="px-8 py-3 rounded-xl font-bold text-white bg-purple-600 active:scale-95 transition-all">
            PLAY AGAIN
          </button>
          <button onClick={() => setPhase('menu')} className="px-6 py-3 rounded-xl font-medium text-gray-400 border border-gray-700 active:scale-95 transition-all">
            MENU
          </button>
        </div>
      </div>
    )
  }

  // ─── Playing ────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-[#08080f]">
      <canvas ref={canvasRef} className="w-full h-full" style={{ display: 'block' }} />

      {/* HUD */}
      <div className="absolute top-3 left-4 text-white">
        <div className="text-2xl font-bold tabular-nums">{displayState.score}</div>
        {displayState.streak >= 3 && (
          <div className="text-sm font-bold" style={{ color: displayState.streak >= 10 ? '#ff6090' : '#ffc83c' }}>
            {displayState.streak} streak
          </div>
        )}
      </div>

      <div className="absolute top-3 right-4 text-right">
        <div className="text-xs text-gray-500">{SONGS[selectedSong].name}</div>
        <div className="text-sm text-gray-400">{displayState.notesHit} / {displayState.totalNotes}</div>
      </div>

      {/* Current note prompt */}
      {currentNoteName && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-center">
          <div className="text-lg text-gray-400">Sing</div>
          <div className="text-4xl font-black text-white" style={{ textShadow: '0 0 20px rgba(139,92,246,0.4)' }}>
            {currentNoteName}
          </div>
          {/* Match progress bar */}
          {matchProgress > 0 && (
            <div className="w-32 h-2 mt-2 mx-auto rounded-full overflow-hidden" style={{ background: 'rgba(40,40,60,0.6)' }}>
              <div className="h-full rounded-full transition-all" style={{
                width: `${matchProgress * 100}%`,
                background: matchProgress >= 0.8 ? '#64ffa0' : '#8b5cf6',
                boxShadow: `0 0 8px ${matchProgress >= 0.8 ? '#64ffa0' : '#8b5cf6'}`,
              }} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
