'use client'

import type { CSSProperties } from 'react'

interface PitchforksChargeBarProps {
  progress: number
  className?: string
  width?: number
  height?: number
  style?: CSSProperties
}

export default function PitchforksChargeBar({
  progress,
  className = '',
  width = 160,
  height = 8,
  style,
}: PitchforksChargeBarProps) {
  if (progress <= 0) return null

  const pct = Math.max(0, Math.min(1, progress))
  const isLocked = pct >= 0.8

  return (
    <div
      className={`pointer-events-none rounded-full overflow-hidden ${className}`}
      style={{
        width,
        height,
        background: 'rgba(40,40,60,0.7)',
        boxShadow: '0 0 12px rgba(0,0,0,0.6)',
        ...style,
      }}
      aria-hidden="true"
    >
      <div
        className="h-full rounded-full transition-[width] duration-75 ease-linear"
        style={{
          width: `${pct * 100}%`,
          background: isLocked ? '#4ade80' : '#fbbf24',
          boxShadow: isLocked ? '0 0 10px #4ade80' : '0 0 6px #fbbf24',
        }}
      />
    </div>
  )
}
