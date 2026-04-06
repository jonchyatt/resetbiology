'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// SightReading — Cold-Read Audition Trainer
// ═══════════════════════════════════════════════════════════════════════════════
//
// Generates random melodic phrases in choir-appropriate keys/ranges.
// Shows on a staff → gives starting pitch → singer reads and sings →
// real-time pitch tracking scores each note. Progressive difficulty.
//
// Designed for the sight-reading portion of a choir audition:
// - Short phrases (4–8 measures)
// - Common keys (C, G, F, D, Bb major)
// - Voice-appropriate ranges (SATB)
// - Stepwise → skips → leaps progression
// - Pause-until-correct for learning, flow for testing
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useEffect } from 'react'
import { NOTE_COLORS } from '@/lib/fsrs'
import { PitchFusion, type FusedPitch } from './pitchFusion'
import { initAudio, playPianoNote } from './audioEngine'
import { computeLayout, renderStaff, drawNoteHeadWithStem, staffPositionToY, type StaffLayout } from './staffRenderer'

// ─── Types ──────────────────────────────────────────────────────────────────

type Voice = 'soprano' | 'alto' | 'tenor' | 'bass'
type Difficulty = 'easy' | 'medium' | 'hard'
type Phase = 'menu' | 'ready' | 'singing' | 'results'

interface PhraseNote {
  semitones: number   // from C4
  name: string        // e.g. "D4"
  state: 'upcoming' | 'active' | 'hit' | 'miss' | 'skipped'
  matchProgress: number
}

// Voice ranges (semitones from C4)
const VOICE_RANGES: Record<Voice, { low: number; high: number; clef: 'treble' | 'bass' }> = {
  soprano: { low: 0, high: 19, clef: 'treble' },   // C4 – G5
  alto:    { low: -7, high: 12, clef: 'treble' },   // F3 – C5
  tenor:   { low: -12, high: 7, clef: 'bass' },     // C3 – G4
  bass:    { low: -19, high: 0, clef: 'bass' },      // F2 – C4
}

// Key signatures — scale degrees as semitone intervals from root
const KEYS: Record<string, { root: number; name: string; scale: number[] }> = {
  'C':  { root: 0,  name: 'C Major',  scale: [0, 2, 4, 5, 7, 9, 11] },
  'G':  { root: 7,  name: 'G Major',  scale: [0, 2, 4, 5, 7, 9, 11] },
  'F':  { root: 5,  name: 'F Major',  scale: [0, 2, 4, 5, 7, 9, 11] },
  'D':  { root: 2,  name: 'D Major',  scale: [0, 2, 4, 5, 7, 9, 11] },
  'Bb': { root: -2, name: 'Bb Major', scale: [0, 2, 4, 5, 7, 9, 11] },
}

const NOTE_NAMES_ALL = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

function semiToName(semi: number): string {
  const idx = ((Math.round(semi) % 12) + 12) % 12
  const oct = 4 + Math.floor(semi / 12)
  return `${NOTE_NAMES_ALL[idx]}${oct}`
}

function semiToFreq(semi: number): number {
  return 261.63 * Math.pow(2, semi / 12)
}

// ─── Phrase Generator ───────────────────────────────────────────────────────

