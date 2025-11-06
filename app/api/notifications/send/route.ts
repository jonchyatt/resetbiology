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

  console.log(`📬 Found ${notifications.length} pending notifications to send`)

  const results = []
  const errors = []

  for (const notification of notifications) {
    console.log('📤 Processing notification:', {
      id: notification.id,
      userId: notification.userId,
      reminderTime: notification.reminderTime,
      subscriptions: notification.user.pushSubscriptions.length
    })

    // Send push notifications
    if (notification.type === 'push') {
      if (notification.user.pushSubscriptions.length === 0) {
        console.warn('⚠️  No push subscriptions found for user:', notification.userId)
        errors.push({ id: notification.id, error: 'No push subscriptions' })
        continue
      }

      for (const sub of notification.user.pushSubscriptions) {
        try {
          const endpointPreview = sub?.endpoint ? sub.endpoint.substring(0, 50) + '...' : 'unknown'
          console.log('📱 Sending to endpoint:', endpointPreview)
          console.log('📱 Subscription structure:', { hasEndpoint: !!sub?.endpoint, hasKeys: !!sub?.keys })

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
          console.log('✅ Notification sent successfully')
          results.push({ id: notification.id, status: 'sent' })
        } catch (error: any) {
          console.error('❌ Push notification failed:', {
            error: error.message,
            statusCode: error.statusCode
          })
          errors.push({
            id: notification.id,
            status: 'failed',
            error: error.message
          })
        }
      }
    }

    // Mark as sent
    await prisma.scheduledNotification.update({
      where: { id: notification.id },
      data: { sent: true, sentAt: new Date() }
    })
  }

  console.log('📊 Send complete:', {
    found: notifications.length,
    sent: results.length,
    failed: errors.length
  })

  return {
    found: notifications.length,
    sent: results.length,
    failed: errors.length,
    results,
    errors
  }
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
