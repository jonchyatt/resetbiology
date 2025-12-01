'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  CheckCircle,
  Clock,
  ChevronRight,
  Eye,
  Target
} from 'lucide-react'
import { VisionExercise } from '@/data/visionExercises'

interface GuidedExerciseProps {
  exercise: VisionExercise
  onComplete: () => void
  onBack: () => void
}

// Audio cue patterns for different exercise types
const AUDIO_PATTERNS = {
  'smooth-tracking': {
    type: 'visual-follow',
    cues: ['Follow the dot smoothly', 'Keep your head still', 'Eyes only', 'Good, continue'],
    pattern: 'figure8',
    speed: 4000, // ms per loop
  },
  'eye-jumps': {
    type: 'saccade',
    cues: ['Left', 'Right', 'Left', 'Right', 'Up', 'Down', 'Diagonal'],
    pattern: 'jump',
    speed: 1000, // ms per jump (60 bpm)
  },
  'figure8-fixation': {
    type: 'visual-follow',
    cues: ['Trace the infinity symbol', 'Breathe steadily', 'Smooth movements'],
    pattern: 'infinity',
    speed: 5000,
  },
  'mirror-scan': {
    type: 'scan',
    cues: ['Scan left', 'Scan right', 'Scan up', 'Scan down', 'Diagonal sweep'],
    pattern: 'rectangle',
    speed: 2000,
  },
  'laterality-ladder': {
    type: 'laterality',
    cues: ['Look left, tap right', 'Look right, tap left', 'Cross your midline'],
    pattern: 'cross',
    speed: 1500,
  },
  'peripheral-pointing': {
    type: 'peripheral',
    cues: ['Keep eyes center', 'Notice the edges', 'Point without looking'],
    pattern: 'expand',
    speed: 3000,
  },
}

