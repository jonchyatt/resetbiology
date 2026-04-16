'use client'

import dynamic from 'next/dynamic'

const NoteTutor = dynamic(
  () => import('@/components/PitchDefender/NoteTutor'),
  { ssr: false, loading: () => (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <div className="text-gray-500 text-lg font-medium animate-pulse">
        Loading Note Tutor...
      </div>
    </div>
  )}
)

export default function NoteTutorPage() {
  return <NoteTutor />
}
