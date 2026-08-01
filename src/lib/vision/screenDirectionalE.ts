export const SCREEN_DIRECTIONAL_E_PROTOCOL = 'screen-directional-e-v1' as const
// The exercise id remains stable for score-neutral storage; this numeric version
// distinguishes the original seven-row geometry from the additive fourteen-row rail.
export const SCREEN_DIRECTIONAL_E_VERSION = 2
// Fourteen log-spaced steps, rounded to keep every DPR-1 row visibly distinct
// while reaching the old near-pixel end without row consolidation.
export const SCREEN_E_LINE_MULTIPLIERS = [
  1, 0.83, 0.69, 0.57, 0.475, 0.39, 0.33, 0.275, 0.22, 0.185, 0.15, 0.13, 0.11, 0.09,
] as const
export const SCREEN_E_LINE_LETTER_COUNTS = [3, 4, 5, 5, 6, 7, 8, 8, 8, 8, 8, 8, 8, 8] as const
export const SCREEN_E_DIRECTIONS = ['up', 'right', 'down', 'left'] as const
export const SCREEN_E_TRIALS_PER_LINE = SCREEN_E_DIRECTIONS.length
export const SCREEN_E_CORRECT_TO_PASS = 3
export const SCREEN_E_MIN_LEGIBLE_PHYSICAL_PX = 5
export const SCREEN_E_QUICK_CHECK_STIMULUS_STAGE_HEIGHT = 80
export const SCREEN_E_RESPONSE_BUTTON_SIZE = 48
export const SCREEN_E_RESPONSE_BUTTON_GAP = 8
export const SCREEN_E_CHART_STAGE_HEIGHT = 260

export const SCREEN_E_STYLE_REGISTRY = {
  crisp: { label: 'Crisp', thickness: 7 },
  thin: { label: 'Thin', thickness: 5 },
} as const

export type ScreenEStyle = keyof typeof SCREEN_E_STYLE_REGISTRY
export const DEFAULT_SCREEN_E_STYLE: ScreenEStyle = 'crisp'

export function resolveScreenEStyle(value: unknown): ScreenEStyle {
  return typeof value === 'string' && Object.hasOwn(SCREEN_E_STYLE_REGISTRY, value)
    ? value as ScreenEStyle
    : DEFAULT_SCREEN_E_STYLE
}

export function screenEStyleThickness(value: unknown): number {
  return SCREEN_E_STYLE_REGISTRY[resolveScreenEStyle(value)].thickness
}

export function screenEStyleRenderThickness(
  value: unknown,
  cssSize: number,
  devicePixelRatio = 1,
): number {
  const style = resolveScreenEStyle(value)
  const nominalThickness = SCREEN_E_STYLE_REGISTRY[style].thickness

  // Crisp is the protected existing presentation. Thin alone is quantized so
  // every bar occupies the same whole number of physical pixels at small rows.
  if (style !== 'thin') return nominalThickness

  const safeCssSize = Number.isFinite(cssSize) && cssSize > 0 ? cssSize : 50
  const safeDevicePixelRatio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
    ? devicePixelRatio
    : 1
  const physicalPixelsPerViewBoxUnit = safeCssSize * safeDevicePixelRatio / 50
  const physicalThickness = Math.max(
    1,
    Math.round(nominalThickness * physicalPixelsPerViewBoxUnit),
  )

  return physicalThickness / physicalPixelsPerViewBoxUnit
}

export type ScreenEDirection = typeof SCREEN_E_DIRECTIONS[number]
export type ScreenEInputMethod = 'touch' | 'pointer' | 'keyboard' | 'voice' | 'helper'
export type ScreenEDistanceChoice = 'stay' | 'further'

export function parseScreenEDistanceChoice(rawTranscript: string): ScreenEDistanceChoice | null {
  const normalized = rawTranscript
    .trim()
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!normalized) return null

  const words = normalized.split(' ')
  const hasStayWord = words.includes('stay')
  const hasFurtherWord = words.includes('further') || words.includes('farther')
  const hasSameDistance = /(?:^|\s)same distance(?:$|\s)/.test(normalized)

  if ((hasStayWord || hasSameDistance) && hasFurtherWord) return null
  if (hasFurtherWord) return 'further'
  if (normalized === 'stay' || normalized === 'stay put' || hasSameDistance) return 'stay'
  return null
}

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

export function screenEPixelSnap(cssPixels: number, devicePixelRatio = 1): number {
  const safeDevicePixelRatio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
    ? devicePixelRatio
    : 1
  return Math.round(cssPixels * safeDevicePixelRatio) / safeDevicePixelRatio
}

export function screenELineSize(
  viewportCssWidth: number,
  lineIndex: number,
  devicePixelRatio = 1,
): number {
  const multiplier = SCREEN_E_LINE_MULTIPLIERS[lineIndex]
  if (multiplier === undefined) throw new RangeError(`Unknown screen-E line ${lineIndex + 1}`)
  const safeDevicePixelRatio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
    ? devicePixelRatio
    : 1
  // Reserve one physical pixel between each trailing row on a DPR-1 display.
  // That keeps all fourteen rows distinct while the actual safety floor remains five physical pixels.
  const distinctPhysicalFloor = SCREEN_E_MIN_LEGIBLE_PHYSICAL_PX +
    (SCREEN_E_LINE_MULTIPLIERS.length - lineIndex - 1)
  return screenEPixelSnap(
    Math.max(
      distinctPhysicalFloor / safeDevicePixelRatio,
      screenEBaseSize(viewportCssWidth) * multiplier,
    ),
    safeDevicePixelRatio,
  )
}

