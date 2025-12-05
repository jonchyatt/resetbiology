import { NextResponse } from "next/server"
import { seedNonPeptideCatalog } from "@/lib/nonPeptideCatalog"

export const dynamic = "force-dynamic"

export async function GET() {
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

