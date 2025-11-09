import { prisma } from '../src/lib/prisma'

async function testProductsAPI() {
  console.log('Fetching products like the API does...\n')

  const products = await prisma.product.findMany({
    where: {
      active: true,
      isBundle: false
    },
    include: { prices: true },
    orderBy: { name: 'asc' }
  })

  console.log(`Found ${products.length} products\n`)

  console.log('Product names:')
  products.forEach((p, i) => {
    const primaryPrice = p.prices.find(price => price.isPrimary)
    const priceStr = primaryPrice ? `$${(primaryPrice.unitAmount / 100).toFixed(2)}` : '$0.00'
    console.log(`  ${i + 1}. ${p.name.padEnd(35)} ${priceStr}`)
  })

  // Check specifically for 5-amino
  const hasAmino = products.some(p => p.name.toLowerCase().includes('amino'))
  console.log(`\n5-amino-1MQ included: ${hasAmino ? '✓ YES' : '❌ NO'}`)

  await prisma.$disconnect()
}

testProductsAPI().catch(console.error)
