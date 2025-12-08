'use client'

import { useState, useEffect } from 'react'

interface SnellenChartProps {
  chartSize: string // "20/20", "20/40", etc.
  exerciseType: 'letters' | 'e-directional'
  onAnswer: (correct: boolean) => void
  resetTrigger?: number // Changes when parent wants to generate new letter
  deviceMode?: 'phone' | 'desktop'
}

// Reduced sizes for mobile friendliness
const CHART_SIZES = {
  '20/200': 4,
  '20/100': 3,
  '20/70': 2.5,
  '20/50': 2,
  '20/40': 1.75,
  '20/30': 1.5,
  '20/25': 1.25,
  '20/20': 1,
  '20/15': 0.75,
  '20/10': 0.5
}

const SNELLEN_LETTERS = ['E', 'F', 'P', 'T', 'O', 'Z', 'L', 'P', 'E', 'D']
const E_DIRECTIONS = ['up', 'down', 'left', 'right'] as const
type EDirection = typeof E_DIRECTIONS[number]

export default function SnellenChart({
  chartSize,
  exerciseType,
  onAnswer,
  resetTrigger = 0,
  deviceMode = 'phone'
}: SnellenChartProps) {
  const [currentLetter, setCurrentLetter] = useState(() =>
    SNELLEN_LETTERS[Math.floor(Math.random() * SNELLEN_LETTERS.length)]
  )
  const [currentDirection, setCurrentDirection] = useState<EDirection>(() =>
    E_DIRECTIONS[Math.floor(Math.random() * E_DIRECTIONS.length)]
  )

  useEffect(() => {
    setCurrentLetter(SNELLEN_LETTERS[Math.floor(Math.random() * SNELLEN_LETTERS.length)])
    setCurrentDirection(E_DIRECTIONS[Math.floor(Math.random() * E_DIRECTIONS.length)])
  }, [resetTrigger])

  const sizeMultiplier = CHART_SIZES[chartSize as keyof typeof CHART_SIZES] || 1
  const baseFontSize = 4 // rem for 20/20
  const fontSize = baseFontSize * sizeMultiplier

  const rotationMap = { right: 0, down: 90, left: 180, up: 270 }

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-lg p-8">
      <div className="text-gray-600 text-sm mb-4 font-semibold">{chartSize}</div>

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
          <div
            className="inline-block font-mono font-black select-none"
            style={{
              fontSize: `${fontSize}rem`,
              transform: `rotate(${rotationMap[currentDirection]}deg)`,
              lineHeight: 1,
              color: '#000000'
            }}
          >
            E
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3 justify-center max-w-md">
        {exerciseType === 'letters' ? (
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

      <div className="mt-6 text-gray-600 text-sm text-center">
        <p className="mb-1">Find your edge of clarity - where letters are just barely readable.</p>
        <p className="text-xs">
          {deviceMode === 'phone'
            ? 'Start comfortable, then gradually extend distance as you improve.'
            : 'Position at normal desk distance, adjust as needed.'}
        </p>
      </div>
    </div>
  )
}
