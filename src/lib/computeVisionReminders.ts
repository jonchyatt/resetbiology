/**
 * Compute Vision Reminders — pure on-demand notification calculator (R1a)
 *
 * Sibling to src/lib/computeReminders.ts (the peptide dose-reminder path,
 * which stays byte-identical / untouched). Vision reminders ride the SAME
 * notification cron's on-demand pass — nothing is materialized ahead of
 * time; the cron calls computeDueVisionReminders() per (enrollment, pref)
 * tuple each tick and gets back whether a reminder is due right now.
 *
 * Program-day derivation uses the same member-calendar function as the
 * program route, so the cron and UI cannot disagree about "what day is it."
 */

import { fromZonedTime } from 'date-fns-tz'
import { type DailySession } from '@/data/visionProtocols'
import type { PrismaClient } from '@prisma/client'
import { isValidVisionTimeZone, visionProgramSessionForLocalDay } from '@/lib/vision/localDayInput'
import { localDayKey } from '@/lib/localDay'

export interface VisionEnrollmentInput {
  startDate: Date | string
  testDayOffset?: number | null
  status: string // "active" | "paused" | "completed" | "abandoned"
}

export interface VisionReminderPrefInput {
  pushEnabled: boolean
  emailEnabled: boolean
  protocolType: string // "peptide" | "vision"
  dailyReminderTime: string | null // HH:mm wall-clock
  timezone: string | null
}

export interface VisionReminderResult {
  due: boolean
  reminderInstant: Date | null
  localDate: string // YYYY-MM-DD, user's calendar date in pref.timezone — dedupe key
  week: number
  day: number
  sessionFocus: string | null
  estMinutes: number | null
}

const CATCH_UP_WINDOW_MS = 90 * 60 * 1000

export function computeDueVisionReminders(args: {
  enrollment: VisionEnrollmentInput
  pref: VisionReminderPrefInput
  now: Date
}): VisionReminderResult {
  const { enrollment, pref, now } = args
  const timezone = pref.timezone
  if (!isValidVisionTimeZone(timezone)) {
    // Never let the deployment timezone manufacture a member reminder.
    return { due: false, reminderInstant: null, localDate: '', week: 0, day: 0, sessionFocus: null, estMinutes: null }
  }
  const localDate = localDayKey(now, timezone)

  // Program-day derivation shares the API's calendar-normalized tester logic.
  const { week, day, session, isRestDay } = visionProgramSessionForLocalDay(enrollment, localDate, timezone)
  const sessionFocus = session?.focus ?? null
  const estMinutes = session ? estimatedMinutes(session) : null

  const eligible =
    enrollment.status === 'active' &&
    (pref.pushEnabled || pref.emailEnabled) &&
    !!pref.dailyReminderTime &&
    pref.protocolType === 'vision'

  if (!eligible || isRestDay || !session) {
    return { due: false, reminderInstant: null, localDate, week, day, sessionFocus, estMinutes }
  }

  const reminderInstant = resolveTodaysReminderInstant(localDate, pref.dailyReminderTime as string, timezone)
  const deltaMs = now.getTime() - reminderInstant.getTime()
  const due = deltaMs >= 0 && deltaMs <= CATCH_UP_WINDOW_MS

  return { due, reminderInstant, localDate, week, day, sessionFocus, estMinutes }
}

function estimatedMinutes(session: DailySession): number {
  return session.baselineMinutes + session.exerciseMinutes
}

/**
 * Companion DB check, kept OUT of the pure compute function above per
 * ticket spec — the caller (notification cron) runs this after
 * computeDueVisionReminders() reports due=true, and skips sending if a
 * VisionDailySession already exists for today's program slot.
 *
 * Matched by (enrollmentId, week, day) — that triple is the authoritative
 * "today's program slot" for this enrollment regardless of testDayOffset
 * traversal, so it's the correct completion key. `localDate` is accepted
 * for interface parity with the caller's dedupe key but not required for
 * correctness here — kept for a future caller that wants an extra guard.
 */
