import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
config({ path: '.env.local' })

const prisma = new PrismaClient()

const SEVEN_DAYS_AGO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

const before = await prisma.scheduledNotification.count()
console.log(`BEFORE: ${before} total scheduledNotification rows`)

const result = await prisma.scheduledNotification.deleteMany({
  where: {
    reminderTime: { lt: SEVEN_DAYS_AGO },
  },
})

const after = await prisma.scheduledNotification.count()
console.log(`DELETED: ${result.count} rows (older than ${SEVEN_DAYS_AGO.toISOString()})`)
console.log(`AFTER: ${after} rows remaining`)

await prisma.$disconnect()
