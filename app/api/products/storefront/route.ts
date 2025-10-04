import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: { active: true, storefront: true },
      include: { prices: { where: { active: true }, orderBy: { unitAmount: 'asc' } } },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error('Error fetching storefront products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}
