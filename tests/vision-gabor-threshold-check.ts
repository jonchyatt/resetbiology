import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  GABOR_3_DOWN_1_UP_TARGET_CORRECT,
  GABOR_EASY_PREVIEW_POLICY,
  GABOR_ORIENTATIONS_DEGREES,
  GABOR_THRESHOLD_PROTOCOL,
  GABOR_THRESHOLD_RENDER_CONFIG,
  buildGaborLocalizationTrial,
  buildGaborEasyPreview,
  buildGaborThresholdBlock,
  applyGaborEasyPreviewResponse,
  applyGaborProductionResponse,
  classifyGaborResponse,
  createGaborEasyPreviewCoordinator,
  createGaborProductionCoordinator,
  createGaborLocalizationState,
  createGaborThresholdState,
  getGaborLocalizationEstimate,
  getGaborThresholdEstimate,
  prepareGaborThresholdSession,
  gaborStopFlags,
  getGaborProductionProgress,
  presentNextGaborEasyPreview,
  presentNextGaborExposure,
  resolveGaborPresentation,
  resolveGaborStopReason,
  startGaborMeasurementAfterLocalization,
  updateGaborLocalization,
  updateGaborThreshold,
  type GaborThresholdPrior,
  type GaborEasyPreviewCoordinator,
  type GaborPresentationResponse,
  type GaborProductionCoordinator,
  type GaborThresholdState,
} from '../src/lib/vision/gaborThreshold'

