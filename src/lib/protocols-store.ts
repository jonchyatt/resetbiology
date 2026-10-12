/**
 * Protocols Store — peptide protocols (Mongo is the store, Drive is a copy)
 *
 * Wave J4.1 (Jon ruling 2026-10-11, Drive option A): Mongo ALWAYS holds the
 * full protocol (dosage/frequency/timing/notes). When a member has connected
 * Google Drive, a best-effort copy also goes to `Profile/protocols.json`.
 * A failed Drive copy is logged and never fails the request.
 *
 * Heal: older Drive-connected rows were blanked in Mongo (the Phase 2.3/2.5
 * "Drive is canonical" design). On read, if a connected member has such a
 * blank row, we read their Drive copy once and FILL ONLY the empty fields.
 * Fill-only and idempotent: a field that already has a value is never
 * written, nothing is deleted, and reminders are only scheduled for a
 * protocol that has none queued. See tests/protocols-heal-check.ts.
 *
 * Drive JSON shape (Profile/protocols.json):
 *   { version: 1, updatedAt: ISO, protocols: [{ id, peptideName, peptideSlug, dosage, ... }] }
 */

import { randomUUID } from 'crypto'
import type { drive_v3 } from 'googleapis'
import { prisma } from '@/lib/prisma'
import { getDriveClient, getSubfolderId } from '@/lib/google-drive'
import { isVaultConnected } from '@/lib/vaultService'
import { scheduleNotificationsForProtocol } from '@/lib/scheduleNotifications'

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

// ---------------- Heal (fill-only) ----------------

const DETAIL_FIELDS = ['dosage', 'frequency', 'timing', 'notes'] as const
type DetailField = (typeof DETAIL_FIELDS)[number]

export interface HealRow {
  id: string
  driveProtocolId: string | null
  dosage: string | null
  frequency: string | null
  timing: string | null
  notes: string | null
}

/** The Mongo fields one row can get from its Drive copy. Only empty fields appear. */
export interface DriveDetailFill {
  id: string
  dosage?: string
  frequency?: string
  timing?: string | null
  notes?: string | null
}

function isBlank(v: unknown): boolean {
  return v === null || v === undefined || v === ''
}

/** A row the old Drive-canonical design blanked in Mongo. */
function needsHeal(row: HealRow): boolean {
  return !!row.driveProtocolId && (isBlank(row.dosage) || isBlank(row.frequency))
}

/**
 * Pure. For each row linked to a Drive record, return ONLY the fields that are
 * empty in Mongo and non-empty in Drive. A field that already has a value is
 * never returned, so applying the result can never overwrite member data.
 */
export function mergeDriveDetails(
  rows: HealRow[],
  file: ProtocolsFile | null | undefined,
): DriveDetailFill[] {
  const byId = new Map((file?.protocols ?? []).map((p) => [p.id, p]))
  const fills: DriveDetailFill[] = []
  for (const row of rows) {
    if (!row.driveProtocolId) continue
    const drive = byId.get(row.driveProtocolId)
    if (!drive) continue
    const fill: DriveDetailFill = { id: row.id }
    for (const k of DETAIL_FIELDS) {
      if (isBlank(row[k]) && !isBlank(drive[k])) (fill as any)[k] = drive[k]
    }
    if (Object.keys(fill).length > 1) fills.push(fill)
  }
  return fills
}

/** Mongo filter: every field we are about to fill is STILL empty (race-safe fill-only). */
function stillEmptyWhere(fields: DetailField[]) {
  return fields.map((k) =>
    k === 'dosage' || k === 'frequency'
      ? { [k]: '' }
      : { OR: [{ [k]: null }, { [k]: '' }, { [k]: { isSet: false } }] },
  )
}

/**
 * If any row was blanked by the old design, read the Drive copy once and fill
 * the empty fields in Mongo. Never throws; on any failure the rows come back
 * unchanged. Reminders are scheduled only for a healed active row that has no
 * future reminder queued (fills missing reminders, never replaces them).
 */
