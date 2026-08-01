import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  DEFAULT_SCREEN_E_STYLE,
  SCREEN_DIRECTIONAL_E_PROTOCOL,
  SCREEN_DIRECTIONAL_E_VERSION,
  SCREEN_E_CORRECT_TO_PASS,
  SCREEN_E_CHART_STAGE_HEIGHT,
  SCREEN_E_DIRECTIONS,
  SCREEN_E_LINE_LETTER_COUNTS,
  SCREEN_E_LINE_MULTIPLIERS,
  SCREEN_E_MIN_LEGIBLE_PHYSICAL_PX,
  SCREEN_E_QUICK_CHECK_STIMULUS_STAGE_HEIGHT,
  SCREEN_E_RESPONSE_BUTTON_SIZE,
  SCREEN_E_STYLE_REGISTRY,
  SCREEN_E_TRIALS_PER_LINE,
  balancedScreenEDirections,
  createScreenDirectionalEEvidence,
  mergeResultsPreservingOpeningScreenCheck,
  parseScreenEDistanceChoice,
  resolveScreenEStyle,
  screenEChartPosition,
  screenDirectionalEMetrics,
  screenELineSize,
  screenEResponsePadLayout,
  screenEStyleRenderThickness,
  screenEStyleThickness,
  shouldOfferScreenDirectionalEAfterExercises,
} from '../src/lib/vision/screenDirectionalE'
import {
  parseEngineResults,
  performanceBonusFor,
} from '../src/lib/vision/engineResultsPayload'

assert.deepEqual(Object.keys(SCREEN_E_STYLE_REGISTRY), ['crisp', 'thin'], 'the practice registry exposes exactly two styles')
assert.equal(DEFAULT_SCREEN_E_STYLE, 'crisp', 'Crisp remains the protected default')
assert.equal(screenEStyleThickness('crisp'), 7, 'Crisp retains the existing normal thickness')
assert.equal(screenEStyleThickness('thin'), 5, 'Thin is the only additive practice thickness')
assert.equal(resolveScreenEStyle('unknown'), 'crisp', 'unknown styles fail closed to Crisp')
assert.equal(screenEStyleThickness('unknown'), 7, 'unknown style thickness fails closed to Crisp')

for (const devicePixelRatio of [1, 2, 3]) {
  for (const cssSize of [55, 45.5, 38, 31.5, 26, 21.5, 18, 15, 12, 10, 8.5, 7, 6, 5]) {
    assert.equal(
      screenEStyleRenderThickness('crisp', cssSize, devicePixelRatio),
      7,
      'Crisp geometry must remain byte-for-byte at its protected seven-unit thickness',
    )

    const thinThickness = screenEStyleRenderThickness('thin', cssSize, devicePixelRatio)
    const physicalScale = cssSize * devicePixelRatio / 50
    const physicalSpans = [
      5,
      25 - thinThickness / 2,
      45 - thinThickness,
    ].map(start => (
      Math.round((start + thinThickness) * physicalScale)
      - Math.round(start * physicalScale)
    ))

    assert.ok(physicalSpans[0] >= 1, 'Thin bars retain at least one physical pixel')
    assert.deepEqual(
      physicalSpans,
      [physicalSpans[0], physicalSpans[0], physicalSpans[0]],
      `Thin top, middle, and bottom bars stay equally thick at ${cssSize}px DPR ${devicePixelRatio}`,
    )
  }
}

const sizesAt390 = SCREEN_E_LINE_MULTIPLIERS.map((_, index) => screenELineSize(390, index))
assert.equal(SCREEN_E_LINE_MULTIPLIERS.length, 14, 'the shared scale contains fourteen additive rows')
assert.deepEqual(
  sizesAt390,
  [55, 45, 38, 31, 26, 21, 18, 15, 12, 10, 8, 7, 6, 5],
  'the long scale extends through distinct near-pixel rows without compression',
)
assert.equal(sizesAt390[0], 55, 'line 1 follows the shared 14%-of-viewport formula and pixel snaps')
assert.equal(sizesAt390.at(-1), 5, 'the smallest line reaches the near-pixel endpoint after pixel snapping')
assert.ok(sizesAt390[0] >= 48 && sizesAt390[0] <= 64, 'line 1 stays inside the frozen size range')
assert.ok(sizesAt390.at(-1)! >= SCREEN_E_MIN_LEGIBLE_PHYSICAL_PX, 'the smallest line keeps a directionally legible opening')
for (let index = 1; index < sizesAt390.length; index += 1) {
  assert.ok(sizesAt390[index] < sizesAt390[index - 1], 'every additive row is strictly smaller')
}
const sizesAt390Dpr3 = SCREEN_E_LINE_MULTIPLIERS.map((_, index) => screenELineSize(390, index, 3))
for (const size of sizesAt390Dpr3) {
  assert.equal(size * 3, Math.round(size * 3), 'each optotype size lands on the device pixel grid')
}
assert.equal(sizesAt390Dpr3.at(-1), 5, 'the final row remains a five-CSS-pixel optotype on DPR 3')

