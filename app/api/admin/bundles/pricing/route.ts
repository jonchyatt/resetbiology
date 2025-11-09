import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateBundlePrice } from '@/lib/bundlePricing'

/**
 * POST: Set manual price override for a bundle
 */
export async function POST(req: NextRequest) {
  try {
    const { bundleId, priceOverride } = await req.json()

    if (!bundleId) {
      return NextResponse.json(
        { error: 'Bundle ID is required' },
        { status: 400 }
      )
    }

    // Update bundle with price override (null = use auto-calculation)
    await prisma.product.update({
      where: { id: bundleId },
      data: { bundlePriceOverride: priceOverride }
    })

    // Fetch bundle with components to recalculate price
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

    if (!bundle) {
      return NextResponse.json(
        { error: 'Bundle not found' },
        { status: 404 }
      )
    }

    // Calculate final price (with override if provided)
    const calculatedPrice = calculateBundlePrice(
      bundle.bundleItems.map(item => ({
        product: {
          prices: item.componentProduct.prices
        },
        quantity: item.quantity,
        isOptional: item.isOptional
      })),
      priceOverride
    )

    // Update or create primary price
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

    // Return updated bundle
    const updatedBundle = await prisma.product.findUnique({
      where: { id: bundleId },
      include: {
        bundleItems: {
          include: {
            componentProduct: {
              include: { prices: true }
            }
          },
          orderBy: { displayOrder: 'asc' }
        },
        prices: true
      }
    })

    return NextResponse.json({ bundle: updatedBundle })
  } catch (error: any) {
    console.error('Error setting price override:', error)
    return NextResponse.json(
      { error: 'Failed to set price override', details: error.message },
      { status: 500 }
    )
  }
}
