'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, MoveHorizontal, Smartphone } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

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

// ─── Chart Configuration (matches SnellenChart) ────────────────────────────

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

// ─── Color-Configurable Tumbling E (integer coords for crisp rendering) ─────

function TumblingE({ direction, size, color = '#000000', visible = true }: {
  direction: EDirection
  size: number
  color?: string
  visible?: boolean
}) {
  if (!visible) {
    return <div style={{ width: size, height: size }} />
  }

  const rotationMap: Record<EDirection, number> = {
    right: 0, down: 90, left: 180, up: 270
  }

  // All integer coordinates for pixel-perfect rendering at any size
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 50 50"
      style={{
        transform: `rotate(${rotationMap[direction]}deg)`,
        shapeRendering: 'crispEdges',
      }}
    >
      <g fill={color}>
        {/* Vertical bar (spine) */}
        <rect x="5" y="5" width="8" height="40" />
        {/* Top horizontal bar */}
        <rect x="5" y="5" width="40" height="8" />
        {/* Middle horizontal bar - integer y for clean centering */}
        <rect x="5" y="21" width="35" height="8" />
        {/* Bottom horizontal bar */}
        <rect x="5" y="37" width="40" height="8" />
      </g>
    </svg>
  )
}

// ─── Color-Configurable Letter ──────────────────────────────────────────────

function SnellenLetter({ letter, size, color = '#000000', visible = true }: {
  letter: string
  size: number
  color?: string
  visible?: boolean
}) {
  if (!visible) {
    return <div style={{ width: size * 0.8, height: size, display: 'inline-block' }} />
  }

  return (
    <div
      className="select-none"
      style={{
        fontSize: `${size * 0.8}px`,
        lineHeight: 1,
        color,
        fontWeight: 700,
        letterSpacing: '0.02em',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        textRendering: 'geometricPrecision',
      }}
    >
      {letter}
    </div>
  )
}

// ─── Data Generation ────────────────────────────────────────────────────────

function generateLineDirections(count: number): EDirection[] {
  return Array.from({ length: count }, () =>
    E_DIRECTIONS[Math.floor(Math.random() * E_DIRECTIONS.length)]
  )
}

function generateLineLetters(count: number): string[] {
  return Array.from({ length: count }, () =>
    CONFUSABLE_LETTERS[Math.floor(Math.random() * CONFUSABLE_LETTERS.length)]
  )
}

function generateChartData(exerciseType: 'letters' | 'e-directional') {
  return CHART_LINES.map(line => ({
    ...line,
    directions: generateLineDirections(line.letterCount),
    letters: generateLineLetters(line.letterCount),
  }))
}

