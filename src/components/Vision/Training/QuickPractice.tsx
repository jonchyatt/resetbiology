'use client'

import { useState } from 'react'
import {
  Play,
  Clock,
  Zap,
  Eye,
  Brain,
  Target,
  ChevronRight,
  Filter,
  Sparkles,
  Volume2
} from 'lucide-react'
import { visionExercises, VisionExercise } from '@/data/visionExercises'
import GuidedExercise from './GuidedExercise'

const CATEGORY_CONFIG = {
  downshift: { icon: Eye, color: 'blue', label: 'Relaxation' },
  mechanics: { icon: Target, color: 'cyan', label: 'Eye Mechanics' },
  peripheral: { icon: Sparkles, color: 'purple', label: 'Peripheral Vision' },
  speed: { icon: Zap, color: 'yellow', label: 'Speed Training' },
  integration: { icon: Brain, color: 'green', label: 'Integration' },
}

type CategoryFilter = 'all' | VisionExercise['category']

export default function QuickPractice() {
  const [selectedExercise, setSelectedExercise] = useState<VisionExercise | null>(null)
  const [filter, setFilter] = useState<CategoryFilter>('all')
  const [completedToday, setCompletedToday] = useState<string[]>([])

  const filteredExercises = filter === 'all'
    ? visionExercises
    : visionExercises.filter(e => e.category === filter)

  // Group exercises by category for better organization
  const exercisesByCategory = visionExercises.reduce((acc, exercise) => {
    if (!acc[exercise.category]) acc[exercise.category] = []
    acc[exercise.category].push(exercise)
    return acc
  }, {} as Record<string, VisionExercise[]>)

  const handleExerciseComplete = () => {
    if (selectedExercise) {
      setCompletedToday(prev => [...prev, selectedExercise.id])
      // Could save to API here
    }
    setSelectedExercise(null)
  }

  // Show guided exercise if one is selected
  if (selectedExercise) {
    return (
      <GuidedExercise
        exercise={selectedExercise}
        onComplete={handleExerciseComplete}
        onBack={() => setSelectedExercise(null)}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 border border-primary-400/30 rounded-2xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
              <Play className="w-6 h-6 text-primary-400" />
              Quick Practice
            </h2>
            <p className="text-gray-300">
              Jump into any exercise for a quick training session. Each exercise includes
              audio guidance and visual cues.
            </p>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <Volume2 className="w-5 h-5" />
            <span className="text-sm">Audio Guided</span>
          </div>
        </div>

        {/* Stats */}
        {completedToday.length > 0 && (
          <div className="mt-4 bg-secondary-500/10 border border-secondary-400/20 rounded-lg p-3">
            <p className="text-sm text-secondary-300">
              <span className="font-bold">{completedToday.length}</span> exercise{completedToday.length !== 1 ? 's' : ''} completed today
            </p>
          </div>
        )}
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            filter === 'all'
              ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
              : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700'
          }`}
        >
          All Exercises
        </button>
        {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
          const Icon = config.icon
          return (
            <button
              key={key}
              onClick={() => setFilter(key as CategoryFilter)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                filter === key
                  ? `bg-${config.color}-500/30 text-white border border-${config.color}-400/50`
                  : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {config.label}
            </button>
          )
        })}
      </div>

      {/* Exercise Grid */}
      {filter === 'all' ? (
        // Grouped by category view
        <div className="space-y-8">
          {Object.entries(exercisesByCategory).map(([category, exercises]) => {
            const config = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG]
            const Icon = config?.icon || Target

            return (
              <div key={category}>
                <div className="flex items-center gap-2 mb-4">
                  <Icon className={`w-5 h-5 text-${config?.color || 'gray'}-400`} />
                  <h3 className="text-lg font-semibold text-white capitalize">
                    {config?.label || category}
                  </h3>
                  <span className="text-sm text-gray-500">({exercises.length})</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {exercises.map(exercise => (
                    <ExerciseCard
                      key={exercise.id}
                      exercise={exercise}
                      isCompleted={completedToday.includes(exercise.id)}
                      onSelect={() => setSelectedExercise(exercise)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        // Filtered flat view
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredExercises.map(exercise => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              isCompleted={completedToday.includes(exercise.id)}
              onSelect={() => setSelectedExercise(exercise)}
            />
          ))}
        </div>
      )}

      {/* Quick Tips */}
      <div className="bg-blue-500/10 border border-blue-400/20 rounded-xl p-4">
        <h4 className="text-blue-300 font-semibold mb-2">Quick Practice Tips</h4>
        <ul className="text-sm text-blue-200/70 space-y-1">
          <li>• Start with a Downshift exercise to relax your eyes</li>
          <li>• Follow the visual guides - keep your head still</li>
          <li>• Use headphones for the best audio guidance experience</li>
          <li>• Take breaks if you feel any eye strain</li>
        </ul>
      </div>
    </div>
  )
}

interface ExerciseCardProps {
  exercise: VisionExercise
  isCompleted: boolean
  onSelect: () => void
}

function ExerciseCard({ exercise, isCompleted, onSelect }: ExerciseCardProps) {
  const config = CATEGORY_CONFIG[exercise.category]
  const Icon = config?.icon || Target

  return (
    <div
      className={`relative bg-gray-900/40 border rounded-xl p-5 transition-all hover:border-primary-400/50 cursor-pointer group ${
        isCompleted ? 'border-secondary-400/30' : 'border-gray-700/50'
      }`}
      onClick={onSelect}
    >
      {isCompleted && (
        <div className="absolute top-3 right-3 bg-secondary-500/20 text-secondary-400 text-xs px-2 py-1 rounded-full">
          Completed
        </div>
      )}

      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-xl bg-${config?.color || 'gray'}-500/20`}>
          <Icon className={`w-6 h-6 text-${config?.color || 'gray'}-400`} />
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-lg font-semibold text-white mb-1 group-hover:text-primary-300 transition-colors">
            {exercise.title}
          </h4>
          <p className="text-sm text-gray-400 line-clamp-2 mb-3">
            {exercise.summary}
          </p>

          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {exercise.duration}
            </span>
            <span className={`px-2 py-0.5 rounded-full ${
              exercise.intensity === 'low' ? 'bg-green-500/20 text-green-300' :
              exercise.intensity === 'moderate' ? 'bg-yellow-500/20 text-yellow-300' :
              'bg-red-500/20 text-red-300'
            }`}>
              {exercise.intensity}
            </span>
            {exercise.equipment && exercise.equipment.length > 0 && (
              <span className="text-gray-500">
                Needs: {exercise.equipment[0]}
              </span>
            )}
          </div>
        </div>

        <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-primary-400 transition-colors" />
      </div>

      {/* Focus areas */}
      {exercise.focus && exercise.focus.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {exercise.focus.slice(0, 3).map(f => (
            <span key={f} className="text-xs px-2 py-0.5 bg-gray-800/50 rounded text-gray-400">
              {f}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
