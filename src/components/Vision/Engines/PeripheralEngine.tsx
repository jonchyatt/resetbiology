'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Play, Pause, Volume2, VolumeX, ChevronLeft, CheckCircle } from 'lucide-react'
import type { EngineProps, EngineResult, EngineMetrics, Prescription } from './types'
import { clampScore } from './types'
import { fitCanvasToElement, drawGaborPatch, drawFixationCross, drawGlow, prefersReducedMotion } from '@/lib/vision/canvasKit'
import { SpeechQueue, Metronome, playTone, unlockAudio } from '@/lib/vision/audioKit'

/**
 * PeripheralEngine (W1.5) — serves peripheral-pointing, mirror-scan, laterality-ladder.
 * Plan: docs/plans/vision-training-interactive-overhaul.md §Tier 1
 *
 * peripheral-pointing / mirror-scan: a central-letter compliance task PROVES the user
 * keeps their eyes fixated centrally while peripheral Gabor targets flash at increasing
 * eccentricity. mirror-scan swaps random rings for a quadrant sweep + "head still" cues.
 * laterality-ladder: crossed-response L/R prompts on a metronome-locked 3-count cadence.
 */

type Mode = 'peripheral' | 'mirror' | 'laterality'

function resolveMode(exerciseId: string): Mode {
  if (exerciseId === 'laterality-ladder') return 'laterality'
  if (exerciseId === 'mirror-scan') return 'mirror'
  return 'peripheral'
}

const LETTER_POOL = ['E', 'F', 'H', 'K', 'L', 'N', 'P', 'R', 'S', 'T', 'V', 'Z']
const RING_FRACTIONS = [0.3, 0.45, 0.6]
const SUCCESSES_PER_RING = 3
const HIT_RADIUS = 80

type PeripheralTarget = {
  x: number
  y: number
  spawnedAt: number
  displayMs: number
  ringIndex: number
  size: number
  orientation: number
}

type Decoy = { x: number; y: number; size: number; orientation: number; spawnedAt: number }

function targetDisplayMs(presc: Prescription): number {
  const base = 1900 / Math.max(1, presc.speedMultiplier)
  const byPhase = base * Math.max(0.55, 1 - (presc.phase - 1) * 0.07)
  return Math.max(650, byPhase)
}

function decoyCount(presc: Prescription): number {
  return Math.min(3, Math.max(0, presc.phase - 2))
}

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const mins = Math.floor(s / 60)
  const secs = s % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatMetricLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim()
}

