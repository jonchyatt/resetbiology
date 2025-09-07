"use client"

import { useEffect } from "react"
import { Play, Pause, Square, SkipForward } from "lucide-react"
import { BreathState } from "@/types/breath"

interface ControlsProps {
  state: BreathState
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onStartExhaleHold: () => void
  onStartInhaleHold: () => void
  onBeginInhaleHold: () => void
  onEndInhaleHold: () => void
  onNextCycle: () => void
  onEndSession: () => void
  disabled?: boolean
}

export function Controls({
  state,
  onStart,
  onPause,
  onResume,
  onStartExhaleHold,
  onStartInhaleHold,
  onBeginInhaleHold,
  onEndInhaleHold,
  onNextCycle,
  onEndSession,
  disabled = false
}: ControlsProps) {
  
  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if (disabled) return
      
      // Prevent default for our shortcuts
      if (['Space', 'KeyP', 'Escape'].includes(event.code)) {
        event.preventDefault()
      }

      switch (event.code) {
        case 'Space':
          handleSpacePress()
          break
        case 'KeyP':
          if (state === 'paused') {
            onResume()
          } else if (['breathing_active', 'exhale_hold_active', 'inhale_hold_active'].includes(state)) {
            onPause()
          }
          break
        case 'Escape':
          if (state !== 'idle' && state !== 'session_complete') {
            onEndSession()
          }
          break
      }
    }

    const handleSpacePress = () => {
      switch (state) {
        case 'idle':
          onStart()
          break
        case 'exhale_hold_ready':
          onStartExhaleHold()
          break
        case 'exhale_hold_active':
          onStartInhaleHold()
          break
        case 'inhale_hold_active':
          onEndInhaleHold()
          break
        case 'cycle_complete':
          onNextCycle()
          break
      }
    }

    window.addEventListener('keydown', handleKeyboard)
    return () => window.removeEventListener('keydown', handleKeyboard)
  }, [state, disabled, onStart, onPause, onResume, onStartExhaleHold, onStartInhaleHold, onBeginInhaleHold, onEndInhaleHold, onNextCycle, onEndSession])

  const getPrimaryButton = () => {
    switch (state) {
      case 'idle':
        return {
          text: 'Start Session',
          action: onStart,
          icon: <Play className="w-5 h-5 mr-2" />,
          color: 'bg-primary-500 hover:bg-primary-600'
        }
      case 'breathing_active':
        return {
          text: 'Pause',
          action: onPause,
          icon: <Pause className="w-5 h-5 mr-2" />,
          color: 'bg-yellow-500 hover:bg-yellow-600'
        }
      case 'paused':
        return {
          text: 'Resume',
          action: onResume,
          icon: <Play className="w-5 h-5 mr-2" />,
          color: 'bg-green-500 hover:bg-green-600'
        }
      case 'exhale_hold_ready':
        return {
          text: 'Start Exhale Hold',
          action: onStartExhaleHold,
          icon: <div className="w-5 h-5 mr-2 bg-amber-400 rounded-full" />,
          color: 'bg-amber-500 hover:bg-amber-600'
        }
      case 'exhale_hold_active':
        return {
          text: 'Start Inhale Hold',
          action: onStartInhaleHold,
          icon: <div className="w-5 h-5 mr-2 bg-green-400 rounded-full" />,
          color: 'bg-green-500 hover:bg-green-600'
        }
      case 'inhale_hold_active':
        return {
          text: 'End Inhale Hold (Exhale)',
          action: onEndInhaleHold,
          icon: <div className="w-5 h-5 mr-2 bg-blue-400 rounded-full" />,
          color: 'bg-blue-500 hover:bg-blue-600'
        }
      case 'cycle_complete':
        return {
          text: 'Next Cycle',
          action: onNextCycle,
          icon: <SkipForward className="w-5 h-5 mr-2" />,
          color: 'bg-purple-500 hover:bg-purple-600'
        }
      case 'session_complete':
        return {
          text: 'New Session',
          action: onStart,
          icon: <Play className="w-5 h-5 mr-2" />,
          color: 'bg-primary-500 hover:bg-primary-600'
        }
      default:
        return {
          text: 'Start',
          action: onStart,
          icon: <Play className="w-5 h-5 mr-2" />,
          color: 'bg-primary-500 hover:bg-primary-600'
        }
    }
  }

  const primary = getPrimaryButton()

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Primary Control */}
      <button
        onClick={primary.action}
        disabled={disabled}
        className={`${primary.color} text-white font-bold py-5 px-10 rounded-xl transition-all duration-200 hover:scale-105 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-xl min-w-[240px] justify-center border border-white/30`}
      >
        {primary.icon}
        {primary.text}
      </button>

      {/* Secondary Controls */}
      <div className="flex gap-4">
        
        {state !== 'idle' && state !== 'session_complete' && (
          <button
            onClick={onEndSession}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center shadow-lg border border-white/20"
          >
            <Square className="w-4 h-4 mr-1" />
            End Session
          </button>
        )}
      </div>

    </div>
  )
}