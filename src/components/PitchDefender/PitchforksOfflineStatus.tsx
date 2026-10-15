'use client'

import { useEffect, useState } from 'react'

const SW_PATH = '/pitchforks-service-worker.js'

export function PitchforksOfflineStatus() {
  const [online, setOnline] = useState(true)
  const [ready, setReady] = useState(false)
  const [updateReady, setUpdateReady] = useState(false)
  const [cacheError, setCacheError] = useState(false)

  useEffect(() => {
    setOnline(navigator.onLine)
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    let registration: ServiceWorkerRegistration | undefined
    const register = async () => {
      if (!('serviceWorker' in navigator)) return
      registration = await navigator.serviceWorker.register(SW_PATH, { scope: '/pitch-defender/pitchforks-3' })
      setReady(Boolean(registration.active))
      registration.active?.postMessage({ type: 'PRECACHE_ROUTE' })
      registration.addEventListener('updatefound', () => {
        const worker = registration?.installing
        if (!worker) return
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) setUpdateReady(true)
        })
      })
    }
    register().catch(() => setCacheError(true))

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const retry = async () => {
    setCacheError(false)
    try {
      const registration = await navigator.serviceWorker.getRegistration('/pitch-defender/pitchforks-3')
      await registration?.update()
      registration?.active?.postMessage({ type: 'PRECACHE_ROUTE' })
      setReady(true)
    } catch {
      setCacheError(true)
    }
  }

  const safeReload = () => window.location.reload()

  return (
    <aside
      aria-live="polite"
      aria-label="Practice availability"
      style={{
        position: 'fixed', top: 12, right: 12, zIndex: 100,
        maxWidth: 250, padding: '8px 10px', borderRadius: 8,
        background: 'rgba(7, 9, 20, .88)', color: '#d7f8ff',
        border: '1px solid rgba(116, 224, 242, .35)', font: '12px/1.35 monospace',
      }}
    >
      <div>{online ? (ready ? 'Practice shell saved for offline play' : 'Preparing offline practice…') : 'Offline practice mode'}</div>
      {cacheError && <div role="alert">This build is not cached yet.</div>}
      {!online && <button type="button" onClick={retry}>Retry connection</button>}
      {updateReady && <button type="button" onClick={safeReload}>Safe reload update</button>}
    </aside>
  )
}
