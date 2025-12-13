'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronDown, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, MoveHorizontal, Mic, MicOff } from 'lucide-react'

// TypeScript declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
  isFinal: boolean
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

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

// Confusable letters for letter chart mode - letters that look similar and challenge focus
// Groups: O/Q/C/D, H/M/N, K/X, R/B, S/Z, V/W
const CONFUSABLE_LETTERS = ['O', 'Q', 'C', 'D', 'H', 'M', 'N', 'K', 'X', 'R', 'S', 'Z', 'V']

// Only show 4 letter choices at a time (like E chart has 4 directions)
const getLetterChoices = (correctLetter: string): string[] => {
  // Get 3 random distractors that aren't the correct letter
  const distractors = CONFUSABLE_LETTERS
    .filter(l => l !== correctLetter)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)

  // Combine and shuffle
  return [correctLetter, ...distractors].sort(() => Math.random() - 0.5)
}

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

// Generate random letters for a chart line using confusable letters
const generateLineLetters = (count: number): string[] => {
  return Array.from({ length: count }, () =>
    CONFUSABLE_LETTERS[Math.floor(Math.random() * CONFUSABLE_LETTERS.length)]
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
  const [showDistancePrompt, setShowDistancePrompt] = useState(false)

  // Visual feedback state - blinks green (correct) or red (incorrect)
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null)

  // Letter choices for current letter (4 options like E chart has 4 directions)
  const [letterChoices, setLetterChoices] = useState<string[]>([])

  // For tracking progression - start normal, progress to thin lines
  const [strokeWeight, setStrokeWeight] = useState<'bold' | 'normal' | 'thin'>('normal')

  // Voice recognition state (free - uses browser's built-in Web Speech API)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [lastHeard, setLastHeard] = useState<string>('')
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  // Single letter mode state (for backwards compatibility)
  const [singleDirection, setSingleDirection] = useState<EDirection>(() =>
    E_DIRECTIONS[Math.floor(Math.random() * E_DIRECTIONS.length)]
  )
  const [singleLetter, setSingleLetter] = useState<string>(() =>
    CONFUSABLE_LETTERS[Math.floor(Math.random() * CONFUSABLE_LETTERS.length)]
  )
  const [singleLetterChoices, setSingleLetterChoices] = useState<string[]>(() =>
    getLetterChoices(CONFUSABLE_LETTERS[Math.floor(Math.random() * CONFUSABLE_LETTERS.length)])
  )

  // Reset chart when resetTrigger or exerciseType changes
  useEffect(() => {
    if (progressionMode === 'single') {
      setSingleDirection(E_DIRECTIONS[Math.floor(Math.random() * E_DIRECTIONS.length)])
      const newLetter = CONFUSABLE_LETTERS[Math.floor(Math.random() * CONFUSABLE_LETTERS.length)]
      setSingleLetter(newLetter)
      setSingleLetterChoices(getLetterChoices(newLetter))
    }
  }, [resetTrigger, progressionMode])

  // Regenerate chart when exerciseType changes
  useEffect(() => {
    setChartData(generateChartData(exerciseType))
    setCurrentLineIndex(0)
    setCurrentLetterIndex(0)
  }, [exerciseType])

  // Generate new letter choices when current letter changes
  useEffect(() => {
    if (exerciseType === 'letters' && chartData[currentLineIndex]) {
      const correctLetter = chartData[currentLineIndex].letters[currentLetterIndex]
      if (correctLetter) {
        setLetterChoices(getLetterChoices(correctLetter))
      }
    }
  }, [exerciseType, currentLineIndex, currentLetterIndex, chartData])

  // Clear feedback after brief display
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 400)
      return () => clearTimeout(timer)
    }
  }, [feedback])

  // Check if voice recognition is supported and set it up
  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognitionAPI) {
      setVoiceSupported(true)
      recognitionRef.current = new SpeechRecognitionAPI()
      recognitionRef.current.continuous = true
      recognitionRef.current.interimResults = true
      recognitionRef.current.lang = 'en-US'
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [])

  // Handle voice recognition results
  useEffect(() => {
    if (!recognitionRef.current || !voiceEnabled || exerciseType !== 'letters') return

    const recognition = recognitionRef.current

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const lastResult = event.results[event.results.length - 1]
      const transcript = lastResult[0].transcript.trim().toUpperCase()

      // Get the last spoken letter (in case they said multiple)
      const spokenLetter = transcript.slice(-1)
      setLastHeard(spokenLetter)

      // Only process final results
      if (lastResult.isFinal) {
        // Check if the spoken letter matches any of the choices
        const currentLine = chartData[currentLineIndex]
        if (currentLine) {
          const correctLetter = currentLine.letters[currentLetterIndex]

          // Check if they said a letter that's in the choices
          if (letterChoices.includes(spokenLetter)) {
            handleLetterAnswer(spokenLetter)
          } else if (CONFUSABLE_LETTERS.includes(spokenLetter)) {
            // They said a valid letter but it's not in the choices - treat as wrong
            handleLetterAnswer(spokenLetter)
          }
        }
      }
    }

    recognition.onerror = (event) => {
      console.log('Speech recognition error:', event)
      setIsListening(false)
    }

    recognition.onend = () => {
      // Auto-restart if voice is still enabled
      if (voiceEnabled && exerciseType === 'letters') {
        try {
          recognition.start()
        } catch (e) {
          // Already started or other error
        }
      } else {
        setIsListening(false)
      }
    }

    recognition.onstart = () => {
      setIsListening(true)
    }

    // Start listening if voice is enabled
    if (voiceEnabled) {
      try {
        recognition.start()
      } catch (e) {
        // May already be started
      }
    }

    return () => {
      try {
        recognition.stop()
      } catch (e) {
        // May not be running
      }
    }
  }, [voiceEnabled, exerciseType, chartData, currentLineIndex, currentLetterIndex, letterChoices])

  // Toggle voice recognition
  const toggleVoice = useCallback(() => {
    if (!recognitionRef.current) return

    if (voiceEnabled) {
      recognitionRef.current.stop()
      setVoiceEnabled(false)
      setIsListening(false)
      setLastHeard('')
    } else {
      setVoiceEnabled(true)
    }
  }, [voiceEnabled])

  // Generate new chart
  const regenerateChart = useCallback(() => {
    // Cancel any speech to prevent audio overlap
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setChartData(generateChartData(exerciseType))
    setCurrentLineIndex(0)
    setCurrentLetterIndex(0)
    setConsecutiveFailures(0)
  }, [exerciseType])

  // Handle answer in line-by-line mode
  const handleLineByLineAnswer = (selectedDirection: EDirection) => {
    const currentLine = chartData[currentLineIndex]
    const correctDirection = currentLine.directions[currentLetterIndex]
    const isCorrect = selectedDirection === correctDirection

    // Show visual feedback (green blink for correct, red for incorrect)
    setFeedback(isCorrect ? 'correct' : 'incorrect')
    onAnswer(isCorrect)

    if (isCorrect) {
      setConsecutiveFailures(0)

      // Delay briefly to show feedback, then advance
      setTimeout(() => {
        // Move to next letter in line
        if (currentLetterIndex < currentLine.letterCount - 1) {
          setCurrentLetterIndex(prev => prev + 1)
        } else {
          // Completed this line! Auto-advance to next line
          if (currentLineIndex >= CHART_LINES.length - 1) {
            setShowDistancePrompt(true)
            if (onChartComplete) onChartComplete()
          } else {
            setCurrentLineIndex(prev => prev + 1)
            setCurrentLetterIndex(0)
          }
        }
      }, 300)
    } else {
      // Wrong answer
      setConsecutiveFailures(prev => prev + 1)

      // After 3 consecutive failures, reset to new chart
      if (consecutiveFailures >= 2) {
        // Audio disabled for now - using visual feedback instead
        setTimeout(() => {
          regenerateChart()
        }, 1500)
      }
    }
  }

  // Handle answer for letter mode
  const handleLetterAnswer = (selectedLetter: string) => {
    const currentLine = chartData[currentLineIndex]
    const correctLetter = currentLine.letters[currentLetterIndex]
    const isCorrect = selectedLetter.toUpperCase() === correctLetter.toUpperCase()

    // Show visual feedback (green blink for correct, red for incorrect)
    setFeedback(isCorrect ? 'correct' : 'incorrect')
    onAnswer(isCorrect)

    if (isCorrect) {
      setConsecutiveFailures(0)

      // Delay briefly to show feedback, then advance
      setTimeout(() => {
        // Move to next letter in line
        if (currentLetterIndex < currentLine.letterCount - 1) {
          setCurrentLetterIndex(prev => prev + 1)
        } else {
          // Completed this line! Auto-advance to next line
          if (currentLineIndex >= CHART_LINES.length - 1) {
            setShowDistancePrompt(true)
            if (onChartComplete) onChartComplete()
          } else {
            setCurrentLineIndex(prev => prev + 1)
            setCurrentLetterIndex(0)
          }
        }
      }, 300)
    } else {
      // Wrong answer
      setConsecutiveFailures(prev => prev + 1)

      // After 3 consecutive failures, reset to new chart
      if (consecutiveFailures >= 2) {
        // Audio disabled for now - using visual feedback instead
        setTimeout(() => {
          regenerateChart()
        }, 1500)
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
      // Cancel any ongoing speech to prevent audio overlap/looping
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1.0
      utterance.pitch = 1.0
      window.speechSynthesis.speak(utterance)
    }
  }

  // Get base size for letters/E based on device - SMALLER test text, bigger buttons
  const getBaseSize = () => {
    return deviceMode === 'phone' ? 28 : 45
  }

  // Get feedback ring color class
  const getFeedbackClass = () => {
    if (feedback === 'correct') return 'ring-4 ring-green-500 animate-pulse'
    if (feedback === 'incorrect') return 'ring-4 ring-red-500 animate-pulse'
    return 'ring-2 ring-primary-400'
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
              const newLetter = CONFUSABLE_LETTERS[Math.floor(Math.random() * CONFUSABLE_LETTERS.length)]
              setSingleLetter(newLetter)
              setSingleLetterChoices(getLetterChoices(newLetter))
            }}
            choices={singleLetterChoices}
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
                    {isCurrentLetter && (
                      <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 z-10">
                        <ChevronDown className="w-5 h-5 text-primary-500 animate-bounce" strokeWidth={3} />
                      </div>
                    )}
                    {/* The E optotype */}
                    <div className={`transition-all duration-200 ${
                      isPastLetter ? 'opacity-20' : ''
                    } ${isCurrentLetter ? getFeedbackClass() + ' rounded-sm' : ''}`}>
                      <TumblingE
                        direction={dir}
                        size={baseSize * line.scale * (deviceMode === 'phone' ? 0.4 : 0.65)}
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
                    {isCurrentLetter && (
                      <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 z-10">
                        <ChevronDown className="w-5 h-5 text-primary-500 animate-bounce" strokeWidth={3} />
                      </div>
                    )}
                    {/* The letter */}
                    <div className={`transition-all duration-200 ${
                      isPastLetter ? 'opacity-20' : ''
                    } ${isCurrentLetter ? getFeedbackClass() + ' rounded-sm px-1' : ''}`}>
                      <SnellenLetter
                        letter={letter}
                        size={baseSize * line.scale * (deviceMode === 'phone' ? 0.4 : 0.65)}
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
      {!showDistancePrompt && (
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
            <div className="space-y-3">
              {/* Voice Control for Letters Mode */}
              {voiceSupported && (
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={toggleVoice}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                      voiceEnabled
                        ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                  >
                    {voiceEnabled ? (
                      <>
                        <Mic className={`w-5 h-5 ${isListening ? 'animate-pulse' : ''}`} />
                        Voice ON
                      </>
                    ) : (
                      <>
                        <MicOff className="w-5 h-5" />
                        Voice OFF
                      </>
                    )}
                  </button>
                  {isListening && lastHeard && (
                    <span className="text-sm text-gray-500">
                      Heard: <span className="font-bold text-primary-600">{lastHeard}</span>
                    </span>
                  )}
                </div>
              )}

              {/* Instructions when voice is on */}
              {voiceEnabled && isListening && (
                <p className="text-xs text-green-600 text-center">
                  🎤 Say the letter you see!
                </p>
              )}

              <LetterButtons
                onSelect={(letter) => handleLetterAnswer(letter)}
                choices={letterChoices}
                compact={deviceMode === 'phone'}
              />
            </div>
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

// Direction buttons component - LARGE buttons for easy tapping
function DirectionButtons({
  onSelect,
  compact = false
}: {
  onSelect: (dir: EDirection) => void
  compact?: boolean
}) {
  // MUCH bigger buttons - user emphasized buttons must be larger than test letters
  // Increased vertical height (py-6/py-7) for better tap targets
  const buttonBase = "bg-gray-900 hover:bg-primary-500 active:bg-primary-600 text-white font-bold rounded-xl transition-all transform active:scale-95 flex items-center justify-center shadow-lg"
  const buttonSize = compact
    ? "py-6 px-10 text-2xl min-w-[130px] min-h-[72px] gap-2"
    : "py-7 px-12 text-3xl min-w-[160px] min-h-[84px] gap-3"
  const iconSize = compact ? "w-7 h-7" : "w-9 h-9"

  return (
    <div className={`flex flex-col items-center ${compact ? 'gap-3' : 'gap-4'}`}>
      {/* Up button */}
      <button
        onClick={() => onSelect('up')}
        className={`${buttonBase} ${buttonSize}`}
      >
        <ArrowUp className={iconSize} strokeWidth={2.5} />
        Up
      </button>

      {/* Left and Right buttons */}
      <div className={`flex ${compact ? 'gap-4' : 'gap-6'}`}>
        <button
          onClick={() => onSelect('left')}
          className={`${buttonBase} ${buttonSize}`}
        >
          <ArrowLeft className={iconSize} strokeWidth={2.5} />
          Left
        </button>
        <button
          onClick={() => onSelect('right')}
          className={`${buttonBase} ${buttonSize}`}
        >
          Right
          <ArrowRight className={iconSize} strokeWidth={2.5} />
        </button>
      </div>

      {/* Down button */}
      <button
        onClick={() => onSelect('down')}
        className={`${buttonBase} ${buttonSize}`}
      >
        <ArrowDown className={iconSize} strokeWidth={2.5} />
        Down
      </button>
    </div>
  )
}

// Letter buttons component for letter chart mode - ONLY 4 CHOICES like E chart has 4 directions
function LetterButtons({
  onSelect,
  choices,
  compact = false
}: {
  onSelect: (letter: string) => void
  choices: string[] // 4 letter choices
  compact?: boolean
}) {
  // MUCH bigger buttons - same size as direction buttons
  const buttonBase = "bg-gray-900 hover:bg-primary-500 active:bg-primary-600 text-white font-black rounded-xl transition-all transform active:scale-95 flex items-center justify-center shadow-lg"
  const buttonSize = compact
    ? "py-4 px-6 text-3xl min-w-[80px] min-h-[64px]"
    : "py-5 px-8 text-4xl min-w-[100px] min-h-[72px]"

  // Display as 2x2 grid for 4 choices
  return (
    <div className={`grid grid-cols-2 ${compact ? 'gap-3' : 'gap-4'}`}>
      {choices.map((letter) => (
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
