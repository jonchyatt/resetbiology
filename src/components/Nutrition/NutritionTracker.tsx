"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { Apple, Target, Plus, X, Calendar, TrendingUp, Utensils } from "lucide-react"
import { FoodQuickAdd, FoodQuickAddResult } from "./FoodQuickAdd"
import { RecentFoods } from "./RecentFoods"
import { MacroGoals } from "./MacroGoals"

interface FoodEntry {
  id: string
  name: string
  calories: number
  protein: number
  carbs: number
  fats: number
  mealType: string
  loggedAt: string
  quantity?: number
  unit?: string
  gramWeight?: number | null
}

interface FoodHistoryEntry {
  id: string
  itemName: string
  brand?: string | null
  gramWeight?: number | null
  quantity: number
  unit: string
  nutrients?: {
    kcal?: number | null
    protein_g?: number | null
    carb_g?: number | null
    fat_g?: number | null
  } | null
  mealType?: string | null
  loggedAt: string
}

export function NutritionTracker() {
  const [activeTab, setActiveTab] = useState<'today' | 'history'>('today')
  const [todaysFoods, setTodaysFoods] = useState<FoodEntry[]>([])
  const [showAddFoodModal, setShowAddFoodModal] = useState(false)
  const [showFoodSearchModal, setShowFoodSearchModal] = useState(false)
  const [selectedMealType, setSelectedMealType] = useState<string>('breakfast')
  const [foodLibrary, setFoodLibrary] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [logSuccess, setLogSuccess] = useState<FoodQuickAddResult | null>(null)
  const [recentRefresh, setRecentRefresh] = useState(0)
  const [historyRefresh, setHistoryRefresh] = useState(0)
  const [historyItems, setHistoryItems] = useState<FoodHistoryEntry[] | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)

  // Form state for adding food
  const [foodName, setFoodName] = useState('')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fats, setFats] = useState('')

  // Load food library and today's foods
  useEffect(() => {
    fetchTodaysFoods()
    fetchFoodLibrary()
  }, [])

  useEffect(() => {
    if (!logSuccess) return
    const timer = setTimeout(() => setLogSuccess(null), 5000)
    return () => clearTimeout(timer)
  }, [logSuccess])

  useEffect(() => {
    if (activeTab !== 'history') return

    const controller = new AbortController()

    const loadHistory = async () => {
      try {
        setHistoryLoading(true)
        setHistoryError(null)
        const response = await fetch('/api/foods/recent?limit=200', {
          cache: 'no-store',
          signal: controller.signal,
        })
        const data = await response.json()
        if (!response.ok || !data?.ok) {
          throw new Error(data?.error || 'Failed to load nutrition history')
        }
        setHistoryItems(Array.isArray(data.items) ? data.items : [])
      } catch (error: any) {
        if (error?.name === 'AbortError') return
        console.error('Error loading nutrition history:', error)
        setHistoryError(error?.message || 'Unable to load nutrition history')
      } finally {
        setHistoryLoading(false)
      }
    }

    loadHistory()
    return () => {
      controller.abort()
    }
  }, [activeTab, historyRefresh])

  const groupedHistory = useMemo(() => {
    if (!historyItems || historyItems.length === 0) return []

    const groups = new Map<string, {
      date: Date
      label: string
      entries: FoodHistoryEntry[]
      totals: { calories: number; protein: number; carbs: number; fats: number }
    }>()

    historyItems.forEach((entry) => {
      const date = new Date(entry.loggedAt)
      const key = date.toISOString().split('T')[0]
      if (!groups.has(key)) {
        groups.set(key, {
          date,
          label: date.toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          }),
          entries: [],
          totals: { calories: 0, protein: 0, carbs: 0, fats: 0 },
        })
      }
      const group = groups.get(key)!
      group.entries.push(entry)
      const kcal = typeof entry.nutrients?.kcal === 'number' ? entry.nutrients.kcal : 0
      const protein = typeof entry.nutrients?.protein_g === 'number' ? entry.nutrients.protein_g : 0
      const carbs = typeof entry.nutrients?.carb_g === 'number' ? entry.nutrients.carb_g : 0
      const fats = typeof entry.nutrients?.fat_g === 'number' ? entry.nutrients.fat_g : 0
      group.totals.calories += kcal
      group.totals.protein += protein
      group.totals.carbs += carbs
      group.totals.fats += fats
    })

    return Array.from(groups.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([key, group]) => ({
        key,
        date: group.date,
        label: group.label,
        totals: group.totals,
        entries: group.entries.sort(
          (a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime(),
        ),
      }))
  }, [historyItems])

  const fetchFoodLibrary = async () => {
    try {
      const response = await fetch('/api/nutrition/foods', {
        credentials: 'include'
      })
      const data = await response.json()

      if (data.success && data.foods) {
        setFoodLibrary(data.foods)
      }
    } catch (error) {
      console.error('Error loading food library:', error)
    }
  }

  const selectFoodFromLibrary = (food: any) => {
    setFoodName(food.name)
    setCalories(food.calories.toString())
    setProtein(food.protein.toString())
    setCarbs(food.carbs.toString())
    setFats(food.fats.toString())
    setShowFoodSearchModal(false)
    setShowAddFoodModal(true)
  }

  const filteredFoods = foodLibrary.filter(food =>
    food.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    food.category.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const fetchTodaysFoods = async () => {
    try {
      const response = await fetch('/api/foods/recent?limit=100', {
        cache: 'no-store'
      })
      const data = await response.json()

      if (data.ok && Array.isArray(data.items)) {
        const today = new Date().toDateString()
        const filtered = data.items
          .filter((entry: any) => new Date(entry.loggedAt).toDateString() === today)

        const mapped: FoodEntry[] = filtered
          .map((entry: any) => ({
            id: entry.id,
            name: entry.itemName,
            calories: Math.round(entry.nutrients?.kcal ?? 0),
            protein: Math.round(((entry.nutrients?.protein_g ?? 0) + Number.EPSILON) * 10) / 10,
            carbs: Math.round(((entry.nutrients?.carb_g ?? 0) + Number.EPSILON) * 10) / 10,
            fats: Math.round(((entry.nutrients?.fat_g ?? 0) + Number.EPSILON) * 10) / 10,
            mealType: (entry.mealType ?? 'snack').toLowerCase(),
            loggedAt: entry.loggedAt,
            quantity: entry.quantity,
            unit: entry.unit,
            gramWeight: entry.gramWeight,
          }))

        mapped.sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime())

        setTodaysFoods(mapped)
      } else {
        setTodaysFoods([])
      }
    } catch (error) {
      console.error('Error loading food entries:', error)
    }
  }

  const handleAddFood = async () => {
    if (!foodName || !calories) {
      alert('Please enter at least food name and calories')
      return
    }

    try {
      const response = await fetch('/api/foods/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'manual',
          itemName: foodName,
          brand: null,
          quantity: 1,
          unit: 'serving',
          gramWeight: null,
          mealType: selectedMealType,
          nutrients: {
            kcal: parseFloat(calories),
            protein_g: protein ? parseFloat(protein) : 0,
            carb_g: carbs ? parseFloat(carbs) : 0,
            fat_g: fats ? parseFloat(fats) : 0,
          }
        })
      })

      const data = await response.json()

      if (data.ok) {
        console.log('✅ Food logged!')
        fetchTodaysFoods()
        // Reset form
        setFoodName('')
        setCalories('')
        setProtein('')
        setCarbs('')
        setFats('')
        setShowAddFoodModal(false)
      } else {
        alert(`Failed to log food: ${data.error}`)
      }
    } catch (error) {
      console.error('Error logging food:', error)
      alert('Failed to log food. Please try again.')
    }
  }

  const deleteFood = async (entryId: string) => {
    if (!confirm('Delete this food entry?')) return

    try {
      const response = await fetch(`/api/foods/log?id=${entryId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.ok) {
        console.log('✅ Food entry deleted')
        fetchTodaysFoods()
        setRecentRefresh((prev) => prev + 1)
        setHistoryRefresh((prev) => prev + 1)
      } else {
        alert('Failed to delete entry')
      }
    } catch (error) {
      console.error('Error deleting food:', error)
      alert('Failed to delete entry')
    }
  }

  // Calculate today's totals
  const todaysTotals = todaysFoods.reduce(
    (acc, food) => ({
      calories: acc.calories + food.calories,
      protein: acc.protein + food.protein,
      carbs: acc.carbs + food.carbs,
      fats: acc.fats + food.fats
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  )

  // Group foods by meal type
  const foodsByMeal = {
    breakfast: todaysFoods.filter(f => f.mealType === 'breakfast'),
    lunch: todaysFoods.filter(f => f.mealType === 'lunch'),
    dinner: todaysFoods.filter(f => f.mealType === 'dinner'),
    snack: todaysFoods.filter(f => f.mealType === 'snack')
  }

  const lastLoggedAt = useMemo(() => {
    let latest: Date | null = null
    for (const food of todaysFoods) {
      const logged = new Date(food.loggedAt)
      if (!latest || logged.getTime() > latest.getTime()) {
        latest = logged
      }
    }
    return latest
  }, [todaysFoods])
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative"
         style={{
           backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
           backgroundSize: 'cover',
           backgroundPosition: 'center',
           backgroundAttachment: 'fixed'
         }}>
      {logSuccess && (
        <div className="fixed right-6 top-24 z-40 max-w-sm rounded-xl border border-emerald-400/40 bg-emerald-500/20 px-4 py-3 text-sm text-emerald-100 shadow-2xl backdrop-blur">
          <p className="font-semibold">Nutrition log saved!</p>
          {logSuccess.pointsAwarded > 0 && (
            <p className="mt-1 text-emerald-200">+{logSuccess.pointsAwarded} points added today.</p>
          )}
          {logSuccess.journalNote && (
            <p className="mt-1 text-emerald-100/80">Journal updated: {logSuccess.journalNote}</p>
          )}
        </div>
      )}

      {/* Header - matching PeptideTracker pattern */}
      <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm shadow-2xl border-b border-primary-400/30 mt-16">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo1.png" alt="Reset Biology" className="h-10 w-auto rounded-lg drop-shadow-lg bg-white/10 backdrop-blur-sm p-1 border border-white/20" />
              <div>
                <div className="flex items-center">
                  <a href="/portal" className="text-xl font-bold text-white drop-shadow-lg hover:text-primary-300 transition-colors">Portal</a>
                  <span className="mx-2 text-primary-300">&gt;</span>
                  <span className="text-lg text-gray-200 drop-shadow-sm">Nutrition Tracker</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <a href="/daily-history" className="text-primary-300 hover:text-primary-200 font-medium text-sm transition-colors drop-shadow-sm">
                Daily History
              </a>
              <a href="/portal" className="text-primary-300 hover:text-primary-200 font-medium text-sm transition-colors drop-shadow-sm">
                ← Back to Portal
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="text-center py-8">
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
          <span className="text-secondary-400">Nutrition</span> Tracker
        </h2>
        <p className="text-xl md:text-2xl text-gray-200 max-w-3xl mx-auto">
          Track macros, fuel your protocols, optimize for peptide effectiveness
        </p>
      </div>

      {/* Tabs */}
      <div className="container mx-auto px-4 pb-8">
        <div className="flex justify-center mb-8">
          <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-1 border border-primary-400/30 hover:shadow-primary-400/20 transition-all duration-300">
            {(['today', 'history'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 rounded-lg font-medium transition-all capitalize ${
                  activeTab === tab
                    ? 'bg-secondary-500 text-white shadow-lg'
                    : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                {tab === 'today' ? 'Today' : 'History'}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'today' && (
          <div className="max-w-6xl mx-auto">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Column 1 - Add Nutrition */}
              <div className="space-y-6">
                <FoodQuickAdd
                  onLogged={(result) => {
                    fetchTodaysFoods()
                    setRecentRefresh((prev) => prev + 1)
                    setHistoryRefresh((prev) => prev + 1)
                    setLogSuccess(result)
                  }}
                />

                <RecentFoods
                  refreshToken={recentRefresh}
                  onQuickAddSuccess={() => {
                    fetchTodaysFoods()
                    setRecentRefresh((prev) => prev + 1)
                    setHistoryRefresh((prev) => prev + 1)
                  }}
                />

                <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-2xl hover:shadow-secondary-400/20 transition-all duration-300">
                  <h4 className="text-white font-semibold mb-3 flex items-center">
                    <TrendingUp className="h-5 w-5 mr-2 text-secondary-400"/>History &amp; Insights
                  </h4>
                  <p className="text-gray-300 text-sm mb-3">
                    Review your daily trendlines across peptides, workouts, meals, breath work, and journal entries in one timeline.
                  </p>
                  <Link
                    href="/journal"
                    className="inline-flex items-center justify-center rounded-lg border border-secondary-400/40 bg-secondary-500/20 px-4 py-2 text-sm font-medium text-secondary-200 transition hover:border-secondary-300 hover:bg-secondary-500/30"
                  >
                    Open Daily History
                  </Link>
                </div>
              </div>

              {/* Column 2 - Today's Meals */}
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-2xl hover:shadow-primary-400/20 transition-all duration-300">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                    <Utensils className="h-5 w-5 mr-2 text-secondary-400"/>Today's Meals
                  </h3>

                  {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((mealType) => (
                    <div key={mealType} className="mb-6 last:mb-0">
                      <h4 className="text-primary-300 font-semibold mb-2 capitalize">{mealType}</h4>
                      {foodsByMeal[mealType].length === 0 ? (
                        <p className="text-gray-400 text-sm italic">Nothing logged</p>
                      ) : (
                        <div className="space-y-2">
                          {foodsByMeal[mealType].map((food) => (
                            <div key={food.id} className="bg-gray-700/30 rounded-lg p-3 flex justify-between items-center">
                              <div>
                                <p className="text-white font-medium">
                                  {food.name}
                                  {food.quantity && food.unit && (
                                    <span className="text-gray-400 text-sm ml-2">({food.quantity}{food.unit})</span>
                                  )}
                                </p>
                                <p className="text-gray-400 text-xs">
                                  {food.calories}cal • P:{food.protein}g C:{food.carbs}g F:{food.fats}g
                                </p>
                              </div>
                              <button
                                onClick={() => deleteFood(food.id)}
                                className="text-red-400 hover:text-red-300 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Column 3 - Macro Goals & Daily Snapshot */}
              <div className="space-y-6">
                <MacroGoals todaysTotals={todaysTotals} />

                <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-2xl hover:shadow-secondary-400/20 transition-all duration-300">
                  <h4 className="text-white font-semibold mb-2 flex items-center">
                    <Calendar className="h-5 w-5 mr-2 text-secondary-400"/>Daily Snapshot
                  </h4>
                  <ul className="space-y-2 text-sm text-gray-300">
                    <li className="flex items-center justify-between">
                      <span>Meals logged</span>
                      <span className="font-semibold text-white">{todaysFoods.length}</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>Last entry</span>
                      <span className="font-semibold text-white">{lastLoggedAt ? lastLoggedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'}</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>Total calories</span>
                      <span className="font-semibold text-white">{Math.round(todaysTotals.calories)} kcal</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-2xl hover:shadow-secondary-400/20 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-6 w-6 text-secondary-300" />
                  <h3 className="text-xl font-bold text-white">Nutrition History</h3>
                </div>
                <button
                  onClick={() => setHistoryRefresh((prev) => prev + 1)}
                  className="rounded-lg border border-secondary-400/40 bg-secondary-500/10 px-4 py-2 text-sm font-medium text-secondary-200 transition hover:border-secondary-400/60 hover:bg-secondary-500/20"
                >
                  Refresh
                </button>
              </div>

              {historyLoading ? (
                <div className="py-8 text-center text-sm text-gray-300">
                  <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-secondary-300 border-t-transparent" />
                  Loading nutrition history...
                </div>
              ) : historyError ? (
                <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {historyError}
                </div>
              ) : groupedHistory.length === 0 ? (
                <div className="py-10 text-center text-gray-300">
                  <p>No nutrition logs yet.</p>
                  <p className="text-sm text-gray-400">Log meals to start building your history.</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
                  {groupedHistory.map((group) => {
                    const totals = group.totals
                    return (
                      <div key={group.key} className="rounded-xl border border-secondary-400/30 bg-gray-900/50 p-4 shadow-lg">
                        <div className="flex items-center justify-between gap-4 border-b border-secondary-400/20 pb-3">
                          <div>
                            <p className="text-lg font-semibold text-white">{group.label}</p>
                            <p className="text-xs text-gray-400">{group.date.toLocaleDateString()}</p>
                          </div>
                          <div className="text-right text-sm text-gray-300">
                            <p className="text-white font-semibold">{Math.round(totals.calories)} kcal</p>
                            <p className="text-xs text-gray-400">
                              P {Math.round(totals.protein)}g • C {Math.round(totals.carbs)}g • F {Math.round(totals.fats)}g
                            </p>
                          </div>
                        </div>
                        <ul className="mt-3 space-y-2">
                          {group.entries.map((entry) => {
                            const loggedDate = new Date(entry.loggedAt)
                            const kcal = Math.round(typeof entry.nutrients?.kcal === 'number' ? entry.nutrients.kcal : 0)
                            const protein = Math.round(typeof entry.nutrients?.protein_g === 'number' ? entry.nutrients.protein_g : 0)
                            const carbs = Math.round(typeof entry.nutrients?.carb_g === 'number' ? entry.nutrients.carb_g : 0)
                            const fats = Math.round(typeof entry.nutrients?.fat_g === 'number' ? entry.nutrients.fat_g : 0)
                            return (
                              <li key={entry.id} className="flex items-start justify-between gap-4 rounded-lg border border-gray-700/40 bg-gray-800/40 px-3 py-2 text-sm text-gray-100">
                                <div>
                                  <p className="font-medium text-white">
                                    {entry.itemName}
                                    {entry.brand ? <span className="ml-1 text-xs text-gray-400">({entry.brand})</span> : null}
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    {(entry.mealType || 'meal').toUpperCase()} • {entry.quantity} {entry.unit}
                                    {entry.gramWeight ? ` • ${Math.round(entry.gramWeight)} g` : ''}
                                  </p>
                                </div>
                                <div className="text-right text-xs text-gray-400">
                                  <p className="text-sm font-semibold text-white">{kcal} kcal</p>
                                  <p>P {protein}g • C {carbs}g • F {fats}g</p>
                                  <p>{loggedDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {/* Add Food Modal */}
      {showAddFoodModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 max-w-md w-full border border-primary-400/30 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Log Food</h3>
              <button
                onClick={() => setShowAddFoodModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Meal Type</label>
                <select
                  value={selectedMealType}
                  onChange={(e) => setSelectedMealType(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-primary-400 focus:outline-none"
                >
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="snack">Snack</option>
                </select>
              </div>

              {/* Search Database Button */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddFoodModal(false)
                    setShowFoodSearchModal(true)
                  }}
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
                >
                  <Apple className="w-4 h-4 mr-2" />
                  Search Food Database
                </button>
                <p className="text-xs text-gray-400 mt-2">Or enter manually below:</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Food Name *</label>
                <input
                  type="text"
                  required
                  value={foodName}
                  onChange={(e) => setFoodName(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-primary-400 focus:outline-none"
                  placeholder="e.g., Chicken Breast"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Calories *</label>
                  <input
                    type="number"
                    required
                    value={calories}
                    onChange={(e) => setCalories(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-primary-400 focus:outline-none"
                    placeholder="200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Protein (g)</label>
                  <input
                    type="number"
                    value={protein}
                    onChange={(e) => setProtein(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-primary-400 focus:outline-none"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Carbs (g)</label>
                  <input
                    type="number"
                    value={carbs}
                    onChange={(e) => setCarbs(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-primary-400 focus:outline-none"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Fats (g)</label>
                  <input
                    type="number"
                    value={fats}
                    onChange={(e) => setFats(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-primary-400 focus:outline-none"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowAddFoodModal(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddFood}
                  className="flex-1 bg-secondary-600 hover:bg-secondary-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Log Food
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Food Search Modal */}
      {showFoodSearchModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 max-w-2xl w-full border border-primary-400/30 shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Food Database</h3>
              <button
                onClick={() => setShowFoodSearchModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Search Bar */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search foods (e.g., chicken, rice, protein)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-primary-400 focus:outline-none"
                autoFocus
              />
              <p className="text-xs text-gray-400 mt-2">
                Found {filteredFoods.length} foods • Click to auto-fill
              </p>
            </div>

            {/* Food List */}
            <div className="overflow-y-auto flex-1">
              <div className="grid gap-3">
                {filteredFoods.map((food) => (
                  <button
                    key={food.id}
                    onClick={() => selectFoodFromLibrary(food)}
                    className="bg-gradient-to-br from-primary-600/10 to-secondary-600/10 hover:from-primary-600/20 hover:to-secondary-600/20 rounded-lg p-4 border border-primary-400/20 hover:border-primary-400/40 transition-all duration-200 text-left"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-bold text-white mb-1">{food.name}</h4>
                        <div className="flex gap-4 text-sm text-gray-300">
                          <span>{food.calories} cal</span>
                          <span>P: {food.protein}g</span>
                          <span>C: {food.carbs}g</span>
                          <span>F: {food.fats}g</span>
                        </div>
                      </div>
                      <span className="text-xs text-secondary-300 bg-secondary-500/20 px-2 py-1 rounded-full">
                        {food.category}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {filteredFoods.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-400">No foods found matching "{searchQuery}"</p>
                  <button
                    onClick={() => {
                      setShowFoodSearchModal(false)
                      setShowAddFoodModal(true)
                    }}
                    className="mt-4 text-primary-300 hover:text-primary-200 underline"
                  >
                    Add manually instead
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}



