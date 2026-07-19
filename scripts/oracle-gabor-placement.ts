/**
 * Oracle for Ticket R4 -- gabor-contrast curriculum placement (Sol's
 * plan-of-record, flw-consult-11-vanguard-spec, corrected total = 24).
 * Deterministic, walks visionMasterProgram.weeklyPlans in-process. No
 * network/DB. Assert-style, exits non-zero on any failure, prints PASS count.
 *
 * Run: node node_modules/tsx/dist/cli.mjs scripts/oracle-gabor-placement.ts
 */

import { strict as assert } from 'node:assert'
import { visionMasterProgram } from '../src/data/visionProtocols'

let passCount = 0
function pass(label: string) {
  passCount++
  console.log(`PASS: ${label}`)
}

// The full exercise-id set that existed BEFORE this ticket's change
// (captured from the pre-edit worktree via a script scan of every
// exerciseIds array). Used for the "nothing dropped" diff in check (e).
const PRE_CHANGE_ID_SET = new Set([
  'box-breath-vision',
  'eye-jumps',
  'figure8-fixation',
  'focus-pushups',
  'focus-trombone',
  'laterality-ladder',
  'mirror-scan',
  'palming-reset',
  'peripheral-pointing',
  'smooth-tracking',
  'snellen-layering-walks',
])

// Sol's exact placement matrix (flw-consult-11-vanguard-spec, corrected
// 2026-07-19: total is 24, not 23).
const EXPECTED_PLACEMENTS = new Set<string>()
for (const week of [3, 4, 5, 6, 7, 8]) {
  for (const day of [2, 4]) EXPECTED_PLACEMENTS.add(`${week}:${day}`)
}
for (const week of [9, 10, 11]) {
  for (const day of [1, 3, 5]) EXPECTED_PLACEMENTS.add(`${week}:${day}`)
}
for (const day of [1, 3, 4]) EXPECTED_PLACEMENTS.add(`12:${day}`)

assert.equal(EXPECTED_PLACEMENTS.size, 24, 'matrix itself must total 24 (12+9+3)')
pass('placement matrix totals 24 (Weeks3-8 Days2&4=12, Weeks9-11 Days1/3/5=9, Week12 Days1/3/4=3)')

// ---- Walk all 60 sessions, collect actual gabor-contrast placements + full id set ----
const actualPlacements = new Set<string>()
const postChangeIdSet = new Set<string>()
let totalSessions = 0
const duplicateIdFindings: string[] = []

for (const wp of visionMasterProgram.weeklyPlans) {
  for (const session of wp.sessions) {
    totalSessions++
    const ids = session.exerciseIds
    for (const id of ids) postChangeIdSet.add(id)

    // (d) no duplicate id within a single session's exerciseIds array
    const seen = new Set<string>()
    for (const id of ids) {
      if (seen.has(id)) duplicateIdFindings.push(`week ${wp.week} day ${session.day}: duplicate id '${id}'`)
      seen.add(id)
    }

    if (ids.includes('gabor-contrast')) {
      actualPlacements.add(`${wp.week}:${session.day}`)
    }
  }
}

assert.equal(totalSessions, 60, 'must walk exactly 60 sessions (12 weeks x 5 days)')
pass('walked exactly 60 sessions (12 weeks x 5 days)')

// (a) exactly the 24 expected sessions contain gabor-contrast, no more no less
const missing = [...EXPECTED_PLACEMENTS].filter((k) => !actualPlacements.has(k))
const extra = [...actualPlacements].filter((k) => !EXPECTED_PLACEMENTS.has(k))
assert.equal(actualPlacements.size, 24, `expected exactly 24 gabor-contrast placements, found ${actualPlacements.size}`)
assert.deepEqual(missing, [], `missing expected placements: ${missing.join(', ')}`)
assert.deepEqual(extra, [], `unexpected extra placements: ${extra.join(', ')}`)
pass('exactly the 24 matrix-specified sessions contain gabor-contrast (no more, no less)')

// (b) zero Week-1/Week-2 sessions contain gabor-contrast
const week1and2 = visionMasterProgram.weeklyPlans.filter((wp) => wp.week === 1 || wp.week === 2)
assert.equal(week1and2.length, 2, 'sanity: exactly 2 weekly plans for weeks 1-2')
for (const wp of week1and2) {
  for (const session of wp.sessions) {
    assert.equal(
      session.exerciseIds.includes('gabor-contrast'),
      false,
      `week ${wp.week} day ${session.day} must NOT contain gabor-contrast (foundation fortnight)`,
    )
  }
}
pass('zero Week-1/Week-2 sessions contain gabor-contrast')

// (c) Week-12-Day-5 (Graduation Day) does NOT contain gabor-contrast
const week12 = visionMasterProgram.weeklyPlans.find((wp) => wp.week === 12)
assert.ok(week12, 'week 12 must exist')
const week12day5 = week12!.sessions.find((s) => s.day === 5)
assert.ok(week12day5, 'week 12 day 5 must exist')
assert.equal(week12day5!.title, 'Graduation Day', 'week 12 day 5 must be Graduation Day')
assert.equal(
  week12day5!.exerciseIds.includes('gabor-contrast'),
  false,
  'Week 12 Day 5 (Graduation Day) must remain untouched -- explicitly excluded',
)
pass('Week 12 Day 5 (Graduation Day) excluded -- does not contain gabor-contrast')

// (d) no exerciseIds array has a duplicate id (any session, program-wide)
assert.deepEqual(duplicateIdFindings, [], `duplicate ids found: ${duplicateIdFindings.join('; ')}`)
pass('no exerciseIds array has a duplicate id (program-wide)')

// (e) every exercise id that existed before this change still exists somewhere
//     in the program after the change (diff full id set before/after -- nothing dropped)
const dropped = [...PRE_CHANGE_ID_SET].filter((id) => !postChangeIdSet.has(id))
assert.deepEqual(dropped, [], `ids dropped from the program: ${dropped.join(', ')}`)
pass('every pre-change exercise id still exists somewhere in the program (nothing dropped)')

// Bonus sanity: gabor-contrast itself is now a new id in the post-change set
assert.ok(postChangeIdSet.has('gabor-contrast'), 'gabor-contrast must now exist in the program id set')
pass('gabor-contrast is present in the post-change program id set')

console.log(`\n${passCount} PASS, 0 FAIL`)
