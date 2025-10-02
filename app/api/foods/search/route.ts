import { NextResponse } from 'next/server';
import { searchCacheByText } from '@/lib/nutrition/db';
import { fdcSearch } from '@/lib/nutrition/search';
import type { CachedFoodResult } from '@/lib/nutrition/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = (searchParams.get('q') ?? '').trim();

  if (!query) {
    return NextResponse.json({ ok: true, items: [] });
  }

  const cached = await searchCacheByText(query, 15);
  const fresh = query.length >= 2 ? await fdcSearch(query, 10) : [];

  const seen = new Set<string>();
  const items: CachedFoodResult[] = [];

  for (const entry of cached) {
    const key = `${entry.source}:${entry.sourceId}`;
    seen.add(key);
    items.push({
      id: entry.id,
      source: entry.source as CachedFoodResult['source'],
      sourceId: entry.sourceId,
      description: entry.description,
      brand: entry.brand ?? null,
      servingGram: entry.servingGram ?? null,
      nutrients: (entry.nutrientsJson as any) ?? null,
      per: (entry.per as CachedFoodResult['per']) ?? '100g',
    });
  }

  for (const item of fresh) {
    const key = `${item.source}:${item.sourceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      source: item.source,
      sourceId: item.sourceId,
      description: item.description,
      brand: item.brand ?? null,
      servingGram: item.servingGram ?? null,
      nutrients: item.nutrients,
      per: item.per,
    });
  }

  return NextResponse.json({ ok: true, items });
}
