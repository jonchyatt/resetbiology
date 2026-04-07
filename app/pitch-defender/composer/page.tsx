'use client'

import dynamic from 'next/dynamic'

const Composer = dynamic(
  () => import('@/components/PitchDefender/Composer'),
  { ssr: false, loading: () => (
    <div className="fixed inset-0 bg-[#0b0b14] flex items-center justify-center">
      <div className="text-gray-500 text-lg font-medium animate-pulse">
        Loading Composer...
      </div>
    </div>
  )}
)

export default function ComposerPage() {
  return <Composer />
}
