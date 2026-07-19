'use client'

import { useEffect, useState } from 'react'
import { Bell, Mail, Clock, AlertCircle, CheckCircle } from 'lucide-react'
import { subscribeToPush } from '@/lib/pushSubscribe'

const DEFAULT_TIME = '08:00'
const HH_MM_RE = /^([01]\d|2[0-3]):[0-5]\d$/

interface VisionNotificationPreference {
  pushEnabled: boolean
  emailEnabled: boolean
  dailyReminderTime: string | null
  timezone: string
}

// Session reminders card for enrolled vision-training users. Persists
// through the existing /api/notifications/preferences API (protocolType:
// "vision") — the server derives the enrollment from the authenticated
// session, so this component never sends an enrollment/protocol id.
export default function SessionRemindersCard() {
  const [pushEnabled, setPushEnabled] = useState(false)
  const [emailEnabled, setEmailEnabled] = useState(false)
  const [dailyReminderTime, setDailyReminderTime] = useState(DEFAULT_TIME)
  const [timezone, setTimezone] = useState(() =>
    typeof window === 'undefined' ? 'UTC' : Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  )
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default')
  const [initializing, setInitializing] = useState(true)
  const [subscribing, setSubscribing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [deniedNote, setDeniedNote] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushPermission(Notification.permission)
    }
    const controller = new AbortController()
    const loadPreference = async () => {
      try {
        const res = await fetch('/api/notifications/preferences?protocolType=vision', {
          signal: controller.signal,
          credentials: 'include'
        })
        if (!res.ok) return
        const data = await res.json()
        const pref: VisionNotificationPreference | null = data.preference
        if (pref) {
          setPushEnabled(pref.pushEnabled)
          setEmailEnabled(pref.emailEnabled)
          setDailyReminderTime(pref.dailyReminderTime || DEFAULT_TIME)
          if (pref.timezone) setTimezone(pref.timezone)
          // Saved pref says push on, but this browser blocks notifications —
          // surface the unblock instructions immediately, not on interaction.
          if (
            pref.pushEnabled &&
            typeof window !== 'undefined' &&
            'Notification' in window &&
            Notification.permission === 'denied'
          ) {
            setDeniedNote(true)
          }
        }
      } catch (err) {
        console.warn('Failed to load vision reminder preference', err)
      } finally {
        setInitializing(false)
      }
    }
    loadPreference()
    return () => controller.abort()
  }, [])

  const save = async (overrides: Partial<{ pushEnabled: boolean; emailEnabled: boolean; dailyReminderTime: string }> = {}) => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          protocolType: 'vision',
          pushEnabled: overrides.pushEnabled ?? pushEnabled,
          emailEnabled: overrides.emailEnabled ?? emailEnabled,
          dailyReminderTime: overrides.dailyReminderTime ?? dailyReminderTime,
          timezone
        })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save reminder settings')
      }
      setSuccess('Reminders saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save reminder settings')
    } finally {
      setSaving(false)
    }
  }

  const handlePushToggle = async (checked: boolean) => {
    setError(null)
    setSuccess(null)
    setDeniedNote(false)

    if (!checked) {
      setPushEnabled(false)
      await save({ pushEnabled: false })
      return
    }

    // Always run the subscribe flow, even when permission is already
    // granted — pushManager.subscribe is idempotent and this guarantees a
    // live subscription actually exists for THIS browser before we save
    // pushEnabled=true (verifier finding: pre-granted permission with a
    // pruned/never-registered subscription would otherwise toggle on and
    // silently never deliver).
    setSubscribing(true)
    try {
      await subscribeToPush()
      setPushPermission('granted')
      setPushEnabled(true)
      await save({ pushEnabled: true })
    } catch (err) {
      const supportsNotification = typeof window !== 'undefined' && 'Notification' in window
      const perm = supportsNotification ? Notification.permission : 'default'
      setPushPermission(perm)
      setPushEnabled(false)
      if (supportsNotification && perm === 'denied') {
        setDeniedNote(true)
      } else {
        setError(err instanceof Error ? err.message : 'Failed to enable push notifications')
      }
    } finally {
      setSubscribing(false)
    }
  }

  const handleEmailToggle = async (checked: boolean) => {
    setEmailEnabled(checked)
    await save({ emailEnabled: checked })
  }

  const handleTimeChange = async (value: string) => {
    setDailyReminderTime(value)
    if (!HH_MM_RE.test(value)) return
    await save({ dailyReminderTime: value })
  }

  const busy = initializing || subscribing || saving

  return (
    <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-4 border border-primary-400/20">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-primary-500/20 rounded-lg">
          <Bell className="w-5 h-5 text-primary-400" />
        </div>
        <div>
          <div className="text-white font-semibold">Session Reminders</div>
          <div className="text-gray-400 text-sm">Get nudged at the same time every day</div>
        </div>
      </div>

      {error && (
        <div className="mb-3 p-3 bg-red-500/20 border border-red-500/50 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <span className="text-red-200 text-sm">{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-3 p-3 bg-green-500/20 border border-green-500/50 rounded-lg flex items-start gap-2">
          <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
          <span className="text-green-200 text-sm">{success}</span>
        </div>
      )}

      {deniedNote && (
        <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded">
          <p className="text-xs text-red-400 font-medium">Notifications are blocked by your browser.</p>
          <p className="text-xs text-red-300/80 mt-1">
            To enable: tap the lock/info icon in your address bar → Site Settings → Notifications → Allow, then try again.
          </p>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4 py-1">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary-400" />
            <span className="text-white font-medium">Daily time</span>
          </div>
          <input
            type="time"
            value={dailyReminderTime}
            onChange={(e) => handleTimeChange(e.target.value)}
            disabled={busy}
            className="bg-gray-700 text-white text-lg px-3 py-2 rounded-lg disabled:opacity-50 min-w-[7.5rem]"
          />
        </div>

        <div className="flex items-center justify-between gap-4 py-1">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary-400" />
            <span className="text-white font-medium">Push notification</span>
          </div>
          <button
            type="button"
            aria-pressed={pushEnabled}
            onClick={() => handlePushToggle(!pushEnabled)}
            disabled={busy}
            className={`relative h-7 w-12 rounded-full transition-colors disabled:opacity-50 ${
              pushEnabled ? 'bg-secondary-500' : 'bg-gray-600'
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                pushEnabled ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between gap-4 py-1">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-400" />
            <span className="text-white font-medium">Email reminder</span>
          </div>
          <button
            type="button"
            aria-pressed={emailEnabled}
            onClick={() => handleEmailToggle(!emailEnabled)}
            disabled={busy}
            className={`relative h-7 w-12 rounded-full transition-colors disabled:opacity-50 ${
              emailEnabled ? 'bg-secondary-500' : 'bg-gray-600'
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                emailEnabled ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>
      </div>

      {saving && <p className="text-xs text-gray-400 mt-3">Saving…</p>}
    </div>
  )
}
