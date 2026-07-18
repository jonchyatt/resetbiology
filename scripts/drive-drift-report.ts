// Drive drift/durability report (Phase C, ticket C3 — data/rb-drive-vault
// plan-2026-07-18-9fe3.md HIGH-3 prerequisite). Fully read-only: never
// mutates Mongo, never mutates Drive, never mutates a MigrationManifest row.
// Same operational shape as scripts/drive-migration-harness.ts (arg parsing,
// self-test-first, dynamic import after dotenv, re-download-and-sha256).
//
// Two modes:
//   drift (default) — for a user/domain, classify every day bucket into
//     IN_SYNC | HAND_EDITED | MISSING | ORPHAN | DIVERGENT_NAME by comparing
//     what Mongo would emit right now (via the SHARED emitter,
//     src/lib/journal-day-file.ts — never a duplicated formatter) against
//     what's actually in the domain's Drive folder.
//   --check-manifest — for a user/domain with a MigrationManifest, re-checks
//     each manifest record's driveFileId still exists and its current
//     content hash vs the manifest's recorded hash: VALID or STALE per
//     record + an overall verdict. This is the re-verify hook HIGH-3 wants
//     an authority flip's precondition to call — it reads LIVE Drive state,
//     never a cached verdict, and never touches manifest.status itself
//     (status changes stay with the harness).
//
// Domain-generic structure; only journal is wired today (matches the
// migration harness's own "ADAPTERS = { journal: journalAdapter }" posture).
//
// Subcommands:
//   --user <email|id> [--domain journal] [--out <path>]                (drift report)
//   --user <email|id> [--domain journal] --check-manifest [--out <path>] (manifest re-verify)
//   self-test  (pure-function checks, no credentials — see src/lib/drive-drift-classify.ts)
//
// Run: npx tsx scripts/drive-drift-report.ts <flags>

import * as dotenv from 'dotenv'
import { createHash } from 'node:crypto'
import { writeFileSync, mkdirSync } from 'node:fs'
import * as path from 'node:path'
import type { drive_v3 } from 'googleapis'
// journal-day-file.ts touches no env vars/credentials at module load (unlike
// google-drive.ts, which reads process.env.GOOGLE_CLIENT_ID at import time),
// so it's safe to import statically here — same reasoning the migration
// harness documents for its own static import of this file.
import { formatJournalDayFile, foldGoalsIntoContent, type JournalDayRow } from '../src/lib/journal-day-file'
import {
  classifyBucket,
  matchCanonicalDayFileName,
  runSelfTest as runClassifySelfTest,
  type DriftClassification,
} from '../src/lib/drive-drift-classify'
// Type-only import (consume, don't edit) — ManifestRecord/ManifestBlob are
// the harness's own exported shapes for the Json blob stored on
// MigrationManifest.records; reusing the types keeps --check-manifest
// reading exactly what migrate/verify wrote, with no duplicated schema.
import type { ManifestRecord, ManifestBlob } from './drive-migration-harness'

