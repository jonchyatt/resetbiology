'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle, Eye, Hand, MoveHorizontal, Sparkles, Zap } from 'lucide-react'
import type { ExerciseEngineDefinition, ExerciseEngineProps } from './types'
import type { VisionExercise } from '@/data/visionExercises'

const DEFAULT_DURATION_SECONDS = 120

export function createGuidedStimulusEngine(exercise: VisionExercise): ExerciseEngineDefinition {
  return {
    id: `${exercise.id}-guided-stimulus-v1`,
    label: `${exercise.title} guided stimulus`,
    sourceExerciseId: exercise.id,
    supportedDeviceModes: ['phone', 'desktop'],
    measurable: false,
    defaultDurationSeconds: DEFAULT_DURATION_SECONDS,
    component: GuidedStimulusEngine,
  }
}

export default function GuidedStimulusEngine({
  exercise,
  difficulty,
  deviceMode,
  reducedMotion,
  controls,
}: ExerciseEngineProps) {
  const [stimulusStep, setStimulusStep] = useState(0)
  const [qualityChecks, setQualityChecks] = useState<Record<string, boolean>>({})
  const cues = useMemo(() => buildCues(exercise), [exercise])
  const motion = getMotionForExercise(exercise)
  const stimulusSize = deviceMode === 'phone' ? 34 : 42

  useEffect(() => {
    if (controls.phase !== 'active' || controls.isPaused) return
    const timer = window.setInterval(() => {
      setStimulusStep((step) => step + 1)
    }, reducedMotion ? 2600 : motion.intervalMs[difficulty])
    return () => window.clearInterval(timer)
  }, [controls.phase, controls.isPaused, difficulty, motion.intervalMs, reducedMotion])

  const activeCue = cues[stimulusStep % cues.length]
  const position = getStimulusPosition(motion.kind, stimulusStep, reducedMotion)

  const complete = () => {
    controls.complete({
      completionMode: 'subjective',
      metrics: {
        stimulusPattern: motion.kind,
        cueCount: cues.length,
        qualityChecksPassed: Object.values(qualityChecks).filter(Boolean).length,
        reducedMotion,
      },
    })
  }

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-5 border border-primary-400/20 shadow-lg">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-primary-600/20">
            <motion.icon className="w-7 h-7 text-primary-300" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-primary-300 font-semibold">
              Scaffold engine
            </div>
            <h3 className="text-2xl font-bold text-white">{exercise.title}</h3>
            <p className="text-gray-300 mt-2">{exercise.summary}</p>
          </div>
        </div>
      </div>

      <div
        className="relative overflow-hidden rounded-xl border border-primary-400/20 bg-gray-950 shadow-2xl"
        style={{ minHeight: deviceMode === 'phone' ? 340 : 420 }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(63,191,181,0.18),transparent_62%)]" />
        <div className="absolute inset-8 rounded-full border border-primary-400/10" />
        <div className="absolute left-8 right-8 top-1/2 h-px bg-primary-400/10" />
        <div className="absolute top-8 bottom-8 left-1/2 w-px bg-primary-400/10" />

        {motion.kind === 'breath' && (
          <div
            className="absolute rounded-full border border-secondary-300/30 bg-secondary-400/15 transition-all duration-1000"
            style={{
              left: '50%',
              top: '50%',
              width: stimulusStep % 2 === 0 ? 170 : 230,
              height: stimulusStep % 2 === 0 ? 170 : 230,
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 0 80px rgba(114, 194, 71, 0.18)',
            }}
          />
        )}

        <div
          className="absolute rounded-full transition-all duration-500"
          style={{
            left: `${position.x}%`,
            top: `${position.y}%`,
            width: stimulusSize,
            height: stimulusSize,
            transform: 'translate(-50%, -50%)',
            background: motion.color,
            boxShadow: '0 0 34px rgba(63, 191, 181, 0.45)',
          }}
        />

        {motion.kind === 'peripheral' && Array.from({ length: 10 }).map((_, index) => {
          const angle = (Math.PI * 2 * index) / 10
          const x = 50 + Math.cos(angle) * 34
          const y = 50 + Math.sin(angle) * 26
          return (
            <div
              key={index}
              className={`absolute h-3 w-3 rounded-full transition-opacity duration-300 ${
                index === stimulusStep % 10 ? 'opacity-100 bg-secondary-300' : 'opacity-25 bg-primary-300'
              }`}
              style={{ left: `${x}%`, top: `${y}%` }}
            />
          )
        })}

        <div className="absolute left-4 right-4 top-4 rounded-xl border border-primary-400/20 bg-gray-950/75 p-4 backdrop-blur-sm">
          <div className="text-xs uppercase tracking-wider text-primary-300 font-semibold">Live cue</div>
          <div className="text-white mt-1">{activeCue}</div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {buildQualityChecks(exercise).map((check) => (
          <button
            key={check}
            onClick={() => setQualityChecks((current) => ({ ...current, [check]: !current[check] }))}
            className={`rounded-lg border px-4 py-3 text-left transition-all ${
              qualityChecks[check]
                ? 'border-secondary-400/50 bg-secondary-500/15 text-secondary-100'
                : 'border-gray-700/50 bg-gray-900/60 text-gray-300 hover:border-primary-400/40'
            }`}
          >
            <div className="flex items-start gap-2 text-sm font-semibold">
              <CheckCircle className="w-4 h-4 mt-0.5" />
              {check}
            </div>
          </button>
        ))}
      </div>

      <div className="flex justify-center">
        <button
          onClick={complete}
          className="px-6 py-3 rounded-lg bg-gradient-to-r from-secondary-500 to-primary-500 hover:from-secondary-600 hover:to-primary-600 text-white font-bold flex items-center gap-2 transition-all shadow-lg shadow-primary-500/20"
        >
          <CheckCircle className="w-5 h-5" />
          Capture Result
        </button>
      </div>
    </div>
  )
}

