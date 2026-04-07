'use client'

import dynamic from 'next/dynamic'

const SynthesiaRunner = dynamic(
  () => import('@/components/PitchDefender/SynthesiaRunner'),
  { ssr: false, loading: () => (
    <div className="fixed inset-0 bg-[#08080f] flex items-center justify-center">
      <div className="text-gray-500 text-lg font-medium animate-pulse">
        Loading Synthesia Runner...
      </div>
    </div>
  )}
)

export default function SynthesiaRunnerPage() {
  return <SynthesiaRunner />
}
