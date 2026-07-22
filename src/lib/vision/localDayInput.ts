import { dayKeyToUtcMidnight, localDayKey, utcMidnightToDayKey } from '@/lib/localDay'
import { effectiveStartDate, getTodaySession } from '@/data/visionProtocols'

export type VisionLocalDayInput = {
  localDate: string
  timeZone: string
}

type VisionLocalDayValidation =
  | { ok: true; value: VisionLocalDayInput }
  | { ok: false; error: string }

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isValidVisionDayKey(value: unknown): value is string {
  if (typeof value !== 'string' || !DAY_KEY.test(value)) return false

  const asUtcMidnight = dayKeyToUtcMidnight(value)
  return !Number.isNaN(asUtcMidnight.getTime()) && utcMidnightToDayKey(asUtcMidnight) === value
}

export function isValidVisionTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false

  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

/**
 * Accept a browser calendar day only when the supplied IANA zone independently
 * resolves the server's current instant to that same day. This prevents a UTC
 * deployment from silently taking ownership of a member's calendar.
 */
export function validateVisionLocalDayInput(
  input: unknown,
  now: Date = new Date(),
): VisionLocalDayValidation {
  if (!isRecord(input)) return { ok: false, error: 'localDate and timeZone are required' }

  const { localDate, timeZone } = input
  if (!isValidVisionDayKey(localDate)) return { ok: false, error: 'localDate must be a real YYYY-MM-DD calendar day' }
  if (!isValidVisionTimeZone(timeZone)) return { ok: false, error: 'timeZone must be a valid IANA time zone' }

  const expectedLocalDate = localDayKey(now, timeZone)
  if (localDate !== expectedLocalDate) {
    return { ok: false, error: 'localDate does not match timeZone at the current time' }
  }

  return { ok: true, value: { localDate, timeZone } }
}

/** Browser-owned request metadata for every Vision Program call. */
export function currentVisionLocalDayInput(): VisionLocalDayInput {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  if (!isValidVisionTimeZone(timeZone)) {
    throw new Error('This browser did not provide a valid IANA time zone for Vision Training')
  }

  return { localDate: localDayKey(new Date(), timeZone), timeZone }
}

/** Calendar arithmetic on day keys, never an elapsed-millisecond approximation. */
export function previousVisionDayKey(dayKey: string): string {
  const previous = dayKeyToUtcMidnight(dayKey)
  previous.setUTCDate(previous.getUTCDate() - 1)
  return utcMidnightToDayKey(previous)
}

/** Anchor a stored enrollment timestamp to the member's calendar before scheduling. */
export function visionProgramStartDay(startDate: Date | string, timeZone: string): Date {
  return dayKeyToUtcMidnight(localDayKey(new Date(startDate), timeZone))
}

/**
 * The one Vision program-day calculation for request handlers and reminders.
 * It first turns both enrollment and current day into calendar containers,
 * then applies the tester cursor without ever changing the stored enrollment.
 */
export function visionProgramSessionForLocalDay(
  enrollment: { startDate: Date | string; testDayOffset?: number | null },
  localDate: string,
  timeZone: string,
) {
  const startDate = visionProgramStartDay(enrollment.startDate, timeZone)
  return getTodaySession(
    effectiveStartDate({ startDate, testDayOffset: enrollment.testDayOffset }),
    dayKeyToUtcMidnight(localDate),
  )
}

export function isVisionSessionCompleteForDay(
  sessions: Array<{ localDate?: string | null; week: number; day: number }>,
  localDate: string,
  week: number,
  day: number,
): boolean {
  return sessions.some(session => session.localDate === localDate && session.week === week && session.day === day)
}
