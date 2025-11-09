import { prisma } from '../src/lib/prisma'

async function check5AminoFull() {
  const product = await prisma.product.findFirst({
    where: {
      name: {
        contains: '5-amino',
        mode: 'insensitive'
      }
    },
    include: {
      prices: true
    }
  })

  if (!product) {
    console.log('Product not found!')
    return
  }

  console.log('5-amino-1MQ Full Details:\n')
  console.log(JSON.stringify(product, null, 2))

  await prisma.$disconnect()
}

check5AminoFull().catch(console.error)
