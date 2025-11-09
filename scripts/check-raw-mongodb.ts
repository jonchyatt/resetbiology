import { prisma } from '../src/lib/prisma'

async function checkRawMongoDB() {
  // Get the raw MongoDB data
  const rawResult = await (prisma as any).$runCommandRaw({
    find: 'products',
    filter: { _id: { $oid: '68eee2826b988624d0545371' } },
    limit: 1
  })

  console.log('Raw MongoDB document for 5-amino-1MQ:')
  console.log(JSON.stringify(rawResult, null, 2))

  // Now check all products where isBundle field exists and equals false
  const withFalse = await (prisma as any).$runCommandRaw({
    find: 'products',
    filter: { isBundle: false }
  })

  console.log(`\n\nProducts with isBundle: false in MongoDB: ${withFalse.cursor.firstBatch.length}`)

  // Check products where isBundle is null or doesn't exist
  const withNull = await (prisma as any).$runCommandRaw({
    find: 'products',
    filter: { isBundle: null }
  })

  console.log(`Products with isBundle: null in MongoDB: ${withNull.cursor.firstBatch.length}`)

  // Check products where isBundle field doesn't exist
  const withoutField = await (prisma as any).$runCommandRaw({
    find: 'products',
    filter: { isBundle: { $exists: false } }
  })

  console.log(`Products without isBundle field: ${withoutField.cursor.firstBatch.length}`)

  await prisma.$disconnect()
}

checkRawMongoDB().catch(console.error)
