#!/usr/bin/env node
// Weekly tally of first-party analytics events from exported host logs.
// Spec: docs/ANALYTICS-LOOP.md. Reads files or stdin, prints a markdown table.
// No network, no database, no third-party script: the only input is log text you already exported.
import { readFileSync } from "node:fs"

// Events the site is allowed to log. Anything else is counted as skipped, not tallied.
export const KNOWN_EVENTS = { store_click: "sellerKey", tool_view: "slug" }

function parseCandidate(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

// A log line may be bare JSON, a host wrapper with a "message" string, or text before the JSON.
export function extractEvent(line) {
  const trimmed = line.trim()
  if (!trimmed) return null
  let obj = parseCandidate(trimmed)
  if (obj && typeof obj.message === "string" && !obj.event) obj = parseCandidate(obj.message) || extractFromText(obj.message)
  if (!obj) obj = extractFromText(trimmed)
  if (!obj || typeof obj !== "object" || typeof obj.event !== "string") return null
  return obj
}

function extractFromText(text) {
  const i = text.indexOf('{"event"')
  return i < 0 ? null : parseCandidate(text.slice(i))
}

// Monday (UTC) of the week containing the ISO timestamp, as YYYY-MM-DD.
export function weekStart(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const day = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - day)
  return d.toISOString().slice(0, 10)
}

export function tallyLines(lines) {
  const counts = new Map()
  let skipped = 0
  for (const line of lines) {
    if (!line.trim()) continue
    const e = extractEvent(line)
    const keyField = e && KNOWN_EVENTS[e.event]
    const week = e && weekStart(e.at)
    const key = keyField && typeof e[keyField] === "string" ? e[keyField] : null
    if (!e || !keyField || !week || !key) {
      skipped++
      continue
    }
    const id = [week, e.event, key].join("\u0000")
    counts.set(id, (counts.get(id) || 0) + 1)
  }
  const rows = [...counts.entries()]
    .map(([id, count]) => {
      const [week, event, key] = id.split("\u0000")
      return { week, event, key, count }
    })
    .sort((a, b) => b.week.localeCompare(a.week) || a.event.localeCompare(b.event) || b.count - a.count || a.key.localeCompare(b.key))
  return { rows, skipped }
}

const cell = (s) => String(s).replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ")

export function renderMarkdown({ rows, skipped }) {
  const out = ["| Week (Mon, UTC) | Event | Key | Count |", "|---|---|---|---|"]
  for (const r of rows) out.push(`| ${r.week} | ${r.event} | ${cell(r.key)} | ${r.count} |`)
  if (!rows.length) out.push("| none | | | 0 |")
  out.push("", `Lines skipped (not a known event, or missing time or key): ${skipped}`)
  return out.join("\n") + "\n"
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = process.argv.slice(2)
  const text = files.length ? files.map((f) => readFileSync(f, "utf8")).join("\n") : readFileSync(0, "utf8")
  process.stdout.write(renderMarkdown(tallyLines(text.split(/\r?\n/))))
}
