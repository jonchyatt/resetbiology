import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession} from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'
import { scheduleNotificationsForProtocol, cancelNotificationsForProtocol } from '@/lib/scheduleNotifications'

export async function GET(req: NextRequest) {
  const session = await auth0.getSession()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { auth0Sub: session.user.sub },
        { email: session.user.email }
      ]
    },
    include: {
      notificationPreferences: true
    }
  })

  return NextResponse.json({ success: true, preferences: user?.notificationPreferences || [] })
}

export async function POST(req: NextRequest) {
  const session = await auth0.getSession()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { protocolId, pushEnabled, emailEnabled, reminderMinutes } = await req.json()

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { auth0Sub: session.user.sub },
        { email: session.user.email }
      ]
    }
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const preference = await prisma.notificationPreference.upsert({
    where: {
      userId_protocolId: {
        userId: user.id,
        protocolId
      }
    },
    create: {
      userId: user.id,
      protocolId,
      pushEnabled,
      emailEnabled,
      reminderMinutes
    },
    update: {
      pushEnabled,
      emailEnabled,
      reminderMinutes
    }
  })

  // Schedule or cancel notifications based on pushEnabled
  try {
    if (pushEnabled) {
      // Reschedule notifications with new preferences
      await scheduleNotificationsForProtocol(user.id, protocolId, {
        daysAhead: 30,
        forceReschedule: true // Delete old notifications and create new ones
      })
    } else {
      // Cancel all future notifications
      await cancelNotificationsForProtocol(user.id, protocolId)
    }
  } catch (error) {
    console.error('Error scheduling notifications:', error)
    // Don't fail the request if scheduling fails
  }

  return NextResponse.json({ success: true, preference })
}
