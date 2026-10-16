import { prisma } from '@/lib/prisma';
import { repairStaleKj } from './kcal';
import type { NormalizedFood, Nutrients } from './types';

// Every cache read re-derives kcal (see kcal.ts) so rows saved before the kJ fix never surface 371.
const repairRow = <R extends { nutrientsJson: unknown }>(row: R): R => ({
  ...row,
  nutrientsJson: repairStaleKj(row.nutrientsJson as Nutrients | null),
} as R);

export async function cacheFoods(items: NormalizedFood[]): Promise<void> {
  for (const item of items) {
    await prisma.foodRef.upsert({
      where: { source_sourceId: { source: item.source, sourceId: item.sourceId } },
      create: {
        source: item.source,
        sourceId: item.sourceId,
        description: item.description,
        brand: item.brand ?? null,
        servingGram: item.servingGram ?? null,
        per: item.per,
        nutrientsJson: item.nutrients,
      },
      update: {
        description: item.description,
        brand: item.brand ?? null,
        servingGram: item.servingGram ?? null,
        per: item.per,
        nutrientsJson: item.nutrients,
        createdAt: new Date(),
      },
    });
  }
}

export async function searchCacheByText(query: string, take = 15) {
  // Get all matching foods
  const foods = await prisma.foodRef.findMany({
    where: { description: { contains: query, mode: 'insensitive' } },
  });

  // Get usage counts for each food
  const foodsWithCounts = await Promise.all(
    foods.map(async (food) => {
      const count = await prisma.foodLog.count({
        where: {
          source: food.source,
          sourceId: food.sourceId,
        },
      });
      return { ...repairRow(food), usageCount: count };
    })
  );

  // Sort by usage count (most popular first), then by createdAt
  const sorted = foodsWithCounts.sort((a, b) => {
    if (b.usageCount !== a.usageCount) {
      return b.usageCount - a.usageCount;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return sorted.slice(0, take);
}

export async function getCached(source: string, sourceId: string) {
  const row = await prisma.foodRef.findFirst({ where: { source, sourceId } });
  return row ? repairRow(row) : row;
}
