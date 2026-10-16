import { NextResponse } from 'next/server';
import { getCached } from '@/lib/nutrition/db';
import { offByBarcode } from '@/lib/nutrition/search';
import { normalizeBarcode } from '@/lib/nutrition/barcode';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const normalized = normalizeBarcode(searchParams.get('code') ?? '');

  if (!normalized) {
    return NextResponse.json({ ok: false, error: 'Enter a valid 12- or 13-digit UPC/EAN with a correct check digit.' }, { status: 400 });
  }
  const code = normalized.code;

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
        barcode: code,
        sourceSnapshot: { source: 'openfoodfacts', sourceId: code, fetchedAt: new Date().toISOString() },
      },
    });
  }

  const item = await offByBarcode(code);
  if (!item) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    item: { ...item, barcode: code, sourceSnapshot: { source: item.source, sourceId: item.sourceId, fetchedAt: new Date().toISOString() } },
  });
}