function buildCues(exercise: VisionExercise) {
  const checkpoints = exercise.checkpoints.length > 0 ? exercise.checkpoints : [exercise.summary]
  const guidance = exercise.guidance.map((item) => item.detail)
  return [...checkpoints, ...guidance].slice(0, 6)
}

function buildQualityChecks(exercise: VisionExercise) {
  if (exercise.category === 'downshift') {
    return ['Jaw and brow relaxed', 'Breath stayed slow', 'No eye pressure']
  }
  if (exercise.category === 'peripheral') {
    return ['Center gaze stayed anchored', 'Edges stayed visible', 'Head stayed quiet']
  }
  if (exercise.category === 'speed') {
    return ['Eyes moved before head', 'Targets stayed clear', 'Tempo stayed controlled']
  }
  if (exercise.category === 'integration') {
    return ['Left/right calls were accurate', 'Body stayed balanced', 'Breath stayed nasal']
  }
  return ['Movement stayed smooth', 'Blur recovered quickly', 'Neck stayed relaxed']
}

function getMotionForExercise(exercise: VisionExercise) {
  if (exercise.category === 'downshift') {
    return {
      kind: 'breath' as const,
      icon: Sparkles,
      color: 'radial-gradient(circle at 35% 35%, #ffffff 0 8%, #72C247 10% 100%)',
      intervalMs: { starter: 5000, standard: 4300, challenge: 3800, advanced: 3400 },
    }
  }
  if (exercise.category === 'peripheral') {
    return {
      kind: 'peripheral' as const,
      icon: Eye,
      color: 'radial-gradient(circle at 35% 35%, #ffffff 0 8%, #3FBFB5 10% 100%)',
      intervalMs: { starter: 2400, standard: 2000, challenge: 1700, advanced: 1400 },
    }
  }
  if (exercise.category === 'speed') {
    return {
      kind: 'saccade' as const,
      icon: Zap,
      color: 'radial-gradient(circle at 35% 35%, #ffffff 0 8%, #facc15 10% 100%)',
      intervalMs: { starter: 1800, standard: 1400, challenge: 1100, advanced: 850 },
    }
  }
  if (exercise.category === 'integration') {
    return {
      kind: 'integration' as const,
      icon: Hand,
      color: 'radial-gradient(circle at 35% 35%, #ffffff 0 8%, #a78bfa 10% 100%)',
      intervalMs: { starter: 2500, standard: 2100, challenge: 1800, advanced: 1500 },
    }
  }
  return {
    kind: 'tracking' as const,
    icon: MoveHorizontal,
    color: 'radial-gradient(circle at 35% 35%, #ffffff 0 8%, #3FBFB5 10% 100%)',
    intervalMs: { starter: 3200, standard: 2700, challenge: 2300, advanced: 1900 },
  }
}

function getStimulusPosition(kind: ReturnType<typeof getMotionForExercise>['kind'], step: number, reducedMotion: boolean) {
  const slowStep = reducedMotion ? Math.floor(step / 2) : step
  const t = slowStep % 8
  const positions = [
    { x: 28, y: 50 },
    { x: 38, y: 35 },
    { x: 50, y: 28 },
    { x: 62, y: 35 },
    { x: 72, y: 50 },
    { x: 62, y: 65 },
    { x: 50, y: 72 },
    { x: 38, y: 65 },
  ]

  if (kind === 'breath') return { x: 50, y: 50 }
  if (kind === 'saccade') return positions[(step * 3) % positions.length]
  if (kind === 'peripheral') return { x: 50, y: 50 }
  if (kind === 'integration') return positions[(step * 2 + 1) % positions.length]
  return positions[t]
}
