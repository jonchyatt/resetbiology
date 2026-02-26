'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, MoveHorizontal, Smartphone, ZoomIn, ZoomOut, Mic, MicOff } from 'lucide-react'
import { WhisperService, type WhisperStatus } from '@/lib/speech'

type EDirection = 'up' | 'down' | 'left' | 'right'
export type BinocularMode = 'off' | 'duplicate' | 'redgreen' | 'grid-square' | 'grid-slanted' | 'alternating'

interface BinocularChartProps {
  chartSize: string
  exerciseType: 'letters' | 'e-directional'
  binocularMode: BinocularMode
  onAnswer: (correct: boolean) => void
  resetTrigger?: number
  deviceMode?: 'phone' | 'desktop'
  onChartComplete?: () => void
  onDistanceAdjust?: (direction: 'closer' | 'further') => void
}

const CHART_LINES = [
  { level: 1, label: 'Moderate', scale: 2.0, letterCount: 3 },
  { level: 2, label: 'Building', scale: 1.6, letterCount: 4 },
  { level: 3, label: 'Challenge', scale: 1.3, letterCount: 5 },
  { level: 4, label: 'Advanced', scale: 1.0, letterCount: 5 },
  { level: 5, label: 'Peak', scale: 0.8, letterCount: 6 },
  { level: 6, label: 'Elite', scale: 0.6, letterCount: 7 },
  { level: 7, label: 'Ultra', scale: 0.45, letterCount: 8 },
]

const E_DIRECTIONS: readonly EDirection[] = ['up', 'down', 'left', 'right']
const CONFUSABLE_LETTERS = ['O', 'Q', 'C', 'D', 'H', 'M', 'N', 'K', 'X', 'R', 'S', 'Z', 'V']

// Tumbling E — matches SnellenChart's TumblingE exactly (thickness=7, computed y positions)
function TumblingE({ direction, size, color = '#000000', visible = true }: {
  direction: EDirection; size: number; color?: string; visible?: boolean
}) {
  if (!visible) return <div style={{ width: size, height: size }} />
  const rot: Record<EDirection, number> = { right: 0, down: 90, left: 180, up: 270 }
  const thickness = 7
  return (
    <svg width={size} height={size} viewBox="0 0 50 50"
      style={{ transform: `rotate(${rot[direction]}deg)` }}>
      <g fill={color}>
        <rect x="5" y="5" width={thickness} height="40" />
        <rect x="5" y="5" width="40" height={thickness} />
        <rect x="5" y={25 - thickness / 2} width="35" height={thickness} />
        <rect x="5" y={45 - thickness} width="40" height={thickness} />
      </g>
    </svg>
  )
}

function SnellenLetter({ letter, size, color = '#000000', visible = true }: {
  letter: string; size: number; color?: string; visible?: boolean
}) {
  if (!visible) return <div style={{ width: size * 0.8, height: size, display: 'inline-block' }} />
  return (
    <div className="select-none" style={{
      fontSize: `${size * 0.8}px`, lineHeight: 1, color, fontWeight: 700,
      letterSpacing: '0.02em', fontFamily: 'system-ui, -apple-system, sans-serif',
      textRendering: 'geometricPrecision',
    }}>{letter}</div>
  )
}

function generateChartData(exerciseType: 'letters' | 'e-directional') {
  return CHART_LINES.map(line => ({
    ...line,
    directions: Array.from({ length: line.letterCount }, () =>
      E_DIRECTIONS[Math.floor(Math.random() * E_DIRECTIONS.length)]),
    letters: Array.from({ length: line.letterCount }, () =>
      CONFUSABLE_LETTERS[Math.floor(Math.random() * CONFUSABLE_LETTERS.length)]),
  }))
}

function getLetterChoices(correctLetter: string): string[] {
  const d = CONFUSABLE_LETTERS.filter(l => l !== correctLetter)
    .sort(() => Math.random() - 0.5).slice(0, 3)
  return [correctLetter, ...d].sort(() => Math.random() - 0.5)
}

