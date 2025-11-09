import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateBundlePrice } from '@/lib/bundlePricing'

/**
 * Helper function to update bundle pricing
 */
async function updateBundlePricing(bundleId: string) {
  const bundle = await prisma.product.findUnique({
    where: { id: bundleId },
    include: {
      bundleItems: {
        include: {
          componentProduct: {
            include: { prices: true }
          }
        }
      },
      prices: true
    }
  })

  if (!bundle) return

  const calculatedPrice = calculateBundlePrice(
    bundle.bundleItems.map(item => ({
      product: {
        prices: item.componentProduct.prices
      },
      quantity: item.quantity,
      isOptional: item.isOptional
    })),
    bundle.bundlePriceOverride
  )

  // Upsert primary price
  const primaryPrice = bundle.prices.find(p => p.isPrimary)
  if (primaryPrice) {
    await prisma.price.update({
      where: { id: primaryPrice.id },
      data: { unitAmount: calculatedPrice }
    })
  } else {
    await prisma.price.create({
      data: {
        productId: bundleId,
        unitAmount: calculatedPrice,
        currency: 'usd',
        isPrimary: true,
        active: true
      }
    })
  }
}

/**
 * POST: Add a component to a bundle
 */
export async function POST(req: NextRequest) {
  try {
    const { bundleId, componentId, quantity, isOptional, displayOrder } = await req.json()

    if (!bundleId || !componentId) {
      return NextResponse.json(
        { error: 'Bundle ID and component ID are required' },
        { status: 400 }
      )
    }

    // Check if component already exists in bundle
    const existing = await prisma.bundleItem.findFirst({
      where: {
        bundleProductId: bundleId,
        componentProductId: componentId
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Component already exists in bundle' },
        { status: 400 }
      )
    }

    // Get current max displayOrder
    const maxOrder = await prisma.bundleItem.findFirst({
      where: { bundleProductId: bundleId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true }
    })

    const item = await prisma.bundleItem.create({
      data: {
        bundleProductId: bundleId,
        componentProductId: componentId,
        quantity: quantity || 1,
        isOptional: isOptional || false,
        displayOrder: displayOrder ?? ((maxOrder?.displayOrder ?? -1) + 1)
      },
      include: {
        componentProduct: {
          include: { prices: true }
        }
      }
    })

    // Recalculate bundle pricing
    await updateBundlePricing(bundleId)

    return NextResponse.json({ item })
  } catch (error: any) {
    console.error('Error adding bundle component:', error)
    return NextResponse.json(
      { error: 'Failed to add component', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH: Update a bundle component (quantity, optional status)
 */
export async function PATCH(req: NextRequest) {
  try {
    const { itemId, quantity, isOptional } = await req.json()

    if (!itemId) {
      return NextResponse.json(
        { error: 'Item ID is required' },
        { status: 400 }
      )
    }

    const item = await prisma.bundleItem.update({
      where: { id: itemId },
      data: {
        ...(quantity !== undefined && { quantity }),
        ...(isOptional !== undefined && { isOptional })
      },
      include: {
        componentProduct: {
          include: { prices: true }
        }
      }
    })

    // Recalculate bundle pricing
    await updateBundlePricing(item.bundleProductId)

    return NextResponse.json({ item })
  } catch (error: any) {
    console.error('Error updating bundle component:', error)
    return NextResponse.json(
      { error: 'Failed to update component', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE: Remove a component from bundle
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const itemId = searchParams.get('itemId')

    if (!itemId) {
      return NextResponse.json(
        { error: 'Item ID is required' },
        { status: 400 }
      )
    }

    const item = await prisma.bundleItem.findUnique({
      where: { id: itemId }
    })

    if (!item) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      )
    }

    await prisma.bundleItem.delete({
      where: { id: itemId }
    })

    // Recalculate bundle pricing
    await updateBundlePricing(item.bundleProductId)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error removing bundle component:', error)
    return NextResponse.json(
      { error: 'Failed to remove component', details: error.message },
      { status: 500 }
    )
  }
}
