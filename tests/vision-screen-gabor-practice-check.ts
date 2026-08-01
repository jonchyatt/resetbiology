import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SCREEN_E_LINE_LETTER_COUNTS, SCREEN_E_LINE_MULTIPLIERS } from '../src/lib/vision/screenDirectionalE'
import {
  DEFAULT_SCREEN_PRACTICE_MODE,
  SCREEN_GABOR_FREQUENCY_CYCLES,
  SCREEN_GABOR_MEAN_GRAY,
  SCREEN_GABOR_MIN_PHYSICAL_PX,
  SCREEN_GABOR_ORIENTATION_MANIFEST,
  SCREEN_GABOR_PRACTICE_VERSION,
  SCREEN_GABOR_RASTER_MODE,
  SCREEN_PRACTICE_MODE_REGISTRY,
  balancedScreenGaborChoices,
  parseScreenGaborChoice,
  resolveScreenPracticeMode,
  screenGaborChoiceForOrientation,
  screenGaborLineSize,
  screenGaborManifestEntry,
} from '../src/lib/vision/screenGaborPractice'

assert.equal(SCREEN_GABOR_PRACTICE_VERSION, 'screen-gabor-orientation-v1')
assert.deepEqual(Object.keys(SCREEN_PRACTICE_MODE_REGISTRY), ['crisp', 'thin', 'gabor'])
assert.equal(DEFAULT_SCREEN_PRACTICE_MODE, 'crisp', 'Crisp remains the protected practice default')
assert.equal(resolveScreenPracticeMode('gabor'), 'gabor')
assert.equal(resolveScreenPracticeMode('unknown'), 'crisp', 'unknown practice modes fail closed to Crisp')
assert.ok(Object.isFrozen(SCREEN_PRACTICE_MODE_REGISTRY), 'the presentation registry is immutable')
assert.equal(SCREEN_GABOR_MEAN_GRAY, '#808080', 'the stimulus field uses calibrated mid-gray')
assert.equal(SCREEN_GABOR_RASTER_MODE, 'mean-matched-opaque', 'the procedural patch is mean-matched to its field')
assert.equal(SCREEN_GABOR_FREQUENCY_CYCLES, 3, 'all chart and response specimens share three cycles')

assert.equal(SCREEN_GABOR_ORIENTATION_MANIFEST.length, 8, 'the compass exposes eight unique choices')
assert.ok(Object.isFrozen(SCREEN_GABOR_ORIENTATION_MANIFEST), 'the orientation map is immutable')
assert.deepEqual(
  SCREEN_GABOR_ORIENTATION_MANIFEST.map(entry => ({
    choice: entry.choice,
    angle: entry.orientationDegrees,
    cell: [entry.row, entry.column],
  })),
  [
    { choice: 1, angle: 0, cell: [0, 0] },
    { choice: 2, angle: 22.5, cell: [0, 1] },
    { choice: 3, angle: 45, cell: [0, 2] },
    { choice: 4, angle: 67.5, cell: [1, 2] },
    { choice: 5, angle: 90, cell: [2, 2] },
    { choice: 6, angle: 112.5, cell: [2, 1] },
    { choice: 7, angle: 135, cell: [2, 0] },
    { choice: 8, angle: 157.5, cell: [1, 0] },
  ],
  'one permanent clockwise number, angle, and compass cell controls every input path',
)
assert.equal(
  new Set(SCREEN_GABOR_ORIENTATION_MANIFEST.map(entry => entry.orientationDegrees % 180)).size,
  8,
  'all eight axial orientations are perceptually unique',
)
for (const entry of SCREEN_GABOR_ORIENTATION_MANIFEST) {
  assert.equal(screenGaborManifestEntry(entry.choice).orientationDegrees, entry.orientationDegrees)
  assert.equal(screenGaborChoiceForOrientation(entry.orientationDegrees + 180), entry.choice)
}

for (const count of new Set(SCREEN_E_LINE_LETTER_COUNTS)) {
  const choices = balancedScreenGaborChoices(count, () => 0)
  assert.equal(choices.length, count)
  assert.equal(new Set(choices).size, count, `a ${count}-target row cannot repeat an orientation`)
}
assert.throws(() => balancedScreenGaborChoices(0), RangeError)
assert.throws(() => balancedScreenGaborChoices(9), RangeError)

for (const [transcript, expected] of [
  ['1', 1], ['one', 1], ['choice one', 1],
  ['2', 2], ['two', 2], ['number three', 3],
  ['FOUR!', 4], ['five', 5], ['6', 6], ['seven', 7], ['eight', 8],
] as const) {
  assert.equal(parseScreenGaborChoice(transcript), expected, `voice accepts the single choice "${transcript}"`)
}
for (const transcript of ['', 'nine', 'up', 'one two', '1 and 2', 'two, two', 'stay further']) {
  assert.equal(parseScreenGaborChoice(transcript), null, `voice refuses ambiguous or unrelated speech "${transcript}"`)
}

