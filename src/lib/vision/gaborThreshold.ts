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
  coldMeasurementResponseCap: 48,
  warmMeasurementResponseCap: 60,
  coldScheduledExposureCap: 88,
  warmScheduledExposureCap: 100,
  sessionExposureCap: 100,
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
      readonly scheduledExposureCap: 100
      readonly sessionExposureCap: 100
      readonly fallbackReason: null
    }
  | {
      readonly mode: 'localization'
      readonly localization: GaborLocalizationState
      readonly measurement: null
      readonly measurementResponseCap: 48
      readonly scheduledExposureCap: 88
      readonly sessionExposureCap: 100
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
      scheduledExposureCap: GABOR_THRESHOLD_PROTOCOL.warmScheduledExposureCap,
      sessionExposureCap: GABOR_THRESHOLD_PROTOCOL.sessionExposureCap,
      fallbackReason: null,
    }
  }
  return {
    mode: 'localization',
    localization: createGaborLocalizationState(),
    measurement: null,
    measurementResponseCap: GABOR_THRESHOLD_PROTOCOL.coldMeasurementResponseCap,
    scheduledExposureCap: GABOR_THRESHOLD_PROTOCOL.coldScheduledExposureCap,
    sessionExposureCap: GABOR_THRESHOLD_PROTOCOL.sessionExposureCap,
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
  readonly contrastRule: 'live' | 'easy-live' | 'transfer-live' | 'fixed' | 'blank'
  readonly fixedContrastPct: number | null
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
  /** Test seam: production omits this and uses the seeded generator. */
  readonly selectionRandom?: () => number
}

/** Build one seeded ten-trial therapeutic block. */
export function buildGaborThresholdBlock({
  seed,
  blockIndex,
  selectionRandom,
}: GaborThresholdBlockOptions): readonly GaborThresholdTrial[] {
  assertBlockIndex(blockIndex)
  const trials: GaborThresholdTrial[] = []

  for (let anchorIndex = 0; anchorIndex < 6; anchorIndex += 1) {
    trials.push(stimulusTrial({
      id: `block-${blockIndex}-anchor-${anchorIndex}`,
      kind: 'anchor',
      condition: 'isolated-anchor',
      adaptive: true,
      contrastRule: 'live',
      orientationDegrees: balancedOrientation(seed, 'anchor', blockIndex * 6 + anchorIndex),
      spatialFrequencyCyclesPerPatch: GABOR_THRESHOLD_PROTOCOL.anchorSpatialFrequencyCyclesPerPatch,
    }))
  }

  trials.push(stimulusTrial({
    id: `block-${blockIndex}-easy-0`,
    kind: 'easy',
    condition: 'easy-supplement',
    adaptive: false,
    contrastRule: 'easy-live',
    orientationDegrees: balancedOrientation(seed, 'easy', blockIndex),
    spatialFrequencyCyclesPerPatch: GABOR_THRESHOLD_PROTOCOL.anchorSpatialFrequencyCyclesPerPatch,
  }))

  trials.push(stimulusTrial({
    id: `block-${blockIndex}-transfer-0`,
    kind: 'transfer',
    condition: 'spatial-frequency-transfer',
    adaptive: false,
    contrastRule: 'transfer-live',
    orientationDegrees: balancedOrientation(seed, 'transfer', blockIndex),
    spatialFrequencyCyclesPerPatch: balancedTransferFrequency(seed, blockIndex),
  }))

  const flankerOrientation = balancedOrientation(seed, 'flanker', blockIndex)
  trials.push(stimulusTrial({
    id: `block-${blockIndex}-flanker-0`,
    kind: 'flanker',
    condition: 'collinear-flanker',
    adaptive: false,
    contrastRule: 'live',
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
  return shuffleGaborBlock(
    trials,
    `${String(seed)}:block-order:${blockIndex}`,
    selectionRandom,
  )
}

/** One deterministic localization target; response index and exposure index stay separate. */
export function buildGaborLocalizationTrial(seed: string | number, exposureIndex: number): GaborThresholdTrial {
  if (!Number.isSafeInteger(exposureIndex) || exposureIndex < 0) {
    throw new RangeError('Gabor exposureIndex must be a non-negative safe integer.')
  }
  return stimulusTrial({
    id: `localization-${exposureIndex}`,
    kind: 'anchor',
    condition: 'isolated-anchor',
    adaptive: false,
    contrastRule: 'live',
    orientationDegrees: balancedOrientation(seed, 'localization', exposureIndex),
    spatialFrequencyCyclesPerPatch: GABOR_THRESHOLD_PROTOCOL.anchorSpatialFrequencyCyclesPerPatch,
  })
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
      contrastRule: 'fixed',
      fixedContrastPct: 60,
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
      contrastRule: 'fixed',
      fixedContrastPct: 60,
      orientationDegrees: balancedOrientation(seed, 'preview-transfer', transferIndex),
      spatialFrequencyCyclesPerPatch: balancedTransferFrequency(seed, transferIndex),
    }))
  }
  trials.push(catchTrial('preview-catch-0'), catchTrial('preview-catch-1'))
  return orderWithOneSelectionDrawPerTrial(trials, `${String(seed)}:preview-order`)
}

