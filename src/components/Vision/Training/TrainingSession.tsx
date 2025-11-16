'use client'

import { useState, useEffect } from 'react'
import SnellenChart from './SnellenChart'
import DistanceTracker from './DistanceTracker'
import { Play, Pause, RotateCcw, CheckCircle, XCircle } from 'lucide-react'

interface TrainingSessionProps {
  visionType: 'near' | 'far'
  exerciseType: 'letters' | 'e-directional'
  initialLevel?: number
}

// Adaptive difficulty system
const DIFFICULTY_LEVELS = [
  { level: 1, chartSize: '20/200', targetDistance: 40, requiredAccuracy: 60 },
  { level: 2, chartSize: '20/100', targetDistance: 45, requiredAccuracy: 65 },
  { level: 3, chartSize: '20/70', targetDistance: 50, requiredAccuracy: 70 },
  { level: 4, chartSize: '20/50', targetDistance: 55, requiredAccuracy: 75 },
  { level: 5, chartSize: '20/40', targetDistance: 60, requiredAccuracy: 80 },
  { level: 6, chartSize: '20/30', targetDistance: 300, requiredAccuracy: 80 }, // Far vision starts
  { level: 7, chartSize: '20/25', targetDistance: 400, requiredAccuracy: 85 },
  { level: 8, chartSize: '20/20', targetDistance: 500, requiredAccuracy: 85 },
  { level: 9, chartSize: '20/15', targetDistance: 600, requiredAccuracy: 90 },
  { level: 10, chartSize: '20/10', targetDistance: 600, requiredAccuracy: 95 }
]

export default function TrainingSession({
  visionType,
  exerciseType,
  initialLevel = 1
}: TrainingSessionProps) {
  const [currentLevel, setCurrentLevel] = useState(initialLevel)
  const [isActive, setIsActive] = useState(false)
  const [currentDistance, setCurrentDistance] = useState(40)
  const [attempts, setAttempts] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [sessionDuration, setSessionDuration] = useState(0)
  const [currentLetter, setCurrentLetter] = useState<string>()
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null)
  const [sessionComplete, setSessionComplete] = useState(false)

  const difficulty = DIFFICULTY_LEVELS[currentLevel - 1] || DIFFICULTY_LEVELS[0]
  const accuracy = attempts > 0 ? (correct / attempts) * 100 : 0

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

  const handleAnswer = (isCorrect: boolean) => {
    setAttempts(prev => prev + 1)
    if (isCorrect) {
      setCorrect(prev => prev + 1)
      setFeedback('correct')
      speak('Correct!')
    } else {
      setFeedback('incorrect')
      speak('Try again')
    }

    // Clear feedback after 1 second and generate new letter
    setTimeout(() => {
      setFeedback(null)
      setCurrentLetter(undefined) // Triggers new random letter
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
            speak(`Level up! Now trying ${DIFFICULTY_LEVELS[currentLevel]?.chartSize}`)
          }, 1500)
        } else {
          // Completed all levels!
          setTimeout(() => {
            setSessionComplete(true)
            setIsActive(false)
            speak('Congratulations! Session complete.')
            saveSession(true)
          }, 1500)
        }
      } else {
        // Failed level - try again
        setTimeout(() => {
          setAttempts(0)
          setCorrect(0)
          speak(`Let's try this level again. You need ${difficulty.requiredAccuracy}% accuracy.`)
        }, 1500)
      }
    }
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
          distanceCm: currentDistance,
          accuracy,
          chartSize: difficulty.chartSize,
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
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="bg-gray-900/40 border border-primary-400/30 rounded-lg p-6 shadow-inner">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-2xl font-bold text-white mb-1">
              Level {currentLevel} - {difficulty.chartSize}
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

      {/* Distance tracker */}
      <DistanceTracker
        targetDistanceCm={difficulty.targetDistance}
        onDistanceChange={setCurrentDistance}
        visionType={visionType}
      />

      {/* Snellen chart */}
      {isActive && !sessionComplete && (
        <div className="relative">
          {/* Feedback overlay */}
          {feedback && (
            <div className={`absolute top-4 right-4 z-10 flex items-center gap-2 px-4 py-2 rounded-lg font-semibold ${
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

          <SnellenChart
            chartSize={difficulty.chartSize}
            exerciseType={exerciseType}
            onAnswer={handleAnswer}
            currentLetter={currentLetter}
          />
        </div>
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
