// Outbound seller URLs for the parked store. The site takes no payment: each
// item and bundle sends the visitor to the vendor instead of on-site checkout.
// Empty string = not configured yet; the UI then shows a disabled button.
// Fill in real vendor URLs here (no schema change needed). Placeholders only.

export const SELLER_REFERRAL_NOTE = "we may earn a referral fee"

export const SELLER_LINKS: Record<string, string> = {
  // /order/non-peptide and /order/energybits, keyed by product slug
  "stemregen-release": "",
  "stemregen-mobilize": "",
  "stemregen-signal": "",
  "energybits-spirulina": "",
  "energybits-chlorella": "",
  "energybits-vitalitybits": "",
  // /store bundles, keyed by bundle title
  "Foundation Protocol": "",
  "Complete Optimization": "",
  "Elite Performance": "",
}

export function getSellerUrl(key: string | undefined | null): string | null {
  if (!key) return null
  const url = (SELLER_LINKS[key] || "").trim()
  return /^https?:\/\//i.test(url) ? url : null
}

// Where "Join the co-op" on /order points. Swap for the co-op's own site (e.g. Southern Utah
// Peptides) when it exists; until then members reach the co-op through the contact page.
export const COOP_JOIN_URL = "/contact?topic=co-op"
