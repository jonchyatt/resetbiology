'use client'

import dynamic from 'next/dynamic'

const VocalTrainerII = dynamic(
  () => import('@/components/PitchDefender/VocalTrainerII'),
  { ssr: false, loading: () => (
    <div className="fixed inset-0 bg-[#08080f] flex items-center justify-center">
      <div className="text-cyan-400 text-lg font-medium animate-pulse">
        Loading Vocal Trainer II…
      </div>
    </div>
  )}
)

export default function VocalTrainerIIPage() {
  return <VocalTrainerII />
}
