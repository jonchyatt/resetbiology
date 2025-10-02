import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  const hasFdc = !!process.env.FDC_API_KEY;
  return NextResponse.json({ ok: true, fdc: hasFdc });
}
