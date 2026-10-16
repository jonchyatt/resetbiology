// RB-FIX-2 unit-style checks. Run: npx tsx tests/rb-fix-2-check.ts
import assert from 'node:assert/strict'
import { appendPeptideDoseToJournal } from '../src/lib/peptideDoseJournal'
import { dayKeyToUtcMidnight } from '../src/lib/localDay'
import { ignoreEmptyString } from '../src/lib/protocolPatch'
import { repairStaleKj } from '../src/lib/nutrition/kcal'

async function main() {
  // 1. journal entry lands on the member's local day, not the UTC day of the dose instant
  const created: any[] = []
  const db: any = {
    journalEntry: {
      findFirst: async () => null,
      update: async () => { throw new Error('unexpected update') },
      create: async (a: any) => { created.push(a.data) },
    },
  }
  // 18:42 MDT on 2026-10-15 == 00:42Z on 2026-10-16
  await appendPeptideDoseToJournal(db, 'u1', new Date('2026-10-16T00:42:14Z'), '2026-10-15',
    { peptideName: 'TB-500', dosage: '250mcg', timeLabel: '18:42:14' })
  assert.equal(created.length, 1)
  assert.equal(created[0].date.toISOString(), dayKeyToUtcMidnight('2026-10-15').toISOString())
  assert.equal(JSON.parse(created[0].entry).peptideNotes, 'TB-500 dose 250mcg at 18:42:14')
  // and a second dose finds that same day (query window covers the local-day container)
  let seenWhere: any
  const db2: any = { journalEntry: {
    findFirst: async (a: any) => { seenWhere = a.where.date; return { id: 'j1', entry: created[0].entry } },
    update: async (a: any) => { created.push(a.data) }, create: async () => { throw new Error('unexpected create') } } }
  await appendPeptideDoseToJournal(db2, 'u1', new Date('2026-10-16T01:00:00Z'), '2026-10-15',
    { peptideName: 'TB-500', dosage: '250mcg', timeLabel: '19:00:00' })
  assert.equal(seenWhere.gte.toISOString(), '2026-10-15T00:00:00.000Z')
  assert.equal(seenWhere.lt.toISOString(), '2026-10-16T00:00:00.000Z')
  console.log('1 journal day: OK ->', created[0].date.toISOString())

  // 3. empty-string schedule fields are ignored, real values pass through
  assert.equal(ignoreEmptyString(''), undefined)
  assert.equal(ignoreEmptyString('  '), undefined)
  assert.equal(ignoreEmptyString('Daily'), 'Daily')
  assert.equal(ignoreEmptyString(undefined), undefined)
  console.log('3 empty-string ignored: OK')

  // 5. stale kJ row repaired, twice in a row; legit foods untouched
  const stale = { kcal: 371, protein_g: 1.09, fat_g: 0.33, carb_g: 22.84, fiber_g: 2.6, sugar_g: 12.2, sodium_mg: 1, sat_fat_g: 0.1, cholesterol_mg: 0, potassium_mg: 358 }
  assert.equal(repairStaleKj(stale)!.kcal, 89)
  assert.equal(repairStaleKj(stale)!.kcal, 89)
  assert.equal(repairStaleKj(repairStaleKj(stale))!.kcal, 89) // idempotent
  assert.equal(repairStaleKj({ ...stale, kcal: 89 })!.kcal, 89)
  assert.equal(repairStaleKj({ ...stale, kcal: 884, protein_g: 0, carb_g: 0, fat_g: 100 })!.kcal, 884) // oil
  assert.equal(repairStaleKj({ ...stale, kcal: 231, protein_g: 0, carb_g: 0, fat_g: 0 })!.kcal, 231) // vodka
  assert.equal(repairStaleKj(null), null)
  console.log('5 banana 371 -> 89 x2, idempotent, oil/vodka untouched: OK')
}
main().catch((e) => { console.error(e); process.exit(1) })
