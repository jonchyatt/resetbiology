import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'
import { getUserFromSession } from '@/lib/getUserFromSession'

/**
 * Test notification endpoint
 * Creates a test notification scheduled 60 seconds from now
 * Hidden feature for testing the notification pipeline
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { delaySeconds = 60 } = body

    // Create test notification times
    const now = new Date()
    const reminderTime = new Date(now.getTime() + delaySeconds * 1000)
    const doseTime = new Date(reminderTime.getTime() + 1000) // 1 second after reminder

    console.log('🧪 Creating test notification:', {
      userId: user.id,
      reminderTime: reminderTime.toISOString(),
      doseTime: doseTime.toISOString(),
      delaySeconds
    })

    // Create a test scheduled notification
    // Use a valid MongoDB ObjectId format (24 hex chars) for test
    const testNotification = await prisma.scheduledNotification.create({
      data: {
        userId: user.id,
        protocolId: '000000000000000000000000', // Valid ObjectId for test mode
        doseTime,
        reminderTime,
        type: 'push',
        sent: false
      }
    })

    console.log('✅ Test notification created:', testNotification.id)

    return NextResponse.json({
      success: true,
      notification: {
        id: testNotification.id,
        reminderTime: testNotification.reminderTime,
        doseTime: testNotification.doseTime,
        willSendIn: `${delaySeconds} seconds`
      },
      message: `Test notification scheduled for ${reminderTime.toLocaleTimeString()}`
    })
  } catch (error: any) {
    console.error('❌ Test notification error:', error)
    return NextResponse.json({
      error: 'Failed to create test notification',
      details: error.message || 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * GET: Check status of recent test notifications
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get recent test notifications (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

    const testNotifications = await prisma.scheduledNotification.findMany({
      where: {
        userId: user.id,
        protocolId: '000000000000000000000000', // Match test mode ObjectId
        reminderTime: {
          gte: oneHourAgo
        }
      },
      orderBy: {
        reminderTime: 'desc'
      },
      take: 10
    })

    return NextResponse.json({
      success: true,
      notifications: testNotifications,
      count: testNotifications.length
    })
  } catch (error: any) {
    console.error('❌ Error fetching test notifications:', error)
    return NextResponse.json({
      error: 'Failed to fetch test notifications',
      details: error.message || 'Unknown error'
    }, { status: 500 })
  }
}