export interface GaborResolvedPresentation {
  readonly trial: GaborThresholdTrial
  readonly stimulusPresent: boolean
  readonly contrastPct: number
  readonly orientationDegrees: number | null
  readonly spatialFrequencyCyclesPerPatch: number | null
  readonly phaseDegrees: 0 | null
  readonly sigmaWavelengthRatio: 1 | null
  readonly flankers: GaborFlankerSpec | null
}

/** Resolve contrast from the live staircase only when the target is presented. */
export function resolveGaborPresentation(
  trial: GaborThresholdTrial,
  liveContrastPct: number,
): GaborResolvedPresentation {
  const live = clampContrast(liveContrastPct)
  const contrastPct = trial.contrastRule === 'blank'
    ? 0
    : trial.contrastRule === 'fixed'
      ? trial.fixedContrastPct!
      : trial.contrastRule === 'easy-live'
        ? Math.min(100, Math.max(50, live * 2))
        : trial.contrastRule === 'transfer-live'
          ? Math.min(100, Math.max(30, live * 1.5))
          : live
  return {
    trial,
    stimulusPresent: trial.stimulusPresent,
    contrastPct,
    orientationDegrees: trial.orientationDegrees,
    spatialFrequencyCyclesPerPatch: trial.spatialFrequencyCyclesPerPatch,
    phaseDegrees: trial.phaseDegrees,
    sigmaWavelengthRatio: trial.sigmaWavelengthRatio,
    flankers: trial.flankers,
  }
}

export type GaborPresentationResponse =
  | { readonly type: 'orientation'; readonly orientationDegrees: number }
  | { readonly type: 'no-pattern' }
  | { readonly type: 'timeout' }

export interface GaborClassifiedResponse {
  readonly correct: boolean
  readonly falseAlarm: boolean
  readonly lapse: boolean
  readonly staircaseResponse: 'correct' | 'incorrect' | null
}

/** The catch/no-pattern binding matrix, shared by localization and measurement. */
export function classifyGaborResponse(
  presentation: GaborResolvedPresentation,
  response: GaborPresentationResponse,
): GaborClassifiedResponse {
  if (response.type === 'timeout') {
    return { correct: false, falseAlarm: false, lapse: true, staircaseResponse: null }
  }
  if (!presentation.stimulusPresent) {
    const correct = response.type === 'no-pattern'
    return {
      correct,
      falseAlarm: !correct,
      lapse: false,
      staircaseResponse: null,
    }
  }
  const correct = response.type === 'orientation'
    && response.orientationDegrees === presentation.orientationDegrees
  return {
    correct,
    falseAlarm: false,
    lapse: false,
    staircaseResponse: correct ? 'correct' : 'incorrect',
  }
}

export type GaborStopReason = 'valid' | 'measurement-cap' | 'exposure-cap' | 'time-cap'

