'use client'

import { useState, useEffect } from 'react'
import SnellenChart from './SnellenChart'
import BinocularChart from './BinocularChart'
import type { BinocularMode } from './BinocularChart'
import DistanceGuidance from './DistanceGuidance'
import { Play, Pause, RotateCcw, CheckCircle, XCircle, Glasses, MoveHorizontal, Trophy, ArrowRight } from 'lucide-react'

interface TrainingSessionProps {
  visionType: 'near' | 'far'
  exerciseType: 'letters' | 'e-directional'
  initialLevel?: number
  deviceMode?: 'phone' | 'desktop'
  binocularMode?: BinocularMode
  onActiveChange?: (isActive: boolean) => void
  onExit?: () => void
}

// Reader glasses progression for nearsightedness training
// The concept: move phone away -> hit arm's length -> add readers -> move back in -> repeat
const READER_GLASSES_STAGES = [
  { stage: 0, glassesStrength: 0, label: 'No Glasses', minDistance: 20, maxDistance: 60, color: 'text-gray-300' },
  { stage: 1, glassesStrength: 1.0, label: '+1.0 Readers', minDistance: 20, maxDistance: 60, color: 'text-blue-400' },
  { stage: 2, glassesStrength: 1.5, label: '+1.5 Readers', minDistance: 20, maxDistance: 60, color: 'text-cyan-400' },
  { stage: 3, glassesStrength: 2.0, label: '+2.0 Readers', minDistance: 20, maxDistance: 60, color: 'text-secondary-400' },
  { stage: 4, glassesStrength: 2.5, label: '+2.5 Readers', minDistance: 20, maxDistance: 60, color: 'text-purple-400' },
  { stage: 5, glassesStrength: 3.0, label: '+3.0 Readers', minDistance: 20, maxDistance: 60, color: 'text-pink-400' },
]

// Adaptive difficulty system - training levels, NOT medical diagnosis
// We cannot use 20/XX notation - that requires calibrated equipment
const DIFFICULTY_LEVELS = [
  { level: 1, label: 'Warm-up', targetDistance: 30, requiredAccuracy: 60 },
  { level: 2, label: 'Foundation', targetDistance: 35, requiredAccuracy: 65 },
  { level: 3, label: 'Building', targetDistance: 40, requiredAccuracy: 70 },
  { level: 4, label: 'Moderate', targetDistance: 45, requiredAccuracy: 75 },
  { level: 5, label: 'Challenge', targetDistance: 50, requiredAccuracy: 80 },
  { level: 6, label: 'Advanced', targetDistance: 55, requiredAccuracy: 80 },
  { level: 7, label: 'Expert', targetDistance: 60, requiredAccuracy: 85 },
  { level: 8, label: 'Peak', targetDistance: 65, requiredAccuracy: 90 },
]

