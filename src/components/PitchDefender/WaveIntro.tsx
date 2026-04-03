'use client'

import { useEffect, useState } from 'react'

interface WaveIntroProps {
  wave: number
  worldName: string
  worldColor: string
  onComplete: () => void
}

export default function WaveIntro({ wave, worldName, worldColor, onComplete }: WaveIntroProps) {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 600)
    const t2 = setTimeout(() => setPhase('out'), 2000)
    const t3 = setTimeout(() => onComplete(), 2800)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onComplete])

  return (
    <div
      className="absolute inset-0 z-40 flex flex-col items-center justify-center pointer-events-none"
      style={{
        animation: phase === 'in'
          ? 'waveIntroIn 0.6s ease-out forwards'
          : phase === 'out'
          ? 'waveIntroOut 0.8s ease-in forwards'
          : undefined,
      }}
    >
      {/* Wave number */}
      <div
        className="text-6xl font-black text-white tracking-wider"
        style={{
          textShadow: `0 0 30px ${worldColor}, 0 0 60px ${worldColor}60`,
        }}
      >
        WAVE {wave}
      </div>

      {/* World name */}
      <div
        className="mt-3 text-xl font-medium uppercase tracking-[0.3em]"
        style={{ color: worldColor }}
      >
        {worldName}
      </div>

      {/* Decorative line */}
      <div
        className="mt-4 h-px"
        style={{
          width: phase === 'hold' ? 200 : 0,
          background: `linear-gradient(90deg, transparent, ${worldColor}, transparent)`,
          transition: 'width 0.6s ease-out',
        }}
      />
    </div>
  )
}
