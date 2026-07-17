// Reversible-migration harness (Phase B, data/rb-drive-vault/PHASE-2-SPEC.md
// sibling rail). Domain-generic: exports a user's Mongo history into their
// own Drive vault with a per-record checksum manifest, verifies
// completeness+integrity, and can roll back byte-faithfully. Phase B is
// COPY-ONLY — migrate never touches Mongo. Only wired domain so far: journal.
//
// Subcommands:
//   --user <email> --domain journal dry-run     (read-only, no writes)
//   --user <email> --domain journal migrate     (idempotent; writes Drive + manifest)
//   --user <email> --domain journal verify       (completeness+integrity gate; non-zero exit on mismatch)
//   --user <email> --domain journal rollback     (trash created Drive files + reset manifest)
//   --user <email> --domain journal verify --expect-rolled-back  (proves rollback worked)
//   --user <email> --domain journal corrupt-one --record <mongoId|first> --i-know-this-is-a-test
//     (TEST-ONLY: deliberately corrupts one manifest record so the next verify MUST refuse)
//   self-test  (pure-function checks, no credentials, no --user/--domain needed)
//
// Run: npx tsx scripts/drive-migration-harness.ts <flags> <command>

import * as dotenv from 'dotenv'
import { createHash } from 'node:crypto'
import { strict as assert } from 'node:assert'
import type { drive_v3 } from 'googleapis'

// ---------------------------------------------------------------------------
// Canonical form (HB1): deterministic JSON — object keys sorted recursively,
// Dates tagged {"$date": ISO} so a Date value can never collide with a plain
// string field carrying the same text, arrays keep source order (order is
// semantic content, not incidental), no floating whitespace
// (JSON.stringify with no indent argument).
// ---------------------------------------------------------------------------
type Canonical = string | number | boolean | null | Canonical[] | { [k: string]: Canonical }

export function canonicalize(value: unknown): Canonical {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return { $date: value.toISOString() }
  if (Array.isArray(value)) return value.map(canonicalize)
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const sorted: Record<string, Canonical> = {}
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = canonicalize(obj[key])
    }
    return sorted
  }
  return value as Canonical
}

function sha256(bytes: string | Buffer): string {
  return createHash('sha256').update(bytes as any).digest('hex')
}

export function canonicalHashOf(record: Record<string, unknown>): string {
  // JSON.stringify preserves insertion order; canonicalize() already
  // inserted keys in sorted order, so this is deterministic regardless of
  // the input object's original key order.
  return sha256(JSON.stringify(canonicalize(record)))
}

// ---------------------------------------------------------------------------
// Manifest shapes
// ---------------------------------------------------------------------------
export type RecordStatus = 'pending' | 'uploaded' | 'verified' | 'failed'

export interface ManifestRecord {
  mongoId: string
  canonicalHash: string
  driveFileId: string | null
  driveContentHash: string | null // sha256 of the re-downloaded Drive bytes (see DESIGN note below)
  byteLength: number | null
  status: RecordStatus
  driveFileName: string | null
  updatedAt: string
  error?: string
}

export interface ManifestHeader {
  userId: string
  domain: string
  startedAt: string
  completedAt: string | null
  sourceRecordCount: number
  status: 'incomplete' | 'verified' | 'failed'
}

// ---------------------------------------------------------------------------
// Verify-refusal logic (HB1 gate) — pure function, testable with no DB/Drive.
// Completeness: every current source record must be present in the
// manifest, hash-matching (unchanged since migration), and record-status
// 'verified'. Target integrity: the manifest's recorded Drive content hash
// must match what's ACTUALLY in Drive right now (re-download-and-sha256),
// for every 'verified' record. ANY failure anywhere -> ok:false.
// ---------------------------------------------------------------------------
export interface VerifyFailure {
  mongoId: string
  reason: string
}
export interface VerifyOutcome {
  ok: boolean
  failures: VerifyFailure[]
}

