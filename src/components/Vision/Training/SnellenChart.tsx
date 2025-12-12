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

// Chart lines - REMOVED top 2 rows (too big to be useful)
// Starting at Moderate level, progressing to finer lines
// NO medical notation - this is training, not diagnosis
const CHART_LINES = [
  { level: 1, label: 'Moderate', scale: 2.0, letterCount: 3 },
  { level: 2, label: 'Building', scale: 1.6, letterCount: 4 },
  { level: 3, label: 'Challenge', scale: 1.3, letterCount: 5 },
  { level: 4, label: 'Advanced', scale: 1.0, letterCount: 5 },
  { level: 5, label: 'Peak', scale: 0.8, letterCount: 6 },
]

// Letters for the letter chart mode (standard Snellen letters)
const SNELLEN_LETTERS = ['C', 'D', 'E', 'F', 'L', 'O', 'P', 'T', 'Z']

const E_DIRECTIONS = ['up', 'down', 'left', 'right'] as const
type EDirection = typeof E_DIRECTIONS[number]

// SVG Tumbling E with proper Snellen proportions (5x5 grid with extended horizontal bars)
// The horizontal bars (legs) are longer than standard font E
// strokeWeight: 'bold' (default) or 'thin' for finer lines = better focus workout
const TumblingE = ({ direction, size, strokeWeight = 'normal' }: { direction: EDirection; size: number; strokeWeight?: 'bold' | 'normal' | 'thin' }) => {
  const rotationMap: Record<EDirection, number> = {
    right: 0,
    down: 90,
    left: 180,
    up: 270
  }

  // Stroke thickness based on weight - thinner = more challenging focus
  const thickness = strokeWeight === 'bold' ? 10 : strokeWeight === 'thin' ? 5 : 7

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
      {/* E shape - thickness varies by strokeWeight */}
      <g fill="black">
        {/* Vertical bar (spine) */}
        <rect x="5" y="5" width={thickness} height="40" />
        {/* Top horizontal bar (leg) */}
        <rect x="5" y="5" width="40" height={thickness} />
        {/* Middle horizontal bar (leg) */}
        <rect x="5" y={25 - thickness/2} width="35" height={thickness} />
        {/* Bottom horizontal bar (leg) */}
        <rect x="5" y={45 - thickness} width="40" height={thickness} />
      </g>
    </svg>
  )
}

// Single Snellen letter with adjustable stroke weight
const SnellenLetter = ({ letter, size, strokeWeight = 'normal' }: { letter: string; size: number; strokeWeight?: 'bold' | 'normal' | 'thin' }) => {
  // Font weight based on strokeWeight
  const fontWeight = strokeWeight === 'bold' ? 900 : strokeWeight === 'thin' ? 300 : 500

  return (
    <div
      className="font-sans select-none"
      style={{
        fontSize: `${size * 0.8}px`,
        lineHeight: 1,
        color: '#000000',
        fontWeight,
        letterSpacing: '0.02em',
      }}
    >
      {letter}
    </div>
  )
}

// Generate random E directions for a chart line
const generateLineDirections = (count: number): EDirection[] => {
  return Array.from({ length: count }, () =>
    E_DIRECTIONS[Math.floor(Math.random() * E_DIRECTIONS.length)]
  )
}

// Generate random letters for a chart line
const generateLineLetters = (count: number): string[] => {
  return Array.from({ length: count }, () =>
    SNELLEN_LETTERS[Math.floor(Math.random() * SNELLEN_LETTERS.length)]
  )
}

