/**
 * Compute Reminders — pure on-demand notification calculator (Phase 2.4)
 *
 * For Drive-connected users we do NOT pre-generate ScheduledNotification rows.
 * Instead, the /api/notifications/send cron tick (every 5 min) calls this
 * function per (user, active-protocol, prefs) tuple and gets back the list of
 * reminders that fall within the current tick window.
 *
 * The cron then dedupes against NotificationDelivery (idempotency table) so
 * a 15-min lookback window can't double-send a reminder a previous tick
 * already delivered.
 *
 * Reuses the same dose-time / dose-date logic as the legacy Mongo path so
 * Drive users and Mongo users see identical timing behavior.
 */

import { fromZonedTime } from 'date-fns-tz'
import { parseDoseTimes, generateDoseDates } from './scheduleNotifications'

export interface ReminderProtocolInput {
  startDate: Date | null
  endDate: Date | null
  frequency: string
  timing: string | null
}

export interface ReminderPrefs {
  pushEnabled: boolean
  emailEnabled: boolean
  reminderMinutes: number
  timezone: string | null
}

export interface DueReminder {
  doseTime: Date
  reminderTime: Date
  type: 'push' | 'email'
}

/**
 * Returns the reminders whose `reminderTime` falls within the half-open
 * window `(windowStart, windowEnd]` AND whose `doseTime` has not yet
 * passed by more than `staleMinutes` (don't notify after the dose was due).
 *
 * Computes a small range of candidate dates around `windowEnd` to handle
 * DST + timezone wrap. We look at today, yesterday, and tomorrow in the
 * user's timezone — cheap because parseDoseTimes returns at most a handful
 * of times per day.
 */
export function computeDueReminders(args: {
  protocol: ReminderProtocolInput
  prefs: ReminderPrefs
  windowStart: Date
  windowEnd: Date
  staleMinutes?: number
}): DueReminder[] {
  const { protocol, prefs, windowStart, windowEnd } = args
  const staleMinutes = args.staleMinutes ?? 60

  // Stop sending reminders after the protocol's end date
  if (protocol.endDate && protocol.endDate.getTime() < windowStart.getTime()) {
    return []
  }
  // Don't start before the protocol begins
  if (protocol.startDate && protocol.startDate.getTime() > windowEnd.getTime()) {
    return []
  }

  // Skip "as needed" — same rule as the legacy Mongo path
  const timingLower = (protocol.timing || '').toLowerCase()
  const frequencyLower = (protocol.frequency || '').toLowerCase()
  if (timingLower.includes('as needed') || frequencyLower.includes('as needed')) {
    return []
  }

  const doseTimes = parseDoseTimes(protocol.timing || '')
  if (doseTimes.length === 0) return []

  const channels: Array<'push' | 'email'> = []
  if (prefs.pushEnabled) channels.push('push')
  if (prefs.emailEnabled) channels.push('email')
  if (channels.length === 0) return []

  const timezone = prefs.timezone || 'UTC'
  const reminderMinutes = prefs.reminderMinutes ?? 15

  // Build a 3-day window of candidate dates (yesterday, today, tomorrow in
  // local time) to handle reminders that cross UTC midnight after timezone
  // conversion. generateDoseDates respects frequency rules (daily, every
  // other day, 3x/week, etc.) so we still honor the same cadence.
  const candidates = generateDoseDatesWindow(protocol, windowStart, windowEnd)

  const due: DueReminder[] = []
  const staleCutoff = new Date(windowEnd.getTime() - staleMinutes * 60 * 1000)

  for (const dateLocal of candidates) {
    for (const time of doseTimes) {
      const doseDateTime = toUtcFromLocalDate(dateLocal, time, timezone)
      const reminderTime = new Date(doseDateTime.getTime() - reminderMinutes * 60 * 1000)

      // In window?
      if (reminderTime <= windowStart || reminderTime > windowEnd) continue
      // Not stale?
      if (doseDateTime < staleCutoff) continue

      for (const type of channels) {
        due.push({ doseTime: doseDateTime, reminderTime, type })
      }
    }
  }

  return due
}

/**
 * Re-uses generateDoseDates but bounded to a tight 3-day window relative to
 * windowEnd. The legacy Mongo helper iterates from today → today+30; here we
 * just need yesterday/today/tomorrow.
 */
function generateDoseDatesWindow(
  protocol: ReminderProtocolInput,
  windowStart: Date,
  windowEnd: Date,
): Date[] {
  const startDate = protocol.startDate ?? new Date(windowStart.getTime() - 24 * 60 * 60 * 1000)
  const allDates = generateDoseDates(
    { startDate, frequency: protocol.frequency },
    Math.ceil((windowEnd.getTime() - new Date().setHours(0, 0, 0, 0)) / (24 * 60 * 60 * 1000)) + 2,
  )

  // Filter to the small candidate window
  const lower = new Date(windowStart.getTime() - 36 * 60 * 60 * 1000)
  const upper = new Date(windowEnd.getTime() + 12 * 60 * 60 * 1000)
  return allDates.filter((d) => d >= lower && d <= upper)
}

/**
 * Local mirror of scheduleNotifications.toUtcFromLocal — kept here to avoid
 * circular import surface. Same implementation.
 */
function toUtcFromLocalDate(date: Date, time: string, timeZone: string): Date {
  const pad = (value: number) => value.toString().padStart(2, '0')
  const localDate = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${time}:00`
  return fromZonedTime(localDate, timeZone)
}
