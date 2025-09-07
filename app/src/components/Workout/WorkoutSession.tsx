"use client"
import { Plus, Trash2 } from "lucide-react"
import type { WorkoutSession, SetEntry } from "./WorkoutTracker"

export function WorkoutSessionView({ session, onAddSet, onUpdateSet, onRemoveExercise, onOpenLibrary }: {
  session: WorkoutSession
  onAddSet: (exId: string) => void
  onUpdateSet: (exId: string, idx: number, patch: Partial<SetEntry>) => void
  onRemoveExercise: (exId: string) => void
  onOpenLibrary: () => void
}) {
  return (
    <div>
      <div className="flex justify-end mb-3">
        <button 
          onClick={onOpenLibrary} 
          className="bg-secondary-600 hover:bg-secondary-700 text-white font-medium py-2 px-4 rounded-lg flex items-center"
        >
          <Plus className="h-4 w-4 mr-1"/>Add Exercise
        </button>
      </div>
      
      <div className="space-y-4">
        {session.exercises.map(ex => (
          <div key={ex.id} className="p-4 border border-gray-700 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-white font-semibold">{ex.name}</p>
                <p className="text-gray-400 text-xs">{ex.category}</p>
              </div>
              <button 
                onClick={() => onRemoveExercise(ex.id)} 
                className="text-red-300 hover:text-red-200 text-xs flex items-center gap-1"
              >
                <Trash2 className="h-3 w-3"/>Remove
              </button>
            </div>
            
            <div className="space-y-2">
              {ex.sets.map((s, i) => (
                <div key={i} className="grid grid-cols-3 gap-2 items-center">
                  <label className="text-gray-300 text-sm">
                    Reps
                    <input 
                      type="number" 
                      value={s.reps} 
                      onChange={(e) => onUpdateSet(ex.id, i, { reps: Number(e.target.value) })} 
                      className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-gray-200 ml-2"
                    />
                  </label>
                  
                  <label className="text-gray-300 text-sm">
                    Weight
                    <input 
                      type="number" 
                      value={s.weight} 
                      onChange={(e) => onUpdateSet(ex.id, i, { weight: Number(e.target.value) })} 
                      className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-gray-200 ml-2"
                    />
                  </label>
                  
                  <label className="text-gray-300 text-sm flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      checked={s.completed} 
                      onChange={(e) => onUpdateSet(ex.id, i, { completed: e.target.checked })} 
                    /> 
                    Completed
                  </label>
                </div>
              ))}
              
              <button 
                onClick={() => onAddSet(ex.id)} 
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