import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  GABOR_3_DOWN_1_UP_TARGET_CORRECT,
  GABOR_ORIENTATIONS_DEGREES,
  GABOR_THRESHOLD_PROTOCOL,
  GABOR_THRESHOLD_RENDER_CONFIG,
  applyGaborProductionResponse,
  createGaborProductionCoordinator,
  presentNextGaborExposure,
  type GaborPresentationResponse,
  type GaborProductionCoordinator,
  type GaborThresholdPrior,
} from '../src/lib/vision/gaborThreshold'
import {
  buildGaborThresholdPriorFromEngineResults,
  parseStoredGaborThresholdPrior,
  selectNewestValidGaborThresholdPrior,
} from '../src/lib/vision/gaborPriorPersistence'
import type { EngineResultPayload } from '../src/lib/vision/engineResultsPayload'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function validGaborMetrics(overrides: Partial<Record<string, number>> = {}): Record<string, number> {
  return {
    trials: 30,
    accuracyPct: 80,
    measurementAccuracyPct: 79,
    totalExposures: 40,
    localizationExposures: 12,
    scheduledExposures: 28,
    measurementResponses: 24,
    adaptiveTrials: 24,
    reversals: 8,
    thresholdValid: 1,
    contrastThresholdPct: 12.5,
    easyTrials: 3,
    transferTrials: 3,
    flankerTrials: 3,
    catchTrials: 3,
    catchFalseAlarms: 0,
    lapses: 0,
    warmStarted: 0,
    protocolVersion: 1,
    anchorSpatialFrequencyCyclesPerPatch: GABOR_THRESHOLD_RENDER_CONFIG.anchorSpatialFrequencyCyclesPerPatch,
    stopValid: 1,
    stopMeasurementCap: 0,
    stopExposureCap: 0,
    stopTimeCap: 0,
    ...overrides,
  }
}

function validGaborResult(
  overrides: Partial<EngineResultPayload> = {},
  metricOverrides: Partial<Record<string, number>> = {},
): EngineResultPayload {
  return {
    exerciseId: 'gabor-contrast',
    durationSec: 150,
    completed: true,
    score: 80,
    metrics: validGaborMetrics(metricOverrides),
    ...overrides,
  }
}

function canonicalRenderConfig(): GaborThresholdPrior['renderConfig'] {
  return {
    rendererId: GABOR_THRESHOLD_RENDER_CONFIG.rendererId,
    contrastMetric: GABOR_THRESHOLD_RENDER_CONFIG.contrastMetric,
    anchorSpatialFrequencyCyclesPerPatch: GABOR_THRESHOLD_RENDER_CONFIG.anchorSpatialFrequencyCyclesPerPatch,
    orientationsDegrees: [...GABOR_THRESHOLD_RENDER_CONFIG.orientationsDegrees],
    phaseDegrees: GABOR_THRESHOLD_RENDER_CONFIG.phaseDegrees,
    sigmaWavelengthRatio: GABOR_THRESHOLD_RENDER_CONFIG.sigmaWavelengthRatio,
  }
}

const compatiblePrior: GaborThresholdPrior = {
  valid: true,
  stale: false,
  protocol: GABOR_THRESHOLD_PROTOCOL.id,
  contrastThresholdPct: 10,
  renderConfig: canonicalRenderConfig(),
}

// ---------------------------------------------------------------------------
// Builder: EngineResultPayload[] -> GaborThresholdPrior | null
// ---------------------------------------------------------------------------

// Exact valid server-owned snapshot round-trip.
const builtFromValidResult = buildGaborThresholdPriorFromEngineResults([validGaborResult()])
assert.ok(builtFromValidResult, 'a qualifying gabor-contrast result builds a prior')
assert.equal(builtFromValidResult!.valid, true)
assert.equal(builtFromValidResult!.stale, false)
assert.equal(builtFromValidResult!.protocol, GABOR_THRESHOLD_PROTOCOL.id)
assert.equal(builtFromValidResult!.contrastThresholdPct, 12.5)
assert.deepEqual(builtFromValidResult!.renderConfig, canonicalRenderConfig())

