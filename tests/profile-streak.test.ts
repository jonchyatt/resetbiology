import { computeDayStreak } from '../src/lib/streak'

// Seed-array regression harness for the pure streak function backing the
// Profile page's "Day Streak" stat (app/api/profile/progress/route.ts).
// Mirrors the DailyTask-backed calculateStreak in app/api/daily-tasks/route.ts
// but with no DB — same idiom as tests/local-day.test.ts.

let failed = false

function check(label: string, pass: boolean, detail?: string) {
  if (pass) {
    console.log(`[PASS] ${label}`)
  } else {
    failed = true
    console.error(`[FAIL] ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

// Consecutive days ending today -> streak 3.
check(
  '3 consecutive days ending today = streak 3',
  computeDayStreak(['2026-07-13', '2026-07-14', '2026-07-15'], '2026-07-15') === 3
)

// A gap breaks the streak — only the run touching "today" (or yesterday) counts.
check(
  'gap before today resets the streak to the run ending today',
  computeDayStreak(['2026-07-10', '2026-07-13', '2026-07-14', '2026-07-15'], '2026-07-15') === 3
)

// Empty input -> 0, no crash.
check('empty day-key list = streak 0', computeDayStreak([], '2026-07-15') === 0)

// Nothing completed today yet — an in-progress day doesn't zero out an
// otherwise-live streak; counting starts from yesterday.
check(
  'no entry for today yet still counts the streak ending yesterday',
  computeDayStreak(['2026-07-13', '2026-07-14'], '2026-07-15') === 2
)

// A gap immediately before today with nothing completed today = 0 (neither
// today nor yesterday is in the set).
check(
  'gap immediately before today with nothing today = streak 0',
  computeDayStreak(['2026-07-10', '2026-07-11'], '2026-07-15') === 0
)

// Order and duplicates in the input don't matter.
check(
  'unsorted, duplicated input still yields streak 3',
  computeDayStreak(['2026-07-15', '2026-07-13', '2026-07-14', '2026-07-14', '2026-07-13'], '2026-07-15') === 3
)

if (failed) {
  process.exitCode = 1
  console.error('\nOne or more profile-streak scenarios failed.')
} else {
  console.log('\nAll profile-streak scenarios passed.')
}
