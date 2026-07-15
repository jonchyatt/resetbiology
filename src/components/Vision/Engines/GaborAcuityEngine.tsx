'use client'

/**
 * GaborAcuityEngine — serves 'gabor-contrast'.
 * Forced-choice orientation identification on a single static Gabor patch
 * per trial, difficulty driven by a 2-down-1-up Michelson-contrast staircase
 * (Sol H4 rev 2). Fixed diamond answer pad (top=vertical, left=diagonal-left,
 * right=diagonal-right, bottom=horizontal) — positions/labels never move,
 * same accidental-saccade doctrine as SnellenChart's DirectionButtons.
 * Contract: src/components/Vision/Engines/types.ts
 * Ticket: jarvis data/rb-vision-interactive/runtime-logs/scratch-2026-07-15-adf3/ticket-T2.md
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, ShieldAlert, Volume2, VolumeX, X } from 'lucide-react'
import type { EngineProps, EngineResult } from './types'
import { clampScore } from './types'
import { fitCanvasToElement, drawGaborPatch, prefersReducedMotion } from '@/lib/vision/canvasKit'
import { SpeechQueue, unlockAudio } from '@/lib/vision/audioKit'

// ---------------------------------------------------------------------------
// Orientations — 4 fixed choices, diamond answer pad (never reshuffled).
// ---------------------------------------------------------------------------
const ORIENTATIONS = {
  vertical: { angle: 0, label: 'Vertical', glyph: '|' },
  'diagonal-left': { angle: 45, label: 'Diagonal', glyph: '\\' },
  'diagonal-right': { angle: 135, label: 'Diagonal', glyph: '/' },
  horizontal: { angle: 90, label: 'Horizontal', glyph: '—' },
} as const
type OrientationKey = keyof typeof ORIENTATIONS

function shuffledBag(): OrientationKey[] {
  const keys = Object.keys(ORIENTATIONS) as OrientationKey[]
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[keys[i], keys[j]] = [keys[j], keys[i]]
  }
  return keys
}

/**
 * Spatial-frequency ("texture tier") mapping — internal training difficulty,
 * NOT calibrated cycles-per-degree (never surfaced in UI copy as such).
 * Values are cycles-across-the-patch fed to canvasKit's drawGaborPatch,
 * chosen to render cleanly at PATCH_SIZE (~140-220px): tier 1 (weeks 1-4)
 * coarse bands, tier 2 (weeks 5-8) medium, tier 3 (weeks 9-12) fine.
 */
function tierForWeek(week: number): 1 | 2 | 3 {
  const w = week || 1
  if (w <= 4) return 1
  if (w <= 8) return 2
  return 3
}
const TIER_FREQUENCY: Record<1 | 2 | 3, number> = { 1: 4, 2: 7, 3: 11 }

// ---------------------------------------------------------------------------
// Staircase constants (Sol H4 rev 2 — implement exactly)
// ---------------------------------------------------------------------------
const START_CONTRAST = 80
const MIN_CONTRAST = 1
const MAX_CONTRAST = 100
const DOWN_STEP = 0.75
const UP_STEP = 1.5
const REVERSALS_TO_END = 8
const TRIAL_TIMEOUT_MS = 10000
const LAPSES_TO_PAUSE = 2
const FEEDBACK_MS = 700
const EARLY_FINISH_AFTER_SEC = 5