// Storage round trip: what $set writes and a later GET reads back is plain
// JSON (Mongo Extended JSON for scalars/arrays here, no ObjectId involved).
const storedThenRead = JSON.parse(JSON.stringify(builtFromValidResult))
const reparsed = parseStoredGaborThresholdPrior(storedThenRead)
assert.deepEqual(reparsed, builtFromValidResult, 'stored-then-read snapshot reparses to the exact original canonical object')
assert.notEqual(reparsed, builtFromValidResult, 'the parser always returns a freshly built object, never the input reference')

// Builder failures: missing prior, incomplete result, invalid threshold, invalid stop.
const builderFailureCases: Array<[string, EngineResultPayload[]]> = [
  ['no gabor-contrast result in the array', [validGaborResult({ exerciseId: 'saccade-tracker' })]],
  ['empty results array', []],
  ['preview-shaped result', [validGaborResult({ metrics: { previewOnly: 1 } })]],
  ['result.completed is false', [validGaborResult({ completed: false })]],
  ['metrics.thresholdValid is 0', [validGaborResult({}, { thresholdValid: 0 })]],
  ['metrics.stopValid is 0', [validGaborResult({}, { stopValid: 0 })]],
  ['contrastThresholdPct below protocol floor', [validGaborResult({}, { contrastThresholdPct: 0.1 })]],
  ['contrastThresholdPct above protocol ceiling', [validGaborResult({}, { contrastThresholdPct: 150 })]],
  ['contrastThresholdPct non-finite', [validGaborResult({}, { contrastThresholdPct: Number.NaN })]],
  ['protocolVersion does not match GABOR_THRESHOLD_V1', [validGaborResult({}, { protocolVersion: 2 })]],
  ['anchorSpatialFrequencyCyclesPerPatch does not match the render contract', [validGaborResult({}, { anchorSpatialFrequencyCyclesPerPatch: 4 })]],
]
for (const [label, results] of builderFailureCases) {
  assert.equal(buildGaborThresholdPriorFromEngineResults(results), null, `builder must reject: ${label}`)
}

// An invalid Gabor result must not block the rest of a completed session's
// engineResults from being buildable/persistable — the builder just returns
// null for the snapshot field, it never throws or signals "reject the session".
const mixedResults = [validGaborResult({ completed: false }), validGaborResult({ exerciseId: 'saccade-tracker', metrics: { accuracyPct: 90 } })]
assert.equal(buildGaborThresholdPriorFromEngineResults(mixedResults), null)
assert.doesNotThrow(() => buildGaborThresholdPriorFromEngineResults(mixedResults))

// ---------------------------------------------------------------------------
// Parser: unknown stored value -> GaborThresholdPrior | null
// ---------------------------------------------------------------------------

const parserFailureCases: Array<[string, unknown]> = [
  ['null', null],
  ['undefined', undefined],
  ['array instead of object', []],
  ['plain string', 'not-an-object'],
  ['valid:false', { ...compatiblePrior, valid: false }],
  ['valid:"true" (string, not boolean)', { ...compatiblePrior, valid: 'true' }],
  ['stale:true', { ...compatiblePrior, stale: true }],
  ['protocol mismatch', { ...compatiblePrior, protocol: 'GABOR_THRESHOLD_V0' }],
  ['contrastThresholdPct below floor', { ...compatiblePrior, contrastThresholdPct: 0.1 }],
  ['contrastThresholdPct above ceiling', { ...compatiblePrior, contrastThresholdPct: 150 }],
  ['contrastThresholdPct non-finite', { ...compatiblePrior, contrastThresholdPct: Number.NaN }],
  ['render mismatch: phaseDegrees', { ...compatiblePrior, renderConfig: { ...compatiblePrior.renderConfig, phaseDegrees: 90 } }],
  ['render mismatch: anchorSpatialFrequencyCyclesPerPatch', { ...compatiblePrior, renderConfig: { ...compatiblePrior.renderConfig, anchorSpatialFrequencyCyclesPerPatch: 4 } }],
  ['render mismatch: rendererId', { ...compatiblePrior, renderConfig: { ...compatiblePrior.renderConfig, rendererId: 'LEGACY_GABOR' } }],
  ['render mismatch: orientation order swapped', { ...compatiblePrior, renderConfig: { ...compatiblePrior.renderConfig, orientationsDegrees: [45, 0, 90, 135] } }],
  ['render mismatch: extra orientation', { ...compatiblePrior, renderConfig: { ...compatiblePrior.renderConfig, orientationsDegrees: [...compatiblePrior.renderConfig.orientationsDegrees, 10] } }],
  ['renderConfig missing entirely', { ...compatiblePrior, renderConfig: undefined }],
]
for (const [label, value] of parserFailureCases) {
  assert.equal(parseStoredGaborThresholdPrior(value), null, `parser must reject: ${label}`)
}

