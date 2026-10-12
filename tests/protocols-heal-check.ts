/**
 * Wave J4.1 heal check: proves the protocol heal is FILL-ONLY.
 * Run: npx tsx tests/protocols-heal-check.ts   (exits 0 on pass)
 *
 * mergeDriveDetails is pure (no database, no Google): it decides which Mongo
 * fields get filled from the member's Drive copy. The live heal applies its
 * output with a Mongo filter that also requires each field to still be empty.
 */
import assert from 'node:assert/strict'
import { mergeDriveDetails, type HealRow, type ProtocolsFile, type DriveProtocolRecord } from '../src/lib/protocols-store'

function driveRecord(id: string, over: Partial<DriveProtocolRecord> = {}): DriveProtocolRecord {
  return {
    id,
    peptideName: 'BPC-157',
    peptideSlug: 'bpc-157',
    peptideId: 'p1',
    dosage: '250mcg',
    frequency: 'Daily',
    timing: '08:00/20:00',
    notes: 'with food',
    startDate: '2026-09-01T00:00:00.000Z',
    endDate: null,
    isActive: true,
    administrationType: 'injection',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...over,
  }
}
const file = (...protocols: DriveProtocolRecord[]): ProtocolsFile => ({ version: 1, updatedAt: '', protocols })
const blankRow = (id: string, driveProtocolId: string | null): HealRow => ({
  id, driveProtocolId, dosage: '', frequency: '', timing: null, notes: null,
})

// (a) a blank row plus a matching Drive record -> every empty field filled
assert.deepEqual(mergeDriveDetails([blankRow('m1', 'd1')], file(driveRecord('d1'))), [
  { id: 'm1', dosage: '250mcg', frequency: 'Daily', timing: '08:00/20:00', notes: 'with food' },
])

// (b) a row that already has details -> untouched, even when Drive disagrees
const full: HealRow = { id: 'm2', driveProtocolId: 'd2', dosage: '500mcg', frequency: 'Weekly', timing: '07:00', notes: 'mine' }
assert.deepEqual(mergeDriveDetails([full], file(driveRecord('d2'))), [])

// (b2) partly filled row -> only the empty fields come back; filled ones never appear
const partial: HealRow = { id: 'm3', driveProtocolId: 'd3', dosage: '300mcg', frequency: '', timing: null, notes: 'keep me' }
const [p] = mergeDriveDetails([partial], file(driveRecord('d3')))
assert.deepEqual(p, { id: 'm3', frequency: 'Daily', timing: '08:00/20:00' })
assert.ok(!('dosage' in p) && !('notes' in p), 'a field that has a value must never be written')

// (b3) Drive copy is itself blank for a field -> nothing to fill for that field
assert.deepEqual(mergeDriveDetails([blankRow('m4', 'd4')], file(driveRecord('d4', { notes: null, timing: '' }))), [
  { id: 'm4', dosage: '250mcg', frequency: 'Daily' },
])

// (c) a Drive record with no row -> ignored; a row with no Drive record -> ignored
assert.deepEqual(mergeDriveDetails([blankRow('m5', 'd-missing')], file(driveRecord('d-orphan'))), [])

// (c2) a row never linked to Drive -> ignored
assert.deepEqual(mergeDriveDetails([blankRow('m6', null)], file(driveRecord('d6'))), [])

// (d) an empty or null file -> no updates
assert.deepEqual(mergeDriveDetails([blankRow('m7', 'd7')], file()), [])
assert.deepEqual(mergeDriveDetails([blankRow('m7', 'd7')], null), [])
assert.deepEqual(mergeDriveDetails([blankRow('m7', 'd7')], undefined), [])

// (e) idempotent: applying a fill then merging again yields nothing more to do
const healed = { ...blankRow('m8', 'd8'), ...mergeDriveDetails([blankRow('m8', 'd8')], file(driveRecord('d8')))[0] }
assert.deepEqual(mergeDriveDetails([healed], file(driveRecord('d8', { dosage: 'CHANGED' }))), [])

// (f) the output never carries a delete or a blank value
for (const f of mergeDriveDetails([blankRow('m9', 'd9')], file(driveRecord('d9')))) {
  for (const [k, v] of Object.entries(f)) assert.ok(v !== '' && v !== null && v !== undefined, `blank value for ${k}`)
}

console.log('protocols-heal-check: all fill-only cases pass')
