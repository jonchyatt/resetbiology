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
          color: 'bg-gradient-to-r from-primary-600/20 to-secondary-600/20 hover:from-primary-600/30 hover:to-secondary-600/30 backdrop-blur-sm'
        }
      case 'breathing_active':
        return null // No primary button needed during breathing - pause/end are in secondary controls
      case 'paused':
        return {
          text: 'Resume',
          action: onResume,
          icon: <Play className="w-5 h-5 mr-2" />,
          color: 'bg-gradient-to-r from-green-600/20 to-emerald-600/20 hover:from-green-600/30 hover:to-emerald-600/30 backdrop-blur-sm'
        }
      case 'exhale_hold_ready':
        return {
          text: 'Start Exhale Hold (Space)',
          action: onStartExhaleHold,
          icon: <div className="w-5 h-5 mr-2 bg-amber-400 rounded-full" />,
          color: 'bg-gradient-to-r from-amber-600/20 to-orange-600/20 hover:from-amber-600/30 hover:to-orange-600/30 backdrop-blur-sm'
        }
      case 'exhale_hold_active':
        return {
          text: 'Start Inhale Hold (Space)',
          action: onStartInhaleHold,
          icon: <div className="w-5 h-5 mr-2 bg-green-400 rounded-full" />,
          color: 'bg-gradient-to-r from-green-600/20 to-teal-600/20 hover:from-green-600/30 hover:to-teal-600/30 backdrop-blur-sm'
        }
      case 'inhale_hold_active':
        return {
          text: 'End Inhale Hold (Space)',
          action: onEndInhaleHold,
          icon: <div className="w-5 h-5 mr-2 bg-blue-400 rounded-full" />,
          color: 'bg-gradient-to-r from-blue-600/20 to-indigo-600/20 hover:from-blue-600/30 hover:to-indigo-600/30 backdrop-blur-sm'
        }
      case 'cycle_complete':
        return {
          text: 'Next Cycle',
          action: onNextCycle,
          icon: <SkipForward className="w-5 h-5 mr-2" />,
          color: 'bg-gradient-to-r from-purple-600/20 to-violet-600/20 hover:from-purple-600/30 hover:to-violet-600/30 backdrop-blur-sm'
        }
      case 'session_complete':
        return {
          text: 'New Session',
          action: onStart,
          icon: <Play className="w-5 h-5 mr-2" />,
          color: 'bg-gradient-to-r from-primary-600/20 to-secondary-600/20 hover:from-primary-600/30 hover:to-secondary-600/30 backdrop-blur-sm'
        }
      default:
        return {
          text: 'Start',
          action: onStart,
          icon: <Play className="w-5 h-5 mr-2" />,
          color: 'bg-gradient-to-r from-primary-600/20 to-secondary-600/20 hover:from-primary-600/30 hover:to-secondary-600/30 backdrop-blur-sm'
        }
    }
  }

  const primary = getPrimaryButton()

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Primary Control - only show if not null */}
      {primary && (
        <button
          onClick={primary.action}
          disabled={disabled}
          className={`${primary.color} text-white font-bold py-4 px-8 rounded-xl transition-all duration-200 hover:scale-105 shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-lg w-full justify-center border border-primary-400/30`}
        >
          {primary.icon}
          {primary.text}
        </button>
      )}

      {/* Secondary Controls - Show Pause and End Session on same line when both available */}
      {(state === 'breathing_active' || state === 'exhale_hold_active' || state === 'inhale_hold_active') && (
        <div className="flex gap-3 w-full">
          <button
            onClick={onPause}
            className="bg-gradient-to-r from-amber-600/20 to-yellow-600/20 hover:from-amber-600/30 hover:to-yellow-600/30 backdrop-blur-sm text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center shadow-xl border border-amber-400/30 text-sm flex-1 justify-center"
          >
            <Pause className="w-4 h-4 mr-1" />
            Pause
          </button>
          <button
            onClick={onEndSession}
            className="bg-gradient-to-r from-red-600/20 to-rose-600/20 hover:from-red-600/30 hover:to-rose-600/30 backdrop-blur-sm text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center shadow-xl border border-red-400/30 text-sm flex-1 justify-center"
          >
            <Square className="w-4 h-4 mr-1" />
            End Session
          </button>
        </div>
      )}

      {/* End Session only for paused state */}
      {state === 'paused' && (
        <div className="flex gap-3 w-full">
          <button
            onClick={onEndSession}
            className="bg-gradient-to-r from-red-600/20 to-rose-600/20 hover:from-red-600/30 hover:to-rose-600/30 backdrop-blur-sm text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center shadow-xl border border-red-400/30 text-sm flex-1 justify-center"
          >
            <Square className="w-4 h-4 mr-1" />
            End Session
          </button>
        </div>
      )}

    </div>
  )
}