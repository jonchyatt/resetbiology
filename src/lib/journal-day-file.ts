// Journal day-file truth format (Phase C, ticket cf-c2-journal-inversion).
//
// The .md file IS truth for the journal domain (D-C1) — hand-edits to it are
// honored. To make that safe with MULTIPLE same-day entries (HIGH-2: last-
// write-wins collapse is data loss, ruled out), a day file is a single
// document holding one YAML front-matter block (schemaVersion, date, and a
// flat per-entry list carrying rowId/createdAt/mood/weight) plus one body
// section per entry holding only its free-text content. Front matter is
// structural truth for mood/weight/date/createdAt/rowId; body sections are
// truth for content. No YAML library — front-matter scalar values are
// JSON-encoded (YAML is a superset of JSON scalars), so a hand-rolled
// line parser round-trips unicode/quotes/colons without a dependency.
//
// formatJournalDayFile: rows -> day-file string (never drops a row).
// parseJournalDayFile: day-file string -> structured entries (never throws).

export interface JournalDayRow {
  rowId: string
  createdAt: Date
  content: string
  mood?: string | null
  weight?: number | null
}

export interface ParsedJournalEntry {
  date: string | null
  mood: string | null
  weight: number | null
  content: string | null
  createdAt: string | null
  rowId: string | null
  parseDegraded?: true
}

const SCHEMA_VERSION = 1
const FRONT_MATTER_DELIM = '---'
const ENTRY_MARKER_PREFIX = '<!-- entry:'

/**
 * The exact HTML-comment marker a row's section is delimited by in the
 * emitted day file. Exported so callers (e.g. the migration harness's
 * reversal map) can prove a given rowId's content is actually locatable in
 * a specific file's bytes, not just structurally declared.
 */
export function journalEntryMarker(rowId: string): string {
  // JSON-encode rowId inside the marker so a rowId containing "-->" or other
  // odd characters still round-trips (defensive; Mongo ObjectIds never do).
  return `${ENTRY_MARKER_PREFIX}${JSON.stringify(rowId)} -->`
}

function yamlScalar(value: unknown): string {
  return JSON.stringify(value ?? null)
}

function formatEntryBody(row: JournalDayRow): string {
  const time = row.createdAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  let section = `${journalEntryMarker(row.rowId)}\n## Entry (${time})\n`
  if (row.content) {
    section += `${row.content}\n`
  }
  return section
}

/**
 * Emit a multi-entry day file. `rows` may be any length >= 1; every row is
 * preserved as its own section (deterministic createdAt-ascending order) —
 * NO entry is ever dropped, even when several rows share the same date.
 */
export function formatJournalDayFile(date: string, rows: JournalDayRow[]): string {
  const sorted = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

  const entryLines = sorted.map((row) => {
    return [
      `  - rowId: ${yamlScalar(row.rowId)}`,
      `    createdAt: ${yamlScalar(row.createdAt.toISOString())}`,
      `    mood: ${yamlScalar(row.mood ?? null)}`,
      `    weight: ${yamlScalar(row.weight ?? null)}`,
    ].join('\n')
  })

  const frontMatter = [
    FRONT_MATTER_DELIM,
    `schemaVersion: ${SCHEMA_VERSION}`,
    `date: ${yamlScalar(date)}`,
    `entries:`,
    ...entryLines,
    FRONT_MATTER_DELIM,
  ].join('\n')

  const heading = sorted.length > 1
    ? `# Journal — ${date} (${sorted.length} entries)\n\n`
    : `# Journal — ${date}\n\n`

  const bodySections = sorted.map(formatEntryBody).join('\n---\n\n')

  return `${frontMatter}\n\n${heading}${bodySections}\n`
}

// ---------------------------------------------------------------------------
// Parser — tolerant, never throws.
// ---------------------------------------------------------------------------

interface ParsedFrontMatterEntry {
  rowId: string | null
  createdAt: string | null
  mood: string | null
  weight: number | null
}

interface ParsedFrontMatter {
  schemaVersion: number | null
  date: string | null
  entries: ParsedFrontMatterEntry[]
}

function tryParseScalar(raw: string): unknown {
  const trimmed = raw.trim()
  if (trimmed === '') return undefined
  try {
    return JSON.parse(trimmed)
  } catch {
    // Hand-edited value that isn't valid JSON (e.g. an unquoted string) —
    // fall back to the raw trimmed text rather than failing.
    return trimmed
  }
}

