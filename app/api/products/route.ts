import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET: List all products
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'
    const bundlesOnly = searchParams.get('bundlesOnly') === 'true'
    const excludeBundles = searchParams.get('excludeBundles') === 'true'

    const products = await prisma.product.findMany({
      where: {
        ...(includeInactive ? {} : { active: true }),
        ...(bundlesOnly ? { isBundle: true } : {}),
        ...(excludeBundles ? { isBundle: false } : {})
      },
      include: {
        prices: true
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({ products })
  } catch (error: any) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products', details: error.message },
      { status: 500 }
    )
  }
}
