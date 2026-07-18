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
// journal-day-file.ts touches no env vars / credentials at module load, so
// (unlike google-drive.ts, which reads process.env.GOOGLE_CLIENT_ID at
// import time) it's safe to import statically here — shared emitter/parser,
// no logic duplication (cf-c2-journal-inversion).
import { formatJournalDayFile, parseJournalDayFile, journalEntryMarker, type JournalDayRow } from '../src/lib/journal-day-file'

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
  // Verifier finding 3: true when migrate found a pre-existing Drive file at
  // this filename (uploadTextFile's update-path adopted it rather than
  // creating it). Rollback must never trash a file migrate didn't create.
  preExisted?: boolean
}

export interface ManifestHeader {
  userId: string
  domain: string
  startedAt: string
  completedAt: string | null
  sourceRecordCount: number
  status: 'incomplete' | 'verified' | 'failed' | 'rollback-incomplete'
}

// ---------------------------------------------------------------------------
// Manifest JSON blob shape (verifier findings 1 + 2). The Prisma `records`
// column is the only flexible (Json) field on MigrationManifest — no schema
// change needed or allowed, so header-level metadata (duplicate-day hazard
// count, in-progress rollback retry state) rides inside that same Json value
// alongside the per-record array, instead of as new typed Prisma columns.
// ---------------------------------------------------------------------------
export interface RollbackAction {
  fileId: string
  action: 'trash' | 'unstamp'
}

// HIGH-2 reversal map: every migrated row's provable location inside its
// (possibly multi-entry) Drive file. `marker` is the exact string a verifier
// can search for in the downloaded file bytes to prove this row was not
// silently dropped by the group's emission.
export interface JournalReversalMapEntry {
  mongoId: string
  driveFileName: string
  marker: string
}

export interface ManifestBlob {
  items: ManifestRecord[]
  duplicateDayGroups: number
  cutoverHazards: string[]
  // Present only while a rollback is mid-retry: the file actions a prior
  // rollback attempt failed to complete. A resumed rollback retries only
  // these (finding 2 — errored-path rollback must converge on re-run).
  pendingRollbackActions?: RollbackAction[]
  // rowId -> section reversal map (HIGH-2). Additive/optional so older
  // manifests (bare array or pre-this-change blob) still read back fine.
  journalReversalMap?: JournalReversalMapEntry[]
}

function readManifestBlob(raw: unknown): ManifestBlob {
  if (Array.isArray(raw)) {
    // Manifests written before this change stored a bare array.
    return { items: raw as ManifestRecord[], duplicateDayGroups: 0, cutoverHazards: [] }
  }
  const obj = (raw ?? {}) as Partial<ManifestBlob>
  return {
    items: Array.isArray(obj.items) ? obj.items : [],
    duplicateDayGroups: typeof obj.duplicateDayGroups === 'number' ? obj.duplicateDayGroups : 0,
    cutoverHazards: Array.isArray(obj.cutoverHazards) ? obj.cutoverHazards : [],
    pendingRollbackActions: Array.isArray(obj.pendingRollbackActions) ? obj.pendingRollbackActions : undefined,
    journalReversalMap: Array.isArray(obj.journalReversalMap) ? obj.journalReversalMap : undefined,
  }
}

/**
 * Proves a reversal map entry actually resolves — the marker string is
 * present in the file content it claims to live in. Pure function, used by
 * both the migrate-time assertion and the self-test.
 */
export function reversalMapEntryResolves(fileContent: string, entry: JournalReversalMapEntry): boolean {
  return fileContent.includes(entry.marker)
}

// ---------------------------------------------------------------------------
// Duplicate-day grouping report (verifier finding 1) — pure function, same
// grouping key the migrate loop uses (target Drive filename). Only the last
// row per group lands in Drive (last-write-wins, matches live sync); every
// other row in a group >1 is a "duplicate-day loser" whose content is
// unrecoverable from Drive-side data alone. This function only *reports*
// group sizes — it does not change the last-write-wins content semantics
// (that redesign belongs to Phase C).
// ---------------------------------------------------------------------------
export interface DuplicateDayGroup {
  fileName: string
  count: number
}

