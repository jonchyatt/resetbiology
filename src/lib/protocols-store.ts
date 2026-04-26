/**
 * Protocols Store — Drive-Primary Storage for Peptide Protocols (Phase 2.3)
 *
 * Single seam between the API routes and the storage layer. When a user has
 * connected their Google Drive Vault, protocol definitions live in their
 * `Profile/protocols.json` and Mongo holds a thin pointer row. Otherwise the
 * legacy pure-Mongo path runs unchanged.
 *
 * Routing decision: per-call, based on `user.googleDriveConnectedAt && driveFolder`.
 * No sync, no migration — the path is determined fresh each call. P2.5 will
 * handle one-time migration of existing users' Mongo data into Drive.
 *
 * Mongo row shape for Drive-connected users:
 *   - id                  (Mongo ObjectId, used by peptide_doses + scheduledNotifications relations)
 *   - userId, peptideId   (foreign keys preserved)
 *   - driveProtocolId     (canonical id used inside protocols.json)
 *   - isActive            (mirrored for fast filtering)
 *   - createdAt, updatedAt
 *   - dosage/frequency/timing/notes/etc. = "" / null  (NOT persisted)
 *
 * Drive JSON shape (Profile/protocols.json):
 *   { version: 1, updatedAt: ISO, protocols: [{ id, peptideName, peptideSlug, dosage, ... }] }
 */

import { randomUUID } from 'crypto'
import type { drive_v3 } from 'googleapis'
import { prisma } from '@/lib/prisma'
import { getDriveClient, getSubfolderId } from '@/lib/google-drive'
import { isVaultConnected } from '@/lib/vaultService'

// ---------------- Types ----------------

export type AdministrationType = 'injection' | 'oral' | 'nasal' | 'topical'

export interface ProtocolInput {
  peptideId?: string
  peptideName?: string
  dosage: string
  frequency: string
  timing?: string
  notes?: string | null
  startDate?: string | Date
  endDate?: string | Date | null
  timezone?: string | null
  administrationType?: AdministrationType
}

export interface ProtocolPatch {
  isActive?: boolean
  dosage?: string
  frequency?: string
  timing?: string
  notes?: string | null
  endDate?: string | Date | null
  administrationType?: AdministrationType
}

export interface DriveProtocolRecord {
  id: string
  peptideName: string
  peptideSlug: string
  peptideId: string // mirrors Mongo catalog id for client convenience
  dosage: string
  frequency: string
  timing: string | null
  notes: string | null
  startDate: string // ISO
  endDate: string | null
  isActive: boolean
  administrationType: AdministrationType
  createdAt: string
  updatedAt: string
}

export interface ProtocolsFile {
  version: 1
  updatedAt: string
  protocols: DriveProtocolRecord[]
}

/** API-facing shape: same as the legacy Mongo response so PeptideTracker.tsx is unchanged. */
export interface ApiProtocolShape {
  id: string
  userId: string
  peptideId: string
  driveProtocolId: string | null
  startDate: Date
  endDate: Date | null
  dosage: string
  frequency: string
  timing: string | null
  notes: string | null
  isActive: boolean
  administrationType: string
  createdAt: Date
  updatedAt: Date
  peptides: {
    id: string
    name: string
    slug: string
    category: string | null
    reconstitution: string | null
    dosage: string | null
  } | null
  peptide_doses: Array<unknown>
  storage: 'mongo' | 'drive'
}

const PROTOCOLS_FILE = 'protocols.json'
const PROFILE_FOLDER = 'Profile'

// ---------------- Drive helpers ----------------

async function getOrCreatePartitionFolder(
  drive: drive_v3.Drive,
  rootFolderId: string,
  partition: string,
): Promise<string | null> {
  return getSubfolderId(drive, rootFolderId, partition)
}

async function readProtocolsFile(userId: string): Promise<ProtocolsFile | null> {
  const drive = await getDriveClient(userId)
  if (!drive) return null

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { driveFolder: true },
  })
  if (!user?.driveFolder) return null

  const profileFolderId = await getOrCreatePartitionFolder(drive, user.driveFolder, PROFILE_FOLDER)
  if (!profileFolderId) return null

  const list = await drive.files.list({
    q: `name='${PROTOCOLS_FILE}' and '${profileFolderId}' in parents and trashed=false`,
    fields: 'files(id)',
  })
  const fileId = list.data.files?.[0]?.id
  if (!fileId) return emptyProtocolsFile()

  try {
    const res = await drive.files.get({ fileId, alt: 'media' })
    const raw = typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
    const parsed = JSON.parse(raw)
    if (parsed && Array.isArray(parsed.protocols)) {
      return { version: 1, updatedAt: parsed.updatedAt ?? new Date().toISOString(), protocols: parsed.protocols }
    }
    return emptyProtocolsFile()
  } catch (err) {
    console.error('[protocols-store] read failed:', err)
    return emptyProtocolsFile()
  }
}

