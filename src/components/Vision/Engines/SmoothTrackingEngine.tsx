'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, CheckCircle, Circle, Eye, Pause, Play, RotateCcw, Volume2 } from 'lucide-react'
import type { ExerciseEngineDefinition, ExerciseEngineProps } from './types'

type TrackingPattern = 'horizontal' | 'vertical' | 'circle' | 'figure8'

const PATTERNS: { id: TrackingPattern; label: string; cue: string }[] = [
  { id: 'horizontal', label: 'Horizontal glide', cue: 'Follow side to side with eyes only.' },
  { id: 'vertical', label: 'Vertical lift', cue: 'Track up and down without lifting your chin.' },
  { id: 'circle', label: 'Circle pursuit', cue: 'Keep the motion round and unbroken.' },
  { id: 'figure8', label: 'Figure-8 flow', cue: 'Let your eyes draw a smooth infinity sign.' },
]

const DIFFICULTY_SPEED: Record<ExerciseEngineProps['difficulty'], number> = {
  starter: 9000,
  standard: 7000,
  challenge: 5400,
  advanced: 4200,
}

const DIFFICULTY_PACE: Record<ExerciseEngineProps['difficulty'], string> = {
  starter: 'Level 1',
  standard: 'Level 2',
  challenge: 'Level 3',
  advanced: 'Level 4',
}

export const smoothTrackingEngine: ExerciseEngineDefinition = {
  id: 'smooth-tracking-v1',
  label: 'Smooth Tracking',
  sourceExerciseId: 'smooth-tracking',
  supportedDeviceModes: ['phone', 'desktop'],
  measurable: true,
  defaultDurationSeconds: 180,
  displayOptions: {
    autoStart: true,
    hideNumericTimer: true,
  },
  component: SmoothTrackingEngine,
}

