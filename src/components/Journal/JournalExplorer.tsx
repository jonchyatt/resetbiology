"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Bookmark, Pencil, Plus, Search, Trash2, X } from "lucide-react"
import { MoodEnergyTimeline } from "@/components/Journal/MoodEnergyTimeline"

type JournalRecord = { id: string; title: string; body: string; tags: string[]; localDate: string; isPinned: boolean; updatedAt: string }
type Activity = { id: string; kind: string; localDate: string; label: string; href: string }

const emptyForm = { title: "", body: "", localDate: new Date().toISOString().slice(0, 10), tags: "" }

export function JournalExplorer() {
  const [records, setRecords] = useState<JournalRecord[]>([])
  const [activity, setActivity] = useState<Activity[]>([])
  const [allTags, setAllTags] = useState<string[]>([])
  const [query, setQuery] = useState("")
  const [tag, setTag] = useState("")
  const [type, setType] = useState("all")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState<JournalRecord | null>(null)
  const [renameFrom, setRenameFrom] = useState("")
  const [renameTo, setRenameTo] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  const load = async () => {
    const params = new URLSearchParams({ q: query, tag, type })
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    const response = await fetch(`/api/journal/explorer?${params}`, { cache: "no-store" })
    if (!response.ok) throw new Error("Could not load your journal")
    const data = await response.json()
    setRecords(data.records || [])
    setActivity(data.activity || [])
    setAllTags(data.allTags || [])
  }

  useEffect(() => { load().catch(error => setMessage(error.message)) }, [query, tag, type, from, to])

  const groupedActivity = useMemo(() => activity.reduce<Record<string, Activity[]>>((groups, item) => {
    ;(groups[item.localDate] ||= []).push(item)
    return groups
  }, {}), [activity])

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!form.title.trim() || !form.body.trim()) return
    setBusy(true); setMessage("")
    try {
      const payload = { title: form.title, body: form.body, localDate: form.localDate, tags: form.tags.split(","), ...(editing ? {} : { clientKey: crypto.randomUUID() }) }
      const response = await fetch(editing ? `/api/journal/explorer/${editing.id}` : "/api/journal/explorer", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      if (!response.ok) throw new Error("Could not save journal entry")
      setForm(emptyForm); setEditing(null); await load(); setMessage("Saved")
    } catch (error: any) { setMessage(error.message) } finally { setBusy(false) }
  }

  async function togglePin(record: JournalRecord) {
    await fetch(`/api/journal/explorer/${record.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPinned: !record.isPinned }) })
    await load()
  }

  async function remove(record: JournalRecord) {
    if (!window.confirm("Delete this journal entry? This cannot be undone.")) return
    await fetch(`/api/journal/explorer/${record.id}`, { method: "DELETE" }); await load()
  }

  async function renameTag(event: FormEvent) {
    event.preventDefault(); if (!renameFrom.trim() || !renameTo.trim()) return
    const response = await fetch("/api/journal/explorer/tags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ from: renameFrom, to: renameTo }) })
    const data = await response.json(); setMessage(response.ok ? `Renamed ${data.renamed} entries` : data.error); setRenameFrom(""); setRenameTo(""); await load()
  }

  return <main className="min-h-screen bg-slate-950 px-4 py-24 text-slate-100 sm:px-8">
    <div className="mx-auto max-w-6xl space-y-6">
      <MoodEnergyTimeline />
      <header><p className="text-xs uppercase tracking-[.3em] text-cyan-300">Private history</p><h1 className="mt-2 text-3xl font-bold sm:text-5xl">Daily Journal</h1><p className="mt-3 max-w-2xl text-slate-300">Search and organize your own notes alongside the meals, peptides, and hypnosis records you actually logged. This page does not diagnose, interpret, or generate treatment advice.</p></header>

      <section className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 md:grid-cols-5">
        <label className="md:col-span-2"><span className="sr-only">Search</span><div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3"><Search className="h-4 w-4 text-slate-400" /><input aria-label="Search journal" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search your words or activity" className="w-full bg-transparent py-2 outline-none" /></div></label>
        <select aria-label="Filter by type" value={type} onChange={e => setType(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"><option value="all">All records</option><option value="journal">Journal notes</option><option value="meal">Meals</option><option value="peptide">Peptides</option><option value="hypnosis">Hypnosis</option></select>
        <select aria-label="Filter by tag" value={tag} onChange={e => setTag(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"><option value="">All tags</option>{allTags.map(item => <option key={item} value={item}>{item}</option>)}</select>
        <div className="flex gap-2"><input aria-label="From date" type="date" value={from} onChange={e => setFrom(e.target.value)} className="min-w-0 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2" /><input aria-label="To date" type="date" value={to} onChange={e => setTo(e.target.value)} className="min-w-0 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2" /></div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[360px,1fr]">
        <form onSubmit={save} className="space-y-3 rounded-2xl border border-cyan-500/30 bg-slate-900/80 p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{editing ? "Edit note" : "New note"}</h2>{editing && <button type="button" onClick={() => { setEditing(null); setForm(emptyForm) }} aria-label="Cancel edit"><X className="h-4 w-4" /></button>}</div><input required aria-label="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Title" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" /><textarea required aria-label="Journal body" value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} placeholder="What happened?" rows={7} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" /><input required aria-label="Journal date" type="date" value={form.localDate} onChange={e => setForm({ ...form, localDate: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" /><input aria-label="Tags" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="Tags, comma separated" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" /><button disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50"><Plus className="h-4 w-4" />{editing ? "Save changes" : "Save note"}</button>{message && <p role="status" className="text-sm text-cyan-200">{message}</p>}</form>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Your notes <span className="text-sm text-slate-400">({records.length})</span></h2><form onSubmit={renameTag} className="flex gap-2"><input aria-label="Rename tag from" value={renameFrom} onChange={e => setRenameFrom(e.target.value)} placeholder="old tag" className="w-24 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm" /><input aria-label="Rename tag to" value={renameTo} onChange={e => setRenameTo(e.target.value)} placeholder="new tag" className="w-24 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm" /><button className="rounded border border-slate-700 px-2 py-1 text-sm">Rename</button></form></div>
          {records.length === 0 && activity.length === 0 && <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-400">No matching records. Try a different filter or write your first note.</div>}
          {records.map(record => <article key={record.id} className="rounded-xl border border-slate-800 bg-slate-900/80 p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{record.title}</h3>{record.isPinned && <span className="text-xs text-amber-300">Pinned</span>}</div><p className="mt-1 text-xs text-slate-400">{record.localDate} · {record.tags.map(item => `#${item}`).join(" ") || "untagged"}</p></div><div className="flex gap-2"><button aria-label={`Pin ${record.title}`} onClick={() => togglePin(record)} className="rounded p-1 text-amber-300"><Bookmark className="h-4 w-4" fill={record.isPinned ? "currentColor" : "none"} /></button><button aria-label={`Edit ${record.title}`} onClick={() => { setEditing(record); setForm({ title: record.title, body: record.body, localDate: record.localDate, tags: record.tags.join(", ") }) }} className="rounded p-1 text-cyan-300"><Pencil className="h-4 w-4" /></button><button aria-label={`Delete ${record.title}`} onClick={() => remove(record)} className="rounded p-1 text-rose-300"><Trash2 className="h-4 w-4" /></button></div></div><p className="mt-3 whitespace-pre-wrap text-slate-200">{record.body}</p>{groupedActivity[record.localDate]?.length > 0 && <div className="mt-4 border-t border-slate-800 pt-3"><p className="text-xs uppercase tracking-wide text-slate-500">Actual records from this day</p><div className="mt-2 flex flex-wrap gap-2">{groupedActivity[record.localDate].map(item => <Link key={item.id} href={item.href} className="rounded-full border border-slate-700 px-3 py-1 text-sm text-cyan-200 hover:border-cyan-400">{item.label} · {item.kind}</Link>)}</div></div>}</article>)}
          {activity.filter(item => !records.some(record => record.localDate === item.localDate)).map(item => <article key={`${item.kind}-${item.id}`} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Linked activity · {item.localDate}</p><Link href={item.href} className="mt-2 inline-block text-cyan-200 hover:underline">{item.label} · {item.kind}</Link></article>)}
        </div>
      </section>
      <p className="text-xs text-slate-500">Links point only to records that still exist for this user. If an activity is deleted, it disappears from the explorer; it is never recreated or replaced with an inference.</p>
    </div>
  </main>
}
