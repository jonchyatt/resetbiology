'use client'

import { Ruler, Monitor, Smartphone } from 'lucide-react'

interface DistanceGuidanceProps {
  targetDistanceCm: number
  visionType: 'near' | 'far'
}

/**
 * Simple distance guidance component - replaces the broken sensor-based tracker
 * Just tells users what distance to use rather than trying to measure it
 */
export default function DistanceGuidance({
  targetDistanceCm,
  visionType
}: DistanceGuidanceProps) {
  // Convert cm to user-friendly descriptions
  const getDistanceDescription = () => {
    if (visionType === 'near') {
      if (targetDistanceCm <= 25) return "Very close - about a hand's length"
      if (targetDistanceCm <= 40) return "Normal reading distance - about arm's length"
      if (targetDistanceCm <= 60) return "Extended arm's length"
      return "Far near vision - push your arm out fully"
    } else {
      // Far vision - suggest using a larger screen
      if (targetDistanceCm < 200) return "2+ meters (6+ feet) from screen"
      return "3+ meters (10+ feet) - use a TV or large monitor"
    }
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
          {visionType === 'near'
            ? `${targetDistanceCm} cm`
            : `${(targetDistanceCm / 100).toFixed(1)} m`
          }
        </div>
      </div>

      {/* Simple visual guide */}
      <div className="bg-gray-800/50 rounded-lg p-4 mb-3">
        <p className="text-white text-center font-medium mb-2">
          {getDistanceDescription()}
        </p>

        {/* Visual ruler representation */}
        <div className="flex items-center justify-center gap-2 text-gray-400 text-sm">
          {visionType === 'near' ? (
            <>
              <Smartphone className="w-4 h-4" />
              <div className="flex-1 h-1 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full max-w-32"
                   style={{ width: `${Math.min(100, (targetDistanceCm / 60) * 100)}%` }} />
              <span>👁️</span>
            </>
          ) : (
            <>
              <Monitor className="w-4 h-4" />
              <div className="flex-1 h-1 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full" />
              <span>👁️</span>
            </>
          )}
        </div>
      </div>

      {/* Device recommendation */}
      {!isPhoneAppropriate && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm">
          <div className="flex items-center gap-2 text-yellow-300 font-medium">
            <Monitor className="w-4 h-4" />
            <span>Tip: Use a computer or TV for far vision training</span>
          </div>
          <p className="text-yellow-200/70 mt-1 text-xs">
            Far vision exercises work best on larger screens at greater distances.
          </p>
        </div>
      )}

      {/* Quick tips */}
      <div className="mt-3 text-xs text-gray-400 space-y-1">
        {visionType === 'near' ? (
          <>
            <p>• Hold phone at the distance shown above</p>
            <p>• Keep your head still, only move eyes</p>
            <p>• Blink naturally - don't stare without blinking</p>
          </>
        ) : (
          <>
            <p>• Sit at least 2 meters from your screen</p>
            <p>• Use a TV or large monitor if available</p>
            <p>• Ensure good lighting (no screen glare)</p>
          </>
        )}
      </div>
    </div>
  )
}