export default function BinocularChart({
  chartSize, exerciseType, binocularMode, onAnswer,
  resetTrigger = 0, deviceMode = 'phone', onChartComplete, onDistanceAdjust,
}: BinocularChartProps) {
  const [chartData, setChartData] = useState(() => generateChartData(exerciseType))
  const [currentLineIndex, setCurrentLineIndex] = useState(0)
  const [currentLetterIndex, setCurrentLetterIndex] = useState(0)
  const [consecutiveFailures, setConsecutiveFailures] = useState(0)
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null)
  const [showDistancePrompt, setShowDistancePrompt] = useState(false)
  const [letterChoices, setLetterChoices] = useState<string[]>([])
  const [viewScale, setViewScale] = useState(100) // percentage — allows zooming out for pupil distance

  // Voice recognition state (Whisper)
  const [localVoiceEnabled, setLocalVoiceEnabled] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState<WhisperStatus>('idle')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [lastHeard, setLastHeard] = useState('')

  const leftColor = binocularMode === 'duplicate' ? '#FFFFFF' : '#DD0000'
  const rightColor = binocularMode === 'duplicate' ? '#FFFFFF' : '#009500'
  const showGrid = ['grid-square', 'grid-slanted', 'alternating'].includes(binocularMode)
  const isSlantedGrid = binocularMode === 'grid-slanted'
  const showAlternating = binocularMode === 'alternating'

  useEffect(() => {
    setChartData(generateChartData(exerciseType))
    setCurrentLineIndex(0); setCurrentLetterIndex(0)
  }, [exerciseType])

  useEffect(() => {
    if (exerciseType === 'letters' && chartData[currentLineIndex]) {
      const cl = chartData[currentLineIndex].letters[currentLetterIndex]
      if (cl) setLetterChoices(getLetterChoices(cl))
    }
  }, [exerciseType, currentLineIndex, currentLetterIndex, chartData])

  useEffect(() => {
    if (feedback) { const t = setTimeout(() => setFeedback(null), 400); return () => clearTimeout(t) }
  }, [feedback])

  const regenerateChart = useCallback(() => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setChartData(generateChartData(exerciseType))
    setCurrentLineIndex(0); setCurrentLetterIndex(0); setConsecutiveFailures(0)
  }, [exerciseType])

  const advanceToNext = useCallback(() => {
    const cl = chartData[currentLineIndex]; if (!cl) return
    if (currentLetterIndex < cl.letterCount - 1) { setCurrentLetterIndex(p => p + 1) }
    else if (currentLineIndex >= CHART_LINES.length - 1) {
      setShowDistancePrompt(true); if (onChartComplete) onChartComplete()
    } else { setCurrentLineIndex(p => p + 1); setCurrentLetterIndex(0) }
  }, [chartData, currentLineIndex, currentLetterIndex, onChartComplete])

  const handleAnswer = useCallback((answer: string) => {
    const cl = chartData[currentLineIndex]; if (!cl) return
    let isCorrect: boolean
    if (exerciseType === 'e-directional') {
      isCorrect = answer === cl.directions[currentLetterIndex]
    } else {
      isCorrect = answer.toUpperCase() === cl.letters[currentLetterIndex].toUpperCase()
    }
    setFeedback(isCorrect ? 'correct' : 'incorrect')
    onAnswer(isCorrect)
    if (isCorrect) {
      setConsecutiveFailures(0); setTimeout(() => advanceToNext(), 300)
    } else {
      setConsecutiveFailures(p => { const n = p + 1; if (n >= 3) setTimeout(() => regenerateChart(), 1500); return n })
    }
  }, [chartData, currentLineIndex, currentLetterIndex, exerciseType, onAnswer, advanceToNext, regenerateChart])

  // Keyboard hotkeys for E-directional mode (desktop)
  useEffect(() => {
    if (exerciseType !== 'e-directional' || showDistancePrompt) return
    const handleKeyDown = (e: KeyboardEvent) => {
      const keyMap: Record<string, EDirection> = {
        'w': 'up', 'ArrowUp': 'up',
        'a': 'left', 'ArrowLeft': 'left',
        'l': 'right', 'ArrowRight': 'right',
        ',': 'down', 'ArrowDown': 'down',
      }
      const dir = keyMap[e.key]
      if (dir) { e.preventDefault(); handleAnswer(dir) }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [exerciseType, showDistancePrompt, handleAnswer])

  // Whisper voice recognition for binocular mode
  useEffect(() => {
    if (!localVoiceEnabled) {
      WhisperService.stop()
      setIsSpeaking(false)
      setLastHeard('')
      return
    }

    const mode = exerciseType === 'e-directional' ? 'e-directional' : 'letters'

    WhisperService.start(mode, {
      onResult: (answer, rawTranscript) => {
        setLastHeard(rawTranscript.trim().split(/\s+/).pop() || '')
        if (!answer) return
        if (answer.type === 'direction') {
          handleAnswer(answer.value)
        } else if (answer.type === 'letter') {
          handleAnswer(answer.value)
        }
      },
      onStatusChange: (status) => {
        setVoiceStatus(status)
        if (status === 'error') setLocalVoiceEnabled(false)
      },
      onSpeechChange: (speaking) => {
        setIsSpeaking(speaking)
      },
    }).catch(() => {
      setLocalVoiceEnabled(false)
    })

    return () => { WhisperService.stop() }
  }, [localVoiceEnabled, exerciseType, handleAnswer])

  const handleDistanceAdjust = (dir: 'closer' | 'further') => {
    setShowDistancePrompt(false); regenerateChart()
    if (onDistanceAdjust) onDistanceAdjust(dir)
  }

  const getFR = () => {
    if (feedback === 'correct') return 'ring-4 ring-green-500 animate-pulse'
    if (feedback === 'incorrect') return 'ring-4 ring-red-500 animate-pulse'
    return 'ring-2 ring-primary-400'
  }

  const baseSize = deviceMode === 'phone' ? 36 : 52
  const sizeMul = deviceMode === 'phone' ? 0.7 : 0.85

  // Render one chart (left or right)
  const renderChart = (side: 'left' | 'right') => {
    const color = side === 'left' ? leftColor : rightColor
    const isLeft = side === 'left'
    return (
      <div className="flex-1 flex flex-col items-center justify-center" style={{ gap: '2px' }}>
        {chartData.map((line, li) => (
          <div key={li} className={`flex items-center justify-center transition-all duration-300 ${
            li < currentLineIndex ? 'opacity-20' : li === currentLineIndex ? 'opacity-100' : 'opacity-40'
          }`} style={{ gap: showGrid ? 0 : '3px' }}>
            {Array.from({ length: line.letterCount }).map((_, ii) => {
              const isCur = li === currentLineIndex && ii === currentLetterIndex
              const isPast = li === currentLineIndex && ii < currentLetterIndex
              const isVis = !showAlternating || (isLeft ? ii % 2 === 0 : ii % 2 === 1)
              const sz = Math.max(14, baseSize * line.scale * sizeMul)
              const item = exerciseType === 'e-directional' ? line.directions[ii] : line.letters[ii]
              return (
                <div key={ii} className={`relative flex items-center justify-center ${isPast ? 'opacity-20' : ''} ${isCur ? getFR() + ' rounded-sm' : ''}`}
                  style={showGrid ? { border: '1px solid #888', padding: '2px', minWidth: sz + 6, minHeight: sz + 6 } : {}}>
                  {isSlantedGrid && showGrid && (
                    <svg className="absolute inset-0 pointer-events-none z-0" width="100%" height="100%" preserveAspectRatio="none">
                      <line x1="0" y1="0" x2="100%" y2="100%" stroke="#aaa" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                      <line x1="100%" y1="0" x2="0" y2="100%" stroke="#aaa" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                    </svg>
                  )}
                  {isCur && <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10"><ChevronDown className="w-4 h-4 text-primary-500 animate-bounce" strokeWidth={3} /></div>}
                  <div className="relative z-[1]">
                    {exerciseType === 'e-directional'
                      ? <TumblingE direction={item as EDirection} size={sz} color={color} visible={isVis} />
                      : <SnellenLetter letter={item as string} size={sz} color={color} visible={isVis} />}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
        <p className="text-gray-500 text-[10px] text-center mt-1 select-none">
          Line {currentLineIndex + 1}/{CHART_LINES.length}
        </p>
      </div>
    )
  }

  // Arrow button for E-directional mode — large touch zones at corners
  const arrowIco = deviceMode === 'phone' ? 'w-8 h-8' : 'w-10 h-10'
  const arrowBtn = "flex items-center justify-center hover:bg-gray-700/40 active:bg-primary-600/40 rounded-xl transition-all active:scale-95 cursor-pointer select-none"

  // Letter button for letter mode — fills full column height
  const letterBtn = "flex-1 flex items-center justify-center bg-gray-800/60 hover:bg-primary-500/80 active:bg-primary-600 text-white font-black text-2xl rounded-xl shadow-md active:scale-95 transition-all cursor-pointer select-none min-w-[56px]"

  // One "eye unit" — arrows at 4 corners: ↑↓ top (same level), ←→ bottom (same level)
  const renderEyeUnit = (side: 'left' | 'right') => {
    const isEMode = exerciseType === 'e-directional'

    if (isEMode) {
      return (
        <div className="flex-1 flex flex-col">
          {/* Top corners: Up (left) and Down (right) — large touch zones */}
          <div className="flex items-stretch justify-between gap-1">
            <button onClick={() => handleAnswer('up')} className={`${arrowBtn} flex-1`}>
              <ArrowUp className={`${arrowIco} text-gray-300`} strokeWidth={2.5} />
            </button>
            <div className="flex-[2]" />
            <button onClick={() => handleAnswer('down')} className={`${arrowBtn} flex-1`}>
              <ArrowDown className={`${arrowIco} text-gray-300`} strokeWidth={2.5} />
            </button>
          </div>
          {/* Chart in the center */}
          <div className="flex-1 flex items-center justify-center overflow-hidden">
            {renderChart(side)}
          </div>
          {/* Bottom corners: Left (left) and Right (right) — large touch zones */}
          <div className="flex items-stretch justify-between gap-1">
            <button onClick={() => handleAnswer('left')} className={`${arrowBtn} flex-1`}>
              <ArrowLeft className={`${arrowIco} text-gray-300`} strokeWidth={2.5} />
            </button>
            <div className="flex-[2]" />
            <button onClick={() => handleAnswer('right')} className={`${arrowBtn} flex-1`}>
              <ArrowRight className={`${arrowIco} text-gray-300`} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )
    }

    // Letter mode — 2 choices on left (full height), chart center, 2 choices on right (full height)
    const leftLetters = letterChoices.slice(0, 2)
    const rightLetters = letterChoices.slice(2, 4)
    return (
      <div className="flex items-stretch flex-1 gap-1">
        <div className="flex flex-col gap-1" style={{ minWidth: deviceMode === 'phone' ? 56 : 64 }}>
          {leftLetters.map(l => (
            <button key={l} onClick={() => handleAnswer(l)} className={letterBtn}>{l}</button>
          ))}
        </div>
        <div className="flex-1 flex items-center justify-center overflow-hidden">
          {renderChart(side)}
        </div>
        <div className="flex flex-col gap-1" style={{ minWidth: deviceMode === 'phone' ? 56 : 64 }}>
          {rightLetters.map(l => (
            <button key={l} onClick={() => handleAnswer(l)} className={letterBtn}>{l}</button>
          ))}
        </div>
      </div>
    )
  }

  // Binocular-friendly prompt — doubled so cross-eyed fusion isn't broken
  const renderDistancePrompt = () => {
    const prompt = (
      <div className="bg-gray-800/90 border border-green-500/40 rounded-lg p-3 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <MoveHorizontal className="w-4 h-4 text-green-400" />
          <span className="text-green-400 font-bold text-sm">Chart Complete!</span>
        </div>
        <div className="flex gap-2 justify-center">
          <button onClick={() => handleDistanceAdjust('further')}
            className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-sm">Move Further</button>
          <button onClick={() => { setShowDistancePrompt(false); regenerateChart() }}
            className="px-3 py-2 bg-gray-600 hover:bg-gray-500 text-gray-200 rounded-lg text-sm">Stay</button>
        </div>
      </div>
    )
    // Duplicate the prompt for binocular mode so it fuses correctly
    return (
      <div className="flex items-center gap-0.5 flex-1">
        <div className="flex-1 flex items-center justify-center px-4">{prompt}</div>
        <div className="w-px bg-gray-600 self-stretch shrink-0" />
        <div className="flex-1 flex items-center justify-center px-4">{prompt}</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Portrait warning (phone only) */}
      {deviceMode === 'phone' && (
        <div className="flex portrait:flex landscape:hidden flex-col items-center justify-center bg-gray-800/90 backdrop-blur-sm rounded-xl p-8 text-center gap-4 min-h-[200px] border border-primary-400/20">
          <Smartphone className="w-14 h-14 text-primary-400" style={{ transform: 'rotate(90deg)' }} />
          <div>
            <p className="text-white font-bold text-lg">Rotate to Landscape</p>
            <p className="text-gray-400 text-sm mt-1">Hold your phone sideways for binocular training</p>
          </div>
        </div>
      )}

      {/* Main layout */}
      <div className={`${deviceMode === 'phone' ? 'hidden landscape:flex' : 'flex'} flex-col gap-1 flex-1`}>
        {/* Zoom control + voice toggle */}
        <div className="flex items-center justify-center gap-2 py-1">
          <button
            onClick={() => setViewScale(s => Math.max(50, s - 10))}
            className="p-1 rounded hover:bg-gray-700/50 text-gray-400 hover:text-white transition-all"
            title="Zoom out (narrower)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-gray-500 text-xs w-10 text-center">{viewScale}%</span>
          <button
            onClick={() => setViewScale(s => Math.min(100, s + 10))}
            className="p-1 rounded hover:bg-gray-700/50 text-gray-400 hover:text-white transition-all"
            title="Zoom in (wider)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-gray-600 mx-1" />
          {/* Voice toggle */}
          <button
            onClick={() => setLocalVoiceEnabled(v => !v)}
            className={`p-1 rounded transition-all ${
              localVoiceEnabled
                ? isSpeaking ? 'bg-green-600 text-white animate-pulse' : 'bg-primary-600 text-white'
                : 'bg-gray-700/50 text-gray-400 hover:text-white'
            }`}
            title={localVoiceEnabled ? 'Voice ON' : 'Voice OFF'}
          >
            {localVoiceEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </button>
          {localVoiceEnabled && (
            <span className="text-gray-500 text-xs">
              {voiceStatus === 'loading' ? 'Loading...' :
               isSpeaking ? '🔴' :
               lastHeard ? `"${lastHeard}"` :
               exerciseType === 'e-directional' ? 'Say direction' : 'Say letter'}
            </span>
          )}
        </div>

        {/* Scalable content area — centered vertically, clipped to fit */}
        <div className="flex-1 flex items-center justify-center overflow-hidden">
          <div className="flex flex-col w-full max-h-full" style={{
            transform: `scale(${viewScale / 100})`,
            transformOrigin: 'center center',
          }}>
            {showDistancePrompt ? (
              renderDistancePrompt()
            ) : (
              <div className="flex items-stretch gap-0.5 flex-1">
                {renderEyeUnit('left')}
                <div className="w-px bg-gray-600 self-stretch shrink-0" />
                {renderEyeUnit('right')}
              </div>
            )}

            {/* Progress dots — doubled for binocular */}
            <div className="flex items-center justify-center gap-1.5 mt-2 pb-2">
              {CHART_LINES.map((_, i) => (
                <div key={i} className={`w-2.5 h-2.5 rounded-full transition-all ${
                  i < currentLineIndex ? 'bg-green-400' : i === currentLineIndex ? 'bg-primary-500' : 'bg-gray-500'
                }`} />
              ))}
            </div>
          </div>
        </div>

        {consecutiveFailures >= 2 && <div className="text-orange-500 text-xs text-center pb-2">One more miss resets chart</div>}
      </div>
    </div>
  )
}
