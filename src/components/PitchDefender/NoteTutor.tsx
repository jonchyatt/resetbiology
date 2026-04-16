'use client'

// ═══════════════════════════════════════════════════════════════════════════
// NoteTutor — Mastery-Gated Note Identification + Singing Tutor
// ═══════════════════════════════════════════════════════════════════════════
//
// Sister to DrillMode (which stays, untouched). Three modes share one pool:
//   A. Staff + Tone → identify via number key 1-9
//   B. Tone only   → identify via number key 1-9
//   C. Name → Sing → mic, Pitchforks v1 canonical lock mechanic
//
// 9-note window (octave + 1) mapped to keys 1-9, shiftable by octave.
// Pool starts with keys 1 + 9 (max separation) and expands by mastery-gated
// strategy alternating "far from weakest" (discrimination) and "neighbor of
// newest" (climb training). Queue-based ordinal reinsertion — NOT time-based.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NOTE_COLORS } from '@/lib/fsrs'
import {
  EngineState, createEngine, createItem, recordResult, pickDepth, reinsert,
  pickNext, canExpandPool, expandPool,
} from './engine/masteryQueue'
import { ActivePool } from './engine/types'
import { usePitchDetection } from './usePitchDetection'
import { initAudio, loadPianoSamples, playPianoNote, playSfx } from './audioEngine'
import { noteToFreq, octaveFoldedCents } from './pitchMath'

// ─── Constants ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'nt_v1_state'
const WINDOW_SIZE = 9                 // keys 1-9 = 9 notes (octave + 1)
const NOTE_CLASSES = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C', 'D'] as const
const CLASS_OFFSET = [0, 1, 2, 3, 4, 5, 6, 7, 8]  // 0 = baseOctave, 7+ = next octave
const DEFAULT_BASE_OCTAVE = 4
const OCTAVE_MIN = 3
const OCTAVE_MAX = 5
const STEP_OF: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 }

type Mode = 'staff' | 'tone' | 'sing'
type Phase = 'menu' | 'listening' | 'answering' | 'feedback' | 'session_end'

const MODE_LABEL: Record<Mode, string> = {
  staff: 'A · Staff + Tone',
  tone: 'B · Tone Only',
  sing: 'C · Name → Sing',
}

