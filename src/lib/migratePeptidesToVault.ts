/**
 * Migrate Peptide Protocols Mongo → Drive (Phase 2.5)
 *
 * One-shot per user that pushes existing Mongo-canonical protocols up to
 * Drive's `Profile/protocols.json` and converts the Mongo rows into thin
 * pointers (driveProtocolId set, canonical fields blanked).
 *
 * Concurrency model (post-Codex P2.5 review):
 *   - Per-user advisory lock via `User.vaultMigrationStartedAt`. Two parallel
 *     callbacks (e.g. user double-clicks Google's consent button) cannot
 *     both run migration — second caller short-circuits with skipped='in progress'.
 *     Stale locks older than LOCK_TTL_MS are reclaimable so a crashed
 *     migration doesn't permanently block retries.
 *   - Per-row atomic claim via `updateMany WHERE driveProtocolId IS NULL`.
 *     If a row was already migrated by a previous attempt (or by a parallel
 *     normal createProtocol that beat us to it), the claim returns count=0
 *     and we skip that row.
 *   - Drive `protocols.json` is updated with a read→merge→write retry loop.
 *     If a normal createProtocol races with us and lands a write between our
 *     read and write, we re-read, re-merge our records on top of whatever
 *     they wrote, and retry up to MAX_DRIVE_RETRIES times.
 *
 * On failure:
 *   - Drive write fails → Mongo claims for this batch are rolled back so a
 *     future retry can re-claim them.
 *   - Mongo flip fails after Drive write → leaves a Drive record with no
 *     pointer in Mongo. Benign: listActiveProtocols filters from Mongo, so
 *     the orphan is invisible. Next migration attempt will detect the row
 *     still has driveProtocolId set and skip it.
 *
 * Trigger paths:
 *   - OAuth callback (awaited fire-once after Drive connect)
 *   - POST /api/vault/migrate-peptides (explicit retry / admin)
 */

import { randomUUID } from 'crypto'
import type { drive_v3 } from 'googleapis'
import { prisma } from '@/lib/prisma'
import { getDriveClient, getSubfolderId } from '@/lib/google-drive'

const PROFILE_FOLDER = 'Profile'
const PROTOCOLS_FILE = 'protocols.json'
const LOCK_TTL_MS = 5 * 60 * 1000 // 5 min — long enough for slow Drive APIs, short enough that crashed migrations don't block retry forever
const MAX_DRIVE_RETRIES = 3

export interface MigrationResult {
  ok: boolean
  migrated: number
  alreadyMigrated: number
  errors: Array<{ protocolId: string; error: string }>
  skipped?: string
}

interface DriveProtocolRecord {
  id: string
  peptideName: string
  peptideSlug: string
  peptideId: string
  dosage: string
  frequency: string
  timing: string | null
  notes: string | null
  startDate: string
  endDate: string | null
  isActive: boolean
  administrationType: string
  createdAt: string
  updatedAt: string
}

interface ProtocolsFile {
  version: 1
  updatedAt: string
  protocols: DriveProtocolRecord[]
}

async function readProtocolsFile(
  drive: drive_v3.Drive,
  profileFolderId: string,
): Promise<{ fileId: string | null; file: ProtocolsFile }> {
  const list = await drive.files.list({
    q: `name='${PROTOCOLS_FILE}' and '${profileFolderId}' in parents and trashed=false`,
    fields: 'files(id)',
  })
  const fileId = list.data.files?.[0]?.id ?? null
  if (!fileId) {
    return {
      fileId: null,
      file: { version: 1, updatedAt: new Date().toISOString(), protocols: [] },
    }
  }
  try {
    const res = await drive.files.get({ fileId, alt: 'media' })
    const raw = typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
    const parsed = JSON.parse(raw)
    if (parsed && Array.isArray(parsed.protocols)) {
      return {
        fileId,
        file: {
          version: 1,
          updatedAt: parsed.updatedAt ?? new Date().toISOString(),
          protocols: parsed.protocols,
        },
      }
    }
  } catch (err) {
    console.error('[migratePeptides] protocols.json read failed, treating as empty:', err)
  }
  return {
    fileId,
    file: { version: 1, updatedAt: new Date().toISOString(), protocols: [] },
  }
}

