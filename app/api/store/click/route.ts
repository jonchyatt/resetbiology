import { NextResponse } from "next/server"
import { parseStoreClick, storeClicksEnabled } from "@/lib/storeClicks"

// Visit-seller click counter. Server log only: no database write, so there is no
// collection to bound (CLAUDE.md Atlas rule). Count with `grep store_click` in the host logs.
export async function POST(req: Request) {
  if (!storeClicksEnabled()) return new NextResponse(null, { status: 204 })
  let body: unknown = null
  try {
    body = await req.json()
  } catch {
    // sendBeacon with a text/plain blob still parses below
  }
  const click = parseStoreClick(body)
  if (!click) return NextResponse.json({ error: "unknown seller" }, { status: 400 })
  console.log(JSON.stringify({ event: "store_click", sellerKey: click.sellerKey, at: new Date().toISOString() }))
  return new NextResponse(null, { status: 204 })
}
