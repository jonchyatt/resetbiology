'use client'

import dynamic from 'next/dynamic'

const ScoreVerify = dynamic(
  () => import('@/components/PitchDefender/ScoreVerify'),
  { ssr: false, loading: () => (
    <div className="fixed inset-0 bg-neutral-200 flex items-center justify-center">
      <div className="text-neutral-700 text-lg font-medium animate-pulse">
        Loading Score ⟷ Engraving audit…
      </div>
    </div>
  )}
)

export default function ScoreVerifyPage() {
  return <ScoreVerify />
}
