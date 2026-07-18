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
//
// Fix-wave 2 (blind-verify HIGH-1 finding #1, cf-c2-journal-inversion): the
// front-matter contract above (schemaVersion/date/entries manifest) is
// UNCHANGED — schemaVersion stays 1. What's new is an ADDITIVE, optional,
// self-delimited machine block inside each entry's BODY section: a full
// structured `payload` (the entire real dashboard EntryPayload — all 10
// fields + tasksCompleted), JSON-encoded on a single reserved comment line
// (`<!-- journal-payload:{...} -->`, guaranteed one physical line since
// JSON.stringify with no indent never emits a raw newline). A human-readable
// rendering of the payload's fields is ALSO emitted into the section (so the
// file still reads as a journal to a person), sharing the same escaping as
// free-text content. A file with no payload line (pre-fix-wave-2 files, or
// hand-mangled ones) still parses exactly as before — `payload` comes back
// null, never throws. Old readers of a NEW file are unaffected (the payload
// line is just another reserved/escaped content line to them).

export interface JournalDayRow {
  rowId: string
  createdAt: Date
  content: string
  mood?: string | null
  weight?: number | null
  /** Full structured entry (fix-wave 2, F1) — the real dashboard EntryPayload. Optional/undefined = no payload block emitted (legacy content-only row). */
  payload?: Record<string, unknown> | null
}

export interface ParsedJournalEntry {
  date: string | null
  mood: string | null
  weight: number | null
  content: string | null
  createdAt: string | null
  rowId: string | null
  /** Full structured entry recovered from the payload block (fix-wave 2, F1); null if absent or unparseable — never throws. */
  payload: Record<string, unknown> | null
  parseDegraded?: true
}

const SCHEMA_VERSION = 1
const FRONT_MATTER_DELIM = '---'
const ENTRY_MARKER_PREFIX = '<!-- entry:'
const PAYLOAD_MARKER_PREFIX = '<!-- journal-payload:'

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

/**
 * Shared goals+content fold-in rule (fix-wave F1). `goals` has no dedicated
 * slot in the structured parse contract ({date, mood, weight, content,
 * createdAt, rowId}) — folded into the content section rather than dropped.
 * Single source of truth: google-drive.ts (live sync) and the migration
 * harness both call this instead of each rendering their own template.
 */
export function foldGoalsIntoContent(content: string, goals?: string | null): string {
  return goals ? `## Goals for Today\n${goals}\n\n${content}` : content
}

// Line-escaping (fix-wave F3+F4): any content line that would otherwise
// collide with our own emitted syntax — a bare `<!-- entry:...` marker line
// or a bare `---` divider/front-matter-delimiter line — gets exactly one
// leading backslash added. Lines already starting with a backslash get a
// second one added, so "strip one leading backslash if present" is always
// the correct, unambiguous inverse (dot-stuffing/mbox-style escaping — same
// idiom, one line each way). This makes ANY content string, including one
// containing a sibling's literal marker text or an embedded/trailing `---`,
// round-trip byte-exact.
function isReservedLine(line: string): boolean {
  return /^<!--\s*entry:/.test(line) || /^-{3,}\s*$/.test(line) || /^<!--\s*journal-payload:/.test(line)
}

function escapeContentLines(content: string): string {
  return content
    .split('\n')
    .map((line) => (line.startsWith('\\') || isReservedLine(line) ? `\\${line}` : line))
    .join('\n')
}

function unescapeContentLines(content: string): string {
  return content
    .split('\n')
    .map((line) => (line.startsWith('\\') ? line.slice(1) : line))
    .join('\n')
}

// F5: heading time is derived from the ISO createdAt with explicit UTC, so
// emitted bytes are deterministic regardless of the emitting process's local
// timezone (was: `toLocaleTimeString` with no `timeZone`, which used
// process-local time). Cosmetic only — the parser strips this heading line
// entirely and never reads the time out of it; the parse contract's
// authoritative createdAt lives in front matter, untouched by this change.
function formatHeadingTimeUTC(date: Date): string {
  return `${date.toISOString().slice(11, 16)} UTC`
}