function generatePhrase(
  voice: Voice,
  keyName: string,
  difficulty: Difficulty,
  length: number,
): PhraseNote[] {
  const range = VOICE_RANGES[voice]
  const key = KEYS[keyName]

  // Build available scale tones within voice range
  const available: number[] = []
  for (let octOffset = -3; octOffset <= 3; octOffset++) {
    for (const degree of key.scale) {
      const semi = key.root + degree + octOffset * 12
      if (semi >= range.low && semi <= range.high) {
        available.push(semi)
      }
    }
  }
  available.sort((a, b) => a - b)

  if (available.length < 3) return []

  // Start near middle of range
  const midRange = (range.low + range.high) / 2
  let currentIdx = available.reduce((best, s, i) =>
    Math.abs(s - midRange) < Math.abs(available[best] - midRange) ? i : best, 0)

  const notes: PhraseNote[] = []

  // Max interval jump based on difficulty
  const maxStep = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 4

  for (let i = 0; i < length; i++) {
    notes.push({
      semitones: available[currentIdx],
      name: semiToName(available[currentIdx]),
      state: 'upcoming',
      matchProgress: 0,
    })

    // Generate next note
    const direction = Math.random() < 0.5 ? -1 : 1
    let step = Math.floor(Math.random() * maxStep) + 1

    // Bias toward stepwise motion
    if (difficulty === 'easy' && Math.random() < 0.7) step = 1
    if (difficulty === 'medium' && Math.random() < 0.5) step = 1

    let nextIdx = currentIdx + direction * step
    nextIdx = Math.max(0, Math.min(available.length - 1, nextIdx))

    // Avoid staying on same note too much
    if (nextIdx === currentIdx && available.length > 1) {
      nextIdx = currentIdx + (currentIdx > 0 ? -1 : 1)
    }

    currentIdx = nextIdx
  }

  return notes
}

// ─── Guide Audio ────────────────────────────────────────────────────────────

