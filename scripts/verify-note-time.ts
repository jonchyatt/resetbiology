// RB-FIX-6: one note-time helper for workout, breath and dose lines.
// Run: TZ=America/Denver npx tsx scripts/verify-note-time.ts
import assert from 'node:assert'
import { formatNoteTime } from '../src/lib/localDay'

const utcEvent = new Date('2026-10-16T20:48:00Z') // 2:48 PM in Denver, 8:48 PM... as a naive UTC read
for (const kind of ['workout', 'breath', 'dose']) {
  assert.strictEqual(formatNoteTime('14:48:09', utcEvent), '2:48 PM', kind)
}
assert.strictEqual(formatNoteTime('02:57 10/16/2026', utcEvent), '2:57 AM') // old odd dose format
assert.strictEqual(formatNoteTime('00:05'), '12:05 AM')
assert.strictEqual(formatNoteTime('12:00'), '12:00 PM')
assert.match(formatNoteTime(null, utcEvent), /^\d{1,2}:\d{2} [AP]M$/) // no client clock: server clock
console.log('note-time helper OK')
