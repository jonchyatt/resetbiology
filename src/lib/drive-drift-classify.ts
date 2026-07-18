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
//
// Run: npx tsx src/lib/drive-drift-classify.ts self-test

export type DriftClassification = 'IN_SYNC' | 'HAND_EDITED' | 'MISSING' | 'ORPHAN' | 'DIVERGENT_NAME'

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