/** Splits raw text into { frontMatter, body }. Returns null frontMatter text if the file has none/broken delimiters. */
function splitFrontMatter(raw: string): { frontMatterText: string | null; body: string } {
  if (!raw.startsWith(FRONT_MATTER_DELIM)) {
    return { frontMatterText: null, body: raw }
  }
  const rest = raw.slice(FRONT_MATTER_DELIM.length)
  const closeIdx = rest.indexOf(`\n${FRONT_MATTER_DELIM}`)
  if (closeIdx === -1) {
    return { frontMatterText: null, body: raw }
  }
  const frontMatterText = rest.slice(0, closeIdx).replace(/^\n/, '')
  const body = rest.slice(closeIdx + `\n${FRONT_MATTER_DELIM}`.length).replace(/^\n+/, '')
  return { frontMatterText, body }
}

function parseFrontMatter(text: string): ParsedFrontMatter | null {
  try {
    const lines = text.split('\n')
    let schemaVersion: number | null = null
    let date: string | null = null
    const entries: ParsedFrontMatterEntry[] = []
    let current: ParsedFrontMatterEntry | null = null

    for (const line of lines) {
      const listItemMatch = line.match(/^\s*-\s+(\w+):\s*(.*)$/)
      const fieldMatch = line.match(/^\s*(\w+):\s*(.*)$/)

      if (listItemMatch) {
        // Starts a new entry object.
        if (current) entries.push(current)
        current = { rowId: null, createdAt: null, mood: null, weight: null }
        const [, key, value] = listItemMatch
        applyField(current, key, tryParseScalar(value))
        continue
      }

      if (!fieldMatch) continue
      const [, key, value] = fieldMatch

      if (key === 'entries') continue // header line, list items follow
      if (current && (line.startsWith('    ') || line.startsWith('\t'))) {
        // Indented continuation of the current entry object.
        applyField(current, key, tryParseScalar(value))
        continue
      }
      // Top-level scalar.
      if (key === 'schemaVersion') {
        const v = tryParseScalar(value)
        schemaVersion = typeof v === 'number' ? v : null
      } else if (key === 'date') {
        const v = tryParseScalar(value)
        date = typeof v === 'string' ? v : null
      }
    }
    if (current) entries.push(current)

    if (schemaVersion === null || date === null) {
      // Front matter present but missing the required keys — treat as broken.
      return null
    }
    return { schemaVersion, date, entries }
  } catch {
    return null
  }
}

function applyField(entry: ParsedFrontMatterEntry, key: string, value: unknown) {
  if (key === 'rowId') entry.rowId = typeof value === 'string' ? value : null
  else if (key === 'createdAt') entry.createdAt = typeof value === 'string' ? value : null
  else if (key === 'mood') entry.mood = typeof value === 'string' ? value : null
  else if (key === 'weight') entry.weight = typeof value === 'number' ? value : null
}

