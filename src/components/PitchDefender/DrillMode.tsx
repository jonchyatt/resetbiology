'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// DrillMode — Standalone SRS Note Learning (No Arcade Pressure)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Flashcard-style note identification with FSRS spaced repetition.
// Show note → listen → identify (click or sing) → grade → next.
// Memory health bars show mastery per note. Progressive unlock.
//
// SHARES localStorage with Note Blaster/Echo Cannon — progress carries over.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  NOTE_COLORS, createNote, reviewNote, autoGrade, pickNextNote,
  currentR, type NoteMemory,
} from '@/lib/fsrs'
import { INTRO_ORDER, UNLOCK_THRESHOLDS } from './types'
import NoteButtons from './NoteButtons'
import PitchGuidance from './PitchGuidance'
import { usePitchDetection } from './usePitchDetection'
import { initAudio, loadPianoSamples, playPianoNote } from './audioEngine'
import { noteToFreq, octaveFoldedCents, PITCH_ON_TOLERANCE_CENTS } from './pitchMath'

// ─── Constants ──────────────────────────────────────────────────────────────

const FSRS_KEY = 'pitch_fsrs_memory'
const DRILL_PROGRESS_KEY = 'pitch_drill_progress'

type InputMode = 'click' | 'mic'
type DrillPhase = 'menu' | 'listening' | 'answering' | 'feedback' | 'session_complete'

interface DrillProgress {
  totalSessions: number
  totalCards: number
  bestStreak: number
}

