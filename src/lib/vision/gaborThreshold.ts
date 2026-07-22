/**
 * Pure psychophysical core for the GABOR_THRESHOLD_V1 protocol.
 *
 * Contrast is expressed as Michelson contrast percent and stepped in log10
 * space. Rendering, reaction time, rewards, and persistence deliberately live
 * outside this module so none of them can become the therapeutic variable.
 */

export const GABOR_THRESHOLD_PROTOCOL = {
  id: 'GABOR_THRESHOLD_V1',
  minContrastPct: 0.5,
  maxContrastPct: 100,
  startContrastPct: 50,
  coarseStepLog10: 0.15,
  fineStepLog10: 0.075,
  fineStepAfterReversals: 2,
  reversalsForThreshold: 8,
  adaptiveTrialsForThreshold: 24,
  discardedReversals: 2,
  averagedReversals: 6,
  anchorSpatialFrequencyCyclesPerPatch: 7,
  transferSpatialFrequenciesCyclesPerPatch: [4, 11] as const,
  phaseDegrees: 0,
  sigmaWavelengthRatio: 1,
  localizationResponses: 12,
  localizationStepLog10: 0.3,
  localizedMeasurementOffsetLog10: 0.2,
  warmMeasurementOffsetLog10: 0.1,
  measurementResponseCap: 48,
  warmMeasurementResponseCap: 60,
  combinedResponseCap: 60,
} as const

/** The stationary target of a 3-down/1-up rule: p^3 = 0.5. */
export const GABOR_3_DOWN_1_UP_TARGET_CORRECT = Math.pow(0.5, 1 / 3)

export const GABOR_ORIENTATIONS_DEGREES = [0, 45, 90, 135] as const

/** Every field that can change the meaning of a saved contrast threshold. */
export const GABOR_THRESHOLD_RENDER_CONFIG = {
  rendererId: 'PROCEDURAL_GABOR_V1',
  contrastMetric: 'michelson-percent',
  anchorSpatialFrequencyCyclesPerPatch: 7,
  orientationsDegrees: GABOR_ORIENTATIONS_DEGREES,
  phaseDegrees: 0,
  sigmaWavelengthRatio: 1,
} as const

/** Quick Practice is visible rehearsal, never a hard-session measurement. */
export const GABOR_EASY_PREVIEW_POLICY = {
  persistsThreshold: false,
  consumesHardSession: false,
  adaptive: false,
} as const

export type GaborStepDirection = -1 | 0 | 1
export type GaborThresholdResponse = 'correct' | 'incorrect' | 'timeout' | 'lapse'

export interface GaborThresholdState {
  readonly protocol: typeof GABOR_THRESHOLD_PROTOCOL.id
  readonly contrastPct: number
  readonly adaptiveTrials: number
  readonly consecutiveCorrect: number
  readonly lastEffectiveDirection: Exclude<GaborStepDirection, 0>
    | null
  readonly reversalContrastsPct: readonly number[]
  readonly completed: boolean
  readonly lockedThresholdPct: number | null
}

export interface GaborThresholdObservation {
  readonly response: GaborThresholdResponse
  /** Only isolated anchor trials are adaptive in GABOR_THRESHOLD_V1. */
  readonly adaptive: boolean
}

export interface GaborThresholdTransition {
  readonly state: GaborThresholdState
  readonly acceptedForStaircase: boolean
  readonly presentedContrastPct: number
  readonly requestedDirection: GaborStepDirection
  readonly effectiveDirection: GaborStepDirection
  readonly stepLog10: number | null
  readonly reversalContrastPct: number | null
}

export type GaborThresholdEstimate =
  | {
      readonly valid: true
      readonly contrastThresholdPct: number
      readonly reversalContrastsPct: readonly number[]
    }
  | {
      readonly valid: false
      readonly reason: 'too-few-adaptive-trials' | 'too-few-reversals' | 'threshold-not-locked'
    }

export interface GaborLocalizationState {
  readonly protocol: typeof GABOR_THRESHOLD_PROTOCOL.id
  readonly contrastPct: number
  readonly responses: number
  readonly presentedContrastsPct: readonly number[]
}

export interface GaborLocalizationTransition {
  readonly state: GaborLocalizationState
  readonly accepted: boolean
  readonly presentedContrastPct: number
  readonly requestedDirection: Exclude<GaborStepDirection, 0>
  readonly effectiveDirection: GaborStepDirection
}

