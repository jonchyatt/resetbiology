import { NextResponse } from 'next/server';
import { getCached } from '@/lib/nutrition/db';
import { offByBarcode } from '@/lib/nutrition/search';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = (searchParams.get('code') ?? '').trim();

  if (!code) {
    return NextResponse.json({ ok: false, error: 'Missing barcode' }, { status: 400 });
  }

  const cached = await getCached('openfoodfacts', code);
  if (cached) {
    return NextResponse.json({
      ok: true,
      item: {
        source: 'openfoodfacts',
        sourceId: code,
        description: cached.description,
        brand: cached.brand ?? null,
        servingGram: cached.servingGram ?? null,
        nutrients: (cached.nutrientsJson as any) ?? null,
        per: (cached.per as '100g' | 'serving') ?? '100g',
      },
    });
  }

  const item = await offByBarcode(code);
  if (!item) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, item });
}