assert.deepEqual(
  SCREEN_E_LINE_LETTER_COUNTS.slice(0, 7),
  [3, 4, 5, 5, 6, 7, 8],
  'the original seven row counts are retained exactly',
)
for (let index = 1; index < SCREEN_E_LINE_LETTER_COUNTS.length; index += 1) {
  assert.ok(
    SCREEN_E_LINE_LETTER_COUNTS[index] >= SCREEN_E_LINE_LETTER_COUNTS[index - 1],
    'rows never lose optotypes as the chart becomes finer',
  )
}
assert.ok(
  SCREEN_E_LINE_LETTER_COUNTS.slice(7).every(count => count === 8),
  'every added fine row preserves eight optotypes',
)
assert.equal(
  SCREEN_E_LINE_LETTER_COUNTS.reduce((total, count) => total + count, 0),
  94,
  'Crisp and Thin share the complete fourteen-row, ninety-four-optotype workout',
)

assert.equal(screenELineSize(200, 0), 48, 'small screens clamp line 1 to 48 CSS pixels')
assert.equal(screenELineSize(2000, 0), 64, 'large screens clamp line 1 to 64 CSS pixels')
assert.throws(() => screenELineSize(390, 14), RangeError, 'unknown lines fail closed')

const chartPositions = SCREEN_E_LINE_MULTIPLIERS.map((_, index) => screenEChartPosition(390, 3, index))
assert.deepEqual(
  chartPositions.slice(0, 2).map(position => position.phase),
  ['opening', 'opening'],
  'the selected marker descends through opening rows before central tracking',
)
assert.deepEqual(
  chartPositions.slice(2, 9).map(position => position.phase),
  Array(7).fill('tracking'),
  'the middle rows retain a central marker while the complete strip travels',
)
assert.deepEqual(
  chartPositions.slice(9).map(position => position.phase),
  Array(5).fill('closing'),
  'the selected marker descends again through the final rows',
)
for (let index = 1; index < chartPositions.length; index += 1) {
  assert.ok(
    chartPositions[index].stripOffsetY <= chartPositions[index - 1].stripOffsetY,
    'the chart strip never reverses direction',
  )
}
assert.ok(chartPositions[1].markerY > chartPositions[0].markerY, 'opening marker descends')
assert.equal(chartPositions[2].markerY, chartPositions[8].markerY, 'tracking marker stays centered')
for (let index = 9; index < chartPositions.length; index += 1) {
  assert.ok(chartPositions[index].markerY > chartPositions[index - 1].markerY, 'every closing marker transition descends')
}
assert.equal(chartPositions[8].stripOffsetY, chartPositions[9].stripOffsetY, 'strip stops before final descent')
for (let index = 9; index < chartPositions.length; index += 1) {
  assert.ok(
    chartPositions[index].rowCenters[index] - chartPositions[index].rowCenters[index - 1] <= 19,
    'fine rows remain a continuous visual ladder without oversized empty bands',
  )
}
assert.ok(
  chartPositions.at(-1)!.markerY > 200 && chartPositions.at(-1)!.markerY < SCREEN_E_CHART_STAGE_HEIGHT,
  'the compact fine-row ladder still ends near the controls',
)
assert.equal(SCREEN_E_CHART_STAGE_HEIGHT, 260, 'the chart viewport is a stable clipped stage')
const responsePad = screenEResponsePadLayout()
assert.equal(responsePad.buttonSize, SCREEN_E_RESPONSE_BUTTON_SIZE)
assert.ok(responsePad.buttonSize >= 44, 'every response target meets the 44 CSS pixel minimum')
assert.equal(responsePad.padHeight, 160, 'the response dock has invariant geometry')
assert.equal(SCREEN_E_QUICK_CHECK_STIMULUS_STAGE_HEIGHT, 80, 'single-E stage height is fixed across rows')

