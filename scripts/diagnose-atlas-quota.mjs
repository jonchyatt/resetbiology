import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
config({ path: '.env.local' })

const prisma = new PrismaClient()

const counts = {}
const models = [
  'user', 'peptide', 'user_peptide_protocols', 'peptide_doses',
  'scheduledNotification', 'notificationPreference', 'pushSubscription',
  'foodEntry', 'workoutSession', 'journalEntry', 'mealPlan',
  'dailyTask', 'session', 'account',
]

for (const m of models) {
  try {
    counts[m] = await prisma[m].count()
  } catch (e) {
    counts[m] = `ERR: ${e.message.split('\n')[0].substring(0, 100)}`
  }
}

const sentVsQueued = {}
try {
  sentVsQueued.scheduledNotificationSent = await prisma.scheduledNotification.count({ where: { sent: true } })
  sentVsQueued.scheduledNotificationUnsent = await prisma.scheduledNotification.count({ where: { sent: false } })
  const past = await prisma.scheduledNotification.count({ where: { reminderTime: { lt: new Date() } } })
  sentVsQueued.scheduledNotificationPastReminder = past
} catch (e) {
  sentVsQueued.error = e.message.substring(0, 200)
}

console.log(JSON.stringify({ counts, sentVsQueued }, null, 2))
await prisma.$disconnect()