function sha256(bytes: string | Buffer): string {
  return createHash('sha256').update(bytes as any).digest('hex')
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

// Local re-implementation of the harness's (unexported) readManifestBlob —
// a few lines of tolerant parsing, not a formatter, so this isn't the
// "duplicated formatter" the ticket warns against (that rule is about the
// journal day-file emitter, which this script never re-implements).
function readManifestBlob(raw: unknown): ManifestBlob {
  if (Array.isArray(raw)) {
    return { items: raw as ManifestRecord[], duplicateDayGroups: 0, cutoverHazards: [] }
  }
  const obj = (raw ?? {}) as Partial<ManifestBlob>
  return {
    items: Array.isArray(obj.items) ? obj.items : [],
    duplicateDayGroups: typeof obj.duplicateDayGroups === 'number' ? obj.duplicateDayGroups : 0,
    cutoverHazards: Array.isArray(obj.cutoverHazards) ? obj.cutoverHazards : [],
  }
}

// ---------------------------------------------------------------------------
// Domain adapter — the "domain-generic module" seam (mirrors the migration
// harness's DomainAdapter). Journal is the only wired adapter today.
// ---------------------------------------------------------------------------
interface DriftAdapter {
  domain: string
  driveFolderName: string
  /** Returns the YYYY-MM-DD date string if `name` is the canonical file name for that date, else null. */
  parseCanonicalName(name: string): string | null
  /** dateStr -> the content Mongo would emit for that day right now, via the shared emitter. */
  fetchExpectedContentByDay(prisma: any, userId: string): Promise<Map<string, string>>
}

const journalDriftAdapter: DriftAdapter = {
  domain: 'journal',
  driveFolderName: 'Journal',
  parseCanonicalName: (name) => matchCanonicalDayFileName('journal', 'md', name),
  fetchExpectedContentByDay: async (prisma, userId) => {
    const rows = await prisma.journalEntry.findMany({ where: { userId } })
    const byDate = new Map<string, any[]>()
    for (const row of rows) {
      const dateStr = new Date(row.date).toISOString().split('T')[0]
      const list = byDate.get(dateStr) ?? []
      list.push(row)
      byDate.set(dateStr, list)
    }
    const result = new Map<string, string>()
    for (const [dateStr, dayRows] of byDate) {
      // Same row-mapping glue as google-drive.ts's syncDomainForDateWithResult
      // case 'journal' and the migration harness's journalAdapter — the
      // shared part is the emitter call (formatJournalDayFile), not this
      // parsing/mapping step.
      const jRows: JournalDayRow[] = dayRows.map((r) => {
        let parsed: { content?: string; goals?: string; [k: string]: unknown } = {}
        try {
          parsed = r.entry ? JSON.parse(r.entry) : {}
        } catch {
          parsed = { content: r.entry }
        }
        return {
          rowId: r.id,
          createdAt: r.createdAt,
          mood: r.mood ?? null,
          weight: r.weight ?? null,
          content: foldGoalsIntoContent(parsed.content || '', parsed.goals),
          payload: parsed,
        }
      })
      result.set(dateStr, formatJournalDayFile(dateStr, jRows))
    }
    return result
  },
}

const DRIFT_ADAPTERS: Record<string, DriftAdapter> = { journal: journalDriftAdapter }

// ---------------------------------------------------------------------------
// CLI arg parsing (identical shape to drive-migration-harness.ts)
// ---------------------------------------------------------------------------
function parseArgs(argv: string[]) {
  const flags: Record<string, string | boolean> = {}
  const positionals: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next
        i++
      } else {
        flags[key] = true
      }
    } else {
      positionals.push(a)
    }
  }
  return { flags, command: positionals[0] }
}

// ---------------------------------------------------------------------------
// Drive helpers (same re-download-and-sha256 pattern as the harness)
// ---------------------------------------------------------------------------
async function downloadAndHash(drive: drive_v3.Drive, fileId: string): Promise<string> {
  const res = await drive.files.get({ fileId, alt: 'media' })
  const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
  return sha256(Buffer.from(text, 'utf8'))
}

interface DriveFileRecord {
  fileId: string
  name: string
  modifiedTime: string | null
  hash: string
}

async function listAndHashFolder(drive: drive_v3.Drive, folderId: string): Promise<DriveFileRecord[]> {
  const list = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id,name,modifiedTime)',
  })
  const out: DriveFileRecord[] = []
  for (const f of list.data.files ?? []) {
    if (!f.id) continue
    const hash = await downloadAndHash(drive, f.id)
    out.push({ fileId: f.id, name: f.name ?? '', modifiedTime: f.modifiedTime ?? null, hash })
  }
  return out
}

// ---------------------------------------------------------------------------
// Drift report
// ---------------------------------------------------------------------------
interface DriftRow {
  dateStr: string | null
  classification: DriftClassification
  expectedHash: string | null
  actualFileId: string | null
  actualFileName: string | null
  actualHash: string | null
  actualModifiedTime: string | null
}

