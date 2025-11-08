import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'
import { getUserFromSession } from '@/lib/getUserFromSession'
import webpush from 'web-push'
import { sendDoseReminderEmail } from '@/lib/email'

// Set VAPID keys (will be configured in .env)
webpush.setVapidDetails(
  'mailto:admin@resetbiology.com',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

/**
 * Manual notification send trigger
 * Allows logged-in users to manually trigger pending notifications
 * Useful for testing without waiting for cron job
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🚀 Manual notification send triggered by user:', user.id)

    const now = new Date()

    // Find notifications to send (all pending, regardless of reminderTime for testing)
    // In production, you might want to limit this to only the current user's notifications
    const notifications = await prisma.scheduledNotification.findMany({
      where: {
        userId: user.id, // Only send notifications for the current user
        sent: false,
        reminderTime: {
          lte: now // Only send notifications that are due
        }
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
        reminderTime: notification.reminderTime,
        subscriptions: notification.user.pushSubscriptions.length
      })

      if (notification.type === 'push') {
        if (notification.user.pushSubscriptions.length === 0) {
          console.warn('⚠️  No push subscriptions found for user:', notification.userId)
          errors.push({
            id: notification.id,
            error: 'No push subscriptions found'
          })
          continue
        }

        // Check if this is a test notification (fake protocolId)
        const isTestNotification = notification.protocolId === '000000000000000000000000'

        for (const sub of notification.user.pushSubscriptions) {
          try {
            console.log('📱 Sending push notification to endpoint:', sub.endpoint.substring(0, 50) + '...')

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
                tag: `dose-${notification.id}`,
                timestamp: Date.now()
              })
            )

            console.log('✅ Push notification sent successfully')
            results.push({
              id: notification.id,
              status: 'sent',
              endpoint: sub.endpoint.substring(0, 30) + '...'
            })
          } catch (error: any) {
            console.error('❌ Push notification failed:', {
              error: error.message,
              statusCode: error.statusCode,
              endpoint: sub.endpoint.substring(0, 50) + '...'
            })

            errors.push({
              id: notification.id,
              status: 'failed',
              error: error.message,
              statusCode: error.statusCode
            })
          }
        }
      } else if (notification.type === 'email') {
        if (!notification.user.email) {
          console.warn('�s��,?  No email on record for user:', notification.userId)
          errors.push({
            id: notification.id,
            error: 'No email on record'
          })
        } else {
          try {
            const peptideName = notification.protocol?.peptides?.name || 'your peptide protocol'
            await sendDoseReminderEmail({
              email: notification.user.email,
              name: notification.user.name || undefined,
              peptideName,
              dosage: notification.protocol?.dosage || undefined,
              reminderTime: notification.reminderTime
            })
            results.push({
              id: notification.id,
              status: 'sent-email'
            })
          } catch (err: any) {
            console.error('�?O Email notification failed:', err.message)
            errors.push({
              id: notification.id,
              status: 'failed',
              error: err.message
            })
          }
        }
      }

      // Mark as sent
      try {
        await prisma.scheduledNotification.update({
          where: { id: notification.id },
          data: { sent: true, sentAt: new Date() }
        })
        console.log('✓ Notification marked as sent:', notification.id)
      } catch (error: any) {
        console.error('❌ Failed to mark notification as sent:', error.message)
      }
    }

    const response = {
      success: true,
      sent: results.length,
      failed: errors.length,
      results,
      errors,
      message: results.length > 0
        ? `Sent ${results.length} notification(s) successfully`
        : 'No pending notifications to send'
    }

    console.log('📊 Send-now result:', response)

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('❌ Send-now error:', error)
    return NextResponse.json({
      error: 'Failed to send notifications',
      details: error.message || 'Unknown error',
      stack: error.stack?.split('\n')[0]
    }, { status: 500 })
  }
}

/**
 * GET: Check pending notifications status
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()

    // Count pending notifications
    const pendingCount = await prisma.scheduledNotification.count({
      where: {
        userId: user.id,
        sent: false,
        reminderTime: {
          lte: now
        }
      }
    })

    // Get upcoming notifications (next hour)
    const upcoming = await prisma.scheduledNotification.findMany({
      where: {
        userId: user.id,
        sent: false,
        reminderTime: {
          gte: now,
          lte: new Date(now.getTime() + 60 * 60 * 1000)
        }
      },
      orderBy: {
        reminderTime: 'asc'
      },
      take: 5
    })

    return NextResponse.json({
      success: true,
      pending: pendingCount,
      upcoming: upcoming.length,
      upcomingNotifications: upcoming
    })
  } catch (error: any) {
    console.error('❌ Error checking notifications:', error)
    return NextResponse.json({
      error: 'Failed to check notifications',
      details: error.message || 'Unknown error'
    }, { status: 500 })
  }
}