for (const [transcript, expected] of [
  ['stay', 'stay'],
  ['STAY PUT!', 'stay'],
  ['same distance', 'stay'],
  ['keep the same distance please', 'stay'],
  ['further', 'further'],
  ['farther', 'further'],
  ['move a little bit further', 'further'],
] as const) {
  assert.equal(parseScreenEDistanceChoice(transcript), expected, `distance voice accepts "${transcript}"`)
}
for (const transcript of [
  '',
  'move',
  'go',
  'next',
  'up',
  'down',
  'left',
  'right',
  'stay then go further',
  'same distance but farther',
]) {
  assert.equal(parseScreenEDistanceChoice(transcript), null, `distance voice rejects "${transcript}"`)
}

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
assert.equal(evidence.totalLines, 14)
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
const staleSevenRowEvidence = {
  exerciseId: SCREEN_DIRECTIONAL_E_PROTOCOL,
  marker: 'stale-opening',
  metrics: { protocolVersion: 1, totalLines: 7 },
}
const currentFourteenRowEvidence = {
  exerciseId: SCREEN_DIRECTIONAL_E_PROTOCOL,
  marker: 'current-runner',
  metrics: { protocolVersion: SCREEN_DIRECTIONAL_E_VERSION, totalLines: SCREEN_E_LINE_MULTIPLIERS.length },
}
assert.deepEqual(
  mergeResultsPreservingOpeningScreenCheck(
    [staleSevenRowEvidence],
    [pursuitResult, currentFourteenRowEvidence],
  ),
  [pursuitResult, currentFourteenRowEvidence],
  'a stale seven-row result cannot block or masquerade as the new fourteen-row evidence',
)
assert.deepEqual(
  mergeResultsPreservingOpeningScreenCheck([staleSevenRowEvidence], [pursuitResult]),
  [pursuitResult],
  'stale screen evidence is not resubmitted after the geometry version changes',
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
  binocular: readFileSync(new URL('../src/components/Vision/Training/BinocularChart.tsx', import.meta.url), 'utf8'),
  daily: readFileSync(new URL('../src/components/Vision/Training/DailyPractice.tsx', import.meta.url), 'utf8'),
  weekly: readFileSync(new URL('../src/components/Vision/Training/WeeklyAssessment.tsx', import.meta.url), 'utf8'),
  runner: readFileSync(new URL('../src/components/Vision/Training/SessionRunner.tsx', import.meta.url), 'utf8'),
  training: readFileSync(new URL('../src/components/Vision/Training/TrainingSession.tsx', import.meta.url), 'utf8'),
  picker: readFileSync(new URL('../src/components/Vision/Training/ScreenEStylePicker.tsx', import.meta.url), 'utf8'),
  vision: readFileSync(new URL('../src/components/Vision/VisionTraining.tsx', import.meta.url), 'utf8'),
  header: readFileSync(new URL('../src/components/Navigation/Header.tsx', import.meta.url), 'utf8'),
  portalHeader: readFileSync(new URL('../src/components/Navigation/PortalHeader.tsx', import.meta.url), 'utf8'),
  protocols: readFileSync(new URL('../src/data/visionProtocols.ts', import.meta.url), 'utf8'),
  curriculum: readFileSync(new URL('../src/components/Vision/Training/CurriculumOverview.tsx', import.meta.url), 'utf8'),
}

for (const [name, source] of Object.entries(sources)) {
  assert.doesNotMatch(source, /20\/\d+/, `${name} renders no uncalibrated medical acuity score`)
  assert.doesNotMatch(source, /sharper by/i, `${name} makes no unsupported line-gain claim`)
}

