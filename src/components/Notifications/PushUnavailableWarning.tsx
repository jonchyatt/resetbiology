'use client'

import { AlertCircle, X, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { usePushAvailability } from '@/hooks/usePushAvailability'

export default function PushUnavailableWarning() {
  const availability = usePushAvailability()
  const [dismissed, setDismissed] = useState(false)

  // Don't show if dismissed
  if (dismissed) return null

  // Don't show if push is fully available
  if (availability.isPermissionGranted && availability.isServiceWorkerReady) {
    return null
  }

  // Don't show if user explicitly denied (they know what they did)
  if (availability.blockReason?.includes('denied')) {
    return null
  }

  // Determine the message and action
  let message = ''
  let actionButton: React.ReactNode = null

  if (!availability.isSupported) {
    message = 'Push notifications are not supported in this browser. Use Chrome, Firefox, or Edge for push reminders.'
  } else if (!availability.isServiceWorkerReady) {
    message = 'Service worker not ready. Refresh the page to enable push notifications.'
    actionButton = (
      <button
        onClick={() => window.location.reload()}
        className="flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-md text-sm font-medium transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        Refresh
      </button>
    )
  } else if (!availability.isPermissionGranted && availability.canShowPrompt) {
    message = 'Enable push notifications to get dose reminders even when the app is closed.'
  } else if (availability.blockReason) {
    message = availability.blockReason
  } else {
    return null // Nothing to show
  }

  return (
    <div className="bg-gradient-to-r from-amber-500/90 to-orange-500/90 backdrop-blur-sm border-b border-amber-600/50">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <AlertCircle className="w-5 h-5 text-white flex-shrink-0" />
            <p className="text-sm text-white font-medium">
              {message}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {actionButton}
            <button
              onClick={() => setDismissed(true)}
              className="p-1 hover:bg-white/20 rounded-md transition-colors"
              aria-label="Dismiss warning"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
