import { prisma } from '../src/lib/prisma'

async function testWithActiveFilter() {
  console.log('Test 1: Only isBundle filter (includeInactive=true)')
  const test1 = await prisma.product.findMany({
    where: { isBundle: false },
    orderBy: { name: 'asc' }
  })
  console.log(`  Found ${test1.length} products`)
  console.log(`  Has 5-amino? ${test1.some(p => p.name.includes('5-amino'))}`)

  console.log('\nTest 2: isBundle + active filters (includeInactive=false)')
  const test2 = await prisma.product.findMany({
    where: {
      isBundle: false,
      active: true
    },
    orderBy: { name: 'asc' }
  })
  console.log(`  Found ${test2.length} products`)
  console.log(`  Has 5-amino? ${test2.some(p => p.name.includes('5-amino'))}`)

  console.log('\nTest 3: Check if storefront filter is needed')
  const test3 = await prisma.product.findMany({
    where: {
      isBundle: false,
      active: true,
      storefront: true
    },
    orderBy: { name: 'asc' }
  })
  console.log(`  Found ${test3.length} products`)
  console.log(`  Has 5-amino? ${test3.some(p => p.name.includes('5-amino'))}`)

  console.log('\nProducts in test2 (active + not bundle):')
  test2.forEach((p, i) => {
    console.log(`  ${(i + 1).toString().padStart(2)}. ${p.name}`)
  })

  await prisma.$disconnect()
}

testWithActiveFilter().catch(console.error)
