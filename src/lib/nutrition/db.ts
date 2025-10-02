import { prisma } from '@/lib/prisma';
import type { NormalizedFood } from './types';

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
  return prisma.foodRef.findMany({
    where: { description: { contains: query, mode: 'insensitive' } },
    orderBy: { createdAt: 'desc' },
    take,
  });
}

export async function getCached(source: string, sourceId: string) {
  return prisma.foodRef.findFirst({ where: { source, sourceId } });
}