assert.match(sources.quick, /screenELineSize\(viewportWidth, lineIndex, devicePixelRatio\)/)
assert.match(sources.quick, /strokeWeight="normal"/, 'baseline and retake checks stay explicitly normal, which is Crisp')
assert.match(sources.chart, /screenELineSize\(viewportWidth, lineIdx, viewportDevicePixelRatio\)/)
assert.match(sources.chart, /screenEStyle = DEFAULT_SCREEN_E_STYLE/)
assert.match(sources.chart, /screenEStyle=\{screenEStyle\}/)
assert.doesNotMatch(sources.chart, /<SnellenLetter[\s\S]{0,160}screenEStyle=/, 'letter rendering never receives the E-only style')
assert.match(sources.picker, /import \{ TumblingE \} from '\.\/SnellenChart'/, 'the selector uses the production vector optotype')
assert.equal((sources.picker.match(/<TumblingE/g) || []).length, 1, 'both style cards are generated through one production specimen seam')
assert.match(sources.picker, /role="radiogroup"/)
assert.match(sources.picker, /role="radio"/)
assert.match(sources.picker, /aria-checked=\{selected\}/)
assert.match(sources.picker, /min-h-11/)
assert.match(sources.picker, /grid grid-cols-2/)
assert.match(sources.picker, /same 14-row workout\. Only the line weight changes\./)
assert.match(sources.picker, /Baseline checks stay Crisp so results remain comparable\./)
assert.doesNotMatch(sources.picker, /Whisper|voiceDirection|voiceEnabled|Mic/)
assert.match(sources.training, /!isActive && !sessionComplete && exerciseType === 'e-directional' && !isBinocular/)
assert.match(sources.training, /screenEStyle=\{activeScreenEStyle\}/)
assert.match(sources.vision, /trainerExerciseType === 'e-directional' && binocularMode === 'off'/)
assert.match(sources.vision, /screenEStyle=\{screenEStyle\}/)
assert.match(sources.quick, /SCREEN_E_TRIALS_PER_LINE/)
assert.match(sources.quick, /SCREEN_E_CORRECT_TO_PASS/)
assert.match(sources.quick, /SCREEN_E_QUICK_CHECK_STIMULUS_STAGE_HEIGHT/)
assert.match(sources.chart, /screenEChartPosition/)
assert.match(sources.chart, /SCREEN_E_CHART_STAGE_HEIGHT/)
assert.match(sources.chart, /data-screen-e-response-pad/)
assert.match(sources.chart, /data-screen-e-response-dock/)
assert.match(sources.chart, /shapeRendering="crispEdges"/)
assert.match(sources.binocular, /showDistancePromptRef/, 'the existing binocular prompt ref remains the donor seam')
assert.match(sources.binocular, /distanceActionsRef/, 'the existing binocular stable action ref remains the donor seam')
assert.match(sources.chart, /showDistancePromptRef/)
assert.match(sources.chart, /parseScreenEDistanceChoice\(rawTranscript\)/)
assert.match(sources.chart, /distanceChoiceActionRef\.current\(distanceChoice\)/)
assert.match(sources.chart, /const handleDistanceChoice = \(choice: ScreenEDistanceChoice\)/)
assert.match(sources.chart, /onClick=\{\(\) => handleDistanceChoice\('further'\)\}/)
assert.match(sources.chart, /onClick=\{\(\) => handleDistanceChoice\('stay'\)\}/)
assert.match(sources.chart, /if \(!showDistancePromptRef\.current \|\| distanceChoiceClaimedRef\.current\) return/)
assert.equal(
  (sources.chart.match(/distanceChoiceClaimedRef\.current = false/g) || []).length,
  1,
  'the distance one-shot resets only when a fresh completion prompt opens',
)
assert.match(sources.chart, /Listening — say Stay or Further/)
const distancePromptStart = sources.chart.indexOf('{showDistancePrompt &&')
const distancePromptEnd = sources.chart.indexOf('{/* Input buttons', distancePromptStart)
const distancePromptSource = sources.chart.slice(distancePromptStart, distancePromptEnd)
assert.equal(
  (distancePromptSource.match(/className="min-h-11/g) || []).length,
  2,
  'Stay and Further remain 44 CSS pixel manual fallbacks',
)
assert.equal(
  (sources.chart.match(/WhisperService\.start\(mode/g) || []).length,
  1,
  'voice recognition retains one on-demand start path',
)
assert.match(sources.chart, /if \(!voiceEnabled\) \{[\s\S]*?WhisperService\.stop\(\)/)
assert.match(sources.chart, /\}, \[voiceEnabled, exerciseType\]\)/)
const promptParserIndex = sources.chart.indexOf('parseScreenEDistanceChoice(rawTranscript)')
const ordinaryAnswerIndex = sources.chart.indexOf('if (!answer) return', promptParserIndex)
assert.ok(promptParserIndex >= 0 && ordinaryAnswerIndex > promptParserIndex, 'prompt speech is intercepted before ordinary direction handling')
assert.match(
  sources.chart,
  /if \(answer\.type === 'direction' && exerciseType === 'e-directional'\) \{\s*window\.dispatchEvent\(new CustomEvent\('voiceDirection', \{ detail: answer\.value \}\)\)/,
  'ordinary direction recognition keeps its existing event path outside the prompt',
)
assert.match(sources.training, /data-rb-vision-training-active/)
assert.match(sources.training, /data-rb-vision-target-distance-cm=\{targetDistanceCm\}/)
assert.match(sources.training, /removeAttribute\('data-rb-vision-training-active'\)/)
assert.match(sources.training, /\[data-rb-site-header\]/)
assert.match(sources.training, /\[data-rb-portal-header\]/)
assert.match(sources.training, /SnellenChart and BinocularChart own row progression/)
assert.match(sources.training, /progressionMode="line-by-line"/)
const trainingAnswerStart = sources.training.indexOf('const handleAnswer =')
const trainingAnswerEnd = sources.training.indexOf('// Handle distance progression', trainingAnswerStart)
const trainingAnswer = sources.training.slice(trainingAnswerStart, trainingAnswerEnd)
assert.match(trainingAnswer, /setAttempts\(prev => prev \+ 1\)/)
assert.match(trainingAnswer, /setCorrect\(prev => prev \+ 1\)/)
assert.doesNotMatch(
  trainingAnswer,
  /newAttempts|newAccuracy|setCurrentLevel|setAttempts\(0\)|setCorrect\(0\)|setSessionComplete|setIsActive|saveSession|setResetTrigger/,
  'the outer shell cannot level, reset, or terminate a chart-owned progression',
)
assert.equal(
  (trainingAnswer.match(/setTimeout\(/g) || []).length,
  1,
  'the only remaining answer timer clears feedback and never advances progression',
)
assert.doesNotMatch(sources.training, /\{attempts\}\/10/, 'TrainingSession renders no obsolete ten-answer denominator')
assert.match(sources.training, /\{accuracy\.toFixed\(0\)\}% \(\{correct\}\/\{attempts\}\)/)
assert.match(sources.training, />\{correct\}\/\{attempts\}</)
assert.match(sources.training, /const saveSession = async/)
assert.match(sources.training, /const resetSession = \(\) =>/)
assert.match(sources.training, /title="Exit training \(ESC\)"/)
assert.match(sources.header, /data-rb-site-header/)
assert.match(sources.portalHeader, /data-rb-portal-header/)
assert.match(sources.quick, /\[flowKey, stage\]/, 'each check stage recenters the optotype on screen')
assert.match(sources.quick, /className="grid gap-3 sm:grid-cols-2"/, 'phone result actions stack before the small-screen breakpoint')
assert.match(sources.quick, /Far testing stays unavailable/)
assert.doesNotMatch(sources.quick, /stage === 'far'|across the room|Reposition for far/)
assert.match(sources.chart, /export const E_DIRECTIONS = SCREEN_E_DIRECTIONS/)
assert.match(sources.weekly, /aria-label="Measured near-point distance"/)
assert.match(sources.weekly, /aria-valuetext=/)
assert.doesNotMatch(sources.protocols, /Snellen/, 'program copy contains no legacy false-acuity promise')
assert.doesNotMatch(sources.curriculum, /Snellen/, 'curriculum copy contains no legacy false-acuity promise')
assert.doesNotMatch(
  sources.protocols,
  /(?:record|log)[^'"\n]*(?:near|far)[^'"\n]*(?:result|score)|(?:near|far)[^'"\n]*self-check/i,
  'program copy cannot promise unsupported near/far results',
)
assert.doesNotMatch(
  sources.curriculum,
  /practice near and far detail/i,
  'curriculum frames this lane as distance switching, not a far-acuity result',
)
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
assert.match(sources.daily, /activeStageRef\.current\?\.scrollIntoView\(\{ block: 'start' \}\)/)
assert.match(sources.daily, /activeStageRef\.current\?\.focus\(\{ preventScroll: true \}\)/)
assert.match(sources.daily, /\[activeStageKey\]/, 'every Day 1 stage transition recenters and focuses the active panel')
assert.match(sources.runner, /performedCount === 0/)
assert.match(sources.runner, /Nothing was added to your training total/)
assert.match(sources.runner, /Day \{day\} is ready whenever you return/)
assert.match(sources.runner, /reportKind !== 'none'/, 'all-skipped runs show no false session score')
assert.match(sources.runner, /reportKind === 'complete' && tomorrow/, 'tomorrow copy appears only after the full guided dose')
assert.match(sources.runner, /performedExerciseIds:\s*resultsRef\.current\.map\(r => r\.exerciseId\)/)
assert.match(sources.daily, /\.\.\.payload\.performedExerciseIds/)
assert.match(
  sources.daily,
  /completedCurrentExerciseIds\.length === currentExerciseIds\.length/,
  'empty or partial guided results cannot expose the server completion action',
)
assert.doesNotMatch(sources.runner, /sessionsCompleted \+ 1\} sessions/)
assert.doesNotMatch(sources.runner, /of training banked/)

console.log('Vision screen-directional-E honesty checks passed.')
