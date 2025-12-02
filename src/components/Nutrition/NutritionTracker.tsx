"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { Apple, Target, Plus, X, Calendar, TrendingUp, Utensils, Copy, Edit, Trash2, Star, Check, Flame } from "lucide-react"
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
  const [copyingDay, setCopyingDay] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingEntry, setEditingEntry] = useState<FoodHistoryEntry | null>(null)

  // Favorites state
  const [favorites, setFavorites] = useState<any[]>([])
  const [favoritesLoading, setFavoritesLoading] = useState(false)

  // Meal Plans state
  const [mealPlans, setMealPlans] = useState<any[]>([])
  const [mealPlansLoading, setMealPlansLoading] = useState(false)
  const [showAddPlanModal, setShowAddPlanModal] = useState(false)
  const [newPlan, setNewPlan] = useState({
    name: '',
    planType: 'maintenance',
    dailyCalories: '',
    proteinTarget: '',
    carbsTarget: '',
    fatsTarget: '',
    description: ''
  })

  // Form state for adding food
  const [foodName, setFoodName] = useState('')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fats, setFats] = useState('')

  // Load meal plans
  const loadMealPlans = async () => {
    try {
      setMealPlansLoading(true)
      const res = await fetch('/api/nutrition/plans?activeOnly=true')
      if (res.ok) {
        const data = await res.json()
        setMealPlans(data.plans || [])
      }
    } catch (err) {
      console.error('Failed to load meal plans:', err)
    } finally {
      setMealPlansLoading(false)
    }
  }

  // Create new meal plan
  const createMealPlan = async () => {
    if (!newPlan.name || !newPlan.dailyCalories) {
      alert('Please enter at least name and daily calories')
      return
    }

    try {
      const res = await fetch('/api/nutrition/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPlan)
      })

      if (res.ok) {
        await loadMealPlans()
        setShowAddPlanModal(false)
        setNewPlan({
          name: '',
          planType: 'maintenance',
          dailyCalories: '',
          proteinTarget: '',
          carbsTarget: '',
          fatsTarget: '',
          description: ''
        })
      } else {
        const data = await res.json()
        alert(`Failed to create plan: ${data.error}`)
      }
    } catch (err) {
      console.error('Failed to create meal plan:', err)
      alert('Failed to create meal plan')
    }
  }

  // Delete/deactivate meal plan
  const removeMealPlan = async (planId: string) => {
    if (!confirm('Remove this meal plan?')) return
    try {
      const res = await fetch(`/api/nutrition/plans?id=${planId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        await loadMealPlans()
      }
    } catch (err) {
      console.error('Failed to remove meal plan:', err)
    }
  }

  // Load food library and today's foods
  useEffect(() => {
    fetchTodaysFoods()
    fetchFoodLibrary()
    loadFavorites()
    loadMealPlans()
  }, [])

  // Load favorites from API
  const loadFavorites = async () => {
    try {
      setFavoritesLoading(true)
      const res = await fetch('/api/nutrition/favorites')
      if (res.ok) {
        const data = await res.json()
        setFavorites(data.favorites || [])
      }
    } catch (err) {
      console.error('Failed to load favorites:', err)
    } finally {
      setFavoritesLoading(false)
    }
  }

  // Check if a history item is favorited
  const isFavorited = (entry: FoodHistoryEntry): boolean => {
    return favorites.some(
      (f) => f.description === entry.itemName && (entry.brand ? f.brand === entry.brand : true)
    )
  }

  // Toggle favorite for a history item
  const toggleFavoriteFromHistory = async (entry: FoodHistoryEntry, e: React.MouseEvent) => {
    e.stopPropagation()

    const action = isFavorited(entry) ? 'remove' : 'add'

    try {
      const res = await fetch('/api/nutrition/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          food: {
            source: 'history',
            sourceId: entry.id,
            description: entry.itemName,
            brand: entry.brand || null,
            per: entry.unit === 'g' ? '100g' : 'serving',
            nutrients: entry.nutrients || null,
            defaultGrams: entry.gramWeight || 100,
            defaultServings: entry.quantity || 1
          },
          action
        })
      })

      if (res.ok) {
        const data = await res.json()
        setFavorites(data.favorites || [])
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err)
    }
  }

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

  const copyPreviousDay = async () => {
    if (!confirm('Copy all meals from yesterday to today?')) return

    try {
      setCopyingDay(true)

      const response = await fetch('/api/nutrition/copy-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daysAgo: 1 })
      })

      const data = await response.json()

      if (data.ok) {
        alert(`✅ Copied ${data.count} meals from yesterday!`)
        fetchTodaysFoods()
        setRecentRefresh((prev) => prev + 1)
        setHistoryRefresh((prev) => prev + 1)
      } else {
        alert(`Failed: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error copying day:', error)
      alert('Failed to copy meals')
    } finally {
      setCopyingDay(false)
    }
  }

  const handleEditEntry = (entry: FoodHistoryEntry) => {
    setEditingEntry(entry)
    // Pre-fill form with entry data
    setFoodName(entry.itemName)
    setCalories((entry.nutrients?.kcal ?? 0).toString())
    setProtein((entry.nutrients?.protein_g ?? 0).toString())
    setCarbs((entry.nutrients?.carb_g ?? 0).toString())
    setFats((entry.nutrients?.fat_g ?? 0).toString())
    setSelectedMealType(entry.mealType || 'snack')
    setShowEditModal(true)
  }

  const handleDeleteHistoryEntry = async (entryId: string) => {
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

  const handleUpdateEntry = async () => {
    if (!editingEntry || !foodName || !calories) {
      alert('Please enter at least food name and calories')
      return
    }

    try {
      const response = await fetch('/api/nutrition/entries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryId: editingEntry.id,
          name: foodName,
          calories: parseFloat(calories),
          protein: protein ? parseFloat(protein) : 0,
          carbs: carbs ? parseFloat(carbs) : 0,
          fats: fats ? parseFloat(fats) : 0,
          mealType: selectedMealType
        })
      })

      const data = await response.json()

      if (data.success) {
        console.log('✅ Food entry updated!')
        fetchTodaysFoods()
        setRecentRefresh((prev) => prev + 1)
        setHistoryRefresh((prev) => prev + 1)
        // Reset form
        setFoodName('')
        setCalories('')
        setProtein('')
        setCarbs('')
        setFats('')
        setShowEditModal(false)
        setEditingEntry(null)
      } else {
        alert(`Failed to update food: ${data.error}`)
      }
    } catch (error) {
      console.error('Error updating food:', error)
      alert('Failed to update food. Please try again.')
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative pt-16"
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

      {/* Portal Subnav Header */}
      <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm shadow-2xl border-b border-primary-400/30">
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
            {/* Active Meal Plans Section */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-bold text-white flex items-center">
                  <Target className="w-6 h-6 mr-2 text-secondary-400" />
                  Active Meal Plans
                </h3>
                <button
                  onClick={() => setShowAddPlanModal(true)}
                  className="bg-secondary-500 hover:bg-secondary-600 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Plan
                </button>
              </div>

              {mealPlansLoading ? (
                <div className="text-center py-6">
                  <div className="animate-spin w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full mx-auto"></div>
                </div>
              ) : mealPlans.length === 0 ? (
                <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 text-center">
                  <Apple className="w-12 h-12 text-secondary-400 mx-auto mb-4" />
                  <h4 className="text-lg font-semibold text-white mb-2">No Active Meal Plans</h4>
                  <p className="text-gray-300 text-sm mb-4">Create a meal plan to track your daily macro targets</p>
                  <button
                    onClick={() => setShowAddPlanModal(true)}
                    className="bg-secondary-500 hover:bg-secondary-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
                  >
                    Create Your First Plan
                  </button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {mealPlans.map((plan) => (
                    <div
                      key={plan.id}
                      className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-5 border border-secondary-400/20 hover:border-secondary-400/40 transition-all shadow-lg"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="text-lg font-bold text-white">{plan.name}</h4>
                          <span className="text-xs px-2 py-1 rounded-full bg-secondary-600/30 text-secondary-300 capitalize">
                            {plan.planType}
                          </span>
                        </div>
                        <button
                          onClick={() => removeMealPlan(plan.id)}
                          className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {plan.description && (
                        <p className="text-gray-300 text-sm mb-3 line-clamp-2">{plan.description}</p>
                      )}

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-gray-700/50 rounded-lg p-2 text-center">
                          <div className="text-secondary-300 font-semibold text-lg">{plan.dailyCalories}</div>
                          <div className="text-gray-400">Daily Cal</div>
                        </div>
                        <div className="bg-gray-700/50 rounded-lg p-2 text-center">
                          <div className="text-secondary-300 font-semibold text-lg">{plan.proteinTarget}g</div>
                          <div className="text-gray-400">Protein</div>
                        </div>
                        <div className="bg-gray-700/50 rounded-lg p-2 text-center">
                          <div className="text-secondary-300 font-semibold">{plan.carbsTarget}g</div>
                          <div className="text-gray-400">Carbs</div>
                        </div>
                        <div className="bg-gray-700/50 rounded-lg p-2 text-center">
                          <div className="text-secondary-300 font-semibold">{plan.fatsTarget}g</div>
                          <div className="text-gray-400">Fats</div>
                        </div>
                      </div>

                      {/* Progress against plan */}
                      <div className="mt-3 pt-3 border-t border-gray-700/50">
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span>Today's Progress</span>
                          <span>{Math.round((todaysTotals.calories / plan.dailyCalories) * 100)}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-secondary-500 to-primary-500 h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(100, (todaysTotals.calories / plan.dailyCalories) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-white flex items-center">
                      <Utensils className="h-5 w-5 mr-2 text-secondary-400"/>Today's Meals
                    </h3>
                    <button
                      onClick={copyPreviousDay}
                      disabled={copyingDay}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 rounded-lg text-xs font-medium text-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Copy yesterday's meals"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copyingDay ? 'Copying...' : 'Copy Yesterday'}
                    </button>
                  </div>

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
                                <div className="flex-1">
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
                                <div className="flex gap-2 items-center">
                                  <button
                                    onClick={(e) => toggleFavoriteFromHistory(entry, e)}
                                    className="p-1 hover:scale-110 transition-transform"
                                    title={isFavorited(entry) ? "Remove from favorites" : "Add to favorites"}
                                  >
                                    <Star
                                      className="w-4 h-4"
                                      fill={isFavorited(entry) ? '#eab308' : 'none'}
                                      stroke={isFavorited(entry) ? '#eab308' : '#94a3b8'}
                                    />
                                  </button>
                                  <button
                                    onClick={() => handleEditEntry(entry)}
                                    className="text-blue-400 hover:text-blue-300 transition-colors"
                                    title="Edit entry"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteHistoryEntry(entry.id)}
                                    className="text-red-400 hover:text-red-300 transition-colors"
                                    title="Delete entry"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
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

      {/* Edit Food Modal */}
      {showEditModal && editingEntry && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 max-w-md w-full border border-primary-400/30 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Edit Food Entry</h3>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setEditingEntry(null)
                  setFoodName('')
                  setCalories('')
                  setProtein('')
                  setCarbs('')
                  setFats('')
                }}
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
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingEntry(null)
                    setFoodName('')
                    setCalories('')
                    setProtein('')
                    setCarbs('')
                    setFats('')
                  }}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateEntry}
                  className="flex-1 bg-secondary-600 hover:bg-secondary-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Update Entry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Meal Plan Modal */}
      {showAddPlanModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 max-w-lg w-full border border-secondary-400/30 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Create Meal Plan</h3>
              <button
                onClick={() => setShowAddPlanModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Plan Name *</label>
                <input
                  type="text"
                  value={newPlan.name}
                  onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-secondary-400 focus:outline-none"
                  placeholder="e.g., Cut Phase, Maintenance, Bulk"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Plan Type</label>
                <select
                  value={newPlan.planType}
                  onChange={(e) => setNewPlan({ ...newPlan, planType: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-secondary-400 focus:outline-none"
                >
                  <option value="maintenance">Maintenance</option>
                  <option value="cut">Cut / Fat Loss</option>
                  <option value="bulk">Bulk / Muscle Gain</option>
                  <option value="keto">Keto</option>
                  <option value="low-carb">Low Carb</option>
                  <option value="high-protein">High Protein</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Daily Calories *</label>
                  <input
                    type="number"
                    value={newPlan.dailyCalories}
                    onChange={(e) => setNewPlan({ ...newPlan, dailyCalories: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-secondary-400 focus:outline-none"
                    placeholder="2000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Protein (g)</label>
                  <input
                    type="number"
                    value={newPlan.proteinTarget}
                    onChange={(e) => setNewPlan({ ...newPlan, proteinTarget: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-secondary-400 focus:outline-none"
                    placeholder="150"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Carbs (g)</label>
                  <input
                    type="number"
                    value={newPlan.carbsTarget}
                    onChange={(e) => setNewPlan({ ...newPlan, carbsTarget: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-secondary-400 focus:outline-none"
                    placeholder="200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Fats (g)</label>
                  <input
                    type="number"
                    value={newPlan.fatsTarget}
                    onChange={(e) => setNewPlan({ ...newPlan, fatsTarget: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-secondary-400 focus:outline-none"
                    placeholder="65"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description (optional)</label>
                <textarea
                  value={newPlan.description}
                  onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-secondary-400 focus:outline-none"
                  placeholder="Notes about this plan..."
                  rows={2}
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={createMealPlan}
                  className="flex-1 bg-secondary-500 hover:bg-secondary-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Create Plan
                </button>
                <button
                  onClick={() => setShowAddPlanModal(false)}
                  className="px-4 py-3 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
