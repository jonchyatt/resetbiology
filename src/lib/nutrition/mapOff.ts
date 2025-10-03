import type { NormalizedFood, Nutrients } from './types';

export function mapOffProduct(barcode: string, product: any): NormalizedFood {
  const nutriments = product?.nutriments ?? {};
  const per: '100g' = '100g';

  const sodiumFromSalt = typeof nutriments['salt_100g'] === 'number'
    ? nutriments['salt_100g'] * 400
    : null;

  const nutrients: Nutrients = {
    kcal: nutriments['energy-kcal_100g'] ?? null,
    protein_g: nutriments['proteins_100g'] ?? null,
    fat_g: nutriments['fat_100g'] ?? null,
    carb_g: nutriments['carbohydrates_100g'] ?? null,
    fiber_g: nutriments['fiber_100g'] ?? null,
    sugar_g: nutriments['sugars_100g'] ?? null,
    sodium_mg: nutriments['sodium_100g'] ?? sodiumFromSalt ?? null,
    sat_fat_g: nutriments['saturated-fat_100g'] ?? null,
    cholesterol_mg: nutriments['cholesterol_100g'] ?? null,
    potassium_mg: nutriments['potassium_100g'] ?? null,
  };

  return {
    source: 'openfoodfacts',
    sourceId: barcode,
    description:
      product?.product_name || product?.generic_name || product?.abbreviated_product_name || 'Unknown product',
    brand: (product?.brands || '').split(',').map((item: string) => item.trim()).filter(Boolean)[0] ?? null,
    servingGram: typeof nutriments['serving_quantity'] === 'number' ? nutriments['serving_quantity'] : null,
    nutrients,
    per,
  };
}
