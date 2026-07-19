'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, LogOut, Pause, Play, Square, X } from 'lucide-react'
import { Metronome, SpeechQueue, unlockAudio } from '@/lib/vision/audioKit'
import { clampScore, type EngineProps } from './types'

const WALKING_BPM = 40
const STEPS_PER_LINE = 4
const LETTERS = ['O', 'Q', 'C', 'D', 'H', 'M', 'N', 'K', 'X', 'R', 'S', 'Z', 'V']
const DIRECTIONS = ['up', 'right', 'down', 'left'] as const

const CHART_LINES = [
  { label: 'Moderate', scale: 2, count: 3 },
  { label: 'Building', scale: 1.6, count: 4 },
  { label: 'Challenge', scale: 1.3, count: 5 },
  { label: 'Advanced', scale: 1, count: 5 },
  { label: 'Peak', scale: 0.8, count: 6 },
  { label: 'Elite', scale: 0.6, count: 7 },
  { label: 'Ultra', scale: 0.45, count: 8 },
] as const

type RunStatus = 'idle' | 'running' | 'paused' | 'complete'
type Assessment = 'clear' | 'blurry'
type ChartMode = 'letters' | 'e-directional'

type Optotype = {
  value: string
  direction?: (typeof DIRECTIONS)[number]
}

function makeLine(lineIndex: number, mode: ChartMode): Optotype[] {
  return Array.from({ length: CHART_LINES[lineIndex].count }, () => {
    if (mode === 'e-directional') {
      const direction = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)]
      return { value: 'E', direction }
    }

    return { value: LETTERS[Math.floor(Math.random() * LETTERS.length)] }
  })
}

function TumblingE({ direction, size }: { direction: NonNullable<Optotype['direction']>; size: number }) {
  const rotation = { right: 0, down: 90, left: 180, up: 270 }[direction]

  return (
    <svg
      aria-label={`E pointing ${direction}`}
      className="shrink-0 transition-transform duration-200"
      height={size}
      role="img"
      style={{ transform: `rotate(${rotation}deg)` }}
      viewBox="0 0 50 50"
      width={size}
    >
      <g fill="currentColor">
        <rect height="40" width="7" x="5" y="5" />
        <rect height="7" width="40" x="5" y="5" />
        <rect height="7" width="35" x="5" y="21.5" />
        <rect height="7" width="40" x="5" y="38" />
      </g>
    </svg>
  )
}