function close(actual: number, expected: number, tolerance: number, message: string): void {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, received ${actual}`)
}

function count<T extends string | number>(values: readonly T[]): Map<T, number> {
  const counts = new Map<T, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return counts
}

function median(values: readonly number[]): number {
  assert.ok(values.length > 0, 'median needs data')
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function medianAbsoluteLog10Error(estimates: readonly number[], truth: number): number {
  return median(estimates.map((estimate) => Math.abs(Math.log10(estimate / truth))))
}

// A 3-down/1-up transformed rule converges where p^3 = 1/2.
close(GABOR_3_DOWN_1_UP_TARGET_CORRECT, 0.793700526, 1e-9, '3-down/1-up target')
close(Math.pow(GABOR_3_DOWN_1_UP_TARGET_CORRECT, 3), 0.5, 1e-12, 'target satisfies p^3 = 0.5')

// State starts and clamps only at the declared Michelson-contrast limits.
assert.equal(createGaborThresholdState().contrastPct, 50)
assert.equal(createGaborThresholdState(-10).contrastPct, 0.5)
assert.equal(createGaborThresholdState(200).contrastPct, 100)
assert.throws(() => createGaborThresholdState(Number.NaN), /finite number/)

let state = createGaborThresholdState()
state = updateGaborThreshold(state, { response: 'correct', adaptive: true }).state
state = updateGaborThreshold(state, { response: 'correct', adaptive: true }).state
const firstDown = updateGaborThreshold(state, { response: 'correct', adaptive: true })
assert.equal(firstDown.effectiveDirection, -1)
assert.equal(firstDown.stepLog10, 0.15)
assert.equal(firstDown.state.reversalContrastsPct.length, 0, 'first effective direction is not a reversal')

const firstUp = updateGaborThreshold(firstDown.state, { response: 'incorrect', adaptive: true })
assert.equal(firstUp.effectiveDirection, 1)
assert.equal(firstUp.reversalContrastPct, firstDown.state.contrastPct, 'reversal records presented pre-step contrast')
assert.equal(firstUp.state.reversalContrastsPct[0], firstDown.state.contrastPct)

state = firstUp.state
for (let index = 0; index < 2; index += 1) {
  state = updateGaborThreshold(state, { response: 'correct', adaptive: true }).state
}
const secondDown = updateGaborThreshold(state, { response: 'correct', adaptive: true })
assert.equal(secondDown.state.reversalContrastsPct.length, 2)
assert.equal(secondDown.stepLog10, 0.15, 'the step that establishes reversal two is still coarse')
const fineUp = updateGaborThreshold(secondDown.state, { response: 'incorrect', adaptive: true })
assert.equal(fineUp.stepLog10, 0.075, 'steps after reversal two use the fine log step')

for (const ignored of [
  { response: 'timeout', adaptive: true },
  { response: 'lapse', adaptive: true },
  { response: 'incorrect', adaptive: false },
] as const) {
  const before = fineUp.state
  const transition = updateGaborThreshold(before, ignored)
  assert.equal(transition.acceptedForStaircase, false)
  assert.equal(transition.state, before, `${ignored.response}/${ignored.adaptive} must preserve state identity`)
}

let lowerBound = createGaborThresholdState(0.5)
for (let index = 0; index < 2; index += 1) {
  lowerBound = updateGaborThreshold(lowerBound, { response: 'correct', adaptive: true }).state
}
const lowerClamp = updateGaborThreshold(lowerBound, { response: 'correct', adaptive: true })
assert.equal(lowerClamp.requestedDirection, -1)
assert.equal(lowerClamp.effectiveDirection, 0)
assert.equal(lowerClamp.state.contrastPct, 0.5)
assert.equal(lowerClamp.state.lastEffectiveDirection, null)
assert.deepEqual(lowerClamp.state.reversalContrastsPct, [])

const upperClamp = updateGaborThreshold(createGaborThresholdState(100), { response: 'incorrect', adaptive: true })
assert.equal(upperClamp.requestedDirection, 1)
assert.equal(upperClamp.effectiveDirection, 0)
assert.equal(upperClamp.state.contrastPct, 100)
assert.equal(upperClamp.state.lastEffectiveDirection, null)
assert.deepEqual(upperClamp.state.reversalContrastsPct, [])

// First-run localization is a sealed 12-response 1-down/1-up pass. It accepts
// every response category, estimates only from the final four presented
// contrasts, and hands a fresh state to the unchanged measurement controller.
const localizationStart = createGaborLocalizationState()
assert.equal(localizationStart.contrastPct, 50)
assert.equal(localizationStart.responses, 0)
assert.equal('adaptiveTrials' in localizationStart, false)
assert.deepEqual(getGaborLocalizationEstimate(localizationStart), {
  valid: false,
  reason: 'localization-incomplete',
})

for (const response of ['incorrect', 'timeout', 'lapse'] as const) {
  const brighter = updateGaborLocalization(localizationStart, response)
  assert.ok(brighter.state.contrastPct > localizationStart.contrastPct, `${response} localizes brighter`)
}
assert.ok(
  updateGaborLocalization(localizationStart, 'correct').state.contrastPct < localizationStart.contrastPct,
  'correct localization response moves darker',
)

let allCorrectLocalization = createGaborLocalizationState()
let allIncorrectLocalization = createGaborLocalizationState()
for (let index = 0; index < GABOR_THRESHOLD_PROTOCOL.localizationResponses; index += 1) {
  allCorrectLocalization = updateGaborLocalization(allCorrectLocalization, 'correct').state
  allIncorrectLocalization = updateGaborLocalization(allIncorrectLocalization, 'incorrect').state
}
assert.equal(allCorrectLocalization.contrastPct, 0.5, 'all-correct localization clamps at the dark bound')
assert.equal(allIncorrectLocalization.contrastPct, 100, 'all-incorrect localization clamps at the bright bound')
assert.equal(allCorrectLocalization.responses, 12)
assert.equal(allCorrectLocalization.presentedContrastsPct.length, 12)
const thirteenth = updateGaborLocalization(allCorrectLocalization, 'incorrect')
assert.equal(thirteenth.accepted, false)
assert.equal(thirteenth.state, allCorrectLocalization, 'localization accepts exactly twelve responses')

const localizedEstimate = getGaborLocalizationEstimate(allCorrectLocalization)
assert.equal(localizedEstimate.valid, true)
if (localizedEstimate.valid) {
  const expected = Math.pow(
    localizedEstimate.presentedContrastsPct.reduce((product, contrast) => product * contrast, 1),
    1 / 4,
  )
  close(localizedEstimate.contrastPct, expected, 1e-12, 'localization uses final-four geometric mean')
  assert.deepEqual(localizedEstimate.presentedContrastsPct, allCorrectLocalization.presentedContrastsPct.slice(-4))
}

const measurementAfterLocalization = startGaborMeasurementAfterLocalization(allCorrectLocalization)
const allCorrectEstimate = getGaborLocalizationEstimate(allCorrectLocalization)
assert.equal(allCorrectEstimate.valid, true)
if (allCorrectEstimate.valid) {
  close(
    measurementAfterLocalization.contrastPct,
    Math.min(100, Math.max(0.5, allCorrectEstimate.contrastPct * Math.pow(10, 0.2))),
    1e-12,
    'localized measurement start',
  )
}
assert.equal(measurementAfterLocalization.adaptiveTrials, 0)
assert.equal(measurementAfterLocalization.consecutiveCorrect, 0)
assert.equal(measurementAfterLocalization.lastEffectiveDirection, null)
assert.deepEqual(measurementAfterLocalization.reversalContrastsPct, [])
assert.equal(measurementAfterLocalization.completed, false)
assert.equal(measurementAfterLocalization.lockedThresholdPct, null)
assert.deepEqual(getGaborThresholdEstimate(measurementAfterLocalization), {
  valid: false,
  reason: 'too-few-adaptive-trials',
})
assert.equal(GABOR_THRESHOLD_PROTOCOL.localizationResponses, 12)
assert.equal(GABOR_THRESHOLD_PROTOCOL.coldMeasurementResponseCap, 48)
assert.equal(GABOR_THRESHOLD_PROTOCOL.warmMeasurementResponseCap, 60)
assert.equal(GABOR_THRESHOLD_PROTOCOL.coldScheduledExposureCap, 88)
assert.equal(GABOR_THRESHOLD_PROTOCOL.warmScheduledExposureCap, 100)
// Foreman amendment: the frozen 60-total-exposure production composition
// failed its 216/240 validity gate; the unchanged frozen bank passed at 100.
assert.equal(GABOR_THRESHOLD_PROTOCOL.sessionExposureCap, 100)

const compatiblePrior: GaborThresholdPrior = {
  valid: true,
  stale: false,
  protocol: GABOR_THRESHOLD_PROTOCOL.id,
  contrastThresholdPct: 10,
  renderConfig: { ...GABOR_THRESHOLD_RENDER_CONFIG },
}
const warmStart = prepareGaborThresholdSession(compatiblePrior)
assert.equal(warmStart.mode, 'warm-start')
if (warmStart.mode === 'warm-start') {
  close(warmStart.measurement.contrastPct, 10 * Math.pow(10, 0.1), 1e-12, 'warm-start offset')
  assert.equal(warmStart.measurementResponseCap, 60)
  assert.equal(warmStart.scheduledExposureCap, 100)
  assert.equal(warmStart.sessionExposureCap, 100)
  assert.equal(warmStart.measurement.adaptiveTrials, 0)
  assert.equal(warmStart.measurement.consecutiveCorrect, 0)
  assert.equal(warmStart.measurement.lastEffectiveDirection, null)
  assert.deepEqual(warmStart.measurement.reversalContrastsPct, [])
  assert.equal(warmStart.measurement.completed, false)
  assert.equal(warmStart.measurement.lockedThresholdPct, null)
}

for (const [prior, reason] of [
  [null, 'missing'],
  [{ ...compatiblePrior, valid: false }, 'invalid'],
  [{ ...compatiblePrior, contrastThresholdPct: Number.NaN }, 'invalid'],
  [{ ...compatiblePrior, contrastThresholdPct: 0.49 }, 'invalid'],
  [{ ...compatiblePrior, stale: true }, 'stale'],
  [{ ...compatiblePrior, protocol: 'GABOR_THRESHOLD_V0' }, 'protocol-mismatch'],
  [{ ...compatiblePrior, renderConfig: { ...compatiblePrior.renderConfig, phaseDegrees: 90 } }, 'render-mismatch'],
] as const) {
  const fallback = prepareGaborThresholdSession(prior)
  assert.equal(fallback.mode, 'localization')
  assert.equal(fallback.fallbackReason, reason)
  assert.equal(fallback.measurement, null)
  assert.equal(fallback.measurementResponseCap, 48)
  assert.equal(fallback.scheduledExposureCap, 88)
  assert.equal(fallback.sessionExposureCap, 100)
  assert.deepEqual(fallback.localization, createGaborLocalizationState())
}

// A threshold is never invented before both gates, and is the geometric mean
// of exactly the six post-burn-in reversals when both gates pass.
const reversalFixture = [80, 60, 40, 20, 10, 5, 2.5, 1.25]
const tooEarly: GaborThresholdState = {
  ...createGaborThresholdState(),
  adaptiveTrials: 23,
  reversalContrastsPct: reversalFixture,
}
const tooFewReversals: GaborThresholdState = {
  ...createGaborThresholdState(),
  adaptiveTrials: 60,
  reversalContrastsPct: reversalFixture.slice(0, 7),
}
assert.deepEqual(getGaborThresholdEstimate(tooEarly), { valid: false, reason: 'too-few-adaptive-trials' })
assert.deepEqual(getGaborThresholdEstimate(tooFewReversals), { valid: false, reason: 'too-few-reversals' })
assert.equal('contrastThresholdPct' in getGaborThresholdEstimate(tooEarly), false)

const thresholdFixtureValue = Math.pow(40 * 20 * 10 * 5 * 2.5 * 1.25, 1 / 6)
const thresholdFixture: GaborThresholdState = {
  ...createGaborThresholdState(),
  adaptiveTrials: 24,
  reversalContrastsPct: reversalFixture,
  completed: true,
  lockedThresholdPct: thresholdFixtureValue,
}
const fixtureEstimate = getGaborThresholdEstimate(thresholdFixture)
assert.equal(fixtureEstimate.valid, true)
if (fixtureEstimate.valid) {
  close(fixtureEstimate.contrastThresholdPct, thresholdFixtureValue, 1e-12, 'public result returns locked threshold')
  assert.deepEqual(fixtureEstimate.reversalContrastsPct, reversalFixture.slice(2))
}

const unlockedEligibleFixture: GaborThresholdState = {
  ...createGaborThresholdState(),
  adaptiveTrials: 24,
  reversalContrastsPct: reversalFixture,
}
assert.deepEqual(getGaborThresholdEstimate(unlockedEligibleFixture), {
  valid: false,
  reason: 'threshold-not-locked',
}, 'public result never computes an unlocked threshold')

// Reach the production terminal through the public updater. CCC-I repeats
// establish eleven real reversals by response 24, so completion and the
// adaptive-trial minimum arrive on the same accepted response.
let productionTerminal = createGaborThresholdState()
let firstValidResponseIndex = 0
while (!productionTerminal.completed && firstValidResponseIndex < 60) {
  const response = firstValidResponseIndex % 4 === 3 ? 'incorrect' : 'correct'
  firstValidResponseIndex += 1
  productionTerminal = updateGaborThreshold(productionTerminal, { response, adaptive: true }).state
}
assert.equal(firstValidResponseIndex, 24)
assert.equal(productionTerminal.adaptiveTrials, 24)
assert.equal(productionTerminal.reversalContrastsPct.length, 11)
assert.equal(productionTerminal.completed, true)
assert.notEqual(productionTerminal.lockedThresholdPct, null)

const terminalEstimate = getGaborThresholdEstimate(productionTerminal)
assert.equal(terminalEstimate.valid, true)
if (terminalEstimate.valid) {
  const actualReversalsSixThroughEleven = productionTerminal.reversalContrastsPct.slice(5)
  const rejectedReversalsThreeThroughEight = productionTerminal.reversalContrastsPct.slice(2, 8)
  assert.deepEqual(
    terminalEstimate.reversalContrastsPct,
    actualReversalsSixThroughEleven,
    'the locked estimate uses actual reversals 6-11, not frozen reversals 3-8',
  )
  close(
    terminalEstimate.contrastThresholdPct,
    Math.pow(actualReversalsSixThroughEleven.reduce((product, value) => product * value, 1), 1 / 6),
    1e-12,
    'production terminal locks the final six usable reversals',
  )
  assert.equal(terminalEstimate.contrastThresholdPct, productionTerminal.lockedThresholdPct)
  assert.notEqual(
    terminalEstimate.contrastThresholdPct,
    Math.pow(rejectedReversalsThreeThroughEight.reduce((product, value) => product * value, 1), 1 / 6),
    'asymmetric fixture distinguishes latest-six from first-six formulas',
  )
}

const terminalSnapshot = structuredClone(productionTerminal)
const lockedThresholdPct = productionTerminal.lockedThresholdPct
for (const [label, observation] of [
  ['adaptive correct', { response: 'correct', adaptive: true }],
  ['adaptive incorrect', { response: 'incorrect', adaptive: true }],
  ['adaptive lapse', { response: 'lapse', adaptive: true }],
  ['adaptive timeout', { response: 'timeout', adaptive: true }],
  ['easy nonadaptive', { response: 'incorrect', adaptive: false }],
  ['transfer nonadaptive', { response: 'correct', adaptive: false }],
  ['flanker nonadaptive', { response: 'incorrect', adaptive: false }],
  ['catch nonadaptive', { response: 'incorrect', adaptive: false }],
] as const) {
  const transition = updateGaborThreshold(productionTerminal, observation)
  assert.equal(transition.acceptedForStaircase, false, `${label} is rejected after completion`)
  assert.equal(transition.state, productionTerminal, `${label} preserves exact state identity`)
  assert.deepEqual(transition.state, terminalSnapshot, `${label} leaves every terminal field unchanged`)
  assert.equal(getGaborThresholdEstimate(transition.state).valid, true)
  assert.equal(transition.state.lockedThresholdPct, lockedThresholdPct)
}

for (let remaining = firstValidResponseIndex; remaining < 48; remaining += 1) {
  const transition = updateGaborThreshold(productionTerminal, {
    response: remaining % 2 ? 'correct' : 'incorrect',
    adaptive: true,
  })
  assert.equal(transition.acceptedForStaircase, false)
  assert.equal(transition.state, productionTerminal)
}
assert.deepEqual(productionTerminal, terminalSnapshot, 'feeding the remaining response budget cannot move the lock')

const asymmetricEstimateFixture = [5, 10, 40]
const correctMedianPerRunError = medianAbsoluteLog10Error(asymmetricEstimateFixture, 10)
const rejectedErrorOfMedian = Math.abs(Math.log10(median(asymmetricEstimateFixture) / 10))
close(correctMedianPerRunError, Math.log10(2), 1e-12, 'bank error is the median per-run absolute log error')
assert.equal(rejectedErrorOfMedian, 0)
assert.notEqual(correctMedianPerRunError, rejectedErrorOfMedian, 'error-of-median substitution is detectably different')

// The seeded therapeutic block has one and only one declared composition.
const block = buildGaborThresholdBlock({ seed: 'p1-a1-proof', blockIndex: 0 })
assert.equal(block.length, 10)
assert.deepEqual(
  Object.fromEntries(count(block.map((trial) => trial.kind))),
  { anchor: 6, easy: 1, transfer: 1, flanker: 1, catch: 1 },
)
assert.deepEqual(
  block,
  buildGaborThresholdBlock({ seed: 'p1-a1-proof', blockIndex: 0 }),
  'same seed produces the same schedule',
)
assert.notDeepEqual(
  block.map((trial) => trial.id),
  buildGaborThresholdBlock({ seed: 'different-seed', blockIndex: 0 }).map((trial) => trial.id),
  'different seeds produce a different seeded order',
)

const anchors = block.filter((trial) => trial.kind === 'anchor')
assert.equal(anchors.length, 6)
for (const trial of anchors) {
  assert.equal(trial.adaptive, true)
  assert.equal(trial.thresholdEligible, true)
  assert.equal(trial.spatialFrequencyCyclesPerPatch, 7)
  assert.equal(trial.phaseDegrees, 0)
  assert.equal(trial.sigmaWavelengthRatio, 1)
  assert.equal(trial.flankers, null)
}
const easy = block.find((trial) => trial.kind === 'easy')!
const transfer = block.find((trial) => trial.kind === 'transfer')!
const flanker = block.find((trial) => trial.kind === 'flanker')!
const catchTrial = block.find((trial) => trial.kind === 'catch')!
assert.equal(resolveGaborPresentation(easy, 20).contrastPct, 50, 'easy contrast resolves as min(100,max(50,2x live))')
assert.equal(resolveGaborPresentation(transfer, 20).contrastPct, 30, 'transfer contrast resolves as min(100,max(30,1.5x live))')
assert.equal(resolveGaborPresentation(anchors[0], 20).contrastPct, 20, 'anchor resolves the live contrast at presentation')
assert.equal(resolveGaborPresentation(flanker, 20).contrastPct, 20, 'flanker center resolves the live contrast at presentation')
assert.equal(flanker.adaptive, false)
assert.equal(flanker.thresholdEligible, false)
assert.equal(flanker.flankers?.centerOffsetWavelengths, 3)
assert.equal(flanker.flankers?.contrastPct, 60)
assert.equal(flanker.flankers?.orientationDegrees, flanker.orientationDegrees)
assert.equal(flanker.flankers?.spatialFrequencyCyclesPerPatch, flanker.spatialFrequencyCyclesPerPatch)
assert.equal(flanker.flankers?.phaseDegrees, flanker.phaseDegrees)
assert.equal(catchTrial.stimulusPresent, false)
assert.equal(catchTrial.falseAlarmOnAnyChoice, true)
assert.equal(catchTrial.responseSemantics, 'any-choice-is-false-alarm')
assert.equal(catchTrial.adaptive, false)
assert.equal(catchTrial.thresholdEligible, false)

const catchPresentation = resolveGaborPresentation(catchTrial, 20)
assert.deepEqual(classifyGaborResponse(catchPresentation, { type: 'orientation', orientationDegrees: 0 }), {
  correct: false,
  falseAlarm: true,
  lapse: false,
  staircaseResponse: null,
})
assert.deepEqual(classifyGaborResponse(catchPresentation, { type: 'no-pattern' }), {
  correct: true,
  falseAlarm: false,
  lapse: false,
  staircaseResponse: null,
})
assert.deepEqual(classifyGaborResponse(catchPresentation, { type: 'timeout' }), {
  correct: false,
  falseAlarm: false,
  lapse: true,
  staircaseResponse: null,
})
const anchorPresentation = resolveGaborPresentation(anchors[0], 20)
assert.equal(classifyGaborResponse(anchorPresentation, { type: 'no-pattern' }).staircaseResponse, 'incorrect')
assert.equal(classifyGaborResponse(anchorPresentation, { type: 'timeout' }).staircaseResponse, null)
assert.equal(
  classifyGaborResponse(anchorPresentation, { type: 'orientation', orientationDegrees: anchorPresentation.orientationDegrees! }).staircaseResponse,
  'correct',
)

const allStops = {
  thresholdCompleted: true,
  measurementResponses: 48,
  measurementResponseCap: 48,
  scheduledExposures: 88,
  scheduledExposureCap: 88,
  totalExposures: 100,
  sessionExposureCap: 100,
  timeCapReached: true,
}
assert.equal(resolveGaborStopReason(allStops), 'valid', 'validity wins the exact stop order')
assert.equal(resolveGaborStopReason({ ...allStops, thresholdCompleted: false }), 'measurement-cap')
assert.equal(resolveGaborStopReason({ ...allStops, thresholdCompleted: false, measurementResponses: 47 }), 'exposure-cap')
assert.equal(resolveGaborStopReason({
  ...allStops,
  thresholdCompleted: false,
  measurementResponses: 47,
  scheduledExposures: 87,
  totalExposures: 99,
}), 'time-cap')
for (const reason of ['valid', 'measurement-cap', 'exposure-cap', 'time-cap'] as const) {
  assert.equal(Object.values(gaborStopFlags(reason)).reduce((sum, flag) => sum + flag, 0), 1, `${reason} is one-hot`)
}

const sequentialPrefix = Array.from({ length: 23 }, (_, exposureIndex) => {
  const scheduledBlock = buildGaborThresholdBlock({
    seed: 'sequential-prefix',
    blockIndex: Math.floor(exposureIndex / 10),
  })
  return scheduledBlock[exposureIndex % 10].id
})
assert.deepEqual(
  sequentialPrefix.slice(0, 10),
  buildGaborThresholdBlock({ seed: 'sequential-prefix', blockIndex: 0 }).map((trial) => trial.id),
  'the consumed schedule is the exact returned order',
)
assert.deepEqual(
  sequentialPrefix.slice(20),
  buildGaborThresholdBlock({ seed: 'sequential-prefix', blockIndex: 2 }).slice(0, 3).map((trial) => trial.id),
  'a partial final block is its natural prefix with no reroll',
)
const localizationOrientations = Array.from({ length: 12 }, (_, exposureIndex) =>
  buildGaborLocalizationTrial('localization-balance', exposureIndex).orientationDegrees!)
for (const orientation of GABOR_ORIENTATIONS_DEGREES) {
  assert.equal(count(localizationOrientations).get(orientation), 3)
}

const highContrastBlock = buildGaborThresholdBlock({ seed: 42, blockIndex: 0 })
assert.equal(resolveGaborPresentation(highContrastBlock.find((trial) => trial.kind === 'easy')!, 80).contrastPct, 100)
assert.equal(resolveGaborPresentation(highContrastBlock.find((trial) => trial.kind === 'transfer')!, 80).contrastPct, 100)

// Adaptive anchors, transfer frequencies, and their orientations use separate
// balanced bags, so adding one condition cannot perturb another condition.
const fourBlocks = Array.from({ length: 4 }, (_, blockIndex) =>
  buildGaborThresholdBlock({ seed: 'balance-proof', blockIndex }),
)
const anchorOrientations = fourBlocks.flatMap((scheduled) => scheduled
  .filter((trial) => trial.kind === 'anchor')
  .map((trial) => trial.orientationDegrees!))
const anchorOrientationCounts = count(anchorOrientations)
for (const orientation of GABOR_ORIENTATIONS_DEGREES) {
  assert.equal(anchorOrientationCounts.get(orientation), 6, `anchor orientation ${orientation} is balanced`)
}
const transferTrials = fourBlocks.flatMap((scheduled) => scheduled.filter((trial) => trial.kind === 'transfer'))
assert.deepEqual(
  [...count(transferTrials.map((trial) => trial.spatialFrequencyCyclesPerPatch!)).entries()].sort((a, b) => a[0] - b[0]),
  [[4, 2], [11, 2]],
)
for (const orientation of GABOR_ORIENTATIONS_DEGREES) {
  assert.equal(count(transferTrials.map((trial) => trial.orientationDegrees!)).get(orientation), 1)
}

let isolatedState = createGaborThresholdState()
for (const trial of block) {
  const before = isolatedState
  isolatedState = updateGaborThreshold(isolatedState, { response: 'incorrect', adaptive: trial.adaptive }).state
  if (!trial.adaptive) assert.equal(isolatedState, before, `${trial.kind} is isolated from the controller`)
}
assert.equal(isolatedState.adaptiveTrials, 6, 'only six isolated anchors feed the controller')

const preview = buildGaborEasyPreview('preview-proof')
assert.equal(preview.length, 12)
assert.deepEqual(
  Object.fromEntries(count(preview.map((trial) => trial.kind))),
  { anchor: 8, transfer: 2, catch: 2 },
)
assert.ok(preview.every((trial) => !trial.adaptive && !trial.thresholdEligible))
assert.ok(preview.every((trial) => trial.kind !== 'flanker'))
assert.ok(preview.filter((trial) => trial.kind === 'anchor').every((trial) => resolveGaborPresentation(trial, 10).contrastPct === 60))
assert.deepEqual(
  [...count(preview.filter((trial) => trial.kind === 'transfer').map((trial) => trial.spatialFrequencyCyclesPerPatch!)).entries()].sort((a, b) => a[0] - b[0]),
  [[4, 1], [11, 1]],
)
for (const orientation of GABOR_ORIENTATIONS_DEGREES) {
  assert.equal(count(preview.filter((trial) => trial.kind === 'anchor').map((trial) => trial.orientationDegrees!)).get(orientation), 2)
}
assert.deepEqual(GABOR_EASY_PREVIEW_POLICY, {
  persistsThreshold: false,
  consumesHardSession: false,
  adaptive: false,
}, 'Quick Practice neither persists a threshold nor consumes the hard-session allowance')

function correctEasyPreviewResponse(state: GaborEasyPreviewCoordinator): GaborPresentationResponse {
  const presentation = state.pending!.presentation
  return presentation.stimulusPresent
    ? { type: 'orientation', orientationDegrees: presentation.orientationDegrees! }
    : { type: 'no-pattern' }
}

let easyPreview = createGaborEasyPreviewCoordinator('preview-coordinator-proof')
for (const forbidden of [
  'localization', 'measurement', 'threshold', 'prior', 'persistence', 'points', 'hardSession',
] as const) {
  assert.equal(forbidden in easyPreview, false, `easy preview has no ${forbidden} authority`)
}
const presentedPreviewKinds: string[] = []
const presentedPreviewFrequencies: number[] = []
while (!easyPreview.terminal) {
  const presented = presentNextGaborEasyPreview(easyPreview)
  assert.ok(presented.pending, 'each unfinished preview step presents one exposure')
  assert.equal(presentNextGaborEasyPreview(presented), presented, 'pending preview presentation is an exact no-op')
  assert.equal(presented.pending!.presentation.contrastPct, presented.pending!.presentation.stimulusPresent ? 60 : 0)
  presentedPreviewKinds.push(presented.pending!.presentation.trial.kind)
  if (presented.pending!.presentation.trial.kind === 'transfer') {
    presentedPreviewFrequencies.push(presented.pending!.presentation.spatialFrequencyCyclesPerPatch!)
  }

  // The engine's preview trial number is a spectator of this mounted identity:
  // it must sit within 1..12 and agree with the response counter on both sides
  // of the response, or the header's "Trial N of 12" could disagree with itself.
  const mountedTrialNumber = presented.pending!.exposureIndex + 1
  assert.ok(mountedTrialNumber >= 1 && mountedTrialNumber <= 12, 'mounted preview trial number stays within 1..12')
  assert.equal(
    mountedTrialNumber,
    presented.counters.trials + 1,
    'mounted trial number is one ahead of the pre-response counter',
  )

  const response = correctEasyPreviewResponse(presented)
  const responded = applyGaborEasyPreviewResponse(presented, response)
  assert.equal(
    responded.counters.trials,
    mountedTrialNumber,
    'post-response counter agrees with the mounted trial number, so trial and feedback never disagree',
  )
  assert.equal(
    applyGaborEasyPreviewResponse(responded, response),
    responded,
    'duplicate preview response preserves exact coordinator identity',
  )
  easyPreview = responded
}
assert.equal(easyPreview.counters.trials, 12)
assert.equal(easyPreview.terminal?.trials, 12)
assert.deepEqual(Object.fromEntries(count(presentedPreviewKinds)), { anchor: 8, transfer: 2, catch: 2 })
assert.deepEqual([...presentedPreviewFrequencies].sort((a, b) => a - b), [4, 11])
assert.equal(easyPreview.counters.catchTrials, 2)
assert.equal(easyPreview.counters.catchFalseAlarms, 0)
assert.equal(easyPreview.terminal?.accuracyPct, 100)
assert.equal(presentNextGaborEasyPreview(easyPreview), easyPreview, 'post-completion presentation is an exact no-op')
assert.equal(
  applyGaborEasyPreviewResponse(easyPreview, { type: 'no-pattern' }),
  easyPreview,
  'post-completion response is an exact no-op',
)

// Independent observer simulation. This is a four-alternative logistic
// psychometric model in log10 contrast: guessing floor 0.25, lapse ceiling
// 0.98, slope 8/log decade. Its location is solved so the named true
// threshold has p(correct)=the 3-down/1-up target, rather than being tuned to
// the controller's observed output.
const GUESS_RATE = 0.25
const LAPSE_RATE = 0.02
const PSYCHOMETRIC_SLOPE = 8
const normalizedTarget = (GABOR_3_DOWN_1_UP_TARGET_CORRECT - GUESS_RATE) / (1 - GUESS_RATE - LAPSE_RATE)
const targetLogit = Math.log(normalizedTarget / (1 - normalizedTarget))

function observerCorrectProbability(contrastPct: number, thresholdPct: number): number {
  const logit = PSYCHOMETRIC_SLOPE * Math.log10(contrastPct / thresholdPct) + targetLogit
  return GUESS_RATE + (1 - GUESS_RATE - LAPSE_RATE) / (1 + Math.exp(-logit))
}

function randomFor(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000
  }
}

function correctResponseForPending(state: GaborProductionCoordinator): GaborPresentationResponse {
  const presentation = state.pending!.presentation
  return presentation.stimulusPresent
    ? { type: 'orientation', orientationDegrees: presentation.orientationDegrees! }
    : { type: 'no-pattern' }
}

function incorrectResponseForPending(state: GaborProductionCoordinator): GaborPresentationResponse {
  const presentation = state.pending!.presentation
  return presentation.stimulusPresent
    ? responseForOrientation(presentation.orientationDegrees!, false)
    : { type: 'orientation', orientationDegrees: 0 }
}

function driveCoordinator(
  initial: GaborProductionCoordinator,
  choose: (state: GaborProductionCoordinator, adaptiveIndex: number) => GaborPresentationResponse,
): GaborProductionCoordinator {
  let state = initial
  let adaptiveIndex = 0
  while (!state.terminal) {
    state = presentNextGaborExposure(state, { timeCapReached: false })
    if (state.terminal) break
    const isAdaptive = state.pending!.stage === 'measurement' && state.pending!.presentation.trial.adaptive
    state = applyGaborProductionResponse(state, choose(state, adaptiveIndex), { timeCapReached: false })
    if (isAdaptive) adaptiveIndex += 1
  }
  return state
}

// The block scheduler exposes an injected random stream and consumes exactly
// one selection draw for each of its ten exposures, including the catch.
let selectionCalls = 0
const countedBlock = buildGaborThresholdBlock({
  seed: 'scheduler-count',
  blockIndex: 0,
  selectionRandom: () => {
    selectionCalls += 1
    return 0.314159
  },
})
assert.equal(countedBlock.length, 10)
assert.equal(selectionCalls, 10)
assert.equal(countedBlock.filter((trial) => trial.kind === 'catch').length, 1)

// Pending is a hard coordinator invariant and the second presentation is an
// exact no-op. A response consumes it once; a duplicate is the same object.
const pendingStart = createGaborProductionCoordinator({ seed: 'pending-proof', prior: null })
const firstPending = presentNextGaborExposure(pendingStart, { timeCapReached: false })
assert.ok(firstPending.pending)
assert.equal(presentNextGaborExposure(firstPending, { timeCapReached: false }), firstPending)
const firstResponded = applyGaborProductionResponse(firstPending, correctResponseForPending(firstPending), { timeCapReached: false })
assert.equal(
  applyGaborProductionResponse(firstResponded, correctResponseForPending(firstPending), { timeCapReached: false }),
  firstResponded,
  'duplicate response preserves exact coordinator identity',
)

// Localization is a coarse, non-scored locator: every presentation consumes
// one of its twelve responses, and a timeout safely moves brighter. The later
// measurement controller still excludes lapses from its adaptive history.
let timeoutLocalization = createGaborProductionCoordinator({ seed: 'timeout-localization', prior: null })
const timeoutLocalizationContrasts: number[] = []
for (let index = 0; index < GABOR_THRESHOLD_PROTOCOL.localizationResponses; index += 1) {
  timeoutLocalization = presentNextGaborExposure(timeoutLocalization, { timeCapReached: false })
  timeoutLocalizationContrasts.push(timeoutLocalization.localization!.contrastPct)
  timeoutLocalization = applyGaborProductionResponse(
    timeoutLocalization,
    { type: 'timeout' },
    { timeCapReached: false },
  )
  assert.equal(timeoutLocalization.localization?.responses, index + 1)
}
assert.ok(timeoutLocalizationContrasts[1] > timeoutLocalizationContrasts[0])
for (let index = 1; index < timeoutLocalizationContrasts.length; index += 1) {
  assert.ok(timeoutLocalizationContrasts[index] >= timeoutLocalizationContrasts[index - 1])
}
assert.equal(timeoutLocalization.localization?.responses, 12)
assert.equal(timeoutLocalization.localization?.contrastPct, 100)
assert.equal(timeoutLocalization.counters.localizationExposures, 12)
assert.equal(timeoutLocalization.counters.lapses, 12)
assert.ok(timeoutLocalization.measurement)
assert.equal(timeoutLocalization.measurement?.adaptiveTrials, 0)
assert.equal(timeoutLocalization.measurement?.consecutiveCorrect, 0)
assert.equal(timeoutLocalization.measurement?.lastEffectiveDirection, null)
assert.deepEqual(timeoutLocalization.measurement?.reversalContrastsPct, [])

const allTimeout = driveCoordinator(
  createGaborProductionCoordinator({ seed: 'all-timeout', prior: null }),
  () => ({ type: 'timeout' }),
)
assert.equal(allTimeout.terminal?.reason, 'exposure-cap')
assert.equal(allTimeout.counters.localizationExposures, 12)
assert.equal(allTimeout.counters.scheduledExposures, 88)
assert.equal(allTimeout.localization?.responses, 12)
assert.ok(allTimeout.measurement)
assert.equal(allTimeout.measurement?.adaptiveTrials, 0)
assert.equal(allTimeout.counters.lapses, 100)
assert.equal(allTimeout.terminal?.metrics.thresholdValid, 0)
assert.equal('contrastThresholdPct' in allTimeout.terminal!.metrics, false)
assert.equal(allTimeout.terminal?.resultCompleted, false)
assert.equal(allTimeout.terminal?.scorePct, 0)

const timePending = presentNextGaborExposure(
  createGaborProductionCoordinator({ seed: 'time-cap', prior: null }),
  { timeCapReached: false },
)
const timedOut = presentNextGaborExposure(timePending, { timeCapReached: true })
assert.equal(timedOut.terminal?.reason, 'time-cap')
assert.equal(timedOut.localization, timePending.localization, 'time cap does not mutate localization')
assert.equal(timedOut.measurement, timePending.measurement, 'time cap does not mutate measurement')
assert.equal(timedOut.counters.trials, 0)

const coldAllCorrect = driveCoordinator(
  createGaborProductionCoordinator({ seed: 0x51a7, prior: null }),
  (coordinator) => correctResponseForPending(coordinator),
)
const coldAllIncorrect = driveCoordinator(
  createGaborProductionCoordinator({ seed: 0x51a7, prior: null }),
  (coordinator) => incorrectResponseForPending(coordinator),
)
assert.equal(coldAllCorrect.terminal?.reason, 'measurement-cap')
assert.equal(coldAllIncorrect.terminal?.reason, 'measurement-cap')
assert.equal(coldAllCorrect.measurement?.adaptiveTrials, 48)
assert.equal(coldAllIncorrect.measurement?.adaptiveTrials, 48)
assert.equal(coldAllCorrect.counters.localizationExposures + coldAllCorrect.counters.scheduledExposures, 92)
assert.equal(coldAllIncorrect.counters.localizationExposures + coldAllIncorrect.counters.scheduledExposures, 92)
assert.equal(coldAllCorrect.terminal?.metrics.thresholdValid, 0)
assert.equal(coldAllCorrect.terminal?.resultCompleted, false)
assert.equal(coldAllCorrect.terminal?.scorePct, 0)
assert.equal('contrastThresholdPct' in coldAllCorrect.terminal!.metrics, false)

const cccI = driveCoordinator(
  createGaborProductionCoordinator({ seed: 0x51a7, prior: null }),
  (coordinator, adaptiveIndex) => coordinator.pending!.stage === 'measurement'
    && coordinator.pending!.presentation.trial.adaptive
    && adaptiveIndex % 4 === 3
    ? incorrectResponseForPending(coordinator)
    : correctResponseForPending(coordinator),
)
assert.equal(cccI.terminal?.reason, 'valid')
assert.equal(cccI.terminal?.resultCompleted, true)
assert.ok(cccI.terminal!.scorePct > 0)
assert.equal(cccI.measurement?.adaptiveTrials, 24)
assert.equal(cccI.counters.localizationExposures + cccI.counters.scheduledExposures, 50)
assert.equal(presentNextGaborExposure(cccI, { timeCapReached: false }), cccI)
assert.equal(cccI.counters.localizationExposures + cccI.counters.scheduledExposures + 1, 51, 'next ordinal 51 is never presented')

// Locate one production catch, then apply the complete binding matrix through
// the coordinator rather than merely testing the classifier in isolation.
let catchPending = createGaborProductionCoordinator({
  seed: 'catch-matrix',
  prior: compatiblePrior,
})
while (!catchPending.pending || catchPending.pending.presentation.trial.kind !== 'catch') {
  if (catchPending.pending) {
    catchPending = applyGaborProductionResponse(
      catchPending,
      correctResponseForPending(catchPending),
      { timeCapReached: false },
    )
  }
  catchPending = presentNextGaborExposure(catchPending, { timeCapReached: false })
}
const catchMeasurement = catchPending.measurement
const catchFalseAlarm = applyGaborProductionResponse(
  catchPending,
  { type: 'orientation', orientationDegrees: 0 },
  { timeCapReached: false },
)
const catchCorrectRejection = applyGaborProductionResponse(
  catchPending,
  { type: 'no-pattern' },
  { timeCapReached: false },
)
const catchLapse = applyGaborProductionResponse(
  catchPending,
  { type: 'timeout' },
  { timeCapReached: false },
)
assert.equal(catchFalseAlarm.lastResponse?.falseAlarm, true)
assert.equal(catchFalseAlarm.counters.catchFalseAlarms, catchPending.counters.catchFalseAlarms + 1)
assert.equal(catchCorrectRejection.lastResponse?.correct, true)
assert.equal(catchLapse.lastResponse?.lapse, true)
assert.equal(catchLapse.lastResponse?.falseAlarm, false)
assert.equal(catchFalseAlarm.measurement, catchMeasurement)
assert.equal(catchCorrectRejection.measurement, catchMeasurement)
assert.equal(catchLapse.measurement, catchMeasurement)

const finishAfterCatch = (state: GaborProductionCoordinator) => driveCoordinator(
  state,
  (coordinator, adaptiveIndex) => coordinator.pending!.stage === 'measurement'
    && coordinator.pending!.presentation.trial.adaptive
    && adaptiveIndex % 4 === 3
    ? incorrectResponseForPending(coordinator)
    : correctResponseForPending(coordinator),
)
const falseAlarmTerminal = finishAfterCatch(catchFalseAlarm)
const correctRejectionTerminal = finishAfterCatch(catchCorrectRejection)
assert.equal(falseAlarmTerminal.terminal?.reason, 'valid')
assert.equal(correctRejectionTerminal.terminal?.reason, 'valid')
assert.equal(
  falseAlarmTerminal.terminal?.metrics.contrastThresholdPct,
  correctRejectionTerminal.terminal?.metrics.contrastThresholdPct,
  'catch false alarms never change the measured threshold',
)
assert.equal(
  falseAlarmTerminal.terminal?.metrics.measurementAccuracyPct,
  correctRejectionTerminal.terminal?.metrics.measurementAccuracyPct,
  'catch false alarms never change measurement-only accuracy',
)
assert.ok(
  falseAlarmTerminal.terminal!.scorePct < correctRejectionTerminal.terminal!.scorePct,
  'catch false alarms lower the points-driving motivational score',
)

const localizationNoPatternPending = presentNextGaborExposure(
  createGaborProductionCoordinator({ seed: 'local-no-pattern', prior: null }),
  { timeCapReached: false },
)
const localizationNoPattern = applyGaborProductionResponse(
  localizationNoPatternPending,
  { type: 'no-pattern' },
  { timeCapReached: false },
)
const localizationTimeout = applyGaborProductionResponse(
  localizationNoPatternPending,
  { type: 'timeout' },
  { timeCapReached: false },
)
assert.equal(localizationNoPattern.lastResponse?.staircaseResponse, 'incorrect')
assert.equal(localizationNoPattern.localization?.responses, 1)
assert.equal(localizationTimeout.lastResponse?.lapse, true)
assert.equal(localizationTimeout.localization?.responses, 1)
assert.ok(localizationTimeout.localization!.contrastPct > localizationNoPatternPending.localization!.contrastPct)

let adaptivePending = createGaborProductionCoordinator({ seed: 'adaptive-matrix', prior: compatiblePrior })
while (!adaptivePending.pending?.presentation.trial.adaptive) {
  if (adaptivePending.pending) {
    adaptivePending = applyGaborProductionResponse(
      adaptivePending,
      correctResponseForPending(adaptivePending),
      { timeCapReached: false },
    )
  }
  adaptivePending = presentNextGaborExposure(adaptivePending, { timeCapReached: false })
}
const adaptiveNoPattern = applyGaborProductionResponse(
  adaptivePending,
  { type: 'no-pattern' },
  { timeCapReached: false },
)
const adaptiveTimeout = applyGaborProductionResponse(
  adaptivePending,
  { type: 'timeout' },
  { timeCapReached: false },
)
assert.equal(adaptiveNoPattern.lastResponse?.staircaseResponse, 'incorrect')
assert.equal(adaptiveNoPattern.measurement?.adaptiveTrials, adaptivePending.measurement!.adaptiveTrials + 1)
assert.equal(adaptiveTimeout.lastResponse?.lapse, true)
assert.equal(adaptiveTimeout.measurement, adaptivePending.measurement)

const replayRandom = randomFor(98765)
const expectedInjectedBlock = buildGaborThresholdBlock({
  seed: 'cursor-proof',
  blockIndex: 0,
  selectionRandom: replayRandom,
})
let coordinatorSelectionCalls = 0
const coordinatorRandom = randomFor(98765)
const countedSelectionRandom = () => {
  coordinatorSelectionCalls += 1
  return coordinatorRandom()
}
let cursorProof = createGaborProductionCoordinator({ seed: 'cursor-proof', prior: compatiblePrior })
const cursorIds: string[] = []
for (let exposure = 0; exposure < 3; exposure += 1) {
  cursorProof = presentNextGaborExposure(cursorProof, {
    timeCapReached: false,
    selectionRandom: countedSelectionRandom,
  })
  cursorIds.push(cursorProof.pending!.presentation.trial.id)
  cursorProof = applyGaborProductionResponse(
    cursorProof,
    correctResponseForPending(cursorProof),
    { timeCapReached: false },
  )
}
assert.deepEqual(cursorIds, expectedInjectedBlock.slice(0, 3).map((trial) => trial.id))
assert.equal(coordinatorSelectionCalls, 10, 'the coordinator builds the current block once and consumes its natural prefix')
for (let exposure = 3; exposure < 10; exposure += 1) {
  cursorProof = presentNextGaborExposure(cursorProof, {
    timeCapReached: false,
    selectionRandom: countedSelectionRandom,
  })
  cursorProof = applyGaborProductionResponse(
    cursorProof,
    correctResponseForPending(cursorProof),
    { timeCapReached: false },
  )
}
assert.equal(coordinatorSelectionCalls, 10)
cursorProof = presentNextGaborExposure(cursorProof, {
  timeCapReached: false,
  selectionRandom: countedSelectionRandom,
})
assert.equal(coordinatorSelectionCalls, 20, 'the next block consumes the next ten scheduler draws only when presented')
assert.equal(applyGaborProductionResponse(cccI, { type: 'timeout' }, { timeCapReached: false }), cccI)

const simulationRows: Array<{
  lane: string
  thresholdPct: number
  validRuns: number
  validRatePct: number
  medianLog10Error: number
  terminalMeasurementAccuracyPct: number
}> = []

interface SimulatedSession {
  readonly estimatePct: number | null
  readonly measurementResponses: readonly boolean[]
  readonly localizationResponses: number
  readonly measurementAdaptiveTrials: number
  readonly firstValidResponseIndex: number | null
  readonly scheduledExposures: number
  readonly stopReason: 'valid' | 'measurement-cap' | 'exposure-cap' | 'time-cap'
  readonly observerCalls: number
  readonly presentedKinds: readonly string[]
  readonly finalState: GaborProductionCoordinator
}

function responseForOrientation(orientationDegrees: number, correct: boolean): GaborPresentationResponse {
  const answer = correct
    ? orientationDegrees
    : GABOR_ORIENTATIONS_DEGREES.find((orientation) => orientation !== orientationDegrees)!
  return { type: 'orientation', orientationDegrees: answer }
}

function runCoordinator(
  initialState: GaborProductionCoordinator,
  thresholdPct: number,
  random: () => number,
): SimulatedSession {
  let state = initialState
  const measurementResponses: boolean[] = []
  let firstValidResponseIndex: number | null = null
  let observerCalls = 0
  const presentedKinds: string[] = []
  while (!state.terminal) {
    state = presentNextGaborExposure(state, { timeCapReached: false })
    if (state.terminal) break
    const pending = state.pending
    assert.ok(pending, 'one pending exposure follows a successful presentation transition')

    const observerDraw = random()
    observerCalls += 1
    presentedKinds.push(pending.stage === 'localization' ? 'localization' : pending.presentation.trial.kind)

    let response: GaborPresentationResponse
    if (pending.stage === 'localization' || pending.presentation.trial.adaptive) {
      const correct = observerDraw < observerCorrectProbability(pending.presentation.contrastPct, thresholdPct)
      response = responseForOrientation(pending.presentation.orientationDegrees!, correct)
      if (pending.stage === 'measurement') {
        measurementResponses.push(correct)
      }
    } else if (!pending.presentation.stimulusPresent) {
      response = { type: 'no-pattern' }
    } else {
      response = responseForOrientation(pending.presentation.orientationDegrees!, true)
    }
    state = applyGaborProductionResponse(state, response, { timeCapReached: false })
    if (state.terminal?.reason === 'valid') {
      firstValidResponseIndex = state.measurement?.adaptiveTrials ?? null
    }
  }
  const terminal = state.terminal!
  const estimatePct = terminal.metrics.thresholdValid === 1
    ? terminal.metrics.contrastThresholdPct
    : null
  return {
    estimatePct,
    measurementResponses,
    localizationResponses: state.localization?.responses ?? 0,
    measurementAdaptiveTrials: state.measurement?.adaptiveTrials ?? 0,
    firstValidResponseIndex,
    scheduledExposures: state.counters.scheduledExposures,
    stopReason: terminal.reason,
    observerCalls,
    presentedKinds,
    finalState: state,
  }
}

function simulateFirstRun(thresholdPct: number, thresholdIndex: number, run: number): SimulatedSession {
  const seed = 0x51a7 + thresholdIndex * 10_000 + run
  return runCoordinator(
    createGaborProductionCoordinator({ seed, prior: null }),
    thresholdPct,
    randomFor(seed),
  )
}

function simulateWarmRun(
  thresholdPct: number,
  thresholdIndex: number,
  run: number,
  priorOffsetLog10: number,
): SimulatedSession {
  const prior: GaborThresholdPrior = {
    ...compatiblePrior,
    contrastThresholdPct: thresholdPct * Math.pow(10, priorOffsetLog10),
  }
  const seed = 0x51a7 + thresholdIndex * 10_000 + run
  const coordinator = createGaborProductionCoordinator({ seed, prior })
  assert.equal(coordinator.mode, 'warm-start')
  return runCoordinator(coordinator, thresholdPct, randomFor(seed))
}

function evaluateBank(
  lane: string,
  thresholdPct: number,
  runSession: (run: number) => SimulatedSession,
): void {
  const validEstimates: number[] = []
  let validRuns = 0
  let terminalCorrect = 0
  let terminalResponses = 0

  for (let run = 0; run < 240; run += 1) {
    const result = runSession(run)
    assert.equal(result.measurementAdaptiveTrials, result.measurementResponses.length)
    assert.ok(result.localizationResponses + result.scheduledExposures <= 100)
    assert.equal(
      result.observerCalls,
      result.finalState.counters.localizationExposures + result.finalState.counters.scheduledExposures,
      'observer stream consumes one draw for every presented exposure and no unpresented exposure',
    )
    for (const kind of result.finalState.mode === 'warm-start'
      ? ['anchor', 'easy', 'transfer', 'flanker', 'catch']
      : ['localization', 'anchor', 'easy', 'transfer', 'flanker', 'catch']) {
      assert.ok(result.presentedKinds.includes(kind), `${kind} consumes its observer draw`)
    }
    assert.equal(Object.values(gaborStopFlags(result.stopReason)).reduce((sum, flag) => sum + flag, 0), 1)
    const { counters, terminal } = result.finalState
    assert.equal(terminal!.metrics.trials, counters.trials)
    assert.equal(terminal!.metrics.localizationExposures, counters.localizationExposures)
    assert.equal(terminal!.metrics.scheduledExposures, counters.scheduledExposures)
    assert.equal(terminal!.metrics.easyTrials, counters.easyTrials)
    assert.equal(terminal!.metrics.transferTrials, counters.transferTrials)
    assert.equal(terminal!.metrics.flankerTrials, counters.flankerTrials)
    assert.equal(terminal!.metrics.catchTrials, counters.catchTrials)
    assert.equal(terminal!.metrics.catchFalseAlarms, counters.catchFalseAlarms)
    assert.equal(terminal!.metrics.lapses, counters.lapses)
    if (result.estimatePct !== null) {
      assert.equal(
        result.measurementResponses.length,
        result.firstValidResponseIndex,
        'processing stops on the response that first makes the threshold valid',
      )
      validRuns += 1
      validEstimates.push(result.estimatePct)
    } else {
      assert.equal(result.firstValidResponseIndex, null)
    }
    for (const correct of result.measurementResponses.slice(-20)) {
      terminalCorrect += Number(correct)
      terminalResponses += 1
    }
  }

  const validRatePct = (validRuns / 240) * 100
  const medianLog10Error = medianAbsoluteLog10Error(validEstimates, thresholdPct)
  const terminalMeasurementAccuracyPct = (terminalCorrect / terminalResponses) * 100
  simulationRows.push({
    lane,
    thresholdPct,
    validRuns,
    validRatePct,
    medianLog10Error,
    terminalMeasurementAccuracyPct,
  })
  assert.ok(validRuns >= 216, `${lane} ${thresholdPct}% observer must have >=216/240 valid; got ${validRuns}/240`)
  if (lane === 'first-run' && thresholdPct === 10) {
    assert.ok(validRuns >= 216, `permanent cold 10% ratchet failed: ${validRuns}/240`)
  }
  assert.ok(
    medianLog10Error <= 0.075,
    `${lane} ${thresholdPct}% observer median estimate must be within 0.075 log10; got ${medianLog10Error}`,
  )
  assert.ok(
    terminalMeasurementAccuracyPct >= 77 && terminalMeasurementAccuracyPct <= 82,
    `${lane} ${thresholdPct}% terminal measurement accuracy must be 77-82%; got ${terminalMeasurementAccuracyPct}%`,
  )
}

const truths = [2, 5, 10, 20, 40] as const
for (const [thresholdIndex, thresholdPct] of truths.entries()) {
  evaluateBank('first-run', thresholdPct, (run) => simulateFirstRun(thresholdPct, thresholdIndex, run))
  for (const priorOffsetLog10 of [-0.15, 0.15] as const) {
    evaluateBank(
      `warm-${priorOffsetLog10 > 0 ? 'plus' : 'minus'}0.15`,
      thresholdPct,
      (run) => simulateWarmRun(thresholdPct, thresholdIndex, run, priorOffsetLog10),
    )
  }
}

assert.deepEqual(
  simulationRows.filter((row) => row.lane === 'first-run').map((row) => row.validRuns),
  [226, 223, 216, 228, 224],
  'ratified cold vector for truths 2/5/10/20/40',
)
assert.deepEqual(
  simulationRows.filter((row) => row.lane === 'warm-minus0.15').map((row) => row.validRuns),
  [240, 238, 240, 239, 239],
  'ratified warm-minus vector for truths 2/5/10/20/40',
)
assert.deepEqual(
  simulationRows.filter((row) => row.lane === 'warm-plus0.15').map((row) => row.validRuns),
  [237, 239, 240, 239, 236],
  'ratified warm-plus vector for truths 2/5/10/20/40',
)
assert.equal(simulationRows.find((row) => row.lane === 'first-run' && row.thresholdPct === 10)?.validRuns, 216)

assert.deepEqual(simulateFirstRun(10, 2, 17), simulateFirstRun(10, 2, 17), 'first-run replay is deterministic')
assert.deepEqual(simulateWarmRun(10, 2, 17, -0.15), simulateWarmRun(10, 2, 17, -0.15), 'warm replay is deterministic')

const coreSource = readFileSync('src/lib/vision/gaborThreshold.ts', 'utf8')
const engineSource = readFileSync('src/components/Vision/Engines/GaborAcuityEngine.tsx', 'utf8')
const quickPracticeSource = readFileSync('src/components/Vision/Training/QuickPractice.tsx', 'utf8')
const sessionRunnerSource = readFileSync('src/components/Vision/Training/SessionRunner.tsx', 'utf8')
const progressDashboardSource = readFileSync('src/components/Vision/Training/ProgressDashboard.tsx', 'utf8')
assert.doesNotMatch(engineSource, /Math\.max\(50,.*\* 2|Math\.max\(30,.*\* 1\.5/, 'React cannot duplicate live contrast formulas')
assert.doesNotMatch(engineSource, /tierForWeek|TIER_FREQUENCY|applyStaircase|2-down-1-up/)
assert.match(engineSource, /presentNextGaborExposure\(active\.state/)
assert.match(engineSource, /applyGaborProductionResponse\(active\.state/)
assert.match(engineSource, /completed: guided\.resultCompleted/)
assert.match(engineSource, /score: guided\.resultCompleted \? clampScore\(guided\.scorePct\) : 0/)
assert.match(engineSource, /if \(completedRef\.current\) return/)
assert.match(engineSource, /completedRef\.current = true/)
assert.match(engineSource, /onComplete\(resultRef\.current\)/)
assert.match(engineSource, /Contrast threshold: \{thresholdPct\.toFixed\(1\)\}%/)
assert.match(engineSource, /Lower is better — this is the faintest contrast reliably identified in today&apos;s task\./)
assert.match(engineSource, /No reliable threshold this time/)
assert.match(engineSource, /<h2 className="text-2xl font-bold text-white">Practice complete<\/h2>/, 'preview completion heading remains')
assert.match(
  engineSource,
  /This easy preview did not change your saved threshold or today&apos;s hard-session status\./,
  'preview completion body uses the exact approved copy',
)
assert.doesNotMatch(
  engineSource,
  /Practice complete\. This easy preview/,
  'preview completion body must not repeat the heading text',
)
assert.match(engineSource, /Back to Vision Library/)
assert.match(engineSource, /!preview && \(/, 'the three-minute progress bar is guided-only')
assert.doesNotMatch(engineSource, /classifyGaborResponse|updateGaborThreshold|resolveGaborStopReason|getGaborThresholdEstimate/)
for (const metric of [
  'trials', 'accuracyPct', 'measurementAccuracyPct', 'totalExposures', 'localizationExposures',
  'scheduledExposures', 'measurementResponses', 'adaptiveTrials', 'reversals', 'thresholdValid',
  'contrastThresholdPct', 'easyTrials', 'transferTrials', 'flankerTrials', 'catchTrials',
  'catchFalseAlarms', 'lapses', 'warmStarted', 'protocolVersion',
  'anchorSpatialFrequencyCyclesPerPatch', 'stopValid', 'stopMeasurementCap', 'stopExposureCap', 'stopTimeCap',
] as const) {
  assert.match(coreSource, new RegExp(`\\b${metric}\\b`), `coordinator emits ${metric}`)
}
assert.match(engineSource, /CATCH_WINDOW_MS = 1_500/)
assert.match(engineSource, /flex h-7 items-center/, 'feedback owns fixed external space')
assert.match(engineSource, /aria-label="No pattern visible"/)
assert.doesNotMatch(quickPracticeSource, /GaborTraining/, 'Quick Practice cannot reach the legacy Gabor runner')
assert.match(quickPracticeSource, /<button[\s\S]*Easy Gabor Preview · 12 trials/, 'the preview entry is a native button card')
assert.equal(quickPracticeSource.match(/Easy Gabor Preview · 12 trials/g)?.length, 1, 'Quick Practice exposes exactly one easy Gabor preview card')
assert.match(quickPracticeSource, /does not measure or save a threshold/)
assert.match(sessionRunnerSource, /Contrast threshold \$\{m\.contrastThresholdPct\.toFixed\(1\)\}% · lower is better/)
assert.match(sessionRunnerSource, /results\.filter\(result => !isGaborResult\(result\)\)/)
assert.match(progressDashboardSource, /contrastThresholdPct: \{ label: 'Contrast Threshold', unit: '%', direction: 'lower' \}/)
assert.match(progressDashboardSource, /point\.exerciseId !== 'gabor-contrast'/)
// P1-A3 repair assertions
assert.doesNotMatch(engineSource, /Nothing failed|no zero score|failed|failure|try harder/, 'engine invalid-result body must not use forbidden words')
assert.match(engineSource, /Your eyes still did the work; today&apos;s responses did not settle into a reliable reading/, 'engine invalid-result uses approved copy')
assert.match(engineSource, /continueAfterPreviewResult/, 'preview Back button calls continueAfterPreviewResult, not onExit')
assert.doesNotMatch(engineSource, /onClick=\{onExit\}[\s\S]{0,60}Back to Vision Library/, 'Back to Vision Library must not call onExit')
assert.match(engineSource, /phase !== 'complete'/, 'X button is hidden during complete phase')
assert.match(sessionRunnerSource, /if \(isGaborResult\(result\)\)/, 'session runner branches all Gabor results')
assert.doesNotMatch(sessionRunnerSource, /encouragementFor[^}]*isGaborResult|isGaborResult[^}]*encouragementFor/, 'praise functions must never fire for Gabor')
assert.match(sessionRunnerSource, /!isGaborResult\(result\)[\s\S]{0,80}result\.score/, 'per-row score suppressed for Gabor in report')
assert.match(progressDashboardSource, /Lower means fainter patterns were identified/, 'progress dashboard explains lower-is-better for contrastThresholdPct')

// P1-A3.1: preview progress is derived from mounted stimulus state, never a
// mutable counter, clamped to the preview trial length, and shown through
// trial/feedback/paused; the guided progress footer stays guided-only.
assert.match(
  engineSource,
  /state\.pending \? state\.pending\.exposureIndex \+ 1 : state\.counters\.trials/,
  'preview progress derives from mounted exposureIndex or the response counter, not an independent counter',
)
assert.match(
  engineSource,
  /Math\.min\(state\.trials\.length, Math\.max\(1, mounted\)\)/,
  'preview progress clamps between 1 and the preview trial length',
)
assert.doesNotMatch(
  engineSource,
  /previewTrialNumber.*useState|useState.*previewTrialNumber|previewTrialNumber\.current \+=|setPreviewTrialNumber/,
  'preview progress must not be a mutable counter',
)
assert.match(
  engineSource,
  /phase === 'trial' \|\| phase === 'feedback' \|\| phase === 'paused'\)[\s\S]{0,40}Trial \$\{previewTrialNumber\} of 12/,
  'preview header renders Trial N of 12 during trial, feedback, and paused phases',
)
assert.match(engineSource, /!preview && \(/, 'the three-minute guided progress footer stays guided-only')

// P1-A3.1: both preview entry paths close normally without inflating the
// local completedToday counter; genuine quick-practice completion is untouched.
const previewOnCompleteClosures = [...quickPracticeSource.matchAll(/onComplete=\{\(\) => ([^}]*)\}/g)]
assert.equal(previewOnCompleteClosures.length, 2, 'exactly two preview onComplete closures exist')
assert.ok(
  previewOnCompleteClosures.every(([, body]) => !body.includes('setCompletedToday')),
  'neither preview onComplete closure appends to completedToday',
)
assert.match(
  previewOnCompleteClosures[0][1],
  /setSelectedExercise\(null\)/,
  'the selected-exercise preview closure still closes via setSelectedExercise(null)',
)
assert.match(
  previewOnCompleteClosures[1][1],
  /setShowGaborPreview\(false\)/,
  'the featured preview closure still closes via setShowGaborPreview(false)',
)
assert.match(
  quickPracticeSource,
  /const handleExerciseComplete = \(\) => \{[\s\S]{0,120}setCompletedToday\(prev => \[\.\.\.prev, selectedExercise\.id\]\)[\s\S]{0,60}setSelectedExercise\(null\)/,
  'genuine quick-practice completion still appends selectedExercise.id to completedToday and closes the selected exercise',
)
assert.equal(
  (quickPracticeSource.match(/setCompletedToday/g) ?? []).length,
  2,
  'setCompletedToday is only declared and called once, inside handleExerciseComplete',
)

console.log('GABOR_THRESHOLD_V1 checks passed.')
console.log('Observer: four-choice log10-logistic; guess=25%, lapse=2%, slope=8/decade; p(true threshold)=79.3700526%.')
console.table(simulationRows)
