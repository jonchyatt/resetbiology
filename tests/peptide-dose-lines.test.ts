import assert from 'node:assert/strict'
import { appendPeptideDoseToJournal, mergeNoteLines } from '../src/lib/peptideDoseJournal'

// in-memory journal db
const rows: any[] = []
const db: any = { journalEntry: {
  findFirst: async () => rows[0] ?? null,
  create: async ({ data }: any) => { rows.push({ id: 'a', ...data }) },
  update: async ({ data }: any) => { Object.assign(rows[0], data) },
} }
const notes = () => JSON.parse(rows[0].entry).peptideNotes
const d = new Date('2026-10-16T12:00:00Z')
async function main() {
  await appendPeptideDoseToJournal(db, 'u', d, '2026-10-16', { peptideName: 'TB-500', dosage: '300mcg', timeLabel: '09:10' })
  await appendPeptideDoseToJournal(db, 'u', d, '2026-10-16', { peptideName: 'TB-500', dosage: '300mcg', timeLabel: '21:40' })
  assert.equal(notes(), 'TB-500 dose 300mcg at 09:10\nTB-500 dose 300mcg at 21:40')
  await appendPeptideDoseToJournal(db, 'u', d, '2026-10-16', { peptideName: 'TB-500', dosage: '300mcg', timeLabel: '21:40' })
  assert.equal(notes().split('\n').length, 2)
  // stale dashboard save keeps both stored lines
  assert.equal(mergeNoteLines(notes(), 'TB-500 dose 300mcg at 21:40'), notes())
  console.log('PASS: two doses -> two lines, exact duplicate skipped, stale save keeps lines')
}
main()
