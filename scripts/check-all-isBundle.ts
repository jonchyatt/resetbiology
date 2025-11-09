import { prisma } from '../src/lib/prisma'

async function checkAllIsBundle() {
  const allProducts = await prisma.product.findMany({
    orderBy: { name: 'asc' }
  })

  console.log(`Total products in database: ${allProducts.length}\n`)

  console.log('All products with isBundle values:')
  allProducts.forEach(p => {
    console.log(`  ${p.name.padEnd(40)} isBundle: ${String(p.isBundle).padEnd(10)} (type: ${typeof p.isBundle})`)
  })

  console.log('\n\nFiltering by isBundle === false:')
  const notBundles = allProducts.filter(p => p.isBundle === false)
  console.log(`Found ${notBundles.length} products:\n`)
  notBundles.forEach(p => {
    console.log(`  - ${p.name}`)
  })

  const amino = allProducts.find(p => p.name.toLowerCase().includes('amino'))
  if (amino) {
    console.log('\n\n5-amino-1MQ detailed check:')
    console.log('  Name:', amino.name)
    console.log('  isBundle:', amino.isBundle)
    console.log('  isBundle === false:', amino.isBundle === false)
    console.log('  In filtered list?:', notBundles.some(p => p.id === amino.id))
  }

  await prisma.$disconnect()
}

checkAllIsBundle().catch(console.error)
