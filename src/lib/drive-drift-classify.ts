// Drift classification (Phase C, ticket C3 — drift/durability layer).
//
// Pure functions only — no Drive, no Mongo, no env. scripts/drive-drift-report.ts
// is the credentialed CLI that gathers the inputs (expected content re-emitted
// from Mongo via the shared journal-day-file.ts emitter, actual Drive file
// listing + re-download-and-sha256) and calls into these to decide, per day
// bucket, one of:
//
//   IN_SYNC        — a canonically-named Drive file exists and its content
//                     hash matches what Mongo would emit right now.
//   HAND_EDITED    — a canonically-named Drive file exists but its content
//                     hash differs (client edited it, or it's gone stale).
//   MISSING        — Mongo has data for this day, no matching Drive file
//                     found anywhere (canonical name or content match).
//   ORPHAN         — a Drive file exists with no corresponding Mongo data
//                     (canonically-named file whose day isn't expected, or a
//                     leftover non-canonical file that matches no expected
//                     day's content).
//   DIVERGENT_NAME — Mongo has data for this day, no canonically-named file
//                     exists, but SOME other file in the folder has content
//                     matching what that day would emit (renamed/duplicated).
//   DUPLICATE_NAME — TWO OR MORE Drive files share the exact canonical name
//                     for this day (Drive allows duplicate names in the same
//                     folder; the report tool must never silently pick a
//                     "winner" — every copy is reported, the day is a hazard).
//
// Run: npx tsx src/lib/drive-drift-classify.ts self-test

export type DriftClassification =
  | 'IN_SYNC'
  | 'HAND_EDITED'
  | 'MISSING'
  | 'ORPHAN'
  | 'DIVERGENT_NAME'
  | 'DUPLICATE_NAME'

export interface ClassifyBucketInput {
  /** sha256 of the content Mongo would emit for this day right now, or null if Mongo has no data for this day. */
  expectedHash: string | null
  /** sha256 of the Drive file at the canonical name for this day, or null if no such file exists. */
  canonicalActualHash: string | null
  /** sha256 of a non-canonically-named Drive file being tested as this day's divergent match, or null if none is being tested. */
  divergentMatchHash: string | null
}

/**
 * Pure per-bucket classifier. Caller is expected to only invoke this for a
 * bucket where at least one of expectedHash/canonicalActualHash is non-null
 * (a bucket with neither is not a real bucket — nothing to report); the
 * neither-present case is defined below only so the function is total.
 */
export function classifyBucket(input: ClassifyBucketInput): DriftClassification {
  const { expectedHash, canonicalActualHash, divergentMatchHash } = input

  if (expectedHash !== null && canonicalActualHash !== null) {
    return expectedHash === canonicalActualHash ? 'IN_SYNC' : 'HAND_EDITED'
  }

  if (expectedHash !== null && canonicalActualHash === null) {
    return divergentMatchHash !== null && divergentMatchHash === expectedHash ? 'DIVERGENT_NAME' : 'MISSING'
  }

  if (expectedHash === null && canonicalActualHash !== null) {
    return 'ORPHAN'
  }

  // expectedHash === null && canonicalActualHash === null: no real bucket.
  // Never emitted by the report tool's loop; defined only for totality.
  return 'ORPHAN'
}

export interface ClassifyCanonicalBucketInput {
  expectedHash: string | null
  /** ALL Drive files found at the canonical name for this day — 0, 1, or (hazard) many. Order never matters. */
  canonicalActualHashes: string[]
  divergentMatchHash: string | null
}

/**
 * Duplicate-name-aware wrapper around classifyBucket (fix-wave F2): if two or
 * more Drive files share the exact canonical name, NOTHING is collapsed by
 * picking one (a Map keyed by name silently drops every loser — the bug this
 * replaces) — the bucket is unconditionally DUPLICATE_NAME, decided purely by
 * `.length`, so the order the caller's Drive listing happened to return the
 * copies in can never change the outcome.
 */
export function classifyCanonicalBucket(input: ClassifyCanonicalBucketInput): DriftClassification {
  if (input.canonicalActualHashes.length > 1) return 'DUPLICATE_NAME'
  return classifyBucket({
    expectedHash: input.expectedHash,
    canonicalActualHash: input.canonicalActualHashes[0] ?? null,
    divergentMatchHash: input.divergentMatchHash,
  })
}