export function computeVerifyOutcome(
  sourceRecords: Array<{ mongoId: string; canonicalHash: string }>,
  manifestRecords: ManifestRecord[],
  actualDriveContentHashes: Map<string, string> // driveFileId -> current re-downloaded sha256
): VerifyOutcome {
  const failures: VerifyFailure[] = []
  const byId = new Map(manifestRecords.map((r) => [r.mongoId, r]))

  for (const src of sourceRecords) {
    const m = byId.get(src.mongoId)
    if (!m) {
      failures.push({ mongoId: src.mongoId, reason: 'missing from manifest' })
      continue
    }
    if (m.canonicalHash !== src.canonicalHash) {
      failures.push({
        mongoId: src.mongoId,
        reason: 'source record changed since migration (canonicalHash mismatch)',
      })
      continue
    }
    if (m.status !== 'verified') {
      failures.push({ mongoId: src.mongoId, reason: `record status is '${m.status}', not verified` })
      continue
    }
    if (!m.driveFileId || !m.driveContentHash) {
      failures.push({ mongoId: src.mongoId, reason: 'missing driveFileId/driveContentHash' })
    }
  }

  for (const m of manifestRecords) {
    if (m.status !== 'verified' || !m.driveFileId) continue
    const actual = actualDriveContentHashes.get(m.driveFileId)
    if (actual === undefined) {
      failures.push({ mongoId: m.mongoId, reason: 'drive file unreadable during verify' })
      continue
    }
    if (actual !== m.driveContentHash) {
      failures.push({ mongoId: m.mongoId, reason: 'drive content hash mismatch (target corrupted/changed)' })
    }
  }

  return { ok: failures.length === 0, failures }
}

// ---------------------------------------------------------------------------
// Domain adapter — the "domain-generic module" seam. Journal is the only
// wired adapter today; a future domain adds one more object like this, no
// harness changes required.
// ---------------------------------------------------------------------------
interface DomainAdapter<TRow> {
  domain: string
  driveFolderName: string
  fetchSourceRecords(prisma: any, userId: string): Promise<TRow[]>
  mongoIdOf(row: TRow): string
  canonicalRecordOf(row: TRow): Record<string, unknown>
  driveFileNameOf(row: TRow): string
  formatContent(row: TRow): string
}

const journalAdapter: DomainAdapter<any> = {
  domain: 'journal',
  driveFolderName: 'Journal',
  fetchSourceRecords: (prisma, userId) =>
    prisma.journalEntry.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
  mongoIdOf: (row) => row.id,
  canonicalRecordOf: (row) => ({
    id: row.id,
    userId: row.userId,
    entry: row.entry,
    mood: row.mood,
    weight: row.weight,
    date: row.date,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }),
  // Mirrors the live-sync day-bucket filename exactly (google-drive.ts
  // getDateWindow + case 'journal'): journal-${dateStr}.md, dateStr from the
  // record's `date` field, so migrated files land indistinguishably from
  // live-synced ones.
  driveFileNameOf: (row) => `journal-${new Date(row.date).toISOString().split('T')[0]}.md`,
  formatContent: (row) => {
    let parsed: { content?: string; goals?: string } = {}
    try {
      parsed = row.entry ? JSON.parse(row.entry) : {}
    } catch {
      parsed = { content: row.entry }
    }
    // formatJournalEntry is imported dynamically in main() and stashed on
    // this module-scope var so the adapter (defined before dotenv.config())
    // can still reach it at call time.
    return formatJournalEntryRef({
      createdAt: row.createdAt,
      content: parsed.content || '',
      mood: row.mood || undefined,
      weight: row.weight || undefined,
      goals: parsed.goals || undefined,
    })
  },
}
let formatJournalEntryRef: (entry: {
  createdAt: Date
  content: string
  mood?: string
  weight?: number
  goals?: string
}) => string = () => {
  throw new Error('formatJournalEntry not wired yet — call after dotenv.config()')
}

const ADAPTERS: Record<string, DomainAdapter<any>> = { journal: journalAdapter }

