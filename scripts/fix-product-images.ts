import { prisma } from '../src/lib/prisma'

async function fixProductImages() {
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

  for (const product of products) {
    const hasImageUrl = !!product.imageUrl
    const allImages = product.allImages as string[] | null

    if (hasImageUrl) {
      console.log(`✅ ${product.name}: Has imageUrl`)
      hasImages++
    } else if (allImages && Array.isArray(allImages) && allImages.length > 0) {
      // Copy first image from allImages to imageUrl
      console.log(`🔧 ${product.name}: Copying from allImages -> imageUrl`)
      console.log(`   Image: ${allImages[0]}`)

      await prisma.product.update({
        where: { id: product.id },
        data: { imageUrl: allImages[0] }
      })

      fixed++
    } else {
      console.log(`❌ ${product.name}: No images found`)
      noImages++
    }
  }

  console.log(`\n📈 Summary:`)
  console.log(`   ✅ Already had images: ${hasImages}`)
  console.log(`   🔧 Fixed: ${fixed}`)
  console.log(`   ❌ Still missing: ${noImages}`)

  await prisma.$disconnect()
}

fixProductImages().catch(console.error)