// ---------------------------------------------------------------------------
// Manifest re-verify (fix-wave F1) — HIGH-3's re-verify hook. Two
// INDEPENDENT staleness checks, because they answer different questions:
//
//   bytesStatus   — has the Drive file's BYTES changed since the manifest
//                   recorded them (currentDriveContentHash vs the manifest's
//                   stored driveContentHash)? Detects hand-edits/corruption
//                   AFTER migration/verify time.
//   emitterStatus — does what's CURRENTLY in Drive match what the LIVE
//                   emitter would produce from CURRENT Mongo data right now
//                   (currentDriveContentHash vs a fresh re-emission, hashed)?
//                   Detects emitter/format drift — a file can be byte-for-
//                   byte unchanged since a perfectly good migration and still
//                   be missing fields the emitter has since started writing
//                   (the "pre-payload-era record" scenario). This is NOT the
//                   same check as ManifestRecord.canonicalHash: canonicalHash
//                   hashes the RAW MONGO ROW fields, so it only detects "did
//                   the source row change" — it says nothing about whether
//                   the FILE FORMAT moved on, which is exactly the blind spot
//                   here. Re-emitting and comparing against Drive bytes is
//                   the only check that can see emitter drift; canonicalHash
//                   is the wrong comparator for it.
//
// A record can be BYTES valid AND EMITTER stale simultaneously (the P6 case:
// untouched pre-payload bytes) — the two fields are reported independently,
// never collapsed into one verdict.
// ---------------------------------------------------------------------------
export type ManifestFieldStatus = 'VALID' | 'STALE'

export interface ManifestRecordCheckInput {
  /** Manifest's stored content hash at migration/verify time, or null if the manifest never recorded one. */
  recordedDriveContentHash: string | null
  /** Re-downloaded current Drive bytes hash, or null if the file is unreachable (missing/trashed/read error). */
  currentDriveContentHash: string | null
  /** sha256 of re-emitting this day's content from CURRENT Mongo data right now, or null if it couldn't be derived (no current Mongo data for the day, or an unparseable canonical file name). */
  currentEmitterHash: string | null
}

export interface ManifestRecordCheckResult {
  bytesStatus: ManifestFieldStatus
  emitterStatus: ManifestFieldStatus
  reasons: string[]
}

export function classifyManifestRecord(input: ManifestRecordCheckInput): ManifestRecordCheckResult {
  const reasons: string[] = []

  if (input.currentDriveContentHash === null) {
    return {
      bytesStatus: 'STALE',
      emitterStatus: 'STALE',
      reasons: ['Drive file unreachable (missing/trashed/read error)'],
    }
  }

  let bytesStatus: ManifestFieldStatus = 'VALID'
  if (input.recordedDriveContentHash === null || input.currentDriveContentHash !== input.recordedDriveContentHash) {
    bytesStatus = 'STALE'
    reasons.push('content hash differs from manifest-recorded hash (bytes changed since migration/verify)')
  }

  let emitterStatus: ManifestFieldStatus = 'VALID'
  if (input.currentEmitterHash === null) {
    emitterStatus = 'STALE'
    reasons.push('could not re-derive current emitter content (no current Mongo data for this day, or unparseable canonical name)')
  } else if (input.currentEmitterHash !== input.currentDriveContentHash) {
    emitterStatus = 'STALE'
    reasons.push('current Drive bytes do not match what the live emitter would produce from Mongo right now (emitter/format drift)')
  }

  return { bytesStatus, emitterStatus, reasons }
}

// ---------------------------------------------------------------------------
// Canonical-name matcher — generic over a domain's filename shape
// (`${prefix}-${YYYY-MM-DD}.${ext}`), used by journal today
// (`journal-2026-07-18.md`) and reusable as-is by any future single-file-per-
// day domain (nutrition, dailyTasks, checkins, modules).
// ---------------------------------------------------------------------------
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Returns the YYYY-MM-DD date string if `name` is EXACTLY the canonical
 * `${prefix}-${date}.${ext}` shape, else null. Structural check only (valid
 * digit grouping, not calendar validity) — matches how the app itself derives
 * the string (`date.toISOString().split('T')[0]`), so anything the app would
 * never emit itself (wrong separators, missing zero-padding, extra suffixes,
 * wrong case) correctly comes back non-canonical.
 */
export function matchCanonicalDayFileName(prefix: string, ext: string, name: string): string | null {
  const re = new RegExp(`^${escapeRegExp(prefix)}-(\\d{4}-\\d{2}-\\d{2})\\.${escapeRegExp(ext)}$`)
  const m = re.exec(name)
  return m ? m[1] : null
}

export function isCanonicalJournalName(name: string): string | null {
  return matchCanonicalDayFileName('journal', 'md', name)
}

