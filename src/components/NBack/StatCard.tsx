import React from 'react'
import type { ReactNode } from 'react'
import { formatAccuracy } from '@/lib/formatAccuracy'

// Accuracy is null when a channel had nothing to score (no matches, no presses): shown as an en dash.
export function StatCard({
  icon, label, hits, misses, falses, accuracy
}: {
  icon: ReactNode
  label: string
  hits: number
  misses: number
  falses: number
  accuracy: number | null
}) {
  return (
    <div className="bg-gray-800/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold text-white">{label}</h3>
        </div>
        <span className={`text-lg font-bold ${
          accuracy === null ? 'text-gray-400' : accuracy >= 80 ? 'text-green-400' : accuracy >= 60 ? 'text-yellow-400' : 'text-red-400'
        }`}>
          {formatAccuracy(accuracy)}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="text-center">
          <p className="text-gray-500 text-xs">Hits</p>
          <p className="text-green-400 font-bold">{hits}</p>
        </div>
        <div className="text-center">
          <p className="text-gray-500 text-xs">Misses</p>
          <p className="text-red-400 font-bold">{misses}</p>
        </div>
        <div className="text-center">
          <p className="text-gray-500 text-xs">False</p>
          <p className="text-orange-400 font-bold">{falses}</p>
        </div>
      </div>
    </div>
  )
}