export type GaborLocalizationEstimate =
  | {
      readonly valid: true
      readonly contrastPct: number
      readonly presentedContrastsPct: readonly number[]
    }
  | { readonly valid: false; readonly reason: 'localization-incomplete' }

export interface GaborThresholdPrior {
  readonly valid: boolean
  readonly stale: boolean
  readonly protocol: string
  readonly contrastThresholdPct: number
  readonly renderConfig: {
    readonly rendererId: string
    readonly contrastMetric: string
    readonly anchorSpatialFrequencyCyclesPerPatch: number
    readonly orientationsDegrees: readonly number[]
    readonly phaseDegrees: number
    readonly sigmaWavelengthRatio: number
  }
}

export type GaborThresholdSessionStart =
  | {
      readonly mode: 'warm-start'
      readonly localization: null
      readonly measurement: GaborThresholdState
      readonly measurementResponseCap: 60
      readonly fallbackReason: null
    }
  | {
      readonly mode: 'localization'
      readonly localization: GaborLocalizationState
      readonly measurement: null
      readonly measurementResponseCap: 48
      readonly fallbackReason: 'missing' | 'invalid' | 'stale' | 'protocol-mismatch' | 'render-mismatch'
    }

export function createGaborThresholdState(
  startContrastPct: number = GABOR_THRESHOLD_PROTOCOL.startContrastPct,
): GaborThresholdState {
  return {
    protocol: GABOR_THRESHOLD_PROTOCOL.id,
    contrastPct: clampContrast(startContrastPct),
    adaptiveTrials: 0,
    consecutiveCorrect: 0,
    lastEffectiveDirection: null,
    reversalContrastsPct: [],
    completed: false,
    lockedThresholdPct: null,
  }
}

export function createGaborLocalizationState(): GaborLocalizationState {
  return {
    protocol: GABOR_THRESHOLD_PROTOCOL.id,
    contrastPct: GABOR_THRESHOLD_PROTOCOL.startContrastPct,
    responses: 0,
    presentedContrastsPct: [],
  }
}

/**
 * Advance the fixed twelve-response 1-down/1-up localization pass.
 * Timeouts and lapses deliberately move brighter here: localization finds a
 * safe starting neighborhood, but none of its state is a measured outcome.
 */
export function updateGaborLocalization(
  state: GaborLocalizationState,
  response: GaborThresholdResponse,
): GaborLocalizationTransition {
  const presentedContrastPct = state.contrastPct
  const requestedDirection: Exclude<GaborStepDirection, 0> = response === 'correct' ? -1 : 1
  if (state.responses >= GABOR_THRESHOLD_PROTOCOL.localizationResponses) {
    return {
      state,
      accepted: false,
      presentedContrastPct,
      requestedDirection,
      effectiveDirection: 0,
    }
  }

  const contrastPct = clampContrast(Math.pow(
    10,
    Math.log10(presentedContrastPct)
      + requestedDirection * GABOR_THRESHOLD_PROTOCOL.localizationStepLog10,
  ))
  const effectiveDirection: GaborStepDirection = approximatelyEqual(contrastPct, presentedContrastPct)
    ? 0
    : requestedDirection

  return {
    state: {
      ...state,
      contrastPct,
      responses: state.responses + 1,
      presentedContrastsPct: [...state.presentedContrastsPct, presentedContrastPct],
    },
    accepted: true,
    presentedContrastPct,
    requestedDirection,
    effectiveDirection,
  }
}

export function getGaborLocalizationEstimate(state: GaborLocalizationState): GaborLocalizationEstimate {
  if (state.responses !== GABOR_THRESHOLD_PROTOCOL.localizationResponses) {
    return { valid: false, reason: 'localization-incomplete' }
  }
  const presentedContrastsPct = state.presentedContrastsPct.slice(-4)
  return {
    valid: true,
    contrastPct: geometricMean(presentedContrastsPct),
    presentedContrastsPct,
  }
}

/** Start a pristine measurement after localization; no localization history crosses this seam. */
export function startGaborMeasurementAfterLocalization(
  localization: GaborLocalizationState,
): GaborThresholdState {
  const estimate = getGaborLocalizationEstimate(localization)
  if (!estimate.valid) throw new Error('Gabor localization must contain exactly 12 responses.')
  return createGaborThresholdState(
    estimate.contrastPct * Math.pow(10, GABOR_THRESHOLD_PROTOCOL.localizedMeasurementOffsetLog10),
  )
}

