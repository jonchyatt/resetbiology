import { createHash } from 'node:crypto'
import type { drive_v3 } from 'googleapis'
import { prisma } from '@/lib/prisma'
import { getDriveClient, syncDomainForDate } from '@/lib/google-drive'

const CLAIM_LEASE_MS = 300 * 1000 // 5 min — must exceed worst-case single-domain Drive sync so the reconciler doesn't reclaim a still-running row
const MAX_ATTEMPTS = 8
const MAX_BACKOFF_MINUTES = 30
const ENQUEUE_MAX_TRIES = 3 // transient-DB-blip guard so a fresh save isn't silently un-queued

type ClaimedDriveSyncRow = {
  id: string
  userId: string
  domain: string
  dateStr: string
  attempts: number
}

function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0]
}

function dateFromDateStr(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  if (!year || !month || !day) {
    throw new Error(`Invalid Drive sync date: ${dateStr}`)
  }
  return new Date(year, month - 1, day)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

function readObjectId(value: unknown): string | null {
  if (typeof value === 'string') return value

  const record = asRecord(value)
  if (record && typeof record.$oid === 'string') {
    return record.$oid
  }

  return null
}

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : null
}

function parseClaimedRow(value: unknown): ClaimedDriveSyncRow | null {
  const record = asRecord(value)
  if (!record) return null

  const id = readObjectId(record._id)
  const userId = readObjectId(record.userId)
  const domain = readString(record.domain)
  const dateStr = readString(record.dateStr)
  const attempts = readNumber(record.attempts)

  if (!id || !userId || !domain || !dateStr || attempts === null) {
    return null
  }

  return { id, userId, domain, dateStr, attempts }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 2000)
  }

  return String(error).slice(0, 2000)
}

function isRateLimitError(error: unknown): boolean {
  const record = asRecord(error)
  const code = record?.code
  const status = record?.status
  const statusCode = record?.statusCode
  const message = errorMessage(error).toLowerCase()

  return (
    code === 429 ||
    status === 429 ||
    statusCode === 429 ||
    message.includes('429') ||
    message.includes('rate limit') ||
    message.includes('ratelimit') ||
    message.includes('quota')
  )
}

function backoffMinutes(attempts: number, rateLimited: boolean): number {
  const base = Math.min(2 ** attempts, MAX_BACKOFF_MINUTES)
  if (!rateLimited) return base
  return Math.min(base * 2, MAX_BACKOFF_MINUTES)
}

// ---------------------------------------------------------------------------
// Drift/durability instrumentation (Phase C, ticket C3 — dark, read-side only).
// After a drain successfully processes a (user, domain, day) row, snapshot
// what was ACTUALLY just written to Drive for that bucket: fileId +
// modifiedTime + content sha256. Write-only instrumentation today — nothing
// in the repo reads it back yet; future drift tooling (drive-drift-report.ts
// et al.) may read it. No authority flip may ever trust a stale verification
// (HIGH-3), so the durability layer needs ground truth recorded at sync time.
//
// Storage choice (no Prisma schema change, per ticket): DriveSyncOutbox has
// exactly one free-text field, `lastError String?`. It's repurposed by
// STATUS: on 'failed'/'pending' (retry) it still holds the real error text
// (unchanged behavior); on 'done' it holds this JSON blob instead of the
// `null` it used to be set to. Nothing outside this file reads `lastError`
// (grepped repo-wide), so no consumer's contract changes. The JSON payload is
// self-describing (`v: 1`) so a reader can tell it apart from a plain error
// string by attempting JSON.parse and checking the shape.
//
// ZERO additional Drive calls (fix-wave finding MED-1/LOW-2): the original
// version re-listed the folder and re-downloaded every matching file after
// the fact — unbounded extra latency on every save, and a substring filename
// match that could pick up unrelated files. Fixed by capturing the upload(s)
// that ALREADY happen inside syncDomainForDate's call to drive.files.create/
// update, instead of asking Drive again afterward: wrapDriveForUploadCapture
// wraps the SAME drive client with a Proxy that (a) widens the `fields` param
// on create/update to also request `modifiedTime` (one extra response field
// on a call that was happening anyway — not an extra call) and (b) reads the
// exact content string off the request itself (`media.body`, the literal
// bytes uploadTextFile just uploaded) to hash locally. No list, no get, no
// folder resolution, no filename guessing.
// ---------------------------------------------------------------------------
interface SyncedFileRecord {
  fileId: string
  modifiedTime: string | null
  sha256: string
}

