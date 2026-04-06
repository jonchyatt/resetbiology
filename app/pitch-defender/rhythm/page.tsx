'use client'

import dynamic from 'next/dynamic'

const RhythmClap = dynamic(
  () => import('@/components/PitchDefender/RhythmClap'),
  { ssr: false, loading: () => (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <div className="text-red-400 text-lg font-medium animate-pulse">
        Loading Rhythm Clap...
      </div>
    </div>
  )}
)

export default function RhythmPage() {
  return <RhythmClap />
}
