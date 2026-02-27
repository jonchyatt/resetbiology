'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronDown, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, MoveHorizontal, Mic, MicOff } from 'lucide-react'
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
  const showDistancePromptRef = useRef(false)
  showDistancePromptRef.current = showDistancePrompt
  const [letterChoices, setLetterChoices] = useState<string[]>([])
  const [ipdGap, setIpdGap] = useState(16) // px gap between left/right charts for pupil distance

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
    if (!isCorrect) setFeedback('incorrect')
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
        // Handle distance prompt voice commands (say "stay" or "forward")
        if (showDistancePromptRef.current) {
          const lastWord = rawTranscript.trim().toLowerCase().split(/\s+/).pop() || ''
          if (['stay', 'same', 'stayed', 'say'].includes(lastWord)) {
            distanceActionsRef.current.stay()
          } else if (['forward', 'further', 'next', 'go', 'advance', 'move'].includes(lastWord)) {
            distanceActionsRef.current.forward()
          }
          return
        }
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

  // Refs for voice-activated distance prompt commands (stable across renders)
  const distanceActionsRef = useRef({ stay: () => {}, forward: () => {} })
  distanceActionsRef.current = {
    stay: () => { setShowDistancePrompt(false); regenerateChart() },
    forward: () => handleDistanceAdjust('further'),
  }

  const getFR = () => {
    if (feedback === 'incorrect') return 'ring-4 ring-red-500 animate-pulse'
    return 'ring-2 ring-primary-400'
  }

  const baseSize = deviceMode === 'phone' ? 32 : 38
  const sizeMul = deviceMode === 'phone' ? 0.55 : 0.6

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
      </div>
    )
  }

  // Arrow icons
  const arrowIco = deviceMode === 'phone' ? 'w-10 h-10' : 'w-12 h-12'
  const ArrowIcons = { up: ArrowUp, down: ArrowDown, left: ArrowLeft, right: ArrowRight }

  // Outer arrow column — flex-1 fills to screen edge, icon near chart side
  const renderOuterArrowCol = (dirs: EDirection[], iconAlign: 'right' | 'left') => (
    <div className="flex flex-col flex-1 shrink-0 min-w-0">
      {dirs.map(dir => {
        const Icon = ArrowIcons[dir]
        return (
          <button key={dir} onClick={() => handleAnswer(dir)}
            className={`flex-1 flex items-center ${iconAlign === 'right' ? 'justify-end pr-1' : 'justify-start pl-1'} active:scale-95 transition-transform cursor-pointer select-none`}>
            <Icon className={`${arrowIco} text-gray-300`} strokeWidth={2.5} />
          </button>
        )
      })}
    </div>
  )

  // Inner arrow column — narrow, tight to chart
  const renderInnerArrowCol = (dirs: EDirection[]) => (
    <div className="flex flex-col shrink-0 w-[6%]">
      {dirs.map(dir => {
        const Icon = ArrowIcons[dir]
        return (
          <button key={dir} onClick={() => handleAnswer(dir)}
            className="flex-1 flex items-center justify-center active:scale-95 transition-transform cursor-pointer select-none">
            <Icon className={`${arrowIco} text-gray-300`} strokeWidth={2.5} />
          </button>
        )
      })}
    </div>
  )

  // Outer letter column — flex-1 fills to screen edge, text near chart
  const renderOuterLetterCol = (letters: string[], align: 'right' | 'left') => (
    <div className="flex flex-col flex-1 shrink-0 min-w-0">
      {letters.map(l => (
        <button key={l} onClick={() => handleAnswer(l)}
          className={`flex-1 flex items-center ${align === 'right' ? 'justify-end pr-2' : 'justify-start pl-2'} text-white font-black text-2xl active:scale-95 transition-transform cursor-pointer select-none`}>
          {l}
        </button>
      ))}
    </div>
  )

  // Center IPD control + midline divider
  const renderIpdCenter = () => (
    <div className="flex flex-col items-center justify-center shrink-0 px-1" style={{ minWidth: '48px' }}>
      <button onClick={() => setIpdGap(g => Math.min(80, g + 4))}
        className="p-1.5 rounded hover:bg-gray-700/50 text-gray-400 hover:text-white transition-all"
        title="Widen gap">
        <MoveHorizontal className="w-5 h-5" />
      </button>
      <div className="flex-1 flex items-center">
        <div className="w-px bg-gray-600 h-full" />
      </div>
      <span className="text-gray-500 text-[10px]">IPD</span>
      <div className="flex-1 flex items-center">
        <div className="w-px bg-gray-600 h-full" />
      </div>
      <button onClick={() => setIpdGap(g => Math.max(0, g - 4))}
        className="p-1.5 rounded hover:bg-gray-700/50 text-gray-400 hover:text-white transition-all"
        title="Narrow gap">
        <ArrowRight className="w-4 h-4 -mr-1" /><ArrowLeft className="w-4 h-4 -ml-1" />
      </button>
    </div>
  )

  // Center 2x2 letter grid + IPD control stacked
  const renderCenterLetterGrid = () => (
    <div className="flex flex-col items-center justify-center shrink-0 gap-1" style={{ minWidth: '80px' }}>
      <div className="grid grid-cols-2 gap-1">
        {letterChoices.map(l => (
          <button key={l} onClick={() => handleAnswer(l)}
            className="flex items-center justify-center text-white font-black text-2xl w-10 h-10 rounded-lg bg-gray-700/40 active:scale-95 transition-transform cursor-pointer select-none">
            {l}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => setIpdGap(g => Math.max(0, g - 4))}
          className="text-gray-500 hover:text-white text-xs px-1">-</button>
        <span className="text-gray-500 text-[10px]">IPD</span>
        <button onClick={() => setIpdGap(g => Math.min(80, g + 4))}
          className="text-gray-500 hover:text-white text-xs px-1">+</button>
      </div>
    </div>
  )

  // Distance prompt — full-height side touch zones + scaled center text
  // Side zones match arrow column positions so user taps same spot
  const renderDistancePromptFull = () => {
    const stayAction = () => { setShowDistancePrompt(false); regenerateChart() }
    const forwardAction = () => handleDistanceAdjust('further')
    const renderEyeContent = () => (
      <div className="flex items-center flex-1 min-w-0 gap-2">
        <div className="flex flex-col items-center shrink-0">
          <span className="text-gray-300 font-bold text-lg whitespace-nowrap">Stay</span>
          <span className="text-gray-500 text-xs whitespace-nowrap">(same distance)</span>
        </div>
        <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
          <MoveHorizontal className="w-5 h-5 text-green-400 shrink-0" />
          <span className="text-green-400 font-bold text-base whitespace-nowrap">Chart Complete!</span>
        </div>
        <div className="flex flex-col items-center shrink-0">
          <span className="text-green-400 font-bold text-lg whitespace-nowrap">Forward</span>
          <span className="text-gray-500 text-xs whitespace-nowrap">(move further)</span>
        </div>
      </div>
    )

    return (
      <div className="flex items-stretch flex-1">
        {/* Left touch zone — full height, same width as arrow column */}
        <button
          onClick={stayAction}
          className="w-[15%] shrink-0 cursor-pointer select-none active:bg-gray-700/30 transition-colors"
          aria-label="Stay at same distance"
        />

        {/* Scaled center — each eye sees Stay | Complete! | Forward, vertically centered */}
        <div className="flex-1 flex items-center justify-center overflow-hidden">
          <div className="flex flex-col items-center">
            <div className="flex items-center" style={{ gap: `${ipdGap}px` }}>
              {renderEyeContent()}
              <div className="w-px bg-gray-600 self-stretch shrink-0 mx-1" />
              {renderEyeContent()}
            </div>
            {/* Progress dots */}
            <div className="flex items-center justify-center gap-1.5 mt-2">
              {CHART_LINES.map((_, i) => (
                <div key={i} className={`w-2.5 h-2.5 rounded-full transition-all ${
                  i < currentLineIndex ? 'bg-green-400' : i === currentLineIndex ? 'bg-primary-500' : 'bg-gray-500'
                }`} />
              ))}
            </div>
          </div>
        </div>

        {/* Right touch zone — full height, same width as arrow column */}
        <button
          onClick={forwardAction}
          className="w-[15%] shrink-0 cursor-pointer select-none active:bg-gray-700/30 transition-colors"
          aria-label="Move forward"
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Main layout - always visible */}
      <div className="flex flex-col gap-1 flex-1">
        {/* Voice toggle — small, top-right corner, outside binocular area */}
        <div className="flex justify-end px-2 py-0.5">
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
        </div>

        {/* Content area */}
        <div className="flex items-stretch flex-1">
          {showDistancePrompt ? (
            renderDistancePromptFull()
          ) : exerciseType === 'e-directional' ? (
            /* E-directional layout:
               [outer UP/LEFT flex→edge] [chart] [inner DOWN/RIGHT narrow] [IPD center] [inner UP/LEFT narrow] [chart] [outer DOWN/RIGHT flex→edge]
               Outer touch areas fill to screen edges. Inner arrows tight to charts. */
            <>
              {renderOuterArrowCol(['up', 'left'], 'right')}
              {renderChart('left')}
              {renderInnerArrowCol(['down', 'right'])}
              {renderIpdCenter()}
              {renderInnerArrowCol(['up', 'left'])}
              {renderChart('right')}
              {renderOuterArrowCol(['down', 'right'], 'left')}
            </>
          ) : (
            /* Letter mode: outer letter cols (touch to edge) + center 2x2 grid with IPD below */
            <>
              {renderOuterLetterCol(letterChoices.slice(0, 2), 'right')}
              {renderChart('left')}
              {renderCenterLetterGrid()}
              {renderChart('right')}
              {renderOuterLetterCol(letterChoices.slice(2, 4), 'left')}
            </>
          )}
        </div>

        {/* Progress dots */}
        {!showDistancePrompt && (
          <div className="flex items-center justify-center gap-1.5 mt-1 pb-2">
            {CHART_LINES.map((_, i) => (
              <div key={i} className={`w-2.5 h-2.5 rounded-full transition-all ${
                i < currentLineIndex ? 'bg-green-400' : i === currentLineIndex ? 'bg-primary-500' : 'bg-gray-500'
              }`} />
            ))}
          </div>
        )}

        {consecutiveFailures >= 2 && <div className="text-orange-500 text-xs text-center pb-2">One more miss resets chart</div>}
      </div>
    </div>
  )
}