async function healBlankRows<T extends HealRow>(
  userId: string,
  rows: T[],
): Promise<T[]> {
  if (!rows.some(needsHeal)) return rows
  try {
    if (!(await isVaultConnected(userId))) return rows
    const file = await readProtocolsFile(userId)
    const fills = mergeDriveDetails(rows.filter(needsHeal), file)
    if (fills.length === 0) return rows

    const applied = new Map<string, DriveDetailFill>()
    for (const fill of fills) {
      const { id, ...data } = fill
      const fields = Object.keys(data) as DetailField[]
      const res = await prisma.user_peptide_protocols.updateMany({
        where: { id, userId, AND: stillEmptyWhere(fields) as any },
        data: { ...data, updatedAt: new Date() },
      })
      if (res.count !== 1) continue // someone else filled it first; leave their value alone
      applied.set(id, fill)
      console.log('[protocols-store] healed blank protocol from Drive copy', { userId, protocolId: id, fields })

      try {
        const queued = await prisma.scheduledNotification.count({
          where: { protocolId: id, sent: false, reminderTime: { gte: new Date() } },
        })
        if (queued === 0) await scheduleNotificationsForProtocol(userId, id, { daysAhead: 30 })
      } catch (err) {
        console.error('[protocols-store] heal: reminder scheduling failed', { protocolId: id, err })
      }
    }

    return rows.map((row) => {
      const fill = applied.get(row.id)
      if (!fill) return row
      const { id: _id, ...data } = fill
      return { ...row, ...data } as T
    })
  } catch (err) {
    console.error('[protocols-store] heal failed; returning rows unchanged', { userId, err })
    return rows
  }
}

/** Best-effort Drive copy: apply `mutate` to protocols.json. Logs and returns false on any failure. */
async function copyToDrive(userId: string, mutate: (file: ProtocolsFile) => boolean): Promise<boolean> {
  try {
    const file = await readProtocolsFile(userId)
    if (!file) return false
    if (!mutate(file)) return false
    const wrote = await writeProtocolsFile(userId, file)
    if (!wrote) console.error('[protocols-store] drive copy failed', { userId })
    return wrote
  } catch (err) {
    console.error('[protocols-store] drive copy failed', { userId, err })
    return false
  }
}

// ---------------- Public API ----------------

export async function listActiveProtocols(userId: string): Promise<ApiProtocolShape[]> {
  const mongoRows = await prisma.user_peptide_protocols.findMany({
    where: { userId, isActive: true },
    include: {
      peptides: true,
      peptide_doses: { orderBy: { doseDate: 'desc' }, take: 10 },
    },
    orderBy: { createdAt: 'desc' },
  })

  const rows = await healBlankRows(userId, mongoRows)
  return rows.map((row) =>
    toApiShape({ mongoRow: row, storage: row.driveProtocolId ? 'drive' : 'mongo' }),
  )
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
  const driveProtocolId = connected ? randomUUID() : null
  const timing = connected ? input.timing ?? null : input.timing || 'AM'

  // Mongo is the store: always the full protocol.
  const mongoRow = await prisma.user_peptide_protocols.create({
    data: {
      userId,
      peptideId: peptide.id,
      ...(driveProtocolId ? { driveProtocolId } : {}),
      dosage: input.dosage,
      frequency: input.frequency,
      timing,
      notes: input.notes ?? null,
      startDate,
      endDate,
      isActive: true,
      administrationType,
      updatedAt: new Date(),
    },
    include: { peptides: true },
  })

  if (driveProtocolId) {
    const nowIso = new Date().toISOString()
    await copyToDrive(userId, (file) => {
      file.protocols.push({
        id: driveProtocolId,
        peptideName: peptide.name,
        peptideSlug: peptide.slug,
        peptideId: peptide.id,
        dosage: input.dosage,
        frequency: input.frequency,
        timing,
        notes: input.notes ?? null,
        startDate: startDate.toISOString(),
        endDate: endDate ? endDate.toISOString() : null,
        isActive: true,
        administrationType,
        createdAt: nowIso,
        updatedAt: nowIso,
      })
      return true
    })
  }

  return {
    ok: true,
    protocol: toApiShape({ mongoRow, storage: driveProtocolId ? 'drive' : 'mongo' }),
  }
}

