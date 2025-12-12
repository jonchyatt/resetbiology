'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, MoveHorizontal } from 'lucide-react'

interface SnellenChartProps {
  chartSize: string // "20/20", "20/40", etc.
  exerciseType: 'letters' | 'e-directional'
  onAnswer: (correct: boolean) => void
  resetTrigger?: number // Changes when parent wants to generate new letter
  deviceMode?: 'phone' | 'desktop'
  // New props for line-by-line progression
  progressionMode?: 'single' | 'line-by-line'
  onChartComplete?: () => void
  onDistanceAdjust?: (direction: 'closer' | 'further') => void
}

// Chart lines from largest (top/easiest) to smallest (bottom/most challenging)
// NO medical notation - this is training, not diagnosis
const CHART_LINES = [
  { level: 1, label: 'Warm-up', scale: 5.0, letterCount: 1 },
  { level: 2, label: 'Easy', scale: 3.5, letterCount: 2 },
  { level: 3, label: 'Moderate', scale: 2.5, letterCount: 3 },
  { level: 4, label: 'Building', scale: 2.0, letterCount: 4 },
  { level: 5, label: 'Challenge', scale: 1.6, letterCount: 5 },
  { level: 6, label: 'Advanced', scale: 1.3, letterCount: 5 },
  { level: 7, label: 'Peak', scale: 1.0, letterCount: 6 },
]

const E_DIRECTIONS = ['up', 'down', 'left', 'right'] as const
type EDirection = typeof E_DIRECTIONS[number]

// SVG Tumbling E with proper Snellen proportions (5x5 grid with extended horizontal bars)
// The horizontal bars (legs) are longer than standard font E
const TumblingE = ({ direction, size }: { direction: EDirection; size: number }) => {
  const rotationMap: Record<EDirection, number> = {
    right: 0,
    down: 90,
    left: 180,
    up: 270
  }

  // The E is designed on a 5x5 grid for proper Snellen proportions
  // Horizontal bars are full width (5 units), vertical bar is 1 unit wide
  // This creates the "longer legs" characteristic of proper optotypes
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 50 50"
      style={{ transform: `rotate(${rotationMap[direction]}deg)` }}
      className="transition-transform duration-200"
    >
      {/* Black E shape with extended horizontal bars */}
      <g fill="black">
        {/* Vertical bar (spine) */}
        <rect x="5" y="5" width="10" height="40" />
        {/* Top horizontal bar (leg) */}
        <rect x="5" y="5" width="40" height="10" />
        {/* Middle horizontal bar (leg) */}
        <rect x="5" y="20" width="35" height="10" />
        {/* Bottom horizontal bar (leg) */}
        <rect x="5" y="35" width="40" height="10" />
      </g>
    </svg>
  )
}

// Generate random E directions for a chart line
const generateLineDirections = (count: number): EDirection[] => {
  return Array.from({ length: count }, () =>
    E_DIRECTIONS[Math.floor(Math.random() * E_DIRECTIONS.length)]
  )
}

// Generate full chart data
const generateChartData = () => {
  return CHART_LINES.map(line => ({
    ...line,
    directions: generateLineDirections(line.letterCount)
  }))
}

