"use client"

import { useEffect, useMemo, useState } from "react"
import { Archive, Edit3, Heart, Plus, Save, Utensils, X } from "lucide-react"

type Ingredient = { name: string; quantity: string; unit: string; notes: string; nutrients: { kcal: string; protein_g: string; carb_g: string; fat_g: string } }
type Recipe = { id: string; name: string; notes: string | null; servings: number; ingredients: Array<{ name: string; quantity: number; unit: string; notes?: string | null; nutrients: Record<string, number> }>; totals: Record<string, number>; favorite: boolean; archived: boolean }

const blankIngredient = (): Ingredient => ({ name: "", quantity: "1", unit: "serving", notes: "", nutrients: { kcal: "0", protein_g: "0", carb_g: "0", fat_g: "0" } })
const blankRecipe = () => ({ name: "", notes: "", servings: "1", ingredients: [blankIngredient()] })

export function RecipeBuilder() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [form, setForm] = useState(blankRecipe())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  const totals = useMemo(() => form.ingredients.reduce((sum, item) => ({
    kcal: sum.kcal + (Number(item.nutrients.kcal) || 0), protein_g: sum.protein_g + (Number(item.nutrients.protein_g) || 0), carb_g: sum.carb_g + (Number(item.nutrients.carb_g) || 0), fat_g: sum.fat_g + (Number(item.nutrients.fat_g) || 0),
  }), { kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0 }), [form.ingredients])

  const load = async () => { const response = await fetch('/api/nutrition/recipes', { cache: 'no-store' }); const data = await response.json(); if (response.ok) setRecipes(data.recipes || []) }
  useEffect(() => { load().catch(() => setMessage('Recipes could not be loaded.')) }, [])

  const updateIngredient = (index: number, field: string, value: string) => setForm(current => ({ ...current, ingredients: current.ingredients.map((item, itemIndex) => itemIndex === index ? (field.startsWith('nutrients.') ? { ...item, nutrients: { ...item.nutrients, [field.slice(10)]: value } } : { ...item, [field]: value }) : item) }))
  const reset = () => { setForm(blankRecipe()); setEditingId(null) }
  const save = async () => {
    setLoading(true); setMessage('')
    const payload = { name: form.name, notes: form.notes, servings: Number(form.servings), ingredients: form.ingredients.map(item => ({ ...item, quantity: Number(item.quantity), nutrients: Object.fromEntries(Object.entries(item.nutrients).map(([key, value]) => [key, Number(value)])) })) }
    try { const response = await fetch(editingId ? `/api/nutrition/recipes/${editingId}` : '/api/nutrition/recipes', { method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); await load(); reset(); setMessage('Recipe saved.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Recipe could not be saved.') } finally { setLoading(false) }
  }
  const edit = (recipe: Recipe) => {
    setForm({ name: recipe.name, notes: recipe.notes || '', servings: String(recipe.servings), ingredients: recipe.ingredients.map(item => ({ name: item.name, quantity: String(item.quantity), unit: item.unit, notes: item.notes || '', nutrients: { kcal: String(item.nutrients.kcal || 0), protein_g: String(item.nutrients.protein_g || 0), carb_g: String(item.nutrients.carb_g || 0), fat_g: String(item.nutrients.fat_g || 0) } })) })
    setEditingId(recipe.id)
  }
  const patch = async (id: string, values: Record<string, unknown>) => { await fetch(`/api/nutrition/recipes/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) }); await load() }
  const log = async (recipe: Recipe) => {
    const servings = window.prompt(`How many servings of ${recipe.name} did you record?`, '1')
    const amount = Number(servings)
    if (!Number.isFinite(amount) || amount <= 0) return
    const storageKey = `rb-recipe-log:${recipe.id}:${amount}`
    const clientRequestId = sessionStorage.getItem(storageKey) || crypto.randomUUID()
    sessionStorage.setItem(storageKey, clientRequestId)
    const response = await fetch(`/api/nutrition/recipes/${recipe.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ servings: amount, clientRequestId }) })
    const data = await response.json()
    if (response.ok) sessionStorage.removeItem(storageKey)
    setMessage(response.ok ? `Meal recorded${data.duplicate ? ' (already recorded)' : ''}.` : data.error || 'Meal could not be recorded.')
  }

  return <section className="container mx-auto mb-10 px-4" aria-labelledby="recipe-builder-title">
    <div className="rounded-2xl border border-secondary-400/30 bg-gray-900/80 p-5 shadow-xl backdrop-blur">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h3 id="recipe-builder-title" className="text-2xl font-bold text-white">My recipes</h3><p className="mt-1 max-w-2xl text-sm text-gray-300">Create private recipes from your own food records. Totals are arithmetic from the quantities you enter; they are not targets or recommendations.</p></div><button className="rounded-lg border border-white/20 px-3 py-2 text-sm text-white" onClick={reset}><Plus size={16} className="mr-1 inline" /> New recipe</button></div>
      {message && <p role="status" className="mb-3 rounded-lg bg-secondary-500/20 px-3 py-2 text-sm text-secondary-100">{message}</p>}
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4"><h4 className="mb-3 font-semibold text-white">{editingId ? 'Edit recipe' : 'New recipe'}</h4><label className="mb-3 block text-sm text-gray-300">Name<input className="mt-1 w-full rounded-lg bg-gray-800 px-3 py-2 text-white" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label><div className="grid grid-cols-2 gap-3"><label className="text-sm text-gray-300">Servings<input type="number" min="0.01" step="0.01" className="mt-1 w-full rounded-lg bg-gray-800 px-3 py-2 text-white" value={form.servings} onChange={e => setForm({ ...form, servings: e.target.value })} /></label><label className="text-sm text-gray-300">Notes<input className="mt-1 w-full rounded-lg bg-gray-800 px-3 py-2 text-white" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label></div>
          <div className="mt-4 space-y-3">{form.ingredients.map((item, index) => <div key={index} className="rounded-lg border border-white/10 p-3"><div className="mb-2 flex justify-between"><span className="text-xs uppercase tracking-wide text-gray-400">Ingredient {index + 1}</span>{form.ingredients.length > 1 && <button aria-label="Remove ingredient" onClick={() => setForm({ ...form, ingredients: form.ingredients.filter((_, i) => i !== index) })}><X size={15} className="text-gray-400" /></button>}</div><div className="grid grid-cols-2 gap-2"><input aria-label="Ingredient name" placeholder="Food name" className="rounded bg-gray-800 px-2 py-2 text-sm text-white" value={item.name} onChange={e => updateIngredient(index, 'name', e.target.value)} /><input aria-label="Ingredient notes" placeholder="Notes" className="rounded bg-gray-800 px-2 py-2 text-sm text-white" value={item.notes} onChange={e => updateIngredient(index, 'notes', e.target.value)} /><input aria-label="Ingredient quantity" type="number" min="0.01" step="0.01" className="rounded bg-gray-800 px-2 py-2 text-sm text-white" value={item.quantity} onChange={e => updateIngredient(index, 'quantity', e.target.value)} /><input aria-label="Ingredient unit" placeholder="unit" className="rounded bg-gray-800 px-2 py-2 text-sm text-white" value={item.unit} onChange={e => updateIngredient(index, 'unit', e.target.value)} /></div><div className="mt-2 grid grid-cols-4 gap-2">{(['kcal', 'protein_g', 'carb_g', 'fat_g'] as const).map(key => <label key={key} className="text-[11px] text-gray-400">{key.replace('_g', '')}<input aria-label={`${key} per ingredient`} type="number" min="0" step="0.01" className="mt-1 w-full rounded bg-gray-800 px-2 py-1 text-xs text-white" value={item.nutrients[key]} onChange={e => updateIngredient(index, `nutrients.${key}`, e.target.value)} /></label>)}</div></div>)}</div><button className="mt-3 text-sm text-secondary-300" onClick={() => setForm({ ...form, ingredients: [...form.ingredients, blankIngredient()] })}><Plus size={15} className="mr-1 inline" /> Add ingredient</button><div className="mt-4 rounded-lg bg-gray-800/70 p-3 text-sm text-gray-200">Recipe totals: {Math.round(totals.kcal * 100) / 100} kcal · {Math.round(totals.protein_g * 100) / 100}g protein · {Math.round(totals.carb_g * 100) / 100}g carbs · {Math.round(totals.fat_g * 100) / 100}g fat</div><button disabled={loading} className="mt-4 rounded-lg bg-secondary-500 px-4 py-2 font-semibold text-white disabled:opacity-50" onClick={save}><Save size={16} className="mr-1 inline" /> {loading ? 'Saving…' : 'Save recipe'}</button></div>
        <div className="space-y-3">{recipes.filter(recipe => !recipe.archived).map(recipe => <article key={recipe.id} className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="flex items-start justify-between gap-3"><div><h4 className="font-semibold text-white">{recipe.name} {recipe.favorite && <Heart size={15} className="inline fill-current text-pink-300" />}</h4><p className="text-sm text-gray-400">{recipe.servings} servings · {Number(recipe.totals?.kcal || 0)} kcal total</p></div><div className="flex gap-1"><button aria-label="Favorite recipe" onClick={() => patch(recipe.id, { favorite: !recipe.favorite })}><Heart size={17} className={recipe.favorite ? 'fill-pink-300 text-pink-300' : 'text-gray-400'} /></button><button aria-label="Edit recipe" onClick={() => { edit(recipe); setEditingId(recipe.id) }}><Edit3 size={17} className="text-gray-400" /></button><button aria-label="Archive recipe" onClick={() => patch(recipe.id, { archived: true })}><Archive size={17} className="text-gray-400" /></button></div></div><p className="mt-2 text-xs text-gray-400">{recipe.ingredients.map(item => `${item.quantity} ${item.unit} ${item.name}`).join(' · ')}</p><button className="mt-3 rounded-lg border border-secondary-300/50 px-3 py-2 text-sm text-secondary-100" onClick={() => log(recipe)}><Utensils size={15} className="mr-1 inline" /> Log servings</button></article>)}{recipes.filter(recipe => !recipe.archived).length === 0 && <p className="rounded-lg border border-dashed border-white/20 p-6 text-center text-sm text-gray-400">No recipes yet. Add one from your own ingredients.</p>}</div>
      </div>
    </div>
  </section>
}
