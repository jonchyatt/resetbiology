/**
 * Trust-boundary helpers for the persisted GABOR_THRESHOLD_V1 prior (P1-A4).
 *
 * A prior crosses two untrusted seams: (1) building it from an engine-result
 * payload the client just posted, and (2) parsing it back out of a stored
 * Mongo document on the next GET. Both directions reconstruct a fresh
 * server-canonical GaborThresholdPrior from constants — nothing here ever
 * trusts a client- or storage-supplied protocol id or render config, it only
 * checks them against GABOR_THRESHOLD_PROTOCOL / GABOR_THRESHOLD_RENDER_CONFIG.
 */

import {
  GABOR_THRESHOLD_PROTOCOL,
  GABOR_THRESHOLD_RENDER_CONFIG,
} from './gaborThreshold'
import type { EngineResultPayload } from './engineResultsPayload'
import type { Prisma } from '@prisma/client'

const GABOR_EXERCISE_ID = 'gabor-contrast'

/** Plain mutable JSON shape written by the raw-Mongo seam. */
interface PersistedGaborRenderConfig extends Prisma.InputJsonObject {
  rendererId: string
  contrastMetric: string
  anchorSpatialFrequencyCyclesPerPatch: number
  orientationsDegrees: number[]
  phaseDegrees: number
  sigmaWavelengthRatio: number
}

export interface PersistedGaborThresholdPrior extends Prisma.InputJsonObject {
  valid: true
  stale: false
  protocol: typeof GABOR_THRESHOLD_PROTOCOL.id
  contrastThresholdPct: number
  renderConfig: PersistedGaborRenderConfig
}

/** The numeric protocolVersion a qualifying result must report, derived from the id (never hardcoded twice). */
function deriveProtocolVersion(protocolId: string): number {
  const match = protocolId.match(/V(\d+)$/)
  if (!match) throw new Error(`GABOR_THRESHOLD_PROTOCOL.id "${protocolId}" has no trailing version number.`)
  return Number(match[1])
}

const GABOR_PROTOCOL_VERSION = deriveProtocolVersion(GABOR_THRESHOLD_PROTOCOL.id)

function isBoundedContrastThresholdPct(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= GABOR_THRESHOLD_PROTOCOL.minContrastPct
    && value <= GABOR_THRESHOLD_PROTOCOL.maxContrastPct
}

function canonicalRenderConfig(): PersistedGaborThresholdPrior['renderConfig'] {
  return {
    rendererId: GABOR_THRESHOLD_RENDER_CONFIG.rendererId,
    contrastMetric: GABOR_THRESHOLD_RENDER_CONFIG.contrastMetric,
    anchorSpatialFrequencyCyclesPerPatch: GABOR_THRESHOLD_RENDER_CONFIG.anchorSpatialFrequencyCyclesPerPatch,
    orientationsDegrees: [...GABOR_THRESHOLD_RENDER_CONFIG.orientationsDegrees],
    phaseDegrees: GABOR_THRESHOLD_RENDER_CONFIG.phaseDegrees,
    sigmaWavelengthRatio: GABOR_THRESHOLD_RENDER_CONFIG.sigmaWavelengthRatio,
  }
}

/**
 * Build the canonical prior snapshot from a just-validated engine-results
 * payload (the array parseEngineResults already returned). Returns null when
 * there is no gabor-contrast result, or it exists but doesn't qualify — the
 * caller must still persist the rest of a completed session either way.
 */
