import type { ComponentType } from 'react'
import type { VisionExercise } from '@/data/visionExercises'
import type { GaborThresholdPrior } from '@/lib/vision/gaborThreshold'

/**
 * VisionEngine contract — every interactive exercise engine implements this.
 * Plan-of-record: docs/plans/vision-training-interactive-overhaul.md §Tier 0 (W0.1)
 *
 * An engine is a full-screen-capable React component that RUNS the exercise
 * with the user (animates, paces, listens for input, measures), then reports
 * a structured result. Engines never talk to APIs directly — the SessionRunner
 * owns persistence.
 */

/** Week-aware dosing for one exercise run, resolved from the 12-week curriculum. */
export type Prescription = {
  exerciseId: string
  /** 1-12 program week (0 = not enrolled / free practice) */
  week: number
  /** Curriculum phase 1-6 (ceil(week/2)); scales difficulty tiers */
  phase: number
  /** How long the engine should run, in seconds */
  targetSeconds: number
  /** 1.0 = week-1 baseline; engines scale animation speed by this */
  speedMultiplier: number
  /** Metronome tempo for rhythm-based engines (saccades, focus rhythm) */
  bpm?: number
  /** Target repetitions, when the exercise is rep-based rather than time-based */
  reps?: number
  /** Physical distance targets carried from exercise data (e.g. "10 cm" / "60 cm") */
  distances?: { near?: string; far?: string }
  /** Today's coaching cues: session cues merged with exercise guidance */
  coachingCues: string[]
}

/** Numeric measurements an engine produces (accuracy pct, reaction ms, bpm reached…). */
export type EngineMetrics = Record<string, number>

export type EngineSelfReport = {
  /** 1-5 how clear did things look by the end */
  clarity?: number
  /** 1-5 eye strain level */
  strain?: number
  notes?: string
}

export type EngineResult = {
  exerciseId: string
  durationSec: number
  completed: boolean
  /** 0-100 normalized performance score (drives performance-based points) */
  score: number
  metrics: EngineMetrics
  selfReport?: EngineSelfReport
}

export type EngineProps = {
  exercise: VisionExercise
  prescription: Prescription
  /** Start muted (user preference persisted by the runner) */
  muted?: boolean
  /** Live metric stream (optional; runner may surface it in HUD) */
  onProgress?: (partial: EngineMetrics) => void
  /** Fires exactly once when the exercise finishes (time elapsed or reps done) */
  onComplete: (result: EngineResult) => void
  /** User bailed out — runner decides what to do (skip / retry / end session) */
  onExit: () => void
  /** Server-owned warm-start snapshot (gabor-contrast only; other engines ignore it) */
  gaborThresholdPrior?: GaborThresholdPrior | null
}

export type VisionEngineComponent = ComponentType<EngineProps>

/** Helper: clamp + round a 0-100 score. */
export function clampScore(raw: number): number {
  return Math.max(0, Math.min(100, Math.round(raw)))
}
