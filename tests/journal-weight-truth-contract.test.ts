import fs from 'node:fs'
import path from 'node:path'
import { resolveJournalWeight, type JournalWeightCandidate } from '../src/lib/journalWeightTruth'
import { isValidDayKey } from '../src/lib/localDay'

// P1b-1A contract harness: proves the resolver never picks a silent winner
// among conflicting weight readings, and that weight/mood/source ids
// survive every classification path (they only ever get PRESERVED, never
// dropped) — the exact guarantee scripts/dedupe-journal-entries.ts's old
// createdAt-desc "canonical row" pick violated.

let failed = false

function check(label: string, pass: boolean, detail?: string) {
  if (pass) {
    console.log(`[PASS] ${label}`)
  } else {
    failed = true
    console.error(`[FAIL] ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function candidate(partial: Partial<JournalWeightCandidate> & { id: string; createdAt: Date }): JournalWeightCandidate {
  return { dayKey: '2026-07-15', weight: null, unit: null, mood: null, ...partial }
}

// --- resolved: one weighted row + weightless duplicates ---
{
  const rows = [
    candidate({ id: 'a', createdAt: new Date('2026-07-15T09:00:00Z'), weight: 180, unit: 'lb', mood: 'good' }),
    candidate({ id: 'b', createdAt: new Date('2026-07-15T10:00:00Z'), mood: 'tired' }),
  ]
  const r = resolveJournalWeight(rows)
  check('single weighted row + weightless duplicate resolves', r.status === 'resolved', r.status)
  check('resolved normalizedKg is lb->kg rounded to 3 decimals', r.normalizedKg === round3Expected(180), String(r.normalizedKg))
  check('resolved preserves both source ids in createdAt order', r.sourceIds.join(',') === 'a,b', r.sourceIds.join(','))
  check('resolved preserves weightless row mood', r.candidates.find((c) => c.id === 'b')?.mood === 'tired')
  check('resolved preserves weighted row weight untouched', r.candidates.find((c) => c.id === 'a')?.weight === 180)
}

// --- same_value_duplicates: equivalent explicit lb/kg readings ---
{
  const rows = [
    candidate({ id: 'a', createdAt: new Date('2026-07-15T09:00:00Z'), weight: 150, unit: 'lb' }),
    candidate({ id: 'b', createdAt: new Date('2026-07-15T10:00:00Z'), weight: round3Expected(150), unit: 'kg' }),
  ]
  const r = resolveJournalWeight(rows)
  check('equivalent lb/kg readings classify as same_value_duplicates', r.status === 'same_value_duplicates', r.status)
  check('same_value_duplicates carries the shared normalizedKg', r.normalizedKg === round3Expected(150), String(r.normalizedKg))
  check('same_value_duplicates preserves both source ids', r.sourceIds.length === 2 && r.candidates.length === 2)
}

// --- conflict: distinct readings never get a silent winner ---
{
  const rows = [
    candidate({ id: 'older', createdAt: new Date('2026-07-15T09:00:00Z'), weight: 180, unit: 'lb', mood: 'ok' }),
    candidate({ id: 'newer', createdAt: new Date('2026-07-15T11:00:00Z'), weight: 175, unit: 'lb', mood: 'great' }),
  ]
  const r = resolveJournalWeight(rows)
  check('distinct readings classify as conflict', r.status === 'conflict', r.status)
  check('conflict selects no normalized value', r.normalizedKg === null, String(r.normalizedKg))
  check('conflict still preserves the older row weight', r.candidates.find((c) => c.id === 'older')?.weight === 180)
  check('conflict still preserves the newer row weight (no newest-wins)', r.candidates.find((c) => c.id === 'newer')?.weight === 175)
  check('conflict still preserves both moods', r.candidates.find((c) => c.id === 'older')?.mood === 'ok' && r.candidates.find((c) => c.id === 'newer')?.mood === 'great')
  check('conflict preserves both source ids in order', r.sourceIds.join(',') === 'older,newer', r.sourceIds.join(','))
}

// --- unknown_day: missing/inconsistent day key stays unknown ---
{
  const rows = [
    candidate({ id: 'a', createdAt: new Date('2026-07-15T09:00:00Z'), weight: 180, unit: 'lb', dayKey: null }),
    candidate({ id: 'b', createdAt: new Date('2026-07-15T10:00:00Z'), weight: 180, unit: 'lb' }),
  ]
  const r = resolveJournalWeight(rows)
  check('missing day key on any row yields unknown_day', r.status === 'unknown_day', r.status)
  check('unknown_day selects no normalized value', r.normalizedKg === null)
  check('unknown_day still preserves both source ids', r.sourceIds.length === 2)
}

// --- unknown_day: the canonical resolver enforces shared strict day truth ---
{
  const cases: Array<{ label: string; dayKey?: string | null }> = [
    { label: 'impossible Gregorian date', dayKey: '2026-02-30' },
    { label: 'malformed date', dayKey: '07/15/2026' },
    { label: 'empty date', dayKey: '' },
    { label: 'missing date', dayKey: undefined },
  ]

  for (const fixture of cases) {
    const r = resolveJournalWeight([
      candidate({ id: fixture.label, createdAt: new Date('2026-07-15T09:00:00Z'), dayKey: fixture.dayKey, weight: 180, unit: 'lb' }),
    ])
    check(`${fixture.label} yields unknown_day in the resolver`, r.status === 'unknown_day', r.status)
    check(`${fixture.label} selects no normalized value`, r.normalizedKg === null, String(r.normalizedKg))
  }

  const differing = resolveJournalWeight([
    candidate({ id: 'first-day', createdAt: new Date('2026-07-15T09:00:00Z'), dayKey: '2026-07-15', weight: 180, unit: 'lb' }),
    candidate({ id: 'second-day', createdAt: new Date('2026-07-16T09:00:00Z'), dayKey: '2026-07-16', weight: 180, unit: 'lb' }),
  ])
  check('differing valid dates yield unknown_day in the resolver', differing.status === 'unknown_day', differing.status)
  check('differing valid dates select no normalized value', differing.normalizedKg === null, String(differing.normalizedKg))
}

// --- unknown_unit: no provenance means no inferred pounds ---
{
  const rows = [candidate({ id: 'a', createdAt: new Date('2026-07-15T09:00:00Z'), weight: 180, unit: null })]
  const r = resolveJournalWeight(rows)
  check('weighted row with no unit tag yields unknown_unit', r.status === 'unknown_unit', r.status)
  check('unknown_unit selects no normalized value (no lb assumed)', r.normalizedKg === null)
  check('unknown_unit preserves the raw weight untouched', r.candidates[0].weight === 180)
}

// --- invalid_source: non-finite, zero, negative — no clinical ceiling invented ---
{
  const zero = resolveJournalWeight([candidate({ id: 'a', createdAt: new Date('2026-07-15T09:00:00Z'), weight: 0, unit: 'lb' })])
  check('zero weight is invalid_source', zero.status === 'invalid_source', zero.status)

  const negative = resolveJournalWeight([candidate({ id: 'a', createdAt: new Date('2026-07-15T09:00:00Z'), weight: -5, unit: 'lb' })])
  check('negative weight is invalid_source', negative.status === 'invalid_source', negative.status)

  const nonFinite = resolveJournalWeight([candidate({ id: 'a', createdAt: new Date('2026-07-15T09:00:00Z'), weight: Infinity, unit: 'lb' })])
  check('non-finite weight is invalid_source', nonFinite.status === 'invalid_source', nonFinite.status)

  const huge = resolveJournalWeight([candidate({ id: 'a', createdAt: new Date('2026-07-15T09:00:00Z'), weight: 99999, unit: 'lb' })])
  check('no invented clinical upper limit — a large finite positive value resolves', huge.status === 'resolved', huge.status)

  check('invalid_source preserves the raw (invalid) weight untouched', zero.candidates[0].weight === 0)
}

// --- removed: every row in the group is weightless ---
{
  const rows = [
    candidate({ id: 'a', createdAt: new Date('2026-07-15T09:00:00Z'), mood: 'meh' }),
    candidate({ id: 'b', createdAt: new Date('2026-07-15T10:00:00Z'), mood: 'fine' }),
  ]
  const r = resolveJournalWeight(rows)
  check('all-weightless group classifies as removed', r.status === 'removed', r.status)
  check('removed selects no normalized value', r.normalizedKg === null)
  check('removed still preserves both moods and ids', r.candidates.map((c) => c.mood).join(',') === 'meh,fine' && r.sourceIds.length === 2)
}

// --- ordering is for reproducibility only, never winner selection ---
{
  const rows = [
    candidate({ id: 'zzz', createdAt: new Date('2026-07-15T09:00:00Z'), weight: 175, unit: 'lb' }),
    candidate({ id: 'aaa', createdAt: new Date('2026-07-15T09:00:00Z'), weight: 180, unit: 'lb' }),
  ]
  const r = resolveJournalWeight(rows)
  check('same createdAt breaks ties by id ASC for ordering', r.sourceIds.join(',') === 'aaa,zzz', r.sourceIds.join(','))
  check('tie-break ordering does not resolve the conflict', r.status === 'conflict', r.status)
}

function round3Expected(lb: number): number {
  return Math.round(lb * 0.45359237 * 1000) / 1000
}

// --- the shared validator the report script relies on must reject
// impossible Gregorian dates that a naive /^\d{4}-\d{2}-\d{2}$/ shape-only
// regex would happily accept ---
{
  check(
    'shared isValidDayKey rejects an impossible Gregorian date (2026-02-30)',
    isValidDayKey('2026-02-30') === false,
    'isValidDayKey accepted an impossible date'
  )
  check(
    'shared isValidDayKey accepts a real day key',
    isValidDayKey('2026-07-15') === true,
    'isValidDayKey rejected a valid date'
  )
}

// --- static quarantine: the report script's source must never regain the
// fabricated-provenance or silent-mutation shape this contract exists to
// keep out, regardless of what the resolver above proves. ---
{
  const scriptPath = path.join(__dirname, '..', 'scripts', 'dedupe-journal-entries.ts')
  const source = fs.readFileSync(scriptPath, 'utf8')

  check(
    'report script never calls localDayKey(...) as a fallback',
    // Matches only a call to the raw `localDayKey` function — must not
    // false-positive on `isValidDayKey(...)`, which shares the "DayKey"
    // suffix but not the "local" prefix immediately before it.
    !/\blocalDayKey\s*\(/.test(source),
    'found a localDayKey(...) call'
  )
  check(
    'report script imports the shared isValidDayKey validator',
    /import\s*\{[^}]*\bisValidDayKey\b[^}]*\}\s*from\s*['"]\.\.\/src\/lib\/localDay['"]/.test(source),
    'no isValidDayKey import from ../src/lib/localDay found'
  )
  check(
    'report script calls isValidDayKey(...) when accepting the JSON localDate',
    /\bisValidDayKey\s*\(/.test(source),
    'no isValidDayKey(...) call found'
  )
  check(
    'report script defines no private day-key regex of its own',
    !/\\d\{4\}-\\d\{2\}-\\d\{2\}/.test(source),
    'found a private YYYY-MM-DD regex — day validation must come from isValidDayKey, not a local pattern'
  )
  check(
    'report script never derives day provenance from entry.date',
    !/\.date\b/.test(source),
    'found an `.date` reference outside the JSON-captured localDate'
  )

  const applyGuardMatch = source.match(/process\.argv\.includes\(['"]--apply['"]\)/)
  const mainInvocationMatch = source.match(/^main\(\)\.catch/m)
  check(
    'report script has a --apply guard',
    !!applyGuardMatch,
    'no --apply guard found'
  )
  check(
    'report script has a main() invocation',
    !!mainInvocationMatch,
    'no top-level main() invocation found'
  )
  check(
    'the --apply guard appears before main() is invoked',
    !!applyGuardMatch && !!mainInvocationMatch && (applyGuardMatch.index as number) < (mainInvocationMatch.index as number),
    'guard does not precede the main() invocation'
  )

  const prismaImportMatch = source.match(/await import\(['"][^'"]*\/lib\/prisma['"]\)/)
  check(
    'prisma is loaded via a dynamic import (not a static top-level import)',
    !/^import\s+\{[^}]*prisma[^}]*\}\s+from\s+['"][^'"]*\/lib\/prisma['"]/m.test(source) && !!prismaImportMatch,
    'prisma module is statically imported at module scope'
  )

  const mainFnMatch = source.match(/async function main\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/)
  check(
    'prisma is dynamically imported inside main()',
    !!mainFnMatch && !!prismaImportMatch && mainFnMatch[1].includes(prismaImportMatch[0]),
    'the dynamic prisma import is not inside the main() function body'
  )

  const mutationPattern = /\.(updateMany|deleteMany|update|delete|create|upsert)\s*\(|\$transaction\s*\(/
  check(
    'report script contains no mutation call or branch',
    !mutationPattern.test(source),
    'found a mutation call (update/updateMany/delete/deleteMany/create/upsert/$transaction)'
  )

  check(
    'unknown-day rows are reported one-by-one, not grouped together',
    /for \(const entry of unknownDayRows\)/.test(source) && /report\(`\$\{entry\.userId\}::unknown_day::\$\{entry\.id\}`, \[entry\]\)/.test(source),
    'unknown-day rows are not routed through the resolver as individual singleton candidates'
  )
}

if (failed) {
  process.exitCode = 1
  console.error('\nOne or more journal-weight-truth scenarios failed.')
} else {
  console.log('\nAll journal-weight-truth contract scenarios passed.')
}
