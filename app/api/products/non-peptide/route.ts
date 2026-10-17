import { NextResponse } from "next/server"
import { seedNonPeptideCatalog } from "@/lib/nonPeptideCatalog"
import { isAdminRequest } from "@/lib/adminGuard"

export const dynamic = "force-dynamic"

export async function GET() {
  // The non-peptide order pages are hidden (307) and the site sells nothing, so this
  // catalog (which seeds the DB and syncs Stripe on every call) is admin-only (RB-FIX-8).
  if (!(await isAdminRequest())) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
  }
  try {
    const products = await seedNonPeptideCatalog({ syncStripe: true })
    return NextResponse.json({ ok: true, products })
  } catch (error: any) {
    console.error("[non-peptide] failed to seed/fetch catalog", error)
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to load non-peptide catalog" },
      { status: 500 }
    )
  }
}
