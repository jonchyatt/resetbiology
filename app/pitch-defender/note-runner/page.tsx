'use client'

import dynamic from 'next/dynamic'

const NoteRunner = dynamic(
  () => import('@/components/PitchDefender/NoteRunner'),
  { ssr: false, loading: () => (
    <div className="fixed inset-0 bg-[#08080f] flex items-center justify-center">
      <div className="text-gray-500 text-lg font-medium animate-pulse">
        Loading Note Runner...
      </div>
    </div>
  )}
)

export default function NoteRunnerPage() {
  return <NoteRunner />
}
