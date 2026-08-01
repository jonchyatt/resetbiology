'use client'

import { TumblingE } from './SnellenChart'
import {
  SCREEN_E_STYLE_REGISTRY,
  type ScreenEStyle,
} from '@/lib/vision/screenDirectionalE'

interface ScreenEStylePickerProps {
  value: ScreenEStyle
  onChange: (style: ScreenEStyle) => void
  nightMode?: boolean
}

const STYLE_IDS = Object.keys(SCREEN_E_STYLE_REGISTRY) as ScreenEStyle[]

export default function ScreenEStylePicker({
  value,
  onChange,
  nightMode = false,
}: ScreenEStylePickerProps) {
  return (
    <fieldset>
      <legend className={`text-sm font-semibold ${nightMode ? 'text-amber-100' : 'text-white'}`}>
        Directional E line style
      </legend>
      <p className={`mt-1 text-xs ${nightMode ? 'text-amber-100/60' : 'text-gray-400'}`}>
        Both styles use the same 14-row workout. Only the line weight changes.
      </p>

      <div
        role="radiogroup"
        aria-label="Directional E line style"
        className="mt-3 grid grid-cols-2 gap-3"
      >
        {STYLE_IDS.map((style) => {
          const option = SCREEN_E_STYLE_REGISTRY[style]
          const selected = value === style

          return (
            <button
              key={style}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(style)}
              className={`min-h-11 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 ${
                selected
                  ? 'border-primary-300 bg-primary-500/20 ring-1 ring-primary-300'
                  : nightMode
                    ? 'border-amber-900/50 bg-[#17100a]/80 hover:border-amber-700'
                    : 'border-gray-600 bg-gray-800/60 hover:border-gray-400'
              }`}
            >
              <span className="flex items-center gap-3">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-white" aria-hidden="true">
                  <TumblingE direction="right" size={44} screenEStyle={style} animate={false} />
                </span>
                <span className="min-w-0">
                  <span className={`block font-semibold ${nightMode ? 'text-amber-50' : 'text-white'}`}>
                    {option.label}
                  </span>
                  <span className={`mt-0.5 block text-xs ${nightMode ? 'text-amber-100/60' : 'text-gray-400'}`}>
                    {selected ? 'Selected' : 'Choose style'}
                  </span>
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <p className={`mt-2 text-xs ${nightMode ? 'text-amber-100/60' : 'text-gray-400'}`}>
        Baseline checks stay Crisp so results remain comparable.
      </p>
    </fieldset>
  )
}