let _sightCtx: AudioContext | null = null
function playTone(semi: number, durationMs: number) {
  if (!_sightCtx) _sightCtx = new AudioContext()
  const ctx = _sightCtx
  if (ctx.state === 'suspended') ctx.resume()
  const now = ctx.currentTime
  const freq = semiToFreq(semi)
  const dur = durationMs / 1000

  const osc = ctx.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(freq, now)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.15, now + 0.02)
  gain.gain.setValueAtTime(0.12, now + dur * 0.7)
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur)

  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + dur)
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function SightReading() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [phase, setPhase] = useState<Phase>('menu')
  const [voice, setVoice] = useState<Voice>('soprano')
  const [keyName, setKeyName] = useState('C')
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [phraseLength, setPhraseLength] = useState(8)
  const [mode, setMode] = useState<'pause' | 'flow'>('pause')

  const [phrase, setPhrase] = useState<PhraseNote[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [matchProgress, setMatchProgress] = useState(0)
  const [stats, setStats] = useState({ hit: 0, miss: 0, total: 0, streak: 0, maxStreak: 0 })

  // Refs
  const fusionRef = useRef<PitchFusion | null>(null)
  const pitchRef = useRef<FusedPitch | null>(null)
  const rafRef = useRef(0)
  const lastTimeRef = useRef(0)
  const matchStartRef = useRef(0)
  const flowTimerRef = useRef(0)
  const phraseRef = useRef<PhraseNote[]>([])
  const currentIdxRef = useRef(0)
  const layoutRef = useRef<StaffLayout | null>(null)
  const statsRef = useRef(stats)

  useEffect(() => { phraseRef.current = phrase }, [phrase])
  useEffect(() => { currentIdxRef.current = currentIdx }, [currentIdx])
  useEffect(() => { statsRef.current = stats }, [stats])

  // Canvas layout
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

  // ─── Generate + Show Phrase ───────────────────────────────────────────
  const generateNewPhrase = useCallback(() => {
    const p = generatePhrase(voice, keyName, difficulty, phraseLength)
    setPhrase(p)
    phraseRef.current = p
    setCurrentIdx(0)
    currentIdxRef.current = 0
    setMatchProgress(0)
    setStats({ hit: 0, miss: 0, total: p.length, streak: 0, maxStreak: 0 })
    setPhase('ready')
  }, [voice, keyName, difficulty, phraseLength])

  // ─── Start Singing ────────────────────────────────────────────────────
  const startSinging = useCallback(async () => {
    initAudio()

    // Play the starting note as reference
    const first = phraseRef.current[0]
    if (first) {
      playTone(first.semitones, 1500)
      // Also play via piano for familiarity
      const name = first.name
      if (!name.includes('#') && !name.includes('b')) {
        playPianoNote(name)
      }
    }

    // Start pitch detection
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const fusion = new PitchFusion({ enableML: true, noiseGateDb: -45 })
    fusionRef.current = fusion
    await fusion.start(p => { pitchRef.current = p })

    // Mark first note active
    setPhrase(prev => prev.map((n, i) => ({ ...n, state: i === 0 ? 'active' : 'upcoming' })))
    matchStartRef.current = 0
    flowTimerRef.current = 0

    setPhase('singing')
    lastTimeRef.current = performance.now()
    singingLoop()
  }, [])

  // ─── Singing Loop ─────────────────────────────────────────────────────
  const singingLoop = useCallback(() => {
    const now = performance.now()
    const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05)
    lastTimeRef.current = now

    const notes = phraseRef.current
    const idx = currentIdxRef.current
    if (idx >= notes.length) {
      fusionRef.current?.stop()
      setPhase('results')
      return
    }

    const target = notes[idx]
    const pitch = pitchRef.current

    if (mode === 'pause') {
      if (pitch?.isActive && pitch.isSettled) {
        const deviation = Math.abs(pitch.staffPosition - target.semitones)
        if (deviation <= 1.5) {
          if (matchStartRef.current === 0) matchStartRef.current = performance.now()
          const held = performance.now() - matchStartRef.current
          const progress = Math.min(1, held / 500) // 500ms hold
          setMatchProgress(progress)
          if (progress >= 1) {
            advanceNote(true)
          }
        } else {
          matchStartRef.current = 0
          setMatchProgress(prev => Math.max(0, prev - dt * 3))
        }
      } else {
        matchStartRef.current = 0
        setMatchProgress(prev => Math.max(0, prev - dt * 2))
      }
    } else {
      // Flow mode — 2 seconds per note
      flowTimerRef.current += dt * 1000
      if (pitch?.isActive && pitch.isSettled) {
        const deviation = Math.abs(pitch.staffPosition - target.semitones)
        if (deviation <= 1.5) {
          setMatchProgress(prev => Math.min(1, prev + dt * 4))
        }
      }
      if (flowTimerRef.current >= 2000) {
        advanceNote(matchProgress >= 0.4)
      }
    }

    // Render staff + notes
    renderFrame()

    rafRef.current = requestAnimationFrame(singingLoop)
  }, [mode])

  // ─── Advance Note ─────────────────────────────────────────────────────
  const advanceNote = useCallback((hit: boolean) => {
    const idx = currentIdxRef.current
    const notes = phraseRef.current

    // Update note state
    notes[idx].state = hit ? 'hit' : 'miss'
    setPhrase([...notes])

    // Stats
    setStats(prev => {
      const newStreak = hit ? prev.streak + 1 : 0
      const updated = {
        ...prev,
        hit: prev.hit + (hit ? 1 : 0),
        miss: prev.miss + (hit ? 0 : 1),
        streak: newStreak,
        maxStreak: Math.max(prev.maxStreak, newStreak),
      }
      statsRef.current = updated
      return updated
    })

    const nextIdx = idx + 1
    if (nextIdx >= notes.length) {
      currentIdxRef.current = nextIdx
      setCurrentIdx(nextIdx)
      return
    }

    // Activate next
    notes[nextIdx].state = 'active'
    setPhrase([...notes])
    currentIdxRef.current = nextIdx
    setCurrentIdx(nextIdx)
    setMatchProgress(0)
    matchStartRef.current = 0
    flowTimerRef.current = 0

    // Play hint on easy difficulty
    if (difficulty === 'easy') {
      playTone(notes[nextIdx].semitones, 400)
    }
  }, [difficulty])

  // ─── Render Frame (staff + notes) ─────────────────────────────────────
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current
    const layout = layoutRef.current
    if (!canvas || !layout) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const pitch = pitchRef.current
    const notes = phraseRef.current

    // Draw staff
    renderStaff(ctx, layout, {
      voiceActive: pitch?.isActive ?? false,
      staffPosition: pitch?.staffPosition ?? 0,
      confidence: pitch?.confidence ?? 0,
      cents: pitch?.cents ?? 0,
      isSettled: pitch?.isSettled ?? false,
      isVibrato: pitch?.isVibrato ?? false,
      trail: [],
    })

    // Draw notes
    const staffX = layout.staffX
    const staffW = layout.staffRight - layout.staffX
    const noteSpacing = staffW / (notes.length + 1)

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i]
      const x = staffX + noteSpacing * (i + 1)
      const y = staffPositionToY(note.semitones, layout)
      const hue = NOTE_COLORS[note.name]?.hue ?? 200
      const isActive = note.state === 'active'

      let fillColor: string
      let strokeColor: string
      let alpha = 1

      switch (note.state) {
        case 'hit':
          fillColor = 'hsla(140, 80%, 50%, 0.9)'
          strokeColor = 'hsla(140, 60%, 70%, 0.8)'
          break
        case 'miss':
          fillColor = 'hsla(0, 70%, 50%, 0.7)'
          strokeColor = 'hsla(0, 50%, 60%, 0.6)'
          break
        case 'active':
          fillColor = `hsla(${hue}, 80%, 55%, 1)`
          strokeColor = `hsla(${hue}, 70%, 70%, 0.9)`
          break
        default: // upcoming
          fillColor = `hsla(${hue}, 40%, 40%, 0.5)`
          strokeColor = `hsla(${hue}, 30%, 50%, 0.4)`
          alpha = 0.6
      }

      // Glow for active note
      if (isActive) {
        const glowR = layout.noteHeadRx * 3
        const glow = ctx.createRadialGradient(x, y, 0, x, y, glowR)
        glow.addColorStop(0, `hsla(${hue}, 80%, 60%, 0.35)`)
        glow.addColorStop(1, 'hsla(0, 0%, 0%, 0)')
        ctx.fillStyle = glow
        ctx.fillRect(x - glowR, y - glowR, glowR * 2, glowR * 2)

        // Match progress ring
        if (matchProgress > 0) {
          const ringR = layout.noteHeadRx + 6
          ctx.strokeStyle = `hsla(140, 80%, 55%, ${0.8 * matchProgress})`
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.arc(x, y, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * matchProgress)
          ctx.stroke()
        }
      }

      drawNoteHeadWithStem(ctx, x, y, layout, fillColor, strokeColor, {
        filled: true,
        showStem: true,
        scale: isActive ? 1.2 : 0.9,
        alpha,
      })

      // Note name (easy + medium)
      if (difficulty !== 'hard' && (note.state === 'active' || note.state === 'hit')) {
        ctx.font = 'bold 11px monospace'
        ctx.fillStyle = `hsla(${hue}, 60%, 75%, ${alpha})`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillText(note.name, x, y + layout.noteHeadRy + 8)
      }
    }
  }, [difficulty, matchProgress])

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
      <div className="fixed inset-0 bg-[#08080f] flex flex-col items-center justify-center px-6">
        <h1 className="text-3xl font-black text-white mb-1" style={{ textShadow: '0 0 30px rgba(234,179,8,0.3)' }}>
          SIGHT READING
        </h1>
        <p className="text-gray-500 text-sm mb-6">Random phrases. Cold read. Nail the audition.</p>

        {/* Voice selector */}
        <div className="mb-4 w-full max-w-sm">
          <div className="text-xs text-gray-600 uppercase tracking-wider mb-2">Voice</div>
          <div className="grid grid-cols-4 gap-2">
            {(['soprano', 'alto', 'tenor', 'bass'] as Voice[]).map(v => (
              <button key={v} onClick={() => setVoice(v)}
                className="px-3 py-2 rounded-xl text-sm font-medium capitalize transition-all"
                style={{
                  background: voice === v ? 'rgba(234,179,8,0.15)' : 'rgba(20,20,35,0.6)',
                  border: `2px solid ${voice === v ? 'rgba(234,179,8,0.4)' : 'rgba(40,40,60,0.3)'}`,
                  color: voice === v ? '#fbbf24' : '#888',
                }}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Key */}
        <div className="mb-4 w-full max-w-sm">
          <div className="text-xs text-gray-600 uppercase tracking-wider mb-2">Key</div>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(KEYS).map(([k, v]) => (
              <button key={k} onClick={() => setKeyName(k)}
                className="px-3 py-1.5 rounded-lg text-sm transition-all"
                style={{
                  background: keyName === k ? 'rgba(234,179,8,0.15)' : 'transparent',
                  border: `1px solid ${keyName === k ? 'rgba(234,179,8,0.4)' : 'rgba(40,40,60,0.3)'}`,
                  color: keyName === k ? '#fbbf24' : '#666',
                }}>
                {v.name}
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty */}
        <div className="mb-4 w-full max-w-sm">
          <div className="text-xs text-gray-600 uppercase tracking-wider mb-2">Difficulty</div>
          <div className="flex gap-2">
            {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
              <button key={d} onClick={() => setDifficulty(d)}
                className="flex-1 px-3 py-2 rounded-xl text-sm font-medium capitalize transition-all"
                style={{
                  background: difficulty === d ? 'rgba(234,179,8,0.15)' : 'rgba(20,20,35,0.6)',
                  border: `2px solid ${difficulty === d ? 'rgba(234,179,8,0.4)' : 'rgba(40,40,60,0.3)'}`,
                  color: difficulty === d ? '#fbbf24' : '#888',
                }}>
                {d}
                <div className="text-[10px] opacity-60 mt-0.5">
                  {d === 'easy' ? 'Steps + hints' : d === 'medium' ? 'Steps + skips' : 'Leaps, no hints'}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Phrase length + mode */}
        <div className="mb-6 w-full max-w-sm flex gap-4">
          <div className="flex-1">
            <div className="text-xs text-gray-600 mb-1">Notes</div>
            <div className="flex gap-1">
              {[6, 8, 12, 16].map(n => (
                <button key={n} onClick={() => setPhraseLength(n)}
                  className="flex-1 px-2 py-1 rounded text-xs transition-all"
                  style={{
                    background: phraseLength === n ? 'rgba(234,179,8,0.15)' : 'transparent',
                    border: `1px solid ${phraseLength === n ? 'rgba(234,179,8,0.3)' : 'rgba(40,40,60,0.3)'}`,
                    color: phraseLength === n ? '#fbbf24' : '#666',
                  }}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1">
            <div className="text-xs text-gray-600 mb-1">Mode</div>
            <div className="flex gap-1">
              <button onClick={() => setMode('pause')}
                className="flex-1 px-2 py-1 rounded text-xs transition-all"
                style={{
                  background: mode === 'pause' ? 'rgba(34,197,94,0.15)' : 'transparent',
                  border: `1px solid ${mode === 'pause' ? 'rgba(34,197,94,0.3)' : 'rgba(40,40,60,0.3)'}`,
                  color: mode === 'pause' ? '#4ade80' : '#666',
                }}>
                Pause
              </button>
              <button onClick={() => setMode('flow')}
                className="flex-1 px-2 py-1 rounded text-xs transition-all"
                style={{
                  background: mode === 'flow' ? 'rgba(234,179,8,0.15)' : 'transparent',
                  border: `1px solid ${mode === 'flow' ? 'rgba(234,179,8,0.3)' : 'rgba(40,40,60,0.3)'}`,
                  color: mode === 'flow' ? '#fbbf24' : '#666',
                }}>
                Flow
              </button>
            </div>
          </div>
        </div>

        <button onClick={generateNewPhrase}
          className="px-10 py-4 rounded-2xl text-xl font-bold text-white transition-all active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #eab308, #b45309)',
            boxShadow: '0 0 30px rgba(234,179,8,0.3), 0 4px 20px rgba(0,0,0,0.4)',
          }}>
          GENERATE PHRASE
        </button>

        <a href="/pitch-defender" className="mt-8 text-xs text-gray-600 hover:text-gray-400 transition-colors">
          ← Back to Pitch Defender
        </a>
      </div>
    )
  }

  // ─── READY (phrase generated, about to sing) ──────────────────────────
  if (phase === 'ready') {
    return (
      <div className="fixed inset-0 bg-[#08080f] flex flex-col">
        <div className="px-4 pt-3 pb-2 text-center">
          <div className="text-sm text-gray-400">
            {KEYS[keyName].name} · {voice} · {difficulty} · {phraseLength} notes
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-4">
          {/* Preview the phrase */}
          <canvas ref={canvasRef} className="w-full max-w-2xl" style={{ height: 200, display: 'block' }} />

          <div className="mt-6 text-center">
            <div className="text-sm text-gray-500 mb-2">
              Starting note: <span className="text-yellow-400 font-bold">{phrase[0]?.name}</span>
            </div>
            <div className="flex gap-3">
              <button onClick={() => {
                if (phrase[0]) playTone(phrase[0].semitones, 1500)
              }}
                className="px-4 py-2 rounded-xl text-sm text-gray-400 border border-gray-700 active:scale-95 transition-all">
                🔊 Hear Starting Note
              </button>
              <button onClick={startSinging}
                className="px-8 py-3 rounded-2xl text-lg font-bold text-white active:scale-95 transition-all"
                style={{
                  background: 'linear-gradient(135deg, #eab308, #b45309)',
                  boxShadow: '0 0 20px rgba(234,179,8,0.3)',
                }}>
                START SINGING
              </button>
            </div>
          </div>

          <button onClick={generateNewPhrase}
            className="mt-4 text-xs text-gray-600 hover:text-gray-400 transition-colors">
            Generate different phrase
          </button>
        </div>
      </div>
    )
  }

  // ─── RESULTS ──────────────────────────────────────────────────────────
  if (phase === 'results') {
    const accuracy = stats.total > 0 ? Math.round((stats.hit / stats.total) * 100) : 0
    return (
      <div className="fixed inset-0 bg-[#08080f] flex flex-col items-center justify-center px-6">
        <div className="text-4xl font-black text-white mb-3" style={{
          textShadow: accuracy >= 90 ? '0 0 30px rgba(100,255,160,0.4)' : '0 0 20px rgba(255,200,60,0.3)',
        }}>
          {accuracy >= 95 ? 'NAILED IT!' : accuracy >= 80 ? 'GREAT READ!' : accuracy >= 60 ? 'GOOD TRY' : 'KEEP PRACTICING'}
        </div>

        <div className="grid grid-cols-3 gap-6 mb-6">
          <div className="text-center">
            <div className="text-xs text-gray-500">ACCURACY</div>
            <div className="text-3xl font-bold" style={{ color: accuracy >= 80 ? '#64ffa0' : '#ffc83c' }}>{accuracy}%</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">NOTES HIT</div>
            <div className="text-3xl font-bold text-white">{stats.hit}/{stats.total}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">BEST STREAK</div>
            <div className="text-3xl font-bold text-purple-400">{stats.maxStreak}</div>
          </div>
        </div>

        {/* Note-by-note review */}
        <div className="flex gap-1 mb-6 flex-wrap justify-center">
          {phrase.map((n, i) => (
            <div key={i} className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
              style={{
                background: n.state === 'hit' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                border: `1px solid ${n.state === 'hit' ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
                color: n.state === 'hit' ? '#4ade80' : '#f87171',
              }}>
              {n.name.replace(/\d/, '')}
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={generateNewPhrase}
            className="px-8 py-3 rounded-xl font-bold text-white active:scale-95 transition-all"
            style={{ background: 'linear-gradient(135deg, #eab308, #b45309)' }}>
            NEW PHRASE
          </button>
          <button onClick={() => {
            setPhrase(prev => prev.map(n => ({ ...n, state: 'upcoming', matchProgress: 0 })))
            setCurrentIdx(0)
            currentIdxRef.current = 0
            setMatchProgress(0)
            setStats({ hit: 0, miss: 0, total: phrase.length, streak: 0, maxStreak: 0 })
            setPhase('ready')
          }}
            className="px-6 py-3 rounded-xl font-medium text-gray-400 border border-gray-700 active:scale-95 transition-all">
            RETRY SAME
          </button>
          <button onClick={() => setPhase('menu')}
            className="px-6 py-3 rounded-xl font-medium text-gray-500 active:scale-95 transition-all">
            MENU
          </button>
        </div>
      </div>
    )
  }

  // ─── SINGING (active practice) ────────────────────────────────────────
  const current = phrase[currentIdx]
  const currentHue = current ? (NOTE_COLORS[current.name]?.hue ?? 200) : 200
  const voicePitch = pitchRef.current
  const isOnPitch = voicePitch?.isActive && voicePitch.isSettled && current &&
    Math.abs(voicePitch.staffPosition - current.semitones) <= 1.5

  return (
    <div className="fixed inset-0 bg-[#08080f] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="text-sm text-gray-400">{currentIdx + 1}/{phrase.length}</div>
        <div className="flex items-center gap-3">
          {stats.streak >= 3 && (
            <span className="text-sm font-bold" style={{
              color: stats.streak >= 8 ? '#ff6090' : '#ffc83c',
            }}>{stats.streak} streak</span>
          )}
          <span className="text-sm text-gray-500">{stats.hit}/{currentIdx}</span>
        </div>
      </div>

      {/* Staff canvas */}
      <div className="px-4">
        <canvas ref={canvasRef} className="w-full max-w-3xl mx-auto" style={{ height: 180, display: 'block' }} />
      </div>

      {/* Current note + pitch feedback */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {current && (
          <>
            <div className="text-5xl font-black mb-2 transition-all" style={{
              color: isOnPitch ? '#64ffa0' : `hsl(${currentHue}, 60%, 60%)`,
              textShadow: isOnPitch ? '0 0 30px rgba(100,255,160,0.5)' : 'none',
            }}>
              {current.name}
            </div>

            {/* Match progress bar */}
            {matchProgress > 0 && (
              <div className="w-40 h-2 rounded-full overflow-hidden mb-3" style={{ background: 'rgba(40,40,60,0.4)' }}>
                <div className="h-full rounded-full transition-all" style={{
                  width: `${matchProgress * 100}%`,
                  background: isOnPitch ? '#64ffa0' : `hsl(${currentHue}, 60%, 50%)`,
                }} />
              </div>
            )}

            {/* Voice feedback */}
            <div className="h-6 text-sm">
              {voicePitch?.isActive ? (
                <span style={{ color: isOnPitch ? '#64ffa0' : '#f87171' }}>
                  {voicePitch.note} {voicePitch.cents > 0 ? '+' : ''}{voicePitch.cents}¢
                  {!isOnPitch && (
                    <span className="text-gray-500 ml-2">
                      {(voicePitch.staffPosition ?? 0) < current.semitones ? '↑' : '↓'}
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-gray-600">Sing...</span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Bottom */}
      <div className="flex justify-center gap-4 pb-5">
        <button onClick={() => {
          if (rafRef.current) cancelAnimationFrame(rafRef.current)
          fusionRef.current?.stop()
          setPhase('results')
        }} className="px-4 py-2 rounded-xl text-sm text-gray-500 border border-gray-700 active:scale-95">
          Stop
        </button>
      </div>
    </div>
  )
}