/** Exact production stop order: valid, measurement, exposure, then time. */
export function resolveGaborStopReason(input: {
  readonly thresholdCompleted: boolean
  readonly measurementResponses: number
  readonly measurementResponseCap: number
  readonly scheduledExposures: number
  readonly scheduledExposureCap: number
  readonly totalExposures: number
  readonly sessionExposureCap: number
  readonly timeCapReached: boolean
}): GaborStopReason | null {
  if (input.thresholdCompleted) return 'valid'
  if (input.measurementResponses >= input.measurementResponseCap) return 'measurement-cap'
  if (input.scheduledExposures >= input.scheduledExposureCap
    || input.totalExposures >= input.sessionExposureCap) return 'exposure-cap'
  if (input.timeCapReached) return 'time-cap'
  return null
}

export function gaborStopFlags(reason: GaborStopReason): {
  readonly stopValid: number
  readonly stopMeasurementCap: number
  readonly stopExposureCap: number
  readonly stopTimeCap: number
} {
  return {
    stopValid: Number(reason === 'valid'),
    stopMeasurementCap: Number(reason === 'measurement-cap'),
    stopExposureCap: Number(reason === 'exposure-cap'),
    stopTimeCap: Number(reason === 'time-cap'),
  }
}

export interface GaborProductionCounters {
  readonly trials: number
  readonly correctResponses: number
  readonly measurementCorrect: number
  readonly localizationExposures: number
  readonly scheduledExposures: number
  readonly easyTrials: number
  readonly transferTrials: number
  readonly flankerTrials: number
  readonly catchTrials: number
  readonly catchFalseAlarms: number
  readonly lapses: number
  readonly consecutiveLapses: number
}

export interface GaborProductionMetrics {
  readonly [metric: string]: number
  readonly trials: number
  readonly accuracyPct: number
  readonly measurementAccuracyPct: number
  readonly totalExposures: number
  readonly localizationExposures: number
  readonly scheduledExposures: number
  readonly measurementResponses: number
  readonly adaptiveTrials: number
  readonly reversals: number
  readonly thresholdValid: number
  readonly easyTrials: number
  readonly transferTrials: number
  readonly flankerTrials: number
  readonly catchTrials: number
  readonly catchFalseAlarms: number
  readonly lapses: number
  readonly warmStarted: number
  readonly protocolVersion: number
  readonly anchorSpatialFrequencyCyclesPerPatch: number
  readonly stopValid: number
  readonly stopMeasurementCap: number
  readonly stopExposureCap: number
  readonly stopTimeCap: number
}

export interface GaborProductionProgress {
  readonly [metric: string]: number
  readonly trials: number
  readonly accuracyPct: number
  readonly totalExposures: number
  readonly localizationExposures: number
  readonly scheduledExposures: number
  readonly measurementResponses: number
  readonly adaptiveTrials: number
  readonly reversals: number
  readonly catchFalseAlarms: number
  readonly lapses: number
}

export interface GaborPendingPresentation {
  readonly stage: 'localization' | 'measurement'
  readonly exposureIndex: number
  readonly presentation: GaborResolvedPresentation
}

export interface GaborProductionTerminal {
  readonly reason: GaborStopReason
  readonly metrics: GaborProductionMetrics
  readonly scorePct: number
}

interface GaborBlockCursor {
  readonly blockIndex: number
  readonly trials: readonly GaborThresholdTrial[]
  readonly nextOffset: number
}

export interface GaborProductionCoordinator {
  readonly protocol: typeof GABOR_THRESHOLD_PROTOCOL.id
  readonly seed: string | number
  readonly mode: GaborThresholdSessionStart['mode']
  readonly fallbackReason: GaborThresholdSessionStart['fallbackReason']
  readonly measurementResponseCap: number
  readonly scheduledExposureCap: number
  readonly sessionExposureCap: number
  readonly localization: GaborLocalizationState | null
  readonly measurement: GaborThresholdState | null
  readonly blockCursor: GaborBlockCursor | null
  readonly pending: GaborPendingPresentation | null
  readonly responseLocked: boolean
  readonly counters: GaborProductionCounters
  readonly lastResponse: GaborClassifiedResponse | null
  readonly terminal: GaborProductionTerminal | null
}

