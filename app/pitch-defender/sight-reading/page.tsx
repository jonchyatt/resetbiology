'use client'

import dynamic from 'next/dynamic'

const SightReading = dynamic(
  () => import('@/components/PitchDefender/SightReading'),
  { ssr: false, loading: () => (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <div className="text-yellow-500 text-lg font-medium animate-pulse">
        Loading Sight Reading...
      </div>
    </div>
  )}
)

export default function SightReadingPage() {
  return <SightReading />
}
