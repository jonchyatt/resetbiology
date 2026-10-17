// Run: TZ=UTC npx tsx tests/rb-fix-8-check.ts
// Simulates the server clock being 01:30 UTC (= 19:30 MDT) and proves a 17:30 MDT
// append and a 19:30 MDT append land in ONE journal entry (F-1).
import assert from 'node:assert/strict'
import { appendJournalNote } from '../src/lib/journalDay'
import { appendPeptideDoseToJournal } from '../src/lib/peptideDoseJournal'

const rows: any[] = []
let n = 0
const db = {
  journalEntry: {
    findFirst: async ({ where }: any) =>
      rows.filter(r => r.userId === where.userId && r.date >= where.date.gte && r.date < where.date.lt).sort((a, b) => b.createdAt - a.createdAt)[0] ?? null,
    update: async ({ where, data }: any) => Object.assign(rows.find(r => r.id === where.id), data),
    create: async ({ data }: any) => { const r = { id: `e${++n}`, createdAt: n, ...data }; rows.push(r); return r },
  },
}
assert.equal(process.env.TZ, 'UTC', 'run with TZ=UTC')

async function main() {
const DAY = '2026-10-16' // member's day (MDT); server UTC date is already 10-17 at 19:30 MDT
await appendJournalNote(db, 'u1', DAY, 'breathNotes', 'Breath 5:30 PM', 'breath')
// server clock moved past UTC midnight (01:30 UTC = 19:30 MDT)
await appendJournalNote(db, 'u1', DAY, 'workoutNotes', 'Workout 7:30 PM', 'workout')
await appendPeptideDoseToJournal(db, 'u1', new Date('2026-10-17T01:30:00Z'), DAY, { peptideName: 'Ipamorelin', dosage: '100mcg', timeLabel: '7:30 PM' })
await appendJournalNote(db, 'u1', DAY, 'moduleNotes', 'Module 7:31 PM', 'module')

assert.equal(rows.length, 1, `expected 1 entry, got ${rows.length}`)
const e = JSON.parse(rows[0].entry)
assert.equal(e.breathNotes, 'Breath 5:30 PM')
assert.equal(e.workoutNotes, 'Workout 7:30 PM')
assert.match(e.peptideNotes, /Ipamorelin/)
assert.equal(e.moduleNotes, 'Module 7:31 PM')
assert.deepEqual(e.tasksCompleted, { breath: true, workout: true, peptides: true, module: true })
await appendJournalNote(db, 'u1', DAY, 'workoutNotes', 'Workout 2', 'workout')
assert.equal(JSON.parse(rows[0].entry).workoutNotes, 'Workout 7:30 PM\nWorkout 2')
assert.equal(rows.length, 1)
console.log('rb-fix-8 F-1 check: OK (one entry for the member day)')
}
main().catch(e => { console.error(e); process.exit(1) })