export default function PeripheralEngine({ exercise, prescription, muted, onProgress, onComplete, onExit }: EngineProps) {
  const mode = useMemo<Mode>(() => resolveMode(exercise.id), [exercise.id])
  const modeLabel =
    mode === 'laterality'
      ? 'Laterality Ladder — crossed response'
      : mode === 'mirror'
        ? 'Mirror Scan — quadrant sweep'
        : 'Peripheral Pointing — central fixation + edge detection'

  const [isPlaying, setIsPlaying] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [isMuted, setIsMuted] = useState(!!muted)
  const [elapsedDisplay, setElapsedDisplay] = useState(0)
  const [finished, setFinished] = useState(false)
  const [result, setResult] = useState<EngineResult | null>(null)
  const [probeChoices, setProbeChoices] = useState<string[] | null>(null)
  const [flipBanner, setFlipBanner] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | undefined>(undefined)
  const lastFrameRef = useRef<number>(0)
  const elapsedMsRef = useRef<number>(0)
  const lastUiSyncRef = useRef<number>(-1000)
  const lastProgressSyncRef = useRef<number>(-1000)
  const isPlayingRef = useRef(false)
  const completedRef = useRef(false)
  const completeCalledRef = useRef(false)
  const reducedMotionRef = useRef(false)
  const modeRef = useRef<Mode>(mode)
  modeRef.current = mode

  const exerciseRef = useRef(exercise)
  exerciseRef.current = exercise
  const prescriptionRef = useRef(prescription)
  prescriptionRef.current = prescription
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const onProgressRef = useRef(onProgress)
  onProgressRef.current = onProgress

  const speechRef = useRef<SpeechQueue | null>(null)
  const metronomeRef = useRef<Metronome | null>(null)
  const timeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  const cuePoolRef = useRef<string[]>([])
  const cueIndexRef = useRef(0)
  const nextCueAtRef = useRef(8000)

  // peripheral / mirror state
  const centerLetterRef = useRef<string>('')
  const nextLetterChangeRef = useRef(400)
  const nextProbeAtRef = useRef(12000)
  const probeActiveRef = useRef(false)
  const probeCorrectAnswerRef = useRef('')
  const probeDeadlineRef = useRef(0)
  const probesShownRef = useRef(0)
  const probesCorrectRef = useRef(0)
  const activeTargetRef = useRef<PeripheralTarget | null>(null)
  const decoysRef = useRef<Decoy[]>([])
  const ringIndexRef = useRef(0)
  const successStreakRef = useRef(0)
  const spawnsRef = useRef(0)
  const hitsRef = useRef(0)
  const reactionTimesRef = useRef<number[]>([])
  const falsePositivesRef = useRef(0)
  const nextSpawnAtRef = useRef(600)
  const burstRef = useRef<{ x: number; y: number; at: number } | null>(null)
  const quadrantIndexRef = useRef(0)
  const quadrantDirRef = useRef(1)

  // laterality state
  const trialSideRef = useRef<'L' | 'R' | null>(null)
  const trialShownAtRef = useRef(0)
  const trialAnsweredRef = useRef(false)
  const ruleInvertedRef = useRef(false)
  const totalTrialsRef = useRef(0)
  const correctTrialsRef = useRef(0)
  const latReactionTimesRef = useRef<number[]>([])

  function pickLetter(exclude?: string): string {
    let letter = LETTER_POOL[Math.floor(Math.random() * LETTER_POOL.length)]
    let guard = 0
    while (letter === exclude && guard < 8) {
      letter = LETTER_POOL[Math.floor(Math.random() * LETTER_POOL.length)]
      guard++
    }
    return letter
  }

  function buildProbeChoices(correct: string): string[] {
    const pool = LETTER_POOL.filter((l) => l !== correct)
    const distractors = [...pool].sort(() => Math.random() - 0.5).slice(0, 2)
    return [correct, ...distractors].sort(() => Math.random() - 0.5)
  }

  function centerOf(width: number, height: number): { cx: number; cy: number } {
    return { cx: width / 2, cy: modeRef.current === 'laterality' ? height * 0.38 : height * 0.42 }
  }

  function effectiveRingIndex(presc: Prescription): number {
    const phaseFloor = Math.floor(((presc.phase ?? 1) - 1) / 2)
    return Math.min(RING_FRACTIONS.length - 1, Math.max(ringIndexRef.current, phaseFloor))
  }

  function ringRadius(width: number, height: number, ringIdx: number, targetSize: number): number {
    const frac = RING_FRACTIONS[Math.min(Math.max(ringIdx, 0), RING_FRACTIONS.length - 1)]
    const raw = frac * Math.min(width, height)
    const max = Math.min(width, height) / 2 - targetSize / 2 - 16
    return Math.max(30, Math.min(raw, max))
  }

  function snapshotMetrics(): EngineMetrics {
    if (modeRef.current === 'laterality') {
      const total = totalTrialsRef.current
      return {
        lateralityErrorRate: total > 0 ? Math.round(((total - correctTrialsRef.current) / total) * 1000) / 10 : 0,
        roundsCompleted: total,
      }
    }
    const spawns = spawnsRef.current
    return {
      detectionPct: spawns > 0 ? Math.round((hitsRef.current / spawns) * 1000) / 10 : 0,
      fixationCompliancePct:
        probesShownRef.current > 0 ? Math.round((probesCorrectRef.current / probesShownRef.current) * 1000) / 10 : 100,
      maxEccentricityRing: Math.round(RING_FRACTIONS[Math.min(ringIndexRef.current, RING_FRACTIONS.length - 1)] * 100),
      falsePositives: falsePositivesRef.current,
    }
  }

  function buildResult(completed: boolean): EngineResult {
    const durationSec = Math.round(elapsedMsRef.current / 1000)
    if (modeRef.current === 'laterality') {
      const total = totalTrialsRef.current
      const correct = correctTrialsRef.current
      const lateralityErrorRate = total > 0 ? Math.round(((total - correct) / total) * 1000) / 10 : 0
      const meanReactionMs = latReactionTimesRef.current.length
        ? Math.round(latReactionTimesRef.current.reduce((a, b) => a + b, 0) / latReactionTimesRef.current.length)
        : 0
      const metrics: EngineMetrics = { lateralityErrorRate, meanReactionMs, roundsCompleted: total }
      const score = clampScore(total > 0 ? (correct / total) * 100 : 0)
      return { exerciseId: exerciseRef.current.id, durationSec, completed, score, metrics }
    }
    const spawns = spawnsRef.current
    const hits = hitsRef.current
    const detectionPct = spawns > 0 ? Math.round((hits / spawns) * 1000) / 10 : 0
    const meanReactionMs = reactionTimesRef.current.length
      ? Math.round(reactionTimesRef.current.reduce((a, b) => a + b, 0) / reactionTimesRef.current.length)
      : 0
    const probesShown = probesShownRef.current
    const fixationCompliancePct = probesShown > 0 ? Math.round((probesCorrectRef.current / probesShown) * 1000) / 10 : 100
    const maxEccentricityRing = Math.round(RING_FRACTIONS[Math.min(ringIndexRef.current, RING_FRACTIONS.length - 1)] * 100)
    const metrics: EngineMetrics = {
      detectionPct,
      meanReactionMs,
      fixationCompliancePct,
      maxEccentricityRing,
      falsePositives: falsePositivesRef.current,
    }
    const score = clampScore(detectionPct * (fixationCompliancePct / 100))
    return { exerciseId: exerciseRef.current.id, durationSec, completed, score, metrics }
  }

  function finishExercise() {
    isPlayingRef.current = false
    setIsPlaying(false)
    metronomeRef.current?.stop()
    speechRef.current?.speak('Exercise complete. Nice work.', { interrupt: true })
    const res = buildResult(true)
    setResult(res)
    setFinished(true)
    if (!completeCalledRef.current) {
      completeCalledRef.current = true
      onCompleteRef.current(res)
    }
  }

  function spawnTarget(width: number, height: number, presc: Prescription, now: number) {
    const { cx, cy } = centerOf(width, height)
    const size = Math.max(22, 34 - (presc.phase - 1) * 2)
    const ringIdxUsed = effectiveRingIndex(presc)
    let x: number
    let y: number
    if (modeRef.current === 'mirror') {
      const quadrants = [
        { dx: -1, dy: -1 },
        { dx: 1, dy: -1 },
        { dx: 1, dy: 1 },
        { dx: -1, dy: 1 },
      ]
      const order = quadrantDirRef.current === 1 ? [0, 1, 2, 3] : [3, 2, 1, 0]
      const q = quadrants[order[quadrantIndexRef.current % 4]]
      const r = ringRadius(width, height, ringIdxUsed, size)
      x = cx + q.dx * r * 0.75
      y = cy + q.dy * r * 0.6
      quadrantIndexRef.current++
      if (quadrantIndexRef.current % 4 === 0) quadrantDirRef.current *= -1
    } else {
      const r = ringRadius(width, height, ringIdxUsed, size)
      const angle = Math.random() * Math.PI * 2
      x = cx + Math.cos(angle) * r
      y = cy + Math.sin(angle) * r
    }
    x = Math.max(size, Math.min(width - size, x))
    y = Math.max(size + 30, Math.min(height - size - 70, y))
    activeTargetRef.current = {
      x,
      y,
      spawnedAt: now,
      displayMs: targetDisplayMs(presc),
      ringIndex: ringIdxUsed,
      size,
      orientation: Math.random() * 180,
    }
    spawnsRef.current++

    const numDecoys = decoyCount(presc)
    const decoys: Decoy[] = []
    for (let i = 0; i < numDecoys; i++) {
      const dr = ringRadius(width, height, Math.max(0, ringIdxUsed - 1), size * 0.9)
      const dangle = Math.random() * Math.PI * 2
      let dx = cx + Math.cos(dangle) * dr
      let dy = cy + Math.sin(dangle) * dr
      dx = Math.max(size, Math.min(width - size, dx))
      dy = Math.max(size + 30, Math.min(height - size - 70, dy))
      decoys.push({ x: dx, y: dy, size: size * 0.85, orientation: Math.random() * 180, spawnedAt: now })
    }
    decoysRef.current = decoys
  }

  function handleLatBeat(beatIndex: number) {
    const phase = beatIndex % 3
    const now = elapsedMsRef.current
    if (phase === 0) {
      const side: 'L' | 'R' = Math.random() < 0.5 ? 'L' : 'R'
      if ((prescriptionRef.current.week ?? 0) >= 5 && totalTrialsRef.current > 0 && Math.random() < 0.15) {
        ruleInvertedRef.current = !ruleInvertedRef.current
        speechRef.current?.speak(
          ruleInvertedRef.current ? 'Rule flip! Same side now.' : 'Rule flip! Opposite side again.',
          { interrupt: true }
        )
        setFlipBanner(true)
        const id = setTimeout(() => setFlipBanner(false), 1600)
        timeoutsRef.current.add(id)
      }
      trialSideRef.current = side
      trialShownAtRef.current = now
      trialAnsweredRef.current = false
    } else if (phase === 2) {
      if (trialSideRef.current && !trialAnsweredRef.current) {
        totalTrialsRef.current++
      }
      trialSideRef.current = null
    }
  }

  function handleLatResponse(buttonSide: 'left' | 'right') {
    if (!isPlayingRef.current || completedRef.current) return
    if (!trialSideRef.current || trialAnsweredRef.current) return
    trialAnsweredRef.current = true
    const promptedSide = trialSideRef.current
    const inverted = ruleInvertedRef.current
    const correctSide: 'left' | 'right' = inverted
      ? promptedSide === 'L'
        ? 'left'
        : 'right'
      : promptedSide === 'L'
        ? 'right'
        : 'left'
    const correct = buttonSide === correctSide
    const now = elapsedMsRef.current
    const reaction = now - trialShownAtRef.current
    totalTrialsRef.current++
    if (correct) correctTrialsRef.current++
    latReactionTimesRef.current.push(reaction)
    playTone(correct ? 660 : 220, 90, 0.28)
  }

  function answerProbe(choice: string) {
    if (!probeActiveRef.current) return
    probesShownRef.current++
    const correct = choice === probeCorrectAnswerRef.current
    if (correct) probesCorrectRef.current++
    playTone(correct ? 660 : 220, 100, 0.28)
    probeActiveRef.current = false
    setProbeChoices(null)
    const now = elapsedMsRef.current
    nextProbeAtRef.current = now + 12000 + Math.random() * 6000
    nextLetterChangeRef.current = now + 2000 + Math.random() * 1000
    nextSpawnAtRef.current = now + 400
  }

  function handleCanvasPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isPlayingRef.current || completedRef.current) return
    if (modeRef.current === 'laterality') return
    if (probeActiveRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const now = elapsedMsRef.current
    const target = activeTargetRef.current
    if (target) {
      const dist = Math.hypot(x - target.x, y - target.y)
      if (dist <= HIT_RADIUS) {
        hitsRef.current++
        reactionTimesRef.current.push(now - target.spawnedAt)
        successStreakRef.current++
        if (successStreakRef.current >= SUCCESSES_PER_RING && ringIndexRef.current < RING_FRACTIONS.length - 1) {
          ringIndexRef.current++
          successStreakRef.current = 0
        }
        burstRef.current = { x: target.x, y: target.y, at: now }
        playTone(660, 90, 0.3)
        activeTargetRef.current = null
        decoysRef.current = []
        nextSpawnAtRef.current = now + 300
        return
      }
    }
    for (const d of decoysRef.current) {
      if (Math.hypot(x - d.x, y - d.y) <= HIT_RADIUS) {
        falsePositivesRef.current++
        playTone(200, 120, 0.25)
        return
      }
    }
  }

  // Mount-once: build cue pool, start the RAF loop, cleanup on unmount.
  useEffect(() => {
    speechRef.current = new SpeechQueue()
    reducedMotionRef.current = prefersReducedMotion()

    const base = [...exerciseRef.current.checkpoints, ...prescriptionRef.current.coachingCues]
    const extra =
      modeRef.current === 'mirror'
        ? ['Keep your head still.', 'Chin level — only your eyes sweep.', 'Shoulders relaxed, head anchored.']
        : []
    cuePoolRef.current = [...base, ...extra].filter(Boolean)

    function drawPeripheralOrMirror(ctx: CanvasRenderingContext2D, width: number, height: number, now: number) {
      const { cx, cy } = centerOf(width, height)
      const ringIdx = effectiveRingIndex(prescriptionRef.current)
      const guideR = ringRadius(width, height, ringIdx, 30)
      ctx.save()
      ctx.strokeStyle = 'rgba(63,191,181,0.12)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(cx, cy, guideR, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()

      drawGlow(ctx, cx, cy, 46, 0.18)
      drawFixationCross(ctx, cx, cy, 10)
      ctx.save()
      ctx.fillStyle = 'rgba(255,255,255,0.92)'
      ctx.font = 'bold 40px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(centerLetterRef.current, cx, cy)
      ctx.restore()

      for (const d of decoysRef.current) {
        const age = now - d.spawnedAt
        const alpha = reducedMotionRef.current ? 1 : Math.min(1, age / 350)
        ctx.save()
        ctx.globalAlpha = alpha
        drawGaborPatch(ctx, d.x, d.y, { size: d.size, orientation: d.orientation, frequency: 4, contrast: 0.22 })
        ctx.restore()
      }

      const target = activeTargetRef.current
      if (target) {
        const age = now - target.spawnedAt
        const alpha = reducedMotionRef.current ? 1 : Math.min(1, age / 350)
        ctx.save()
        ctx.globalAlpha = alpha
        drawGlow(ctx, target.x, target.y, target.size * 0.9, 0.25)
        drawGaborPatch(ctx, target.x, target.y, { size: target.size, orientation: target.orientation, frequency: 5, contrast: 0.95 })
        ctx.restore()
      }

      const burst = burstRef.current
      if (burst) {
        const age = now - burst.at
        if (age < 400) {
          const p = reducedMotionRef.current ? 0.3 : age / 400
          drawGlow(ctx, burst.x, burst.y, 40 + p * 70, 0.35 * (1 - p))
          ctx.save()
          ctx.strokeStyle = `rgba(114,194,71,${0.9 * (1 - p)})`
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.arc(burst.x, burst.y, 20 + p * 50, 0, Math.PI * 2)
          ctx.stroke()
          ctx.restore()
        } else {
          burstRef.current = null
        }
      }
    }

    function drawLaterality(ctx: CanvasRenderingContext2D, width: number, height: number) {
      const { cx, cy } = centerOf(width, height)
      drawFixationCross(ctx, cx, cy, 14)
      const side = trialSideRef.current
      if (side) {
        const offset = width * 0.28
        const x = side === 'L' ? cx - offset : cx + offset
        const answered = trialAnsweredRef.current
        drawGlow(ctx, x, cy, 70, answered ? 0.12 : 0.25)
        ctx.save()
        ctx.fillStyle = answered ? 'rgba(255,255,255,0.4)' : '#ffffff'
        ctx.font = 'bold 88px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(side, x, cy)
        ctx.restore()
      }
      ctx.save()
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.font = '13px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(ruleInvertedRef.current ? 'Rule: same side' : 'Rule: crossed', cx, cy + 60)
      ctx.restore()
    }

    function doFrame(t: number) {
      const canvas = canvasRef.current
      if (!canvas) return
      const { width, height } = fitCanvasToElement(canvas)
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      if (!lastFrameRef.current) lastFrameRef.current = t
      const dt = t - lastFrameRef.current
      lastFrameRef.current = t

      if (isPlayingRef.current && !completedRef.current) {
        elapsedMsRef.current += dt
      }
      const now = elapsedMsRef.current

      if (isPlayingRef.current && !completedRef.current) {
        const presc = prescriptionRef.current

        if (modeRef.current !== 'laterality') {
          if (!probeActiveRef.current) {
            if (!activeTargetRef.current && now >= nextSpawnAtRef.current) {
              spawnTarget(width, height, presc, now)
            }
            const target = activeTargetRef.current
            if (target && now - target.spawnedAt >= target.displayMs) {
              activeTargetRef.current = null
              decoysRef.current = []
              successStreakRef.current = 0
              nextSpawnAtRef.current = now + 350
            }
            if (now >= nextLetterChangeRef.current) {
              centerLetterRef.current = pickLetter(centerLetterRef.current)
              nextLetterChangeRef.current = now + 2000 + Math.random() * 1000
            }
            if (now >= nextProbeAtRef.current) {
              probeActiveRef.current = true
              probeCorrectAnswerRef.current = centerLetterRef.current
              probeDeadlineRef.current = now + 4000
              activeTargetRef.current = null
              decoysRef.current = []
              setProbeChoices(buildProbeChoices(centerLetterRef.current))
            }
          } else if (now >= probeDeadlineRef.current) {
            probesShownRef.current++
            probeActiveRef.current = false
            setProbeChoices(null)
            nextProbeAtRef.current = now + 12000 + Math.random() * 6000
            nextLetterChangeRef.current = now + 2000 + Math.random() * 1000
            nextSpawnAtRef.current = now + 400
          }
        }

        if (now >= nextCueAtRef.current && cuePoolRef.current.length > 0) {
          const cue = cuePoolRef.current[cueIndexRef.current % cuePoolRef.current.length]
          cueIndexRef.current++
          speechRef.current?.speak(cue)
          nextCueAtRef.current = now + 16000 + Math.random() * 6000
        }
      }

      if (now - lastUiSyncRef.current >= 200) {
        lastUiSyncRef.current = now
        setElapsedDisplay(Math.floor(now / 1000))
      }
      if (now - lastProgressSyncRef.current >= 1000) {
        lastProgressSyncRef.current = now
        onProgressRef.current?.(snapshotMetrics())
      }

      ctx.fillStyle = '#0f172a'
      ctx.fillRect(0, 0, width, height)
      if (modeRef.current === 'laterality') drawLaterality(ctx, width, height)
      else drawPeripheralOrMirror(ctx, width, height, now)

      if (isPlayingRef.current && !completedRef.current && now / 1000 >= prescriptionRef.current.targetSeconds) {
        completedRef.current = true
        finishExercise()
      }
    }

    const loop = (t: number) => {
      doFrame(t)
      if (!completedRef.current) {
        rafRef.current = requestAnimationFrame(loop)
      }
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      metronomeRef.current?.stop()
      speechRef.current?.stop()
      timeoutsRef.current.forEach((id) => clearTimeout(id))
      timeoutsRef.current.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (speechRef.current) speechRef.current.muted = isMuted
    if (metronomeRef.current) metronomeRef.current.muted = isMuted
  }, [isMuted])

  function handleStart() {
    unlockAudio()
    if (!hasStarted) {
      setHasStarted(true)
      speechRef.current?.speak(exerciseRef.current.summary, { interrupt: true })
      const now = elapsedMsRef.current
      nextLetterChangeRef.current = now + 400
      nextProbeAtRef.current = now + 12000 + Math.random() * 6000
      nextSpawnAtRef.current = now + 600
      nextCueAtRef.current = now + 8000
      centerLetterRef.current = pickLetter()
    }
    isPlayingRef.current = true
    setIsPlaying(true)
    if (mode === 'laterality') {
      if (!metronomeRef.current) {
        metronomeRef.current = new Metronome(prescriptionRef.current.bpm ?? 40, handleLatBeat)
        metronomeRef.current.muted = isMuted
      }
      metronomeRef.current.start()
    }
  }

  function handlePauseToggle() {
    if (isPlaying) {
      isPlayingRef.current = false
      setIsPlaying(false)
      metronomeRef.current?.stop()
    } else {
      handleStart()
    }
  }

  if (finished && result) {
    return (
      <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-6 rounded-xl border border-secondary-400/30 bg-gradient-to-br from-gray-800/80 to-gray-900/80 p-8 text-center shadow-2xl backdrop-blur-sm">
        <CheckCircle className="h-16 w-16 text-secondary-400" />
        <div>
          <h2 className="mb-1 text-2xl font-bold text-white">{exercise.title} complete</h2>
          <p className="text-gray-400">Score {result.score}/100</p>
        </div>
        <div className="grid w-full max-w-xs grid-cols-2 gap-3 text-sm text-gray-300">
          {Object.entries(result.metrics).map(([k, v]) => (
            <div key={k} className="rounded-lg border border-primary-400/10 bg-gray-900/60 p-2">
              <div className="text-xs uppercase tracking-wide text-gray-500">{formatMetricLabel(k)}</div>
              <div className="font-semibold text-white">{v}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-[560px] w-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          onClick={onExit}
          className="flex items-center gap-1 text-sm text-gray-400 transition-colors hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
          Exit
        </button>
        <div className="text-center">
          <h2 className="text-lg font-bold leading-tight text-white">{exercise.title}</h2>
          <p className="text-xs text-gray-500">{modeLabel}</p>
        </div>
        <button
          onClick={() => setIsMuted((m) => !m)}
          className="rounded-lg bg-gray-800/30 p-2 text-gray-400 backdrop-blur-sm transition-all duration-300 hover:bg-gray-700/30 hover:text-white"
        >
          {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      </div>

      <div>
        <div className="mb-1 flex justify-between text-xs text-gray-400">
          <span>{formatTime(elapsedDisplay)}</span>
          <span>{formatTime(prescription.targetSeconds)}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-gray-700">
          <div
            className="h-full bg-primary-500 transition-all duration-500"
            style={{ width: `${Math.min(100, (elapsedDisplay / Math.max(1, prescription.targetSeconds)) * 100)}%` }}
          />
        </div>
      </div>

      <div className="relative min-h-[380px] w-full flex-1 overflow-hidden rounded-xl border border-primary-400/20 bg-[#0f172a] shadow-lg">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none"
          onPointerDown={handleCanvasPointerDown}
        />

        {!hasStarted && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/70 px-6 text-center backdrop-blur-sm">
            <p className="text-sm text-gray-200">{exercise.summary}</p>
          </div>
        )}

        {probeChoices && (
          <div className="absolute inset-x-0 bottom-6 flex flex-col items-center gap-3 px-4">
            <p className="rounded-lg border border-primary-400/30 bg-gray-900/80 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-sm">
              What letter is showing?
            </p>
            <div className="flex gap-3">
              {probeChoices.map((choice) => (
                <button
                  key={choice}
                  onClick={() => answerProbe(choice)}
                  className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary-500 text-2xl font-bold text-white shadow-lg shadow-primary-500/30 transition-all duration-200 hover:bg-primary-600 active:scale-95"
                >
                  {choice}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === 'laterality' && (
          <>
            <button
              onClick={() => handleLatResponse('left')}
              className="absolute bottom-4 left-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary-500 text-lg font-bold text-white shadow-lg shadow-primary-500/30 transition-all duration-150 hover:bg-primary-600 active:scale-95"
            >
              LEFT
            </button>
            <button
              onClick={() => handleLatResponse('right')}
              className="absolute bottom-4 right-4 flex h-20 w-20 items-center justify-center rounded-full bg-secondary-500 text-lg font-bold text-white shadow-lg shadow-secondary-500/30 transition-all duration-150 hover:bg-secondary-600 active:scale-95"
            >
              RIGHT
            </button>
            {flipBanner && (
              <div className="absolute inset-x-0 top-4 flex justify-center">
                <span className="animate-pulse rounded-lg bg-yellow-500/90 px-4 py-2 text-sm font-bold text-gray-900 shadow-lg">
                  {ruleInvertedRef.current ? 'Rule flip! Same side now.' : 'Rule flip! Opposite side again.'}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex justify-center gap-4">
        <button
          onClick={handlePauseToggle}
          className={`flex items-center gap-2 rounded-lg px-8 py-3 font-semibold shadow-lg transition-all duration-300 ${
            isPlaying
              ? 'bg-yellow-500 text-gray-900 shadow-yellow-500/20 hover:bg-yellow-600'
              : 'bg-primary-500 text-white shadow-primary-500/20 hover:bg-primary-600'
          }`}
        >
          {isPlaying ? (
            <>
              <Pause className="h-5 w-5" />
              Pause
            </>
          ) : (
            <>
              <Play className="h-5 w-5" />
              {hasStarted ? 'Resume' : 'Start'}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
