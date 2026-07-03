'use client'

import { useEffect, useState } from 'react'
import { Ruler } from 'lucide-react'

interface DistanceTrackerProps {
  targetDistanceCm: number
  onDistanceChange: (distanceCm: number) => void
  visionType: 'near' | 'far'
}

export default function DistanceTracker({
  targetDistanceCm,
  onDistanceChange,
  visionType
}: DistanceTrackerProps) {
  const minDistanceCm = visionType === 'near' ? 20 : 60
  const maxDistanceCm = visionType === 'near' ? 60 : 100
  const clampDistance = (distanceCm: number) => {
    return Math.min(maxDistanceCm, Math.max(minDistanceCm, Math.round(distanceCm)))
  }

  const [currentDistance, setCurrentDistance] = useState<number>(clampDistance(targetDistanceCm || 50))
  const [permissionGranted, setPermissionGranted] = useState(false)
  const [useManual, setUseManual] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        (DeviceOrientationEvent as any).requestPermission()
          .then((response: string) => {
            if (response === 'granted') {
              setPermissionGranted(true)
              startTracking()
            } else {
              setUseManual(true)
            }
          })
          .catch(() => setUseManual(true))
      } else {
        setPermissionGranted(true)
        startTracking()
      }
    } else {
      setUseManual(true)
    }
  }, [])

  const updateDistance = (distanceCm: number) => {
    const nextDistance = clampDistance(distanceCm)
    setCurrentDistance(nextDistance)
    onDistanceChange(nextDistance)
  }

  const startTracking = () => {
    window.addEventListener('deviceorientation', handleOrientation)
  }

  const handleOrientation = (event: DeviceOrientationEvent) => {
    const beta = event.beta || 0
    const tiltOffset = Math.min(40, Math.abs(90 - Math.abs(beta)))
    const estimatedDistance = visionType === 'near'
      ? 20 + tiltOffset
      : 60 + tiltOffset

    updateDistance(estimatedDistance)
  }

  useEffect(() => {
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation)
    }
  }, [])

  const distanceDifference = currentDistance - targetDistanceCm
  const isInRange = Math.abs(distanceDifference) < (visionType === 'near' ? 5 : 10)

  return (
    <div className="bg-gray-900/40 border border-primary-400/30 rounded-lg p-4 shadow-inner">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Ruler className="w-5 h-5 text-primary-400" />
          <span className="text-white font-semibold">Distance Tracking</span>
        </div>
        <div className={`text-2xl font-bold ${isInRange ? 'text-secondary-400' : 'text-yellow-400'}`}>
          {currentDistance} cm
        </div>
      </div>

      <div className="mb-3">
        <div className="bg-gray-700 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${isInRange ? 'bg-secondary-400' : 'bg-yellow-400'}`}
            style={{
              width: `${Math.min(100, Math.max(0, ((currentDistance - minDistanceCm) / (maxDistanceCm - minDistanceCm)) * 100))}%`
            }}
          />
        </div>
      </div>

      <div className="text-sm">
        {isInRange ? (
          <p className="text-secondary-400 font-semibold">Perfect distance.</p>
        ) : distanceDifference > 0 ? (
          <p className="text-yellow-400">Move closer ({Math.abs(distanceDifference)} cm too far).</p>
        ) : (
          <p className="text-yellow-400">Move back ({Math.abs(distanceDifference)} cm too close).</p>
        )}
      </div>

      {useManual && (
        <div className="mt-4 pt-4 border-t border-gray-600">
          <label className="text-white text-sm block mb-2">
            Manual Distance Control:
          </label>
          <input
            type="range"
            min={minDistanceCm}
            max={maxDistanceCm}
            value={currentDistance}
            onChange={(event) => updateDistance(parseInt(event.target.value))}
            className="w-full"
          />
          <p className="text-xs text-gray-400 mt-1">
            Use slider if device sensors are not available.
          </p>
        </div>
      )}

      <div className="mt-3 text-xs text-gray-400 text-center">
        Target: {clampDistance(targetDistanceCm)} cm
      </div>
    </div>
  )
}
