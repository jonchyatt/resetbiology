"use client"
import { useMemo, useState } from "react"
import { X, Search, Plus, Sandwich } from "lucide-react"
import type { MealCategory } from "./MealLogger"

export interface FoodRecord {
  name: string
  brand?: string
  serving: string
  calories: number
  protein: number
  carbs: number
  fats: number
  tags?: string[]
}

export function FoodSearch({ foods, onAdd, onClose }: {
  foods: FoodRecord[]
  onAdd: (f: { name: string; serving: string; calories: number; protein: number; carbs: number; fats: number; category: MealCategory }) => void
  onClose: () => void
}) {
  const [q, setQ] = useState("")
  const [category, setCategory] = useState<MealCategory>('breakfast')
  const [multiplier, setMultiplier] = useState(1)

  const filtered = useMemo(() => {
    const needle = q.toLowerCase().trim()
    if (!needle) return foods.slice(0, 30)
    return foods.filter(f => (
      f.name.toLowerCase().includes(needle) ||
      (f.brand?.toLowerCase().includes(needle)) ||
      (f.tags?.some(t => t.toLowerCase().includes(needle)))
    )).slice(0, 50)
  }, [q, foods])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-gradient-to-br from-gray-800/90 to-gray-900/90 border border-primary-400/30 rounded-xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-lg flex items-center">
            <Sandwich className="h-5 w-5 mr-2 text-secondary-400"/>
            Add Food
          </h3>
          <button onClick={onClose} className="text-gray-300 hover:text-white">
            <X className="h-5 w-5"/>
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-3 flex items-center bg-gray-800 border border-gray-700 rounded-lg px-3">
            <Search className="h-4 w-4 text-gray-400 mr-2"/>
            <input 
              value={q} 
              onChange={(e) => setQ(e.target.value)} 
              placeholder="Search foods, brands, tags" 
              className="w-full bg-transparent py-2 text-gray-200 placeholder-gray-500 focus:outline-none"
            />
          </div>
          
          <select 
            value={category} 
            onChange={(e) => setCategory(e.target.value as MealCategory)} 
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-200"
          >
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snack">Snack</option>
          </select>
        </div>

        <div className="mt-4 max-h-96 overflow-y-auto space-y-2">
          {filtered.map((food, idx) => (
            <div key={idx} className="bg-gray-700/30 rounded-lg p-3 border border-gray-600/30">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-white">{food.name}</h4>
                  {food.brand && <p className="text-sm text-gray-400">{food.brand}</p>}
                  <p className="text-sm text-gray-300">{food.serving}</p>
                  <div className="flex gap-4 text-xs text-gray-400 mt-1">
                    <span>{food.calories} cal</span>
                    <span>P: {food.protein}g</span>
                    <span>C: {food.carbs}g</span>
                    <span>F: {food.fats}g</span>
                  </div>
                  {food.tags && (
                    <div className="flex gap-1 mt-2">
                      {food.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-xs px-2 py-0.5 rounded bg-secondary-600/20 text-secondary-300">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <select 
                    value={multiplier} 
                    onChange={(e) => setMultiplier(parseFloat(e.target.value))} 
                    className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200"
                  >
                    <option value={0.25}>1/4</option>
                    <option value={0.5}>1/2</option>
                    <option value={1}>1x</option>
                    <option value={1.5}>1.5x</option>
                    <option value={2}>2x</option>
                  </select>
                  
                  <button
                    onClick={() => onAdd({
                      name: food.name,
                      serving: multiplier === 1 ? food.serving : `${food.serving} (${multiplier}x)`,
                      calories: Math.round(food.calories * multiplier),
                      protein: Math.round(food.protein * multiplier * 10) / 10,
                      carbs: Math.round(food.carbs * multiplier * 10) / 10,
                      fats: Math.round(food.fats * multiplier * 10) / 10,
                      category
                    })}
                    className="bg-secondary-600 hover:bg-secondary-700 text-white font-medium py-1 px-3 rounded-lg flex items-center text-sm"
                  >
                    <Plus className="h-3 w-3 mr-1"/>
                    Add
                  </button>
                </div>
              </div>
            </div>
          ))}
          
          {filtered.length === 0 && q && (
            <p className="text-gray-400 text-center py-4">No foods found matching "{q}"</p>
          )}
        </div>
      </div>
    </div>
  )
}