export interface DriveSyncMeta {
  v: 1
  syncedAt: string
  files: SyncedFileRecord[]
}

interface CapturedUpload {
  fileId: string | null
  modifiedTime: string | null
  content: string | null
}

function sha256Hex(text: string): string {
  return createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex')
}

function mergeFields(existing: unknown, extra: string): string {
  const base = typeof existing === 'string' && existing.length > 0 ? existing.split(',') : []
  const parts = new Set([...base.map((s) => s.trim()).filter(Boolean), ...extra.split(',')])
  return [...parts].join(',')
}

// Wraps a drive_v3.Drive client so every files.create/files.update call made
// THROUGH THIS WRAPPER (i.e. the ones syncDomainForDate's uploadTextFile
// makes) also reports {fileId, modifiedTime, content} to `onUpload` — with no
// additional Drive round trip. Any capture-side error is swallowed (the real
// upload's result is always returned untouched) so instrumentation can never
// break a sync that would otherwise have succeeded.
function wrapDriveForUploadCapture(
  drive: drive_v3.Drive,
  onUpload: (info: CapturedUpload) => void
): drive_v3.Drive {
  const files = drive.files
  const originalCreate = files.create.bind(files)
  const originalUpdate = files.update.bind(files)

  const capture = (params: any, res: any) => {
    try {
      const content = typeof params?.media?.body === 'string' ? params.media.body : null
      const fileId = (res?.data?.id as string | undefined) ?? (params?.fileId as string | undefined) ?? null
      const modifiedTime = (res?.data?.modifiedTime as string | undefined) ?? null
      onUpload({ fileId, modifiedTime, content })
    } catch (error) {
      console.error('[drive-drift] upload capture failed (instrumentation only, upload already succeeded):', errorMessage(error))
    }
  }

  const patchedFiles = new Proxy(files, {
    get(target, prop, receiver) {
      if (prop === 'create') {
        return async (params?: any, options?: any) => {
          const augmented = { ...params, fields: mergeFields(params?.fields, 'id,modifiedTime') }
          const res = await originalCreate(augmented, options)
          capture(augmented, res)
          return res
        }
      }
      if (prop === 'update') {
        return async (params?: any, options?: any) => {
          const augmented = { ...params, fields: mergeFields(params?.fields, 'id,modifiedTime') }
          const res = await originalUpdate(augmented, options)
          capture(augmented, res)
          return res
        }
      }
      return Reflect.get(target, prop, receiver)
    },
  })

  // `drive.files` is a non-configurable, non-writable OWN data property on
  // the real client (confirmed via Object.getOwnPropertyDescriptor against a
  // real google.drive() instance) — a Proxy `get` trap that reports a
  // substitute value for it violates the ES2015 [[Get]] invariant and throws
  // at runtime (live walkthrough repro, step5b-resync.log). Object.create(drive)
  // sidesteps this entirely: it's a REAL object, not a Proxy, so there is no
  // invariant to violate. Its prototype is `drive`, so every other property/
  // method (including any other non-configurable ones) is reachable
  // unchanged through the prototype chain; only `files` is shadowed.
  // NOTE: plain assignment (`wrapped.files = ...` / Object.assign) is NOT
  // enough here — a `[[Set]]` walks the prototype chain and refuses to write
  // because `drive`'s own `files` is non-writable, throwing "Cannot assign
  // to read only property" (caught by this fix's own self-test). Only
  // Object.defineProperty creates a genuine OWN property on the new object,
  // bypassing the prototype's descriptor entirely.
  const wrapped = Object.create(drive)
  Object.defineProperty(wrapped, 'files', {
    value: patchedFiles,
    writable: true,
    enumerable: true,
    configurable: true,
  })
  return wrapped as drive_v3.Drive
}

