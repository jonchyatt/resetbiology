import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
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
