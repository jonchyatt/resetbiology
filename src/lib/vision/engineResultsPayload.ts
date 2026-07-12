/**
 * Shared server-side validation for engine-result payloads (WP5 reconcile).
 * Used by BOTH /api/vision/sessions (free practice) and /api/vision/program
 * (12-week complete_session) so the contract can't drift between routes.
 * Metrics are training-performance proxies — never clinical measurements
 * (plan §4.9).
 */

export type EngineResultPayload = {
  exerciseId: string
  durationSec: number
  completed: boolean
  score: number
  metrics: Record<string, number>
  selfReport?: {
    clarity?: number
    strain?: number
    notes?: string
  }
}

export function parseEngineResults(value: unknown): EngineResultPayload[] | null {
  if (!Array.isArray(value) || value.length > 20) return null

  const parsed: EngineResultPayload[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null
    const result = item as Record<string, unknown>

    if (
      typeof result.exerciseId !== 'string' ||
      result.exerciseId.length === 0 ||
      result.exerciseId.length > 100 ||
      typeof result.durationSec !== 'number' ||
      !Number.isFinite(result.durationSec) ||
      result.durationSec < 0 ||
      typeof result.completed !== 'boolean' ||
      typeof result.score !== 'number' ||
      !Number.isFinite(result.score) ||
      result.score < 0 ||
      result.score > 100 ||
      !result.metrics ||
      typeof result.metrics !== 'object' ||
      Array.isArray(result.metrics)
    ) {
      return null
    }

    const metrics = result.metrics as Record<string, unknown>
    if (Object.values(metrics).some(metric => typeof metric !== 'number' || !Number.isFinite(metric))) {
      return null
    }

    let selfReport: EngineResultPayload['selfReport']
    if (result.selfReport !== undefined) {
      if (!result.selfReport || typeof result.selfReport !== 'object' || Array.isArray(result.selfReport)) return null
      const report = result.selfReport as Record<string, unknown>
      if (
        (report.clarity !== undefined && (typeof report.clarity !== 'number' || report.clarity < 1 || report.clarity > 5)) ||
        (report.strain !== undefined && (typeof report.strain !== 'number' || report.strain < 1 || report.strain > 5)) ||
        (report.notes !== undefined && (typeof report.notes !== 'string' || report.notes.length > 2000))
      ) {
        return null
      }
      selfReport = {
        ...(typeof report.clarity === 'number' ? { clarity: report.clarity } : {}),
        ...(typeof report.strain === 'number' ? { strain: report.strain } : {}),
        ...(typeof report.notes === 'string' ? { notes: report.notes } : {}),
      }
    }

    parsed.push({
      exerciseId: result.exerciseId,
      durationSec: Math.round(result.durationSec),
      completed: result.completed,
      score: result.score,
      metrics: metrics as Record<string, number>,
      ...(selfReport ? { selfReport } : {}),
    })
  }

  return parsed
}

/** Performance bonus: measured gains stack ON TOP of completion points (never replace). */
export function performanceBonusFor(engineResults: EngineResultPayload[] | undefined): number {
  return Math.min(
    50,
    engineResults?.reduce((sum, result) => sum + Math.round(result.score / 10), 0) || 0,
  )
}
