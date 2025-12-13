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
    speed: 4000,
  },
  'eye-jumps': {
    type: 'saccade',
    cues: ['Left', 'Right', 'Left', 'Right', 'Up', 'Down', 'Diagonal'],
    pattern: 'jump',
    speed: 1000,
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

  // Play a tone for rhythm
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

      // Clear canvas with dark background
      ctx.fillStyle = '#111827'
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

  /**
   * Draw a Gabor patch on Canvas - scientifically accurate visual stimulus
   * Used instead of simple dots for perceptual training
   */
  const drawGaborPatch = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    orientation: number = 0,
    frequency: number = 4,
    contrast: number = 1,
    phase: number = 0
  ) => {
    const sigma = size / 4
    const halfSize = size / 2

    // Pre-calculate rotation values
    const theta = (orientation * Math.PI) / 180
    const cosTheta = Math.cos(theta)
    const sinTheta = Math.sin(theta)
    const phaseRad = (phase * Math.PI) / 180
    const normalizedFreq = (2 * Math.PI * frequency) / size

    // Create temporary canvas for Gabor patch
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = size
    tempCanvas.height = size
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) return

    const imageData = tempCtx.createImageData(size, size)
    const data = imageData.data
    const bgGray = 128

    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const xc = px - halfSize
        const yc = py - halfSize

        const xPrime = xc * cosTheta + yc * sinTheta
        const yPrime = -xc * sinTheta + yc * cosTheta

        const gaussian = Math.exp(-(xPrime * xPrime + yPrime * yPrime) / (2 * sigma * sigma))
        const sinusoid = Math.cos(normalizedFreq * xPrime + phaseRad)
        const gabor = gaussian * sinusoid * contrast

        const pixelValue = Math.max(0, Math.min(255, Math.round(bgGray + gabor * 127)))

        const idx = (py * size + px) * 4
        data[idx] = pixelValue
        data[idx + 1] = pixelValue
        data[idx + 2] = pixelValue
        data[idx + 3] = 255
      }
    }

    tempCtx.putImageData(imageData, 0, 0)

    // Draw with circular clip
    ctx.save()
    ctx.beginPath()
    ctx.arc(x, y, halfSize, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(tempCanvas, x - halfSize, y - halfSize)
    ctx.restore()

    // Add subtle glow
    const gradient = ctx.createRadialGradient(x, y, halfSize * 0.8, x, y, halfSize * 1.2)
    gradient.addColorStop(0, 'transparent')
    gradient.addColorStop(1, 'rgba(63, 191, 181, 0.15)')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(x, y, halfSize * 1.2, 0, Math.PI * 2)
    ctx.fill()
  }

  const drawInfinity = (ctx: CanvasRenderingContext2D, cx: number, cy: number, progress: number) => {
    const a = 120
    const b = 60
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

    // Calculate position
    const dotX = cx + a * Math.cos(t) / (1 + Math.sin(t) * Math.sin(t))
    const dotY = cy + b * Math.sin(t) * Math.cos(t) / (1 + Math.sin(t) * Math.sin(t))

    // Draw Gabor patch instead of simple dot - orientation follows path direction
    const nextT = t + 0.1
    const nextX = cx + a * Math.cos(nextT) / (1 + Math.sin(nextT) * Math.sin(nextT))
    const nextY = cy + b * Math.sin(nextT) * Math.cos(nextT) / (1 + Math.sin(nextT) * Math.sin(nextT))
    const angle = Math.atan2(nextY - dotY, nextX - dotX) * 180 / Math.PI

    drawGaborPatch(ctx, dotX, dotY, 40, angle, 5, 0.9, progress * 360)
  }

  const drawSaccadeTargets = (ctx: CanvasRenderingContext2D, cx: number, cy: number, progress: number) => {
    const positions = [
      { x: cx - 150, y: cy, angle: 0 },
      { x: cx + 150, y: cy, angle: 90 },
      { x: cx, y: cy - 100, angle: 45 },
      { x: cx, y: cy + 100, angle: -45 },
    ]

    // Draw inactive targets as faded Gabor patches
    positions.forEach((pos, i) => {
      const activeIndex = Math.floor(progress * positions.length) % positions.length
      if (i !== activeIndex) {
        drawGaborPatch(ctx, pos.x, pos.y, 35, pos.angle, 4, 0.2, 0)
      }
    })

    // Highlight active target with full contrast Gabor
    const activeIndex = Math.floor(progress * positions.length) % positions.length
    const activePos = positions[activeIndex]

    // Animated phase for active target
    drawGaborPatch(ctx, activePos.x, activePos.y, 45, activePos.angle, 5, 0.95, progress * 720)

    // Center fixation cross
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(cx - 8, cy)
    ctx.lineTo(cx + 8, cy)
    ctx.moveTo(cx, cy - 8)
    ctx.lineTo(cx, cy + 8)
    ctx.stroke()
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

    let x, y, angle
    if (dist < w) {
      x = cx - w/2 + dist
      y = cy - h/2
      angle = 0 // Moving right
    } else if (dist < w + h) {
      x = cx + w/2
      y = cy - h/2 + (dist - w)
      angle = 90 // Moving down
    } else if (dist < 2*w + h) {
      x = cx + w/2 - (dist - w - h)
      y = cy + h/2
      angle = 180 // Moving left
    } else {
      x = cx - w/2
      y = cy + h/2 - (dist - 2*w - h)
      angle = 270 // Moving up
    }

    // Draw Gabor patch following the rectangle path
    drawGaborPatch(ctx, x, y, 35, angle, 5, 0.9, progress * 360)
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
    // Expanding rings (subtle guide)
    const maxRadius = 180
    const rings = 3

    for (let i = 0; i < rings; i++) {
      const ringProgress = (progress + i / rings) % 1
      const radius = ringProgress * maxRadius
      const alpha = (1 - ringProgress) * 0.3

      ctx.strokeStyle = `rgba(63, 191, 181, ${alpha})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.stroke()
    }

    // Center fixation Gabor patch - keep eyes here!
    drawGaborPatch(ctx, cx, cy, 30, 0, 6, 0.8, progress * 180)

    // Peripheral Gabor patches - different orientations for each position
    const numPatches = 8
    for (let i = 0; i < numPatches; i++) {
      const angle = (i / numPatches) * Math.PI * 2
      const x = cx + Math.cos(angle) * 160
      const y = cy + Math.sin(angle) * 100
      const orientation = (i * 22.5) % 180 // Different orientation for each

      // Contrast varies with time - some fade in/out
      const contrast = 0.3 + 0.4 * Math.sin(progress * Math.PI * 2 + i * 0.7)

      drawGaborPatch(ctx, x, y, 25, orientation, 4, contrast, 0)
    }
  }

  const drawPulsingDot = (ctx: CanvasRenderingContext2D, cx: number, cy: number, progress: number) => {
    // Pulsing Gabor patch instead of simple dot
    const baseSize = 40
    const sizeVariation = 8 * Math.sin(progress * Math.PI * 2)

    drawGaborPatch(ctx, cx, cy, baseSize + sizeVariation, progress * 90, 5, 0.85, progress * 360)
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
      <div className="bg-gradient-to-r from-secondary-600/20 to-primary-600/20 backdrop-blur-sm rounded-xl p-8 border border-secondary-400/30 shadow-2xl text-center">
        <CheckCircle className="w-20 h-20 text-secondary-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Exercise Complete!</h2>
        <p className="text-gray-300 mb-6">
          You completed {exercise.title} in {formatTime(elapsedTime)}
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={handleReset}
            className="px-6 py-3 bg-gray-700/80 backdrop-blur-sm hover:bg-gray-600/80 text-white rounded-lg font-semibold flex items-center gap-2 transition-all duration-300 hover:shadow-lg"
          >
            <RotateCcw className="w-5 h-5" />
            Do Again
          </button>
          <button
            onClick={onComplete}
            className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-semibold flex items-center gap-2 transition-all duration-300 hover:shadow-lg hover:shadow-primary-500/30"
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
          className="text-gray-400 hover:text-white flex items-center gap-2 text-sm transition-colors"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Back to exercises
        </button>
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="p-2 rounded-lg bg-gray-800/30 backdrop-blur-sm hover:bg-gray-700/30 text-gray-400 hover:text-white transition-all duration-300"
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>

      {/* Exercise Info */}
      <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-6 border border-primary-400/20 shadow-lg">
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
              className="h-full bg-primary-500 transition-all duration-1000"
              style={{ width: `${(elapsedTime / durationSeconds) * 100}%` }}
            />
          </div>
        </div>

        {/* Current cue */}
        <div className="bg-primary-600/20 border border-primary-400/30 rounded-xl p-4 text-center mb-4">
          <p className="text-primary-300 text-lg font-medium">
            {pattern.cues[currentStep] || 'Ready to begin'}
          </p>
        </div>
      </div>

      {/* Visual Guide Canvas */}
      <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl border border-primary-400/20 shadow-lg overflow-hidden">
        <canvas
          ref={canvasRef}
          width={400}
          height={300}
          className="w-full h-auto"
          style={{ background: '#111827' }}
        />
      </div>

      {/* Checkpoints */}
      <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-4 border border-primary-400/20 shadow-lg">
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
          className="px-6 py-3 bg-gray-700/80 backdrop-blur-sm hover:bg-gray-600/80 text-white rounded-lg font-semibold flex items-center gap-2 transition-all duration-300 hover:shadow-lg"
        >
          <RotateCcw className="w-5 h-5" />
          Reset
        </button>
        <button
          onClick={() => isPlaying ? setIsPlaying(false) : handleStart()}
          className={`px-8 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all duration-300 ${
            isPlaying
              ? 'bg-yellow-500 hover:bg-yellow-600 text-gray-900 shadow-lg shadow-yellow-500/20'
              : 'bg-primary-500 hover:bg-primary-600 text-white shadow-lg shadow-primary-500/20'
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