async function writeProtocolsFile(
  drive: drive_v3.Drive,
  profileFolderId: string,
  fileId: string | null,
  file: ProtocolsFile,
): Promise<{ ok: boolean; fileId: string | null }> {
  const body = JSON.stringify({ ...file, updatedAt: new Date().toISOString() }, null, 2)
  try {
    if (fileId) {
      await drive.files.update({
        fileId,
        media: { mimeType: 'application/json', body },
      })
      return { ok: true, fileId }
    }
    const created = await drive.files.create({
      requestBody: {
        name: PROTOCOLS_FILE,
        parents: [profileFolderId],
        mimeType: 'application/json',
      },
      media: { mimeType: 'application/json', body },
      fields: 'id',
    })
    return { ok: true, fileId: created.data.id ?? null }
  } catch (err) {
    console.error('[migratePeptides] protocols.json write failed:', err)
    return { ok: false, fileId }
  }
}

/**
 * Read-merge-write retry. Verifies our records survived the write by
 * re-reading and checking ids are present. Catches the case where a
 * concurrent createProtocol beat us to the file between our read and write.
 */
async function appendRecordsWithRetry(
  drive: drive_v3.Drive,
  profileFolderId: string,
  newRecords: DriveProtocolRecord[],
): Promise<boolean> {
  const newIds = new Set(newRecords.map((r) => r.id))

  for (let attempt = 0; attempt < MAX_DRIVE_RETRIES; attempt++) {
    const { fileId, file } = await readProtocolsFile(drive, profileFolderId)
    const presentIds = new Set(file.protocols.map((p) => p.id))
    const toAppend = newRecords.filter((r) => !presentIds.has(r.id))

    if (toAppend.length === 0) {
      return true // someone else already merged our records (or we already wrote on a prior loop)
    }
    const merged: ProtocolsFile = {
      version: 1,
      updatedAt: new Date().toISOString(),
      protocols: [...file.protocols, ...toAppend],
    }
    const writeResult = await writeProtocolsFile(drive, profileFolderId, fileId, merged)
    if (!writeResult.ok) {
      // Drive write failure is terminal — don't retry on a failure we already
      // logged. Caller will roll back Mongo claims.
      return false
    }

    // Verify our records are present after the write
    const verify = await readProtocolsFile(drive, profileFolderId)
    const verifyIds = new Set(verify.file.protocols.map((p) => p.id))
    const allPresent = newRecords.every((r) => verifyIds.has(r.id))
    if (allPresent) return true

    console.warn(
      `[migratePeptides] write verification missed ids on attempt ${attempt + 1}; retrying`,
      { missing: [...newIds].filter((id) => !verifyIds.has(id)) },
    )
  }
  return false
}

async function tryAcquireLock(userId: string): Promise<boolean> {
  const ttlAgo = new Date(Date.now() - LOCK_TTL_MS)
  const result = await prisma.user.updateMany({
    where: {
      id: userId,
      OR: [
        { vaultMigrationStartedAt: null },
        { vaultMigrationStartedAt: { lt: ttlAgo } },
      ],
    },
    data: { vaultMigrationStartedAt: new Date() },
  })
  return result.count === 1
}

async function releaseLock(userId: string): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { vaultMigrationStartedAt: null },
    })
  } catch (err) {
    console.error('[migratePeptides] lock release failed (will time out):', err)
  }
}