export async function updateProtocol(
  userId: string,
  protocolId: string,
  patch: ProtocolPatch,
): Promise<{ ok: true; protocol: ApiProtocolShape; timingChanged: boolean } | { ok: false; status: number; error: string }> {
  const found = await prisma.user_peptide_protocols.findUnique({
    where: { id: protocolId },
  })
  if (!found || found.userId !== userId) {
    return { ok: false, status: 404, error: 'Protocol not found or access denied' }
  }
  // Heal first, so a partial edit of a blanked row can't strand its other fields.
  const [existing] = await healBlankRows(userId, [found])

  const updateData: Record<string, unknown> = { updatedAt: new Date() }
  if (typeof patch.isActive === 'boolean') updateData.isActive = patch.isActive
  if (patch.endDate !== undefined) updateData.endDate = patch.endDate ? new Date(patch.endDate) : null
  if (patch.administrationType) updateData.administrationType = patch.administrationType
  if (patch.dosage !== undefined) updateData.dosage = patch.dosage
  if (patch.frequency !== undefined) updateData.frequency = patch.frequency
  if (patch.notes !== undefined) updateData.notes = patch.notes
  const timingChanged = patch.timing !== undefined && patch.timing !== existing.timing
  if (patch.timing !== undefined) updateData.timing = patch.timing

  const mongoRow = await prisma.user_peptide_protocols.update({
    where: { id: protocolId },
    data: updateData,
    include: { peptides: true },
  })

  if (existing.driveProtocolId) {
    const nowIso = new Date().toISOString()
    await copyToDrive(userId, (file) => {
      const idx = file.protocols.findIndex((p) => p.id === existing.driveProtocolId)
      if (idx < 0) return false
      const previous = file.protocols[idx]
      // A row that is still blank (heal could not run) must not blank the Drive copy it heals from.
      const keep = needsHeal(mongoRow)
      file.protocols[idx] = {
        ...previous,
        dosage: keep ? previous.dosage : mongoRow.dosage,
        frequency: keep ? previous.frequency : mongoRow.frequency,
        timing: keep ? previous.timing : mongoRow.timing,
        notes: keep ? previous.notes : mongoRow.notes,
        endDate: mongoRow.endDate ? mongoRow.endDate.toISOString() : null,
        isActive: mongoRow.isActive,
        administrationType: (mongoRow.administrationType ?? previous.administrationType) as AdministrationType,
        updatedAt: nowIso,
      }
      return true
    })
  }

  return {
    ok: true,
    protocol: toApiShape({ mongoRow, storage: existing.driveProtocolId ? 'drive' : 'mongo' }),
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

  // Mongo first: archive (preserve dose history)
  await prisma.user_peptide_protocols.update({
    where: { id: protocolId },
    data: { isActive: false, updatedAt: new Date() },
  })

  if (existing.driveProtocolId) {
    await copyToDrive(userId, (file) => {
      const idx = file.protocols.findIndex((p) => p.id === existing.driveProtocolId)
      if (idx < 0) return false
      file.protocols[idx] = { ...file.protocols[idx], isActive: false, updatedAt: new Date().toISOString() }
      return true
    })
  }

  return { ok: true }
}

/**
 * For the notification cron. Active protocol definitions from Mongo (healed
 * from the Drive copy when a row was blanked), without dose history.
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
  const found = await prisma.user_peptide_protocols.findMany({
    where: { userId, isActive: true },
    include: { peptides: true },
  })
  const rows = await healBlankRows(userId, found)

  return rows.map((r) => ({
    protocolId: r.id,
    driveProtocolId: r.driveProtocolId ?? null,
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
