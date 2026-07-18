import {
  localDayKey,
  todayLocalKey,
  dayKeyToUtcMidnight,
  utcMidnightToDayKey,
  weekdayOfDayKey,
  dayOfMonthFromKey,
  getMonthRange,
  buildMonthCalendarDays,
} from '../src/lib/localDay'
import { toUtcFromLocal } from '../src/lib/scheduleNotifications'

// F1.3 regression harness for the shared local-day helper that replaced the
// hardcoded `4 * 60 * 60 * 1000` (UTC-4) offsets in journal/history/route.ts.
// Boundary-time scenarios build their UTC instants via toUtcFromLocal
// (date-fns-tz's fromZonedTime) — a completely separate tz implementation
// from localDayKey's Intl.DateTimeFormat — so this is a genuine
// cross-validation, not a tautology. Idiom follows tests/timezone-notification-check.ts.

type BoundaryScenario = {
  label: string
  date: string // the local calendar day the time string is on
  time: string // 'HH:MM'
  timeZone: string
  expectedKey: string
}

const boundaryScenarios: BoundaryScenario[] = [
  // --- UTC ---
  { label: 'UTC 23:30 stays on the same day', date: '2026-07-15', time: '23:30', timeZone: 'UTC', expectedKey: '2026-07-15' },
  { label: 'UTC 00:30 rolls to the next day', date: '2026-07-16', time: '00:30', timeZone: 'UTC', expectedKey: '2026-07-16' },

  // --- America/New_York, winter (EST, UTC-5) ---
  { label: 'New_York winter 23:30 EST stays on the same day', date: '2026-01-15', time: '23:30', timeZone: 'America/New_York', expectedKey: '2026-01-15' },
  { label: 'New_York winter 00:30 EST rolls to the next day', date: '2026-01-16', time: '00:30', timeZone: 'America/New_York', expectedKey: '2026-01-16' },

  // --- America/New_York, summer (EDT, UTC-4) ---
  { label: 'New_York summer 23:30 EDT stays on the same day', date: '2026-07-15', time: '23:30', timeZone: 'America/New_York', expectedKey: '2026-07-15' },
  { label: 'New_York summer 00:30 EDT rolls to the next day', date: '2026-07-16', time: '00:30', timeZone: 'America/New_York', expectedKey: '2026-07-16' },

  // --- America/Denver (MST/MDT) ---
  { label: 'Denver 23:30 stays on the same day', date: '2026-01-15', time: '23:30', timeZone: 'America/Denver', expectedKey: '2026-01-15' },
  { label: 'Denver 00:30 rolls to the next day', date: '2026-01-16', time: '00:30', timeZone: 'America/Denver', expectedKey: '2026-01-16' },

  // --- America/Phoenix (no DST, always UTC-7) ---
  { label: 'Phoenix 23:30 stays on the same day', date: '2026-07-15', time: '23:30', timeZone: 'America/Phoenix', expectedKey: '2026-07-15' },
  { label: 'Phoenix 00:30 rolls to the next day', date: '2026-07-16', time: '00:30', timeZone: 'America/Phoenix', expectedKey: '2026-07-16' },

  // --- America/Los_Angeles (PST/PDT) ---
  { label: 'Los_Angeles 23:30 stays on the same day', date: '2026-07-15', time: '23:30', timeZone: 'America/Los_Angeles', expectedKey: '2026-07-15' },
  { label: 'Los_Angeles 00:30 rolls to the next day', date: '2026-07-16', time: '00:30', timeZone: 'America/Los_Angeles', expectedKey: '2026-07-16' },

  // --- Spring-forward transition day itself: US DST 2026 begins Sun
  // 2026-03-08 (2:00am -> 3:00am, verified via Node's own Intl weekday
  // lookup at test-authoring time, not assumed). ---
  { label: 'spring-forward day (New_York) 23:30 stays on transition day', date: '2026-03-08', time: '23:30', timeZone: 'America/New_York', expectedKey: '2026-03-08' },
  { label: 'day after spring-forward 00:30 rolls correctly', date: '2026-03-09', time: '00:30', timeZone: 'America/New_York', expectedKey: '2026-03-09' },

  // --- Fall-back transition day itself: US DST 2026 ends Sun 2026-11-01
  // (2:00am -> 1:00am). ---
  { label: 'fall-back day (New_York) 23:30 stays on transition day', date: '2026-11-01', time: '23:30', timeZone: 'America/New_York', expectedKey: '2026-11-01' },
  { label: 'day after fall-back 00:30 rolls correctly', date: '2026-11-02', time: '00:30', timeZone: 'America/New_York', expectedKey: '2026-11-02' },
]

