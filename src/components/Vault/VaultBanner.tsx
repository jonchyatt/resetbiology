"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Cloud, X } from "lucide-react"
import { useVaultStatus } from "@/hooks/useVaultStatus"
import { isSnoozed, snooze } from "@/hooks/useVaultPrompt"

const DISMISS_KEY = "vaultBannerDismissed"

/**
 * Portal-level invitation for unconnected users. Drive is optional (Jon
 * ruling 2026-10-11): it adds a copy the member owns.
 *
 * Hides automatically when:
 *  - User is loading status
 *  - User is already connected
 *  - User dismissed it in the last 30 days (localStorage snooze)
 */
export function VaultBanner() {
  const { loading, connected, error } = useVaultStatus()
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    setDismissed(isSnoozed(DISMISS_KEY))
  }, [])

  const handleDismiss = () => {
    if (typeof window !== "undefined") snooze(DISMISS_KEY)
    setDismissed(true)
  }

  if (loading || connected || error || dismissed) return null

  return (
    <div className="mb-8 bg-gradient-to-r from-primary-600/20 via-secondary-600/20 to-primary-600/20 border-2 border-primary-400/40 rounded-xl p-6 shadow-lg backdrop-blur-sm relative overflow-hidden">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-gray-300 hover:text-white transition-colors z-20"
        aria-label="Dismiss"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 to-secondary-500/10 animate-pulse opacity-40" />

      <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
        <div className="flex-shrink-0 bg-gradient-to-br from-primary-500/30 to-secondary-500/30 p-4 rounded-full">
          <Cloud className="w-10 h-10 text-primary-300" />
        </div>

        <div className="flex-1 text-center md:text-left">
          <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-2 justify-center md:justify-start">
            {/* src: RULING-2026-10-11 Drive option A */}
            Keep your own copy in Google Drive
          </h3>
          <p className="text-gray-200 mb-1">
            Your data is saved in your Reset Biology account. Connect Google Drive to also keep a copy in{" "}
            <span className="text-primary-300 font-semibold">a folder you own</span>.
          </p>
          <p className="text-sm text-gray-300">
            Adds progress photos, a copy you can open any time, and data you can take with you. Optional, about 30 seconds.
          </p>
        </div>

        <Link
          href="/connect-drive"
          className="action-btn-primary flex-shrink-0 inline-flex items-center gap-2 px-6 py-3 font-bold rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg whitespace-nowrap"
        >
          <Cloud className="w-5 h-5" />
          Connect Drive
        </Link>
      </div>
    </div>
  )
}