// The parser must never trust extra/tampered fields riding along on an
// otherwise-matching stored renderConfig — it always reconstructs from the
// live constants, so a smuggled field cannot survive into the returned prior.
const taintedStored = {
  ...compatiblePrior,
  renderConfig: { ...compatiblePrior.renderConfig, maliciousFlag: true },
}
const parsedTainted = parseStoredGaborThresholdPrior(taintedStored)
assert.ok(parsedTainted, 'a matching renderConfig with an extra field still parses')
assert.deepEqual(
  Object.keys(parsedTainted!.renderConfig).sort(),
  ['anchorSpatialFrequencyCyclesPerPatch', 'contrastMetric', 'orientationsDegrees', 'phaseDegrees', 'rendererId', 'sigmaWavelengthRatio'],
  'parser output has exactly the canonical render-config fields, dropping any smuggled extras',
)

// Cold localization when the prior is missing, and identically when a
// structurally invalid stored value parses down to null.
const missingPriorCoordinator = createGaborProductionCoordinator({ seed: 'missing-prior', prior: null })
assert.equal(missingPriorCoordinator.mode, 'localization')
assert.equal(missingPriorCoordinator.fallbackReason, 'missing')

const invalidStoredParsed = parseStoredGaborThresholdPrior({ ...compatiblePrior, stale: true })
assert.equal(invalidStoredParsed, null)
const invalidPriorCoordinator = createGaborProductionCoordinator({ seed: 'invalid-prior', prior: invalidStoredParsed })
assert.equal(invalidPriorCoordinator.mode, 'localization')
assert.equal(invalidPriorCoordinator.fallbackReason, 'missing', 'a parse failure feeds the coordinator null, which falls back exactly like a missing prior')

// Compatible prior -> warm start with zero localization exposures ever recorded.
const warmStartCoordinator = createGaborProductionCoordinator({ seed: 'warm-zero-localization', prior: compatiblePrior })
assert.equal(warmStartCoordinator.mode, 'warm-start')
assert.equal(warmStartCoordinator.localization, null)
assert.equal(warmStartCoordinator.counters.localizationExposures, 0)
const warmFirstPresentation = presentNextGaborExposure(warmStartCoordinator, { timeCapReached: false })
assert.equal(warmFirstPresentation.pending?.stage, 'measurement', 'warm start presents measurement directly, skipping localization')
assert.equal(warmFirstPresentation.counters.localizationExposures, 0, 'warm start never records a localization exposure')

// ---------------------------------------------------------------------------
// Newest-first selector
// ---------------------------------------------------------------------------

const USER_ID = '507f1f77bcf86cd799439011'
const ENROLLMENT_ID = '507f1f77bcf86cd799439012'
const OTHER_USER_ID = '507f1f77bcf86cd799439099'
const OTHER_ENROLLMENT_ID = '507f1f77bcf86cd799439098'

// No documents at all -> no prior.
assert.equal(selectNewestValidGaborThresholdPrior([], USER_ID, ENROLLMENT_ID), null)

const validStoredPlain = JSON.parse(JSON.stringify(compatiblePrior))
const canonicalFromStored = parseStoredGaborThresholdPrior(validStoredPlain)
assert.ok(canonicalFromStored)

// A later invalid/malformed snapshot must not conceal an earlier valid one —
// the selector must fall through the newest (bad) doc to the older good one.
const newestFirstDocsWithABadHead: unknown[] = [
  { userId: { $oid: USER_ID }, enrollmentId: { $oid: ENROLLMENT_ID }, gaborThresholdPrior: { ...validStoredPlain, stale: true } },
  { userId: { $oid: USER_ID }, enrollmentId: { $oid: ENROLLMENT_ID }, gaborThresholdPrior: validStoredPlain },
]
assert.deepEqual(
  selectNewestValidGaborThresholdPrior(newestFirstDocsWithABadHead, USER_ID, ENROLLMENT_ID),
  canonicalFromStored,
  'an older valid snapshot surfaces past a newer invalid one',
)

