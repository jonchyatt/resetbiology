"use client"

import { Cloud, Lock, X } from "lucide-react"
import Link from "next/link"
import { useVaultPrompt } from "@/hooks/useVaultPrompt"

export interface VaultPromptModalProps {
  /** Page identifier — used for copy. e.g. "Peptide Tracker", "Workout Tracker". */
  trackerName?: string
  /** What's the user trying to do? Used in the modal's value prop. */
  trackerVerb?: string // e.g. "log doses", "log workouts", "log nutrition"
}

/**
 * Just-in-time modal that fires on tracking pages when the user has not
 * yet connected their Google Drive Vault. Soft-block: user can dismiss
 * for the session, but the page makes clear that tracking-feature data
 * persistence requires a connected Vault.
 *
 * Visual canon mirrors AgeVerificationModal — same shell, primary→secondary
 * gradient CTA, gray-900 inner. ui-specialist confirmed this is the
 * canonical first-touch modal pattern.
 */
export function VaultPromptModal({
  trackerName = "this tracker",
  trackerVerb = "save your data",
}: VaultPromptModalProps) {
  const { shouldPrompt, dismiss } = useVaultPrompt()

  if (!shouldPrompt) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vault-prompt-title"
    >
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl border border-primary-400/20 relative">
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center mb-6">
          <div className="bg-primary-500/20 p-4 rounded-full mb-4">
            <Cloud className="w-12 h-12 text-primary-400" />
          </div>
          <h2 id="vault-prompt-title" className="text-2xl md:text-3xl font-bold text-white text-center">
            Set up your Vault
          </h2>
          <p className="text-sm text-primary-300 mt-2 flex items-center gap-1.5">
            <Lock className="w-4 h-4" aria-hidden="true" />
            Required for {trackerName}
          </p>
        </div>

        <div className="mb-8 text-center">
          <p className="text-gray-200 text-base mb-4">
            Reset Biology stores your tracking data on{" "}
            <span className="text-primary-300 font-semibold">your own Google Drive</span> —
            you own it, we don&apos;t keep copies.
          </p>
          <p className="text-gray-400 text-sm mb-2">
            Connect once to {trackerVerb}, get personalized coaching from your voice agents,
            and receive dose reminders. Takes about 30 seconds.
          </p>
          <p className="text-xs text-gray-500 italic">
            We can only see files we create. Nothing else in your Drive is accessible to us.
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href="/connect-drive"
            className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-primary-500/50"
          >
            <Cloud className="w-5 h-5" />
            Set up my Vault
          </Link>

          <button
            onClick={dismiss}
            className="w-full inline-flex items-center justify-center gap-2 bg-gray-800/60 hover:bg-gray-700/70 text-gray-200 font-medium py-3 px-6 rounded-lg border border-gray-700 transition-all"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  )
}