async function runDriftReport(
  prisma: any,
  drive: drive_v3.Drive,
  driveFolder: string,
  adapter: DriftAdapter,
  userLabel: string
): Promise<{ rows: DriftRow[]; summary: Record<DriftClassification, number> }> {
  const { getSubfolderId } = await import('../src/lib/google-drive')

  const expectedByDay = new Map<string, string>()
  const expectedHashByDay = new Map<string, string>()
  for (const [dateStr, content] of await adapter.fetchExpectedContentByDay(prisma, userLabel)) {
    expectedByDay.set(dateStr, content)
    expectedHashByDay.set(dateStr, sha256(Buffer.from(content, 'utf8')))
  }

  const folderId = await getSubfolderId(drive, driveFolder, adapter.driveFolderName)
  const allFiles = folderId ? await listAndHashFolder(drive, folderId) : []

  const canonical = new Map<string, DriveFileRecord>()
  const nonCanonical: DriveFileRecord[] = []
  for (const f of allFiles) {
    const dateStr = adapter.parseCanonicalName(f.name)
    if (dateStr) canonical.set(dateStr, f)
    else nonCanonical.push(f)
  }

  const consumed = new Set<string>()
  const allDates = new Set<string>([...expectedHashByDay.keys(), ...canonical.keys()])
  const rows: DriftRow[] = []

  for (const dateStr of [...allDates].sort()) {
    const expectedHash = expectedHashByDay.get(dateStr) ?? null
    const canonicalRec = canonical.get(dateStr) ?? null
    let divergentMatch: DriveFileRecord | null = null

    if (expectedHash !== null && canonicalRec === null) {
      divergentMatch = nonCanonical.find((f) => !consumed.has(f.fileId) && f.hash === expectedHash) ?? null
      if (divergentMatch) consumed.add(divergentMatch.fileId)
    }

    const classification = classifyBucket({
      expectedHash,
      canonicalActualHash: canonicalRec?.hash ?? null,
      divergentMatchHash: divergentMatch?.hash ?? null,
    })

    const actual = canonicalRec ?? divergentMatch
    rows.push({
      dateStr,
      classification,
      expectedHash,
      actualFileId: actual?.fileId ?? null,
      actualFileName: actual?.name ?? null,
      actualHash: actual?.hash ?? null,
      actualModifiedTime: actual?.modifiedTime ?? null,
    })
  }

  // Leftover non-canonical files that matched no expected day's content.
  for (const f of nonCanonical) {
    if (consumed.has(f.fileId)) continue
    rows.push({
      dateStr: null,
      classification: 'ORPHAN',
      expectedHash: null,
      actualFileId: f.fileId,
      actualFileName: f.name,
      actualHash: f.hash,
      actualModifiedTime: f.modifiedTime,
    })
  }

  const summary: Record<DriftClassification, number> = {
    IN_SYNC: 0,
    HAND_EDITED: 0,
    MISSING: 0,
    ORPHAN: 0,
    DIVERGENT_NAME: 0,
  }
  for (const r of rows) summary[r.classification] += 1

  return { rows, summary }
}

function printDriftTable(rows: DriftRow[]): void {
  const header = ['DATE', 'CLASS', 'ACTUAL FILE', 'MODIFIED', 'HASH (expected/actual)']
  console.log(header.join(' | '))
  for (const r of rows) {
    const hashCol = `${(r.expectedHash ?? '-').slice(0, 10)} / ${(r.actualHash ?? '-').slice(0, 10)}`
    console.log(
      [r.dateStr ?? '(no date)', r.classification, r.actualFileName ?? '-', r.actualModifiedTime ?? '-', hashCol].join(
        ' | '
      )
    )
  }
}

// ---------------------------------------------------------------------------
// --check-manifest: re-verify hook (HIGH-3). Read-only, no status mutation.
// ---------------------------------------------------------------------------
interface ManifestCheckRow {
  mongoId: string
  driveFileId: string | null
  status: 'VALID' | 'STALE'
  reason?: string
}

async function runCheckManifest(
  prisma: any,
  drive: drive_v3.Drive,
  userId: string,
  domain: string
): Promise<{ manifestFound: boolean; manifestStatus: string | null; rows: ManifestCheckRow[]; overall: 'VALID' | 'STALE' | 'NO_MANIFEST' }> {
  const manifest = await prisma.migrationManifest.findFirst({
    where: { userId, domain },
    orderBy: { startedAt: 'desc' },
  })
  if (!manifest) {
    return { manifestFound: false, manifestStatus: null, rows: [], overall: 'NO_MANIFEST' }
  }

  const blob = readManifestBlob(manifest.records)
  const rows: ManifestCheckRow[] = []

  for (const rec of blob.items) {
    if (!rec.driveFileId) {
      rows.push({ mongoId: rec.mongoId, driveFileId: null, status: 'STALE', reason: 'no driveFileId recorded' })
      continue
    }
    try {
      const meta = await drive.files.get({ fileId: rec.driveFileId, fields: 'id,trashed' })
      if (meta.data.trashed) {
        rows.push({ mongoId: rec.mongoId, driveFileId: rec.driveFileId, status: 'STALE', reason: 'Drive file is trashed' })
        continue
      }
      const currentHash = await downloadAndHash(drive, rec.driveFileId)
      if (currentHash !== rec.driveContentHash) {
        rows.push({ mongoId: rec.mongoId, driveFileId: rec.driveFileId, status: 'STALE', reason: 'content hash mismatch vs manifest' })
        continue
      }
      rows.push({ mongoId: rec.mongoId, driveFileId: rec.driveFileId, status: 'VALID' })
    } catch (error) {
      rows.push({
        mongoId: rec.mongoId,
        driveFileId: rec.driveFileId,
        status: 'STALE',
        reason: `Drive lookup failed: ${errorMessage(error)}`,
      })
    }
  }

  const allValid = rows.every((r) => r.status === 'VALID') && manifest.status === 'verified'
  return { manifestFound: true, manifestStatus: manifest.status, rows, overall: allValid ? 'VALID' : 'STALE' }
}

function printManifestCheckTable(rows: ManifestCheckRow[]): void {
  console.log('MONGO ID | DRIVE FILE ID | STATUS | REASON')
  for (const r of rows) {
    console.log([r.mongoId, r.driveFileId ?? '-', r.status, r.reason ?? '-'].join(' | '))
  }
}