// ---------------------------------------------------------------------------
// Self-test (no deps, no DB, no Drive) — run via:
//   npx tsx src/lib/drive-drift-classify.ts self-test
// ---------------------------------------------------------------------------
export function runSelfTest(): boolean {
  const assert = require('node:assert').strict
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

  // ---- classifyBucket decision table ----------------------------------

  check('expected + canonical actual, hash match -> IN_SYNC', () => {
    assert.equal(
      classifyBucket({ expectedHash: 'h1', canonicalActualHash: 'h1', divergentMatchHash: null }),
      'IN_SYNC'
    )
  })

  check('expected + canonical actual, hash mismatch -> HAND_EDITED', () => {
    assert.equal(
      classifyBucket({ expectedHash: 'h1', canonicalActualHash: 'h2', divergentMatchHash: null }),
      'HAND_EDITED'
    )
  })

  check('expected, no canonical actual, no divergent candidate -> MISSING', () => {
    assert.equal(
      classifyBucket({ expectedHash: 'h1', canonicalActualHash: null, divergentMatchHash: null }),
      'MISSING'
    )
  })

  check('expected, no canonical actual, divergent candidate content matches -> DIVERGENT_NAME', () => {
    assert.equal(
      classifyBucket({ expectedHash: 'h1', canonicalActualHash: null, divergentMatchHash: 'h1' }),
      'DIVERGENT_NAME'
    )
  })

  check('expected, no canonical actual, divergent candidate content does NOT match -> MISSING (not a real divergent match)', () => {
    assert.equal(
      classifyBucket({ expectedHash: 'h1', canonicalActualHash: null, divergentMatchHash: 'h9' }),
      'MISSING'
    )
  })

  check('no expected, canonical actual present -> ORPHAN', () => {
    assert.equal(
      classifyBucket({ expectedHash: null, canonicalActualHash: 'h1', divergentMatchHash: null }),
      'ORPHAN'
    )
  })

  check('no expected, no canonical actual (unreachable bucket) -> defined, does not throw', () => {
    assert.doesNotThrow(() => classifyBucket({ expectedHash: null, canonicalActualHash: null, divergentMatchHash: null }))
  })

  // ---- classifyCanonicalBucket (fix-wave F2: duplicate canonical names) ----

  check('0 canonical copies -> falls through to classifyBucket (MISSING, matches prior behavior)', () => {
    assert.equal(
      classifyCanonicalBucket({ expectedHash: 'h1', canonicalActualHashes: [], divergentMatchHash: null }),
      'MISSING'
    )
  })

  check('1 canonical copy -> falls through to classifyBucket (IN_SYNC, matches prior behavior)', () => {
    assert.equal(
      classifyCanonicalBucket({ expectedHash: 'h1', canonicalActualHashes: ['h1'], divergentMatchHash: null }),
      'IN_SYNC'
    )
  })

  check('2 canonical copies, one matching expected + one hand-edited -> DUPLICATE_NAME regardless (ordering A: match first)', () => {
    assert.equal(
      classifyCanonicalBucket({ expectedHash: 'h1', canonicalActualHashes: ['h1', 'h9'], divergentMatchHash: null }),
      'DUPLICATE_NAME'
    )
  })

  check('2 canonical copies, same content, reversed order (ordering B: match second) -> DUPLICATE_NAME, order never matters', () => {
    assert.equal(
      classifyCanonicalBucket({ expectedHash: 'h1', canonicalActualHashes: ['h9', 'h1'], divergentMatchHash: null }),
      'DUPLICATE_NAME'
    )
  })

  check('3+ canonical copies -> still DUPLICATE_NAME, nothing dropped by length alone', () => {
    assert.equal(
      classifyCanonicalBucket({ expectedHash: 'h1', canonicalActualHashes: ['h1', 'h2', 'h3'], divergentMatchHash: null }),
      'DUPLICATE_NAME'
    )
  })

  // ---- classifyManifestRecord (fix-wave F1: manifest re-verify) ----------

  check('bytes unchanged + emitter matches current Drive bytes -> VALID/VALID', () => {
    const result = classifyManifestRecord({
      recordedDriveContentHash: 'bytesA',
      currentDriveContentHash: 'bytesA',
      currentEmitterHash: 'bytesA',
    })
    assert.equal(result.bytesStatus, 'VALID')
    assert.equal(result.emitterStatus, 'VALID')
    assert.equal(result.reasons.length, 0)
  })

  check('P6 (verifier exact scenario): pre-payload-era record, untouched pre-payload bytes -> BYTES VALID, EMITTER STALE', () => {
    // Bytes are exactly what the manifest recorded at migration time (no
    // hand-edit, nothing touched it since) — but the live emitter, run
    // against current Mongo data right now, would produce different
    // (payload-block-bearing) bytes. Bytes-only staleness checking would
    // wrongly say VALID; this must come back EMITTER_STALE.
    const preePayloadBytes = 'pre-payload-era-content-hash'
    const currentEmitterOutput = 'post-payload-era-content-hash'
    const result = classifyManifestRecord({
      recordedDriveContentHash: preePayloadBytes,
      currentDriveContentHash: preePayloadBytes, // untouched since migration
      currentEmitterHash: currentEmitterOutput, // emitter has moved on
    })
    assert.equal(result.bytesStatus, 'VALID')
    assert.equal(result.emitterStatus, 'STALE')
    assert.ok(result.reasons.some((r) => r.includes('emitter/format drift')))
  })

  check('hand-edited since manifest, but coincidentally matches current emitter output -> BYTES STALE, EMITTER VALID', () => {
    const result = classifyManifestRecord({
      recordedDriveContentHash: 'original-bytes',
      currentDriveContentHash: 'edited-bytes',
      currentEmitterHash: 'edited-bytes',
    })
    assert.equal(result.bytesStatus, 'STALE')
    assert.equal(result.emitterStatus, 'VALID')
  })

  check('both stale: hand-edited AND emitter-mismatched', () => {
    const result = classifyManifestRecord({
      recordedDriveContentHash: 'original-bytes',
      currentDriveContentHash: 'edited-bytes',
      currentEmitterHash: 'expected-bytes',
    })
    assert.equal(result.bytesStatus, 'STALE')
    assert.equal(result.emitterStatus, 'STALE')
    assert.equal(result.reasons.length, 2)
  })

  check('Drive file unreachable -> both STALE with a single explicit reason, no further checks attempted', () => {
    const result = classifyManifestRecord({
      recordedDriveContentHash: 'bytesA',
      currentDriveContentHash: null,
      currentEmitterHash: 'bytesA',
    })
    assert.equal(result.bytesStatus, 'STALE')
    assert.equal(result.emitterStatus, 'STALE')
    assert.equal(result.reasons.length, 1)
    assert.ok(result.reasons[0].includes('unreachable'))
  })

  check('no current Mongo data for this day (rows deleted / unparseable name) -> emitter STALE, bytes unaffected', () => {
    const result = classifyManifestRecord({
      recordedDriveContentHash: 'bytesA',
      currentDriveContentHash: 'bytesA',
      currentEmitterHash: null,
    })
    assert.equal(result.bytesStatus, 'VALID')
    assert.equal(result.emitterStatus, 'STALE')
    assert.ok(result.reasons.some((r) => r.includes('could not re-derive')))
  })

  check('manifest never recorded a driveContentHash -> bytes STALE even if current bytes happen to equal emitter output', () => {
    const result = classifyManifestRecord({
      recordedDriveContentHash: null,
      currentDriveContentHash: 'bytesA',
      currentEmitterHash: 'bytesA',
    })
    assert.equal(result.bytesStatus, 'STALE')
    assert.equal(result.emitterStatus, 'VALID')
  })

  // ---- canonical-name matcher ------------------------------------------

  check('exact canonical journal name matches and extracts the date', () => {
    assert.equal(isCanonicalJournalName('journal-2026-07-18.md'), '2026-07-18')
  })

  check('non-canonical: duplicate/copy suffix', () => {
    assert.equal(isCanonicalJournalName('journal-2026-07-18-copy.md'), null)
    assert.equal(isCanonicalJournalName('journal-2026-07-18 (1).md'), null)
  })

  check('non-canonical: wrong separator (underscore instead of hyphen)', () => {
    assert.equal(isCanonicalJournalName('journal_2026_07_18.md'), null)
  })

  check('non-canonical: wrong case', () => {
    assert.equal(isCanonicalJournalName('Journal-2026-07-18.md'), null)
  })

  check('non-canonical: extra extension / trailing bytes', () => {
    assert.equal(isCanonicalJournalName('journal-2026-07-18.md.bak'), null)
  })

  check('non-canonical: US-local date order (MM-DD-YYYY) instead of ISO', () => {
    assert.equal(isCanonicalJournalName('journal-07-18-2026.md'), null)
  })

  check('non-canonical: missing zero-padding', () => {
    assert.equal(isCanonicalJournalName('journal-2026-7-18.md'), null)
  })

  check('non-canonical: different domain prefix entirely', () => {
    assert.equal(isCanonicalJournalName('workout-2026-07-18-abc123.md'), null)
  })

  check('generic matcher works for a different domain shape (nutrition, csv-free single-file-per-day)', () => {
    assert.equal(matchCanonicalDayFileName('nutrition', 'md', 'nutrition-2026-07-18.md'), '2026-07-18')
    assert.equal(matchCanonicalDayFileName('nutrition', 'md', 'nutrition-2026-07-18-old.md'), null)
  })

  console.log(results.join('\n'))
  console.log(pass ? `\nSELF-TEST: ALL PASS (${results.length}/${results.length})` : '\nSELF-TEST: FAILURES PRESENT')
  return pass
}

if (require.main === module) {
  const command = process.argv[2]
  if (command === 'self-test') {
    const ok = runSelfTest()
    process.exitCode = ok ? 0 : 1
  } else {
    console.error('Usage: npx tsx src/lib/drive-drift-classify.ts self-test')
    process.exitCode = 1
  }
}
