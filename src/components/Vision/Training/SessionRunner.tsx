'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  Play,
  X,
  Volume2,
  VolumeX,
  ChevronRight,
  Trophy,
  Flame,
  Wind,
  Target,
  SkipForward,
  CheckCircle,
} from 'lucide-react'
import { visionExerciseMap, type VisionExercise } from '@/data/visionExercises'
import { resolvePrescription } from '@/lib/vision/prescription'
import { SpeechQueue, unlockAudio } from '@/lib/vision/audioKit'
import { getEngine } from '@/components/Vision/Engines'
import type { EngineResult } from '@/components/Vision/Engines/types'
import GuidedExercise from './GuidedExercise'

/**
 * SessionRunner v2 (W0.5 / WP4) — the guided daily session experience.
 * Full-screen coached flow: intro → engine → interlude → … → report.
 * The runner OWNS pacing and persistence hand-off; engines own their exercise.
 * Plan: docs/plans/vision-training-interactive-overhaul.md
 */

const MUTE_KEY = 'vision-runner-muted'
const INTERLUDE_SECONDS = 20

type RunnerStage =
  | { kind: 'intro' }
  | { kind: 'exercise'; index: number }
  | { kind: 'interlude'; nextIndex: number }
  | { kind: 'report' }

export interface SessionRunnerFinishPayload {
  results: EngineResult[]
  skipped: string[]
  totalScore: number
  performedExerciseIds: string[]
}

interface SessionRunnerProps {
  exerciseIds: string[]
  week: number
  day: number
  phase: string
  sessionTitle: string
  sessionFocus: string
  coachingCues: string[]
  streakDays?: number
  onFinish: (payload: SessionRunnerFinishPayload) => void
  onExit: () => void
}

const ENCOURAGEMENTS_HIGH = ['Outstanding.', 'Elite work.', 'Your eyes are learning fast.']
const ENCOURAGEMENTS_MID = ['Solid rep. Keep stacking.', 'Good work — consistency wins.', 'Nice. Progress is progress.']
const ENCOURAGEMENTS_LOW = ['Showing up is the win today.', 'Every session rewires. Done is what counts.']

function encouragementFor(score: number, index: number): string {
  const pool = score >= 80 ? ENCOURAGEMENTS_HIGH : score >= 50 ? ENCOURAGEMENTS_MID : ENCOURAGEMENTS_LOW
  return pool[index % pool.length]
}

/** Pick the single most interesting metric to headline on the report row. */
function headlineMetric(result: EngineResult): string | null {
  const m = result.metrics
  if (m.accuracyPct !== undefined) return `${Math.round(m.accuracyPct)}% accuracy`
  if (m.peakBpm !== undefined) return `peaked at ${Math.round(m.peakBpm)} bpm`
  if (m.smoothnessScore !== undefined) return `smoothness ${Math.round(m.smoothnessScore)}`
  if (m.meanReactionMs !== undefined) return `${Math.round(m.meanReactionMs)} ms reaction`
  if (m.npcCm !== undefined) return `near point ${m.npcCm} cm`
  if (m.smallestClearLine !== undefined) return `line ${m.smallestClearLine} clear`
  if (m.cyclesCompleted !== undefined) return `${m.cyclesCompleted} cycles`
  return null
}

