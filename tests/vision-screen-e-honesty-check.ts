import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  SCREEN_DIRECTIONAL_E_PROTOCOL,
  SCREEN_E_CORRECT_TO_PASS,
  SCREEN_E_DIRECTIONS,
  SCREEN_E_LINE_MULTIPLIERS,
  SCREEN_E_TRIALS_PER_LINE,
  balancedScreenEDirections,
  createScreenDirectionalEEvidence,
  mergeResultsPreservingOpeningScreenCheck,
  screenDirectionalEMetrics,
  screenELineSize,
  shouldOfferScreenDirectionalEAfterExercises,
} from '../src/lib/vision/screenDirectionalE'
import {
  parseEngineResults,
  performanceBonusFor,
} from '../src/lib/vision/engineResultsPayload'

const sizesAt390 = SCREEN_E_LINE_MULTIPLIERS.map((_, index) => screenELineSize(390, index))
assert.ok(Math.abs(sizesAt390[0] - 54.6) < 0.0001, 'line 1 follows the shared 14%-of-viewport formula')
assert.ok(Math.abs(sizesAt390[6] - 15.834) < 0.0001, 'line 7 follows the shared multiplier')
assert.ok(sizesAt390[0] >= 48 && sizesAt390[0] <= 64, 'line 1 stays inside the frozen size range')
assert.ok(sizesAt390[6] >= 13.9 && sizesAt390[6] <= 18.6, 'line 7 stays inside the frozen size range')
for (let index = 1; index < sizesAt390.length; index += 1) {
  assert.ok(sizesAt390[index] < sizesAt390[index - 1], 'every line is strictly smaller')
}

assert.equal(screenELineSize(200, 0), 48, 'small screens clamp line 1 to 48 CSS pixels')
assert.equal(screenELineSize(2000, 0), 64, 'large screens clamp line 1 to 64 CSS pixels')
assert.throws(() => screenELineSize(390, 7), RangeError, 'unknown lines fail closed')

const balanced = balancedScreenEDirections(() => 0)
assert.equal(SCREEN_E_TRIALS_PER_LINE, 4)
assert.equal(SCREEN_E_CORRECT_TO_PASS, 3)
assert.deepEqual(
  [...balanced].sort(),
  [...SCREEN_E_DIRECTIONS].sort(),
  'each line presents every orientation exactly once',
)

const evidence = createScreenDirectionalEEvidence({
  bestLine: 4,
  trialCount: 20,
  correctCount: 16,
  viewportCssWidth: 390,
  viewportCssHeight: 844,
  devicePixelRatio: 3,
  inputMethod: 'touch',
})
assert.ok(Object.isFrozen(evidence), 'the evidence capsule is immutable')
assert.equal(evidence.protocolVersion, SCREEN_DIRECTIONAL_E_PROTOCOL)
assert.equal(evidence.totalLines, 7)
assert.equal(evidence.geometryCalibrated, 0)
assert.equal(evidence.distanceMeasured, 0)

const tampered = parseEngineResults([
  {
    exerciseId: SCREEN_DIRECTIONAL_E_PROTOCOL,
    durationSec: 30,
    completed: true,
    score: 100,
    metrics: screenDirectionalEMetrics(evidence),
  },
  {
    exerciseId: 'snellen-proof',
    durationSec: 30,
    completed: true,
    score: 100,
    metrics: { nearSnellenLine: 7 },
  },
])
assert.ok(tampered)
assert.deepEqual(tampered.map(result => result.score), [0, 0], 'server parsing neutralizes client score tampering')
assert.equal(performanceBonusFor(tampered), 0, 'screen-E and legacy screen proof award zero performance points')
const validEvidenceMetrics = screenDirectionalEMetrics(evidence)
assert.equal(
  parseEngineResults([
    {
      exerciseId: SCREEN_DIRECTIONAL_E_PROTOCOL,
      durationSec: 30,
      completed: true,
      score: 0,
      metrics: {
        ...validEvidenceMetrics,
        bestLine: 999,
      },
    },
  ]),
  null,
  'server rejects impossible screen-E evidence instead of persisting it',
)
const incompleteEvidenceMetrics = { ...validEvidenceMetrics }
delete incompleteEvidenceMetrics.inputMethod
assert.equal(
  parseEngineResults([
    {
      exerciseId: SCREEN_DIRECTIONAL_E_PROTOCOL,
      durationSec: 30,
      completed: true,
      score: 0,
      metrics: incompleteEvidenceMetrics,
    },
  ]),
  null,
  'server rejects incomplete screen-E evidence',
)

