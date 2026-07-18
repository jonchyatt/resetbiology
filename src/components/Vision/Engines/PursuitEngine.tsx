'use client'

/**
 * PursuitEngine (W1.3) — serves 'smooth-tracking' and 'figure8-fixation'.
 * Full-screen canvas: a Gabor patch rides a parametric path at week-scaled
 * speed. Trace mode (on by default) lets the user keep a finger/mouse on the
 * target — deviation drives a smoothness score. Watch-only fallback keeps the
 * exercise legitimate for eyes-only users (phone propped up, no touch input).
 * Contract: src/components/Vision/Engines/types.ts
 * Plan: docs/plans/vision-training-interactive-overhaul.md §Tier 1 (W1.3)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, Volume2, VolumeX, X, MousePointer2, Eye } from 'lucide-react'
import type { EngineProps, EngineResult } from './types'
import { clampScore } from './types'
import {
  fitCanvasToElement,
  drawGaborPatch,
  drawGlow,
  infinityPoint,
  sweepPoint,
  pathTangentAngle,
  type Point,
} from '@/lib/vision/canvasKit'
import { SpeechQueue, unlockAudio } from '@/lib/vision/audioKit'

type Stage = 'horizontal' | 'vertical' | 'infinity'

const STAGE_ORDER: Stage[] = ['horizontal', 'vertical', 'infinity']
const STAGE_SECONDS = 60
const CUE_SECONDS = 12
const ON_TARGET_RADIUS = 60
const WATCH_ONLY_TIMEOUT_MS = 10_000
const BASE_LOOP_SECONDS = 4
const TRACING_MIN_MS = 5_000

const STAGE_LABEL: Record<Stage, string> = {
  horizontal: 'Horizontal Sweep',
  vertical: 'Vertical Loops',
  infinity: 'Infinity Path',
}

const STAGE_ANNOUNCE: Record<Stage, string> = {
  horizontal: 'Follow the target left and right. Eyes only, head still.',
  vertical: 'Now vertical loops. Eyes only, head still.',
  infinity: 'Now the infinity path. Smooth and steady.',
}

/** Vertical/horizontal ellipse loop, matching the sweepPoint/infinityPoint call shape. */
function ellipsePoint(t: number, cx: number, cy: number, rx: number, ry: number): Point {
  const T = t * Math.PI * 2 + Math.PI / 2
  return { x: cx + rx * Math.cos(T), y: cy + ry * Math.sin(T) }
}