export async function migratePeptidesToVault(userId: string): Promise<MigrationResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { driveFolder: true, googleDriveRefreshToken: true },
  })
  if (!user?.driveFolder || !user?.googleDriveRefreshToken) {
    return {
      ok: false,
      migrated: 0,
      alreadyMigrated: 0,
      errors: [],
      skipped: 'user not connected to Drive',
    }
  }

  const acquired = await tryAcquireLock(userId)
  if (!acquired) {
    return {
      ok: true,
      migrated: 0,
      alreadyMigrated: 0,
      errors: [],
      skipped: 'migration already in progress',
    }
  }

  try {
    const drive = await getDriveClient(userId)
    if (!drive) {
      return {
        ok: false,
        migrated: 0,
        alreadyMigrated: 0,
        errors: [],
        skipped: 'could not obtain Drive client',
      }
    }

    const profileFolderId = await getSubfolderId(drive, user.driveFolder, PROFILE_FOLDER)
    if (!profileFolderId) {
      return {
        ok: false,
        migrated: 0,
        alreadyMigrated: 0,
        errors: [],
        skipped: 'Profile subfolder missing or inaccessible',
      }
    }

    const allActive = await prisma.user_peptide_protocols.findMany({
      where: { userId, isActive: true },
      include: { peptides: true },
      orderBy: { createdAt: 'asc' },
    })
    const candidates = allActive.filter((p) => !p.driveProtocolId)
    const alreadyMigrated = allActive.length - candidates.length

    if (candidates.length === 0) {
      return { ok: true, migrated: 0, alreadyMigrated, errors: [] }
    }

    const errors: Array<{ protocolId: string; error: string }> = []
    const claimed: Array<{ mongoId: string; driveId: string; record: DriveProtocolRecord }> = []
    const nowIso = new Date().toISOString()

    // Per-row atomic claim: WHERE driveProtocolId IS NULL ensures only one
    // migration (or one createProtocol race) wins each row. If the claim
    // fails, the row was migrated underneath us — skip it.
    for (const row of candidates) {
      if (!row.peptides) {
        errors.push({ protocolId: row.id, error: 'peptide reference missing' })
        continue
      }
      const driveId = randomUUID()
      const claim = await prisma.user_peptide_protocols.updateMany({
        where: { id: row.id, driveProtocolId: null, isActive: true },
        data: { driveProtocolId: driveId, updatedAt: new Date() },
      })
      if (claim.count !== 1) {
        // Another writer beat us to this row; not an error, just a skip.
        continue
      }
      claimed.push({
        mongoId: row.id,
        driveId,
        record: {
          id: driveId,
          peptideName: row.peptides.name,
          peptideSlug: row.peptides.slug,
          peptideId: row.peptides.id,
          dosage: row.dosage ?? '',
          frequency: row.frequency ?? '',
          timing: row.timing ?? null,
          notes: row.notes ?? null,
          startDate: (row.startDate ?? new Date()).toISOString(),
          endDate: row.endDate ? row.endDate.toISOString() : null,
          isActive: true,
          administrationType: row.administrationType ?? 'injection',
          createdAt: row.createdAt.toISOString(),
          updatedAt: nowIso,
        },
      })
    }

    if (claimed.length === 0) {
      return { ok: errors.length === 0, migrated: 0, alreadyMigrated, errors }
    }

    const wrote = await appendRecordsWithRetry(
      drive,
      profileFolderId,
      claimed.map((c) => c.record),
    )

    if (!wrote) {
      // Roll back Mongo claims so a future retry can re-attempt
      for (const { mongoId } of claimed) {
        await prisma.user_peptide_protocols.updateMany({
          where: { id: mongoId, driveProtocolId: { not: null } },
          data: { driveProtocolId: null, updatedAt: new Date() },
        }).catch((err) => {
          console.error('[migratePeptides] rollback failed for', mongoId, err.message)
        })
      }
      return {
        ok: false,
        migrated: 0,
        alreadyMigrated,
        errors: [{ protocolId: 'all', error: 'Drive write failed; Mongo claims rolled back' }],
      }
    }

    // Drive is the canonical source of truth now; blank the Mongo definition
    // fields and cancel future ScheduledNotifications so Pass 1 stops sending.
    let migrated = 0
    for (const { mongoId } of claimed) {
      try {
        await prisma.user_peptide_protocols.update({
          where: { id: mongoId },
          data: {
            dosage: '',
            frequency: '',
            timing: null,
            notes: null,
            updatedAt: new Date(),
          },
        })
        await prisma.scheduledNotification.deleteMany({
          where: {
            userId,
            protocolId: mongoId,
            sent: false,
            reminderTime: { gte: new Date() },
          },
        })
        migrated += 1
      } catch (err: any) {
        errors.push({
          protocolId: mongoId,
          error: `mongo blank failed: ${err.message}`,
        })
      }
    }

    return {
      ok: errors.length === 0,
      migrated,
      alreadyMigrated,
      errors,
    }
  } finally {
    await releaseLock(userId)
  }
}
