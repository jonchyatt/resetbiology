'use client'

/**
 * SaccadeEngine (W1.4) — serves 'eye-jumps'.
 * Metronome-locked jumps between 2-6 fixed positions, widening each 2 phases.
 * Each jump flashes a letter; every 8-beat round pauses for a 4-choice probe.
 * Adaptive: 2 consecutive rounds >=90% accuracy -> +5 bpm; a round <60% -> -5 bpm.
 * Contract: src/components/Vision/Engines/types.ts
 * Plan: docs/plans/vision-training-interactive-overhaul.md §Tier 1 (W1.4)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Volume2, VolumeX, X, Zap } from 'lucide-react'
import type { EngineProps, EngineResult } from './types'
import { clampScore } from './types'
import { fitCanvasToElement, drawGaborPatch, drawGlow, drawFixationCross, type Point } from '@/lib/vision/canvasKit'
import { SpeechQueue, Metronome, unlockAudio } from '@/lib/vision/audioKit'

const BEATS_PER_ROUND = 8
const START_BPM_DEFAULT = 60
const MIN_BPM = 40
const MAX_BPM = 100
const BPM_STEP = 5
const PROBE_LETTERS = ['B', 'D', 'F', 'H', 'K', 'M', 'P', 'R', 'S', 'T', 'V', 'X']
const FLASH_MS = 250

type TargetSlot = { x: number; y: number; angle: number }

/** Widen the target set every 2 phases: 2 -> 4 -> 6 positions. */
function positionsForPhase(phase: number, halfW: number, halfH: number): TargetSlot[] {
  const base: TargetSlot[] = [
    { x: -halfW, y: 0, angle: 0 },
    { x: halfW, y: 0, angle: 90 },
  ]
  if (phase < 3) return base
  const vertical: TargetSlot[] = [
    { x: 0, y: -halfH, angle: 45 },
    { x: 0, y: halfH, angle: -45 },
  ]
  if (phase < 5) return [...base, ...vertical]
  const diagonal: TargetSlot[] = [
    { x: -halfW * 0.75, y: -halfH * 0.75, angle: 30 },
    { x: halfW * 0.75, y: halfH * 0.75, angle: -30 },
  ]
  return [...base, ...vertical, ...diagonal]
}

function formatTime(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

function pickProbeChoices(correct: string): string[] {
  const pool = PROBE_LETTERS.filter(l => l !== correct)
  const choices = [correct]
  while (choices.length < 4 && pool.length) {
    const idx = Math.floor(Math.random() * pool.length)
    choices.push(pool.splice(idx, 1)[0])
  }
  // Fisher-Yates shuffle so the correct answer isn't always first.
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[choices[i], choices[j]] = [choices[j], choices[i]]
  }
  return choices
}