export default function SnellenWalksEngine({
  exercise,
  prescription,
  muted = false,
  onProgress,
  onComplete,
  onExit,
}: EngineProps) {
  const targetSeconds = Math.max(1, prescription.targetSeconds)
  const initialLineIndex = Math.min(CHART_LINES.length - 1, Math.max(0, prescription.phase - 1))
  const shouldSwitchMode = exercise.checkpoints.some((checkpoint) => /e-directional/i.test(checkpoint))

  const [status, setStatus] = useState<RunStatus>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [stepsCompleted, setStepsCompleted] = useState(0)
  const [lineIndex, setLineIndex] = useState(initialLineIndex)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [mode, setMode] = useState<ChartMode>('letters')
  const [optotypes, setOptotypes] = useState(() => makeLine(initialLineIndex, 'letters'))

  const [speech] = useState(() => new SpeechQueue()) // T7c: lazy init — useRef(new X()) constructed+registered a new SpeechQueue every render
  const metronomeRef = useRef<Metronome | null>(null)
  const beatGenerationRef = useRef(0)
  const completedRef = useRef(false)
  const elapsedRef = useRef(0)
  const stepsRef = useRef(0)
  const lineIndexRef = useRef(initialLineIndex)
  const smallestClearLineRef = useRef(0)
  const clearRoundsRef = useRef(0)
  const assessedRoundsRef = useRef(0)
  const assessmentRef = useRef<Assessment | null>(null)
  const modeRef = useRef<ChartMode>('letters')
  const finishRef = useRef<() => void>(() => undefined)

  const clearPct = assessedRoundsRef.current > 0
    ? Math.round((clearRoundsRef.current / assessedRoundsRef.current) * 100)
    : 0

  const finish = useCallback(() => {
    if (completedRef.current) return
    completedRef.current = true
    beatGenerationRef.current += 1
    metronomeRef.current?.stop()
    speech.stop()
    setStatus('complete')

    const finalClearPct = assessedRoundsRef.current > 0
      ? Math.round((clearRoundsRef.current / assessedRoundsRef.current) * 100)
      : 0
    const expectedLine = Math.min(CHART_LINES.length, Math.max(1, prescription.phase))

    onComplete({
      exerciseId: exercise.id,
      durationSec: Math.min(targetSeconds, elapsedRef.current),
      completed: true,
      score: clampScore((smallestClearLineRef.current / expectedLine) * 100),
      metrics: {
        smallestClearLine: smallestClearLineRef.current,
        stepsCompleted: stepsRef.current,
        clearPct: finalClearPct,
      },
    })
  }, [exercise.id, onComplete, prescription.phase, targetSeconds])

  finishRef.current = finish

  const handleBeat = useCallback(() => {
    const nextSteps = stepsRef.current + 1
    stepsRef.current = nextSteps
    setStepsCompleted(nextSteps)
    setHighlightIndex((current) => (current + 1) % CHART_LINES[lineIndexRef.current].count)

    if ((nextSteps - 1) % STEPS_PER_LINE === 0) {
      speech.speak('Step... read the line... next step')
    }

    let nextLineIndex = lineIndexRef.current
    if (nextSteps % STEPS_PER_LINE === 0 && assessmentRef.current) {
      assessedRoundsRef.current += 1

      if (assessmentRef.current === 'clear') {
        clearRoundsRef.current += 1
        smallestClearLineRef.current = Math.max(smallestClearLineRef.current, lineIndexRef.current + 1)
        nextLineIndex = Math.min(CHART_LINES.length - 1, lineIndexRef.current + 1)
      } else {
        nextLineIndex = Math.max(0, lineIndexRef.current - 1)
      }

      assessmentRef.current = null
      lineIndexRef.current = nextLineIndex
      setAssessment(null)
      setLineIndex(nextLineIndex)
      setHighlightIndex(0)
      setOptotypes(makeLine(nextLineIndex, modeRef.current))
    }

    const nextClearPct = assessedRoundsRef.current > 0
      ? Math.round((clearRoundsRef.current / assessedRoundsRef.current) * 100)
      : 0

    onProgress?.({
      smallestClearLine: smallestClearLineRef.current,
      stepsCompleted: nextSteps,
      clearPct: nextClearPct,
    })
  }, [onProgress])

  useEffect(() => {
    speech.muted = muted
    if (metronomeRef.current) metronomeRef.current.muted = muted
  }, [muted])

  useEffect(() => {
    if (status !== 'running') return

    const generation = ++beatGenerationRef.current
    const metronome = new Metronome(WALKING_BPM, () => {
      if (beatGenerationRef.current === generation) handleBeat()
    })
    metronome.muted = muted
    metronomeRef.current = metronome
    metronome.start()

    return () => {
      metronome.stop()
      if (beatGenerationRef.current === generation) beatGenerationRef.current += 1
    }
  }, [handleBeat, muted, status])

  useEffect(() => {
    if (status !== 'running') return

    const timer = window.setInterval(() => {
      const nextElapsed = Math.min(targetSeconds, elapsedRef.current + 1)
      elapsedRef.current = nextElapsed
      setElapsed(nextElapsed)

      if (shouldSwitchMode && modeRef.current === 'letters' && nextElapsed >= targetSeconds / 2) {
        modeRef.current = 'e-directional'
        setMode('e-directional')
        setHighlightIndex(0)
        setOptotypes(makeLine(lineIndexRef.current, 'e-directional'))
        speech.speak('Now read the direction of each E.', { interrupt: true })
      }

      if (nextElapsed >= targetSeconds) finishRef.current()
    }, 1000)

    return () => window.clearInterval(timer)
  }, [shouldSwitchMode, status, targetSeconds])

  useEffect(() => () => {
    beatGenerationRef.current += 1
    metronomeRef.current?.stop()
    speech.stop()
  }, [])

  const startOrResume = () => {
    unlockAudio()
    if (status === 'idle') {
      speech.speak('Hold your phone securely. Keep your path clear and walk slowly.', { interrupt: true })
    }
    setStatus('running')
  }

  const pause = () => {
    beatGenerationRef.current += 1
    metronomeRef.current?.stop()
    speech.stop()
    setStatus('paused')
  }

  const recordAssessment = (value: Assessment) => {
    if (status !== 'running' && status !== 'paused') return
    assessmentRef.current = value
    setAssessment(value)
  }

  const handleExit = () => {
    beatGenerationRef.current += 1
    metronomeRef.current?.stop()
    speech.stop()
    setStatus('paused')
    onExit()
  }

  const remaining = Math.max(0, targetSeconds - elapsed)
  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60
  const optotypeSize = Math.max(
    24,
    Math.min(Math.round(58 * CHART_LINES[lineIndex].scale), Math.floor(320 / CHART_LINES[lineIndex].count))
  )

  return (
    <section className="mx-auto flex min-h-[min(760px,100dvh)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-primary-400/20 bg-gradient-to-br from-gray-800/80 to-gray-900/80 text-white shadow-xl backdrop-blur-sm">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-gray-900/70 px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-300">Walking Snellen</p>
          <h2 className="text-lg font-bold">{exercise.title}</h2>
        </div>
        <button
          aria-label="Exit exercise"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-red-600/90 text-white transition hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
          onClick={handleExit}
          type="button"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      <div className="grid grid-cols-3 gap-2 px-4 py-3 text-center text-sm">
        <div className="rounded-lg bg-gray-800/70 p-2">
          <p className="text-xs text-gray-400">Time left</p>
          <p className="font-bold tabular-nums">{minutes}:{seconds.toString().padStart(2, '0')}</p>
        </div>
        <div className="rounded-lg bg-gray-800/70 p-2">
          <p className="text-xs text-gray-400">Steps</p>
          <p className="font-bold">{stepsCompleted}</p>
        </div>
        <div className="rounded-lg bg-gray-800/70 p-2">
          <p className="text-xs text-gray-400">Clear</p>
          <p className="font-bold text-secondary-300">{clearPct}%</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4">
        <div className="mb-3 flex items-center justify-between text-xs text-gray-300">
          <span>Line {lineIndex + 1}: {CHART_LINES[lineIndex].label}</span>
          <span>{mode === 'letters' ? 'Read letters' : 'Call the E direction'} · {WALKING_BPM} bpm{muted ? ' · muted' : ''}</span>
        </div>

        <div className="flex min-h-56 flex-1 items-center justify-center overflow-hidden rounded-xl bg-white px-2 py-8 text-black shadow-inner">
          <div className="flex max-w-full items-center justify-center gap-1 sm:gap-2" aria-live="polite">
            {optotypes.map((optotype, index) => (
              <div
                className={`flex items-center justify-center rounded-md px-0.5 transition-all duration-200 ${
                  index === highlightIndex
                    ? 'scale-110 bg-primary-100 ring-4 ring-primary-500'
                    : 'opacity-55'
                }`}
                key={`${mode}-${lineIndex}-${index}-${optotype.value}-${optotype.direction ?? ''}`}
              >
                {optotype.direction ? (
                  <TumblingE direction={optotype.direction} size={optotypeSize} />
                ) : (
                  <span
                    className="select-none font-sans font-medium leading-none"
                    style={{ fontSize: `${optotypeSize * 0.8}px` }}
                  >
                    {optotype.value}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <p className="my-3 text-center text-sm text-gray-300">
          Tap what you see now. Your choice adjusts the line after every {STEPS_PER_LINE} steps.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <button
            aria-pressed={assessment === 'clear'}
            className={`flex min-h-16 items-center justify-center gap-2 rounded-xl border text-lg font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-300 ${
              assessment === 'clear'
                ? 'border-secondary-300 bg-secondary-500 text-white shadow-lg shadow-secondary-500/20'
                : 'border-secondary-400/40 bg-secondary-500/20 text-secondary-200 hover:bg-secondary-500/30'
            } disabled:cursor-not-allowed disabled:opacity-40`}
            disabled={status === 'idle' || status === 'complete'}
            onClick={() => recordAssessment('clear')}
            type="button"
          >
            <Check className="h-6 w-6" />
            Clear
          </button>
          <button
            aria-pressed={assessment === 'blurry'}
            className={`flex min-h-16 items-center justify-center gap-2 rounded-xl border text-lg font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 ${
              assessment === 'blurry'
                ? 'border-primary-300 bg-primary-600 text-white shadow-lg shadow-primary-500/20'
                : 'border-primary-400/40 bg-primary-500/20 text-primary-200 hover:bg-primary-500/30'
            } disabled:cursor-not-allowed disabled:opacity-40`}
            disabled={status === 'idle' || status === 'complete'}
            onClick={() => recordAssessment('blurry')}
            type="button"
          >
            <X className="h-6 w-6" />
            Blurry
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          {status === 'running' ? (
            <button className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-yellow-500 font-semibold text-gray-950 transition hover:bg-yellow-400" onClick={pause} type="button">
              <Pause className="h-5 w-5" /> Pause
            </button>
          ) : status !== 'complete' ? (
            <button className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-secondary-500 font-semibold text-white transition hover:bg-secondary-400" onClick={startOrResume} type="button">
              <Play className="h-5 w-5" /> {status === 'paused' ? 'Resume' : 'Start walking'}
            </button>
          ) : (
            <div className="flex min-h-12 items-center justify-center rounded-xl bg-secondary-500/20 font-semibold text-secondary-300">Complete</div>
          )}

          <button
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gray-700 font-semibold text-white transition hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={status === 'idle' || status === 'complete'}
            onClick={finish}
            type="button"
          >
            <Square className="h-5 w-5" /> Finish
          </button>
        </div>

        <p className="mt-3 text-center text-xs text-gray-400">Keep your path clear. Stop walking before tapping controls if needed.</p>
      </div>
    </section>
  )
}
