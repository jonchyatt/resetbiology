import { prisma } from '../src/lib/prisma'

async function testExactAPIQuery() {
  const includeInactive = true
  const excludeBundles = true

  console.log('Query parameters:')
  console.log('  includeInactive:', includeInactive)
  console.log('  excludeBundles:', excludeBundles)

  const whereClause = {
    ...(includeInactive ? {} : { active: true }),
    ...(excludeBundles ? { isBundle: false } : {})
  }

  console.log('\nGenerated where clause:', JSON.stringify(whereClause, null, 2))

  const products = await prisma.product.findMany({
    where: whereClause,
    include: { prices: true },
    orderBy: { name: 'asc' }
  })

  console.log(`\nFound ${products.length} products:\n`)

  products.forEach((p, i) => {
    const primaryPrice = p.prices.find(price => price.isPrimary)
    const priceStr = primaryPrice ? `$${(primaryPrice.unitAmount / 100).toFixed(2)}` : '$0.00'
    console.log(`  ${(i + 1).toString().padStart(2)}. ${p.name.padEnd(35)} ${priceStr}`)
  })

  const hasAmino = products.some(p => p.name.toLowerCase().includes('amino'))
  console.log(`\n5-amino-1MQ included: ${hasAmino ? '✓ YES' : '❌ NO'}`)

  await prisma.$disconnect()
}

testExactAPIQuery().catch(console.error)
