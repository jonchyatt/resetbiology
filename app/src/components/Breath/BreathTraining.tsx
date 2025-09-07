"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Wind, Play, Pause, RotateCcw, Heart, TrendingUp } from "lucide-react"
import { BreathOrb } from "./BreathOrb"
import { PhaseTimer } from "./PhaseTimer"
import { Controls } from "./Controls"
import { Configurator } from "./Configurator"
import { SessionStats } from "./SessionStats"
import { BreathStorage } from "@/lib/breathStorage"
import { BreathState, BreathSettings, DEFAULT_SETTINGS, CycleData, SessionData } from "@/types/breath"

interface BreathTrainingProps {
  onSessionComplete?: (session: any) => void
}

export function BreathTraining({ onSessionComplete }: BreathTrainingProps) {
  const [sessionType, setSessionType] = useState<'guided' | 'freeform' | 'challenge'>('guided')
  const [isActive, setIsActive] = useState(false)
  const [currentPhase, setCurrentPhase] = useState<'inhale' | 'hold' | 'exhale' | 'rest'>('inhale')
  const [cycle, setCycle] = useState(0)
  const [targetCycles, setTargetCycles] = useState(10)
  const [sessionTime, setSessionTime] = useState(0)
  const [heartRate, setHeartRate] = useState(72) // Mock HRV data
  const [relaxationScore, setRelaxationScore] = useState(50)
  
  const phaseTimeouts = useRef<NodeJS.Timeout[]>([])
  const sessionInterval = useRef<NodeJS.Timeout>()

  // Breath pattern configurations
  const breathPatterns = {
    guided: { inhale: 4, hold: 7, exhale: 8, rest: 0 }, // 4-7-8 relaxation
    freeform: { inhale: 4, hold: 4, exhale: 4, rest: 0 }, // Box breathing
    challenge: { inhale: 4, hold: 7, exhale: 8, rest: 2 } // Advanced pattern
  }

  const currentPattern = breathPatterns[sessionType]

  useEffect(() => {
    if (isActive) {
      sessionInterval.current = setInterval(() => {
        setSessionTime(prev => prev + 1)
        
        // Mock physiological improvements
        setHeartRate(prev => Math.max(60, prev - 0.1))
        setRelaxationScore(prev => Math.min(100, prev + 0.2))
      }, 1000)
      
      runBreathCycle()
    } else {
      clearAllTimers()
    }

    return () => clearAllTimers()
  }, [isActive, sessionType])

  const clearAllTimers = () => {
    phaseTimeouts.current.forEach(timeout => clearTimeout(timeout))
    phaseTimeouts.current = []
    if (sessionInterval.current) {
      clearInterval(sessionInterval.current)
    }
  }

  const runBreathCycle = () => {
    if (!isActive) return

    const sequence = [
      { phase: 'inhale', duration: currentPattern.inhale },
      { phase: 'hold', duration: currentPattern.hold },
      { phase: 'exhale', duration: currentPattern.exhale },
      ...(currentPattern.rest > 0 ? [{ phase: 'rest', duration: currentPattern.rest }] : [])
    ]

    let currentStep = 0

    const executePhase = () => {
      if (!isActive || currentStep >= sequence.length) {
        setCycle(prev => {
          const newCycle = prev + 1
          if (newCycle >= targetCycles) {
            completeSession()
            return newCycle
          }
          return newCycle
        })
        currentStep = 0
        if (cycle + 1 < targetCycles) {
          setTimeout(executePhase, 500) // Brief pause between cycles
        }
        return
      }

      const step = sequence[currentStep]
      setCurrentPhase(step.phase as any)

      const timeout = setTimeout(() => {
        currentStep++
        executePhase()
      }, step.duration * 1000)

      phaseTimeouts.current.push(timeout)
    }

    executePhase()
  }

  const startSession = () => {
    setIsActive(true)
    setCycle(0)
    setSessionTime(0)
    setHeartRate(72 + Math.random() * 10) // Realistic starting HR
    setRelaxationScore(50 + Math.random() * 10)
  }

  const stopSession = () => {
    setIsActive(false)
    setCurrentPhase('inhale')
  }

  const completeSession = () => {
    setIsActive(false)
    setCurrentPhase('inhale')
    
    const session: BreathSession = {
      id: `session-${Date.now()}`,
      sessionType,
      duration: sessionTime,
      cycles: targetCycles,
      progressScore: Math.round(relaxationScore),
      improvements: {
        heartRateVariability: Math.round((72 - heartRate) * 10) / 10,
        relaxationScore: Math.round(relaxationScore)
      }
    }
    
    onSessionComplete?.(session)
    
    // Celebration psychology
    alert(`🌬️ Session Complete! +50 points earned. HRV improved by ${session.improvements?.heartRateVariability}!`)
  }

  const resetSession = () => {
    stopSession()
    setCycle(0)
    setSessionTime(0)
  }

  const getPhaseInstruction = () => {
    switch (currentPhase) {
      case 'inhale': return 'Breathe In'
      case 'hold': return 'Hold'
      case 'exhale': return 'Breathe Out'
      case 'rest': return 'Rest'
    }
  }

  const getPhaseColor = () => {
    switch (currentPhase) {
      case 'inhale': return 'text-blue-600'
      case 'hold': return 'text-purple-600'
      case 'exhale': return 'text-green-600'
      case 'rest': return 'text-gray-600'
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="bg-white rounded-lg p-6 shadow-lg">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-400 to-green-400 rounded-full flex items-center justify-center">
          <Wind className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Breath Training</h2>
        <p className="text-gray-600">
          Enhance your metabolic reset with proven breathing techniques that reduce stress and optimize results.
        </p>
      </div>

      {/* Session Type Selection */}
      {!isActive && (
        <div className="mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">Choose Your Session</h3>
          <div className="grid gap-3">
            {Object.keys(breathPatterns).map(type => (
              <button
                key={type}
                onClick={() => setSessionType(type as any)}
                className={`p-4 rounded-lg border text-left transition-all ${
                  sessionType === type 
                    ? 'border-primary-400 bg-primary-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-900 capitalize">{type} Session</h4>
                    <p className="text-sm text-gray-600">
                      {type === 'guided' && '4-7-8 Pattern • Best for beginners • Deep relaxation'}
                      {type === 'freeform' && 'Box Breathing • Balanced approach • Stress relief'}
                      {type === 'challenge' && 'Advanced Pattern • Maximum benefits • +bonus points'}
                    </p>
                  </div>
                  <div className="text-xs text-gray-500">
                    {type === 'guided' && '+50 pts'}
                    {type === 'freeform' && '+50 pts'}
                    {type === 'challenge' && '+75 pts'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active Session Display */}
      {isActive && (
        <div className="text-center mb-6">
          {/* Breathing Animation Circle */}
          <div className="relative mb-6">
            <div className={`w-32 h-32 mx-auto rounded-full border-4 transition-all duration-1000 ${
              currentPhase === 'inhale' ? 'border-blue-400 scale-110' :
              currentPhase === 'hold' ? 'border-purple-400 scale-110' :
              currentPhase === 'exhale' ? 'border-green-400 scale-90' :
              'border-gray-400 scale-100'
            } ${getPhaseColor()}`}>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className={`text-2xl font-bold ${getPhaseColor()}`}>
                    {getPhaseInstruction()}
                  </div>
                  <div className="text-sm text-gray-500">
                    {currentPattern[currentPhase]}s
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Session Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900">{cycle}</div>
              <div className="text-sm text-gray-600">/ {targetCycles} cycles</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">{formatTime(sessionTime)}</div>
              <div className="text-sm text-gray-600">elapsed</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">{Math.round(relaxationScore)}</div>
              <div className="text-sm text-gray-600">relaxation</div>
            </div>
          </div>
        </div>
      )}

      {/* Session Controls */}
      <div className="flex justify-center space-x-4 mb-6">
        {!isActive ? (
          <button
            onClick={startSession}
            className="flex items-center px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-semibold transition-colors"
          >
            <Play className="w-5 h-5 mr-2" />
            Start Session
          </button>
        ) : (
          <>
            <button
              onClick={stopSession}
              className="flex items-center px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-colors"
            >
              <Pause className="w-4 h-4 mr-2" />
              Pause
            </button>
            
            <button
              onClick={resetSession}
              className="flex items-center px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </button>
          </>
        )}
      </div>

      {/* Progress & Benefits */}
      {isActive && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center mb-2">
              <Heart className="w-5 h-5 text-blue-600 mr-2" />
              <span className="font-semibold text-blue-800">Heart Rate Variability</span>
            </div>
            <div className="text-sm text-blue-700">
              <div className="flex justify-between">
                <span>Current HR:</span>
                <span className="font-semibold">{Math.round(heartRate)} bpm</span>
              </div>
              <div className="flex justify-between">
                <span>Improvement:</span>
                <span className="font-semibold text-green-600">+{Math.round((72 - heartRate) * 10) / 10}</span>
              </div>
            </div>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <div className="flex items-center mb-2">
              <TrendingUp className="w-5 h-5 text-green-600 mr-2" />
              <span className="font-semibold text-green-800">Stress Reduction</span>
            </div>
            <div className="text-sm text-green-700">
              <div className="flex justify-between">
                <span>Relaxation Score:</span>
                <span className="font-semibold">{Math.round(relaxationScore)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Metabolic Boost:</span>
                <span className="font-semibold text-blue-600">Active</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Psychology Motivation */}
      {!isActive && (
        <div className="bg-gradient-to-r from-primary-50 to-secondary-50 p-4 rounded-lg border border-primary-200">
          <h3 className="font-semibold text-gray-900 mb-2">🧠 Why Breath Training Accelerates Your Reset</h3>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>• Reduces cortisol (stress hormone that blocks weight loss)</li>
            <li>• Improves insulin sensitivity (works with Retatrutide)</li>
            <li>• Activates parasympathetic nervous system (recovery mode)</li>
            <li>• Builds discipline that transfers to all healthy behaviors</li>
          </ul>
          
          <div className="mt-3 p-3 bg-yellow-50 rounded border border-yellow-200">
            <p className="text-yellow-800 text-sm font-semibold">
              💡 Pro tip: Daily breath training participants show 23% better long-term weight maintenance!
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export function BreathSessionHistory({ sessions }: { sessions: BreathSession[] }) {
  const totalSessions = sessions.length
  const totalMinutes = Math.round(sessions.reduce((sum, s) => sum + s.duration, 0) / 60)
  const avgRelaxation = Math.round(sessions.reduce((sum, s) => sum + (s.improvements?.relaxationScore || 50), 0) / Math.max(sessions.length, 1))

  return (
    <div className="bg-white rounded-lg p-6 shadow-md">
      <h3 className="text-lg font-bold text-gray-900 mb-4">🌬️ Your Breath Training Journey</h3>
      
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{totalSessions}</div>
          <div className="text-sm text-blue-800">Sessions</div>
        </div>
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{totalMinutes}</div>
          <div className="text-sm text-green-800">Minutes</div>
        </div>
        <div className="text-center p-3 bg-purple-50 rounded-lg">
          <div className="text-2xl font-bold text-purple-600">{avgRelaxation}%</div>
          <div className="text-sm text-purple-800">Avg Relaxation</div>
        </div>
      </div>

      {sessions.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-semibold text-gray-900">Recent Sessions</h4>
          {sessions.slice(-5).reverse().map((session, index) => (
            <div key={session.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center">
                <Wind className="w-4 h-4 text-gray-500 mr-2" />
                <span className="text-sm font-medium capitalize">{session.sessionType}</span>
                <span className="text-xs text-gray-500 ml-2">
                  {Math.round(session.duration / 60)} min • {session.cycles} cycles
                </span>
              </div>
              <div className="flex items-center text-sm">
                <TrendingUp className="w-3 h-3 text-green-500 mr-1" />
                <span className="text-green-600 font-semibold">+{session.sessionType === 'challenge' ? 75 : 50} pts</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Streak Psychology */}
      {totalSessions >= 3 && (
        <div className="mt-6 bg-gradient-to-r from-primary-500 to-secondary-500 text-white p-4 rounded-lg text-center">
          <h4 className="font-bold mb-2">🔥 Breath Training Streak!</h4>
          <p className="text-sm text-primary-100">
            {totalSessions} sessions completed! Your nervous system is adapting. 
            Keep this momentum to maximize your metabolic reset!
          </p>
        </div>
      )}
    </div>
  )
}