'use client'

import { Ruler, Monitor, Smartphone } from 'lucide-react'

interface DistanceGuidanceProps {
  targetDistanceCm: number
  visionType: 'near' | 'far'
  deviceMode?: 'phone' | 'desktop'
}

// Simple distance guidance (text-only) so users know how to position themselves.
export default function DistanceGuidance({
  targetDistanceCm,
  visionType,
  deviceMode = 'phone'
}: DistanceGuidanceProps) {
  const getDistanceDescription = () => {
    if (visionType === 'near') {
      if (targetDistanceCm <= 25) return "Very close - about a hand's length"
      if (targetDistanceCm <= 40) return "Normal reading distance - about arm's length"
      if (targetDistanceCm <= 60) return "Extended arm's length"
      return 'Far near vision - push your arm out fully'
    }
    if (targetDistanceCm < 200) return 'Use a desk setup; target ~80cm+'
    return 'Use a TV/monitor at 2–3m for far checks'
  }

  const isPhoneAppropriate = visionType === 'near' || targetDistanceCm <= 100

  return (
    <div className="bg-gray-900/40 border border-primary-400/30 rounded-lg p-4 shadow-inner">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Ruler className="w-5 h-5 text-primary-400" />
          <span className="text-white font-semibold">Distance Guide</span>
        </div>
        <div className="text-xl font-bold text-secondary-400">
          {visionType === 'near' ? `${targetDistanceCm} cm` : `${(targetDistanceCm / 100).toFixed(1)} m`}
        </div>
      </div>

      <div className="bg-gray-800/50 rounded-lg p-4 mb-3">
        <p className="text-white text-center font-medium mb-2">
          {getDistanceDescription()}
        </p>

        <div className="flex items-center justify-center gap-2 text-gray-400 text-sm">
          {visionType === 'near' ? (
            <>
              <Smartphone className="w-4 h-4" />
              <div
                className="flex-1 h-1 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full max-w-32"
                style={{ width: `${Math.min(100, (targetDistanceCm / 60) * 100)}%` }}
              />
              <span>Eye</span>
            </>
          ) : (
            <>
              <Monitor className="w-4 h-4" />
              <div className="flex-1 h-1 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full" />
              <span>Eye</span>
            </>
          )}
        </div>
      </div>

      {!isPhoneAppropriate && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm">
          <div className="flex items-center gap-2 text-yellow-300 font-medium">
            <Monitor className="w-4 h-4" />
            <span>Use a computer/TV for far vision training</span>
          </div>
          <p className="text-yellow-200/70 mt-1 text-xs">
            Larger screens make tiny lines legible at distance.
          </p>
        </div>
      )}

      <div className="mt-3 text-xs text-gray-400 space-y-1">
        {visionType === 'near' ? (
          <>
            <p>• Hold your {deviceMode === 'phone' ? 'phone' : 'screen'} at the distance shown above</p>
            <p>• Keep your head still, move only your eyes</p>
            <p>• Blink naturally</p>
          </>
        ) : (
          <>
            <p>• Desktop: aim ~80cm; TV: 2–3m</p>
            <p>• Use a large monitor if possible</p>
            <p>• Avoid glare; keep room lighting even</p>
          </>
        )}
      </div>
    </div>
  )
}