function buildSyncMeta(capturedUploads: CapturedUpload[]): string | null {
  const files: SyncedFileRecord[] = capturedUploads
    .filter((u): u is CapturedUpload & { fileId: string; content: string } => !!u.fileId && u.content !== null)
    .map((u) => ({ fileId: u.fileId, modifiedTime: u.modifiedTime, sha256: sha256Hex(u.content) }))

  if (files.length === 0) return null
  const meta: DriveSyncMeta = { v: 1, syncedAt: new Date().toISOString(), files }
  return JSON.stringify(meta)
}

type DriveClientFactory = (userId: string) => ReturnType<typeof getDriveClient>

// Optional row filter — used by drainDriveSyncRowsNow to claim ONLY the specific
// rows a request just enqueued, instead of the FIFO-next-pending row the cron
// drain uses. Same atomic findAndModify machinery either way (no separate claim
// path to drift out of sync).
type ClaimFilter = { userId: string; domain: string; dateStr: string }

async function claimNextDriveSyncRow(filter?: ClaimFilter): Promise<ClaimedDriveSyncRow | null> {
  const now = new Date()
  const leaseUntil = new Date(now.getTime() + CLAIM_LEASE_MS)

  // $runCommandRaw JSON-serializes JS Dates into plain ISO strings (NOT BSON dates),
  // which breaks $lt against real date fields and corrupts leaseUntil/updatedAt for
  // Prisma reads — measured live 2026-07-13. EJSON {$date} is required here.
  const result = await prisma.$runCommandRaw({
    findAndModify: 'DriveSyncOutbox',
    query: {
      status: 'pending',
      $or: [
        { leaseUntil: null },
        { leaseUntil: { $lt: { $date: now.toISOString() } } },
      ],
      ...(filter
        ? {
            userId: { $oid: filter.userId },
            domain: filter.domain,
            dateStr: filter.dateStr,
          }
        : {}),
    },
    sort: { createdAt: 1 },
    update: {
      $set: {
        status: 'inflight',
        leaseUntil: { $date: leaseUntil.toISOString() },
        updatedAt: { $date: now.toISOString() },
      },
      $inc: { attempts: 1 },
    },
    new: true,
  } as any)

  const resultRecord = asRecord(result)
  const claimed = parseClaimedRow(resultRecord?.value)
  if (!resultRecord?.value) return null

  if (!claimed) {
    throw new Error('Malformed DriveSyncOutbox claim result')
  }

  return claimed
}

