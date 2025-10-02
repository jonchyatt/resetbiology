import { cacheFoods } from './db';
import { mapFdcFood } from './mapFdc';
import { mapOffProduct } from './mapOff';
import type { NormalizedFood } from './types';

export async function fdcSearch(query: string, pageSize = 10): Promise<NormalizedFood[]> {
  if (!process.env.USDA_API_KEY) {
    return [];
  }

  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
  url.searchParams.set('api_key', process.env.USDA_API_KEY);
  url.searchParams.set('query', query);
  url.searchParams.set('pageSize', pageSize.toString());

  const response = await fetch(url, { next: { revalidate: 0 } });
  if (!response.ok) {
    return [];
  }

  const json = await response.json();
  const foods = Array.isArray(json?.foods) ? json.foods : [];
  const normalized = foods.map(mapFdcFood);
  if (normalized.length) {
    await cacheFoods(normalized);
  }
  return normalized;
}

export async function offByBarcode(barcode: string): Promise<NormalizedFood | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': `${process.env.OPENFOODFACTS_APP_NAME ?? 'resetbiology'} - web`,
      Accept: 'application/json',
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    return null;
  }

  const json = await response.json();
  if (json?.status !== 1 || !json?.product) {
    return null;
  }

  const normalized = mapOffProduct(barcode, json.product);
  await cacheFoods([normalized]);
  return normalized;
}
