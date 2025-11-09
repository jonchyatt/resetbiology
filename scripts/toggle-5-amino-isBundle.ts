import { prisma } from '../src/lib/prisma'

async function toggle5AminoIsBundle() {
  const productId = '68eee2826b988624d0545371'

  console.log('Fetching 5-amino-1MQ...')
  const before = await prisma.product.findUnique({
    where: { id: productId }
  })

  console.log('Before:')
  console.log(`  isBundle: ${before?.isBundle}`)

  // Toggle to true
  console.log('\nSetting to true...')
  await prisma.product.update({
    where: { id: productId },
    data: { isBundle: true }
  })

  // Toggle back to false
  console.log('Setting back to false...')
  await prisma.product.update({
    where: { id: productId },
    data: { isBundle: false }
  })

  const after = await prisma.product.findUnique({
    where: { id: productId }
  })

  console.log('\nAfter:')
  console.log(`  isBundle: ${after?.isBundle}`)

  // Test findMany
  console.log('\nTesting findMany with isBundle: false...')
  const products = await prisma.product.findMany({
    where: { isBundle: false },
    select: { name: true },
    orderBy: { name: 'asc' }
  })

  console.log(`Found ${products.length} products`)
  const has5Amino = products.some(p => p.name.includes('5-amino'))
  console.log(`Has 5-amino? ${has5Amino}`)

  if (has5Amino) {
    console.log('\n✅ SUCCESS! Product names:')
    products.slice(0, 15).forEach((p, i) => {
      console.log(`  ${(i + 1).toString().padStart(2)}. ${p.name}`)
    })
  }

  await prisma.$disconnect()
}

toggle5AminoIsBundle().catch(console.error)
