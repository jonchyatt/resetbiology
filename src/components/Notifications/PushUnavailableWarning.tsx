'use client'

import { AlertCircle, X, RefreshCw, Bell } from 'lucide-react'
import { useState, useEffect } from 'react'
import { usePushAvailability } from '@/hooks/usePushAvailability'

export default function PushUnavailableWarning() {
  const availability = usePushAvailability()
  const [dismissed, setDismissed] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [permissionState, setPermissionState] = useState<NotificationPermission | null>(null)

  // Track actual permission state independently
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermissionState(Notification.permission)
    }
  }, [requesting]) // Re-check after request attempt

  // Don't show if dismissed
  if (dismissed) return null

  // Don't show if push is fully available
  if (availability.isPermissionGranted && availability.isServiceWorkerReady) {
    return null
  }

  // Request push permission - works even after previous cancel
  const requestPermission = async () => {
    if (!availability.isSupported) return

    setRequesting(true)
    try {
      const permission = await Notification.requestPermission()
      setPermissionState(permission)

      if (permission === 'granted') {
        // Subscribe to push notifications
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        })

        // Send subscription to server
        await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription })
        })

        // Dismiss banner on success
        setDismissed(true)
      }
    } catch (error) {
      console.error('Failed to request push permission:', error)
    } finally {
      setRequesting(false)
    }
  }

  // Use local permission state if available, fall back to hook's state
  const currentPermission = permissionState ?? (availability.isPermissionGranted ? 'granted' : 'default')
  const canRequestPermission = availability.isSupported && availability.isServiceWorkerReady && currentPermission !== 'denied'

  // Determine the message and action
  let message = ''
  let actionButton: React.ReactNode = null
  let isClickable = false

  if (!availability.isSupported) {
    message = 'Push notifications are not supported in this browser. Use Chrome, Firefox, or Edge for push reminders.'
  } else if (!availability.isServiceWorkerReady) {
    message = 'Service worker not ready. Refresh the page to enable push notifications.'
    actionButton = (
      <button
        onClick={(e) => {
          e.stopPropagation()
          window.location.reload()
        }}
        className="flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-md text-sm font-medium transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        Refresh
      </button>
    )
  } else if (currentPermission === 'denied') {
    // Permission was blocked - can't request again
    message = 'Notifications blocked. Tap the lock icon in your browser address bar to enable.'
    // No action button - user must manually enable in browser
  } else if (canRequestPermission) {
    // Permission is default or user cancelled before - can still request
    message = 'Enable push notifications to get dose reminders even when the app is closed.'
    isClickable = true
    actionButton = (
      <button
        onClick={(e) => {
          e.stopPropagation()
          requestPermission()
        }}
        disabled={requesting}
        className="flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
      >
        <Bell className="w-4 h-4" />
        {requesting ? 'Enabling...' : 'Enable'}
      </button>
    )
  } else if (availability.blockReason) {
    message = availability.blockReason
  } else {
    return null // Nothing to show
  }

  return (
    <div
      className={`bg-gradient-to-r from-amber-500/90 to-orange-500/90 backdrop-blur-sm border-b border-amber-600/50 ${isClickable ? 'cursor-pointer hover:from-amber-500 hover:to-orange-500' : ''}`}
      onClick={isClickable ? requestPermission : undefined}
    >
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <AlertCircle className="w-5 h-5 text-white flex-shrink-0" />
            <p className="text-sm text-white font-medium">
              {message}
              {isClickable && <span className="ml-2 opacity-75">Tap to enable.</span>}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {actionButton}
            <button
              onClick={(e) => {
                e.stopPropagation()
                setDismissed(true)
              }}
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
