"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Pencil, Printer, Trash2, Download, Plus, X } from "lucide-react"

type Entry = { id: string; clientKey: string; mood: number; energy: number; note: string | null; tags: string[]; localDate: string; recordedAt: string }
type Marker = { id: string; kind: string; localDate: string; label: string; href: string }

const today = () => new Date().toLocaleDateString("en-CA")
const blank = () => ({ mood: "5", energy: "5", note: "", localDate: today(), recordedAt: new Date().toISOString().slice(0, 16), tags: "" })

function csvCell(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"` }
function average(entries: Entry[], field: "mood" | "energy") { return entries.length ? entries.reduce((sum, entry) => sum + entry[field], 0) / entries.length : 0 }

export function MoodEnergyTimeline() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [markers, setMarkers] = useState<Marker[]>([])
  const [tag, setTag] = useState("")
  const [periodMode, setPeriodMode] = useState<"day" | "week" | "month">("month")
  const [from, setFrom] = useState(() => { const date = new Date(); date.setDate(1); return date.toLocaleDateString("en-CA") })
  const [to, setTo] = useState(today)
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState<Entry | null>(null)
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const params = new URLSearchParams({ from, to })
    if (tag) params.set("tag", tag)
    const [timelineResponse, activityResponse] = await Promise.all([
      fetch(`/api/journal/mood-energy?${params}`, { cache: "no-store" }),
      fetch(`/api/journal/explorer?from=${from}&to=${to}`, { cache: "no-store" }),
    ])
    if (!timelineResponse.ok) throw new Error("Could not load mood and energy")
    const timeline = await timelineResponse.json()
    const activity = activityResponse.ok ? await activityResponse.json() : { activity: [] }
    setEntries(timeline.entries || [])
    setMarkers(activity.activity || [])
  }
  useEffect(() => { load().catch(error => setMessage(error.message)) }, [from, to, tag])

  const allTags = useMemo(() => [...new Set(entries.flatMap(entry => entry.tags))].sort(), [entries])
  const periods = useMemo(() => {
    const grouped = new Map<string, Entry[]>()
    for (const entry of entries) {
      const date = new Date(`${entry.localDate}T12:00:00`)
      const key = periodMode === "day" ? entry.localDate : periodMode === "month" ? entry.localDate.slice(0, 7) : (() => { const start = new Date(date); start.setDate(date.getDate() - date.getDay()); return start.toLocaleDateString("en-CA") })()
      grouped.set(key, [...(grouped.get(key) || []), entry])
    }
    return [...grouped].sort(([a], [b]) => a.localeCompare(b)).map(([label, items]) => ({ label, items, mood: average(items, "mood"), energy: average(items, "energy") }))
  }, [entries, periodMode])

  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("")
    const payload = { mood: Number(form.mood), energy: Number(form.energy), note: form.note, localDate: form.localDate, recordedAt: new Date(form.recordedAt).toISOString(), tags: form.tags.split(","), ...(editing ? {} : { clientKey: crypto.randomUUID() }) }
    try {
      const response = await fetch(editing ? `/api/journal/mood-energy/${editing.id}` : "/api/journal/mood-energy", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not save entry")
      setForm(blank()); setEditing(null); await load(); setMessage(data.duplicate ? "Already saved; no duplicate point added." : "Saved")
    } catch (error: any) { setMessage(error.message) } finally { setBusy(false) }
  }
  async function remove(entry: Entry) {
    if (!window.confirm("Delete this user-entered point?")) return
    const response = await fetch(`/api/journal/mood-energy/${entry.id}`, { method: "DELETE" })
    if (!response.ok) setMessage("Could not delete point"); else await load()
  }
  function exportCsv() {
    const header = ["local_date", "recorded_at", "mood_1_to_10", "energy_1_to_10", "note", "tags"]
    const rows = entries.map(entry => [entry.localDate, entry.recordedAt, entry.mood, entry.energy, entry.note, entry.tags.join(" | ")])
    const blob = new Blob([[header, ...rows].map(row => row.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "reset-biology-mood-energy.csv"; link.click(); URL.revokeObjectURL(url)
  }

  return <section className="mood-energy-timeline rounded-2xl border border-violet-400/30 bg-slate-900/90 p-5 text-slate-100 shadow-xl print:bg-white print:text-black">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[.25em] text-violet-300 print:text-violet-700">Private self-observation</p><h2 className="mt-1 text-2xl font-bold">Mood and energy timeline</h2><p className="mt-2 max-w-2xl text-sm text-slate-300 print:text-slate-700">Your entered 1–10 values, local dates, notes, and tags. Neutral markers are links to records you logged; this view does not infer causes, treatment effects, or diagnoses, and does not diagnose.</p></div><div className="flex gap-2 print:hidden"><button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm"><Download className="h-4 w-4" />Export CSV</button><button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm"><Printer className="h-4 w-4" />Print summary</button></div></div>
    <div className="mt-5 grid gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 md:grid-cols-5 print:hidden"><label>From<input aria-label="Timeline from" type="date" value={from} onChange={e => setFrom(e.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2" /></label><label>To<input aria-label="Timeline to" type="date" value={to} onChange={e => setTo(e.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2" /></label><label>Tag<select aria-label="Timeline tag" value={tag} onChange={e => setTag(e.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2"><option value="">All tags</option>{allTags.map(item => <option key={item}>{item}</option>)}</select></label><label>Chart grouping<select aria-label="Chart grouping" value={periodMode} onChange={e => setPeriodMode(e.target.value as typeof periodMode)} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2"><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option></select></label><div className="self-end text-sm text-slate-300">Visible retained records: <strong>{entries.length}</strong></div></div>
    <form onSubmit={save} className="mt-5 grid gap-3 rounded-xl border border-violet-400/20 bg-violet-950/20 p-4 md:grid-cols-6 print:hidden"><label>Mood (1–10)<input required min="1" max="10" type="number" value={form.mood} onChange={e => setForm({ ...form, mood: e.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2" /></label><label>Energy (1–10)<input required min="1" max="10" type="number" value={form.energy} onChange={e => setForm({ ...form, energy: e.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2" /></label><label>Local date<input required type="date" value={form.localDate} onChange={e => setForm({ ...form, localDate: e.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2" /></label><label>Local time<input required type="datetime-local" value={form.recordedAt} onChange={e => setForm({ ...form, recordedAt: e.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2" /></label><label className="md:col-span-2">Tags<input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="sleep, travel" className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2" /></label><label className="md:col-span-5">Optional note<textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} rows={2} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2" /></label><div className="flex items-end gap-2"><button disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-violet-400 px-3 py-2 font-semibold text-slate-950 disabled:opacity-50"><Plus className="h-4 w-4" />{editing ? "Save edit" : "Add point"}</button>{editing && <button type="button" onClick={() => { setEditing(null); setForm(blank()) }} aria-label="Cancel edit" className="rounded-lg border border-slate-700 p-2"><X className="h-4 w-4" /></button>}</div></form>
    {message && <p role="status" className="mt-3 text-sm text-violet-200 print:text-violet-700">{message}</p>}
    <div className="mt-6 grid gap-4 md:grid-cols-3 print:grid-cols-3">{periods.map(period => <div key={period.label} className="rounded-xl border border-slate-800 p-3"><p className="text-xs uppercase text-slate-400">{period.label}</p><div className="mt-3 space-y-2 text-sm">{([["Mood", period.mood], ["Energy", period.energy]] as const).map(([label, value]) => <div key={label}><div className="flex justify-between"><span>{label}</span><strong>{value.toFixed(1)}/10</strong></div><div className="h-2 rounded bg-slate-800"><div className="h-2 rounded bg-violet-400" style={{ width: `${value * 10}%` }} /></div></div>)}</div></div>)}</div>
    <div className="mt-6 space-y-2">{entries.length === 0 && <p className="rounded-xl border border-dashed border-slate-700 p-5 text-sm text-slate-400">No retained points match this date and tag filter.</p>}{entries.map(entry => <article key={entry.id} className="rounded-xl border border-slate-800 p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{entry.localDate} · mood {entry.mood}/10 · energy {entry.energy}/10</p><p className="text-xs text-slate-400">{new Date(entry.recordedAt).toLocaleString()} · {entry.tags.map(item => `#${item}`).join(" ") || "untagged"}</p>{entry.note && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200 print:text-slate-800">{entry.note}</p>}</div><div className="flex gap-2 print:hidden"><button aria-label={`Edit mood and energy ${entry.localDate}`} onClick={() => { setEditing(entry); setForm({ mood: String(entry.mood), energy: String(entry.energy), note: entry.note || "", localDate: entry.localDate, recordedAt: new Date(entry.recordedAt).toISOString().slice(0, 16), tags: entry.tags.join(", ") }) }}><Pencil className="h-4 w-4" /></button><button aria-label={`Delete mood and energy ${entry.localDate}`} onClick={() => remove(entry)}><Trash2 className="h-4 w-4 text-rose-300" /></button></div></div></article>)}</div>
    <div className="mt-6 border-t border-slate-800 pt-4 print:hidden"><p className="text-xs uppercase tracking-wide text-slate-500">Neutral event markers in this date range</p><div className="mt-2 flex flex-wrap gap-2">{markers.map(marker => <Link key={`${marker.kind}-${marker.id}`} href={marker.href} className="rounded-full border border-slate-700 px-3 py-1 text-sm text-cyan-200">{marker.localDate} · {marker.label} · {marker.kind}</Link>)}{markers.length === 0 && <span className="text-sm text-slate-500">No linked records retained in this range; deleted records are not recreated.</span>}</div></div>
  </section>
}
