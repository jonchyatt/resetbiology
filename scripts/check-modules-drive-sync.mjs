// Ticket T6 check — proves the modules-domain Drive sync chain is durable end to
// end: enqueue -> outbox row -> drain -> exactly one Drive artifact, and that a
// failure between "Drive write succeeded" and "outbox row marked done" does not
// duplicate the artifact on retry (idempotent-by-filename upload) or lose it.
//
// Runs the REAL production code (enqueueDriveSync, drainDriveSyncRowsNow,
// processClaimedRow (exercised internally), syncDomainForDate,
// syncDomainForDateWithResult's 'modules' case, formatModuleCompletions,
// getSubfolderId, uploadTextFile) from src/lib/driveSyncQueue.ts and
// src/lib/google-drive.ts. Only two things are faked, because nothing else in
// this environment can safely stand in for them: (1) @/lib/prisma — no live
// test-db credentials are available to this script, so it is replaced with an
// in-memory collection store that implements the exact subset of the Prisma API
// these two files call; (2) the Drive client — a fake drive_v3.Drive-shaped
// object with an in-memory folder/file tree, injected via the drainDriveSyncRowsNow
// / drainDriveSyncOutbox `options.getDrive` seam added for this ticket. No real
// network calls, no real Mongo.
//
// Run: node --import tsx --experimental-test-module-mocks scripts/check-modules-drive-sync.mjs

import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// ---------------------------------------------------------------------------
// Fake Prisma — in-memory collections, just the surface driveSyncQueue.ts and
// google-drive.ts's 'modules' case actually call.
// ---------------------------------------------------------------------------
let nextId = 1
const genId = () => `fake-id-${nextId++}`

const outboxRows = new Map() // id -> row
const users = new Map() // id -> { driveFolder }
const moduleCompletions = [] // { userId, moduleId, completedAt, localTime, audioDuration, fullCompletion }

let failNextDoneUpdate = false // toggled by the test to simulate a post-write crash

const fakePrisma = {
  driveSyncOutbox: {
    async upsert({ where, update, create }) {
      const key = where.userId_domain_dateStr
      const existing = [...outboxRows.values()].find(
        r => r.userId === key.userId && r.domain === key.domain && r.dateStr === key.dateStr
      )
      if (existing) {
        Object.assign(existing, update)
        return existing
      }
      const row = {
        id: genId(),
        userId: key.userId,
        domain: key.domain,
        dateStr: key.dateStr,
        status: 'pending',
        attempts: 0,
        lastError: null,
        leaseUntil: null,
        createdAt: new Date(),
        ...create,
      }
      outboxRows.set(row.id, row)
      return row
    },
    async update({ where, data }) {
      const row = outboxRows.get(where.id)
      if (!row) throw new Error(`fake outbox row not found: ${where.id}`)
      if (data.status === 'done' && failNextDoneUpdate) {
        failNextDoneUpdate = false
        throw new Error('Simulated transient DB error after Drive write succeeded')
      }
      Object.assign(row, data)
      return row
    },
  },
  user: {
    async findUnique({ where }) {
      const u = users.get(where.id)
      return u ? { driveFolder: u.driveFolder } : null
    },
  },
  moduleCompletion: {
    async findMany({ where, orderBy }) {
      let rows = moduleCompletions.filter(
        r =>
          r.userId === where.userId &&
          r.completedAt >= where.completedAt.gte &&
          r.completedAt <= where.completedAt.lte
      )
      if (orderBy?.completedAt === 'asc') rows = rows.slice().sort((a, b) => a.completedAt - b.completedAt)
      return rows
    },
  },
  async $runCommandRaw(cmd) {
    if (cmd.findAndModify !== 'DriveSyncOutbox') throw new Error(`unsupported fake command: ${cmd.findAndModify}`)
    const now = new Date()
    const candidates = [...outboxRows.values()]
      .filter(r => r.status === 'pending')
      .filter(r => r.leaseUntil === null || new Date(r.leaseUntil) < now)
      .filter(r => {
        if (!cmd.query.userId) return true
        return r.userId === cmd.query.userId.$oid && r.domain === cmd.query.domain && r.dateStr === cmd.query.dateStr
      })
      .sort((a, b) => a.createdAt - b.createdAt)

    const row = candidates[0]
    if (!row) return { value: null }

    row.status = 'inflight'
    row.leaseUntil = cmd.update.$set.leaseUntil.$date
    row.attempts += 1

    return { value: { _id: row.id, userId: row.userId, domain: row.domain, dateStr: row.dateStr, attempts: row.attempts } }
  },
}

