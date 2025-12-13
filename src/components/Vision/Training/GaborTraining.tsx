'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Play,
  Pause,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
  Eye,
  Target,
  Zap,
  TrendingUp,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react'
import GaborPatch, { ContrastStaircase, generateTiltedOrientation } from './GaborPatch'

type ExerciseMode = 'orientation' | 'contrast' | 'crowding' | 'peripheral'

interface GaborTrainingProps {
  onComplete?: (results: TrainingResults) => void
}

interface TrainingResults {
  mode: ExerciseMode
  totalTrials: number
  correctTrials: number
  accuracy: number
  contrastThreshold?: number
  duration: number
}

interface Trial {
  correct: boolean
  reactionTime: number
  contrast?: number
  orientation?: number
}

const EXERCISE_MODES: { id: ExerciseMode; label: string; icon: any; description: string; color: string }[] = [
  {
    id: 'orientation',
    label: 'Orientation',
    icon: Target,
    description: 'Is the patch tilted left or right?',
    color: 'primary'
  },
  {
    id: 'contrast',
    label: 'Contrast',
    icon: Eye,
    description: 'Find your contrast threshold',
    color: 'secondary'
  },
  {
    id: 'crowding',
    label: 'Crowding',
    icon: Zap,
    description: 'Find the different patch',
    color: 'purple'
  },
  {
    id: 'peripheral',
    label: 'Peripheral',
    icon: TrendingUp,
    description: 'Detect patches in your periphery',
    color: 'blue'
  }
]

