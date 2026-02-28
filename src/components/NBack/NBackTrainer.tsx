'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Brain,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Grid3X3,
  Type,
  TrendingUp,
  Target,
  Clock,
  Award,
  ChevronUp,
  ChevronDown,
  Settings,
  HelpCircle,
  CheckCircle2,
  XCircle,
  Zap,
  Calendar,
  Flame
} from 'lucide-react'
import { PortalHeader } from '@/components/Navigation/PortalHeader'

// Types
type GameMode = 'dual' | 'triple'
type GameState = 'idle' | 'countdown' | 'playing' | 'paused' | 'finished'

interface Trial {
  position: number // 0-8 for 3x3 grid
  audioLetter: string
  visualLetter?: string // For triple mode
  isPositionMatch: boolean
  isAudioMatch: boolean
  isLetterMatch?: boolean
}

interface SessionStats {
  positionHits: number
  positionMisses: number
  positionFalse: number
  audioHits: number
  audioMisses: number
  audioFalse: number
  letterHits: number
  letterMisses: number
  letterFalse: number
}

interface ProgressData {
  gameMode: string
  currentNLevel: number
  highestNLevel: number
  bestAccuracy: number
  totalSessions: number
  streakDays: number
  lastSessionDate: string | null
}

interface SessionRecord {
  id: string
  gameMode: string
  nLevel: number
  overallAccuracy: number
  positionAccuracy: number
  audioAccuracy: number
  letterAccuracy?: number
  durationSeconds: number
  levelAdvanced: boolean
  createdAt: string
}

// Audio letters used (phonetically distinct)
const AUDIO_LETTERS = ['C', 'H', 'K', 'L', 'Q', 'R', 'S', 'T']
const VISUAL_LETTERS = ['A', 'B', 'F', 'G', 'M', 'N', 'P', 'W']

// Generate stimuli sequence
function generateSequence(nLevel: number, totalTrials: number, gameMode: GameMode): Trial[] {
  const trials: Trial[] = []
  const matchProbability = 0.25 // 25% chance of match per modality

  for (let i = 0; i < totalTrials; i++) {
    let position: number
    let audioLetter: string
    let visualLetter: string | undefined
    let isPositionMatch = false
    let isAudioMatch = false
    let isLetterMatch = false

    if (i >= nLevel) {
      // Determine if this should be a match
      const shouldPositionMatch = Math.random() < matchProbability
      const shouldAudioMatch = Math.random() < matchProbability
      const shouldLetterMatch = gameMode === 'triple' ? Math.random() < matchProbability : false

      if (shouldPositionMatch) {
        position = trials[i - nLevel].position
        isPositionMatch = true
      } else {
        // Pick different position
        do {
          position = Math.floor(Math.random() * 9)
        } while (position === trials[i - nLevel].position)
      }

      if (shouldAudioMatch) {
        audioLetter = trials[i - nLevel].audioLetter
        isAudioMatch = true
      } else {
        do {
          audioLetter = AUDIO_LETTERS[Math.floor(Math.random() * AUDIO_LETTERS.length)]
        } while (audioLetter === trials[i - nLevel].audioLetter)
      }

      if (gameMode === 'triple') {
        if (shouldLetterMatch) {
          visualLetter = trials[i - nLevel].visualLetter
          isLetterMatch = true
        } else {
          do {
            visualLetter = VISUAL_LETTERS[Math.floor(Math.random() * VISUAL_LETTERS.length)]
          } while (visualLetter === trials[i - nLevel].visualLetter)
        }
      }
    } else {
      // First n trials - no matches possible
      position = Math.floor(Math.random() * 9)
      audioLetter = AUDIO_LETTERS[Math.floor(Math.random() * AUDIO_LETTERS.length)]
      if (gameMode === 'triple') {
        visualLetter = VISUAL_LETTERS[Math.floor(Math.random() * VISUAL_LETTERS.length)]
      }
    }

    trials.push({
      position,
      audioLetter,
      visualLetter,
      isPositionMatch,
      isAudioMatch,
      isLetterMatch: gameMode === 'triple' ? isLetterMatch : undefined
    })
  }

  return trials
}

// Text-to-speech for audio stimuli
function speakLetter(letter: string, volume: number = 0.8) {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(letter)
    utterance.rate = 0.9
    utterance.pitch = 1
    utterance.volume = volume
    window.speechSynthesis.speak(utterance)
  }
}

