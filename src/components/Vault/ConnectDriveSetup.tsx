"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import {
  Cloud,
  Shield,
  CheckCircle,
  ArrowRight,
  Lock,
  HeartPulse,
  FolderOpen,
  ExternalLink,
  AlertCircle,
} from "lucide-react"
import { PortalHeader } from "@/components/Navigation/PortalHeader"
import { useVaultStatus } from "@/hooks/useVaultStatus"

const FOLDER_PREVIEW: Array<{ icon: string; label: string }> = [
  { icon: "💉", label: "Peptides" },
  { icon: "🏋️", label: "Workouts" },
  { icon: "🥗", label: "Nutrition" },
  { icon: "🌬️", label: "Breath Sessions" },
  { icon: "👁️", label: "Vision Training" },
  { icon: "🧠", label: "Memory Training" },
  { icon: "📓", label: "Journal" },
  { icon: "👤", label: "Profile" },
]

const PRINCIPLES: Array<{ icon: typeof Shield; title: string; body: string }> = [
  {
    icon: Shield,
    title: "You own every byte",
    body: "Your protocols, doses, sessions, and journal entries live in YOUR Google Drive. Reset Biology doesn't keep copies on our servers.",
  },
  {
    icon: Lock,
    title: "We can only see what we create",
    body: "The drive.file OAuth scope means our app can ONLY touch files it created in the Reset Biology folder. Nothing else in your Drive is accessible.",
  },
  {
    icon: HeartPulse,
    title: "Required for tracking + reminders",
    body: "Peptide protocols, dose schedules, push notifications, and personalized voice coaches all read from your Vault. Set it up once, then it just works.",
  },
]

