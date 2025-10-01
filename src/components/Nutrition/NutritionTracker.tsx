"use client"

import { useMemo, useState, useEffect } from "react"
import { Apple, PieChart, Target, Calendar, Plus, ShoppingCart, History, UtensilsCrossed, Clock, Droplet, NotebookPen, Upload, Check } from "lucide-react"
import { FoodSearch } from "./FoodSearch"
import { MealLogger, type MealCategory } from "./MealLogger"
import { foodIndex } from "./FoodDatabase"

interface FoodEntry {
  id: string
  name: string
  calories: number
  protein: number
  carbs: number
  fats: number
  serving: string
  time: string
  category: MealCategory
}

interface DayEntry {
  date: string
  foods: FoodEntry[]
  waterIntake: number
  notes?: string
}

interface MacroTargets {
  calories: number
  protein: number
  carbs: number
  fats: number
}

export function NutritionTracker() {
  const [currentDay, setCurrentDay] = useState<DayEntry>({
    date: new Date().toISOString().split('T')[0],
    foods: [],
    waterIntake: 0
  })

  const [macroTargets, setMacroTargets] = useState<MacroTargets>({
    calories: 2000,
    protein: 150,
    carbs: 200,
    fats: 67
  })

  const [activeTab, setActiveTab] = useState<'today' | 'history' | 'meal-plans'>('today')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [notes, setNotes] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Load today's entries on mount
  useEffect(() => {
    loadTodayEntries()
  }, [])

  const loadTodayEntries = async () => {
    try {
      setIsLoading(true)
      const today = new Date().toISOString().split('T')[0]
      const response = await fetch(`/api/nutrition/entries?date=${today}`, {
        credentials: 'include'
      })
      const data = await response.json()

      if (data.success && data.entries) {
        // Transform database entries to match our interface
        const formattedFoods = data.entries.map((entry: any) => ({
          id: entry.id,
          name: entry.name,
          calories: entry.calories,
          protein: entry.protein,
          carbs: entry.carbs,
          fats: entry.fats,
          serving: entry.serving || '1 serving',
          time: new Date(entry.loggedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          category: entry.mealType as MealCategory
        }))

        setCurrentDay(prev => ({
          ...prev,
          foods: formattedFoods
        }))
      }
    } catch (error) {
      console.error('Error loading nutrition entries:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const addFood = async (food: Omit<FoodEntry, 'id' | 'time'>, category: MealCategory) => {
    const newEntry = {
      ...food,
      id: crypto.randomUUID(),
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      category
    }

    // Add to local state immediately
    setCurrentDay(prev => ({
      ...prev,
      foods: [...prev.foods, newEntry]
    }))

    // Save to database
    try {
      setIsSaving(true)
      const response = await fetch('/api/nutrition/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: food.name,
          calories: food.calories,
          protein: food.protein,
          carbs: food.carbs,
          fats: food.fats,
          mealType: category,
          serving: food.serving
        })
      })

      const data = await response.json()

      if (data.success) {
        // Update with real ID from database
        setCurrentDay(prev => ({
          ...prev,
          foods: prev.foods.map(f => f.id === newEntry.id ? { ...f, id: data.entry.id } : f)
        }))

        if (data.pointsAwarded) {
          console.log(`✅ Food logged! +${data.pointsAwarded} points earned!`)
        }
      } else {
        console.error('Failed to save food entry:', data.error)
      }
    } catch (error) {
      console.error('Error saving food entry:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const currentMacros = useMemo(() => currentDay.foods.reduce((acc, food) => ({
    calories: acc.calories + food.calories,
    protein: acc.protein + food.protein,
    carbs: acc.carbs + food.carbs,
    fats: acc.fats + food.fats
  }), { calories: 0, protein: 0, carbs: 0, fats: 0 }), [currentDay.foods])

  // KEEP THIS SAMPLE DATA - shows peptide integration
  const sampleMealPlans = [
    {
      name: "Peptide Optimization Protocol",
      description: "Optimized for maximum peptide absorption and effectiveness",
      calories: 1800,
      protein: 140,
      meals: ["High-protein breakfast", "Pre-peptide snack", "Post-workout meal", "Light dinner"],
      peptideSupport: true
    },
    {
      name: "Metabolic Reset Plan",
      description: "Balanced nutrition for metabolic restoration",
      calories: 2200,
      protein: 120,
      meals: ["Nutrient-dense breakfast", "Balanced lunch", "Healthy snack", "Lean dinner"],
      peptideSupport: false
    },
    {
      name: "Performance Enhancement",
      description: "High-protein plan for active clients",
      calories: 2500,
      protein: 180,
      meals: ["Power breakfast", "Pre-workout fuel", "Post-workout recovery", "Balanced dinner"],
      peptideSupport: true
    }
  ]

  // PRESERVE THIS COMPONENT - it's the macro display bars
  const MacroCard = ({ label, current, target, color }: { 
    label: string, current: number, target: number, color: string 
  }) => {
    const percentage = Math.min((current / target) * 100, 100)
    return (
      <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/30 p-4 rounded-lg hover:shadow-secondary-400/20 transition-all duration-300 backdrop-blur-sm border border-secondary-400/30 shadow-xl">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-200">{label}</span>
          <span className="text-sm text-gray-300">{current.toFixed(0)}/{target}</span>
        </div>
        <div className="w-full bg-gray-900/50 rounded-full h-2 backdrop-blur-sm border border-gray-600/30">
          <div 
            className={`h-2 rounded-full transition-all duration-500 ${color}`}
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
      </div>
    )
  }

  const groupedFoods = useMemo(() => {
    const groups: Record<MealCategory, FoodEntry[]> = { breakfast: [], lunch: [], dinner: [], snack: [] }
    currentDay.foods.forEach(f => groups[f.category].push(f))
    return groups
  }, [currentDay.foods])


  const removeFood = (id: string) => setCurrentDay(prev => ({
    ...prev,
    foods: prev.foods.filter(f => f.id !== id)
  }))

  const updateWater = (delta: number) => setCurrentDay(prev => ({
    ...prev,
    waterIntake: Math.max(0, prev.waterIntake + delta)
  }))

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative"
         style={{
           backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
           backgroundSize: 'cover',
           backgroundPosition: 'center',
           backgroundAttachment: 'fixed'
         }}>
      <div className="relative z-10">
        {/* PRESERVE THIS HEADER PATTERN */}
        <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm shadow-2xl border-b border-primary-400/30">
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

        {/* PRESERVE THIS TITLE SECTION */}
        <div className="text-center py-8">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 text-shadow-lg animate-fade-in">
            <span className="text-secondary-400">Nutrition</span> Tracker
          </h2>
          <p className="text-xl md:text-2xl text-gray-200 max-w-3xl mx-auto font-medium leading-relaxed drop-shadow-sm">
            Automated meal plans optimized for peptide effectiveness. Track macros with peptide-specific recommendations.
          </p>
        </div>

        <div className="container mx-auto px-4 pb-8">
          {/* PRESERVE THIS TAB NAVIGATION */}
          <div className="flex justify-center mb-8">
            <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-1 border border-primary-400/30 hover:shadow-primary-400/20 transition-all duration-300">
              {(['today', 'history', 'meal-plans'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-3 rounded-lg font-medium transition-all capitalize ${
                    activeTab === tab 
                      ? 'bg-secondary-500 text-white shadow-lg' 
                      : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                  }`}
                >
                  {tab === 'meal-plans' ? 'Meal Plans' : tab}
                </button>
              ))}
            </div>
          </div>

          {/* TODAY TAB */}
          {activeTab === 'today' && (
            <div className="max-w-6xl mx-auto">
              <div className="grid gap-6 lg:grid-cols-3">
                {/* KEEP THIS ENTIRE MACRO OVERVIEW SECTION */}
                <div className="space-y-6">
                  <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-2xl hover:shadow-primary-400/20 transition-all duration-300">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                      <PieChart className="w-5 h-5 mr-2 text-secondary-400" />
                      Daily Macros
                    </h3>
                    <div className="space-y-4">
                      <MacroCard label="Calories" current={currentMacros.calories} target={macroTargets.calories} color="bg-gradient-to-r from-blue-500 to-blue-600" />
                      <MacroCard label="Protein (g)" current={currentMacros.protein} target={macroTargets.protein} color="bg-gradient-to-r from-red-500 to-red-600" />
                      <MacroCard label="Carbs (g)" current={currentMacros.carbs} target={macroTargets.carbs} color="bg-gradient-to-r from-green-500 to-green-600" />
                      <MacroCard label="Fats (g)" current={currentMacros.fats} target={macroTargets.fats} color="bg-gradient-to-r from-yellow-500 to-yellow-600" />
                    </div>
                  </div>

                  {/* KEEP THIS PEPTIDE OPTIMIZATION TIP */}
                  <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-4 border border-primary-400/50">
                    <h4 className="font-semibold text-primary-300 mb-2">🧬 Peptide Optimization</h4>
                    <p className="text-sm text-gray-200">
                      Next peptide dose in 2 hours. Consider a light protein snack 30 minutes before.
                    </p>
                  </div>

                  {/* WATER + NOTES */}
                  <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-2xl hover:shadow-secondary-400/20 transition-all duration-300">
                    <h3 className="text-white font-semibold mb-3 flex items-center"><Droplet className="mr-2 h-5 w-5 text-secondary-400"/>Hydration</h3>
                    <div className="flex items-center gap-3">
                      <button onClick={() => updateWater(8)} className="bg-secondary-600 hover:bg-secondary-700 text-white font-medium py-2 px-3 rounded-lg">+ 8 oz</button>
                      <button onClick={() => updateWater(-8)} className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-3 rounded-lg">- 8 oz</button>
                      <span className="text-gray-200 ml-auto">{currentDay.waterIntake} oz</span>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-2xl hover:shadow-secondary-400/20 transition-all duration-300">
                    <h3 className="text-white font-semibold mb-3 flex items-center"><NotebookPen className="mr-2 h-5 w-5 text-secondary-400"/>Notes</h3>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How do you feel today? Peptide timing effects, appetite, etc." className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-secondary-500"></textarea>
                  </div>
                </div>

                {/* FOOD LOGGING */}
                <div className="lg:col-span-2">
                  <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-2xl hover:shadow-secondary-400/20 transition-all duration-300">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-white flex items-center">
                        <Apple className="w-5 h-5 mr-2 text-secondary-400" />
                        Today's Meals
                      </h3>
                      {/* ENHANCED BUTTON opens food search/log modal */}
                      <button onClick={() => setIsSearchOpen(true)} className="bg-secondary-600 hover:bg-secondary-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Food
                      </button>
                    </div>

                    <MealLogger groups={groupedFoods} onRemove={removeFood} />

                    {currentDay.foods.length === 0 && (
                      <div className="text-center py-8">
                        <Apple className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                        <p className="text-gray-300 mb-4">No foods logged today</p>
                        <p className="text-sm text-gray-400">Start tracking your nutrition for optimal peptide results</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <div className="max-w-5xl mx-auto">
              <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-2xl hover:shadow-secondary-400/20 transition-all duration-300">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center"><History className="h-5 w-5 mr-2 text-secondary-400"/>Meal History</h3>
                <p className="text-gray-300">Coming soon: persist days to localStorage or backend and browse past logs with peptide timing overlays.</p>
              </div>
            </div>
          )}

          {/* MEAL PLANS TAB (preserved) */}
          {activeTab === 'meal-plans' && (
            <div className="max-w-5xl mx-auto grid gap-6 md:grid-cols-2">
              {sampleMealPlans.map(mp => (
                <div key={mp.name} className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-2xl hover:shadow-secondary-400/20 transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-semibold text-lg">{mp.name}</h4>
                      <p className="text-gray-300 text-sm">{mp.description}</p>
                    </div>
                    {mp.peptideSupport && <span className="text-xs px-2 py-1 rounded bg-secondary-600 text-white">Peptide Support</span>}
                  </div>
                  <div className="mt-4 text-gray-300 text-sm">
                    <p className="mb-2">Target: {mp.calories} kcal • {mp.protein} g protein</p>
                    <ul className="list-disc list-inside space-y-1">
                      {mp.meals.map(m => <li key={m}>{m}</li>)}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SEARCH MODAL */}
      {isSearchOpen && (
        <FoodSearch
          foods={foodIndex}
          onClose={() => setIsSearchOpen(false)}
          onAdd={(payload) => {
            // FoodSearch returns the food data, we need to add a default category
            addFood(payload, 'meal' as MealCategory)
            setIsSearchOpen(false)
          }}
        />
      )}
    </div>
  )
}