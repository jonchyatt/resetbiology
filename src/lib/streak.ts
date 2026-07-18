// Pure, seed-array-based version of the DailyTask-backed calculateStreak in
// app/api/daily-tasks/route.ts — same algorithm, no DB, so it's directly
// testable (tests/profile-streak.test.ts) and reusable from any route that
// already has a list of completed local-day keys (e.g. app/api/profile/progress/route.ts).

import { dayKeyToUtcMidnight, utcMidnightToDayKey } from './localDay'

function shiftDayKey(key: string, deltaDays: number): string {
  const d = dayKeyToUtcMidnight(key)
  d.setUTCDate(d.getUTCDate() + deltaDays)
  return utcMidnightToDayKey(d)
}

/**
 * Consecutive local-day streak ending today. `dayKeys` is any list of
 * YYYY-MM-DD keys on which the user completed something (need not be sorted
 * or deduped — order and duplicates don't matter). `todayKey` is the
 * caller's current local day (e.g. `todayLocalKey()`).
 *
 * If today has no entry yet, counting starts from yesterday so an
 * in-progress day doesn't zero out an otherwise-live streak (matches
 * calculateStreak's behavior in app/api/daily-tasks/route.ts).
 */
export function computeDayStreak(dayKeys: string[], todayKey: string): number {
  const completed = new Set(dayKeys)
  if (completed.size === 0) return 0

  let cursorKey = completed.has(todayKey) ? todayKey : shiftDayKey(todayKey, -1)

  let streak = 0
  while (completed.has(cursorKey)) {
    streak++
    cursorKey = shiftDayKey(cursorKey, -1)
  }
  return streak
}
