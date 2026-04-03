'use client'

import dynamic from 'next/dynamic'

const SheetMusicViewer = dynamic(
  () => import('@/components/PitchDefender/SheetMusicViewer'),
  { ssr: false, loading: () => (
    <div className="fixed inset-0 bg-[#0a0a14] flex items-center justify-center">
      <div className="text-gray-500 text-lg font-medium animate-pulse">
        Loading Sheet Music Engine...
      </div>
    </div>
  )}
)

export default function SheetMusicPage() {
  return (
    <div className="min-h-screen bg-[#0a0a14]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800/50">
        <div>
          <h1 className="text-xl font-bold text-white">Sheet Music Viewer</h1>
          <p className="text-xs text-gray-500">Professional notation — OSMD spike (Ode to Joy SATB, 4 clef types)</p>
        </div>
        <a href="/pitch-defender" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
          &larr; Back to Game
        </a>
      </div>

      {/* Sheet Music */}
      <div className="p-4">
        <SheetMusicViewer darkMode={true} zoom={1.0} />
      </div>
    </div>
  )
}
