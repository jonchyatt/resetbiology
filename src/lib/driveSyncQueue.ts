import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { getDriveClient, getSubfolderId, syncDomainForDate } from '@/lib/google-drive'

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
// what's ACTUALLY on Drive right now for that bucket: fileId + modifiedTime +
// content sha256. This is the receipt drive-drift-report.ts's IN_SYNC/
// HAND_EDITED classification reads back — no authority flip may ever trust a
// stale verification (HIGH-3), so the durability layer has to be able to SEE
// drift, which means recording ground truth at sync time.
//
// Storage choice (no Prisma schema change, per ticket): DriveSyncOutbox has
// exactly one free-text field, `lastError String?`. It's repurposed by
// STATUS: on 'failed'/'pending' (retry) it still holds the real error text
// (unchanged behavior); on 'done' it holds this JSON blob instead of the
// `null` it used to be set to. Nothing outside this file reads `lastError`
// (grepped repo-wide), so no consumer's contract changes. The JSON payload is
// self-describing (`v: 1`) so a reader can tell it apart from a plain error
// string by attempting JSON.parse and checking the shape.
// ---------------------------------------------------------------------------
interface SyncedFileRecord {
  fileId: string
  name: string
  modifiedTime: string | null
  sha256: string
}

export interface DriveSyncMeta {
  v: 1
  syncedAt: string
  files: SyncedFileRecord[]
}

// Domain -> vault subfolder name, mirrors the folder names google-drive.ts's
// syncDomainForDateWithResult switch already uses per domain (VAULT_SUBFOLDERS
// contract) — duplicated as data here (not logic) since that switch has no
// exported domain->folder map to import.
const DOMAIN_FOLDER_NAMES: Record<string, string> = {
  journal: 'Journal',
  workouts: 'Workouts',
  nutrition: 'Nutrition',
  breath: 'Breath Sessions',
  vision: 'Vision Training',
  nback: 'Memory Training',
  dailyTasks: 'Progress Reports',
  checkins: 'Progress Reports',
  modules: 'Progress Reports',
  peptides: 'Peptides',
}

function sha256Hex(text: string): string {
  return createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex')
}

// Best-effort snapshot of whatever's currently on Drive for this bucket.
// NEVER throws — a recording failure must not undo the sync that just
// succeeded; it only means this round's drift receipt is missing (the next
// successful sync of the same day will record one). All subfolders in scope
// here are pre-created at vault-init time (VAULT_SUBFOLDERS), so
// getSubfolderId is a find-only lookup in practice for a connected vault —
// this call does not create Drive state a healthy vault didn't already have.
async function recordSyncedFileMetadata(
  drive: Awaited<ReturnType<typeof getDriveClient>>,
  driveFolder: string,
  domain: string,
  dateStr: string
): Promise<string | null> {
  const folderName = DOMAIN_FOLDER_NAMES[domain]
  if (!drive || !folderName) return null

  try {
    const folderId = await getSubfolderId(drive, driveFolder, folderName)
    if (!folderId) return null

    const list = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false and name contains '${dateStr}'`,
      fields: 'files(id,name,modifiedTime)',
    })

    const files: SyncedFileRecord[] = []
    for (const f of list.data.files ?? []) {
      if (!f.id) continue
      const res = await drive.files.get({ fileId: f.id, alt: 'media' })
      const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
      files.push({ fileId: f.id, name: f.name ?? '', modifiedTime: f.modifiedTime ?? null, sha256: sha256Hex(text) })
    }

    const meta: DriveSyncMeta = { v: 1, syncedAt: new Date().toISOString(), files }
    return JSON.stringify(meta)
  } catch (error) {
    console.error('[drive-drift] post-sync metadata recording failed (instrumentation only, sync already succeeded):', {
      domain,
      dateStr,
      error: errorMessage(error),
    })
    return null
  }
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

    await syncDomainForDate(
      drive,
      user.driveFolder,
      row.userId,
      row.domain,
      dateFromDateStr(row.dateStr)
    )

    const syncMeta = await recordSyncedFileMetadata(drive, user.driveFolder, row.domain, row.dateStr)

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
