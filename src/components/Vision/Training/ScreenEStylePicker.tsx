'use client'

import { TumblingE } from './SnellenChart'
import GaborPatch from './GaborPatch'
import {
  SCREEN_GABOR_CONTRAST,
  SCREEN_GABOR_FREQUENCY_CYCLES,
  SCREEN_GABOR_MEAN_GRAY,
  SCREEN_GABOR_RASTER_MODE,
  SCREEN_PRACTICE_MODE_REGISTRY,
  type ScreenPracticeMode,
} from '@/lib/vision/screenGaborPractice'

interface ScreenEStylePickerProps {
  value: ScreenPracticeMode
  onChange: (style: ScreenPracticeMode) => void
  nightMode?: boolean
}

const PRACTICE_MODE_IDS = Object.keys(SCREEN_PRACTICE_MODE_REGISTRY) as ScreenPracticeMode[]

export default function ScreenEStylePicker({
  value,
  onChange,
  nightMode = false,
}: ScreenEStylePickerProps) {
  return (
    <fieldset>
      <legend className={`text-sm font-semibold ${nightMode ? 'text-amber-100' : 'text-white'}`}>
        Practice target
      </legend>
      <p className={`mt-1 text-xs ${nightMode ? 'text-amber-100/60' : 'text-gray-400'}`}>
        Choose what you want to resolve through the same 14-row journey.
      </p>

      <div
        role="radiogroup"
        aria-label="Vision practice target"
        className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        {PRACTICE_MODE_IDS.map((mode) => {
          const option = SCREEN_PRACTICE_MODE_REGISTRY[mode]
          const selected = value === mode

          return (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(mode)}
              className={`min-h-11 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 ${
                selected
                  ? 'border-primary-300 bg-primary-500/20 ring-1 ring-primary-300'
                  : nightMode
                    ? 'border-amber-900/50 bg-[#17100a]/80 hover:border-amber-700'
                    : 'border-gray-600 bg-gray-800/60 hover:border-gray-400'
              }`}
            >
              <span className="flex items-center gap-3">
                <span
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-lg ${mode === 'gabor' ? 'bg-[#808080]' : 'bg-white'}`}
                  aria-hidden="true"
                >
                  {mode === 'gabor' ? (
                    <GaborPatch
                      size={48}
                      orientation={45}
                      frequency={SCREEN_GABOR_FREQUENCY_CYCLES}
                      contrast={SCREEN_GABOR_CONTRAST}
                      backgroundColor={SCREEN_GABOR_MEAN_GRAY}
                      rasterMode={SCREEN_GABOR_RASTER_MODE}
                      animate={false}
                    />
                  ) : (
                    <TumblingE direction="right" size={44} screenEStyle={mode} animate={false} />
                  )}
                </span>
                <span className="min-w-0">
                  <span className={`block font-semibold ${nightMode ? 'text-amber-50' : 'text-white'}`}>
                    {option.label}
                  </span>
                  <span className={`mt-0.5 block text-xs ${nightMode ? 'text-amber-100/60' : 'text-gray-400'}`}>
                    {selected ? 'Selected' : option.description}
                  </span>
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <p className={`mt-2 text-xs ${nightMode ? 'text-amber-100/60' : 'text-gray-400'}`}>
        Baseline and retake checks stay Crisp so results remain comparable. Gabor is practice-only.
      </p>
    </fieldset>
  )
}