// Shared claimed-row processor — the ONE place that turns a claimed outbox row
// into a Drive write + terminal/retry status update. Both the FIFO cron drain
// and the targeted immediate drain route through this so retry/backoff/crash-
// recovery semantics can't drift between the two call sites.
async function processClaimedRow(
  row: ClaimedDriveSyncRow,
  getDrive: DriveClientFactory
): Promise<'done' | 'failed'> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: row.userId },
      select: { driveFolder: true },
    })

    if (!user) {
      await prisma.driveSyncOutbox.update({
        where: { id: row.id },
        data: {
          status: 'user_removed',
          leaseUntil: null,
          lastError: 'User not found',
        },
      })
      return 'failed'
    }

    const drive = await getDrive(row.userId)
    if (!drive) {
      throw new Error('Google Drive not connected')
    }

    if (!user.driveFolder) {
      throw new Error('No Drive folder configured')
    }

    const capturedUploads: CapturedUpload[] = []
    const captureDrive = wrapDriveForUploadCapture(drive, (info) => capturedUploads.push(info))

    await syncDomainForDate(
      captureDrive,
      user.driveFolder,
      row.userId,
      row.domain,
      dateFromDateStr(row.dateStr)
    )

    const syncMeta = buildSyncMeta(capturedUploads)

    await prisma.driveSyncOutbox.update({
      where: { id: row.id },
      data: {
        status: 'done',
        leaseUntil: null,
        lastError: syncMeta,
      },
    })
    return 'done'
  } catch (error) {
    const lastError = errorMessage(error)
    const terminal = row.attempts >= MAX_ATTEMPTS

    if (terminal) {
      await prisma.driveSyncOutbox.update({
        where: { id: row.id },
        data: {
          status: 'failed',
          leaseUntil: null,
          lastError,
        },
      })
    } else {
      const delayMinutes = backoffMinutes(row.attempts, isRateLimitError(error))
      await prisma.driveSyncOutbox.update({
        where: { id: row.id },
        data: {
          status: 'pending',
          leaseUntil: new Date(Date.now() + delayMinutes * 60 * 1000),
          lastError,
        },
      })
    }

    return 'failed'
  }
}

export async function enqueueDriveSync(
  userId: string,
  date: Date,
  domains: string[]
): Promise<void> {
  const dateStr = toDateStr(date)

  for (const domain of domains) {
    // A fresh enqueue = a fresh intent, so reset attempts/status to give the row
    // a full retry budget even if a prior same-day run had exhausted it (Argus HIGH).
    // Retry the upsert itself a few times so a transient DB blip doesn't silently
    // drop the enqueue and break the durability claim at the front door (FLW HIGH).
    let lastError: unknown = null
    for (let attempt = 0; attempt < ENQUEUE_MAX_TRIES; attempt += 1) {
      try {
        await prisma.driveSyncOutbox.upsert({
          where: {
            userId_domain_dateStr: {
              userId,
              domain,
              dateStr,
            },
          },
          update: {
            status: 'pending',
            leaseUntil: null,
            lastError: null,
            attempts: 0,
          },
          create: {
            userId,
            domain,
            dateStr,
          },
        })
        lastError = null
        break
      } catch (error) {
        lastError = error
      }
    }
    if (lastError) {
      // Exhausted retries. The source data is already persisted in Mongo, so
      // backfillDriveSyncOutbox (runs on the drain cron) recreates the missing
      // intent from the source rows — this log is the signal for it.
      console.error('Drive sync enqueue failed (backfill will reconcile):', {
        userId,
        domain,
        dateStr,
        error: errorMessage(lastError),
      })
    }
  }
}

export async function drainDriveSyncOutbox(
  max = 25,
  options: { getDrive?: DriveClientFactory } = {}
): Promise<{ claimed: number; done: number; failed: number }> {
  const getDrive = options.getDrive ?? getDriveClient
  let claimed = 0
  let done = 0
  let failed = 0

  for (let i = 0; i < max; i += 1) {
    const row = await claimNextDriveSyncRow()
    if (!row) break

    claimed += 1
    const result = await processClaimedRow(row, getDrive)
    if (result === 'done') done += 1
    else failed += 1
  }

  return { claimed, done, failed }
}

