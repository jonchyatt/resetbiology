'use client'

import { useState, useEffect } from 'react'
import { Target, Edit2, Check, X } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

export interface Goals {
  calories: number
  protein: number
  carbs: number
  fats: number
}

interface MacroGoalsProps {
  todaysTotals: { calories: number; protein: number; carbs: number; fats: number }
  goals: Goals
  /** 'plan' = targets come from the active meal plan (read-only here); 'personal' = editable defaults. */
  goalSource: 'plan' | 'personal'
  planName?: string
  onPersonalGoalsSaved?: (goals: Goals) => void
}

// Protein is the hero metric for a GLP-1 / peptide member — render it first.
const MACRO_ORDER: Array<{ key: keyof Goals; label: string; unit: string }> = [
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'calories', label: 'Calories', unit: 'kcal' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fats', label: 'Fats', unit: 'g' },
]

export function MacroGoals({ todaysTotals, goals, goalSource, planName, onPersonalGoalsSaved }: MacroGoalsProps) {
  const toast = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [editedGoals, setEditedGoals] = useState<Goals>(goals)

  useEffect(() => {
    if (!isEditing) setEditedGoals(goals)
  }, [goals, isEditing])

  const handleSaveGoals = async () => {
    try {
      const res = await fetch('/api/nutrition/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goals: editedGoals })
      })
      if (res.ok) {
        onPersonalGoalsSaved?.(editedGoals)
        setIsEditing(false)
        toast.success('Goals saved')
      } else {
        toast.error('Failed to save goals')
      }
    } catch (err) {
      console.error('Failed to save goals:', err)
      toast.error('Failed to save goals')
    }
  }

  const getProgressColor = (current: number, goal: number): string => {
    if (goal <= 0) return 'bg-gray-500'
    const pct = (current / goal) * 100
    if (pct >= 80) return 'bg-emerald-500'
    if (pct >= 50) return 'bg-yellow-500'
    return 'bg-rose-500'
  }

  const getPercentage = (current: number, goal: number): number => {
    if (goal <= 0) return 0
    return Math.min(100, (current / goal) * 100)
  }

  const editable = goalSource === 'personal'

  return (
    <div className="bg-gradient-to-br from-amber-600/20 to-amber-700/20 backdrop-blur-sm rounded-xl p-4 border border-amber-400/30 shadow-2xl hover:shadow-amber-500/20 transition-all duration-300">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-lg font-bold text-white flex items-center">
          <Target className="h-4 w-4 mr-2 text-amber-400" />
          Macro Goals
        </h3>

        {editable && !isEditing ? (
          <button onClick={() => setIsEditing(true)} className="p-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 transition-colors" title="Edit Goals">
            <Edit2 className="w-4 h-4 text-amber-300" />
          </button>
        ) : editable && isEditing ? (
          <div className="flex gap-2">
            <button onClick={handleSaveGoals} className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 transition-colors" title="Save Goals">
              <Check className="w-4 h-4 text-emerald-300" />
            </button>
            <button onClick={() => { setEditedGoals(goals); setIsEditing(false) }} className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 transition-colors" title="Cancel">
              <X className="w-4 h-4 text-rose-300" />
            </button>
          </div>
        ) : null}
      </div>

      <p className="text-[11px] text-amber-200/70 mb-4">
        {goalSource === 'plan'
          ? `From your active plan${planName ? ` · ${planName}` : ''}`
          : 'Personal targets — create a meal plan to override'}
      </p>

      <div className="space-y-4">
        {MACRO_ORDER.map(({ key, label, unit }) => {
          const current = todaysTotals[key]
          const goal = goals[key]
          const hero = key === 'protein'
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs ${hero ? 'text-emerald-300 font-semibold' : 'text-gray-300'}`}>{label}</span>
                {editable && isEditing ? (
                  <input
                    type="number"
                    value={editedGoals[key]}
                    onChange={(e) => setEditedGoals({ ...editedGoals, [key]: parseInt(e.target.value) || 0 })}
                    className="w-20 px-2 py-1 text-xs bg-gray-700 text-white rounded border border-amber-400/30 focus:border-amber-400 focus:outline-none"
                  />
                ) : (
                  <span className="text-xs text-white font-semibold">
                    {Math.round(current)} / {goal} {unit}
                  </span>
                )}
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${getProgressColor(current, goal)}`}
                  style={{ width: `${getPercentage(current, goal)}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {Math.round(getPercentage(current, goal))}% of goal
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
