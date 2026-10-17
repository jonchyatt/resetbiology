"use client"

import { useState } from "react"
import { getSellerUrl, SELLER_REFERRAL_NOTE } from "@/config/sellerLinks"

// Reset Biology takes no money (RULING-2026-10-17): every outbound seller link goes
// through a visible hand-off so the free site and the selling site stay separate.
export function VisitSellerButton({ sellerKey, className }: { sellerKey?: string; className: string }) {
  const url = getSellerUrl(sellerKey)
  const [confirming, setConfirming] = useState(false)

  if (!url) {
    return (
      <>
        <button type="button" disabled className={`${className} opacity-60 cursor-not-allowed`}>
          Seller link coming soon
        </button>
        <p className="text-xs text-gray-500 text-center mt-2">{SELLER_REFERRAL_NOTE}</p>
      </>
    )
  }

  return (
    <>
      {confirming ? (
        <div role="dialog" aria-label="Leaving Reset Biology" className="rounded-xl border border-white/20 bg-black/40 p-4 text-center">
          <p className="font-semibold text-white">You are leaving Reset Biology</p>
          <p className="mt-1 text-sm text-gray-300">
            Reset Biology sells nothing. This seller is a separate business with its own checkout and terms.
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="action-btn-primary rounded-lg px-4 py-2 font-semibold"
              onClick={() => setConfirming(false)}
            >
              Continue to seller
            </a>
            <button type="button" onClick={() => setConfirming(false)} className="rounded-lg border border-white/30 px-4 py-2 text-white">
              Stay here
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className={`block w-full text-center ${className}`}>
          Visit seller
        </button>
      )}
      <p className="text-xs text-gray-500 text-center mt-2">{SELLER_REFERRAL_NOTE}</p>
    </>
  )
}