// Immediate, targeted drain of the exact rows a request just enqueued — awaited
// by the caller, NOT fire-and-forget (S+1 lesson from 3e047b19: Vercel freezes
// the lambda after the response, so anything un-awaited here would never run in
// prod, same as the enqueue-side bug that commit fixed one day before this one).
// Claims ONLY (userId, domain, dateStr) rows via the same atomic claim path as
// the cron drain, so a concurrent cron tick can never double-process the same
// row (findAndModify is atomic; whichever caller claims it first wins, the
// other gets null and moves on). If this attempt fails or the row is already
// claimed elsewhere, the row is left exactly as the shared retry/backoff logic
// would leave it — the cron drain remains the crash-recovery backstop.
export async function drainDriveSyncRowsNow(
  userId: string,
  date: Date,
  domains: string[],
  options: { getDrive?: DriveClientFactory } = {}
): Promise<{ attempted: number; done: number; failed: number }> {
  const getDrive = options.getDrive ?? getDriveClient
  const dateStr = toDateStr(date)
  let attempted = 0
  let done = 0
  let failed = 0

  for (const domain of domains) {
    const row = await claimNextDriveSyncRow({ userId, domain, dateStr })
    if (!row) continue // already claimed/processed elsewhere, or not enqueued — nothing to do

    attempted += 1
    const result = await processClaimedRow(row, getDrive)
    if (result === 'done') done += 1
    else failed += 1
  }

  return { attempted, done, failed }
}

// The FLW-flagged front-door gap: if every enqueue upsert fails during a save,
// no outbox row exists and nothing would ever sync that day's data. This sweep
// re-derives sync intent from the SOURCE rows (the data that must not be lost)
// and creates any outbox row that is missing. Any existing row — done, pending,
// failed — counts as recorded intent and is left untouched.
const BACKFILL_CREATE_CAP = 500 // ponytail: per-run cap; the next scheduled run picks up the rest

export async function backfillDriveSyncOutbox(
  options: { windowHours?: number; userId?: string } = {}
): Promise<{ scanned: number; created: number }> {
  const windowHours = options.windowHours ?? 48
  const since = new Date(Date.now() - windowHours * 3600 * 1000)
  const userFilter = options.userId ? { userId: options.userId } : {}

  const sources: Array<[string, Array<{ userId: string; when: Date }>]> = [
    // journal: scan by touch-time (createdAt OR updatedAt — historical edits bump
    // updatedAt) but key the sync day by the entry's authoritative `date`.
    ['journal', (await prisma.journalEntry.findMany({ where: { ...userFilter, OR: [{ createdAt: { gte: since } }, { updatedAt: { gte: since } }] }, select: { userId: true, date: true } })).map(r => ({ userId: r.userId, when: r.date }))],
    ['workouts', (await prisma.workoutSession.findMany({ where: { ...userFilter, completedAt: { gte: since } }, select: { userId: true, completedAt: true } })).map(r => ({ userId: r.userId, when: r.completedAt }))],
    ['nutrition', (await prisma.foodEntry.findMany({ where: { ...userFilter, loggedAt: { gte: since } }, select: { userId: true, loggedAt: true } })).map(r => ({ userId: r.userId, when: r.loggedAt }))],
    ['breath', (await prisma.breathSession.findMany({ where: { ...userFilter, createdAt: { gte: since } }, select: { userId: true, createdAt: true } })).map(r => ({ userId: r.userId, when: r.createdAt }))],
    ['vision', (await prisma.visionSession.findMany({ where: { ...userFilter, createdAt: { gte: since } }, select: { userId: true, createdAt: true } })).map(r => ({ userId: r.userId, when: r.createdAt }))],
    ['nback', (await prisma.nBackSession.findMany({ where: { ...userFilter, createdAt: { gte: since } }, select: { userId: true, createdAt: true } })).map(r => ({ userId: r.userId, when: r.createdAt }))],
    ['dailyTasks', (await prisma.dailyTask.findMany({ where: { ...userFilter, date: { gte: since } }, select: { userId: true, date: true } })).map(r => ({ userId: r.userId, when: r.date }))],
    ['checkins', (await prisma.workoutCheckIn.findMany({ where: { ...userFilter, createdAt: { gte: since } }, select: { userId: true, createdAt: true } })).map(r => ({ userId: r.userId, when: r.createdAt }))],
    ['modules', (await prisma.moduleCompletion.findMany({ where: { ...userFilter, completedAt: { gte: since } }, select: { userId: true, completedAt: true } })).map(r => ({ userId: r.userId, when: r.completedAt }))],
  ]

  // peptide doses hang off protocols, not users
  const protocols = await prisma.user_peptide_protocols.findMany({
    where: options.userId ? { userId: options.userId } : {},
    select: { id: true, userId: true },
  })
  if (protocols.length > 0) {
    const protocolOwner = new Map(protocols.map(p => [p.id, p.userId]))
    const doses = await prisma.peptide_doses.findMany({
      where: { protocolId: { in: protocols.map(p => p.id) }, doseDate: { gte: since } },
      select: { protocolId: true, doseDate: true },
    })
    sources.push(['peptides', doses.map(d => ({ userId: protocolOwner.get(d.protocolId)!, when: d.doseDate }))])
  }

  const wanted = new Map<string, { userId: string; domain: string; dateStr: string }>()
  for (const [domain, rows] of sources) {
    for (const r of rows) {
      const dateStr = toDateStr(r.when)
      wanted.set(`${r.userId}|${domain}|${dateStr}`, { userId: r.userId, domain, dateStr })
    }
  }
  if (wanted.size === 0) return { scanned: 0, created: 0 }

  const userIds = [...new Set([...wanted.values()].map(t => t.userId))]
  const syncUsers = new Set(
    (await prisma.user.findMany({
      where: { id: { in: userIds }, googleDriveSyncEnabled: true },
      select: { id: true },
    })).map(u => u.id)
  )
  const existing = await prisma.driveSyncOutbox.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, domain: true, dateStr: true },
  })
  const recorded = new Set(existing.map(r => `${r.userId}|${r.domain}|${r.dateStr}`))

  let created = 0
  for (const [key, t] of wanted) {
    if (!syncUsers.has(t.userId) || recorded.has(key)) continue
    if (created >= BACKFILL_CREATE_CAP) break
    try {
      await prisma.driveSyncOutbox.create({ data: t })
      created += 1
    } catch {
      // unique-key race with a live enqueue — intent already recorded, exactly what we want
    }
  }
  return { scanned: wanted.size, created }
}