const openingEvidence = {
  exerciseId: SCREEN_DIRECTIONAL_E_PROTOCOL,
  marker: 'opening',
}
const runnerEvidence = {
  exerciseId: SCREEN_DIRECTIONAL_E_PROTOCOL,
  marker: 'runner',
}
const pursuitResult = { exerciseId: 'smooth-pursuit', marker: 'runner' }
assert.deepEqual(
  mergeResultsPreservingOpeningScreenCheck([openingEvidence], [pursuitResult, runnerEvidence]),
  [openingEvidence, pursuitResult],
  'guided results preserve the confirmed opening check and discard a redundant runner check',
)
assert.deepEqual(
  mergeResultsPreservingOpeningScreenCheck([], [pursuitResult, runnerEvidence]),
  [pursuitResult, runnerEvidence],
  'a skipped opening check still accepts the optional runner check',
)
assert.equal(shouldOfferScreenDirectionalEAfterExercises(true), false)
assert.equal(shouldOfferScreenDirectionalEAfterExercises(false), true)
assert.equal(
  performanceBonusFor([
    {
      exerciseId: 'smooth-pursuit',
      durationSec: 30,
      completed: true,
      score: 100,
      metrics: {},
    },
  ]),
  10,
  'unrelated engine scoring remains unchanged',
)

const sources = {
  quick: readFileSync(new URL('../src/components/Vision/Training/SnellenQuickCheck.tsx', import.meta.url), 'utf8'),
  chart: readFileSync(new URL('../src/components/Vision/Training/SnellenChart.tsx', import.meta.url), 'utf8'),
  daily: readFileSync(new URL('../src/components/Vision/Training/DailyPractice.tsx', import.meta.url), 'utf8'),
  weekly: readFileSync(new URL('../src/components/Vision/Training/WeeklyAssessment.tsx', import.meta.url), 'utf8'),
  runner: readFileSync(new URL('../src/components/Vision/Training/SessionRunner.tsx', import.meta.url), 'utf8'),
}

for (const [name, source] of Object.entries(sources)) {
  assert.doesNotMatch(source, /20\/\d+/, `${name} renders no uncalibrated medical acuity score`)
  assert.doesNotMatch(source, /sharper by/i, `${name} makes no unsupported line-gain claim`)
}

assert.match(sources.quick, /screenELineSize\(viewportWidth, lineIndex\)/)
assert.match(sources.chart, /screenELineSize\(viewportWidth, lineIdx\)/)
assert.match(sources.quick, /SCREEN_E_TRIALS_PER_LINE/)
assert.match(sources.quick, /SCREEN_E_CORRECT_TO_PASS/)
assert.match(sources.quick, /Far testing stays unavailable/)
assert.doesNotMatch(sources.quick, /stage === 'far'|across the room|Reposition for far/)
assert.match(sources.chart, /export const E_DIRECTIONS = SCREEN_E_DIRECTIONS/)
assert.match(sources.weekly, /aria-label="Measured near-point distance"/)
assert.match(sources.weekly, /aria-valuetext=/)
assert.equal(
  (sources.quick.match(/onComplete\(/g) || []).length,
  1,
  'only the explicit result-confirm action can persist the check',
)

const quickHandlerStart = sources.daily.indexOf('const handleQuickCheckComplete =')
const quickHandlerEnd = sources.daily.indexOf('useEffect(() =>', quickHandlerStart)
const quickHandler = sources.daily.slice(quickHandlerStart, quickHandlerEnd)
assert.doesNotMatch(quickHandler, /update_baselines|nearSnellen|farSnellen|fetch\(/)
assert.match(quickHandler, /score:\s*0/)
assert.match(quickHandler, /current\.filter\(item => item\.exerciseId !== SCREEN_DIRECTIONAL_E_PROTOCOL\)/)
assert.match(sources.daily, /mergeResultsPreservingOpeningScreenCheck\(current, payload\.results\)/)
assert.match(sources.daily, /screenCheckAlreadyCompleted=/)
assert.match(sources.runner, /shouldOfferScreenDirectionalEAfterExercises\(screenCheckAlreadyCompleted\)/)
assert.match(sources.runner, /exerciseId:\s*SCREEN_DIRECTIONAL_E_PROTOCOL/)
assert.match(sources.runner, /score:\s*0/)

console.log('Vision screen-directional-E honesty checks passed.')
