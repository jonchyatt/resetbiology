'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Eye, RotateCcw, ShieldAlert, X } from 'lucide-react'
import { DirectionButtons, TumblingE } from './SnellenChart'
import { prefersReducedMotion } from '@/lib/vision/canvasKit'
import { unlockAudio } from '@/lib/vision/audioKit'
import {
  SCREEN_E_CORRECT_TO_PASS,
  SCREEN_E_LINE_MULTIPLIERS,
  SCREEN_E_TRIALS_PER_LINE,
  balancedScreenEDirections,
  createScreenDirectionalEEvidence,
  screenELineSize,
  type ScreenDirectionalEEvidence,
  type ScreenEDirection,
  type ScreenEInputMethod,
} from '@/lib/vision/screenDirectionalE'

export interface SnellenQuickCheckResult {
  evidence: ScreenDirectionalEEvidence
  durationSec: number
}

export interface SnellenQuickCheckProps {
  legs: 'both' | 'near-only'
  nightMode?: boolean
  onComplete: (result: SnellenQuickCheckResult) => void
  onExit: () => void
}

type Stage = 'intro' | 'check' | 'result'

interface RunResult {
  bestLine: number
  trialCount: number
  correctCount: number
  inputMethod: ScreenEInputMethod
}

function ScreenELineCheck({
  viewportWidth,
  reducedMotion,
  onDone,
}: {
  viewportWidth: number
  reducedMotion: boolean
  onDone: (result: RunResult) => void
}) {
  const [directions, setDirections] = useState(balancedScreenEDirections)
  const [lineIndex, setLineIndex] = useState(0)
  const [trialIndex, setTrialIndex] = useState(0)
  const [lineCorrect, setLineCorrect] = useState(0)
  const [trialCount, setTrialCount] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null)
  const inputMethodRef = useRef<ScreenEInputMethod>('pointer')
  const acceptingInputRef = useRef(true)
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
  }, [])

  const handleSelect = (direction: ScreenEDirection) => {
    if (feedback || !acceptingInputRef.current) return
    acceptingInputRef.current = false

    const correct = direction === directions[trialIndex]
    const nextLineCorrect = lineCorrect + (correct ? 1 : 0)
    const nextTrialCount = trialCount + 1
    const nextCorrectCount = correctCount + (correct ? 1 : 0)
    setFeedback(correct ? 'correct' : 'incorrect')
    setLineCorrect(nextLineCorrect)
    setTrialCount(nextTrialCount)
    setCorrectCount(nextCorrectCount)

    feedbackTimerRef.current = setTimeout(() => {
      setFeedback(null)
      if (trialIndex < SCREEN_E_TRIALS_PER_LINE - 1) {
        setTrialIndex(index => index + 1)
        acceptingInputRef.current = true
        return
      }

      const passed = nextLineCorrect >= SCREEN_E_CORRECT_TO_PASS
      if (!passed || lineIndex >= SCREEN_E_LINE_MULTIPLIERS.length - 1) {
        onDone({
          bestLine: passed ? lineIndex + 1 : lineIndex,
          trialCount: nextTrialCount,
          correctCount: nextCorrectCount,
          inputMethod: inputMethodRef.current,
        })
        return
      }

      setLineIndex(index => index + 1)
      setTrialIndex(0)
      setLineCorrect(0)
      setDirections(balancedScreenEDirections())
      acceptingInputRef.current = true
    }, reducedMotion ? 450 : 280)
  }

  const feedbackRingClass =
    feedback === 'correct'
      ? 'ring-4 ring-secondary-400'
      : feedback === 'incorrect'
        ? 'ring-4 ring-amber-400'
        : 'ring-2 ring-primary-400'

  return (
    <div
      className="space-y-6"
      onPointerDownCapture={event => {
        inputMethodRef.current = event.pointerType === 'touch' ? 'touch' : 'pointer'
      }}
      onKeyDownCapture={() => {
        inputMethodRef.current = 'keyboard'
      }}
    >
      <div className="text-center">
        <p className="text-gray-300 text-sm font-semibold">
          Screen-based directional-E check
        </p>
        <p className="text-gray-500 text-xs mt-1">
          Line {lineIndex + 1}/{SCREEN_E_LINE_MULTIPLIERS.length} · Trial {trialIndex + 1}/{SCREEN_E_TRIALS_PER_LINE}
        </p>
      </div>

      <div className="flex justify-center">
        <div className={`bg-white rounded-lg p-4 ${feedbackRingClass}`}>
          <TumblingE
            direction={directions[trialIndex]}
            size={screenELineSize(viewportWidth, lineIndex)}
            strokeWeight="normal"
            animate={false}
          />
        </div>
      </div>

      <p className="text-gray-400 text-xs text-center">
        Which way is the E pointing?
      </p>
      <DirectionButtons onSelect={handleSelect} compact />
    </div>
  )
}

