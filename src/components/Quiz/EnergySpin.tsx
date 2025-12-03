"use client"

import { useState, useEffect, useRef } from "react"
import { Play, Pause, SkipForward, Volume2, Sparkles } from "lucide-react"

interface EnergySpinProps {
  userName: string
  onComplete: () => void
  onSkip: () => void
}

/**
 * Energy Spin Up - Mini Mental Mastery Module
 *
 * Phase 1: Text-based guided visualization with animated visuals
 * Phase 2 (Future): Pre-recorded audio with your voice
 *
 * Purpose: Make them feel good, establish fun, create physical involvement
 */
export function EnergySpin({ userName, onComplete, onSkip }: EnergySpinProps) {
  const [stage, setStage] = useState<"intro" | "visualizing" | "complete">("intro")
  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [spinSpeed, setSpinSpeed] = useState(1)
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  const animationRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)

  // Guided visualization steps
  const steps = [
    {
      instruction: `${userName}, close your eyes for a moment...`,
      duration: 3000,
    },
    {
      instruction: "Think about that goal you just described...",
      duration: 4000,
    },
    {
      instruction: "Where do you feel it in your body? Point to it.",
      duration: 4000,
    },
    {
      instruction: "What color is that feeling?",
      duration: 3000,
      hasColorPicker: true,
    },
    {
      instruction: "Now imagine that color starting to spin...",
      duration: 4000,
    },
    {
      instruction: "Spin it faster... and faster...",
      duration: 4000,
      speedUp: true,
    },
    {
      instruction: "Feel it spreading through your whole body...",
      duration: 4000,
    },
    {
      instruction: "Now anchor this feeling right here...",
      duration: 3000,
    },
    {
      instruction: "This is what success feels like.",
      duration: 3000,
    },
    {
      instruction: "Welcome to Reset Biology.",
      duration: 3000,
      final: true,
    },
  ]

  const colors = [
    { name: "Gold", value: "#FFD700", gradient: "from-yellow-400 to-amber-500" },
    { name: "Electric Blue", value: "#00BFFF", gradient: "from-cyan-400 to-blue-500" },
    { name: "Emerald", value: "#50C878", gradient: "from-emerald-400 to-green-500" },
    { name: "Purple", value: "#9B59B6", gradient: "from-purple-400 to-violet-500" },
    { name: "Red", value: "#E74C3C", gradient: "from-red-400 to-rose-500" },
    { name: "Teal", value: "#3FBFB5", gradient: "from-teal-400 to-cyan-500" },
  ]

  // Auto-advance through steps when playing
  useEffect(() => {
    if (stage !== "visualizing" || !isPlaying) return

    const currentStepData = steps[currentStep]
    const timer = setTimeout(() => {
      // Don't auto-advance if waiting for color selection
      if (currentStepData.hasColorPicker && !selectedColor) return

      if (currentStep < steps.length - 1) {
        setCurrentStep(prev => prev + 1)
        if (steps[currentStep + 1]?.speedUp) {
          setSpinSpeed(prev => Math.min(prev + 1, 5))
        }
      } else {
        setStage("complete")
      }
    }, currentStepData.duration)

    return () => clearTimeout(timer)
  }, [stage, isPlaying, currentStep, selectedColor])

  const handleStart = () => {
    setStage("visualizing")
    setIsPlaying(true)
    startTimeRef.current = Date.now()
  }

  const handlePlayPause = () => {
    setIsPlaying(prev => !prev)
  }

  const handleColorSelect = (color: typeof colors[0]) => {
    setSelectedColor(color.value)
  }

  const currentStepData = steps[currentStep]
  const selectedColorData = colors.find(c => c.value === selectedColor)

  // Intro screen
  if (stage === "intro") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 flex items-center justify-center px-4">
        <div className="max-w-xl mx-auto text-center">
          <div className="mb-8">
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center animate-pulse">
              <Sparkles className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Energy Activation
            </h1>
            <p className="text-gray-300 text-lg mb-2">
              Before we show you your options, let's do something fun.
            </p>
            <p className="text-gray-400">
              This quick 2-minute exercise will help you connect with your goals on a deeper level.
            </p>
          </div>

          <div className="bg-gray-800/50 rounded-xl p-6 mb-8 border border-primary-500/20">
            <h3 className="text-white font-semibold mb-2">What you'll do:</h3>
            <ul className="text-gray-300 text-left space-y-2">
              <li className="flex items-center gap-2">
                <span className="text-primary-400">1.</span> Close your eyes
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary-400">2.</span> Visualize your goal
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary-400">3.</span> Amplify the feeling
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary-400">4.</span> Anchor it in your body
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-4">
            <button
              onClick={handleStart}
              className="w-full py-4 bg-gradient-to-r from-primary-500 to-secondary-500 text-white rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-primary-500/30 transition-all"
            >
              Start Energy Activation
            </button>
            <button
              onClick={onSkip}
              className="text-gray-400 hover:text-white transition-colors"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Completion screen
  if (stage === "complete") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 flex items-center justify-center px-4">
        <div className="max-w-xl mx-auto text-center">
          <div
            className={`w-32 h-32 mx-auto mb-8 rounded-full flex items-center justify-center animate-spin-slow bg-gradient-to-br ${
              selectedColorData?.gradient || "from-primary-500 to-secondary-500"
            }`}
            style={{ animationDuration: "3s" }}
          >
            <div className="w-28 h-28 bg-gray-900 rounded-full flex items-center justify-center">
              <Sparkles className="w-12 h-12 text-white" />
            </div>
          </div>

          <h1 className="text-4xl font-bold text-white mb-4">
            Welcome to Reset Biology, {userName}!
          </h1>
          <p className="text-gray-300 text-lg mb-8">
            You've just anchored the feeling of success. Remember this moment whenever you need motivation.
          </p>

          <button
            onClick={onComplete}
            className="w-full py-4 bg-gradient-to-r from-primary-500 to-secondary-500 text-white rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-primary-500/30 transition-all"
          >
            See Your Options
          </button>
        </div>
      </div>
    )
  }

  // Visualization screen
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 flex items-center justify-center px-4">
      <div className="max-w-xl mx-auto">
        {/* Spinning Visual */}
        <div className="flex justify-center mb-12">
          <div
            className={`w-48 h-48 rounded-full flex items-center justify-center transition-all duration-500 ${
              selectedColor
                ? `bg-gradient-to-br ${selectedColorData?.gradient}`
                : "bg-gradient-to-br from-primary-500/50 to-secondary-500/50"
            }`}
            style={{
              animation: isPlaying
                ? `spin ${Math.max(0.5, 3 - spinSpeed * 0.4)}s linear infinite`
                : "none",
              boxShadow: selectedColor
                ? `0 0 ${spinSpeed * 20}px ${spinSpeed * 10}px ${selectedColor}40`
                : undefined,
            }}
          >
            <div className="w-40 h-40 bg-gray-900/80 rounded-full flex items-center justify-center backdrop-blur-sm">
              <div className="text-center">
                <p className="text-5xl font-bold text-white">{currentStep + 1}</p>
                <p className="text-gray-400 text-sm">of {steps.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Instruction */}
        <div className="text-center mb-8">
          <p className="text-2xl md:text-3xl font-medium text-white leading-relaxed animate-fade-in">
            {currentStepData.instruction}
          </p>
        </div>

        {/* Color Picker */}
        {currentStepData.hasColorPicker && !selectedColor && (
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            {colors.map((color) => (
              <button
                key={color.value}
                onClick={() => handleColorSelect(color)}
                className="w-16 h-16 rounded-full transition-transform hover:scale-110 focus:ring-4 focus:ring-white/30"
                style={{ backgroundColor: color.value }}
                aria-label={color.name}
              />
            ))}
          </div>
        )}

        {/* Controls */}
        <div className="flex justify-center gap-4">
          <button
            onClick={handlePlayPause}
            className="p-4 bg-gray-800/50 rounded-full hover:bg-gray-700/50 transition-colors"
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 text-white" />
            ) : (
              <Play className="w-6 h-6 text-white" />
            )}
          </button>
          <button
            onClick={onSkip}
            className="p-4 bg-gray-800/50 rounded-full hover:bg-gray-700/50 transition-colors"
          >
            <SkipForward className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Skip link */}
        <div className="text-center mt-8">
          <button
            onClick={onSkip}
            className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
          >
            Skip this exercise
          </button>
        </div>
      </div>

      {/* Animation keyframes */}
      <style jsx global>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
        .animate-spin-slow {
          animation: spin 3s linear infinite;
        }
      `}</style>
    </div>
  )
}

export default EnergySpin
