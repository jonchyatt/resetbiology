'use client'
import { useState, useEffect } from 'react'
import { Bell, Mail, X } from 'lucide-react'

interface Props {
  protocolId: string
  protocolName: string
  onClose: () => void
}

export default function NotificationPreferences({ protocolId, protocolName, onClose }: Props) {
  const [pushEnabled, setPushEnabled] = useState(true)
  const [emailEnabled, setEmailEnabled] = useState(false)
  const [reminderMinutes, setReminderMinutes] = useState(15)
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if ('Notification' in window) {
      setPushPermission(Notification.permission)
    }
  }, [])

  const requestPushPermission = async () => {
    if ('Notification' in window && 'serviceWorker' in navigator) {
      const permission = await Notification.requestPermission()
      setPushPermission(permission)

      if (permission === 'granted') {
        // Subscribe to push
        const registration = await navigator.serviceWorker.ready

        // Convert VAPID key from base64 to Uint8Array
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        const convertedKey = Uint8Array.from(
          atob(vapidPublicKey.replace(/-/g, '+').replace(/_/g, '/')),
          c => c.charCodeAt(0)
        )

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey
        })

        // Send to server
        await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription })
        })
      }
    }
  }

  const savePreferences = async () => {
    setLoading(true)
    try {
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

      if (response.ok) {
        alert('Notification preferences saved!')
        onClose()
      } else {
        alert('Failed to save preferences')
      }
    } catch (error) {
      console.error('Error saving preferences:', error)
      alert('Failed to save preferences')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 max-w-md w-full border border-primary-400/30 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white">Dose Reminders</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4">
          <p className="text-gray-300 text-sm">
            Set reminders for: <span className="font-semibold text-primary-300">{protocolName}</span>
          </p>
        </div>

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
              disabled={pushPermission !== 'granted'}
              className="w-5 h-5 rounded"
            />
          </div>

          {pushPermission !== 'granted' && (
            <button
              onClick={requestPushPermission}
              className="text-sm text-primary-400 hover:text-primary-300 transition-colors"
            >
              Enable push notifications →
            </button>
          )}

          {pushPermission === 'granted' && (
            <p className="text-xs text-gray-400 mt-1">Get reminders even when the app is closed</p>
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
              className="w-5 h-5 rounded"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">Receive email reminders as backup</p>
        </div>

        {/* Reminder Timing */}
        <div className="mb-6">
          <label className="text-white font-semibold mb-2 block">
            Remind me before dose:
          </label>
          <select
            value={reminderMinutes}
            onChange={(e) => setReminderMinutes(Number(e.target.value))}
            className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-primary-400 focus:outline-none"
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
            disabled={loading}
            className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-3 px-4 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save Preferences'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-3 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
