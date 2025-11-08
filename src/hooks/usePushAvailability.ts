'use client'

import { useState, useEffect } from 'react'

export interface PushAvailability {
  isSupported: boolean
  isPermissionGranted: boolean
  isServiceWorkerReady: boolean
  canShowPrompt: boolean
  blockReason: string | null
}

export function usePushAvailability(): PushAvailability {
  const [availability, setAvailability] = useState<PushAvailability>({
    isSupported: false,
    isPermissionGranted: false,
    isServiceWorkerReady: false,
    canShowPrompt: false,
    blockReason: null
  })

  useEffect(() => {
    const checkAvailability = async () => {
      // Check if running in browser
      if (typeof window === 'undefined') {
        setAvailability({
          isSupported: false,
          isPermissionGranted: false,
          isServiceWorkerReady: false,
          canShowPrompt: false,
          blockReason: 'Not running in browser'
        })
        return
      }

      // Check for Notification API support
      const isSupported = 'Notification' in window && 'serviceWorker' in navigator

      if (!isSupported) {
        setAvailability({
          isSupported: false,
          isPermissionGranted: false,
          isServiceWorkerReady: false,
          canShowPrompt: false,
          blockReason: 'Browser does not support push notifications'
        })
        return
      }

      // Check notification permission
      const permission = Notification.permission
      const isPermissionGranted = permission === 'granted'

      // Check if permission was denied
      if (permission === 'denied') {
        setAvailability({
          isSupported: true,
          isPermissionGranted: false,
          isServiceWorkerReady: false,
          canShowPrompt: false,
          blockReason: 'Notification permission was denied. Enable in browser settings.'
        })
        return
      }

      // Check service worker registration
      let isServiceWorkerReady = false
      try {
        const registration = await navigator.serviceWorker.getRegistration()
        isServiceWorkerReady = !!registration
      } catch (error) {
        console.warn('Service worker check failed:', error)
      }

      if (!isServiceWorkerReady) {
        setAvailability({
          isSupported: true,
          isPermissionGranted,
          isServiceWorkerReady: false,
          canShowPrompt: permission === 'default',
          blockReason: 'Service worker not registered. Refresh the page.'
        })
        return
      }

      // Check if running on localhost or HTTPS
      const isSecureContext = window.isSecureContext
      if (!isSecureContext) {
        setAvailability({
          isSupported: true,
          isPermissionGranted,
          isServiceWorkerReady,
          canShowPrompt: false,
          blockReason: 'Push notifications require HTTPS'
        })
        return
      }

      // All checks passed
      setAvailability({
        isSupported: true,
        isPermissionGranted,
        isServiceWorkerReady,
        canShowPrompt: permission === 'default',
        blockReason: null
      })
    }

    checkAvailability()

    // Re-check when visibility changes (e.g., user comes back to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAvailability()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  return availability
}
