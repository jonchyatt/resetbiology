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
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
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