export interface GaborProductionCoordinatorOptions {
  readonly seed: string | number
  readonly prior?: GaborThresholdPrior | null
}

export interface GaborPresentOptions {
  readonly timeCapReached: boolean
  /** Test seam used only when the next ten-exposure block is first built. */
  readonly selectionRandom?: () => number
}

export interface GaborApplyResponseOptions {
  readonly timeCapReached: boolean
}

/** Create the one production authority for cold or compatible warm sessions. */
export function createGaborProductionCoordinator({
  seed,
  prior = null,
}: GaborProductionCoordinatorOptions): GaborProductionCoordinator {
  const session = prepareGaborThresholdSession(prior)
  return {
    protocol: GABOR_THRESHOLD_PROTOCOL.id,
    seed,
    mode: session.mode,
    fallbackReason: session.fallbackReason,
    measurementResponseCap: session.measurementResponseCap,
    scheduledExposureCap: session.scheduledExposureCap,
    sessionExposureCap: session.sessionExposureCap,
    localization: session.localization,
    measurement: session.measurement,
    blockCursor: null,
    pending: null,
    responseLocked: true,
    counters: emptyProductionCounters(),
    lastResponse: null,
    terminal: null,
  }
}

/**
 * Present exactly one next exposure, or lock the terminal snapshot. A pending
 * exposure is an invariant: without a time-cap signal this is an exact no-op.
 */
export function presentNextGaborExposure(
  coordinator: GaborProductionCoordinator,
  options: GaborPresentOptions,
): GaborProductionCoordinator {
  if (coordinator.terminal) return coordinator

  const stopped = stopGaborCoordinatorIfNeeded(coordinator, options.timeCapReached)
  if (stopped !== coordinator) return stopped
  if (coordinator.pending) return coordinator

  if (coordinator.localization
    && coordinator.localization.responses < GABOR_THRESHOLD_PROTOCOL.localizationResponses) {
    const exposureIndex = coordinator.counters.localizationExposures
    const trial = buildGaborLocalizationTrial(coordinator.seed, exposureIndex)
    return {
      ...coordinator,
      pending: {
        stage: 'localization',
        exposureIndex,
        presentation: resolveGaborPresentation(trial, coordinator.localization.contrastPct),
      },
      responseLocked: false,
      counters: {
        ...coordinator.counters,
        localizationExposures: exposureIndex + 1,
      },
      lastResponse: null,
    }
  }

  const measurement = coordinator.measurement
  if (!measurement) throw new Error('Gabor measurement cannot start before localization is complete.')

  const scheduledExposureIndex = coordinator.counters.scheduledExposures
  const requestedBlockIndex = Math.floor(scheduledExposureIndex / 10)
  const cursor = coordinator.blockCursor?.blockIndex === requestedBlockIndex
    && coordinator.blockCursor.nextOffset < coordinator.blockCursor.trials.length
    ? coordinator.blockCursor
    : {
        blockIndex: requestedBlockIndex,
        trials: buildGaborThresholdBlock({
          seed: coordinator.seed,
          blockIndex: requestedBlockIndex,
          selectionRandom: options.selectionRandom,
        }),
        nextOffset: 0,
      }
  const trial = cursor.trials[cursor.nextOffset]
  const counters = incrementProductionKind({
    ...coordinator.counters,
    scheduledExposures: scheduledExposureIndex + 1,
  }, trial.kind)
  return {
    ...coordinator,
    blockCursor: { ...cursor, nextOffset: cursor.nextOffset + 1 },
    pending: {
      stage: 'measurement',
      exposureIndex: scheduledExposureIndex,
      presentation: resolveGaborPresentation(trial, measurement.contrastPct),
    },
    responseLocked: false,
    counters,
    lastResponse: null,
  }
}

