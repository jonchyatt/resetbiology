import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import webpush from 'web-push'

// Set VAPID keys (will be configured in .env)
webpush.setVapidDetails(
  'mailto:admin@resetbiology.com',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

async function sendNotifications() {
  const now = new Date()

  // Find notifications to send
  const notifications = await prisma.scheduledNotification.findMany({
    where: {
      reminderTime: {
        lte: now
      },
      sent: false
    },
    include: {
      user: {
        include: {
          pushSubscriptions: true
        }
      }
    }
  })

  const results = []

  for (const notification of notifications) {
    // Send push notifications
    if (notification.type === 'push') {
      for (const sub of notification.user.pushSubscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: sub.keys as any
            },
            JSON.stringify({
              title: 'Dose Reminder',
              body: 'Time for your peptide dose!',
              url: '/peptides',
              tag: `dose-${notification.id}`
            })
          )
          results.push({ id: notification.id, status: 'sent' })
        } catch (error) {
          console.error('Push notification failed:', error)
          results.push({ id: notification.id, status: 'failed' })
        }
      }
    }

    // Mark as sent
    await prisma.scheduledNotification.update({
      where: { id: notification.id },
      data: { sent: true, sentAt: new Date() }
    })
  }

  return { sent: results.length, results }
}

// GET handler for Vercel Cron (crons use GET by default)
export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('🔔 Cron job triggered notification send')
  const result = await sendNotifications()
  return NextResponse.json(result)
}

// POST handler for manual/testing
export async function POST(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('🔔 Manual notification send triggered')
  const result = await sendNotifications()
  return NextResponse.json(result)
}
