import type { VisionExercise } from '@/data/visionExercises'
import type { ExerciseEngineDefinition } from './types'
import { createGuidedStimulusEngine } from './GuidedStimulusEngine'
import { smoothTrackingEngine } from './SmoothTrackingEngine'

export { default as SessionRunner } from './SessionRunner'
export { default as GuidedStimulusEngine, createGuidedStimulusEngine } from './GuidedStimulusEngine'
export { default as SmoothTrackingEngine, smoothTrackingEngine } from './SmoothTrackingEngine'
export * from './types'

const ENGINE_REGISTRY: Record<string, ExerciseEngineDefinition> = {
  [smoothTrackingEngine.sourceExerciseId]: smoothTrackingEngine,
}

export function getEngineForExercise(exercise: VisionExercise): ExerciseEngineDefinition {
  return ENGINE_REGISTRY[exercise.id] || createGuidedStimulusEngine(exercise)
}
