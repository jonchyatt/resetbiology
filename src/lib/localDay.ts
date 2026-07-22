// Single source of truth for "what calendar day is this" — shared by every
// journal/daily-task writer and the daily-history reader, so a save and the
// calendar cell that displays it always agree on which square it lands in.
// Replaces the hardcoded `4 * 60 * 60 * 1000` (UTC-4) offsets that broke the
// calendar for every non-Eastern visitor and shifted the whole month grid.

/**
 * YYYY-MM-DD for `date`, in `timeZone` if given, else in the runtime's own
 * local zone (the visitor's real timezone when called client-side; the
 * server's zone — UTC on Vercel — when called server-side with no zone,
 * used only as the fallback for legacy rows with no captured local date).
 */
export function localDayKey(date: Date, timeZone?: string): string {
  if (timeZone) {
    // en-CA formats as YYYY-MM-DD directly — no part-picking needed.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)
  }
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Today's local day key — browser tz client-side, server tz server-side. */
export function todayLocalKey(timeZone?: string): string {
  return localDayKey(new Date(), timeZone)
}

/**
 * Turns a day key back into a Date stamped at UTC midnight. Models with no
 * dedicated `localDate` string column (DailyTask.date, JournalEntry.date)
 * use this as a timezone-independent container — the UTC calendar fields of
 * the stored Date ARE the local day key, nothing more, no schema change
 * needed.
 */
export function dayKeyToUtcMidnight(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`)
}

/** Inverse of dayKeyToUtcMidnight — reads the day key back out. */
export function utcMidnightToDayKey(date: Date): string {
  const y = String(date.getUTCFullYear()).padStart(4, '0')
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Strict Gregorian YYYY-MM-DD validation, including impossible-date rejection. */
export function isValidDayKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  if (value.startsWith('0000-')) return false

  const parsed = dayKeyToUtcMidnight(value)
  return !Number.isNaN(parsed.getTime()) && utcMidnightToDayKey(parsed) === value
}

/** Pure calendar-day movement using a UTC Date only as a timezone-free container. */
export function shiftDayKey(dayKey: string, deltaDays: number): string {
  if (!isValidDayKey(dayKey)) throw new RangeError('Invalid day key')
  if (!Number.isInteger(deltaDays)) throw new RangeError('Day shift must be an integer')

  const shifted = dayKeyToUtcMidnight(dayKey)
  shifted.setUTCDate(shifted.getUTCDate() + deltaDays)
  const result = utcMidnightToDayKey(shifted)
  if (!isValidDayKey(result)) throw new RangeError('Shifted day is out of range')
  return result
}

/**
 * Weekday (0=Sun..6=Sat) of a YYYY-MM-DD day key. Parsed WITHOUT a "Z"
 * suffix so JS reads it as local time — this is a pure calendar fact (July
 * 1, 2026 is a Wednesday everywhere on Earth) and must never be shifted by
 * an ISO-instant/timezone round-trip. Used for calendar-grid leading-blank
 * math (F1.3 NEW-1c).
 */
export function weekdayOfDayKey(key: string): number {
  return new Date(`${key}T00:00:00`).getDay()
}

/** Day-of-month integer straight from a YYYY-MM-DD key — no Date detour. */
export function dayOfMonthFromKey(key: string): number {
  return Number(key.slice(8, 10))
}

/**
 * [start, end) bounds (local-midnight Date objects, calendar-integer math
 * only) for the month named by `param` ("YYYY-MM"), defaulting to `now`'s
 * own local month. Shared by the history route's DB query and its calendar
 * grid so both agree on what "this month" means (F1.3 NEW-1a/b — replaces
 * the hardcoded "convert to EDT" offset that rendered June 30 -> July 30).
 */
export function getMonthRange(param?: string | null, now: Date = new Date()): { start: Date; end: Date } {
  let year = now.getFullYear()
  let month = now.getMonth()

  if (param) {
    const [y, m] = param.split('-').map(Number)
    if (!Number.isNaN(y) && !Number.isNaN(m) && m >= 1 && m <= 12) {
      year = y
      month = m - 1
    }
  }

  const start = new Date(year, month, 1)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setMonth(end.getMonth() + 1)
  return { start, end }
}

/**
 * Day keys + display ISO strings for every calendar day in [start, end),
 * one entry per day, in order. Extracted from the history route's inline
 * cursor loop so the July-grid regression test can exercise the exact
 * function the route calls instead of a test-constructed key array.
 */
export function buildMonthCalendarDays(start: Date, end: Date): Array<{ date: string; iso: string }> {
  const days: Array<{ date: string; iso: string }> = []
  const cursor = new Date(start)
  while (cursor < end) {
    days.push({ date: localDayKey(cursor), iso: cursor.toISOString() })
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}
