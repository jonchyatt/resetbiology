"use client"

import { useEffect, useState } from "react"
import { useVaultStatus } from "./useVaultStatus"

const DISMISS_KEY = "vaultPromptDismissed"
// Shown once per browser: set the first time the prompt is displayed, never cleared.
const SEEN_KEY = "vaultPromptSeen"
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000

/** True if `key` holds a snooze timestamp under 30 days old. Storage can throw (private mode): treat as not snoozed. */
export function isSnoozed(key: string): boolean {
  try {
    const at = Number(localStorage.getItem(key))
    return Number.isFinite(at) && at > 0 && Date.now() - at < SNOOZE_MS
  } catch {
    return false
  }
}

/** Remember "Not now" for 30 days. Best-effort: storage can throw in private mode. */
export function snooze(key: string): void {
  try {
    localStorage.setItem(key, String(Date.now()))
  } catch {
    // ignore: the in-memory dismissal still hides it for this visit
  }
}

/**
 * Per-tracking-page just-in-time prompt to connect Drive Vault.
 *
 * Returns `shouldPrompt: true` when ALL of these hold:
 *   - Status loaded
 *   - User NOT connected to Drive
 *   - User has NOT said "Not now" in the last 30 days
 *
 * Drive is optional (Jon ruling 2026-10-11): 'Not now' is remembered for 30 days.
 */
export function useVaultPrompt() {
  const status = useVaultStatus()
  const [dismissed, setDismissed] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [seenBefore, setSeenBefore] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    setDismissed(isSnoozed(DISMISS_KEY))
    try { setSeenBefore(localStorage.getItem(SEEN_KEY) === "1") } catch { /* storage blocked: fall back to the 30-day snooze */ }
    setHydrated(true)
  }, [])

  const dismiss = () => {
    if (typeof window !== "undefined") snooze(DISMISS_KEY)
    setDismissed(true)
  }

  const shouldPrompt =
    hydrated && !status.loading && !status.error && !status.connected && !dismissed && !seenBefore

  useEffect(() => {
    if (!shouldPrompt) return
    try { localStorage.setItem(SEEN_KEY, "1") } catch { /* ignore */ }
  }, [shouldPrompt])

  return {
    shouldPrompt,
    dismiss,
    refresh: status.refresh,
  }
}