let failed = false

function check(label: string, pass: boolean, detail?: string) {
  if (pass) {
    console.log(`[PASS] ${label}`)
  } else {
    failed = true
    console.error(`[FAIL] ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

for (const scenario of boundaryScenarios) {
  const [y, m, d] = scenario.date.split('-').map(Number)
  const baseDate = new Date(Date.UTC(y, m - 1, d))
  const utcInstant = toUtcFromLocal(baseDate, scenario.time, scenario.timeZone)
  const actual = localDayKey(utcInstant, scenario.timeZone)
  check(scenario.label, actual === scenario.expectedKey, `expected ${scenario.expectedKey}, got ${actual} (utc instant ${utcInstant.toISOString()})`)
}

// --- dayKeyToUtcMidnight / utcMidnightToDayKey round-trip (the "derived
// local story" DailyTask and JournalEntry use in place of a schema column) ---
for (const key of ['2026-01-01', '2026-07-15', '2026-12-31', '2026-03-08', '2026-11-01']) {
  const roundTripped = utcMidnightToDayKey(dayKeyToUtcMidnight(key))
  check(`dayKeyToUtcMidnight round-trip for ${key}`, roundTripped === key, `got ${roundTripped}`)
}

// --- todayLocalKey shape sanity ---
check('todayLocalKey returns a YYYY-MM-DD string', /^\d{4}-\d{2}-\d{2}$/.test(todayLocalKey()), todayLocalKey())

// --- Month grid: July 2026 must render as July 1-31 with correct labels
// and correct weekday alignment, in Denver AND New York AND UTC (F1.3
// NEW-1a/b/c acceptance). Calls the ROUTE's actual calendar-generation
// functions (getMonthRange + buildMonthCalendarDays, now shared out of
// app/api/journal/history/route.ts) instead of a test-constructed key
// array — a bug in either function fails this test, which a
// tautological "build the same keys the test expects" check cannot do.
const { start: julyStart, end: julyEnd } = getMonthRange('2026-07')
const julyGrid = buildMonthCalendarDays(julyStart, julyEnd)
const julyKeys = julyGrid.map((d) => d.date)

check('July 2026 has exactly 31 day keys (no off-by-one at either end)', julyKeys.length === 31, `got ${julyKeys.length}`)
check('July 2026 starts on the 1st', dayOfMonthFromKey(julyKeys[0]) === 1, julyKeys[0])
check('July 2026 ends on the 31st', dayOfMonthFromKey(julyKeys[julyKeys.length - 1]) === 31, julyKeys[julyKeys.length - 1])
check('July 2026 grid iso strings are well-formed and in order', julyGrid.every((d, i) => !Number.isNaN(new Date(d.iso).getTime()) && (i === 0 || julyGrid[i - 1].iso < d.iso)))
// July 1, 2026 is a Wednesday (verified via Intl weekday lookup at
// test-authoring time — JS getDay(): 0=Sun..6=Sat, so Wednesday = 3).
check('July 1, 2026 leading-blank weekday is Wednesday (3)', weekdayOfDayKey(julyKeys[0]) === 3, String(weekdayOfDayKey(julyKeys[0])))

for (const zone of ['UTC', 'America/Denver', 'America/New_York']) {
  // Noon UTC on each grid day is safely inside the same calendar day for
  // every continental US zone (max UTC-10 offset would be needed to roll
  // it — none of our supported zones go that far west) and for UTC
  // itself, so a real timestamp reformatted per-zone must reproduce the
  // SAME grid the route function actually generated above.
  const zoneKeys = julyGrid.map(({ date }) => {
    const noonUtc = new Date(`${date}T12:00:00.000Z`)
    return localDayKey(noonUtc, zone)
  })
  const matches = zoneKeys.every((key, i) => key === julyKeys[i])
  check(`July 2026 grid reproduces July 1-31 in ${zone}`, matches, JSON.stringify(zoneKeys))
  // Weekday alignment must also hold per-zone — a pure calendar fact, not
  // shifted by which zone re-derived the key (see weekdayOfDayKey doc).
  const zoneWeekdays = zoneKeys.map(weekdayOfDayKey)
  const expectedWeekdays = julyKeys.map(weekdayOfDayKey)
  check(`July 2026 weekday alignment matches in ${zone}`, zoneWeekdays.every((w, i) => w === expectedWeekdays[i]), JSON.stringify(zoneWeekdays))
}

if (failed) {
  process.exitCode = 1
  console.error('\nOne or more local-day scenarios failed.')
} else {
  console.log('\nAll local-day scenarios passed.')
}
