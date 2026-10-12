"use client"

import { Cloud, X } from "lucide-react"
import Link from "next/link"
import { useVaultPrompt } from "@/hooks/useVaultPrompt"

export interface VaultPromptModalProps {
  /** Page identifier — used for copy. e.g. "Peptide Tracker", "Workout Tracker". */
  trackerName?: string
  /** What's the user trying to do? Used in the modal's value prop. */
  trackerVerb?: string // e.g. "log doses", "log workouts", "log nutrition"
}

/**
 * Just-in-time invitation on tracking pages when the user has not yet
 * connected Google Drive. Drive is OPTIONAL (Jon ruling 2026-10-11, Drive
 * option A): everything is already saved in the account; Drive adds a copy
 * the member owns. "Not now" is remembered for 30 days (useVaultPrompt).
 *
 * Visual canon mirrors AgeVerificationModal — same shell, primary→secondary
 * gradient CTA, gray-900 inner. ui-specialist confirmed this is the
 * canonical first-touch modal pattern.
 */
// ponytail: trackerName/trackerVerb stay in the props (four pages pass them) but the
// optional-Drive copy no longer names the tracker; drop them when those pages are next touched.
export function VaultPromptModal(_props: VaultPromptModalProps) {
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
            {/* src: RULING-2026-10-11 Drive option A */}
            Keep your own copy in Google Drive
          </h2>
          <p className="text-sm text-primary-300 mt-2">
            Optional · about 30 seconds
          </p>
        </div>

        <div className="mb-8 text-center">
          <p className="text-gray-200 text-base mb-4">
            {/* src: RULING-2026-10-11 Drive option A */}
            Everything you log is already saved in your Reset Biology account. Connect Google
            Drive and we also keep a copy in{" "}
            <span className="text-primary-300 font-semibold">a folder you own</span>.
          </p>
          <p className="text-gray-400 text-sm mb-2">
            Drive adds progress photos, a copy you can open any time, and data you can take
            with you. Your voice coaches can also use your history.
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
            Connect Google Drive
          </Link>

          <button
            onClick={dismiss}
            className="w-full inline-flex items-center justify-center gap-2 bg-gray-800/60 hover:bg-gray-700/70 text-gray-200 font-medium py-3 px-6 rounded-lg border border-gray-700 transition-all"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}
