import { getSellerUrl, SELLER_REFERRAL_NOTE } from "@/config/sellerLinks"

export function VisitSellerButton({ sellerKey, className }: { sellerKey?: string; className: string }) {
  const url = getSellerUrl(sellerKey)
  return (
    <>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer sponsored" className={`block text-center ${className}`}>
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
