import type { NormalizedFood, Nutrients } from './types';

type FdcFood = {
  fdcId: number;
  description: string;
  brandName?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients?: Array<{
    nutrientName?: string;
    unitName?: string;
    value?: number;
  }>;
};

const findNutrient = (nutrients: FdcFood['foodNutrients'], name: string): number | null => {
  if (!nutrients) return null;
  const hit = nutrients.find((n) => n.nutrientName?.toLowerCase().includes(name.toLowerCase()));
  return typeof hit?.value === 'number' ? hit.value : null;
};

/**
 * Normalize an FDC food item into our internal shape. FDC data is usually per 100 g
 * for foundation foods but can be per serving for branded products.
 */
export function mapFdcFood(food: FdcFood): NormalizedFood {
  const per: '100g' | 'serving' =
    food.servingSize && food.servingSizeUnit ? 'serving' : '100g';

  const nutrients: Nutrients = {
    kcal: findNutrient(food.foodNutrients, 'Energy') ?? null,
    protein_g: findNutrient(food.foodNutrients, 'Protein') ?? null,
    fat_g: findNutrient(food.foodNutrients, 'Total lipid') ?? null,
    carb_g: findNutrient(food.foodNutrients, 'Carbohydrate') ?? null,
    fiber_g: findNutrient(food.foodNutrients, 'Fiber') ?? null,
    sugar_g: findNutrient(food.foodNutrients, 'Sugars') ?? null,
    sodium_mg: findNutrient(food.foodNutrients, 'Sodium') ?? null,
    sat_fat_g: findNutrient(food.foodNutrients, 'SFA') ?? null,
    cholesterol_mg: findNutrient(food.foodNutrients, 'Cholesterol') ?? null,
    potassium_mg: findNutrient(food.foodNutrients, 'Potassium') ?? null,
  };

  return {
    source: 'usda',
    sourceId: String(food.fdcId),
    description: food.description,
    brand: food.brandName ?? null,
    servingGram:
      food.servingSizeUnit?.toLowerCase() === 'g' ? food.servingSize ?? null : null,
    nutrients,
    per,
  };
}
