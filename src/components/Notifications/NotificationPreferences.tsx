'use client'
import { useState, useEffect } from 'react'
import { Bell, Mail, AlertCircle, CheckCircle } from 'lucide-react'

interface Props {
  protocolId: string
  protocolName: string
  onClose: () => void
}

// Convert base64 VAPID key to Uint8Array format required by Push API
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export default function NotificationPreferences({ protocolId, protocolName, onClose }: Props) {
  const [pushEnabled, setPushEnabled] = useState(true)
  const [emailEnabled, setEmailEnabled] = useState(false)
  const [reminderMinutes, setReminderMinutes] = useState(15)
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if ('Notification' in window) {
      setPushPermission(Notification.permission)
    }
  }, [])

  const requestPushPermission = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      if (!('Notification' in window)) {
        throw new Error('This browser does not support notifications')
      }

      if (!('serviceWorker' in navigator)) {
        throw new Error('This browser does not support service workers')
      }

      console.log('🔔 Requesting notification permission...')
      const permission = await Notification.requestPermission()
      setPushPermission(permission)

      if (permission !== 'granted') {
        throw new Error('Notification permission denied')
      }

      console.log('✅ Permission granted, registering push subscription...')

      // Wait for service worker to be ready
      const registration = await navigator.serviceWorker.ready
      console.log('✅ Service worker ready:', registration)

      // Get VAPID public key and convert to Uint8Array
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        throw new Error('VAPID public key not configured')
      }

      const applicationServerKey = urlBase64ToUint8Array(vapidKey)
      console.log('✅ VAPID key converted to Uint8Array')

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      })
      console.log('✅ Push subscription created:', subscription.endpoint)

      // Send subscription to server (properly serialized)
      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON() // Properly serialize subscription
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save subscription')
      }

      console.log('✅ Subscription saved to server')
      setSuccess('Push notifications enabled successfully!')

    } catch (err) {
      console.error('❌ Error setting up push notifications:', err)
      setError(err instanceof Error ? err.message : 'Failed to enable push notifications')
    } finally {
      setLoading(false)
    }
  }

  const savePreferences = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      console.log('💾 Saving notification preferences...')

      const response = await fetch('/api/notifications/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          protocolId,
          pushEnabled,
          emailEnabled,
          reminderMinutes
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save preferences')
      }

      console.log('✅ Preferences saved successfully')
      setSuccess(`Reminders set for ${protocolName}!`)

      // Close modal after brief success message
      setTimeout(() => {
        onClose()
      }, 1500)

    } catch (err) {
      console.error('❌ Error saving preferences:', err)
      setError(err instanceof Error ? err.message : 'Failed to save preferences')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
        <h3 className="text-xl font-bold text-white mb-4">
          Notification Preferences
          <div className="text-sm font-normal text-gray-400 mt-1">{protocolName}</div>
        </h3>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <span className="text-red-200 text-sm">{error}</span>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg flex items-start gap-2">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <span className="text-green-200 text-sm">{success}</span>
          </div>
        )}

        {/* Push Notifications */}
        <div className="mb-4 p-4 bg-gray-700/50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary-400" />
              <span className="text-white font-semibold">Push Notifications</span>
            </div>
            <input
              type="checkbox"
              checked={pushEnabled}
              onChange={(e) => setPushEnabled(e.target.checked)}
              disabled={pushPermission !== 'granted' || loading}
              className="w-5 h-5"
            />
          </div>

          {pushPermission !== 'granted' && (
            <button
              onClick={requestPushPermission}
              disabled={loading}
              className="text-sm text-primary-400 hover:text-primary-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Setting up...' : 'Enable push notifications →'}
            </button>
          )}

          {pushPermission === 'granted' && (
            <p className="text-xs text-green-400 mt-2">✓ Push notifications enabled</p>
          )}
        </div>

        {/* Email Notifications */}
        <div className="mb-4 p-4 bg-gray-700/50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-400" />
              <span className="text-white font-semibold">Email Reminders</span>
            </div>
            <input
              type="checkbox"
              checked={emailEnabled}
              onChange={(e) => setEmailEnabled(e.target.checked)}
              disabled={loading}
              className="w-5 h-5"
            />
          </div>
        </div>

        {/* Reminder Timing */}
        <div className="mb-6">
          <label className="text-white font-semibold mb-2 block">
            Remind me before dose:
          </label>
          <select
            value={reminderMinutes}
            onChange={(e) => setReminderMinutes(Number(e.target.value))}
            disabled={loading}
            className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
          >
            <option value={5}>5 minutes</option>
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={60}>1 hour</option>
          </select>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={savePreferences}
            disabled={loading || (pushEnabled && pushPermission !== 'granted')}
            className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-2 px-4 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save Preferences'}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-gray-400 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
