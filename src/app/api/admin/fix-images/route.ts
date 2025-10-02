import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    console.log('🔍 Checking product images...')

    // Get all products
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        imageUrl: true,
        allImages: true
      }
    })

    console.log(`\n📊 Found ${products.length} products\n`)

    let fixed = 0
    let noImages = 0
    let hasImages = 0
    const details: any[] = []

    for (const product of products) {
      const hasImageUrl = !!product.imageUrl
      const allImages = product.allImages as string[] | null

      if (hasImageUrl) {
        console.log(`✅ ${product.name}: Has imageUrl`)
        details.push({
          name: product.name,
          status: 'has_image',
          imageUrl: product.imageUrl
        })
        hasImages++
      } else if (allImages && Array.isArray(allImages) && allImages.length > 0) {
        // Copy first image from allImages to imageUrl
        console.log(`🔧 ${product.name}: Copying from allImages -> imageUrl`)
        console.log(`   Image: ${allImages[0]}`)

        await prisma.product.update({
          where: { id: product.id },
          data: { imageUrl: allImages[0] }
        })

        details.push({
          name: product.name,
          status: 'fixed',
          imageUrl: allImages[0]
        })
        fixed++
      } else {
        console.log(`❌ ${product.name}: No images found`)
        details.push({
          name: product.name,
          status: 'no_images'
        })
        noImages++
      }
    }

    const summary = {
      total: products.length,
      alreadyHadImages: hasImages,
      fixed: fixed,
      stillMissing: noImages,
      details: details
    }

    console.log(`\n📈 Summary:`)
    console.log(`   ✅ Already had images: ${hasImages}`)
    console.log(`   🔧 Fixed: ${fixed}`)
    console.log(`   ❌ Still missing: ${noImages}`)

    return NextResponse.json({
      success: true,
      summary: summary
    })

  } catch (error) {
    console.error('Error fixing images:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
