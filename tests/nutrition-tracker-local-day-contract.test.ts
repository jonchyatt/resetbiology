import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dayKeyToUtcMidnight, localDayKey } from '../src/lib/localDay'

const tracker = readFileSync(new URL('../src/components/Nutrition/NutritionTracker.tsx', import.meta.url), 'utf8')

assert.match(
  tracker,
  /import \{ dayKeyToUtcMidnight, localDayKey, todayLocalKey \} from "@\/lib\/localDay"/,
  'Today, History, and their labels must use the shared local-day authority',
)
assert.doesNotMatch(tracker, /function localDayString\(/, 'the tracker must not retain a private day helper')
assert.doesNotMatch(
  tracker,
  /toISOString\(\)\.split\(['"]T['"]\)\[0\]/,
  'History must not bucket entries by their UTC calendar date',
)
assert.match(tracker, /const today = todayLocalKey\(\)/, 'Today must resolve through the shared today helper')
assert.match(
  tracker,
  /\.filter\(\(e\) => \(e\.localDate \|\| localDayKey\(new Date\(e\.loggedAt\)\)\) === today\)/,
  'Today must prefer the captured day and use the shared fallback only for a legacy FoodLog',
)
assert.match(tracker, /localDate: e\.localDate \?\? null/, 'the captured day must survive the History mapping')
assert.match(
  tracker,
  /const key = entry\.localDate \|\| localDayKey\(new Date\(entry\.loggedAt\)\)/,
  'History must use the same captured-day-first rule as Today',
)
assert.match(tracker, /const date = dayKeyToUtcMidnight\(key\)/, 'History display dates must derive from the bucket key')
assert.match(
  tracker,
  /label: date\.toLocaleDateString\(undefined, \{ weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' \}\)/,
  'the descriptive History label must not shift the key during display conversion',
)
assert.match(
  tracker,
  /dateLabel: date\.toLocaleDateString\(undefined, \{ timeZone: 'UTC' \}\)/,
  'the numeric History label must not shift the key during display conversion',
)
assert.match(tracker, /\{group\.dateLabel\}/, 'History must render the key-derived numeric label')
assert.match(
  tracker,
  /group\.entries\.sort\(\(a, b\) => new Date\(b\.loggedAt\)\.getTime\(\) - new Date\(a\.loggedAt\)\.getTime\(\)\)/,
  'within-day entries must retain newest-first timestamp ordering',
)

const nutrientField = { calories: 'kcal', protein: 'protein_g', carbs: 'carb_g', fats: 'fat_g', fiber: 'fiber_g' }
for (const [total, nutrient] of Object.entries(nutrientField)) {
  assert.ok(
    tracker.includes(`group.totals.${total} += num(entry.nutrients?.${nutrient})`),
    `${total} totals must remain derived from every entry in the resolved day`,
  )
}

for (const capability of [
  "(['today', 'history'] as const).map((tab)",
  'onClick={() => setActiveTab(tab)}',
  'onClick={refreshAll}',
  'toggleFavoriteFromHistory(entry, e)',
  'handleEditEntry(entry)',
  'handleDeleteEntry(entry.id)',
  'copyPreviousDay',
  '<MacroGoals',
]) {
  assert.ok(tracker.includes(capability), `${capability} must remain available`)
}

type Fixture = {
  label: string
  instant: string
  timeZone: string
  expected: string
}

const midnightFixtures: Fixture[] = [
  { label: 'UTC before midnight', instant: '2026-07-15T23:30:00.000Z', timeZone: 'UTC', expected: '2026-07-15' },
  { label: 'UTC after midnight', instant: '2026-07-16T00:30:00.000Z', timeZone: 'UTC', expected: '2026-07-16' },
  { label: 'EST before midnight', instant: '2026-01-16T04:30:00.000Z', timeZone: 'America/New_York', expected: '2026-01-15' },
  { label: 'EST after midnight', instant: '2026-01-16T05:30:00.000Z', timeZone: 'America/New_York', expected: '2026-01-16' },
  { label: 'EDT before midnight', instant: '2026-07-16T03:30:00.000Z', timeZone: 'America/New_York', expected: '2026-07-15' },
  { label: 'EDT after midnight', instant: '2026-07-16T04:30:00.000Z', timeZone: 'America/New_York', expected: '2026-07-16' },
  { label: 'MST before midnight', instant: '2026-01-16T06:30:00.000Z', timeZone: 'America/Phoenix', expected: '2026-01-15' },
  { label: 'MST after midnight', instant: '2026-01-16T07:30:00.000Z', timeZone: 'America/Phoenix', expected: '2026-01-16' },
]

for (const fixture of midnightFixtures) {
  assert.equal(localDayKey(new Date(fixture.instant), fixture.timeZone), fixture.expected, fixture.label)
}

const conflictingStoredLog = { localDate: '2026-07-15', loggedAt: '2026-07-16T12:00:00.000Z' }
const capturedDayFirst = conflictingStoredLog.localDate || localDayKey(new Date(conflictingStoredLog.loggedAt), 'UTC')
assert.equal(capturedDayFirst, '2026-07-15', 'stored localDate must win over a conflicting UTC timestamp')

const legacyFoodLog = { localDate: null as string | null, loggedAt: '2026-07-16T03:30:00.000Z' }
const todayKey = legacyFoodLog.localDate || localDayKey(new Date(legacyFoodLog.loggedAt), 'America/New_York')
const historyKey = legacyFoodLog.localDate || localDayKey(new Date(legacyFoodLog.loggedAt), 'America/New_York')
assert.equal(todayKey, '2026-07-15', 'a legacy FoodLog must fall back through the shared member-local helper')
assert.equal(historyKey, todayKey, 'Today and History must resolve the same day key')

const displayDate = dayKeyToUtcMidnight(historyKey)
const descriptiveLabel = displayDate.toLocaleDateString('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})
const numericLabel = displayDate.toLocaleDateString('en-US', { timeZone: 'UTC' })
assert.equal(descriptiveLabel, 'Wed, Jul 15', 'the descriptive label must represent the resolved key')
assert.equal(numericLabel, '7/15/2026', 'the numeric label must represent the same resolved key')

console.log('nutrition tracker local-day contract: PASS')
