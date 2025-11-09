import { prisma } from '../src/lib/prisma'

async function debugPrismaQuery() {
  console.log('DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 50) + '...')

  // Direct MongoDB query
  const db = (prisma as any)._baseDm?._datamodel || prisma

  console.log('\nQuerying with isBundle: false...')
  const query = {
    where: { isBundle: false },
    orderBy: { name: 'asc' as const }
  }

  console.log('Query:', JSON.stringify(query, null, 2))

  const products = await prisma.product.findMany(query)

  console.log(`\nFound ${products.length} products`)
  console.log('\nAll product names:')
  products.forEach((p, i) => {
    console.log(`  ${(i + 1).toString().padStart(2)}. ${p.name}  (id: ${p.id.slice(-8)})`)
  })

  // Now try findFirst with 5-amino
  console.log('\n\nDirect query for 5-amino-1MQ:')
  const amino = await prisma.product.findUnique({
    where: { id: '68eee2826b988624d0545371' }
  })

  if (amino) {
    console.log('  Found via findUnique!')
    console.log(`    Name: ${amino.name}`)
    console.log(`    isBundle: ${amino.isBundle}`)
    console.log(`    active: ${amino.active}`)
  }

  await prisma.$disconnect()
}

debugPrismaQuery().catch(console.error)
