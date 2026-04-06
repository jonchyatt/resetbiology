'use client'

import dynamic from 'next/dynamic'

const ChoirPractice = dynamic(
  () => import('@/components/PitchDefender/ChoirPractice'),
  { ssr: false, loading: () => (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <div className="text-indigo-400 text-lg font-medium animate-pulse">
        Loading Choir Practice...
      </div>
    </div>
  )}
)

export default function ChoirPracticePage() {
  return <ChoirPractice />
}
