"use client"

import { Plus, Trash2 } from "lucide-react"

export type SetEntry = {
  reps: number
  weight: number
  completed: boolean
}

export type ExerciseEntry = {
  id: string
  name: string
  category: string
  sets: SetEntry[]
}

export type WorkoutSession = {
  id: string
  exercises: ExerciseEntry[]
  duration?: number
  notes?: string | null
}

export function WorkoutSessionView({ session, onAddSet, onUpdateSet, onRemoveExercise, onOpenLibrary }: {
  session: WorkoutSession
  onAddSet: (exerciseId: string) => void
  onUpdateSet: (exerciseId: string, setIndex: number, patch: Partial<SetEntry>) => void
  onRemoveExercise: (exerciseId: string) => void
  onOpenLibrary: () => void
}) {
  return (
    <div>
      <div className="flex justify-end mb-3">
        <button
          onClick={onOpenLibrary}
          className="bg-secondary-600 hover:bg-secondary-700 text-white font-medium py-2 px-4 rounded-lg flex items-center"
        >
          <Plus className="h-4 w-4 mr-1" />Add Exercise
        </button>
      </div>

      <div className="space-y-4">
        {session.exercises.map((exercise) => (
          <div key={exercise.id} className="p-4 border border-gray-700 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-white font-semibold">{exercise.name}</p>
                <p className="text-gray-400 text-xs">{exercise.category}</p>
              </div>
              <button
                onClick={() => onRemoveExercise(exercise.id)}
                className="text-red-300 hover:text-red-200 text-xs flex items-center gap-1"
              >
                <Trash2 className="h-3 w-3" />Remove
              </button>
            </div>

            <div className="space-y-2">
              {exercise.sets.map((set, index) => (
                <div key={index} className="grid grid-cols-3 gap-2 items-center">
                  <label className="text-gray-300 text-sm">
                    Reps
                    <input
                      type="number"
                      value={set.reps}
                      onChange={(event) => onUpdateSet(exercise.id, index, { reps: Number(event.target.value) })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-gray-200 ml-2"
                    />
                  </label>

                  <label className="text-gray-300 text-sm">
                    Weight
                    <input
                      type="number"
                      value={set.weight}
                      onChange={(event) => onUpdateSet(exercise.id, index, { weight: Number(event.target.value) })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-gray-200 ml-2"
                    />
                  </label>

                  <label className="text-gray-300 text-sm flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={set.completed}
                      onChange={(event) => onUpdateSet(exercise.id, index, { completed: event.target.checked })}
                    />
                    Completed
                  </label>
                </div>
              ))}

              <button
                onClick={() => onAddSet(exercise.id)}
                className="mt-2 bg-gray-700 hover:bg-gray-600 text-white text-sm px-3 py-1 rounded-md"
              >
                Add Set
              </button>
            </div>
          </div>
        ))}

        {session.exercises.length === 0 && (
          <p className="text-gray-300">No exercises yet. Add from the library.</p>
        )}
      </div>
    </div>
  )
}
