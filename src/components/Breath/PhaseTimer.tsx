"use client"

import { motion } from "framer-motion"

interface PhaseTimerProps {
  timeMs: number
  phase: string
  isActive: boolean
  className?: string
}

export function PhaseTimer({ timeMs, phase, isActive, className = "" }: PhaseTimerProps) {
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    
    if (minutes > 0) {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`
    }
    return `${seconds}s`
  }

  const getTextColor = () => {
    if (!isActive) return 'text-gray-600'
    
    switch (phase) {
      case 'breathing':
        return 'text-blue-700'
      case 'exhale_hold':
        return 'text-amber-700'
      case 'inhale_hold':
        return 'text-green-700'
      case 'complete':
        return 'text-purple-700'
      default:
        return 'text-gray-800'
    }
  }

  return (
    <div className={`text-center ${className}`}>
      <motion.div
        className={`font-mono text-6xl md:text-7xl font-bold ${getTextColor()} tabular-nums drop-shadow-lg`}
        style={{ textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
        animate={{ 
          scale: isActive ? [1, 1.05, 1] : 1,
          opacity: isActive ? 1 : 0.7
        }}
        transition={{ 
          scale: { duration: 1, repeat: isActive ? Infinity : 0, ease: "easeInOut" },
          opacity: { duration: 0.3 }
        }}
      >
        {formatTime(timeMs)}
      </motion.div>
      
      {phase && (
        <div className="mt-2">
          <span className={`text-xl font-semibold ${getTextColor()} uppercase tracking-wider drop-shadow-md`}>
            {phase.replace('_', ' ')}
          </span>
        </div>
      )}
    </div>
  )
}