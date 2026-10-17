import { SELLER_LINKS } from "@/config/sellerLinks"

export const STORE_CLICKS_ENDPOINT = "/api/store/click"

export function storeClicksEnabled(): boolean {
  return process.env.NEXT_PUBLIC_RB_STORE_CLICKS === "1"
}

// Only keys we configured are counted, so the log cannot be filled with arbitrary text.
export function parseStoreClick(body: unknown): { sellerKey: string } | null {
  if (!body || typeof body !== "object") return null
  const key = (body as { sellerKey?: unknown }).sellerKey
  if (typeof key !== "string" || !Object.prototype.hasOwnProperty.call(SELLER_LINKS, key)) return null
  return { sellerKey: key }
}