/** Apply one response to the sole pending exposure. Duplicate calls are exact no-ops. */
export function applyGaborProductionResponse(
  coordinator: GaborProductionCoordinator,
  response: GaborPresentationResponse,
  options: GaborApplyResponseOptions,
): GaborProductionCoordinator {
  if (coordinator.terminal || !coordinator.pending || coordinator.responseLocked) return coordinator

  const classified = classifyGaborResponse(coordinator.pending.presentation, response)
  let localization = coordinator.localization
  let measurement = coordinator.measurement
  let counters: GaborProductionCounters = {
    ...coordinator.counters,
    trials: coordinator.counters.trials + 1,
    correctResponses: coordinator.counters.correctResponses + Number(classified.correct),
    catchFalseAlarms: coordinator.counters.catchFalseAlarms + Number(classified.falseAlarm),
    lapses: coordinator.counters.lapses + Number(classified.lapse),
    consecutiveLapses: classified.lapse ? coordinator.counters.consecutiveLapses + 1 : 0,
  }

  if (coordinator.pending.stage === 'localization') {
    if (localization && classified.staircaseResponse) {
      localization = updateGaborLocalization(localization, classified.staircaseResponse).state
      if (localization.responses === GABOR_THRESHOLD_PROTOCOL.localizationResponses) {
        measurement = startGaborMeasurementAfterLocalization(localization)
      }
    }
  } else if (coordinator.pending.presentation.trial.adaptive
    && classified.staircaseResponse
    && measurement) {
    measurement = updateGaborThreshold(measurement, {
      response: classified.staircaseResponse,
      adaptive: true,
    }).state
    if (classified.correct) {
      counters = { ...counters, measurementCorrect: counters.measurementCorrect + 1 }
    }
  }

  const responded: GaborProductionCoordinator = {
    ...coordinator,
    localization,
    measurement,
    pending: null,
    responseLocked: true,
    counters,
    lastResponse: classified,
  }
  return stopGaborCoordinatorIfNeeded(responded, options.timeCapReached)
}

export function getGaborProductionProgress(
  coordinator: GaborProductionCoordinator,
): GaborProductionProgress {
  const measurementResponses = coordinator.measurement?.adaptiveTrials ?? 0
  return {
    trials: coordinator.counters.trials,
    accuracyPct: percentage(coordinator.counters.correctResponses, coordinator.counters.trials),
    totalExposures: totalProductionExposures(coordinator),
    localizationExposures: coordinator.counters.localizationExposures,
    scheduledExposures: coordinator.counters.scheduledExposures,
    measurementResponses,
    adaptiveTrials: measurementResponses,
    reversals: coordinator.measurement?.reversalContrastsPct.length ?? 0,
    catchFalseAlarms: coordinator.counters.catchFalseAlarms,
    lapses: coordinator.counters.lapses,
  }
}

function stopGaborCoordinatorIfNeeded(
  coordinator: GaborProductionCoordinator,
  timeCapReached: boolean,
): GaborProductionCoordinator {
  const reason = resolveGaborStopReason({
    thresholdCompleted: coordinator.measurement?.completed ?? false,
    measurementResponses: coordinator.measurement?.adaptiveTrials ?? 0,
    measurementResponseCap: coordinator.measurementResponseCap,
    scheduledExposures: coordinator.counters.scheduledExposures,
    scheduledExposureCap: coordinator.scheduledExposureCap,
    totalExposures: totalProductionExposures(coordinator),
    sessionExposureCap: coordinator.sessionExposureCap,
    timeCapReached,
  })
  return reason ? terminalizeGaborCoordinator(coordinator, reason) : coordinator
}