export default function GaborTraining({ onComplete }: GaborTrainingProps) {
  const [mode, setMode] = useState<ExerciseMode>('orientation')
  const [isActive, setIsActive] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [showInstructions, setShowInstructions] = useState(true)

  // Trial state
  const [currentTrial, setCurrentTrial] = useState(0)
  const [totalTrials] = useState(20)
  const [trials, setTrials] = useState<Trial[]>([])
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null)

  // Timing
  const [sessionDuration, setSessionDuration] = useState(0)
  const trialStartTime = useRef<number>(0)

  // Orientation mode state
  const [targetOrientation, setTargetOrientation] = useState(0)
  const [isTargetLeft, setIsTargetLeft] = useState(false)
  const [tiltAmount, setTiltAmount] = useState(15) // Degrees - gets smaller as you improve

  // Contrast mode state
  const [staircase] = useState(() => new ContrastStaircase(0.5, 0.1, 0.02))
  const [currentContrast, setCurrentContrast] = useState(0.5)

  // Crowding mode state
  const [crowdingTarget, setCrowdingTarget] = useState(0) // Index of the different one
  const [crowdingOrientations, setCrowdingOrientations] = useState<number[]>([])

  // Peripheral mode state
  const [peripheralPosition, setPeripheralPosition] = useState({ x: 0, y: 0 })
  const [peripheralQuadrant, setPeripheralQuadrant] = useState<1 | 2 | 3 | 4>(1)
  const [showPeripheralTarget, setShowPeripheralTarget] = useState(false)

  // Session timer
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isActive && !isPaused) {
      interval = setInterval(() => {
        setSessionDuration(prev => prev + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isActive, isPaused])

  // Generate new trial based on mode
  const generateTrial = useCallback(() => {
    trialStartTime.current = performance.now()

    switch (mode) {
      case 'orientation': {
        const { orientation, isLeft } = generateTiltedOrientation(tiltAmount)
        setTargetOrientation(orientation)
        setIsTargetLeft(isLeft)
        break
      }
      case 'contrast': {
        // Orientation is always slightly tilted, contrast varies
        const { orientation, isLeft } = generateTiltedOrientation(15)
        setTargetOrientation(orientation)
        setIsTargetLeft(isLeft)
        setCurrentContrast(staircase.getCurrentContrast())
        break
      }
      case 'crowding': {
        // Generate 4 patches, one with different orientation
        const baseOrientation = Math.random() * 180 - 90
        const targetIndex = Math.floor(Math.random() * 4)
        const orientations = Array(4).fill(baseOrientation)
        // Target is rotated 90 degrees from others
        orientations[targetIndex] = baseOrientation + 90
        setCrowdingTarget(targetIndex)
        setCrowdingOrientations(orientations)
        break
      }
      case 'peripheral': {
        // Random quadrant
        const quadrant = (Math.floor(Math.random() * 4) + 1) as 1 | 2 | 3 | 4
        setPeripheralQuadrant(quadrant)
        // Position based on quadrant (relative percentages)
        const positions = {
          1: { x: 70, y: 30 },  // Top-right
          2: { x: 30, y: 30 },  // Top-left
          3: { x: 30, y: 70 },  // Bottom-left
          4: { x: 70, y: 70 }   // Bottom-right
        }
        setPeripheralPosition(positions[quadrant])
        // Show target after brief delay
        setShowPeripheralTarget(false)
        setTimeout(() => setShowPeripheralTarget(true), 500 + Math.random() * 1000)
        break
      }
    }
  }, [mode, tiltAmount, staircase])

  // Handle user response
  const handleResponse = useCallback((response: string | number) => {
    const reactionTime = performance.now() - trialStartTime.current
    let isCorrect = false

    switch (mode) {
      case 'orientation':
        isCorrect = (response === 'left' && isTargetLeft) || (response === 'right' && !isTargetLeft)
        // Adaptive difficulty - reduce tilt amount after 3 correct in a row
        if (isCorrect && trials.slice(-2).every(t => t.correct)) {
          setTiltAmount(prev => Math.max(3, prev - 1))
        } else if (!isCorrect) {
          setTiltAmount(prev => Math.min(30, prev + 2))
        }
        break

      case 'contrast':
        isCorrect = (response === 'left' && isTargetLeft) || (response === 'right' && !isTargetLeft)
        // Update staircase
        const newContrast = staircase.update(isCorrect)
        setCurrentContrast(newContrast)
        break

      case 'crowding':
        isCorrect = response === crowdingTarget
        break

      case 'peripheral':
        isCorrect = response === peripheralQuadrant
        setShowPeripheralTarget(false)
        break
    }

    // Record trial
    const trial: Trial = {
      correct: isCorrect,
      reactionTime,
      contrast: mode === 'contrast' ? currentContrast : undefined,
      orientation: targetOrientation
    }
    setTrials(prev => [...prev, trial])

    // Show feedback
    setFeedback(isCorrect ? 'correct' : 'incorrect')
    setTimeout(() => {
      setFeedback(null)

      // Check if session complete
      if (currentTrial + 1 >= totalTrials) {
        completeSession()
      } else {
        setCurrentTrial(prev => prev + 1)
        generateTrial()
      }
    }, 500)
  }, [mode, isTargetLeft, crowdingTarget, peripheralQuadrant, currentContrast, targetOrientation, trials, currentTrial, totalTrials, staircase, generateTrial])

  // Complete session
  const completeSession = () => {
    setIsActive(false)
    const correctTrials = trials.filter(t => t.correct).length + (feedback === 'correct' ? 1 : 0)
    const results: TrainingResults = {
      mode,
      totalTrials: totalTrials,
      correctTrials,
      accuracy: (correctTrials / totalTrials) * 100,
      contrastThreshold: mode === 'contrast' ? staircase.getThresholdEstimate() ?? currentContrast : undefined,
      duration: sessionDuration
    }
    if (onComplete) onComplete(results)
  }

  // Start session
  const startSession = () => {
    setIsActive(true)
    setIsPaused(false)
    setShowInstructions(false)
    setCurrentTrial(0)
    setTrials([])
    setSessionDuration(0)
    setTiltAmount(15)
    setCurrentContrast(0.5)
    generateTrial()
  }

  // Reset session
  const resetSession = () => {
    setIsActive(false)
    setIsPaused(false)
    setShowInstructions(true)
    setCurrentTrial(0)
    setTrials([])
    setSessionDuration(0)
    setFeedback(null)
  }

  // Keyboard controls
  useEffect(() => {
    if (!isActive || isPaused) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode === 'orientation' || mode === 'contrast') {
        if (e.key === 'ArrowLeft') handleResponse('left')
        else if (e.key === 'ArrowRight') handleResponse('right')
      } else if (mode === 'crowding') {
        const num = parseInt(e.key)
        if (num >= 1 && num <= 4) handleResponse(num - 1)
      } else if (mode === 'peripheral') {
        const num = parseInt(e.key)
        if (num >= 1 && num <= 4) handleResponse(num)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isActive, isPaused, mode, handleResponse])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const accuracy = trials.length > 0
    ? (trials.filter(t => t.correct).length / trials.length) * 100
    : 0

  return (
    <div className="space-y-4">
      {/* Mode Selection - only show when not active */}
      {!isActive && (
        <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-4 border border-primary-400/20 shadow-lg">
          <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary-400" />
            Gabor Patch Training
          </h3>
          <p className="text-gray-400 text-sm mb-4">
            Train your visual cortex with scientifically-designed stimuli that match how your neurons process visual information.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            {EXERCISE_MODES.map(ex => {
              const Icon = ex.icon
              const isSelected = mode === ex.id
              const colorClasses = {
                primary: isSelected ? 'bg-primary-600 border-primary-400' : 'border-primary-400/30 hover:border-primary-400/50',
                secondary: isSelected ? 'bg-secondary-600 border-secondary-400' : 'border-secondary-400/30 hover:border-secondary-400/50',
                purple: isSelected ? 'bg-purple-600 border-purple-400' : 'border-purple-400/30 hover:border-purple-400/50',
                blue: isSelected ? 'bg-blue-600 border-blue-400' : 'border-blue-400/30 hover:border-blue-400/50'
              }

              return (
                <button
                  key={ex.id}
                  onClick={() => setMode(ex.id)}
                  className={`p-3 rounded-xl border-2 transition-all ${colorClasses[ex.color as keyof typeof colorClasses]} ${isSelected ? 'text-white shadow-lg' : 'text-gray-300 bg-gray-800/50'}`}
                >
                  <Icon className="w-6 h-6 mx-auto mb-1" />
                  <div className="text-sm font-semibold">{ex.label}</div>
                </button>
              )
            })}
          </div>

          {/* Instructions for selected mode */}
          {showInstructions && (
            <div className="bg-gray-900/50 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-primary-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-white mb-1">
                    {EXERCISE_MODES.find(e => e.id === mode)?.label} Training
                  </h4>
                  <p className="text-gray-400 text-sm">
                    {mode === 'orientation' && (
                      <>
                        Identify if the striped patch is tilted <strong>left</strong> or <strong>right</strong>.
                        Use arrow keys or tap the buttons. The tilt gets subtler as you improve!
                      </>
                    )}
                    {mode === 'contrast' && (
                      <>
                        Same as orientation, but the patch contrast will adapt to find your <strong>threshold</strong> -
                        the point where you can barely see the stripes. This measures your contrast sensitivity.
                      </>
                    )}
                    {mode === 'crowding' && (
                      <>
                        Four patches will appear. Find the <strong>one that's different</strong> (rotated 90° from the others).
                        This trains your brain to process multiple stimuli simultaneously.
                      </>
                    )}
                    {mode === 'peripheral' && (
                      <>
                        Focus on the center cross. A patch will appear in your <strong>peripheral vision</strong>.
                        Identify which quadrant (1-4) without moving your eyes. Trains peripheral awareness!
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={startSession}
            className="w-full py-4 rounded-xl font-bold bg-secondary-500 hover:bg-secondary-600 text-white shadow-lg shadow-secondary-500/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
          >
            <Play className="w-6 h-6" />
            Start Training ({totalTrials} trials)
          </button>
        </div>
      )}

      {/* Active Training Session */}
      {isActive && (
        <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl border border-primary-400/20 shadow-lg overflow-hidden">
          {/* Stats bar */}
          <div className="bg-gray-900/60 px-4 py-2 flex items-center justify-between border-b border-gray-700/50">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-white font-semibold capitalize">{mode}</span>
              <span className="text-gray-400">|</span>
              <span className="text-gray-300">{formatTime(sessionDuration)}</span>
              <span className="text-gray-400">|</span>
              <span className={accuracy >= 70 ? 'text-secondary-400' : 'text-yellow-400'}>
                {accuracy.toFixed(0)}%
              </span>
              <span className="text-gray-400">|</span>
              <span className="text-gray-300">
                {currentTrial + 1}/{totalTrials}
              </span>
              {mode === 'contrast' && (
                <>
                  <span className="text-gray-400">|</span>
                  <span className="text-primary-400">
                    Contrast: {(currentContrast * 100).toFixed(0)}%
                  </span>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsPaused(!isPaused)}
                className="px-3 py-1 rounded bg-yellow-500 hover:bg-yellow-600 text-gray-900 text-sm font-semibold flex items-center gap-1"
              >
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                {isPaused ? 'Resume' : 'Pause'}
              </button>
              <button
                onClick={resetSession}
                className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm flex items-center gap-1"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Training Area */}
          <div className="relative p-6 min-h-[400px] flex items-center justify-center bg-[#808080]">
            {/* Feedback overlay */}
            {feedback && (
              <div className={`absolute top-4 right-4 z-20 flex items-center gap-2 px-4 py-2 rounded-lg font-semibold ${
                feedback === 'correct' ? 'bg-secondary-500 text-white' : 'bg-red-500 text-white'
              }`}>
                {feedback === 'correct' ? (
                  <><CheckCircle className="w-5 h-5" /> Correct!</>
                ) : (
                  <><XCircle className="w-5 h-5" /> Try Again</>
                )}
              </div>
            )}

            {isPaused ? (
              <div className="text-center">
                <Pause className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-600 font-semibold">Paused</p>
              </div>
            ) : (
              <>
                {/* Orientation & Contrast Mode */}
                {(mode === 'orientation' || mode === 'contrast') && (
                  <div className="flex flex-col items-center gap-6">
                    <GaborPatch
                      size={150}
                      orientation={targetOrientation}
                      contrast={mode === 'contrast' ? currentContrast : 1}
                      frequency={4}
                    />
                    <div className="flex gap-4">
                      <button
                        onClick={() => handleResponse('left')}
                        className="py-4 px-8 bg-gray-900 hover:bg-primary-600 text-white rounded-xl font-bold text-xl flex items-center gap-2 transition-all shadow-lg"
                      >
                        <ArrowLeft className="w-6 h-6" />
                        Left
                      </button>
                      <button
                        onClick={() => handleResponse('right')}
                        className="py-4 px-8 bg-gray-900 hover:bg-primary-600 text-white rounded-xl font-bold text-xl flex items-center gap-2 transition-all shadow-lg"
                      >
                        Right
                        <ArrowRight className="w-6 h-6" />
                      </button>
                    </div>
                    <p className="text-gray-600 text-sm">Use ← → arrow keys or tap buttons</p>
                  </div>
                )}

                {/* Crowding Mode */}
                {mode === 'crowding' && (
                  <div className="flex flex-col items-center gap-6">
                    <div className="grid grid-cols-2 gap-4">
                      {crowdingOrientations.map((orientation, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleResponse(idx)}
                          className="p-2 rounded-xl bg-gray-700/50 hover:bg-gray-600/50 transition-all"
                        >
                          <GaborPatch
                            size={100}
                            orientation={orientation}
                            contrast={0.8}
                            frequency={4}
                          />
                          <div className="text-gray-400 text-xs mt-1">{idx + 1}</div>
                        </button>
                      ))}
                    </div>
                    <p className="text-gray-600 text-sm">Click the different one (or press 1-4)</p>
                  </div>
                )}

                {/* Peripheral Mode */}
                {mode === 'peripheral' && (
                  <div className="relative w-full h-[350px]">
                    {/* Center fixation cross */}
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-4xl font-bold text-gray-600">
                      +
                    </div>

                    {/* Quadrant labels */}
                    <div className="absolute top-4 right-4 text-gray-500 text-sm">1</div>
                    <div className="absolute top-4 left-4 text-gray-500 text-sm">2</div>
                    <div className="absolute bottom-4 left-4 text-gray-500 text-sm">3</div>
                    <div className="absolute bottom-4 right-4 text-gray-500 text-sm">4</div>

                    {/* Peripheral target */}
                    {showPeripheralTarget && (
                      <div
                        className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-opacity duration-100"
                        style={{
                          left: `${peripheralPosition.x}%`,
                          top: `${peripheralPosition.y}%`
                        }}
                      >
                        <GaborPatch
                          size={80}
                          orientation={Math.random() * 180 - 90}
                          contrast={0.7}
                          frequency={3}
                        />
                      </div>
                    )}

                    {/* Response buttons */}
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 flex gap-2">
                      {[1, 2, 3, 4].map(q => (
                        <button
                          key={q}
                          onClick={() => handleResponse(q)}
                          className="py-3 px-6 bg-gray-900 hover:bg-primary-600 text-white rounded-lg font-bold transition-all"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                    <p className="absolute bottom-16 left-1/2 transform -translate-x-1/2 text-gray-600 text-sm">
                      Keep eyes on + | Which quadrant?
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-gray-800">
            <div
              className="h-full bg-gradient-to-r from-primary-500 to-secondary-500 transition-all duration-300"
              style={{ width: `${((currentTrial + 1) / totalTrials) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Results - show when complete */}
      {!isActive && trials.length > 0 && (
        <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-6 border border-secondary-400/30 shadow-lg">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-secondary-400" />
            Training Complete!
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-gray-900/50 rounded-lg p-3 text-center">
              <p className="text-gray-400 text-xs mb-1">Accuracy</p>
              <p className={`text-2xl font-bold ${accuracy >= 70 ? 'text-secondary-400' : 'text-yellow-400'}`}>
                {accuracy.toFixed(0)}%
              </p>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-3 text-center">
              <p className="text-gray-400 text-xs mb-1">Correct</p>
              <p className="text-2xl font-bold text-white">
                {trials.filter(t => t.correct).length}/{trials.length}
              </p>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-3 text-center">
              <p className="text-gray-400 text-xs mb-1">Duration</p>
              <p className="text-2xl font-bold text-white">{formatTime(sessionDuration)}</p>
            </div>
            {mode === 'contrast' && (
              <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                <p className="text-gray-400 text-xs mb-1">Threshold</p>
                <p className="text-2xl font-bold text-primary-400">
                  {(currentContrast * 100).toFixed(0)}%
                </p>
              </div>
            )}
            {mode === 'orientation' && (
              <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                <p className="text-gray-400 text-xs mb-1">Final Tilt</p>
                <p className="text-2xl font-bold text-primary-400">
                  {tiltAmount}°
                </p>
              </div>
            )}
          </div>
          <button
            onClick={resetSession}
            className="w-full py-3 rounded-xl font-semibold bg-primary-600 hover:bg-primary-500 text-white flex items-center justify-center gap-2 transition-all"
          >
            <RotateCcw className="w-5 h-5" />
            Train Again
          </button>
        </div>
      )}
    </div>
  )
}
