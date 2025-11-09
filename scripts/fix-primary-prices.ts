import { prisma } from '../src/lib/prisma'

async function fixPrimaryPrices() {
  console.log('Finding products without primary prices...\n')

  const products = await prisma.product.findMany({
    include: {
      prices: true
    }
  })

  let fixed = 0

  for (const product of products) {
    const hasPrimaryPrice = product.prices.some(p => p.isPrimary)

    if (!hasPrimaryPrice && product.prices.length > 0) {
      // Set the first active price as primary, or just the first price
      const priceToMakePrimary = product.prices.find(p => p.active) || product.prices[0]

      if (priceToMakePrimary) {
        await prisma.price.update({
          where: { id: priceToMakePrimary.id },
          data: { isPrimary: true }
        })

        console.log(`✅ Fixed ${product.name}: Set price $${(priceToMakePrimary.unitAmount / 100).toFixed(2)} as primary`)
        fixed++
      }
    }
  }

  console.log(`\nFixed ${fixed} products`)
  await prisma.$disconnect()
}

fixPrimaryPrices().catch(console.error)
