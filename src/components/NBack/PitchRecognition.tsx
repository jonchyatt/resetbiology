'use client'

import { useState, useCallback, useRef } from 'react'
import { Music, RotateCcw, Play } from 'lucide-react'
import { PortalHeader } from '@/components/Navigation/PortalHeader'

// ─── Constants ───────────────────────────────────────────────────────────────

// All notes in piano keyboard order (for visual display)
const KEYBOARD_ORDER = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']

// Note introduction order (widest spacing first — easiest to distinguish by ear)
const INTRO_ORDER = ['C4', 'A4', 'G4', 'E4', 'D4', 'F4', 'B4', 'C5']

type Phase = 'idle' | 'playing' | 'feedback' | 'summary'
type ButtonState = 'default' | 'correct' | 'wrong' | 'highlight'

interface NoteStats {
  correct: number
  total: number
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PitchRecognition() {
  const [activeNotes, setActiveNotes] = useState<string[]>(['C4', 'A4'])
  const [currentNote, setCurrentNote] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0)
  const [consecutiveWrong, setConsecutiveWrong] = useState(0)
  const [noteStats, setNoteStats] = useState<Record<string, NoteStats>>({})
  const [sessionTotal, setSessionTotal] = useState(0)
  const [sessionCorrect, setSessionCorrect] = useState(0)
  const [buttonStates, setButtonStates] = useState<Record<string, ButtonState>>({})
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null)
  const lastNoteRef = useRef<string | null>(null)

  const playNote = useCallback((note: string) => {
    const audio = new Audio(`/sounds/nback/piano/${note}.wav`)
    audio.play().catch(() => {/* browser autoplay policy — user will replay */})
    setHighlightedKey(note)
    setTimeout(() => setHighlightedKey(null), 600)
  }, [])

  const pickNextNote = useCallback((pool: string[]): string => {
    if (pool.length === 1) return pool[0]
    let note: string
    do {
      note = pool[Math.floor(Math.random() * pool.length)]
    } while (note === lastNoteRef.current)
    return note
  }, [])

  const startGame = useCallback(() => {
    const initialPool = ['C4', 'A4']
    const note = pickNextNote(initialPool)
    lastNoteRef.current = note
    setActiveNotes(initialPool)
    setCurrentNote(note)
    setPhase('playing')
    setConsecutiveCorrect(0)
    setConsecutiveWrong(0)
    setNoteStats({})
    setSessionTotal(0)
    setSessionCorrect(0)
    setButtonStates({})
    playNote(note)
  }, [pickNextNote, playNote])

  const replayNote = useCallback(() => {
    if (currentNote) playNote(currentNote)
  }, [currentNote, playNote])

  const handleAnswer = useCallback((chosen: string) => {
    if (phase !== 'playing' || !currentNote) return
    setPhase('feedback')

    const isCorrect = chosen === currentNote
    const newTotal = sessionTotal + 1
    const newCorrect = sessionCorrect + (isCorrect ? 1 : 0)
    setSessionTotal(newTotal)
    setSessionCorrect(newCorrect)

    setNoteStats(prev => ({
      ...prev,
      [currentNote]: {
        correct: (prev[currentNote]?.correct ?? 0) + (isCorrect ? 1 : 0),
        total: (prev[currentNote]?.total ?? 0) + 1,
      },
    }))

    setButtonStates(
      isCorrect
        ? { [chosen]: 'correct' }
        : { [chosen]: 'wrong', [currentNote]: 'highlight' }
    )

    const newConsecCorrect = isCorrect ? consecutiveCorrect + 1 : 0
    const newConsecWrong = isCorrect ? 0 : consecutiveWrong + 1
    setConsecutiveCorrect(newConsecCorrect)
    setConsecutiveWrong(newConsecWrong)

    // Determine next pool (may add or remove a note)
    let nextPool = [...activeNotes]
    let resetCorrectStreak = false
    let resetWrongStreak = false

    if (isCorrect && newConsecCorrect >= 5 && nextPool.length < 8) {
      const nextNote = INTRO_ORDER.find(n => !nextPool.includes(n))
      if (nextNote) {
        nextPool = [...nextPool, nextNote]
        resetCorrectStreak = true
      }
    } else if (!isCorrect && newConsecWrong >= 3 && nextPool.length > 2) {
      // Remove the last-introduced note that isn't the one just played
      const lastIntroduced = [...INTRO_ORDER]
        .reverse()
        .find(n => nextPool.includes(n) && n !== currentNote)
      if (lastIntroduced) {
        nextPool = nextPool.filter(n => n !== lastIntroduced)
        resetWrongStreak = true
      }
    }

    if (resetCorrectStreak) setConsecutiveCorrect(0)
    if (resetWrongStreak) setConsecutiveWrong(0)
    if (nextPool.length !== activeNotes.length) setActiveNotes(nextPool)

    const delay = isCorrect ? 800 : 1200
    setTimeout(() => {
      setButtonStates({})
      const nextNote = pickNextNote(nextPool)
      lastNoteRef.current = nextNote
      setCurrentNote(nextNote)
      setPhase('playing')
      playNote(nextNote)
    }, delay)
  }, [
    phase, currentNote, consecutiveCorrect, consecutiveWrong,
    activeNotes, sessionTotal, sessionCorrect, pickNextNote, playNote,
  ])

  const endSession = useCallback(() => {
    setPhase('summary')
    setCurrentNote(null)
  }, [])

  // ─── Styling helpers ────────────────────────────────────────────────────────

  const getButtonClass = (note: string) => {
    const state = buttonStates[note] ?? 'default'
    const base = 'rounded-lg px-4 py-3 font-mono text-lg font-bold border-2 transition-all duration-150 disabled:cursor-not-allowed'
    switch (state) {
      case 'correct':   return `${base} bg-green-500/30 border-green-400 text-green-300`
      case 'wrong':     return `${base} bg-red-500/30 border-red-400 text-red-300`
      case 'highlight': return `${base} bg-teal-500/30 border-teal-400 text-teal-300`
      default:          return `${base} bg-gray-700/60 border-gray-600 text-gray-200 hover:border-teal-400`
    }
  }

  const getKeyClass = (note: string) => {
    const isHighlighted = highlightedKey === note
    const isActive = activeNotes.includes(note)
    const base = 'w-10 h-24 rounded-b-md border-2 transition-all duration-100'
    if (isHighlighted) return `${base} bg-teal-400/80 border-teal-300 shadow-lg shadow-teal-500/50 scale-95`
    if (isActive)      return `${base} bg-gray-100 border-gray-400 shadow-sm`
    return               `${base} bg-gray-600 border-gray-700 opacity-25`
  }

  const accuracyPct = sessionTotal > 0
    ? Math.round((sessionCorrect / sessionTotal) * 100)
    : 0

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800"
      style={{
        backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <PortalHeader section="Mental Training" />

      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Page header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Music className="w-7 h-7 text-teal-400" />
            <h1 className="text-3xl font-bold text-white">Pitch Recognition</h1>
          </div>
          <p className="text-gray-400 text-sm">Train your ear to identify musical notes by sound</p>
        </div>

        {/* ── Idle ── */}
        {phase === 'idle' && (
          <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-8 border border-primary-400/20 shadow-lg text-center">
            <p className="text-gray-300 mb-2 text-lg">Identify piano notes by ear</p>
            <p className="text-gray-500 text-sm mb-2">Start with 2 notes. Master them and more are added — up to all 8.</p>
            <div className="flex justify-center gap-4 text-xs text-gray-600 mb-8">
              <span>✓ 5 correct in a row → new note added</span>
              <span>✗ 3 wrong in a row → note removed</span>
            </div>
            <button
              onClick={startGame}
              className="bg-teal-600 hover:bg-teal-500 text-white font-bold px-8 py-3 rounded-xl transition-colors flex items-center gap-2 mx-auto"
            >
              <Play className="w-5 h-5" />
              Start Game
            </button>
          </div>
        )}

        {/* ── Playing / Feedback ── */}
        {(phase === 'playing' || phase === 'feedback') && (
          <>
            {/* Stats bar */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm">
                {activeNotes.length} note{activeNotes.length !== 1 ? 's' : ''} active
              </span>
              <span className="text-gray-400 text-sm">
                {sessionCorrect}/{sessionTotal} · {accuracyPct}%
              </span>
              <button
                onClick={endSession}
                className="text-gray-500 hover:text-gray-300 text-xs border border-gray-700 hover:border-gray-500 rounded px-2 py-1 transition-colors"
              >
                End Session
              </button>
            </div>

            {/* Main card */}
            <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-6 border border-primary-400/20 shadow-lg mb-3">

              {/* Piano keyboard visual */}
              <div className="flex justify-center gap-1.5 mb-8">
                {KEYBOARD_ORDER.map(note => (
                  <div key={note} className="flex flex-col items-center gap-1">
                    <div className={getKeyClass(note)} />
                    <span className={`text-xs font-mono ${activeNotes.includes(note) ? 'text-gray-400' : 'text-gray-700'}`}>
                      {note}
                    </span>
                  </div>
                ))}
              </div>

              {/* Replay button */}
              <div className="text-center mb-6">
                <button
                  onClick={replayNote}
                  disabled={phase === 'feedback'}
                  className="bg-teal-600/20 hover:bg-teal-600/40 disabled:opacity-40 border border-teal-500/50 text-teal-300 font-medium px-6 py-2 rounded-lg transition-colors flex items-center gap-2 mx-auto text-sm"
                >
                  <RotateCcw className="w-4 h-4" />
                  Replay Note
                </button>
              </div>

              {/* Answer buttons — sorted by keyboard order */}
              <div className={`grid gap-3 ${activeNotes.length <= 4 ? 'grid-cols-4' : 'grid-cols-4'}`}>
                {[...activeNotes]
                  .sort((a, b) => KEYBOARD_ORDER.indexOf(a) - KEYBOARD_ORDER.indexOf(b))
                  .map(note => (
                    <button
                      key={note}
                      onClick={() => handleAnswer(note)}
                      disabled={phase === 'feedback'}
                      className={getButtonClass(note)}
                    >
                      {note}
                    </button>
                  ))}
              </div>
            </div>

            {/* Streak indicator */}
            {(consecutiveCorrect > 0 || consecutiveWrong > 0) && (
              <div className="text-center text-sm">
                {consecutiveCorrect > 0 && (
                  <span className="text-green-400">
                    🔥 {consecutiveCorrect} correct in a row
                    {consecutiveCorrect >= 4 ? ' — almost leveling up!' : ''}
                  </span>
                )}
                {consecutiveWrong > 0 && (
                  <span className="text-red-400">
                    ⚠ {consecutiveWrong} wrong in a row
                    {consecutiveWrong >= 2 ? ' — simplifying soon' : ''}
                  </span>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Summary ── */}
        {phase === 'summary' && (
          <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-8 border border-primary-400/20 shadow-lg">
            <h2 className="text-2xl font-bold text-white text-center mb-3">Session Complete</h2>
            <p className="text-center text-5xl font-mono font-bold text-teal-400 mb-1">
              {accuracyPct}%
            </p>
            <p className="text-center text-gray-400 mb-8">
              {sessionCorrect} correct out of {sessionTotal}
            </p>

            {/* Per-note breakdown */}
            {Object.keys(noteStats).length > 0 && (
              <div className="mb-8">
                <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">
                  Per-note accuracy
                </h3>
                <div className="space-y-2">
                  {KEYBOARD_ORDER.filter(n => noteStats[n]).map(note => {
                    const stats = noteStats[note]
                    const pct = stats.total > 0
                      ? Math.round((stats.correct / stats.total) * 100)
                      : 0
                    return (
                      <div key={note} className="flex items-center gap-3">
                        <span className="font-mono text-sm text-gray-300 w-8">{note}</span>
                        <div className="flex-1 bg-gray-700/50 rounded-full h-2">
                          <div
                            className="bg-teal-500 h-2 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 w-20 text-right">
                          {stats.correct}/{stats.total} ({pct}%)
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <button
              onClick={startGame}
              className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5" />
              Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
