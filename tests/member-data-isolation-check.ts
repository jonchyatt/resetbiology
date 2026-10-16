/**
 * "Download my data" / "Delete my data" isolation check.
 * Proves one member can never read or delete another member's data.
 * Run: npx tsx tests/member-data-isolation-check.ts   (exits 0 on pass)
 *
 * Uses the real handlers and the real model list from the Prisma schema,
 * against an in-memory fake database holding two members, A and B.
 */
import assert from 'node:assert/strict'
import { exportMemberData, createMemberDataHandlers, memberDataModels, scopedWhere, delegateName } from '../src/lib/member-data'

const A = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const B = 'bbbbbbbbbbbbbbbbbbbbbbbb'
const models = memberDataModels()

// ---- model list sanity ----
for (const m of ['user_peptide_protocols', 'peptide_doses', 'JournalEntry', 'ScheduledNotification', 'ProgressPhoto', 'FoodLog']) {
  assert.ok(models.includes(m), `missing member-data model ${m}`)
}
assert.ok(!models.includes('AgentTraining'), 'admin-authored training must not be member data')
const before = (child: string, parent: string) =>
  assert.ok(models.indexOf(child) < models.indexOf(parent), `${child} must be deleted before ${parent}`)
before('peptide_doses', 'user_peptide_protocols')
before('ScheduledNotification', 'user_peptide_protocols')
before('WorkoutCheckIn', 'WorkoutAssignment')
before('VisionDailySession', 'VisionProgramEnrollment')
assert.throws(() => scopedWhere('JournalEntry', '', []), /without a user id/)

// ---- in-memory fake db ----
type Row = Record<string, any>
const tables: Record<string, Row[]> = {}
const seenWheres: Array<{ model: string; where: Row }> = []
const matches = (row: Row, where: Row) =>
  Object.entries(where).every(([k, v]) =>
    v && typeof v === 'object' && Array.isArray(v.in) ? v.in.includes(row[k]) : row[k] === v,
  )
function delegate(model: string) {
  tables[model] ??= []
  return {
    findMany: async ({ where }: { where: Row }) => {
      seenWheres.push({ model, where })
      return tables[model].filter((r) => matches(r, where))
    },
    findUnique: async ({ where }: { where: Row }) => {
      seenWheres.push({ model, where })
      return tables[model].find((r) => matches(r, where)) ?? null
    },
    deleteMany: async ({ where }: { where: Row }) => {
      seenWheres.push({ model, where })
      const keep = tables[model].filter((r) => !matches(r, where))
      const count = tables[model].length - keep.length
      tables[model] = keep
      return { count }
    },
  }
}
const db: Record<string, any> = { user: delegate('User'), $transaction: (ops: Promise<unknown>[]) => Promise.all(ops) }
for (const m of models) db[delegateName(m)] = delegate(m)

// Two members, a row of every kind each.
tables.User.push({ id: A, email: 'a@example.com', googleDriveRefreshToken: 'secret-a' }, { id: B, email: 'b@example.com', googleDriveRefreshToken: 'secret-b' })
for (const m of models) {
  if (m === 'peptide_doses') continue
  tables[m].push({ id: `${m}-A`, userId: A }, { id: `${m}-B`, userId: B })
}
tables.peptide_doses.push(
  { id: 'dose-A', protocolId: 'user_peptide_protocols-A' },
  { id: 'dose-B', protocolId: 'user_peptide_protocols-B' },
)
const bRows = () => Object.values(tables).flat().filter((r) => r.userId === B || r.id === B || r.protocolId === 'user_peptide_protocols-B').length
const B_TOTAL = bRows()
assert.equal(B_TOTAL, models.length + 1, 'B has one row per model plus the User row')

const asA = createMemberDataHandlers({ getUser: async () => tables.User.find((u) => u.id === A) ?? null, db })
const anonymous = createMemberDataHandlers({ getUser: async () => null, db })

async function main() {
  // ---- signed out: 401, nothing read or deleted ----
  assert.equal((await anonymous.GET()).status, 401)
  assert.equal((await anonymous.DELETE(new Request('http://x', { method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE' }) }))).status, 401)
  assert.equal(bRows(), B_TOTAL)
  assert.ok(tables.User.some((u) => u.id === A), 'anonymous delete removed nothing')

  // ---- download as A: only A's rows, no secrets ----
  const res = await asA.GET()
  assert.equal(res.status, 200)
  assert.match(res.headers.get('Content-Disposition') ?? '', /attachment/)
  // RB-FIX-7: the download is now a readable shape (no ids); isolation is asserted on the raw export it is built from.
  const dump = (await exportMemberData(db, A)) as any
  const shaped = JSON.stringify(await res.json())
  assert.ok(!shaped.includes(B), "readable export never mentions B's id")
  assert.equal(dump.account.id, A)
  assert.ok(!('googleDriveRefreshToken' in dump.account), 'export must not include the Drive token')
  for (const [model, rows] of Object.entries(dump.data) as Array<[string, Row[]]>) {
    assert.equal(rows.length, 1, `${model}: exactly A's one row`)
    for (const r of rows) assert.ok(r.userId === A || r.protocolId === 'user_peptide_protocols-A', `${model}: leaked a row that is not A's`)
  }
  assert.ok(!JSON.stringify(dump).includes(B), "export never mentions B's id")

  // ---- delete without typing DELETE: 400, nothing removed ----
  const noConfirm = await asA.DELETE(new Request('http://x', { method: 'DELETE', body: JSON.stringify({ confirm: 'delete' }) }))
  assert.equal(noConfirm.status, 400)
  assert.ok(tables.User.some((u) => u.id === A) && tables.JournalEntry.some((r) => r.userId === A))

  // ---- delete as A, even when the body names B: A gone, B untouched ----
  const del = await asA.DELETE(new Request('http://x', { method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE', userId: B }) }))
  assert.equal(del.status, 200)
  assert.equal(Object.values(tables).flat().filter((r) => r.userId === A || r.id === A || r.protocolId === 'user_peptide_protocols-A').length, 0, "all of A's rows deleted")
  assert.equal(bRows(), B_TOTAL, "every one of B's rows is still there")

  // ---- every query A's requests made was scoped to A ----
  for (const { model, where } of seenWheres) {
    const text = JSON.stringify(where)
    assert.ok(!text.includes(B), `${model}: a query named B`)
    assert.ok(Object.keys(where).length > 0, `${model}: an unscoped query`)
  }

  console.log(`member-data-isolation-check: pass (${models.length} tables; B untouched by A's download and delete)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
