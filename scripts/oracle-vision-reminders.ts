/**
 * Oracle for computeDueVisionReminders() / isVisionSessionCompletedToday()
 * (R1a). Deterministic fixed-clock matrix, NO network/DB. Assert-style,
 * exits non-zero on any failure, prints PASS count.
 *
 * Run: node node_modules/tsx/dist/cli.mjs scripts/oracle-vision-reminders.ts
 */

import { strict as assert } from 'node:assert'
import { computeDueVisionReminders, type VisionEnrollmentInput, type VisionReminderPrefInput } from '../src/lib/computeVisionReminders'
import { visionMasterProgram } from '../src/data/visionProtocols'
import { localDayKey } from '../src/lib/localDay'
import { visionProgramSessionForLocalDay } from '../src/lib/vision/localDayInput'

let passCount = 0
function pass(label: string) {
  passCount++
  console.log(`PASS: ${label}`)
}

function baseEnrollment(overrides: Partial<VisionEnrollmentInput> = {}): VisionEnrollmentInput {
  return { startDate: new Date('2026-01-05T15:00:00.000Z'), status: 'active', testDayOffset: null, ...overrides }
}

function basePref(overrides: Partial<VisionReminderPrefInput> = {}): VisionReminderPrefInput {
  return {
    pushEnabled: true,
    emailEnabled: false,
    protocolType: 'vision',
    dailyReminderTime: '08:00',
    timezone: 'America/Denver',
    ...overrides,
  }
}

// ---- 1. Enrollment status gating ------------------------------------------
{
  const now = new Date('2026-01-05T15:00:00.000Z') // 08:00 America/Denver, week1 day1
  for (const status of ['paused', 'completed', 'abandoned']) {
    const r = computeDueVisionReminders({ enrollment: baseEnrollment({ status }), pref: basePref(), now })
    assert.equal(r.due, false, `status=${status} must not be due`)
  }
  pass('enrollment status gating (paused/completed/abandoned -> due=false)')

  const rActive = computeDueVisionReminders({ enrollment: baseEnrollment({ status: 'active' }), pref: basePref(), now })
  assert.equal(rActive.due, true, 'active status + eligible pref + weekday + on-time -> due=true')
  pass('active enrollment + eligible pref -> due=true')
}

// ---- 2. protocolType must be "vision" (peptide-path isolation) ------------
{
  const now = new Date('2026-01-05T15:00:00.000Z')
  const r = computeDueVisionReminders({ enrollment: baseEnrollment(), pref: basePref({ protocolType: 'peptide' }), now })
  assert.equal(r.due, false, 'protocolType=peptide (default) must never fire a vision reminder')
  pass('protocolType=peptide isolation (peptide path never fires vision reminder)')
}

// ---- 3. pushEnabled || emailEnabled required -------------------------------
{
  const now = new Date('2026-01-05T15:00:00.000Z')
  const r = computeDueVisionReminders({
    enrollment: baseEnrollment(),
    pref: basePref({ pushEnabled: false, emailEnabled: false }),
    now,
  })
  assert.equal(r.due, false, 'both channels disabled -> due=false')
  const r2 = computeDueVisionReminders({
    enrollment: baseEnrollment(),
    pref: basePref({ pushEnabled: false, emailEnabled: true }),
    now,
  })
  assert.equal(r2.due, true, 'emailEnabled alone is sufficient')
  pass('channel-enabled gating (push||email required)')
}

// ---- 4. missing dailyReminderTime ------------------------------------------
{
  const now = new Date('2026-01-05T15:00:00.000Z')
  const r = computeDueVisionReminders({ enrollment: baseEnrollment(), pref: basePref({ dailyReminderTime: null }), now })
  assert.equal(r.due, false, 'missing dailyReminderTime -> due=false')
  assert.equal(r.reminderInstant, null, 'missing dailyReminderTime -> no reminderInstant computed')
  pass('missing dailyReminderTime -> due=false, reminderInstant=null')
}

// ---- 5. rest day (Saturday=day6, Sunday=day7 of the program week) ---------
{
  // startDate is week1day1; +5 days -> day6 (Saturday, rest day)
  const enrollment = baseEnrollment()
  const now = new Date('2026-01-10T15:00:00.000Z') // 5 days after Jan5 -> day6
  const r = computeDueVisionReminders({ enrollment, pref: basePref(), now })
  assert.equal(r.due, false, 'rest day must not be due')
  assert.equal(r.sessionFocus, null, 'rest day has no session')
  assert.equal(r.estMinutes, null, 'rest day has no estMinutes')
  assert.equal(r.day, 6, 'day should compute to 6 (Saturday)')
  pass('rest day (day 6) -> due=false, session fields null')
}