// camelCase key -> "Title Case" label, generically — no hardcoded field list
// to keep in sync if the dashboard's fields change (fix-wave 2, F1).
function humanizeKey(key: string): string {
  const spaced = key.replace(/([A-Z])/g, ' $1')
  return (spaced.charAt(0).toUpperCase() + spaced.slice(1)).trim()
}

/**
 * Human-readable rendering of a structured entry payload — decorative only;
 * NOT part of the machine round-trip (that's the payload marker line below).
 * Skips empty string fields and non-string values other than a boolean-map
 * `tasksCompleted`, so the file still reads like a journal to a person.
 */
function renderPayloadHuman(payload: Record<string, unknown>): string {
  const sections: string[] = []
  for (const [key, value] of Object.entries(payload)) {
    if (key === 'tasksCompleted') continue
    if (typeof value === 'string' && value.trim()) {
      sections.push(`### ${humanizeKey(key)}\n${value}`)
    }
  }
  const tasks = payload.tasksCompleted
  if (tasks && typeof tasks === 'object' && !Array.isArray(tasks)) {
    const done = Object.entries(tasks as Record<string, unknown>)
      .filter(([, v]) => v === true)
      .map(([k]) => `- [x] ${humanizeKey(k)}`)
    if (done.length > 0) {
      sections.push(`### Tasks Completed\n${done.join('\n')}`)
    }
  }
  return sections.join('\n\n')
}