/** Select localization or a compatible prior without ever carrying measurement history. */
export function prepareGaborThresholdSession(
  prior?: GaborThresholdPrior | null,
): GaborThresholdSessionStart {
  const fallbackReason = priorFallbackReason(prior)
  if (fallbackReason === null && prior) {
    return {
      mode: 'warm-start',
      localization: null,
      measurement: createGaborThresholdState(
        prior.contrastThresholdPct * Math.pow(10, GABOR_THRESHOLD_PROTOCOL.warmMeasurementOffsetLog10),
      ),
      measurementResponseCap: GABOR_THRESHOLD_PROTOCOL.warmMeasurementResponseCap,
      fallbackReason: null,
    }
  }
  return {
    mode: 'localization',
    localization: createGaborLocalizationState(),
    measurement: null,
    measurementResponseCap: GABOR_THRESHOLD_PROTOCOL.measurementResponseCap,
    fallbackReason: fallbackReason ?? 'missing',
  }
}

/**
 * Advance one response through the 3-down/1-up controller.
 *
 * Ignored observations return the original state object. A requested step that
 * hits a clamp still consumes its response run, but it cannot change the last
 * effective direction or create a reversal.
 */
export function updateGaborThreshold(
  state: GaborThresholdState,
  observation: GaborThresholdObservation,
): GaborThresholdTransition {
  const presentedContrastPct = state.contrastPct
  if (state.completed) {
    return {
      state,
      acceptedForStaircase: false,
      presentedContrastPct,
      requestedDirection: 0,
      effectiveDirection: 0,
      stepLog10: null,
      reversalContrastPct: null,
    }
  }
  if (!observation.adaptive || observation.response === 'timeout' || observation.response === 'lapse') {
    return {
      state,
      acceptedForStaircase: false,
      presentedContrastPct,
      requestedDirection: 0,
      effectiveDirection: 0,
      stepLog10: null,
      reversalContrastPct: null,
    }
  }

  const adaptiveTrials = state.adaptiveTrials + 1
  let consecutiveCorrect = observation.response === 'correct'
    ? state.consecutiveCorrect + 1
    : 0
  let requestedDirection: GaborStepDirection = 0

  if (observation.response === 'incorrect') {
    requestedDirection = 1
  } else if (consecutiveCorrect === 3) {
    requestedDirection = -1
    consecutiveCorrect = 0
  }

  if (requestedDirection === 0) {
    const nextState = lockGaborThresholdIfEligible({ ...state, adaptiveTrials, consecutiveCorrect })
    return {
      state: nextState,
      acceptedForStaircase: true,
      presentedContrastPct,
      requestedDirection,
      effectiveDirection: 0,
      stepLog10: null,
      reversalContrastPct: null,
    }
  }

  const stepLog10 = state.reversalContrastsPct.length < GABOR_THRESHOLD_PROTOCOL.fineStepAfterReversals
    ? GABOR_THRESHOLD_PROTOCOL.coarseStepLog10
    : GABOR_THRESHOLD_PROTOCOL.fineStepLog10
  const requestedContrastPct = Math.pow(
    10,
    Math.log10(presentedContrastPct) + requestedDirection * stepLog10,
  )
  const contrastPct = clampContrast(requestedContrastPct)
  const effectiveDirection: GaborStepDirection = approximatelyEqual(contrastPct, presentedContrastPct)
    ? 0
    : requestedDirection

  if (effectiveDirection === 0) {
    const nextState = lockGaborThresholdIfEligible({ ...state, adaptiveTrials, consecutiveCorrect })
    return {
      state: nextState,
      acceptedForStaircase: true,
      presentedContrastPct,
      requestedDirection,
      effectiveDirection,
      stepLog10,
      reversalContrastPct: null,
    }
  }

  const isReversal = state.lastEffectiveDirection !== null
    && state.lastEffectiveDirection !== effectiveDirection
  const reversalContrastPct = isReversal ? presentedContrastPct : null

  const nextState = lockGaborThresholdIfEligible({
    ...state,
    contrastPct,
    adaptiveTrials,
    consecutiveCorrect,
    lastEffectiveDirection: effectiveDirection,
    reversalContrastsPct: isReversal
      ? [...state.reversalContrastsPct, presentedContrastPct]
      : state.reversalContrastsPct,
  })
  return {
    state: nextState,
    acceptedForStaircase: true,
    presentedContrastPct,
    requestedDirection,
    effectiveDirection,
    stepLog10,
    reversalContrastPct,
  }
}

