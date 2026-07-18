/**
 * Journal read-path authority flip (Phase C, ticket cf-c2-journal-inversion).
 *
 * Dark by default: `journalReadAuthorityActive` returns false unless ALL three
 * hold — env flag on, vault connected, AND a LIVE (queried-at-call-time)
 * MigrationManifest row for (userId, 'journal') with status 'verified'
 * (HIGH-3: a cached/stale verdict must never authorize; this module holds no
 * cross-request cache of any of the three checks — every call re-queries).
 *
 * Decision logic below is split into pure functions so the overlay/degraded
 * rules (HIGH-1 read-your-write, MED-3 fallback provenance) are testable
 * without a live Drive connection or database.
 */

import { prisma } from '@/lib/prisma'
import { isVaultConnected } from '@/lib/vaultService'

export const JOURNAL_AUTHORITY_ENV_FLAG = 'DRIVE_READ_AUTHORITY_JOURNAL'
export const JOURNAL_MANIFEST_DOMAIN = 'journal'

export interface AuthorityContext {
  flagOn: boolean
  vaultConnected: boolean
  manifestStatus: string | null
}

/** Pure: the three-way gate (HIGH-3 amends D-C2 — flag AND vault AND verified manifest, nothing cached). */
export function computeAuthorityActive(context: AuthorityContext): boolean {
  return context.flagOn && context.vaultConnected && context.manifestStatus === 'verified'
}

/**
 * Live gather of the three authority primitives. Short-circuits before any
 * DB call when the env flag is off — dark-by-default is structurally cheap,
 * not just structurally correct. No module-level cache: every call queries
 * fresh (per-request memoization by the caller holding the returned object
 * for the rest of that one request is fine; there is nothing here to memoize
 * ACROSS requests/calls).
 */
export async function gatherAuthorityContext(userId: string): Promise<AuthorityContext> {
  const flagOn = process.env[JOURNAL_AUTHORITY_ENV_FLAG] === '1'
  if (!flagOn) {
    return { flagOn, vaultConnected: false, manifestStatus: null }
  }

  const [vaultConnected, manifest] = await Promise.all([
    isVaultConnected(userId),
    prisma.migrationManifest.findFirst({
      where: { userId, domain: JOURNAL_MANIFEST_DOMAIN, status: 'verified' },
      orderBy: { completedAt: 'desc' },
      select: { status: true },
    }),
  ])

  return { flagOn, vaultConnected, manifestStatus: manifest?.status ?? null }
}

/** The authority helper named by the ticket: true only when all three gates hold. */
export async function journalReadAuthorityActive(userId: string): Promise<boolean> {
  const context = await gatherAuthorityContext(userId)
  return computeAuthorityActive(context)
}

// ---------------------------------------------------------------------------
// Read-your-write overlay + degraded-fallback decision (HIGH-1, MED-3)
// ---------------------------------------------------------------------------

export type JournalReadProvenance = 'drive' | 'syncing' | 'app-cache'

export interface JournalReadDecisionInput extends AuthorityContext {
  /** Mongo row's updatedAt (or createdAt if never updated); null if no row exists. */
  mongoUpdatedAt: Date | null
  /** Drive day-file's modifiedTime; null if no file exists (or authority inactive). */
  driveModifiedTime: Date | null
  /** A pending/inflight DriveSyncOutbox row exists for this user/day/domain. */
  pendingOutbox: boolean
  /** The Drive read attempt itself errored (network/auth/API failure). */
  driveReadFailed: boolean
}

export interface JournalReadDecision {
  authorityActive: boolean
  /** null when authority is inactive — today's path carries no provenance field at all. */
  provenance: JournalReadProvenance | null
}

/**
 * Pure decision function covering the full GET-time branch matrix:
 *   - authority inactive -> today's Mongo-only path (provenance: null)
 *   - Drive read failed -> degraded fallback, provenance 'app-cache' (MED-3)
 *   - pending outbox row OR Mongo newer than Drive -> 'syncing' (HIGH-1)
 *   - otherwise -> 'drive' (Drive is truth)
 * A just-saved entry can never read back stale or vanish: 'syncing' is
 * checked before falling through to 'drive'.
 */
export function decideJournalRead(input: JournalReadDecisionInput): JournalReadDecision {
  const authorityActive = computeAuthorityActive(input)
  if (!authorityActive) {
    return { authorityActive: false, provenance: null }
  }

  if (input.driveReadFailed) {
    return { authorityActive: true, provenance: 'app-cache' }
  }

  if (input.pendingOutbox) {
    return { authorityActive: true, provenance: 'syncing' }
  }

  if (
    input.mongoUpdatedAt &&
    input.driveModifiedTime &&
    input.mongoUpdatedAt.getTime() > input.driveModifiedTime.getTime()
  ) {
    return { authorityActive: true, provenance: 'syncing' }
  }

  // Fix-wave 2 (F2, blind-verify HIGH finding #2): no Drive file exists
  // (missing/deleted/outbox 'failed'/'user_removed') but a Mongo row does —
  // NEVER resolve to 'drive' with {entry:null} while Mongo holds data.
  // Degrade to 'app-cache' (a real, defensible copy) rather than pretending
  // there's nothing. Only when NEITHER Mongo nor Drive has anything for this
  // day (brand new day, first save never happened) does 'drive' (empty) fall
  // through below.
  if (!input.driveModifiedTime && input.mongoUpdatedAt) {
    return { authorityActive: true, provenance: 'app-cache' }
  }

  return { authorityActive: true, provenance: 'drive' }
}

