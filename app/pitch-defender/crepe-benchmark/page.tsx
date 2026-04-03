'use client'

import dynamic from 'next/dynamic'

const CrepeBenchmark = dynamic(
  () => import('@/components/PitchDefender/CrepeBenchmark'),
  { ssr: false, loading: () => (
    <div className="fixed inset-0 bg-gray-950 flex items-center justify-center">
      <div className="text-gray-500 text-lg font-medium animate-pulse">
        Loading CREPE Benchmark...
      </div>
    </div>
  )}
)

export default function CrepeBenchmarkPage() {
  return <CrepeBenchmark />
}