export function getGaborThresholdEstimate(state: GaborThresholdState): GaborThresholdEstimate {
  if (state.adaptiveTrials < GABOR_THRESHOLD_PROTOCOL.adaptiveTrialsForThreshold) {
    return { valid: false, reason: 'too-few-adaptive-trials' }
  }
  if (state.reversalContrastsPct.length < GABOR_THRESHOLD_PROTOCOL.reversalsForThreshold) {
    return { valid: false, reason: 'too-few-reversals' }
  }
  if (!state.completed || state.lockedThresholdPct === null) {
    return { valid: false, reason: 'threshold-not-locked' }
  }

  const usableReversals = state.reversalContrastsPct.slice(GABOR_THRESHOLD_PROTOCOL.discardedReversals)
  const reversalContrastsPct = usableReversals.slice(-GABOR_THRESHOLD_PROTOCOL.averagedReversals)

  return { valid: true, contrastThresholdPct: state.lockedThresholdPct, reversalContrastsPct }
}

function lockGaborThresholdIfEligible(state: GaborThresholdState): GaborThresholdState {
  if (state.completed
    || state.adaptiveTrials < GABOR_THRESHOLD_PROTOCOL.adaptiveTrialsForThreshold
    || state.reversalContrastsPct.length < GABOR_THRESHOLD_PROTOCOL.reversalsForThreshold) return state

  const usableReversals = state.reversalContrastsPct.slice(GABOR_THRESHOLD_PROTOCOL.discardedReversals)
  const finalSix = usableReversals.slice(-GABOR_THRESHOLD_PROTOCOL.averagedReversals)
  return {
    ...state,
    completed: true,
    lockedThresholdPct: geometricMean(finalSix),
  }
}

function priorFallbackReason(
  prior?: GaborThresholdPrior | null,
): GaborThresholdSessionStart['fallbackReason'] {
  if (!prior) return 'missing'
  if (!prior.valid
    || !Number.isFinite(prior.contrastThresholdPct)
    || prior.contrastThresholdPct < GABOR_THRESHOLD_PROTOCOL.minContrastPct
    || prior.contrastThresholdPct > GABOR_THRESHOLD_PROTOCOL.maxContrastPct) return 'invalid'
  if (prior.stale) return 'stale'
  if (prior.protocol !== GABOR_THRESHOLD_PROTOCOL.id) return 'protocol-mismatch'
  if (!sameRenderConfig(prior.renderConfig)) return 'render-mismatch'
  return null
}

function sameRenderConfig(config: GaborThresholdPrior['renderConfig']): boolean {
  return config.rendererId === GABOR_THRESHOLD_RENDER_CONFIG.rendererId
    && config.contrastMetric === GABOR_THRESHOLD_RENDER_CONFIG.contrastMetric
    && config.anchorSpatialFrequencyCyclesPerPatch === GABOR_THRESHOLD_RENDER_CONFIG.anchorSpatialFrequencyCyclesPerPatch
    && config.phaseDegrees === GABOR_THRESHOLD_RENDER_CONFIG.phaseDegrees
    && config.sigmaWavelengthRatio === GABOR_THRESHOLD_RENDER_CONFIG.sigmaWavelengthRatio
    && config.orientationsDegrees.length === GABOR_THRESHOLD_RENDER_CONFIG.orientationsDegrees.length
    && config.orientationsDegrees.every(
      (orientation, index) => orientation === GABOR_THRESHOLD_RENDER_CONFIG.orientationsDegrees[index],
    )
}

export type GaborTrialKind = 'anchor' | 'easy' | 'transfer' | 'flanker' | 'catch'
export type GaborTrialCondition =
  | 'isolated-anchor'
  | 'easy-supplement'
  | 'spatial-frequency-transfer'
  | 'collinear-flanker'
  | 'blank-catch'

export interface GaborFlankerSpec {
  readonly arrangement: 'collinear-bilateral'
  readonly centerOffsetWavelengths: 3
  readonly contrastPct: 60
  readonly orientationDegrees: number
  readonly spatialFrequencyCyclesPerPatch: 7
  readonly phaseDegrees: 0
}

