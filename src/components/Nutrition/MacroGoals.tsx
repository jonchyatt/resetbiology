'use client'

import { useState, useEffect } from 'react'
import { Target, Edit2, Check, X } from 'lucide-react'

interface MacroGoalsProps {
  todaysTotals: {
    calories: number
    protein: number
    carbs: number
    fats: number
  }
}

interface Goals {
  calories: number
  protein: number
  carbs: number
  fats: number
}

export function MacroGoals({ todaysTotals }: MacroGoalsProps) {
  const [goals, setGoals] = useState<Goals>({
    calories: 2000,
    protein: 150,
    carbs: 200,
    fats: 65
  })
  const [isEditing, setIsEditing] = useState(false)
  const [editedGoals, setEditedGoals] = useState<Goals>(goals)
  const [loading, setLoading] = useState(true)

  // Load goals from user profile
  useEffect(() => {
    const loadGoals = async () => {
      try {
        const res = await fetch('/api/nutrition/goals')
        if (res.ok) {
          const data = await res.json()
          if (data.goals) {
            setGoals(data.goals)
            setEditedGoals(data.goals)
          }
        }
      } catch (err) {
        console.error('Failed to load goals:', err)
      } finally {
        setLoading(false)
      }
    }
    loadGoals()
  }, [])

  const handleSaveGoals = async () => {
    try {
      const res = await fetch('/api/nutrition/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goals: editedGoals })
      })

      if (res.ok) {
        setGoals(editedGoals)
        setIsEditing(false)
      }
    } catch (err) {
      console.error('Failed to save goals:', err)
      alert('Failed to save goals')
    }
  }

  const getProgressColor = (current: number, goal: number): string => {
    if (goal === 0) return 'bg-gray-500'
    const percentage = (current / goal) * 100
    if (percentage >= 80) return 'bg-emerald-500'
    if (percentage >= 50) return 'bg-yellow-500'
    return 'bg-rose-500'
  }

  const getPercentage = (current: number, goal: number): number => {
    if (goal === 0) return 0
    return Math.min(100, (current / goal) * 100)
  }

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-amber-600/20 to-amber-700/20 backdrop-blur-sm rounded-xl p-4 border border-amber-400/30 shadow-2xl">
        <p className="text-white text-sm">Loading goals...</p>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-amber-600/20 to-amber-700/20 backdrop-blur-sm rounded-xl p-4 border border-amber-400/30 shadow-2xl hover:shadow-amber-500/20 transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white flex items-center">
          <Target className="h-4 w-4 mr-2 text-amber-400" />
          Macro Goals
        </h3>

        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="p-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 transition-colors"
            title="Edit Goals"
          >
            <Edit2 className="w-4 h-4 text-amber-300" />
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleSaveGoals}
              className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 transition-colors"
              title="Save Goals"
            >
              <Check className="w-4 h-4 text-emerald-300" />
            </button>
            <button
              onClick={() => {
                setEditedGoals(goals)
                setIsEditing(false)
              }}
              className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 transition-colors"
              title="Cancel"
            >
              <X className="w-4 h-4 text-rose-300" />
            </button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {/* Calories */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-300">Calories</span>
            {isEditing ? (
              <input
                type="number"
                value={editedGoals.calories}
                onChange={(e) => setEditedGoals({ ...editedGoals, calories: parseInt(e.target.value) || 0 })}
                className="w-20 px-2 py-1 text-xs bg-gray-700 text-white rounded border border-amber-400/30 focus:border-amber-400 focus:outline-none"
              />
            ) : (
              <span className="text-xs text-white font-semibold">
                {Math.round(todaysTotals.calories)} / {goals.calories} kcal
              </span>
            )}
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${getProgressColor(todaysTotals.calories, goals.calories)}`}
              style={{ width: `${getPercentage(todaysTotals.calories, goals.calories)}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {Math.round(getPercentage(todaysTotals.calories, goals.calories))}% of goal
          </p>
        </div>

        {/* Protein */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-300">Protein</span>
            {isEditing ? (
              <input
                type="number"
                value={editedGoals.protein}
                onChange={(e) => setEditedGoals({ ...editedGoals, protein: parseInt(e.target.value) || 0 })}
                className="w-20 px-2 py-1 text-xs bg-gray-700 text-white rounded border border-amber-400/30 focus:border-amber-400 focus:outline-none"
              />
            ) : (
              <span className="text-xs text-white font-semibold">
                {Math.round(todaysTotals.protein)} / {goals.protein}g
              </span>
            )}
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${getProgressColor(todaysTotals.protein, goals.protein)}`}
              style={{ width: `${getPercentage(todaysTotals.protein, goals.protein)}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {Math.round(getPercentage(todaysTotals.protein, goals.protein))}% of goal
          </p>
        </div>

        {/* Carbs */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-300">Carbs</span>
            {isEditing ? (
              <input
                type="number"
                value={editedGoals.carbs}
                onChange={(e) => setEditedGoals({ ...editedGoals, carbs: parseInt(e.target.value) || 0 })}
                className="w-20 px-2 py-1 text-xs bg-gray-700 text-white rounded border border-amber-400/30 focus:border-amber-400 focus:outline-none"
              />
            ) : (
              <span className="text-xs text-white font-semibold">
                {Math.round(todaysTotals.carbs)} / {goals.carbs}g
              </span>
            )}
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${getProgressColor(todaysTotals.carbs, goals.carbs)}`}
              style={{ width: `${getPercentage(todaysTotals.carbs, goals.carbs)}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {Math.round(getPercentage(todaysTotals.carbs, goals.carbs))}% of goal
          </p>
        </div>

        {/* Fats */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-300">Fats</span>
            {isEditing ? (
              <input
                type="number"
                value={editedGoals.fats}
                onChange={(e) => setEditedGoals({ ...editedGoals, fats: parseInt(e.target.value) || 0 })}
                className="w-20 px-2 py-1 text-xs bg-gray-700 text-white rounded border border-amber-400/30 focus:border-amber-400 focus:outline-none"
              />
            ) : (
              <span className="text-xs text-white font-semibold">
                {Math.round(todaysTotals.fats)} / {goals.fats}g
              </span>
            )}
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${getProgressColor(todaysTotals.fats, goals.fats)}`}
              style={{ width: `${getPercentage(todaysTotals.fats, goals.fats)}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {Math.round(getPercentage(todaysTotals.fats, goals.fats))}% of goal
          </p>
        </div>
      </div>
    </div>
  )
}
