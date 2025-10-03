export type Nutrients = {
  kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carb_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  sat_fat_g: number | null;
  cholesterol_mg: number | null;
  potassium_mg: number | null;
};

export type NormalizedFood = {
  source: 'usda' | 'openfoodfacts';
  sourceId: string;
  description: string;
  brand?: string | null;
  servingGram?: number | null;
  nutrients: Nutrients;
  per: '100g' | 'serving';
};

export type CachedFoodResult = {
  id?: string;
  source: NormalizedFood['source'];
  sourceId: string;
  description: string;
  brand?: string | null;
  servingGram?: number | null;
  nutrients: Nutrients | null;
  per: '100g' | 'serving';
};