export interface GaborThresholdTrial {
  readonly id: string
  readonly protocol: typeof GABOR_THRESHOLD_PROTOCOL.id
  readonly kind: GaborTrialKind
  readonly condition: GaborTrialCondition
  readonly stimulusPresent: boolean
  readonly adaptive: boolean
  readonly thresholdEligible: boolean
  readonly contrastPct: number
  readonly orientationDegrees: number | null
  readonly spatialFrequencyCyclesPerPatch: number | null
  readonly phaseDegrees: 0 | null
  readonly sigmaWavelengthRatio: 1 | null
  readonly responseSemantics: 'four-choice-orientation' | 'any-choice-is-false-alarm'
  readonly falseAlarmOnAnyChoice: boolean
  readonly flankers: GaborFlankerSpec | null
}

export interface GaborThresholdBlockOptions {
  readonly seed: string | number
  readonly blockIndex: number
  readonly currentContrastPct: number
}

/** Build one seeded ten-trial therapeutic block. */
export function buildGaborThresholdBlock({
  seed,
  blockIndex,
  currentContrastPct,
}: GaborThresholdBlockOptions): readonly GaborThresholdTrial[] {
  assertBlockIndex(blockIndex)
  const contrastPct = clampContrast(currentContrastPct)
  const trials: GaborThresholdTrial[] = []

  for (let anchorIndex = 0; anchorIndex < 6; anchorIndex += 1) {
    trials.push(stimulusTrial({
      id: `block-${blockIndex}-anchor-${anchorIndex}`,
      kind: 'anchor',
      condition: 'isolated-anchor',
      adaptive: true,
      contrastPct,
      orientationDegrees: balancedOrientation(seed, 'anchor', blockIndex * 6 + anchorIndex),
      spatialFrequencyCyclesPerPatch: GABOR_THRESHOLD_PROTOCOL.anchorSpatialFrequencyCyclesPerPatch,
    }))
  }

  trials.push(stimulusTrial({
    id: `block-${blockIndex}-easy-0`,
    kind: 'easy',
    condition: 'easy-supplement',
    adaptive: false,
    contrastPct: Math.min(100, Math.max(50, contrastPct * 2)),
    orientationDegrees: balancedOrientation(seed, 'easy', blockIndex),
    spatialFrequencyCyclesPerPatch: GABOR_THRESHOLD_PROTOCOL.anchorSpatialFrequencyCyclesPerPatch,
  }))

  trials.push(stimulusTrial({
    id: `block-${blockIndex}-transfer-0`,
    kind: 'transfer',
    condition: 'spatial-frequency-transfer',
    adaptive: false,
    contrastPct: Math.min(100, Math.max(30, contrastPct * 1.5)),
    orientationDegrees: balancedOrientation(seed, 'transfer', blockIndex),
    spatialFrequencyCyclesPerPatch: balancedTransferFrequency(seed, blockIndex),
  }))

  const flankerOrientation = balancedOrientation(seed, 'flanker', blockIndex)
  trials.push(stimulusTrial({
    id: `block-${blockIndex}-flanker-0`,
    kind: 'flanker',
    condition: 'collinear-flanker',
    adaptive: false,
    contrastPct,
    orientationDegrees: flankerOrientation,
    spatialFrequencyCyclesPerPatch: GABOR_THRESHOLD_PROTOCOL.anchorSpatialFrequencyCyclesPerPatch,
    flankers: {
      arrangement: 'collinear-bilateral',
      centerOffsetWavelengths: 3,
      contrastPct: 60,
      orientationDegrees: flankerOrientation,
      spatialFrequencyCyclesPerPatch: GABOR_THRESHOLD_PROTOCOL.anchorSpatialFrequencyCyclesPerPatch,
      phaseDegrees: GABOR_THRESHOLD_PROTOCOL.phaseDegrees,
    },
  }))

  trials.push(catchTrial(`block-${blockIndex}-catch-0`))
  return shuffleDeterministically(trials, `${String(seed)}:block-order:${blockIndex}`)
}

