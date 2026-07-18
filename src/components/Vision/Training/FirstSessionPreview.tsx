'use client'

import { useState } from 'react'
import { Sparkles, Play } from 'lucide-react'
import { visionExercises } from '@/data/visionExercises'
import { getEngine } from '@/components/Vision/Engines'
import { resolvePrescription } from '@/lib/vision/prescription'
import { prefersReducedMotion } from '@/lib/vision/canvasKit'

// W2b.1 (plan §Tier 2b, HIGH): the shortest valid coached win, BEFORE the enrollment ask.
// Fixed to palming-reset — gentlest exercise in the catalog (low intensity, pure breath +
// visual rest, zero user-input pressure) so a first-touch visitor can't "fail" it.
const PREVIEW_EXERCISE = visionExercises.find(e => e.id === 'palming-reset')!

interface FirstSessionPreviewProps {
  onEnroll: () => void
  enrolling?: boolean
  onExit: () => void
}

export default function FirstSessionPreview({ onEnroll, enrolling, onExit }: FirstSessionPreviewProps) {
  const [done, setDone] = useState(false)

  if (!done) {
    const Engine = getEngine(PREVIEW_EXERCISE.id)!
    const prescription = resolvePrescription(PREVIEW_EXERCISE.id, 0)
    if (prefersReducedMotion()) {
      prescription.speedMultiplier = Math.min(prescription.speedMultiplier, 0.6)
    }
    return (
      <div className="min-h-[70vh] flex flex-col">
        <Engine
          exercise={PREVIEW_EXERCISE}
          prescription={prescription}
          onComplete={() => setDone(true)}
          onExit={onExit}
        />
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-r from-primary-600/30 to-secondary-600/30 backdrop-blur-sm rounded-xl p-8 border border-primary-400/30 shadow-2xl text-center space-y-4">
      <Sparkles className="w-10 h-10 text-secondary-300 mx-auto" />
      <h2 className="text-2xl font-bold text-white">That's one rep in. 60 more, and you own the whole arc.</h2>
      <p className="text-gray-300 max-w-xl mx-auto">
        You just did the first move of the 12-week program. Every session from here is coached the
        same way — timed, guided, measured. Claim the rest of the journey.
      </p>
      <button
        onClick={onEnroll}
        disabled={enrolling}
        className="px-8 py-4 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white font-bold text-lg rounded-xl transition-all duration-300 hover:scale-105 shadow-lg shadow-primary-500/30 flex items-center gap-2 mx-auto"
      >
        {enrolling ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Claiming...
          </>
        ) : (
          <>
            <Play className="w-5 h-5" />
            Claim Your Journey
          </>
        )}
      </button>
      <button onClick={onExit} className="block mx-auto text-sm text-gray-500 hover:text-gray-300 transition-colors">
        Not yet — let me look around first
      </button>
    </div>
  )
}