// ---- 6. each weekday (day 1-5) resolves to the real weeklyPlans session ---
{
  for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
    const now = new Date(new Date('2026-01-05T15:00:00.000Z').getTime() + dayOffset * 86400000)
    const enrollment = baseEnrollment()
    const r = computeDueVisionReminders({ enrollment, pref: basePref(), now })
    const expectedDay = dayOffset + 1
    assert.equal(r.week, 1, `week1 for dayOffset=${dayOffset}`)
    assert.equal(r.day, expectedDay, `day=${expectedDay} for dayOffset=${dayOffset}`)
    assert.equal(r.due, true, `weekday ${expectedDay} at reminder time -> due=true`)
    const expectedSession = visionMasterProgram.weeklyPlans[0].sessions.find((s) => s.day === expectedDay)
    assert.ok(expectedSession, `weeklyPlans week1 must have a session for day ${expectedDay}`)
    assert.equal(r.sessionFocus, expectedSession!.focus, `sessionFocus matches weeklyPlans day ${expectedDay}`)
    assert.equal(
      r.estMinutes,
      expectedSession!.baselineMinutes + expectedSession!.exerciseMinutes,
      `estMinutes = baselineMinutes + exerciseMinutes for day ${expectedDay}`,
    )
  }
  pass('all 5 weekdays -> due=true, sessionFocus/estMinutes match visionMasterProgram data')
}

// ---- 7. catch-up window edges (89 min due, 91 min not) ---------------------
{
  const enrollment = baseEnrollment()
  const pref = basePref({ dailyReminderTime: '08:00', timezone: 'America/Denver' })
  // 08:00 America/Denver (MST, -07:00) on 2026-01-05 = 15:00:00Z
  const reminderInstantMs = new Date('2026-01-05T15:00:00.000Z').getTime()

  const now89 = new Date(reminderInstantMs + 89 * 60 * 1000)
  const r89 = computeDueVisionReminders({ enrollment, pref, now: now89 })
  assert.equal(r89.due, true, '89 minutes after reminderInstant must still be due (catch-up window)')

  const now91 = new Date(reminderInstantMs + 91 * 60 * 1000)
  const r91 = computeDueVisionReminders({ enrollment, pref, now: now91 })
  assert.equal(r91.due, false, '91 minutes after reminderInstant must NOT be due (dropped, never pile up)')

  const now90 = new Date(reminderInstantMs + 90 * 60 * 1000)
  const r90 = computeDueVisionReminders({ enrollment, pref, now: now90 })
  assert.equal(r90.due, true, 'exactly 90 minutes is inclusive (<=)')

  const nowBefore = new Date(reminderInstantMs - 1000)
  const rBefore = computeDueVisionReminders({ enrollment, pref, now: nowBefore })
  assert.equal(rBefore.due, false, '1 second before reminderInstant must not be due yet')

  pass('catch-up window edges (89 due / 90 due / 91 not due / before not due)')
}

// ---- 8. spring-forward gap: America/Denver 2026-03-08 02:30 ---------------
{
  // Program day 1 lands exactly on 2026-03-08 so the nonexistent local time
  // (02:00-03:00 skip) falls on a real session day.
  const enrollment = baseEnrollment({ startDate: new Date('2026-03-08T12:00:00.000Z') })
  const pref = basePref({ dailyReminderTime: '02:30', timezone: 'America/Denver' })
  const now = new Date('2026-03-08T09:05:00.000Z') // 5 min after the transition instant (09:00Z)

  const r = computeDueVisionReminders({ enrollment, pref, now })
  assert.equal(r.localDate, '2026-03-08', 'localDate is the calendar date containing the gap')
  assert.ok(r.reminderInstant, 'reminderInstant must resolve even though 02:30 does not exist locally')
  assert.equal(
    r.reminderInstant!.toISOString(),
    '2026-03-08T09:00:00.000Z',
    'nonexistent 02:30 clamps FORWARD to the transition instant (03:00 MDT = 09:00Z), not backward',
  )
  assert.equal(r.due, true, 'now (5 min after clamped instant) is within the catch-up window -> due=true')
  pass('spring-forward gap (America/Denver 2026-03-08 02:30) clamps forward to transition instant')
}