export default function SmoothTrackingEngine({
  exercise,
  difficulty,
  durationSeconds,
  deviceMode,
  reducedMotion,
  controls,
}: ExerciseEngineProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const animationRef = useRef<number | null>(null)
  const startedAtRef = useRef<number>(0)
  const [patternIndex, setPatternIndex] = useState(0)
  const [position, setPosition] = useState({ x: 50, y: 50 })
  const [loopsCompleted, setLoopsCompleted] = useState(0)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const completedRef = useRef(false)
  const pattern = PATTERNS[patternIndex]
  const cycleMs = DIFFICULTY_SPEED[difficulty]
  const paceLabel = DIFFICULTY_PACE[difficulty]

  const targetSize = deviceMode === 'phone' ? 34 : 42
  const pathScale = deviceMode === 'phone' ? 0.78 : 0.86

  const phaseLabel = useMemo(() => {
    if (controls.phase === 'intro') return 'Set your head still, soften your jaw, and prepare to track.'
    if (controls.phase === 'cooldown') return 'Blink slowly, look around the room, and let your eyes soften.'
    if (controls.phase === 'result') return 'Smooth Tracking complete.'
    return pattern.cue
  }, [controls.phase, pattern.cue])

  useEffect(() => {
    if (!audioEnabled || controls.phase !== 'active' || controls.isPaused || typeof window === 'undefined') return
    if (!('speechSynthesis' in window)) return

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(pattern.cue)
    utterance.rate = 0.92
    utterance.pitch = 1
    utterance.volume = 0.75
    window.speechSynthesis.speak(utterance)
  }, [audioEnabled, controls.phase, controls.isPaused, pattern.cue])

  useEffect(() => {
    if (controls.phase !== 'active' || controls.isPaused || reducedMotion) return

    const animate = (now: number) => {
      if (!startedAtRef.current) startedAtRef.current = now
      const elapsed = now - startedAtRef.current
      const normalized = (elapsed % cycleMs) / cycleMs
      const completedLoops = Math.floor(elapsed / cycleMs)
      setLoopsCompleted(completedLoops)

      const pathPosition = getPatternPosition(pattern.id, normalized, pathScale)
      setPosition(pathPosition)

      const nextIndex = Math.floor((controls.progress / 100) * PATTERNS.length)
      setPatternIndex(Math.min(PATTERNS.length - 1, nextIndex))

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [controls.phase, controls.isPaused, controls.progress, cycleMs, pattern.id, pathScale, reducedMotion])

  useEffect(() => {
    if (controls.phase !== 'active' || !reducedMotion) return
    const step = window.setInterval(() => {
      setPatternIndex((current) => (current + 1) % PATTERNS.length)
      setPosition((current) => ({
        x: current.x === 35 ? 65 : 35,
        y: current.y === 42 ? 58 : 42,
      }))
    }, 2200)
    return () => window.clearInterval(step)
  }, [controls.phase, reducedMotion])

  useEffect(() => {
    if (controls.phase !== 'active') {
      completedRef.current = false
      if (controls.phase === 'intro') {
        startedAtRef.current = 0
        setLoopsCompleted(0)
        setPatternIndex(0)
        setPosition({ x: 50, y: 50 })
      }
    }
  }, [controls.phase])

  const completeWithMetrics = () => {
    if (completedRef.current) return
    completedRef.current = true

    controls.complete({
      completionMode: 'performance',
      metrics: {
        patternsPracticed: PATTERNS.slice(0, patternIndex + 1).map((item) => item.id).join(', '),
        loopsCompleted,
        speedMsPerLoop: cycleMs,
        reducedMotion,
      },
    })
  }

  useEffect(() => {
    if (controls.phase === 'active' && controls.remainingSeconds <= 1) {
      completeWithMetrics()
    }
  }, [controls.phase, controls.remainingSeconds])

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-5 border border-primary-400/20 shadow-lg">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-primary-300 text-sm font-semibold mb-1">
              <Eye className="w-4 h-4" />
              Reference engine
            </div>
            <h3 className="text-2xl font-bold text-white">{exercise.title}</h3>
            <p className="text-gray-300 mt-2 max-w-2xl">
              Follow the moving target with eye motion only while the path changes automatically.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-gray-950/50 px-3 py-2 border border-gray-700/50">
              <div className="text-gray-400">Pattern</div>
              <div className="text-white font-semibold">{patternIndex + 1}/{PATTERNS.length}</div>
            </div>
            <div className="rounded-lg bg-gray-950/50 px-3 py-2 border border-gray-700/50">
              <div className="text-gray-400">Loops</div>
              <div className="text-white font-semibold">{loopsCompleted}</div>
            </div>
            <div className="rounded-lg bg-gray-950/50 px-3 py-2 border border-gray-700/50">
              <div className="text-gray-400">Pace</div>
              <div className="text-white font-semibold">{paceLabel}</div>
            </div>
          </div>
        </div>
      </div>

      <div
        ref={surfaceRef}
        className="relative overflow-hidden rounded-xl border border-primary-400/20 bg-[radial-gradient(circle_at_center,rgba(63,191,181,0.18),rgba(17,24,39,0.96)_58%)] shadow-2xl"
        style={{ minHeight: deviceMode === 'phone' ? 360 : 460 }}
      >
        <div className="absolute inset-5 rounded-full border border-primary-300/15" />
        <div className="absolute left-1/2 top-8 bottom-8 w-px bg-primary-300/10" />
        <div className="absolute top-1/2 left-8 right-8 h-px bg-primary-300/10" />
        <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
          <path
            d="M 14 50 C 25 25, 41 25, 50 50 S 75 75, 86 50 C 75 25, 59 25, 50 50 S 25 75, 14 50"
            fill="none"
            stroke="rgba(63, 191, 181, 0.24)"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
          <circle cx="50%" cy="50%" r="28%" fill="none" stroke="rgba(114, 194, 71, 0.16)" strokeWidth="1.5" />
        </svg>

        <div
          className="absolute rounded-full shadow-[0_0_34px_rgba(114,194,71,0.55)] transition-colors duration-300"
          style={{
            left: `${position.x}%`,
            top: `${position.y}%`,
            width: targetSize,
            height: targetSize,
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle at 35% 35%, #ffffff 0 8%, #72C247 9% 44%, #3FBFB5 45% 100%)',
          }}
        >
          <div className="absolute inset-[-10px] rounded-full border border-secondary-300/30" />
        </div>

        <div className="absolute left-4 right-4 top-4 flex flex-wrap items-center justify-between gap-3">
          <div className="sr-only" aria-live="polite">{phaseLabel}</div>
          <div className="flex items-center gap-2 rounded-lg bg-gray-950/70 px-3 py-2 backdrop-blur-sm border border-primary-400/20">
            <Activity className="w-4 h-4 text-secondary-300" />
            <span className="text-sm text-white">{pattern.label}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {PATTERNS.map((item, index) => (
          <div
            key={item.id}
            className={`rounded-lg border px-4 py-3 ${
              index === patternIndex
                ? 'border-secondary-400/50 bg-secondary-500/15 text-white'
                : index < patternIndex
                  ? 'border-primary-400/30 bg-primary-500/10 text-gray-200'
                  : 'border-gray-700/40 bg-gray-900/50 text-gray-400'
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              {index < patternIndex ? <CheckCircle className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
              {item.label}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={controls.restart}
          className="px-4 py-3 rounded-lg bg-gray-700/80 hover:bg-gray-600/80 text-white font-semibold flex items-center gap-2 transition-all"
        >
          <RotateCcw className="w-5 h-5" />
          Restart
        </button>
        <button
          onClick={controls.isPaused ? controls.resume : controls.pause}
          disabled={controls.phase !== 'active'}
          className="px-5 py-3 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:hover:bg-primary-600 text-white font-semibold flex items-center gap-2 transition-all"
        >
          {controls.isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
          {controls.isPaused ? 'Resume' : 'Pause'}
        </button>
        <button
          onClick={() => setAudioEnabled((enabled) => !enabled)}
          className={`px-4 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all ${
            audioEnabled ? 'bg-secondary-600 text-white' : 'bg-gray-800 text-gray-300'
          }`}
        >
          <Volume2 className="w-5 h-5" />
          Cues
        </button>
      </div>
    </div>
  )
}

function getPatternPosition(pattern: TrackingPattern, progress: number, scale: number) {
  const theta = progress * Math.PI * 2
  const width = 36 * scale
  const height = 30 * scale

  if (pattern === 'horizontal') {
    return { x: 50 + Math.cos(theta) * width, y: 50 }
  }

  if (pattern === 'vertical') {
    return { x: 50, y: 50 + Math.sin(theta) * height }
  }

  if (pattern === 'circle') {
    return { x: 50 + Math.cos(theta) * width * 0.72, y: 50 + Math.sin(theta) * height }
  }

  return {
    x: 50 + Math.sin(theta) * width,
    y: 50 + Math.sin(theta * 2) * height * 0.55,
  }
}
