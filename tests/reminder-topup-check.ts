/**
 * Nightly reminder top-up is idempotent: running it again creates nothing new.
 * Run: npx tsx tests/reminder-topup-check.ts   (exits 0 on pass)
 */
import assert from 'node:assert/strict'
import { dropExistingReminders } from '../src/lib/scheduleNotifications'

const t = (iso: string) => new Date(iso)
const plan = [
  { doseTime: t('2026-10-12T15:00:00Z'), type: 'push' },
  { doseTime: t('2026-10-12T15:00:00Z'), type: 'email' },
  { doseTime: t('2026-10-13T15:00:00Z'), type: 'push' },
]

// nothing queued yet -> everything is created
assert.equal(dropExistingReminders(plan, []).length, 3)

// second nightly run: the same plan against what the first run stored -> nothing new
assert.deepEqual(dropExistingReminders(plan, plan), [])

// partial overlap (one already sent, still counts as existing) -> only the missing ones
const left = dropExistingReminders(plan, [{ doseTime: t('2026-10-12T15:00:00Z'), type: 'push' }])
assert.deepEqual(left.map((n) => `${n.doseTime.toISOString()}|${n.type}`), [
  '2026-10-12T15:00:00.000Z|email',
  '2026-10-13T15:00:00.000Z|push',
])

// a different channel at the same time is not a duplicate
assert.equal(dropExistingReminders([{ doseTime: t('2026-10-12T15:00:00Z'), type: 'email' }], [{ doseTime: t('2026-10-12T15:00:00Z'), type: 'push' }]).length, 1)

// duplicates inside one plan collapse to one
assert.equal(dropExistingReminders([...plan, ...plan], []).length, 3)

console.log('reminder-topup-check: pass')
