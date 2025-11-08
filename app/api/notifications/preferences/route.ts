import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { scheduleNotificationsForProtocol, cancelNotificationsForProtocol } from '@/lib/scheduleNotifications'

export async function GET(req: NextRequest) {
  const session = await auth0.getSession()
  const user = await getUserFromSession(session)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const protocolId = req.nextUrl.searchParams.get('protocolId')

  if (protocolId) {
    const preference = await prisma.notificationPreference.findUnique({
      where: {
        userId_protocolId: {
          userId: user.id,
          protocolId
        }
      }
    })

    return NextResponse.json({
      success: true,
      preference
    })
  }

  const userWithPreferences = await prisma.user.findUnique({
    where: {
      id: user.id
    },
    include: {
      notificationPreferences: true
    }
  })

  return NextResponse.json({
    success: true,
    preferences: userWithPreferences?.notificationPreferences || []
  })
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { protocolId, pushEnabled, emailEnabled, reminderMinutes, timezone } = body

    if (!protocolId) {
      return NextResponse.json({ error: 'Protocol ID required' }, { status: 400 })
    }

    const existingPreference = await prisma.notificationPreference.findUnique({
      where: {
        userId_protocolId: {
          userId: user.id,
          protocolId
        }
      }
    })

    const fallbackTimezone =
      timezone ||
      existingPreference?.timezone ||
      (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')

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
        pushEnabled: pushEnabled ?? true,
        emailEnabled: emailEnabled ?? false,
        reminderMinutes: reminderMinutes ?? existingPreference?.reminderMinutes ?? 15,
        timezone: fallbackTimezone
      },
      update: {
        pushEnabled,
        emailEnabled,
        reminderMinutes,
        timezone: fallbackTimezone
      }
    })

    try {
      if (preference.pushEnabled || preference.emailEnabled) {
        await scheduleNotificationsForProtocol(user.id, protocolId, {
          daysAhead: 30,
          forceReschedule: true,
          timezone: fallbackTimezone,
          reminderMinutes: preference.reminderMinutes
        })
      } else {
        await cancelNotificationsForProtocol(user.id, protocolId)
      }
    } catch (scheduleError) {
      console.error('Error scheduling notifications:', scheduleError)
    }

    return NextResponse.json({ success: true, preference })
  } catch (error: any) {
    console.error('POST /api/notifications/preferences error:', error)
    return NextResponse.json({
      error: 'Failed to save notification preferences',
      details: error.message || 'Unknown error'
    }, { status: 500 })
  }
}
