import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendDoseReminderEmail } from '@/lib/email'
import { CronHealthMonitor } from '@/lib/cronHealthMonitoring'
import webpush from 'web-push'

export const dynamic = 'force-dynamic'

// Set VAPID keys lazily to prevent build-time errors when env vars missing
let vapidConfigured = false
function ensureVapid(): boolean {
  if (vapidConfigured) return true
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (pub && pub.length > 0 && priv && priv.length > 0) {
    try {
      webpush.setVapidDetails('mailto:admin@resetbiology.com', pub, priv)
      vapidConfigured = true
      return true
    } catch { return false }
  }
  return false
}

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

      let notificationSent = false
      let subscriptionsToDelete: string[] = []

      if (notification.type === 'push') {
        if (!ensureVapid()) {
          console.warn('⚠️  VAPID keys not configured, skipping push notification')
          errors.push({ id: notification.id, error: 'VAPID keys not configured' })
          continue
        }

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
            notificationSent = true
          } catch (error: any) {
            console.error('❌ Push notification failed:', {
              error: error.message,
              statusCode: error.statusCode
            })

            // Check if subscription is expired/invalid (410 Gone or 404 Not Found)
            if (error.statusCode === 410 || error.statusCode === 404) {
              console.warn('🗑️  Marking subscription for deletion:', sub.id)
              subscriptionsToDelete.push(sub.id)
            }

            errors.push({
              id: notification.id,
              status: 'failed',
              error: error.message,
              statusCode: error.statusCode
            })
          }
        }

        // Clean up expired subscriptions
        if (subscriptionsToDelete.length > 0) {
          await prisma.pushSubscription.deleteMany({
            where: {
              id: {
                in: subscriptionsToDelete
              }
            }
          })
          console.log(`🗑️  Deleted ${subscriptionsToDelete.length} expired push subscriptions`)
        }
      } else if (notification.type === 'email') {
        if (!notification.user.email) {
          console.warn('⚠️  User missing email for notification:', notification.userId)
          errors.push({ id: notification.id, error: 'No email on file' })
        } else {
          try {
            // For test notifications, use generic message. For real notifications, we'd need to fetch protocol separately
            const isTestNotification = notification.protocolId === '000000000000000000000000'
            const peptideName = isTestNotification ? 'your peptide protocol' : 'your scheduled peptide'

            await sendDoseReminderEmail({
              email: notification.user.email,
              name: notification.user.name || 'Reset Biology member',
              peptideName,
              dosage: undefined, // Could fetch protocol separately if needed
              reminderTime: notification.reminderTime
            })
            console.log('✅ Email notification sent successfully')
            results.push({ id: notification.id, status: 'sent-email' })
            notificationSent = true
          } catch (error: any) {
            console.error('❌ Email notification failed:', error.message)
            errors.push({ id: notification.id, error: error.message })
            continue
          }
        }
      }

      // ONLY mark as sent if at least one notification was delivered successfully
      if (notificationSent) {
        await prisma.scheduledNotification.update({
          where: { id: notification.id },
          data: { sent: true, sentAt: new Date() }
        })
      }
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