interface Persisted {
  engine: EngineState
  pool: ActivePool<string>
  baseOctave: number
  octaveTolerant: boolean
  preferredMode: Mode
  totalCorrect: number
  totalAttempts: number
  sessions: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function windowNotes(baseOctave: number): string[] {
  return CLASS_OFFSET.map(i => {
    const cls = NOTE_CLASSES[i]
    const oct = baseOctave + (i >= 7 ? 1 : 0)
    return `${cls}${oct}`
  })
}

/** Absolute semitone distance between note names. */
function semitoneDist(a: string, b: string): number {
  const freqA = noteToFreq(a), freqB = noteToFreq(b)
  if (!freqA || !freqB) return 0
  return Math.abs(12 * Math.log2(freqA / freqB))
}

function initialState(): Persisted {
  const pool: ActivePool<string> = {
    items: [],
    candidates: [],
    attemptsSinceExpansion: 0,
    createdAt: Date.now(),
    expansionCycle: 0,
  }
  const engine = createEngine()
  return {
    engine, pool, baseOctave: DEFAULT_BASE_OCTAVE,
    octaveTolerant: true, preferredMode: 'staff',
    totalCorrect: 0, totalAttempts: 0, sessions: 0,
  }
}

function ensurePoolForOctave(s: Persisted): Persisted {
  const notes = windowNotes(s.baseOctave)
  // Seed engine items for every note in the current window so memory bars
  // and candidates render even before they've been touched.
  for (const n of notes) {
    if (!s.engine.items[n]) s.engine.items[n] = createItem(n, 'note', { note: n })
  }
  // Pool is only valid if every active id is in the current window. On fresh
  // state or after an octave shift, seed/reset to [pos0, pos8] — max
  // separation (Jon: "start further apart"). Mastery scores per note name
  // are preserved in engine.items across sessions.
  const poolValid = s.pool.items.length > 0
    && s.pool.items.every(n => notes.includes(n))
  if (!poolValid) {
    s.pool.items = [notes[0], notes[8]]
    s.pool.candidates = notes.slice(1, 8)
    s.pool.attemptsSinceExpansion = 0
    s.pool.expansionCycle = 0
  } else {
    // Reconcile candidates with current window (they drift if octave changed
    // and was then changed back — defensive refresh).
    s.pool.candidates = notes.filter(n => !s.pool.items.includes(n))
  }
  return s
}

// ─── Staff SVG ──────────────────────────────────────────────────────────────

function StaffNote({ note, color }: { note: string; color: string }) {
  const m = note.match(/^([A-G])(\d+)$/)
  if (!m) return null
  const cls = m[1], oct = parseInt(m[2], 10)
  // Staff position: 0 = bottom line (E4). Each step = 0.5 line spacing = 5px.
  const pos = STEP_OF[cls] + 7 * (oct - 4) - 2
  const y = 20 + (8 - pos) * 5
  const ledgersBelow: number[] = []
  const ledgersAbove: number[] = []
  for (let p = -2; p >= pos; p -= 2) ledgersBelow.push(20 + (8 - p) * 5)
  for (let p = 10; p <= pos; p += 2) ledgersAbove.push(20 + (8 - p) * 5)
  return (
    <svg width="180" height="110" viewBox="0 0 180 110">
      {[20, 30, 40, 50, 60].map(ly => (
        <line key={ly} x1="10" y1={ly} x2="170" y2={ly} stroke="#555" strokeWidth="1" />
      ))}
      <text x="8" y="58" fontSize="54" fill="#777" fontFamily="serif">{'\uD834\uDD1E'}</text>
      {ledgersBelow.map(ly => (
        <line key={'lb' + ly} x1="80" y1={ly} x2="108" y2={ly} stroke="#555" strokeWidth="1" />
      ))}
      {ledgersAbove.map(ly => (
        <line key={'la' + ly} x1="80" y1={ly} x2="108" y2={ly} stroke="#555" strokeWidth="1" />
      ))}
      <ellipse cx="94" cy={y} rx="8" ry="6" fill={color}
        transform={`rotate(-20 94 ${y})`}
        style={{ filter: `drop-shadow(0 0 8px ${color})` }} />
      {/* Stem — down if above middle line, up if below */}
      {pos >= 4
        ? <line x1="86" y1={y} x2="86" y2={y + 30} stroke={color} strokeWidth="1.5" />
        : <line x1="102" y1={y} x2="102" y2={y - 30} stroke={color} strokeWidth="1.5" />}
    </svg>
  )
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function NoteTutor() {
  const [state, setState] = useState<Persisted>(() => ensurePoolForOctave(initialState()))
  const [mode, setMode] = useState<Mode>('staff')
  const [phase, setPhase] = useState<Phase>('menu')
  const [currentNote, setCurrentNote] = useState<string>('')
  const [lastAnswer, setLastAnswer] = useState<{ note: string; correct: boolean } | null>(null)
  const [sessionStats, setSessionStats] = useState({ correct: 0, attempts: 0, streak: 0, best: 0 })
  const [lockProgress, setLockProgress] = useState(0)
  const [expandedNote, setExpandedNote] = useState<string | null>(null)

  const processingRef = useRef(false)
  const lockStartRef = useRef(0)
  const notePlayedAtRef = useRef(0)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const processAnswerRef = useRef<(note: string) => void>(() => {})

  const notes = useMemo(() => windowNotes(state.baseOctave), [state.baseOctave])

  // Mic only activates in sing mode
  const { isListening, pitch, startListening, stopListening, pitchRef } =
    usePitchDetection({ noiseGateDb: -45 })

  // ─── Load persisted ─────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Persisted
        setState(ensurePoolForOctave(parsed))
        setMode(parsed.preferredMode ?? 'staff')
      }
    } catch { /* fresh start */ }
    loadPianoSamples()
  }, [])

  const persist = useCallback((s: Persisted) => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    } catch { /* quota — drop */ }
  }, [])

  const scheduleTimer = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timersRef.current = timersRef.current.filter(t => t !== id)
      fn()
    }, ms)
    timersRef.current.push(id)
    return id
  }, [])

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }, [])

  useEffect(() => () => clearAllTimers(), [clearAllTimers])

  // ─── Mic lock (Pitchforks v1 canonical pattern) ─────────────────────────
  useEffect(() => {
    if (mode !== 'sing' || phase !== 'answering' || !isListening) return
    const TICK_MS = 50
    const HOLD_MS = 300
    const TOLERANCE_CENTS = 70
    const CONFIDENCE_FLOOR = 0.75

    const interval = setInterval(() => {
      if (processingRef.current || !currentNote) {
        lockStartRef.current = 0
        setLockProgress(0)
        return
      }
      if (lockStartRef.current === -1) return  // cooldown
      const p = pitchRef.current
      if (p?.isActive && p.confidence >= CONFIDENCE_FLOOR && p.frequency > 0) {
        const tgt = noteToFreq(currentNote)
        let cents = octaveFoldedCents(p.frequency, tgt)
        // If strict (octave-tolerant=OFF), punish wrong-octave singing
        if (!state.octaveTolerant) {
          // recompute raw (non-folded) cents for octave strictness
          const rawCents = 1200 * Math.log2(p.frequency / tgt)
          if (Math.abs(rawCents) > 600) cents = rawCents  // outside ±600 = wrong octave
        }
        if (Math.abs(cents) <= TOLERANCE_CENTS) {
          if (lockStartRef.current === 0) lockStartRef.current = performance.now()
          if (lockStartRef.current > 0) {
            const held = performance.now() - lockStartRef.current
            const prog = Math.min(1, held / HOLD_MS)
            setLockProgress(prog)
            if (prog >= 1) {
              lockStartRef.current = -1
              setLockProgress(0)
              setTimeout(() => { if (lockStartRef.current === -1) lockStartRef.current = 0 }, 600)
              processAnswerRef.current(currentNote)
            }
          }
        } else if (lockStartRef.current > 0) {
          lockStartRef.current = 0
          setLockProgress(0)
        }
      }
      // silent / low confidence → DO NOTHING. preserve in-progress lock.
    }, TICK_MS)
    return () => clearInterval(interval)
  }, [mode, phase, isListening, currentNote, state.octaveTolerant, pitchRef])

  // ─── Play current tone ──────────────────────────────────────────────────
  const playCurrent = useCallback(() => {
    if (!currentNote) return
    playPianoNote(currentNote)
    notePlayedAtRef.current = Date.now()
  }, [currentNote])

  // ─── Start session ──────────────────────────────────────────────────────
  const startSession = useCallback(() => {
    clearAllTimers()
    processingRef.current = false
    lockStartRef.current = 0
    initAudio()
    if (mode === 'sing') startListening()
    setSessionStats({ correct: 0, attempts: 0, streak: 0, best: 0 })
    const ids = state.pool.items
    const first = pickNext(state.engine, ids, null)
    if (!first) return
    setCurrentNote(first)
    setPhase('listening')
    if (mode !== 'sing') {
      scheduleTimer(() => { playPianoNote(first); notePlayedAtRef.current = Date.now() }, 300)
      scheduleTimer(() => setPhase('answering'), 800)
    } else {
      // sing mode: no tone play — prompt user to produce the note
      scheduleTimer(() => setPhase('answering'), 300)
    }
  }, [mode, state, startListening, clearAllTimers, scheduleTimer])

  // ─── Process answer ─────────────────────────────────────────────────────
  const processAnswer = useCallback((answer: string) => {
    if (processingRef.current) return
    processingRef.current = true
    const correct = answer === currentNote
    const item = state.engine.items[currentNote]
    if (item) {
      recordResult(state.engine, currentNote, correct)
      reinsert(state.engine, currentNote, pickDepth(state.engine, item, correct))
    }
    state.pool.attemptsSinceExpansion += 1
    state.totalAttempts += 1
    if (correct) state.totalCorrect += 1

    setLastAnswer({ note: answer, correct })
    playSfx(correct ? 'correct' : 'wrong')
    if (!correct) scheduleTimer(() => playPianoNote(currentNote), 400)

    setSessionStats(prev => {
      const streak = correct ? prev.streak + 1 : 0
      return {
        correct: prev.correct + (correct ? 1 : 0),
        attempts: prev.attempts + 1,
        streak,
        best: Math.max(prev.best, streak),
      }
    })

    // Pool expansion check
    if (canExpandPool(state.engine, state.pool)) {
      const added = expandPool(
        state.engine, state.pool, 'note',
        (id) => ({ note: id }),
        semitoneDist,
      )
      if (added) setExpandedNote(added)
    }

    persist(state)
    setPhase('feedback')
    const feedbackMs = correct ? 550 : 1400
    scheduleTimer(() => {
      setLastAnswer(null)
      setExpandedNote(null)
      const next = pickNext(state.engine, state.pool.items, currentNote)
      if (!next) {
        processingRef.current = false
        setPhase('session_end')
        return
      }
      setCurrentNote(next)
      setPhase('listening')
      if (mode !== 'sing') {
        scheduleTimer(() => { playPianoNote(next); notePlayedAtRef.current = Date.now() }, 250)
        scheduleTimer(() => { setPhase('answering'); processingRef.current = false }, 650)
      } else {
        scheduleTimer(() => { setPhase('answering'); processingRef.current = false }, 250)
      }
    }, feedbackMs)
  }, [currentNote, state, mode, persist, scheduleTimer])

  useEffect(() => { processAnswerRef.current = processAnswer }, [processAnswer])

  // ─── Keyboard 1-9 ───────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'answering' || mode === 'sing') return
    const onKey = (e: KeyboardEvent) => {
      const n = parseInt(e.key, 10)
      if (Number.isFinite(n) && n >= 1 && n <= 9) {
        const note = notes[n - 1]
        if (state.pool.items.includes(note)) {
          processAnswer(note)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, mode, notes, state.pool.items, processAnswer])

  // ─── Octave shift ───────────────────────────────────────────────────────
  const shiftOctave = useCallback((delta: number) => {
    setState(prev => {
      const target = Math.max(OCTAVE_MIN, Math.min(OCTAVE_MAX, prev.baseOctave + delta))
      if (target === prev.baseOctave) return prev
      const next = { ...prev, baseOctave: target }
      return ensurePoolForOctave(next)
    })
  }, [])

  // ─── End session ────────────────────────────────────────────────────────
  const endSession = useCallback(() => {
    clearAllTimers()
    processingRef.current = false
    stopListening()
    setState(prev => {
      const next = { ...prev, sessions: prev.sessions + 1 }
      persist(next)
      return next
    })
    setPhase('menu')
  }, [clearAllTimers, stopListening, persist])

  // ─── Render helpers ─────────────────────────────────────────────────────

  const memoryBar = (note: string) => {
    const m = state.engine.items[note]
    const mastery = m?.mastery ?? 0
    const color = NOTE_COLORS[note] ?? { hue: 200 }
    const active = state.pool.items.includes(note)
    const isCurrent = note === currentNote && phase !== 'menu' && phase !== 'session_end'
    return (
      <div key={note} className="flex flex-col items-center" style={{ minWidth: 34 }}>
        <div className="relative rounded-full overflow-hidden" style={{
          width: 18, height: 38,
          background: 'rgba(18,18,28,0.8)',
          border: isCurrent ? `2px solid hsl(${color.hue},70%,60%)` : '1px solid rgba(80,80,100,0.3)',
          boxShadow: isCurrent ? `0 0 10px hsl(${color.hue},70%,55%)` : 'none',
          opacity: active ? 1 : 0.35,
        }}>
          <div className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-500" style={{
            height: `${mastery * 100}%`,
            background: `linear-gradient(to top, hsl(${color.hue},60%,35%), hsl(${color.hue},70%,55%))`,
          }} />
        </div>
        <div className="text-[10px] mt-1 font-mono" style={{ color: isCurrent ? `hsl(${color.hue},70%,75%)` : '#666' }}>
          {note.replace(/\d/, '')}
        </div>
      </div>
    )
  }

  const noteHue = NOTE_COLORS[currentNote]?.hue ?? 210
  const noteColor = `hsl(${noteHue}, 70%, 60%)`

  // ─── MENU ───────────────────────────────────────────────────────────────
  if (phase === 'menu') {
    const accuracy = state.totalAttempts > 0
      ? Math.round((state.totalCorrect / state.totalAttempts) * 100) : 0
    return (
      <div className="fixed inset-0 bg-[#06060c] flex flex-col items-center justify-center px-6 overflow-y-auto">
        <h1 className="text-3xl font-black text-white mb-1"
          style={{ textShadow: '0 0 25px rgba(139,92,246,0.35)' }}>NOTE TUTOR</h1>
        <p className="text-gray-500 text-sm mb-6">Mastery-gated identification → singing. Keys 1-9.</p>

        {/* Memory bars for entire 9-note window */}
        <div className="flex gap-2 mb-6">{notes.map(n => memoryBar(n))}</div>

        {/* Mode selector */}
        <div className="flex gap-2 mb-4 flex-wrap justify-center max-w-md">
          {(['staff', 'tone', 'sing'] as Mode[]).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className="px-4 py-2 rounded-xl text-xs font-medium transition-all"
              style={{
                background: mode === m ? 'rgba(139,92,246,0.18)' : 'rgba(40,40,60,0.4)',
                border: `2px solid ${mode === m ? '#8b5cf6' : 'rgba(60,60,80,0.3)'}`,
                color: mode === m ? '#a78bfa' : '#888',
              }}>
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>

        {/* Octave shift */}
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => shiftOctave(-1)} disabled={state.baseOctave <= OCTAVE_MIN}
            className="w-8 h-8 rounded-lg border border-gray-700 text-gray-400 disabled:opacity-30">−</button>
          <span className="text-xs text-gray-500 font-mono">OCTAVE {state.baseOctave}-{state.baseOctave + 1}</span>
          <button onClick={() => shiftOctave(1)} disabled={state.baseOctave >= OCTAVE_MAX}
            className="w-8 h-8 rounded-lg border border-gray-700 text-gray-400 disabled:opacity-30">+</button>
        </div>

        {/* Octave tolerance toggle — only relevant in sing mode */}
        {mode === 'sing' && (
          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <input type="checkbox" checked={state.octaveTolerant}
              onChange={e => setState(s => ({ ...s, octaveTolerant: e.target.checked }))}
              className="w-4 h-4 accent-purple-500" />
            <span className="text-xs text-gray-400">Octave tolerant (any C counts as C4)</span>
          </label>
        )}

        <button onClick={startSession}
          className="px-10 py-4 rounded-2xl text-xl font-bold text-white transition-all active:scale-95 mt-2"
          style={{
            background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
            boxShadow: '0 0 30px rgba(139,92,246,0.35), 0 4px 18px rgba(0,0,0,0.4)',
          }}>START</button>

        {state.totalAttempts > 0 && (
          <div className="mt-6 text-xs text-gray-600 font-mono">
            {state.sessions} sessions · {state.totalAttempts} answers · {accuracy}% lifetime
          </div>
        )}
        <a href="/pitch-defender" className="mt-6 text-xs text-gray-700 hover:text-gray-500">← Back to Pitch Defender</a>
      </div>
    )
  }

  if (phase === 'session_end') {
    const acc = sessionStats.attempts > 0
      ? Math.round((sessionStats.correct / sessionStats.attempts) * 100) : 0
    return (
      <div className="fixed inset-0 bg-[#06060c] flex flex-col items-center justify-center px-6">
        <div className="text-3xl font-black text-white mb-2">SESSION DONE</div>
        <div className="text-5xl font-bold mb-6" style={{ color: acc >= 80 ? '#64ffa0' : '#fbbf24' }}>{acc}%</div>
        <div className="flex gap-6 mb-6 text-center">
          <div><div className="text-xs text-gray-500">Answers</div><div className="text-xl text-white font-bold">{sessionStats.attempts}</div></div>
          <div><div className="text-xs text-gray-500">Correct</div><div className="text-xl text-green-400 font-bold">{sessionStats.correct}</div></div>
          <div><div className="text-xs text-gray-500">Best streak</div><div className="text-xl text-purple-400 font-bold">{sessionStats.best}</div></div>
        </div>
        <div className="flex gap-3">
          <button onClick={startSession}
            className="px-6 py-3 rounded-xl font-bold text-white active:scale-95"
            style={{ background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)' }}>AGAIN</button>
          <button onClick={() => setPhase('menu')}
            className="px-6 py-3 rounded-xl font-medium text-gray-400 border border-gray-700">MENU</button>
        </div>
      </div>
    )
  }

  // ─── ACTIVE ─────────────────────────────────────────────────────────────
  const isAnswering = phase === 'answering'
  const isFeedback = phase === 'feedback'
  const acc = sessionStats.attempts > 0
    ? Math.round((sessionStats.correct / sessionStats.attempts) * 100) : 0

  return (
    <div className="fixed inset-0 bg-[#06060c] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="text-xs text-gray-400 font-mono">{MODE_LABEL[mode]}</div>
        <div className="flex items-center gap-3 text-xs">
          {sessionStats.streak >= 3 && (
            <span className="font-bold" style={{
              color: sessionStats.streak >= 10 ? '#ff6090' : sessionStats.streak >= 5 ? '#fbbf24' : '#8b5cf6',
            }}>{sessionStats.streak}x</span>
          )}
          <span className="text-gray-500 font-mono">{sessionStats.correct}/{sessionStats.attempts} · {acc}%</span>
        </div>
      </div>
      <div className="flex gap-2 justify-center mb-3">{notes.map(n => memoryBar(n))}</div>

      {/* Main card */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        {mode === 'staff' && currentNote && (
          <div className="mb-4 p-3 rounded-xl" style={{
            background: 'rgba(20,20,32,0.6)',
            border: `1px solid hsl(${noteHue},40%,30%)`,
          }}>
            <StaffNote note={currentNote} color={noteColor} />
          </div>
        )}

        {/* Prompt / feedback orb */}
        <div className="relative mb-5">
          <div className="w-36 h-36 rounded-full flex items-center justify-center transition-all duration-300"
            style={{
              background: `radial-gradient(circle, hsl(${noteHue},60%,22%) 0%, hsl(${noteHue},40%,8%) 70%, transparent)`,
              border: isFeedback
                ? `3px solid ${lastAnswer?.correct ? 'rgba(100,255,160,0.7)' : 'rgba(255,80,80,0.7)'}`
                : `2px solid hsl(${noteHue},50%,40%)`,
              boxShadow: isFeedback
                ? lastAnswer?.correct
                  ? '0 0 40px rgba(100,255,160,0.5)'
                  : '0 0 40px rgba(255,80,80,0.5)'
                : `0 0 25px hsl(${noteHue},60%,40%,0.35)`,
            }}>
            {isFeedback ? (
              <div className="text-center">
                <div className="text-4xl font-black" style={{ color: lastAnswer?.correct ? '#64ffa0' : '#ff5050' }}>
                  {lastAnswer?.correct ? '✓' : currentNote}
                </div>
                {!lastAnswer?.correct && <div className="text-xs text-gray-400 mt-1">was the answer</div>}
              </div>
            ) : mode === 'sing' ? (
              <div className="text-center">
                <div className="text-sm text-gray-400 mb-1">Sing</div>
                <div className="text-3xl font-black" style={{ color: noteColor }}>{currentNote}</div>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-sm text-gray-400 mb-1">
                  {phase === 'listening' ? 'Listen…' : 'What note?'}
                </div>
                <button onClick={playCurrent} className="text-3xl" style={{ color: noteColor }}>🔊</button>
              </div>
            )}
          </div>

          {/* Pitchforks v1 mic meter (sing mode only, while locking) */}
          {mode === 'sing' && isAnswering && lockProgress > 0 && (
            <div className="absolute left-1/2 -translate-x-1/2"
              style={{
                bottom: -18, width: 120, height: 5,
                background: 'rgba(10,10,20,0.65)',
                border: '1px solid rgba(60,60,90,0.6)',
                borderRadius: 2, overflow: 'hidden',
              }}>
              <div style={{
                width: `${lockProgress * 100}%`, height: '100%',
                background: lockProgress >= 0.8 ? '#4ade80' : '#fbbf24',
                boxShadow: lockProgress >= 0.8
                  ? '0 0 8px #4ade80, 0 0 16px #4ade8060'
                  : '0 0 6px #fbbf2460',
                transition: 'width 0.05s linear',
              }} />
            </div>
          )}
        </div>

        {/* Hearing readout in sing mode */}
        {mode === 'sing' && isAnswering && (
          <div className="mb-3 text-xs h-5">
            {pitch?.isActive ? (
              <span style={{ color: `hsl(${NOTE_COLORS[pitch.note]?.hue ?? 200},60%,65%)` }}>
                Hearing: <b>{pitch.note}</b> ({pitch.cents > 0 ? '+' : ''}{pitch.cents}¢)
              </span>
            ) : <span className="text-gray-600">Sing the note…</span>}
          </div>
        )}

        {/* Expansion banner */}
        {expandedNote && (
          <div className="mb-3 px-4 py-2 rounded-xl text-sm font-bold animate-pulse"
            style={{
              background: 'rgba(100,255,160,0.1)',
              border: '1px solid rgba(100,255,160,0.35)',
              color: '#64ffa0',
            }}>
            New note unlocked: {expandedNote}
          </div>
        )}

        {/* Replay button (not in sing mode — no pre-played tone) */}
        {mode !== 'sing' && (
          <button onClick={playCurrent} disabled={!isAnswering}
            className="px-4 py-2 rounded-xl text-xs text-gray-400 border border-gray-700 active:scale-95 disabled:opacity-30 mb-3">
            Replay tone
          </button>
        )}

        {/* Number-key buttons (hidden in sing mode) */}
        {mode !== 'sing' && (
          <div className="flex flex-wrap justify-center gap-2 max-w-lg">
            {notes.map((n, i) => {
              const unlocked = state.pool.items.includes(n)
              const color = NOTE_COLORS[n] ?? { hue: 210 }
              const lastCorrect = lastAnswer?.correct && lastAnswer.note === n
              const lastWrong = lastAnswer && !lastAnswer.correct && lastAnswer.note === n
              return (
                <button key={n} disabled={!isAnswering || !unlocked}
                  onClick={() => processAnswer(n)}
                  className="relative font-bold transition-all active:scale-95"
                  style={{
                    width: 56, height: 64, borderRadius: 12,
                    color: unlocked ? 'white' : '#555',
                    background: unlocked
                      ? `linear-gradient(135deg, hsl(${color.hue},60%,25%), hsl(${color.hue},50%,14%))`
                      : 'rgba(30,30,40,0.5)',
                    border: `2px solid ${unlocked ? `hsl(${color.hue},70%,50%)` : 'rgba(60,60,80,0.3)'}`,
                    opacity: unlocked ? 1 : 0.35,
                    boxShadow: lastCorrect
                      ? `0 0 22px hsl(${color.hue},80%,60%), inset 0 0 14px hsl(${color.hue},80%,60%)`
                      : lastWrong
                      ? '0 0 22px hsl(0,80%,55%), inset 0 0 10px hsl(0,80%,55%)'
                      : undefined,
                  }}>
                  <div className="text-[10px] text-gray-400 font-mono">{i + 1}</div>
                  <div className="text-base font-mono">{n.replace(/\d/, '')}</div>
                  <div className="text-[9px] text-gray-500 font-mono">{n.match(/\d/)?.[0]}</div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex justify-center gap-3 pb-5 text-xs">
        <button onClick={endSession}
          className="px-4 py-2 rounded-xl text-gray-500 border border-gray-700 active:scale-95">
          End session
        </button>
      </div>
    </div>
  )
}