interface SessionStats {
  correct: number
  wrong: number
  streak: number
  maxStreak: number
  startTime: number
  cardsReviewed: number
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function DrillMode() {
  // ─── State ────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<DrillPhase>('menu')
  const [inputMode, setInputMode] = useState<InputMode>('click')
  const [currentNote, setCurrentNote] = useState<string>('')
  const [unlockedNotes, setUnlockedNotes] = useState<string[]>([INTRO_ORDER[0], INTRO_ORDER[1]])
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0)
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState<boolean | null>(null)
  const [lastCorrectNote, setLastCorrectNote] = useState<string | null>(null)
  const [lastWrongNote, setLastWrongNote] = useState<string | null>(null)
  const [newNoteUnlocked, setNewNoteUnlocked] = useState<string | null>(null)
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    correct: 0, wrong: 0, streak: 0, maxStreak: 0, startTime: 0, cardsReviewed: 0,
  })
  const [sessionTarget, setSessionTarget] = useState(20) // cards per session
  const [lockProgress, setLockProgress] = useState(0)
  const [autoPlay, setAutoPlay] = useState(true) // auto-play note on new card

  // Refs
  const fsrsRef = useRef<Record<string, NoteMemory>>({})
  const progressRef = useRef<DrillProgress>({ totalSessions: 0, totalCards: 0, bestStreak: 0 })
  const notePlayTimeRef = useRef(0)
  const lockStartRef = useRef(0)
  const lockDurationRef = useRef(600)
  const processingRef = useRef(false)        // [FIX HIGH] double-answer guard
  const pendingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]) // [FIX HIGH] timer cleanup
  const processAnswerRef = useRef<(note: string) => void>(() => {}) // stable ref for mic tick
  const sessionStatsRef = useRef<SessionStats>({ correct: 0, wrong: 0, streak: 0, maxStreak: 0, startTime: 0, cardsReviewed: 0 }) // [FIX MEDIUM] avoid stale closure
  const unlockedNotesRef = useRef<string[]>([INTRO_ORDER[0], INTRO_ORDER[1]]) // [FIX LOW] stale closure on unlock

  // Pitch detection for mic mode
  const { isListening, pitch, startListening, stopListening, pitchRef: livePitchRef } = usePitchDetection({ noiseGateDb: -45 })

  // Keep refs in sync with state
  useEffect(() => { sessionStatsRef.current = sessionStats }, [sessionStats])
  useEffect(() => { unlockedNotesRef.current = unlockedNotes }, [unlockedNotes])

  // Timer management — schedule + track for cleanup
  const scheduleTimer = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      pendingTimersRef.current = pendingTimersRef.current.filter(t => t !== id)
      fn()
    }, ms)
    pendingTimersRef.current.push(id)
    return id
  }, [])

  const clearAllTimers = useCallback(() => {
    pendingTimersRef.current.forEach(clearTimeout)
    pendingTimersRef.current = []
  }, [])

  // ─── Load persisted data ──────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FSRS_KEY)
      if (raw) fsrsRef.current = JSON.parse(raw)
    } catch { /* fresh start */ }

    try {
      const raw = localStorage.getItem(DRILL_PROGRESS_KEY)
      if (raw) progressRef.current = JSON.parse(raw)
    } catch { /* fresh start */ }

    // Restore unlocked notes: only notes that have been REVIEWED (lastReview > 0)
    // AND that appear in INTRO_ORDER in sequence (no gaps from other modes pre-seeding)
    const reviewed = new Set(
      Object.entries(fsrsRef.current)
        .filter(([, m]) => m.lastReview > 0)
        .map(([k]) => k)
    )
    const restored: string[] = []
    for (const note of INTRO_ORDER) {
      if (reviewed.has(note)) restored.push(note)
      else break // stop at first unreviewed — no gaps
    }
    if (restored.length >= 2) {
      setUnlockedNotes(restored)
      unlockedNotesRef.current = restored
    }

    loadPianoSamples()
  }, [])

  // ─── Cleanup on unmount ───────────────────────────────────────────────
  useEffect(() => {
    return () => {
      pendingTimersRef.current.forEach(clearTimeout)
      pendingTimersRef.current = []
    }
  }, [])

  // ─── Persist ──────────────────────────────────────────────────────────
  const saveFsrs = useCallback(() => {
    try { localStorage.setItem(FSRS_KEY, JSON.stringify(fsrsRef.current)) } catch {}
  }, [])

  const saveProgress = useCallback(() => {
    try { localStorage.setItem(DRILL_PROGRESS_KEY, JSON.stringify(progressRef.current)) } catch {}
  }, [])

  // ─── Mic tick — Pitchforks v1 pattern (THE canonical reference) ──
  // Port from src/components/PitchDefender/Pitchforks.tsx:418-493.
  // Two principles, both load-bearing:
  //   1. Silent or low-confidence frames preserve the in-progress lock.
  //      DO NOTHING. pitch.isActive flickers in normal singing.
  //   2. ONLY a confidently wrong note (confidence >= 0.75 AND outside the
  //      70-cent tolerance) hard-resets the lock.
  // Reuses lockStartRef as the matchStart timestamp (Pitchforks v1 convention):
  //   0  = not currently locking
  //   > 0 = locking, value is performance.now() of first in-tolerance frame
  //   -1 = post-fire cooldown (don't accept new locks for 600ms)
  useEffect(() => {
    if (inputMode !== 'mic' || phase !== 'answering' || !isListening) return

    const TICK_MS = 50
    const HOLD_MS = 300
    const TOLERANCE_CENTS = 70
    const CONFIDENCE_FLOOR = 0.75

    const interval = setInterval(() => {
      if (processingRef.current) return
      if (!currentNote) {
        lockStartRef.current = 0
        setLockProgress(0)
        return
      }

      // Cooldown sentinel — wait it out
      if (lockStartRef.current === -1) return

      const p = livePitchRef.current
      if (p?.isActive && p.confidence >= CONFIDENCE_FLOOR && p.frequency > 0) {
        const targetFreq = noteToFreq(currentNote)
        const centsOff = octaveFoldedCents(p.frequency, targetFreq)
        if (Math.abs(centsOff) <= TOLERANCE_CENTS) {
          // IN tolerance — start or continue the lock
          if (lockStartRef.current === 0) lockStartRef.current = performance.now()
          if (lockStartRef.current > 0) {
            const held = performance.now() - lockStartRef.current
            const progress = Math.min(1, held / HOLD_MS)
            setLockProgress(progress)
            if (progress >= 1) {
              // FIRE — set cooldown sentinel
              lockStartRef.current = -1
              setLockProgress(0)
              setTimeout(() => { if (lockStartRef.current === -1) lockStartRef.current = 0 }, 600)
              processAnswerRef.current(currentNote)
            }
          }
        } else {
          // CONFIDENTLY wrong — hard reset
          if (lockStartRef.current > 0) {
            lockStartRef.current = 0
            setLockProgress(0)
          }
        }
      }
      // else: silent or low confidence — DO NOTHING. preserve in-progress lock.
      // (This is the load-bearing flicker fix from Pitchforks v1.)
    }, TICK_MS)

    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputMode, phase, isListening, currentNote])

  // ─── Start Session ────────────────────────────────────────────────────
  const startSession = useCallback(() => {
    clearAllTimers()
    processingRef.current = false
    initAudio()
    if (inputMode === 'mic') startListening()

    // Ensure FSRS memory for unlocked notes
    const notes = unlockedNotesRef.current
    for (const note of notes) {
      if (!fsrsRef.current[note]) fsrsRef.current[note] = createNote(note)
    }

    const initialStats = { correct: 0, wrong: 0, streak: 0, maxStreak: 0, startTime: Date.now(), cardsReviewed: 0 }
    setSessionStats(initialStats)
    sessionStatsRef.current = initialStats

    // Pick first note
    const first = pickNextNote(notes, fsrsRef.current, null)
    setCurrentNote(first)
    setPhase('listening')

    // Auto-play
    scheduleTimer(() => {
      playPianoNote(first)
      notePlayTimeRef.current = Date.now()
    }, 400)

    // After a beat, allow answering
    scheduleTimer(() => setPhase('answering'), 800)
  }, [inputMode, clearAllTimers, scheduleTimer])

  // ─── Process Answer ───────────────────────────────────────────────────
  const processAnswer = useCallback((answeredNote: string) => {
    // [FIX HIGH] Processing lock — prevents double-click and mic tick races
    if (processingRef.current) return
    processingRef.current = true

    const correct = answeredNote === currentNote
    const latency = notePlayTimeRef.current > 0 ? Date.now() - notePlayTimeRef.current : 2000
    const grade = autoGrade(correct, latency)

    // Update FSRS
    if (!fsrsRef.current[currentNote]) fsrsRef.current[currentNote] = createNote(currentNote)
    fsrsRef.current[currentNote] = reviewNote(fsrsRef.current[currentNote], grade)
    saveFsrs()

    // Visual feedback
    setLastAnswerCorrect(correct)
    if (correct) {
      setLastCorrectNote(answeredNote)
      scheduleTimer(() => setLastCorrectNote(null), 400)
    } else {
      setLastWrongNote(answeredNote)
      scheduleTimer(() => setLastWrongNote(null), 400)
      // Play the correct note so they hear it
      scheduleTimer(() => playPianoNote(currentNote), 300)
    }

    // Update stats via functional setState + sync ref
    setSessionStats(prev => {
      const newStreak = correct ? prev.streak + 1 : 0
      const updated = {
        ...prev,
        correct: prev.correct + (correct ? 1 : 0),
        wrong: prev.wrong + (correct ? 0 : 1),
        streak: newStreak,
        maxStreak: Math.max(prev.maxStreak, newStreak),
        cardsReviewed: prev.cardsReviewed + 1,
      }
      sessionStatsRef.current = updated // [FIX MEDIUM] keep ref in sync for timer closures
      return updated
    })

    // Check progressive unlock
    const newConsecutive = correct ? consecutiveCorrect + 1 : 0
    setConsecutiveCorrect(newConsecutive)

    if (correct) {
      const currentPool = unlockedNotesRef.current // [FIX LOW] use ref not stale state
      const currentPoolSize = currentPool.length
      const threshold = UNLOCK_THRESHOLDS[currentPoolSize]
      if (threshold && newConsecutive >= threshold && currentPoolSize < INTRO_ORDER.length) {
        const nextNote = INTRO_ORDER[currentPoolSize]
        const newPool = [...currentPool, nextNote]
        setUnlockedNotes(newPool)
        unlockedNotesRef.current = newPool
        setNewNoteUnlocked(nextNote)
        if (!fsrsRef.current[nextNote]) fsrsRef.current[nextNote] = createNote(nextNote)
        saveFsrs()
        scheduleTimer(() => setNewNoteUnlocked(null), 2000)
      }
    }

    // Show feedback briefly, then next card
    setPhase('feedback')
    const feedbackDuration = correct ? 600 : 1200
    scheduleTimer(() => {
      // [FIX MEDIUM] Read from ref, not stale closure
      const stats = sessionStatsRef.current
      if (stats.cardsReviewed >= sessionTarget) {
        // Session complete
        progressRef.current.totalSessions++
        progressRef.current.totalCards += stats.cardsReviewed
        progressRef.current.bestStreak = Math.max(progressRef.current.bestStreak, stats.maxStreak)
        saveProgress()
        if (inputMode === 'mic') stopListening()
        setPhase('session_complete')
        processingRef.current = false
        return
      }

      // Next card — use ref for latest unlocked notes
      const pool = unlockedNotesRef.current
      const next = pickNextNote(pool, fsrsRef.current, currentNote)
      setCurrentNote(next)
      setLastAnswerCorrect(null)
      setPhase('listening')

      if (autoPlay) {
        scheduleTimer(() => {
          playPianoNote(next)
          notePlayTimeRef.current = Date.now()
        }, 300)
      }
      scheduleTimer(() => {
        setPhase('answering')
        processingRef.current = false // [FIX HIGH] unlock after full transition
      }, 700)
    }, feedbackDuration)
  }, [currentNote, consecutiveCorrect, sessionTarget, inputMode, autoPlay, scheduleTimer])

  // Keep ref in sync so mic tick always calls latest version
  useEffect(() => { processAnswerRef.current = processAnswer }, [processAnswer])

  // ─── Replay Note ──────────────────────────────────────────────────────
  const replayNote = useCallback(() => {
    playPianoNote(currentNote)
    notePlayTimeRef.current = Date.now()
  }, [currentNote])

  // ─── Handle Click Answer ──────────────────────────────────────────────
  const handleNoteSelected = useCallback((note: string) => {
    processAnswer(note)
  }, [processAnswer])

  // ─── Memory Health Bars ───────────────────────────────────────────────
  const renderMemoryBars = () => {
    return (
      <div className="flex flex-wrap justify-center gap-1.5 px-4 mb-4">
        {unlockedNotes.map(note => {
          const mem = fsrsRef.current[note]
          const r = mem ? currentR(mem) : 0
          const color = NOTE_COLORS[note]
          const hue = color?.hue ?? 0
          const isCurrentNote = note === currentNote && phase !== 'menu' && phase !== 'session_complete'

          return (
            <div key={note} className="flex flex-col items-center" style={{ minWidth: 32 }}>
              {/* Bar */}
              <div className="relative w-5 rounded-full overflow-hidden" style={{
                height: 36,
                background: 'rgba(20, 20, 30, 0.6)',
                border: isCurrentNote ? `2px solid hsl(${hue}, 70%, 60%)` : '1px solid rgba(60, 60, 80, 0.3)',
                boxShadow: isCurrentNote ? `0 0 8px hsl(${hue}, 70%, 50%)` : 'none',
              }}>
                <div className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-500" style={{
                  height: `${r * 100}%`,
                  background: `linear-gradient(to top, hsl(${hue}, 60%, 35%), hsl(${hue}, 70%, 50%))`,
                  opacity: 0.9,
                }} />
              </div>
              {/* Label */}
              <div className="text-[9px] mt-0.5 font-mono" style={{
                color: isCurrentNote ? `hsl(${hue}, 70%, 70%)` : '#666',
                fontWeight: isCurrentNote ? 700 : 400,
              }}>
                {note.replace(/\d/, '')}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ─── MENU ─────────────────────────────────────────────────────────────
  if (phase === 'menu') {
    const totalReviewed = Object.values(fsrsRef.current).filter(m => m.lastReview > 0).length
    return (
      <div className="fixed inset-0 bg-[#08080f] flex flex-col items-center justify-center px-6">
        <h1 className="text-3xl font-black text-white mb-1" style={{ textShadow: '0 0 30px rgba(60,191,181,0.3)' }}>
          NOTE DRILL
        </h1>
        <p className="text-gray-500 text-sm mb-6">Spaced repetition note learning — no pressure, just practice</p>

        {/* Memory overview */}
        {totalReviewed > 0 && renderMemoryBars()}

        {/* Input mode toggle */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setInputMode('click')}
            className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: inputMode === 'click' ? 'rgba(60,191,181,0.15)' : 'rgba(40,40,60,0.4)',
              border: `2px solid ${inputMode === 'click' ? '#3FBFB5' : 'rgba(60,60,80,0.3)'}`,
              color: inputMode === 'click' ? '#3FBFB5' : '#888',
            }}
          >
            Click Mode
            <div className="text-xs opacity-60 mt-0.5">Tap the note name</div>
          </button>
          <button
            onClick={() => setInputMode('mic')}
            className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: inputMode === 'mic' ? 'rgba(139,92,246,0.15)' : 'rgba(40,40,60,0.4)',
              border: `2px solid ${inputMode === 'mic' ? '#8b5cf6' : 'rgba(60,60,80,0.3)'}`,
              color: inputMode === 'mic' ? '#a78bfa' : '#888',
            }}
          >
            Mic Mode
            <div className="text-xs opacity-60 mt-0.5">Sing the note</div>
          </button>
        </div>

        {/* Session length */}
        <div className="flex items-center gap-3 mb-6">
          <span className="text-xs text-gray-500">CARDS:</span>
          {[10, 20, 40].map(n => (
            <button
              key={n}
              onClick={() => setSessionTarget(n)}
              className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
              style={{
                background: sessionTarget === n ? 'rgba(60,191,181,0.15)' : 'transparent',
                border: `1px solid ${sessionTarget === n ? '#3FBFB5' : 'rgba(60,60,80,0.3)'}`,
                color: sessionTarget === n ? '#3FBFB5' : '#666',
              }}
            >
              {n}
            </button>
          ))}
        </div>

        {/* Auto-play toggle */}
        <label className="flex items-center gap-2 mb-6 cursor-pointer">
          <input
            type="checkbox"
            checked={autoPlay}
            onChange={() => setAutoPlay(!autoPlay)}
            className="w-4 h-4 rounded accent-teal-500"
          />
          <span className="text-xs text-gray-400">Auto-play note on each card</span>
        </label>

        <button
          onClick={startSession}
          className="px-10 py-4 rounded-2xl text-xl font-bold text-white transition-all active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #3FBFB5, #2a8a82)',
            boxShadow: '0 0 30px rgba(60,191,181,0.3), 0 4px 20px rgba(0,0,0,0.4)',
          }}
        >
          START DRILL
        </button>

        {/* Stats */}
        {progressRef.current.totalSessions > 0 && (
          <div className="mt-6 text-center">
            <div className="text-xs text-gray-600">
              {progressRef.current.totalSessions} sessions
              {' · '}{progressRef.current.totalCards} cards reviewed
              {' · '}{progressRef.current.bestStreak} best streak
            </div>
          </div>
        )}

        <a href="/pitch-defender" className="mt-6 text-xs text-gray-600 hover:text-gray-400 transition-colors">
          ← Back to Pitch Defender
        </a>
      </div>
    )
  }

  // ─── SESSION COMPLETE ─────────────────────────────────────────────────
  if (phase === 'session_complete') {
    const accuracy = sessionStats.cardsReviewed > 0
      ? Math.round((sessionStats.correct / sessionStats.cardsReviewed) * 100) : 0
    const elapsed = Math.round((Date.now() - sessionStats.startTime) / 1000)
    const minutes = Math.floor(elapsed / 60)
    const seconds = elapsed % 60

    return (
      <div className="fixed inset-0 bg-[#08080f] flex flex-col items-center justify-center px-6">
        <div className="text-4xl font-black text-white mb-2" style={{
          textShadow: accuracy >= 90 ? '0 0 30px rgba(100,255,160,0.4)' : '0 0 20px rgba(255,200,60,0.3)',
        }}>
          {accuracy === 100 ? 'PERFECT SESSION!' : accuracy >= 80 ? 'GREAT WORK!' : 'SESSION COMPLETE'}
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-6">
          <div className="text-center">
            <div className="text-xs text-gray-500">ACCURACY</div>
            <div className="text-2xl font-bold" style={{ color: accuracy >= 80 ? '#64ffa0' : '#ffc83c' }}>
              {accuracy}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">CARDS</div>
            <div className="text-2xl font-bold text-white">{sessionStats.cardsReviewed}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">BEST STREAK</div>
            <div className="text-2xl font-bold text-purple-400">{sessionStats.maxStreak}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">TIME</div>
            <div className="text-2xl font-bold text-gray-300">
              {minutes > 0 ? `${minutes}m ` : ''}{seconds}s
            </div>
          </div>
        </div>

        {/* Updated memory bars */}
        {renderMemoryBars()}

        {newNoteUnlocked && (
          <div className="mb-4 px-4 py-2 rounded-xl text-sm font-bold text-center"
            style={{
              background: 'rgba(100, 255, 160, 0.1)',
              border: '1px solid rgba(100, 255, 160, 0.3)',
              color: '#64ffa0',
            }}>
            New note unlocked: {newNoteUnlocked}!
          </div>
        )}

        <div className="flex gap-4">
          <button onClick={startSession}
            className="px-8 py-3 rounded-xl font-bold text-white active:scale-95 transition-all"
            style={{ background: 'linear-gradient(135deg, #3FBFB5, #2a8a82)' }}>
            DRILL AGAIN
          </button>
          <button onClick={() => setPhase('menu')}
            className="px-6 py-3 rounded-xl font-medium text-gray-400 border border-gray-700 active:scale-95 transition-all">
            MENU
          </button>
        </div>
      </div>
    )
  }

  // ─── ACTIVE DRILL (listening / answering / feedback) ──────────────────
  const noteColor = NOTE_COLORS[currentNote]
  const noteHue = noteColor?.hue ?? 0
  const isAnswering = phase === 'answering'
  const isFeedback = phase === 'feedback'
  const progress = sessionStats.cardsReviewed / sessionTarget

  return (
    <div className="fixed inset-0 bg-[#08080f] flex flex-col">
      {/* Top bar — progress + stats */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="text-sm text-gray-400 font-medium">
          {sessionStats.cardsReviewed} / {sessionTarget}
        </div>
        <div className="flex items-center gap-3">
          {sessionStats.streak >= 3 && (
            <div className="text-sm font-bold" style={{
              color: sessionStats.streak >= 10 ? '#ff6090' : sessionStats.streak >= 5 ? '#ffc83c' : '#3FBFB5',
            }}>
              {sessionStats.streak} streak
            </div>
          )}
          <div className="text-sm text-gray-500">
            {sessionStats.correct}/{sessionStats.cardsReviewed}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 mx-4 rounded-full overflow-hidden" style={{ background: 'rgba(40,40,60,0.4)' }}>
        <div className="h-full rounded-full transition-all duration-500" style={{
          width: `${progress * 100}%`,
          background: 'linear-gradient(90deg, #3FBFB5, #8b5cf6)',
        }} />
      </div>

      {/* Memory bars */}
      <div className="mt-3">
        {renderMemoryBars()}
      </div>

      {/* Main card area */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Note display */}
        <div className="relative mb-6">
          {/* Glowing orb */}
          <div className="w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300"
            style={{
              background: `radial-gradient(circle, hsl(${noteHue}, 60%, 25%) 0%, hsl(${noteHue}, 40%, 10%) 70%, transparent 100%)`,
              boxShadow: isFeedback
                ? lastAnswerCorrect
                  ? '0 0 40px rgba(100,255,160,0.5), 0 0 80px rgba(100,255,160,0.2)'
                  : '0 0 40px rgba(255,80,80,0.5), 0 0 80px rgba(255,80,80,0.2)'
                : `0 0 30px hsl(${noteHue}, 60%, 40%, 0.3), 0 0 60px hsl(${noteHue}, 60%, 40%, 0.1)`,
              border: isFeedback
                ? lastAnswerCorrect
                  ? '3px solid rgba(100,255,160,0.6)'
                  : '3px solid rgba(255,80,80,0.6)'
                : `2px solid hsl(${noteHue}, 50%, 40%)`,
            }}
          >
            {/* Show note name after answering (feedback) or in listen phase */}
            {isFeedback ? (
              <div className="text-center">
                <div className="text-4xl font-black" style={{
                  color: lastAnswerCorrect ? '#64ffa0' : '#ff5050',
                }}>
                  {lastAnswerCorrect ? '✓' : currentNote}
                </div>
                {!lastAnswerCorrect && (
                  <div className="text-xs text-gray-400 mt-1">was the answer</div>
                )}
              </div>
            ) : (
              <div className="text-center">
                <div className="text-lg text-gray-400 mb-1">
                  {phase === 'listening' ? 'Listen...' : 'What note?'}
                </div>
                <button onClick={replayNote} className="text-2xl" style={{
                  color: `hsl(${noteHue}, 60%, 60%)`,
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                }}>
                  🔊
                </button>
              </div>
            )}
          </div>

          {/* Mic pitch guidance (positioned beside the orb) */}
          {inputMode === 'mic' && isAnswering && (
            <PitchGuidance
              targetNote={currentNote}
              pitch={pitch}
              isLocking={lockProgress > 0}
              lockProgress={lockProgress}
            />
          )}

          {/* Pitchforks v1 slider bar — canonical mic lock feedback.
              Gated to lockProgress > 0 so it only appears while singing on-pitch. */}
          {inputMode === 'mic' && isAnswering && lockProgress > 0 && (
            <div
              className="absolute left-1/2 -translate-x-1/2"
              style={{
                bottom: -14,
                width: 100,
                height: 4,
                background: 'rgba(10,10,20,0.6)',
                border: '1px solid rgba(60,60,90,0.6)',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${lockProgress * 100}%`,
                  height: '100%',
                  background: lockProgress >= 0.8 ? '#4ade80' : '#fbbf24',
                  boxShadow: lockProgress >= 0.8
                    ? '0 0 8px #4ade80, 0 0 16px #4ade8060'
                    : '0 0 6px #fbbf2460',
                  transition: 'width 0.05s linear',
                }}
              />
            </div>
          )}
        </div>

        {/* New note unlocked banner */}
        {newNoteUnlocked && (
          <div className="mb-4 px-4 py-2 rounded-xl text-sm font-bold animate-pulse"
            style={{
              background: 'rgba(100, 255, 160, 0.1)',
              border: '1px solid rgba(100, 255, 160, 0.3)',
              color: '#64ffa0',
            }}>
            New note unlocked: {newNoteUnlocked}!
          </div>
        )}

        {/* Mic mode status */}
        {inputMode === 'mic' && isAnswering && (
          <div className="mb-3 text-center">
            <div className="text-xs text-gray-500">
              {pitch?.isActive ? (
                <span style={{ color: `hsl(${NOTE_COLORS[pitch.note]?.hue ?? 0}, 60%, 60%)` }}>
                  Hearing: <b>{pitch.note}</b> ({pitch.cents > 0 ? '+' : ''}{pitch.cents}¢)
                </span>
              ) : (
                'Sing the note you hear...'
              )}
            </div>
          </div>
        )}

        {/* Click mode — note buttons */}
        {inputMode === 'click' && (
          <NoteButtons
            unlockedNotes={unlockedNotes}
            onNoteSelected={handleNoteSelected}
            disabled={!isAnswering}
            lastCorrectNote={lastCorrectNote}
            lastWrongNote={lastWrongNote}
          />
        )}
      </div>

      {/* Bottom — replay + skip */}
      <div className="flex justify-center gap-4 pb-6">
        <button onClick={replayNote}
          className="px-4 py-2 rounded-xl text-sm text-gray-400 border border-gray-700 active:scale-95 transition-all"
          disabled={!isAnswering}>
          Replay Note
        </button>
        <button onClick={() => {
          clearAllTimers()
          processingRef.current = false
          if (inputMode === 'mic') stopListening()
          setPhase('menu')
        }}
          className="px-4 py-2 rounded-xl text-sm text-gray-500 active:scale-95 transition-all">
          End Session
        </button>
      </div>
    </div>
  )
}
