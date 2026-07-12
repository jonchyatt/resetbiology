'use client'

import dynamic from 'next/dynamic'

const RetroBlasterII = dynamic(
  () => import('@/components/PitchDefender/RetroBlasterII'),
  { ssr: false, loading: () => (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <div className="text-gray-500 text-lg font-medium animate-pulse" style={{ fontFamily: 'monospace' }}>
        LOADING...
      </div>
    </div>
  )}
)

export default function RetroTwoPage() {
  return <RetroBlasterII />
}