// ---------------------------------------------------------------------------
// CLI arg parsing
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
// Self-test (no credentials, no DB, no Drive) — run FIRST, before any
// dotenv/dynamic-import, so it truly needs nothing.
// ---------------------------------------------------------------------------
function runSelfTest(): boolean {
  const results: string[] = []
  let pass = true
  const check = (label: string, fn: () => void) => {
    try {
      fn()
      results.push(`PASS: ${label}`)
    } catch (err: any) {
      pass = false
      results.push(`FAIL: ${label} -- ${err?.message ?? err}`)
    }
  }

  check('same record twice -> same hash', () => {
    const a = { id: '1', date: new Date('2026-01-01T00:00:00Z'), mood: 'good', weight: 150 }
    const b = { id: '1', date: new Date('2026-01-01T00:00:00Z'), mood: 'good', weight: 150 }
    assert.equal(canonicalHashOf(a), canonicalHashOf(b))
  })

  check('key order shuffled -> same hash', () => {
    const a = { a: 1, b: 2, c: 3, date: new Date('2026-01-01T00:00:00Z') }
    const b = { date: new Date('2026-01-01T00:00:00Z'), c: 3, a: 1, b: 2 }
    assert.equal(canonicalHashOf(a), canonicalHashOf(b))
  })

  check('changed field -> different hash', () => {
    const a = { id: '1', mood: 'good' }
    const b = { id: '1', mood: 'bad' }
    assert.notEqual(canonicalHashOf(a), canonicalHashOf(b))
  })

  check('Date value vs. equal-text string do not collide', () => {
    const d = new Date('2026-01-01T00:00:00.000Z')
    const withDate = canonicalHashOf({ x: d })
    const withString = canonicalHashOf({ x: d.toISOString() })
    assert.notEqual(withDate, withString)
  })

  check('verify-refusal: clean manifest passes', () => {
    const source = [
      { mongoId: 'm1', canonicalHash: 'h1' },
      { mongoId: 'm2', canonicalHash: 'h2' },
    ]
    const manifest: ManifestRecord[] = [
      {
        mongoId: 'm1',
        canonicalHash: 'h1',
        driveFileId: 'f1',
        driveContentHash: 'c1',
        byteLength: 10,
        status: 'verified',
        driveFileName: 'a.md',
        updatedAt: 'now',
      },
      {
        mongoId: 'm2',
        canonicalHash: 'h2',
        driveFileId: 'f2',
        driveContentHash: 'c2',
        byteLength: 10,
        status: 'verified',
        driveFileName: 'b.md',
        updatedAt: 'now',
      },
    ]
    const actual = new Map([
      ['f1', 'c1'],
      ['f2', 'c2'],
    ])
    const outcome = computeVerifyOutcome(source, manifest, actual)
    assert.equal(outcome.ok, true)
    assert.equal(outcome.failures.length, 0)
  })

  check('verify-refusal: corrupted canonicalHash trips the gate (proves the gate says no)', () => {
    const source = [{ mongoId: 'm1', canonicalHash: 'h1' }]
    const manifest: ManifestRecord[] = [
      {
        mongoId: 'm1',
        canonicalHash: 'CORRUPTED-h1',
        driveFileId: 'f1',
        driveContentHash: 'c1',
        byteLength: 10,
        status: 'verified',
        driveFileName: 'a.md',
        updatedAt: 'now',
      },
    ]
    const actual = new Map([['f1', 'c1']])
    const outcome = computeVerifyOutcome(source, manifest, actual)
    assert.equal(outcome.ok, false)
    assert.equal(outcome.failures.length, 1)
    assert.equal(outcome.failures[0].mongoId, 'm1')
  })

  check('verify-refusal: target-side drift (drive content changed) trips the gate', () => {
    const source = [{ mongoId: 'm1', canonicalHash: 'h1' }]
    const manifest: ManifestRecord[] = [
      {
        mongoId: 'm1',
        canonicalHash: 'h1',
        driveFileId: 'f1',
        driveContentHash: 'c1',
        byteLength: 10,
        status: 'verified',
        driveFileName: 'a.md',
        updatedAt: 'now',
      },
    ]
    const actual = new Map([['f1', 'SOMETHING-ELSE']])
    const outcome = computeVerifyOutcome(source, manifest, actual)
    assert.equal(outcome.ok, false)
  })

  console.log(results.join('\n'))
  console.log(pass ? '\nSELF-TEST: ALL PASS' : '\nSELF-TEST: FAILURES PRESENT')
  return pass
}