export default function SnellenQuickCheck({
  legs,
  nightMode = false,
  onComplete,
  onExit,
}: SnellenQuickCheckProps) {
  const [stage, setStage] = useState<Stage>('intro')
  const [runResult, setRunResult] = useState<RunResult | null>(null)
  const [flowKey, setFlowKey] = useState(0)
  const [viewport, setViewport] = useState({ width: 390, height: 844, devicePixelRatio: 1 })
  const cardRef = useRef<HTMLDivElement | null>(null)
  const startRef = useRef<number | null>(null)
  const reducedMotion = prefersReducedMotion()

  useEffect(() => {
    const syncViewport = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1,
      })
    }
    syncViewport()
    window.addEventListener('resize', syncViewport)
    return () => window.removeEventListener('resize', syncViewport)
  }, [])

  useEffect(() => {
    const frame = requestAnimationFrame(() => cardRef.current?.scrollIntoView({ block: 'start' }))
    return () => cancelAnimationFrame(frame)
  }, [flowKey, stage])

  const handleStart = () => {
    unlockAudio()
    startRef.current = Date.now()
    setStage('check')
  }

  const handleKeep = () => {
    if (!runResult) return
    const durationSec = startRef.current ? Math.round((Date.now() - startRef.current) / 1000) : 0
    onComplete({
      evidence: createScreenDirectionalEEvidence({
        ...runResult,
        viewportCssWidth: viewport.width,
        viewportCssHeight: viewport.height,
        devicePixelRatio: viewport.devicePixelRatio,
      }),
      durationSec,
    })
  }

  const retry = () => {
    setRunResult(null)
    setFlowKey(key => key + 1)
    startRef.current = Date.now()
    setStage('check')
  }

  const cardClass = nightMode
    ? 'bg-gradient-to-br from-[#17100a]/90 to-[#0c0906]/90 border border-amber-900/40'
    : 'bg-gradient-to-br from-gray-800/90 to-gray-900/90 border border-primary-400/30'

  return (
    <div ref={cardRef} className="max-w-md mx-auto w-full scroll-mt-36">
      <div className={`${cardClass} backdrop-blur-sm rounded-xl p-6 shadow-2xl`}>
        <div className="flex justify-end mb-2">
          <button
            onClick={onExit}
            aria-label="Exit screen-based directional-E check"
            className="min-h-11 min-w-11 p-2 rounded-lg bg-gray-800/60 hover:bg-gray-700/60 text-gray-300 transition-colors flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {stage === 'intro' && (
          <div className="text-center space-y-4">
            <Eye className="w-9 h-9 text-primary-400 mx-auto" />
            <h3 className="text-xl font-bold text-white">Screen-based directional-E check</h3>
            <p className="text-gray-300 text-sm">
              Hold this screen about 25 cm away. We&apos;ll record the smallest line you can
              identify on this device—not a medical acuity score.
            </p>

            <div className="bg-amber-500/10 border border-amber-300/30 rounded-lg p-3 flex items-start gap-2 text-left">
              <ShieldAlert className="w-4 h-4 text-amber-200 mt-0.5 flex-shrink-0" />
              <p className="text-amber-50/90 text-xs leading-5">
                You&apos;re in control. Tired eyes are useful feedback—pause or stop. Pain,
                headache, dizziness, or new double vision ends the check; seek appropriate
                professional care.
              </p>
            </div>

            {legs === 'both' && (
              <p className="text-gray-500 text-xs">
                Far testing stays unavailable until measured distance and a remote, voice,
                keyboard, or helper response are ready.
              </p>
            )}

            <button
              onClick={handleStart}
              className="w-full min-h-11 px-6 py-3 bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-primary-500/30"
            >
              Start near-screen check
            </button>
          </div>
        )}

        {stage === 'check' && (
          <ScreenELineCheck
            key={flowKey}
            viewportWidth={viewport.width}
            reducedMotion={reducedMotion}
            onDone={result => {
              setRunResult(result)
              setStage('result')
            }}
          />
        )}

        {stage === 'result' && runResult && (
          <div className="text-center space-y-5 py-4">
            <div>
              <p className="text-gray-400 text-sm">Your reference on this screen</p>
              <p className="text-white text-3xl font-bold mt-2">
                Line {runResult.bestLine}/{SCREEN_E_LINE_MULTIPLIERS.length}
              </p>
              <p className="text-gray-500 text-xs mt-2">
                Screen-based training reference at the stated setup distance—not an eye exam
                or diagnosis.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={retry}
                className="flex-1 min-h-11 px-5 py-3 bg-gray-700/80 hover:bg-gray-600/80 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                Retry
              </button>
              <button
                onClick={handleKeep}
                className="flex-1 min-h-11 px-5 py-3 bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-all"
              >
                Keep this check
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
