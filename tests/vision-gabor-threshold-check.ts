import assert from 'node:assert/strict'
import {
  GABOR_3_DOWN_1_UP_TARGET_CORRECT,
  GABOR_EASY_PREVIEW_POLICY,
  GABOR_ORIENTATIONS_DEGREES,
  GABOR_THRESHOLD_PROTOCOL,
  GABOR_THRESHOLD_RENDER_CONFIG,
  buildGaborEasyPreview,
  buildGaborThresholdBlock,
  createGaborLocalizationState,
  createGaborThresholdState,
  getGaborLocalizationEstimate,
  getGaborThresholdEstimate,
  prepareGaborThresholdSession,
  startGaborMeasurementAfterLocalization,
  updateGaborLocalization,
  updateGaborThreshold,
  type GaborThresholdPrior,
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
assert.deepEqual(getGaborThresholdEstimate(measurementAfterLocalization), {
  valid: false,
  reason: 'too-few-adaptive-trials',
})
assert.equal(GABOR_THRESHOLD_PROTOCOL.localizationResponses + GABOR_THRESHOLD_PROTOCOL.measurementResponseCap, 60)
assert.equal(GABOR_THRESHOLD_PROTOCOL.combinedResponseCap, 60)

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
  assert.equal(warmStart.measurement.adaptiveTrials, 0)
  assert.equal(warmStart.measurement.consecutiveCorrect, 0)
  assert.equal(warmStart.measurement.lastEffectiveDirection, null)
  assert.deepEqual(warmStart.measurement.reversalContrastsPct, [])
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

const thresholdFixture: GaborThresholdState = {
  ...createGaborThresholdState(),
  adaptiveTrials: 24,
  reversalContrastsPct: reversalFixture,
}
const fixtureEstimate = getGaborThresholdEstimate(thresholdFixture)
assert.equal(fixtureEstimate.valid, true)
if (fixtureEstimate.valid) {
  const expected = Math.pow(40 * 20 * 10 * 5 * 2.5 * 1.25, 1 / 6)
  close(fixtureEstimate.contrastThresholdPct, expected, 1e-12, 'six-reversal geometric mean')
  assert.deepEqual(fixtureEstimate.reversalContrastsPct, reversalFixture.slice(2))
}

// The seeded therapeutic block has one and only one declared composition.
const block = buildGaborThresholdBlock({ seed: 'p1-a1-proof', blockIndex: 0, currentContrastPct: 20 })
assert.equal(block.length, 10)
assert.deepEqual(
  Object.fromEntries(count(block.map((trial) => trial.kind))),
  { anchor: 6, easy: 1, transfer: 1, flanker: 1, catch: 1 },
)
assert.deepEqual(
  block,
  buildGaborThresholdBlock({ seed: 'p1-a1-proof', blockIndex: 0, currentContrastPct: 20 }),
  'same seed produces the same schedule',
)
assert.notDeepEqual(
  block.map((trial) => trial.id),
  buildGaborThresholdBlock({ seed: 'different-seed', blockIndex: 0, currentContrastPct: 20 }).map((trial) => trial.id),
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
assert.equal(easy.contrastPct, 50, 'easy contrast is min(100,max(50,2x current))')
assert.equal(transfer.contrastPct, 30, 'transfer contrast is min(100,max(30,1.5x current))')
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

const highContrastBlock = buildGaborThresholdBlock({ seed: 42, blockIndex: 0, currentContrastPct: 80 })
assert.equal(highContrastBlock.find((trial) => trial.kind === 'easy')?.contrastPct, 100)
assert.equal(highContrastBlock.find((trial) => trial.kind === 'transfer')?.contrastPct, 100)

// Adaptive anchors, transfer frequencies, and their orientations use separate
// balanced bags, so adding one condition cannot perturb another condition.
const fourBlocks = Array.from({ length: 4 }, (_, blockIndex) =>
  buildGaborThresholdBlock({ seed: 'balance-proof', blockIndex, currentContrastPct: 12 }),
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
assert.ok(preview.filter((trial) => trial.kind === 'anchor').every((trial) => trial.contrastPct === 60))
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
}

function runMeasurement(
  initialState: GaborThresholdState,
  thresholdPct: number,
  random: () => number,
  responseCap: number,
): SimulatedSession {
  let state = initialState
  const measurementResponses: boolean[] = []
  for (let trial = 0; trial < responseCap; trial += 1) {
    const correct = random() < observerCorrectProbability(state.contrastPct, thresholdPct)
    measurementResponses.push(correct)
    state = updateGaborThreshold(state, {
      response: correct ? 'correct' : 'incorrect',
      adaptive: true,
    }).state
  }
  const estimate = getGaborThresholdEstimate(state)
  return {
    estimatePct: estimate.valid ? estimate.contrastThresholdPct : null,
    measurementResponses,
    localizationResponses: 0,
    measurementAdaptiveTrials: state.adaptiveTrials,
  }
}

function simulateFirstRun(thresholdPct: number, thresholdIndex: number, run: number): SimulatedSession {
  const random = randomFor(0x51a7 + thresholdIndex * 10_000 + run)
  let localization = createGaborLocalizationState()
  for (let trial = 0; trial < GABOR_THRESHOLD_PROTOCOL.localizationResponses; trial += 1) {
    const correct = random() < observerCorrectProbability(localization.contrastPct, thresholdPct)
    localization = updateGaborLocalization(localization, correct ? 'correct' : 'incorrect').state
  }
  const measurement = runMeasurement(
    startGaborMeasurementAfterLocalization(localization),
    thresholdPct,
    random,
    GABOR_THRESHOLD_PROTOCOL.measurementResponseCap,
  )
  return { ...measurement, localizationResponses: localization.responses }
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
  const session = prepareGaborThresholdSession(prior)
  assert.equal(session.mode, 'warm-start')
  if (session.mode !== 'warm-start') throw new Error('compatible warm prior unexpectedly localized')
  return runMeasurement(
    session.measurement,
    thresholdPct,
    randomFor(0x51a7 + thresholdIndex * 10_000 + run),
    session.measurementResponseCap,
  )
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
    assert.ok(result.localizationResponses + result.measurementAdaptiveTrials <= 60)
    if (result.estimatePct !== null) {
      validRuns += 1
      validEstimates.push(result.estimatePct)
    }
    for (const correct of result.measurementResponses.slice(-20)) {
      terminalCorrect += Number(correct)
      terminalResponses += 1
    }
  }

  const validRatePct = (validRuns / 240) * 100
  const medianLog10Error = Math.abs(Math.log10(median(validEstimates) / thresholdPct))
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

assert.deepEqual(simulateFirstRun(10, 2, 17), simulateFirstRun(10, 2, 17), 'first-run replay is deterministic')
assert.deepEqual(simulateWarmRun(10, 2, 17, -0.15), simulateWarmRun(10, 2, 17, -0.15), 'warm replay is deterministic')

console.log('GABOR_THRESHOLD_V1 checks passed.')
console.log('Observer: four-choice log10-logistic; guess=25%, lapse=2%, slope=8/decade; p(true threshold)=79.3700526%.')
console.table(simulationRows)
