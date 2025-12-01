'use client'

import { useState, useEffect } from 'react'

interface SnellenChartProps {
  chartSize: string // "20/20", "20/40", "20/60", etc.
  exerciseType: 'letters' | 'e-directional'
  onAnswer: (correct: boolean) => void
  resetTrigger?: number // Changes when parent wants to generate new letter
}

// Snellen chart letter sizes (relative to 20/20)
// Reduced from original values to fit on mobile screens
// Original 20/200 was 10x = 40rem which overflows phones
const CHART_SIZES = {
  '20/200': 4,      // Was 10 - too big for phones
  '20/100': 3,      // Was 5
  '20/70': 2.5,     // Was 3.5
  '20/50': 2,       // Was 2.5
  '20/40': 1.75,    // Was 2
  '20/30': 1.5,     // Same
  '20/25': 1.25,    // Same
  '20/20': 1,       // Same
  '20/15': 0.75,    // Same
  '20/10': 0.5      // Same
}

// Standard Snellen letters (most legible)
const SNELLEN_LETTERS = ['E', 'F', 'P', 'T', 'O', 'Z', 'L', 'P', 'E', 'D']

// E direction options
const E_DIRECTIONS = ['up', 'down', 'left', 'right'] as const
type EDirection = typeof E_DIRECTIONS[number]

export default function SnellenChart({
  chartSize,
  exerciseType,
  onAnswer,
  resetTrigger = 0
}: SnellenChartProps) {
  // State to hold current letter/direction (only changes when resetTrigger changes)
  const [currentLetter, setCurrentLetter] = useState(() =>
    SNELLEN_LETTERS[Math.floor(Math.random() * SNELLEN_LETTERS.length)]
  )
  const [currentDirection, setCurrentDirection] = useState<EDirection>(() =>
    E_DIRECTIONS[Math.floor(Math.random() * E_DIRECTIONS.length)]
  )

  // Generate new letter/direction only when resetTrigger changes
  useEffect(() => {
    setCurrentLetter(SNELLEN_LETTERS[Math.floor(Math.random() * SNELLEN_LETTERS.length)])
    setCurrentDirection(E_DIRECTIONS[Math.floor(Math.random() * E_DIRECTIONS.length)])
  }, [resetTrigger])

  const sizeMultiplier = CHART_SIZES[chartSize as keyof typeof CHART_SIZES] || 1

  // Base size in rem (20/20 baseline)
  const baseFontSize = 4 // rem
  const fontSize = baseFontSize * sizeMultiplier

  // Render E chart based on direction
  const renderEChart = (direction: EDirection) => {
    const rotationMap = {
      'right': 0,
      'down': 90,
      'left': 180,
      'up': 270
    }

    return (
      <div
        className="inline-block font-mono font-black select-none"
        style={{
          fontSize: `${fontSize}rem`,
          transform: `rotate(${rotationMap[direction]}deg)`,
          lineHeight: 1,
          color: '#000000'
        }}
      >
        E
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-lg p-8">
      {/* Chart label */}
      <div className="text-gray-600 text-sm mb-4 font-semibold">
        {chartSize}
      </div>

      {/* Letter or E display */}
      <div className="mb-8 select-none" style={{ userSelect: 'none' }}>
        {exerciseType === 'letters' ? (
          <div
            className="font-mono font-black"
            style={{
              fontSize: `${fontSize}rem`,
              lineHeight: 1,
              color: '#000000',
              letterSpacing: '0.1em'
            }}
          >
            {currentLetter}
          </div>
        ) : (
          renderEChart(currentDirection)
        )}
      </div>

      {/* Answer buttons */}
      <div className="flex flex-wrap gap-3 justify-center max-w-md">
        {exerciseType === 'letters' ? (
          // Letter selection
          SNELLEN_LETTERS.map(letter => (
            <button
              key={letter}
              onClick={() => onAnswer(letter === currentLetter)}
              className="bg-gray-900 hover:bg-primary-500 text-white font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-105 text-xl"
            >
              {letter}
            </button>
          ))
        ) : (
          // Direction selection for E
          <>
            <div className="w-full flex justify-center mb-2">
              <button
                onClick={() => onAnswer(currentDirection === 'up')}
                className="bg-gray-900 hover:bg-primary-500 text-white font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-105"
              >
                ↑ Up
              </button>
            </div>
            <div className="w-full flex gap-3 justify-center">
              <button
                onClick={() => onAnswer(currentDirection === 'left')}
                className="bg-gray-900 hover:bg-primary-500 text-white font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-105"
              >
                ← Left
              </button>
              <button
                onClick={() => onAnswer(currentDirection === 'right')}
                className="bg-gray-900 hover:bg-primary-500 text-white font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-105"
              >
                Right →
              </button>
            </div>
            <div className="w-full flex justify-center mt-2">
              <button
                onClick={() => onAnswer(currentDirection === 'down')}
                className="bg-gray-900 hover:bg-primary-500 text-white font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-105"
              >
                ↓ Down
              </button>
            </div>
          </>
        )}
      </div>

      {/* Distance guidance text */}
      <div className="mt-6 text-gray-600 text-sm text-center">
        <p className="mb-1">📏 Optimal viewing distance varies with screen size</p>
        <p className="text-xs">Near vision: 16" (40cm) | Far vision: 10-20 feet (3-6m)</p>
      </div>
    </div>
  )
}
