'use client'

import dynamic from 'next/dynamic'
import { Suspense, useState } from 'react'

type Tab = 'nback' | 'pitch'

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

const PitchRecognition = dynamic(
  () => import('@/components/NBack/PitchRecognition'),
  { ssr: false, loading: () => <LoadingSpinner /> }
)

export default function MentalTrainingPage() {
  const [activeTab, setActiveTab] = useState<Tab>('nback')

  return (
    <div className="relative">
      {/* Tab bar — sticky so it's visible regardless of component scroll */}
      <div className="sticky top-0 z-50 flex justify-center py-2 bg-gray-900/90 backdrop-blur-sm border-b border-gray-700/50">
        <div className="flex gap-1 p-1 bg-gray-800/80 rounded-xl border border-gray-700/50">
          <button
            onClick={() => setActiveTab('nback')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'nback'
                ? 'bg-teal-600/80 text-white shadow-lg'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
            }`}
          >
            🧠 N-Back Training
          </button>
          <button
            onClick={() => setActiveTab('pitch')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'pitch'
                ? 'bg-teal-600/80 text-white shadow-lg'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
            }`}
          >
            🎵 Pitch Recognition
          </button>
        </div>
      </div>

      {/* Active component */}
      <Suspense fallback={<LoadingSpinner />}>
        {activeTab === 'nback' ? <NBackTrainer /> : <PitchRecognition />}
      </Suspense>
    </div>
  )
}