export async function reconcileDriveSyncOutbox(): Promise<void> {
  await prisma.driveSyncOutbox.updateMany({
    where: {
      status: 'inflight',
      leaseUntil: {
        lt: new Date(),
      },
    },
    data: {
      status: 'pending',
      leaseUntil: null,
    },
  })
}

// ---------------------------------------------------------------------------
// Self-test (no DB, no Drive credentials — a synthetic fake client shaped
// exactly like the real googleapis one) — run via:
//   npx tsx src/lib/driveSyncQueue.ts self-test
//
// Reproduces the live-walkthrough bug (step5b-resync.log,
// data/rb-drive-vault/runtime-logs/scratch-2026-07-18-9fe3/): the real
// drive_v3.Drive client's `.files` is a non-configurable, non-writable OWN
// data property (confirmed via Object.getOwnPropertyDescriptor against a
// real google.drive() instance) — a `get`-trap Proxy that substitutes a
// different value for it violates the ES2015 [[Get]] invariant and throws
// `TypeError: 'get' on proxy: property 'files' is a read-only and
// non-configurable data property...`.
// ---------------------------------------------------------------------------
function buildFakeDriveForCaptureTest(): { drive: any; calls: { create: any[]; update: any[] } } {
  const calls = { create: [] as any[], update: [] as any[] }
  const fakeFiles: any = {}
  // `create`/`update` are prototype methods on the real Resource$Files
  // instance (writable+configurable), not own-frozen properties — matches
  // that shape exactly.
  Object.defineProperty(fakeFiles, 'create', {
    value: async (params: any) => {
      calls.create.push(params)
      return { data: { id: 'new-file-id', modifiedTime: '2026-07-18T00:00:00.000Z' } }
    },
    writable: true,
    enumerable: false,
    configurable: true,
  })
  Object.defineProperty(fakeFiles, 'update', {
    value: async (params: any) => {
      calls.update.push(params)
      return { data: { id: params.fileId, modifiedTime: '2026-07-18T01:00:00.000Z' } }
    },
    writable: true,
    enumerable: false,
    configurable: true,
  })

  const fakeDrive: any = {}
  // The exact shape that trips the bug: non-configurable, non-writable own
  // data property.
  Object.defineProperty(fakeDrive, 'files', {
    value: fakeFiles,
    writable: false,
    enumerable: true,
    configurable: false,
  })
  // An arbitrary OTHER non-configurable own property, to prove pass-through
  // is unaffected by whatever approach patches `files`.
  Object.defineProperty(fakeDrive, 'context', {
    value: { marker: 'unchanged' },
    writable: false,
    enumerable: true,
    configurable: false,
  })

  return { drive: fakeDrive, calls }
}

