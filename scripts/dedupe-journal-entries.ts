// Report-only inspection of the duplicate JournalEntry rows NEW-2
// accumulated: app/api/nback/sessions/route.ts used to unconditionally
// `create` a new row per >=80%-accuracy session instead of merging into the
// day's existing entry (fixed in the same ratchet step as this script — see
// app/api/nback/sessions/route.ts). Existing duplicate rows from before
// that fix can be inspected here.
//
// This script NEVER writes to the database. It has no --apply, no merge,
// and no delete path — see [[journalWeightTruth]] (src/lib/journalWeightTruth.ts)
// for why: picking a "canonical" row by createdAt desc silently discarded
// conflicting weight/mood readings instead of surfacing the conflict.
//
// Day provenance is member-local and can ONLY come from the writer-captured
// `localDate` field inside the JSON blob. Rows without a valid explicit
// localDate are never assigned a fabricated day (no UTC/server-local/
// derived-from-`date` fallback) — they are reported individually as
// unknown_day candidates instead.
//
// Usage:
//   npx tsx scripts/dedupe-journal-entries.ts   (reports resolver classifications only)

import { resolveJournalWeight, type JournalWeightCandidate } from '../src/lib/journalWeightTruth'
import { isValidDayKey } from '../src/lib/localDay'

if (process.argv.includes('--apply')) {
  console.error('--apply is permanently removed from this script. It only reports classifications and never writes.')
  process.exit(1)
}

function dayKeyForEntry(entry: { entry: string | null }): string | null {
  try {
    const parsed = entry.entry ? JSON.parse(entry.entry) : {}
    if (isValidDayKey(parsed?.localDate)) {
      return parsed.localDate
    }
  } catch {
    // fall through to null — malformed JSON is unknown provenance, not a reason to guess
  }
  return null
}

function unitForEntry(entry: { entry: string | null }): 'lb' | 'kg' | null {
  try {
    const parsed = entry.entry ? JSON.parse(entry.entry) : {}
    return parsed?.weightUnit === 'lb' || parsed?.weightUnit === 'kg' ? parsed.weightUnit : null
  } catch {
    return null
  }
}

async function main() {
  const { prisma } = await import('../src/lib/prisma')

  const allEntries = await prisma.journalEntry.findMany({
    orderBy: { createdAt: 'asc' },
  })

  type Entry = (typeof allEntries)[number]

  const knownDayGroups = new Map<string, Entry[]>()
  const unknownDayRows: Entry[] = []

  for (const entry of allEntries) {
    const dayKey = dayKeyForEntry(entry)
    if (dayKey === null) {
      unknownDayRows.push(entry)
      continue
    }
    const key = `${entry.userId}::${dayKey}`
    const bucket = knownDayGroups.get(key) ?? []
    bucket.push(entry)
    knownDayGroups.set(key, bucket)
  }

  const duplicateGroups = [...knownDayGroups.entries()].filter(([, rows]) => rows.length > 1)

  console.log(`Scanned ${allEntries.length} journal entries across ${knownDayGroups.size} known user-days.`)
  console.log(`Found ${duplicateGroups.length} user-days with duplicate rows and ${unknownDayRows.length} unknown-day row(s).`)

  function toCandidate(entry: Entry): JournalWeightCandidate {
    return {
      id: entry.id,
      createdAt: entry.createdAt,
      dayKey: dayKeyForEntry(entry),
      weight: entry.weight ?? null,
      unit: unitForEntry(entry),
      mood: entry.mood ?? null,
    }
  }

  function report(label: string, rows: Entry[]) {
    const resolution = resolveJournalWeight(rows.map(toCandidate))
    console.log(
      `\n[${label}] ${rows.length} row(s) -> status: ${resolution.status}, sourceIds: ${resolution.sourceIds.join(', ')}` +
        (resolution.normalizedKg !== null ? `, normalizedKg: ${resolution.normalizedKg}` : '')
    )
  }

  for (const [key, rows] of duplicateGroups) {
    report(key, rows)
  }

  // Each unknown-day row is its own candidate — never lumped with other
  // unknown-day rows just because they share a userId.
  for (const entry of unknownDayRows) {
    report(`${entry.userId}::unknown_day::${entry.id}`, [entry])
  }

  console.log('\nReport only — this script never writes and has no --apply path.')

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
