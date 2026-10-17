"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Droplets, Pencil, Plus, Trash2 } from "lucide-react"
import { getLocalDateTime } from "@/lib/nutrition/localEntry"

type Entry = { id: string; drinkName: string; amount: number; unit: string; amountMl: number; localTime: string }
type Props = { compact?: boolean; title?: string }

export function HydrationTracker({ compact = false, title = "Hydration log" }: Props) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [totalMl, setTotalMl] = useState(0)
  const [targetMl, setTargetMl] = useState<number | null>(null)
  const [amount, setAmount] = useState('250')
  const [unit, setUnit] = useState<'ml' | 'fl-oz'>('ml')
  const [drinkName, setDrinkName] = useState('Water')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [recent, setRecent] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)
  const localDate = getLocalDateTime().localDate

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/hydration?localDate=${localDate}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to load hydration')
      setEntries(data.entries || []); setTotalMl(data.totalMl || 0); setTargetMl(data.targetMl)
      setRecent(Array.from(new Set((data.entries || []).map((entry: Entry) => entry.amountMl))).slice(-4).reverse() as number[])
    } catch (err: any) { setError(err.message || 'Unable to load hydration') }
  }, [localDate])

  useEffect(() => { load() }, [load])
  const displayTotal = useMemo(() => `${totalMl.toLocaleString()} mL`, [totalMl])
  const save = async () => {
    setError(null)
    const response = await fetch('/api/hydration', { method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingId, amount: Number(amount), unit, drinkName, localDate, localTime: getLocalDateTime().localTime, requestId: editingId || crypto.randomUUID() }) })
    const data = await response.json()
    if (!response.ok) { setError(data.error || 'Unable to save hydration'); return }
    setEditingId(null); setAmount('250'); setDrinkName('Water'); await load()
  }
  const remove = async (id: string) => { setError(null); const response = await fetch(`/api/hydration/${id}`, { method: 'DELETE' }); if (!response.ok) setError('Unable to remove entry'); await load() }
  const edit = (entry: Entry) => { setEditingId(entry.id); setAmount(String(entry.amount)); setUnit(entry.unit as 'ml' | 'fl-oz'); setDrinkName(entry.drinkName) }
  const saveTarget = async () => { const value = Number(window.prompt('Your personal target in mL (optional):', String(targetMl || ''))); if (!Number.isFinite(value) || value <= 0) return; const response = await fetch('/api/hydration', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetMl: Math.round(value) }) }); if (response.ok) setTargetMl(Math.round(value)) }

  return <section className={`rounded-2xl border border-cyan-400/30 bg-slate-900/70 p-5 text-slate-100 shadow-xl ${compact ? '' : 'mb-8'}`} aria-label={title}>
    <div className="flex items-start justify-between gap-4"><div><h3 className="flex items-center gap-2 text-xl font-semibold"><Droplets className="h-5 w-5 text-cyan-300" />{title}</h3><p className="mt-1 text-sm text-slate-300">Private self-observation. No recommended target or health claim.</p></div><div className="text-right"><div className="text-2xl font-bold text-cyan-200">{displayTotal}</div>{targetMl && <div className="text-xs text-slate-400">of your {targetMl.toLocaleString()} mL target</div>}</div></div>
    <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_110px_1fr_auto]"><input aria-label="Amount" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2" /><select aria-label="Unit" value={unit} onChange={e => setUnit(e.target.value as 'ml' | 'fl-oz')} className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2"><option value="ml">mL</option><option value="fl-oz">fl oz</option></select><input aria-label="Drink name" value={drinkName} onChange={e => setDrinkName(e.target.value)} className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2" placeholder="Water or your drink name" /><button onClick={save} className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 font-semibold hover:bg-cyan-500"><Plus className="h-4 w-4" />{editingId ? 'Save' : 'Add'}</button></div>
    {recent.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-2 text-sm"><span className="text-slate-400">Recent:</span>{recent.map(value => <button key={value} onClick={() => { setAmount(String(value)); setUnit('ml') }} className="rounded-full border border-cyan-400/30 px-3 py-1 text-cyan-200 hover:bg-cyan-500/20">{value} mL</button>)}</div>}
    {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
    <div className="mt-4 space-y-2">{entries.map(entry => <div key={entry.id} className="flex items-center justify-between rounded-lg bg-slate-800/70 px-3 py-2"><div><span className="font-medium">{entry.drinkName}</span><span className="ml-2 text-slate-300">{entry.amount} {entry.unit}</span><span className="ml-2 text-xs text-slate-500">{entry.localTime}</span></div><div className="flex gap-2"><button aria-label={`Edit ${entry.drinkName}`} onClick={() => edit(entry)} className="text-cyan-300"><Pencil className="h-4 w-4" /></button><button aria-label={`Remove ${entry.drinkName}`} onClick={() => remove(entry.id)} className="text-rose-300"><Trash2 className="h-4 w-4" /></button></div></div>)}</div>
    <button onClick={saveTarget} className="mt-4 text-sm text-cyan-200 underline underline-offset-2">{targetMl ? 'Edit your personal target' : 'Set an optional personal target'}</button>
  </section>
}
