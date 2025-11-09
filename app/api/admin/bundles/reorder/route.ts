import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST: Reorder bundle components
 */
export async function POST(req: NextRequest) {
  try {
    const { bundleId, componentIds } = await req.json()

    if (!bundleId || !Array.isArray(componentIds)) {
      return NextResponse.json(
        { error: 'Bundle ID and component IDs array are required' },
        { status: 400 }
      )
    }

    // Update displayOrder for each component
    await Promise.all(
      componentIds.map((id, index) =>
        prisma.bundleItem.update({
          where: { id },
          data: { displayOrder: index }
        })
      )
    )

    // Fetch updated bundle
    const bundle = await prisma.product.findUnique({
      where: { id: bundleId },
      include: {
        bundleItems: {
          include: {
            componentProduct: {
              include: { prices: true }
            }
          },
          orderBy: { displayOrder: 'asc' }
        }
      }
    })

    return NextResponse.json({ bundle })
  } catch (error: any) {
    console.error('Error reordering components:', error)
    return NextResponse.json(
      { error: 'Failed to reorder components', details: error.message },
      { status: 500 }
    )
  }
}
