'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Brain, Play, Pause, RotateCcw, Volume2, Grid3X3, Type, TrendingUp,
  Target, Clock, Award, ChevronUp, ChevronDown, Settings, HelpCircle,
  CheckCircle2, Zap, Calendar, Flame, Lock, Unlock, Music, Palette,
  Headphones, Eye, Shuffle
} from 'lucide-react'
import { PortalHeader } from '@/components/Navigation/PortalHeader'

// ─── Types ───────────────────────────────────────────────────────────────────

type GameMode = 'position' | 'audio' | 'dual' | 'triple' | 'quad'
type SoundSet = 'letters' | 'nato' | 'numbers' | 'piano'
type GameState = 'idle' | 'countdown' | 'playing' | 'paused' | 'finished'

// Which modalities are active for each mode
const MODE_CONFIG: Record<GameMode, { hasPosition: boolean; hasAudio: boolean; hasLetter: boolean; hasColor: boolean }> = {
  position: { hasPosition: true,  hasAudio: false, hasLetter: false, hasColor: false },
  audio:    { hasPosition: false, hasAudio: true,  hasLetter: false, hasColor: false },
  dual:     { hasPosition: true,  hasAudio: true,  hasLetter: false, hasColor: false },
  triple:   { hasPosition: true,  hasAudio: true,  hasLetter: true,  hasColor: false },
  quad:     { hasPosition: true,  hasAudio: true,  hasLetter: true,  hasColor: true  },
}

// Mode display info
const MODE_INFO: Record<GameMode, { label: string; short: string; description: string; recommended?: boolean }> = {
  position: { label: 'Position Only', short: 'Position', description: 'Track the square location. No audio required.' },
  audio:    { label: 'Audio Only',    short: 'Audio',    description: 'Track the spoken sounds. No grid watching.' },
  dual:     { label: 'Dual N-Back',   short: 'Dual',     description: 'Position + Audio. The classic brain training task.', recommended: true },
  triple:   { label: 'Triple N-Back', short: 'Triple',   description: 'Position + Audio + Visual Letter.' },
  quad:     { label: 'Quad N-Back',   short: 'Quad',     description: 'All four: Position + Audio + Color + Letter.' },
}

// ─── Audio & Stimuli ─────────────────────────────────────────────────────────

// 8 phonetically distinct letters (from Brain Workshop)
const AUDIO_LETTERS = ['C', 'H', 'K', 'L', 'Q', 'R', 'S', 'T']
const VISUAL_LETTERS = ['A', 'B', 'F', 'G', 'M', 'N', 'P', 'W']

// Sound set: maps each letter to its filename in /public/sounds/nback/{set}/
const SOUND_SETS: Record<SoundSet, { label: string; description: string; fileMap: Record<string, string> }> = {
  letters: {
    label: 'Letters',
    description: 'Standard spoken letters (C, H, K…)',
    fileMap: { C: 'c', H: 'h', K: 'k', L: 'l', Q: 'q', R: 'r', S: 's', T: 't' },
  },
  nato: {
    label: 'NATO',
    description: 'NATO phonetic (Charlie, Hotel, Kilo…)',
    fileMap: { C: 'c', H: 'h', K: 'k', L: 'l', Q: 'q', R: 'r', S: 's', T: 't' },
  },
  numbers: {
    label: 'Numbers',
    description: 'Spoken numbers (1 through 8)',
    fileMap: { C: '1', H: '2', K: '3', L: '4', Q: '5', R: '6', S: '7', T: '8' },
  },
  piano: {
    label: 'Piano',
    description: 'Musical piano notes',
    fileMap: { C: 'C4', H: 'D4', K: 'E4', L: 'F4', Q: 'G4', R: 'A4', S: 'B4', T: 'C5' },
  },
}

// 8 distinct colors for quad mode
const SQUARE_COLORS = [
  { name: 'teal',   activeClass: 'bg-teal-500 border-teal-300',     shadowClass: 'shadow-teal-500/60' },
  { name: 'blue',   activeClass: 'bg-blue-500 border-blue-300',     shadowClass: 'shadow-blue-500/60' },
  { name: 'green',  activeClass: 'bg-green-500 border-green-300',   shadowClass: 'shadow-green-500/60' },
  { name: 'yellow', activeClass: 'bg-yellow-400 border-yellow-200', shadowClass: 'shadow-yellow-400/60' },
  { name: 'red',    activeClass: 'bg-red-500 border-red-300',       shadowClass: 'shadow-red-500/60' },
  { name: 'purple', activeClass: 'bg-purple-500 border-purple-300', shadowClass: 'shadow-purple-500/60' },
  { name: 'orange', activeClass: 'bg-orange-500 border-orange-300', shadowClass: 'shadow-orange-500/60' },
  { name: 'pink',   activeClass: 'bg-pink-500 border-pink-300',     shadowClass: 'shadow-pink-500/60' },
] as const

// ─── Data Interfaces ──────────────────────────────────────────────────────────

interface Trial {
  position: number
  audioLetter: string
  visualLetter?: string
  colorIndex?: number
  isPositionMatch: boolean
  isAudioMatch: boolean
  isLetterMatch?: boolean
  isColorMatch?: boolean
}

interface SessionStats {
  positionHits: number; positionMisses: number; positionFalse: number
  audioHits: number;    audioMisses: number;    audioFalse: number
  letterHits: number;   letterMisses: number;   letterFalse: number
  colorHits: number;    colorMisses: number;    colorFalse: number
}

const EMPTY_STATS: SessionStats = {
  positionHits: 0, positionMisses: 0, positionFalse: 0,
  audioHits: 0,    audioMisses: 0,    audioFalse: 0,
  letterHits: 0,   letterMisses: 0,   letterFalse: 0,
  colorHits: 0,    colorMisses: 0,    colorFalse: 0,
}

interface ProgressData {
  gameMode: string; currentNLevel: number; highestNLevel: number
  bestAccuracy: number; totalSessions: number; streakDays: number
  lastSessionDate: string | null
}

interface SessionRecord {
  id: string; gameMode: string; nLevel: number; overallAccuracy: number
  positionAccuracy: number; audioAccuracy: number; letterAccuracy?: number
  durationSeconds: number; levelAdvanced: boolean; createdAt: string
}

// ─── Audio System ─────────────────────────────────────────────────────────────