async function runSelfTest(): Promise<boolean> {
  const assert = require('node:assert').strict
  const results: string[] = []
  let pass = true
  const checkAsync = async (label: string, fn: () => Promise<void> | void) => {
    try {
      await fn()
      results.push(`PASS: ${label}`)
    } catch (err: any) {
      pass = false
      results.push(`FAIL: ${label} -- ${err?.message ?? err}`)
    }
  }

  await checkAsync(
    'wrapDriveForUploadCapture does not throw against a non-configurable/non-writable own `files` property (repro of the live Proxy-invariant TypeError, step5b-resync.log)',
    () => {
      const { drive } = buildFakeDriveForCaptureTest()
      const wrapped: any = wrapDriveForUploadCapture(drive, () => {})
      void wrapped.files // accessing .files must not throw
    }
  )

  await checkAsync('create/update interception still captures fileId/modifiedTime/content', async () => {
    const { drive, calls } = buildFakeDriveForCaptureTest()
    const captured: CapturedUpload[] = []
    const wrapped: any = wrapDriveForUploadCapture(drive, (info) => captured.push(info))

    await wrapped.files.create({
      requestBody: { name: 'x' },
      media: { mimeType: 'text/markdown', body: 'hello world' },
      fields: 'id',
    })
    await wrapped.files.update({ fileId: 'existing-id', media: { mimeType: 'text/markdown', body: 'updated body' } })

    assert.equal(captured.length, 2)
    assert.equal(captured[0].content, 'hello world')
    assert.equal(captured[0].fileId, 'new-file-id')
    assert.equal(captured[0].modifiedTime, '2026-07-18T00:00:00.000Z')
    assert.equal(captured[1].content, 'updated body')
    assert.equal(captured[1].fileId, 'existing-id')
    assert.equal(captured[1].modifiedTime, '2026-07-18T01:00:00.000Z')

    // fields param widened to request modifiedTime alongside whatever was already requested.
    assert.ok(calls.create[0].fields.includes('id'))
    assert.ok(calls.create[0].fields.includes('modifiedTime'))
  })

  await checkAsync('an arbitrary other non-configurable own property reads through unchanged', () => {
    const { drive } = buildFakeDriveForCaptureTest()
    const wrapped: any = wrapDriveForUploadCapture(drive, () => {})
    assert.equal(wrapped.context, drive.context)
    assert.deepEqual(wrapped.context, { marker: 'unchanged' })
  })

  console.log(results.join('\n'))
  console.log(pass ? `\nSELF-TEST: ALL PASS (${results.length}/${results.length})` : '\nSELF-TEST: FAILURES PRESENT')
  return pass
}

if (require.main === module) {
  const command = process.argv[2]
  if (command === 'self-test') {
    runSelfTest().then((ok) => {
      process.exitCode = ok ? 0 : 1
    })
  } else {
    console.error('Usage: npx tsx src/lib/driveSyncQueue.ts self-test')
    process.exitCode = 1
  }
}
