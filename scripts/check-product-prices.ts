import { prisma } from '../src/lib/prisma'

async function checkProductPrices() {
  console.log('Fetching products with prices...\n')

  const products = await prisma.product.findMany({
    where: {
      isBundle: false,
      active: true
    },
    include: {
      prices: true
    },
    take: 5,
    orderBy: { name: 'asc' }
  })

  console.log(`Found ${products.length} products\n`)

  products.forEach(product => {
    console.log(`Product: ${product.name}`)
    console.log(`  ID: ${product.id}`)
    console.log(`  Active: ${product.active}`)
    console.log(`  Is Bundle: ${product.isBundle}`)
    console.log(`  Prices:`)

    if (product.prices.length === 0) {
      console.log('    ⚠️  NO PRICES FOUND')
    } else {
      product.prices.forEach(price => {
        console.log(`    - ID: ${price.id}`)
        console.log(`      Amount: $${(price.unitAmount / 100).toFixed(2)}`)
        console.log(`      Currency: ${price.currency}`)
        console.log(`      Primary: ${price.isPrimary}`)
        console.log(`      Active: ${price.active}`)
      })
    }
    console.log('')
  })

  await prisma.$disconnect()
}

checkProductPrices().catch(console.error)
