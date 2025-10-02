"use client"

import { motion } from "framer-motion"
import { BreathState } from "@/types/breath"

interface BreathOrbProps {
  state: BreathState
  isInhale: boolean
  progress: number
  motionReduced: boolean
  currentHoldDuration?: number
}

export function BreathOrb({ state, isInhale, progress, motionReduced, currentHoldDuration = 0 }: BreathOrbProps) {
  const getStateColor = () => {
    switch (state) {
      case 'breathing_active':
        return isInhale ? 'from-blue-400 to-blue-600' : 'from-blue-300 to-blue-500'
      case 'exhale_hold_ready':
      case 'exhale_hold_active':
        return 'from-amber-400 to-orange-500'
      case 'inhale_hold_ready':
      case 'inhale_hold_active':
        return 'from-green-400 to-emerald-500'
      case 'cycle_complete':
        return 'from-purple-400 to-purple-600'
      case 'paused':
        return 'from-gray-400 to-gray-600'
      case 'session_complete':
        return 'from-primary-400 to-secondary-500'
      default:
        return 'from-green-300 to-green-500'
    }
  }

  const getScale = () => {
    if (motionReduced) return 1
    
    switch (state) {
      case 'breathing_active':
        return isInhale ? 1.2 : 0.8
      case 'exhale_hold_active':
        return 0.6
      case 'inhale_hold_active':
        return 1.4
      case 'cycle_complete':
      case 'session_complete':
        return 1.1
      default:
        return 1
    }
  }

  const getRingProgress = () => {
    if (state === 'breathing_active') return progress
    if (state === 'exhale_hold_active' || state === 'inhale_hold_active') return 1
    return 0
  }

  return (
    <div className="relative flex items-center justify-center">
      {/* Progress Ring */}
      <svg
        className="absolute w-80 h-80 transform -rotate-90"
        viewBox="0 0 200 200"
      >
        <circle
          cx="100"
          cy="100"
          r="90"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          className="text-gray-300"
        />
        <motion.circle
          cx="100"
          cy="100"
          r="90"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          className="text-primary-400"
          strokeDasharray={565.48} // 2π × 90
          strokeDashoffset={565.48 - (565.48 * getRingProgress())}
          strokeLinecap="round"
          initial={false}
          animate={{
            strokeDashoffset: 565.48 - (565.48 * getRingProgress())
          }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        />
      </svg>

      {/* Main Orb */}
      {motionReduced ? (
        // Static progress bar for reduced motion
        <div className="w-64 h-64 rounded-full border-4 border-gray-300 flex items-center justify-center">
          <div className="w-56 h-4 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className={`h-full bg-gradient-to-r ${getStateColor()}`}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      ) : (
        <motion.div
          className={`w-64 h-64 rounded-full bg-gradient-to-br ${getStateColor()} shadow-2xl flex items-center justify-center border-4 border-white/30`}
          animate={{ 
            scale: getScale(),
            rotate: state === 'session_complete' ? 360 : 0
          }}
          transition={{
            scale: {
              duration: state === 'breathing_active' ? 
                (isInhale ? 3 : 3) : 0.5,
              ease: "easeInOut",
              repeat: state === 'breathing_active' ? Infinity : 0,
              repeatType: "reverse"
            },
            rotate: {
              duration: 2,
              ease: "easeInOut"
            }
          }}
        >
          {/* Inner Glow */}
          <motion.div
            className="w-48 h-48 rounded-full bg-white/20 flex items-center justify-center"
            animate={{ opacity: isInhale ? 0.8 : 0.3 }}
            transition={{ duration: 1, ease: "easeInOut" }}
          >
            {/* Center Indicator */}
            <div className="w-16 h-16 rounded-full bg-white/40 flex items-center justify-center">
              {state === 'breathing_active' && (
                <motion.div
                  className="w-8 h-8 rounded-full bg-white"
                  animate={{ scale: isInhale ? 1.5 : 0.5 }}
                  transition={{ duration: 1, ease: "easeInOut" }}
                />
              )}
              {(state === 'exhale_hold_active' || state === 'inhale_hold_active') && (
                <motion.div
                  className="w-8 h-8 rounded-full bg-white"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* State Label - Only show during active phases, hide "Ready to Begin" */}
      {state !== 'idle' && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <div className="backdrop-blur-sm px-6 py-3 rounded-full text-base font-semibold border transition-all duration-300 bg-black/60 text-white border-white/20 text-center">
            {state === 'breathing_active' && (isInhale ? 'Inhale' : 'Exhale')}
            {state === 'exhale_hold_ready' && 'Ready for Exhale Hold'}
            {state === 'exhale_hold_active' && `Exhale Hold: ${Math.floor(currentHoldDuration / 1000)}s`}
            {state === 'inhale_hold_ready' && 'Ready for Inhale Hold'}
            {state === 'inhale_hold_active' && `Inhale Hold: ${Math.floor(currentHoldDuration / 1000)}s`}
            {state === 'cycle_complete' && 'Cycle Complete'}
            {state === 'paused' && 'Paused'}
            {state === 'session_complete' && 'Session Complete'}
          </div>
        </div>
      )}
    </div>
  )
}