export default function SnellenChart({
  chartSize,
  exerciseType,
  onAnswer,
  resetTrigger = 0,
  deviceMode = 'phone',
  progressionMode = 'line-by-line',
  onChartComplete,
  onDistanceAdjust
}: SnellenChartProps) {
  // Chart state
  const [chartData, setChartData] = useState(generateChartData)
  const [currentLineIndex, setCurrentLineIndex] = useState(0)
  const [currentLetterIndex, setCurrentLetterIndex] = useState(0)
  const [consecutiveFailures, setConsecutiveFailures] = useState(0)
  const [showRestPrompt, setShowRestPrompt] = useState(false)
  const [showDistancePrompt, setShowDistancePrompt] = useState(false)
  const [lineCompleted, setLineCompleted] = useState(false)

  // Single letter mode state (for backwards compatibility)
  const [singleDirection, setSingleDirection] = useState<EDirection>(() =>
    E_DIRECTIONS[Math.floor(Math.random() * E_DIRECTIONS.length)]
  )

  // Reset chart when resetTrigger changes
  useEffect(() => {
    if (progressionMode === 'single') {
      setSingleDirection(E_DIRECTIONS[Math.floor(Math.random() * E_DIRECTIONS.length)])
    }
  }, [resetTrigger, progressionMode])

  // Generate new chart
  const regenerateChart = useCallback(() => {
    setChartData(generateChartData())
    setCurrentLineIndex(0)
    setCurrentLetterIndex(0)
    setConsecutiveFailures(0)
    setLineCompleted(false)
  }, [])

  // Handle answer in line-by-line mode
  const handleLineByLineAnswer = (selectedDirection: EDirection) => {
    const currentLine = chartData[currentLineIndex]
    const correctDirection = currentLine.directions[currentLetterIndex]
    const isCorrect = selectedDirection === correctDirection

    onAnswer(isCorrect)

    if (isCorrect) {
      setConsecutiveFailures(0)

      // Move to next letter in line
      if (currentLetterIndex < currentLine.letterCount - 1) {
        setCurrentLetterIndex(prev => prev + 1)
      } else {
        // Completed this line!
        setLineCompleted(true)

        // Check if this was the last line
        if (currentLineIndex >= CHART_LINES.length - 1) {
          // Chart complete! Prompt to move screen further
          setShowDistancePrompt(true)
          if (onChartComplete) onChartComplete()
        } else {
          // Show rest prompt before next line (like resting between bench press sets)
          setShowRestPrompt(true)
        }
      }
    } else {
      // Wrong answer
      setConsecutiveFailures(prev => prev + 1)

      // After 3 consecutive failures, reset to new chart
      if (consecutiveFailures >= 2) {
        speak('Let\'s try a fresh chart. Take a breath.')
        setTimeout(() => {
          regenerateChart()
        }, 2000)
      }
    }
  }

  // Move to next line after rest
  const continueToNextLine = () => {
    setShowRestPrompt(false)
    setLineCompleted(false)
    setCurrentLineIndex(prev => prev + 1)
    setCurrentLetterIndex(0)
  }

  // Handle distance adjustment - TINY increments like adding 2.5lb plates
  const handleDistanceAdjust = (direction: 'closer' | 'further') => {
    setShowDistancePrompt(false)
    regenerateChart()
    if (onDistanceAdjust) onDistanceAdjust(direction)
    speak(direction === 'further'
      ? 'Move your screen just a finger-width further. Tiny steps build strength!'
      : 'Move your screen slightly closer.')
  }

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1.0
      utterance.pitch = 1.0
      window.speechSynthesis.speak(utterance)
    }
  }

  // Get base size for E based on device
  const getBaseSize = () => {
    return deviceMode === 'phone' ? 60 : 80
  }

  // Single letter mode (backwards compatible)
  if (progressionMode === 'single') {
    // Size multipliers by training level label
    const LEVEL_SIZES: Record<string, number> = {
      'Warm-up': 4,
      'Foundation': 3,
      'Easy': 2.5,
      'Building': 2,
      'Moderate': 1.75,
      'Challenge': 1.5,
      'Advanced': 1.25,
      'Expert': 1,
      'Peak': 0.75
    }
    const sizeMultiplier = LEVEL_SIZES[chartSize] || 1
    const baseSize = getBaseSize()

    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-lg p-8">
        <div className="text-gray-600 text-sm mb-4 font-semibold">{chartSize} Level</div>

        <div className="mb-8 select-none">
          {exerciseType === 'e-directional' ? (
            <TumblingE direction={singleDirection} size={baseSize * sizeMultiplier} />
          ) : (
            <div
              className="font-mono font-black"
              style={{
                fontSize: `${4 * sizeMultiplier}rem`,
                lineHeight: 1,
                color: '#000000',
              }}
            >
              E
            </div>
          )}
        </div>

        {/* Direction buttons */}
        <DirectionButtons
          onSelect={(dir) => {
            onAnswer(dir === singleDirection)
            setSingleDirection(E_DIRECTIONS[Math.floor(Math.random() * E_DIRECTIONS.length)])
          }}
        />
      </div>
    )
  }

  // Line-by-line progression mode
  const currentLine = chartData[currentLineIndex]
  const baseSize = getBaseSize()

  return (
    <div className="flex flex-col items-center bg-white rounded-lg p-4 md:p-8">
      {/* Full chart display */}
      <div className="w-full max-w-2xl space-y-4 mb-6">
        {chartData.map((line, lineIdx) => (
          <div
            key={lineIdx}
            className={`flex items-center justify-center gap-2 md:gap-4 transition-all duration-300 ${
              lineIdx < currentLineIndex
                ? 'opacity-30' // Completed lines fade
                : lineIdx === currentLineIndex
                  ? 'opacity-100' // Current line highlighted
                  : 'opacity-50' // Future lines dimmed
            }`}
          >
            {line.directions.map((dir, letterIdx) => {
              const isCurrentLetter = lineIdx === currentLineIndex && letterIdx === currentLetterIndex
              const isPastLetter = lineIdx === currentLineIndex && letterIdx < currentLetterIndex

              return (
                <div
                  key={letterIdx}
                  className="relative flex flex-col items-center"
                >
                  {/* The E optotype */}
                  <div className={`transition-all duration-200 ${
                    isPastLetter ? 'opacity-30' : ''
                  }`}>
                    <TumblingE
                      direction={dir}
                      size={baseSize * line.scale * (deviceMode === 'phone' ? 0.6 : 1)}
                    />
                  </div>

                  {/* Arrow pointer under current letter */}
                  {isCurrentLetter && !lineCompleted && (
                    <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 animate-bounce">
                      <ChevronDown className="w-6 h-6 text-primary-500" strokeWidth={3} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Rest prompt between lines */}
      {showRestPrompt && (
        <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-400/40 rounded-lg p-6 mb-6 text-center animate-fade-in">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
            <span className="text-green-400 font-semibold">Line Complete!</span>
          </div>
          <p className="text-gray-700 mb-4">
            Great work! Rest your eyes for a moment.
            <br />
            <span className="text-sm text-gray-500">Like finishing a set - let the muscles relax.</span>
          </p>
          <button
            onClick={continueToNextLine}
            className="px-8 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-semibold transition-all flex items-center gap-2 mx-auto"
          >
            Continue to Line {currentLineIndex + 2}
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Distance adjustment prompt after completing chart */}
      {showDistancePrompt && (
        <div className="bg-gradient-to-r from-secondary-500/20 to-primary-500/20 border border-secondary-400/40 rounded-lg p-6 mb-6 animate-fade-in">
          <div className="flex items-center justify-center gap-2 mb-3">
            <MoveHorizontal className="w-6 h-6 text-secondary-400" />
            <span className="text-secondary-400 font-bold text-lg">Chart Complete!</span>
          </div>
          <p className="text-gray-700 text-center mb-2">
            Excellent! You've completed all lines.
          </p>
          <p className="text-gray-600 text-sm text-center mb-4">
            <strong>Tiny adjustments build strength!</strong>
            <br />
            Move your screen just a finger-width further away.
            <br />
            <span className="text-xs text-gray-500">Like adding 2.5lb plates to a barbell - small steps, big gains over time.</span>
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => handleDistanceAdjust('further')}
              className="px-6 py-3 bg-secondary-500 hover:bg-secondary-600 text-white rounded-lg font-semibold transition-all flex items-center gap-2"
            >
              <ArrowRight className="w-5 h-5" />
              Move Further & Continue
            </button>
            <button
              onClick={() => {
                setShowDistancePrompt(false)
                regenerateChart()
              }}
              className="px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-all"
            >
              Stay Here
            </button>
          </div>
        </div>
      )}

      {/* Direction input buttons */}
      {!showRestPrompt && !showDistancePrompt && (
        <div className="mt-4">
          <p className="text-gray-600 text-sm text-center mb-4">
            Which way is the E pointing? (Line {currentLineIndex + 1}, Letter {currentLetterIndex + 1})
          </p>
          <DirectionButtons
            onSelect={handleLineByLineAnswer}
            highlightCurrent={true}
          />
        </div>
      )}

      {/* Progress indicator */}
      <div className="mt-6 flex items-center gap-2 text-sm text-gray-500">
        <span>Progress:</span>
        <div className="flex gap-1">
          {CHART_LINES.map((_, idx) => (
            <div
              key={idx}
              className={`w-3 h-3 rounded-full transition-all ${
                idx < currentLineIndex
                  ? 'bg-secondary-400'
                  : idx === currentLineIndex
                    ? 'bg-primary-500 ring-2 ring-primary-300'
                    : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Consecutive failure warning */}
      {consecutiveFailures >= 2 && (
        <div className="mt-4 text-orange-600 text-sm text-center animate-pulse">
          Take your time. One more miss will reset to a new chart.
        </div>
      )}
    </div>
  )
}

// Direction buttons component
function DirectionButtons({
  onSelect,
  highlightCurrent = false
}: {
  onSelect: (dir: EDirection) => void
  highlightCurrent?: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      {/* Up button */}
      <button
        onClick={() => onSelect('up')}
        className="bg-gray-900 hover:bg-primary-500 text-white font-bold py-3 px-8 rounded-lg transition-all transform hover:scale-105 flex items-center gap-2"
      >
        <ArrowUp className="w-5 h-5" />
        Up
      </button>

      {/* Left and Right buttons */}
      <div className="flex gap-4">
        <button
          onClick={() => onSelect('left')}
          className="bg-gray-900 hover:bg-primary-500 text-white font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-105 flex items-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          Left
        </button>
        <button
          onClick={() => onSelect('right')}
          className="bg-gray-900 hover:bg-primary-500 text-white font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-105 flex items-center gap-2"
        >
          Right
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>

      {/* Down button */}
      <button
        onClick={() => onSelect('down')}
        className="bg-gray-900 hover:bg-primary-500 text-white font-bold py-3 px-8 rounded-lg transition-all transform hover:scale-105 flex items-center gap-2"
      >
        <ArrowDown className="w-5 h-5" />
        Down
      </button>
    </div>
  )
}