function getLetterChoices(correctLetter: string): string[] {
  const distractors = CONFUSABLE_LETTERS
    .filter(l => l !== correctLetter)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
  return [correctLetter, ...distractors].sort(() => Math.random() - 0.5)
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function BinocularChart({
  chartSize,
  exerciseType,
  binocularMode,
  onAnswer,
  resetTrigger = 0,
  deviceMode = 'phone',
  onChartComplete,
  onDistanceAdjust,
}: BinocularChartProps) {
  // Chart state
  const [chartData, setChartData] = useState(() => generateChartData(exerciseType))
  const [currentLineIndex, setCurrentLineIndex] = useState(0)
  const [currentLetterIndex, setCurrentLetterIndex] = useState(0)
  const [consecutiveFailures, setConsecutiveFailures] = useState(0)
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null)
  const [showDistancePrompt, setShowDistancePrompt] = useState(false)
  const [letterChoices, setLetterChoices] = useState<string[]>([])

  // ─── Derived mode flags ───────────────────────────────────────────────────
  const leftColor = binocularMode === 'duplicate' ? '#000000' : '#EE0000'
  const rightColor = binocularMode === 'duplicate' ? '#000000' : '#00BB00'
  const showGrid = ['grid-square', 'grid-slanted', 'alternating'].includes(binocularMode)
  const isSlantedGrid = binocularMode === 'grid-slanted'
  const showAlternating = binocularMode === 'alternating'

  // ─── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    setChartData(generateChartData(exerciseType))
    setCurrentLineIndex(0)
    setCurrentLetterIndex(0)
  }, [exerciseType])

  useEffect(() => {
    if (exerciseType === 'letters' && chartData[currentLineIndex]) {
      const correctLetter = chartData[currentLineIndex].letters[currentLetterIndex]
      if (correctLetter) {
        setLetterChoices(getLetterChoices(correctLetter))
      }
    }
  }, [exerciseType, currentLineIndex, currentLetterIndex, chartData])

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 400)
      return () => clearTimeout(timer)
    }
  }, [feedback])

  // ─── Game Logic ───────────────────────────────────────────────────────────

  const regenerateChart = useCallback(() => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setChartData(generateChartData(exerciseType))
    setCurrentLineIndex(0)
    setCurrentLetterIndex(0)
    setConsecutiveFailures(0)
  }, [exerciseType])

  const advanceToNext = useCallback(() => {
    const currentLine = chartData[currentLineIndex]
    if (!currentLine) return

    if (currentLetterIndex < currentLine.letterCount - 1) {
      setCurrentLetterIndex(prev => prev + 1)
    } else {
      if (currentLineIndex >= CHART_LINES.length - 1) {
        setShowDistancePrompt(true)
        if (onChartComplete) onChartComplete()
      } else {
        setCurrentLineIndex(prev => prev + 1)
        setCurrentLetterIndex(0)
      }
    }
  }, [chartData, currentLineIndex, currentLetterIndex, onChartComplete])

  const handleDirectionAnswer = useCallback((selectedDirection: EDirection) => {
    const currentLine = chartData[currentLineIndex]
    if (!currentLine) return

    const correctDirection = currentLine.directions[currentLetterIndex]
    const isCorrect = selectedDirection === correctDirection

    setFeedback(isCorrect ? 'correct' : 'incorrect')
    onAnswer(isCorrect)

    if (isCorrect) {
      setConsecutiveFailures(0)
      setTimeout(() => advanceToNext(), 300)
    } else {
      setConsecutiveFailures(prev => {
        const newCount = prev + 1
        if (newCount >= 3) {
          setTimeout(() => regenerateChart(), 1500)
        }
        return newCount
      })
    }
  }, [chartData, currentLineIndex, currentLetterIndex, onAnswer, advanceToNext, regenerateChart])

  const handleLetterAnswer = useCallback((selectedLetter: string) => {
    const currentLine = chartData[currentLineIndex]
    if (!currentLine) return

    const correctLetter = currentLine.letters[currentLetterIndex]
    const isCorrect = selectedLetter.toUpperCase() === correctLetter.toUpperCase()

    setFeedback(isCorrect ? 'correct' : 'incorrect')
    onAnswer(isCorrect)

    if (isCorrect) {
      setConsecutiveFailures(0)
      setTimeout(() => advanceToNext(), 300)
    } else {
      setConsecutiveFailures(prev => {
        const newCount = prev + 1
        if (newCount >= 3) {
          setTimeout(() => regenerateChart(), 1500)
        }
        return newCount
      })
    }
  }, [chartData, currentLineIndex, currentLetterIndex, onAnswer, advanceToNext, regenerateChart])

  const handleDistanceAdjust = (direction: 'closer' | 'further') => {
    setShowDistancePrompt(false)
    regenerateChart()
    if (onDistanceAdjust) onDistanceAdjust(direction)
  }

  // ─── Rendering Helpers ────────────────────────────────────────────────────

  const getFeedbackRing = () => {
    if (feedback === 'correct') return 'ring-4 ring-green-500 animate-pulse'
    if (feedback === 'incorrect') return 'ring-4 ring-red-500 animate-pulse'
    return 'ring-2 ring-primary-400'
  }

  // Much larger sizes - binocular charts need to fill the space and be readable
  const baseSize = deviceMode === 'phone' ? 36 : 52
  const sizeMultiplier = deviceMode === 'phone' ? 0.7 : 0.85

  const renderChart = (side: 'left' | 'right') => {
    const color = side === 'left' ? leftColor : rightColor
    const isLeft = side === 'left'

    return (
      <div className="flex-1 flex flex-col items-center justify-center" style={{ gap: '2px' }}>
        {chartData.map((line, lineIdx) => (
          <div
            key={lineIdx}
            className={`flex items-center justify-center transition-all duration-300 ${
              lineIdx < currentLineIndex ? 'opacity-20'
              : lineIdx === currentLineIndex ? 'opacity-100'
              : 'opacity-40'
            }`}
            style={{ gap: showGrid ? 0 : '3px' }}
          >
            {Array.from({ length: line.letterCount }).map((_, itemIdx) => {
              const isCurrentItem = lineIdx === currentLineIndex && itemIdx === currentLetterIndex
              const isPastItem = lineIdx === currentLineIndex && itemIdx < currentLetterIndex
              const isVisible = !showAlternating || (isLeft ? itemIdx % 2 === 0 : itemIdx % 2 === 1)
              // Ensure minimum readable size (never below 14px)
              const itemSize = Math.max(14, baseSize * line.scale * sizeMultiplier)

              const item = exerciseType === 'e-directional'
                ? line.directions[itemIdx]
                : line.letters[itemIdx]

              return (
                <div
                  key={itemIdx}
                  className={`relative flex items-center justify-center ${
                    isPastItem ? 'opacity-20' : ''
                  } ${isCurrentItem ? getFeedbackRing() + ' rounded-sm' : ''}`}
                  style={{
                    ...(showGrid ? {
                      border: '1px solid #888',
                      padding: '2px',
                      minWidth: itemSize + 6,
                      minHeight: itemSize + 6,
                    } : {}),
                  }}
                >
                  {/* Diagonal lines for slanted grid */}
                  {isSlantedGrid && showGrid && (
                    <svg
                      className="absolute inset-0 pointer-events-none z-0"
                      width="100%"
                      height="100%"
                      preserveAspectRatio="none"
                    >
                      <line x1="0" y1="0" x2="100%" y2="100%" stroke="#aaa" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                      <line x1="100%" y1="0" x2="0" y2="100%" stroke="#aaa" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                    </svg>
                  )}

                  {/* Current item indicator */}
                  {isCurrentItem && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                      <ChevronDown className="w-4 h-4 text-primary-500 animate-bounce" strokeWidth={3} />
                    </div>
                  )}

                  {/* The optotype */}
                  <div className="relative z-[1]">
                    {exerciseType === 'e-directional' ? (
                      <TumblingE direction={item as EDirection} size={itemSize} color={color} visible={isVisible} />
                    ) : (
                      <SnellenLetter letter={item as string} size={itemSize} color={color} visible={isVisible} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}

        {/* Line indicator under each chart */}
        <p className="text-gray-500 text-[10px] text-center mt-1 select-none">
          Which way? (Line {currentLineIndex + 1}/{CHART_LINES.length})
        </p>
      </div>
    )
  }

  // ─── Button Styles ────────────────────────────────────────────────────────

  const btnClass = "bg-gray-900 hover:bg-primary-500 active:bg-primary-600 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1"
  const btnSize = deviceMode === 'phone'
    ? "px-3 py-4 text-sm min-w-[90px]"
    : "px-5 py-5 text-base min-w-[120px]"
  const letterBtnClass = "bg-gray-900 hover:bg-primary-500 active:bg-primary-600 text-white font-black rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center"
  const letterBtnSize = deviceMode === 'phone'
    ? "px-3 py-3 text-xl min-w-[70px]"
    : "px-5 py-4 text-2xl min-w-[100px]"
  const iconSize = deviceMode === 'phone' ? "w-5 h-5" : "w-6 h-6"

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col">
      {/* Portrait orientation warning (phone only) */}
      {deviceMode === 'phone' && (
        <div className="flex portrait:flex landscape:hidden flex-col items-center justify-center bg-gray-800/90 backdrop-blur-sm rounded-xl p-8 text-center gap-4 min-h-[200px] border border-primary-400/20">
          <div className="relative">
            <Smartphone className="w-14 h-14 text-primary-400" style={{ transform: 'rotate(90deg)' }} />
          </div>
          <div>
            <p className="text-white font-bold text-lg">Rotate to Landscape</p>
            <p className="text-gray-400 text-sm mt-1">
              Hold your phone sideways for binocular training
            </p>
          </div>
        </div>
      )}

      {/* Main layout (landscape on phone, always on desktop) */}
      <div className={`${deviceMode === 'phone' ? 'hidden landscape:flex' : 'flex'} flex-col gap-2`}>
        {/* Distance complete prompt */}
        {showDistancePrompt && (
          <div className="bg-green-50 border border-green-300 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <MoveHorizontal className="w-4 h-4 text-green-600" />
              <span className="text-green-600 font-bold text-sm">Chart Complete!</span>
            </div>
            <p className="text-gray-600 text-xs mb-2">Move screen a finger-width further away</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => handleDistanceAdjust('further')}
                className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold text-sm"
              >
                Move Further
              </button>
              <button
                onClick={() => { setShowDistancePrompt(false); regenerateChart() }}
                className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm"
              >
                Stay
              </button>
            </div>
          </div>
        )}

        {/* Chart + buttons layout — buttons always on SIDES for both modes */}
        {!showDistancePrompt && (
          <div className="flex items-stretch gap-1.5">
            {/* Left button column */}
            <div className="flex flex-col justify-around shrink-0 gap-2 py-1">
              {exerciseType === 'e-directional' ? (
                <>
                  <button
                    onClick={() => handleDirectionAnswer('up')}
                    className={`${btnClass} ${btnSize}`}
                  >
                    <ArrowUp className={iconSize} strokeWidth={2.5} />
                    Up
                  </button>
                  <button
                    onClick={() => handleDirectionAnswer('left')}
                    className={`${btnClass} ${btnSize}`}
                  >
                    <ArrowLeft className={iconSize} strokeWidth={2.5} />
                    Left
                  </button>
                </>
              ) : (
                /* Letter mode: 2 choices on left side */
                <>
                  {letterChoices.slice(0, 2).map(letter => (
                    <button
                      key={letter}
                      onClick={() => handleLetterAnswer(letter)}
                      className={`${letterBtnClass} ${letterBtnSize}`}
                    >
                      {letter}
                    </button>
                  ))}
                </>
              )}
            </div>

            {/* Center: Two charts side by side */}
            <div
              className="flex-1 bg-white rounded-lg flex overflow-hidden"
              style={{
                padding: deviceMode === 'phone' ? '8px' : '16px',
                gap: deviceMode === 'phone' ? '8px' : '16px',
              }}
            >
              {renderChart('left')}
              <div className="w-px bg-gray-300 self-stretch shrink-0" />
              {renderChart('right')}
            </div>

            {/* Right button column */}
            <div className="flex flex-col justify-around shrink-0 gap-2 py-1">
              {exerciseType === 'e-directional' ? (
                <>
                  <button
                    onClick={() => handleDirectionAnswer('right')}
                    className={`${btnClass} ${btnSize}`}
                  >
                    Right
                    <ArrowRight className={iconSize} strokeWidth={2.5} />
                  </button>
                  <button
                    onClick={() => handleDirectionAnswer('down')}
                    className={`${btnClass} ${btnSize}`}
                  >
                    <ArrowDown className={iconSize} strokeWidth={2.5} />
                    Down
                  </button>
                </>
              ) : (
                /* Letter mode: 2 choices on right side */
                <>
                  {letterChoices.slice(2, 4).map(letter => (
                    <button
                      key={letter}
                      onClick={() => handleLetterAnswer(letter)}
                      className={`${letterBtnClass} ${letterBtnSize}`}
                    >
                      {letter}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1 mt-1">
          {CHART_LINES.map((_, idx) => (
            <div
              key={idx}
              className={`w-2 h-2 rounded-full transition-all ${
                idx < currentLineIndex ? 'bg-green-400'
                : idx === currentLineIndex ? 'bg-primary-500'
                : 'bg-gray-300'
              }`}
            />
          ))}
        </div>

        {/* Consecutive failure warning */}
        {consecutiveFailures >= 2 && (
          <div className="text-orange-500 text-xs text-center">
            One more miss resets chart
          </div>
        )}
      </div>
    </div>
  )
}
