'use client'

import dynamic from 'next/dynamic'

const ScoreVerifyCourt = dynamic(
  () => import('@/components/PitchDefender/ScoreVerifyCourt'),
  { ssr: false, loading: () => (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
      <div className="text-neutral-300 text-lg font-medium animate-pulse">Loading the A4 court read…</div>
    </div>
  )}
)

export default function ScoreVerifyCourtPage() {
  return <ScoreVerifyCourt />
}
