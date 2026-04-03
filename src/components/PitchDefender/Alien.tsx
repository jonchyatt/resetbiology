'use client'

import { useEffect, useState } from 'react'
import type { AlienState } from './types'

interface AlienProps {
  alien: AlienState
  fieldHeight: number
  isActive: boolean
  onAnimationEnd?: () => void
}

export default function Alien({ alien, fieldHeight, isActive, onAnimationEnd }: AlienProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Trigger spawn animation after mount
    const t = setTimeout(() => setMounted(true), 20)
    return () => clearTimeout(t)
  }, [])

  const hsl = `hsl(${alien.noteHue}, 80%, 60%)`
  const hslDim = `hsl(${alien.noteHue}, 60%, 30%)`
  const hslBright = `hsl(${alien.noteHue}, 90%, 75%)`

  // Horizontal position from lane (0-4)
  const lanePercent = 15 + alien.lane * 17.5 // 15% to 85%

  const isExploding = alien.lifecycle === 'exploding'
  const isHit = alien.lifecycle === 'hit'
  const isEscaped = alien.lifecycle === 'escaped'
  const isDescending = alien.lifecycle === 'descending' || alien.lifecycle === 'spawning'

  return (
    <div
      className="absolute"
      style={{
        left: `${lanePercent}%`,
        top: 0,
        transform: 'translateX(-50%)',
        zIndex: isActive ? 20 : 10,
      }}
    >
      {/* Inner animation container — separate from positioning to avoid transform clobber */}
      <div
        data-alien-id={alien.id}
        style={{
          // Descent animation
          ...(isDescending && mounted ? {
            animation: `alienDescend ${alien.descentDuration}s linear forwards`,
            '--field-height': `${fieldHeight}px`,
          } as React.CSSProperties : {}),
          // Explode
          ...(isExploding ? {
            animation: 'alienExplode 0.5s ease-out forwards',
          } : {}),
          // Escape
          ...(isEscaped ? {
            animation: 'alienEscape 0.4s ease-in forwards',
          } : {}),
        }}
        onAnimationEnd={() => {
          if (isExploding || isEscaped) onAnimationEnd?.()
        }}
      >
      {/* Outer decorative rings */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          width: 88, height: 88,
          marginLeft: -44, marginTop: -44,
          left: '50%', top: '50%',
          border: `2px solid ${hslDim}`,
          animation: isActive ? 'ringPulse 2s ease-in-out infinite' : undefined,
          opacity: 0.3,
          '--alien-color': hsl,
        } as React.CSSProperties}
      />

      {/* Main alien body */}
      <div
        className="relative flex items-center justify-center"
        style={{
          width: alien.isBoss ? 110 : 72,
          height: alien.isBoss ? 110 : 72,
          borderRadius: alien.isBoss ? '20%' : '50%',
          background: `radial-gradient(circle at 40% 35%, ${hslBright}, ${hsl} 50%, ${hslDim} 100%)`,
          boxShadow: isActive
            ? `0 0 20px ${hsl}, 0 0 40px ${hsl}, 0 0 60px ${hsl}40`
            : `0 0 12px ${hsl}60, 0 0 24px ${hsl}30`,
          animation: isActive
            ? `corePulse 1.5s ease-in-out infinite`
            : isHit
            ? 'alienHit 0.2s ease-out'
            : undefined,
          '--alien-color': hsl,
          // Spawn scale
          ...(!mounted ? { transform: 'scale(0)', opacity: 0 } : {}),
          ...(mounted && isDescending && !isExploding ? {
            transition: 'transform 0.3s ease-out, opacity 0.3s',
          } : {}),
        } as React.CSSProperties}
      >
        {/* Inner core(s) — single for normal, multiple for sequence aliens */}
        {alien.sequence && alien.sequence.length > 1 ? (
          // Multi-core: stacked dots showing sequence progress
          <div className="absolute flex flex-col items-center gap-1" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
            {alien.sequence.map((_, i) => {
              const destroyed = i < (alien.coresDestroyed ?? 0)
              const current = i === (alien.coresDestroyed ?? 0)
              return (
                <div key={i} className="rounded-full" style={{
                  width: current ? 14 : 10,
                  height: current ? 14 : 10,
                  background: destroyed
                    ? 'rgba(60, 60, 80, 0.4)'
                    : current
                    ? `radial-gradient(circle, white, ${hslBright})`
                    : `radial-gradient(circle, ${hsl}, ${hslDim})`,
                  boxShadow: current && isActive ? `0 0 8px ${hsl}` : 'none',
                  border: destroyed ? '1px solid rgba(80,80,100,0.3)' : 'none',
                  transition: 'all 0.3s',
                }} />
              )
            })}
          </div>
        ) : (
          // Single core
          <div
            className="absolute rounded-full"
            style={{
              width: 32, height: 32,
              background: `radial-gradient(circle, white 0%, ${hslBright} 60%, transparent 100%)`,
              opacity: isActive ? 0.9 : 0.5,
            }}
          />
        )}

        {/* Geometric accent lines */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border: `1px solid ${hslBright}40`,
            transform: 'rotate(45deg)',
          }}
        />
      </div>

      {/* Active indicator — pulsing outer glow */}
      {isActive && (
        <div
          className="absolute rounded-full"
          style={{
            width: 96, height: 96,
            left: '50%', top: '50%',
            marginLeft: -48, marginTop: -48,
            border: `1px solid ${hsl}60`,
            animation: 'ringPulse 2s ease-in-out infinite 0.5s',
          }}
        />
      )}
      </div>
    </div>
  )
}
