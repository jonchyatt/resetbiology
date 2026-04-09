'use client'

import dynamic from 'next/dynamic'

const SimplySing = dynamic(
  () => import('@/components/PitchDefender/SimplySing'),
  { ssr: false, loading: () => (
    <div className="fixed inset-0 bg-[#0a0817] flex items-center justify-center">
      <div className="text-cyan-300 text-lg font-medium animate-pulse">
        Loading Simply Sing...
      </div>
    </div>
  )}
)

export default function SimplySingPage() {
  return <SimplySing />
}