// ---------------------------------------------------------------------------
// Fake Google Drive — in-memory folder/file tree, matches the drive_v3.Drive
// surface getSubfolderId/uploadTextFile actually call (files.list/create/update).
// ---------------------------------------------------------------------------
function makeFakeDrive() {
  const folders = new Map([['root', { name: 'Reset Biology Data', parentId: null }]])
  const files = new Map() // id -> { name, parentId, content }

  function parseQuery(q) {
    const nameMatch = q.match(/name='([^']*)'/)
    const parentMatch = q.match(/'([^']*)' in parents/)
    const isFolderQuery = q.includes("mimeType='application/vnd.google-apps.folder'")
    return { name: nameMatch?.[1], parentId: parentMatch?.[1], isFolderQuery }
  }

  return {
    files: {
      async list({ q }) {
        const { name, parentId, isFolderQuery } = parseQuery(q)
        const store = isFolderQuery ? folders : files
        const hits = [...store.entries()].filter(
          ([, v]) => v.name === name && v.parentId === parentId
        )
        return { data: { files: hits.map(([id]) => ({ id })) } }
      },
      async create({ requestBody, media }) {
        const id = genId()
        if (requestBody.mimeType === 'application/vnd.google-apps.folder') {
          folders.set(id, { name: requestBody.name, parentId: requestBody.parents[0] })
        } else {
          files.set(id, { name: requestBody.name, parentId: requestBody.parents[0], content: media?.body ?? '' })
        }
        return { data: { id } }
      },
      async update({ fileId, media }) {
        const file = files.get(fileId)
        if (!file) throw new Error(`fake drive: update on missing file ${fileId}`)
        file.content = media?.body ?? file.content
        return { data: { id: fileId } }
      },
    },
    // test helpers, not part of the real drive_v3.Drive shape
    _filesNamed(name) {
      return [...files.values()].filter(f => f.name === name)
    },
  }
}

// ---------------------------------------------------------------------------
// Wire the mock BEFORE importing anything that transitively imports @/lib/prisma
// (driveSyncQueue.ts and google-drive.ts both do).
// ---------------------------------------------------------------------------
const prismaSpecifier = pathToFileURL(path.resolve('src/lib/prisma.ts')).href
mock.module(prismaSpecifier, { namedExports: { prisma: fakePrisma } })

const { enqueueDriveSync, drainDriveSyncRowsNow } = await import('../src/lib/driveSyncQueue.ts')

test('modules domain: enqueue -> drain lands exactly one Drive artifact', async () => {
  const userId = 'user-happy-path'
  const date = new Date('2026-07-14T20:47:00Z')
  const dateStr = '2026-07-14'
  users.set(userId, { driveFolder: 'root' })
  moduleCompletions.push({
    userId,
    moduleId: 'module-3',
    completedAt: date,
    localTime: '8:47 PM',
    audioDuration: 1650,
    fullCompletion: true,
  })
  const drive = makeFakeDrive()

  await enqueueDriveSync(userId, date, ['modules'])
  const pendingRow = [...outboxRows.values()].find(r => r.userId === userId && r.domain === 'modules')
  assert.ok(pendingRow, 'enqueueDriveSync must create a DriveSyncOutbox row (UI-equivalent completion call -> enqueue row created)')
  assert.equal(pendingRow.status, 'pending')

  const result = await drainDriveSyncRowsNow(userId, date, ['modules'], { getDrive: async () => drive })
  assert.equal(result.attempted, 1)
  assert.equal(result.done, 1)
  assert.equal(result.failed, 0)
  assert.equal(pendingRow.status, 'done', 'outbox row must reach terminal done status')

  const artifacts = drive._filesNamed(`modules-${dateStr}.md`)
  assert.equal(artifacts.length, 1, 'drain must produce exactly one Drive write for the modules domain')
  assert.match(artifacts[0].content, /module-3/, 'artifact must be readable and contain the actual completion')
})

test('modules domain: crash after successful Drive write, then re-drain -> still exactly one artifact (no dupe, no loss)', async () => {
  const userId = 'user-retry-path'
  const date = new Date('2026-07-13T20:47:00Z')
  const dateStr = '2026-07-13'
  users.set(userId, { driveFolder: 'root' })
  moduleCompletions.push({
    userId,
    moduleId: 'module-1',
    completedAt: date,
    localTime: '8:47 PM',
    audioDuration: 1800,
    fullCompletion: true,
  })
  const drive = makeFakeDrive()

  await enqueueDriveSync(userId, date, ['modules'])
  const row = [...outboxRows.values()].find(r => r.userId === userId && r.domain === 'modules')
  assert.ok(row)

  // Simulate: the Drive write succeeds, but the DB call that marks the outbox
  // row 'done' fails right after (process killed / transient Mongo blip). This
  // is the realistic failure window a naive retry could turn into a duplicate.
  failNextDoneUpdate = true
  const attempt1 = await drainDriveSyncRowsNow(userId, date, ['modules'], { getDrive: async () => drive })
  assert.equal(attempt1.attempted, 1)
  assert.equal(attempt1.done, 0, 'the post-write status update was the thing that failed')
  assert.equal(attempt1.failed, 1)
  assert.equal(row.status, 'pending', 'failed attempt must requeue for retry, not silently drop')
  assert.ok(row.leaseUntil, 'backoff lease must be set so the row is not immediately re-claimed')
  assert.equal(drive._filesNamed(`modules-${dateStr}.md`).length, 1, 'the Drive write itself DID succeed before the simulated crash')

  // Simulate backoff elapsing (what the cron reconciler / next tick would see).
  row.leaseUntil = null

  const attempt2 = await drainDriveSyncRowsNow(userId, date, ['modules'], { getDrive: async () => drive })
  assert.equal(attempt2.attempted, 1)
  assert.equal(attempt2.done, 1)
  assert.equal(row.status, 'done')

  const artifacts = drive._filesNamed(`modules-${dateStr}.md`)
  assert.equal(artifacts.length, 1, 'retry after a post-write crash must NOT create a duplicate artifact')
})