export async function isVisionSessionCompletedToday(
  prisma: Pick<PrismaClient, 'visionDailySession'>,
  enrollmentId: string,
  week: number,
  day: number,
  localDate: string,
): Promise<boolean> {
  void localDate // ponytail: accepted for signature parity, not needed — (enrollmentId, week, day) is already the unique key
  const existing = await prisma.visionDailySession.findFirst({
    where: { enrollmentId, week, day },
    select: { id: true },
  })
  return !!existing
}

// ---- timezone resolution -------------------------------------------------

function resolveTodaysReminderInstant(localDate: string, hhmm: string, timeZone: string): Date {
  const [y, mo, d] = localDate.split('-').map(Number)
  const [h, mi] = hhmm.split(':').map(Number)
  return resolveLocalWallClock(y, mo, d, h, mi, timeZone)
}

function zonedParts(utcMs: number, timeZone: string): { y: number; mo: number; d: number; h: number; mi: number } {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const map: Record<string, string> = {}
  for (const part of dtf.formatToParts(new Date(utcMs))) {
    if (part.type !== 'literal') map[part.type] = part.value
  }
  return { y: Number(map.year), mo: Number(map.month), d: Number(map.day), h: Number(map.hour), mi: Number(map.minute) }
}

function wallClockNumber(p: { y: number; mo: number; d: number; h: number; mi: number }): number {
  return p.y * 100000000 + p.mo * 1000000 + p.d * 10000 + p.h * 100 + p.mi
}

/**
 * Resolves a local wall-clock date+time in an IANA timezone to a UTC instant.
 *
 * - Ordinary times: exact conversion (delegates to date-fns-tz, already a
 *   project dependency — src/lib/computeReminders.ts uses the same
 *   fromZonedTime for the peptide path).
 * - Ambiguous times (DST fall-back overlap, e.g. 01:30 occurring twice):
 *   date-fns-tz's fromZonedTime already resolves to the FIRST occurrence
 *   here (verified empirically against America/Denver 2026-11-01 01:30 —
 *   see scripts/oracle-vision-reminders.mjs).
 * - Nonexistent times (DST spring-forward gap, e.g. 02:30 on a
 *   02:00->03:00 skip): fromZonedTime does NOT round-trip cleanly for
 *   these — detected via re-formatting the resolved instant back into the
 *   zone and comparing wall-clock components. On mismatch, binary-search
 *   for the transition instant (the first UTC instant whose local
 *   wall-clock reads >= the requested time) — this is "clamp FORWARD to
 *   the next valid instant."
 */
function resolveLocalWallClock(y: number, mo: number, d: number, h: number, mi: number, timeZone: string): Date {
  const pad = (n: number) => String(n).padStart(2, '0')
  const naiveIso = `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:00`
  const resolved = fromZonedTime(naiveIso, timeZone)

  const target = wallClockNumber({ y, mo, d, h, mi })
  const got = wallClockNumber(zonedParts(resolved.getTime(), timeZone))
  if (got === target) return resolved // clean round-trip — not a gap

  // Nonexistent local time. Binary-search the first UTC instant whose local
  // wall-clock reading is >= target, bracketing outward from our (invalid)
  // guess until lo reads < target and hi reads >= target.
  let lo = resolved.getTime() - 2 * 3600 * 1000
  let hi = resolved.getTime() + 2 * 3600 * 1000
  let guard = 0
  while (wallClockNumber(zonedParts(lo, timeZone)) >= target && guard < 48) {
    lo -= 3600 * 1000
    guard++
  }
  guard = 0
  while (wallClockNumber(zonedParts(hi, timeZone)) < target && guard < 48) {
    hi += 3600 * 1000
    guard++
  }
  while (hi - lo > 1000) {
    const mid = lo + Math.floor((hi - lo) / 2)
    if (wallClockNumber(zonedParts(mid, timeZone)) >= target) hi = mid
    else lo = mid
  }
  return new Date(hi)
}