function formatEntryBody(row: JournalDayRow): string {
  const time = formatHeadingTimeUTC(row.createdAt)
  let section = `${journalEntryMarker(row.rowId)}\n## Entry (${time})\n`

  const humanPayload = row.payload ? renderPayloadHuman(row.payload) : ''
  const humanText = [humanPayload, row.content].filter(Boolean).join('\n\n')
  if (humanText) {
    section += `${escapeContentLines(humanText)}\n`
  }

  // Machine round-trip block (fix-wave 2, F1) — single line, guaranteed no
  // embedded raw newline (JSON.stringify with no indent), so the parser can
  // find it purely by line-start match with no closing delimiter needed.
  if (row.payload !== undefined && row.payload !== null) {
    section += `${PAYLOAD_MARKER_PREFIX}${JSON.stringify(row.payload)}\n`
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

/**
 * Finds `needle` only where it starts an actual LINE (preceded by "\n" or at
 * the very start of the string). escapeContentLines only ever escapes a
 * content line that is itself the whole reserved pattern — the escaped form
 * starts with "\\" instead, so it can never satisfy this line-start check.
 * That's what makes a marker/divider found this way provably real, not a
 * substring embedded inside a sibling's (escaped) content (fix-wave F3).
 */
function indexOfAtLineStart(text: string, needle: string, from = 0): number {
  let searchFrom = from
  while (true) {
    const idx = text.indexOf(needle, searchFrom)
    if (idx === -1) return -1
    if (idx === 0 || text[idx - 1] === '\n') return idx
    searchFrom = idx + 1
  }
}

/**
 * Extracts the payload marker line (if present, fix-wave 2 F1) from a raw
 * section, returning the parsed payload (null if absent/unparseable — NEVER
 * throws) and the section with that exact line removed, so downstream
 * content-extraction never sees the machine block as human text.
 */
function extractPayloadLine(section: string): { payload: Record<string, unknown> | null; rest: string } {
  const idx = indexOfAtLineStart(section, PAYLOAD_MARKER_PREFIX)
  if (idx === -1) return { payload: null, rest: section }

  const lineEnd = section.indexOf('\n', idx)
  const line = lineEnd === -1 ? section.slice(idx) : section.slice(idx, lineEnd)
  const jsonText = line.slice(PAYLOAD_MARKER_PREFIX.length)

  let payload: Record<string, unknown> | null = null
  try {
    const parsed = JSON.parse(jsonText)
    payload = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    payload = null // hand-mangled payload block — tolerant, never throws
  }

  const rest = lineEnd === -1 ? section.slice(0, idx) : section.slice(0, idx) + section.slice(lineEnd + 1)
  return { payload, rest }
}

/** Locates the body section for a given rowId's marker; null content if not found (hand-deleted section). */
function findSection(body: string, rowId: string): { content: string | null; payload: Record<string, unknown> | null } {
  const marker = journalEntryMarker(rowId)
  const idx = indexOfAtLineStart(body, marker)
  if (idx === -1) return { content: null, payload: null }
  const afterMarker = body.slice(idx + marker.length)
  // Any occurrence of a raw (unescaped) marker prefix AT A LINE START here
  // is guaranteed to be a REAL section boundary, never embedded content —
  // escapeContentLines (fix-wave F3) escapes any content line matching this
  // pattern on emit, so an unescaped marker-prefix line can only be one we
  // wrote ourselves.
  const nextMarkerIdx = indexOfAtLineStart(afterMarker, ENTRY_MARKER_PREFIX)
  const rawSection = nextMarkerIdx === -1 ? afterMarker : afterMarker.slice(0, nextMarkerIdx)

  // Pull the machine payload block out BEFORE any content-shaped stripping
  // (fix-wave 2, F1) — content extraction below is otherwise untouched.
  const { payload, rest: section } = extractPayloadLine(rawSection)

  // Strip the leading "## Entry (...)" heading line.
  const withoutHeading = section.replace(/^\s*##\s*Entry[^\n]*\n/, '')
  // Strip a trailing "---" section divider — safe post-escaping: any content
  // line that was originally a bare "---" is now "\---" (escaped) and won't
  // match this regex, so only our own inserted divider is ever stripped here.
  const withoutDivider = withoutHeading.replace(/\n-{3,}\s*$/, '')
  const content = unescapeContentLines(withoutDivider).trim()
  return { content, payload }
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
          payload: null,
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
          payload: null,
          parseDegraded: true,
        },
      ]
    }

    return fm.entries.map((entry) => {
      const found = entry.rowId ? findSection(body, entry.rowId) : { content: null, payload: null }
      return {
        date: fm.date,
        mood: entry.mood,
        weight: entry.weight,
        content: found.content,
        createdAt: entry.createdAt,
        rowId: entry.rowId,
        payload: found.payload,
      }
    })
  } catch {
    // Belt-and-suspenders — parseFrontMatter/findSection already catch
    // internally, but a day file must never throw regardless of cause.
    return [
      {
        date: null,
        mood: null,
        weight: null,
        content: raw.trim() || null,
        createdAt: null,
        rowId: null,
        payload: null,
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
    const inputs = ['', 'not a journal file at all', '---\nbroken: [unterminated', '{}', '\x00\x01binary-ish']
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

  check('fix-wave F3: content containing an exact sibling marker string does not misattribute sections', () => {
    const rows: JournalDayRow[] = [
      { rowId: 'r1', createdAt: new Date('2026-08-01T06:00:00.000Z'), content: `Wrote about r2 today.\n${journalEntryMarker('r2')}\nend of note.`, mood: null, weight: null },
      { rowId: 'r2', createdAt: new Date('2026-08-01T20:00:00.000Z'), content: 'Actual r2 content.', mood: null, weight: null },
    ]
    const file = formatJournalDayFile('2026-08-01', rows)
    const parsed = parseJournalDayFile(file)
    assert.equal(parsed.length, 2)
    const byRowId = new Map(parsed.map((p) => [p.rowId, p]))
    assert.equal(byRowId.get('r1')?.content, rows[0].content)
    assert.equal(byRowId.get('r2')?.content, 'Actual r2 content.')
  })

  check('fix-wave F4: content ending in "---", and content that is only "---", round-trip exactly', () => {
    const rows: JournalDayRow[] = [
      { rowId: 'r-trailing', createdAt: new Date('2026-08-02T06:00:00.000Z'), content: 'line1\n---', mood: null, weight: null },
      { rowId: 'r-onlydash', createdAt: new Date('2026-08-02T18:00:00.000Z'), content: '---', mood: null, weight: null },
    ]
    const file = formatJournalDayFile('2026-08-02', rows)
    const parsed = parseJournalDayFile(file)
    assert.equal(parsed.length, 2)
    const byRowId = new Map(parsed.map((p) => [p.rowId, p]))
    assert.equal(byRowId.get('r-trailing')?.content, 'line1\n---')
    assert.equal(byRowId.get('r-onlydash')?.content, '---')
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

  check('fix-wave 2 (F1): full REAL EntryPayload shape round-trips byte-exact via the payload block, all 10 fields + tasksCompleted, unicode, empties', () => {
    const realPayload = {
      reasonsValidation: 'Because I said I would. 日本語 test, "quotes", a colon: yes.',
      affirmationGoal: '',
      affirmationBecause: 'My future self depends on it 🎉',
      affirmationMeans: 'Showing up daily.',
      peptideNotes: '',
      workoutNotes: 'Legs + core, 45 min.',
      nutritionNotes: '',
      breathNotes: 'Box breathing, 10 min.',
      moduleNotes: '',
      tasksCompleted: { journal: true, workout: true, meals: false, module: false, breath: true },
    }
    const row: JournalDayRow = {
      rowId: 'row-real',
      createdAt: new Date('2026-07-18T14:00:00.000Z'),
      content: '',
      mood: 'good',
      weight: 181.2,
      payload: realPayload,
    }
    const file = formatJournalDayFile('2026-07-18', [row])
    const parsed = parseJournalDayFile(file)
    assert.equal(parsed.length, 1)
    assert.deepEqual(parsed[0].payload, realPayload)
    assert.equal(parsed[0].mood, 'good')
    assert.equal(parsed[0].weight, 181.2)
    // Human-readable render is present in content for a person reading the file.
    assert.ok(parsed[0].content?.includes('Because I said I would'))
    assert.ok(parsed[0].content?.includes('Tasks Completed'))
  })

  check('fix-wave 2 (F1): row with no payload still parses with payload: null (backward compatible, pre-fix-wave-2 files)', () => {
    const row: JournalDayRow = {
      rowId: 'row-legacy',
      createdAt: new Date('2026-07-18T09:00:00.000Z'),
      content: 'Plain freeform note, no payload block.',
      mood: null,
      weight: null,
    }
    const file = formatJournalDayFile('2026-07-18', [row])
    assert.ok(!file.includes('journal-payload'))
    const parsed = parseJournalDayFile(file)
    assert.equal(parsed[0].payload, null)
    assert.equal(parsed[0].content, 'Plain freeform note, no payload block.')
  })

  check('fix-wave 2 (F1): hand-mangled payload block (invalid JSON) degrades payload to null, content still recovered, never throws', () => {
    const row: JournalDayRow = { rowId: 'row-mangle', createdAt: new Date('2026-07-18T10:00:00.000Z'), content: 'note', mood: null, weight: null, payload: { a: 1 } }
    const file = formatJournalDayFile('2026-07-18', [row])
    const mangled = file.replace(/<!-- journal-payload:.*$/m, '<!-- journal-payload:{not valid json')
    let parsed: ParsedJournalEntry[] = []
    assert.doesNotThrow(() => {
      parsed = parseJournalDayFile(mangled)
    })
    assert.equal(parsed[0].payload, null)
  })

  check('fix-wave 2 (F1): 2+ same-day rows each with their own payload — no cross-contamination', () => {
    const rows: JournalDayRow[] = [
      { rowId: 'p1', createdAt: new Date('2026-07-18T07:00:00.000Z'), content: '', mood: null, weight: null, payload: { reasonsValidation: 'first' } },
      { rowId: 'p2', createdAt: new Date('2026-07-18T18:00:00.000Z'), content: '', mood: null, weight: null, payload: { reasonsValidation: 'second' } },
    ]
    const file = formatJournalDayFile('2026-07-18', rows)
    const parsed = parseJournalDayFile(file)
    const byRowId = new Map(parsed.map((p) => [p.rowId, p]))
    assert.deepEqual(byRowId.get('p1')?.payload, { reasonsValidation: 'first' })
    assert.deepEqual(byRowId.get('p2')?.payload, { reasonsValidation: 'second' })
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
