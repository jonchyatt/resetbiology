'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronDown, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, MoveHorizontal, Mic, MicOff } from 'lucide-react'
import { WhisperService, type WhisperStatus } from '@/lib/speech'
import { SpeechQueue } from '@/lib/vision/audioKit'
import GaborPatch from './GaborPatch'
import GaborResponseCompass from './GaborResponseCompass'
import {
  DEFAULT_SCREEN_E_STYLE,
  SCREEN_E_CHART_STAGE_HEIGHT,
  SCREEN_E_DIRECTIONS,
  SCREEN_E_LINE_LETTER_COUNTS,
  SCREEN_E_LINE_MULTIPLIERS,
  parseScreenEDistanceChoice,
  screenEChartPosition,
  screenELineSize,
  screenEResponsePadLayout,
  screenEStyleRenderThickness,
  screenEStyleThickness,
  type ScreenEDistanceChoice,
  type ScreenEDirection,
  type ScreenEStyle,
} from '@/lib/vision/screenDirectionalE'
import {
  DEFAULT_SCREEN_PRACTICE_MODE,
  SCREEN_GABOR_CONTRAST,
  SCREEN_GABOR_FREQUENCY_CYCLES,
  SCREEN_GABOR_MEAN_GRAY,
  SCREEN_GABOR_RASTER_MODE,
  SCREEN_GABOR_SIGMA_RATIO,
  balancedScreenGaborChoices,
  parseScreenGaborChoice,
  resolveScreenPracticeMode,
  screenGaborLineSize,
  screenGaborManifestEntry,
  type ScreenGaborChoice,
  type ScreenPracticeMode,
} from '@/lib/vision/screenGaborPractice'

interface SnellenChartProps {
  chartSize: string
  exerciseType: 'letters' | 'e-directional'
  onAnswer: (correct: boolean) => void
  resetTrigger?: number // Changes when parent wants to generate new letter
  deviceMode?: 'phone' | 'desktop'
  // New props for line-by-line progression
  progressionMode?: 'single' | 'line-by-line'
  onChartComplete?: () => void
  onDistanceAdjust?: (direction: 'closer' | 'further') => void
  practiceMode?: ScreenPracticeMode
  screenEStyle?: ScreenEStyle
}

// Each row remains an additive part of the long chart. The shared scale is
// intentionally the same source used by the single-E reference check.
export const CHART_LINES = SCREEN_E_LINE_MULTIPLIERS.map((scale, index) => ({
  level: index + 1,
  label: `Detail ${index + 1}`,
  scale,
  letterCount: SCREEN_E_LINE_LETTER_COUNTS[index],
}))

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

export const E_DIRECTIONS = SCREEN_E_DIRECTIONS
export type EDirection = ScreenEDirection

// SVG Tumbling E with proper Snellen proportions (5x5 grid with extended horizontal bars)
// The horizontal bars (legs) are longer than standard font E
// strokeWeight: 'bold' (default) or 'thin' for finer lines = better focus workout
// animate=false for measurement contexts (SnellenQuickCheck): the 200ms rotation
// tween briefly shows ambiguous diagonal orientations and ignores reduced-motion.
export const TumblingE = ({ direction, size, strokeWeight = 'normal', screenEStyle, devicePixelRatio = 1, animate = true }: { direction: EDirection; size: number; strokeWeight?: 'bold' | 'normal' | 'thin'; screenEStyle?: ScreenEStyle; devicePixelRatio?: number; animate?: boolean }) => {
  const rotationMap: Record<EDirection, number> = {
    right: 0,
    down: 90,
    left: 180,
    up: 270
  }

  // Stroke thickness based on weight - thinner = more challenging focus
  const thickness = screenEStyle === undefined
    ? strokeWeight === 'bold' ? 10 : strokeWeight === 'thin' ? screenEStyleThickness('thin') : screenEStyleThickness(DEFAULT_SCREEN_E_STYLE)
    : screenEStyleRenderThickness(screenEStyle, size, devicePixelRatio)

  // The E is designed on a 5x5 grid for proper Snellen proportions
  // Horizontal bars are full width (5 units), vertical bar is 1 unit wide
  // This creates the "longer legs" characteristic of proper optotypes
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 50 50"
      shapeRendering="crispEdges"
      style={{ transform: `rotate(${rotationMap[direction]}deg)` }}
      className={animate ? 'transition-transform duration-200' : undefined}
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
export const generateLineDirections = (count: number): EDirection[] => {
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
    letters: generateLineLetters(line.letterCount),
    gaborChoices: balancedScreenGaborChoices(line.letterCount),
  }))
}

