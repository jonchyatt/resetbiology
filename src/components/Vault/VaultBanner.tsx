"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Cloud, Lock, X } from "lucide-react"
import { useVaultStatus } from "@/hooks/useVaultStatus"

const DISMISS_KEY = "vaultBannerDismissed"

/**
 * Portal-level soft prompt for unconnected users.
 * Encourages users to connect their Google Drive Vault — the architectural
 * core of Reset Biology's data-sovereignty model.
 *
 * Hides automatically when:
 *  - User is loading status
 *  - User is already connected
 *  - User dismissed in this session (sessionStorage)
 */
export function VaultBanner() {
  const { loading, connected } = useVaultStatus()
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "true")
  }, [])

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(DISMISS_KEY, "true")
    }
    setDismissed(true)
  }

  if (loading || connected || dismissed) return null

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
            Set up your Reset Biology Vault
            <Lock className="w-5 h-5 text-primary-300" aria-hidden="true" />
          </h3>
          <p className="text-gray-200 mb-1">
            Reset Biology stores your tracking data on{" "}
            <span className="text-primary-300 font-semibold">your own Google Drive</span> — you own it,
            we don&apos;t keep copies.
          </p>
          <p className="text-sm text-gray-300">
            Required for peptide tracking, dose reminders, and personalized voice coaches. ~30 seconds.
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
