'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, CheckCircle, Clock, Pause, Play, RotateCcw, Trophy, Volume2, VolumeX } from 'lucide-react'
import type {
  ExerciseEngineDefinition,
  ExerciseEngineResult,
  ExerciseLifecyclePhase,
  SessionRunnerResult,
  SessionRunnerSaveContext,
} from './types'
import type { VisionExercise } from '@/data/visionExercises'

interface SessionRunnerItem {
  exercise: VisionExercise
  engine: ExerciseEngineDefinition
}

interface SessionRunnerProps {
  items: SessionRunnerItem[]
  deviceMode?: 'phone' | 'desktop'
  difficulty?: 'starter' | 'standard' | 'challenge' | 'advanced'
  reducedMotion?: boolean
  saveContext?: SessionRunnerSaveContext
  onComplete?: (result: SessionRunnerResult) => void
  onBack?: () => void
}

export default function SessionRunner({
  items,
  deviceMode = 'phone',
  difficulty = 'standard',
  reducedMotion = false,
  saveContext,
  onComplete,
  onBack,
}: SessionRunnerProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [phase, setPhase] = useState<ExerciseLifecyclePhase>(() => getInitialPhase(items[0]?.engine))
  const [isPaused, setIsPaused] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [activeSeconds, setActiveSeconds] = useState(0)
  const [results, setResults] = useState<ExerciseEngineResult[]>([])
  const [sessionElapsed, setSessionElapsed] = useState(0)
  const [muted, setMuted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null)

  const currentItem = items[currentIndex]
  const currentDuration = currentItem?.engine.defaultDurationSeconds || 180
  const remainingSeconds = Math.max(0, currentDuration - elapsedSeconds)
  const progress = currentDuration > 0 ? Math.min(100, (elapsedSeconds / currentDuration) * 100) : 0
  const EngineComponent = currentItem?.engine.component
  const displayOptions = currentItem?.engine.displayOptions || {}

  const completedIds = useMemo(() => results.map((result) => result.exerciseId), [results])

  useEffect(() => {
    sessionTimerRef.current = setInterval(() => {
      setSessionElapsed((value) => value + 1)
    }, 1000)

    return () => {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (phase !== 'active' || isPaused) return

    const timer = setInterval(() => {
      setElapsedSeconds((value) => {
        const next = value + 1
        if (next >= currentDuration) {
          window.setTimeout(() => completeCurrent(), 0)
        }
        return next
      })
      setActiveSeconds((value) => value + 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [phase, isPaused, currentDuration])

  useEffect(() => {
    if (muted || typeof window === 'undefined' || !currentItem) return
    if (!('speechSynthesis' in window)) return

    const text = phase === 'intro'
      ? `Prepare for ${currentItem.exercise.title}.`
      : phase === 'active'
        ? `Begin ${currentItem.exercise.title}.`
        : phase === 'cooldown'
          ? 'Cooldown. Blink and soften your gaze.'
          : `${currentItem.exercise.title} complete.`

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.92
    utterance.volume = 0.75
    window.speechSynthesis.speak(utterance)
  }, [phase, currentItem, muted])

  if (!currentItem || !EngineComponent) {
    return (
      <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-8 border border-primary-400/20 text-center">
        <Trophy className="w-14 h-14 text-secondary-400 mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-white mb-2">Session Complete</h3>
        <p className="text-gray-300 mb-6">All available engines in this session are finished.</p>
        {saveError && <p className="text-red-300 text-sm mb-4">{saveError}</p>}
        {onBack && (
          <button
            onClick={onBack}
            className="px-6 py-3 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold"
          >
            Back to session
          </button>
        )}
      </div>
    )
  }

  const controls = {
    phase,
    isPaused,
    elapsedSeconds,
    remainingSeconds,
    progress,
    pause: () => setIsPaused(true),
    resume: () => setIsPaused(false),
    restart: restartCurrent,
    complete: completeCurrent,
  }

  function startCurrent() {
    setPhase('active')
    setIsPaused(false)
  }

  function restartCurrent() {
    setElapsedSeconds(0)
    setActiveSeconds(0)
    setPhase(getInitialPhase(currentItem?.engine))
    setIsPaused(false)
  }

  async function completeCurrent(partial?: Partial<ExerciseEngineResult>) {
    if (!currentItem) return

    const result: ExerciseEngineResult = {
      exerciseId: currentItem.exercise.id,
      exerciseTitle: currentItem.exercise.title,
      completed: true,
      completionMode: currentItem.engine.measurable ? 'performance' : 'subjective',
      durationSeconds: elapsedSeconds,
      activeSeconds,
      metrics: {},
      finishedAt: new Date().toISOString(),
      ...partial,
    }

    const nextResults = [...results.filter((item) => item.exerciseId !== result.exerciseId), result]
    setResults(nextResults)
    setPhase('result')

    if (currentIndex < items.length - 1) {
      window.setTimeout(() => {
        const nextItem = items[currentIndex + 1]
        setCurrentIndex((index) => index + 1)
        setElapsedSeconds(0)
        setActiveSeconds(0)
        setPhase(getInitialPhase(nextItem?.engine))
        setIsPaused(false)
      }, 900)
      return
    }

    await finishSession(nextResults)
  }

  async function finishSession(finalResults: ExerciseEngineResult[]) {
    setSaving(true)
    setSaveError(null)

    let didSave = false
    try {
      if (saveContext) {
        const response = await fetch('/api/vision/program', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'complete_session',
            data: {
              week: saveContext.week,
              day: saveContext.day,
              baselineMinutes: saveContext.baselineMinutes,
              exerciseMinutes: saveContext.exerciseMinutes,
              breathWarmupMinutes: saveContext.breathWarmupMinutes ?? 0,
              exercisesCompleted: finalResults.map((result) => result.exerciseId),
              nearSnellenResult: saveContext.nearSnellenResult || null,
              farSnellenResult: saveContext.farSnellenResult || null,
              notes: buildSessionNotes(saveContext.notes, finalResults),
            },
          }),
        })

        if (!response.ok) {
          const body = await response.json().catch(() => null)
          throw new Error(body?.error || 'Unable to save vision session')
        }
        didSave = true
        setSaved(true)
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save vision session')
    } finally {
      setSaving(false)
    }

    onComplete?.({
      totalDurationSeconds: sessionElapsed,
      activeDurationSeconds: finalResults.reduce((sum, item) => sum + item.activeSeconds, 0),
      exercisesCompleted: finalResults.map((result) => result.exerciseId),
      engineResults: finalResults,
      saved: didSave,
    })
  }

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-5 border border-primary-400/20 shadow-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-primary-300 font-semibold">
              Engine {currentIndex + 1} of {items.length}
            </div>
            <h2 className="text-2xl font-bold text-white mt-1">{currentItem.exercise.title}</h2>
            <p className="text-gray-300 text-sm mt-1">{currentItem.engine.label} engine</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setMuted((value) => !value)}
              className="p-3 rounded-lg bg-gray-800/70 text-gray-200 hover:bg-gray-700/80"
              title={muted ? 'Turn audio cues on' : 'Mute audio cues'}
            >
              {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <button
              onClick={restartCurrent}
              className="p-3 rounded-lg bg-gray-800/70 text-gray-200 hover:bg-gray-700/80"
              title="Restart this engine"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            {phase === 'intro' ? (
              <button
                onClick={startCurrent}
                className="px-5 py-3 rounded-lg bg-gradient-to-r from-primary-500 to-secondary-500 text-white font-bold flex items-center gap-2"
              >
                <Play className="w-5 h-5" />
                Start Engine
              </button>
            ) : (
              <button
                onClick={isPaused ? controls.resume : controls.pause}
                disabled={phase !== 'active'}
                className="px-5 py-3 rounded-lg bg-primary-600 disabled:opacity-50 text-white font-bold flex items-center gap-2"
              >
                {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                {isPaused ? 'Resume' : 'Pause'}
              </button>
            )}
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            {displayOptions.hideNumericTimer ? (
              <>
                <span>Guided phase flow</span>
                <span>{Math.round(progress)}% complete</span>
              </>
            ) : (
              <>
                <span>{formatTime(elapsedSeconds)} / {formatTime(currentDuration)}</span>
                <span>{Math.round(progress)}%</span>
              </>
            )}
          </div>
          <div className="h-2 rounded-full overflow-hidden bg-gray-700">
            <div
              className="h-full bg-gradient-to-r from-primary-500 to-secondary-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-3">
          {items.map((item, index) => (
            <div
              key={item.exercise.id}
              className={`rounded-lg border px-3 py-2 text-sm ${
                completedIds.includes(item.exercise.id)
                  ? 'border-secondary-400/40 bg-secondary-500/10 text-secondary-200'
                  : index === currentIndex
                    ? 'border-primary-400/50 bg-primary-500/10 text-white'
                    : 'border-gray-700/50 bg-gray-900/40 text-gray-400'
              }`}
            >
              <div className="flex items-center gap-2">
                {completedIds.includes(item.exercise.id) ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                {item.exercise.title}
              </div>
            </div>
          ))}
        </div>
      </div>

      <EngineComponent
        exercise={currentItem.exercise}
        difficulty={difficulty}
        durationSeconds={currentDuration}
        deviceMode={deviceMode}
        reducedMotion={reducedMotion}
        controls={controls}
        onPhaseChange={setPhase}
      />

      {phase === 'result' && (
        <div className="bg-secondary-600/15 border border-secondary-400/30 rounded-xl p-4 text-secondary-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Engine result captured.
          </div>
          {currentIndex < items.length - 1 && (
            <div className="flex items-center gap-2 text-sm">
              Next engine
              <ArrowRight className="w-4 h-4" />
            </div>
          )}
        </div>
      )}

      {(saving || saved || saveError) && (
        <div className="rounded-xl border border-primary-400/20 bg-gray-900/70 p-4 text-sm">
          {saving && <span className="text-gray-300">Saving session record...</span>}
          {saved && <span className="text-secondary-300">Session record saved.</span>}
          {saveError && <span className="text-red-300">{saveError}</span>}
        </div>
      )}
    </div>
  )
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function getInitialPhase(engine?: ExerciseEngineDefinition): ExerciseLifecyclePhase {
  return engine?.displayOptions?.autoStart ? 'active' : 'intro'
}

function buildSessionNotes(notes: string | null | undefined, results: ExerciseEngineResult[]) {
  const engineSummary = results
    .map((result) => `${result.exerciseTitle}: ${result.activeSeconds}s active, ${Object.entries(result.metrics).map(([key, value]) => `${key}=${value}`).join(', ') || 'completed'}`)
    .join(' | ')

  return [notes, `Engine results: ${engineSummary}`].filter(Boolean).join('\n')
}
