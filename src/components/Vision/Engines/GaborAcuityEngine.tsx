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
  applyGaborEasyPreviewResponse,
  applyGaborProductionResponse,
  createGaborEasyPreviewCoordinator,
  createGaborProductionCoordinator,
  getGaborProductionProgress,
  presentNextGaborEasyPreview,
  presentNextGaborExposure,
  type GaborEasyPreviewCoordinator,
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
type GaborAcuityEngineProps = EngineProps & { preview?: boolean }
type ActiveCoordinator =
  | { readonly mode: 'guided'; readonly state: GaborProductionCoordinator }
  | { readonly mode: 'preview'; readonly state: GaborEasyPreviewCoordinator }

function formatTime(totalSec: number): string {
  const seconds = Math.max(0, Math.round(totalSec))
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`
}

function createActiveCoordinator(preview: boolean, seed: string): ActiveCoordinator {
  return preview
    ? { mode: 'preview', state: createGaborEasyPreviewCoordinator(seed) }
    : { mode: 'guided', state: createGaborProductionCoordinator({ seed, prior: null }) }
}

function presentActiveCoordinator(active: ActiveCoordinator, timeCapReached: boolean): ActiveCoordinator {
  return active.mode === 'preview'
    ? { mode: 'preview', state: presentNextGaborEasyPreview(active.state) }
    : {
        mode: 'guided',
        state: presentNextGaborExposure(active.state, { timeCapReached }),
      }
}

function respondToActiveCoordinator(
  active: ActiveCoordinator,
  response: GaborPresentationResponse,
  timeCapReached: boolean,
): ActiveCoordinator {
  return active.mode === 'preview'
    ? { mode: 'preview', state: applyGaborEasyPreviewResponse(active.state, response) }
    : {
        mode: 'guided',
        state: applyGaborProductionResponse(active.state, response, { timeCapReached }),
      }
}

export default function GaborAcuityEngine({
  exercise,
  onProgress,
  onComplete,
  onExit,
  preview = false,
}: GaborAcuityEngineProps) {
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
  const [statsDisplay, setStatsDisplay] = useState({ exposures: 0, accuracyPct: 0 })

  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next
    setPhaseState(next)
  }, [])

  const seedRef = useRef<string>(GABOR_THRESHOLD_PROTOCOL.id)
  const coordinatorRef = useRef<ActiveCoordinator>(createActiveCoordinator(preview, seedRef.current))
  const completedRef = useRef(false)
  const reportedRef = useRef(false)
  const resultRef = useRef<EngineResult | null>(null)
  const previewConsecutiveLapsesRef = useRef(0)
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

  const publishProgress = useCallback((active: ActiveCoordinator) => {
    if (active.mode === 'preview') {
      const { counters } = active.state
      setStatsDisplay({
        exposures: counters.trials,
        accuracyPct: counters.trials > 0 ? Math.round((counters.correctResponses / counters.trials) * 100) : 0,
      })
      return
    }
    const progress = getGaborProductionProgress(active.state)
    setStatsDisplay({ exposures: progress.totalExposures, accuracyPct: progress.accuracyPct })
    onProgress?.(progress)
  }, [onProgress])

  const finish = useCallback(() => {
    if (completedRef.current) return
    const active = coordinatorRef.current
    const terminal = active.state.terminal
    if (!terminal) return
    completedRef.current = true
    clearTrialTimer()
    clearAdvanceTimer()
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current)
    tickIntervalRef.current = undefined
    speechRef.current?.stop()

    if (active.mode === 'guided') {
      const guided = active.state.terminal!
      resultRef.current = {
        exerciseId: exercise.id,
        durationSec: Math.round(elapsedSeconds()),
        completed: guided.resultCompleted,
        score: guided.resultCompleted ? clampScore(guided.scorePct) : 0,
        metrics: guided.metrics,
      }
      const progress = getGaborProductionProgress(active.state)
      setStatsDisplay({ exposures: progress.totalExposures, accuracyPct: progress.accuracyPct })
    } else {
      const easy = active.state.terminal!
      setStatsDisplay({ exposures: easy.trials, accuracyPct: easy.accuracyPct })
    }
    setPhase('complete')
  }, [clearAdvanceTimer, clearTrialTimer, elapsedSeconds, exercise.id, setPhase])
  finishRef.current = finish

  const continueAfterGuidedResult = useCallback(() => {
    if (reportedRef.current || !resultRef.current) return
    reportedRef.current = true
    onComplete(resultRef.current)
  }, [onComplete])

  const continueAfterPreviewResult = useCallback(() => {
    if (reportedRef.current) return
    reportedRef.current = true
    onComplete({
      exerciseId: exercise.id,
      durationSec: Math.round(elapsedSeconds()),
      completed: true,
      score: 0,
      metrics: { previewOnly: 1 },
    })
  }, [elapsedSeconds, exercise.id, onComplete])

  const armResponseWindow = useCallback((presentation: GaborResolvedPresentation) => {
    clearTrialTimer()
    trialTimeoutRef.current = setTimeout(
      () => finalizeResponseRef.current({ type: 'timeout' }),
      presentation.stimulusPresent ? STIMULUS_TIMEOUT_MS : CATCH_WINDOW_MS,
    )
  }, [clearTrialTimer])

  const startNextPresentation = useCallback(() => {
    if (completedRef.current) return
    const next = presentActiveCoordinator(
      coordinatorRef.current,
      !preview && elapsedSeconds() >= TIME_CAP_SECONDS,
    )
    coordinatorRef.current = next
    publishProgress(next)
    if (next.state.terminal) {
      finishRef.current()
      return
    }
    const pending = next.state.pending
    if (!pending) return
    setFeedback(null)
    setPhase('trial')
    drawPresentation(pending.presentation)
    armResponseWindow(pending.presentation)
  }, [armResponseWindow, drawPresentation, elapsedSeconds, preview, publishProgress, setPhase])
  startNextRef.current = startNextPresentation

  const finalizeResponse = useCallback((response: GaborPresentationResponse) => {
    if (completedRef.current || phaseRef.current !== 'trial') return
    clearTrialTimer()
    const next = respondToActiveCoordinator(
      coordinatorRef.current,
      response,
      !preview && elapsedSeconds() >= TIME_CAP_SECONDS,
    )
    if (next === coordinatorRef.current) return
    coordinatorRef.current = next
    const classified = next.state.lastResponse
    if (!classified) return
    previewConsecutiveLapsesRef.current = classified.lapse
      ? previewConsecutiveLapsesRef.current + 1
      : 0
    setFeedback(classified.lapse ? 'timeout' : classified.correct ? 'correct' : 'wrong')
    setPhase('feedback')
    publishProgress(next)

    if (next.state.terminal) {
      finishRef.current()
      return
    }
    const consecutiveLapses = next.mode === 'guided'
      ? next.state.counters.consecutiveLapses
      : previewConsecutiveLapsesRef.current
    if (classified.lapse && consecutiveLapses >= LAPSES_TO_PAUSE) {
      pauseStartRef.current = performance.now()
      resumeStartsNextRef.current = true
      setPauseReason('lapse')
      setPhase('paused')
      speechRef.current?.speak('Still with me? Tap resume when ready.', { interrupt: true })
      return
    }
    clearAdvanceTimer()
    advanceTimeoutRef.current = setTimeout(() => startNextRef.current(), FEEDBACK_MS)
  }, [clearAdvanceTimer, clearTrialTimer, elapsedSeconds, preview, publishProgress, setPhase])
  finalizeResponseRef.current = finalizeResponse

  const start = useCallback(() => {
    if (phaseRef.current !== 'intro') return
    unlockAudio()
    seedRef.current = `${preview ? 'easy-preview' : GABOR_THRESHOLD_PROTOCOL.id}:${Date.now()}`
    coordinatorRef.current = createActiveCoordinator(preview, seedRef.current)
    completedRef.current = false
    reportedRef.current = false
    resultRef.current = null
    previewConsecutiveLapsesRef.current = 0
    pausedAccumRef.current = 0
    pauseStartRef.current = null
    startWallRef.current = performance.now()
    speechRef.current?.speak('Choose the stripe direction, or choose no pattern when the field is blank.', { interrupt: true })
    startNextRef.current()
    tickIntervalRef.current = setInterval(() => {
      if (completedRef.current) return
      const elapsed = elapsedSeconds()
      setElapsedDisplay(elapsed)
      if (!preview && elapsed >= TIME_CAP_SECONDS) {
        coordinatorRef.current = presentActiveCoordinator(coordinatorRef.current, true)
        publishProgress(coordinatorRef.current)
        finishRef.current()
      }
    }, 250)
  }, [elapsedSeconds, preview, publishProgress])

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
    const pending = coordinatorRef.current.state.pending
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
    drawPresentation(coordinatorRef.current.state.pending?.presentation ?? null)
    const canvas = canvasRef.current
    if (!canvas || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => drawPresentation(coordinatorRef.current.state.pending?.presentation ?? null))
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
  const guidedTerminal = coordinatorRef.current.mode === 'guided'
    ? coordinatorRef.current.state.terminal
    : null
  const thresholdPct = guidedTerminal?.metrics.thresholdValid === 1
    && Number.isFinite(guidedTerminal.metrics.contrastThresholdPct)
    ? guidedTerminal.metrics.contrastThresholdPct
    : null
  const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950'

  return (
    <div className="relative flex h-full min-h-[100dvh] w-full select-none flex-col overflow-hidden bg-[#808080]">
      <div className="relative z-10 flex items-center justify-between bg-gradient-to-b from-gray-950/90 to-transparent px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-white">{exercise.title}</p>
          <p className="text-xs text-gray-300">
            {phase === 'trial' || phase === 'feedback'
              ? 'Find the stripe direction'
              : preview ? 'Easy preview · 12 trials' : 'Guided contrast-threshold task'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(phase === 'trial' || phase === 'feedback') && (
            <button onClick={pauseManual} className={`flex h-11 w-11 items-center justify-center rounded-lg bg-gray-900/80 text-gray-300 backdrop-blur-sm hover:text-white ${focusRing}`} aria-label="Pause exercise">
              <Pause className="h-5 w-5" />
            </button>
          )}
          <button
            onClick={() => { if (speechRef.current) speechRef.current.muted = !getSharedMuted() }}
            className={`flex h-11 w-11 items-center justify-center rounded-lg bg-gray-900/80 text-gray-300 backdrop-blur-sm hover:text-white ${focusRing}`}
            aria-label="Toggle sound"
          >
            {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          {phase !== 'complete' && (
            <button onClick={handleAbort} className={`flex h-11 w-11 items-center justify-center rounded-lg bg-gray-900/80 text-gray-300 backdrop-blur-sm hover:text-white ${focusRing}`} aria-label="Exit exercise">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      <div className="relative min-h-0 w-full flex-1">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        {phase === 'intro' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950/85 p-6 backdrop-blur-sm">
            <div className="w-full max-w-sm space-y-5 rounded-xl border border-primary-400/20 bg-gradient-to-br from-gray-800/80 to-gray-900/80 p-6 text-center shadow-2xl">
              <h2 className="text-2xl font-bold text-white">{exercise.title}</h2>
              <p className="text-sm text-gray-300">
                {preview
                  ? 'Learn the response controls with twelve easy, fixed-contrast patterns and blank checks.'
                  : exercise.summary}
              </p>
              <div className="flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-left">
                <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-300" />
                <p className="text-xs text-red-200/90">Stop immediately for pain, dizziness, double vision, headache, or persistent blur. The X above ends the exercise at any time.</p>
              </div>
              <p className="text-xs text-gray-400">
                Choose the direction the stripes run. If the field is blank, choose No pattern. {preview
                  ? 'This preview does not measure or save a threshold and is not hard training.'
                  : 'This trains visual processing; it is not a diagnosis or prescription.'}
              </p>
              <button onClick={start} className={`flex min-h-11 w-full items-center justify-center rounded-lg bg-primary-500 px-8 py-3 font-semibold text-white shadow-lg shadow-primary-500/20 hover:bg-primary-600 ${focusRing}`}>
                {preview ? 'Start easy preview' : 'Start guided task'}
              </button>
            </div>
          </div>
        )}

        {phase === 'paused' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950/90 p-6 backdrop-blur-sm">
            <div className="w-full max-w-sm space-y-5 rounded-xl border border-primary-400/20 bg-gradient-to-br from-gray-800/80 to-gray-900/80 p-6 text-center shadow-2xl">
              <h2 className="text-lg font-semibold text-white">{pauseReason === 'lapse' ? 'Still with me?' : 'Paused'}</h2>
              <p className="text-sm text-gray-400">No rush. Resume when your eyes feel ready.</p>
              <button onClick={resume} className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary-500 px-8 py-3 font-semibold text-white hover:bg-primary-600 ${focusRing}`}>
                <Play className="h-5 w-5" /> Resume
              </button>
            </div>
          </div>
        )}

        {phase === 'complete' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950/85 p-6 backdrop-blur-sm">
            <div className="w-full max-w-sm space-y-3 rounded-xl border border-secondary-400/30 bg-gradient-to-r from-secondary-600/20 to-primary-600/20 p-8 text-center shadow-2xl">
              {preview ? (
                <>
                  <h2 className="text-2xl font-bold text-white">Practice complete</h2>
                  <p className="text-sm leading-relaxed text-gray-300">
                    Practice complete. This easy preview did not change your saved threshold or today&apos;s hard-session status.
                  </p>
                  <button onClick={continueAfterPreviewResult} className={`flex min-h-11 w-full items-center justify-center rounded-lg bg-primary-500 px-6 py-3 font-semibold text-white hover:bg-primary-600 ${focusRing}`}>
                    Back to Vision Library
                  </button>
                </>
              ) : thresholdPct !== null ? (
                <>
                  <h2 className="text-2xl font-bold text-white">Contrast threshold: {thresholdPct.toFixed(1)}%</h2>
                  <p className="text-sm leading-relaxed text-gray-300">
                    Lower is better — this is the faintest contrast reliably identified in today&apos;s task.
                  </p>
                  <p className="text-xs leading-relaxed text-gray-400">
                    This is a training-task proxy for visual processing, not an eye exam, diagnosis, or prescription. Response accuracy: {statsDisplay.accuracyPct}%.
                  </p>
                  <button onClick={continueAfterGuidedResult} className={`flex min-h-11 w-full items-center justify-center rounded-lg bg-primary-500 px-6 py-3 font-semibold text-white hover:bg-primary-600 ${focusRing}`}>
                    Continue
                  </button>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-gray-100">No reliable threshold this time</h2>
                  <p className="text-sm leading-relaxed text-gray-300">
                    Your eyes still did the work; today&apos;s responses did not settle into a reliable reading.
                  </p>
                  <p className="text-xs leading-relaxed text-gray-400">
                    This training task is not an eye exam, diagnosis, or prescription.
                  </p>
                  <button onClick={continueAfterGuidedResult} className={`flex min-h-11 w-full items-center justify-center rounded-lg bg-teal-700 px-6 py-3 font-semibold text-white hover:bg-teal-600 ${focusRing}`}>
                    Continue
                  </button>
                </>
              )}
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

      {!preview && (
        <div className="relative z-10 space-y-2 bg-gradient-to-t from-gray-950/90 to-transparent px-4 pb-4 pt-2">
          <div className="h-2 overflow-hidden rounded-full bg-gray-700">
            <div className={reducedMotion ? 'h-full bg-primary-500' : 'h-full bg-primary-500 transition-all duration-300'} style={{ width: `${Math.min(100, (elapsedDisplay / TIME_CAP_SECONDS) * 100)}%` }} />
          </div>
          <div className="flex items-center justify-between text-xs text-gray-300">
            <span>{formatTime(elapsedDisplay)}</span>
            <span>{formatTime(TIME_CAP_SECONDS)}</span>
          </div>
        </div>
      )}
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
  const buttonBase = `flex min-h-11 min-w-[104px] flex-col items-center justify-center gap-1 rounded-xl bg-gray-950 px-5 py-2 font-bold text-white shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#808080] ${transition} ${disabled ? 'opacity-50' : 'hover:bg-primary-600'}`
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