export function buildGaborThresholdPriorFromEngineResults(
  engineResults: readonly EngineResultPayload[],
): PersistedGaborThresholdPrior | null {
  const result = engineResults.find(r => r.exerciseId === GABOR_EXERCISE_ID)
  if (!result) return null

  const metrics = result.metrics
  if (
    !result.completed
    || metrics.thresholdValid !== 1
    || metrics.stopValid !== 1
    || !isBoundedContrastThresholdPct(metrics.contrastThresholdPct)
    || metrics.protocolVersion !== GABOR_PROTOCOL_VERSION
    || metrics.anchorSpatialFrequencyCyclesPerPatch !== GABOR_THRESHOLD_RENDER_CONFIG.anchorSpatialFrequencyCyclesPerPatch
  ) {
    return null
  }

  return {
    valid: true,
    stale: false,
    protocol: GABOR_THRESHOLD_PROTOCOL.id,
    contrastThresholdPct: metrics.contrastThresholdPct,
    renderConfig: canonicalRenderConfig(),
  }
}

function sameCanonicalRenderConfig(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const config = value as Record<string, unknown>
  const orientations = config.orientationsDegrees
  return config.rendererId === GABOR_THRESHOLD_RENDER_CONFIG.rendererId
    && config.contrastMetric === GABOR_THRESHOLD_RENDER_CONFIG.contrastMetric
    && config.anchorSpatialFrequencyCyclesPerPatch === GABOR_THRESHOLD_RENDER_CONFIG.anchorSpatialFrequencyCyclesPerPatch
    && config.phaseDegrees === GABOR_THRESHOLD_RENDER_CONFIG.phaseDegrees
    && config.sigmaWavelengthRatio === GABOR_THRESHOLD_RENDER_CONFIG.sigmaWavelengthRatio
    && Array.isArray(orientations)
    && orientations.length === GABOR_THRESHOLD_RENDER_CONFIG.orientationsDegrees.length
    && orientations.every((orientation, index) => orientation === GABOR_THRESHOLD_RENDER_CONFIG.orientationsDegrees[index])
}

/**
 * Reconstruct a fresh canonical prior from an unknown stored value (whatever
 * came back off a Mongo document's `gaborThresholdPrior` field). `valid` alone
 * is never trusted — every field that would change the meaning of the
 * threshold is re-checked against current constants before anything is
 * returned, and the returned object is always newly built, never the input.
 */
export function parseStoredGaborThresholdPrior(value: unknown): PersistedGaborThresholdPrior | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const candidate = value as Record<string, unknown>

  if (candidate.valid !== true || candidate.stale !== false) return null
  if (candidate.protocol !== GABOR_THRESHOLD_PROTOCOL.id) return null
  if (!isBoundedContrastThresholdPct(candidate.contrastThresholdPct)) return null
  if (!sameCanonicalRenderConfig(candidate.renderConfig)) return null

  return {
    valid: true,
    stale: false,
    protocol: GABOR_THRESHOLD_PROTOCOL.id,
    contrastThresholdPct: candidate.contrastThresholdPct,
    renderConfig: canonicalRenderConfig(),
  }
}

/** Accept both the `{ $oid }` shape Prisma's raw Mongo commands return and a plain string (test fixtures). */
function extractObjectIdString(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && typeof (value as Record<string, unknown>).$oid === 'string') {
    return (value as Record<string, unknown>).$oid as string
  }
  return null
}

/**
 * Pick the first structurally valid prior out of raw daily-session documents
 * that the caller has already sorted newest-first. Re-checks userId and
 * enrollmentId on every document (defense in depth against a bad filter), and
 * skips — rather than stops at — documents whose snapshot fails to parse, so
 * a later invalid/malformed snapshot can never conceal an earlier valid one.
 */
export function selectNewestValidGaborThresholdPrior(
  rawDailySessionsNewestFirst: readonly unknown[],
  userId: string,
  enrollmentId: string,
): PersistedGaborThresholdPrior | null {
  for (const doc of rawDailySessionsNewestFirst) {
    if (!doc || typeof doc !== 'object') continue
    const record = doc as Record<string, unknown>
    if (extractObjectIdString(record.userId) !== userId) continue
    if (extractObjectIdString(record.enrollmentId) !== enrollmentId) continue
    const prior = parseStoredGaborThresholdPrior(record.gaborThresholdPrior)
    if (prior) return prior
  }
  return null
}
