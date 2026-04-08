'use client'

import dynamic from 'next/dynamic'

const VocalTrainer = dynamic(
  () => import('@/components/PitchDefender/VocalTrainer'),
  { ssr: false, loading: () => (
    <div className="fixed inset-0 bg-[#08080f] flex items-center justify-center">
      <div className="text-amber-400 text-lg font-medium animate-pulse">
        Loading Vocal Trainer…
      </div>
    </div>
  )}
)

export default function VocalTrainerPage() {
  return <VocalTrainer />
}
