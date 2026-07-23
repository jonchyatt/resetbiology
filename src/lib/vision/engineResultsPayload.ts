/**
 * Shared server-side validation for engine-result payloads (WP5 reconcile).
 * Used by BOTH /api/vision/sessions (free practice) and /api/vision/program
 * (12-week complete_session) so the contract can't drift between routes.
 * Metrics are training-performance proxies — never clinical measurements
 * (plan §4.9).
 */

import {
  SCREEN_DIRECTIONAL_E_PROTOCOL,
  SCREEN_DIRECTIONAL_E_VERSION,
  SCREEN_E_CORRECT_TO_PASS,
  SCREEN_E_LINE_MULTIPLIERS,
  SCREEN_E_TRIALS_PER_LINE,
} from './screenDirectionalE'

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

const SCORE_NEUTRAL_EVIDENCE_IDS = new Set([SCREEN_DIRECTIONAL_E_PROTOCOL, 'snellen-proof'])
const SCREEN_E_METRIC_KEYS = [
  'protocolVersion',
  'bestLine',
  'totalLines',
  'trialCount',
  'correctCount',
  'viewportCssWidth',
  'viewportCssHeight',
  'devicePixelRatio',
  'geometryCalibrated',
  'distanceMeasured',
  'inputMethod',
] as const

export function isScoreNeutralVisionEvidence(exerciseId: string): boolean {
  return SCORE_NEUTRAL_EVIDENCE_IDS.has(exerciseId)
}

export function isValidScreenDirectionalEMetrics(metrics: Record<string, unknown>): boolean {
  if (
    Object.keys(metrics).length !== SCREEN_E_METRIC_KEYS.length ||
    SCREEN_E_METRIC_KEYS.some(key => !(key in metrics))
  ) {
    return false
  }

  const bestLine = metrics.bestLine
  const trialCount = metrics.trialCount
  const correctCount = metrics.correctCount
  if (
    metrics.protocolVersion !== SCREEN_DIRECTIONAL_E_VERSION ||
    metrics.totalLines !== SCREEN_E_LINE_MULTIPLIERS.length ||
    typeof bestLine !== 'number' ||
    !Number.isInteger(bestLine) ||
    bestLine < 0 ||
    bestLine > SCREEN_E_LINE_MULTIPLIERS.length ||
    typeof trialCount !== 'number' ||
    !Number.isInteger(trialCount) ||
    trialCount !== Math.min(bestLine + 1, SCREEN_E_LINE_MULTIPLIERS.length) * SCREEN_E_TRIALS_PER_LINE ||
    typeof correctCount !== 'number' ||
    !Number.isInteger(correctCount)
  ) {
    return false
  }

  const minimumCorrect = bestLine * SCREEN_E_CORRECT_TO_PASS
  const maximumCorrect = bestLine * SCREEN_E_TRIALS_PER_LINE +
    (bestLine < SCREEN_E_LINE_MULTIPLIERS.length ? SCREEN_E_CORRECT_TO_PASS - 1 : 0)
  return (
    correctCount >= minimumCorrect &&
    correctCount <= maximumCorrect &&
    typeof metrics.viewportCssWidth === 'number' &&
    metrics.viewportCssWidth > 0 &&
    metrics.viewportCssWidth <= 10_000 &&
    typeof metrics.viewportCssHeight === 'number' &&
    metrics.viewportCssHeight > 0 &&
    metrics.viewportCssHeight <= 10_000 &&
    typeof metrics.devicePixelRatio === 'number' &&
    metrics.devicePixelRatio > 0 &&
    metrics.devicePixelRatio <= 10 &&
    metrics.geometryCalibrated === 0 &&
    metrics.distanceMeasured === 0 &&
    Number.isInteger(metrics.inputMethod) &&
    (metrics.inputMethod as number) >= 1 &&
    (metrics.inputMethod as number) <= 5
  )
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
    if (
      result.exerciseId === SCREEN_DIRECTIONAL_E_PROTOCOL &&
      (result.completed !== true || !isValidScreenDirectionalEMetrics(metrics))
    ) {
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
      score: isScoreNeutralVisionEvidence(result.exerciseId) ? 0 : result.score,
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
    engineResults?.reduce(
      (sum, result) => sum + (
        isScoreNeutralVisionEvidence(result.exerciseId) ? 0 : Math.round(result.score / 10)
      ),
      0,
    ) || 0,
  )
}
