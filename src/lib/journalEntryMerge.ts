// `JournalEntry.entry` is a String column holding JSON (prisma/schema.prisma:426).
// The PATCH route (app/api/journal/entry/[id]/route.ts) used to spread that
// string as if it were already an object, then write the resulting object
// back into a String column — Prisma rejected it and every reflection edit
// 500'd (F1.1). Pulled out to a plain lib file (Next.js route.ts files may
// only export HTTP method handlers) so the exact merge logic is unit
// testable — see tests/journal-entry-patch.test.ts.

const ENTRY_JSON_FIELDS = [
  'reasonsValidation',
  'affirmationGoal',
  'affirmationBecause',
  'affirmationMeans',
  'peptideNotes',
  'workoutNotes',
  'nutritionNotes',
  'breathNotes',
  'moduleNotes',
] as const

export function hasEntryJsonChanges(data: Record<string, unknown>): boolean {
  return ENTRY_JSON_FIELDS.some((field) => data[field] !== undefined)
}

/** Parse, merge, re-stringify — never returns anything but a JSON string. */
export function mergeJournalEntryJson(currentEntryJson: string | null | undefined, changes: Record<string, unknown>): string {
  let currentEntry: Record<string, unknown> = {}
  try {
    currentEntry = currentEntryJson ? JSON.parse(currentEntryJson) : {}
  } catch {
    currentEntry = {}
  }

  const merged: Record<string, unknown> = { ...currentEntry }
  for (const field of ENTRY_JSON_FIELDS) {
    if (changes[field] !== undefined) merged[field] = changes[field]
  }

  return JSON.stringify(merged)
}
