"use client"

import { useState } from "react"
import Link from "next/link"
import { Sparkles, Cloud, Apple, Compass, Check, X } from "lucide-react"
import { useVaultStatus } from "@/hooks/useVaultStatus"

export interface OnboardingStatus {
  onboardingComplete: boolean
  driveConnected: boolean
  firstWinDone: boolean
  grandfatherEligible: boolean
}

interface OnboardingGuideProps {
  /** REASON CONTRACT v1.1 — reused from EnhancedDashboard's existing fetch, never re-fetched here. */
  reason: string | null
  firstName: string
  /** Daily-task list length, derived (never hardcoded "6" — v2 COPY TRUTH MED-3). */
  taskCount: number
  status: OnboardingStatus
  onComplete: () => void
}

/**
 * First-run guided flow (FLOW-SPEC T6). Four-step progressive card, never a
 * modal wall — the portal grid renders underneath regardless of this
 * component's state. Steps 1/4 are informational; steps 2/3 derive their
 * "done" state from existing signals (no new columns). The only persisted
 * bit anywhere in this flow is User.onboardingComplete, set by the single
 * explicit action below (or by the parent's silent grandfather POST).
 */
export function OnboardingGuide({ reason, firstName, taskCount, status, onComplete }: OnboardingGuideProps) {
  const [expanded, setExpanded] = useState(true)
  const [completing, setCompleting] = useState(false)
  // Drive connect/error/unavailable states already live in this hook
  // (VaultBanner uses the same one) — reused rather than re-implemented,
  // and it never touches rb-drive-vault's internals, just its public status API.
  const vault = useVaultStatus()

  const driveDone = status.driveConnected || vault.connected
  const firstWinDone = status.firstWinDone

  const handleDone = async () => {
    setCompleting(true)
    try {
      const res = await fetch('/api/onboarding/complete', { method: 'POST' })
      if (res.ok) {
        onComplete()
        return
      }
    } catch {
      // network hiccup — button re-enables, member can just try again
    }
    setCompleting(false)
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-teal-600/20 border border-teal-400/30 rounded-full text-teal-200 text-sm hover:bg-teal-600/30 transition-colors"
      >
        <Compass className="w-4 h-4" />
        Finish setup
      </button>
    )
  }

  return (
    <div className="mb-8 bg-gray-800/40 border border-teal-400/30 rounded-xl p-6 backdrop-blur-sm relative">
      <button
        type="button"
        onClick={() => setExpanded(false)}
        className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
        aria-label="Minimize setup"
      >
        <X className="w-5 h-5" />
      </button>

      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-teal-300" />
        Getting started
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Step 1 — welcome + reason echo (informational, no persisted state) */}
        <div className="p-4 bg-gray-700/30 rounded-lg border border-gray-600/30">
          <p className="text-white font-semibold mb-1">Welcome, {firstName}.</p>
          {reason ? (
            <p className="text-gray-300 text-sm italic">You said: &ldquo;{reason}&rdquo;</p>
          ) : (
            <p className="text-gray-400 text-sm italic">Your first check-in will ask for your reason — it powers everything here.</p>
          )}
        </div>

        {/* Step 2 — attach your vault (derived: googleDriveConnectedAt) */}
        <div className="p-4 bg-gray-700/30 rounded-lg border border-gray-600/30">
          <div className="flex items-center gap-2 mb-1">
            <Cloud className="w-4 h-4 text-teal-300" />
            <p className="text-white font-semibold">Attach your vault</p>
            {driveDone && <Check className="w-4 h-4 text-green-400" />}
          </div>
          {driveDone ? (
            <p className="text-gray-300 text-sm">Connected — backs up to your own Google Drive.</p>
          ) : vault.error ? (
            // ponytail: hook only exposes one error signal (status-check failure) —
            // no distinct "connect flow failed" vs "temporarily unavailable" wire
            // exists in the app today, so this one honest, non-blocking copy covers
            // both spec states (actionable retry + skip-for-now).
            <p className="text-gray-400 text-sm">
              Vault status temporarily unavailable —{' '}
              <button type="button" onClick={() => vault.refresh()} className="text-teal-300 underline">retry</button>
              {' '}or{' '}
              <Link href="/connect-drive" className="text-teal-300 underline">skip for now</Link>.
            </p>
          ) : (
            <p className="text-gray-400 text-sm">
              Backs up to your own Google Drive.{' '}
              <Link href="/connect-drive" className="text-teal-300 underline">Connect Drive</Link>
            </p>
          )}
        </div>

        {/* Step 3 — first win (derived: any FoodLog OR DailyTask row) */}
        <div className="p-4 bg-gray-700/30 rounded-lg border border-gray-600/30">
          <div className="flex items-center gap-2 mb-1">
            <Apple className="w-4 h-4 text-amber-300" />
            <p className="text-white font-semibold">Log your first meal</p>
            {firstWinDone && <Check className="w-4 h-4 text-green-400" />}
          </div>
          {firstWinDone ? (
            <p className="text-gray-300 text-sm">Nice — you&apos;ve logged your first entry.</p>
          ) : (
            <p className="text-gray-400 text-sm">
              Let&apos;s protect your protein.{' '}
              <Link href="/nutrition" className="text-teal-300 underline">Log a meal</Link>
            </p>
          )}
        </div>

        {/* Step 4 — how this works (informational, no persisted state) */}
        <div className="p-4 bg-gray-700/30 rounded-lg border border-gray-600/30">
          <p className="text-white font-semibold mb-1">How this works</p>
          <ul className="text-gray-400 text-sm space-y-1">
            <li>Daily check-in — {taskCount} tasks, build your streak</li>
            <li>Modules — mind first</li>
            <li>Journal — your record. <Link href="/education" className="text-teal-300 underline">Learn more</Link></li>
          </ul>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={handleDone}
          disabled={completing}
          className={`px-5 py-2 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 ${
            driveDone && firstWinDone
              ? 'bg-teal-500 hover:bg-teal-600 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
          }`}
        >
          {completing ? 'Saving…' : 'Done — take me to my day'}
        </button>
      </div>
    </div>
  )
}
