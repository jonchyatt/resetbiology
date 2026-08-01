import {
  SCREEN_E_LINE_MULTIPLIERS,
  screenEBaseSize,
  screenEPixelSnap,
  type ScreenEStyle,
} from './screenDirectionalE'

export const SCREEN_GABOR_PRACTICE_VERSION = 'screen-gabor-orientation-v1' as const
export const SCREEN_GABOR_MEAN_GRAY = '#808080' as const
export const SCREEN_GABOR_RASTER_MODE = 'mean-matched-opaque' as const
export const SCREEN_GABOR_FREQUENCY_CYCLES = 3
export const SCREEN_GABOR_CONTRAST = 0.82
export const SCREEN_GABOR_SIGMA_RATIO = 0.25
export const SCREEN_GABOR_MIN_PHYSICAL_PX = 12

export const SCREEN_PRACTICE_MODE_REGISTRY = Object.freeze({
  crisp: Object.freeze({
    kind: 'directional-e' as const,
    label: 'Crisp',
    description: 'Strong, precise directional E',
    screenEStyle: 'crisp' as const,
  }),
  thin: Object.freeze({
    kind: 'directional-e' as const,
    label: 'Thin',
    description: 'Finer directional E lines',
    screenEStyle: 'thin' as const,
  }),
  gabor: Object.freeze({
    kind: 'gabor' as const,
    label: 'Gabor',
    description: 'Match the soft stripe direction',
    screenEStyle: null,
  }),
})

export type ScreenPracticeMode = keyof typeof SCREEN_PRACTICE_MODE_REGISTRY
export const DEFAULT_SCREEN_PRACTICE_MODE: ScreenPracticeMode = 'crisp'

export function resolveScreenPracticeMode(value: unknown): ScreenPracticeMode {
  return typeof value === 'string' && Object.hasOwn(SCREEN_PRACTICE_MODE_REGISTRY, value)
    ? value as ScreenPracticeMode
    : DEFAULT_SCREEN_PRACTICE_MODE
}

export function screenPracticeModeEStyle(value: unknown): ScreenEStyle {
  const mode = resolveScreenPracticeMode(value)
  return mode === 'thin' ? 'thin' : 'crisp'
}

export type ScreenGaborChoice = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
export type ScreenGaborCompassIndex = 0 | 1 | 2

export interface ScreenGaborOrientationManifestEntry {
  readonly choice: ScreenGaborChoice
  readonly orientationDegrees: number
  readonly row: ScreenGaborCompassIndex
  readonly column: ScreenGaborCompassIndex
}

/**
 * Axial orientations repeat after 180 degrees. The permanent clockwise
 * number/cell map is the one authority used by rendering, touch, and voice.
 */
export const SCREEN_GABOR_ORIENTATION_MANIFEST = Object.freeze([
  Object.freeze({ choice: 1, orientationDegrees: 0, row: 0, column: 0 }),
  Object.freeze({ choice: 2, orientationDegrees: 22.5, row: 0, column: 1 }),
  Object.freeze({ choice: 3, orientationDegrees: 45, row: 0, column: 2 }),
  Object.freeze({ choice: 4, orientationDegrees: 67.5, row: 1, column: 2 }),
  Object.freeze({ choice: 5, orientationDegrees: 90, row: 2, column: 2 }),
  Object.freeze({ choice: 6, orientationDegrees: 112.5, row: 2, column: 1 }),
  Object.freeze({ choice: 7, orientationDegrees: 135, row: 2, column: 0 }),
  Object.freeze({ choice: 8, orientationDegrees: 157.5, row: 1, column: 0 }),
] as const satisfies readonly ScreenGaborOrientationManifestEntry[])

const SCREEN_GABOR_ENTRY_BY_CHOICE = new Map(
  SCREEN_GABOR_ORIENTATION_MANIFEST.map(entry => [entry.choice, entry]),
)

export function screenGaborManifestEntry(choice: ScreenGaborChoice): ScreenGaborOrientationManifestEntry {
  const entry = SCREEN_GABOR_ENTRY_BY_CHOICE.get(choice)
  if (!entry) throw new RangeError(`Unknown screen-Gabor choice ${choice}`)
  return entry
}

export function screenGaborChoiceForOrientation(orientationDegrees: number): ScreenGaborChoice {
  const normalized = ((orientationDegrees % 180) + 180) % 180
  const entry = SCREEN_GABOR_ORIENTATION_MANIFEST.find(candidate =>
    Math.abs(candidate.orientationDegrees - normalized) < 1e-9,
  )
  if (!entry) throw new RangeError(`Unknown screen-Gabor orientation ${orientationDegrees}`)
  return entry.choice
}

export function balancedScreenGaborChoices(
  count: number,
  random: () => number = Math.random,
): ScreenGaborChoice[] {
  if (!Number.isInteger(count) || count < 1 || count > SCREEN_GABOR_ORIENTATION_MANIFEST.length) {
    throw new RangeError(`Screen-Gabor rows require 1-${SCREEN_GABOR_ORIENTATION_MANIFEST.length} targets`)
  }
  const choices = SCREEN_GABOR_ORIENTATION_MANIFEST.map(entry => entry.choice)
  for (let index = choices.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[choices[index], choices[swapIndex]] = [choices[swapIndex], choices[index]]
  }
  return choices.slice(0, count)
}

const SCREEN_GABOR_NUMBER_TOKENS: Readonly<Record<string, ScreenGaborChoice>> = Object.freeze({
  '1': 1,
  one: 1,
  '2': 2,
  two: 2,
  '3': 3,
  three: 3,
  '4': 4,
  four: 4,
  '5': 5,
  five: 5,
  '6': 6,
  six: 6,
  '7': 7,
  seven: 7,
  '8': 8,
  eight: 8,
})

/** Accept one explicit number only; ambiguous multi-number speech is refused. */
export function parseScreenGaborChoice(rawTranscript: string): ScreenGaborChoice | null {
  const tokens = rawTranscript
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const matches = tokens
    .map(token => SCREEN_GABOR_NUMBER_TOKENS[token])
    .filter((choice): choice is ScreenGaborChoice => choice !== undefined)
  return matches.length === 1 ? matches[0] : null
}

/**
 * Reuse the fourteen-step visual rail but reserve enough backing pixels to
 * represent three stripe cycles honestly at the fine end.
 */
export function screenGaborLineSize(
  viewportCssWidth: number,
  lineIndex: number,
  devicePixelRatio = 1,
): number {
  const multiplier = SCREEN_E_LINE_MULTIPLIERS[lineIndex]
  if (multiplier === undefined) throw new RangeError(`Unknown screen-Gabor line ${lineIndex + 1}`)
  const safeDevicePixelRatio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
    ? devicePixelRatio
    : 1
  const remainingRows = SCREEN_E_LINE_MULTIPLIERS.length - lineIndex - 1
  const distinctPhysicalFloor = SCREEN_GABOR_MIN_PHYSICAL_PX + remainingRows
  return screenEPixelSnap(
    Math.max(
      distinctPhysicalFloor / safeDevicePixelRatio,
      screenEBaseSize(viewportCssWidth) * multiplier,
    ),
    safeDevicePixelRatio,
  )
}