export function ConnectDriveSetup() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { loading, connected, refresh } = useVaultStatus()
  const [connecting, setConnecting] = useState(false)

  const driveQueryStatus = searchParams.get("drive")
  const isJustConnected = driveQueryStatus === "connected"
  const isError = driveQueryStatus === "error"
  const isDenied = driveQueryStatus === "denied"

  useEffect(() => {
    if (driveQueryStatus) {
      refresh()
    }
  }, [driveQueryStatus, refresh])

  const handleConnect = () => {
    setConnecting(true)
    const returnTo = encodeURIComponent("/connect-drive")
    window.location.href = `/api/integrations/google-drive/connect?returnTo=${returnTo}`
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative pt-32"
      style={{
        backgroundImage:
          'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="relative z-10">
        <PortalHeader
          section="Vault Setup"
          subtitle="Sync your tracking data to your own Google Drive"
          showPeptideInfo={false}
        />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Hero */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 mb-6 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full shadow-lg">
              <Cloud className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 text-shadow-lg">
              {connected ? "Your Vault is connected" : "Set up your Reset Biology Vault"}
            </h1>
            <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto">
              {connected
                ? "All your tracking data syncs to your own Google Drive. You own it, you control it."
                : "Reset Biology stores your tracking data on YOUR Google Drive — not on our servers."}
            </p>
          </div>

          {/* Status pills (post-OAuth feedback) */}
          {isJustConnected && connected && (
            <div className="mb-8 flex items-center gap-3 bg-secondary-600/20 border border-secondary-400/40 rounded-xl p-4 backdrop-blur-sm">
              <CheckCircle className="w-6 h-6 text-secondary-300 flex-shrink-0" />
              <p className="text-secondary-100 font-medium">
                Drive connected successfully. Your Vault is ready.
              </p>
            </div>
          )}
          {isDenied && (
            <div className="mb-8 flex items-center gap-3 bg-amber-600/20 border border-amber-400/40 rounded-xl p-4 backdrop-blur-sm">
              <AlertCircle className="w-6 h-6 text-amber-300 flex-shrink-0" />
              <p className="text-amber-100 font-medium">
                Drive connection canceled. You can try again whenever you&apos;re ready.
              </p>
            </div>
          )}
          {isError && (
            <div className="mb-8 flex items-center gap-3 bg-red-600/20 border border-red-400/40 rounded-xl p-4 backdrop-blur-sm">
              <AlertCircle className="w-6 h-6 text-red-300 flex-shrink-0" />
              <p className="text-red-100 font-medium">
                Something went wrong connecting Drive. Try again or contact support.
              </p>
            </div>
          )}

          {/* Connected state — success card */}
          {connected ? (
            <div className="card-hover-primary mb-8">
              <div className="flex flex-col items-center text-center py-6">
                <div className="w-16 h-16 mb-5 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-9 h-9 text-white" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                  You&apos;re all set!
                </h2>
                <p className="text-gray-300 mb-6 max-w-xl">
                  Every protocol, dose, workout, meal, breath session, vision drill, and journal entry now syncs to your{" "}
                  <span className="text-primary-300 font-semibold">Reset Biology Data</span> folder in Google Drive.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href="https://drive.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="action-btn-secondary inline-flex items-center justify-center gap-2 px-6 py-3 font-semibold rounded-lg transition-all"
                  >
                    <ExternalLink className="w-5 h-5" />
                    Open my Vault in Google Drive
                  </a>
                  <button
                    onClick={() => router.push("/portal")}
                    className="action-btn-primary inline-flex items-center justify-center gap-2 px-6 py-3 font-bold rounded-lg transition-all"
                  >
                    Continue to Portal
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Principles */}
              <div className="grid md:grid-cols-3 gap-4 mb-8">
                {PRINCIPLES.map(({ icon: Icon, title, body }) => (
                  <div key={title} className="card-hover-secondary">
                    <div className="flex flex-col items-center text-center p-2">
                      <div className="w-12 h-12 mb-3 bg-primary-500/20 rounded-full flex items-center justify-center">
                        <Icon className="w-6 h-6 text-primary-300" />
                      </div>
                      <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                      <p className="text-sm text-gray-300">{body}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Folder preview */}
              <div className="card-hover-primary mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <FolderOpen className="w-6 h-6 text-primary-300" />
                  <h2 className="text-xl md:text-2xl font-bold text-white">
                    What we&apos;ll create in your Drive
                  </h2>
                </div>
                <p className="text-gray-300 text-sm mb-5">
                  A single folder named{" "}
                  <code className="text-primary-300 bg-gray-800/60 px-2 py-0.5 rounded">
                    Reset Biology Data
                  </code>{" "}
                  with these subfolders:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {FOLDER_PREVIEW.map((f) => (
                    <div
                      key={f.label}
                      className="flex items-center gap-2 bg-gray-800/40 border border-gray-700/40 rounded-lg px-3 py-2"
                    >
                      <span className="text-2xl" aria-hidden="true">
                        {f.icon}
                      </span>
                      <span className="text-sm text-gray-200">{f.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div className="card-hover-primary">
                <div className="flex flex-col items-center text-center py-4">
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
                    Ready to connect?
                  </h2>
                  <p className="text-gray-300 mb-6 max-w-xl">
                    Google will ask permission to create files in your Drive. We use the{" "}
                    <code className="text-primary-300 bg-gray-800/60 px-2 py-0.5 rounded text-xs">
                      drive.file
                    </code>{" "}
                    scope — we can only see files we create. Nothing else in your Drive is accessible to us.
                  </p>
                  <button
                    onClick={handleConnect}
                    disabled={connecting || loading}
                    className="action-btn-primary inline-flex items-center gap-2 px-8 py-4 font-bold text-lg rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {connecting ? (
                      <>
                        <Cloud className="w-6 h-6 animate-pulse" />
                        Redirecting to Google…
                      </>
                    ) : (
                      <>
                        <Cloud className="w-6 h-6" />
                        Connect Google Drive
                      </>
                    )}
                  </button>
                  <p className="mt-4 text-xs text-gray-400">
                    Already have an account connected?{" "}
                    <button
                      onClick={() => router.push("/profile")}
                      className="text-primary-300 hover:text-primary-200 underline"
                    >
                      Manage in Profile
                    </button>
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
