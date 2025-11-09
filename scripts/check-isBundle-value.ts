import { prisma } from '../src/lib/prisma'

async function checkIsBundleValue() {
  const p = await prisma.product.findFirst({
    where: {
      name: {
        contains: '5-amino',
        mode: 'insensitive'
      }
    }
  })

  console.log('5-amino-1MQ isBundle analysis:')
  console.log('  Raw value:', p?.isBundle)
  console.log('  Type:', typeof p?.isBundle)
  console.log('  Is null?', p?.isBundle === null)
  console.log('  Is undefined?', p?.isBundle === undefined)
  console.log('  Is false?', p?.isBundle === false)
  console.log('  Equals false (loose)?', p?.isBundle == false)
  console.log('  NOT operator (!isBundle)?', !p?.isBundle)

  await prisma.$disconnect()
}

checkIsBundleValue().catch(console.error)
