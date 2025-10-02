import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Get all products and show what image data they actually have
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        imageUrl: true,
        allImages: true,
        localImages: true
      },
      take: 10 // Just first 10 for debugging
    })

    const analysis = products.map(p => ({
      name: p.name,
      slug: p.slug,
      hasImageUrl: !!p.imageUrl,
      imageUrl: p.imageUrl,
      hasAllImages: !!p.allImages,
      allImagesType: Array.isArray(p.allImages) ? 'array' : typeof p.allImages,
      allImagesContent: p.allImages,
      hasLocalImages: !!p.localImages,
      localImagesType: Array.isArray(p.localImages) ? 'array' : typeof p.localImages,
      localImagesContent: p.localImages
    }))

    return NextResponse.json({
      success: true,
      total: products.length,
      products: analysis
    }, { status: 200 })

  } catch (error) {
    console.error('Error checking images:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
