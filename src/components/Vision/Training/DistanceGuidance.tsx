'use client'

import { Monitor, Ruler, Smartphone } from 'lucide-react'

interface DistanceGuidanceProps {
  targetDistanceCm: number
  visionType: 'near' | 'far'
  deviceMode?: 'phone' | 'desktop'
}

export default function DistanceGuidance({
  targetDistanceCm,
  visionType,
  deviceMode = 'phone'
}: DistanceGuidanceProps) {
  const recommendedRange = deviceMode === 'phone' ? '20-60 cm' : '60-100 cm'

  const getDistanceDescription = () => {
    if (deviceMode === 'phone') {
      if (targetDistanceCm <= 25) return "Close - about a hand's length away"
      if (targetDistanceCm <= 40) return 'Comfortable reading distance'
      return "Extended arm's length - push the blur"
    }

    if (targetDistanceCm <= 60) return 'Close desktop viewing'
    if (targetDistanceCm <= 80) return 'Normal desk distance'
    return 'Extended desk distance - stay within reach'
  }

  const isPhoneAppropriate = deviceMode !== 'phone' || targetDistanceCm <= 60

  return (
    <div className="bg-gray-900/40 border border-primary-400/30 rounded-lg p-4 shadow-inner">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Ruler className="w-5 h-5 text-primary-400" />
          <span className="text-white font-semibold">Distance Guide</span>
        </div>
        <div className="text-xl font-bold text-secondary-400">
          {targetDistanceCm} cm
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

      {!isPhoneAppropriate && deviceMode === 'phone' && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm">
          <div className="flex items-center gap-2 text-yellow-300 font-medium">
            <Monitor className="w-4 h-4" />
            <span>Consider switching to Desktop mode</span>
          </div>
          <p className="text-yellow-200/70 mt-1 text-xs">
            Larger screens work better when training beyond arm's length.
          </p>
        </div>
      )}

      <div className="mt-3 text-xs text-gray-400 space-y-1">
        <p>- Hold your {deviceMode === 'phone' ? 'phone' : 'screen'} at the distance shown above.</p>
        <p>- Recommended {deviceMode === 'phone' ? 'phone' : 'desktop'} range: {recommendedRange}.</p>
        <p>- Keep your head still, move only your eyes.</p>
        <p>- Blink naturally between attempts.</p>
        <p>- Find your edge of clarity, where text is just barely readable.</p>
      </div>
    </div>
  )
}
