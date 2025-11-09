import { prisma } from '../src/lib/prisma'

async function check5Amino() {
  console.log('Searching for 5-amino-1MQ...\n')

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
    console.log('❌ Product not found')
    return
  }

  console.log('Product found:')
  console.log(`  Name: ${product.name}`)
  console.log(`  ID: ${product.id}`)
  console.log(`  Active: ${product.active}`)
  console.log(`  Is Bundle: ${product.isBundle}`)
  console.log(`  Show in Store: ${product.showInStore}`)
  console.log(`  Slug: ${product.slug}`)
  console.log(`\nPrices:`)

  if (product.prices.length === 0) {
    console.log('  ⚠️  NO PRICES FOUND')
  } else {
    product.prices.forEach(price => {
      console.log(`  - Amount: $${(price.unitAmount / 100).toFixed(2)}`)
      console.log(`    Primary: ${price.isPrimary}`)
      console.log(`    Active: ${price.active}`)
    })
  }

  console.log('\n🔍 Checking what query filters would exclude it:')
  console.log(`  - excludeBundles=true → ${product.isBundle ? 'EXCLUDED ❌' : 'INCLUDED ✓'}`)
  console.log(`  - active=true → ${product.active ? 'INCLUDED ✓' : 'EXCLUDED ❌'}`)

  await prisma.$disconnect()
}

check5Amino().catch(console.error)