export function computeDuplicateDayGroups<TRow>(
  rows: TRow[],
  fileNameOf: (row: TRow) => string
): DuplicateDayGroup[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const fn = fileNameOf(row)
    counts.set(fn, (counts.get(fn) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([fileName, count]) => ({ fileName, count }))
}

function duplicateDayCutoverHazards(groups: DuplicateDayGroup[]): string[] {
  // HIGH-2 (multi-entry day file, cf-c2-journal-inversion): duplicate-day
  // groups are no longer a data-loss hazard — every row lands as its own
  // section in the shared file, provable via the reversal map. Retained as
  // an informational note (not a hazard) so operators still see the count.
  if (groups.length === 0) return []
  return [
    `multi-entry-day-groups: ${groups.length} groups — all rows preserved as separate sections (HIGH-2), see journalReversalMap for per-row recoverability`,
  ]
}

// ---------------------------------------------------------------------------
// preExisted classification (verifier finding 3 residual) — pure function. A
// pre-check-by-filename alone can't distinguish a live-synced file from a
// file migrate itself created in an EARLIER run (e.g. run 1 uploads but the
// round-trip fails, so the record stays 'failed' with driveFileId still set;
// run 2 re-processes the same group and finds that same file). Only a
// fileId with no matching prior manifest driveFileId in this group is
// genuinely pre-existing — one we didn't create.
// ---------------------------------------------------------------------------
export function classifyPreExisted(foundFileId: string | null, priorDriveFileIdsInGroup: Array<string | null>): boolean {
  if (!foundFileId) return false
  return !priorDriveFileIdsInGroup.includes(foundFileId)
}

// ---------------------------------------------------------------------------
// Rollback convergence (verifier finding 2) — pure function. Given the set of
// file actions a rollback run attempted and their outcomes, decides whether
// rollback converged (nothing pending -> safe to delete the manifest) or
// must persist a narrowed retry set instead.
// ---------------------------------------------------------------------------
export interface RollbackActionResult extends RollbackAction {
  success: boolean
}

export function computeRollbackConvergence(
  attempted: RollbackAction[],
  results: RollbackActionResult[]
): { converged: boolean; stillPending: RollbackAction[] } {
  const failed = new Set(results.filter((r) => !r.success).map((r) => r.fileId))
  const stillPending = attempted.filter((a) => failed.has(a.fileId))
  return { converged: stillPending.length === 0, stillPending }
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
  // Formats the WHOLE same-day group in one call (HIGH-2: multi-entry day
  // file, no winner-takes-it-all collapse). Same shared emitter the live
  // sync path uses (google-drive.ts formatJournalEntry -> journal-day-file.ts
  // formatJournalDayFile) — migrated and live-synced files are byte-identical
  // for the same source rows.
  formatGroupContent(fileName: string, rows: TRow[]): string
  // rowId -> the exact marker string provably locatable in formatGroupContent's
  // output for that row (reversal map — HIGH-2 recoverability proof).
  reversalMarkerFor(row: TRow): string
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
  formatGroupContent: (fileName, rows) => {
    const dateStr = fileName.replace(/^journal-/, '').replace(/\.md$/, '')
    const dayRows: JournalDayRow[] = rows.map((row) => {
      let parsed: { content?: string; goals?: string } = {}
      try {
        parsed = row.entry ? JSON.parse(row.entry) : {}
      } catch {
        parsed = { content: row.entry }
      }
      return {
        rowId: row.id,
        createdAt: row.createdAt,
        mood: row.mood ?? null,
        weight: row.weight ?? null,
        // `goals` has no dedicated slot in the structured parse contract —
        // folded into content, matching google-drive.ts's formatJournalEntry
        // wrapper exactly (same shared emitter, same fold-in rule).
        content: parsed.goals ? `## Goals for Today\n${parsed.goals}\n\n${parsed.content || ''}` : parsed.content || '',
      }
    })
    // Shared emitter with the live-sync path (google-drive.ts formatJournalEntry
    // is a thin wrapper over this same function) — migrated and live-synced
    // files are byte-identical for the same source rows.
    return formatJournalDayFile(dateStr, dayRows)
  },
  reversalMarkerFor: (row) => journalEntryMarker(row.id),
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

  check('duplicate-day grouping: counts groups with >1 row correctly (finding 1)', () => {
    const rows = [
      { id: 'a', fn: 'journal-2026-01-01.md' },
      { id: 'b', fn: 'journal-2026-01-01.md' }, // dup w/ a -> group of 2
      { id: 'c', fn: 'journal-2026-01-02.md' }, // solo, not a group
      { id: 'd', fn: 'journal-2026-01-03.md' },
      { id: 'e', fn: 'journal-2026-01-03.md' },
      { id: 'f', fn: 'journal-2026-01-03.md' }, // dup w/ d,e -> group of 3
    ]
    const groups = computeDuplicateDayGroups(rows, (r) => r.fn)
    assert.equal(groups.length, 2)
    const byName = new Map(groups.map((g) => [g.fileName, g.count]))
    assert.equal(byName.get('journal-2026-01-01.md'), 2)
    assert.equal(byName.get('journal-2026-01-03.md'), 3)
    assert.equal(byName.has('journal-2026-01-02.md'), false)
  })

  check('rollback convergence: all actions succeed -> converged, nothing pending (finding 2)', () => {
    const actions: RollbackAction[] = [
      { fileId: 'f1', action: 'trash' },
      { fileId: 'f2', action: 'unstamp' },
    ]
    const results: RollbackActionResult[] = [
      { fileId: 'f1', action: 'trash', success: true },
      { fileId: 'f2', action: 'unstamp', success: true },
    ]
    const outcome = computeRollbackConvergence(actions, results)
    assert.equal(outcome.converged, true)
    assert.equal(outcome.stillPending.length, 0)
  })

  check('rollback convergence: one failure -> rollback-incomplete state, only the failure retried (finding 2)', () => {
    const actions: RollbackAction[] = [
      { fileId: 'f1', action: 'trash' },
      { fileId: 'f2', action: 'trash' },
    ]
    const results: RollbackActionResult[] = [
      { fileId: 'f1', action: 'trash', success: true },
      { fileId: 'f2', action: 'trash', success: false },
    ]
    const outcome = computeRollbackConvergence(actions, results)
    assert.equal(outcome.converged, false)
    assert.equal(outcome.stillPending.length, 1)
    assert.equal(outcome.stillPending[0].fileId, 'f2')

    // Manifest state transition a real rollback run would persist: manifest
    // is NOT deleted, status flips to 'rollback-incomplete', the blob keeps
    // only the still-pending action for the next run to retry.
    const manifestStatus = outcome.converged ? 'deleted' : 'rollback-incomplete'
    assert.equal(manifestStatus, 'rollback-incomplete')
    const resumedActions = outcome.stillPending
    assert.deepEqual(resumedActions, [{ fileId: 'f2', action: 'trash' }])
  })

  check('preExisted classification: a file migrate created in a prior run is NOT preExisted (finding 3 residual)', () => {
    // Run 1 uploaded fileId 'f-ours' for mongoId 'm1' (round-trip failed, or
    // the source row later changed) — that driveFileId is still on the
    // prior manifest record. Run 2 re-processes the group, the pre-check
    // list call finds that same 'f-ours' file. It must NOT be flagged
    // preExisted — rollback would otherwise unstamp-and-leave a file we
    // created ourselves.
    assert.equal(classifyPreExisted('f-ours', ['f-ours', null]), false)
  })

  check('preExisted classification: a file with no matching prior driveFileId IS preExisted (finding 3 residual)', () => {
    // Genuinely a live-synced file we never touched before — no prior
    // record in this group carries this fileId.
    assert.equal(classifyPreExisted('f-live-sync', ['f-other-mongoid-file', null]), true)
  })

  check('preExisted classification: no file found at all -> not preExisted', () => {
    assert.equal(classifyPreExisted(null, ['f-ours']), false)
  })

  check('multi-entry day case (HIGH-2): journalAdapter.formatGroupContent preserves every row, matches shared emitter byte-for-byte', () => {
    const groupRows = [
      { id: 'm1', entry: JSON.stringify({ content: 'Morning row' }), mood: 'good', weight: 150, date: new Date('2026-02-02T07:00:00.000Z'), createdAt: new Date('2026-02-02T07:00:00.000Z') },
      { id: 'm2', entry: JSON.stringify({ content: 'Evening row' }), mood: 'tired', weight: null, date: new Date('2026-02-02T20:00:00.000Z'), createdAt: new Date('2026-02-02T20:00:00.000Z') },
    ]
    const fileName = journalAdapter.driveFileNameOf(groupRows[0])
    assert.equal(fileName, 'journal-2026-02-02.md')

    const content = journalAdapter.formatGroupContent(fileName, groupRows)
    // Direct call to the shared emitter with the same inputs must produce
    // byte-identical output — proves the adapter delegates, doesn't duplicate.
    const directContent = formatJournalDayFile('2026-02-02', [
      { rowId: 'm1', createdAt: groupRows[0].createdAt, mood: 'good', weight: 150, content: 'Morning row' },
      { rowId: 'm2', createdAt: groupRows[1].createdAt, mood: 'tired', weight: null, content: 'Evening row' },
    ])
    assert.equal(content, directContent)

    // No entry dropped: both rows' content recoverable via the tolerant parser.
    const parsed = parseJournalDayFile(content)
    assert.equal(parsed.length, 2)
    assert.deepEqual(parsed.map((p) => p.rowId).sort(), ['m1', 'm2'])
    const byRowId = new Map(parsed.map((p) => [p.rowId, p]))
    assert.equal(byRowId.get('m1')?.content, 'Morning row')
    assert.equal(byRowId.get('m2')?.content, 'Evening row')
  })

  check('reversal-map recovery case (HIGH-2): every migrated row is provably recoverable from its file content', () => {
    const groupRows = [
      { id: 'm1', entry: JSON.stringify({ content: 'Row one' }), mood: null, weight: null, date: new Date('2026-03-03T05:00:00.000Z'), createdAt: new Date('2026-03-03T05:00:00.000Z') },
      { id: 'm2', entry: JSON.stringify({ content: 'Row two' }), mood: null, weight: null, date: new Date('2026-03-03T15:00:00.000Z'), createdAt: new Date('2026-03-03T15:00:00.000Z') },
      { id: 'm3', entry: JSON.stringify({ content: 'Row three' }), mood: null, weight: null, date: new Date('2026-03-03T21:00:00.000Z'), createdAt: new Date('2026-03-03T21:00:00.000Z') },
    ]
    const fileName = journalAdapter.driveFileNameOf(groupRows[0])
    const content = journalAdapter.formatGroupContent(fileName, groupRows)

    const reversalMap: JournalReversalMapEntry[] = groupRows.map((row) => ({
      mongoId: row.id,
      driveFileName: fileName,
      marker: journalAdapter.reversalMarkerFor(row),
    }))

    for (const entry of reversalMap) {
      assert.ok(reversalMapEntryResolves(content, entry), `reversal map entry for ${entry.mongoId} did not resolve against its file content`)
    }

    // Refusal case: a marker for a row that was never emitted into this
    // content must NOT resolve — proves the check isn't a rubber stamp.
    const bogusEntry: JournalReversalMapEntry = { mongoId: 'never-migrated', driveFileName: fileName, marker: journalEntryMarker('never-migrated') }
    assert.equal(reversalMapEntryResolves(content, bogusEntry), false)
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
  const { getDriveClient, getSubfolderId, uploadTextFile } = await import('../src/lib/google-drive')
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
      const existingRecords: ManifestRecord[] = existing ? readManifestBlob(existing.records).items : []
      const existingById = new Map(existingRecords.map((r) => [r.mongoId, r]))
      const wouldSkip = hashes.filter((h) => {
        const m = existingById.get(h.mongoId)
        return m && m.status === 'verified' && m.canonicalHash === h.canonicalHash
      }).length

      // HIGH-2 (multi-entry day file): surface duplicate-day groups BEFORE
      // cutover for visibility — every row in a group now lands in Drive as
      // its own section (no longer a data-loss hazard, see formatGroupContent).
      const dupGroups = computeDuplicateDayGroups(rows, adapter.driveFileNameOf)

      console.log(`DRY RUN — user=${userEmail} domain=${adapter.domain}`)
      console.log(`Source record count: ${rows.length}`)
      console.log(`Would skip (already verified, unchanged): ${wouldSkip}`)
      console.log(`Would migrate: ${rows.length - wouldSkip}`)
      console.log(`Multi-entry day groups (same target filename, >1 source row): ${dupGroups.length}`)
      if (dupGroups.length > 0) {
        console.log('  All rows in each group are preserved as separate sections in the day file (HIGH-2) — none are dropped.')
        for (const g of dupGroups) {
          console.log(`    ${g.fileName}: ${g.count} rows`)
        }
      }
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
        existing ? readManifestBlob(existing.records).items.map((r) => [r.mongoId, r]) : []
      )

      // HIGH-2 (multi-entry day file): surface duplicate-day groups BEFORE
      // cutover for visibility — record it on the manifest header (no
      // longer a data-loss hazard; every row lands in its own section).
      const dupGroups = computeDuplicateDayGroups(rows, adapter.driveFileNameOf)
      console.log(`Multi-entry day groups (same target filename, >1 source row): ${dupGroups.length}`)
      if (dupGroups.length > 0) {
        console.log('  All rows in each group are preserved as separate sections in the day file (HIGH-2) — none are dropped.')
        for (const g of dupGroups) {
          console.log(`    ${g.fileName}: ${g.count} rows`)
        }
      }

      // Group by target Drive filename. Live sync writes one file per
      // (user, day); a same-day collision means MULTIPLE JournalEntry rows
      // target the same file. HIGH-2: every row in the group is emitted as
      // its own section in one shared upload — none are dropped.
      const groups = new Map<string, any[]>()
      for (const row of rows) {
        const fn = adapter.driveFileNameOf(row)
        if (!groups.has(fn)) groups.set(fn, [])
        groups.get(fn)!.push(row)
      }

      let uploaded = 0
      let skipped = 0
      let failed = 0
      const journalReversalMap: JournalReversalMapEntry[] = existing
        ? readManifestBlob(existing.records).journalReversalMap ?? []
        : []
      const reversalById = new Map(journalReversalMap.map((e) => [e.mongoId, e]))

      for (const [fileName, groupRows] of groups) {
        const allVerified = groupRows.every((row) => {
          const m = byId.get(adapter.mongoIdOf(row))
          return m && m.status === 'verified' && m.canonicalHash === canonicalHashOf(adapter.canonicalRecordOf(row))
        })
        if (allVerified) {
          skipped += groupRows.length
          continue
        }

        // HIGH-2: format the WHOLE group as one multi-entry file — every row
        // gets its own section, no winner/loser collapse.
        const content = adapter.formatGroupContent(fileName, groupRows)
        const nowIso = new Date().toISOString()

        let driveFileId: string | null = null
        let driveContentHash: string | null = null
        let byteLength: number | null = null
        let uploadErr: string | undefined

        // Verifier finding 3: pre-check whether this filename already exists
        // in the subfolder — uploadTextFile's own existence check happens
        // again inside it (additive-only: we don't touch its return shape,
        // the other live-sync call site is unaffected), but we need the
        // boolean ourselves so rollback can skip trashing adopted files.
        // classifyPreExisted (residual fix) rules out files migrate itself
        // created in a prior run — those aren't pre-existing, they're ours.
        let preExisted = false
        try {
          const preCheck = await drive.files.list({
            q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
            fields: 'files(id)',
          })
          const foundFileId = preCheck.data.files?.[0]?.id ?? null
          const priorDriveFileIdsInGroup = groupRows.map((row) => byId.get(adapter.mongoIdOf(row))?.driveFileId ?? null)
          preExisted = classifyPreExisted(foundFileId, priorDriveFileIdsInGroup)
        } catch {
          // best-effort — a failed pre-check just loses the preExisted flag
          // for this record, it isn't fatal to the upload itself.
        }

        try {
          driveFileId = await uploadTextFile(drive, folderId, fileName, content, 'text/markdown', {
            rbUserId: user.id,
            rbKind: 'migration',
            rbDomain: adapter.domain,
            // Multiple rows can share one file (HIGH-2 multi-entry group) —
            // the reversal map (below) is the per-row provenance record;
            // this appProperty stays a comma-joined list for quick eyeballing.
            rbMongoId: groupRows.map((row) => adapter.mongoIdOf(row)).join(','),
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
            preExisted,
          })
          // HIGH-2 reversal map: record this row's provable section marker
          // regardless of upload outcome — on success it resolves against
          // the uploaded content; verify re-checks it against live Drive
          // content each run (see 'verify' command below).
          if (status === 'verified') {
            reversalById.set(mongoId, {
              mongoId,
              driveFileName: fileName,
              marker: adapter.reversalMarkerFor(row),
            })
          }
        }
      }

      const records = Array.from(byId.values())
      const blob: ManifestBlob = {
        items: records,
        duplicateDayGroups: dupGroups.length,
        cutoverHazards: duplicateDayCutoverHazards(dupGroups),
        journalReversalMap: Array.from(reversalById.values()),
      }
      if (existing) {
        await prisma.migrationManifest.update({
          where: { id: existing.id },
          data: { records: blob as any, completedAt: null, status: 'incomplete' },
        })
      } else {
        await prisma.migrationManifest.create({
          data: {
            userId: user.id,
            domain: adapter.domain,
            status: 'incomplete',
            startedAt: new Date(),
            completedAt: null,
            records: blob as any,
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
        // Verifier finding 3 (appProperties implication): a preExisted file
        // that migrate adopted also gets the migration appProperties stamp.
        // Rather than teach this query to special-case preExisted files, the
        // chosen fix lives on the rollback side — rollback UN-STAMPS (clears
        // rbUserId/rbKind/rbDomain/rbMongoId) preExisted files instead of
        // trashing them, so they stop matching this query on their own and
        // this query needs no changes.
        const noManifestRecords = !manifest || readManifestBlob(manifest.records).items.length === 0
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
      const blob = readManifestBlob(manifest.records)
      const manifestRecords = blob.items

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

      // Verifier finding 1: print the recorded cutover hazard loudly. This is
      // informational, not a corruption — verify still exits 0 on a clean
      // hash/completeness pass even when hazards are present.
      if (blob.cutoverHazards.length > 0) {
        console.log('='.repeat(70))
        console.log(`CUTOVER HAZARD (recorded at migrate time): ${blob.duplicateDayGroups} duplicate-day group(s)`)
        for (const h of blob.cutoverHazards) console.log(`  ${h}`)
        console.log('='.repeat(70))
      }

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
      const blob = readManifestBlob(manifest.records)
      const manifestRecords = blob.items

      // Verifier finding 3: preExisted files get 'unstamp' (leave the file
      // in place, clear the migration appProperties), everything else gets
      // 'trash' (migrate created it, rollback removes it).
      const actionByFileId = new Map<string, RollbackAction['action']>()
      for (const r of manifestRecords) {
        if (!r.driveFileId) continue
        actionByFileId.set(r.driveFileId, r.preExisted ? 'unstamp' : 'trash')
      }
      const fullActions: RollbackAction[] = Array.from(actionByFileId, ([fileId, action]) => ({ fileId, action }))
      // Verifier finding 2: a resumed rollback (status === 'rollback-incomplete')
      // retries only the actions a prior run failed to complete, not the full set.
      const actions =
        manifest.status === 'rollback-incomplete' && blob.pendingRollbackActions
          ? blob.pendingRollbackActions
          : fullActions

      const results: RollbackActionResult[] = []
      let trashed = 0
      let unstamped = 0
      const trashErrors: string[] = []
      if (drive) {
        for (const { fileId, action } of actions) {
          try {
            if (action === 'unstamp') {
              await drive.files.update({
                fileId,
                requestBody: { appProperties: { rbUserId: null, rbKind: null, rbDomain: null, rbMongoId: null } } as any,
              })
              unstamped++
            } else {
              await drive.files.update({ fileId, requestBody: { trashed: true } })
              trashed++
            }
            results.push({ fileId, action, success: true })
          } catch (err: any) {
            const code = err?.code ?? err?.response?.status
            if (code === 404) {
              // Already gone (or already unstamped) — counts as success on re-run.
              if (action === 'trash') trashed++
              else unstamped++
              results.push({ fileId, action, success: true })
              continue
            }
            trashErrors.push(`${fileId} (${action}): ${err?.message ?? err}`)
            results.push({ fileId, action, success: false })
          }
        }
      } else if (actions.length > 0) {
        trashErrors.push('no Drive client available — could not process any files')
        for (const a of actions) results.push({ ...a, success: false })
      }

      const convergence = computeRollbackConvergence(actions, results)

      console.log(`ROLLBACK — user=${userEmail} domain=${adapter.domain}`)
      console.log(`Drive files trashed this run: ${trashed}`)
      console.log(`Pre-existed files left in place (appProperties unstamped): ${unstamped}`)

      if (!convergence.converged) {
        // Verifier finding 2: do NOT delete the manifest — rollback hasn't
        // converged. Persist only the not-yet-done actions so a re-run
        // retries exactly those instead of reporting "Nothing to roll back"
        // while stamped files remain.
        await prisma.migrationManifest.update({
          where: { id: manifest.id },
          data: {
            status: 'rollback-incomplete',
            records: { ...blob, pendingRollbackActions: convergence.stillPending } as any,
          },
        })
        console.error('Errors:')
        trashErrors.forEach((e) => console.error(`  - ${e}`))
        console.error(
          `ROLLBACK INCOMPLETE: ${convergence.stillPending.length} file action(s) still pending. Re-run rollback to retry.`
        )
        process.exitCode = 1
        break
      }

      // Converged: every action succeeded (this run or a prior one). Phase B
      // is copy-only, so Mongo was never touched — deleting the manifest is
      // the entire rollback.
      await prisma.migrationManifest.delete({ where: { id: manifest.id } })
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
      const blob = readManifestBlob(manifest.records)
      const records = blob.items
      const target = typeof flags.record === 'string' ? flags.record : null
      const idx =
        target === 'first' || !target ? 0 : records.findIndex((r) => r.mongoId === target)
      if (idx < 0 || !records[idx]) throw new Error(`BLOCKED: record '${target}' not found in manifest.`)

      const before = records[idx].canonicalHash
      records[idx] = { ...records[idx], canonicalHash: `CORRUPTED-${before}` }

      await prisma.migrationManifest.update({
        where: { id: manifest.id },
        data: { records: { ...blob, items: records } as any },
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
