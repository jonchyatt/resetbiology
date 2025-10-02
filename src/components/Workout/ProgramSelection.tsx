"use client"
import { Flame, CheckCircle2 } from "lucide-react"

export function ProgramSelection({ programs, onSelect }: { 
  programs: { 
    key: string
    name: string
    description: string
    frequency: string
    duration: string 
  }[]
  onSelect: (key: string) => void 
}) {
  return (
    <div className="max-w-6xl mx-auto grid gap-6 md:grid-cols-2">
      {programs.map(p => (
        <div key={p.key} className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-white font-semibold text-lg flex items-center gap-2">
                <Flame className="h-5 w-5 text-secondary-400"/>
                {p.name}
              </h4>
              <p className="text-gray-300 text-sm">{p.description}</p>
            </div>
            <button 
              onClick={() => onSelect(p.key)} 
              className="bg-secondary-600 hover:bg-secondary-700 text-white font-medium py-2 px-3 rounded-lg flex items-center"
            >
              <CheckCircle2 className="h-4 w-4 mr-1"/>Load
            </button>
          </div>
          <p className="text-gray-400 text-xs mt-3">{p.frequency} • {p.duration}</p>
        </div>
      ))}
    </div>
  )
}