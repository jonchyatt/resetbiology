'use client'

import GaborPatch from './GaborPatch'
import {
  SCREEN_GABOR_CONTRAST,
  SCREEN_GABOR_FREQUENCY_CYCLES,
  SCREEN_GABOR_MEAN_GRAY,
  SCREEN_GABOR_ORIENTATION_MANIFEST,
  SCREEN_GABOR_RASTER_MODE,
  SCREEN_GABOR_SIGMA_RATIO,
  type ScreenGaborChoice,
} from '@/lib/vision/screenGaborPractice'

interface GaborResponseCompassProps {
  onSelect: (choice: ScreenGaborChoice) => void
  disabled?: boolean
}

export default function GaborResponseCompass({
  onSelect,
  disabled = false,
}: GaborResponseCompassProps) {
  return (
    <div
      className="mx-auto w-full max-w-[354px] rounded-[22px] border border-primary-400/70 bg-gray-950 p-3 shadow-[0_12px_34px_rgba(0,0,0,0.38),inset_0_0_0_1px_rgba(45,212,191,0.12)] [@media(max-height:700px)]:p-2"
      data-screen-gabor-response-pad
      aria-label="Eight Gabor orientation choices"
    >
      <div className="grid grid-cols-3 grid-rows-3 gap-2 [@media(max-height:700px)]:gap-1.5">
        {SCREEN_GABOR_ORIENTATION_MANIFEST.map(entry => (
          <button
            key={entry.choice}
            type="button"
            aria-label={`Choice ${entry.choice}`}
            disabled={disabled}
            onClick={() => onSelect(entry.choice)}
            data-screen-gabor-choice={entry.choice}
            className="relative flex min-h-[72px] min-w-0 items-center justify-center overflow-hidden rounded-xl bg-[#808080] transition-transform active:scale-[0.97] disabled:cursor-wait disabled:opacity-70 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 [@media(max-height:700px)]:min-h-[60px]"
            style={{
              gridRowStart: entry.row + 1,
              gridColumnStart: entry.column + 1,
            }}
          >
            <span
              aria-hidden="true"
              className="absolute left-1.5 top-1.5 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-950/90 px-1 text-[11px] font-bold leading-none text-white ring-1 ring-white/20"
            >
              {entry.choice}
            </span>
            <GaborPatch
              size={52}
              orientation={entry.orientationDegrees}
              frequency={SCREEN_GABOR_FREQUENCY_CYCLES}
              contrast={SCREEN_GABOR_CONTRAST}
              sigma={52 * SCREEN_GABOR_SIGMA_RATIO}
              backgroundColor={SCREEN_GABOR_MEAN_GRAY}
              rasterMode={SCREEN_GABOR_RASTER_MODE}
              animate={false}
            />
          </button>
        ))}

        <div
          className="flex min-h-[72px] items-center justify-center rounded-xl bg-[#808080] [@media(max-height:700px)]:min-h-[60px]"
          style={{ gridRowStart: 2, gridColumnStart: 2 }}
          data-screen-gabor-neutral-center
          aria-hidden="true"
        />
      </div>
    </div>
  )
}