/** Locates the body section for a given rowId's marker; null if not found (hand-deleted section). */
function findSectionContent(body: string, rowId: string): string | null {
  const marker = journalEntryMarker(rowId)
  const idx = body.indexOf(marker)
  if (idx === -1) return null
  const afterMarker = body.slice(idx + marker.length)
  const nextMarkerIdx = afterMarker.indexOf(ENTRY_MARKER_PREFIX)
  const section = nextMarkerIdx === -1 ? afterMarker : afterMarker.slice(0, nextMarkerIdx)
  // Strip the leading "## Entry (...)" heading line, keep the rest as content.
  const withoutHeading = section.replace(/^\s*##\s*Entry[^\n]*\n/, '')
  // Strip a trailing "---" section divider if present.
  return withoutHeading.replace(/\n-{3,}\s*$/, '').trim()
}

/**
 * Parse a day-file string back into structured entries. NEVER throws — any
 * input that isn't our well-formed format degrades to a single body-only
 * entry with null structural fields and parseDegraded: true.
 */
export function parseJournalDayFile(raw: string): ParsedJournalEntry[] {
  try {
    const { frontMatterText, body } = splitFrontMatter(raw)
    const fm = frontMatterText !== null ? parseFrontMatter(frontMatterText) : null

    if (!fm) {
      return [
        {
          date: null,
          mood: null,
          weight: null,
          content: raw.trim() || null,
          createdAt: null,
          rowId: null,
          parseDegraded: true,
        },
      ]
    }

    if (fm.entries.length === 0) {
      // Front matter parsed but carries no entries — degrade the body as a
      // single unattributed entry rather than returning nothing (no entry is
      // ever silently dropped).
      return [
        {
          date: fm.date,
          mood: null,
          weight: null,
          content: body.replace(/^#[^\n]*\n+/, '').trim() || null,
          createdAt: null,
          rowId: null,
          parseDegraded: true,
        },
      ]
    }

    return fm.entries.map((entry) => ({
      date: fm.date,
      mood: entry.mood,
      weight: entry.weight,
      content: entry.rowId ? findSectionContent(body, entry.rowId) : null,
      createdAt: entry.createdAt,
      rowId: entry.rowId,
    }))
  } catch {
    // Belt-and-suspenders — parseFrontMatter/findSectionContent already
    // catch internally, but a day file must never throw regardless of cause.
    return [
      {
        date: null,
        mood: null,
        weight: null,
        content: raw.trim() || null,
        createdAt: null,
        rowId: null,
        parseDegraded: true,
      },
    ]
  }
}

// ---------------------------------------------------------------------------
// Self-test (no deps, no DB, no Drive) — run via:
//   npx tsx src/lib/journal-day-file.ts self-test
// ---------------------------------------------------------------------------
function runSelfTest(): boolean {
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

  check('single entry round-trips content/mood/weight/createdAt/rowId', () => {
    const row: JournalDayRow = {
      rowId: 'row-1',
      createdAt: new Date('2026-07-18T08:00:00.000Z'),
      content: 'Slept well, feeling good.',
      mood: 'good',
      weight: 180.5,
    }
    const file = formatJournalDayFile('2026-07-18', [row])
    const parsed = parseJournalDayFile(file)
    assert.equal(parsed.length, 1)
    assert.equal(parsed[0].content, row.content)
    assert.equal(parsed[0].mood, 'good')
    assert.equal(parsed[0].weight, 180.5)
    assert.equal(parsed[0].createdAt, row.createdAt.toISOString())
    assert.equal(parsed[0].rowId, 'row-1')
    assert.equal(parsed[0].date, '2026-07-18')
    assert.equal(parsed[0].parseDegraded, undefined)
  })

  check('2+ same-day rows: every row recovered, none dropped, createdAt-ascending order', () => {
    const rows: JournalDayRow[] = [
      { rowId: 'r2', createdAt: new Date('2026-07-18T18:00:00.000Z'), content: 'Evening entry', mood: 'tired', weight: null },
      { rowId: 'r1', createdAt: new Date('2026-07-18T07:00:00.000Z'), content: 'Morning entry', mood: 'good', weight: 179 },
      { rowId: 'r3', createdAt: new Date('2026-07-18T12:30:00.000Z'), content: 'Midday check-in', mood: null, weight: null },
    ]
    const file = formatJournalDayFile('2026-07-18', rows)
    const parsed = parseJournalDayFile(file)
    assert.equal(parsed.length, 3)
    // createdAt-ascending: r1 07:00 -> r3 12:30 -> r2 18:00.
    assert.deepEqual(parsed.map((p) => p.rowId), ['r1', 'r3', 'r2'])
    assert.equal(parsed[0].content, 'Morning entry')
    assert.equal(parsed[1].content, 'Midday check-in')
    assert.equal(parsed[2].content, 'Evening entry')
    assert.equal(parsed[1].mood, null)
    assert.equal(parsed[1].weight, null)
  })

  check('unicode content and mood round-trip exactly', () => {
    const row: JournalDayRow = {
      rowId: 'row-u',
      createdAt: new Date('2026-07-18T09:00:00.000Z'),
      content: 'Journaling in 日本語, emoji 🎉, quotes "like this" and a colon: yes.',
      mood: '😊 optimistic',
      weight: 72.3,
    }
    const file = formatJournalDayFile('2026-07-18', [row])
    const parsed = parseJournalDayFile(file)
    assert.equal(parsed[0].content, row.content)
    assert.equal(parsed[0].mood, row.mood)
  })

  check('empty content entry round-trips as empty/null, not dropped', () => {
    const rows: JournalDayRow[] = [
      { rowId: 'r-empty', createdAt: new Date('2026-07-18T10:00:00.000Z'), content: '', mood: 'blank', weight: null },
      { rowId: 'r-other', createdAt: new Date('2026-07-18T11:00:00.000Z'), content: 'has content', mood: null, weight: null },
    ]
    const file = formatJournalDayFile('2026-07-18', rows)
    const parsed = parseJournalDayFile(file)
    assert.equal(parsed.length, 2)
    // Empty string content collapses to '' (falsy) in the section — parser
    // returns '' trimmed to '' which is falsy, so we accept either '' or null.
    assert.ok(parsed[0].content === '' || parsed[0].content === null)
    assert.equal(parsed[0].mood, 'blank')
    assert.equal(parsed[1].content, 'has content')
  })

  check('hand-mangled file (front matter deleted) degrades to single body-only entry, never throws', () => {
    const mangled = '# Journal — 2026-07-18\n\nSomeone deleted the front matter and just left this text.\n'
    let parsed: ParsedJournalEntry[] = []
    assert.doesNotThrow(() => {
      parsed = parseJournalDayFile(mangled)
    })
    assert.equal(parsed.length, 1)
    assert.equal(parsed[0].parseDegraded, true)
    assert.equal(parsed[0].date, null)
    assert.equal(parsed[0].mood, null)
    assert.equal(parsed[0].rowId, null)
    assert.ok(parsed[0].content?.includes('Someone deleted the front matter'))
  })

  check('garbage/empty/random string input never throws', () => {
    const inputs = ['', 'not a journal file at all', '---\nbroken: [unterminated', '{}', ' binary-ish']
    for (const input of inputs) {
      assert.doesNotThrow(() => parseJournalDayFile(input))
      const parsed = parseJournalDayFile(input)
      assert.ok(Array.isArray(parsed) && parsed.length >= 1)
    }
  })

  check('UTC/DST filename-derivation matrix (MED-2): canonical key is UTC ISO date, immune to process-local timezone', () => {
    // Canonical key ruling (D-C5, plan-2026-07-18-9fe3): filename date comes
    // from `date.toISOString().split('T')[0]` — always the UTC calendar
    // date of the instant, regardless of what local timezone the process
    // happens to be running in. Proven by re-deriving the same instant's
    // filename date under several different process.env.TZ values.
    const cases: Array<{ label: string; iso: string; expectedDateStr: string }> = [
      { label: 'UTC midnight', iso: '2026-01-01T00:00:00.000Z', expectedDateStr: '2026-01-01' },
      { label: '23:59 UTC (late-day boundary)', iso: '2026-01-01T23:59:00.000Z', expectedDateStr: '2026-01-01' },
      { label: 'US-Mountain local midnight, winter (MST UTC-7), stored as UTC', iso: '2026-01-15T07:00:00.000Z', expectedDateStr: '2026-01-15' },
      { label: 'US-Mountain local midnight, summer (MDT UTC-6), stored as UTC', iso: '2026-07-15T06:00:00.000Z', expectedDateStr: '2026-07-15' },
      { label: 'US DST spring-forward day (2026-03-08)', iso: '2026-03-08T09:00:00.000Z', expectedDateStr: '2026-03-08' },
      { label: 'US DST fall-back day (2026-11-01)', iso: '2026-11-01T09:00:00.000Z', expectedDateStr: '2026-11-01' },
    ]
    const tzsToTry = ['UTC', 'America/Denver', 'Pacific/Kiritimati', 'Pacific/Niue']
    const originalTz = process.env.TZ
    try {
      const matrixReport: string[] = []
      for (const c of cases) {
        const filenameDatesByTz = tzsToTry.map((tz) => {
          process.env.TZ = tz
          const dateStr = new Date(c.iso).toISOString().split('T')[0]
          return { tz, dateStr }
        })
        const distinct = new Set(filenameDatesByTz.map((r) => r.dateStr))
        matrixReport.push(
          `    ${c.label}: ${c.iso} -> ${[...distinct].join(', ')} (stable across ${tzsToTry.join('/')})`
        )
        assert.equal(distinct.size, 1, `${c.label}: filename date diverged across timezones: ${JSON.stringify(filenameDatesByTz)}`)
        assert.equal([...distinct][0], c.expectedDateStr, `${c.label}: expected ${c.expectedDateStr}`)
      }
      results.push(...matrixReport)
    } finally {
      if (originalTz === undefined) delete process.env.TZ
      else process.env.TZ = originalTz
    }
  })

  check('front matter present but entries list empty degrades gracefully, does not throw', () => {
    const noEntries = '---\nschemaVersion: 1\ndate: "2026-07-18"\nentries:\n---\n\nsome stray body text\n'
    let parsed: ParsedJournalEntry[] = []
    assert.doesNotThrow(() => {
      parsed = parseJournalDayFile(noEntries)
    })
    assert.equal(parsed.length, 1)
    assert.equal(parsed[0].parseDegraded, true)
    assert.equal(parsed[0].date, '2026-07-18')
  })

  console.log(results.join('\n'))
  console.log(pass ? `\nSELF-TEST: ALL PASS (${results.length}/${results.length})` : `\nSELF-TEST: FAILURES PRESENT`)
  return pass
}

if (require.main === module) {
  const command = process.argv[2]
  if (command === 'self-test') {
    const ok = runSelfTest()
    process.exitCode = ok ? 0 : 1
  } else {
    console.error(`Usage: npx tsx src/lib/journal-day-file.ts self-test`)
    process.exitCode = 1
  }
}
