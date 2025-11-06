'use client'
import { useState, useEffect } from 'react'
import { Bell, Mail, AlertCircle, CheckCircle, Zap } from 'lucide-react'

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

  // Hidden test button state
  const [clickCount, setClickCount] = useState(0)
  const [showTestButton, setShowTestButton] = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const [testCountdown, setTestCountdown] = useState<number | null>(null)

  useEffect(() => {
    if ('Notification' in window) {
      setPushPermission(Notification.permission)
    }
  }, [])

  // Triple-click detection for test button
  useEffect(() => {
    if (clickCount >= 3) {
      setShowTestButton(prev => !prev) // Toggle test mode
      console.log(showTestButton ? '🚫 Test mode deactivated' : '🧪 Test mode activated!')
    }
    const timer = setTimeout(() => setClickCount(0), 1000) // Reset after 1 second
    return () => clearTimeout(timer)
  }, [clickCount, showTestButton])

  // Countdown timer for test notification
  useEffect(() => {
    if (testCountdown === null || testCountdown <= 0) return

    const timer = setInterval(() => {
      setTestCountdown(prev => {
        if (prev === null || prev <= 1) {
          return null
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [testCountdown])

  const sendTestNotification = async () => {
    setTestLoading(true)
    setError(null)
    setSuccess(null)

    try {
      console.log('🧪 Creating test notification...')

      const response = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delaySeconds: 60 })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create test notification')
      }

      const data = await response.json()
      console.log('✅ Test notification created:', data)

      setSuccess(`Test notification scheduled! Will arrive in 60 seconds...`)
      setTestCountdown(60)

    } catch (err) {
      console.error('❌ Error creating test notification:', err)
      setError(err instanceof Error ? err.message : 'Failed to create test notification')
    } finally {
      setTestLoading(false)
    }
  }

  const sendNow = async () => {
    setTestLoading(true)
    setError(null)
    setSuccess(null)

    try {
      console.log('⚡ Triggering immediate send...')

      const response = await fetch('/api/notifications/send-now', {
        method: 'POST'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to send notifications')
      }

      const data = await response.json()
      console.log('✅ Send triggered:', data)

      if (data.sent > 0) {
        setSuccess(`Sent ${data.sent} notification(s) immediately!`)
      } else {
        setSuccess('No pending notifications to send')
      }

      setTestCountdown(null)

    } catch (err) {
      console.error('❌ Error sending notifications:', err)
      setError(err instanceof Error ? err.message : 'Failed to send notifications')
    } finally {
      setTestLoading(false)
    }
  }

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
        applicationServerKey: applicationServerKey as BufferSource
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
        <h3
          className="text-xl font-bold text-white mb-4 cursor-default"
          onClick={() => setClickCount(prev => prev + 1)}
        >
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

        {/* Hidden Test Section */}
        {showTestButton && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-5 h-5 text-yellow-400" />
              <span className="text-yellow-400 font-semibold">Test Mode</span>
            </div>

            {testCountdown !== null && (
              <div className="mb-3 p-2 bg-gray-700/50 rounded text-center">
                <div className="text-2xl font-mono text-white">{testCountdown}s</div>
                <div className="text-xs text-gray-400">until test notification</div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={sendTestNotification}
                disabled={testLoading || loading || testCountdown !== null}
                className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black py-2 px-3 rounded-lg font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testLoading ? 'Creating...' : 'Test (60s)'}
              </button>
              <button
                onClick={sendNow}
                disabled={testLoading || loading || testCountdown === null}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-3 rounded-lg font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testLoading ? 'Sending...' : 'Send Now'}
              </button>
            </div>

            <p className="text-xs text-gray-400 mt-2">
              Triple-click title to hide test mode
            </p>
          </div>
        )}

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
