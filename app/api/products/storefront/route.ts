import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminRequest } from '@/lib/adminGuard';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const admin = await isAdminRequest();
    const products = await prisma.product.findMany({
      where: { active: true, storefront: true },
      // Prices only for admins; the site sells nothing, so the public never gets them.
      ...(admin ? { include: { prices: { where: { active: true }, orderBy: { unitAmount: 'asc' } } } } : {}),
      orderBy: { name: 'asc' },
    });

    if (admin) return NextResponse.json(products);

    // Public/member callers (the tracker picker) read only these fields.
    return NextResponse.json(
      products.map((p: any) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        category: p.category,
        isTrackable: p.isTrackable,
      })),
    );
  } catch (error) {
    console.error('Error fetching storefront products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}
