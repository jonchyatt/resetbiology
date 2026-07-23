import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { completedExerciseIdsForSession } from '../src/components/Vision/Training/DailyPractice'

const dayThree = {
  day: 3,
  title: 'Focus Introduction',
  focus: 'Begin convergence training',
  baselineMinutes: 3,
  exerciseMinutes: 15,
  exerciseIds: ['palming-reset', 'focus-pushups'],
  exercises: [
    { id: 'palming-reset' },
    { id: 'focus-pushups' },
  ],
  coachingCues: [],
  totalMinutes: 18,
}

assert.deepEqual(
  completedExerciseIdsForSession(
    ['palming-reset', 'box-breath-vision', 'box-breath-vision'],
    dayThree,
  ),
  ['palming-reset'],
  'only identifiers belonging to the active day count, in active-day order and without duplicates',
)
assert.deepEqual(
  completedExerciseIdsForSession(['box-breath-vision'], dayThree),
  [],
  'a previous-day-only completion cannot hide the active day guided session',
)
assert.deepEqual(
  completedExerciseIdsForSession(
    ['focus-pushups', 'palming-reset'],
    dayThree,
  ),
  ['palming-reset', 'focus-pushups'],
  'the completion gate opens only when every active-day identifier is complete',
)

const source = readFileSync(
  new URL('../src/components/Vision/Training/DailyPractice.tsx', import.meta.url),
  'utf8',
)
const advanceStart = source.indexOf('const handleAdvanceDay = async () =>')
const advanceEnd = source.indexOf('const handleEnroll = async () =>', advanceStart)
assert.ok(advanceStart >= 0 && advanceEnd > advanceStart, 'tester day-advance handler is present')
const advanceHandler = source.slice(advanceStart, advanceEnd)

const successGuard = advanceHandler.indexOf('if (!response.ok || !data.success) return')
assert.ok(successGuard >= 0, 'failed tester advancement returns before changing session state')

for (const reset of [
  'setSessionStarted(false)',
  'setBaselineComplete(false)',
  'setCompletedExercises([])',
  'setActiveExercise(0)',
  'setEngineResults([])',
  'setShowGuidedRunner(false)',
  'setShowBreathWarmup(false)',
  "setBreathWarmupStatus('pending')",
  'setShowQuickCheck(false)',
  'setShowSnellenTrainer(false)',
  'setShowWeeklyAssessment(false)',
  "setSessionNotes('')",
]) {
  const resetIndex = advanceHandler.indexOf(reset)
  assert.ok(resetIndex > successGuard, `${reset} runs only after confirmed advancement`)
}

assert.match(
  advanceHandler,
  /await loadProgram\(\)[\s\S]*finally\s*{[\s\S]*setAdvancingDay\(false\)/,
  'the next day loads before tester advancement is released',
)
assert.doesNotMatch(
  advanceHandler,
  /setBreathWarmupEnabled|setBreathWarmupMinutes|setNearSnellenResult|setFarSnellenResult|localStorage/,
  'advancement does not erase member preferences or persisted baselines',
)
assert.doesNotMatch(
  source,
  /completedExercises\.length/,
  'raw prior-day completion length cannot control active-session behavior',
)
assert.match(
  source,
  /exercisesCompleted:\s*completedCurrentExerciseIds/,
  'session submission contains only active-day exercise identifiers',
)
assert.match(
  source,
  /const completedCurrentExerciseIds = completedExerciseIdsForSession\([\s\S]*?completedExercises,[\s\S]*?todaySession\.session/,
  'submission derives its completion evidence from the active session',
)

console.log('Vision tester day-advance state checks passed.')