export default function SessionRunner({
  exerciseIds,
  week,
  day,
  phase,
  sessionTitle,
  sessionFocus,
  coachingCues,
  streakDays = 0,
  onFinish,
  onExit,
}: SessionRunnerProps) {
  const [stage, setStage] = useState<RunnerStage>({ kind: 'intro' })
  const [results, setResults] = useState<EngineResult[]>([])
  const [skipped, setSkipped] = useState<string[]>([])
  const [muted, setMuted] = useState(false)
  const [interludeLeft, setInterludeLeft] = useState(INTERLUDE_SECONDS)
  const [confirmExit, setConfirmExit] = useState(false)
  const [mounted, setMounted] = useState(false)

  const speechRef = useRef<SpeechQueue | null>(null)
  const resultsRef = useRef<EngineResult[]>([])
  const skippedRef = useRef<string[]>([])

  const exercises: VisionExercise[] = useMemo(
    () => exerciseIds.map(id => visionExerciseMap[id]).filter(Boolean),
    [exerciseIds],
  )

  useEffect(() => {
    setMounted(true)
    speechRef.current = new SpeechQueue()
    const storedMute = typeof window !== 'undefined' && window.localStorage.getItem(MUTE_KEY) === 'true'
    setMuted(storedMute)
    if (speechRef.current) speechRef.current.muted = storedMute
    return () => speechRef.current?.stop()
  }, [])

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev
      if (speechRef.current) speechRef.current.muted = next
      if (typeof window !== 'undefined') window.localStorage.setItem(MUTE_KEY, String(next))
      return next
    })
  }, [])

  const speak = useCallback((text: string, interrupt = false) => {
    speechRef.current?.speak(text, { interrupt })
  }, [])

  // Interlude countdown
  useEffect(() => {
    if (stage.kind !== 'interlude') return
    setInterludeLeft(INTERLUDE_SECONDS)
    const t = setInterval(() => {
      setInterludeLeft(prev => {
        if (prev <= 1) {
          clearInterval(t)
          setStage({ kind: 'exercise', index: stage.nextIndex })
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [stage])

  const totalScore = useMemo(() => {
    if (results.length === 0) return 0
    return Math.round(results.reduce((a, r) => a + r.score, 0) / results.length)
  }, [results])

  const begin = useCallback(() => {
    unlockAudio()
    speak(`${sessionTitle}. ${exercises.length} exercises. I'll walk you through every one. Let's begin.`, true)
    setStage({ kind: 'exercise', index: 0 })
  }, [speak, sessionTitle, exercises.length])

  const advanceFrom = useCallback((index: number) => {
    if (index >= exercises.length - 1) {
      speak('Session complete. Look at what you just did.', true)
      setStage({ kind: 'report' })
    } else {
      setStage({ kind: 'interlude', nextIndex: index + 1 })
    }
  }, [exercises.length, speak])

  const handleEngineComplete = useCallback((index: number) => (result: EngineResult) => {
    resultsRef.current = [...resultsRef.current, result]
    setResults(resultsRef.current)
    speak(encouragementFor(result.score, index))
    advanceFrom(index)
  }, [advanceFrom, speak])

  const handleEngineExit = useCallback((index: number) => () => {
    const id = exercises[index]?.id
    if (id) {
      skippedRef.current = [...skippedRef.current, id]
      setSkipped(skippedRef.current)
    }
    advanceFrom(index)
  }, [advanceFrom, exercises])

  const finish = useCallback(() => {
    onFinish({
      results: resultsRef.current,
      skipped: skippedRef.current,
      totalScore,
      performedExerciseIds: resultsRef.current.filter(r => r.completed).map(r => r.exerciseId),
    })
  }, [onFinish, totalScore])

  const requestExit = useCallback(() => {
    if (resultsRef.current.length > 0 && stage.kind !== 'report') {
      setConfirmExit(true)
    } else if (stage.kind === 'report') {
      finish()
    } else {
      speechRef.current?.stop()
      onExit()
    }
  }, [stage, finish, onExit])

  if (!mounted) return null

  const dots = exercises.map((ex, i) => {
    const done = results.some(r => r.exerciseId === ex.id) || skipped.includes(ex.id)
    const active = stage.kind === 'exercise' && stage.index === i
    return (
      <div
        key={ex.id + i}
        className={`h-2 rounded-full transition-all duration-300 ${
          active ? 'w-6 bg-primary-400' : done ? 'w-2 bg-secondary-400' : 'w-2 bg-gray-600'
        }`}
      />
    )
  })

  const body = (
    <div className="fixed inset-0 z-[99998] bg-gradient-to-br from-gray-900 to-gray-800 flex flex-col overflow-hidden">
      {/* HUD */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/40 bg-gray-900/60 backdrop-blur-sm">
        <div className="flex items-center gap-2">{dots}</div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            aria-label={muted ? 'Unmute coach' : 'Mute coach'}
            className="p-2.5 rounded-lg bg-gray-800/60 hover:bg-gray-700/60 text-gray-300 transition-colors"
          >
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          <button
            onClick={requestExit}
            aria-label="Exit session"
            className="p-2.5 rounded-lg bg-gray-800/60 hover:bg-gray-700/60 text-gray-300 hover:text-red-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stage content */}
      <div className="flex-1 overflow-y-auto">
        {stage.kind === 'intro' && (
          <div className="min-h-full flex flex-col items-center justify-center px-6 py-10 text-center">
            <div className="text-xs font-semibold text-primary-400 uppercase tracking-widest mb-3">
              {phase} • Week {week}, Day {day}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">{sessionTitle}</h1>
            <p className="text-gray-300 max-w-md mb-6">{sessionFocus}</p>

            {streakDays > 0 && (
              <div className="flex items-center gap-2 mb-6 px-4 py-2 bg-orange-500/10 border border-orange-400/30 rounded-full">
                <Flame className="w-4 h-4 text-orange-400" />
                <span className="text-orange-200 text-sm font-semibold">{streakDays}-day streak on the line</span>
              </div>
            )}

            <div className="w-full max-w-sm space-y-2 mb-8">
              {exercises.map((ex, i) => (
                <div
                  key={ex.id}
                  className="flex items-center gap-3 bg-gray-800/50 backdrop-blur-sm rounded-xl px-4 py-3 border border-gray-700/40 text-left"
                >
                  <span className="w-6 h-6 rounded-full bg-primary-500/20 text-primary-300 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-white text-sm font-semibold truncate">{ex.title}</div>
                    <div className="text-gray-500 text-xs">{ex.duration} • {ex.category}</div>
                  </div>
                </div>
              ))}
            </div>

            {coachingCues.length > 0 && (
              <div className="flex items-start gap-2 max-w-sm mb-8 text-left">
                <Target className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                <p className="text-yellow-200/80 text-sm">{coachingCues[0]}</p>
              </div>
            )}

            <button
              onClick={begin}
              className="px-12 py-4 bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white font-bold text-lg rounded-2xl shadow-lg shadow-primary-500/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
            >
              <Play className="w-6 h-6" />
              Begin Session
            </button>

            <p className="text-gray-500 text-xs max-w-xs mt-6">
              Stop immediately if you feel pain, dizziness, double vision, or persistent blur —
              the X in the corner ends any exercise instantly. Strain is a signal, not a badge.
            </p>
          </div>
        )}

        {stage.kind === 'exercise' && (() => {
          const exercise = exercises[stage.index]
          if (!exercise) return null
          const Engine = getEngine(exercise.id)
          const prescription = resolvePrescription(exercise.id, week)
          return (
            <div className="min-h-full flex flex-col px-3 py-3 md:px-6 md:py-4">
              <div className="text-center mb-2">
                <span className="text-xs text-gray-500 uppercase tracking-wider">
                  Exercise {stage.index + 1} of {exercises.length}
                </span>
              </div>
              <div className="flex-1">
                {Engine ? (
                  <Engine
                    key={exercise.id + stage.index}
                    exercise={exercise}
                    prescription={prescription}
                    muted={muted}
                    onComplete={handleEngineComplete(stage.index)}
                    onExit={handleEngineExit(stage.index)}
                  />
                ) : (
                  /* v1 fallback — every exercise always runnable (never-strip) */
                  <GuidedExercise
                    key={exercise.id + stage.index}
                    exercise={exercise}
                    onComplete={() =>
                      handleEngineComplete(stage.index)({
                        exerciseId: exercise.id,
                        durationSec: prescription.targetSeconds,
                        completed: true,
                        score: 60,
                        metrics: {},
                      })
                    }
                    onBack={handleEngineExit(stage.index)}
                  />
                )}
              </div>
            </div>
          )
        })()}

        {stage.kind === 'interlude' && (() => {
          const next = exercises[stage.nextIndex]
          const progress = 1 - interludeLeft / INTERLUDE_SECONDS
          return (
            <div className="min-h-full flex flex-col items-center justify-center px-6 text-center">
              <div className="relative w-28 h-28 mb-6">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(75,85,99,0.4)" strokeWidth="6" />
                  <circle
                    cx="50" cy="50" r="44" fill="none"
                    stroke="rgb(63,191,181)" strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={`${Math.PI * 88}`}
                    strokeDashoffset={`${Math.PI * 88 * (1 - progress)}`}
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-white">
                  {interludeLeft}
                </div>
              </div>
              <div className="flex items-center gap-2 text-primary-300 mb-2">
                <Wind className="w-5 h-5" />
                <span className="font-semibold">Breathe easy. Blink softly.</span>
              </div>
              <p className="text-gray-400 text-sm mb-8">Let your eyes rest before the next round.</p>

              {next && (
                <div className="bg-gray-800/60 backdrop-blur-sm border border-primary-400/20 rounded-2xl px-6 py-4 max-w-sm mb-8">
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Up next</div>
                  <div className="text-white font-bold text-lg">{next.title}</div>
                  <p className="text-gray-400 text-sm mt-1">{next.summary}</p>
                </div>
              )}

              <button
                onClick={() => setStage({ kind: 'exercise', index: stage.nextIndex })}
                className="px-6 py-3 bg-gray-700/70 hover:bg-gray-600/70 text-white rounded-xl font-semibold flex items-center gap-2 transition-all"
              >
                <SkipForward className="w-4 h-4" />
                I&apos;m ready now
              </button>
            </div>
          )
        })()}

        {stage.kind === 'report' && (
          <div className="min-h-full flex flex-col items-center justify-center px-6 py-10">
            <Trophy className="w-16 h-16 text-secondary-400 mb-4" />
            <h2 className="text-3xl font-bold text-white mb-1">Session Complete</h2>
            <p className="text-gray-400 mb-6">{sessionTitle} — Week {week}, Day {day}</p>

            <div className="text-center mb-8">
              <div className="text-6xl font-black text-secondary-400">
                {totalScore}
              </div>
              <div className="text-gray-500 text-sm uppercase tracking-wider mt-1">Session score</div>
            </div>

            <div className="w-full max-w-sm space-y-2 mb-8">
              {exercises.map(ex => {
                const result = results.find(r => r.exerciseId === ex.id)
                const wasSkipped = skipped.includes(ex.id)
                const metric = result ? headlineMetric(result) : null
                return (
                  <div
                    key={ex.id}
                    className="flex items-center justify-between bg-gray-800/50 backdrop-blur-sm rounded-xl px-4 py-3 border border-gray-700/40"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {result ? (
                        <CheckCircle className="w-5 h-5 text-secondary-400 flex-shrink-0" />
                      ) : (
                        <SkipForward className="w-5 h-5 text-gray-600 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="text-white text-sm font-semibold truncate">{ex.title}</div>
                        {metric && <div className="text-gray-500 text-xs">{metric}</div>}
                        {wasSkipped && <div className="text-gray-600 text-xs">skipped</div>}
                      </div>
                    </div>
                    {result && (
                      <span className={`text-lg font-bold ${result.score >= 80 ? 'text-secondary-400' : result.score >= 50 ? 'text-primary-300' : 'text-gray-400'}`}>
                        {result.score}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            <button
              onClick={finish}
              className="px-12 py-4 bg-gradient-to-r from-secondary-500 to-primary-500 hover:from-secondary-600 hover:to-primary-600 text-white font-bold text-lg rounded-2xl shadow-lg shadow-secondary-500/30 transition-all flex items-center gap-2"
            >
              <ChevronRight className="w-5 h-5" />
              Log &amp; Finish
            </button>
          </div>
        )}
      </div>

      {/* Exit confirmation */}
      {confirmExit && (
        <div className="absolute inset-0 z-10 bg-black/70 backdrop-blur-sm flex items-center justify-center px-6">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-sm w-full text-center">
            <h3 className="text-white font-bold text-lg mb-2">End session early?</h3>
            <p className="text-gray-400 text-sm mb-6">
              You&apos;ve finished {results.length} exercise{results.length === 1 ? '' : 's'}. Log what you did, or keep going.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmExit(false)}
                className="flex-1 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-semibold transition-colors"
              >
                Keep going
              </button>
              <button
                onClick={finish}
                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-semibold transition-colors"
              >
                Log &amp; end
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  return createPortal(body, document.body)
}
