'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, MoveHorizontal, Smartphone } from 'lucide-react'

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

// Tumbling E — integer coords for pixel-perfect rendering
function TumblingE({ direction, size, color = '#000000', visible = true }: {
  direction: EDirection; size: number; color?: string; visible?: boolean
}) {
  if (!visible) return <div style={{ width: size, height: size }} />
  const rot: Record<EDirection, number> = { right: 0, down: 90, left: 180, up: 270 }
  return (
    <svg width={size} height={size} viewBox="0 0 50 50"
      style={{ transform: `rotate(${rot[direction]}deg)`, shapeRendering: 'crispEdges' }}>
      <g fill={color}>
        <rect x="5" y="5" width="8" height="40" />
        <rect x="5" y="5" width="40" height="8" />
        <rect x="5" y="21" width="35" height="8" />
        <rect x="5" y="37" width="40" height="8" />
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

  const leftColor = binocularMode === 'duplicate' ? '#000000' : '#EE0000'
  const rightColor = binocularMode === 'duplicate' ? '#000000' : '#00BB00'
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
          Which way? (Line {currentLineIndex + 1}/{CHART_LINES.length})
        </p>
      </div>
    )
  }

  // "Read true" button column — each chart gets its own buttons on BOTH sides
  // When cross-eye fused, the inner buttons overlap into one perceived set
  const renderButtonCol = (position: 'left' | 'right') => {
    const isEMode = exerciseType === 'e-directional'
    // Tall buttons that fill vertical space — easy to press without precision
    const bCls = "bg-gray-900 hover:bg-primary-500 active:bg-primary-600 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1 flex-1"
    const bSz = deviceMode === 'phone' ? "px-2 text-xs min-w-[60px]" : "px-4 text-sm min-w-[90px]"
    const ico = deviceMode === 'phone' ? "w-4 h-4" : "w-5 h-5"

    if (isEMode) {
      if (position === 'left') return (
        <div className="flex flex-col gap-1 shrink-0 py-1" style={{ minHeight: '100%' }}>
          <button onClick={() => handleAnswer('up')} className={`${bCls} ${bSz}`}>
            <ArrowUp className={ico} strokeWidth={2.5} />Up
          </button>
          <button onClick={() => handleAnswer('left')} className={`${bCls} ${bSz}`}>
            <ArrowLeft className={ico} strokeWidth={2.5} />Left
          </button>
        </div>
      )
      return (
        <div className="flex flex-col gap-1 shrink-0 py-1" style={{ minHeight: '100%' }}>
          <button onClick={() => handleAnswer('right')} className={`${bCls} ${bSz}`}>
            Rt<ArrowRight className={ico} strokeWidth={2.5} />
          </button>
          <button onClick={() => handleAnswer('down')} className={`${bCls} ${bSz}`}>
            <ArrowDown className={ico} strokeWidth={2.5} />Dn
          </button>
        </div>
      )
    }
    // Letter mode — 2 letters per column
    const letters = position === 'left' ? letterChoices.slice(0, 2) : letterChoices.slice(2, 4)
    return (
      <div className="flex flex-col gap-1 shrink-0 py-1" style={{ minHeight: '100%' }}>
        {letters.map(l => (
          <button key={l} onClick={() => handleAnswer(l)}
            className={`${bCls} ${bSz} font-black text-lg`}>{l}</button>
        ))}
      </div>
    )
  }

  // One "eye unit" = [left-buttons] [chart] [right-buttons]
  const renderEyeUnit = (side: 'left' | 'right') => (
    <div className="flex items-stretch flex-1 gap-0.5">
      {renderButtonCol('left')}
      <div className="flex-1 bg-white rounded-md flex items-center justify-center"
        style={{ padding: deviceMode === 'phone' ? '4px' : '10px' }}>
        {renderChart(side)}
      </div>
      {renderButtonCol('right')}
    </div>
  )

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
        {showDistancePrompt ? (
          <div className="bg-green-50 border border-green-300 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <MoveHorizontal className="w-4 h-4 text-green-600" />
              <span className="text-green-600 font-bold text-sm">Chart Complete!</span>
            </div>
            <div className="flex gap-2 justify-center">
              <button onClick={() => handleDistanceAdjust('further')}
                className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold text-sm">Move Further</button>
              <button onClick={() => { setShowDistancePrompt(false); regenerateChart() }}
                className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm">Stay</button>
            </div>
          </div>
        ) : (
          /* "Read true" layout: each chart flanked by its own buttons
             [L-btns][ChartL][R-btns] | [L-btns][ChartR][R-btns]
             Inner buttons overlap when cross-eye fused → 8 buttons → perceived as 4 */
          <div className="flex items-stretch gap-0.5 flex-1">
            {renderEyeUnit('left')}
            <div className="w-px bg-gray-600 self-stretch shrink-0" />
            {renderEyeUnit('right')}
          </div>
        )}

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1 mt-1">
          {CHART_LINES.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full transition-all ${
              i < currentLineIndex ? 'bg-green-400' : i === currentLineIndex ? 'bg-primary-500' : 'bg-gray-300'
            }`} />
          ))}
        </div>
        {consecutiveFailures >= 2 && <div className="text-orange-500 text-xs text-center">One more miss resets chart</div>}
      </div>
    </div>
  )
}