function formatTime(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

export default function PursuitEngine({ exercise, prescription, muted, onProgress, onComplete, onExit }: EngineProps) {
  const isFigure8 = exercise.id === 'figure8-fixation'

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const speechRef = useRef<SpeechQueue | null>(null)
  if (!speechRef.current) speechRef.current = new SpeechQueue()

  const [phase, setPhase] = useState<'intro' | 'running' | 'paused' | 'complete'>('intro')
  const [isMuted, setIsMuted] = useState(!!muted)
  const [traceMode, setTraceMode] = useState(true)
  const [elapsedDisplay, setElapsedDisplay] = useState(0)
  const [stageLabel, setStageLabel] = useState<string>(isFigure8 ? 'Wide Loop' : STAGE_LABEL.horizontal)
  const [cueText, setCueText] = useState<string>('Get ready.')
  const [onTargetNow, setOnTargetNow] = useState(false)
  const [watchOnly, setWatchOnly] = useState(true)

  const traceModeRef = useRef(traceMode)
  useEffect(() => { traceModeRef.current = traceMode }, [traceMode])

  useEffect(() => {
    speechRef.current!.muted = isMuted
  }, [isMuted])

  const targetSeconds = Math.max(30, prescription.targetSeconds || 180)
  const loopSeconds = Math.max(1, BASE_LOOP_SECONDS / (prescription.speedMultiplier || 1))

  // ponytail: exercise.checkpoints describe stage-specific / time-anchored
  // structure ("for 60 sec", "each minute") already spoken at the right
  // moment by STAGE_ANNOUNCE (stage change) / the figure8 label switch in
  // draw() below — cycling them here on a blind CUE_SECONDS clock would
  // recite stale or mismatched stage instructions (S: "for 60 sec" while
  // already on the vertical stage). Only stage-agnostic coaching cues rotate.
  const cueList = useMemo(() => {
    const list = [...(prescription.coachingCues ?? [])]
    return list.length ? list : ['Keep your head still. Eyes only.']
  }, [prescription.coachingCues])

  // rAF loop bookkeeping — refs so the recursive frame closure never goes stale.
  const rafRef = useRef<number | undefined>(undefined)
  const lastTickRef = useRef<number | null>(null)
  const elapsedMsRef = useRef(0)
  const lastBlockRef = useRef(-1)
  const lastCueSlotRef = useRef(-1)
  const lastUiUpdateRef = useRef(0)
  const lastProgressRef = useRef(0)
  const completeTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const completedRef = useRef(false)

  const pointerRef = useRef({ x: 0, y: 0, hasInput: false, lastInputTs: 0 })
  const targetPosRef = useRef<Point>({ x: 0, y: 0 })
  const metricsRef = useRef({
    onTargetMs: 0,
    tracingMs: 0,
    deviationSum: 0,
    deviationCount: 0,
    pointerActiveMs: 0,
    stagesCompleted: 0,
  })

  const pathForStage = useCallback(
    (stage: Stage, t: number, cx: number, cy: number, halfW: number, halfH: number): Point => {
      if (stage === 'horizontal') return sweepPoint(t, cx, cy, halfW)
      if (stage === 'vertical') return ellipsePoint(t, cx, cy, halfW * 0.35, halfH * 0.75)
      return infinityPoint(t, cx, cy, halfW * 0.65, halfH * 0.45)
    },
    [],
  )

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number, elapsedSec: number) => {
      ctx.fillStyle = '#0b1220'
      ctx.fillRect(0, 0, width, height)

      const cx = width / 2
      const cy = height / 2
      const halfW = Math.max(60, width / 2 - 56)
      const halfH = Math.max(60, height / 2 - 90)
      const t = (elapsedSec % loopSeconds) / loopSeconds

      let pathFn: (tt: number) => Point
      let patchSize = 42
      let orientationBoost = 0

      if (isFigure8) {
        const minuteBucket = Math.floor(elapsedSec / 60)
        const wide = minuteBucket % 2 === 0
        const scale = wide ? 1 : 0.5
        pathFn = (tt: number) => infinityPoint(tt, cx, cy, halfW * 0.7 * scale, halfH * 0.5 * scale)
        // Near/far simulation: patch grows and shrinks once per loop.
        const nearFar = (Math.cos(t * Math.PI * 2) + 1) / 2
        patchSize = 26 + nearFar * 22
        setStageLabel(wide ? 'Wide Loop' : 'Tight Loop')
      } else {
        const blockCount = Math.floor(elapsedSec / STAGE_SECONDS)
        const stage = STAGE_ORDER[blockCount % STAGE_ORDER.length]
        pathFn = (tt: number) => pathForStage(stage, tt, cx, cy, halfW, halfH)
        if (blockCount !== lastBlockRef.current) {
          lastBlockRef.current = blockCount
          metricsRef.current.stagesCompleted = blockCount
          speechRef.current?.speak(STAGE_ANNOUNCE[stage])
          setStageLabel(STAGE_LABEL[stage])
        }
      }

      const pos = pathFn(t)
      targetPosRef.current = pos
      const angle = pathTangentAngle(pathFn, t) + orientationBoost

      // Faint path guide.
      ctx.strokeStyle = 'rgba(63, 191, 181, 0.22)'
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i <= 80; i++) {
        const p = pathFn(i / 80)
        if (i === 0) ctx.moveTo(p.x, p.y)
        else ctx.lineTo(p.x, p.y)
      }
      ctx.stroke()

      // Pointer trace feedback.
      const nowMs = performance.now()
      const tracingNow =
        traceModeRef.current && pointerRef.current.hasInput && nowMs - pointerRef.current.lastInputTs < WATCH_ONLY_TIMEOUT_MS
      if (tracingNow) {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(pointerRef.current.x, pointerRef.current.y, 14, 0, Math.PI * 2)
        ctx.stroke()
      }

      drawGlow(ctx, pos.x, pos.y, patchSize * 0.9, 0.18)
      drawGaborPatch(ctx, pos.x, pos.y, { size: patchSize, orientation: angle, frequency: 5, contrast: 0.95, phase: elapsedSec * 90 })

      return { tracingNow }
    },
    [isFigure8, loopSeconds, pathForStage],
  )

  const finish = useCallback(() => {
    if (completedRef.current) return
    completedRef.current = true
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setPhase('complete')
    speechRef.current?.speak('Nice work. Exercise complete.', { interrupt: true })

    const m = metricsRef.current
    const timeOnTargetPct = m.tracingMs > 0 ? Math.round((m.onTargetMs / m.tracingMs) * 100) : 0
    const meanDeviation = m.deviationCount > 0 ? m.deviationSum / m.deviationCount : Infinity
    const smoothnessScore =
      meanDeviation === Infinity ? 0 : meanDeviation <= 15 ? 100 : meanDeviation >= 120 ? 0 : Math.round(100 - ((meanDeviation - 15) / (120 - 15)) * 100)
    const tracingUsed = m.pointerActiveMs > TRACING_MIN_MS
    const completionPct = Math.min(100, Math.round((elapsedMsRef.current / 1000 / targetSeconds) * 100))
    const finalStagesCompleted = isFigure8 ? Math.floor(elapsedMsRef.current / 1000 / 60) : m.stagesCompleted + 1

    const result: EngineResult = {
      exerciseId: exercise.id,
      durationSec: Math.round(elapsedMsRef.current / 1000),
      completed: true,
      score: clampScore(tracingUsed ? smoothnessScore : completionPct),
      metrics: {
        timeOnTargetPct,
        smoothnessScore: tracingUsed ? smoothnessScore : 0,
        stagesCompleted: finalStagesCompleted,
      },
    }
    completeTimeoutRef.current = setTimeout(() => onComplete(result), 1400)
  }, [exercise.id, isFigure8, onComplete, targetSeconds])

  const frame = useCallback(
    (now: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const { width, height } = fitCanvasToElement(canvas)
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      if (lastTickRef.current == null) lastTickRef.current = now
      const dt = now - lastTickRef.current
      lastTickRef.current = now
      elapsedMsRef.current += dt
      const elapsedSec = elapsedMsRef.current / 1000

      const { tracingNow } = draw(ctx, width, height, elapsedSec)

      if (tracingNow) {
        const dist = Math.hypot(pointerRef.current.x - targetPosRef.current.x, pointerRef.current.y - targetPosRef.current.y)
        metricsRef.current.deviationSum += dist
        metricsRef.current.deviationCount += 1
        metricsRef.current.tracingMs += dt
        metricsRef.current.pointerActiveMs += dt
        if (dist <= ON_TARGET_RADIUS) metricsRef.current.onTargetMs += dt
        if (now - lastUiUpdateRef.current > 200) {
          setOnTargetNow(dist <= ON_TARGET_RADIUS)
          setWatchOnly(false)
        }
      } else if (now - lastUiUpdateRef.current > 200) {
        setWatchOnly(true)
        setOnTargetNow(false)
      }

      const cueSlot = Math.floor(elapsedSec / CUE_SECONDS) % cueList.length
      if (cueSlot !== lastCueSlotRef.current) {
        lastCueSlotRef.current = cueSlot
        const text = cueList[cueSlot]
        setCueText(text)
        speechRef.current?.speak(text)
      }

      if (now - lastUiUpdateRef.current > 200) {
        lastUiUpdateRef.current = now
        setElapsedDisplay(elapsedSec)
      }
      if (now - lastProgressRef.current > 900) {
        lastProgressRef.current = now
        const m = metricsRef.current
        onProgress?.({
          timeOnTargetPct: m.tracingMs > 0 ? Math.round((m.onTargetMs / m.tracingMs) * 100) : 0,
          smoothnessScore: m.deviationCount > 0 ? Math.max(0, Math.round(100 - (m.deviationSum / m.deviationCount / 120) * 100)) : 0,
        })
      }

      if (elapsedSec >= targetSeconds) {
        finish()
        return
      }
      rafRef.current = requestAnimationFrame(frame)
    },
    [cueList, draw, finish, onProgress, targetSeconds],
  )

  const start = useCallback(() => {
    unlockAudio()
    lastTickRef.current = null
    setPhase('running')
    speechRef.current?.speak(isFigure8 ? 'Trace the infinity path. Smooth and steady.' : STAGE_ANNOUNCE.horizontal, { interrupt: true })
    rafRef.current = requestAnimationFrame(frame)
  }, [frame, isFigure8])

  const pause = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = undefined
    lastTickRef.current = null
    setPhase('paused')
  }, [])

  const resume = useCallback(() => {
    lastTickRef.current = null
    setPhase('running')
    rafRef.current = requestAnimationFrame(frame)
  }, [frame])

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (completeTimeoutRef.current) clearTimeout(completeTimeoutRef.current)
      speechRef.current?.stop()
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => fitCanvasToElement(canvas))
    if (canvas.parentElement) ro.observe(canvas.parentElement)
    fitCanvasToElement(canvas)
    return () => ro.disconnect()
  }, [])

  const toCanvasPoint = (e: { clientX: number; clientY: number }): Point => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!traceModeRef.current) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const p = toCanvasPoint(e)
    pointerRef.current.x = p.x
    pointerRef.current.y = p.y
    pointerRef.current.hasInput = true
    pointerRef.current.lastInputTs = performance.now()
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!traceModeRef.current) return
    const p = toCanvasPoint(e)
    pointerRef.current.x = p.x
    pointerRef.current.y = p.y
    pointerRef.current.hasInput = true
    pointerRef.current.lastInputTs = performance.now()
  }

  const targetLabel = exercise.title
  const progressPct = Math.min(100, Math.round((elapsedDisplay / targetSeconds) * 100))

  return (
    <div className="relative flex h-full min-h-[100dvh] w-full select-none flex-col overflow-hidden bg-gray-950">
      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between bg-gradient-to-b from-gray-900/90 to-transparent px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-white">{targetLabel}</p>
          <p className="text-xs text-gray-400">{stageLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTraceMode(v => !v)}
            className={`flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-medium backdrop-blur-sm transition-all duration-300 ${
              traceMode ? 'bg-primary-500/80 text-white' : 'bg-gray-800/80 text-gray-400'
            }`}
            aria-label="Toggle trace mode"
          >
            {traceMode ? <MousePointer2 className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {traceMode ? 'Trace' : 'Watch'}
          </button>
          <button
            onClick={() => setIsMuted(v => !v)}
            className="flex h-11 w-11 items-center justify-center rounded-lg bg-gray-800/80 text-gray-400 backdrop-blur-sm transition-all duration-300 hover:text-white"
            aria-label="Toggle sound"
          >
            {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          <button
            onClick={onExit}
            className="flex h-11 w-11 items-center justify-center rounded-lg bg-gray-800/80 text-gray-400 backdrop-blur-sm transition-all duration-300 hover:text-white"
            aria-label="Exit exercise"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="relative min-h-0 w-full flex-1">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none"
          style={{ touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
        />

        {phase !== 'complete' && (
          <div className="pointer-events-none absolute right-4 top-4 flex items-center gap-2 rounded-full bg-gray-900/70 px-3 py-1.5 backdrop-blur-sm">
            <span className={`h-2.5 w-2.5 rounded-full ${onTargetNow ? 'bg-secondary-400' : watchOnly ? 'bg-gray-500' : 'bg-yellow-500'}`} />
            <span className="text-xs text-gray-300">{watchOnly ? 'Watch-only' : onTargetNow ? 'On target' : 'Tracing'}</span>
          </div>
        )}

        {phase === 'intro' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950/85 p-6 backdrop-blur-sm">
            <div className="w-full max-w-sm space-y-5 rounded-xl border border-primary-400/20 bg-gradient-to-br from-gray-800/80 to-gray-900/80 p-6 text-center shadow-2xl">
              <h2 className="text-2xl font-bold text-white">{exercise.title}</h2>
              <p className="text-sm text-gray-400">{exercise.summary}</p>
              <p className="text-xs text-gray-500">
                Keep a finger on the target as it moves, or watch it eyes-only if your phone is propped up. {formatTime(targetSeconds)} today.
              </p>
              <button
                onClick={start}
                className="flex w-full min-h-11 items-center justify-center gap-2 rounded-lg bg-primary-500 px-8 py-3 font-semibold text-white shadow-lg shadow-primary-500/20 transition-all duration-300 hover:bg-primary-600"
              >
                <Play className="h-5 w-5" />
                Start
              </button>
            </div>
          </div>
        )}

        {phase === 'complete' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950/85 p-6 backdrop-blur-sm">
            <div className="w-full max-w-sm space-y-2 rounded-xl border border-secondary-400/30 bg-gradient-to-r from-secondary-600/20 to-primary-600/20 p-8 text-center shadow-2xl">
              <h2 className="text-2xl font-bold text-white">Exercise Complete!</h2>
              <p className="text-gray-300">Great tracking — nice and smooth.</p>
            </div>
          </div>
        )}
      </div>

      {/* Cue banner */}
      <div className="relative z-10 bg-gradient-to-t from-gray-900/90 to-transparent px-4 py-3 text-center">
        <p className="text-sm font-medium text-primary-300">{cueText}</p>
      </div>

      {/* Progress + controls */}
      <div className="relative z-10 space-y-3 px-4 pb-4">
        <div className="h-2 overflow-hidden rounded-full bg-gray-700">
          <div className="h-full bg-primary-500 transition-all duration-300" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{formatTime(elapsedDisplay)}</span>
          <span>{formatTime(targetSeconds)}</span>
        </div>
        {phase !== 'intro' && phase !== 'complete' && (
          <div className="flex justify-center">
            <button
              onClick={() => (phase === 'running' ? pause() : resume())}
              className={`flex min-h-11 items-center gap-2 rounded-lg px-8 py-3 font-semibold shadow-lg transition-all duration-300 ${
                phase === 'running'
                  ? 'bg-yellow-500 text-gray-900 shadow-yellow-500/20 hover:bg-yellow-600'
                  : 'bg-primary-500 text-white shadow-primary-500/20 hover:bg-primary-600'
              }`}
            >
              {phase === 'running' ? (
                <>
                  <Pause className="h-5 w-5" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-5 w-5" />
                  Resume
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
