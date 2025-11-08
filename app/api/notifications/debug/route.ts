import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'
import { getUserFromSession } from '@/lib/getUserFromSession'

/**
 * Debug endpoint to check notification system status
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check VAPID keys
    const vapidConfigured = !!(
      process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    )

    // Check push subscriptions
    const pushSubscriptions = await prisma.pushSubscription.findMany({
      where: { userId: user.id }
    })

    // Check recent test notifications
    const testNotifications = await prisma.scheduledNotification.findMany({
      where: {
        userId: user.id,
        protocolId: '000000000000000000000000' // Test mode ID
      },
      orderBy: { reminderTime: 'desc' },
      take: 5
    })

    // Check pending notifications
    const pendingNotifications = await prisma.scheduledNotification.findMany({
      where: {
        userId: user.id,
        sent: false,
        reminderTime: { lte: new Date() }
      },
      take: 5
    })

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email
      },
      vapidConfigured,
      vapidPublicKeyPresent: !!process.env.VAPID_PUBLIC_KEY,
      vapidPrivateKeyPresent: !!process.env.VAPID_PRIVATE_KEY,
      vapidPublicKeyClientPresent: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      pushSubscriptions: {
        count: pushSubscriptions.length,
        subscriptions: pushSubscriptions.map(sub => ({
          id: sub.id,
          endpoint: sub.endpoint.substring(0, 50) + '...',
          createdAt: sub.createdAt
        }))
      },
      testNotifications: {
        count: testNotifications.length,
        notifications: testNotifications.map(n => ({
          id: n.id,
          reminderTime: n.reminderTime,
          sent: n.sent,
          sentAt: n.sentAt,
          type: n.type
        }))
      },
      pendingNotifications: {
        count: pendingNotifications.length,
        notifications: pendingNotifications.map(n => ({
          id: n.id,
          reminderTime: n.reminderTime,
          type: n.type
        }))
      }
    })
  } catch (error: any) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
