"use client"

import { useEffect, useState } from "react"

export interface VaultStatus {
  loading: boolean
  connected: boolean
  folderId: string | null
  connectedAt: string | null
  syncEnabled: boolean
  error?: string
}

const INITIAL: VaultStatus = {
  loading: true,
  connected: false,
  folderId: null,
  connectedAt: null,
  syncEnabled: false,
}

export function useVaultStatus(): VaultStatus & { refresh: () => Promise<void> } {
  const [status, setStatus] = useState<VaultStatus>(INITIAL)

  const refresh = async () => {
    try {
      const res = await fetch("/api/integrations/google-drive/status", {
        credentials: "include",
        cache: "no-store",
      })
      if (!res.ok) {
        setStatus({ ...INITIAL, loading: false, error: `status ${res.status}` })
        return
      }
      const data = await res.json()
      setStatus({
        loading: false,
        connected: !!data.connected,
        folderId: data.folderId ?? null,
        connectedAt: data.connectedAt ?? null,
        syncEnabled: !!data.syncEnabled,
      })
    } catch (err) {
      setStatus({
        ...INITIAL,
        loading: false,
        error: err instanceof Error ? err.message : "unknown",
      })
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  return { ...status, refresh }
}
