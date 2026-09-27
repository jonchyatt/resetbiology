'use client'

import { useState, useEffect, useLayoutEffect, useCallback, useRef, type UIEvent } from 'react'
import { ChevronDown, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, MoveHorizontal, Mic, MicOff } from 'lucide-react'
import { WhisperService, type WhisperStatus } from '@/lib/speech'
import { SpeechQueue } from '@/lib/vision/audioKit'
import {
  SCREEN_E_LINE_MULTIPLIERS,
  SCREEN_E_LINE_LETTER_COUNTS,
  screenEChartPosition,
  screenELineSize,
} from '@/lib/vision/screenDirectionalE'

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

function SnellenLetter({ letter, size, color = '#000000', visible = true, fontWeight = 700 }: {
  letter: string; size: number; color?: string; visible?: boolean; fontWeight?: number
}) {
  if (!visible) return <div style={{ width: size * 0.8, height: size, display: 'inline-block' }} />
  return (
    <div className="select-none" style={{
      fontSize: `${size * 0.8}px`, lineHeight: 1, color, fontWeight,
      letterSpacing: '0.02em', fontFamily: 'system-ui, -apple-system, sans-serif',
      textRendering: 'geometricPrecision',
    }}>{letter}</div>
  )
}

function generateChartData(exerciseType: 'letters' | 'e-directional', binocularMode: BinocularMode) {
  const lines = binocularMode === 'redgreen'
    ? SCREEN_E_LINE_LETTER_COUNTS.map((letterCount, index) => ({
      level: index + 1,
      label: `Line ${index + 1}`,
      scale: SCREEN_E_LINE_MULTIPLIERS[index],
      letterCount,
    }))
    : CHART_LINES
  return lines.map(line => ({
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
  const [chartData, setChartData] = useState(() => generateChartData(exerciseType, binocularMode))
  const [currentLineIndex, setCurrentLineIndex] = useState(0)
  const [currentLetterIndex, setCurrentLetterIndex] = useState(0)
  const [consecutiveFailures, setConsecutiveFailures] = useState(0)
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null)
  const [showDistancePrompt, setShowDistancePrompt] = useState(false)
  const [letterChoices, setLetterChoices] = useState<string[]>([])
  const [ipdGap, setIpdGap] = useState(64) // px width of center column between charts
  const leftChartViewportRef = useRef<HTMLDivElement>(null)
  const rightChartViewportRef = useRef<HTMLDivElement>(null)
  const syncChartScroll = (side: 'left' | 'right', event: UIEvent<HTMLDivElement>) => {
    const peer = side === 'left' ? rightChartViewportRef.current : leftChartViewportRef.current
    if (peer && Math.abs(peer.scrollTop - event.currentTarget.scrollTop) > 1) {
      peer.scrollTop = event.currentTarget.scrollTop
    }
  }
  useLayoutEffect(() => {
    leftChartViewportRef.current?.scrollTo(0, 0)
    rightChartViewportRef.current?.scrollTo(0, 0)
  }, [chartData])

  useLayoutEffect(() => {
    if (binocularMode !== 'redgreen') return
    const leftViewport = leftChartViewportRef.current
    const rightViewport = rightChartViewportRef.current
    const activeRow = leftViewport?.querySelector<HTMLElement>(`[data-binocular-chart-row="${currentLineIndex}"]`)
    if (!leftViewport || !rightViewport || !activeRow) return

    const viewportBox = leftViewport.getBoundingClientRect()
    const rowBox = activeRow.getBoundingClientRect()
    const rowCenterFromTop = rowBox.top + rowBox.height / 2 - viewportBox.top
    const viewportMidpoint = leftViewport.clientHeight / 2
    const nextScrollTop = Math.min(
      leftViewport.scrollHeight - leftViewport.clientHeight,
      Math.max(0, leftViewport.scrollTop + rowCenterFromTop - viewportMidpoint),
    )
    leftViewport.scrollTop = nextScrollTop
    rightViewport.scrollTop = nextScrollTop
  }, [binocularMode, exerciseType, chartData, currentLineIndex, currentLetterIndex])
  // Simulated distance — shrink chart instead of moving screen (for headset use)
  const [chartScale, setChartScale] = useState(1.0)

  // Voice — on-demand only, NO preload. Model loads when user taps Voice ON.
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState<WhisperStatus>('idle')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const pendingVoiceDirectionsRef = useRef<EDirection[]>([])
  const voiceDrainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const answerGateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const acceptingAnswerRef = useRef(true)
  const awaitingAdvanceRef = useRef(false)
  const drainVoiceDirectionsRef = useRef<() => void>(() => {})

  useEffect(() => () => {
    if (voiceDrainTimerRef.current) clearTimeout(voiceDrainTimerRef.current)
    if (answerGateTimerRef.current) clearTimeout(answerGateTimerRef.current)
  }, [])

  useEffect(() => {
    if (!awaitingAdvanceRef.current) return
    awaitingAdvanceRef.current = false
    acceptingAnswerRef.current = true
    drainVoiceDirectionsRef.current()
  }, [currentLineIndex, currentLetterIndex, showDistancePrompt])

  const leftColor = binocularMode === 'duplicate' ? '#FFFFFF' : '#DD0000'
  const rightColor = binocularMode === 'duplicate' ? '#FFFFFF' : '#009500'
  const showGrid = ['grid-square', 'grid-slanted', 'alternating'].includes(binocularMode)
  const isSlantedGrid = binocularMode === 'grid-slanted'
  const showAlternating = binocularMode === 'alternating'

  useEffect(() => {
    setChartData(generateChartData(exerciseType, binocularMode))
    setCurrentLineIndex(0); setCurrentLetterIndex(0)
  }, [exerciseType, binocularMode])

  useEffect(() => {
    if (exerciseType === 'letters' && chartData[currentLineIndex]) {
      const cl = chartData[currentLineIndex].letters[currentLetterIndex]
      if (cl) setLetterChoices(getLetterChoices(cl))
    }
  }, [exerciseType, currentLineIndex, currentLetterIndex, chartData])

  useEffect(() => {
    if (feedback) { const t = setTimeout(() => setFeedback(null), 400); return () => clearTimeout(t) }
  }, [feedback])

  // Voice-out seam (T5b) — same SpeechQueue instance SessionRunner/engines use.
  const speechRef = useRef<SpeechQueue | null>(null)
  useEffect(() => {
    speechRef.current = new SpeechQueue()
    return () => speechRef.current?.stop()
  }, [])

  const regenerateChart = useCallback(() => {
    speechRef.current?.stop()
    pendingVoiceDirectionsRef.current = []
    if (answerGateTimerRef.current) clearTimeout(answerGateTimerRef.current)
    answerGateTimerRef.current = null
    acceptingAnswerRef.current = true
    awaitingAdvanceRef.current = false
    setChartData(generateChartData(exerciseType, binocularMode))
    setCurrentLineIndex(0); setCurrentLetterIndex(0); setConsecutiveFailures(0)
  }, [exerciseType, binocularMode])

  const advanceToNext = useCallback(() => {
    const cl = chartData[currentLineIndex]; if (!cl) return
    if (currentLetterIndex < cl.letterCount - 1) { setCurrentLetterIndex(p => p + 1) }
    else if (currentLineIndex >= chartData.length - 1) {
      pendingVoiceDirectionsRef.current = []
      setShowDistancePrompt(true); if (onChartComplete) onChartComplete()
    } else { setCurrentLineIndex(p => p + 1); setCurrentLetterIndex(0) }
  }, [chartData, currentLineIndex, currentLetterIndex, onChartComplete])

  const handleAnswer = useCallback((answer: string) => {
    if (!acceptingAnswerRef.current || showDistancePromptRef.current) return
    const cl = chartData[currentLineIndex]; if (!cl) return
    acceptingAnswerRef.current = false
    let isCorrect: boolean
    if (exerciseType === 'e-directional') {
      isCorrect = answer === cl.directions[currentLetterIndex]
    } else {
      isCorrect = answer.toUpperCase() === cl.letters[currentLetterIndex].toUpperCase()
    }
    if (!isCorrect) setFeedback('incorrect')
    onAnswer(isCorrect)
    if (isCorrect) {
      setConsecutiveFailures(0)
      answerGateTimerRef.current = setTimeout(() => {
        awaitingAdvanceRef.current = true
        advanceToNext()
      }, binocularMode === 'redgreen' ? 0 : 300)
    } else {
      setConsecutiveFailures(p => { const n = p + 1; if (n >= 3) setTimeout(() => regenerateChart(), 1500); return n })
      answerGateTimerRef.current = setTimeout(() => {
        acceptingAnswerRef.current = true
        drainVoiceDirectionsRef.current()
      }, 300)
    }
  }, [chartData, currentLineIndex, currentLetterIndex, exerciseType, onAnswer, advanceToNext, regenerateChart, binocularMode])

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
      if (dir) { e.preventDefault(); pendingVoiceDirectionsRef.current = []; handleAnswer(dir) }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [exerciseType, showDistancePrompt, handleAnswer])

  // Stable ref so voice callbacks always call latest handleAnswer
  const handleAnswerRef = useRef(handleAnswer)
  handleAnswerRef.current = handleAnswer
  const showDistancePromptRef = useRef(false)
  showDistancePromptRef.current = showDistancePrompt
  drainVoiceDirectionsRef.current = () => {
    if (showDistancePromptRef.current || !acceptingAnswerRef.current || voiceDrainTimerRef.current) return
    const direction = pendingVoiceDirectionsRef.current.shift()
    if (!direction) return
    handleAnswerRef.current(direction)
    voiceDrainTimerRef.current = setTimeout(() => {
      voiceDrainTimerRef.current = null
      drainVoiceDirectionsRef.current()
    }, 320)
  }

  // On-demand Whisper — NO preload, only loads when voiceEnabled flips to true
  useEffect(() => {
    if (!voiceEnabled) {
      WhisperService.stop()
      pendingVoiceDirectionsRef.current = []
      if (voiceDrainTimerRef.current) clearTimeout(voiceDrainTimerRef.current)
      voiceDrainTimerRef.current = null
      setIsSpeaking(false)
      return
    }

    const mode = exerciseType === 'e-directional' ? 'e-directional' : 'letters'

    WhisperService.start(mode, {
      onResult: (answer, rawTranscript) => {
        // Distance prompt voice commands
        if (showDistancePromptRef.current) {
          const lastWord = rawTranscript.trim().toLowerCase().split(/\s+/).pop() || ''
          if (['stay', 'same', 'stayed', 'say'].includes(lastWord)) {
            distanceActionsRef.current.stay()
          } else if (['shrink', 'shrunk', 'smaller', 'small', 'think', 'drink',
                       'forward', 'further', 'next', 'go', 'advance', 'move'].includes(lastWord)) {
            distanceActionsRef.current.forward()
          }
          return
        }
        if (!answer) return
        if (answer.type === 'letter') {
          handleAnswerRef.current(answer.value)
        }
      },
      onDirectionalCommand: (direction) => {
        if (showDistancePromptRef.current || exerciseType !== 'e-directional') return
        if (pendingVoiceDirectionsRef.current.length < 12) pendingVoiceDirectionsRef.current.push(direction)
        drainVoiceDirectionsRef.current()
      },
      onStatusChange: (status) => {
        setVoiceStatus(status)
        if (status === 'error') setVoiceEnabled(false)
      },
      onSpeechChange: (speaking) => {
        setIsSpeaking(speaking)
      },
    }).catch(() => {
      setVoiceEnabled(false)
    })

    return () => { WhisperService.stop() }
  }, [voiceEnabled, exerciseType])

  const handleDistanceAdjust = (dir: 'closer' | 'further') => {
    setShowDistancePrompt(false); regenerateChart()
    if (onDistanceAdjust) onDistanceAdjust(dir)
  }

  // Shrink chart — simulates moving further away (for headset where you can't move)
  const handleShrink = () => {
    setShowDistancePrompt(false)
    setChartScale(prev => Math.max(0.15, prev * 0.82)) // ~18% smaller each time, floor at 0.15x
    regenerateChart()
    if (onDistanceAdjust) onDistanceAdjust('further') // still track progression
  }

  // Phone/headset = shrink (can't move), desktop = physical move
  const usesShrinkMode = deviceMode === 'phone'

  // Stable refs for voice-activated distance commands
  const distanceActionsRef = useRef({ stay: () => {}, forward: () => {} })
  distanceActionsRef.current = {
    stay: () => { setShowDistancePrompt(false); regenerateChart() },
    forward: () => usesShrinkMode ? handleShrink() : handleDistanceAdjust('further'),
  }

  const getFR = () => {
    if (feedback === 'incorrect') return 'ring-4 ring-red-500 animate-pulse'
    return 'ring-2 ring-primary-400'
  }

  const viewportWidth = typeof window === 'undefined' ? 390 : window.innerWidth
  const devicePixelRatio = typeof window === 'undefined' ? 1 : window.devicePixelRatio
  const redGreenRailIndices = chartData.map((_, index) => index)
  const fullSnellenPosition = screenEChartPosition(
    viewportWidth,
    devicePixelRatio,
    currentLineIndex,
    SCREEN_E_LINE_MULTIPLIERS.length,
  )
  const redGreenRowHeights = redGreenRailIndices.map(index => fullSnellenPosition.rowHeights[index])
  const redGreenRowGap = 4
  const redGreenChartMinWidth = binocularMode === 'redgreen' && exerciseType === 'e-directional'
    ? Math.max(...chartData.map((line, index) => line.letterCount * screenELineSize(viewportWidth, redGreenRailIndices[index], devicePixelRatio) + (line.letterCount - 1) * 3))
    : undefined
  const redGreenChartMinHeight = redGreenRowHeights.reduce((total, height) => total + height, 0) + redGreenRowGap * (chartData.length - 1)
  const baseSize = deviceMode === 'phone' ? 34 : 44
  const sizeMul = (deviceMode === 'phone' ? 0.6 : 0.7) * chartScale

  // Render one chart (left or right)
  const renderChart = (side: 'left' | 'right') => {
    const color = side === 'left' ? leftColor : rightColor
    const isLeft = side === 'left'
    return (
      <div data-binocular-eye-chart={side} className={`flex-1 min-w-0 flex flex-col items-center ${binocularMode === 'redgreen' ? 'justify-start gap-1' : 'justify-evenly'}`}
        style={binocularMode === 'redgreen' ? { minWidth: redGreenChartMinWidth, minHeight: redGreenChartMinHeight, flex: '0 0 auto' } : undefined}>
        {chartData.map((line, li) => (
          <div key={li} data-binocular-chart-row={li} className={`flex items-center justify-center ${binocularMode === 'redgreen' ? 'gap-2' : ''} transition-all duration-300 ${
            li < currentLineIndex ? (binocularMode === 'redgreen' ? 'opacity-30' : 'opacity-20')
              : li === currentLineIndex ? 'opacity-100'
                : binocularMode === 'redgreen' ? 'opacity-55' : 'opacity-40'
          }`} style={{ gap: showGrid ? 0 : '3px', ...(binocularMode === 'redgreen' ? { minHeight: redGreenRowHeights[li] } : {}) }}>
            {Array.from({ length: line.letterCount }).map((_, ii) => {
              const isCur = li === currentLineIndex && ii === currentLetterIndex
              const isPast = li === currentLineIndex && ii < currentLetterIndex
              const isVis = !showAlternating || (isLeft ? ii % 2 === 0 : ii % 2 === 1)
              const redGreenRailIndex = redGreenRailIndices[li]
              const sz = binocularMode === 'redgreen'
                ? screenELineSize(viewportWidth, redGreenRailIndex, devicePixelRatio) * chartScale
                : Math.max(14, baseSize * line.scale * sizeMul)
              const item = exerciseType === 'e-directional' ? line.directions[ii] : line.letters[ii]
              return (
                <div key={ii} data-binocular-optotype-size={sz} data-binocular-target-index={ii} data-binocular-current-target={isCur ? 'true' : undefined} data-binocular-target={item}
                  className={`relative flex items-center justify-center ${isPast ? 'opacity-20' : ''} ${isCur ? getFR() + ' rounded-sm' : ''}`}
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
                      : <SnellenLetter letter={item as string} size={sz} color={color} visible={isVis} fontWeight={binocularMode === 'redgreen' ? 500 : 700} />}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    )
  }

  const renderChartViewport = (side: 'left' | 'right') => {
    if (binocularMode !== 'redgreen') return renderChart(side)
    return (
      <div
        ref={side === 'left' ? leftChartViewportRef : rightChartViewportRef}
        data-binocular-eye-viewport={side}
        role="region"
        aria-label={`${side === 'left' ? 'Left' : 'Right'} eye chart`}
        tabIndex={0}
        onScroll={event => syncChartScroll(side, event)}
        className="flex-1 min-w-0 min-h-0 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={redGreenChartMinWidth ? { minWidth: redGreenChartMinWidth } : undefined}
      >
        {renderChart(side)}
      </div>
    )
  }

  // Arrow icons
  const arrowIco = deviceMode === 'phone' ? 'w-10 h-10' : 'w-12 h-12'
  const arrowSize = deviceMode === 'phone' ? 40 : 48
  const ArrowIcons = { up: ArrowUp, down: ArrowDown, left: ArrowLeft, right: ArrowRight }

  // Red/Green keeps its answer arrows in equal fixed columns so fusion preserves
  // their scale and offsets. Other binocular layouts retain their existing sizing.
  const renderOuterArrowCol = (dirs: EDirection[], iconAlign: 'right' | 'left', eye: 'left' | 'right') => (
    <div data-binocular-arrow-column="outer"
      className={`flex flex-col shrink-0 ${binocularMode === 'redgreen' ? '' : 'flex-1 min-w-0'}`}
      style={binocularMode === 'redgreen' ? { flex: '0.75 1 0%', minWidth: 0 } : undefined}>
      {dirs.map(dir => {
        const Icon = ArrowIcons[dir]
        return (
          <button key={dir} data-binocular-answer-arrow={dir} onClick={() => { pendingVoiceDirectionsRef.current = []; handleAnswer(dir) }}
            aria-label={`${eye === 'left' ? 'Left' : 'Right'} eye answer: ${dir}`}
            className={`flex-1 flex items-center ${iconAlign === 'right' ? 'justify-end pr-1' : 'justify-start pl-1'} active:scale-95 transition-transform cursor-pointer select-none`}>
            <Icon className={`${arrowIco} ${binocularMode === 'redgreen' ? 'shrink-0' : ''} text-gray-300`} strokeWidth={2.5} />
          </button>
        )
      })}
    </div>
  )

  // Inner arrow column — narrow, tight to chart
  const renderInnerArrowCol = (dirs: EDirection[], eye: 'left' | 'right') => (
    <div data-binocular-arrow-column="inner"
      className={`flex flex-col shrink-0 ${binocularMode === 'redgreen' ? '' : 'w-[6%]'}`}
      style={binocularMode === 'redgreen' ? { width: arrowSize } : undefined}>
      {dirs.map(dir => {
        const Icon = ArrowIcons[dir]
        return (
          <button key={dir} data-binocular-answer-arrow={dir} onClick={() => { pendingVoiceDirectionsRef.current = []; handleAnswer(dir) }}
            aria-label={`${eye === 'left' ? 'Left' : 'Right'} eye answer: ${dir}`}
            className="flex-1 flex items-center justify-center active:scale-95 transition-transform cursor-pointer select-none">
            <Icon className={`${arrowIco} ${binocularMode === 'redgreen' ? 'shrink-0' : ''} text-gray-300`} strokeWidth={2.5} />
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

  // Center IPD control — entire column is a touch target
  // Top half widens, bottom half narrows. No tiny buttons.
  const renderIpdCenter = () => (
    <div className="flex flex-col items-center justify-center shrink-0 transition-all duration-150" style={{ width: `${Math.max(48, ipdGap)}px` }}>
      {/* Top half — tap anywhere to WIDEN */}
      <button data-binocular-ipd-widen onClick={() => setIpdGap(g => Math.min(160, g + 8))}
        aria-label="Widen eye chart separation"
        className="flex-1 w-full flex flex-col items-center justify-center cursor-pointer select-none active:bg-gray-700/30 transition-colors"
        title="Widen gap">
        <ArrowLeft className="w-5 h-5 text-gray-500" /><ArrowRight className="w-5 h-5 text-gray-500" />
      </button>
      {/* Midline */}
      <div className="w-full flex items-center justify-center py-1">
        <span className="text-gray-600 text-[10px]">IPD</span>
      </div>
      {/* Bottom half — tap anywhere to NARROW */}
      <button data-binocular-ipd-narrow onClick={() => setIpdGap(g => Math.max(48, g - 8))}
        aria-label="Narrow eye chart separation"
        className="flex-1 w-full flex flex-col items-center justify-center cursor-pointer select-none active:bg-gray-700/30 transition-colors"
        title="Narrow gap">
        <ArrowRight className="w-5 h-5 text-gray-500" /><ArrowLeft className="w-5 h-5 text-gray-500" />
      </button>
    </div>
  )

  // Center 2x2 letter grid + IPD control stacked
  const renderCenterLetterGrid = () => (
    <div className="flex flex-col items-center justify-center shrink-0" style={{ minWidth: '80px' }}>
      {/* Top half — tap to widen IPD */}
      <button onClick={() => setIpdGap(g => Math.min(120, g + 6))}
        className="flex-1 w-full flex items-end justify-center pb-1 cursor-pointer select-none active:bg-gray-700/30 transition-colors">
        <div className="flex text-gray-500"><ArrowLeft className="w-4 h-4" /><ArrowRight className="w-4 h-4" /></div>
      </button>
      {/* Letter grid in the middle */}
      <div className="grid grid-cols-2 gap-1">
        {letterChoices.map(l => (
          <button key={l} onClick={() => handleAnswer(l)}
            className="flex items-center justify-center text-white font-black text-2xl rounded-lg bg-gray-700/40 w-10 h-10 active:scale-95 transition-transform cursor-pointer select-none">
            {l}
          </button>
        ))}
      </div>
      {/* Bottom half — tap to narrow IPD */}
      <button onClick={() => setIpdGap(g => Math.max(0, g - 6))}
        className="flex-1 w-full flex items-start justify-center pt-1 cursor-pointer select-none active:bg-gray-700/30 transition-colors">
        <div className="flex text-gray-500"><ArrowRight className="w-4 h-4" /><ArrowLeft className="w-4 h-4" /></div>
      </button>
    </div>
  )

  // Distance prompt — mirrors the two-eye chart layout so each eye sees
  // "Stay" on the left and "Forward" on the right, centered where the chart was.
  // Touch zones match the arrow column positions for muscle-memory tapping.
  const renderDistancePromptFull = () => {
    const stayAction = () => { setShowDistancePrompt(false); regenerateChart() }
    const progressAction = usesShrinkMode ? handleShrink : () => handleDistanceAdjust('further')
    const progressLabel = usesShrinkMode ? 'Shrink' : 'Further'
    // One eye's prompt — centered where chart was
    const renderEyePrompt = () => (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 px-2">
          <div className="flex items-center gap-1">
            <MoveHorizontal className="w-5 h-5 text-green-400 shrink-0" />
            <span className="text-green-400 font-bold text-sm">Complete!</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={stayAction}
              className="px-4 py-3 rounded-lg bg-gray-700/60 text-gray-200 font-bold text-sm active:scale-95 transition-transform">
              Stay
            </button>
            <button onClick={progressAction}
              className="px-4 py-3 rounded-lg bg-green-600/80 text-white font-bold text-sm active:scale-95 transition-transform">
              {progressLabel}
            </button>
          </div>
        </div>
      </div>
    )

    return (
      <div className="flex items-stretch flex-1">
        {/* Left eye half */}
        <div className="flex-1 flex items-stretch">
          <button onClick={stayAction}
            className="flex-1 cursor-pointer select-none active:bg-gray-700/30 transition-colors"
            aria-label="Stay at same size" />
          {renderEyePrompt()}
          <button onClick={progressAction}
            className="flex-1 cursor-pointer select-none active:bg-gray-700/30 transition-colors"
            aria-label={progressLabel} />
        </div>

        {/* Center IPD divider — matches chart layout */}
        <div className="shrink-0 flex items-center" style={{ width: `${Math.max(48, ipdGap)}px` }}>
          <div className="w-px bg-gray-600 h-full mx-auto" />
        </div>

        {/* Right eye half — mirror of left */}
        <div className="flex-1 flex items-stretch">
          <button onClick={stayAction}
            className="flex-1 cursor-pointer select-none active:bg-gray-700/30 transition-colors"
            aria-label="Stay at same size" />
          {renderEyePrompt()}
          <button onClick={progressAction}
            className="flex-1 cursor-pointer select-none active:bg-gray-700/30 transition-colors"
            aria-label={progressLabel} />
        </div>
      </div>
    )
  }

  return (
    <div data-binocular-scroll-shell={binocularMode === 'redgreen' ? 'redgreen' : undefined}
      className={`flex flex-col h-full min-h-0 ${binocularMode === 'redgreen' ? 'overflow-hidden' : ''}`}
      style={binocularMode === 'redgreen' ? { maxHeight: 'calc(100dvh - 60px)' } : undefined}>
      {/* Main layout - always visible */}
      <div className="flex flex-col gap-1 flex-1 min-h-0">
        {/* Content area — two eye-halves with IPD gap between */}
        <div className={`flex items-stretch flex-1 min-h-0 ${binocularMode === 'redgreen' ? 'min-w-0' : ''}`}>
          {showDistancePrompt ? (
            renderDistancePromptFull()
          ) : binocularMode === 'redgreen' && exerciseType === 'letters' ? (
            <div className="flex flex-1 items-stretch min-h-0 min-w-0">
              {renderChartViewport('left')}
              {renderIpdCenter()}
              {renderChartViewport('right')}
            </div>
          ) : exerciseType === 'e-directional' ? (
            <>
              {/* LEFT EYE HALF — chart centered in this half, arrows tight around it */}
              <div className="flex-1 flex items-stretch min-h-0 min-w-0">
                {renderOuterArrowCol(['up', 'left'], 'right', 'left')}
                {renderChartViewport('left')}
                {renderInnerArrowCol(['down', 'right'], 'left')}
              </div>

              {/* CENTER — IPD control */}
              {renderIpdCenter()}

              {/* RIGHT EYE HALF — mirror of left */}
              <div className="flex-1 flex items-stretch min-h-0 min-w-0">
                {renderInnerArrowCol(['up', 'left'], 'right')}
                {renderChartViewport('right')}
                {renderOuterArrowCol(['down', 'right'], 'left', 'right')}
              </div>
            </>
          ) : (
            <>
              {/* LEFT EYE HALF */}
              <div className="flex-1 flex items-stretch">
                {renderOuterLetterCol(letterChoices.slice(0, 2), 'right')}
                {renderChart('left')}
              </div>

              {/* CENTER — 2x2 letter grid + IPD */}
              {renderCenterLetterGrid()}

              {/* RIGHT EYE HALF */}
              <div className="flex-1 flex items-stretch">
                {renderChart('right')}
                {renderOuterLetterCol(letterChoices.slice(2, 4), 'left')}
              </div>
            </>
          )}
        </div>

        {!showDistancePrompt && binocularMode === 'redgreen' && exerciseType === 'letters' && (
          <div data-binocular-letter-answer-dock className="flex shrink-0 flex-col items-center gap-1 py-0">
            <div className="grid grid-cols-2 gap-1">
              {letterChoices.map(letter => (
                <button key={letter} data-binocular-center-answer="true" onClick={() => handleAnswer(letter)}
                  className="flex h-12 min-h-12 w-12 min-w-12 items-center justify-center rounded-lg bg-gray-700/70 text-2xl font-black text-white">
                  {letter}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Progress dots */}
        {!showDistancePrompt && (
          <div className={`flex items-center justify-center gap-1.5 ${binocularMode === 'redgreen' ? '' : 'mt-1 pb-2'}`}>
            {chartData.map((_, i) => (
              <div key={i} className={`w-2.5 h-2.5 rounded-full transition-all ${
                i < currentLineIndex ? 'bg-green-400' : i === currentLineIndex ? 'bg-primary-500' : 'bg-gray-500'
              }`} />
            ))}
          </div>
        )}

        {consecutiveFailures >= 2 && <div className="text-orange-500 text-xs text-center pb-2">One more miss resets chart</div>}

        {/* Voice toggle — below charts, outside binocular area, large tap target */}
        <div className={`flex justify-center ${binocularMode !== 'redgreen' || exerciseType === 'letters' ? 'pb-2' : ''}`}>
          <button
            onClick={() => setVoiceEnabled(v => !v)}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl font-semibold text-sm transition-all ${
              voiceEnabled
                ? isSpeaking ? 'bg-green-600 text-white animate-pulse' : 'bg-primary-600 text-white'
                : 'bg-gray-700/60 text-gray-400 hover:text-white'
            }`}
          >
            {voiceEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            {voiceEnabled
              ? voiceStatus === 'loading' ? 'Loading voice...' : isSpeaking ? 'Hearing...' : 'Voice ON'
              : 'Voice OFF'}
          </button>
        </div>
      </div>
    </div>
  )
}
