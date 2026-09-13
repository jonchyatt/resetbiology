/**
 * Pure selector for the staged wave-receipt relief pose.
 *
 * The caller owns the successful receipt, its shared logical clock, and the
 * empty-enemy/empty-bolt eligibility check. This helper only chooses a sprite
 * name; it does not create a clock, score, progression, or boss state.
 */

export type PitchforksVictoryPose = 'none' | 'neutral' | 'eyeLift'

export type PitchforksVictoryAssetAvailability = Readonly<{
  neutral?: boolean
  eyeLift?: boolean
}>

export type PitchforksVictoryPoseInput = Readonly<{
  elapsedMs: number
  eligible: boolean
  reducedMotion: boolean
  /** Use either the authoritative wave index or receipt ordinal for parity. */
  wave?: number
  receiptOrdinal?: number
  assets?: PitchforksVictoryAssetAvailability
  assetAvailability?: PitchforksVictoryAssetAvailability
}>

/** Presentation starts 300 ms after the successful clear receipt. */
export const PITCHFORKS_VICTORY_START_MS = 300
/** The staged active motion window is 300–1150 ms from the receipt. */
export const PITCHFORKS_VICTORY_EYE_LIFT_START_MS = 850
export const PITCHFORKS_VICTORY_ACTIVE_END_MS = 1150
/** Reduced motion holds the static neutral pose through the first idle frame. */
export const PITCHFORKS_VICTORY_REDUCED_MOTION_END_MS = 1600
/** Normal motion clears the decorative layer at this receipt-relative time. */
export const PITCHFORKS_VICTORY_CLEAR_MS = 1750

const DEFAULT_ASSETS: PitchforksVictoryAssetAvailability = Object.freeze({
  neutral: true,
  eyeLift: true,
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function availableAssets(value: unknown): PitchforksVictoryAssetAvailability | null {
  if (value === undefined) return DEFAULT_ASSETS
  if (!isRecord(value)) return null
  return {
    neutral: value.neutral === true,
    eyeLift: value.eyeLift === true,
  }
}

function ordinalFromInput(input: PitchforksVictoryPoseInput): unknown {
  return input.receiptOrdinal ?? input.wave
}

function poseFromValues(
  elapsedMs: unknown,
  eligible: unknown,
  reducedMotion: unknown,
  ordinal: unknown,
  assetsInput: unknown,
): PitchforksVictoryPose {
  if (
    typeof eligible !== 'boolean' ||
    !eligible ||
    typeof reducedMotion !== 'boolean' ||
    typeof elapsedMs !== 'number' ||
    !Number.isFinite(elapsedMs) ||
    elapsedMs < 0 ||
    typeof ordinal !== 'number' ||
    !Number.isSafeInteger(ordinal) ||
    ordinal < 0
  ) {
    return 'none'
  }

  const assets = availableAssets(assetsInput)
  if (assets === null || assets.neutral !== true) return 'none'

  if (reducedMotion) {
    return elapsedMs >= PITCHFORKS_VICTORY_START_MS &&
      elapsedMs < PITCHFORKS_VICTORY_REDUCED_MOTION_END_MS
      ? 'neutral'
      : 'none'
  }

  if (
    elapsedMs < PITCHFORKS_VICTORY_START_MS ||
    elapsedMs >= PITCHFORKS_VICTORY_CLEAR_MS
  ) {
    return 'none'
  }

  // The staged art lifts the existing eye cluster at the apex. Missing
  // eye-lift art safely falls back to the available neutral pose.
  if (
    ordinal % 2 === 1 &&
    elapsedMs >= PITCHFORKS_VICTORY_EYE_LIFT_START_MS &&
    elapsedMs < PITCHFORKS_VICTORY_ACTIVE_END_MS &&
    assets.eyeLift === true
  ) {
    return 'eyeLift'
  }

  return 'neutral'
}

export function selectPitchforksVictoryPose(input: PitchforksVictoryPoseInput): PitchforksVictoryPose
export function selectPitchforksVictoryPose(
  elapsedMs: number,
  eligible: boolean,
  reducedMotion: boolean,
  waveOrReceiptOrdinal: number,
  assets?: PitchforksVictoryAssetAvailability,
): PitchforksVictoryPose
export function selectPitchforksVictoryPose(
  inputOrElapsedMs: PitchforksVictoryPoseInput | number,
  eligible?: boolean,
  reducedMotion?: boolean,
  waveOrReceiptOrdinal?: number,
  assets?: PitchforksVictoryAssetAvailability,
): PitchforksVictoryPose {
  if (isRecord(inputOrElapsedMs)) {
    return poseFromValues(
      inputOrElapsedMs.elapsedMs,
      inputOrElapsedMs.eligible,
      inputOrElapsedMs.reducedMotion,
      ordinalFromInput(inputOrElapsedMs as PitchforksVictoryPoseInput),
      inputOrElapsedMs.assets ?? inputOrElapsedMs.assetAvailability,
    )
  }

  return poseFromValues(
    inputOrElapsedMs,
    eligible,
    reducedMotion,
    waveOrReceiptOrdinal,
    assets,
  )
}
