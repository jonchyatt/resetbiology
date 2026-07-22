import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dayKeyToUtcMidnight, localDayKey } from '../src/lib/localDay'
import {
  isVisionSessionCompleteForDay,
  previousVisionDayKey,
  validateVisionLocalDayInput,
  visionProgramStartDay,
  visionProgramSessionForLocalDay,
} from '../src/lib/vision/localDayInput'
import { effectiveStartDate, getTodaySession } from '../src/data/visionProtocols'

function expectValid(localDate: string, timeZone: string, now: string) {
  const result = validateVisionLocalDayInput({ localDate, timeZone }, new Date(now))
  assert.equal(result.ok, true, `${timeZone} ${now} should accept ${localDate}`)
}

// Denver is still on July 21 after the UTC day has already become July 22.
expectValid('2026-07-21', 'America/Denver', '2026-07-22T05:30:00.000Z')
expectValid('2026-07-22', 'America/Denver', '2026-07-22T06:30:00.000Z')

// The spring-forward hour changes, but the member's calendar date does not.
expectValid('2026-03-08', 'America/Denver', '2026-03-08T08:30:00.000Z')
expectValid('2026-03-08', 'America/Denver', '2026-03-08T09:30:00.000Z')

for (const [input, now, message] of [
  [{ localDate: '2026-07-21', timeZone: 'Mars/Olympus' }, '2026-07-22T05:30:00.000Z', 'malformed timezone'],
  [{ localDate: '2026-02-30', timeZone: 'America/Denver' }, '2026-03-02T18:00:00.000Z', 'malformed day'],
  [{ localDate: '2026-07-22', timeZone: 'America/Denver' }, '2026-07-22T05:30:00.000Z', 'day/timezone mismatch'],
] as const) {
  const result = validateVisionLocalDayInput(input, new Date(now))
  assert.equal(result.ok, false, `${message} must be rejected`)
}

const enrollmentStart = visionProgramStartDay(new Date('2026-07-22T05:30:00.000Z'), 'America/Denver')
const localProgramDay = getTodaySession(effectiveStartDate({ startDate: enrollmentStart }), dayKeyToUtcMidnight('2026-07-21'))
assert.equal(localProgramDay.week, 1, 'Denver late evening stays in week one')
assert.equal(localProgramDay.day, 1, 'Denver late evening remains day one after UTC rollover')

for (const scenario of [
  { timeZone: 'America/Denver', instant: '2026-07-22T05:30:00.000Z', localDate: '2026-07-21' },
  { timeZone: 'America/New_York', instant: '2026-07-22T03:30:00.000Z', localDate: '2026-07-21' },
] as const) {
  const enrollment = { startDate: new Date(scenario.instant), testDayOffset: null }
  const dayOne = visionProgramSessionForLocalDay(enrollment, scenario.localDate, scenario.timeZone)
  const withCursor = visionProgramSessionForLocalDay({ ...enrollment, testDayOffset: 8 }, scenario.localDate, scenario.timeZone)
  assert.deepEqual(
    { week: dayOne.week, day: dayOne.day },
    { week: 1, day: 1 },
    `${scenario.timeZone} late-day enrollment starts at local day one after UTC rollover`,
  )
  assert.deepEqual(
    { week: withCursor.week, day: withCursor.day },
    { week: 2, day: 2 },
    `${scenario.timeZone} tester cursor uses calendar days without changing enrollment start`,
  )
}

const sessions = [
  { localDate: '2026-07-21', week: 1, day: 1 },
  { localDate: '2026-07-20', week: 1, day: 1 },
]
assert.equal(isVisionSessionCompleteForDay(sessions, '2026-07-21', 1, 1), true, 'current local-day completion is found')
assert.equal(isVisionSessionCompleteForDay(sessions, '2026-07-22', 1, 1), false, 'a UTC-next-day lookup cannot borrow yesterday completion')

assert.equal(previousVisionDayKey('2026-03-09'), '2026-03-08', 'streak continuation crosses the 23-hour spring-forward day by calendar key')
assert.equal(previousVisionDayKey('2026-11-02'), '2026-11-01', 'streak continuation crosses the 25-hour fall-back day by calendar key')
assert.equal(
  localDayKey(new Date('2026-03-09T05:30:00.000Z'), 'America/Denver'),
  previousVisionDayKey('2026-03-09'),
  'a prior local-day session continues the streak after DST',
)

for (const [script, marker] of [
  ['scripts/vision-journey-verify.mjs', 'const isVisionProgram'],
  ['scripts/foreman-live-probe.mjs', 'const isVisionProgram'],
  ['scripts/abort-visibility-probe.mjs', 'const visionProgramApi'],
] as const) {
  const source = readFileSync(new URL(`../${script}`, import.meta.url), 'utf8')
  assert.ok(source.includes(marker), `${script} routes every Vision Program probe through its metadata helper`)
  assert.doesNotMatch(source, /fetch\(['"]\/api\/vision\/program/, `${script} has no unadorned Vision Program fetch`)
}

console.log('Vision local-day checks passed.')