export default function GuidedExercise({ exercise, onComplete, onBack }: GuidedExerciseProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [showCompletionScreen, setShowCompletionScreen] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | undefined>(undefined)
  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const audioContextRef = useRef<AudioContext | null>(null)

  // Get exercise-specific pattern or default
  const pattern = AUDIO_PATTERNS[exercise.id as keyof typeof AUDIO_PATTERNS] || {
    type: 'basic',
    cues: exercise.checkpoints,
    pattern: 'none',
    speed: 3000,
  }

  // Parse duration string to seconds
  const durationSeconds = parseInt(exercise.duration) * 60 || 180

  // Text-to-speech function
  const speak = useCallback((text: string) => {
    if (isMuted || typeof window === 'undefined') return

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.9
      utterance.pitch = 1.0
      utterance.volume = 0.8
      window.speechSynthesis.speak(utterance)
    }
  }, [isMuted])

  // Play a tone for rhythm (metronome)
  const playTone = useCallback((frequency: number = 440, duration: number = 100) => {
    if (isMuted) return

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }

      const ctx = audioContextRef.current
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.frequency.value = frequency
      oscillator.type = 'sine'

      gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000)

      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + duration / 1000)
    } catch (e) {
      console.log('Audio not available')
    }
  }, [isMuted])

  // Animation loop for visual guidance
  useEffect(() => {
    if (!isPlaying || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    let startTime = Date.now()

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = (elapsed % pattern.speed) / pattern.speed

      // Clear canvas
      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw based on pattern type
      switch (pattern.pattern) {
        case 'figure8':
        case 'infinity':
          drawInfinity(ctx, centerX, centerY, progress)
          break
        case 'jump':
          drawSaccadeTargets(ctx, centerX, centerY, progress)
          break
        case 'rectangle':
          drawRectanglePath(ctx, centerX, centerY, progress)
          break
        case 'cross':
          drawCrossPattern(ctx, centerX, centerY, progress)
          break
        case 'expand':
          drawPeripheralExpand(ctx, centerX, centerY, progress)
          break
        default:
          drawPulsingDot(ctx, centerX, centerY, progress)
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isPlaying, pattern])

  // Timer and cue progression
  useEffect(() => {
    if (!isPlaying) return

    timerRef.current = setInterval(() => {
      setElapsedTime(prev => {
        const newTime = prev + 1

        // Cycle through cues
        const cueInterval = Math.floor(durationSeconds / pattern.cues.length)
        const newStep = Math.floor(newTime / cueInterval) % pattern.cues.length

        if (newStep !== currentStep) {
          setCurrentStep(newStep)
          speak(pattern.cues[newStep])

          // Play tone for rhythm exercises
          if (pattern.type === 'saccade') {
            playTone(newStep % 2 === 0 ? 440 : 550)
          }
        }

        // Check completion
        if (newTime >= durationSeconds) {
          setIsPlaying(false)
          setShowCompletionScreen(true)
          speak('Exercise complete. Great work!')
          return durationSeconds
        }

        return newTime
      })
    }, 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [isPlaying, currentStep, durationSeconds, pattern, speak, playTone])

  // Drawing functions
  const drawInfinity = (ctx: CanvasRenderingContext2D, cx: number, cy: number, progress: number) => {
    const a = 120 // horizontal radius
    const b = 60  // vertical radius
    const t = progress * Math.PI * 2

    // Draw path
    ctx.strokeStyle = 'rgba(63, 191, 181, 0.3)'
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let i = 0; i <= 100; i++) {
      const ti = (i / 100) * Math.PI * 2
      const x = cx + a * Math.cos(ti) / (1 + Math.sin(ti) * Math.sin(ti))
      const y = cy + b * Math.sin(ti) * Math.cos(ti) / (1 + Math.sin(ti) * Math.sin(ti))
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Draw moving dot
    const dotX = cx + a * Math.cos(t) / (1 + Math.sin(t) * Math.sin(t))
    const dotY = cy + b * Math.sin(t) * Math.cos(t) / (1 + Math.sin(t) * Math.sin(t))

    // Glow effect
    const gradient = ctx.createRadialGradient(dotX, dotY, 0, dotX, dotY, 30)
    gradient.addColorStop(0, 'rgba(63, 191, 181, 0.8)')
    gradient.addColorStop(0.5, 'rgba(63, 191, 181, 0.3)')
    gradient.addColorStop(1, 'transparent')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(dotX, dotY, 30, 0, Math.PI * 2)
    ctx.fill()

    // Core dot
    ctx.fillStyle = '#3FBFB5'
    ctx.beginPath()
    ctx.arc(dotX, dotY, 12, 0, Math.PI * 2)
    ctx.fill()
  }

  const drawSaccadeTargets = (ctx: CanvasRenderingContext2D, cx: number, cy: number, progress: number) => {
    const positions = [
      { x: cx - 150, y: cy },     // Left
      { x: cx + 150, y: cy },     // Right
      { x: cx, y: cy - 100 },     // Up
      { x: cx, y: cy + 100 },     // Down
    ]

    // Draw all target positions
    positions.forEach((pos, i) => {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, 20, 0, Math.PI * 2)
      ctx.fill()

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
      ctx.lineWidth = 2
      ctx.stroke()
    })

    // Highlight active target
    const activeIndex = Math.floor(progress * positions.length) % positions.length
    const activePos = positions[activeIndex]

    // Glow effect
    const gradient = ctx.createRadialGradient(activePos.x, activePos.y, 0, activePos.x, activePos.y, 40)
    gradient.addColorStop(0, 'rgba(114, 194, 71, 0.8)')
    gradient.addColorStop(0.5, 'rgba(114, 194, 71, 0.3)')
    gradient.addColorStop(1, 'transparent')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(activePos.x, activePos.y, 40, 0, Math.PI * 2)
    ctx.fill()

    // Active dot
    ctx.fillStyle = '#72C247'
    ctx.beginPath()
    ctx.arc(activePos.x, activePos.y, 15, 0, Math.PI * 2)
    ctx.fill()

    // Center fixation point
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.beginPath()
    ctx.arc(cx, cy, 5, 0, Math.PI * 2)
    ctx.fill()
  }

  const drawRectanglePath = (ctx: CanvasRenderingContext2D, cx: number, cy: number, progress: number) => {
    const w = 200
    const h = 120

    // Draw rectangle path
    ctx.strokeStyle = 'rgba(63, 191, 181, 0.3)'
    ctx.lineWidth = 2
    ctx.strokeRect(cx - w/2, cy - h/2, w, h)

    // Calculate position along rectangle
    const perimeter = 2 * (w + h)
    const dist = progress * perimeter

    let x, y
    if (dist < w) {
      x = cx - w/2 + dist
      y = cy - h/2
    } else if (dist < w + h) {
      x = cx + w/2
      y = cy - h/2 + (dist - w)
    } else if (dist < 2*w + h) {
      x = cx + w/2 - (dist - w - h)
      y = cy + h/2
    } else {
      x = cx - w/2
      y = cy + h/2 - (dist - 2*w - h)
    }

    // Glow
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, 25)
    gradient.addColorStop(0, 'rgba(63, 191, 181, 0.8)')
    gradient.addColorStop(1, 'transparent')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(x, y, 25, 0, Math.PI * 2)
    ctx.fill()

    // Dot
    ctx.fillStyle = '#3FBFB5'
    ctx.beginPath()
    ctx.arc(x, y, 10, 0, Math.PI * 2)
    ctx.fill()
  }

  const drawCrossPattern = (ctx: CanvasRenderingContext2D, cx: number, cy: number, progress: number) => {
    // Draw cross lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cx - 150, cy)
    ctx.lineTo(cx + 150, cy)
    ctx.moveTo(cx, cy - 100)
    ctx.lineTo(cx, cy + 100)
    ctx.stroke()

    // Alternating sides
    const side = Math.floor(progress * 4) % 4
    const positions = [
      { x: cx - 120, y: cy, label: 'L' },
      { x: cx + 120, y: cy, label: 'R' },
      { x: cx, y: cy - 80, label: 'U' },
      { x: cx, y: cy + 80, label: 'D' },
    ]

    const activePos = positions[side]

    // Highlight
    ctx.fillStyle = 'rgba(114, 194, 71, 0.3)'
    ctx.beginPath()
    ctx.arc(activePos.x, activePos.y, 35, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#72C247'
    ctx.font = 'bold 24px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(activePos.label, activePos.x, activePos.y)

    // Center
    ctx.fillStyle = 'white'
    ctx.beginPath()
    ctx.arc(cx, cy, 8, 0, Math.PI * 2)
    ctx.fill()
  }

  const drawPeripheralExpand = (ctx: CanvasRenderingContext2D, cx: number, cy: number, progress: number) => {
    // Expanding rings
    const maxRadius = 180
    const rings = 4

    for (let i = 0; i < rings; i++) {
      const ringProgress = (progress + i / rings) % 1
      const radius = ringProgress * maxRadius
      const alpha = 1 - ringProgress

      ctx.strokeStyle = `rgba(63, 191, 181, ${alpha * 0.5})`
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.stroke()
    }

    // Center fixation
    ctx.fillStyle = '#3FBFB5'
    ctx.beginPath()
    ctx.arc(cx, cy, 10, 0, Math.PI * 2)
    ctx.fill()

    // Peripheral dots
    const numDots = 8
    for (let i = 0; i < numDots; i++) {
      const angle = (i / numDots) * Math.PI * 2
      const x = cx + Math.cos(angle) * 160
      const y = cy + Math.sin(angle) * 100

      ctx.fillStyle = `rgba(255, 255, 255, ${0.2 + 0.3 * Math.sin(progress * Math.PI * 2 + i)})`
      ctx.beginPath()
      ctx.arc(x, y, 8, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const drawPulsingDot = (ctx: CanvasRenderingContext2D, cx: number, cy: number, progress: number) => {
    const scale = 1 + 0.3 * Math.sin(progress * Math.PI * 2)
    const radius = 15 * scale

    ctx.fillStyle = '#3FBFB5'
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.fill()
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleStart = () => {
    setIsPlaying(true)
    speak(pattern.cues[0] || 'Begin the exercise')
  }

  const handleReset = () => {
    setIsPlaying(false)
    setElapsedTime(0)
    setCurrentStep(0)
    setShowCompletionScreen(false)
  }

  if (showCompletionScreen) {
    return (
      <div className="bg-gradient-to-br from-secondary-600/20 to-primary-600/20 border border-secondary-400/30 rounded-2xl p-8 text-center">
        <CheckCircle className="w-20 h-20 text-secondary-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Exercise Complete!</h2>
        <p className="text-gray-300 mb-6">
          You completed {exercise.title} in {formatTime(elapsedTime)}
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={handleReset}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-semibold flex items-center gap-2"
          >
            <RotateCcw className="w-5 h-5" />
            Do Again
          </button>
          <button
            onClick={onComplete}
            className="px-6 py-3 bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white rounded-xl font-semibold flex items-center gap-2"
          >
            Continue
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white flex items-center gap-2 text-sm"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Back to exercises
        </button>
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700 text-gray-400 hover:text-white"
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>

      {/* Exercise Info */}
      <div className="bg-gray-900/40 border border-primary-400/30 rounded-2xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">{exercise.title}</h2>
            <p className="text-gray-400">{exercise.summary}</p>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <Clock className="w-4 h-4" />
            <span>{exercise.duration}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>Progress</span>
            <span>{formatTime(elapsedTime)} / {exercise.duration}</span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary-500 to-secondary-500 transition-all duration-1000"
              style={{ width: `${(elapsedTime / durationSeconds) * 100}%` }}
            />
          </div>
        </div>

        {/* Current cue */}
        <div className="bg-primary-500/10 border border-primary-400/30 rounded-xl p-4 text-center mb-4">
          <p className="text-primary-300 text-lg font-medium">
            {pattern.cues[currentStep] || 'Ready to begin'}
          </p>
        </div>
      </div>

      {/* Visual Guide Canvas */}
      <div className="bg-gray-900/60 border border-primary-400/30 rounded-2xl overflow-hidden">
        <canvas
          ref={canvasRef}
          width={400}
          height={300}
          className="w-full h-auto"
          style={{ background: '#1a1a2e' }}
        />
      </div>

      {/* Checkpoints */}
      <div className="bg-gray-900/40 border border-gray-700/50 rounded-xl p-4">
        <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
          <Target className="w-4 h-4 text-secondary-400" />
          Key Points
        </h4>
        <ul className="space-y-2">
          {exercise.checkpoints.slice(0, 3).map((checkpoint, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
              <CheckCircle className="w-4 h-4 text-secondary-400/50 flex-shrink-0 mt-0.5" />
              {checkpoint}
            </li>
          ))}
        </ul>
      </div>

      {/* Controls */}
      <div className="flex gap-4 justify-center">
        <button
          onClick={handleReset}
          className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-semibold flex items-center gap-2"
        >
          <RotateCcw className="w-5 h-5" />
          Reset
        </button>
        <button
          onClick={() => isPlaying ? setIsPlaying(false) : handleStart()}
          className={`px-8 py-3 rounded-xl font-semibold flex items-center gap-2 ${
            isPlaying
              ? 'bg-yellow-500 hover:bg-yellow-600 text-gray-900'
              : 'bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white'
          }`}
        >
          {isPlaying ? (
            <>
              <Pause className="w-5 h-5" />
              Pause
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              {elapsedTime > 0 ? 'Resume' : 'Start'}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