// ---------------------------------------------------------------------------
// Self-test (no deps, no DB, no Drive) — run via:
//   npx tsx src/lib/drive-read-authority.ts self-test
// ---------------------------------------------------------------------------
async function runSelfTest(): Promise<boolean> {
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
  const checkAsync = async (label: string, fn: () => Promise<void>) => {
    try {
      await fn()
      results.push(`PASS: ${label}`)
    } catch (err: any) {
      pass = false
      results.push(`FAIL: ${label} -- ${err?.message ?? err}`)
    }
  }

  const baseOverlay = {
    mongoUpdatedAt: null as Date | null,
    driveModifiedTime: null as Date | null,
    pendingOutbox: false,
    driveReadFailed: false,
  }

  check('flag off -> authority inactive regardless of everything else', () => {
    const decision = decideJournalRead({
      flagOn: false,
      vaultConnected: true,
      manifestStatus: 'verified',
      ...baseOverlay,
      driveModifiedTime: new Date('2026-01-01T00:00:00.000Z'),
    })
    assert.equal(decision.authorityActive, false)
    assert.equal(decision.provenance, null)
    assert.equal(computeAuthorityActive({ flagOn: false, vaultConnected: true, manifestStatus: 'verified' }), false)
  })

  check('flag on but no vault connected -> authority inactive', () => {
    const decision = decideJournalRead({
      flagOn: true,
      vaultConnected: false,
      manifestStatus: 'verified',
      ...baseOverlay,
    })
    assert.equal(decision.authorityActive, false)
    assert.equal(decision.provenance, null)
  })

  check('flag on + vault connected but manifest missing (null) -> authority inactive', () => {
    const decision = decideJournalRead({
      flagOn: true,
      vaultConnected: true,
      manifestStatus: null,
      ...baseOverlay,
    })
    assert.equal(decision.authorityActive, false)
    assert.equal(decision.provenance, null)
  })

  check('flag on + vault connected but manifest unverified (e.g. "incomplete"/"failed") -> authority inactive', () => {
    for (const status of ['incomplete', 'failed', 'rollback-incomplete']) {
      const decision = decideJournalRead({
        flagOn: true,
        vaultConnected: true,
        manifestStatus: status,
        ...baseOverlay,
      })
      assert.equal(decision.authorityActive, false, `status=${status}`)
      assert.equal(decision.provenance, null, `status=${status}`)
    }
  })

  check('all three gates verified, no Mongo row, no Drive file, nothing pending -> drive (empty)', () => {
    const decision = decideJournalRead({
      flagOn: true,
      vaultConnected: true,
      manifestStatus: 'verified',
      ...baseOverlay,
    })
    assert.equal(decision.authorityActive, true)
    assert.equal(decision.provenance, 'drive')
  })

  check('F2 (blind-verify HIGH #2): Drive file missing (driveModifiedTime null) but Mongo row exists -> app-cache, NEVER drive/{entry:null}', () => {
    const decision = decideJournalRead({
      flagOn: true,
      vaultConnected: true,
      manifestStatus: 'verified',
      mongoUpdatedAt: new Date('2026-07-18T12:00:00.000Z'),
      driveModifiedTime: null,
      pendingOutbox: false,
      driveReadFailed: false,
    })
    assert.equal(decision.authorityActive, true)
    assert.equal(decision.provenance, 'app-cache')
  })

  check('F2: Drive file missing AND a pending outbox row exists -> syncing takes priority over app-cache', () => {
    const decision = decideJournalRead({
      flagOn: true,
      vaultConnected: true,
      manifestStatus: 'verified',
      mongoUpdatedAt: new Date('2026-07-18T12:00:00.000Z'),
      driveModifiedTime: null,
      pendingOutbox: true,
      driveReadFailed: false,
    })
    assert.equal(decision.provenance, 'syncing')
  })

  check('F2: Drive file missing AND Mongo row ALSO missing (brand new day) -> drive (empty), not app-cache', () => {
    const decision = decideJournalRead({
      flagOn: true,
      vaultConnected: true,
      manifestStatus: 'verified',
      mongoUpdatedAt: null,
      driveModifiedTime: null,
      pendingOutbox: false,
      driveReadFailed: false,
    })
    assert.equal(decision.provenance, 'drive')
  })

  check('Drive read failed -> app-cache degraded fallback (MED-3), even with no pending outbox', () => {
    const decision = decideJournalRead({
      flagOn: true,
      vaultConnected: true,
      manifestStatus: 'verified',
      ...baseOverlay,
      driveReadFailed: true,
    })
    assert.equal(decision.authorityActive, true)
    assert.equal(decision.provenance, 'app-cache')
  })

  check('pending outbox row -> syncing (HIGH-1), even if Drive read nominally succeeded', () => {
    const decision = decideJournalRead({
      flagOn: true,
      vaultConnected: true,
      manifestStatus: 'verified',
      ...baseOverlay,
      pendingOutbox: true,
      driveModifiedTime: new Date('2026-01-01T00:00:00.000Z'),
    })
    assert.equal(decision.authorityActive, true)
    assert.equal(decision.provenance, 'syncing')
  })

  check('Mongo updatedAt newer than Drive modifiedTime -> syncing (a just-saved entry never reads back stale)', () => {
    const decision = decideJournalRead({
      flagOn: true,
      vaultConnected: true,
      manifestStatus: 'verified',
      ...baseOverlay,
      mongoUpdatedAt: new Date('2026-07-18T12:00:00.000Z'),
      driveModifiedTime: new Date('2026-07-18T11:00:00.000Z'),
    })
    assert.equal(decision.authorityActive, true)
    assert.equal(decision.provenance, 'syncing')
  })

  check('Mongo updatedAt older/equal than Drive modifiedTime, no pending outbox, no read error -> drive', () => {
    const decision = decideJournalRead({
      flagOn: true,
      vaultConnected: true,
      manifestStatus: 'verified',
      ...baseOverlay,
      mongoUpdatedAt: new Date('2026-07-18T10:00:00.000Z'),
      driveModifiedTime: new Date('2026-07-18T11:00:00.000Z'),
    })
    assert.equal(decision.authorityActive, true)
    assert.equal(decision.provenance, 'drive')

    const decisionEqual = decideJournalRead({
      flagOn: true,
      vaultConnected: true,
      manifestStatus: 'verified',
      ...baseOverlay,
      mongoUpdatedAt: new Date('2026-07-18T11:00:00.000Z'),
      driveModifiedTime: new Date('2026-07-18T11:00:00.000Z'),
    })
    assert.equal(decisionEqual.provenance, 'drive')
  })

  check('driveReadFailed takes precedence over a would-be "drive" resolution', () => {
    const decision = decideJournalRead({
      flagOn: true,
      vaultConnected: true,
      manifestStatus: 'verified',
      mongoUpdatedAt: new Date('2026-07-18T09:00:00.000Z'),
      driveModifiedTime: new Date('2026-07-18T11:00:00.000Z'),
      pendingOutbox: false,
      driveReadFailed: true,
    })
    assert.equal(decision.provenance, 'app-cache')
  })

  // Flag-off regression proof (ticket requirement #6): with the env var
  // unset, the LIVE gatherAuthorityContext must short-circuit to inactive
  // BEFORE it ever calls isVaultConnected/prisma — proven here by running it
  // with no DB connection available and confirming it still resolves (a
  // version that queried the DB first would hang/throw here, not resolve
  // cleanly to {flagOn:false, ...}).
  await checkAsync('flag-off regression proof: gatherAuthorityContext short-circuits with env var unset, no DB touched', async () => {
    const original = process.env[JOURNAL_AUTHORITY_ENV_FLAG]
    delete process.env[JOURNAL_AUTHORITY_ENV_FLAG]
    try {
      const context = await gatherAuthorityContext('nonexistent-user-id-no-db-needed')
      assert.equal(context.flagOn, false)
      assert.equal(context.vaultConnected, false)
      assert.equal(context.manifestStatus, null)
      assert.equal(computeAuthorityActive(context), false)
    } finally {
      if (original === undefined) delete process.env[JOURNAL_AUTHORITY_ENV_FLAG]
      else process.env[JOURNAL_AUTHORITY_ENV_FLAG] = original
    }
  })

  await checkAsync('flag-off regression proof: "0" and unset both short-circuit (only exact "1" activates)', async () => {
    const original = process.env[JOURNAL_AUTHORITY_ENV_FLAG]
    try {
      for (const value of ['0', '', 'true', 'false']) {
        process.env[JOURNAL_AUTHORITY_ENV_FLAG] = value
        const context = await gatherAuthorityContext('nonexistent-user-id-no-db-needed')
        assert.equal(context.flagOn, false, `value=${JSON.stringify(value)}`)
      }
    } finally {
      if (original === undefined) delete process.env[JOURNAL_AUTHORITY_ENV_FLAG]
      else process.env[JOURNAL_AUTHORITY_ENV_FLAG] = original
    }
  })

  console.log(results.join('\n'))
  console.log(pass ? `\nSELF-TEST: ALL PASS (${results.length}/${results.length})` : `\nSELF-TEST: FAILURES PRESENT`)
  return pass
}

if (require.main === module) {
  const command = process.argv[2]
  if (command === 'self-test') {
    runSelfTest().then((ok) => {
      process.exitCode = ok ? 0 : 1
    })
  } else {
    console.error(`Usage: npx tsx src/lib/drive-read-authority.ts self-test`)
    process.exitCode = 1
  }
}
