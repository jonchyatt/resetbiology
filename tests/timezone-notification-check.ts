import { toUtcFromLocal } from '../src/lib/scheduleNotifications'

interface Scenario {
  label: string
  date: string
  time: string
  timezone: string
  expectedUtc: string
}

const scenarios: Scenario[] = [
  {
    label: 'PST morning dose',
    date: '2025-02-01',
    time: '08:00',
    timezone: 'America/Los_Angeles',
    expectedUtc: '2025-02-01T16:00:00.000Z'
  },
  {
    label: 'EST evening dose',
    date: '2025-02-01',
    time: '21:30',
    timezone: 'America/New_York',
    expectedUtc: '2025-02-02T02:30:00.000Z'
  },
  {
    label: 'Central Europe noon dose',
    date: '2025-06-15',
    time: '12:00',
    timezone: 'Europe/Berlin',
    expectedUtc: '2025-06-15T10:00:00.000Z'
  },
  {
    label: 'Sydney bedtime dose',
    date: '2025-10-03',
    time: '22:15',
    timezone: 'Australia/Sydney',
    expectedUtc: '2025-10-03T12:15:00.000Z'
  }
]

function makeDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

const results = scenarios.map((scenario) => {
  const baseDate = makeDate(scenario.date)
  const actual = toUtcFromLocal(baseDate, scenario.time, scenario.timezone)
  const pass = actual.toISOString() === scenario.expectedUtc
  if (!pass) {
    console.error(`[FAIL] ${scenario.label} expected ${scenario.expectedUtc} but got ${actual.toISOString()}`)
  } else {
    console.log(`[PASS] ${scenario.label} -> ${actual.toISOString()}`)
  }
  return pass
})

if (results.some((pass) => !pass)) {
  process.exitCode = 1
  console.error('\nOne or more timezone scenarios failed. Investigate conversions before deploying notifications.')
} else {
  console.log('\nAll timezone conversion scenarios passed.')
}