// Generate full chart data with both E directions and letters
const generateChartData = (exerciseType: 'letters' | 'e-directional') => {
  return CHART_LINES.map(line => ({
    ...line,
    directions: generateLineDirections(line.letterCount),
    letters: generateLineLetters(line.letterCount)
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
  const [chartData, setChartData] = useState(() => generateChartData(exerciseType))
  const [currentLineIndex, setCurrentLineIndex] = useState(0)
  const [currentLetterIndex, setCurrentLetterIndex] = useState(0)
  const [consecutiveFailures, setConsecutiveFailures] = useState(0)
  const [showRestPrompt, setShowRestPrompt] = useState(false)
  const [showDistancePrompt, setShowDistancePrompt] = useState(false)
  const [lineCompleted, setLineCompleted] = useState(false)

  // For tracking progression - start normal, progress to thin lines
  const [strokeWeight, setStrokeWeight] = useState<'bold' | 'normal' | 'thin'>('normal')

  // Single letter mode state (for backwards compatibility)
  const [singleDirection, setSingleDirection] = useState<EDirection>(() =>
    E_DIRECTIONS[Math.floor(Math.random() * E_DIRECTIONS.length)]
  )
  const [singleLetter, setSingleLetter] = useState<string>(() =>
    SNELLEN_LETTERS[Math.floor(Math.random() * SNELLEN_LETTERS.length)]
  )

  // Reset chart when resetTrigger or exerciseType changes
  useEffect(() => {
    if (progressionMode === 'single') {
      setSingleDirection(E_DIRECTIONS[Math.floor(Math.random() * E_DIRECTIONS.length)])
      setSingleLetter(SNELLEN_LETTERS[Math.floor(Math.random() * SNELLEN_LETTERS.length)])
    }
  }, [resetTrigger, progressionMode])

  // Regenerate chart when exerciseType changes
  useEffect(() => {
    setChartData(generateChartData(exerciseType))
    setCurrentLineIndex(0)
    setCurrentLetterIndex(0)
  }, [exerciseType])

  // Generate new chart
  const regenerateChart = useCallback(() => {
    setChartData(generateChartData(exerciseType))
    setCurrentLineIndex(0)
    setCurrentLetterIndex(0)
    setConsecutiveFailures(0)
    setLineCompleted(false)
  }, [exerciseType])

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

  // Handle answer for letter mode
  const handleLetterAnswer = (selectedLetter: string) => {
    const currentLine = chartData[currentLineIndex]
    const correctLetter = currentLine.letters[currentLetterIndex]
    const isCorrect = selectedLetter.toUpperCase() === correctLetter.toUpperCase()

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
          // Show rest prompt before next line
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

  // Get base size for letters/E based on device - SHRUNK to fit buttons on screen
  const getBaseSize = () => {
    return deviceMode === 'phone' ? 40 : 60
  }

  // Single letter mode (backwards compatible)
  if (progressionMode === 'single') {
    // Size multipliers by training level label
    const LEVEL_SIZES: Record<string, number> = {
      'Warm-up': 3,
      'Foundation': 2.5,
      'Easy': 2,
      'Building': 1.75,
      'Moderate': 1.5,
      'Challenge': 1.25,
      'Advanced': 1,
      'Expert': 0.85,
      'Peak': 0.7
    }
    const sizeMultiplier = LEVEL_SIZES[chartSize] || 1
    const baseSize = getBaseSize()

    return (
      <div className="flex flex-col items-center bg-white rounded-lg p-4">
        <div className="text-gray-500 text-xs mb-2">{chartSize} Level</div>

        <div className="mb-4 select-none">
          {exerciseType === 'e-directional' ? (
            <TumblingE direction={singleDirection} size={baseSize * sizeMultiplier} strokeWeight={strokeWeight} />
          ) : (
            <SnellenLetter letter={singleLetter} size={baseSize * sizeMultiplier} strokeWeight={strokeWeight} />
          )}
        </div>

        {/* Direction buttons for E, Letter buttons for letters */}
        {exerciseType === 'e-directional' ? (
          <DirectionButtons
            onSelect={(dir) => {
              onAnswer(dir === singleDirection)
              setSingleDirection(E_DIRECTIONS[Math.floor(Math.random() * E_DIRECTIONS.length)])
            }}
            compact={deviceMode === 'phone'}
          />
        ) : (
          <LetterButtons
            onSelect={(letter) => {
              onAnswer(letter === singleLetter)
              setSingleLetter(SNELLEN_LETTERS[Math.floor(Math.random() * SNELLEN_LETTERS.length)])
            }}
            targetLetter={singleLetter}
            compact={deviceMode === 'phone'}
          />
        )}
      </div>
    )
  }

  // Line-by-line progression mode
  const currentLine = chartData[currentLineIndex]
  const baseSize = getBaseSize()

  // Determine stroke weight based on progression (gets thinner as you advance)
  const getLineStrokeWeight = (lineIdx: number): 'bold' | 'normal' | 'thin' => {
    if (lineIdx <= 1) return 'normal'
    if (lineIdx <= 3) return 'normal'
    return 'thin' // Peak lines have thin strokes for extra challenge
  }

  return (
    <div className="flex flex-col items-center bg-white rounded-lg p-2">
      {/* Compact chart display */}
      <div className="w-full max-w-xl space-y-1 mb-2">
        {chartData.map((line, lineIdx) => (
          <div
            key={lineIdx}
            className={`flex items-center justify-center gap-1 md:gap-2 transition-all duration-300 ${
              lineIdx < currentLineIndex
                ? 'opacity-20' // Completed lines fade more
                : lineIdx === currentLineIndex
                  ? 'opacity-100' // Current line highlighted
                  : 'opacity-40' // Future lines dimmed
            }`}
          >
            {exerciseType === 'e-directional' ? (
              // E chart mode
              line.directions.map((dir, letterIdx) => {
                const isCurrentLetter = lineIdx === currentLineIndex && letterIdx === currentLetterIndex
                const isPastLetter = lineIdx === currentLineIndex && letterIdx < currentLetterIndex

                return (
                  <div
                    key={letterIdx}
                    className="relative flex flex-col items-center"
                  >
                    {/* Arrow pointer ABOVE current letter */}
                    {isCurrentLetter && !lineCompleted && (
                      <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 z-10">
                        <ChevronDown className="w-5 h-5 text-primary-500 animate-bounce" strokeWidth={3} />
                      </div>
                    )}
                    {/* The E optotype */}
                    <div className={`transition-all duration-200 ${
                      isPastLetter ? 'opacity-20' : ''
                    } ${isCurrentLetter && !lineCompleted ? 'ring-2 ring-primary-400 rounded-sm' : ''}`}>
                      <TumblingE
                        direction={dir}
                        size={baseSize * line.scale * (deviceMode === 'phone' ? 0.5 : 0.8)}
                        strokeWeight={getLineStrokeWeight(lineIdx)}
                      />
                    </div>
                  </div>
                )
              })
            ) : (
              // Letter chart mode
              line.letters.map((letter, letterIdx) => {
                const isCurrentLetter = lineIdx === currentLineIndex && letterIdx === currentLetterIndex
                const isPastLetter = lineIdx === currentLineIndex && letterIdx < currentLetterIndex

                return (
                  <div
                    key={letterIdx}
                    className="relative flex flex-col items-center"
                  >
                    {/* Arrow pointer ABOVE current letter */}
                    {isCurrentLetter && !lineCompleted && (
                      <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 z-10">
                        <ChevronDown className="w-5 h-5 text-primary-500 animate-bounce" strokeWidth={3} />
                      </div>
                    )}
                    {/* The letter */}
                    <div className={`transition-all duration-200 ${
                      isPastLetter ? 'opacity-20' : ''
                    } ${isCurrentLetter && !lineCompleted ? 'ring-2 ring-primary-400 rounded-sm px-1' : ''}`}>
                      <SnellenLetter
                        letter={letter}
                        size={baseSize * line.scale * (deviceMode === 'phone' ? 0.5 : 0.8)}
                        strokeWeight={getLineStrokeWeight(lineIdx)}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        ))}
      </div>

      {/* Rest prompt between lines - COMPACT */}
      {showRestPrompt && (
        <div className="bg-blue-50 border border-blue-300 rounded-lg p-3 mb-2 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-green-600 font-semibold text-sm">Line Complete!</span>
          </div>
          <button
            onClick={continueToNextLine}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-semibold text-sm transition-all"
          >
            Next Line →
          </button>
        </div>
      )}

      {/* Distance adjustment prompt after completing chart - COMPACT */}
      {showDistancePrompt && (
        <div className="bg-green-50 border border-green-300 rounded-lg p-3 mb-2 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <MoveHorizontal className="w-4 h-4 text-green-600" />
            <span className="text-green-600 font-bold text-sm">Chart Complete!</span>
          </div>
          <p className="text-gray-600 text-xs mb-2">
            Move screen a finger-width further away
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => handleDistanceAdjust('further')}
              className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold text-sm"
            >
              Move Further
            </button>
            <button
              onClick={() => {
                setShowDistancePrompt(false)
                regenerateChart()
              }}
              className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm"
            >
              Stay
            </button>
          </div>
        </div>
      )}

      {/* Input buttons - COMPACT and always visible */}
      {!showRestPrompt && !showDistancePrompt && (
        <div className="mt-1">
          <p className="text-gray-500 text-xs text-center mb-2">
            {exerciseType === 'e-directional' ? 'Which way?' : 'Which letter?'} (Line {currentLineIndex + 1}/{CHART_LINES.length})
          </p>
          {exerciseType === 'e-directional' ? (
            <DirectionButtons
              onSelect={handleLineByLineAnswer}
              compact={deviceMode === 'phone'}
            />
          ) : (
            <LetterButtons
              onSelect={(letter) => handleLetterAnswer(letter)}
              targetLetter={currentLine.letters[currentLetterIndex]}
              compact={deviceMode === 'phone'}
            />
          )}
        </div>
      )}

      {/* Progress indicator - COMPACT */}
      <div className="mt-2 flex items-center justify-center gap-1">
        {CHART_LINES.map((_, idx) => (
          <div
            key={idx}
            className={`w-2 h-2 rounded-full transition-all ${
              idx < currentLineIndex
                ? 'bg-green-400'
                : idx === currentLineIndex
                  ? 'bg-primary-500'
                  : 'bg-gray-300'
            }`}
          />
        ))}
      </div>

      {/* Consecutive failure warning */}
      {consecutiveFailures >= 2 && (
        <div className="mt-2 text-orange-500 text-xs text-center">
          One more miss resets chart
        </div>
      )}
    </div>
  )
}

// Direction buttons component - supports compact mode for mobile
function DirectionButtons({
  onSelect,
  compact = false
}: {
  onSelect: (dir: EDirection) => void
  compact?: boolean
}) {
  const buttonBase = "bg-gray-900 hover:bg-primary-500 active:bg-primary-600 text-white font-bold rounded-lg transition-all transform active:scale-95 flex items-center justify-center shadow-md"
  const buttonSize = compact ? "py-2 px-4 text-sm min-w-[70px] gap-1" : "py-3 px-6 text-base min-w-[100px] gap-2"
  const iconSize = compact ? "w-4 h-4" : "w-5 h-5"

  return (
    <div className={`flex flex-col items-center ${compact ? 'gap-2' : 'gap-3'}`}>
      {/* Up button */}
      <button
        onClick={() => onSelect('up')}
        className={`${buttonBase} ${buttonSize}`}
      >
        <ArrowUp className={iconSize} />
        Up
      </button>

      {/* Left and Right buttons */}
      <div className={`flex ${compact ? 'gap-3' : 'gap-4'}`}>
        <button
          onClick={() => onSelect('left')}
          className={`${buttonBase} ${buttonSize}`}
        >
          <ArrowLeft className={iconSize} />
          Left
        </button>
        <button
          onClick={() => onSelect('right')}
          className={`${buttonBase} ${buttonSize}`}
        >
          Right
          <ArrowRight className={iconSize} />
        </button>
      </div>

      {/* Down button */}
      <button
        onClick={() => onSelect('down')}
        className={`${buttonBase} ${buttonSize}`}
      >
        <ArrowDown className={iconSize} />
        Down
      </button>
    </div>
  )
}

// Letter buttons component for letter chart mode
function LetterButtons({
  onSelect,
  targetLetter,
  compact = false
}: {
  onSelect: (letter: string) => void
  targetLetter: string
  compact?: boolean
}) {
  const buttonBase = "bg-gray-900 hover:bg-primary-500 active:bg-primary-600 text-white font-bold rounded-lg transition-all transform active:scale-95 flex items-center justify-center shadow-md"
  const buttonSize = compact ? "py-2 px-3 text-sm min-w-[40px]" : "py-3 px-5 text-lg min-w-[50px]"

  return (
    <div className={`flex flex-wrap justify-center ${compact ? 'gap-1' : 'gap-2'} max-w-xs`}>
      {SNELLEN_LETTERS.map((letter) => (
        <button
          key={letter}
          onClick={() => onSelect(letter)}
          className={`${buttonBase} ${buttonSize}`}
        >
          {letter}
        </button>
      ))}
    </div>
  )
}