function speakLetter(letter: string, volume: number, soundSet: SoundSet) {
  if (typeof window === 'undefined') return
  const { fileMap } = SOUND_SETS[soundSet]
  const filename = fileMap[letter]
  const path = `/sounds/nback/${soundSet}/${filename}.wav`
  const audio = new Audio(path)
  audio.volume = Math.max(0, Math.min(1, volume))
  audio.play().catch(() => {
    // Fallback to browser TTS
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utt = new SpeechSynthesisUtterance(letter)
      utt.rate = 0.9
      utt.volume = volume
      window.speechSynthesis.speak(utt)
    }
  })
}

function playFeedbackSound(type: 'advance', volume: number) {
  if (typeof window === 'undefined') return
  const audio = new Audio(`/sounds/nback/feedback/${type === 'advance' ? 'applause' : 'good'}.wav`)
  audio.volume = Math.max(0, Math.min(1, volume * 0.7))
  audio.play().catch(() => {})
}

// ─── Sequence Generator ───────────────────────────────────────────────────────

function generateSequence(
  nLevel: number,
  totalTrials: number,
  gameMode: GameMode,
  interference: boolean,
): Trial[] {
  const cfg = MODE_CONFIG[gameMode]
  const matchProb = 0.25
  const trials: Trial[] = []

  for (let i = 0; i < totalTrials; i++) {
    let position = 0, audioLetter = 'C'
    let visualLetter: string | undefined, colorIndex: number | undefined
    let isPositionMatch = false, isAudioMatch = false
    let isLetterMatch = false, isColorMatch = false

    if (i >= nLevel) {
      const prev = trials[i - nLevel]
      const lure = interference && i >= nLevel + 1 ? trials[i - nLevel - 1] : null

      if (cfg.hasPosition) {
        if (Math.random() < matchProb) {
          position = prev.position; isPositionMatch = true
        } else if (lure && Math.random() < 0.25) {
          // Interference: lure with N-1 position (not a real match)
          position = lure.position
        } else {
          do { position = Math.floor(Math.random() * 9) } while (position === prev.position)
        }
      } else {
        position = Math.floor(Math.random() * 9)
      }

      if (cfg.hasAudio) {
        if (Math.random() < matchProb) {
          audioLetter = prev.audioLetter; isAudioMatch = true
        } else if (lure && Math.random() < 0.25) {
          audioLetter = lure.audioLetter
        } else {
          do { audioLetter = AUDIO_LETTERS[Math.floor(Math.random() * AUDIO_LETTERS.length)] }
          while (audioLetter === prev.audioLetter)
        }
      } else {
        audioLetter = AUDIO_LETTERS[Math.floor(Math.random() * AUDIO_LETTERS.length)]
      }

      if (cfg.hasLetter) {
        if (Math.random() < matchProb) {
          visualLetter = prev.visualLetter; isLetterMatch = true
        } else if (lure && Math.random() < 0.25) {
          visualLetter = lure.visualLetter
        } else {
          do { visualLetter = VISUAL_LETTERS[Math.floor(Math.random() * VISUAL_LETTERS.length)] }
          while (visualLetter === prev.visualLetter)
        }
      }

      if (cfg.hasColor) {
        if (Math.random() < matchProb) {
          colorIndex = prev.colorIndex; isColorMatch = true
        } else if (lure && Math.random() < 0.25) {
          colorIndex = lure.colorIndex
        } else {
          do { colorIndex = Math.floor(Math.random() * 8) }
          while (colorIndex === prev.colorIndex)
        }
      }
    } else {
      // First N trials — no matches possible
      position = Math.floor(Math.random() * 9)
      audioLetter = AUDIO_LETTERS[Math.floor(Math.random() * AUDIO_LETTERS.length)]
      if (cfg.hasLetter) visualLetter = VISUAL_LETTERS[Math.floor(Math.random() * VISUAL_LETTERS.length)]
      if (cfg.hasColor) colorIndex = Math.floor(Math.random() * 8)
    }

    trials.push({
      position,
      audioLetter,
      visualLetter: cfg.hasLetter ? visualLetter : undefined,
      colorIndex: cfg.hasColor ? colorIndex : undefined,
      isPositionMatch: cfg.hasPosition && isPositionMatch,
      isAudioMatch: cfg.hasAudio && isAudioMatch,
      isLetterMatch: cfg.hasLetter ? isLetterMatch : undefined,
      isColorMatch: cfg.hasColor ? isColorMatch : undefined,
    })
  }

  return trials
}

// ─── Accuracy Helpers ─────────────────────────────────────────────────────────