export interface ScreenEChartTravel {
  readonly phase: 'opening' | 'tracking' | 'closing'
  readonly openingLineCount: number
  readonly closingStartLineIndex: number
  readonly stripAnchorLineIndex: number
}

/**
 * The strip only moves upward during tracking. Opening and closing positions
 * are expressed independently so any number of additive rows keeps the same
 * motion contract.
 */
export function screenEChartTravel(totalLines: number, lineIndex: number): ScreenEChartTravel {
  if (!Number.isInteger(totalLines) || totalLines < 1) {
    throw new RangeError('Screen-E chart requires at least one line')
  }
  if (!Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex >= totalLines) {
    throw new RangeError(`Unknown screen-E chart line ${lineIndex + 1}`)
  }

  const openingLineCount = Math.min(3, totalLines)
  const trackingStartLineIndex = openingLineCount - 1
  // Spread the final descent across five fine rows. Tiny optotypes no longer
  // need oversized empty slots just to carry the marker toward the controls.
  const closingLineCount = totalLines > openingLineCount ? Math.min(5, totalLines - openingLineCount) : 0
  const closingStartLineIndex = totalLines - closingLineCount
  const finalTrackingLineIndex = Math.max(trackingStartLineIndex, closingStartLineIndex - 1)

  if (lineIndex < trackingStartLineIndex) {
    return { phase: 'opening', openingLineCount, closingStartLineIndex, stripAnchorLineIndex: 0 }
  }
  if (lineIndex <= finalTrackingLineIndex) {
    return { phase: 'tracking', openingLineCount, closingStartLineIndex, stripAnchorLineIndex: lineIndex }
  }
  return {
    phase: 'closing',
    openingLineCount,
    closingStartLineIndex,
    stripAnchorLineIndex: finalTrackingLineIndex,
  }
}

export interface ScreenEChartPosition extends ScreenEChartTravel {
  readonly markerY: number
  readonly stripOffsetY: number
  readonly rowCenters: readonly number[]
  readonly rowHeights: readonly number[]
}

export function screenEChartPosition(
  viewportCssWidth: number,
  devicePixelRatio: number,
  lineIndex: number,
  totalLines: number = SCREEN_E_LINE_MULTIPLIERS.length,
): ScreenEChartPosition {
  const travel = screenEChartTravel(totalLines, lineIndex)
  const rowHeights = Array.from({ length: totalLines }, (_, index) =>
    Math.max(14, Math.ceil(screenELineSize(viewportCssWidth, index, devicePixelRatio) + 8)),
  )
  const rowCenters = rowHeights.reduce<number[]>((centers, height, index) => {
    const previousCenter = centers[index - 1]
    const previousHeight = rowHeights[index - 1]
    centers.push(index === 0 ? height / 2 : previousCenter + (previousHeight + height) / 2)
    return centers
  }, [])
  const trackingMarkerY = rowCenters[travel.openingLineCount - 1]

  if (travel.phase === 'opening') {
    return { ...travel, markerY: rowCenters[lineIndex], stripOffsetY: 0, rowCenters, rowHeights }
  }

  const stripOffsetY = trackingMarkerY - rowCenters[travel.stripAnchorLineIndex]
  return {
    ...travel,
    markerY: travel.phase === 'closing' ? rowCenters[lineIndex] + stripOffsetY : trackingMarkerY,
    stripOffsetY,
    rowCenters,
    rowHeights,
  }
}

export function screenEResponsePadLayout() {
  return Object.freeze({
    buttonSize: SCREEN_E_RESPONSE_BUTTON_SIZE,
    buttonGap: SCREEN_E_RESPONSE_BUTTON_GAP,
    padHeight: SCREEN_E_RESPONSE_BUTTON_SIZE * 3 + SCREEN_E_RESPONSE_BUTTON_GAP * 2,
  })
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

type ScreenEResultLike = {
  exerciseId: string
  metrics?: Record<string, unknown>
}

function isCurrentScreenDirectionalEResult(result: ScreenEResultLike): boolean {
  if (result.exerciseId !== SCREEN_DIRECTIONAL_E_PROTOCOL) return false
  // Tiny test/caller markers without metrics retain the historical generic behavior.
  if (!result.metrics) return true
  return result.metrics.protocolVersion === SCREEN_DIRECTIONAL_E_VERSION &&
    result.metrics.totalLines === SCREEN_E_LINE_MULTIPLIERS.length
}

export function mergeResultsPreservingOpeningScreenCheck<T extends ScreenEResultLike>(
  current: T[],
  incoming: T[],
): T[] {
  const hasOpeningScreenCheck = current.some(isCurrentScreenDirectionalEResult)
  const acceptedIncoming = hasOpeningScreenCheck
    ? incoming.filter(result => result.exerciseId !== SCREEN_DIRECTIONAL_E_PROTOCOL)
    : incoming
  const incomingExerciseIds = new Set(acceptedIncoming.map(result => result.exerciseId))
  return [
    ...current.filter(result =>
      !incomingExerciseIds.has(result.exerciseId) &&
      (result.exerciseId !== SCREEN_DIRECTIONAL_E_PROTOCOL || isCurrentScreenDirectionalEResult(result)),
    ),
    ...acceptedIncoming,
  ]
}
