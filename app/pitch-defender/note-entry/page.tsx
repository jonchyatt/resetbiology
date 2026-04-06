'use client'

import dynamic from 'next/dynamic'

const NoteEntry = dynamic(
  () => import('@/components/PitchDefender/NoteEntry'),
  { ssr: false, loading: () => (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <div className="text-indigo-400 text-lg font-medium animate-pulse">
        Loading Note Entry...
      </div>
    </div>
  )}
)

export default function NoteEntryPage() {
  return <NoteEntry />
}