function calcAccuracy(hits: number, misses: number, falseAlarms: number): number {
  const total = hits + misses + falseAlarms
  return total === 0 ? 100 : (hits / total) * 100
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NBackTrainer() {
  // ── Settings ──
  const [gameMode, setGameMode] = useState<GameMode>('dual')
  const [nLevel, setNLevel] = useState(2)
  const [trialsPerSession, setTrialsPerSession] = useState(20)
  const [trialDurationMs, setTrialDurationMs] = useState(3000)
  const [audioVolume, setAudioVolume] = useState(0.8)
  const [soundSet, setSoundSet] = useState<SoundSet>('letters')
  const [manualMode, setManualMode] = useState(false)
  const [interference, setInterference] = useState(false)

  // ── Game state ──
  const [gameState, setGameState] = useState<GameState>('idle')
  const [countdown, setCountdown] = useState(3)
  const [currentTrialIndex, setCurrentTrialIndex] = useState(0)
  const [trials, setTrials] = useState<Trial[]>([])
  const [showStimulus, setShowStimulus] = useState(false)
  const sessionStartTimeRef = useRef(0)

  // ── Response refs (avoids stale closures in game loop) ──
  const posResponseRef = useRef(false)
  const audResponseRef = useRef(false)
  const letResponseRef = useRef(false)
  const colResponseRef = useRef(false)

  // ── Visual button state ──
  const [btnPos, setBtnPos] = useState(false)
  const [btnAud, setBtnAud] = useState(false)
  const [btnLet, setBtnLet] = useState(false)
  const [btnCol, setBtnCol] = useState(false)

  // ── Session stats (ref for correctness in async callbacks) ──
  const [stats, setStats] = useState<SessionStats>(EMPTY_STATS)
  const statsRef = useRef<SessionStats>(EMPTY_STATS)
  useEffect(() => { statsRef.current = stats }, [stats])

  // ── Feedback display ──
  const [feedback, setFeedback] = useState<{
    position?: 'correct' | 'incorrect' | 'missed'
    audio?: 'correct' | 'incorrect' | 'missed'
    letter?: 'correct' | 'incorrect' | 'missed'
    color?: 'correct' | 'incorrect' | 'missed'
  }>({})

  // ── Progress ──
  const [progress, setProgress] = useState<ProgressData[]>([])
  const [recentSessions, setRecentSessions] = useState<SessionRecord[]>([])
  const [weeklyStats, setWeeklyStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // ── UI ──
  const [activeTab, setActiveTab] = useState<'training' | 'progress' | 'info'>('training')
  const [showSettings, setShowSettings] = useState(false)
  const [saveResult, setSaveResult] = useState<{ points: number; advanced: boolean; decreased: boolean } | null>(null)

  // ── Timer ref ──
  const stimulusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Derived config
  const cfg = MODE_CONFIG[gameMode]

  // ── Fetch progress ──────────────────────────────────────────────────────────
  useEffect(() => { fetchProgress() }, [])

  const fetchProgress = async () => {
    try {
      const res = await fetch('/api/nback/progress', { credentials: 'include' })
      const data = await res.json()
      if (data.success) {
        setProgress(data.progress || [])
        setRecentSessions(data.recentSessions || [])
        setWeeklyStats(data.weeklyStats)
        if (!manualMode) {
          const mp = data.progress?.find((p: ProgressData) => p.gameMode === gameMode)
          if (mp) setNLevel(mp.currentNLevel)
        }
      }
    } catch { /* silent */ } finally { setLoading(false) }
  }

  // Auto-update N-level when mode changes (unless manual)
  useEffect(() => {
    if (manualMode) return
    const mp = progress.find(p => p.gameMode === gameMode)
    setNLevel(mp ? mp.currentNLevel : 2)
  }, [gameMode, progress, manualMode])

  // ── Start game ──────────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    const sequence = generateSequence(nLevel, trialsPerSession, gameMode, interference)
    setTrials(sequence)
    setCurrentTrialIndex(0)
    setStats(EMPTY_STATS)
    statsRef.current = EMPTY_STATS
    setFeedback({})
    setSaveResult(null)
    posResponseRef.current = false
    audResponseRef.current = false
    letResponseRef.current = false
    colResponseRef.current = false
    setBtnPos(false); setBtnAud(false); setBtnLet(false); setBtnCol(false)
    setGameState('countdown')
    setCountdown(3)
  }, [nLevel, trialsPerSession, gameMode, interference])

  // ── Countdown ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== 'countdown') return
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(c => c - 1), 1000)
      return () => clearTimeout(t)
    }
    setGameState('playing')
    sessionStartTimeRef.current = Date.now()
    setShowStimulus(true)
  }, [gameState, countdown])

  // ── Main game loop ───────────────────────────────────────────────────────────
  // Uses refs for responses — pressing a button does NOT restart the timer
  useEffect(() => {
    if (gameState !== 'playing' || !showStimulus) return
    const trial = trials[currentTrialIndex]
    if (!trial) return

    if (cfg.hasAudio) speakLetter(trial.audioLetter, audioVolume, soundSet)

    const hideAt = trialDurationMs - 500
    stimulusTimerRef.current = setTimeout(() => {
      setShowStimulus(false)

      // Small delay to capture final responses, then process
      setTimeout(() => {
        const posR = posResponseRef.current
        const audR = audResponseRef.current
        const letR = letResponseRef.current
        const colR = colResponseRef.current

        // Clear responses for next trial
        posResponseRef.current = false
        audResponseRef.current = false
        letResponseRef.current = false
        colResponseRef.current = false
        setBtnPos(false); setBtnAud(false); setBtnLet(false); setBtnCol(false)

        // Process this trial's responses
        if (currentTrialIndex >= nLevel) {
          const newFbk: typeof feedback = {}
          setStats(prev => {
            const s = { ...prev }
            if (cfg.hasPosition) {
              if (trial.isPositionMatch) {
                if (posR) { s.positionHits++; newFbk.position = 'correct' }
                else { s.positionMisses++; newFbk.position = 'missed' }
              } else if (posR) { s.positionFalse++; newFbk.position = 'incorrect' }
            }
            if (cfg.hasAudio) {
              if (trial.isAudioMatch) {
                if (audR) { s.audioHits++; newFbk.audio = 'correct' }
                else { s.audioMisses++; newFbk.audio = 'missed' }
              } else if (audR) { s.audioFalse++; newFbk.audio = 'incorrect' }
            }
            if (cfg.hasLetter) {
              if (trial.isLetterMatch) {
                if (letR) { s.letterHits++; newFbk.letter = 'correct' }
                else { s.letterMisses++; newFbk.letter = 'missed' }
              } else if (letR) { s.letterFalse++; newFbk.letter = 'incorrect' }
            }
            if (cfg.hasColor) {
              if (trial.isColorMatch) {
                if (colR) { s.colorHits++; newFbk.color = 'correct' }
                else { s.colorMisses++; newFbk.color = 'missed' }
              } else if (colR) { s.colorFalse++; newFbk.color = 'incorrect' }
            }
            statsRef.current = s
            return s
          })
          setFeedback(newFbk)
        }

        // Advance to next trial or finish
        if (currentTrialIndex < trials.length - 1) {
          setTimeout(() => {
            setCurrentTrialIndex(i => i + 1)
            setShowStimulus(true)
            setFeedback({})
          }, 500)
        } else {
          finishSession()
        }
      }, 200)
    }, hideAt)

    return () => { if (stimulusTimerRef.current) clearTimeout(stimulusTimerRef.current) }
  }, [gameState, showStimulus, currentTrialIndex]) // Minimal deps — refs handle volatile values

  // ── Finish session ──────────────────────────────────────────────────────────
  const finishSession = useCallback(async () => {
    setGameState('finished')
    const durationSeconds = Math.round((Date.now() - sessionStartTimeRef.current) / 1000)
    const s = statsRef.current // Use ref for freshest stats

    const posAcc = cfg.hasPosition ? calcAccuracy(s.positionHits, s.positionMisses, s.positionFalse) : null
    const audAcc = cfg.hasAudio    ? calcAccuracy(s.audioHits,    s.audioMisses,    s.audioFalse)    : null
    const letAcc = cfg.hasLetter   ? calcAccuracy(s.letterHits,   s.letterMisses,   s.letterFalse)   : null
    const colAcc = cfg.hasColor    ? calcAccuracy(s.colorHits,    s.colorMisses,    s.colorFalse)    : null

    const activeAccuracies = [posAcc, audAcc, letAcc, colAcc].filter(a => a !== null) as number[]
    const overallAccuracy = activeAccuracies.length > 0
      ? activeAccuracies.reduce((a, b) => a + b, 0) / activeAccuracies.length
      : 0

    const levelAdvanced = !manualMode && overallAccuracy >= 80
    const levelDecreased = !manualMode && overallAccuracy < 50

    if (levelAdvanced) playFeedbackSound('advance', audioVolume)

    try {
      const res = await fetch('/api/nback/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          gameMode,
          nLevel,
          totalTrials: trialsPerSession,
          ...s,
          overallAccuracy:  Math.round(overallAccuracy * 10) / 10,
          positionAccuracy: posAcc !== null ? Math.round(posAcc * 10) / 10 : 0,
          audioAccuracy:    audAcc !== null ? Math.round(audAcc * 10) / 10 : 0,
          letterAccuracy:   letAcc !== null ? Math.round(letAcc * 10) / 10 : null,
          colorAccuracy:    colAcc !== null ? Math.round(colAcc * 10) / 10 : null,
          durationSeconds,
          levelAdvanced,
          levelDecreased,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSaveResult({ points: data.pointsAwarded, advanced: data.levelAdvanced, decreased: levelDecreased })
        fetchProgress()
      }
    } catch { /* silent */ }
  }, [gameMode, nLevel, trialsPerSession, cfg, manualMode, audioVolume])

  // ── Pause / Resume ──────────────────────────────────────────────────────────
  const togglePause = () => {
    if (gameState === 'playing') {
      setGameState('paused')
    } else if (gameState === 'paused') {
      setGameState('playing')
      setShowStimulus(true)
    }
  }

  // ── Reset ───────────────────────────────────────────────────────────────────
  const resetGame = () => {
    setGameState('idle')
    setTrials([])
    setCurrentTrialIndex(0)
    setShowStimulus(false)
    setFeedback({})
    setSaveResult(null)
    if (stimulusTimerRef.current) clearTimeout(stimulusTimerRef.current)
  }

  // ── Response handlers ───────────────────────────────────────────────────────
  const handlePos = () => {
    if (gameState !== 'playing' || currentTrialIndex < nLevel) return
    posResponseRef.current = true; setBtnPos(true)
  }
  const handleAud = () => {
    if (gameState !== 'playing' || currentTrialIndex < nLevel) return
    audResponseRef.current = true; setBtnAud(true)
  }
  const handleLet = () => {
    if (gameState !== 'playing' || currentTrialIndex < nLevel) return
    letResponseRef.current = true; setBtnLet(true)
  }
  const handleCol = () => {
    if (gameState !== 'playing' || currentTrialIndex < nLevel) return
    colResponseRef.current = true; setBtnCol(true)
  }

  // ── Keyboard controls ───────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return
      const k = e.key.toLowerCase()
      if (k === 'a' && cfg.hasAudio)    handleAud()
      if (k === 'l' && cfg.hasPosition) handlePos()
      if (k === 's' && cfg.hasLetter)   handleLet()
      if (k === 'd' && cfg.hasColor)    handleCol()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [gameState, cfg])

  // ── Live accuracy (during game) ─────────────────────────────────────────────
  const liveAccuracy = (() => {
    const hits = stats.positionHits + stats.audioHits + stats.letterHits + stats.colorHits
    const total = hits + stats.positionMisses + stats.positionFalse +
      stats.audioMisses + stats.audioFalse + stats.letterMisses + stats.letterFalse +
      stats.colorMisses + stats.colorFalse
    return total === 0 ? 0 : Math.round((hits / total) * 100)
  })()

  const currentModeProgress = progress.find(p => p.gameMode === gameMode)

  // ── Active color for the square ─────────────────────────────────────────────
  const activeColorIndex = showStimulus && trials[currentTrialIndex]?.colorIndex !== undefined
    ? trials[currentTrialIndex].colorIndex!
    : 0
  const activeColor = SQUARE_COLORS[activeColorIndex]

  // ── Feedback ring helpers ───────────────────────────────────────────────────
  const fbkRing = (fbk: 'correct' | 'incorrect' | 'missed' | undefined) =>
    fbk === 'correct' ? 'ring-2 ring-inset ring-green-500' :
    fbk === 'incorrect' || fbk === 'missed' ? 'ring-2 ring-inset ring-red-500' : ''

  // ══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative"
      style={{
        backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
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
            Scientifically-validated N-Back training. Sharpen your working memory and fluid intelligence.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center gap-2 mb-8 px-4">
          {([
            { id: 'training', label: 'Training',    icon: Brain       },
            { id: 'progress', label: 'Progress',    icon: TrendingUp  },
            { id: 'info',     label: 'How to Play', icon: HelpCircle  },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
                activeTab === tab.id
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

          {/* ── TRAINING TAB ────────────────────────────────────────────── */}
          {activeTab === 'training' && (
            <div className="max-w-4xl mx-auto space-y-6">

              {/* ── IDLE: Configure ─────────────────────────────────────── */}
              {gameState === 'idle' && (
                <div className="bg-gray-900/60 backdrop-blur-sm rounded-2xl border border-primary-400/20 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-white mb-1">Configure Session</h2>
                      <p className="text-gray-400">Choose your mode and difficulty</p>
                    </div>
                    <button
                      onClick={() => setShowSettings(s => !s)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 transition"
                    >
                      <Settings className="w-4 h-4" />
                      {showSettings ? 'Hide' : 'Advanced'} Settings
                    </button>
                  </div>

                  {/* ── Mode Selector ──────────────────────────────────── */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                    {(Object.keys(MODE_INFO) as GameMode[]).map(mode => {
                      const info = MODE_INFO[mode]
                      const mc = MODE_CONFIG[mode]
                      const isActive = gameMode === mode
                      return (
                        <button
                          key={mode}
                          onClick={() => setGameMode(mode)}
                          className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                            isActive
                              ? 'border-primary-400 bg-primary-500/15'
                              : 'border-gray-700 hover:border-gray-600 bg-gray-800/30'
                          }`}
                        >
                          {info.recommended && (
                            <span className="absolute -top-2 -right-2 text-[10px] bg-primary-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                              ★ REC
                            </span>
                          )}
                          {/* Modality icons */}
                          <div className="flex flex-wrap gap-1 mb-2">
                            {mc.hasPosition && <Grid3X3 className="w-4 h-4 text-primary-400" />}
                            {mc.hasAudio    && <Volume2 className="w-4 h-4 text-blue-400" />}
                            {mc.hasColor    && <Palette className="w-4 h-4 text-yellow-400" />}
                            {mc.hasLetter   && <Type    className="w-4 h-4 text-secondary-400" />}
                          </div>
                          <p className={`font-bold text-sm mb-1 ${isActive ? 'text-white' : 'text-gray-300'}`}>
                            {info.short}
                          </p>
                          <p className="text-gray-500 text-xs leading-tight hidden md:block">
                            {info.description}
                          </p>
                        </button>
                      )
                    })}
                  </div>

                  {/* Mode description on mobile */}
                  <p className="md:hidden text-sm text-gray-400 mb-4 px-1">
                    {MODE_INFO[gameMode].description}
                  </p>

                  {/* ── N-Level ─────────────────────────────────────────── */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-semibold text-gray-300">
                        N-Level: <span className="text-primary-400 text-base">{nLevel}-Back</span>
                      </label>
                      <button
                        onClick={() => setManualMode(m => !m)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition ${
                          manualMode
                            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                        title={manualMode ? 'Manual mode — level locked' : 'Auto mode — level adjusts by performance'}
                      >
                        {manualMode ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        {manualMode ? 'Manual' : 'Auto'}
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setNLevel(n => Math.max(1, n - 1))}
                        disabled={nLevel <= 1}
                        className="p-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40"
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
                        onClick={() => setNLevel(n => Math.min(9, n + 1))}
                        disabled={nLevel >= 9}
                        className="p-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40"
                      >
                        <ChevronUp className="w-5 h-5" />
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {manualMode
                        ? '🔒 Manual — level will not change automatically'
                        : 'Auto — advances at ≥80%, drops at <50% accuracy'}
                    </p>
                  </div>

                  {/* ── Advanced Settings ───────────────────────────────── */}
                  {showSettings && (
                    <div className="p-4 bg-gray-800/50 rounded-xl mb-6 space-y-5">
                      {/* Sound Set */}
                      {cfg.hasAudio && (
                        <div>
                          <label className="text-sm font-medium text-gray-300 mb-2 block flex items-center gap-2">
                            <Music className="w-4 h-4 text-blue-400" />
                            Sound Set
                          </label>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {(Object.keys(SOUND_SETS) as SoundSet[]).map(ss => (
                              <button
                                key={ss}
                                onClick={() => setSoundSet(ss)}
                                className={`p-2 rounded-lg text-xs font-medium transition ${
                                  soundSet === ss
                                    ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                }`}
                              >
                                <div className="font-bold">{SOUND_SETS[ss].label}</div>
                                <div className="text-gray-500 mt-0.5 leading-tight hidden md:block">
                                  {SOUND_SETS[ss].description}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-300 mb-2 block">
                            Trials per Session: <span className="text-white">{trialsPerSession}</span>
                          </label>
                          <input type="range" min={15} max={40} step={5}
                            value={trialsPerSession}
                            onChange={e => setTrialsPerSession(Number(e.target.value))}
                            className="w-full accent-primary-500"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-300 mb-2 block">
                            Trial Speed: <span className="text-white">{trialDurationMs / 1000}s</span>
                          </label>
                          <input type="range" min={1500} max={4000} step={250}
                            value={trialDurationMs}
                            onChange={e => setTrialDurationMs(Number(e.target.value))}
                            className="w-full accent-primary-500"
                          />
                        </div>
                        {cfg.hasAudio && (
                          <div>
                            <label className="text-sm font-medium text-gray-300 mb-2 block">
                              Audio Volume: <span className="text-white">{Math.round(audioVolume * 100)}%</span>
                            </label>
                            <input type="range" min={0} max={1} step={0.1}
                              value={audioVolume}
                              onChange={e => setAudioVolume(Number(e.target.value))}
                              className="w-full accent-primary-500"
                            />
                          </div>
                        )}
                      </div>

                      {/* Interference toggle */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-300 flex items-center gap-2">
                            <Shuffle className="w-4 h-4 text-orange-400" />
                            Interference Mode
                          </p>
                          <p className="text-xs text-gray-500">Adds "lure" trials one step off — harder!</p>
                        </div>
                        <button
                          onClick={() => setInterference(i => !i)}
                          className={`relative w-12 h-6 rounded-full transition-colors ${
                            interference ? 'bg-orange-500' : 'bg-gray-600'
                          }`}
                        >
                          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                            interference ? 'translate-x-6' : 'translate-x-0.5'
                          }`} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Start Button ─────────────────────────────────────── */}
                  <button
                    onClick={startGame}
                    className="w-full py-4 bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white font-bold text-xl rounded-xl shadow-lg shadow-primary-500/30 transition-all transform hover:scale-[1.02]"
                  >
                    <div className="flex items-center justify-center gap-3">
                      <Play className="w-6 h-6" />
                      Start {MODE_INFO[gameMode].short} {nLevel}-Back
                      {interference && <span className="text-sm font-normal opacity-80">(interference)</span>}
                    </div>
                  </button>

                  {/* Progress badge */}
                  {currentModeProgress && (
                    <div className="mt-4 p-4 bg-gray-800/50 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Flame className="w-5 h-5 text-orange-400" />
                        <span className="text-gray-300">{currentModeProgress.streakDays} day streak</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Award className="w-5 h-5 text-yellow-400" />
                        <span className="text-gray-300">
                          Best: {currentModeProgress.highestNLevel}-back @ {Math.round(currentModeProgress.bestAccuracy)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── COUNTDOWN ─────────────────────────────────────────────── */}
              {gameState === 'countdown' && (
                <div className="bg-gray-900/80 backdrop-blur-sm rounded-2xl border border-primary-400/20 p-16 text-center">
                  <p className="text-gray-400 mb-4">Get Ready — {MODE_INFO[gameMode].label}</p>
                  <div className="text-9xl font-bold text-primary-400 animate-pulse">{countdown}</div>
                  <p className="text-gray-400 mt-6 text-sm">
                    {cfg.hasAudio    && <span className="mr-4"><kbd className="px-2 py-1 bg-gray-700 rounded">A</kbd> = Audio</span>}
                    {cfg.hasPosition && <span className="mr-4"><kbd className="px-2 py-1 bg-gray-700 rounded">L</kbd> = Position</span>}
                    {cfg.hasLetter   && <span className="mr-4"><kbd className="px-2 py-1 bg-gray-700 rounded">S</kbd> = Letter</span>}
                    {cfg.hasColor    && <span><kbd className="px-2 py-1 bg-gray-700 rounded">D</kbd> = Color</span>}
                  </p>
                </div>
              )}

              {/* ── GAME BOARD ────────────────────────────────────────────── */}
              {(gameState === 'playing' || gameState === 'paused') && (
                <div className="space-y-4">
                  {/* Stats bar */}
                  <div className="flex items-center justify-between gap-2 px-2">
                    <span className="text-sm text-gray-400">
                      Trial <span className="text-white font-bold">{currentTrialIndex + 1}/{trialsPerSession}</span>
                    </span>
                    <span className="text-sm text-gray-400">
                      N=<span className="text-primary-400 font-bold">{nLevel}</span>
                    </span>
                    <span className="text-sm text-gray-400">
                      Acc <span className="text-secondary-400 font-bold">{liveAccuracy}%</span>
                    </span>
                    {manualMode && (
                      <span className="text-xs text-yellow-400 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Manual
                      </span>
                    )}
                    <div className="flex gap-2">
                      <button onClick={togglePause}
                        className="p-2 rounded-lg bg-gray-800/60 text-gray-300 hover:bg-gray-700"
                      >
                        {gameState === 'paused' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                      </button>
                      <button onClick={resetGame}
                        className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Main board */}
                  <div className="relative bg-gray-900/80 backdrop-blur-sm rounded-2xl border border-primary-400/20 overflow-hidden">
                    {gameState === 'paused' && (
                      <div className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center z-10">
                        <p className="text-3xl font-bold text-white">PAUSED</p>
                      </div>
                    )}

                    <div className="flex items-stretch min-h-[300px] landscape:min-h-[220px]">

                      {/* LEFT: Audio (top) + Letter (bottom if triple/quad) */}
                      {(cfg.hasAudio || cfg.hasLetter) && (
                        <div className="flex flex-col w-20 landscape:w-24 shrink-0 border-r border-gray-700/50">
                          {cfg.hasAudio && (
                            <button
                              onClick={handleAud}
                              disabled={gameState === 'paused' || currentTrialIndex < nLevel}
                              className={`flex flex-col items-center justify-center font-bold text-sm transition-all active:scale-95 select-none disabled:opacity-50 ${
                                cfg.hasLetter ? 'flex-1 border-b border-gray-700/50' : 'flex-1'
                              } ${btnAud ? 'bg-blue-500 text-white' : 'bg-gray-800/40 text-gray-300 hover:bg-gray-700/60'} ${fbkRing(feedback.audio)}`}
                            >
                              <Volume2 className="w-7 h-7 mb-0.5" />
                              <span>Audio</span>
                              <kbd className="mt-0.5 px-1.5 py-0.5 bg-black/30 rounded text-xs text-gray-400">A</kbd>
                            </button>
                          )}
                          {cfg.hasLetter && (
                            <button
                              onClick={handleLet}
                              disabled={gameState === 'paused' || currentTrialIndex < nLevel}
                              className={`flex flex-col items-center justify-center flex-1 font-bold text-sm transition-all active:scale-95 select-none disabled:opacity-50 ${
                                btnLet ? 'bg-secondary-500 text-white' : 'bg-gray-800/40 text-gray-300 hover:bg-gray-700/60'
                              } ${fbkRing(feedback.letter)}`}
                            >
                              <Type className="w-7 h-7 mb-0.5" />
                              <span>Letter</span>
                              <kbd className="mt-0.5 px-1.5 py-0.5 bg-black/30 rounded text-xs text-gray-400">S</kbd>
                            </button>
                          )}
                        </div>
                      )}

                      {/* CENTER: Grid */}
                      <div className="flex-1 flex flex-col items-center justify-center py-4 px-2 gap-3">
                        {/* 3×3 Grid */}
                        <div className="grid grid-cols-3 gap-2 w-fit">
                          {Array.from({ length: 9 }).map((_, i) => {
                            const isActive = showStimulus && trials[currentTrialIndex]?.position === i
                            const squareColor = isActive && cfg.hasColor
                              ? activeColor
                              : null
                            return (
                              <div
                                key={i}
                                className={`w-14 h-14 landscape:w-12 landscape:h-12 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all duration-150 ${
                                  isActive
                                    ? squareColor
                                      ? `${squareColor.activeClass} shadow-lg ${squareColor.shadowClass}`
                                      : 'bg-primary-500 border-primary-400 text-white shadow-lg shadow-primary-500/50'
                                    : 'bg-gray-800/50 border-gray-700'
                                }`}
                              >
                                {isActive && cfg.hasLetter && trials[currentTrialIndex]?.visualLetter}
                              </div>
                            )
                          })}
                        </div>

                        {/* Audio letter display */}
                        {cfg.hasAudio && showStimulus && (
                          <div className="text-center">
                            <p className="text-xs text-gray-500 uppercase tracking-wide">
                              {SOUND_SETS[soundSet].label}
                            </p>
                            <p className="text-3xl font-bold text-blue-400 leading-none">
                              {trials[currentTrialIndex]?.audioLetter}
                            </p>
                          </div>
                        )}

                        {/* Color indicator for quad mode */}
                        {cfg.hasColor && showStimulus && (
                          <div className="text-center">
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Color</p>
                            <div className={`w-6 h-6 rounded-full mx-auto mt-1 ${activeColor.activeClass}`} />
                          </div>
                        )}
                      </div>

                      {/* RIGHT: Position (top) + Color (bottom if quad) */}
                      {(cfg.hasPosition || cfg.hasColor) && (
                        <div className="flex flex-col w-20 landscape:w-24 shrink-0 border-l border-gray-700/50">
                          {cfg.hasPosition && (
                            <button
                              onClick={handlePos}
                              disabled={gameState === 'paused' || currentTrialIndex < nLevel}
                              className={`flex flex-col items-center justify-center font-bold text-sm transition-all active:scale-95 select-none disabled:opacity-50 ${
                                cfg.hasColor ? 'flex-1 border-b border-gray-700/50' : 'flex-1'
                              } ${btnPos ? 'bg-primary-500 text-white' : 'bg-gray-800/40 text-gray-300 hover:bg-gray-700/60'} ${fbkRing(feedback.position)}`}
                            >
                              <Grid3X3 className="w-7 h-7 mb-0.5" />
                              <span>Position</span>
                              <kbd className="mt-0.5 px-1.5 py-0.5 bg-black/30 rounded text-xs text-gray-400">L</kbd>
                            </button>
                          )}
                          {cfg.hasColor && (
                            <button
                              onClick={handleCol}
                              disabled={gameState === 'paused' || currentTrialIndex < nLevel}
                              className={`flex flex-col items-center justify-center flex-1 font-bold text-sm transition-all active:scale-95 select-none disabled:opacity-50 ${
                                btnCol ? 'bg-yellow-500 text-white' : 'bg-gray-800/40 text-gray-300 hover:bg-gray-700/60'
                              } ${fbkRing(feedback.color)}`}
                            >
                              <Palette className="w-7 h-7 mb-0.5" />
                              <span>Color</span>
                              <kbd className="mt-0.5 px-1.5 py-0.5 bg-black/30 rounded text-xs text-gray-400">D</kbd>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── RESULTS ───────────────────────────────────────────────── */}
              {gameState === 'finished' && (
                <div className="bg-gray-900/80 backdrop-blur-sm rounded-2xl border border-primary-400/20 p-8">
                  <div className="text-center mb-8">
                    <div className={`inline-flex p-4 rounded-full mb-4 ${
                      saveResult?.advanced ? 'bg-secondary-500/20' :
                      saveResult?.decreased ? 'bg-orange-500/20' :
                      'bg-primary-500/20'
                    }`}>
                      {saveResult?.advanced ? (
                        <Zap className="w-12 h-12 text-secondary-400" />
                      ) : (
                        <CheckCircle2 className="w-12 h-12 text-primary-400" />
                      )}
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-2">
                      {saveResult?.advanced  ? `Level Up! → ${nLevel + 1}-Back` :
                       saveResult?.decreased ? `Dropped to ${nLevel - 1}-Back` :
                       'Session Complete!'}
                    </h2>
                    {saveResult && (
                      <p className="text-xl text-secondary-400">+{saveResult.points} points earned</p>
                    )}
                  </div>

                  {/* Stats grid */}
                  <div className="grid md:grid-cols-2 gap-4 mb-8">
                    {cfg.hasPosition && (
                      <StatCard icon={<Grid3X3 className="w-5 h-5 text-primary-400" />} label="Position"
                        hits={stats.positionHits} misses={stats.positionMisses} falses={stats.positionFalse}
                        accuracy={calcAccuracy(stats.positionHits, stats.positionMisses, stats.positionFalse)}
                      />
                    )}
                    {cfg.hasAudio && (
                      <StatCard icon={<Volume2 className="w-5 h-5 text-blue-400" />} label="Audio"
                        hits={stats.audioHits} misses={stats.audioMisses} falses={stats.audioFalse}
                        accuracy={calcAccuracy(stats.audioHits, stats.audioMisses, stats.audioFalse)}
                      />
                    )}
                    {cfg.hasLetter && (
                      <StatCard icon={<Type className="w-5 h-5 text-secondary-400" />} label="Letter"
                        hits={stats.letterHits} misses={stats.letterMisses} falses={stats.letterFalse}
                        accuracy={calcAccuracy(stats.letterHits, stats.letterMisses, stats.letterFalse)}
                      />
                    )}
                    {cfg.hasColor && (
                      <StatCard icon={<Palette className="w-5 h-5 text-yellow-400" />} label="Color"
                        hits={stats.colorHits} misses={stats.colorMisses} falses={stats.colorFalse}
                        accuracy={calcAccuracy(stats.colorHits, stats.colorMisses, stats.colorFalse)}
                      />
                    )}
                  </div>

                  <div className="flex flex-wrap gap-4 justify-center">
                    <button
                      onClick={() => { resetGame(); setTimeout(startGame, 50) }}
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

          {/* ── PROGRESS TAB ─────────────────────────────────────────────── */}
          {activeTab === 'progress' && (
            <div className="max-w-4xl mx-auto space-y-6">
              {weeklyStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'This Week',    value: weeklyStats.sessionsThisWeek,   sub: 'sessions',      color: 'text-white' },
                    { label: 'Avg Accuracy', value: `${weeklyStats.avgAccuracyThisWeek}%`, sub: 'this week', color: 'text-primary-400' },
                    { label: 'Level Ups',    value: weeklyStats.advancementsThisWeek, sub: 'this week',   color: 'text-secondary-400' },
                    { label: 'Total Time',   value: `${Math.round(weeklyStats.totalTimeThisWeek / 60)}`, sub: 'minutes', color: 'text-white' },
                  ].map(stat => (
                    <div key={stat.label} className="bg-gray-900/60 rounded-xl p-4 border border-primary-400/20">
                      <p className="text-xs text-gray-400 uppercase mb-1">{stat.label}</p>
                      <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                      <p className="text-sm text-gray-400">{stat.sub}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-6">
                {progress.map(p => (
                  <div key={p.gameMode} className="bg-gray-900/60 rounded-xl p-6 border border-primary-400/20">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-white capitalize">
                        {MODE_INFO[p.gameMode as GameMode]?.short ?? p.gameMode} N-Back
                      </h3>
                      <div className="flex items-center gap-2">
                        <Flame className="w-5 h-5 text-orange-400" />
                        <span className="text-orange-400 font-bold">{p.streakDays}d</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-400 uppercase">Current</p>
                        <p className="text-2xl font-bold text-primary-400">{p.currentNLevel}-back</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase">Highest</p>
                        <p className="text-2xl font-bold text-secondary-400">{p.highestNLevel}-back</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase">Best Accuracy</p>
                        <p className="text-2xl font-bold text-white">{Math.round(p.bestAccuracy)}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase">Sessions</p>
                        <p className="text-2xl font-bold text-white">{p.totalSessions}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {progress.length === 0 && !loading && (
                  <div className="md:col-span-2 text-center py-12 text-gray-400">
                    No progress yet. Complete your first session!
                  </div>
                )}
              </div>

              <div className="bg-gray-900/60 rounded-xl p-6 border border-primary-400/20">
                <h3 className="text-xl font-bold text-white mb-4">Recent Sessions</h3>
                {recentSessions.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No sessions yet.</p>
                ) : (
                  <div className="space-y-3">
                    {recentSessions.slice(0, 10).map(session => (
                      <div key={session.id} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl">
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${session.levelAdvanced ? 'bg-secondary-500/20' : 'bg-gray-700'}`}>
                            {session.levelAdvanced
                              ? <Zap className="w-5 h-5 text-secondary-400" />
                              : <Brain className="w-5 h-5 text-gray-400" />
                            }
                          </div>
                          <div>
                            <p className="font-semibold text-white capitalize">
                              {MODE_INFO[session.gameMode as GameMode]?.short ?? session.gameMode} {session.nLevel}-Back
                            </p>
                            <p className="text-sm text-gray-400">
                              {new Date(session.createdAt).toLocaleDateString()} ·{' '}
                              {Math.round(session.durationSeconds / 60)}min
                            </p>
                          </div>
                        </div>
                        <p className={`text-xl font-bold ${
                          session.overallAccuracy >= 80 ? 'text-green-400' :
                          session.overallAccuracy >= 60 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {Math.round(session.overallAccuracy)}%
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── INFO TAB ──────────────────────────────────────────────────── */}
          {activeTab === 'info' && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="bg-gray-900/60 rounded-xl p-6 border border-primary-400/20">
                <h2 className="text-2xl font-bold text-white mb-4">What is N-Back?</h2>
                <p className="text-gray-300 mb-4">
                  N-Back is a scientifically validated working memory task. A stimulus appears each trial —
                  you must identify when it matches the stimulus from <em>N trials ago</em>.
                </p>
                <p className="text-gray-300">
                  Research by Jaeggi et al. (2008) showed that dual n-back training improves fluid intelligence —
                  the ability to reason and solve novel problems.
                </p>
              </div>

              <div className="bg-gray-900/60 rounded-xl p-6 border border-primary-400/20">
                <h2 className="text-2xl font-bold text-white mb-4">Game Modes</h2>
                <div className="space-y-4">
                  {(Object.keys(MODE_INFO) as GameMode[]).map(mode => {
                    const info = MODE_INFO[mode]
                    const mc = MODE_CONFIG[mode]
                    return (
                      <div key={mode} className="flex gap-4 p-3 rounded-xl bg-gray-800/40">
                        <div className="flex gap-1 mt-1">
                          {mc.hasPosition && <Grid3X3 className="w-4 h-4 text-primary-400" />}
                          {mc.hasAudio    && <Volume2  className="w-4 h-4 text-blue-400" />}
                          {mc.hasColor    && <Palette  className="w-4 h-4 text-yellow-400" />}
                          {mc.hasLetter   && <Type     className="w-4 h-4 text-secondary-400" />}
                        </div>
                        <div>
                          <p className="font-semibold text-white">{info.label}</p>
                          <p className="text-gray-400 text-sm">{info.description}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="bg-gray-900/60 rounded-xl p-6 border border-primary-400/20">
                <h2 className="text-2xl font-bold text-white mb-4">Controls</h2>
                <div className="grid md:grid-cols-2 gap-3 text-sm">
                  {[
                    { key: 'A', label: 'Audio match', color: 'text-blue-400' },
                    { key: 'L', label: 'Position match', color: 'text-primary-400' },
                    { key: 'S', label: 'Letter match (triple/quad)', color: 'text-secondary-400' },
                    { key: 'D', label: 'Color match (quad only)', color: 'text-yellow-400' },
                  ].map(c => (
                    <div key={c.key} className="flex items-center gap-3">
                      <kbd className="px-3 py-1.5 bg-gray-700 rounded text-base font-bold text-white">{c.key}</kbd>
                      <span className={c.color}>{c.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-900/60 rounded-xl p-6 border border-primary-400/20">
                <h2 className="text-2xl font-bold text-white mb-4">Tips</h2>
                <ul className="space-y-3 text-gray-300">
                  {[
                    'Start with Position Only or Audio Only if Dual is too hard at first.',
                    'Train daily — even 10–15 minutes makes a difference.',
                    'Stay at 2-Back until you consistently hit 80%+ before moving up.',
                    "Missing matches is normal — don't over-respond to avoid false alarms.",
                    'Use keyboard shortcuts (A, L, S, D) for faster reaction times.',
                    'Try NATO or Piano sound sets for a fresh challenge.',
                    'Enable Interference mode once 2-back feels easy.',
                  ].map((tip, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ─── Stat Card Sub-component ──────────────────────────────────────────────────
function StatCard({
  icon, label, hits, misses, falses, accuracy
}: {
  icon: React.ReactNode
  label: string
  hits: number
  misses: number
  falses: number
  accuracy: number
}) {
  return (
    <div className="bg-gray-800/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold text-white">{label}</h3>
        </div>
        <span className={`text-lg font-bold ${
          accuracy >= 80 ? 'text-green-400' : accuracy >= 60 ? 'text-yellow-400' : 'text-red-400'
        }`}>
          {Math.round(accuracy)}%
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="text-center">
          <p className="text-gray-500 text-xs">Hits</p>
          <p className="text-green-400 font-bold">{hits}</p>
        </div>
        <div className="text-center">
          <p className="text-gray-500 text-xs">Misses</p>
          <p className="text-red-400 font-bold">{misses}</p>
        </div>
        <div className="text-center">
          <p className="text-gray-500 text-xs">False</p>
          <p className="text-orange-400 font-bold">{falses}</p>
        </div>
      </div>
    </div>
  )
}
