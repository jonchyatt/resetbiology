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

async function claimNextDriveSyncRow(): Promise<ClaimedDriveSyncRow | null> {
  const now = new Date()
  const leaseUntil = new Date(now.getTime() + CLAIM_LEASE_MS)

  const result = await prisma.$runCommandRaw({
    findAndModify: 'DriveSyncOutbox',
    query: {
      status: 'pending',
      $or: [
        { leaseUntil: null },
        { leaseUntil: { $lt: now } },
      ],
    },
    sort: { createdAt: 1 },
    update: {
      $set: {
        status: 'inflight',
        leaseUntil,
        updatedAt: now,
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
      // Exhausted retries. The source data is already persisted in Mongo, so the
      // backfill sweep (TODO Phase 1.1: scan recent domain rows lacking a done
      // outbox entry) is the safety net — this log is the signal for it.
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
  max = 25
): Promise<{ claimed: number; done: number; failed: number }> {
  let claimed = 0
  let done = 0
  let failed = 0

  for (let i = 0; i < max; i += 1) {
    const row = await claimNextDriveSyncRow()
    if (!row) break

    claimed += 1

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
        failed += 1
        continue
      }

      const drive = await getDriveClient(row.userId)
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

      await prisma.driveSyncOutbox.update({
        where: { id: row.id },
        data: {
          status: 'done',
          leaseUntil: null,
          lastError: null,
        },
      })
      done += 1
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

      failed += 1
    }
  }

  return { claimed, done, failed }
}

export async function reconcileDriveSyncOutbox(): Promise<void> {
  // TODO Phase 1.1: verify done rows against Drive files and re-queue missing outputs.
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
