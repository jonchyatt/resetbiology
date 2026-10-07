import assert from 'node:assert/strict'
import { journalEntryIdForDay } from '../src/lib/journal/dayEntry'
import {
  createFoodLogRequestId,
  getLocalDateTime,
  isLocalDate,
  localDateToUtcStart,
} from '../src/lib/nutrition/localEntry'

process.env.TZ = 'America/Denver'

const beforeMidnight = getLocalDateTime(new Date('2026-10-07T05:59:00.000Z'))
const afterMidnight = getLocalDateTime(new Date('2026-10-07T06:01:00.000Z'))

assert.equal(beforeMidnight.localDate, '2026-10-06')
assert.equal(beforeMidnight.localTime, '23:59:00')
assert.equal(afterMidnight.localDate, '2026-10-07')
assert.equal(afterMidnight.localTime, '00:01:00')
assert.equal(getLocalDateTime(new Date('2026-11-01T07:59:00.000Z')).localTime, '01:59:00')
assert.equal(getLocalDateTime(new Date('2026-11-01T08:01:00.000Z')).localTime, '01:01:00')

assert.equal(isLocalDate('2026-10-06'), true)
assert.equal(isLocalDate('2026-02-29'), false)
assert.equal(isLocalDate('2024-02-29'), true)
assert.equal(isLocalDate('2026-13-01'), false)
assert.equal(localDateToUtcStart('2026-10-06').toISOString(), '2026-10-06T00:00:00.000Z')

const firstId = createFoodLogRequestId()
const secondId = createFoodLogRequestId()
assert.match(firstId, /^[a-f0-9]{24}$/)
assert.match(secondId, /^[a-f0-9]{24}$/)
assert.notEqual(firstId, secondId)

const journalId = journalEntryIdForDay('507f1f77bcf86cd799439011', '2026-10-06')
assert.match(journalId, /^[a-f0-9]{24}$/)
assert.equal(journalEntryIdForDay('507f1f77bcf86cd799439011', '2026-10-06'), journalId)
assert.notEqual(journalEntryIdForDay('507f1f77bcf86cd799439011', '2026-10-07'), journalId)

console.log('RB-05 local date/time and retry-key checks passed')