const RESPONSE_PAD_LAYOUT = screenEResponsePadLayout()

export default function SnellenChart({
  chartSize,
  exerciseType,
  onAnswer,
  resetTrigger = 0,
  deviceMode = 'phone',
  progressionMode = 'line-by-line',
  onChartComplete,
  onDistanceAdjust,
  practiceMode = DEFAULT_SCREEN_PRACTICE_MODE,
  screenEStyle = DEFAULT_SCREEN_E_STYLE,
}: SnellenChartProps) {
  const activePracticeMode = resolveScreenPracticeMode(practiceMode)
  const isGaborPractice = exerciseType === 'e-directional' && activePracticeMode === 'gabor'
  // Chart state
  const [chartData, setChartData] = useState(() => generateChartData(exerciseType))
  const [currentLineIndex, setCurrentLineIndex] = useState(0)
  const [currentLetterIndex, setCurrentLetterIndex] = useState(0)
  const [consecutiveFailures, setConsecutiveFailures] = useState(0)
  const [showDistancePrompt, setShowDistancePrompt] = useState(false)
  const [viewportWidth, setViewportWidth] = useState(390)
  const [viewportDevicePixelRatio, setViewportDevicePixelRatio] = useState(1)

  // Visual feedback state - blinks green (correct) or red (incorrect)
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null)

  // Letter choices for current letter (4 options like E chart has 4 directions)
  const [letterChoices, setLetterChoices] = useState<string[]>([])

  // For tracking progression - start normal, progress to thin lines
  const [strokeWeight, setStrokeWeight] = useState<'bold' | 'normal' | 'thin'>('normal')

  // Voice recognition state — model loads ON-DEMAND only when user taps Voice ON (no preload)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState<WhisperStatus>('idle')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [lastHeard, setLastHeard] = useState<string>('')

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
  const acceptingAnswerRef = useRef(true)
  const motionSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showDistancePromptRef = useRef(false)
  const distanceChoiceClaimedRef = useRef(false)
  const distanceChoiceActionRef = useRef<(choice: ScreenEDistanceChoice) => void>(() => {})
  showDistancePromptRef.current = showDistancePrompt

  // Voice-out seam (T5b) — same SpeechQueue instance SessionRunner/engines use,
  // so this legacy trainer speaks with the one educator voice.
  const speechRef = useRef<SpeechQueue | null>(null)
  useEffect(() => {
    speechRef.current = new SpeechQueue()
    return () => speechRef.current?.stop()
  }, [])

  useEffect(() => {
    const syncViewport = () => {
      setViewportWidth(window.innerWidth)
      setViewportDevicePixelRatio(window.devicePixelRatio || 1)
    }
    syncViewport()
    window.addEventListener('resize', syncViewport)
    return () => window.removeEventListener('resize', syncViewport)
  }, [])

  useEffect(() => () => {
    if (motionSettleTimerRef.current) clearTimeout(motionSettleTimerRef.current)
  }, [])

  // Reset chart when resetTrigger or exerciseType changes
  useEffect(() => {
    if (progressionMode === 'single') {
      setSingleDirection(E_DIRECTIONS[Math.floor(Math.random() * E_DIRECTIONS.length)])
      const newLetter = CONFUSABLE_LETTERS[Math.floor(Math.random() * CONFUSABLE_LETTERS.length)]
      setSingleLetter(newLetter)
      setSingleLetterChoices(getLetterChoices(newLetter))
    }
  }, [resetTrigger, progressionMode])

  // Regenerate chart when the exercise or its practice presentation changes.
  useEffect(() => {
    setChartData(generateChartData(exerciseType))
    setCurrentLineIndex(0)
    setCurrentLetterIndex(0)
  }, [exerciseType, activePracticeMode])

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

  // NO preload — model only loads when user taps "Voice ON"
  // This fixes the crash where the ~40MB model was downloading on every mount.

  // Start/stop Whisper voice recognition (on-demand only)
  useEffect(() => {
    if (!voiceEnabled) {
      WhisperService.stop()
      setIsSpeaking(false)
      setLastHeard('')
      return
    }

    const mode = exerciseType === 'e-directional' ? 'e-directional' : 'letters'

    WhisperService.start(mode, {
      onResult: (answer, rawTranscript) => {
        setLastHeard(rawTranscript.trim().split(/\s+/).pop() || '')
        if (showDistancePromptRef.current) {
          const distanceChoice = parseScreenEDistanceChoice(rawTranscript)
          if (distanceChoice) distanceChoiceActionRef.current(distanceChoice)
          return
        }
        if (isGaborPractice) {
          const gaborChoice = parseScreenGaborChoice(rawTranscript)
          if (gaborChoice) {
            window.dispatchEvent(new CustomEvent('voiceGaborChoice', { detail: gaborChoice }))
          }
          return
        }
        if (!answer) return

        if (answer.type === 'direction' && exerciseType === 'e-directional') {
          window.dispatchEvent(new CustomEvent('voiceDirection', { detail: answer.value }))
        } else if (answer.type === 'letter' && exerciseType === 'letters') {
          window.dispatchEvent(new CustomEvent('voiceLetter', { detail: answer.value }))
        }
      },
      onStatusChange: (status) => {
        setVoiceStatus(status)
        if (status === 'error') {
          setVoiceEnabled(false)
        }
      },
      onSpeechChange: (speaking) => {
        setIsSpeaking(speaking)
      },
    }).catch(() => {
      setVoiceEnabled(false)
    })

    return () => {
      WhisperService.stop()
    }
  }, [voiceEnabled, exerciseType, isGaborPractice])

  // Listen for voice direction events
  const handleLineByLineAnswerRef = useRef((..._args: Parameters<typeof handleLineByLineAnswer>) => {})
  const handleLetterAnswerRef = useRef((..._args: Parameters<typeof handleLetterAnswer>) => {})
  const handleGaborAnswerRef = useRef((..._args: Parameters<typeof handleGaborAnswer>) => {})

  // Refs updated after function definitions below (see after handleLetterAnswer)

  useEffect(() => {
    if (!voiceEnabled) return
    const handler = (e: Event) => {
      const direction = (e as CustomEvent).detail as EDirection
      if (direction && exerciseType === 'e-directional' && !isGaborPractice) {
        handleLineByLineAnswerRef.current(direction)
      }
    }
    window.addEventListener('voiceDirection', handler)
    return () => window.removeEventListener('voiceDirection', handler)
  }, [voiceEnabled, exerciseType, isGaborPractice])

  useEffect(() => {
    if (!voiceEnabled) return
    const handler = (e: Event) => {
      const choice = (e as CustomEvent).detail as ScreenGaborChoice
      if (choice && isGaborPractice) handleGaborAnswerRef.current(choice)
    }
    window.addEventListener('voiceGaborChoice', handler)
    return () => window.removeEventListener('voiceGaborChoice', handler)
  }, [voiceEnabled, isGaborPractice])

  useEffect(() => {
    if (!voiceEnabled) return
    const handler = (e: Event) => {
      const letter = (e as CustomEvent).detail as string
      if (letter && exerciseType === 'letters') {
        handleLetterAnswerRef.current(letter)
      }
    }
    window.addEventListener('voiceLetter', handler)
    return () => window.removeEventListener('voiceLetter', handler)
  }, [voiceEnabled, exerciseType])

  // Generate new chart
  const regenerateChart = useCallback(() => {
    // Cancel any speech to prevent audio overlap
    speechRef.current?.stop()
    setChartData(generateChartData(exerciseType))
    setCurrentLineIndex(0)
    setCurrentLetterIndex(0)
    setConsecutiveFailures(0)
    acceptingAnswerRef.current = true
  }, [exerciseType])

  const openDistancePrompt = useCallback(() => {
    distanceChoiceClaimedRef.current = false
    showDistancePromptRef.current = true
    setShowDistancePrompt(true)
    if (onChartComplete) onChartComplete()
  }, [onChartComplete])

  const settleChartMotion = (afterFeedback: () => boolean | void) => {
    motionSettleTimerRef.current = setTimeout(() => {
      const holdInputUntilReset = afterFeedback()
      if (holdInputUntilReset) return
      motionSettleTimerRef.current = setTimeout(() => {
        acceptingAnswerRef.current = true
      }, 320)
    }, 360)
  }

  // A single gate covers touch, keyboard, pointer, and the existing voice event
  // path. A new answer is accepted only after the marker/strip transition settles.
  const handleLineByLineAnswer = (selectedDirection: EDirection) => {
    if (!acceptingAnswerRef.current) return
    const currentLine = chartData[currentLineIndex]
    if (!currentLine) return
    acceptingAnswerRef.current = false

    const correctDirection = currentLine.directions[currentLetterIndex]
    const isCorrect = selectedDirection === correctDirection

    // Show visual feedback (green blink for correct, red for incorrect)
    setFeedback(isCorrect ? 'correct' : 'incorrect')
    onAnswer(isCorrect)

    if (isCorrect) {
      setConsecutiveFailures(0)

      settleChartMotion(() => {
        // Move to next letter in line
        if (currentLetterIndex < currentLine.letterCount - 1) {
          setCurrentLetterIndex(prev => prev + 1)
        } else {
          // Completed this line! Auto-advance to next line
          if (currentLineIndex >= CHART_LINES.length - 1) {
            openDistancePrompt()
          } else {
            setCurrentLineIndex(prev => prev + 1)
            setCurrentLetterIndex(0)
          }
        }
      })
    } else {
      // Wrong answer
      const shouldRegenerate = consecutiveFailures >= 2
      setConsecutiveFailures(prev => prev + 1)

      // After 3 consecutive failures, reset to new chart
      settleChartMotion(() => {
        if (!shouldRegenerate) return
        acceptingAnswerRef.current = false
        motionSettleTimerRef.current = setTimeout(() => {
          regenerateChart()
          acceptingAnswerRef.current = true
        }, 1100)
        return true
      })
    }
  }

  // Gabor touch and spoken-number answers use the same progression and the
  // same one-shot gate as the protected directional-E path.
  const handleGaborAnswer = (selectedChoice: ScreenGaborChoice) => {
    if (!acceptingAnswerRef.current) return
    const currentLine = chartData[currentLineIndex]
    if (!currentLine) return
    acceptingAnswerRef.current = false

    const correctChoice = currentLine.gaborChoices[currentLetterIndex]
    const isCorrect = selectedChoice === correctChoice
    setFeedback(isCorrect ? 'correct' : 'incorrect')
    onAnswer(isCorrect)

    if (isCorrect) {
      setConsecutiveFailures(0)
      settleChartMotion(() => {
        if (currentLetterIndex < currentLine.letterCount - 1) {
          setCurrentLetterIndex(prev => prev + 1)
        } else if (currentLineIndex >= CHART_LINES.length - 1) {
          openDistancePrompt()
        } else {
          setCurrentLineIndex(prev => prev + 1)
          setCurrentLetterIndex(0)
        }
      })
      return
    }

    const shouldRegenerate = consecutiveFailures >= 2
    setConsecutiveFailures(prev => prev + 1)
    settleChartMotion(() => {
      if (!shouldRegenerate) return
      acceptingAnswerRef.current = false
      motionSettleTimerRef.current = setTimeout(() => {
        regenerateChart()
        acceptingAnswerRef.current = true
      }, 1100)
      return true
    })
  }

  // Handle answer for letter mode
  const handleLetterAnswer = (selectedLetter: string) => {
    if (!acceptingAnswerRef.current) return
    const currentLine = chartData[currentLineIndex]
    if (!currentLine) return
    acceptingAnswerRef.current = false
    const correctLetter = currentLine.letters[currentLetterIndex]
    const isCorrect = selectedLetter.toUpperCase() === correctLetter.toUpperCase()

    // Show visual feedback (green blink for correct, red for incorrect)
    setFeedback(isCorrect ? 'correct' : 'incorrect')
    onAnswer(isCorrect)

    if (isCorrect) {
      setConsecutiveFailures(0)

      settleChartMotion(() => {
        // Move to next letter in line
        if (currentLetterIndex < currentLine.letterCount - 1) {
          setCurrentLetterIndex(prev => prev + 1)
        } else {
          // Completed this line! Auto-advance to next line
          if (currentLineIndex >= CHART_LINES.length - 1) {
            openDistancePrompt()
          } else {
            setCurrentLineIndex(prev => prev + 1)
            setCurrentLetterIndex(0)
          }
        }
      })
    } else {
      // Wrong answer
      const shouldRegenerate = consecutiveFailures >= 2
      setConsecutiveFailures(prev => prev + 1)

      // After 3 consecutive failures, reset to new chart
      settleChartMotion(() => {
        if (!shouldRegenerate) return
        acceptingAnswerRef.current = false
        motionSettleTimerRef.current = setTimeout(() => {
          regenerateChart()
          acceptingAnswerRef.current = true
        }, 1100)
        return true
      })
    }
  }

  // Keep refs in sync so voice event listeners always call latest versions
  handleLineByLineAnswerRef.current = handleLineByLineAnswer
  handleLetterAnswerRef.current = handleLetterAnswer
  handleGaborAnswerRef.current = handleGaborAnswer

  // Handle distance adjustment - TINY increments like adding 2.5lb plates
  const handleDistanceAdjust = (direction: 'closer' | 'further') => {
    setShowDistancePrompt(false)
    regenerateChart()
    if (onDistanceAdjust) onDistanceAdjust(direction)
    speak(direction === 'further'
      ? 'Move your screen just a finger-width further. Tiny steps build strength!'
      : 'Move your screen slightly closer.')
  }

  const handleDistanceChoice = (choice: ScreenEDistanceChoice) => {
    if (!showDistancePromptRef.current || distanceChoiceClaimedRef.current) return
    distanceChoiceClaimedRef.current = true
    showDistancePromptRef.current = false

    if (choice === 'further') {
      handleDistanceAdjust('further')
      return
    }
    setShowDistancePrompt(false)
    regenerateChart()
  }
  distanceChoiceActionRef.current = handleDistanceChoice

  const speak = (text: string) => {
    // interrupt: true preserves the old cancel-then-speak semantics
    speechRef.current?.speak(text, { interrupt: true })
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
    const singleGaborChoice = chartData[0]?.gaborChoices[0] ?? 1
    const singleGaborEntry = screenGaborManifestEntry(singleGaborChoice)
    const singleStimulusSize = baseSize * sizeMultiplier

    return (
      <div
        className={`flex flex-col items-center rounded-lg p-4 ${isGaborPractice ? 'bg-[#808080]' : 'bg-white'}`}
        data-screen-practice-mode={activePracticeMode}
      >
        <div className="text-gray-500 text-xs mb-2">{chartSize} Level</div>

        <div className="mb-4 select-none">
          {isGaborPractice ? (
            <GaborPatch
              size={singleStimulusSize}
              orientation={singleGaborEntry.orientationDegrees}
              frequency={SCREEN_GABOR_FREQUENCY_CYCLES}
              contrast={SCREEN_GABOR_CONTRAST}
              sigma={singleStimulusSize * SCREEN_GABOR_SIGMA_RATIO}
              backgroundColor={SCREEN_GABOR_MEAN_GRAY}
              rasterMode={SCREEN_GABOR_RASTER_MODE}
              animate={false}
            />
          ) : exerciseType === 'e-directional' ? (
            <TumblingE direction={singleDirection} size={baseSize * sizeMultiplier} screenEStyle={screenEStyle} devicePixelRatio={viewportDevicePixelRatio} />
          ) : (
            <SnellenLetter letter={singleLetter} size={baseSize * sizeMultiplier} strokeWeight={strokeWeight} />
          )}
        </div>

        {/* Direction buttons for E, Letter buttons for letters */}
        {isGaborPractice ? (
          <GaborResponseCompass
            onSelect={(choice) => {
              onAnswer(choice === singleGaborChoice)
              setChartData(generateChartData(exerciseType))
            }}
          />
        ) : exerciseType === 'e-directional' ? (
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
  const chartPosition = screenEChartPosition(
    viewportWidth,
    viewportDevicePixelRatio,
    currentLineIndex,
    chartData.length,
  )
  const activeLineSize = isGaborPractice
    ? screenGaborLineSize(viewportWidth, currentLineIndex, viewportDevicePixelRatio)
    : screenELineSize(viewportWidth, currentLineIndex, viewportDevicePixelRatio)
  const activeMarkerOffsetX = currentLine
    ? (currentLetterIndex - (currentLine.letterCount - 1) / 2) * (activeLineSize + 8)
    : 0

  // Keep every directional E at the same sturdy vector stroke so small rows
  // retain an open, recognizable direction rather than closing into a blob.
  const getLineStrokeWeight = (lineIdx: number): 'bold' | 'normal' | 'thin' => {
    void lineIdx
    return 'normal'
  }

  return (
    <div
      className={`flex flex-col items-center rounded-lg p-2 ${isGaborPractice ? 'bg-[#808080]' : 'bg-white'}`}
      data-screen-practice-mode={activePracticeMode}
    >
      {/* The complete strip stays mounted; the clipped viewport only hides rows outside view. */}
      <div
        className="relative w-full max-w-xl overflow-hidden mb-2"
        style={{
          height: SCREEN_E_CHART_STAGE_HEIGHT,
          backgroundColor: isGaborPractice ? SCREEN_GABOR_MEAN_GRAY : undefined,
        }}
        aria-label={isGaborPractice ? 'Long Gabor orientation chart' : 'Long directional-E chart'}
      >
        <div
          className="absolute inset-x-0 top-0 transition-transform duration-300 ease-out"
          style={{ transform: `translateY(${chartPosition.stripOffsetY}px)` }}
        >
          {chartData.map((line, lineIdx) => {
            const lineSize = isGaborPractice
              ? screenGaborLineSize(viewportWidth, lineIdx, viewportDevicePixelRatio)
              : screenELineSize(viewportWidth, lineIdx, viewportDevicePixelRatio)
            const isCurrentLine = lineIdx === currentLineIndex

            return (
              <div
                key={lineIdx}
                className={`flex items-center justify-center gap-2 ${
                  lineIdx < currentLineIndex ? 'opacity-30' : isCurrentLine ? 'opacity-100' : 'opacity-55'
                }`}
                style={{ height: chartPosition.rowHeights[lineIdx] }}
              >
                {isGaborPractice ? (
                  line.gaborChoices.map((choice, letterIdx) => {
                    const entry = screenGaborManifestEntry(choice)
                    const isCurrentLetter = isCurrentLine && letterIdx === currentLetterIndex
                    const isPastLetter = isCurrentLine && letterIdx < currentLetterIndex

                    return (
                      <div
                        key={letterIdx}
                        className="flex items-center justify-center"
                        data-screen-gabor-target-choice={choice}
                        data-screen-gabor-active-target={isCurrentLetter ? 'true' : undefined}
                      >
                        <div className={`${isPastLetter ? 'opacity-30' : ''} ${isCurrentLetter ? getFeedbackClass() + ' rounded-full' : ''}`}>
                          <GaborPatch
                            size={lineSize}
                            orientation={entry.orientationDegrees}
                            frequency={SCREEN_GABOR_FREQUENCY_CYCLES}
                            contrast={SCREEN_GABOR_CONTRAST}
                            sigma={lineSize * SCREEN_GABOR_SIGMA_RATIO}
                            backgroundColor={SCREEN_GABOR_MEAN_GRAY}
                            rasterMode={SCREEN_GABOR_RASTER_MODE}
                            animate={false}
                          />
                        </div>
                      </div>
                    )
                  })
                ) : exerciseType === 'e-directional' ? (
                  line.directions.map((dir, letterIdx) => {
                    const isCurrentLetter = isCurrentLine && letterIdx === currentLetterIndex
                    const isPastLetter = isCurrentLine && letterIdx < currentLetterIndex

                    return (
                      <div key={letterIdx} className="flex items-center justify-center">
                        <div className={`${isPastLetter ? 'opacity-30' : ''} ${isCurrentLetter ? getFeedbackClass() + ' rounded-sm' : ''}`}>
                          <TumblingE
                            direction={dir}
                            size={lineSize}
                            screenEStyle={screenEStyle}
                            devicePixelRatio={viewportDevicePixelRatio}
                          />
                        </div>
                      </div>
                    )
                  })
                ) : (
                  line.letters.map((letter, letterIdx) => {
                    const isCurrentLetter = isCurrentLine && letterIdx === currentLetterIndex
                    const isPastLetter = isCurrentLine && letterIdx < currentLetterIndex

                    return (
                      <div key={letterIdx} className={`${isPastLetter ? 'opacity-30' : ''} ${isCurrentLetter ? getFeedbackClass() + ' rounded-sm px-1' : ''}`}>
                        <SnellenLetter
                          letter={letter}
                          size={lineSize}
                          strokeWeight={getLineStrokeWeight(lineIdx)}
                        />
                      </div>
                    )
                  })
                )}
              </div>
            )
          })}
        </div>

        {/* This marker descends only at opening/closing; it holds centrally while the strip moves upward. */}
        <div
          className="absolute z-10 transition-[top,left] duration-300 ease-out pointer-events-none"
          style={{
            top: Math.max(0, chartPosition.markerY - 28),
            left: `calc(50% + ${activeMarkerOffsetX}px)`,
            transform: 'translateX(-50%)',
          }}
          aria-hidden="true"
        >
          <ChevronDown className="w-5 h-5 text-primary-500" strokeWidth={3} />
        </div>
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
          {voiceEnabled && (
            <p role="status" className="text-gray-700 text-xs font-semibold mb-2">
              Listening — say Stay or Further
            </p>
          )}
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => handleDistanceChoice('further')}
              className="min-h-11 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold text-sm"
            >
              Move Further
            </button>
            <button
              onClick={() => handleDistanceChoice('stay')}
              className="min-h-11 px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm"
            >
              Stay
            </button>
          </div>
        </div>
      )}

      {/* Input buttons - COMPACT and always visible */}
      {!showDistancePrompt && (
        <div
          className="mt-1 w-full"
          data-screen-e-response-dock
          data-screen-gabor-response-dock={isGaborPractice ? 'true' : undefined}
        >
          <p className={`${isGaborPractice ? 'text-gray-100' : 'text-gray-500'} text-xs text-center mb-2`}>
            {isGaborPractice ? 'Which pattern? Say or choose 1-8' : exerciseType === 'e-directional' ? 'Which way?' : 'Which letter?'} (Line {currentLineIndex + 1}/{CHART_LINES.length})
          </p>
          {/* Voice control — only loads model when tapped ON */}
          <div className="flex items-center justify-center gap-3 mb-2">
            <button
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                voiceEnabled
                  ? isSpeaking
                    ? 'bg-green-500 text-white shadow-lg shadow-green-500/30 animate-pulse'
                    : 'bg-primary-600 text-white shadow-lg shadow-primary-500/30'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
              title={voiceEnabled ? 'Voice ON (tap to disable)' : 'Voice OFF (tap to enable)'}
            >
              {voiceEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              {voiceEnabled ? 'Voice ON' : 'Voice OFF'}
            </button>
            {voiceEnabled && (
              <span className={`text-xs ${isGaborPractice ? 'text-gray-100' : 'text-gray-500'}`}>
                {voiceStatus === 'loading' ? 'Loading model...' :
                 isSpeaking ? 'Hearing...' :
                 lastHeard ? `Heard: "${lastHeard}"` :
                 isGaborPractice ? 'Say a number from 1 to 8' :
                 exerciseType === 'e-directional' ? 'Say up/down/left/right' : 'Say the letter name'}
              </span>
            )}
          </div>

          {isGaborPractice ? (
            <GaborResponseCompass onSelect={handleGaborAnswer} />
          ) : exerciseType === 'e-directional' ? (
            <DirectionButtons
              onSelect={handleLineByLineAnswer}
              compact={deviceMode === 'phone'}
            />
          ) : (
            <LetterButtons
              onSelect={(letter) => handleLetterAnswer(letter)}
              choices={letterChoices}
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

// Direction buttons component - LARGE buttons for easy tapping
// Exported (Chunk B): SnellenQuickCheck reuses this exact fixed arrow-diamond
// pad — positions/labels never move, structurally killing the accidental-saccade
// bug (letters AND buttons reshuffling together in the old "letters" trainer mode).
export function DirectionButtons({
  onSelect,
  compact = false
}: {
  onSelect: (dir: EDirection) => void
  compact?: boolean
}) {
  // One fixed dock: stimulus size never participates in these button dimensions.
  const buttonBase = "bg-gray-900 hover:bg-primary-500 active:bg-primary-600 text-white font-bold rounded-xl transition-colors active:scale-95 flex items-center justify-center shadow-lg flex-shrink-0"
  const buttonSize = compact
    ? "w-28 h-12 text-base gap-1.5"
    : "w-36 h-16 text-lg gap-2"
  const iconSize = compact ? "w-5 h-5" : "w-6 h-6"
  const buttonStyle = {
    minHeight: RESPONSE_PAD_LAYOUT.buttonSize,
    minWidth: compact ? 112 : 144,
  }

  return (
    <div
      className="flex flex-col items-center gap-2"
      data-screen-e-response-pad
      style={{ minHeight: RESPONSE_PAD_LAYOUT.padHeight }}
    >
      {/* Up button */}
      <button
        onClick={() => onSelect('up')}
        className={`${buttonBase} ${buttonSize}`}
        style={buttonStyle}
      >
        <ArrowUp className={iconSize} strokeWidth={2.5} />
        Up
      </button>

      {/* Left and Right buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => onSelect('left')}
          className={`${buttonBase} ${buttonSize}`}
          style={buttonStyle}
        >
          <ArrowLeft className={iconSize} strokeWidth={2.5} />
          Left
        </button>
        <button
          onClick={() => onSelect('right')}
          className={`${buttonBase} ${buttonSize}`}
          style={buttonStyle}
        >
          Right
          <ArrowRight className={iconSize} strokeWidth={2.5} />
        </button>
      </div>

      {/* Down button */}
      <button
        onClick={() => onSelect('down')}
        className={`${buttonBase} ${buttonSize}`}
        style={buttonStyle}
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
