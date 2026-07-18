// One-off cleanup for the duplicate JournalEntry rows NEW-2 accumulated:
// app/api/nback/sessions/route.ts used to unconditionally `create` a new
// row per >=80%-accuracy session instead of merging into the day's
// existing entry (fixed in the same ratchet step as this script — see
// app/api/nback/sessions/route.ts). Existing duplicate rows from before
// that fix still need a one-time cleanup.
//
// DRY RUN BY DEFAULT. Pass --apply to actually write.
// PER TICKET INSTRUCTIONS: this script is written but NEVER RUN in this
// session, dry or --apply.
//
// Usage:
//   npx tsx scripts/dedupe-journal-entries.ts          (dry run — reports only)
//   npx tsx scripts/dedupe-journal-entries.ts --apply   (merges + deletes)
//
// Idempotent by inspection: --apply reduces every duplicate group to
// exactly one row (merge fields into the canonical survivor, delete the
// rest). A subsequent run — dry or --apply — finds zero groups with more
// than one row, so it merges and deletes nothing. There is no group the
// script would ever re-touch.

import { prisma } from '../src/lib/prisma'
import { localDayKey } from '../src/lib/localDay'

const APPLY = process.argv.includes('--apply')

function dayKeyForEntry(entry: { date: Date; entry: string | null }): string {
  // Same precedence the reader uses (app/api/journal/history/route.ts):
  // prefer the writer-captured localDate inside the JSON blob, else fall
  // back to the row's own local calendar-component reading of `date`.
  try {
    const parsed = entry.entry ? JSON.parse(entry.entry) : {}
    if (typeof parsed?.localDate === 'string' && parsed.localDate) return parsed.localDate
  } catch {
    // fall through to date-based key
  }
  return localDayKey(new Date(entry.date))
}

async function main() {
  const allEntries = await prisma.journalEntry.findMany({
    orderBy: { createdAt: 'asc' },
  })

  const groups = new Map<string, typeof allEntries>()
  for (const entry of allEntries) {
    const key = `${entry.userId}::${dayKeyForEntry(entry)}`
    const bucket = groups.get(key) ?? []
    bucket.push(entry)
    groups.set(key, bucket)
  }

  const duplicateGroups = [...groups.entries()].filter(([, rows]) => rows.length > 1)

  console.log(`Scanned ${allEntries.length} journal entries across ${groups.size} user-days.`)
  console.log(`Found ${duplicateGroups.length} user-days with duplicate rows.`)

  for (const [key, rows] of duplicateGroups) {
    // Same merge-target policy as journal/entry POST's
    // `orderBy: { createdAt: 'desc' }` — the most recently created row is
    // what future merges attach to, so it's the canonical survivor. Older
    // rows fill in ONLY fields the canonical row is missing, so a more
    // recent user edit is never clobbered by an older duplicate.
    const sorted = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    const [canonical, ...stale] = sorted

    let canonicalJson: Record<string, unknown> = {}
    try {
      canonicalJson = canonical.entry ? JSON.parse(canonical.entry) : {}
    } catch {
      canonicalJson = {}
    }

    const mergedJson: Record<string, unknown> = { ...canonicalJson }
    for (const staleRow of [...stale].reverse()) { // oldest-first so a more recent stale row wins ties
      let staleJson: Record<string, unknown> = {}
      try {
        staleJson = staleRow.entry ? JSON.parse(staleRow.entry) : {}
      } catch {
        staleJson = {}
      }
      for (const [field, value] of Object.entries(staleJson)) {
        if (mergedJson[field] === undefined || mergedJson[field] === '') {
          mergedJson[field] = value
        }
      }
    }

    console.log(`\n[${key}] ${rows.length} rows -> keeping ${canonical.id}, deleting ${stale.map((r) => r.id).join(', ')}`)

    if (APPLY) {
      await prisma.journalEntry.update({
        where: { id: canonical.id },
        data: { entry: JSON.stringify(mergedJson) },
      })
      await prisma.journalEntry.deleteMany({
        where: { id: { in: stale.map((r) => r.id) } },
      })
    }
  }

  if (!APPLY) {
    console.log('\nDry run only — no writes made. Re-run with --apply to merge + delete.')
  } else {
    console.log(`\nMerged and deleted duplicates for ${duplicateGroups.length} user-days.`)
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
