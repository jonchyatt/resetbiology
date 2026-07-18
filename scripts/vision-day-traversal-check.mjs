/**
 * Deterministic proof for the tester "rip through the program" traversal
 * cursor (app/api/vision/program/route.ts action=advance_day).
 *
 * Simulates the full Day-1 → program-complete walk purely in-memory (no DB,
 * no network) and asserts the cursor math never strands a tester on a rest
 * day, visits all 60 trainable sessions, crosses all 6 weekly-assessment
 * boundaries, and terminates in the week>12 clamp — then checks the
 * reset_test_cursor math restores the exact real-calendar start date.
 *
 * Usage: node scripts/vision-day-traversal-check.mjs
 * Exits 0 on all-pass, 1 with the failing assertion printed otherwise.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000

// Pure day/week math mirrored from src/data/visionProtocols.ts:912
// getTodaySession(enrollmentStartDate, currentDate). Exercise/session lookup
// is intentionally omitted — the traversal proof only needs week/day/isRestDay.
function getTodaySessionPure(startDate, currentDate) {
  const daysSinceStart = Math.floor((currentDate.getTime() - startDate.getTime()) / MS_PER_DAY)
  const weekNumberRaw = Math.floor(daysSinceStart / 7) + 1
  const dayOfWeek = (daysSinceStart % 7) + 1

  if (weekNumberRaw > 12) {
    return { week: 12, day: 5, isRestDay: false, trainable: false, terminal: true }
  }
  if (dayOfWeek > 5) {
    return { week: weekNumberRaw, day: dayOfWeek, isRestDay: true, trainable: false, terminal: false }
  }
  return { week: weekNumberRaw, day: dayOfWeek, isRestDay: false, trainable: true, terminal: false }
}

// Mirrors effectiveStartDate() in app/api/vision/program/route.ts.
function effectiveStart(startDate, offsetDays) {
  return new Date(startDate.getTime() - (offsetDays ?? 0) * MS_PER_DAY)
}

function fail(msg) {
  console.error(`FAIL: ${msg}`)
  process.exit(1)
}

const enrollmentStart = new Date('2026-01-01T00:00:00.000Z')
const now = enrollmentStart // pinned "now" — the cursor, not the clock, drives the walk

// Day 0: initial landing before any advance_day call.
let offset = 0
let today = getTodaySessionPure(effectiveStart(enrollmentStart, offset), now)
if (!(today.week === 1 && today.day === 1 && today.trainable)) {
  fail(`day 0 should be week 1 day 1 trainable, got ${JSON.stringify(today)}`)
}

const trainableLanded = new Set([`${today.week}-${today.day}`])
let weeklyAssessments = 0
let advanceCount = 0
let terminalReached = false
const MAX_ADVANCES = 200 // safety cap, real walk terminates well under this

while (!terminalReached && advanceCount < MAX_ADVANCES) {
  // Mirrors the advance_day PATCH loop: increment up to 3 times, skipping
  // rest days, so one tap always lands on a trainable session or terminal.
  let stepOffset = offset + 1
  let next = getTodaySessionPure(effectiveStart(enrollmentStart, stepOffset), now)
  let iterations = 1
  while (next.isRestDay && iterations < 3) {
    stepOffset += 1
    next = getTodaySessionPure(effectiveStart(enrollmentStart, stepOffset), now)
    iterations += 1
  }
  offset = stepOffset
  advanceCount += 1

  // (a) every advance lands on a trainable session or terminal state — never a rest day.
  if (next.isRestDay) fail(`advance #${advanceCount} landed on a rest day: ${JSON.stringify(next)}`)

  if (next.terminal) {
    terminalReached = true
    break
  }

  trainableLanded.add(`${next.week}-${next.day}`)
  if (next.day === 5 && next.week % 2 === 0) weeklyAssessments++
  today = next
}

// (d) the walk terminates in the week>12 program-complete clamp.
if (!terminalReached) fail(`walk did not reach the terminal clamp within ${MAX_ADVANCES} advances`)

// (b) all 60 trainable sessions are reachable.
if (trainableLanded.size !== 60) {
  fail(`expected 60 unique trainable sessions reached, got ${trainableLanded.size}`)
}

// (c) weekly-assessment boundaries (even weeks, day 5) occur 6 times.
if (weeklyAssessments !== 6) {
  fail(`expected 6 weekly-assessment boundaries, got ${weeklyAssessments}`)
}

// (e) cursor reset math returns effective start === startDate.
const resetEffectiveStart = effectiveStart(enrollmentStart, null)
if (resetEffectiveStart.getTime() !== enrollmentStart.getTime()) {
  fail(`reset_test_cursor should restore effective start === startDate, got ${resetEffectiveStart.toISOString()}`)
}

console.log(
  `PASS — 60/60 trainable sessions reached · ${advanceCount} advance_day calls · ` +
  `6/6 weekly assessments · terminal clamp reached · cursor reset restores real start date`
)
process.exit(0)
