import { visionMasterProgram, type DailySession } from '@/data/visionProtocols'
import { visionExerciseMap } from '@/data/visionExercises'
import type { Prescription } from '@/components/Vision/Engines/types'

/**
 * Prescription resolver (W0.2) — pure functions that turn (exerciseId, week, session)
 * into week-aware dosing. Week 1 and week 9 must be OBSERVABLY different in every
 * engine, driven from this file + curriculum data, never hardcoded in components.
 * Plan: docs/plans/vision-training-interactive-overhaul.md §Tier 0
 */

/**
 * Tempo table for rhythm-based exercises. Baselines come from the exercise
 * doctrine in visionExercises.ts (e.g. eye-jumps guidance "Start 60 bpm; add
 * +5 bpm once accuracy ≥ 90%", focus-pushups progression "metronome at 50 bpm
 * … bump tempo +5 bpm weekly"). The per-week ramp is the curriculum default;
 * adaptive engines may exceed it in-session when accuracy earns it.
 */
const TEMPO_TABLE: Record<string, { startBpm: number; perWeek: number; maxBpm: number; startWeek: number }> = {
  'eye-jumps': { startBpm: 60, perWeek: 5, maxBpm: 100, startWeek: 3 },
  'focus-pushups': { startBpm: 50, perWeek: 5, maxBpm: 80, startWeek: 2 },
  'focus-trombone': { startBpm: 12, perWeek: 1, maxBpm: 20, startWeek: 1 }, // breaths/min pace
  'laterality-ladder': { startBpm: 40, perWeek: 4, maxBpm: 70, startWeek: 1 },
}

/** Animation speed grows ~5%/week, capped at 1.6x — gentle, perceptible ramp. */
export function speedMultiplierForWeek(week: number): number {
  const w = Math.max(1, Math.min(12, week || 1))
  return Math.min(1.6, 1 + (w - 1) * 0.05)
}

export function phaseForWeek(week: number): number {
  return Math.max(1, Math.min(6, Math.ceil((week || 1) / 2)))
}

function bpmForWeek(exerciseId: string, week: number): number | undefined {
  const t = TEMPO_TABLE[exerciseId]
  if (!t) return undefined
  const effective = Math.max(0, (week || 1) - t.startWeek)
  return Math.min(t.maxBpm, t.startBpm + effective * t.perWeek)
}

/** Parse "6 min" → 360. Falls back to 180. */
export function parseDurationSeconds(duration: string | undefined): number {
  if (!duration) return 180
  const m = duration.match(/(\d+(?:\.\d+)?)/)
  return m ? Math.round(parseFloat(m[1]) * 60) : 180
}

/**
 * Split a session's exerciseMinutes across its exercises, weighted by each
 * exercise's own nominal duration so a 3-min palming and an 8-min tracking
 * block share the budget proportionally.
 */
function targetSecondsFromSession(exerciseId: string, session: DailySession): number {
  const nominal = session.exerciseIds.map(id => parseDurationSeconds(visionExerciseMap[id]?.duration))
  const total = nominal.reduce((a, b) => a + b, 0) || 1
  const idx = session.exerciseIds.indexOf(exerciseId)
  const mine = idx >= 0 ? nominal[idx] : 180
  return Math.max(60, Math.round((session.exerciseMinutes * 60) * (mine / total)))
}

/** Find the curriculum session for a given week/day, if any. */
export function findSession(week: number, day: number): DailySession | undefined {
  const plan = visionMasterProgram.weeklyPlans.find(w => w.week === week)
  return plan?.sessions.find(s => s.day === day)
}

/**
 * Resolve the full prescription for one exercise run.
 * `session` present → curriculum mode (Today's Session).
 * `session` absent → free practice (Vision Library): nominal duration, week-scaled.
 */
export function resolvePrescription(
  exerciseId: string,
  week: number,
  session?: DailySession,
): Prescription {
  const exercise = visionExerciseMap[exerciseId]
  const cues = [
    ...(session?.coachingCues ?? []),
    ...(exercise?.guidance?.map(g => g.detail) ?? []),
  ]
  return {
    exerciseId,
    week: week || 0,
    phase: phaseForWeek(week),
    targetSeconds: session
      ? targetSecondsFromSession(exerciseId, session)
      : parseDurationSeconds(exercise?.duration),
    speedMultiplier: speedMultiplierForWeek(week),
    bpm: bpmForWeek(exerciseId, week),
    distances: exercise?.distanceTargets,
    coachingCues: cues,
  }
}
