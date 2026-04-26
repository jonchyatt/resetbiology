/**
 * Migrate Peptide Protocols Mongo → Drive (Phase 2.5)
 *
 * For users who created protocols BEFORE connecting their Drive Vault, this
 * one-shot pushes their existing Mongo-canonical protocols up to Drive's
 * `Profile/protocols.json` and converts the Mongo rows into thin pointer
 * rows (driveProtocolId set, canonical fields blanked) — same shape as a
 * fresh Drive-routed createProtocol.
 *
 * Idempotent: any protocol already carrying driveProtocolId is skipped.
 *
 * Side effects:
 *   - Cancels future ScheduledNotification rows for migrated protocols so
 *     Pass 1 (legacy Mongo cron) stops sending. The Drive on-demand pass
 *     (P2.4) takes over from the next tick.
 *   - Does NOT touch dose history (peptide_doses) — protocol id is
 *     preserved, so historical doses stay attached.
 *
 * Triggered by:
 *   - OAuth callback right after a successful Drive connect
 *   - Optional explicit POST /api/vault/migrate-peptides
 */

import { randomUUID } from 'crypto'
import type { drive_v3 } from 'googleapis'
import { prisma } from '@/lib/prisma'
import { getDriveClient, getSubfolderId } from '@/lib/google-drive'

const PROFILE_FOLDER = 'Profile'
const PROTOCOLS_FILE = 'protocols.json'

export interface MigrationResult {
  ok: boolean
  migrated: number
  alreadyMigrated: number
  errors: Array<{ protocolId: string; error: string }>
  skipped?: string // reason if migration short-circuited (e.g. user not connected)
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
): Promise<boolean> {
  const body = JSON.stringify({ ...file, updatedAt: new Date().toISOString() }, null, 2)
  try {
    if (fileId) {
      await drive.files.update({
        fileId,
        media: { mimeType: 'application/json', body },
      })
    } else {
      await drive.files.create({
        requestBody: {
          name: PROTOCOLS_FILE,
          parents: [profileFolderId],
          mimeType: 'application/json',
        },
        media: { mimeType: 'application/json', body },
        fields: 'id',
      })
    }
    return true
  } catch (err) {
    console.error('[migratePeptides] protocols.json write failed:', err)
    return false
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

  // Already-migrated protocols carry a non-null driveProtocolId.
  const allActive = await prisma.user_peptide_protocols.findMany({
    where: { userId, isActive: true },
    include: { peptides: true },
    orderBy: { createdAt: 'asc' },
  })
  const toMigrate = allActive.filter((p) => !p.driveProtocolId)
  const alreadyMigrated = allActive.length - toMigrate.length

  if (toMigrate.length === 0) {
    return { ok: true, migrated: 0, alreadyMigrated, errors: [] }
  }

  // Single read + single write — never call createProtocol per row, that
  // would multiply Drive round-trips and risk lost-update if the user is
  // racing the migration with a fresh add.
  const { fileId, file } = await readProtocolsFile(drive, profileFolderId)
  const existingDriveIds = new Set(file.protocols.map((p) => p.id))

  const errors: Array<{ protocolId: string; error: string }> = []
  const newDriveRecords: Array<{ mongoId: string; record: DriveProtocolRecord }> = []
  const nowIso = new Date().toISOString()

  for (const row of toMigrate) {
    if (!row.peptides) {
      errors.push({ protocolId: row.id, error: 'peptide reference missing' })
      continue
    }
    let driveId = randomUUID()
    // Belt-and-suspenders: don't reuse an id that somehow already exists in
    // protocols.json (would corrupt the existing record on push).
    while (existingDriveIds.has(driveId)) driveId = randomUUID()
    existingDriveIds.add(driveId)

    newDriveRecords.push({
      mongoId: row.id,
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

  if (newDriveRecords.length === 0) {
    return { ok: errors.length === 0, migrated: 0, alreadyMigrated, errors }
  }

  // Push new records into the file, write once.
  file.protocols.push(...newDriveRecords.map((nr) => nr.record))
  const wrote = await writeProtocolsFile(drive, profileFolderId, fileId, file)
  if (!wrote) {
    return {
      ok: false,
      migrated: 0,
      alreadyMigrated,
      errors: [{ protocolId: 'all', error: 'Drive write failed; no Mongo rows mutated' }],
    }
  }

  // Drive write succeeded — flip the Mongo rows to thin pointers and cancel
  // legacy notification queue. Each row is independent; an error on one row
  // shouldn't block the rest, so loop instead of $transaction.
  let migrated = 0
  for (const { mongoId, record } of newDriveRecords) {
    try {
      await prisma.user_peptide_protocols.update({
        where: { id: mongoId },
        data: {
          driveProtocolId: record.id,
          dosage: '',
          frequency: '',
          timing: null,
          notes: null,
          updatedAt: new Date(),
        },
      })
      // Cancel future Mongo-cron sends for this protocol — Drive cron now
      // owns it. Don't touch already-sent rows (audit history).
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
        error: `mongo flip failed: ${err.message}`,
      })
    }
  }

  return {
    ok: errors.length === 0,
    migrated,
    alreadyMigrated,
    errors,
  }
}