// ---------------------------------------------------------------------------
// Drive helpers
// ---------------------------------------------------------------------------
async function downloadDriveText(drive: drive_v3.Drive, fileId: string): Promise<string> {
  const res = await drive.files.get({ fileId, alt: 'media' })
  return typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
}

async function downloadAndHash(
  drive: drive_v3.Drive,
  fileId: string
): Promise<{ hash: string; byteLength: number }> {
  const text = await downloadDriveText(drive, fileId)
  return { hash: sha256(Buffer.from(text, 'utf8')), byteLength: Buffer.byteLength(text, 'utf8') }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
let prismaRef: any

async function main() {
  const { flags, command } = parseArgs(process.argv.slice(2))

  // self-test needs no env, no DB, no Drive — check before dotenv/imports.
  if (command === 'self-test' || flags['self-test']) {
    const ok = runSelfTest()
    process.exitCode = ok ? 0 : 1
    return
  }

  const envPath =
    typeof flags.env === 'string' ? flags.env : 'C:/Users/jonch/rbw-drive-vault/.env.vercel-pull2'
  // dotenv.config() must run before google-drive.ts's module-level
  // `process.env.GOOGLE_CLIENT_ID` read — dynamic import() below (after this
  // call) avoids ESM's static-import hoisting trap. See spike-lt5 pattern.
  dotenv.config({ path: envPath })

  const userEmail = typeof flags.user === 'string' ? flags.user : null
  const domainName = typeof flags.domain === 'string' ? flags.domain : null
  if (!userEmail || !domainName) {
    console.error('BLOCKED: --user <email> and --domain <name> are required')
    process.exitCode = 1
    return
  }
  const adapter = ADAPTERS[domainName]
  if (!adapter) {
    console.error(`BLOCKED: unknown domain '${domainName}'. Wired domains: ${Object.keys(ADAPTERS).join(', ')}`)
    process.exitCode = 1
    return
  }

  const { prisma } = await import('../src/lib/prisma')
  const { getDriveClient, getSubfolderId, uploadTextFile, formatJournalEntry } = await import(
    '../src/lib/google-drive'
  )
  formatJournalEntryRef = formatJournalEntry
  prismaRef = prisma

  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    select: { id: true, driveFolder: true },
  })
  if (!user) throw new Error(`BLOCKED: no user found for ${userEmail}`)

  switch (command) {
    case 'dry-run': {
      // Read-only. No Drive client needed.
      const rows = await adapter.fetchSourceRecords(prisma, user.id)
      const hashes = rows.map((r) => ({
        mongoId: adapter.mongoIdOf(r),
        canonicalHash: canonicalHashOf(adapter.canonicalRecordOf(r)),
        driveFileName: adapter.driveFileNameOf(r),
      }))
      const existing = await prisma.migrationManifest.findFirst({
        where: { userId: user.id, domain: adapter.domain },
      })
      const existingRecords: ManifestRecord[] = existing ? (existing.records as any) : []
      const existingById = new Map(existingRecords.map((r) => [r.mongoId, r]))
      const wouldSkip = hashes.filter((h) => {
        const m = existingById.get(h.mongoId)
        return m && m.status === 'verified' && m.canonicalHash === h.canonicalHash
      }).length

      console.log(`DRY RUN — user=${userEmail} domain=${adapter.domain}`)
      console.log(`Source record count: ${rows.length}`)
      console.log(`Would skip (already verified, unchanged): ${wouldSkip}`)
      console.log(`Would migrate: ${rows.length - wouldSkip}`)
      console.log(`Sample canonical hashes (up to 5):`)
      for (const h of hashes.slice(0, 5)) {
        console.log(`  ${h.mongoId} -> ${h.canonicalHash.slice(0, 16)}... (${h.driveFileName})`)
      }
      break
    }

    case 'migrate': {
      if (!user.driveFolder) throw new Error('BLOCKED: user has no driveFolder pointer')
      const drive = await getDriveClient(user.id)
      if (!drive) throw new Error('BLOCKED: getDriveClient returned null')
      const folderId = await getSubfolderId(drive, user.driveFolder, adapter.driveFolderName)
      if (!folderId) throw new Error(`BLOCKED: could not resolve/create '${adapter.driveFolderName}' subfolder`)

      const rows = await adapter.fetchSourceRecords(prisma, user.id)
      const existing = await prisma.migrationManifest.findFirst({
        where: { userId: user.id, domain: adapter.domain },
      })
      const byId = new Map<string, ManifestRecord>(
        existing ? (existing.records as unknown as ManifestRecord[]).map((r) => [r.mongoId, r]) : []
      )

      // Group by target Drive filename. Live sync writes one file per
      // (user, day) and overwrites it if multiple entries land on the same
      // day; the app's write path (journal/entry/route.ts) enforces at most
      // one JournalEntry per calendar day in practice, but this grouping
      // stays defensive against legacy/edge-case duplicates so a same-day
      // collision can never make verify's target-integrity check flap.
      const groups = new Map<string, any[]>()
      for (const row of rows) {
        const fn = adapter.driveFileNameOf(row)
        if (!groups.has(fn)) groups.set(fn, [])
        groups.get(fn)!.push(row)
      }

      let uploaded = 0
      let skipped = 0
      let failed = 0

      for (const [fileName, groupRows] of groups) {
        const allVerified = groupRows.every((row) => {
          const m = byId.get(adapter.mongoIdOf(row))
          return m && m.status === 'verified' && m.canonicalHash === canonicalHashOf(adapter.canonicalRecordOf(row))
        })
        if (allVerified) {
          skipped += groupRows.length
          continue
        }

        // Last row in fetch order (orderBy createdAt asc) is Drive's current
        // truth for this filename — matches live-sync's overwrite semantics
        // exactly (same-day entries: last write wins in Drive).
        const winner = groupRows[groupRows.length - 1]
        const content = adapter.formatContent(winner)
        const nowIso = new Date().toISOString()

        let driveFileId: string | null = null
        let driveContentHash: string | null = null
        let byteLength: number | null = null
        let uploadErr: string | undefined

        try {
          driveFileId = await uploadTextFile(drive, folderId, fileName, content, 'text/markdown', {
            rbUserId: user.id,
            rbKind: 'migration',
            rbDomain: adapter.domain,
            rbMongoId: adapter.mongoIdOf(winner),
          })
          if (!driveFileId) throw new Error('uploadTextFile returned null')
          // Round-trip verify immediately: re-download and compare against
          // what we intended to write. This is the "Drive-side content hash
          // after upload" chosen approach (re-download-and-sha256, not
          // Drive's md5Checksum) — proves the bytes actually landed, not
          // just that the request didn't throw.
          const dl = await downloadAndHash(drive, driveFileId)
          const expectedHash = sha256(Buffer.from(content, 'utf8'))
          if (dl.hash !== expectedHash) {
            uploadErr = `post-upload round-trip mismatch: expected ${expectedHash.slice(0, 12)} got ${dl.hash.slice(0, 12)}`
          } else {
            driveContentHash = dl.hash
            byteLength = dl.byteLength
          }
        } catch (err: any) {
          uploadErr = String(err?.message ?? err)
        }

        for (const row of groupRows) {
          const mongoId = adapter.mongoIdOf(row)
          const canonicalHash = canonicalHashOf(adapter.canonicalRecordOf(row))
          const status: RecordStatus = driveFileId && driveContentHash ? 'verified' : 'failed'
          if (status === 'verified') uploaded++
          else failed++
          byId.set(mongoId, {
            mongoId,
            canonicalHash,
            driveFileId,
            driveContentHash,
            byteLength,
            status,
            driveFileName: fileName,
            updatedAt: nowIso,
            error: uploadErr,
          })
        }
      }

      const records = Array.from(byId.values())
      if (existing) {
        await prisma.migrationManifest.update({
          where: { id: existing.id },
          data: { records: records as any, completedAt: null, status: 'incomplete' },
        })
      } else {
        await prisma.migrationManifest.create({
          data: {
            userId: user.id,
            domain: adapter.domain,
            status: 'incomplete',
            startedAt: new Date(),
            completedAt: null,
            records: records as any,
          },
        })
      }

      console.log(`MIGRATE — user=${userEmail} domain=${adapter.domain}`)
      console.log(`Source records: ${rows.length}`)
      console.log(`Uploaded+round-trip-verified this run: ${uploaded}`)
      console.log(`Skipped (already verified, unchanged): ${skipped}`)
      console.log(`Failed this run: ${failed}`)
      console.log(`Manifest status: incomplete (run 'verify' to gate it to 'verified')`)
      break
    }

    case 'verify': {
      const manifest = await prisma.migrationManifest.findFirst({
        where: { userId: user.id, domain: adapter.domain },
      })

      if (flags['expect-rolled-back']) {
        // Rollback-proof mode: expect no manifest (or an empty one) AND no
        // migration-stamped Drive files remaining for this user+domain.
        const noManifestRecords = !manifest || (manifest.records as unknown as ManifestRecord[]).length === 0
        let noDriveFiles = true
        let checkedDrive = false
        if (user.driveFolder) {
          const drive = await getDriveClient(user.id)
          if (drive) {
            checkedDrive = true
            const q = [
              'trashed=false',
              `appProperties has { key='rbUserId' and value='${user.id}' }`,
              `appProperties has { key='rbDomain' and value='${adapter.domain}' }`,
              "appProperties has { key='rbKind' and value='migration' }",
            ].join(' and ')
            const res = await drive.files.list({ q, fields: 'files(id)' })
            noDriveFiles = (res.data.files ?? []).length === 0
          }
        }
        const ok = noManifestRecords && noDriveFiles
        console.log(`VERIFY --expect-rolled-back — user=${userEmail} domain=${adapter.domain}`)
        console.log(`Manifest empty/absent: ${noManifestRecords}`)
        console.log(`Drive migration-stamped files present: ${checkedDrive ? !noDriveFiles : 'not checked (no Drive connection)'}`)
        console.log(ok ? 'PASS: vault is back to pre-migration state' : 'FAIL: rollback is incomplete')
        process.exitCode = ok ? 0 : 1
        break
      }

      if (!manifest) {
        console.error('REFUSED: no manifest exists for this user+domain — run migrate first.')
        process.exitCode = 1
        break
      }

      const rows = await adapter.fetchSourceRecords(prisma, user.id)
      const sourceRecords = rows.map((r) => ({
        mongoId: adapter.mongoIdOf(r),
        canonicalHash: canonicalHashOf(adapter.canonicalRecordOf(r)),
      }))
      const manifestRecords = manifest.records as unknown as ManifestRecord[]

      const uniqueFileIds = Array.from(
        new Set(manifestRecords.filter((r) => r.driveFileId).map((r) => r.driveFileId as string))
      )
      const actualHashes = new Map<string, string>()
      if (uniqueFileIds.length > 0) {
        const drive = await getDriveClient(user.id)
        if (!drive) {
          console.error('REFUSED: could not obtain Drive client to verify target integrity.')
          process.exitCode = 1
          break
        }
        for (const fileId of uniqueFileIds) {
          try {
            const dl = await downloadAndHash(drive, fileId)
            actualHashes.set(fileId, dl.hash)
          } catch (err: any) {
            // leave unset -> computeVerifyOutcome reports 'unreadable'
            console.error(`  drive file ${fileId} unreadable: ${err?.message ?? err}`)
          }
        }
      }

      const outcome = computeVerifyOutcome(sourceRecords, manifestRecords, actualHashes)
      const nowIso = new Date()

      if (outcome.ok) {
        await prisma.migrationManifest.update({
          where: { id: manifest.id },
          data: { status: 'verified', completedAt: nowIso },
        })
        console.log(`VERIFY — user=${userEmail} domain=${adapter.domain}: PASS`)
        console.log(`${sourceRecords.length} source records, all present/verified in Drive.`)
        process.exitCode = 0
      } else {
        await prisma.migrationManifest.update({
          where: { id: manifest.id },
          data: { status: 'failed', completedAt: nowIso },
        })
        console.error('='.repeat(70))
        console.error(`VERIFY REFUSED — user=${userEmail} domain=${adapter.domain}`)
        console.error(`${outcome.failures.length} mismatch(es) found. Manifest CANNOT be marked verified.`)
        for (const f of outcome.failures) {
          console.error(`  - ${f.mongoId}: ${f.reason}`)
        }
        console.error('='.repeat(70))
        process.exitCode = 1
      }
      break
    }

    case 'rollback': {
      const manifest = await prisma.migrationManifest.findFirst({
        where: { userId: user.id, domain: adapter.domain },
      })
      if (!manifest) {
        console.log('Nothing to roll back — no manifest exists.')
        break
      }
      const drive = await getDriveClient(user.id)
      const manifestRecords = manifest.records as unknown as ManifestRecord[]
      const uniqueFileIds = Array.from(
        new Set(manifestRecords.filter((r) => r.driveFileId).map((r) => r.driveFileId as string))
      )
      let trashed = 0
      const trashErrors: string[] = []
      if (drive) {
        for (const fileId of uniqueFileIds) {
          try {
            await drive.files.update({ fileId, requestBody: { trashed: true } })
            trashed++
          } catch (err: any) {
            trashErrors.push(`${fileId}: ${err?.message ?? err}`)
          }
        }
      } else if (uniqueFileIds.length > 0) {
        trashErrors.push('no Drive client available — could not trash any files')
      }

      // Reset the manifest: back to pre-migration state = no manifest row.
      // Phase B is copy-only, so Mongo was never touched — this is the
      // entire rollback.
      await prisma.migrationManifest.delete({ where: { id: manifest.id } })

      console.log(`ROLLBACK — user=${userEmail} domain=${adapter.domain}`)
      console.log(`Drive files trashed: ${trashed}/${uniqueFileIds.length}`)
      if (trashErrors.length) {
        console.error('Errors:')
        trashErrors.forEach((e) => console.error(`  - ${e}`))
        process.exitCode = 1
      }
      console.log('Manifest reset (row deleted). Mongo was never touched (Phase B is copy-only).')
      break
    }

    case 'corrupt-one': {
      if (!flags['i-know-this-is-a-test']) {
        console.error('REFUSED: corrupt-one requires --i-know-this-is-a-test (TEST-ONLY subcommand).')
        process.exitCode = 1
        break
      }
      const manifest = await prisma.migrationManifest.findFirst({
        where: { userId: user.id, domain: adapter.domain },
      })
      if (!manifest) throw new Error('BLOCKED: no manifest exists to corrupt — run migrate first.')
      const records = manifest.records as unknown as ManifestRecord[]
      const target = typeof flags.record === 'string' ? flags.record : null
      const idx =
        target === 'first' || !target ? 0 : records.findIndex((r) => r.mongoId === target)
      if (idx < 0 || !records[idx]) throw new Error(`BLOCKED: record '${target}' not found in manifest.`)

      const before = records[idx].canonicalHash
      records[idx] = { ...records[idx], canonicalHash: `CORRUPTED-${before}` }

      await prisma.migrationManifest.update({
        where: { id: manifest.id },
        data: { records: records as any },
      })
      console.log(
        `CORRUPT-ONE (TEST-ONLY) — mongoId=${records[idx].mongoId} canonicalHash flipped. Next 'verify' MUST refuse.`
      )
      break
    }

    default:
      console.error(
        `Unknown command '${command}'. Expected one of: dry-run, migrate, verify, rollback, corrupt-one, self-test`
      )
      process.exitCode = 1
  }
}

main()
  .catch((err) => {
    console.error('HARNESS FAILED:', err)
    process.exitCode = 1
  })
  .finally(() => prismaRef?.$disconnect())
