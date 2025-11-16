'use client'

interface SnellenChartProps {
  chartSize: string // "20/20", "20/40", "20/60", etc.
  exerciseType: 'letters' | 'e-directional'
  onAnswer: (correct: boolean) => void
  currentLetter?: string
}

// Snellen chart letter sizes (relative to 20/20)
const CHART_SIZES = {
  '20/200': 10,
  '20/100': 5,
  '20/70': 3.5,
  '20/50': 2.5,
  '20/40': 2,
  '20/30': 1.5,
  '20/25': 1.25,
  '20/20': 1,
  '20/15': 0.75,
  '20/10': 0.5
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
  currentLetter
}: SnellenChartProps) {
  const sizeMultiplier = CHART_SIZES[chartSize as keyof typeof CHART_SIZES] || 1

  // Base size in rem (20/20 baseline)
  const baseFontSize = 4 // rem
  const fontSize = baseFontSize * sizeMultiplier

  // Generate random letter or E direction
  const randomLetter = currentLetter || SNELLEN_LETTERS[Math.floor(Math.random() * SNELLEN_LETTERS.length)]
  const randomEDirection: EDirection = E_DIRECTIONS[Math.floor(Math.random() * E_DIRECTIONS.length)]

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
            {randomLetter}
          </div>
        ) : (
          renderEChart(randomEDirection)
        )}
      </div>

      {/* Answer buttons */}
      <div className="flex flex-wrap gap-3 justify-center max-w-md">
        {exerciseType === 'letters' ? (
          // Letter selection
          SNELLEN_LETTERS.map(letter => (
            <button
              key={letter}
              onClick={() => onAnswer(letter === randomLetter)}
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
                onClick={() => onAnswer(randomEDirection === 'up')}
                className="bg-gray-900 hover:bg-primary-500 text-white font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-105"
              >
                ↑ Up
              </button>
            </div>
            <div className="w-full flex gap-3 justify-center">
              <button
                onClick={() => onAnswer(randomEDirection === 'left')}
                className="bg-gray-900 hover:bg-primary-500 text-white font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-105"
              >
                ← Left
              </button>
              <button
                onClick={() => onAnswer(randomEDirection === 'right')}
                className="bg-gray-900 hover:bg-primary-500 text-white font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-105"
              >
                Right →
              </button>
            </div>
            <div className="w-full flex justify-center mt-2">
              <button
                onClick={() => onAnswer(randomEDirection === 'down')}
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
