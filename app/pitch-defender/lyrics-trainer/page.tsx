'use client'

import dynamic from 'next/dynamic'

const LyricsTrainer = dynamic(
  () => import('@/components/PitchDefender/LyricsTrainer'),
  { ssr: false, loading: () => (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <div className="text-gray-500 text-lg font-medium animate-pulse">
        Loading Lyrics Trainer...
      </div>
    </div>
  )}
)

export default function LyricsTrainerPage() {
  return <LyricsTrainer />
}
