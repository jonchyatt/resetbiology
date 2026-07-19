// Shared browser-side push-notification permission + subscribe flow.
// Extracted from NotificationPreferences.tsx so any settings surface
// (peptide modal, vision session reminders) can reuse the same behavior.

// ponytail: same hang class as PeptideTracker.setupPushSubscription —
// navigator.serviceWorker.ready never settles when no service worker is
// registered for this scope. Race it against a timeout so every caller of
// subscribeToPush() always settles instead of spinning forever.
const SERVICE_WORKER_READY_TIMEOUT_MS = 5000
function waitForServiceWorkerReady(): Promise<ServiceWorkerRegistration> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Service worker not ready (timed out)')),
        SERVICE_WORKER_READY_TIMEOUT_MS
      )
    )
  ])
}

// Convert base64 VAPID key to Uint8Array format required by Push API
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * Requests Notification permission, subscribes to push, and registers the
 * subscription with the server. Throws an Error with a plain-English
 * message on any failure (permission denied, unsupported browser, missing
 * VAPID config, subscribe failure, or server rejection) — callers should
 * check `Notification.permission` after a catch to distinguish "denied"
 * from other failures.
 */
export async function subscribeToPush(): Promise<PushSubscription> {
  if (!('Notification' in window)) {
    throw new Error('This browser does not support notifications')
  }

  if (!('serviceWorker' in navigator)) {
    throw new Error('This browser does not support service workers')
  }

  const permission = await Notification.requestPermission()

  if (permission !== 'granted') {
    throw new Error('Notification permission denied')
  }

  const registration = await waitForServiceWorkerReady()

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidKey) {
    throw new Error('Push notifications not configured on this server. Please contact support.')
  }

  if (vapidKey.length < 60 || !/^[A-Za-z0-9_-]+$/.test(vapidKey)) {
    throw new Error('Push notification configuration error. Please contact support.')
  }

  let applicationServerKey: Uint8Array
  try {
    applicationServerKey = urlBase64ToUint8Array(vapidKey)
  } catch {
    throw new Error('Push notification configuration error. Please contact support.')
  }

  let subscription: PushSubscription
  try {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as BufferSource
    })
  } catch (subscribeError: any) {
    if (subscribeError?.message?.includes('pattern')) {
      throw new Error('Push notification setup failed. The server configuration may be invalid. Please try again later or contact support.')
    }
    throw subscribeError
  }

  const response = await fetch('/api/notifications/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscription: subscription.toJSON()
    })
  })

  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.error || 'Failed to save subscription')
  }

  return subscription
}
