"use client"
import { useMemo, useState } from "react"
import { X, Search } from "lucide-react"
import { exercises } from "@/data/exercises"

export interface ExerciseDef { 
  name: string
  category: string
  equipment?: string
  primaryMuscle?: string 
}

export function ExerciseLibrary({ onPick, onClose }: { 
  onPick: (ex: ExerciseDef) => void
  onClose: () => void 
}) {
  const [q, setQ] = useState("")
  
  const results = useMemo(() => {
    const n = q.toLowerCase().trim()
    if (!n) return exercises.slice(0, 50)
    return exercises.filter(e => 
      e.name.toLowerCase().includes(n) || 
      e.category.toLowerCase().includes(n) || 
      (e.primaryMuscle?.toLowerCase().includes(n))
    ).slice(0, 100)
  }, [q])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-gradient-to-br from-gray-800/90 to-gray-900/90 border border-primary-400/30 rounded-xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-lg">Exercise Library</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-white">
            <X className="h-5 w-5"/>
          </button>
        </div>
        
        <div className="flex items-center bg-gray-800 border border-gray-700 rounded-lg px-3">
          <Search className="h-4 w-4 text-gray-400 mr-2"/>
          <input 
            value={q} 
            onChange={(e) => setQ(e.target.value)} 
            placeholder="Search exercises" 
            className="w-full bg-transparent py-2 text-gray-200 placeholder-gray-500 focus:outline-none"
          />
        </div>
        
        <div className="mt-4 max-h-[50vh] overflow-auto rounded-lg border border-gray-700">
          {results.map((e) => (
            <button 
              key={e.name} 
              onClick={() => onPick(e)} 
              className="w-full text-left p-3 border-b border-gray-800 hover:bg-gray-800/60"
            >
              <p className="text-white font-medium">{e.name}</p>
              <p className="text-gray-400 text-sm">
                {e.category}
                {e.primaryMuscle ? ` • ${e.primaryMuscle}` : ''}
                {e.equipment ? ` • ${e.equipment}` : ''}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}