'use client'

/**
 * GABOR_THRESHOLD_V1 runner. The psychophysical controller and presentation
 * formulas live in gaborThreshold.ts; this component only schedules, renders,
 * binds responses, and reports the locked result.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Pause, Play, ShieldAlert, Volume2, VolumeX, X } from 'lucide-react'
import type { EngineProps, EngineResult } from './types'
import { clampScore } from './types'
import { drawGaborPatch, fitCanvasToElement, prefersReducedMotion } from '@/lib/vision/canvasKit'
import { SpeechQueue, getSharedMuted, subscribeSharedMuted, unlockAudio } from '@/lib/vision/audioKit'
import {
  GABOR_THRESHOLD_PROTOCOL,
  applyGaborProductionResponse,
  createGaborProductionCoordinator,
  getGaborProductionProgress,
  presentNextGaborExposure,
  type GaborPresentationResponse,
  type GaborProductionCoordinator,
  type GaborResolvedPresentation,
} from '@/lib/vision/gaborThreshold'

const ORIENTATIONS = {
  vertical: { angle: 0, label: 'Vertical', glyph: '|', ariaLabel: 'Vertical' },
  'diagonal-left': { angle: 45, label: 'Diagonal', glyph: '/', ariaLabel: 'Diagonal rising /' },
  'diagonal-right': { angle: 135, label: 'Diagonal', glyph: '\\', ariaLabel: 'Diagonal falling \\' },
  horizontal: { angle: 90, label: 'Horizontal', glyph: '—', ariaLabel: 'Horizontal' },
} as const
type OrientationKey = keyof typeof ORIENTATIONS

const STIMULUS_TIMEOUT_MS = 10_000
const CATCH_WINDOW_MS = 1_500
const FEEDBACK_MS = 700
const TIME_CAP_SECONDS = 180
const LAPSES_TO_PAUSE = 2
const NEUTRAL_FIELD = '#808080'

type Phase = 'intro' | 'trial' | 'feedback' | 'paused' | 'complete'
type PauseReason = 'manual' | 'lapse' | null
type Feedback = 'correct' | 'wrong' | 'timeout' | null

function formatTime(totalSec: number): string {
  const seconds = Math.max(0, Math.round(totalSec))
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`
}

export default function GaborAcuityEngine({ exercise, onProgress, onComplete, onExit }: EngineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const speechRef = useRef<SpeechQueue | null>(null)
  if (!speechRef.current) speechRef.current = new SpeechQueue()

  const reducedMotion = useMemo(() => prefersReducedMotion(), [])
  const isMuted = useSyncExternalStore(subscribeSharedMuted, getSharedMuted, getSharedMuted)
  const [phase, setPhaseState] = useState<Phase>('intro')
  const phaseRef = useRef<Phase>('intro')
  const [pauseReason, setPauseReason] = useState<PauseReason>(null)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [elapsedDisplay, setElapsedDisplay] = useState(0)
  const [statsDisplay, setStatsDisplay] = useState({ exposures: 0, responses: 0, reversals: 0, accuracyPct: 0 })

  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next
    setPhaseState(next)
  }, [])

  const seedRef = useRef<string>(GABOR_THRESHOLD_PROTOCOL.id)
  const coordinatorRef = useRef<GaborProductionCoordinator>(createGaborProductionCoordinator({
    seed: seedRef.current,
    prior: null,
  }))
  const completedRef = useRef(false)
  const resumeStartsNextRef = useRef(false)

  const trialTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const startWallRef = useRef<number | null>(null)
  const pausedAccumRef = useRef(0)
  const pauseStartRef = useRef<number | null>(null)

  const finishRef = useRef<() => void>(() => {})
  const startNextRef = useRef<() => void>(() => {})
  const finalizeResponseRef = useRef<(response: GaborPresentationResponse) => void>(() => {})

  const clearTrialTimer = useCallback(() => {
    if (trialTimeoutRef.current) clearTimeout(trialTimeoutRef.current)
    trialTimeoutRef.current = undefined
  }, [])

  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current)
    advanceTimeoutRef.current = undefined
  }, [])

  const elapsedSeconds = useCallback(() => {
    if (startWallRef.current === null) return 0
    const now = performance.now()
    const paused = pausedAccumRef.current + (pauseStartRef.current === null ? 0 : now - pauseStartRef.current)
    return Math.max(0, (now - startWallRef.current - paused) / 1000)
  }, [])

  const drawPresentation = useCallback((presentation: GaborResolvedPresentation | null) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { width, height } = fitCanvasToElement(canvas)
    const ctx = canvas.getContext('2d')
    if (!ctx || width <= 0 || height <= 0) return
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = NEUTRAL_FIELD
    ctx.fillRect(0, 0, width, height)
    if (!presentation?.stimulusPresent
      || presentation.orientationDegrees === null
      || presentation.spatialFrequencyCyclesPerPatch === null) return

    const size = Math.max(126, Math.min(196, Math.min(width, height) * 0.42))
    const frequency = presentation.spatialFrequencyCyclesPerPatch
    const sigma = size / frequency
    const cx = width / 2
    const cy = height / 2
    const common = {
      size,
      orientation: presentation.orientationDegrees,
      frequency,
      sigma,
      phase: presentation.phaseDegrees ?? 0,
      rasterMode: 'mean-matched-opaque' as const,
    }

    if (!presentation.flankers) {
      drawGaborPatch(ctx, cx, cy, { ...common, contrast: presentation.contrastPct / 100 })
      return
    }

    // Opaque mean-matched tiles cannot alpha-stack. Partition the collinear
    // axis at equal-distance boundaries; same-phase Gabors meet continuously
    // there, so every patch remains visible without a square or double alpha.
    const stripeAxis = ((presentation.orientationDegrees + 90) * Math.PI) / 180
    const axisX = Math.cos(stripeAxis)
    const axisY = Math.sin(stripeAxis)
    const perpendicularX = -axisY
    const perpendicularY = axisX
    const distance = presentation.flankers.centerOffsetWavelengths * (size / frequency)
    const extent = Math.max(width, height) * 2
    const drawCell = (centerOffset: number, minAlongAxis: number, maxAlongAxis: number, contrast: number) => {
      const point = (alongAxis: number, perpendicular: number) => ({
        x: cx + axisX * alongAxis + perpendicularX * perpendicular,
        y: cy + axisY * alongAxis + perpendicularY * perpendicular,
      })
      const corners = [
        point(minAlongAxis, -extent),
        point(maxAlongAxis, -extent),
        point(maxAlongAxis, extent),
        point(minAlongAxis, extent),
      ]
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(corners[0].x, corners[0].y)
      for (const corner of corners.slice(1)) ctx.lineTo(corner.x, corner.y)
      ctx.closePath()
      ctx.clip()
      drawGaborPatch(ctx, cx + axisX * centerOffset, cy + axisY * centerOffset, { ...common, contrast })
      ctx.restore()
    }
    drawCell(-distance, -extent, -distance / 2, presentation.flankers.contrastPct / 100)
    drawCell(0, -distance / 2, distance / 2, presentation.contrastPct / 100)
    drawCell(distance, distance / 2, extent, presentation.flankers.contrastPct / 100)
  }, [])

  const publishProgress = useCallback((coordinator: GaborProductionCoordinator) => {
    const progress = getGaborProductionProgress(coordinator)
    setStatsDisplay({
      exposures: progress.totalExposures,
      responses: progress.measurementResponses,
      reversals: progress.reversals,
      accuracyPct: progress.accuracyPct,
    })
    onProgress?.(progress)
  }, [onProgress])

  const finish = useCallback(() => {
    if (completedRef.current) return
    const terminal = coordinatorRef.current.terminal
    if (!terminal) return
    completedRef.current = true
    clearTrialTimer()
    clearAdvanceTimer()
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current)
    tickIntervalRef.current = undefined
    speechRef.current?.stop()

    const result: EngineResult = {
      exerciseId: exercise.id,
      durationSec: Math.round(elapsedSeconds()),
      completed: terminal.resultCompleted,
      score: terminal.resultCompleted ? clampScore(terminal.scorePct) : 0,
      metrics: terminal.metrics,
    }
    const progress = getGaborProductionProgress(coordinatorRef.current)
    setStatsDisplay({
      exposures: progress.totalExposures,
      responses: progress.measurementResponses,
      reversals: progress.reversals,
      accuracyPct: progress.accuracyPct,
    })
    setPhase('complete')
    onComplete(result)
  }, [clearAdvanceTimer, clearTrialTimer, elapsedSeconds, exercise.id, onComplete, setPhase])
  finishRef.current = finish

  const armResponseWindow = useCallback((presentation: GaborResolvedPresentation) => {
    clearTrialTimer()
    trialTimeoutRef.current = setTimeout(
      () => finalizeResponseRef.current({ type: 'timeout' }),
      presentation.stimulusPresent ? STIMULUS_TIMEOUT_MS : CATCH_WINDOW_MS,
    )
  }, [clearTrialTimer])

  const startNextPresentation = useCallback(() => {
    if (completedRef.current) return
    const next = presentNextGaborExposure(coordinatorRef.current, {
      timeCapReached: elapsedSeconds() >= TIME_CAP_SECONDS,
    })
    coordinatorRef.current = next
    publishProgress(next)
    if (next.terminal) {
      finishRef.current()
      return
    }
    const pending = next.pending
    if (!pending) return
    setFeedback(null)
    setPhase('trial')
    drawPresentation(pending.presentation)
    armResponseWindow(pending.presentation)
  }, [armResponseWindow, drawPresentation, elapsedSeconds, publishProgress, setPhase])
  startNextRef.current = startNextPresentation

  const finalizeResponse = useCallback((response: GaborPresentationResponse) => {
    if (completedRef.current || phaseRef.current !== 'trial') return
    clearTrialTimer()
    const next = applyGaborProductionResponse(coordinatorRef.current, response, {
      timeCapReached: elapsedSeconds() >= TIME_CAP_SECONDS,
    })
    if (next === coordinatorRef.current) return
    coordinatorRef.current = next
    const classified = next.lastResponse
    if (!classified) return
    setFeedback(classified.lapse ? 'timeout' : classified.correct ? 'correct' : 'wrong')
    setPhase('feedback')
    publishProgress(next)

    if (next.terminal) {
      finishRef.current()
      return
    }
    if (classified.lapse && next.counters.consecutiveLapses >= LAPSES_TO_PAUSE) {
      pauseStartRef.current = performance.now()
      resumeStartsNextRef.current = true
      setPauseReason('lapse')
      setPhase('paused')
      speechRef.current?.speak('Still with me? Tap resume when ready.', { interrupt: true })
      return
    }
    clearAdvanceTimer()
    advanceTimeoutRef.current = setTimeout(() => startNextRef.current(), FEEDBACK_MS)
  }, [clearAdvanceTimer, clearTrialTimer, elapsedSeconds, publishProgress, setPhase])
  finalizeResponseRef.current = finalizeResponse

  const start = useCallback(() => {
    if (phaseRef.current !== 'intro') return
    unlockAudio()
    seedRef.current = `${GABOR_THRESHOLD_PROTOCOL.id}:${Date.now()}`
    coordinatorRef.current = createGaborProductionCoordinator({ seed: seedRef.current, prior: null })
    completedRef.current = false
    pausedAccumRef.current = 0
    pauseStartRef.current = null
    startWallRef.current = performance.now()
    speechRef.current?.speak('Choose the stripe direction, or choose no pattern when the field is blank.', { interrupt: true })
    startNextRef.current()
    tickIntervalRef.current = setInterval(() => {
      if (completedRef.current) return
      const elapsed = elapsedSeconds()
      setElapsedDisplay(elapsed)
      if (elapsed >= TIME_CAP_SECONDS) {
        coordinatorRef.current = presentNextGaborExposure(coordinatorRef.current, { timeCapReached: true })
        publishProgress(coordinatorRef.current)
        finishRef.current()
      }
    }, 250)
  }, [elapsedSeconds, publishProgress])

  const pauseManual = useCallback(() => {
    if (phaseRef.current !== 'trial' && phaseRef.current !== 'feedback') return
    clearTrialTimer()
    clearAdvanceTimer()
    pauseStartRef.current = performance.now()
    resumeStartsNextRef.current = phaseRef.current === 'feedback'
    setPauseReason('manual')
    setPhase('paused')
  }, [clearAdvanceTimer, clearTrialTimer, setPhase])

  const resume = useCallback(() => {
    if (pauseStartRef.current !== null) {
      pausedAccumRef.current += performance.now() - pauseStartRef.current
      pauseStartRef.current = null
    }
    setPauseReason(null)
    if (resumeStartsNextRef.current) {
      resumeStartsNextRef.current = false
      startNextRef.current()
      return
    }
    const pending = coordinatorRef.current.pending
    if (!pending) {
      startNextRef.current()
      return
    }
    setFeedback(null)
    setPhase('trial')
    drawPresentation(pending.presentation)
    armResponseWindow(pending.presentation)
  }, [armResponseWindow, drawPresentation, setPhase])

  const handleAbort = useCallback(() => {
    if (completedRef.current) return
    completedRef.current = true
    clearTrialTimer()
    clearAdvanceTimer()
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current)
    speechRef.current?.stop()
    onExit()
  }, [clearAdvanceTimer, clearTrialTimer, onExit])

  useEffect(() => {
    drawPresentation(coordinatorRef.current.pending?.presentation ?? null)
    const canvas = canvasRef.current
    if (!canvas || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => drawPresentation(coordinatorRef.current.pending?.presentation ?? null))
    if (canvas.parentElement) observer.observe(canvas.parentElement)
    return () => observer.disconnect()
  }, [drawPresentation])

  useEffect(() => () => {
    clearTrialTimer()
    clearAdvanceTimer()
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current)
    speechRef.current?.stop()
  }, [clearAdvanceTimer, clearTrialTimer])

  const answerOrientation = useCallback((choice: OrientationKey) => {
    finalizeResponseRef.current({ type: 'orientation', orientationDegrees: ORIENTATIONS[choice].angle })
  }, [])
  const answerNoPattern = useCallback(() => finalizeResponseRef.current({ type: 'no-pattern' }), [])

  const feedbackText = feedback === 'correct' ? 'Correct' : feedback === 'timeout' ? 'No response recorded' : feedback === 'wrong' ? 'Not quite' : ''
  const feedbackClass = feedback === 'correct' ? 'text-secondary-400' : feedback === 'timeout' ? 'text-gray-300' : 'text-yellow-300'

  return (
    <div className="relative flex h-full min-h-[100dvh] w-full select-none flex-col overflow-hidden bg-[#808080]">
      <div className="relative z-10 flex items-center justify-between bg-gradient-to-b from-gray-950/90 to-transparent px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-white">{exercise.title}</p>
          <p className="text-xs text-gray-300">
            {statsDisplay.exposures > 0
              ? `${statsDisplay.exposures} presentations · ${statsDisplay.responses} measured responses`
              : 'Contrast-processing training'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(phase === 'trial' || phase === 'feedback') && (
            <button onClick={pauseManual} className="flex h-11 w-11 items-center justify-center rounded-lg bg-gray-900/80 text-gray-300 backdrop-blur-sm hover:text-white" aria-label="Pause exercise">
              <Pause className="h-5 w-5" />
            </button>
          )}
          <button
            onClick={() => { if (speechRef.current) speechRef.current.muted = !getSharedMuted() }}
            className="flex h-11 w-11 items-center justify-center rounded-lg bg-gray-900/80 text-gray-300 backdrop-blur-sm hover:text-white"
            aria-label="Toggle sound"
          >
            {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          <button onClick={handleAbort} className="flex h-11 w-11 items-center justify-center rounded-lg bg-gray-900/80 text-gray-300 backdrop-blur-sm hover:text-white" aria-label="Exit exercise">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="relative min-h-0 w-full flex-1">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        {phase === 'intro' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950/85 p-6 backdrop-blur-sm">
            <div className="w-full max-w-sm space-y-5 rounded-xl border border-primary-400/20 bg-gradient-to-br from-gray-800/80 to-gray-900/80 p-6 text-center shadow-2xl">
              <h2 className="text-2xl font-bold text-white">{exercise.title}</h2>
              <p className="text-sm text-gray-300">{exercise.summary}</p>
              <div className="flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-left">
                <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-300" />
                <p className="text-xs text-red-200/90">Stop immediately for pain, dizziness, double vision, headache, or persistent blur. The X above ends the exercise at any time.</p>
              </div>
              <p className="text-xs text-gray-400">Choose the direction the stripes run. If the field is blank, choose No pattern. This trains visual processing; it is not a diagnosis or prescription.</p>
              <button onClick={start} className="flex min-h-11 w-full items-center justify-center rounded-lg bg-primary-500 px-8 py-3 font-semibold text-white shadow-lg shadow-primary-500/20 hover:bg-primary-600">
                Start
              </button>
            </div>
          </div>
        )}

        {phase === 'paused' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950/90 p-6 backdrop-blur-sm">
            <div className="w-full max-w-sm space-y-5 rounded-xl border border-primary-400/20 bg-gradient-to-br from-gray-800/80 to-gray-900/80 p-6 text-center shadow-2xl">
              <h2 className="text-lg font-semibold text-white">{pauseReason === 'lapse' ? 'Still with me?' : 'Paused'}</h2>
              <p className="text-sm text-gray-400">No rush. Resume when your eyes feel ready.</p>
              <button onClick={resume} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary-500 px-8 py-3 font-semibold text-white hover:bg-primary-600">
                <Play className="h-5 w-5" /> Resume
              </button>
            </div>
          </div>
        )}

        {phase === 'complete' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950/85 p-6 backdrop-blur-sm">
            <div className="w-full max-w-sm space-y-2 rounded-xl border border-secondary-400/30 bg-gradient-to-r from-secondary-600/20 to-primary-600/20 p-8 text-center shadow-2xl">
              <h2 className="text-2xl font-bold text-white">Exercise complete</h2>
              <p className="text-gray-300">{statsDisplay.accuracyPct}% response accuracy · {statsDisplay.exposures} presentations</p>
              <p className="text-xs text-gray-400">Your result reflects this contrast-processing task. It is not an eye exam, diagnosis, or prescription.</p>
            </div>
          </div>
        )}
      </div>

      {(phase === 'trial' || phase === 'feedback') && (
        <div className="relative z-10 flex flex-col items-center px-4 pb-3">
          <p className={`flex h-7 items-center text-base font-bold ${feedbackClass}`} aria-live="polite">{feedbackText}</p>
          <GaborAnswerPad
            onSelect={answerOrientation}
            onNoPattern={answerNoPattern}
            disabled={phase !== 'trial'}
            reducedMotion={reducedMotion}
          />
        </div>
      )}

      <div className="relative z-10 space-y-2 bg-gradient-to-t from-gray-950/90 to-transparent px-4 pb-4 pt-2">
        <div className="h-2 overflow-hidden rounded-full bg-gray-700">
          <div className={reducedMotion ? 'h-full bg-primary-500' : 'h-full bg-primary-500 transition-all duration-300'} style={{ width: `${Math.min(100, (elapsedDisplay / TIME_CAP_SECONDS) * 100)}%` }} />
        </div>
        <div className="flex items-center justify-between text-xs text-gray-300">
          <span>{formatTime(elapsedDisplay)}</span>
          <span>{formatTime(TIME_CAP_SECONDS)}</span>
        </div>
      </div>
    </div>
  )
}

function GaborAnswerPad({
  onSelect,
  onNoPattern,
  disabled,
  reducedMotion,
}: {
  onSelect: (key: OrientationKey) => void
  onNoPattern: () => void
  disabled: boolean
  reducedMotion: boolean
}) {
  const transition = reducedMotion ? '' : 'transition-transform active:scale-95'
  const buttonBase = `flex min-h-11 min-w-[104px] flex-col items-center justify-center gap-1 rounded-xl bg-gray-950 px-5 py-2 font-bold text-white shadow-lg ${transition} ${disabled ? 'opacity-50' : 'hover:bg-primary-600'}`
  const Button = ({ orientation }: { orientation: OrientationKey }) => (
    <button onClick={() => onSelect(orientation)} disabled={disabled} className={buttonBase} aria-label={ORIENTATIONS[orientation].ariaLabel}>
      <span className="text-2xl leading-none">{ORIENTATIONS[orientation].glyph}</span>
      <span className="text-xs font-semibold">{ORIENTATIONS[orientation].label}</span>
    </button>
  )

  return (
    <div className="flex flex-col items-center gap-2">
      <Button orientation="vertical" />
      <div className="flex gap-4">
        <Button orientation="diagonal-left" />
        <Button orientation="diagonal-right" />
      </div>
      <Button orientation="horizontal" />
      <button onClick={onNoPattern} disabled={disabled} className={`${buttonBase} min-w-[160px]`} aria-label="No pattern visible">
        <span className="text-sm font-semibold">No pattern</span>
      </button>
    </div>
  )
}
