"use client"

import { useState, useEffect } from "react"
import { Plus, Save, Trash2, Edit } from "lucide-react"

interface AdminMealPlan {
  id?: string
  name: string
  planType: string
  dailyCalories: number
  proteinTarget: number
  carbsTarget: number
  fatsTarget: number
  description?: string
  notes?: string
  isActive?: boolean
}

export default function AdminNutritionPage() {
  const [plans, setPlans] = useState<AdminMealPlan[]>([])

  const [editingPlan, setEditingPlan] = useState<AdminMealPlan | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<AdminMealPlan>({
    name: "",
    planType: "",
    dailyCalories: 0,
    proteinTarget: 0,
    carbsTarget: 0,
    fatsTarget: 0,
    description: "",
    notes: ""
  })

  const planTypes = [
    "Muscle Building",
    "Fat Loss",
    "Maintenance",
    "Ketogenic",
    "Low Carb",
    "High Carb",
    "Intermittent Fasting",
    "Custom"
  ]

  // Load plans from database on mount
  useEffect(() => {
    fetchPlans()
  }, [])

  const fetchPlans = async () => {
    try {
      const response = await fetch('/api/nutrition/plans', {
        credentials: 'include'
      })
      const data = await response.json()

      if (data.success && data.plans) {
        setPlans(data.plans)
      }
    } catch (error) {
      console.error('Error loading meal plans:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (editingPlan) {
        // Update existing plan
        const response = await fetch('/api/nutrition/plans', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            id: editingPlan.id,
            ...formData
          })
        })

        const data = await response.json()

        if (data.success) {
          console.log('✅ Meal plan updated!')
          fetchPlans()
        } else {
          alert(`Failed to update plan: ${data.error}`)
        }
      } else {
        // Create new plan
        const response = await fetch('/api/nutrition/plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(formData)
        })

        const data = await response.json()

        if (data.success) {
          console.log(`✅ Meal plan created! +${data.pointsAwarded} points`)
          fetchPlans()
        } else {
          alert(`Failed to create plan: ${data.error}`)
        }
      }

      resetForm()
    } catch (error) {
      console.error('Error saving meal plan:', error)
      alert('Failed to save meal plan. Please try again.')
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      planType: "",
      dailyCalories: 0,
      proteinTarget: 0,
      carbsTarget: 0,
      fatsTarget: 0,
      description: "",
      notes: ""
    })
    setEditingPlan(null)
    setShowForm(false)
  }

  const editPlan = (plan: AdminMealPlan) => {
    setFormData({ ...plan })
    setEditingPlan(plan)
    setShowForm(true)
  }

  const deletePlan = async (id: string) => {
    if (!confirm("Are you sure you want to delete this meal plan?")) return

    try {
      const response = await fetch(`/api/nutrition/plans?id=${id}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      const data = await response.json()

      if (data.success) {
        console.log('✅ Meal plan deleted')
        fetchPlans()
      } else {
        alert('Failed to delete plan')
      }
    } catch (error) {
      console.error('Error deleting meal plan:', error)
      alert('Failed to delete plan')
    }
  }

  const exportPlans = () => {
    const dataStr = JSON.stringify(plans, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    const exportFileDefaultName = 'meal-plans-export.json'

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
      {/* Navigation Header */}
      <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm shadow-2xl border-b border-primary-400/30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <img src="/logo1.png" alt="Reset Biology" className="h-8 w-auto mr-3 drop-shadow-lg" />
              <div className="flex items-center">
                <h1 className="text-xl font-bold text-white drop-shadow-lg">Admin</h1>
                <span className="mx-2 text-primary-300">•</span>
                <span className="text-lg text-gray-200 drop-shadow-sm">Nutrition Management</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <a href="/admin" className="text-primary-300 hover:text-primary-200 font-medium text-sm transition-colors drop-shadow-sm">
                ← Back to Admin
              </a>
              <a href="/portal" className="text-primary-300 hover:text-primary-200 font-medium text-sm transition-colors drop-shadow-sm">
                ← Back to Portal
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10">
        <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 mb-8 shadow-xl hover:shadow-primary-400/20 transition-all duration-300">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">Meal Plan Library</h1>
              <p className="text-gray-300 mt-1">Create and manage meal plans for users</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={exportPlans}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Save className="w-4 h-4" />
                Export
              </button>
              <button
                onClick={() => setShowForm(!showForm)}
                className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Meal Plan
              </button>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Form Section */}
          {showForm && (
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-teal-400/30 shadow-xl hover:shadow-teal-400/20 transition-all duration-300">
              <h2 className="text-xl font-bold text-white mb-6">
                {editingPlan ? 'Edit Meal Plan' : 'Add New Meal Plan'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Plan Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full bg-primary-600/10 backdrop-blur-sm border border-primary-400/30 rounded-lg px-3 py-2 text-white focus:border-primary-400 focus:outline-none placeholder-gray-400"
                      placeholder="e.g., Muscle Gain"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Plan Type *</label>
                    <select
                      required
                      value={formData.planType}
                      onChange={(e) => setFormData({...formData, planType: e.target.value})}
                      className="w-full bg-primary-600/10 backdrop-blur-sm border border-primary-400/30 rounded-lg px-3 py-2 text-white focus:border-primary-400 focus:outline-none"
                    >
                      <option value="">Select type...</option>
                      {planTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Daily Calories *</label>
                  <input
                    type="number"
                    required
                    value={formData.dailyCalories || ""}
                    onChange={(e) => setFormData({...formData, dailyCalories: parseInt(e.target.value) || 0})}
                    className="w-full bg-primary-600/10 backdrop-blur-sm border border-primary-400/30 rounded-lg px-3 py-2 text-white focus:border-primary-400 focus:outline-none placeholder-gray-400"
                    placeholder="e.g., 2500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Protein (g) *</label>
                    <input
                      type="number"
                      required
                      value={formData.proteinTarget || ""}
                      onChange={(e) => setFormData({...formData, proteinTarget: parseInt(e.target.value) || 0})}
                      className="w-full bg-primary-600/10 backdrop-blur-sm border border-primary-400/30 rounded-lg px-3 py-2 text-white focus:border-primary-400 focus:outline-none placeholder-gray-400"
                      placeholder="150"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Carbs (g) *</label>
                    <input
                      type="number"
                      required
                      value={formData.carbsTarget || ""}
                      onChange={(e) => setFormData({...formData, carbsTarget: parseInt(e.target.value) || 0})}
                      className="w-full bg-primary-600/10 backdrop-blur-sm border border-primary-400/30 rounded-lg px-3 py-2 text-white focus:border-primary-400 focus:outline-none placeholder-gray-400"
                      placeholder="200"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Fats (g) *</label>
                    <input
                      type="number"
                      required
                      value={formData.fatsTarget || ""}
                      onChange={(e) => setFormData({...formData, fatsTarget: parseInt(e.target.value) || 0})}
                      className="w-full bg-primary-600/10 backdrop-blur-sm border border-primary-400/30 rounded-lg px-3 py-2 text-white focus:border-primary-400 focus:outline-none placeholder-gray-400"
                      placeholder="70"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                  <textarea
                    value={formData.description || ""}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full bg-primary-600/10 backdrop-blur-sm border border-primary-400/30 rounded-lg px-3 py-2 text-white focus:border-primary-400 focus:outline-none placeholder-gray-400"
                    placeholder="Brief description of the meal plan"
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Notes</label>
                  <textarea
                    value={formData.notes || ""}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    className="w-full bg-primary-600/10 backdrop-blur-sm border border-primary-400/30 rounded-lg px-3 py-2 text-white focus:border-primary-400 focus:outline-none placeholder-gray-400"
                    placeholder="Additional guidance or tips"
                    rows={2}
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
                    className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    {editingPlan ? 'Update Plan' : 'Add Plan'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Plans List */}
          <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-blue-500/30 shadow-xl hover:shadow-blue-400/20 transition-all duration-300">
            <h2 className="text-xl font-bold text-white mb-6">Meal Plan Library ({plans.length})</h2>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {plans.map((plan) => (
                <div key={plan.id} className="bg-gradient-to-br from-gray-700/60 to-gray-800/60 backdrop-blur-sm rounded-lg p-4 border border-primary-400/20 shadow-lg hover:shadow-primary-400/10 transition-all duration-300">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-white">{plan.name}</h3>
                      <span className="text-sm text-primary-300 bg-primary-500/20 px-2 py-1 rounded-full">
                        {plan.planType}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => editPlan(plan)}
                        className="text-blue-400 hover:text-blue-300 p-1"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deletePlan(plan.id!)}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-300 mb-2">
                    <div><strong>Calories:</strong> {plan.dailyCalories}</div>
                    <div><strong>Protein:</strong> {plan.proteinTarget}g</div>
                    <div><strong>Carbs:</strong> {plan.carbsTarget}g</div>
                    <div><strong>Fats:</strong> {plan.fatsTarget}g</div>
                  </div>

                  {plan.description && (
                    <p className="text-sm text-gray-400 mt-2">{plan.description}</p>
                  )}

                  {plan.notes && (
                    <p className="text-xs text-gray-500 mt-1 italic">{plan.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
