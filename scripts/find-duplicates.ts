import { prisma } from '../src/lib/prisma'

async function findDuplicates() {
  const allProducts = await prisma.product.findMany({
    orderBy: { name: 'asc' }
  })

  console.log(`Total products: ${allProducts.length}\n`)

  // Group by name
  const byName = allProducts.reduce((acc, p) => {
    if (!acc[p.name]) acc[p.name] = []
    acc[p.name].push(p)
    return acc
  }, {} as Record<string, typeof allProducts>)

  console.log('Duplicate names:')
  Object.entries(byName).forEach(([name, products]) => {
    if (products.length > 1) {
      console.log(`\n${name} (${products.length} copies):`)
      products.forEach(p => {
        console.log(`  - ID: ${p.id.slice(-8)}`)
        console.log(`    active: ${p.active}, isBundle: ${p.isBundle}, storefront: ${p.storefront}`)
        console.log(`    created: ${p.createdAt.toISOString().split('T')[0]}`)
      })
    }
  })

  // Check 5-amino specifically
  const amino = byName['5-amino-1MQ'] || []
  console.log(`\n\n5-amino-1MQ copies: ${amino.length}`)
  amino.forEach((p, i) => {
    console.log(`\nCopy ${i + 1}:`)
    console.log(`  ID: ${p.id}`)
    console.log(`  active: ${p.active}`)
    console.log(`  isBundle: ${p.isBundle}`)
    console.log(`  storefront: ${p.storefront}`)
    console.log(`  created: ${p.createdAt}`)
  })

  await prisma.$disconnect()
}

findDuplicates().catch(console.error)
