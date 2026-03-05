'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'

const LoadingSpinner = () => (
  <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center"
    style={{
      backgroundImage: 'linear-gradient(rgba(0,0,0,0.75), rgba(0,0,0,0.85)), url(/hero-background.jpg)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
    }}>
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-400 mx-auto mb-4"></div>
      <p className="text-gray-400">Loading Ear Training…</p>
    </div>
  </div>
)

const PitchRecognition = dynamic(
  () => import('@/components/NBack/PitchRecognition'),
  { ssr: false, loading: () => <LoadingSpinner /> }
)

export default function EarTrainingPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <PitchRecognition />
    </Suspense>
  )
}
