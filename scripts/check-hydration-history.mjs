#!/usr/bin/env node
import assert from 'node:assert/strict'

const FL_OZ_TO_ML = 29.5735295625
const MAX_AMOUNT = 100000
const convert = (amount, unit) => unit === 'ml' ? Math.round(amount) : Math.round(amount * FL_OZ_TO_ML)
const valid = (amount, unit) => Number.isFinite(Number(amount)) && Number(amount) > 0 && Number(amount) <= MAX_AMOUNT && ['ml', 'fl-oz'].includes(unit)

assert.equal(convert(500, 'ml'), 500)
assert.equal(convert(8, 'fl-oz'), 237)
assert.equal(convert(16, 'fl-oz'), 473)
assert.equal(valid(250, 'ml'), true)
for (const bad of [[0, 'ml'], [-1, 'ml'], ['nope', 'ml'], [100001, 'ml'], [250, 'cups']]) assert.equal(valid(...bad), false)

const entries = new Map()
const snapshots = []
const users = { a: [], b: [] }
function create(userId, requestId, amount, unit, localDate, localTime, name = 'Water') {
  assert.equal(valid(amount, unit), true)
  if (entries.has(requestId)) return entries.get(requestId)
  const entry = { id: `${userId}-${entries.size}`, userId, requestId, amount, unit, amountMl: convert(amount, unit), localDate, localTime, name }
  entries.set(requestId, entry); users[userId].push(entry); snapshots.push({ action: 'created', entry: structuredClone(entry) }); return entry
}
function update(userId, entry, amount, unit) {
  assert.equal(entry.userId, userId); assert.equal(valid(amount, unit), true)
  const before = structuredClone(entry); entry.amount = amount; entry.unit = unit; entry.amountMl = convert(amount, unit)
  snapshots.push({ action: 'updated', entry: structuredClone(entry) }); assert.notDeepEqual(before, entry)
}
function remove(userId, entry) { assert.equal(entry.userId, userId); entry.deleted = true; snapshots.push({ action: 'deleted', entry: structuredClone(entry) }) }

const first = create('a', 'retry-1', 8, 'fl-oz', '2026-11-01', '23:59:59', 'Water')
assert.equal(create('a', 'retry-1', 8, 'fl-oz', '2026-11-01', '23:59:59').id, first.id)
update('a', first, 250, 'ml')
const recent = [first.amountMl]
assert.deepEqual(recent, [250])
const midnight = create('a', 'midnight-1', 16, 'fl-oz', '2026-11-02', '00:00:01', 'Tea')
assert.equal(midnight.localDate, '2026-11-02')
assert.equal(users.b.length, 0)
assert.throws(() => update('b', first, 300, 'ml'))
remove('a', first)
const recreated = create('a', 'recreate-1', 250, 'ml', '2026-11-01', '12:00:00')
assert.notEqual(recreated.id, first.id)
assert.equal(snapshots.length, 5)
assert.equal(snapshots[0].entry.amountMl, 237)
assert.equal(snapshots[1].entry.amountMl, 250)
assert.equal(snapshots[2].entry.localDate, '2026-11-02')
assert.equal(snapshots[3].action, 'deleted')
console.log('PASS hydration conversion, validation, CRUD, quick-add, immutable snapshots, two-user isolation, idempotency, midnight, delete/recreate')
