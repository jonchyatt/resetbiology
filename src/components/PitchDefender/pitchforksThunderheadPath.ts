/**
 * Pure Thunderhead cloud travel and caption placement geometry.
 *
 * The caller owns the lifecycle clock and chooses the exact earned target.
 * This module only maps that already-authoritative progress into a bounded
 * position and places the exact-note caption around the fixed cloud envelope.
 * It deliberately has no renderer, timing, pitch, score, or gameplay state.
 */

export type PitchforksThunderheadPoint = Readonly<{
  x: number
  y: number
}>

export type PitchforksThunderheadCaptionRect = Readonly<{
  left: number
  top: number
  width: number
  height: number
}>

/** The measured clear lane used by the candidate clearance path. */
export const PITCHFORKS_THUNDERHEAD_CLEAR_LANE_Y = 149

/** Fixed cloud envelope around the supplied core anchor. */
export const PITCHFORKS_THUNDERHEAD_CLOUD_BOUNDS = Object.freeze({
  left: -56,
  top: -53,
  width: 112,
  height: 64,
})

export const PITCHFORKS_THUNDERHEAD_CAPTION_HEIGHT = 32

const PATH_BREAKPOINT = 0.25
const CAPTION_WORLD_MARGIN = 4
const CAPTION_CLOUD_GAP = 8
const CAPTION_TOP_OFFSET = 16

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isFinitePoint(value: unknown): value is PitchforksThunderheadPoint {
  return isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y)
}

function frozenPoint(x: number, y: number): PitchforksThunderheadPoint | null {
  return Number.isFinite(x) && Number.isFinite(y)
    ? Object.freeze({ x, y })
    : null
}

/**
 * Project one normalized Thunderhead travel sample.
 *
 * Progress 0..0.25 moves the cloud vertically at its start x until the clear
 * lane. Progress 0.25..1 then carries it horizontally along that lane. The
 * explicit breakpoint and endpoints keep the path continuous and exact.
 */
export function getPitchforksThunderheadPathPosition(
  start: PitchforksThunderheadPoint,
  targetX: number,
  normalizedProgress: number,
): PitchforksThunderheadPoint | null {
  if (!isFinitePoint(start) || !isFiniteNumber(targetX) || !isFiniteNumber(normalizedProgress)) {
    return null
  }

  const progress = Math.max(0, Math.min(1, normalizedProgress))
  if (progress === 0) return frozenPoint(start.x, start.y)
  if (progress === 1) return frozenPoint(targetX, PITCHFORKS_THUNDERHEAD_CLEAR_LANE_Y)

  if (progress <= PATH_BREAKPOINT) {
    const verticalProgress = progress / PATH_BREAKPOINT
    const y = start.y + (PITCHFORKS_THUNDERHEAD_CLEAR_LANE_Y - start.y) * verticalProgress
    return frozenPoint(start.x, y)
  }

  const horizontalProgress = (progress - PATH_BREAKPOINT) / (1 - PATH_BREAKPOINT)
  const x = start.x + (targetX - start.x) * horizontalProgress
  return frozenPoint(x, PITCHFORKS_THUNDERHEAD_CLEAR_LANE_Y)
}

/**
 * Place the exact-note caption below the cloud without covering its measured
 * envelope. The supplied width is authoritative, including accidentals; the
 * helper never substitutes a minimum or hardcoded label width.
 */
export function getPitchforksThunderheadCaptionRect(
  core: PitchforksThunderheadPoint,
  labelWidth: number,
  worldWidth = 720,
): PitchforksThunderheadCaptionRect | null {
  if (
    !isFinitePoint(core)
    || !isFiniteNumber(labelWidth)
    || labelWidth <= 0
    || !isFiniteNumber(worldWidth)
    || worldWidth <= 0
  ) return null

  const top = core.y + CAPTION_TOP_OFFSET
  if (!Number.isFinite(top)) return null

  const rightLimit = worldWidth - CAPTION_WORLD_MARGIN
  const leftLimit = CAPTION_WORLD_MARGIN
  const preferredLeft = core.x + PITCHFORKS_THUNDERHEAD_CLOUD_BOUNDS.width / 2 + CAPTION_CLOUD_GAP
  const fallbackLeft = core.x - PITCHFORKS_THUNDERHEAD_CLOUD_BOUNDS.width / 2
    - CAPTION_CLOUD_GAP - labelWidth
  const fits = (left: number): boolean =>
    Number.isFinite(left)
    && left >= leftLimit
    && Number.isFinite(left + labelWidth)
    && left + labelWidth <= rightLimit

  const left = fits(preferredLeft)
    ? preferredLeft
    : fits(fallbackLeft)
      ? fallbackLeft
      : null
  if (left === null) return null

  return Object.freeze({
    left,
    top,
    width: labelWidth,
    height: PITCHFORKS_THUNDERHEAD_CAPTION_HEIGHT,
  })
}
