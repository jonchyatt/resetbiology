'use client'

import { useEffect, useRef, type KeyboardEvent } from 'react'
import { Camera, Search, X } from 'lucide-react'

interface CameraUploadProps {
  onClose: () => void
  onUseSearch: () => void
}

const PHOTO_ANALYSIS_UNAVAILABLE =
  'Photo analysis is temporarily unavailable. Use Search to log your meal manually.'

export function CameraUpload({ onClose, onUseSearch }: CameraUploadProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const primaryActionRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    primaryActionRef.current?.focus()
  }, [])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }

    if (event.key !== 'Tab') return

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [],
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-analysis-title"
        aria-describedby="photo-analysis-description"
        onKeyDown={handleKeyDown}
        className="w-full max-w-lg rounded-xl border border-blue-400/30 bg-gradient-to-br from-gray-800 to-gray-900 p-5 shadow-2xl sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="rounded-lg border border-blue-400/30 bg-blue-500/10 p-2 text-blue-200">
              <Camera className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h3 id="photo-analysis-title" className="text-xl font-bold text-white">
                Photo logging is resting
              </h3>
              <p className="mt-1 text-sm text-gray-400">Search and manual logging still work normally.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close photo logging notice"
            className="shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* ponytail: Phase 1 contains paid photo inference here; Phase 2c upgrades
            this surface to the validated free, database-grounded lane. */}
        <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-4 text-amber-100">
          <p id="photo-analysis-description" role="status" aria-live="polite" className="text-sm leading-6">
            {PHOTO_ANALYSIS_UNAVAILABLE}
          </p>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg bg-gray-700 px-4 py-3 font-medium text-white transition-colors hover:bg-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            Cancel
          </button>
          <button
            ref={primaryActionRef}
            type="button"
            onClick={onUseSearch}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3 font-medium text-white transition-colors hover:bg-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            Use Search instead
          </button>
        </div>
      </div>
    </div>
  )
}
