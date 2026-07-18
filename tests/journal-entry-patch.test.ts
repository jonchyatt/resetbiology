import { mergeJournalEntryJson, hasEntryJsonChanges } from '../src/lib/journalEntryMerge'

// F1.1 regression harness: `JournalEntry.entry` is a String column holding
// JSON. Before the fix, the PATCH route spread that string directly
// (`existingEntry.entry as any || {}`) instead of JSON.parse-ing it first,
// producing per-character garbage and a 500 on every reflection edit. This
// exercises the exact merge function the route now calls, following the
// tests/timezone-notification-check.ts idiom (no server, no live DB).

type Scenario = {
  label: string
  seeded: string | null
  changes: Record<string, unknown>
  expected: Record<string, unknown>
}

const scenarios: Scenario[] = [
  {
    label: 'PATCH a seeded entry\'s reflection text merges, does not clobber siblings',
    seeded: JSON.stringify({
      reasonsValidation: 'old reflection',
      affirmationGoal: 'stay consistent',
      peptideNotes: 'dose logged at 8am',
    }),
    changes: { reasonsValidation: 'new reflection after edit' },
    expected: {
      reasonsValidation: 'new reflection after edit',
      affirmationGoal: 'stay consistent',
      peptideNotes: 'dose logged at 8am',
    },
  },
  {
    label: 'multiple fields in one PATCH all merge',
    seeded: JSON.stringify({ reasonsValidation: 'old' }),
    changes: { affirmationBecause: 'because I said so', affirmationMeans: 'and that means growth' },
    expected: {
      reasonsValidation: 'old',
      affirmationBecause: 'because I said so',
      affirmationMeans: 'and that means growth',
    },
  },
  {
    label: 'null/legacy seeded entry (no row yet) still produces valid JSON',
    seeded: null,
    changes: { reasonsValidation: 'first ever edit' },
    expected: { reasonsValidation: 'first ever edit' },
  },
  {
    label: 'corrupt seeded JSON does not throw — merge starts fresh',
    seeded: 'not valid json {{{',
    changes: { moduleNotes: 'module note' },
    expected: { moduleNotes: 'module note' },
  },
]

let failed = false

for (const scenario of scenarios) {
  try {
    const resultJson = mergeJournalEntryJson(scenario.seeded, scenario.changes)

    // The bug this regresses: the old code assigned an OBJECT to
    // updateData.entry (a String column) and Prisma threw before this
    // point was ever reached. Asserting the result is a JSON *string* (not
    // "[object Object]", not a thrown exception) is the 200-vs-500 proof.
    if (typeof resultJson !== 'string') {
      throw new Error(`expected a JSON string, got ${typeof resultJson}`)
    }

    const parsed = JSON.parse(resultJson) // must not throw
    for (const [key, value] of Object.entries(scenario.expected)) {
      if (parsed[key] !== value) {
        throw new Error(`field "${key}": expected ${JSON.stringify(value)}, got ${JSON.stringify(parsed[key])}`)
      }
    }

    console.log(`[PASS] ${scenario.label}`)
  } catch (err) {
    failed = true
    console.error(`[FAIL] ${scenario.label}:`, err instanceof Error ? err.message : err)
  }
}

// hasEntryJsonChanges gate: no entry-JSON fields present → route must skip
// touching `entry` entirely (mood/weight-only edits shouldn't rewrite it).
if (hasEntryJsonChanges({ mood: 'Great 😊', weight: 180 })) {
  failed = true
  console.error('[FAIL] hasEntryJsonChanges: mood/weight-only PATCH incorrectly flagged as an entry-JSON change')
} else {
  console.log('[PASS] hasEntryJsonChanges: mood/weight-only PATCH correctly skips entry merge')
}

if (!hasEntryJsonChanges({ reasonsValidation: 'x' })) {
  failed = true
  console.error('[FAIL] hasEntryJsonChanges: reasonsValidation change not detected')
} else {
  console.log('[PASS] hasEntryJsonChanges: reasonsValidation change detected')
}

if (failed) {
  process.exitCode = 1
  console.error('\nOne or more journal-entry-patch scenarios failed.')
} else {
  console.log('\nAll journal-entry-patch scenarios passed.')
}