async function writeProtocolsFile(userId: string, file: ProtocolsFile): Promise<boolean> {
  const drive = await getDriveClient(userId)
  if (!drive) return false

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { driveFolder: true },
  })
  if (!user?.driveFolder) return false

  const profileFolderId = await getOrCreatePartitionFolder(drive, user.driveFolder, PROFILE_FOLDER)
  if (!profileFolderId) return false

  const list = await drive.files.list({
    q: `name='${PROTOCOLS_FILE}' and '${profileFolderId}' in parents and trashed=false`,
    fields: 'files(id)',
  })
  const existingId = list.data.files?.[0]?.id
  const body = JSON.stringify({ ...file, updatedAt: new Date().toISOString() }, null, 2)

  try {
    if (existingId) {
      await drive.files.update({
        fileId: existingId,
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
    console.error('[protocols-store] write failed:', err)
    return false
  }
}

function emptyProtocolsFile(): ProtocolsFile {
  return { version: 1, updatedAt: new Date().toISOString(), protocols: [] }
}

// ---------------- Shared helpers ----------------

async function findOrCreatePeptide(input: ProtocolInput) {
  if (input.peptideId) {
    const peptide = await prisma.peptide.findUnique({ where: { id: input.peptideId } })
    if (peptide) return peptide
  }
  if (input.peptideName) {
    const existing = await prisma.peptide.findFirst({
      where: { name: { equals: input.peptideName, mode: 'insensitive' } },
    })
    if (existing) return existing
    const slug = input.peptideName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
    return prisma.peptide.create({
      data: {
        name: input.peptideName,
        slug,
        category: 'Custom',
        dosage: input.dosage || '250mcg',
        price: 0,
        updatedAt: new Date(),
      },
    })
  }
  return null
}

function toApiShape(args: {
  mongoRow: any
  driveRecord?: DriveProtocolRecord
  storage: 'mongo' | 'drive'
}): ApiProtocolShape {
  const { mongoRow, driveRecord, storage } = args
  const startDate = driveRecord ? new Date(driveRecord.startDate) : mongoRow.startDate
  const endDate = driveRecord ? (driveRecord.endDate ? new Date(driveRecord.endDate) : null) : mongoRow.endDate
  return {
    id: mongoRow.id,
    userId: mongoRow.userId,
    peptideId: mongoRow.peptideId,
    driveProtocolId: mongoRow.driveProtocolId ?? null,
    startDate,
    endDate,
    dosage: driveRecord?.dosage ?? mongoRow.dosage ?? '',
    frequency: driveRecord?.frequency ?? mongoRow.frequency ?? '',
    timing: driveRecord?.timing ?? mongoRow.timing ?? null,
    notes: driveRecord?.notes ?? mongoRow.notes ?? null,
    isActive: mongoRow.isActive,
    administrationType:
      driveRecord?.administrationType ?? mongoRow.administrationType ?? 'injection',
    createdAt: mongoRow.createdAt,
    updatedAt: mongoRow.updatedAt,
    peptides: mongoRow.peptides ?? null,
    peptide_doses: mongoRow.peptide_doses ?? [],
    storage,
  }
}

// ---------------- Public API ----------------

export async function listActiveProtocols(userId: string): Promise<ApiProtocolShape[]> {
  const connected = await isVaultConnected(userId)

  const mongoRows = await prisma.user_peptide_protocols.findMany({
    where: { userId, isActive: true },
    include: {
      peptides: true,
      peptide_doses: { orderBy: { doseDate: 'desc' }, take: 10 },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!connected) {
    return mongoRows.map((row) => toApiShape({ mongoRow: row, storage: 'mongo' }))
  }

  const file = await readProtocolsFile(userId)
  const driveById = new Map<string, DriveProtocolRecord>(
    (file?.protocols ?? []).map((p) => [p.id, p]),
  )

  return mongoRows.map((row) => {
    const driveRecord = row.driveProtocolId ? driveById.get(row.driveProtocolId) : undefined
    return toApiShape({
      mongoRow: row,
      driveRecord,
      storage: row.driveProtocolId ? 'drive' : 'mongo',
    })
  })
}

export async function createProtocol(
  userId: string,
  input: ProtocolInput,
): Promise<{ ok: true; protocol: ApiProtocolShape } | { ok: false; status: number; error: string }> {
  if (!input.peptideId && !input.peptideName) {
    return { ok: false, status: 400, error: 'Must provide either peptideId or peptideName' }
  }
  if (!input.dosage || !input.frequency) {
    return { ok: false, status: 400, error: 'Missing required fields: dosage, frequency' }
  }

  const peptide = await findOrCreatePeptide(input)
  if (!peptide) {
    return { ok: false, status: 404, error: 'Peptide not found and unable to create' }
  }

  const connected = await isVaultConnected(userId)
  const startDate = input.startDate ? new Date(input.startDate) : new Date()
  const endDate = input.endDate ? new Date(input.endDate) : null
  const administrationType = (input.administrationType || 'injection') as AdministrationType

  if (connected) {
    const driveProtocolId = randomUUID()
    const nowIso = new Date().toISOString()
    const driveRecord: DriveProtocolRecord = {
      id: driveProtocolId,
      peptideName: peptide.name,
      peptideSlug: peptide.slug,
      peptideId: peptide.id,
      dosage: input.dosage,
      frequency: input.frequency,
      timing: input.timing ?? null,
      notes: input.notes ?? null,
      startDate: startDate.toISOString(),
      endDate: endDate ? endDate.toISOString() : null,
      isActive: true,
      administrationType,
      createdAt: nowIso,
      updatedAt: nowIso,
    }

    const file = (await readProtocolsFile(userId)) ?? emptyProtocolsFile()
    file.protocols.push(driveRecord)
    const wrote = await writeProtocolsFile(userId, file)
    if (!wrote) {
      return { ok: false, status: 502, error: 'Failed to write protocol to your Google Drive Vault' }
    }

    // Thin pointer row — preserves doses + notification relations without
    // duplicating the protocol definition.
    const pointer = await prisma.user_peptide_protocols.create({
      data: {
        userId,
        peptideId: peptide.id,
        driveProtocolId,
        startDate,
        endDate,
        dosage: '', // canonical lives in Drive
        frequency: '',
        timing: null,
        notes: null,
        isActive: true,
        administrationType,
        updatedAt: new Date(),
      },
      include: { peptides: true },
    })

    return {
      ok: true,
      protocol: toApiShape({ mongoRow: pointer, driveRecord, storage: 'drive' }),
    }
  }

  // Legacy pure-Mongo path (unchanged behavior)
  const mongoRow = await prisma.user_peptide_protocols.create({
    data: {
      userId,
      peptideId: peptide.id,
      dosage: input.dosage,
      frequency: input.frequency,
      timing: input.timing || 'AM',
      notes: input.notes ?? null,
      startDate,
      endDate,
      isActive: true,
      administrationType,
      updatedAt: new Date(),
    },
    include: { peptides: true },
  })

  return { ok: true, protocol: toApiShape({ mongoRow, storage: 'mongo' }) }
}

export async function updateProtocol(
  userId: string,
  protocolId: string,
  patch: ProtocolPatch,
): Promise<{ ok: true; protocol: ApiProtocolShape; timingChanged: boolean } | { ok: false; status: number; error: string }> {
  const existing = await prisma.user_peptide_protocols.findUnique({
    where: { id: protocolId },
  })
  if (!existing || existing.userId !== userId) {
    return { ok: false, status: 404, error: 'Protocol not found or access denied' }
  }

  const useDrive = !!existing.driveProtocolId
  const nowIso = new Date().toISOString()

  let driveRecord: DriveProtocolRecord | undefined
  let timingChanged = false

  if (useDrive) {
    const file = await readProtocolsFile(userId)
    if (!file) {
      return { ok: false, status: 502, error: 'Could not read protocols from your Vault' }
    }
    const idx = file.protocols.findIndex((p) => p.id === existing.driveProtocolId)
    if (idx < 0) {
      return { ok: false, status: 404, error: 'Protocol not found in your Vault' }
    }
    const previous = file.protocols[idx]
    const next: DriveProtocolRecord = {
      ...previous,
      dosage: patch.dosage ?? previous.dosage,
      frequency: patch.frequency ?? previous.frequency,
      timing: patch.timing !== undefined ? patch.timing : previous.timing,
      notes: patch.notes !== undefined ? patch.notes : previous.notes,
      endDate:
        patch.endDate !== undefined
          ? patch.endDate
            ? new Date(patch.endDate).toISOString()
            : null
          : previous.endDate,
      isActive: patch.isActive ?? previous.isActive,
      administrationType: patch.administrationType ?? previous.administrationType,
      updatedAt: nowIso,
    }
    timingChanged = patch.timing !== undefined && previous.timing !== next.timing
    file.protocols[idx] = next
    const wrote = await writeProtocolsFile(userId, file)
    if (!wrote) {
      return { ok: false, status: 502, error: 'Failed to update protocol in your Vault' }
    }
    driveRecord = next
  }

  // Mongo update — for Drive users, only mirror isActive + endDate + administrationType
  // (the relation-relevant fields). For legacy users, full record update.
  const updateData: Record<string, unknown> = { updatedAt: new Date() }
  if (typeof patch.isActive === 'boolean') updateData.isActive = patch.isActive
  if (patch.endDate !== undefined) updateData.endDate = patch.endDate ? new Date(patch.endDate) : null
  if (patch.administrationType) updateData.administrationType = patch.administrationType

  if (!useDrive) {
    if (patch.dosage !== undefined) updateData.dosage = patch.dosage
    if (patch.frequency !== undefined) updateData.frequency = patch.frequency
    if (patch.timing !== undefined) {
      updateData.timing = patch.timing
      timingChanged = patch.timing !== existing.timing
    }
    if (patch.notes !== undefined) updateData.notes = patch.notes
  }

  const mongoRow = await prisma.user_peptide_protocols.update({
    where: { id: protocolId },
    data: updateData,
    include: { peptides: true },
  })

  return {
    ok: true,
    protocol: toApiShape({ mongoRow, driveRecord, storage: useDrive ? 'drive' : 'mongo' }),
    timingChanged,
  }
}

export async function archiveProtocol(
  userId: string,
  protocolId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const existing = await prisma.user_peptide_protocols.findUnique({ where: { id: protocolId } })
  if (!existing) return { ok: false, status: 404, error: 'Protocol not found' }
  if (existing.userId !== userId) return { ok: false, status: 403, error: 'Access denied' }

  if (existing.driveProtocolId) {
    const file = await readProtocolsFile(userId)
    if (file) {
      const idx = file.protocols.findIndex((p) => p.id === existing.driveProtocolId)
      if (idx >= 0) {
        file.protocols[idx] = {
          ...file.protocols[idx],
          isActive: false,
          updatedAt: new Date().toISOString(),
        }
        await writeProtocolsFile(userId, file)
      }
    }
  }

  // Mongo: archive (preserve dose history)
  await prisma.user_peptide_protocols.update({
    where: { id: protocolId },
    data: { isActive: false, updatedAt: new Date() },
  })

  return { ok: true }
}

/**
 * For P2.4 notification compute. Returns active protocol definitions
 * (Drive or Mongo, normalized) without dose history. Cheaper read.
 */
export interface ActiveProtocolForCron {
  protocolId: string // Mongo id (used as ScheduledNotification.protocolId)
  driveProtocolId: string | null
  userId: string
  peptideName: string
  dosage: string
  frequency: string
  timing: string | null
  startDate: Date
  endDate: Date | null
  administrationType: string
}

export async function listActiveProtocolsLite(userId: string): Promise<ActiveProtocolForCron[]> {
  const connected = await isVaultConnected(userId)
  const rows = await prisma.user_peptide_protocols.findMany({
    where: { userId, isActive: true },
    include: { peptides: true },
  })

  if (!connected) {
    return rows.map((r) => ({
      protocolId: r.id,
      driveProtocolId: null,
      userId: r.userId,
      peptideName: r.peptides?.name ?? 'Unknown',
      dosage: r.dosage,
      frequency: r.frequency,
      timing: r.timing,
      startDate: r.startDate,
      endDate: r.endDate,
      administrationType: r.administrationType ?? 'injection',
    }))
  }

  const file = await readProtocolsFile(userId)
  const byId = new Map<string, DriveProtocolRecord>((file?.protocols ?? []).map((p) => [p.id, p]))

  return rows.map((r) => {
    const drive = r.driveProtocolId ? byId.get(r.driveProtocolId) : undefined
    return {
      protocolId: r.id,
      driveProtocolId: r.driveProtocolId,
      userId: r.userId,
      peptideName: drive?.peptideName ?? r.peptides?.name ?? 'Unknown',
      dosage: drive?.dosage ?? r.dosage,
      frequency: drive?.frequency ?? r.frequency,
      timing: drive?.timing ?? r.timing,
      startDate: drive ? new Date(drive.startDate) : r.startDate,
      endDate: drive ? (drive.endDate ? new Date(drive.endDate) : null) : r.endDate,
      administrationType: drive?.administrationType ?? r.administrationType ?? 'injection',
    }
  })
}
