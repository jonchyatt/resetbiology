import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminRequest } from '@/lib/adminGuard';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  // /product/* pages redirect to /order and the site sells nothing: prices + Stripe ids stay admin-only (RB-FIX-8).
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }
  try {
    const { slug } = await params;

    // Case-insensitive slug lookup
    const product = await prisma.product.findFirst({
      where: {
        slug: {
          equals: slug,
          mode: 'insensitive'
        },
        active: true,
        storefront: true
      },
      include: {
        prices: {
          where: { active: true },
          orderBy: { unitAmount: 'asc' }
        },
        bundleItems: {
          include: {
            componentProduct: {
              include: {
                prices: {
                  where: { active: true }
                }
              }
            }
          },
          orderBy: { displayOrder: 'asc' }
        }
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}
