import { prisma } from '../src/lib/prisma'

async function fix5AminoIsBundle() {
  const productId = '68eee2826b988624d0545371'

  console.log('Fetching 5-amino-1MQ...')
  const before = await prisma.product.findUnique({
    where: { id: productId }
  })

  console.log('Before update:')
  console.log(`  Name: ${before?.name}`)
  console.log(`  isBundle: ${before?.isBundle} (type: ${typeof before?.isBundle})`)

  // Update to null first
  console.log('\nSetting isBundle to null...')
  await prisma.product.update({
    where: { id: productId },
    data: { isBundle: null as any }
  })

  // Then update back to false
  console.log('Setting isBundle back to false...')
  await prisma.product.update({
    where: { id: productId },
    data: { isBundle: false }
  })

  const after = await prisma.product.findUnique({
    where: { id: productId }
  })

  console.log('\nAfter update:')
  console.log(`  Name: ${after?.name}`)
  console.log(`  isBundle: ${after?.isBundle} (type: ${typeof after?.isBundle})`)

  // Test findMany
  console.log('\nTesting findMany with isBundle: false...')
  const products = await prisma.product.findMany({
    where: { isBundle: false },
    select: { name: true }
  })

  console.log(`Found ${products.length} products`)
  const has5Amino = products.some(p => p.name.includes('5-amino'))
  console.log(`Has 5-amino? ${has5Amino}`)

  if (has5Amino) {
    console.log('\n✅ SUCCESS! 5-amino-1MQ now appears in query results')
  } else {
    console.log('\n❌ Still not appearing in results')
  }

  await prisma.$disconnect()
}

fix5AminoIsBundle().catch(console.error)
