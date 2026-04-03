'use client'

import dynamic from 'next/dynamic'

const PitchTester = dynamic(
  () => import('@/components/PitchDefender/PitchTester'),
  { ssr: false, loading: () => (
    <div className="fixed inset-0 bg-[#08080f] flex items-center justify-center">
      <div className="text-gray-500 text-lg font-medium animate-pulse">
        Loading Staff Tester...
      </div>
    </div>
  )}
)

export default function StaffTesterPage() {
  return <PitchTester />
}