assert.equal(SCREEN_E_LINE_MULTIPLIERS.length, 14, 'Gabor reuses every additive chart row')
assert.equal(
  SCREEN_E_LINE_LETTER_COUNTS.reduce((total, count) => total + count, 0),
  94,
  'Gabor reuses the full ninety-four-target journey',
)
for (const devicePixelRatio of [1, 2, 3]) {
  const sizes = SCREEN_E_LINE_MULTIPLIERS.map((_, index) => screenGaborLineSize(390, index, devicePixelRatio))
  for (let index = 1; index < sizes.length; index += 1) {
    assert.ok(sizes[index] < sizes[index - 1], `DPR ${devicePixelRatio} keeps every row separately smaller`)
  }
  for (const size of sizes) {
    assert.equal(size * devicePixelRatio, Math.round(size * devicePixelRatio), 'every Gabor lands on the physical-pixel grid')
  }
  assert.ok(
    sizes.at(-1)! * devicePixelRatio >= SCREEN_GABOR_MIN_PHYSICAL_PX,
    `DPR ${devicePixelRatio} preserves the finest three-cycle stimulus instead of collapsing it`,
  )
}
assert.throws(() => screenGaborLineSize(390, 14), RangeError)

const sources = {
  gabor: readFileSync(new URL('../src/components/Vision/Training/GaborPatch.tsx', import.meta.url), 'utf8'),
  compass: readFileSync(new URL('../src/components/Vision/Training/GaborResponseCompass.tsx', import.meta.url), 'utf8'),
  chart: readFileSync(new URL('../src/components/Vision/Training/SnellenChart.tsx', import.meta.url), 'utf8'),
  training: readFileSync(new URL('../src/components/Vision/Training/TrainingSession.tsx', import.meta.url), 'utf8'),
  picker: readFileSync(new URL('../src/components/Vision/Training/ScreenEStylePicker.tsx', import.meta.url), 'utf8'),
  quick: readFileSync(new URL('../src/components/Vision/Training/SnellenQuickCheck.tsx', import.meta.url), 'utf8'),
}

assert.match(sources.gabor, /rasterMode = 'legacy-opaque'/, 'existing Gabor callers keep their protected default')
assert.match(sources.gabor, /rasterMode,\s*\.\.\.\(animate/, 'the shared renderer receives the opt-in raster mode')
assert.match(sources.compass, /max-w-\[354px\]/)
assert.match(sources.compass, /grid grid-cols-3 grid-rows-3/)
assert.match(sources.compass, /min-h-\[72px\]/, 'all eight touch targets exceed forty-four CSS pixels')
assert.match(sources.compass, /data-screen-gabor-neutral-center/)
assert.equal((sources.compass.match(/bg-\[#808080\]/g) || []).length, 2, 'choice tiles and neutral center share one gray')
assert.doesNotMatch(sources.compass, /onClick[^\n]*neutral|ring-\[#777777\]/, 'the center is neutral and noninteractive')
assert.match(sources.chart, /screenGaborLineSize\(viewportWidth, lineIdx, viewportDevicePixelRatio\)/)
assert.match(sources.chart, /gaborChoices: balancedScreenGaborChoices\(line\.letterCount\)/)
assert.match(sources.chart, /data-screen-gabor-target-choice=\{choice\}/)
assert.match(sources.chart, /rasterMode=\{SCREEN_GABOR_RASTER_MODE\}/)
assert.match(sources.chart, /backgroundColor=\{SCREEN_GABOR_MEAN_GRAY\}/)
assert.match(sources.chart, /<GaborResponseCompass onSelect=\{handleGaborAnswer\}/)
assert.match(sources.chart, /if \(!acceptingAnswerRef\.current\) return/)
assert.equal((sources.chart.match(/WhisperService\.start\(mode/g) || []).length, 1, 'one recognizer serves E, letters, Gabor, and distance speech')
const gaborParserIndex = sources.chart.indexOf('parseScreenGaborChoice(rawTranscript)')
const ordinaryParserIndex = sources.chart.indexOf('if (!answer) return', gaborParserIndex)
assert.ok(gaborParserIndex >= 0 && ordinaryParserIndex > gaborParserIndex, 'spoken numbers route before the old parser rejects them')
assert.match(sources.training, /exerciseType: activePracticeMode === 'gabor' \? 'gabor-orientation' : exerciseType/)
assert.match(sources.training, /isBinocular && selectedPracticeMode === 'gabor'[\s\S]*?\? 'crisp'/, 'binocular presentation fails closed to Crisp')
assert.match(sources.picker, /Gabor is practice-only/)
assert.doesNotMatch(sources.quick, /screenGaborPractice|practiceMode|GaborPatch/, 'baseline and retake remain isolated from Gabor practice')

console.log('Vision screen-Gabor practice checks passed.')