export default function NBackTrainer() {
  // Game settings
  const [gameMode, setGameMode] = useState<GameMode>('dual')
  const [nLevel, setNLevel] = useState(2)
  const [trialsPerSession, setTrialsPerSession] = useState(20)
  const [trialDurationMs, setTrialDurationMs] = useState(3000)
  const [audioVolume, setAudioVolume] = useState(0.8)

  // Game state
  const [gameState, setGameState] = useState<GameState>('idle')
  const [countdown, setCountdown] = useState(3)
  const [currentTrialIndex, setCurrentTrialIndex] = useState(0)
  const [trials, setTrials] = useState<Trial[]>([])
  const [showStimulus, setShowStimulus] = useState(false)
  const [sessionStartTime, setSessionStartTime] = useState<number>(0)

  // User responses for current trial
  const [positionResponse, setPositionResponse] = useState(false)
  const [audioResponse, setAudioResponse] = useState(false)
  const [letterResponse, setLetterResponse] = useState(false)

  // Session statistics
  const [stats, setStats] = useState<SessionStats>({
    positionHits: 0,
    positionMisses: 0,
    positionFalse: 0,
    audioHits: 0,
    audioMisses: 0,
    audioFalse: 0,
    letterHits: 0,
    letterMisses: 0,
    letterFalse: 0
  })

  // Feedback display
  const [feedback, setFeedback] = useState<{
    position?: 'correct' | 'incorrect' | 'missed'
    audio?: 'correct' | 'incorrect' | 'missed'
    letter?: 'correct' | 'incorrect' | 'missed'
  }>({})

  // Progress and history
  const [progress, setProgress] = useState<ProgressData[]>([])
  const [recentSessions, setRecentSessions] = useState<SessionRecord[]>([])
  const [weeklyStats, setWeeklyStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // UI state
  const [activeTab, setActiveTab] = useState<'training' | 'progress' | 'info'>('training')
  const [showSettings, setShowSettings] = useState(false)
  const [saveResult, setSaveResult] = useState<{ points: number; advanced: boolean } | null>(null)

  // Refs for timers
  const trialTimerRef = useRef<NodeJS.Timeout | null>(null)
  const stimulusTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch user progress on mount
  useEffect(() => {
    fetchProgress()
  }, [])

  const fetchProgress = async () => {
    try {
      const res = await fetch('/api/nback/progress', { credentials: 'include' })
      const data = await res.json()
      if (data.success) {
        setProgress(data.progress || [])
        setRecentSessions(data.recentSessions || [])
        setWeeklyStats(data.weeklyStats)

        // Set N-level based on user's progress
        const modeProgress = data.progress?.find((p: ProgressData) => p.gameMode === gameMode)
        if (modeProgress) {
          setNLevel(modeProgress.currentNLevel)
        }
      }
    } catch (error) {
      console.error('Failed to fetch progress:', error)
    } finally {
      setLoading(false)
    }
  }

  // Update N-level when game mode changes
  useEffect(() => {
    const modeProgress = progress.find(p => p.gameMode === gameMode)
    if (modeProgress) {
      setNLevel(modeProgress.currentNLevel)
    } else {
      setNLevel(2) // Default for new mode
    }
  }, [gameMode, progress])

  // Start game
  const startGame = useCallback(() => {
    const sequence = generateSequence(nLevel, trialsPerSession, gameMode)
    setTrials(sequence)
    setCurrentTrialIndex(0)
    setStats({
      positionHits: 0,
      positionMisses: 0,
      positionFalse: 0,
      audioHits: 0,
      audioMisses: 0,
      audioFalse: 0,
      letterHits: 0,
      letterMisses: 0,
      letterFalse: 0
    })
    setFeedback({})
    setGameState('countdown')
    setCountdown(3)
  }, [nLevel, trialsPerSession, gameMode])

  // Countdown effect
  useEffect(() => {
    if (gameState !== 'countdown') return

    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else {
      setGameState('playing')
      setSessionStartTime(Date.now())
      setShowStimulus(true)
    }
  }, [gameState, countdown])

  // Process trial response
  const processTrialResponse = useCallback(() => {
    if (currentTrialIndex < nLevel) {
      // No matches possible yet, clear responses
      setPositionResponse(false)
      setAudioResponse(false)
      setLetterResponse(false)
      return
    }

    const trial = trials[currentTrialIndex]
    const newFeedback: typeof feedback = {}

    setStats(prev => {
      const newStats = { ...prev }

      // Position
      if (trial.isPositionMatch) {
        if (positionResponse) {
          newStats.positionHits++
          newFeedback.position = 'correct'
        } else {
          newStats.positionMisses++
          newFeedback.position = 'missed'
        }
      } else if (positionResponse) {
        newStats.positionFalse++
        newFeedback.position = 'incorrect'
      }

      // Audio
      if (trial.isAudioMatch) {
        if (audioResponse) {
          newStats.audioHits++
          newFeedback.audio = 'correct'
        } else {
          newStats.audioMisses++
          newFeedback.audio = 'missed'
        }
      } else if (audioResponse) {
        newStats.audioFalse++
        newFeedback.audio = 'incorrect'
      }

      // Letter (triple mode)
      if (gameMode === 'triple') {
        if (trial.isLetterMatch) {
          if (letterResponse) {
            newStats.letterHits++
            newFeedback.letter = 'correct'
          } else {
            newStats.letterMisses++
            newFeedback.letter = 'missed'
          }
        } else if (letterResponse) {
          newStats.letterFalse++
          newFeedback.letter = 'incorrect'
        }
      }

      return newStats
    })

    setFeedback(newFeedback)
    setPositionResponse(false)
    setAudioResponse(false)
    setLetterResponse(false)
  }, [currentTrialIndex, nLevel, trials, positionResponse, audioResponse, letterResponse, gameMode])

  // Main game loop
  useEffect(() => {
    if (gameState !== 'playing' || !showStimulus) return

    const trial = trials[currentTrialIndex]
    if (!trial) return

    // Play audio
    speakLetter(trial.audioLetter, audioVolume)

    // Hide stimulus after display time
    stimulusTimerRef.current = setTimeout(() => {
      setShowStimulus(false)

      // Process response after brief delay
      setTimeout(() => {
        processTrialResponse()

        // Move to next trial or finish
        if (currentTrialIndex < trials.length - 1) {
          setTimeout(() => {
            setCurrentTrialIndex(prev => prev + 1)
            setShowStimulus(true)
            setFeedback({})
          }, 500)
        } else {
          finishSession()
        }
      }, 200)
    }, trialDurationMs - 500)

    return () => {
      if (stimulusTimerRef.current) clearTimeout(stimulusTimerRef.current)
    }
  }, [gameState, showStimulus, currentTrialIndex, trials, trialDurationMs, audioVolume, processTrialResponse])

  // Finish session and save
  const finishSession = useCallback(async () => {
    setGameState('finished')
    const durationSeconds = Math.round((Date.now() - sessionStartTime) / 1000)

    // Calculate accuracies
    const totalPositionTargets = trials.filter((t, i) => i >= nLevel && t.isPositionMatch).length
    const totalAudioTargets = trials.filter((t, i) => i >= nLevel && t.isAudioMatch).length
    const totalLetterTargets = trials.filter((t, i) => i >= nLevel && t.isLetterMatch).length

    const positionAccuracy = totalPositionTargets > 0
      ? ((stats.positionHits / (stats.positionHits + stats.positionMisses + stats.positionFalse)) * 100) || 0
      : 100

    const audioAccuracy = totalAudioTargets > 0
      ? ((stats.audioHits / (stats.audioHits + stats.audioMisses + stats.audioFalse)) * 100) || 0
      : 100

    const letterAccuracy = gameMode === 'triple' && totalLetterTargets > 0
      ? ((stats.letterHits / (stats.letterHits + stats.letterMisses + stats.letterFalse)) * 100) || 0
      : gameMode === 'triple' ? 100 : undefined

    // Overall accuracy - weighted average
    let overallAccuracy: number
    if (gameMode === 'triple') {
      overallAccuracy = (positionAccuracy + audioAccuracy + (letterAccuracy || 0)) / 3
    } else {
      overallAccuracy = (positionAccuracy + audioAccuracy) / 2
    }

    // Level advancement threshold: 80% overall accuracy
    const levelAdvanced = overallAccuracy >= 80

    try {
      const res = await fetch('/api/nback/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          gameMode,
          nLevel,
          totalTrials: trialsPerSession,
          ...stats,
          overallAccuracy: Math.round(overallAccuracy * 10) / 10,
          positionAccuracy: Math.round(positionAccuracy * 10) / 10,
          audioAccuracy: Math.round(audioAccuracy * 10) / 10,
          letterAccuracy: letterAccuracy !== undefined ? Math.round(letterAccuracy * 10) / 10 : null,
          durationSeconds,
          levelAdvanced
        })
      })

      const data = await res.json()
      if (data.success) {
        setSaveResult({
          points: data.pointsAwarded,
          advanced: data.levelAdvanced
        })
        fetchProgress() // Refresh progress
      }
    } catch (error) {
      console.error('Failed to save session:', error)
    }
  }, [gameMode, nLevel, trialsPerSession, stats, trials, sessionStartTime])

  // Pause/Resume
  const togglePause = () => {
    if (gameState === 'playing') {
      setGameState('paused')
    } else if (gameState === 'paused') {
      setGameState('playing')
      setShowStimulus(true)
    }
  }

  // Reset game
  const resetGame = () => {
    setGameState('idle')
    setTrials([])
    setCurrentTrialIndex(0)
    setShowStimulus(false)
    setFeedback({})
    setSaveResult(null)
    if (trialTimerRef.current) clearTimeout(trialTimerRef.current)
    if (stimulusTimerRef.current) clearTimeout(stimulusTimerRef.current)
  }

  // Handle key presses
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return

      if (e.key === 'a' || e.key === 'A') {
        setAudioResponse(true)
      } else if (e.key === 'l' || e.key === 'L') {
        setPositionResponse(true)
      } else if (gameMode === 'triple' && (e.key === 's' || e.key === 'S')) {
        setLetterResponse(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [gameState, gameMode])

  // Current progress for display
  const currentModeProgress = progress.find(p => p.gameMode === gameMode)

  // Calculate live accuracy during game
  const liveAccuracy = (() => {
    const totalResponses = stats.positionHits + stats.positionMisses + stats.positionFalse +
      stats.audioHits + stats.audioMisses + stats.audioFalse
    if (totalResponses === 0) return 0
    const hits = stats.positionHits + stats.audioHits
    return Math.round((hits / totalResponses) * 100)
  })()

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative"
      style={{
        backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      <div className="relative z-10 pt-32">
        <PortalHeader
          section="Mental Training"
          secondaryBackLink="/daily-history"
          secondaryBackText="Daily History"
        />

        {/* Title */}
        <div className="text-center py-8">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4">
            <span className="text-primary-400">Memory</span> Trainer
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Train your working memory and fluid intelligence with scientifically-validated dual and triple N-Back exercises.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center gap-2 mb-8 px-4">
          {[
            { id: 'training', label: 'Training', icon: Brain },
            { id: 'progress', label: 'Progress', icon: TrendingUp },
            { id: 'info', label: 'How to Play', icon: HelpCircle }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${activeTab === tab.id
                ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
                : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
                }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="container mx-auto px-4 pb-16">
          {/* Training Tab */}
          {activeTab === 'training' && (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Game Mode & Settings */}
              {gameState === 'idle' && (
                <div className="bg-gray-900/60 backdrop-blur-sm rounded-2xl border border-primary-400/20 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-white mb-1">Configure Session</h2>
                      <p className="text-gray-400">Choose your training mode and difficulty</p>
                    </div>
                    <button
                      onClick={() => setShowSettings(!showSettings)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 transition"
                    >
                      <Settings className="w-4 h-4" />
                      {showSettings ? 'Hide' : 'Show'} Settings
                    </button>
                  </div>

                  {/* Game Mode Selection */}
                  <div className="grid md:grid-cols-2 gap-4 mb-6">
                    <button
                      onClick={() => setGameMode('dual')}
                      className={`p-6 rounded-xl border-2 transition-all text-left ${gameMode === 'dual'
                        ? 'border-primary-400 bg-primary-500/10'
                        : 'border-gray-700 hover:border-gray-600'
                        }`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-primary-500/20">
                          <Grid3X3 className="w-6 h-6 text-primary-400" />
                        </div>
                        <div className="p-2 rounded-lg bg-blue-500/20">
                          <Volume2 className="w-6 h-6 text-blue-400" />
                        </div>
                      </div>
                      <h3 className="text-xl font-bold text-white mb-1">Dual N-Back</h3>
                      <p className="text-gray-400 text-sm">
                        Track position (visual) and audio (letters) simultaneously
                      </p>
                    </button>

                    <button
                      onClick={() => setGameMode('triple')}
                      className={`p-6 rounded-xl border-2 transition-all text-left ${gameMode === 'triple'
                        ? 'border-secondary-400 bg-secondary-500/10'
                        : 'border-gray-700 hover:border-gray-600'
                        }`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-primary-500/20">
                          <Grid3X3 className="w-6 h-6 text-primary-400" />
                        </div>
                        <div className="p-2 rounded-lg bg-blue-500/20">
                          <Volume2 className="w-6 h-6 text-blue-400" />
                        </div>
                        <div className="p-2 rounded-lg bg-secondary-500/20">
                          <Type className="w-6 h-6 text-secondary-400" />
                        </div>
                      </div>
                      <h3 className="text-xl font-bold text-white mb-1">Triple N-Back</h3>
                      <p className="text-gray-400 text-sm">
                        Add visual letters for an extra challenge
                      </p>
                    </button>
                  </div>

                  {/* N-Level Selection */}
                  <div className="mb-6">
                    <label className="text-sm font-semibold text-gray-300 mb-3 block">
                      N-Level: {nLevel}-Back
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setNLevel(Math.max(1, nLevel - 1))}
                        disabled={nLevel <= 1}
                        className="p-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronDown className="w-5 h-5" />
                      </button>
                      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary-500 to-secondary-500 transition-all"
                          style={{ width: `${(nLevel / 9) * 100}%` }}
                        />
                      </div>
                      <button
                        onClick={() => setNLevel(Math.min(9, nLevel + 1))}
                        disabled={nLevel >= 9}
                        className="p-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronUp className="w-5 h-5" />
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Match stimuli from {nLevel} trials ago. Higher = harder.
                    </p>
                  </div>

                  {/* Advanced Settings */}
                  {showSettings && (
                    <div className="grid md:grid-cols-2 gap-4 p-4 bg-gray-800/50 rounded-xl mb-6">
                      <div>
                        <label className="text-sm font-medium text-gray-300 mb-2 block">
                          Trials per Session: {trialsPerSession}
                        </label>
                        <input
                          type="range"
                          min={15}
                          max={40}
                          step={5}
                          value={trialsPerSession}
                          onChange={e => setTrialsPerSession(Number(e.target.value))}
                          className="w-full accent-primary-500"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-300 mb-2 block">
                          Trial Speed: {trialDurationMs / 1000}s
                        </label>
                        <input
                          type="range"
                          min={2000}
                          max={4000}
                          step={250}
                          value={trialDurationMs}
                          onChange={e => setTrialDurationMs(Number(e.target.value))}
                          className="w-full accent-primary-500"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-300 mb-2 block">
                          Audio Volume: {Math.round(audioVolume * 100)}%
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.1}
                          value={audioVolume}
                          onChange={e => setAudioVolume(Number(e.target.value))}
                          className="w-full accent-primary-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Start Button */}
                  <button
                    onClick={startGame}
                    className="w-full py-4 bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white font-bold text-xl rounded-xl shadow-lg shadow-primary-500/30 transition-all transform hover:scale-[1.02]"
                  >
                    <div className="flex items-center justify-center gap-3">
                      <Play className="w-6 h-6" />
                      Start {gameMode === 'dual' ? 'Dual' : 'Triple'} {nLevel}-Back
                    </div>
                  </button>

                  {/* Current Progress */}
                  {currentModeProgress && (
                    <div className="mt-6 p-4 bg-gray-800/50 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Flame className="w-5 h-5 text-orange-400" />
                          <span className="text-gray-300">
                            {currentModeProgress.streakDays} day streak
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Award className="w-5 h-5 text-yellow-400" />
                          <span className="text-gray-300">
                            Best: {currentModeProgress.highestNLevel}-back @ {Math.round(currentModeProgress.bestAccuracy)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Countdown */}
              {gameState === 'countdown' && (
                <div className="bg-gray-900/80 backdrop-blur-sm rounded-2xl border border-primary-400/20 p-16 text-center">
                  <p className="text-gray-400 mb-4">Get Ready!</p>
                  <div className="text-9xl font-bold text-primary-400 animate-pulse">
                    {countdown}
                  </div>
                  <p className="text-gray-400 mt-4">
                    {gameMode === 'dual' ? 'A = Audio Match | L = Position Match' : 'A = Audio | L = Position | S = Letter'}
                  </p>
                </div>
              )}

              {/* Game Board — landscape thumb-friendly layout */}
              {(gameState === 'playing' || gameState === 'paused') && (
                <div className="space-y-4">
                  {/* Compact Stats Bar */}
                  <div className="flex items-center justify-between gap-2 px-2">
                    <span className="text-sm text-gray-400">Trial <span className="text-white font-bold">{currentTrialIndex + 1}/{trialsPerSession}</span></span>
                    <span className="text-sm text-gray-400">N=<span className="text-primary-400 font-bold">{nLevel}</span></span>
                    <span className="text-sm text-gray-400">Acc <span className="text-secondary-400 font-bold">{liveAccuracy}%</span></span>
                    <div className="flex gap-2">
                      <button
                        onClick={togglePause}
                        className="p-2 rounded-lg bg-gray-800/60 text-gray-300 hover:bg-gray-700 transition"
                      >
                        {gameState === 'paused' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={resetGame}
                        className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Main game area — buttons on outer edges, grid centered */}
                  <div className="relative bg-gray-900/80 backdrop-blur-sm rounded-2xl border border-primary-400/20 overflow-hidden">
                    {gameState === 'paused' && (
                      <div className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center z-10">
                        <p className="text-3xl font-bold text-white">PAUSED</p>
                      </div>
                    )}

                    <div className="flex items-stretch min-h-[280px] landscape:min-h-[200px]">
                      {/* LEFT EDGE — left thumb: Audio (top) + Letter (bottom, triple/quad mode) */}
                      <div className="flex flex-col w-20 landscape:w-24 shrink-0 border-r border-gray-700/50">
                        <button
                          onClick={() => setAudioResponse(true)}
                          disabled={gameState === 'paused' || currentTrialIndex < nLevel}
                          className={`flex flex-col items-center justify-center flex-1 font-bold text-sm transition-all active:scale-95 select-none ${audioResponse
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-800/40 text-gray-300 hover:bg-gray-700/60'
                            } ${feedback.audio === 'correct' ? 'ring-2 ring-inset ring-green-500' : ''} ${feedback.audio === 'incorrect' || feedback.audio === 'missed' ? 'ring-2 ring-inset ring-red-500' : ''} disabled:opacity-50`}
                        >
                          <Volume2 className="w-7 h-7 mb-0.5" />
                          <span>Audio</span>
                          <kbd className="mt-0.5 px-1.5 py-0.5 bg-black/30 rounded text-xs text-gray-400">A</kbd>
                        </button>
                        {gameMode === 'triple' && (
                          <button
                            onClick={() => setLetterResponse(true)}
                            disabled={gameState === 'paused' || currentTrialIndex < nLevel}
                            className={`flex flex-col items-center justify-center flex-1 font-bold text-sm transition-all active:scale-95 select-none border-t border-gray-700/50 ${letterResponse
                              ? 'bg-secondary-500 text-white'
                              : 'bg-gray-800/40 text-gray-300 hover:bg-gray-700/60'
                              } ${feedback.letter === 'correct' ? 'ring-2 ring-inset ring-green-500' : ''} ${feedback.letter === 'incorrect' || feedback.letter === 'missed' ? 'ring-2 ring-inset ring-red-500' : ''} disabled:opacity-50`}
                          >
                            <Type className="w-7 h-7 mb-0.5" />
                            <span>Letter</span>
                            <kbd className="mt-0.5 px-1.5 py-0.5 bg-black/30 rounded text-xs text-gray-400">S</kbd>
                          </button>
                        )}
                      </div>

                      {/* CENTER — Grid + Audio Letter */}
                      <div className="flex-1 flex flex-col items-center justify-center py-4 px-2">
                        {/* 3x3 Grid */}
                        <div className="grid grid-cols-3 gap-2 w-fit mb-3">
                          {Array.from({ length: 9 }).map((_, i) => {
                            const isActive = showStimulus && trials[currentTrialIndex]?.position === i
                            return (
                              <div
                                key={i}
                                className={`w-14 h-14 landscape:w-12 landscape:h-12 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all duration-200 ${isActive
                                  ? 'bg-primary-500 border-primary-400 text-white shadow-lg shadow-primary-500/50'
                                  : 'bg-gray-800/50 border-gray-700'
                                  }`}
                              >
                                {isActive && gameMode === 'triple' && trials[currentTrialIndex]?.visualLetter}
                              </div>
                            )
                          })}
                        </div>

                        {/* Audio Letter Display */}
                        {showStimulus && (
                          <div className="text-center">
                            <p className="text-xs text-gray-500">Audio</p>
                            <p className="text-3xl font-bold text-blue-400">
                              {trials[currentTrialIndex]?.audioLetter}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* RIGHT EDGE — right thumb: Position (top) + [Future: Color (bottom)] */}
                      <div className="flex flex-col w-20 landscape:w-24 shrink-0 border-l border-gray-700/50">
                        <button
                          onClick={() => setPositionResponse(true)}
                          disabled={gameState === 'paused' || currentTrialIndex < nLevel}
                          className={`flex flex-col items-center justify-center flex-1 font-bold text-sm transition-all active:scale-95 select-none ${positionResponse
                            ? 'bg-primary-500 text-white'
                            : 'bg-gray-800/40 text-gray-300 hover:bg-gray-700/60'
                            } ${feedback.position === 'correct' ? 'ring-2 ring-inset ring-green-500' : ''} ${feedback.position === 'incorrect' || feedback.position === 'missed' ? 'ring-2 ring-inset ring-red-500' : ''} disabled:opacity-50`}
                        >
                          <Grid3X3 className="w-7 h-7 mb-0.5" />
                          <span>Position</span>
                          <kbd className="mt-0.5 px-1.5 py-0.5 bg-black/30 rounded text-xs text-gray-400">L</kbd>
                        </button>
                        {/* Future quad mode: Color button will slot here */}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Results Screen */}
              {gameState === 'finished' && (
                <div className="bg-gray-900/80 backdrop-blur-sm rounded-2xl border border-primary-400/20 p-8">
                  <div className="text-center mb-8">
                    <div className={`inline-flex p-4 rounded-full mb-4 ${saveResult?.advanced ? 'bg-secondary-500/20' : 'bg-primary-500/20'
                      }`}>
                      {saveResult?.advanced ? (
                        <Zap className="w-12 h-12 text-secondary-400" />
                      ) : (
                        <CheckCircle2 className="w-12 h-12 text-primary-400" />
                      )}
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-2">
                      {saveResult?.advanced ? 'Level Up!' : 'Session Complete!'}
                    </h2>
                    {saveResult && (
                      <p className="text-xl text-secondary-400">+{saveResult.points} points earned</p>
                    )}
                  </div>

                  {/* Stats Grid */}
                  <div className="grid md:grid-cols-2 gap-6 mb-8">
                    {/* Position Stats */}
                    <div className="bg-gray-800/50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Grid3X3 className="w-5 h-5 text-primary-400" />
                        <h3 className="font-semibold text-white">Position</h3>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Hits</span>
                          <span className="text-green-400">{stats.positionHits}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Misses</span>
                          <span className="text-red-400">{stats.positionMisses}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">False Alarms</span>
                          <span className="text-orange-400">{stats.positionFalse}</span>
                        </div>
                      </div>
                    </div>

                    {/* Audio Stats */}
                    <div className="bg-gray-800/50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Volume2 className="w-5 h-5 text-blue-400" />
                        <h3 className="font-semibold text-white">Audio</h3>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Hits</span>
                          <span className="text-green-400">{stats.audioHits}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Misses</span>
                          <span className="text-red-400">{stats.audioMisses}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">False Alarms</span>
                          <span className="text-orange-400">{stats.audioFalse}</span>
                        </div>
                      </div>
                    </div>

                    {/* Letter Stats (Triple mode) */}
                    {gameMode === 'triple' && (
                      <div className="bg-gray-800/50 rounded-xl p-4 md:col-span-2">
                        <div className="flex items-center gap-2 mb-3">
                          <Type className="w-5 h-5 text-secondary-400" />
                          <h3 className="font-semibold text-white">Letter</h3>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Hits</span>
                            <span className="text-green-400">{stats.letterHits}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Misses</span>
                            <span className="text-red-400">{stats.letterMisses}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">False Alarms</span>
                            <span className="text-orange-400">{stats.letterFalse}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-4 justify-center">
                    <button
                      onClick={() => {
                        resetGame()
                        startGame()
                      }}
                      className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-primary-500 to-secondary-500 text-white font-bold rounded-xl hover:from-primary-600 hover:to-secondary-600 transition"
                    >
                      <RotateCcw className="w-5 h-5" />
                      Play Again
                    </button>
                    <button
                      onClick={resetGame}
                      className="flex items-center gap-2 px-8 py-3 bg-gray-800 text-gray-300 font-bold rounded-xl hover:bg-gray-700 transition"
                    >
                      Back to Menu
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Progress Tab */}
          {activeTab === 'progress' && (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Weekly Stats */}
              {weeklyStats && (
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="bg-gray-900/60 rounded-xl p-4 border border-primary-400/20">
                    <p className="text-xs text-gray-400 uppercase mb-1">This Week</p>
                    <p className="text-3xl font-bold text-white">{weeklyStats.sessionsThisWeek}</p>
                    <p className="text-sm text-gray-400">sessions</p>
                  </div>
                  <div className="bg-gray-900/60 rounded-xl p-4 border border-primary-400/20">
                    <p className="text-xs text-gray-400 uppercase mb-1">Avg Accuracy</p>
                    <p className="text-3xl font-bold text-primary-400">{weeklyStats.avgAccuracyThisWeek}%</p>
                    <p className="text-sm text-gray-400">this week</p>
                  </div>
                  <div className="bg-gray-900/60 rounded-xl p-4 border border-primary-400/20">
                    <p className="text-xs text-gray-400 uppercase mb-1">Level Ups</p>
                    <p className="text-3xl font-bold text-secondary-400">{weeklyStats.advancementsThisWeek}</p>
                    <p className="text-sm text-gray-400">this week</p>
                  </div>
                  <div className="bg-gray-900/60 rounded-xl p-4 border border-primary-400/20">
                    <p className="text-xs text-gray-400 uppercase mb-1">Total Time</p>
                    <p className="text-3xl font-bold text-white">
                      {Math.round(weeklyStats.totalTimeThisWeek / 60)}
                    </p>
                    <p className="text-sm text-gray-400">minutes</p>
                  </div>
                </div>
              )}

              {/* Progress Cards */}
              <div className="grid md:grid-cols-2 gap-6">
                {progress.map(p => (
                  <div
                    key={p.gameMode}
                    className="bg-gray-900/60 rounded-xl p-6 border border-primary-400/20"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-white capitalize">{p.gameMode} N-Back</h3>
                      <div className="flex items-center gap-2">
                        <Flame className="w-5 h-5 text-orange-400" />
                        <span className="text-orange-400 font-bold">{p.streakDays} day streak</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-400 uppercase">Current Level</p>
                        <p className="text-2xl font-bold text-primary-400">{p.currentNLevel}-back</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase">Highest Level</p>
                        <p className="text-2xl font-bold text-secondary-400">{p.highestNLevel}-back</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase">Best Accuracy</p>
                        <p className="text-2xl font-bold text-white">{Math.round(p.bestAccuracy)}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase">Total Sessions</p>
                        <p className="text-2xl font-bold text-white">{p.totalSessions}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Recent Sessions */}
              <div className="bg-gray-900/60 rounded-xl p-6 border border-primary-400/20">
                <h3 className="text-xl font-bold text-white mb-4">Recent Sessions</h3>
                {recentSessions.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">
                    No sessions yet. Start training to track your progress!
                  </p>
                ) : (
                  <div className="space-y-3">
                    {recentSessions.slice(0, 10).map(session => (
                      <div
                        key={session.id}
                        className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${session.levelAdvanced ? 'bg-secondary-500/20' : 'bg-gray-700'
                            }`}>
                            {session.levelAdvanced ? (
                              <Zap className="w-5 h-5 text-secondary-400" />
                            ) : (
                              <Brain className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-white capitalize">
                              {session.gameMode} {session.nLevel}-Back
                            </p>
                            <p className="text-sm text-gray-400">
                              {new Date(session.createdAt).toLocaleDateString()} at{' '}
                              {new Date(session.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-xl font-bold ${session.overallAccuracy >= 80
                            ? 'text-green-400'
                            : session.overallAccuracy >= 60
                              ? 'text-yellow-400'
                              : 'text-red-400'
                            }`}>
                            {Math.round(session.overallAccuracy)}%
                          </p>
                          <p className="text-xs text-gray-400">
                            {Math.round(session.durationSeconds / 60)}min
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Info Tab */}
          {activeTab === 'info' && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="bg-gray-900/60 rounded-xl p-6 border border-primary-400/20">
                <h2 className="text-2xl font-bold text-white mb-4">What is N-Back?</h2>
                <p className="text-gray-300 mb-4">
                  N-Back is a scientifically validated working memory task that has been shown to improve
                  fluid intelligence. You must remember stimuli from N trials ago and respond when there's a match.
                </p>
                <p className="text-gray-300">
                  Research by Jaeggi et al. (2008) demonstrated that dual n-back training can improve
                  fluid intelligence - the ability to reason and solve new problems.
                </p>
              </div>

              <div className="bg-gray-900/60 rounded-xl p-6 border border-primary-400/20">
                <h2 className="text-2xl font-bold text-white mb-4">How to Play</h2>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-primary-500/20 rounded-lg flex items-center justify-center">
                      <span className="text-primary-400 font-bold">1</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">Watch & Listen</h3>
                      <p className="text-gray-400">
                        A square lights up on the grid (position) and a letter is spoken (audio).
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-primary-500/20 rounded-lg flex items-center justify-center">
                      <span className="text-primary-400 font-bold">2</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">Remember</h3>
                      <p className="text-gray-400">
                        Keep track of stimuli from N trials back. In 2-back, remember 2 trials ago.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-primary-500/20 rounded-lg flex items-center justify-center">
                      <span className="text-primary-400 font-bold">3</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">Respond</h3>
                      <p className="text-gray-400">
                        Press <kbd className="px-2 py-1 bg-gray-700 rounded">A</kbd> for audio match,{' '}
                        <kbd className="px-2 py-1 bg-gray-700 rounded">L</kbd> for position match.
                        In triple mode, add <kbd className="px-2 py-1 bg-gray-700 rounded">S</kbd> for letter match.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900/60 rounded-xl p-6 border border-primary-400/20">
                <h2 className="text-2xl font-bold text-white mb-4">Tips for Success</h2>
                <ul className="space-y-3 text-gray-300">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    Start with 2-back until you can consistently achieve 80%+ accuracy
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    Train daily for best results - even 10-15 minutes helps
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    Don't be discouraged by mistakes - they're part of learning
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    Train in a quiet environment for best audio recognition
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    Use keyboard shortcuts (A, L, S) for faster responses
                  </li>
                </ul>
              </div>

              <div className="bg-gray-900/60 rounded-xl p-6 border border-secondary-400/20">
                <h2 className="text-2xl font-bold text-white mb-4">Research & Benefits</h2>
                <div className="space-y-3 text-gray-300">
                  <p>
                    <strong className="text-secondary-400">Fluid Intelligence:</strong> N-back training
                    has been linked to improvements in fluid reasoning abilities.
                  </p>
                  <p>
                    <strong className="text-secondary-400">Working Memory:</strong> Consistent training
                    strengthens your ability to hold and manipulate information.
                  </p>
                  <p>
                    <strong className="text-secondary-400">Attention Control:</strong> The task requires
                    sustained focus and attention management.
                  </p>
                  <p>
                    <strong className="text-secondary-400">Transfer Effects:</strong> Some studies suggest
                    benefits may transfer to untrained cognitive tasks.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
