'use client'

import dynamic from 'next/dynamic'

const Pitchforks = dynamic(
  () => import('@/components/PitchDefender/Pitchforks'),
  { ssr: false, loading: () => (
    <div className="fixed inset-0 bg-[#0a0812] flex items-center justify-center">
      <div className="text-green-400 text-lg font-medium animate-pulse" style={{ fontFamily: 'monospace' }}>
        THE MONSTER AWAKENS...
      </div>
    </div>
  )}
)

export default function PitchforksPage() {
  return <Pitchforks />
}
