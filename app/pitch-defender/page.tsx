'use client'

import dynamic from 'next/dynamic'

// Dynamic import with SSR disabled — Three.js and Web Audio require browser APIs
const PitchDefender = dynamic(
  () => import('@/components/PitchDefender/PitchDefender'),
  { ssr: false, loading: () => (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <div className="text-gray-500 text-lg font-medium animate-pulse">
        Loading Pitch Defender...
      </div>
    </div>
  )}
)

export default function PitchDefenderPage() {
  return <PitchDefender />
}