// ---- 9. fall-back ambiguity: America/Denver 2026-11-01 01:30 (both occurrences -> single localDate) ---
{
  const enrollment = baseEnrollment({ startDate: new Date('2026-11-01T12:00:00.000Z') })
  const pref = basePref({ dailyReminderTime: '01:30', timezone: 'America/Denver' })

  // First occurrence window (01:30 MDT = 07:30Z)
  const nowFirst = new Date('2026-11-01T08:00:00.000Z') // 30 min after first occurrence
  const rFirst = computeDueVisionReminders({ enrollment, pref, now: nowFirst })
  assert.equal(rFirst.reminderInstant!.toISOString(), '2026-11-01T07:30:00.000Z', 'ambiguous time resolves to FIRST occurrence')
  assert.equal(rFirst.localDate, '2026-11-01', 'localDate for the first-occurrence window')
  assert.equal(rFirst.due, true, 'first-occurrence window is due')

  // Later in the same catch-up window (crossing the actual fall-back instant, still same computed reminderInstant/localDate)
  const nowLater = new Date('2026-11-01T08:35:00.000Z') // 65 min after the SAME reminderInstant (07:30Z)
  const rLater = computeDueVisionReminders({ enrollment, pref, now: nowLater })
  assert.equal(
    rLater.reminderInstant!.toISOString(),
    rFirst.reminderInstant!.toISOString(),
    'reminderInstant is stable across the fall-back window -- computed once per localDate, not per literal wall-clock match',
  )
  assert.equal(rLater.localDate, rFirst.localDate, 'both occurrences collapse to a single localDate (no double-fire)')
  assert.equal(rLater.due, true, 'still within the 90-min catch-up window relative to the single reminderInstant')

  pass('fall-back ambiguity (America/Denver 2026-11-01 01:30) resolves to first occurrence, single localDate')
}

// ---- 10. timezone change mid-program ---------------------------------------
{
  const enrollment = baseEnrollment()
  const now = new Date('2026-01-05T15:00:00.000Z')
  const rDenver = computeDueVisionReminders({ enrollment, pref: basePref({ timezone: 'America/Denver' }), now })
  const rNewYork = computeDueVisionReminders({ enrollment, pref: basePref({ timezone: 'America/New_York' }), now })

  // This seeded enrollment has the same calendar key in both zones.
  assert.equal(rDenver.week, rNewYork.week, 'week is timezone-independent')
  assert.equal(rDenver.day, rNewYork.day, 'day is timezone-independent')
  // But the reminder clock-time resolution differs per timezone.
  assert.notEqual(
    rDenver.reminderInstant!.toISOString(),
    rNewYork.reminderInstant!.toISOString(),
    'same wall-clock dailyReminderTime resolves to a different instant per timezone',
  )
  pass('timezone change mid-program: program day stable, reminderInstant differs by tz')
}

// ---- 11. testDayOffset applied (tester traversal cursor) -------------------
{
  const enrollment = baseEnrollment({ testDayOffset: 8 }) // pushes effective start back 8 days
  const now = new Date('2026-01-05T15:00:00.000Z')
  const r = computeDueVisionReminders({ enrollment, pref: basePref(), now })

  const expected = visionProgramSessionForLocalDay(enrollment, localDayKey(now, 'America/Denver'), 'America/Denver')
  assert.equal(r.week, expected.week, 'testDayOffset-shifted week matches the shared API/reminder day function')
  assert.equal(r.day, expected.day, 'testDayOffset-shifted day matches the shared API/reminder day function')
  pass('testDayOffset uses the shared API/reminder calendar-day function')
}

// ---- 12. program complete (week > 12) --------------------------------------
{
  const enrollment = baseEnrollment({ startDate: new Date('2020-01-01T00:00:00.000Z') }) // long past, program complete
  const now = new Date('2026-01-05T15:00:00.000Z')
  const r = computeDueVisionReminders({ enrollment, pref: basePref(), now })
  assert.equal(r.due, false, 'program-complete (week>12, session=null) must not be due')
  pass('program complete (week>12) -> due=false')
}

console.log(`\n${passCount} PASS, 0 FAIL`)
