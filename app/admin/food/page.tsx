"use client"

import { useState } from "react"
import { Plus, Save, Trash2, Edit, Apple } from "lucide-react"

interface AdminFood {
  id?: string
  name: string
  brand?: string
  category: string
  serving_size: string
  serving_unit: string
  calories_per_serving: number
  macros: {
    protein: number
    carbs: number
    fat: number
    fiber?: number
    sugar?: number
  }
  micronutrients?: {
    sodium?: number
    potassium?: number
    calcium?: number
    iron?: number
    vitamin_c?: number
  }
  peptide_interactions?: string[]
  notes?: string
}

interface MealTemplate {
  id?: string
  name: string
  category: string
  description: string
  foods: {
    foodId: string
    quantity: number
  }[]
  total_calories?: number
  peptide_timing?: string
}

export default function AdminFoodPage() {
  const [activeTab, setActiveTab] = useState<'foods' | 'meals'>('foods')
  const [foods, setFoods] = useState<AdminFood[]>([
    // Example foods
    {
      id: "food-1",
      name: "Chicken Breast",
      category: "Protein",
      serving_size: "100",
      serving_unit: "g",
      calories_per_serving: 165,
      macros: {
        protein: 31,
        carbs: 0,
        fat: 3.6,
        fiber: 0
      },
      peptide_interactions: ["Enhances CJC-1295 absorption"],
      notes: "High-quality lean protein, ideal for muscle building"
    }
  ])

  const [meals, setMeals] = useState<MealTemplate[]>([
    {
      id: "meal-1",
      name: "Post-Workout Recovery Bowl",
      category: "Post-Workout",
      description: "High protein meal optimized for peptide absorption",
      foods: [
        { foodId: "food-1", quantity: 200 }
      ],
      total_calories: 330,
      peptide_timing: "Take peptides 30 minutes before this meal"
    }
  ])

  const [editingItem, setEditingItem] = useState<AdminFood | MealTemplate | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [foodFormData, setFoodFormData] = useState<AdminFood>({
    name: "",
    brand: "",
    category: "",
    serving_size: "",
    serving_unit: "",
    calories_per_serving: 0,
    macros: {
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0
    },
    micronutrients: {
      sodium: 0,
      potassium: 0,
      calcium: 0,
      iron: 0,
      vitamin_c: 0
    },
    peptide_interactions: [],
    notes: ""
  })

  const categories = ["Protein", "Vegetables", "Fruits", "Grains", "Dairy", "Fats", "Beverages", "Supplements", "Snacks"]
  const servingUnits = ["g", "oz", "cup", "tbsp", "tsp", "piece", "slice", "ml"]
  const mealCategories = ["Breakfast", "Lunch", "Dinner", "Snack", "Pre-Workout", "Post-Workout", "Peptide-Optimized"]

  const handleFoodSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (editingItem && 'macros' in editingItem) {
      // Update existing food
      setFoods(prev => prev.map(food => 
        food.id === editingItem.id ? { ...foodFormData, id: editingItem.id } : food
      ))
    } else {
      // Add new food
      const newFood: AdminFood = {
        ...foodFormData,
        id: `food-${Date.now()}`
      }
      setFoods(prev => [...prev, newFood])
    }
    
    resetForm()
  }

  const resetForm = () => {
    setFoodFormData({
      name: "",
      brand: "",
      category: "",
      serving_size: "",
      serving_unit: "",
      calories_per_serving: 0,
      macros: {
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0
      },
      micronutrients: {
        sodium: 0,
        potassium: 0,
        calcium: 0,
        iron: 0,
        vitamin_c: 0
      },
      peptide_interactions: [],
      notes: ""
    })
    setEditingItem(null)
    setShowForm(false)
  }

  const editFood = (food: AdminFood) => {
    setFoodFormData({ ...food })
    setEditingItem(food)
    setShowForm(true)
  }

  const deleteFood = (id: string) => {
    if (confirm("Are you sure you want to delete this food item?")) {
      setFoods(prev => prev.filter(food => food.id !== id))
    }
  }

  const exportData = () => {
    const data = { foods, meals }
    const dataStr = JSON.stringify(data, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    const exportFileDefaultName = 'food-database-export.json'
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative"
         style={{
           backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
           backgroundSize: 'cover',
           backgroundPosition: 'center',
           backgroundAttachment: 'fixed'
         }}>
      <div className="relative z-10">
        <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-green-400/30 mb-8 shadow-xl hover:shadow-green-400/20 transition-all duration-300">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">Admin: Food Database Management</h1>
              <p className="text-gray-300 mt-1">Manage foods and meal templates for nutrition tracking</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={exportData}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Save className="w-4 h-4" />
                Export
              </button>
              <button
                onClick={() => setShowForm(!showForm)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Food
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-8">
          <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-1 border border-green-400/30 shadow-xl hover:shadow-green-400/20 transition-all duration-300">
            {(['foods', 'meals'] as const).map((tab) => (
              <button 
                key={tab} 
                onClick={() => setActiveTab(tab)} 
                className={`px-6 py-3 rounded-lg font-medium transition-all capitalize ${
                  activeTab === tab 
                    ? 'bg-green-500 text-white shadow-lg' 
                    : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Form Section */}
          {showForm && activeTab === 'foods' && (
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-green-400/30 shadow-xl hover:shadow-green-400/20 transition-all duration-300">
              <h2 className="text-xl font-bold text-white mb-6">
                {editingItem ? 'Edit Food' : 'Add New Food'}
              </h2>
              
              <form onSubmit={handleFoodSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Name *</label>
                    <input
                      type="text"
                      required
                      value={foodFormData.name}
                      onChange={(e) => setFoodFormData({...foodFormData, name: e.target.value})}
                      className="w-full bg-primary-600/10 backdrop-blur-sm border border-primary-400/30 rounded-lg px-3 py-2 text-white focus:border-green-400 focus:outline-none placeholder-gray-400"
                      placeholder="e.g., Chicken Breast"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Brand</label>
                    <input
                      type="text"
                      value={foodFormData.brand || ""}
                      onChange={(e) => setFoodFormData({...foodFormData, brand: e.target.value})}
                      className="w-full bg-primary-600/10 backdrop-blur-sm border border-primary-400/30 rounded-lg px-3 py-2 text-white focus:border-green-400 focus:outline-none placeholder-gray-400"
                      placeholder="e.g., Tyson"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Category *</label>
                    <select
                      required
                      value={foodFormData.category}
                      onChange={(e) => setFoodFormData({...foodFormData, category: e.target.value})}
                      className="w-full bg-primary-600/10 backdrop-blur-sm border border-primary-400/30 rounded-lg px-3 py-2 text-white focus:border-green-400 focus:outline-none placeholder-gray-400"
                    >
                      <option value="">Select category...</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Calories per serving *</label>
                    <input
                      type="number"
                      required
                      value={foodFormData.calories_per_serving}
                      onChange={(e) => setFoodFormData({...foodFormData, calories_per_serving: parseInt(e.target.value)})}
                      className="w-full bg-primary-600/10 backdrop-blur-sm border border-primary-400/30 rounded-lg px-3 py-2 text-white focus:border-green-400 focus:outline-none placeholder-gray-400"
                      placeholder="165"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Serving Size *</label>
                    <input
                      type="text"
                      required
                      value={foodFormData.serving_size}
                      onChange={(e) => setFoodFormData({...foodFormData, serving_size: e.target.value})}
                      className="w-full bg-primary-600/10 backdrop-blur-sm border border-primary-400/30 rounded-lg px-3 py-2 text-white focus:border-green-400 focus:outline-none placeholder-gray-400"
                      placeholder="100"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Unit *</label>
                    <select
                      required
                      value={foodFormData.serving_unit}
                      onChange={(e) => setFoodFormData({...foodFormData, serving_unit: e.target.value})}
                      className="w-full bg-primary-600/10 backdrop-blur-sm border border-primary-400/30 rounded-lg px-3 py-2 text-white focus:border-green-400 focus:outline-none placeholder-gray-400"
                    >
                      <option value="">Unit...</option>
                      {servingUnits.map(unit => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Macros Section */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Macronutrients (per serving)</h3>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Protein (g) *</label>
                      <input
                        type="number"
                        step="0.1"
                        required
                        value={foodFormData.macros.protein}
                        onChange={(e) => setFoodFormData({
                          ...foodFormData, 
                          macros: {...foodFormData.macros, protein: parseFloat(e.target.value)}
                        })}
                        className="w-full bg-primary-600/10 backdrop-blur-sm border border-primary-400/30 rounded-lg px-3 py-2 text-white focus:border-green-400 focus:outline-none placeholder-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Carbs (g) *</label>
                      <input
                        type="number"
                        step="0.1"
                        required
                        value={foodFormData.macros.carbs}
                        onChange={(e) => setFoodFormData({
                          ...foodFormData, 
                          macros: {...foodFormData.macros, carbs: parseFloat(e.target.value)}
                        })}
                        className="w-full bg-primary-600/10 backdrop-blur-sm border border-primary-400/30 rounded-lg px-3 py-2 text-white focus:border-green-400 focus:outline-none placeholder-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Fat (g) *</label>
                      <input
                        type="number"
                        step="0.1"
                        required
                        value={foodFormData.macros.fat}
                        onChange={(e) => setFoodFormData({
                          ...foodFormData, 
                          macros: {...foodFormData.macros, fat: parseFloat(e.target.value)}
                        })}
                        className="w-full bg-primary-600/10 backdrop-blur-sm border border-primary-400/30 rounded-lg px-3 py-2 text-white focus:border-green-400 focus:outline-none placeholder-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Fiber (g)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={foodFormData.macros.fiber || 0}
                        onChange={(e) => setFoodFormData({
                          ...foodFormData, 
                          macros: {...foodFormData.macros, fiber: parseFloat(e.target.value)}
                        })}
                        className="w-full bg-primary-600/10 backdrop-blur-sm border border-primary-400/30 rounded-lg px-3 py-2 text-white focus:border-green-400 focus:outline-none placeholder-gray-400"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Peptide Interactions/Notes</label>
                  <textarea
                    value={foodFormData.notes || ""}
                    onChange={(e) => setFoodFormData({...foodFormData, notes: e.target.value})}
                    className="w-full bg-primary-600/10 backdrop-blur-sm border border-primary-400/30 rounded-lg px-3 py-2 text-white focus:border-green-400 focus:outline-none placeholder-gray-400"
                    placeholder="How this food affects peptide absorption or efficacy"
                    rows={3}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    {editingItem ? 'Update Food' : 'Add Food'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Food List */}
          {activeTab === 'foods' && (
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-green-400/30 shadow-xl hover:shadow-green-400/20 transition-all duration-300">
              <h2 className="text-xl font-bold text-white mb-6">Food Database ({foods.length})</h2>
              
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {foods.map((food) => (
                  <div key={food.id} className="bg-gradient-to-br from-gray-700/60 to-gray-800/60 backdrop-blur-sm rounded-lg p-4 border border-green-400/30 shadow-xl hover:shadow-green-400/20 transition-all duration-300">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-white">{food.name}</h3>
                        {food.brand && <p className="text-sm text-gray-400">{food.brand}</p>}
                        <div className="flex gap-2 mt-1">
                          <span className="text-xs text-green-300 bg-green-500/20 px-2 py-1 rounded-full">
                            {food.category}
                          </span>
                          <span className="text-xs text-gray-300 bg-gray-500/20 px-2 py-1 rounded-full">
                            {food.calories_per_serving} cal/{food.serving_size}{food.serving_unit}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => editFood(food)}
                          className="text-blue-400 hover:text-blue-300 p-1"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteFood(food.id!)}
                          className="text-red-400 hover:text-red-300 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 text-sm text-gray-300">
                      <div><strong>Protein:</strong> {food.macros.protein}g</div>
                      <div><strong>Carbs:</strong> {food.macros.carbs}g</div>
                      <div><strong>Fat:</strong> {food.macros.fat}g</div>
                    </div>
                    
                    {food.notes && (
                      <p className="text-sm text-gray-400 mt-2">{food.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Meal Templates Tab */}
          {activeTab === 'meals' && (
            <div className="lg:col-span-2">
              <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-green-400/30 shadow-xl hover:shadow-green-400/20 transition-all duration-300">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                  <Apple className="w-5 h-5 mr-2 text-green-400" />
                  Meal Templates ({meals.length})
                </h2>
                
                <div className="space-y-4">
                  {meals.map((meal) => (
                    <div key={meal.id} className="bg-gradient-to-br from-gray-700/60 to-gray-800/60 backdrop-blur-sm rounded-lg p-4 border border-green-400/30 shadow-xl hover:shadow-green-400/20 transition-all duration-300">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-bold text-white">{meal.name}</h3>
                          <p className="text-gray-300 text-sm mt-1">{meal.description}</p>
                        </div>
                        <div className="flex gap-2">
                          <button className="text-blue-400 hover:text-blue-300 p-1">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button className="text-red-400 hover:text-red-300 p-1">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm text-gray-300 mb-3">
                        <div><strong>Category:</strong> {meal.category}</div>
                        <div><strong>Calories:</strong> {meal.total_calories || 'TBD'}</div>
                        <div><strong>Foods:</strong> {meal.foods.length} items</div>
                      </div>
                      
                      {meal.peptide_timing && (
                        <div className="text-sm text-green-400 bg-green-500/10 p-2 rounded">
                          <strong>Peptide Timing:</strong> {meal.peptide_timing}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  )
}