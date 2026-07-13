'use client'

import { useEffect, useRef, useState } from 'react'
import { ShieldAlert, X, RotateCcw, ArrowRight, Eye, MoveHorizontal } from 'lucide-react'
import {
  CHART_LINES,
  CHART_LINE_TO_SNELLEN,
  TumblingE,
  DirectionButtons,
  generateLineDirections,
  type EDirection,
} from './SnellenChart'
import { prefersReducedMotion } from '@/lib/vision/canvasKit'
import { SpeechQueue, unlockAudio } from '@/lib/vision/audioKit'

/**
 * SnellenQuickCheck (Chunk B, Q1b+Q4 = ONE component) — a short, measured,
 * fully-abortable self-test replacing the old open-ended trainer diversion.
 * Reuses SnellenChart's optotype sizing (CHART_LINES) + fixed directional
 * answer pad (DirectionButtons) — no new sizing/answer mechanic invented.
 *
 * Safety (plan §4.8 / fix-package amendment 1): stop-rule copy shown before
 * either leg, X/Exit visible on every screen, zero persistence on abort —
 * onComplete fires ONLY from the confirm screen's "Use these" button.
 * Copy (plan §4.9 / amendment 1): proxy language — "your self-measured
 * reading", never a claim of measured acuity improvement.
 * Plan: jarvis data/rb-vision-interactive/runtime-logs/plan-2026-07-13-baseline-fix-package.md
 */

export interface SnellenQuickCheckResult {
  nearSnellen?: string
  farSnellen?: string
  durationSec: number
}

export interface SnellenQuickCheckProps {
  legs: 'both' | 'near-only'
  nightMode?: boolean
  onComplete: (result: SnellenQuickCheckResult) => void
  onExit: () => void
}

type Stage = 'intro' | 'near' | 'reposition' | 'far' | 'confirm'

function buildLegChart() {
  return CHART_LINES.map(line => ({ ...line, directions: generateLineDirections(line.letterCount) }))
}

