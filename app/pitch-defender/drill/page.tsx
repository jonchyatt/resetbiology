'use client'

import dynamic from 'next/dynamic'

const DrillMode = dynamic(
  () => import('@/components/PitchDefender/DrillMode'),
  { ssr: false, loading: () => (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <div className="text-gray-500 text-lg font-medium animate-pulse">
        Loading Note Drill...
      </div>
    </div>
  )}
)

export default function DrillPage() {
  return <DrillMode />
}
