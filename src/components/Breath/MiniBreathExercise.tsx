"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Pause, X, Volume2, VolumeX } from 'lucide-react'

interface BreathExerciseSettings {
  name: string
  inhaleMs: number
  exhaleMs: number
  inhaleHoldMs: number
  exhaleHoldMs: number
  breathsPerCycle: number
  cyclesTarget: number
  backgroundMusic?: string | null
  musicVolume?: number
}

interface MiniBreathExerciseProps {
  onClose?: () => void
  showCloseButton?: boolean
  exercise?: BreathExerciseSettings | null
  compact?: boolean
}

type BreathPhase = 'idle' | 'inhale' | 'inhale_hold' | 'exhale' | 'exhale_hold' | 'complete'

const DEFAULT_EXERCISE: BreathExerciseSettings = {
  name: 'Quick Calm',
  inhaleMs: 4000,
  exhaleMs: 6000,
  inhaleHoldMs: 0,
  exhaleHoldMs: 0,
  breathsPerCycle: 6,
  cyclesTarget: 1,
  backgroundMusic: null,
  musicVolume: 0.5
}

export default function MiniBreathExercise({
  onClose,
  showCloseButton = true,
  exercise = null,
  compact = false
}: MiniBreathExerciseProps) {
  const settings = exercise || DEFAULT_EXERCISE

  const [phase, setPhase] = useState<BreathPhase>('idle')
  const [breathCount, setBreathCount] = useState(0)
  const [progress, setProgress] = useState(0)
  const [isMuted, setIsMuted] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const animationRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const phaseRef = useRef<BreathPhase>('idle')

  // Sync phase ref
  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  // Handle audio
  useEffect(() => {
    if (settings.backgroundMusic && phase !== 'idle' && phase !== 'complete') {
      if (!audioRef.current) {
        audioRef.current = new Audio(settings.backgroundMusic)
        audioRef.current.loop = true
        audioRef.current.volume = (settings.musicVolume || 0.5) * (isMuted ? 0 : 1)
      }
      audioRef.current.play().catch(() => {})
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
      }
    }
  }, [settings.backgroundMusic, settings.musicVolume, phase, isMuted])

  // Toggle mute
  const toggleMute = () => {
    setIsMuted(!isMuted)
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? (settings.musicVolume || 0.5) : 0
    }
  }

  // Get current phase duration
  const getPhaseDuration = useCallback((p: BreathPhase): number => {
    switch (p) {
      case 'inhale': return settings.inhaleMs
      case 'inhale_hold': return settings.inhaleHoldMs
      case 'exhale': return settings.exhaleMs
      case 'exhale_hold': return settings.exhaleHoldMs
      default: return 0
    }
  }, [settings])

  // Get next phase
  const getNextPhase = useCallback((currentPhase: BreathPhase, currentBreathCount: number): BreathPhase => {
    switch (currentPhase) {
      case 'inhale':
        return settings.inhaleHoldMs > 0 ? 'inhale_hold' : 'exhale'
      case 'inhale_hold':
        return 'exhale'
      case 'exhale':
        if (settings.exhaleHoldMs > 0) return 'exhale_hold'
        // Check if cycle is complete
        if (currentBreathCount >= settings.breathsPerCycle) {
          return 'complete'
        }
        return 'inhale'
      case 'exhale_hold':
        if (currentBreathCount >= settings.breathsPerCycle) {
          return 'complete'
        }
        return 'inhale'
      default:
        return 'inhale'
    }
  }, [settings])

  // Animation loop
  const animate = useCallback((timestamp: number) => {
    if (phaseRef.current === 'idle' || phaseRef.current === 'complete') {
      return
    }

    const elapsed = timestamp - startTimeRef.current
    const duration = getPhaseDuration(phaseRef.current)
    const newProgress = Math.min(elapsed / duration, 1)

    setProgress(newProgress)

    if (newProgress >= 1) {
      // Move to next phase
      const nextPhase = getNextPhase(phaseRef.current, breathCount + (phaseRef.current === 'exhale' || phaseRef.current === 'exhale_hold' ? 1 : 0))

      if (phaseRef.current === 'exhale' || phaseRef.current === 'exhale_hold') {
        setBreathCount(prev => prev + 1)
      }

      if (nextPhase === 'complete') {
        setPhase('complete')
        if (audioRef.current) {
          audioRef.current.pause()
        }
        return
      }

      setPhase(nextPhase)
      startTimeRef.current = timestamp
      setProgress(0)
    }

    animationRef.current = requestAnimationFrame(animate)
  }, [getPhaseDuration, getNextPhase, breathCount])

  // Start exercise
  const start = () => {
    setPhase('inhale')
    setBreathCount(0)
    setProgress(0)
    startTimeRef.current = performance.now()
    animationRef.current = requestAnimationFrame(animate)
  }

  // Stop exercise
  const stop = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
    if (audioRef.current) {
      audioRef.current.pause()
    }
    setPhase('idle')
    setBreathCount(0)
    setProgress(0)
  }

  // Restart on phase change
  useEffect(() => {
    if (phase !== 'idle' && phase !== 'complete') {
      startTimeRef.current = performance.now()
      animationRef.current = requestAnimationFrame(animate)
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [phase, animate])

  // Calculate orb scale
  const getOrbScale = (): number => {
    switch (phase) {
      case 'inhale':
        return 0.6 + (progress * 0.4) // 0.6 -> 1.0
      case 'inhale_hold':
        return 1.0
      case 'exhale':
        return 1.0 - (progress * 0.4) // 1.0 -> 0.6
      case 'exhale_hold':
        return 0.6
      default:
        return 0.7
    }
  }

  // Get phase text
  const getPhaseText = (): string => {
    switch (phase) {
      case 'inhale': return 'Breathe In'
      case 'inhale_hold': return 'Hold'
      case 'exhale': return 'Breathe Out'
      case 'exhale_hold': return 'Hold'
      case 'complete': return 'Complete!'
      default: return 'Ready?'
    }
  }

  // Get phase color
  const getPhaseColor = (): string => {
    switch (phase) {
      case 'inhale':
      case 'inhale_hold':
        return 'from-teal-400 to-cyan-500'
      case 'exhale':
      case 'exhale_hold':
        return 'from-purple-400 to-indigo-500'
      case 'complete':
        return 'from-green-400 to-emerald-500'
      default:
        return 'from-gray-400 to-gray-500'
    }
  }

  const orbScale = getOrbScale()
  const size = compact ? 120 : 180

  return (
    <div className={`relative ${compact ? 'p-4' : 'p-6'} bg-gray-900/90 backdrop-blur-lg rounded-2xl border border-teal-400/30`}>
      {/* Close button */}
      {showCloseButton && onClose && (
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* Title */}
      <div className="text-center mb-4">
        <h3 className={`${compact ? 'text-lg' : 'text-xl'} font-bold text-white`}>
          {settings.name}
        </h3>
        {!compact && (
          <p className="text-sm text-gray-400 mt-1">
            {phase === 'idle' ? 'Click play to begin' : `Breath ${Math.min(breathCount + 1, settings.breathsPerCycle)} of ${settings.breathsPerCycle}`}
          </p>
        )}
      </div>

      {/* Breathing Orb */}
      <div className="flex justify-center mb-4">
        <div
          className="relative flex items-center justify-center"
          style={{ width: size, height: size }}
        >
          {/* Outer ring */}
          <div
            className={`absolute rounded-full bg-gradient-to-br ${getPhaseColor()} opacity-20`}
            style={{
              width: size,
              height: size,
              transform: `scale(${orbScale})`,
              transition: 'transform 100ms linear'
            }}
          />

          {/* Inner orb */}
          <div
            className={`absolute rounded-full bg-gradient-to-br ${getPhaseColor()} shadow-lg`}
            style={{
              width: size * 0.7,
              height: size * 0.7,
              transform: `scale(${orbScale})`,
              transition: 'transform 100ms linear',
              boxShadow: `0 0 ${20 * orbScale}px ${phase === 'idle' ? 'rgba(150,150,150,0.3)' : 'rgba(56,189,248,0.4)'}`
            }}
          />

          {/* Phase text */}
          <span className={`relative z-10 ${compact ? 'text-sm' : 'text-lg'} font-semibold text-white`}>
            {getPhaseText()}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex justify-center items-center gap-4">
        {phase === 'idle' ? (
          <button
            onClick={start}
            className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white px-6 py-2 rounded-full font-semibold transition-colors"
          >
            <Play className="w-5 h-5" />
            Start
          </button>
        ) : phase === 'complete' ? (
          <div className="flex gap-3">
            <button
              onClick={start}
              className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white px-6 py-2 rounded-full font-semibold transition-colors"
            >
              <Play className="w-5 h-5" />
              Again
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Done
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={stop}
              className="flex items-center gap-2 bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-full font-semibold transition-colors"
            >
              <Pause className="w-4 h-4" />
              Stop
            </button>

            {settings.backgroundMusic && (
              <button
                onClick={toggleMute}
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Progress bar (only when active) */}
      {phase !== 'idle' && phase !== 'complete' && (
        <div className="mt-4">
          <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${getPhaseColor()} transition-all duration-100`}
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
