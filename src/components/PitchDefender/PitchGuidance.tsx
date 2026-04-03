'use client'

import type { PitchInfo } from './usePitchDetection'

interface PitchGuidanceProps {
  targetNote: string
  pitch: PitchInfo | null
  isLocking: boolean      // true when pitch is within tolerance
  lockProgress: number    // 0-1, how far through the hold duration
}

export default function PitchGuidance({ targetNote, pitch, isLocking, lockProgress }: PitchGuidanceProps) {
  const isActive = pitch?.isActive ?? false
  const cents = pitch?.cents ?? 0
  const detectedNote = pitch?.note ?? ''

  // Clamp cents to visual range (-100 to +100 for display)
  const clampedCents = Math.max(-100, Math.min(100, cents))
  // Map to 0-100% (50% = on target)
  const markerPos = 50 - (clampedCents / 100) * 45

  // Determine feedback state
  const isTooLow = isActive && cents < -15
  const isTooHigh = isActive && cents > 15
  const isClose = isActive && Math.abs(cents) <= 15

  return (
    <div className="absolute pointer-events-none" style={{
      right: -50,
      top: '50%',
      transform: 'translateY(-50%)',
      width: 36,
      height: 120,
    }}>
      {/* Track background */}
      <div className="absolute inset-0 rounded-full" style={{
        background: 'rgba(20, 20, 30, 0.7)',
        border: '1px solid rgba(100, 100, 140, 0.3)',
      }}>
        {/* Target zone (center band) */}
        <div className="absolute left-0 right-0" style={{
          top: '40%',
          height: '20%',
          background: isLocking
            ? `rgba(100, 255, 100, ${0.2 + lockProgress * 0.4})`
            : 'rgba(60, 191, 181, 0.15)',
          borderTop: '1px solid rgba(60, 191, 181, 0.4)',
          borderBottom: '1px solid rgba(60, 191, 181, 0.4)',
        }} />

        {/* Target center line */}
        <div className="absolute left-1 right-1" style={{
          top: '50%',
          height: 2,
          background: isLocking ? '#4ade80' : '#3FBFB5',
          boxShadow: isLocking ? '0 0 8px #4ade80' : '0 0 4px #3FBFB560',
          transform: 'translateY(-50%)',
        }} />

        {/* Voice marker (moving dot) */}
        {isActive && (
          <div className="absolute" style={{
            left: '50%',
            top: `${markerPos}%`,
            transform: 'translate(-50%, -50%)',
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: isClose
              ? '#4ade80'
              : isTooHigh
              ? '#f87171'
              : '#60a5fa',
            boxShadow: isClose
              ? '0 0 12px #4ade80, 0 0 24px #4ade8060'
              : isTooHigh
              ? '0 0 8px #f87171'
              : '0 0 8px #60a5fa',
            transition: 'top 0.05s linear',
          }} />
        )}

        {/* Direction arrows */}
        {isActive && isTooLow && (
          <div className="absolute left-1/2 -translate-x-1/2 text-blue-400 text-xs font-bold"
            style={{ bottom: 4, animation: 'comboFlash 1s ease-in-out infinite' }}>
            ▲
          </div>
        )}
        {isActive && isTooHigh && (
          <div className="absolute left-1/2 -translate-x-1/2 text-red-400 text-xs font-bold"
            style={{ top: 4, animation: 'comboFlash 1s ease-in-out infinite' }}>
            ▼
          </div>
        )}
      </div>

      {/* Lock progress ring */}
      {isLocking && lockProgress > 0 && (
        <div className="absolute -inset-2 rounded-full" style={{
          border: '3px solid transparent',
          borderTopColor: '#4ade80',
          transform: `rotate(${lockProgress * 360}deg)`,
          transition: 'transform 0.1s linear',
          boxShadow: '0 0 8px #4ade8040',
        }} />
      )}

      {/* "LOCKED" text when fully locked */}
      {lockProgress >= 1 && (
        <div className="absolute -right-2 top-1/2 -translate-y-1/2 text-green-400 text-xs font-bold whitespace-nowrap"
          style={{ textShadow: '0 0 8px #4ade80' }}>
          LOCKED
        </div>
      )}
    </div>
  )
}
