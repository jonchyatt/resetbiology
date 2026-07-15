"use client"

import { Cloud, X } from "lucide-react"

interface DisconnectVaultModalProps {
  open: boolean
  loading: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Custom-styled replacement for the bare window.confirm() on the Disconnect
 * action. Frames disconnect honestly: syncing stops, existing files stay the
 * client's, reconnect picks the same folder back up.
 */
export function DisconnectVaultModal({ open, loading, onConfirm, onCancel }: DisconnectVaultModalProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disconnect-vault-title"
    >
      <div className="card-hover-primary max-w-md w-full relative">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          aria-label="Cancel"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4 mb-4">
          <div className="p-3 bg-blue-500/20 rounded-lg flex-shrink-0">
            <Cloud className="w-7 h-7 text-blue-400" />
          </div>
          <h3 id="disconnect-vault-title" className="text-xl font-bold text-white pt-1">
            Disconnect Google Drive?
          </h3>
        </div>

        <ul className="text-sm text-gray-300 space-y-2 mb-6 list-disc list-inside">
          <li>Syncing to your Drive stops immediately.</li>
          <li>Every file already in your Drive stays yours — nothing is deleted.</li>
          <li>Reconnect anytime and we&apos;ll pick up your existing folder, not a new one.</li>
        </ul>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            Keep it connected
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? "Disconnecting..." : "Disconnect"}
          </button>
        </div>
      </div>
    </div>
  )
}
