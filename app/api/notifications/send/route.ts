import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendDoseReminderEmail } from '@/lib/email'
import { CronHealthMonitor } from '@/lib/cronHealthMonitoring'
import webpush from 'web-push'

// Set VAPID keys (will be configured in .env)
webpush.setVapidDetails(
  'mailto:admin@resetbiology.com',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

async function sendNotifications() {
  const monitor = new CronHealthMonitor()

  try {
    await monitor.start('notification-send')

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

      if (notification.type === 'push') {
        if (notification.user.pushSubscriptions.length === 0) {
          console.warn('⚠️  No push subscriptions found for user:', notification.userId)
          errors.push({ id: notification.id, error: 'No push subscriptions' })
          continue
        }

        // Check if this is a test notification (fake protocolId)
        const isTestNotification = notification.protocolId === '000000000000000000000000'

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
                title: isTestNotification ? '🧪 Test Notification' : '💊 Dose Reminder',
                body: isTestNotification
                  ? 'Test notification sent successfully! Your notification system is working.'
                  : 'Time for your peptide dose!',
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
      } else if (notification.type === 'email') {
        if (!notification.user.email) {
          console.warn('⚠️  User missing email for notification:', notification.userId)
          errors.push({ id: notification.id, error: 'No email on file' })
        } else {
          try {
            const peptideName = notification.protocol?.peptides?.name || 'your peptide protocol'
            await sendDoseReminderEmail({
              email: notification.user.email,
              name: notification.user.name || 'Reset Biology member',
              peptideName,
              dosage: notification.protocol?.dosage || notification.protocol?.peptides?.dosage || 'Scheduled dose',
              reminderTime: notification.reminderTime
            })
            console.log('✅ Email notification sent successfully')
            results.push({ id: notification.id, status: 'sent-email' })
          } catch (error: any) {
            console.error('❌ Email notification failed:', error.message)
            errors.push({ id: notification.id, error: error.message })
            continue
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

    await monitor.complete({
      notificationsFound: notifications.length,
      notificationsSent: results.length,
      notificationsFailed: errors.length,
      metadata: { results, errors }
    })

    return {
      found: notifications.length,
      sent: results.length,
      failed: errors.length,
      results,
      errors
    }
  } catch (error: any) {
    console.error('💥 Fatal error in sendNotifications:', error)

    await monitor.fail(error, {
      errorMessage: error.message,
      errorStack: error.stack
    })

    throw error
  }
}

// GET handler for Vercel Cron (crons use GET by default)
export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  const querySecret = req.nextUrl.searchParams.get('secret')
  const vercelCronHeader = req.headers.get('x-vercel-cron')
  const cronSecret = process.env.CRON_SECRET

  const authorized =
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (cronSecret && querySecret === cronSecret) ||
    (vercelCronHeader && process.env.CRON_ALLOW_HEADER === 'true')

  if (!authorized) {
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
  const querySecret = req.nextUrl.searchParams.get('secret')
  const cronSecret = process.env.CRON_SECRET

  if (!(cronSecret && (authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('🔔 Manual notification send triggered')
  const result = await sendNotifications()
  return NextResponse.json(result)
}