// User and enrollment isolation: wrong-user and wrong-enrollment documents
// must never be selected, even carrying an otherwise-valid snapshot. Accepts
// both the Prisma raw-Mongo `{ $oid }` shape and plain strings (fixtures).
const isolationDocs: unknown[] = [
  { userId: { $oid: OTHER_USER_ID }, enrollmentId: { $oid: ENROLLMENT_ID }, gaborThresholdPrior: validStoredPlain },
  { userId: { $oid: USER_ID }, enrollmentId: { $oid: OTHER_ENROLLMENT_ID }, gaborThresholdPrior: validStoredPlain },
  { userId: USER_ID, enrollmentId: ENROLLMENT_ID, gaborThresholdPrior: validStoredPlain },
]
assert.deepEqual(
  selectNewestValidGaborThresholdPrior(isolationDocs, USER_ID, ENROLLMENT_ID),
  canonicalFromStored,
  'only the doc matching both userId and enrollmentId is selected',
)
assert.equal(
  selectNewestValidGaborThresholdPrior(isolationDocs.slice(0, 2), USER_ID, ENROLLMENT_ID),
  null,
  'wrong-user and wrong-enrollment docs alone never produce a prior',
)

// Malformed documents in the list (not objects, missing fields) are skipped, not fatal.
const withGarbageDocs: unknown[] = [null, 'not-a-doc', 42, { userId: USER_ID }, ...isolationDocs]
assert.deepEqual(
  selectNewestValidGaborThresholdPrior(withGarbageDocs, USER_ID, ENROLLMENT_ID),
  canonicalFromStored,
  'garbage list entries are skipped rather than throwing',
)

// ---------------------------------------------------------------------------
// Warm/cold terminal metrics — deterministic coordinator response pattern
// (mirrors tests/vision-gabor-threshold-check.ts's psychometric-model driver).
// ---------------------------------------------------------------------------

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

function responseForOrientation(orientationDegrees: number, correct: boolean): GaborPresentationResponse {
  const answer = correct
    ? orientationDegrees
    : GABOR_ORIENTATIONS_DEGREES.find((orientation) => orientation !== orientationDegrees)!
  return { type: 'orientation', orientationDegrees: answer }
}

function driveToTerminal(
  initial: GaborProductionCoordinator,
  thresholdPct: number,
  random: () => number,
): GaborProductionCoordinator {
  let state = initial
  while (!state.terminal) {
    state = presentNextGaborExposure(state, { timeCapReached: false })
    if (state.terminal) break
    const pending = state.pending!
    const draw = random()
    let response: GaborPresentationResponse
    if (pending.stage === 'localization' || pending.presentation.trial.adaptive) {
      const correct = draw < observerCorrectProbability(pending.presentation.contrastPct, thresholdPct)
      response = responseForOrientation(pending.presentation.orientationDegrees!, correct)
    } else if (!pending.presentation.stimulusPresent) {
      response = { type: 'no-pattern' }
    } else {
      response = responseForOrientation(pending.presentation.orientationDegrees!, true)
    }
    state = applyGaborProductionResponse(state, response, { timeCapReached: false })
  }
  return state
}

/** Deterministic: tries a bounded, fixed sequence of seeds until one lands on reason==='valid'. */
function findValidTerminal(
  thresholdPct: number,
  makeCoordinator: (seed: number) => GaborProductionCoordinator,
): GaborProductionCoordinator {
  for (let seed = 0xa11ce; seed < 0xa11ce + 80; seed += 1) {
    const terminal = driveToTerminal(makeCoordinator(seed), thresholdPct, randomFor(seed))
    if (terminal.terminal?.reason === 'valid') return terminal
  }
  throw new Error('no seed within budget produced a valid terminal')
}

const TRUE_THRESHOLD_PCT = 10

const coldValidTerminal = findValidTerminal(TRUE_THRESHOLD_PCT, (seed) => createGaborProductionCoordinator({ seed, prior: null }))
assert.equal(coldValidTerminal.mode, 'localization')
assert.equal(coldValidTerminal.terminal!.resultCompleted, true)
assert.equal(coldValidTerminal.terminal!.metrics.thresholdValid, 1)
assert.equal(coldValidTerminal.terminal!.metrics.warmStarted, 0, 'a cold run reports warmStarted=0')