// ---------------------------------------------------------------------------
// Leg — runs one distance's tumbling-E rounds. Line passes at >=3/4 correct;
// fail stops at the last passed line; ONE retry offered per leg (amendment 2).
// ---------------------------------------------------------------------------
function Leg({
  distanceLabel,
  reducedMotion,
  onDone,
}: {
  distanceLabel: 'near' | 'far'
  reducedMotion: boolean
  onDone: (snellen: string | undefined) => void
}) {
  const [chart, setChart] = useState(buildLegChart)
  const [lineIdx, setLineIdx] = useState(0)
  const [letterIdx, setLetterIdx] = useState(0)
  const [lineCorrect, setLineCorrect] = useState(0)
  const [lineTotal, setLineTotal] = useState(0)
  const [bestPassedIdx, setBestPassedIdx] = useState(-1)
  const [retryUsed, setRetryUsed] = useState(false)
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null)
  const [phase, setPhase] = useState<'running' | 'result'>('running')

  const currentLine = chart[lineIdx]

  const handleSelect = (dir: EDirection) => {
    if (feedback) return // debounce while feedback is showing
    const correct = dir === currentLine.directions[letterIdx]
    setFeedback(correct ? 'correct' : 'incorrect')
    const newCorrect = lineCorrect + (correct ? 1 : 0)
    const newTotal = lineTotal + 1
    setLineCorrect(newCorrect)
    setLineTotal(newTotal)

    setTimeout(() => {
      setFeedback(null)
      if (letterIdx < currentLine.letterCount - 1) {
        setLetterIdx(prev => prev + 1)
        return
      }
      // Line complete — evaluate against the 3/4 pass threshold
      const linePassed = newCorrect / newTotal >= 0.75
      if (linePassed) {
        setBestPassedIdx(lineIdx)
        if (lineIdx >= CHART_LINES.length - 1) {
          setPhase('result')
        } else {
          setLineIdx(prev => prev + 1)
          setLetterIdx(0)
          setLineCorrect(0)
          setLineTotal(0)
        }
      } else {
        setPhase('result')
      }
    }, reducedMotion ? 500 : 300)
  }

  const retry = () => {
    setChart(buildLegChart())
    setLineIdx(0)
    setLetterIdx(0)
    setLineCorrect(0)
    setLineTotal(0)
    setBestPassedIdx(-1)
    setRetryUsed(true)
    setFeedback(null)
    setPhase('running')
  }

  if (phase === 'result') {
    const snellen = bestPassedIdx >= 0 ? CHART_LINE_TO_SNELLEN[bestPassedIdx] : undefined
    return (
      <div className="text-center space-y-5 py-6">
        <p className="text-gray-300 text-sm">
          {distanceLabel === 'near' ? 'Near' : 'Far'} self-measured reading
        </p>
        <p className="text-white text-3xl font-bold">{snellen || 'Below chart range'}</p>
        <div className="flex gap-3 justify-center pt-2">
          {!retryUsed && (
            <button
              onClick={retry}
              className="min-h-11 px-5 py-3 bg-gray-700/80 hover:bg-gray-600/80 text-white rounded-lg font-semibold flex items-center gap-2 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              Retry
            </button>
          )}
          <button
            onClick={() => onDone(snellen)}
            className="min-h-11 px-6 py-3 bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white rounded-lg font-semibold flex items-center gap-2 transition-all"
          >
            Continue
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  const feedbackRingClass =
    feedback === 'correct'
      ? `ring-4 ring-green-500 ${reducedMotion ? '' : 'animate-pulse'}`
      : feedback === 'incorrect'
        ? `ring-4 ring-red-500 ${reducedMotion ? '' : 'animate-pulse'}`
        : 'ring-2 ring-primary-400'

  return (
    <div className="space-y-6">
      <p className="text-gray-500 text-xs text-center">
        Line {lineIdx + 1}/{CHART_LINES.length}
      </p>
      <div className="flex justify-center">
        <div className={`bg-white rounded-lg p-4 ${feedbackRingClass}`}>
          {/* Acuity staircase comes from SIZE ONLY (SnellenChart's baseSize × line.scale
              formula, base 55 ≈ phone single-E display) — constant stroke so line
              difficulty isn't double-penalized (FLW H2 measurement validity). */}
          <TumblingE
            direction={currentLine.directions[letterIdx]}
            size={Math.round(55 * currentLine.scale)}
            strokeWeight="normal"
            animate={false}
          />
        </div>
      </div>
      <DirectionButtons onSelect={handleSelect} compact />
    </div>
  )
}

// ---------------------------------------------------------------------------
// SnellenQuickCheck
// ---------------------------------------------------------------------------
export default function SnellenQuickCheck({ legs, nightMode = false, onComplete, onExit }: SnellenQuickCheckProps) {
  const [stage, setStage] = useState<Stage>('intro')
  const cardRef = useRef<HTMLDivElement | null>(null)
  const [nearResult, setNearResult] = useState<string | undefined>(undefined)
  const [farResult, setFarResult] = useState<string | undefined>(undefined)
  const [flowKey, setFlowKey] = useState(0)

  const startRef = useRef<number | null>(null)
  const speechRef = useRef<SpeechQueue | null>(null)
  const reducedMotion = prefersReducedMotion()

  useEffect(() => {
    speechRef.current = new SpeechQueue()
    return () => speechRef.current?.stop()
  }, [])

  // Bring the card fully into view on mount — at 390×844 the Day-1 mount opens
  // mid-page with the Start button below the fold (dual-eye Argus finding,
  // 2026-07-13). Instant, not smooth: reduced-motion safe.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({ block: 'start' })
    })
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    if (stage === 'reposition') {
      speechRef.current?.speak(
        "Nice. Now let's check your far vision. Stand back — arm's length from your screen, or across the room if you're on a monitor.",
        { interrupt: true }
      )
    }
  }, [stage])

  const handleStart = () => {
    unlockAudio()
    startRef.current = Date.now()
    setStage('near')
  }

  const handleNearDone = (snellen: string | undefined) => {
    setNearResult(snellen)
    setStage(legs === 'both' ? 'reposition' : 'confirm')
  }

  const handleFarDone = (snellen: string | undefined) => {
    setFarResult(snellen)
    setStage('confirm')
  }

  const handleUseThese = () => {
    const durationSec = startRef.current ? Math.round((Date.now() - startRef.current) / 1000) : 0
    onComplete({
      nearSnellen: nearResult,
      farSnellen: legs === 'both' ? farResult : undefined,
      durationSec,
    })
  }

  const handleRetryAll = () => {
    setNearResult(undefined)
    setFarResult(undefined)
    setFlowKey(k => k + 1)
    setStage('intro')
  }

  const cardClass = nightMode
    ? 'bg-gradient-to-br from-[#17100a]/90 to-[#0c0906]/90 border border-amber-900/40'
    : 'bg-gradient-to-br from-gray-800/90 to-gray-900/90 border border-primary-400/30'

  return (
    <div ref={cardRef} className="max-w-md mx-auto w-full scroll-mt-4">
      <div className={`${cardClass} backdrop-blur-sm rounded-xl p-6 shadow-2xl`}>
        {/* X/Exit — visible on every screen, zero persistence (amendment 1) */}
        <div className="flex justify-end mb-2">
          <button
            onClick={onExit}
            aria-label="Exit measurement"
            className="p-2 rounded-lg bg-gray-800/60 hover:bg-gray-700/60 text-gray-300 hover:text-red-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {stage === 'intro' && (
          <div className="text-center space-y-4">
            <Eye className="w-9 h-9 text-primary-400 mx-auto" />
            <h3 className="text-xl font-bold text-white">Guided self-measure</h3>

            <div className="bg-red-500/10 border border-red-400/30 rounded-lg p-3 flex items-start gap-2 text-left">
              <ShieldAlert className="w-4 h-4 text-red-300 mt-0.5 flex-shrink-0" />
              <p className="text-red-200/90 text-xs">
                Stop immediately if you feel pain, dizziness, double vision, or persistent blur.
                The X above ends this at any time.
              </p>
            </div>

            <p className="text-gray-300 text-sm">
              Hold your phone about 25cm away — a bit closer than normal reading distance.
              {legs === 'both' && " We'll check far vision after."}
            </p>
            <p className="text-gray-500 text-xs">
              You&apos;ll see a letter &quot;E&quot; pointing a direction. Tap the matching arrow.
            </p>

            <button
              onClick={handleStart}
              className="w-full min-h-11 px-6 py-3 bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-primary-500/30"
            >
              Start
            </button>
          </div>
        )}

        {stage === 'near' && (
          <Leg key={`near-${flowKey}`} distanceLabel="near" reducedMotion={reducedMotion} onDone={handleNearDone} />
        )}

        {stage === 'reposition' && (
          <div className="text-center space-y-5 py-6">
            <MoveHorizontal className="w-9 h-9 text-primary-400 mx-auto" />
            <h3 className="text-lg font-bold text-white">Reposition for far vision</h3>
            <p className="text-gray-300 text-sm">
              Stand back — arm&apos;s length from your screen, or across the room if you&apos;re on a monitor.
              Take your time, no rush.
            </p>
            <button
              onClick={() => setStage('far')}
              className="min-h-11 px-6 py-3 bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white font-bold rounded-xl transition-all"
            >
              Ready — Continue
            </button>
          </div>
        )}

        {stage === 'far' && (
          <Leg key={`far-${flowKey}`} distanceLabel="far" reducedMotion={reducedMotion} onDone={handleFarDone} />
        )}

        {stage === 'confirm' && (
          <div className="space-y-5">
            <div className="text-center">
              <h3 className="text-lg font-bold text-white">Your self-measured reading</h3>
              <p className="text-gray-500 text-xs mt-1">Training-performance proxy, not a clinical measurement.</p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="bg-gray-900/50 rounded-lg p-4 border border-primary-400/20 flex items-center justify-between">
                <span className="text-gray-400 text-sm">Near vision</span>
                <span className="text-white font-bold text-lg">{nearResult || '—'}</span>
              </div>
              {legs === 'both' && (
                <div className="bg-gray-900/50 rounded-lg p-4 border border-primary-400/20 flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Far vision</span>
                  <span className="text-white font-bold text-lg">{farResult || '—'}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleRetryAll}
                className="flex-1 min-h-11 px-5 py-3 bg-gray-700/80 hover:bg-gray-600/80 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                Retry
              </button>
              <button
                onClick={handleUseThese}
                className="flex-1 min-h-11 px-5 py-3 bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white rounded-lg font-semibold transition-all"
              >
                Use these
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
