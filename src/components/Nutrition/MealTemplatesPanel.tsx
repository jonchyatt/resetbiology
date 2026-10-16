"use client"

import { useEffect, useState } from 'react'
import { Copy, Edit3, Save, Star, Trash2, X } from 'lucide-react'
import { createFoodLogRequestId, getLocalDateTime } from '@/lib/nutrition/localEntry'

type Meal = { id: string; itemName: string; brand?: string | null; quantity: number; unit: string; gramWeight?: number | null; nutrients?: Record<string, number> | null; mealType?: string | null; notes?: string | null }
type Template = { id: string; name: string; ingredients: Meal; notes?: string | null; tags: string[]; favorite: boolean }

function inputClass() { return 'w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-secondary-400 focus:outline-none' }

export function MealTemplatesPanel() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [meals, setMeals] = useState<Meal[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMeal, setSelectedMeal] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Template | null>(null)
  const [repeat, setRepeat] = useState<Template | null>(null)
  const [repeatName, setRepeatName] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [templateResponse, mealResponse] = await Promise.all([
        fetch('/api/nutrition/templates', { cache: 'no-store' }),
        fetch('/api/foods/recent?limit=100', { cache: 'no-store' }),
      ])
      const templateData = await templateResponse.json()
      const mealData = await mealResponse.json()
      if (!templateResponse.ok || !templateData.ok) throw new Error(templateData.error || 'Unable to load templates')
      setTemplates(templateData.templates || [])
      setMeals(mealData.ok ? mealData.items || [] : [])
    } catch (e: any) { setError(e?.message || 'Unable to load meal templates') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const createTemplate = async () => {
    if (!name.trim() || !selectedMeal) return setError('Choose a personal meal and name the template.')
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/nutrition/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, sourceMealId: selectedMeal }) })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.error || 'Unable to save template')
      setName(''); setSelectedMeal(''); await load()
    } catch (e: any) { setError(e?.message || 'Unable to save template') } finally { setBusy(false) }
  }

  const saveEdit = async () => {
    if (!editing) return
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/nutrition/templates/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: editing.name, notes: editing.notes || '', tags: editing.tags, ingredients: editing.ingredients }) })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.error || 'Unable to edit template')
      setEditing(null); await load()
    } catch (e: any) { setError(e?.message || 'Unable to edit template') } finally { setBusy(false) }
  }

  const repeatTemplate = async () => {
    if (!repeat) return
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/nutrition/templates/${repeat.id}/repeat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: createFoodLogRequestId(), itemName: repeatName.trim() || repeat.ingredients.itemName, localDate: getLocalDateTime().localDate }) })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.error || 'Unable to repeat template')
      setRepeat(null); setRepeatName(''); await load()
    } catch (e: any) { setError(e?.message || 'Unable to repeat template') } finally { setBusy(false) }
  }

  const toggleFavorite = async (template: Template) => {
    await fetch(`/api/nutrition/templates/${template.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ favorite: !template.favorite }) }); await load()
  }
  const deleteTemplate = async (template: Template) => {
    if (!window.confirm(`Delete “${template.name}”? Existing meal history stays.`)) return
    await fetch(`/api/nutrition/templates/${template.id}`, { method: 'DELETE' }); await load()
  }

  return <section className="mb-8 rounded-xl border border-secondary-400/30 bg-gray-900/70 p-5 shadow-xl" aria-labelledby="meal-templates-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 id="meal-templates-title" className="text-xl font-bold text-white">My meal templates</h3><p className="mt-1 text-sm text-gray-300">Save your own meals for a truthful one-tap repeat. Nothing is suggested.</p></div>
    </div>
    {error && <p role="alert" className="mt-3 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>}
    <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
      <select aria-label="Meal to save as template" value={selectedMeal} onChange={e => setSelectedMeal(e.target.value)} className={inputClass()}><option value="">Choose a meal you entered…</option>{meals.map(meal => <option key={meal.id} value={meal.id}>{meal.itemName} · {meal.mealType || 'meal'}</option>)}</select>
      <input aria-label="New template name" value={name} onChange={e => setName(e.target.value)} className={inputClass()} placeholder="Template name" />
      <button disabled={busy || loading} onClick={createTemplate} className="rounded-lg bg-secondary-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save template</button>
    </div>
    {loading ? <p className="mt-5 text-sm text-gray-400">Loading your templates…</p> : templates.length === 0 ? <p className="mt-5 text-sm text-gray-400">No templates yet. Log a meal, then save it here.</p> : <div className="mt-5 grid gap-3 md:grid-cols-2">
      {templates.map(template => <article key={template.id} className="rounded-lg border border-gray-700 bg-gray-800/70 p-4">
        <div className="flex items-start justify-between gap-3"><div><h4 className="font-semibold text-white">{template.name}</h4><p className="text-sm text-gray-300">{template.ingredients.itemName}</p>{template.tags?.length ? <p className="mt-1 text-xs text-gray-400">{template.tags.join(' · ')}</p> : null}</div><button aria-label={template.favorite ? 'Unfavorite template' : 'Favorite template'} onClick={() => toggleFavorite(template)} className="text-yellow-300"><Star className="h-5 w-5" fill={template.favorite ? 'currentColor' : 'none'} /></button></div>
        <div className="mt-3 flex flex-wrap gap-2"><button onClick={() => { setRepeat(template); setRepeatName(template.ingredients.itemName) }} className="inline-flex items-center gap-1 rounded-md bg-secondary-500 px-3 py-2 text-xs font-semibold text-white"><Copy className="h-3.5 w-3.5" />Repeat meal</button><button onClick={() => setEditing({ ...template, ingredients: { ...template.ingredients } })} className="inline-flex items-center gap-1 rounded-md border border-gray-600 px-3 py-2 text-xs text-gray-200"><Edit3 className="h-3.5 w-3.5" />Edit</button><button onClick={() => deleteTemplate(template)} className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 px-3 py-2 text-xs text-rose-200"><Trash2 className="h-3.5 w-3.5" />Delete</button></div>
      </article>)}
    </div>}
    {editing && <div className="mt-4 rounded-lg border border-secondary-400/30 bg-gray-950/70 p-4"><div className="flex justify-between"><h4 className="font-semibold text-white">Edit template</h4><button onClick={() => setEditing(null)}><X className="h-4 w-4 text-gray-300" /></button></div><div className="mt-3 grid gap-3 md:grid-cols-2"><input aria-label="Template name" className={inputClass()} value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /><input aria-label="Template tags" className={inputClass()} value={(editing.tags || []).join(', ')} onChange={e => setEditing({ ...editing, tags: e.target.value.split(',').map(v => v.trim()).filter(Boolean) })} /><input aria-label="Ingredients" className={inputClass()} value={editing.ingredients.itemName} onChange={e => setEditing({ ...editing, ingredients: { ...editing.ingredients, itemName: e.target.value } })} /><textarea aria-label="Template notes" className={inputClass()} value={editing.notes || ''} onChange={e => setEditing({ ...editing, notes: e.target.value })} placeholder="Notes" /></div><button disabled={busy} onClick={saveEdit} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-secondary-500 px-3 py-2 text-sm font-semibold text-white"><Save className="h-4 w-4" />Save changes</button></div>}
    {repeat && <div className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-950/30 p-4"><div className="flex justify-between"><h4 className="font-semibold text-white">Repeat “{repeat.name}”</h4><button onClick={() => setRepeat(null)}><X className="h-4 w-4 text-gray-300" /></button></div><p className="mt-1 text-sm text-gray-300">This creates a new dated meal record; the template and source meal stay unchanged.</p><input aria-label="Repeated meal name" className={`${inputClass()} mt-3`} value={repeatName} onChange={e => setRepeatName(e.target.value)} /><button disabled={busy} onClick={repeatTemplate} className="mt-3 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Add to today</button></div>}
  </section>
}
