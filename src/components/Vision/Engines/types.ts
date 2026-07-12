import type { ComponentType } from 'react'
import type { VisionExercise } from '@/data/visionExercises'

export type ExerciseDeviceMode = 'phone' | 'desktop'

export type ExerciseDifficulty = 'starter' | 'standard' | 'challenge' | 'advanced'

export type ExerciseLifecyclePhase = 'intro' | 'active' | 'cooldown' | 'result'

export type ExerciseCompletionMode = 'performance' | 'subjective'

export type ExerciseMetricValue = string | number | boolean

export type ExerciseMetrics = Record<string, ExerciseMetricValue>

export interface ExerciseEngineResult {
  exerciseId: string
  exerciseTitle: string
  completed: boolean
  completionMode: ExerciseCompletionMode
  durationSeconds: number
  activeSeconds: number
  metrics: ExerciseMetrics
  notes?: string
  finishedAt: string
}

export interface ExerciseEngineControls {
  phase: ExerciseLifecyclePhase
  isPaused: boolean
  elapsedSeconds: number
  remainingSeconds: number
  progress: number
  pause: () => void
  resume: () => void
  restart: () => void
  complete: (result?: Partial<ExerciseEngineResult>) => void
}

export interface ExerciseEngineProps {
  exercise: VisionExercise
  difficulty: ExerciseDifficulty
  durationSeconds: number
  deviceMode: ExerciseDeviceMode
  reducedMotion: boolean
  autoStart?: boolean
  controls: ExerciseEngineControls
  onPhaseChange?: (phase: ExerciseLifecyclePhase) => void
}

export interface ExerciseEngineDefinition {
  id: string
  label: string
  sourceExerciseId: string
  supportedDeviceModes: ExerciseDeviceMode[]
  measurable: boolean
  defaultDurationSeconds: number
  displayOptions?: {
    autoStart?: boolean
    hideNumericTimer?: boolean
  }
  component: ComponentType<ExerciseEngineProps>
}

export interface SessionRunnerSaveContext {
  week: number
  day: number
  baselineMinutes: number
  exerciseMinutes: number
  breathWarmupMinutes?: number
  nearSnellenResult?: string | null
  farSnellenResult?: string | null
  notes?: string | null
}

export interface SessionRunnerResult {
  totalDurationSeconds: number
  activeDurationSeconds: number
  exercisesCompleted: string[]
  engineResults: ExerciseEngineResult[]
  saved: boolean
}
