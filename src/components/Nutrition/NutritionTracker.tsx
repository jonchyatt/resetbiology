"use client"

import { useState, useEffect } from "react"
import { Apple, Target, Plus, X, Calendar, TrendingUp, Utensils } from "lucide-react"

interface MealPlan {
  id: string
  name: string
  planType: string
  dailyCalories: number
  proteinTarget: number
  carbsTarget: number
  fatsTarget: number
  description?: string
  notes?: string
  isActive: boolean
}

interface FoodEntry {
  id: string
  name: string
  calories: number
  protein: number
  carbs: number
  fats: number
  mealType: string
  loggedAt: string
}

export function NutritionTracker() {
  const [activeTab, setActiveTab] = useState<'today' | 'plans' | 'history'>('today')
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([])
  const [activePlan, setActivePlan] = useState<MealPlan | null>(null)
  const [todaysFoods, setTodaysFoods] = useState<FoodEntry[]>([])
  const [showAddFoodModal, setShowAddFoodModal] = useState(false)
  const [showFoodSearchModal, setShowFoodSearchModal] = useState(false)
  const [selectedMealType, setSelectedMealType] = useState<string>('breakfast')
  const [foodLibrary, setFoodLibrary] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  // Form state for adding food
  const [foodName, setFoodName] = useState('')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fats, setFats] = useState('')

  // Load meal plans, food library, and today's foods
  useEffect(() => {
    fetchMealPlans()
    fetchTodaysFoods()
    fetchFoodLibrary()
  }, [])

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

  const fetchMealPlans = async () => {
    try {
      const response = await fetch('/api/nutrition/plans', {
        credentials: 'include'
      })
      const data = await response.json()

      if (data.success && data.plans) {
        setMealPlans(data.plans)
        const active = data.plans.find((p: MealPlan) => p.isActive)
        if (active) setActivePlan(active)
      }
    } catch (error) {
      console.error('Error loading meal plans:', error)
    }
  }

  const fetchTodaysFoods = async () => {
    try {
      const response = await fetch('/api/nutrition/entries', {
        credentials: 'include'
      })
      const data = await response.json()

      if (data.success && data.entries) {
        setTodaysFoods(data.entries)
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
      const response = await fetch('/api/nutrition/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
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
        console.log(`✅ Food logged! +${data.pointsAwarded} points`)
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
      const response = await fetch(`/api/nutrition/entries?id=${entryId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      const data = await response.json()

      if (data.success) {
        console.log('✅ Food entry deleted')
        fetchTodaysFoods()
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

  const handleSetActivePlan = async (planId: string) => {
    try {
      const response = await fetch('/api/nutrition/plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: planId,
          isActive: true
        })
      })

      const data = await response.json()

      if (data.success) {
        console.log('✅ Active plan updated!')
        fetchMealPlans()
      } else {
        alert('Failed to set active plan')
      }
    } catch (error) {
      console.error('Error setting active plan:', error)
      alert('Failed to set active plan')
    }
  }

  const MealPlanCard = ({ plan }: { plan: MealPlan }) => (
    <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/30 rounded-lg p-6 border border-primary-400/30 backdrop-blur-sm shadow-xl hover:shadow-primary-400/20 transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-white">{plan.name}</h3>
          <span className="text-xs text-secondary-300 bg-secondary-500/20 px-2 py-1 rounded-full mt-2 inline-block">
            {plan.planType}
          </span>
        </div>
        {plan.isActive ? (
          <span className="text-xs text-green-300 bg-green-500/20 px-3 py-1 rounded-full">
            Active
          </span>
        ) : (
          <button
            onClick={() => handleSetActivePlan(plan.id)}
            className="text-xs text-primary-300 bg-primary-500/20 px-3 py-1 rounded-full hover:bg-primary-500/30 transition-colors"
          >
            Set Active
          </button>
        )}
      </div>

      <div className="flex gap-4">
        <div className="flex-1 space-y-3 text-sm">
          <div className="space-y-2">
            <div>
              <span className="text-gray-400">Daily Calories:</span>
              <span className="text-white font-medium ml-2">{plan.dailyCalories}</span>
            </div>
            <div>
              <span className="text-gray-400">Protein:</span>
              <span className="text-white font-medium ml-2">{plan.proteinTarget}g</span>
            </div>
            <div>
              <span className="text-gray-400">Carbs:</span>
              <span className="text-white font-medium ml-2">{plan.carbsTarget}g</span>
            </div>
            <div>
              <span className="text-gray-400">Fats:</span>
              <span className="text-white font-medium ml-2">{plan.fatsTarget}g</span>
            </div>
          </div>

          {plan.description && (
            <div className="border-t border-gray-600 pt-3">
              <p className="text-gray-300 text-xs">{plan.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  const MacroProgressBar = ({ label, current, target, color }: { label: string; current: number; target: number; color: string }) => {
    const percentage = Math.min((current / target) * 100, 100)

    return (
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-300">{label}</span>
          <span className="text-white font-medium">{current} / {target}g</span>
        </div>
        <div className="w-full bg-gray-700/50 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${color}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative"
         style={{
           backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
           backgroundSize: 'cover',
           backgroundPosition: 'center',
           backgroundAttachment: 'fixed'
         }}>
      {/* Header - matching PeptideTracker pattern */}
      <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm shadow-2xl border-b border-primary-400/30 mt-16">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <img src="/logo1.png" alt="Reset Biology" className="h-8 w-auto mr-3 drop-shadow-lg" />
              <div>
                <h1 className="text-xl font-bold text-white drop-shadow-lg">Portal</h1>
                <span className="text-lg text-gray-200 drop-shadow-sm">• Nutrition Tracker</span>
              </div>
            </div>
            <a href="/portal" className="text-primary-300 hover:text-primary-200 font-medium text-sm transition-colors drop-shadow-sm">
              ← Back to Portal
            </a>
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="text-center py-8">
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
          <span className="text-secondary-400">Nutrition</span> Tracker
        </h2>
        <p className="text-xl md:text-2xl text-gray-200 max-w-3xl mx-auto">
          Track macros, manage meal plans, optimize for peptide effectiveness
        </p>
      </div>

      {/* Tabs */}
      <div className="container mx-auto px-4 pb-8">
        <div className="flex justify-center mb-8">
          <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-1 border border-primary-400/30 hover:shadow-primary-400/20 transition-all duration-300">
            {(['today', 'plans', 'history'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 rounded-lg font-medium transition-all capitalize ${
                  activeTab === tab
                    ? 'bg-secondary-500 text-white shadow-lg'
                    : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                {tab === 'today' ? 'Today' : tab === 'plans' ? 'Meal Plans' : 'History'}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'today' && (
          <div className="max-w-6xl mx-auto grid gap-6 lg:grid-cols-3">
            {/* Main content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Today's Progress */}
              <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-2xl hover:shadow-primary-400/20 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white flex items-center">
                    <Target className="h-5 w-5 mr-2 text-secondary-400"/>Today's Macros
                  </h3>
                  <button
                    onClick={() => setShowAddFoodModal(true)}
                    className="bg-secondary-600 hover:bg-secondary-700 text-white font-medium py-2 px-4 rounded-lg flex items-center"
                  >
                    <Plus className="h-4 w-4 mr-1"/>Add Food
                  </button>
                </div>

                {activePlan && (
                  <div className="space-y-4">
                    <div className="bg-gray-800/50 rounded-lg p-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-300">Calories</span>
                        <span className="text-white font-bold text-lg">{todaysTotals.calories} / {activePlan.dailyCalories}</span>
                      </div>
                      <div className="w-full bg-gray-700/50 rounded-full h-4 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min((todaysTotals.calories / activePlan.dailyCalories) * 100, 100)}%` }}
                        />
                      </div>
                    </div>

                    <MacroProgressBar
                      label="Protein"
                      current={todaysTotals.protein}
                      target={activePlan.proteinTarget}
                      color="bg-gradient-to-r from-blue-500 to-blue-400"
                    />
                    <MacroProgressBar
                      label="Carbs"
                      current={todaysTotals.carbs}
                      target={activePlan.carbsTarget}
                      color="bg-gradient-to-r from-green-500 to-green-400"
                    />
                    <MacroProgressBar
                      label="Fats"
                      current={todaysTotals.fats}
                      target={activePlan.fatsTarget}
                      color="bg-gradient-to-r from-amber-500 to-amber-400"
                    />
                  </div>
                )}
              </div>

              {/* Today's Meals */}
              <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-2xl hover:shadow-primary-400/20 transition-all duration-300">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                  <Utensils className="h-5 w-5 mr-2 text-secondary-400"/>Today's Meals
                </h3>

                {['breakfast', 'lunch', 'dinner', 'snack'].map((mealType) => (
                  <div key={mealType} className="mb-6 last:mb-0">
                    <h4 className="text-primary-300 font-semibold mb-2 capitalize">{mealType}</h4>
                    {foodsByMeal[mealType as keyof typeof foodsByMeal].length === 0 ? (
                      <p className="text-gray-400 text-sm italic">Nothing logged</p>
                    ) : (
                      <div className="space-y-2">
                        {foodsByMeal[mealType as keyof typeof foodsByMeal].map((food) => (
                          <div key={food.id} className="bg-gray-700/30 rounded-lg p-3 flex justify-between items-center">
                            <div>
                              <p className="text-white font-medium">{food.name}</p>
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

            {/* Sidebar */}
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-2xl hover:shadow-secondary-400/20 transition-all duration-300">
                <h4 className="text-white font-semibold mb-2 flex items-center">
                  <Calendar className="h-5 w-5 mr-2 text-secondary-400"/>Current Plan
                </h4>
                {activePlan ? (
                  <div>
                    <p className="text-primary-300 font-bold text-lg">{activePlan.name}</p>
                    <p className="text-gray-400 text-sm">{activePlan.planType}</p>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">No active plan</p>
                )}
              </div>

              <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-2xl hover:shadow-secondary-400/20 transition-all duration-300">
                <h4 className="text-white font-semibold mb-2 flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2 text-secondary-400"/>Progress
                </h4>
                <p className="text-gray-300 text-sm">Weekly trends and analytics coming soon.</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'plans' && (
          <div className="max-w-5xl mx-auto">
            <div className="mb-6 flex justify-between items-center">
              <h3 className="text-2xl font-bold text-white">Meal Plans</h3>
              <a
                href="/admin/nutrition"
                className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                <Plus className="inline h-4 w-4 mr-1"/>Create Plan
              </a>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {mealPlans.map((plan) => (
                <MealPlanCard key={plan.id} plan={plan} />
              ))}
            </div>

            {mealPlans.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-400">No meal plans yet. Create one to get started!</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="max-w-5xl mx-auto">
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-2xl hover:shadow-secondary-400/20 transition-all duration-300">
              <h3 className="text-xl font-bold text-white mb-4">History</h3>
              <p className="text-gray-300">Nutrition history coming soon.</p>
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