const warmValidTerminal = findValidTerminal(
  TRUE_THRESHOLD_PCT,
  (seed) => createGaborProductionCoordinator({ seed, prior: { ...compatiblePrior, contrastThresholdPct: TRUE_THRESHOLD_PCT } }),
)
assert.equal(warmValidTerminal.mode, 'warm-start')
assert.equal(warmValidTerminal.terminal!.resultCompleted, true)
assert.equal(warmValidTerminal.terminal!.metrics.thresholdValid, 1)
assert.equal(warmValidTerminal.terminal!.metrics.warmStarted, 1, 'a warm run reports warmStarted=1')

// A genuine warm-run terminal result round-trips end to end: coordinator
// terminal metrics -> builder -> stored -> parser -> fresh canonical prior.
const warmEngineResult: EngineResultPayload = {
  exerciseId: 'gabor-contrast',
  durationSec: 150,
  completed: true,
  score: warmValidTerminal.terminal!.scorePct,
  metrics: warmValidTerminal.terminal!.metrics,
}
const warmBuiltPrior = buildGaborThresholdPriorFromEngineResults([warmEngineResult])
assert.ok(warmBuiltPrior, 'a genuine warm-run terminal result builds a fresh prior')
assert.equal(warmBuiltPrior!.contrastThresholdPct, warmValidTerminal.terminal!.metrics.contrastThresholdPct)
const warmRoundTripped = parseStoredGaborThresholdPrior(JSON.parse(JSON.stringify(warmBuiltPrior)))
assert.deepEqual(warmRoundTripped, warmBuiltPrior)

// ---------------------------------------------------------------------------
// Source wiring
// ---------------------------------------------------------------------------

const routeSource = readFileSync('app/api/vision/program/route.ts', 'utf8')
const dailyPracticeSource = readFileSync('src/components/Vision/Training/DailyPractice.tsx', 'utf8')
const sessionRunnerSource = readFileSync('src/components/Vision/Training/SessionRunner.tsx', 'utf8')
const engineSource = readFileSync('src/components/Vision/Engines/GaborAcuityEngine.tsx', 'utf8')
const quickPracticeSource = readFileSync('src/components/Vision/Training/QuickPractice.tsx', 'utf8')
const typesSource = readFileSync('src/components/Vision/Engines/types.ts', 'utf8')
const persistenceSource = readFileSync('src/lib/vision/gaborPriorPersistence.ts', 'utf8')

