import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateBundlePrice } from '@/lib/bundlePricing'

/**
 * GET: List all bundles with their components
 */
export async function GET(req: NextRequest) {
  try {
    const bundles = await prisma.product.findMany({
      where: { isBundle: true },
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
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({ bundles })
  } catch (error: any) {
    console.error('Error fetching bundles:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bundles', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST: Create a new bundle
 */
export async function POST(req: NextRequest) {
  try {
    const { name, slug, description, imageUrl, showInStore } = await req.json()

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      )
    }

    const bundle = await prisma.product.create({
      data: {
        name,
        slug,
        description,
        imageUrl,
        isBundle: true,
        active: true,
        storefront: showInStore !== undefined ? showInStore : false,
        trackInventory: false // Bundles track via components
      },
      include: {
        bundleItems: true,
        prices: true
      }
    })

    return NextResponse.json({ bundle })
  } catch (error: any) {
    console.error('Error creating bundle:', error)
    return NextResponse.json(
      { error: 'Failed to create bundle', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH: Update bundle details
 */
export async function PATCH(req: NextRequest) {
  try {
    const { id, name, slug, description, imageUrl, active, storefront } = await req.json()

    if (!id) {
      return NextResponse.json(
        { error: 'Bundle ID is required' },
        { status: 400 }
      )
    }

    const bundle = await prisma.product.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(slug && { slug }),
        ...(description !== undefined && { description }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(active !== undefined && { active }),
        ...(storefront !== undefined && { storefront })
      },
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

    return NextResponse.json({ bundle })
  } catch (error: any) {
    console.error('Error updating bundle:', error)
    return NextResponse.json(
      { error: 'Failed to update bundle', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE: Delete a bundle
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Bundle ID is required' },
        { status: 400 }
      )
    }

    // Delete bundle items first
    await prisma.bundleItem.deleteMany({
      where: { bundleProductId: id }
    })

    // Delete prices
    await prisma.price.deleteMany({
      where: { productId: id }
    })

    // Delete bundle
    await prisma.product.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting bundle:', error)
    return NextResponse.json(
      { error: 'Failed to delete bundle', details: error.message },
      { status: 500 }
    )
  }
}
