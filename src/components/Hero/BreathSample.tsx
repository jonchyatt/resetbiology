"use client"

import { useState, useEffect } from 'react'
import { Wind, X } from 'lucide-react'
import MiniBreathExercise from '@/components/Breath/MiniBreathExercise'

interface BreathExercise {
  id: string
  name: string
  description: string
  inhaleMs: number
  exhaleMs: number
  inhaleHoldMs: number
  exhaleHoldMs: number
  breathsPerCycle: number
  cyclesTarget: number
  backgroundMusic: string | null
  musicVolume: number
}

export function BreathSample() {
  const [showExercise, setShowExercise] = useState(false)
  const [sampleExercise, setSampleExercise] = useState<BreathExercise | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch the sample exercise
  useEffect(() => {
    const fetchSample = async () => {
      try {
        const response = await fetch('/api/breath/exercises?category=sample')
        if (response.ok) {
          const data = await response.json()
          const sample = data.exercises?.find((e: any) => e.isSample)
          if (sample) {
            setSampleExercise(sample)
          }
        }
      } catch (error) {
        console.error('Failed to load sample exercise:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSample()
  }, [])

  if (loading) {
    return null // Don't show anything while loading
  }

  if (!sampleExercise) {
    return null // No sample exercise configured
  }

  return (
    <>
      {/* Trigger Button */}
      <div className="bg-gradient-to-br from-teal-600/20 to-cyan-600/20 backdrop-blur-sm rounded-xl p-4 border border-teal-400/30 shadow-2xl">
        <div className="text-center">
          <Wind className="w-10 h-10 text-teal-400 mx-auto mb-2" />
          <h3 className="text-lg font-bold text-white mb-2">Try Breathing Now</h3>
          <p className="text-sm text-gray-300 mb-4">
            Experience our {sampleExercise.name.toLowerCase()} exercise - no signup required
          </p>
          <button
            onClick={() => setShowExercise(true)}
            className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white py-2 px-4 rounded-lg font-semibold transition-all shadow-lg hover:shadow-teal-400/20"
          >
            Start 2-Min Exercise
          </button>
        </div>
      </div>

      {/* Exercise Modal */}
      {showExercise && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="relative max-w-md w-full">
            <MiniBreathExercise
              exercise={sampleExercise}
              onClose={() => setShowExercise(false)}
              showCloseButton={true}
              compact={false}
            />

            {/* Promo after exercise */}
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-400 mb-2">
                Want more breathing exercises?
              </p>
              <a
                href="/breath"
                className="text-teal-400 hover:text-teal-300 font-medium text-sm"
              >
                Explore Full Breath Training App →
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
