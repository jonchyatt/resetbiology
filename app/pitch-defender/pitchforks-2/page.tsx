'use client'

import dynamic from 'next/dynamic'

// PitchforksII — sprite-based version with Frankenstein as lightning conductor.
// Lives ALONGSIDE the original Pitchforks at /pitch-defender/pitchforks
// Original is untouched and reachable. Switch back any time.
const PitchforksII = dynamic(
  () => import('@/components/PitchDefender/PitchforksII'),
  { ssr: false, loading: () => (
    <div className="fixed inset-0 bg-[#0a0812] flex items-center justify-center">
      <div className="text-cyan-300 text-lg font-medium animate-pulse" style={{ fontFamily: 'monospace' }}>
        SUMMONING THE STORM...
      </div>
    </div>
  )}
)

export default function PitchforksIIPage() {
  return <PitchforksII />
}