// ---------------------------------------------------------------------------
// Artifact writer
// ---------------------------------------------------------------------------
function writeArtifact(outPath: string, data: unknown): void {
  mkdirSync(path.dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8')
}

function defaultOutPath(kind: string, userLabel: string, domain: string): string {
  const safeUser = userLabel.replace(/[^a-zA-Z0-9._-]/g, '_')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  return path.join('data', 'drive-drift-reports', `${kind}-${domain}-${safeUser}-${stamp}.json`)
}

// ---------------------------------------------------------------------------
// Self-test dispatch — delegates to src/lib/drive-drift-classify.ts, which
// owns the actual pure-function decision table + canonical-name matcher
// tests (no need to duplicate them here; this file's `self-test` command
// exists only so its invocation shape matches the harness/journal-day-file
// convention).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const { flags, command } = parseArgs(process.argv.slice(2))

  if (command === 'self-test' || flags['self-test']) {
    const ok = runClassifySelfTest()
    process.exitCode = ok ? 0 : 1
    return
  }

  const envPath =
    typeof flags.env === 'string' ? flags.env : 'C:/Users/jonch/rbw-drive-vault/.env.vercel-pull2'
  dotenv.config({ path: envPath })

  const userArg = typeof flags.user === 'string' ? flags.user : null
  const domain = typeof flags.domain === 'string' ? flags.domain : 'journal'
  if (!userArg) {
    console.error('BLOCKED: --user <email|id> is required')
    process.exitCode = 1
    return
  }

  const adapter = DRIFT_ADAPTERS[domain]
  if (!adapter) {
    console.error(`BLOCKED: unknown/unwired domain '${domain}'. Wired domains: ${Object.keys(DRIFT_ADAPTERS).join(', ')}`)
    process.exitCode = 1
    return
  }

  const { prisma } = await import('../src/lib/prisma')
  const { getDriveClient } = await import('../src/lib/google-drive')

  const byEmail = await prisma.user.findUnique({ where: { email: userArg }, select: { id: true, driveFolder: true } })
  // Only attempt the id lookup if userArg is even shaped like a Mongo
  // ObjectId (24 hex chars) — otherwise Prisma throws P2023 on a malformed
  // id instead of returning null, which would surface as a confusing crash
  // for the common case of a typo'd email.
  const looksLikeObjectId = /^[0-9a-fA-F]{24}$/.test(userArg)
  const user =
    byEmail ??
    (looksLikeObjectId
      ? await prisma.user.findUnique({ where: { id: userArg }, select: { id: true, driveFolder: true } })
      : null)
  if (!user) throw new Error(`BLOCKED: no user found for '${userArg}'`)

  const drive = await getDriveClient(user.id)
  if (!drive) {
    console.error('BLOCKED: user has no connected Google Drive (no refresh token, or GOOGLE_CLIENT_ID/SECRET missing)')
    process.exitCode = 1
    return
  }
  if (!user.driveFolder) {
    console.error('BLOCKED: user has no driveFolder configured')
    process.exitCode = 1
    return
  }

  if (flags['check-manifest']) {
    const result = await runCheckManifest(prisma, drive, user.id, domain)
    console.log(`MANIFEST RE-VERIFY — user=${userArg} domain=${domain}`)
    if (!result.manifestFound) {
      console.log('No MigrationManifest found for this user/domain.')
      console.log('\nOVERALL: NO_MANIFEST')
    } else {
      console.log(`Manifest status (as recorded): ${result.manifestStatus}`)
      printManifestCheckTable(result.rows)
      console.log(`\nOVERALL: ${result.overall}`)
    }
    const outPath = typeof flags.out === 'string' ? flags.out : defaultOutPath('manifest-check', userArg, domain)
    writeArtifact(outPath, { user: userArg, domain, ...result })
    console.log(`\nArtifact: ${outPath}`)
    process.exitCode = result.overall === 'VALID' || result.overall === 'NO_MANIFEST' ? 0 : 1
    return
  }

  const { rows, summary } = await runDriftReport(prisma, drive, user.driveFolder, adapter, user.id)
  console.log(`DRIFT REPORT — user=${userArg} domain=${domain}`)
  printDriftTable(rows)
  console.log('\nSUMMARY:', summary)

  const outPath = typeof flags.out === 'string' ? flags.out : defaultOutPath('drift', userArg, domain)
  writeArtifact(outPath, { user: userArg, domain, summary, rows })
  console.log(`\nArtifact: ${outPath}`)
}

main().catch((err) => {
  console.error('DRIFT REPORT FAILED:', err)
  process.exitCode = 1
})
