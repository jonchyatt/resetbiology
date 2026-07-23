export const SCREEN_DIRECTIONAL_E_PROTOCOL = 'screen-directional-e-v1' as const
export const SCREEN_DIRECTIONAL_E_VERSION = 1
export const SCREEN_E_LINE_MULTIPLIERS = [1, 0.82, 0.68, 0.56, 0.46, 0.37, 0.29] as const
export const SCREEN_E_DIRECTIONS = ['up', 'right', 'down', 'left'] as const
export const SCREEN_E_TRIALS_PER_LINE = SCREEN_E_DIRECTIONS.length
export const SCREEN_E_CORRECT_TO_PASS = 3

export type ScreenEDirection = typeof SCREEN_E_DIRECTIONS[number]
export type ScreenEInputMethod = 'touch' | 'pointer' | 'keyboard' | 'voice' | 'helper'

export interface ScreenDirectionalEEvidence {
  readonly protocolVersion: typeof SCREEN_DIRECTIONAL_E_PROTOCOL
  readonly bestLine: number
  readonly totalLines: number
  readonly trialCount: number
  readonly correctCount: number
  readonly viewportCssWidth: number
  readonly viewportCssHeight: number
  readonly devicePixelRatio: number
  readonly geometryCalibrated: 0
  readonly distanceMeasured: 0
  readonly inputMethod: ScreenEInputMethod
}

export function screenEBaseSize(viewportCssWidth: number): number {
  return Math.min(64, Math.max(48, viewportCssWidth * 0.14))
}

export function screenELineSize(viewportCssWidth: number, lineIndex: number): number {
  const multiplier = SCREEN_E_LINE_MULTIPLIERS[lineIndex]
  if (multiplier === undefined) throw new RangeError(`Unknown screen-E line ${lineIndex + 1}`)
  return screenEBaseSize(viewportCssWidth) * multiplier
}

export function balancedScreenEDirections(random: () => number = Math.random): ScreenEDirection[] {
  const directions = [...SCREEN_E_DIRECTIONS]
  for (let index = directions.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[directions[index], directions[swapIndex]] = [directions[swapIndex], directions[index]]
  }
  return directions
}

export function createScreenDirectionalEEvidence(
  input: Omit<
    ScreenDirectionalEEvidence,
    'protocolVersion' | 'totalLines' | 'geometryCalibrated' | 'distanceMeasured'
  >,
): ScreenDirectionalEEvidence {
  return Object.freeze({
    protocolVersion: SCREEN_DIRECTIONAL_E_PROTOCOL,
    bestLine: input.bestLine,
    totalLines: SCREEN_E_LINE_MULTIPLIERS.length,
    trialCount: input.trialCount,
    correctCount: input.correctCount,
    viewportCssWidth: input.viewportCssWidth,
    viewportCssHeight: input.viewportCssHeight,
    devicePixelRatio: input.devicePixelRatio,
    geometryCalibrated: 0,
    distanceMeasured: 0,
    inputMethod: input.inputMethod,
  })
}

const INPUT_METHOD_CODE: Record<ScreenEInputMethod, number> = {
  touch: 1,
  pointer: 2,
  keyboard: 3,
  voice: 4,
  helper: 5,
}

export function screenDirectionalEMetrics(evidence: ScreenDirectionalEEvidence): Record<string, number> {
  return {
    protocolVersion: SCREEN_DIRECTIONAL_E_VERSION,
    bestLine: evidence.bestLine,
    totalLines: evidence.totalLines,
    trialCount: evidence.trialCount,
    correctCount: evidence.correctCount,
    viewportCssWidth: evidence.viewportCssWidth,
    viewportCssHeight: evidence.viewportCssHeight,
    devicePixelRatio: evidence.devicePixelRatio,
    geometryCalibrated: evidence.geometryCalibrated,
    distanceMeasured: evidence.distanceMeasured,
    inputMethod: INPUT_METHOD_CODE[evidence.inputMethod],
  }
}

export function shouldOfferScreenDirectionalEAfterExercises(
  openingCheckCompleted: boolean,
): boolean {
  return !openingCheckCompleted
}

export function mergeResultsPreservingOpeningScreenCheck<T extends { exerciseId: string }>(
  current: T[],
  incoming: T[],
): T[] {
  const hasOpeningScreenCheck = current.some(
    result => result.exerciseId === SCREEN_DIRECTIONAL_E_PROTOCOL,
  )
  const acceptedIncoming = hasOpeningScreenCheck
    ? incoming.filter(result => result.exerciseId !== SCREEN_DIRECTIONAL_E_PROTOCOL)
    : incoming
  const incomingExerciseIds = new Set(acceptedIncoming.map(result => result.exerciseId))
  return [
    ...current.filter(result => !incomingExerciseIds.has(result.exerciseId)),
    ...acceptedIncoming,
  ]
}
