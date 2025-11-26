'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'

// Dynamic import to avoid SSR issues with audio/speech synthesis
const NBackTrainer = dynamic(
  () => import('@/components/NBack/NBackTrainer'),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading Mental Training...</p>
        </div>
      </div>
    )
  }
)

export default function MentalTrainingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading Mental Training...</p>
        </div>
      </div>
    }>
      <NBackTrainer />
    </Suspense>
  )
}