// GET is filtered by BOTH ids plus existence, sorted newest-first with an
// _id tie-break, and applies no arbitrary limit.
assert.match(
  routeSource,
  /find: 'vision_daily_sessions'[\s\S]{0,200}userId: \{ \$oid: user\.id \}[\s\S]{0,120}enrollmentId: \{ \$oid: enrollment\.id \}[\s\S]{0,120}gaborThresholdPrior: \{ \$exists: true \}/,
  'GET raw find filters by userId, enrollmentId, and prior existence together',
)
assert.match(routeSource, /sort: \{ completedAt: -1, _id: -1 \}/, 'GET raw find sorts newest-first with an _id tie-break')
assert.doesNotMatch(
  routeSource,
  /find: 'vision_daily_sessions'[\s\S]{0,400}limit:/,
  'GET raw find for the prior applies no arbitrary limit',
)
assert.match(routeSource, /selectNewestValidGaborThresholdPrior\(/, 'GET calls the pure newest-valid selector')
assert.match(routeSource, /gaborThresholdPrior: null,/, 'the unenrolled response is explicit about gaborThresholdPrior:null')
assert.match(
  routeSource,
  /catch \(error\) \{[\s\S]{0,160}Vision Gabor prior lookup failed; using cold localization:/,
  'an optional prior lookup failure falls back cold instead of failing the whole program GET',
)

// POST writes engineResults and (only if qualified) gaborThresholdPrior in
// the SAME single $set — exactly two raw Mongo calls exist in this route:
// the GET find, and this POST update.
assert.equal((routeSource.match(/\$runCommandRaw/g) ?? []).length, 2, 'route makes exactly two raw Mongo calls total (GET find + POST update)')
assert.match(
  routeSource,
  /const sessionResultsForStorage: Prisma\.InputJsonObject = gaborThresholdPrior[\s\S]{0,120}\? \{ engineResults, gaborThresholdPrior \}[\s\S]{0,60}: \{ engineResults \}/,
  'qualified and unqualified results produce one explicit JSON-safe storage object',
)
assert.match(
  routeSource,
  /u: \{ \$set: sessionResultsForStorage \}/,
  'engineResults and gaborThresholdPrior are written together in one $set',
)
assert.match(routeSource, /buildGaborThresholdPriorFromEngineResults\(engineResults\)/, 'POST builds the prior from the just-validated engineResults')

// The route never trusts a client-supplied protocol/render object for the prior.
assert.doesNotMatch(routeSource, /gaborThresholdPrior:\s*data\./, 'route must not accept a client-supplied gaborThresholdPrior')
assert.doesNotMatch(routeSource, /data\.protocol|data\.renderConfig|body\.protocol|body\.renderConfig/, 'route never reads a client protocol/renderConfig for the prior')

// The persistence module itself never trusts a stored/client protocol or
// renderConfig value — both directions stamp the live constants.
assert.doesNotMatch(persistenceSource, /protocol:\s*candidate\.protocol/, 'parser must not trust the stored protocol value')
assert.doesNotMatch(persistenceSource, /renderConfig:\s*candidate\.renderConfig/, 'parser must not trust the stored renderConfig value')
assert.equal(
  (persistenceSource.match(/protocol: GABOR_THRESHOLD_PROTOCOL\.id,/g) ?? []).length,
  2,
  'both the builder and the parser stamp the constant protocol id',
)
assert.equal(
  (persistenceSource.match(/renderConfig: canonicalRenderConfig\(\),/g) ?? []).length,
  2,
  'both the builder and the parser stamp the canonical render config',
)

// DailyPractice -> SessionRunner -> only the gabor-contrast engine.
assert.match(
  dailyPracticeSource,
  /setGaborThresholdPrior\(data\.gaborThresholdPrior \?\? null\)/,
  'DailyPractice refreshes the prior — including clearing to null — from every successful GET',
)
assert.match(dailyPracticeSource, /gaborThresholdPrior=\{gaborThresholdPrior\}/, 'DailyPractice forwards the prior into SessionRunner')

assert.match(sessionRunnerSource, /gaborThresholdPrior\?: GaborThresholdPrior \| null/, 'SessionRunner declares a typed optional prior prop')
assert.match(
  sessionRunnerSource,
  /gaborThresholdPrior=\{exercise\.id === 'gabor-contrast' \? gaborThresholdPrior : undefined\}/,
  'SessionRunner forwards the prior only to the gabor-contrast engine',
)

// EngineProps carries the prior as an optional field so every other engine needs no edits.
assert.match(typesSource, /gaborThresholdPrior\?: GaborThresholdPrior \| null/, 'EngineProps declares the optional typed prior')

// Both the initial coordinator ref and the authoritative start() reset use the prior for guided mode.
assert.match(
  engineSource,
  /const coordinatorRef = useRef<ActiveCoordinator>\(createActiveCoordinator\(preview, seedRef\.current, gaborThresholdPrior\)\)/,
  'initial coordinator creation uses the prior',
)
const startCallbackMatch = engineSource.match(/const start = useCallback\(\(\) => \{[\s\S]*?\n {2}\}, \[[^\]]*\]\)/)
assert.ok(startCallbackMatch, 'start() callback body found')
assert.match(
  startCallbackMatch![0],
  /coordinatorRef\.current = createActiveCoordinator\(preview, seedRef\.current, gaborThresholdPrior\)/,
  'the authoritative start() reset uses the prior',
)

// The preview branch explicitly never reads `prior` — createActiveCoordinator
// only threads it through the guided branch's production coordinator.
assert.match(
  engineSource,
  /function createActiveCoordinator\(preview: boolean, seed: string, prior: GaborThresholdPrior \| null\): ActiveCoordinator \{[\s\S]{0,20}return preview[\s\S]{0,20}\? \{ mode: 'preview', state: createGaborEasyPreviewCoordinator\(seed\) \}[\s\S]{0,10}: \{ mode: 'guided', state: createGaborProductionCoordinator\(\{ seed, prior \}\) \}/,
  'createActiveCoordinator only reads prior on the guided branch; the preview branch never references it',
)

// Preview (Quick Practice) never receives, reads, or persists a prior at all.
assert.doesNotMatch(quickPracticeSource, /gaborThresholdPrior/, 'Quick Practice preview never references a prior')

console.log('Gabor prior persistence checks passed.')