/** Build the non-therapeutic twelve-trial easy preview. */
export function buildGaborEasyPreview(seed: string | number): readonly GaborThresholdTrial[] {
  const trials: GaborThresholdTrial[] = []
  for (let anchorIndex = 0; anchorIndex < 8; anchorIndex += 1) {
    trials.push(stimulusTrial({
      id: `preview-anchor-${anchorIndex}`,
      kind: 'anchor',
      condition: 'isolated-anchor',
      adaptive: false,
      contrastPct: 60,
      orientationDegrees: balancedOrientation(seed, 'preview-anchor', anchorIndex),
      spatialFrequencyCyclesPerPatch: GABOR_THRESHOLD_PROTOCOL.anchorSpatialFrequencyCyclesPerPatch,
    }))
  }
  for (let transferIndex = 0; transferIndex < 2; transferIndex += 1) {
    trials.push(stimulusTrial({
      id: `preview-transfer-${transferIndex}`,
      kind: 'transfer',
      condition: 'spatial-frequency-transfer',
      adaptive: false,
      contrastPct: 60,
      orientationDegrees: balancedOrientation(seed, 'preview-transfer', transferIndex),
      spatialFrequencyCyclesPerPatch: balancedTransferFrequency(seed, transferIndex),
    }))
  }
  trials.push(catchTrial('preview-catch-0'), catchTrial('preview-catch-1'))
  return shuffleDeterministically(trials, `${String(seed)}:preview-order`)
}

function stimulusTrial({
  id,
  kind,
  condition,
  adaptive,
  contrastPct,
  orientationDegrees,
  spatialFrequencyCyclesPerPatch,
  flankers = null,
}: {
  readonly id: string
  readonly kind: Exclude<GaborTrialKind, 'catch'>
  readonly condition: Exclude<GaborTrialCondition, 'blank-catch'>
  readonly adaptive: boolean
  readonly contrastPct: number
  readonly orientationDegrees: number
  readonly spatialFrequencyCyclesPerPatch: number
  readonly flankers?: GaborFlankerSpec | null
}): GaborThresholdTrial {
  return {
    id,
    protocol: GABOR_THRESHOLD_PROTOCOL.id,
    kind,
    condition,
    stimulusPresent: true,
    adaptive,
    thresholdEligible: adaptive,
    contrastPct,
    orientationDegrees,
    spatialFrequencyCyclesPerPatch,
    phaseDegrees: GABOR_THRESHOLD_PROTOCOL.phaseDegrees,
    sigmaWavelengthRatio: GABOR_THRESHOLD_PROTOCOL.sigmaWavelengthRatio,
    responseSemantics: 'four-choice-orientation',
    falseAlarmOnAnyChoice: false,
    flankers,
  }
}

function catchTrial(id: string): GaborThresholdTrial {
  return {
    id,
    protocol: GABOR_THRESHOLD_PROTOCOL.id,
    kind: 'catch',
    condition: 'blank-catch',
    stimulusPresent: false,
    adaptive: false,
    thresholdEligible: false,
    contrastPct: 0,
    orientationDegrees: null,
    spatialFrequencyCyclesPerPatch: null,
    phaseDegrees: null,
    sigmaWavelengthRatio: null,
    responseSemantics: 'any-choice-is-false-alarm',
    falseAlarmOnAnyChoice: true,
    flankers: null,
  }
}

function clampContrast(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError('Gabor contrast must be a finite number.')
  }
  return Math.min(
    GABOR_THRESHOLD_PROTOCOL.maxContrastPct,
    Math.max(GABOR_THRESHOLD_PROTOCOL.minContrastPct, value),
  )
}

function approximatelyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b)) * 4
}

function geometricMean(values: readonly number[]): number {
  return Math.pow(10, values.reduce((sum, value) => sum + Math.log10(value), 0) / values.length)
}

function assertBlockIndex(blockIndex: number): void {
  if (!Number.isSafeInteger(blockIndex) || blockIndex < 0) {
    throw new RangeError('Gabor blockIndex must be a non-negative safe integer.')
  }
}

function balancedOrientation(seed: string | number, lane: string, index: number): number {
  return balancedValue(seed, lane, index, GABOR_ORIENTATIONS_DEGREES)
}

function balancedTransferFrequency(seed: string | number, index: number): 4 | 11 {
  return balancedValue(
    seed,
    'transfer-frequency',
    index,
    GABOR_THRESHOLD_PROTOCOL.transferSpatialFrequenciesCyclesPerPatch,
  )
}

function balancedValue<const T extends readonly (string | number)[]>(
  seed: string | number,
  lane: string,
  index: number,
  values: T,
): T[number] {
  const bagIndex = Math.floor(index / values.length)
  const offset = index % values.length
  const bag = shuffleDeterministically([...values], `${String(seed)}:${lane}:${bagIndex}`)
  return bag[offset] as T[number]
}

function shuffleDeterministically<T>(values: T[], seed: string): T[] {
  const random = mulberry32(fnv1a32(seed))
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[values[index], values[swapIndex]] = [values[swapIndex], values[index]]
  }
  return values
}

function fnv1a32(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000
  }
}
