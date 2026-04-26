"use client"

import { useEffect, useState } from "react"
import { useVaultStatus } from "./useVaultStatus"

const DISMISS_KEY = "vaultPromptDismissed"

/**
 * Per-tracking-page just-in-time prompt to connect Drive Vault.
 *
 * Returns `shouldPrompt: true` when ALL of these hold:
 *   - Status loaded
 *   - User NOT connected to Drive
 *   - User has NOT dismissed the prompt in this session
 *
 * Dismissal is per-session (sessionStorage). Persistent dismissal would
 * hide a required setup step too easily — codex review explicitly
 * endorsed session-scoped TTL.
 */
export function useVaultPrompt() {
  const status = useVaultStatus()
  const [dismissed, setDismissed] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "true")
    setHydrated(true)
  }, [])

  const dismiss = () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(DISMISS_KEY, "true")
    }
    setDismissed(true)
  }

  const shouldPrompt =
    hydrated && !status.loading && !status.connected && !dismissed

  return {
    shouldPrompt,
    dismiss,
    refresh: status.refresh,
  }
}
