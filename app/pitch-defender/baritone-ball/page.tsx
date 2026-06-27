'use client'

import dynamic from 'next/dynamic'

const BaritoneBallTrainer = dynamic(
  () => import('@/components/PitchDefender/BaritoneBallTrainer'),
  { ssr: false, loading: () => (
    <div className="fixed inset-0 bg-[#08080f] flex items-center justify-center">
      <div className="text-amber-400 text-lg font-medium animate-pulse">Loading…</div>
    </div>
  )}
)

export default function BaritoneBallPage() {
  return <BaritoneBallTrainer />
}