export default function SaccadeEngine({ exercise, prescription, muted, onProgress, onComplete, onExit }: EngineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const speechRef = useRef<SpeechQueue | null>(null)
  if (!speechRef.current) speechRef.current = new SpeechQueue()

  const startBpm = Math.max(MIN_BPM, Math.min(MAX_BPM, prescription.bpm || START_BPM_DEFAULT))

  const [phase, setPhase] = useState<'intro' | 'running' | 'probe' | 'complete'>('intro')
  const [isMuted, setIsMuted] = useState(!!muted)
  const [elapsedDisplay, setElapsedDisplay] = useState(0)
  const [bpmDisplay, setBpmDisplay] = useState(startBpm)
  const [activeLetter, setActiveLetter] = useState<string | null>(null)
  const [probeChoices, setProbeChoices] = useState<string[]>([])
  const [probeCorrect, setProbeCorrect] = useState<string>('')
  const [lastRoundFeedback, setLastRoundFeedback] = useState<string | null>(null)
  const [speedAnnounce, setSpeedAnnounce] = useState<string | null>(null)

  useEffect(() => {
    speechRef.current!.muted = isMuted
  }, [isMuted])

  const targetSeconds = Math.max(30, prescription.targetSeconds || 180)
  const curriculumPhase = Math.max(1, Math.min(6, prescription.phase || 1))

  const cueList = useMemo(() => {
    const list = [...(exercise.checkpoints ?? []), ...(prescription.coachingCues ?? [])]
    return list.length ? list : ['Eyes jump, head still.']
  }, [exercise.checkpoints, prescription.coachingCues])

  // Refs that survive across metronome beat closures without going stale.
  const rafRef = useRef<number | undefined>(undefined)
  const elapsedStartRef = useRef<number | null>(null)
  const elapsedAccumRef = useRef(0)
  const completedRef = useRef(false)
  const completeTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const cueIndexRef = useRef(0)
  const cueTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  const activeIndexRef = useRef(0)
  const positionsRef = useRef<TargetSlot[]>([])
  const canvasSizeRef = useRef({ width: 0, height: 0 })
  const roundBeatRef = useRef(0)
  const roundLetterRef = useRef<string>('')
  const roundResultsRef = useRef<boolean[]>([])
  const consecutiveHighRef = useRef(0)
  const peakBpmRef = useRef(startBpm)
  const totalRoundsRef = useRef(0)
  const totalCorrectRoundsRef = useRef(0)
  const totalAnswered = useRef(0)
  const flashLetterRef = useRef<string | null>(null)
  const awaitingProbeRef = useRef(false)

  const metronomeRef = useRef<Metronome | null>(null)

  const drawScene = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.fillStyle = '#0b1220'
    ctx.fillRect(0, 0, width, height)
    const cx = width / 2
    const cy = height / 2
    const positions = positionsRef.current
    const activeIdx = activeIndexRef.current

    positions.forEach((slot, i) => {
      const x = cx + slot.x
      const y = cy + slot.y
      if (i === activeIdx) return
      drawGaborPatch(ctx, x, y, { size: 40, orientation: slot.angle, frequency: 4, contrast: 0.2 })
    })

    if (positions.length) {
      const active = positions[activeIdx]
      const x = cx + active.x
      const y = cy + active.y
      drawGlow(ctx, x, y, 32, 0.22)
      drawGaborPatch(ctx, x, y, { size: 50, orientation: active.angle, frequency: 5, contrast: 0.95 })
      if (flashLetterRef.current) {
        ctx.fillStyle = 'rgba(11,18,32,0.85)'
        ctx.beginPath()
        ctx.arc(x, y, 26, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 30px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(flashLetterRef.current, x, y)
      }
    }

    drawFixationCross(ctx, cx, cy, 10, 'rgba(255,255,255,0.75)')
  }, [])

  const renderLoop = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { width, height } = fitCanvasToElement(canvas)
    canvasSizeRef.current = { width, height }
    const ctx = canvas.getContext('2d')
    if (ctx) drawScene(ctx, width, height)
    rafRef.current = requestAnimationFrame(renderLoop)
  }, [drawScene])

  const evaluateRound = useCallback(() => {
    const results = roundResultsRef.current
    if (!results.length) return
    const correctCount = results.filter(Boolean).length
    const accuracyPct = Math.round((correctCount / results.length) * 100)
    totalRoundsRef.current += 1
    if (accuracyPct >= 90) totalCorrectRoundsRef.current += 1

    const m = metronomeRef.current
    if (!m) return
    if (accuracyPct >= 90) {
      consecutiveHighRef.current += 1
      if (consecutiveHighRef.current >= 2) {
        const next = Math.min(MAX_BPM, m.getBpm() + BPM_STEP)
        if (next !== m.getBpm()) {
          m.setBpm(next)
          peakBpmRef.current = Math.max(peakBpmRef.current, next)
          setBpmDisplay(next)
          setSpeedAnnounce(`Speeding up — ${next} beats`)
          speechRef.current?.speak(`Speeding up. ${next} beats per minute.`)
        }
        consecutiveHighRef.current = 0
      }
    } else {
      consecutiveHighRef.current = 0
      if (accuracyPct < 60) {
        const next = Math.max(MIN_BPM, m.getBpm() - BPM_STEP)
        if (next !== m.getBpm()) {
          m.setBpm(next)
          setBpmDisplay(next)
          setSpeedAnnounce(`Easing off — ${next} beats`)
          speechRef.current?.speak(`Easing off. ${next} beats per minute.`)
        }
      }
    }
    roundResultsRef.current = []
  }, [])

  const finish = useCallback(() => {
    if (completedRef.current) return
    completedRef.current = true
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    metronomeRef.current?.stop()
    if (cueTimerRef.current) clearInterval(cueTimerRef.current)
    setPhase('complete')
    speechRef.current?.speak('Nice work. Exercise complete.', { interrupt: true })

    const answered = totalAnswered.current
    const accuracyPct = answered > 0 ? Math.round((correctAnswersRef.current / answered) * 100) : 0
    const durationSec = Math.round(elapsedAccumRef.current)
    const bpmGain = Math.max(0, peakBpmRef.current - startBpm)
    const bpmNorm = Math.min(100, (bpmGain / Math.max(1, MAX_BPM - startBpm)) * 100)
    const score = clampScore(accuracyPct * 0.7 + bpmNorm * 0.3)

    const result: EngineResult = {
      exerciseId: exercise.id,
      durationSec,
      completed: true,
      score,
      metrics: {
        accuracyPct,
        peakBpm: peakBpmRef.current,
        roundsCompleted: totalRoundsRef.current,
      },
    }
    completeTimeoutRef.current = setTimeout(() => onComplete(result), 1400)
  }, [exercise.id, onComplete, startBpm])

  const correctAnswersRef = useRef(0)

  const advanceCue = useCallback(() => {
    const idx = cueIndexRef.current % cueList.length
    cueIndexRef.current += 1
    speechRef.current?.speak(cueList[idx])
  }, [cueList])

  const runProbe = useCallback(() => {
    const letter = roundLetterRef.current
    if (!letter) return
    awaitingProbeRef.current = true
    setProbeCorrect(letter)
    setProbeChoices(pickProbeChoices(letter))
    setPhase('probe')
    metronomeRef.current?.stop()
    speechRef.current?.speak('What did you see?')
  }, [])

  const onBeat = useCallback(
    (beatIndex: number) => {
      const positions = positionsRef.current
      if (!positions.length) return
      const idx = beatIndex % positions.length
      activeIndexRef.current = idx

      // Sample one probe letter per round on a mid-round beat.
      const roundBeat = beatIndex % BEATS_PER_ROUND
      roundBeatRef.current = roundBeat
      if (roundBeat === Math.floor(BEATS_PER_ROUND / 2)) {
        const letter = PROBE_LETTERS[Math.floor(Math.random() * PROBE_LETTERS.length)]
        roundLetterRef.current = letter
        flashLetterRef.current = letter
        setActiveLetter(letter)
        if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current)
        flashTimeoutRef.current = setTimeout(() => {
          flashLetterRef.current = null
          setActiveLetter(null)
        }, FLASH_MS)
      }

      if (roundBeat === BEATS_PER_ROUND - 1) {
        // Round finished — pause for the probe after this beat's flash clears.
        setTimeout(() => runProbe(), FLASH_MS + 120)
      }
    },
    [runProbe],
  )

  const start = useCallback(() => {
    unlockAudio()
    const canvas = canvasRef.current
    const { width, height } = canvas ? fitCanvasToElement(canvas) : { width: 0, height: 0 }
    const halfW = Math.max(80, width / 2 - 60)
    const halfH = Math.max(80, height / 2 - 100)
    positionsRef.current = positionsForPhase(curriculumPhase, halfW, halfH)

    metronomeRef.current = new Metronome(startBpm, onBeat)
    metronomeRef.current.muted = isMuted
    metronomeRef.current.start()

    elapsedStartRef.current = performance.now()
    setPhase('running')
    speechRef.current?.speak('Watch the target jump. Read the letter each time it flashes.', { interrupt: true })
    advanceCue()
    cueTimerRef.current = setInterval(advanceCue, 14000)
    rafRef.current = requestAnimationFrame(renderLoop)
  }, [advanceCue, curriculumPhase, isMuted, onBeat, renderLoop, startBpm])

  const answerProbe = useCallback(
    (choice: string) => {
      if (!awaitingProbeRef.current) return
      awaitingProbeRef.current = false
      const correct = choice === probeCorrect
      roundResultsRef.current.push(correct)
      totalAnswered.current += 1
      if (correct) correctAnswersRef.current += 1
      setLastRoundFeedback(correct ? 'Nailed it!' : `It was ${probeCorrect}`)
      evaluateRound()

      elapsedAccumRef.current += elapsedStartRef.current ? (performance.now() - elapsedStartRef.current) / 1000 : 0
      elapsedStartRef.current = performance.now()
      setElapsedDisplay(elapsedAccumRef.current)

      onProgress?.({
        accuracyPct: totalAnswered.current > 0 ? Math.round((correctAnswersRef.current / totalAnswered.current) * 100) : 0,
        peakBpm: peakBpmRef.current,
        roundsCompleted: totalRoundsRef.current,
      })

      if (elapsedAccumRef.current >= targetSeconds) {
        finish()
        return
      }

      setTimeout(() => {
        setLastRoundFeedback(null)
        setSpeedAnnounce(null)
        setPhase('running')
        metronomeRef.current?.start()
        rafRef.current = requestAnimationFrame(renderLoop)
      }, 900)
    },
    [evaluateRound, finish, onProgress, probeCorrect, renderLoop, targetSeconds],
  )

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (completeTimeoutRef.current) clearTimeout(completeTimeoutRef.current)
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current)
      if (cueTimerRef.current) clearInterval(cueTimerRef.current)
      metronomeRef.current?.stop()
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

  // Keep the live elapsed clock ticking while running (between probes).
  useEffect(() => {
    if (phase !== 'running') return
    const id = setInterval(() => {
      const base = elapsedStartRef.current ? (performance.now() - elapsedStartRef.current) / 1000 : 0
      setElapsedDisplay(elapsedAccumRef.current + base)
    }, 500)
    return () => clearInterval(id)
  }, [phase])

  const runningAccuracy = totalAnswered.current > 0 ? Math.round((correctAnswersRef.current / totalAnswered.current) * 100) : null

  return (
    <div className="relative flex h-full min-h-[100dvh] w-full select-none flex-col overflow-hidden bg-gray-950">
      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between bg-gradient-to-b from-gray-900/90 to-transparent px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-white">{exercise.title}</p>
          <p className="flex items-center gap-1 text-xs text-gray-400">
            <Zap className="h-3 w-3 text-secondary-400" />
            {bpmDisplay} bpm{runningAccuracy !== null ? ` · ${runningAccuracy}% accuracy` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setIsMuted(v => {
                const next = !v
                if (metronomeRef.current) metronomeRef.current.muted = next
                return next
              })
            }}
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
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        {speedAnnounce && phase === 'running' && (
          <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-primary-500/90 px-4 py-1.5 text-xs font-semibold text-white shadow-lg">
            {speedAnnounce}
          </div>
        )}

        {phase === 'intro' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950/85 p-6 backdrop-blur-sm">
            <div className="w-full max-w-sm space-y-5 rounded-xl border border-primary-400/20 bg-gradient-to-br from-gray-800/80 to-gray-900/80 p-6 text-center shadow-2xl">
              <h2 className="text-2xl font-bold text-white">{exercise.title}</h2>
              <p className="text-sm text-gray-400">{exercise.summary}</p>
              <p className="text-xs text-gray-500">
                Jump your eyes to each flash and remember the letter. Every 8 beats we&apos;ll ask what you saw — get it right and we speed up.
              </p>
              <button
                onClick={start}
                className="flex w-full min-h-11 items-center justify-center gap-2 rounded-lg bg-primary-500 px-8 py-3 font-semibold text-white shadow-lg shadow-primary-500/20 transition-all duration-300 hover:bg-primary-600"
              >
                Start
              </button>
            </div>
          </div>
        )}

        {phase === 'probe' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950/90 p-6 backdrop-blur-sm">
            <div className="w-full max-w-sm space-y-5 rounded-xl border border-primary-400/20 bg-gradient-to-br from-gray-800/80 to-gray-900/80 p-6 text-center shadow-2xl">
              <h2 className="text-lg font-semibold text-white">What did you see?</h2>
              {lastRoundFeedback ? (
                <p className={`text-2xl font-bold ${lastRoundFeedback.startsWith('Nailed') ? 'text-secondary-400' : 'text-yellow-400'}`}>
                  {lastRoundFeedback}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {probeChoices.map(choice => (
                    <button
                      key={choice}
                      onClick={() => answerProbe(choice)}
                      className="min-h-11 rounded-lg bg-gray-700/80 py-4 text-2xl font-bold text-white transition-all duration-300 hover:bg-primary-500"
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {phase === 'complete' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950/85 p-6 backdrop-blur-sm">
            <div className="w-full max-w-sm space-y-2 rounded-xl border border-secondary-400/30 bg-gradient-to-r from-secondary-600/20 to-primary-600/20 p-8 text-center shadow-2xl">
              <h2 className="text-2xl font-bold text-white">Exercise Complete!</h2>
              <p className="text-gray-300">Peak speed: {peakBpmRef.current} bpm</p>
            </div>
          </div>
        )}
      </div>

      {/* Progress */}
      <div className="relative z-10 space-y-2 px-4 pb-4">
        <div className="h-2 overflow-hidden rounded-full bg-gray-700">
          <div
            className="h-full bg-primary-500 transition-all duration-300"
            style={{ width: `${Math.min(100, Math.round((elapsedDisplay / targetSeconds) * 100))}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{formatTime(elapsedDisplay)}</span>
          <span>{formatTime(targetSeconds)}</span>
        </div>
      </div>
    </div>
  )
}