export default function TrainingSession({
  visionType,
  exerciseType,
  initialLevel = 1,
  deviceMode = 'phone',
  binocularMode = 'off',
  onActiveChange,
  onExit
}: TrainingSessionProps) {
  const isBinocular = binocularMode && binocularMode !== 'off'
  const [currentLevel, setCurrentLevel] = useState(initialLevel)
  // Auto-start when component mounts (parent controls when to show us)
  const [isActive, setIsActive] = useState(true)
  const [attempts, setAttempts] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [sessionDuration, setSessionDuration] = useState(0)
  const [resetTrigger, setResetTrigger] = useState(0) // Increments to trigger new letter
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null)
  const [sessionComplete, setSessionComplete] = useState(false)

  // Distance progression state for nearsightedness training
  const [targetDistanceCm, setTargetDistanceCm] = useState(deviceMode === 'desktop' ? 80 : 25) // Start close for phone, farther for desktop
  const [readerGlassesStage, setReaderGlassesStage] = useState(0)
  const [distanceProgressionMode, setDistanceProgressionMode] = useState(visionType === 'near')
  const [showGlassesPrompt, setShowGlassesPrompt] = useState(false)
  const [consecutiveSuccessAtMax, setConsecutiveSuccessAtMax] = useState(0)

  const difficulty = DIFFICULTY_LEVELS[currentLevel - 1] || DIFFICULTY_LEVELS[0]
  const accuracy = attempts > 0 ? (correct / attempts) * 100 : 0
  const currentGlassesStage = READER_GLASSES_STAGES[readerGlassesStage] || READER_GLASSES_STAGES[0]

  // Reset target distance if device mode changes
  useEffect(() => {
    setTargetDistanceCm(deviceMode === 'desktop' ? 80 : 25)
  }, [deviceMode])

  // Session timer
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isActive && !sessionComplete) {
      interval = setInterval(() => {
        setSessionDuration(prev => prev + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isActive, sessionComplete])

  // Notify parent when active state changes
  useEffect(() => {
    if (onActiveChange) {
      onActiveChange(isActive)
    }
  }, [isActive, onActiveChange])

  const handleAnswer = (isCorrect: boolean) => {
    setAttempts(prev => prev + 1)
    if (isCorrect) {
      setCorrect(prev => prev + 1)
      setFeedback('correct')
      // Audio disabled - using visual feedback instead

      // Distance progression for nearsightedness training
      if (distanceProgressionMode && visionType === 'near') {
        handleDistanceProgression(true)
      }
    } else {
      setFeedback('incorrect')
      // Audio disabled - using visual feedback instead
      setConsecutiveSuccessAtMax(0)

      // If struggling, visual feedback is shown (audio disabled)
    }

    // Clear feedback after 1 second and generate new letter
    setTimeout(() => {
      setFeedback(null)
      setResetTrigger(prev => prev + 1) // Triggers new random letter
    }, 1000)

    // Check if should level up or complete session
    const newAttempts = attempts + 1
    const newCorrect = isCorrect ? correct + 1 : correct
    const newAccuracy = (newCorrect / newAttempts) * 100

    if (newAttempts >= 10) {
      if (newAccuracy >= difficulty.requiredAccuracy) {
        if (currentLevel < 10) {
          // Level up!
          setTimeout(() => {
            setCurrentLevel(prev => prev + 1)
            setAttempts(0)
            setCorrect(0)
            setResetTrigger(prev => prev + 1) // Generate new letter for new level
            // Audio disabled - visual feedback shows level up
          }, 1500)
        } else {
          // Completed all levels!
          setTimeout(() => {
            setSessionComplete(true)
            setIsActive(false)
            // Audio disabled - visual feedback shows completion
            saveSession(true)
          }, 1500)
        }
      } else {
        // Failed level - try again
        setTimeout(() => {
          setAttempts(0)
          setCorrect(0)
          setResetTrigger(prev => prev + 1) // Generate new letter for retry
          // Audio disabled - visual feedback shows retry needed
        }, 1500)
      }
    }
  }

  // Handle distance progression - the "barbell" concept
  // NOTE: Distance changes only happen when ENTIRE CHART is completed (via onChartComplete callback)
  // This function just tracks glasses progression at max distance
  const handleDistanceProgression = (wasCorrect: boolean) => {
    if (!wasCorrect) return

    const maxDistance = currentGlassesStage.maxDistance

    // At arm's length (max distance)?
    if (targetDistanceCm >= maxDistance - 5) {
      setConsecutiveSuccessAtMax(prev => prev + 1)

      // After 3 consecutive successes at max distance, prompt for glasses upgrade
      if (consecutiveSuccessAtMax >= 2) {
        if (readerGlassesStage < READER_GLASSES_STAGES.length - 1) {
          setShowGlassesPrompt(true)
          // Audio disabled - visual prompt shows glasses upgrade
        }
      }
    }
    // NOTE: Removed per-answer distance increment - this now only happens after completing full chart
  }

  // Upgrade to next glasses stage
  const upgradeGlasses = () => {
    if (readerGlassesStage < READER_GLASSES_STAGES.length - 1) {
      setReaderGlassesStage(prev => prev + 1)
      setTargetDistanceCm(25) // Reset to close distance
      setConsecutiveSuccessAtMax(0)
      setShowGlassesPrompt(false)
      // Audio disabled - visual feedback shows new glasses stage
    }
  }

  // Skip glasses upgrade
  const skipGlassesUpgrade = () => {
    setShowGlassesPrompt(false)
    setConsecutiveSuccessAtMax(0)
    // Audio disabled
  }

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1.0
      utterance.pitch = 1.0
      window.speechSynthesis.speak(utterance)
    }
  }

  const saveSession = async (success: boolean) => {
    try {
      await fetch('/api/vision/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visionType,
          exerciseType,
          distanceCm: distanceProgressionMode ? targetDistanceCm : difficulty.targetDistance,
          accuracy,
          level: difficulty.label,
          duration: sessionDuration,
          success
        })
      })
    } catch (error) {
      console.error('Failed to save session:', error)
    }
  }

  const resetSession = () => {
    setCurrentLevel(initialLevel)
    setAttempts(0)
    setCorrect(0)
    setSessionDuration(0)
    setIsActive(false)
    setSessionComplete(false)
    setFeedback(null)
    setResetTrigger(prev => prev + 1) // Generate new letter for fresh start
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-4">
      {/* CHART FIRST when active - this is the main focus! */}
      {isActive && !sessionComplete && (
        <div className="relative">
          {/* Unified stats bar — matches mockup: stats left, controls right */}
          <div className="bg-gray-900/80 backdrop-blur-sm px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-white font-semibold">{difficulty.label}</span>
              <span className="text-gray-600">|</span>
              <span className="text-gray-300">{formatTime(sessionDuration)}</span>
              <span className="text-gray-600">|</span>
              <span className={accuracy >= difficulty.requiredAccuracy ? 'text-secondary-400' : 'text-yellow-400'}>
                {accuracy.toFixed(0)}% ({attempts}/10)
              </span>
            </div>
            <div className="flex items-center gap-2">
              {onExit && (
                <>
                  <button
                    onClick={onExit}
                    className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold flex items-center gap-1.5 transition-all"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Exit Training
                  </button>
                  <div className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-400 text-xs border border-gray-600/50">
                    Press ESC to exit
                  </div>
                </>
              )}
              <button
                onClick={() => setIsActive(false)}
                className="px-4 py-1.5 rounded-lg border border-gray-500 hover:border-gray-400 text-white text-sm font-semibold flex items-center gap-1.5 transition-all"
              >
                <Pause className="w-4 h-4" />
                Pause
              </button>
              <button
                onClick={resetSession}
                className="p-1.5 rounded-lg border border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white transition-all"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Feedback overlay */}
          {feedback && (
            <div className={`absolute top-12 right-4 z-10 flex items-center gap-2 px-4 py-2 rounded-lg font-semibold ${
              feedback === 'correct' ? 'bg-secondary-500 text-white' : 'bg-red-500 text-white'
            }`}>
              {feedback === 'correct' ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Correct!
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5" />
                  Try Again
                </>
              )}
            </div>
          )}

          {isBinocular ? (
            <BinocularChart
              chartSize={difficulty.label}
              exerciseType={exerciseType}
              binocularMode={binocularMode}
              onAnswer={handleAnswer}
              resetTrigger={resetTrigger}
              deviceMode={deviceMode}
              onChartComplete={() => {
                // Audio disabled - visual feedback shows chart completion
              }}
              onDistanceAdjust={(direction) => {
                if (direction === 'further') {
                  setTargetDistanceCm(prev => Math.min(prev + 1, 100))
                } else {
                  setTargetDistanceCm(prev => Math.max(prev - 1, 15))
                }
              }}
            />
          ) : (
            <SnellenChart
              chartSize={difficulty.label}
              exerciseType={exerciseType}
              onAnswer={handleAnswer}
              resetTrigger={resetTrigger}
              deviceMode={deviceMode}
              progressionMode="line-by-line"
              onChartComplete={() => {
                // Audio disabled - visual feedback shows chart completion
              }}
              onDistanceAdjust={(direction) => {
                if (direction === 'further') {
                  setTargetDistanceCm(prev => Math.min(prev + 1, 100))
                } else {
                  setTargetDistanceCm(prev => Math.max(prev - 1, 15))
                }
              }}
            />
          )}
        </div>
      )}

      {/* Header with stats - show when NOT active */}
      {!isActive && (
        <div className="bg-gray-900/40 border border-primary-400/30 rounded-lg p-6 shadow-inner">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-2xl font-bold text-white mb-1">
              Level {currentLevel} - {difficulty.label}
            </h3>
            <p className="text-gray-400 text-sm">
              {visionType === 'near' ? 'Near Vision' : 'Far Vision'} Training
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setIsActive(!isActive)}
              className={`px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all ${
                isActive
                  ? 'bg-yellow-500 hover:bg-yellow-600 text-gray-900'
                  : 'bg-secondary-500 hover:bg-secondary-600 text-white'
              }`}
            >
              {isActive ? (
                <>
                  <Pause className="w-5 h-5" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Start
                </>
              )}
            </button>
            <button
              onClick={resetSession}
              className="px-6 py-3 rounded-lg font-semibold bg-gray-700 hover:bg-gray-600 text-white flex items-center gap-2 transition-all"
            >
              <RotateCcw className="w-5 h-5" />
              Reset
            </button>
          </div>
        </div>

        {/* Session stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-gray-400 text-xs mb-1">Time</p>
            <p className="text-white text-xl font-bold">{formatTime(sessionDuration)}</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-gray-400 text-xs mb-1">Accuracy</p>
            <p className={`text-xl font-bold ${accuracy >= difficulty.requiredAccuracy ? 'text-secondary-400' : 'text-yellow-400'}`}>
              {accuracy.toFixed(0)}%
            </p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-gray-400 text-xs mb-1">Attempts</p>
            <p className="text-white text-xl font-bold">{attempts}/10</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-gray-400 text-xs mb-1">Required</p>
            <p className="text-primary-400 text-xl font-bold">{difficulty.requiredAccuracy}%</p>
          </div>
        </div>
      </div>
      )}

      {/* Distance Progression Panel - for near vision training - hide when active */}
      {!isActive && visionType === 'near' && distanceProgressionMode && (
        <div className="bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-400/30 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <MoveHorizontal className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h4 className="text-white font-bold">Distance Progression</h4>
                <p className="text-sm text-gray-300">Like adding weight to a barbell</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Glasses className={`w-5 h-5 ${currentGlassesStage.color}`} />
              <span className={`font-semibold ${currentGlassesStage.color}`}>
                {currentGlassesStage.label}
              </span>
            </div>
          </div>

          {/* Distance progress bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Target Distance</span>
              <span className="text-white font-bold">{targetDistanceCm} cm</span>
            </div>
            <div className="bg-gray-700 rounded-full h-4 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500"
                style={{ width: `${((targetDistanceCm - 20) / 40) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>20 cm (close)</span>
              <span>60 cm (arm's length)</span>
            </div>
          </div>

          {/* Glasses progression stages */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {READER_GLASSES_STAGES.map((stage, idx) => (
              <div
                key={stage.stage}
                className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  idx === readerGlassesStage
                    ? 'bg-blue-500/30 border border-blue-400/50 text-white'
                    : idx < readerGlassesStage
                    ? 'bg-secondary-500/20 border border-secondary-400/30 text-secondary-300'
                    : 'bg-gray-800/50 border border-gray-600/30 text-gray-500'
                }`}
              >
                {idx < readerGlassesStage && <CheckCircle className="w-3 h-3 inline mr-1" />}
                {stage.label}
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-400 mt-3">
            Move the screen away as you get correct answers. At arm's length, add reader glasses to "add weight" and continue strengthening.
          </p>
        </div>
      )}

      {/* Glasses upgrade prompt */}
      {showGlassesPrompt && (
        <div className="bg-gradient-to-r from-purple-600/30 to-pink-600/30 border border-purple-400/40 rounded-lg p-6 animate-pulse">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-purple-500/30 rounded-lg">
              <Trophy className="w-8 h-8 text-purple-400" />
            </div>
            <div className="flex-1">
              <h4 className="text-white font-bold text-lg mb-2">Ready for More Challenge!</h4>
              <p className="text-gray-300 mb-4">
                You've mastered the current distance. Add <span className="font-bold text-cyan-400">{READER_GLASSES_STAGES[readerGlassesStage + 1]?.label}</span> to continue strengthening your eyes.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={upgradeGlasses}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold flex items-center gap-2 transition-all"
                >
                  <Glasses className="w-5 h-5" />
                  Add Glasses
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={skipGlassesUpgrade}
                  className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg font-medium transition-all"
                >
                  Not Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Distance guidance - hide when active to keep chart visible */}
      {!isActive && (
        <DistanceGuidance
          targetDistanceCm={distanceProgressionMode ? targetDistanceCm : difficulty.targetDistance}
          visionType={visionType}
          deviceMode={deviceMode}
        />
      )}

      {/* Session complete */}
      {sessionComplete && (
        <div className="bg-gradient-to-br from-secondary-600/20 to-primary-600/20 border border-secondary-400/30 rounded-lg p-8 text-center">
          <CheckCircle className="w-16 h-16 text-secondary-400 mx-auto mb-4" />
          <h3 className="text-3xl font-bold text-white mb-2">Session Complete!</h3>
          <p className="text-gray-300 mb-6">
            You've completed all {currentLevel} levels with {accuracy.toFixed(1)}% accuracy
          </p>
          <button
            onClick={resetSession}
            className="px-8 py-3 rounded-lg font-semibold bg-secondary-500 hover:bg-secondary-600 text-white transition-all"
          >
            Start New Session
          </button>
        </div>
      )}

      {/* Instructions for first-time users */}
      {!isActive && !sessionComplete && attempts === 0 && (
        <div className="bg-blue-500/10 border border-blue-400/30 rounded-lg p-6">
          <h4 className="text-blue-300 font-semibold mb-3">How to Train:</h4>
          <ul className="text-gray-300 space-y-2 text-sm">
            <li>• Press Start to begin your training session</li>
            <li>• Position yourself at the target distance shown</li>
            <li>• Identify the letter or direction of the "E"</li>
            <li>• You need {difficulty.requiredAccuracy}% accuracy to advance (10 attempts per level)</li>
            <li>• Listen for verbal feedback after each answer</li>
            <li>• Complete all 10 levels to finish the session</li>
          </ul>
        </div>
      )}
    </div>
  )
}