function formatTime(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

type Phase = 'intro' | 'trial' | 'feedback' | 'paused' | 'complete'
type PauseReason = 'manual' | 'lapse' | null
type Feedback = 'correct' | 'wrong' | 'timeout' | null

export default function GaborAcuityEngine({ exercise, prescription, muted, onProgress, onComplete, onExit }: EngineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const speechRef = useRef<SpeechQueue | null>(null)
  if (!speechRef.current) speechRef.current = new SpeechQueue()

  const reducedMotion = useMemo(() => prefersReducedMotion(), [])
  const targetSeconds = Math.max(30, prescription.targetSeconds || 180)
  const tier = tierForWeek(prescription.week)

  const [phase, setPhase] = useState<Phase>('intro')
  const [pauseReason, setPauseReason] = useState<PauseReason>(null)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [isMuted, setIsMuted] = useState(!!muted)
  const [elapsedDisplay, setElapsedDisplay] = useState(0)
  const [statsDisplay, setStatsDisplay] = useState({ trials: 0, correct: 0, reversals: 0 })

  useEffect(() => {
    speechRef.current!.muted = isMuted
  }, [isMuted])

  // Trial / staircase state — refs so closures never go stale.
  const bagRef = useRef<OrientationKey[]>([])
  const currentOrientationRef = useRef<OrientationKey>('vertical')
  const contrastRef = useRef(START_CONTRAST)
  const consecutiveCorrectRef = useRef(0)
  const lastDirectionRef = useRef<'up' | 'down' | null>(null)
  const reversalsRef = useRef(0)
  const reversalContrastsRef = useRef<number[]>([])
  const lapseStreakRef = useRef(0)
  const trialsRef = useRef(0)
  const correctRef = useRef(0)
  const completedRef = useRef(false)

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const completeTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  const startWallRef = useRef<number | null>(null)
  const pausedAccumRef = useRef(0)
  const pauseStartRef = useRef<number | null>(null)

  const elapsedSeconds = useCallback(() => {
    if (!startWallRef.current) return 0
    const now = performance.now()
    const pausedTotal = pausedAccumRef.current + (pauseStartRef.current ? now - pauseStartRef.current : 0)
    return Math.max(0, (now - startWallRef.current - pausedTotal) / 1000)
  }, [])

  const nextOrientation = useCallback((): OrientationKey => {
    if (!bagRef.current.length) bagRef.current = shuffledBag()
    return bagRef.current.pop()!
  }, [])

  const drawPatch = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { width, height } = fitCanvasToElement(canvas)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#0b1220'
    ctx.fillRect(0, 0, width, height)
    const size = Math.max(140, Math.min(220, Math.min(width, height) * 0.55))
    const angle = ORIENTATIONS[currentOrientationRef.current].angle
    drawGaborPatch(ctx, width / 2, height / 2, {
      size,
      orientation: angle,
      frequency: TIER_FREQUENCY[tier],
      contrast: contrastRef.current / 100,
    })
  }, [tier])

  const clearTrialTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = undefined
  }, [])

  /** Reversal + step logic — lapses NEVER call this (Sol H4: don't feed the staircase). */
  const applyStaircase = useCallback((correct: boolean) => {
    let direction: 'up' | 'down'
    if (correct) {
      consecutiveCorrectRef.current += 1
      if (consecutiveCorrectRef.current < 2) return
      consecutiveCorrectRef.current = 0
      direction = 'down'
    } else {
      consecutiveCorrectRef.current = 0
      direction = 'up'
    }
    const next = Math.max(
      MIN_CONTRAST,
      Math.min(MAX_CONTRAST, contrastRef.current * (direction === 'down' ? DOWN_STEP : UP_STEP)),
    )
    contrastRef.current = next
    if (lastDirectionRef.current && lastDirectionRef.current !== direction) {
      reversalsRef.current += 1
      reversalContrastsRef.current.push(next)
      if (reversalContrastsRef.current.length > 4) reversalContrastsRef.current.shift()
    }
    lastDirectionRef.current = direction
  }, [])

  const finish = useCallback(
    (completed: boolean) => {
      if (completedRef.current) return
      completedRef.current = true
      clearTrialTimer()
      if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current)
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current)
      setPhase('complete')
      speechRef.current?.speak('Nice work. Exercise complete.', { interrupt: true })

      const trials = trialsRef.current
      const accuracyPct = trials > 0 ? Math.round((correctRef.current / trials) * 100) : 0
      const durationSec = Math.round(elapsedSeconds())
      const reversals = reversalsRef.current

      /**
       * Score formula: when >=4 reversals occurred, the mean contrast at the
       * last 4 reversals IS the threshold — lower contrast = sharper vision,
       * so score = 100 - threshold (e.g. a 12.5% threshold -> score ~88; a
       * 60% threshold -> score 40). Below 4 reversals the threshold isn't
       * statistically meaningful (Sol H4) so score falls back to a small
       * participation floor instead of reporting a misleading number.
       */
      let thresholdValid = 0
      let contrastThresholdPct: number | undefined
      let score = 25
      if (reversals >= 4) {
        const values = reversalContrastsRef.current
        const mean = values.reduce((a, b) => a + b, 0) / values.length
        contrastThresholdPct = Math.round(mean * 10) / 10
        thresholdValid = 1
        score = clampScore(100 - contrastThresholdPct)
      }

      const result: EngineResult = {
        exerciseId: exercise.id,
        durationSec,
        completed,
        score,
        metrics: {
          trials,
          accuracyPct,
          reversals,
          thresholdValid,
          ...(thresholdValid ? { contrastThresholdPct: contrastThresholdPct! } : {}),
        },
      }
      completeTimeoutRef.current = setTimeout(() => onComplete(result), 1400)
    },
    [clearTrialTimer, elapsedSeconds, exercise.id, onComplete],
  )

  /** Trial timeout = a lapse: counted wrong for accuracy/trials, but EXCLUDED
   * from the staircase (Sol H4: lapses don't feed it). Shared by startTrial
   * (new orientation) and resume (same orientation — "restarts CURRENT trial
   * fresh", §4.9c) so the lapse/pause/target-seconds handling lives once. */
  const armTrialTimeout = useCallback(() => {
    clearTrialTimer()
    timeoutRef.current = setTimeout(() => {
      trialsRef.current += 1
      lapseStreakRef.current += 1
      setFeedback('timeout')
      setPhase('feedback')
      setStatsDisplay({ trials: trialsRef.current, correct: correctRef.current, reversals: reversalsRef.current })
      onProgress?.({
        trials: trialsRef.current,
        accuracyPct: Math.round((correctRef.current / trialsRef.current) * 100),
        reversals: reversalsRef.current,
      })
      if (elapsedSeconds() >= targetSeconds) {
        advanceTimeoutRef.current = setTimeout(() => finish(true), FEEDBACK_MS)
        return
      }
      advanceTimeoutRef.current = setTimeout(() => {
        if (lapseStreakRef.current >= LAPSES_TO_PAUSE) {
          pauseStartRef.current = performance.now()
          setPauseReason('lapse')
          setPhase('paused')
          speechRef.current?.speak('Still with me? Tap resume when ready.', { interrupt: true })
        } else {
          startTrial()
        }
      }, FEEDBACK_MS)
    }, TRIAL_TIMEOUT_MS)
  }, [clearTrialTimer, elapsedSeconds, finish, onProgress, targetSeconds])

  const startTrial = useCallback(() => {
    if (completedRef.current) return
    currentOrientationRef.current = nextOrientation()
    setFeedback(null)
    setPhase('trial')
    drawPatch()
    armTrialTimeout()
  }, [armTrialTimeout, drawPatch, nextOrientation])

  const answer = useCallback(
    (choice: OrientationKey) => {
      if (phase !== 'trial') return // debounce during feedback window (SnellenQuickCheck Leg idiom)
      clearTrialTimer()
      const correct = choice === currentOrientationRef.current
      trialsRef.current += 1
      lapseStreakRef.current = 0
      if (correct) correctRef.current += 1
      applyStaircase(correct)
      setFeedback(correct ? 'correct' : 'wrong')
      setPhase('feedback')
      setStatsDisplay({ trials: trialsRef.current, correct: correctRef.current, reversals: reversalsRef.current })
      onProgress?.({
        trials: trialsRef.current,
        accuracyPct: Math.round((correctRef.current / trialsRef.current) * 100),
        reversals: reversalsRef.current,
      })

      if (reversalsRef.current >= REVERSALS_TO_END || elapsedSeconds() >= targetSeconds) {
        advanceTimeoutRef.current = setTimeout(() => finish(true), FEEDBACK_MS)
        return
      }
      advanceTimeoutRef.current = setTimeout(() => startTrial(), FEEDBACK_MS)
    },
    [applyStaircase, clearTrialTimer, elapsedSeconds, finish, onProgress, phase, startTrial, targetSeconds],
  )

  const start = useCallback(() => {
    unlockAudio()
    startWallRef.current = performance.now()
    bagRef.current = []
    speechRef.current?.speak('Watch the pattern, then tap the matching direction.', { interrupt: true })
    startTrial()
    tickIntervalRef.current = setInterval(() => {
      if (completedRef.current) return
      setElapsedDisplay(elapsedSeconds())
    }, 500)
  }, [elapsedSeconds, startTrial])

  const pauseManual = useCallback(() => {
    if (phase !== 'trial' && phase !== 'feedback') return
    clearTrialTimer()
    if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current)
    pauseStartRef.current = performance.now()
    setPauseReason('manual')
    setPhase('paused')
  }, [clearTrialTimer, phase])

  const resume = useCallback(() => {
    if (pauseStartRef.current) {
      pausedAccumRef.current += performance.now() - pauseStartRef.current
      pauseStartRef.current = null
    }
    lapseStreakRef.current = 0
    setPauseReason(null)
    // "resuming restarts the CURRENT trial fresh" (§4.9c) — same orientation/contrast, new timer.
    setFeedback(null)
    setPhase('trial')
    drawPatch()
    clearTrialTimer()
    timeoutRef.current = setTimeout(() => {
      trialsRef.current += 1
      lapseStreakRef.current += 1
      setFeedback('timeout')
      setPhase('feedback')
      advanceTimeoutRef.current = setTimeout(() => startTrial(), FEEDBACK_MS)
    }, TRIAL_TIMEOUT_MS)
  }, [clearTrialTimer, drawPatch, startTrial])

  const handleAbort = useCallback(() => {
    clearTrialTimer()
    if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current)
    if (completeTimeoutRef.current) clearTimeout(completeTimeoutRef.current)
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current)
    speechRef.current?.stop()
    onExit()
  }, [clearTrialTimer, onExit])

  useEffect(() => {
    return () => {
      clearTrialTimer()
      if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current)
      if (completeTimeoutRef.current) clearTimeout(completeTimeoutRef.current)
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current)
      speechRef.current?.stop()
    }
  }, [clearTrialTimer])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => drawPatch())
    if (canvas.parentElement) ro.observe(canvas.parentElement)
    return () => ro.disconnect()
  }, [drawPatch])

  const showEarlyFinish =
    elapsedDisplay >= EARLY_FINISH_AFTER_SEC && (phase === 'trial' || phase === 'feedback' || (phase === 'paused' && pauseReason === 'manual'))

  const feedbackText = feedback === 'correct' ? 'Correct' : feedback === 'timeout' ? "Time's up" : feedback === 'wrong' ? 'Not quite' : null
  const feedbackClass = feedback === 'correct' ? 'text-secondary-400' : 'text-yellow-400'

  return (
    <div className="relative flex h-full min-h-[100dvh] w-full select-none flex-col overflow-hidden bg-gray-950">
      {/* Top bar — mute + X/abort visible in EVERY state (§4.9b) */}
      <div className="relative z-10 flex items-center justify-between bg-gradient-to-b from-gray-900/90 to-transparent px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-white">{exercise.title}</p>
          <p className="text-xs text-gray-400">
            {statsDisplay.trials > 0 ? `${statsDisplay.trials} trials · ${statsDisplay.reversals} reversals` : 'Contrast-sensitivity training'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(phase === 'trial' || phase === 'feedback') && (
            <button
              onClick={pauseManual}
              className="flex h-11 w-11 items-center justify-center rounded-lg bg-gray-800/80 text-gray-400 backdrop-blur-sm hover:text-white"
              aria-label="Pause exercise"
            >
              <Pause className="h-5 w-5" />
            </button>
          )}
          <button
            onClick={() => setIsMuted(v => !v)}
            className="flex h-11 w-11 items-center justify-center rounded-lg bg-gray-800/80 text-gray-400 backdrop-blur-sm hover:text-white"
            aria-label="Toggle sound"
          >
            {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          <button
            onClick={handleAbort}
            className="flex h-11 w-11 items-center justify-center rounded-lg bg-gray-800/80 text-gray-400 backdrop-blur-sm hover:text-white"
            aria-label="Exit exercise"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="relative min-h-0 w-full flex-1">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        {phase === 'intro' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950/85 p-6 backdrop-blur-sm">
            <div className="w-full max-w-sm space-y-5 rounded-xl border border-primary-400/20 bg-gradient-to-br from-gray-800/80 to-gray-900/80 p-6 text-center shadow-2xl">
              <h2 className="text-2xl font-bold text-white">{exercise.title}</h2>
              <p className="text-sm text-gray-400">{exercise.summary}</p>
              <div className="flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-left">
                <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-300" />
                <p className="text-xs text-red-200/90">
                  Stop immediately if you feel pain, dizziness, double vision, or persistent blur. The X above ends this at any time.
                </p>
              </div>
              <p className="text-xs text-gray-500">
                A faint striped patch will flash. Tap the arrow pad for the direction the stripes run — vertical, horizontal, or diagonal.
              </p>
              <button
                onClick={start}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary-500 px-8 py-3 font-semibold text-white shadow-lg shadow-primary-500/20 hover:bg-primary-600"
              >
                Start
              </button>
            </div>
          </div>
        )}

        {phase === 'paused' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950/90 p-6 backdrop-blur-sm">
            <div className="w-full max-w-sm space-y-5 rounded-xl border border-primary-400/20 bg-gradient-to-br from-gray-800/80 to-gray-900/80 p-6 text-center shadow-2xl">
              <h2 className="text-lg font-semibold text-white">{pauseReason === 'lapse' ? 'Still with me?' : 'Paused'}</h2>
              {pauseReason === 'lapse' && <p className="text-sm text-gray-400">No rush — tap resume whenever you&apos;re ready.</p>}
              <button
                onClick={resume}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary-500 px-8 py-3 font-semibold text-white hover:bg-primary-600"
              >
                <Play className="h-5 w-5" /> Resume
              </button>
            </div>
          </div>
        )}

        {phase === 'complete' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950/85 p-6 backdrop-blur-sm">
            <div className="w-full max-w-sm space-y-2 rounded-xl border border-secondary-400/30 bg-gradient-to-r from-secondary-600/20 to-primary-600/20 p-8 text-center shadow-2xl">
              <h2 className="text-2xl font-bold text-white">Exercise Complete!</h2>
              <p className="text-gray-300">
                {statsDisplay.trials > 0 ? Math.round((statsDisplay.correct / statsDisplay.trials) * 100) : 0}% accuracy · {statsDisplay.trials} trials
              </p>
              <p className="text-xs text-gray-500">Contrast-sensitivity training score — not a clinical measurement.</p>
              {statsDisplay.reversals < 4 && <p className="text-xs text-amber-300">Keep training to establish your score.</p>}
            </div>
          </div>
        )}
      </div>

      {/* Answer pad + feedback — fixed diamond layout, never reshuffled */}
      {(phase === 'trial' || phase === 'feedback') && (
        <div className="relative z-10 flex flex-col items-center gap-3 px-4 pb-3">
          {feedbackText && <p className={`text-lg font-bold ${feedbackClass}`}>{feedbackText}</p>}
          <GaborAnswerPad onSelect={answer} disabled={phase !== 'trial'} reducedMotion={reducedMotion} />
        </div>
      )}

      {/* Progress */}
      <div className="relative z-10 space-y-2 px-4 pb-4">
        <div className="h-2 overflow-hidden rounded-full bg-gray-700">
          <div
            className={reducedMotion ? 'h-full bg-primary-500' : 'h-full bg-primary-500 transition-all duration-300'}
            style={{ width: `${Math.min(100, Math.round((elapsedDisplay / targetSeconds) * 100))}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{formatTime(elapsedDisplay)}</span>
          {showEarlyFinish ? (
            <button onClick={() => finish(true)} className="min-h-11 px-3 text-primary-300 underline">
              Finish now
            </button>
          ) : (
            <span>{formatTime(targetSeconds)}</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Fixed diamond answer pad — top=vertical, left=diagonal-left, right=diagonal-right,
// bottom=horizontal. Positions/labels NEVER move (accidental-saccade doctrine,
// copies SnellenChart's exported DirectionButtons pattern).
// ---------------------------------------------------------------------------
function GaborAnswerPad({
  onSelect,
  disabled,
  reducedMotion,
}: {
  onSelect: (key: OrientationKey) => void
  disabled: boolean
  reducedMotion: boolean
}) {
  const transitionClass = reducedMotion ? '' : 'transition-transform active:scale-95'
  const buttonBase = `flex min-h-11 min-w-[110px] flex-col items-center justify-center gap-1 rounded-xl bg-gray-900 px-6 py-3 font-bold text-white shadow-lg ${transitionClass} ${disabled ? 'opacity-50' : 'hover:bg-primary-500'}`

  const Btn = ({ k }: { k: OrientationKey }) => (
    <button onClick={() => onSelect(k)} disabled={disabled} className={buttonBase} aria-label={ORIENTATIONS[k].label}>
      <span className="text-2xl leading-none">{ORIENTATIONS[k].glyph}</span>
      <span className="text-xs font-semibold">{ORIENTATIONS[k].label}</span>
    </button>
  )

  return (
    <div className="flex flex-col items-center gap-3">
      <Btn k="vertical" />
      <div className="flex gap-6">
        <Btn k="diagonal-left" />
        <Btn k="diagonal-right" />
      </div>
      <Btn k="horizontal" />
    </div>
  )
}
