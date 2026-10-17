"use client"

import { STORE_CLICKS_ENDPOINT, storeClicksEnabled } from "@/lib/storeClicks"
import { getSellerUrl, SELLER_REFERRAL_NOTE } from "@/config/sellerLinks"

export function VisitSellerButton({ sellerKey, className }: { sellerKey?: string; className: string }) {
  const url = getSellerUrl(sellerKey)
  const countClick = () => {
    if (!sellerKey || !storeClicksEnabled()) return
    try {
      navigator.sendBeacon(STORE_CLICKS_ENDPOINT, new Blob([JSON.stringify({ sellerKey })], { type: "application/json" }))
    } catch {
      // counting must never block the visitor
    }
  }
  return (
    <>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer sponsored" onClick={countClick} className={`block text-center ${className}`}>
          Visit seller
        </a>
      ) : (
        <button type="button" disabled className={`${className} opacity-60 cursor-not-allowed`}>
          Seller link coming soon
        </button>
      )}
      <p className="text-xs text-gray-500 text-center mt-2">{SELLER_REFERRAL_NOTE}</p>
    </>
  )
}