function terminalizeGaborCoordinator(
  coordinator: GaborProductionCoordinator,
  reason: GaborStopReason,
): GaborProductionCoordinator {
  const estimate = coordinator.measurement
    ? getGaborThresholdEstimate(coordinator.measurement)
    : { valid: false as const }
  const progress = getGaborProductionProgress(coordinator)
  const measurementAccuracyPct = percentage(
    coordinator.counters.measurementCorrect,
    progress.measurementResponses,
  )
  const flags = gaborStopFlags(reason)
  const metrics: GaborProductionMetrics = {
    trials: coordinator.counters.trials,
    accuracyPct: progress.accuracyPct,
    measurementAccuracyPct,
    totalExposures: progress.totalExposures,
    localizationExposures: coordinator.counters.localizationExposures,
    scheduledExposures: coordinator.counters.scheduledExposures,
    measurementResponses: progress.measurementResponses,
    adaptiveTrials: progress.adaptiveTrials,
    reversals: progress.reversals,
    thresholdValid: Number(estimate.valid),
    ...(estimate.valid ? { contrastThresholdPct: estimate.contrastThresholdPct } : {}),
    easyTrials: coordinator.counters.easyTrials,
    transferTrials: coordinator.counters.transferTrials,
    flankerTrials: coordinator.counters.flankerTrials,
    catchTrials: coordinator.counters.catchTrials,
    catchFalseAlarms: coordinator.counters.catchFalseAlarms,
    lapses: coordinator.counters.lapses,
    warmStarted: Number(coordinator.mode === 'warm-start'),
    protocolVersion: 1,
    anchorSpatialFrequencyCyclesPerPatch: GABOR_THRESHOLD_PROTOCOL.anchorSpatialFrequencyCyclesPerPatch,
    stopValid: flags.stopValid,
    stopMeasurementCap: flags.stopMeasurementCap,
    stopExposureCap: flags.stopExposureCap,
    stopTimeCap: flags.stopTimeCap,
  }
  return {
    ...coordinator,
    pending: null,
    responseLocked: true,
    terminal: {
      reason,
      metrics,
      scorePct: progress.accuracyPct,
    },
  }
}

function emptyProductionCounters(): GaborProductionCounters {
  return {
    trials: 0,
    correctResponses: 0,
    measurementCorrect: 0,
    localizationExposures: 0,
    scheduledExposures: 0,
    easyTrials: 0,
    transferTrials: 0,
    flankerTrials: 0,
    catchTrials: 0,
    catchFalseAlarms: 0,
    lapses: 0,
    consecutiveLapses: 0,
  }
}

function incrementProductionKind(
  counters: GaborProductionCounters,
  kind: GaborTrialKind,
): GaborProductionCounters {
  if (kind === 'anchor') return counters
  const field = kind === 'easy'
    ? 'easyTrials'
    : kind === 'transfer'
      ? 'transferTrials'
      : kind === 'flanker'
        ? 'flankerTrials'
        : 'catchTrials'
  return { ...counters, [field]: counters[field] + 1 }
}

function totalProductionExposures(coordinator: GaborProductionCoordinator): number {
  return coordinator.counters.localizationExposures + coordinator.counters.scheduledExposures
}

function percentage(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0
}

function stimulusTrial({
  id,
  kind,
  condition,
  adaptive,
  contrastRule,
  fixedContrastPct = null,
  orientationDegrees,
  spatialFrequencyCyclesPerPatch,
  flankers = null,
}: {
  readonly id: string
  readonly kind: Exclude<GaborTrialKind, 'catch'>
  readonly condition: Exclude<GaborTrialCondition, 'blank-catch'>
  readonly adaptive: boolean
  readonly contrastRule: Exclude<GaborThresholdTrial['contrastRule'], 'blank'>
  readonly fixedContrastPct?: number | null
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
    contrastRule,
    fixedContrastPct,
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
    contrastRule: 'blank',
    fixedContrastPct: null,
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

/**
 * Preserve the ratified Fisher-Yates order while consuming one scheduler draw
 * for every member of the ten-exposure block. Fisher-Yates needs nine draws to
 * determine the order; the final draw accounts for the sole remaining member.
 */
function shuffleGaborBlock<T>(values: T[], seed: string, injectedRandom?: () => number): T[] {
  const random = injectedRandom ?? mulberry32(fnv1a32(seed))
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[values[index], values[swapIndex]] = [values[swapIndex], values[index]]
  }
  if (values.length > 0) random()
  return values
}

function orderWithOneSelectionDrawPerTrial<T>(values: T[], seed: string): T[] {
  const random = mulberry32(fnv1a32(seed))
  return values
    .map((value, naturalIndex) => ({ value, naturalIndex, selectionDraw: random() }))
    .sort((a, b) => a.selectionDraw - b.selectionDraw || a.naturalIndex - b.naturalIndex)
    .map(({ value }) => value)
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
