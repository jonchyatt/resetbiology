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
  const [currentDistance, setCurrentDistance] = useState<number>(50)
  const [permissionGranted, setPermissionGranted] = useState(false)
  const [useManual, setUseManual] = useState(false)

  useEffect(() => {
    // Check if device orientation API is available
    if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
      // Request permission on iOS 13+
      if (
        typeof (DeviceOrientationEvent as any).requestPermission === 'function'
      ) {
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
        // Permission not required (Android, desktop)
        setPermissionGranted(true)
        startTracking()
      }
    } else {
      setUseManual(true)
    }
  }, [])

  const startTracking = () => {
    // Simple distance estimation based on device tilt
    // This is a rough approximation - real implementation would use camera API
    window.addEventListener('deviceorientation', handleOrientation)
  }

  const handleOrientation = (event: DeviceOrientationEvent) => {
    const beta = event.beta || 0 // Forward/back tilt in degrees (-180 to 180)

    // Map tilt angle to distance
    // Assuming: 90° (vertical) = near distance, 45° = mid, 0° (flat) = far
    let estimatedDistance = 40 // Default near vision distance in cm

    if (visionType === 'near') {
      // Near vision: 16-24 inches (40-60 cm)
      estimatedDistance = 40 + Math.abs(90 - Math.abs(beta))
    } else {
      // Far vision: Convert to meters for far vision
      // This is simplified - real app would need camera-based distance measurement
      const meters = 3 + (Math.abs(beta) / 10)
      estimatedDistance = meters * 100 // Convert to cm for consistency
    }

    setCurrentDistance(Math.round(estimatedDistance))
    onDistanceChange(Math.round(estimatedDistance))
  }

  useEffect(() => {
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation)
    }
  }, [])

  const distanceDifference = currentDistance - targetDistanceCm
  const isInRange = Math.abs(distanceDifference) < (visionType === 'near' ? 5 : 30)

  return (
    <div className="bg-gray-900/40 border border-primary-400/30 rounded-lg p-4 shadow-inner">
      {/* Distance display */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Ruler className="w-5 h-5 text-primary-400" />
          <span className="text-white font-semibold">Distance Tracking</span>
        </div>
        <div className={`text-2xl font-bold ${isInRange ? 'text-secondary-400' : 'text-yellow-400'}`}>
          {visionType === 'near'
            ? `${currentDistance} cm`
            : `${(currentDistance / 100).toFixed(1)} m`
          }
        </div>
      </div>

      {/* Visual indicator */}
      <div className="mb-3">
        <div className="bg-gray-700 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isInRange ? 'bg-secondary-400' : 'bg-yellow-400'
            }`}
            style={{
              width: `${Math.min(100, Math.max(0, (currentDistance / (targetDistanceCm * 2)) * 100))}%`
            }}
          />
        </div>
      </div>

      {/* Guidance text */}
      <div className="text-sm">
        {isInRange ? (
          <p className="text-secondary-400 font-semibold">✓ Perfect distance!</p>
        ) : distanceDifference > 0 ? (
          <p className="text-yellow-400">
            Move closer (
            {visionType === 'near'
              ? `${Math.abs(distanceDifference)} cm too far`
              : `${(Math.abs(distanceDifference) / 100).toFixed(1)} m too far`
            })
          </p>
        ) : (
          <p className="text-yellow-400">
            Move back (
            {visionType === 'near'
              ? `${Math.abs(distanceDifference)} cm too close`
              : `${(Math.abs(distanceDifference) / 100).toFixed(1)} m too close`
            })
          </p>
        )}
      </div>

      {/* Manual override for devices without sensors */}
      {useManual && (
        <div className="mt-4 pt-4 border-t border-gray-600">
          <label className="text-white text-sm block mb-2">
            Manual Distance Control:
          </label>
          <input
            type="range"
            min={visionType === 'near' ? 30 : 100}
            max={visionType === 'near' ? 80 : 800}
            value={currentDistance}
            onChange={(e) => {
              const val = parseInt(e.target.value)
              setCurrentDistance(val)
              onDistanceChange(val)
            }}
            className="w-full"
          />
          <p className="text-xs text-gray-400 mt-1">
            Use slider if device sensors aren't available
          </p>
        </div>
      )}

      {/* Target distance info */}
      <div className="mt-3 text-xs text-gray-400 text-center">
        Target: {visionType === 'near' ? `${targetDistanceCm} cm` : `${(targetDistanceCm / 100).toFixed(1)} m`}
      </div>
    </div>
  )
}
