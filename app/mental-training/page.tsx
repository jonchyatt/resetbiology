'use client'

import dynamic from 'next/dynamic'

const LoadingSpinner = () => (
  <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400 mx-auto mb-4"></div>
      <p className="text-gray-400">Loading...</p>
    </div>
  </div>
)

const NBackTrainer = dynamic(
  () => import('@/components/NBack/NBackTrainer'),
  { ssr: false, loading: () => <LoadingSpinner /> }
)

// The Pitch Recognition tab duplicated /ear-training and is no longer offered here.
export default function MentalTrainingPage() {
  return <NBackTrainer />
}
