import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { scheduleNotificationsForProtocol, cancelNotificationsForProtocol } from '@/lib/scheduleNotifications'

// Vision prefs are keyed on the user's own VisionProgramEnrollment id, which
// the client never gets to name directly (SECURITY: derived server-side from
// the authenticated session, never taken as a request param). Peptide prefs
// are keyed on a client-supplied protocolId, unchanged from before.
async function findOwnVisionEnrollment(userId: string) {
  return prisma.visionProgramEnrollment.findUnique({ where: { userId } })
}

const HH_MM_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function isValidTimezone(tz: string): boolean {
  try {
    // Throws RangeError for an unrecognized IANA zone.
    Intl.DateTimeFormat(undefined, { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  const session = await auth0.getSession()
  const user = await getUserFromSession(session)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const protocolId = req.nextUrl.searchParams.get('protocolId')
  const protocolType = req.nextUrl.searchParams.get('protocolType')

  if (protocolType === 'vision') {
    // Scoped to the authenticated user's own enrollment — never a client-supplied id.
    const enrollment = await findOwnVisionEnrollment(user.id)
    if (!enrollment) {
      return NextResponse.json({ success: true, preference: null })
    }

    const preference = await prisma.notificationPreference.findUnique({
      where: {
        userId_protocolId: {
          userId: user.id,
          protocolId: enrollment.id
        }
      }
    })

    return NextResponse.json({ success: true, preference })
  }

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
    const { protocolType, pushEnabled, emailEnabled, reminderMinutes, timezone, dailyReminderTime } = body

    let protocolId: string

    if (protocolType === 'vision') {
      // SECURITY: the vision enrollment id is NEVER accepted from the client.
      // It is looked up by the authenticated user's own id and used as the
      // protocolId server-side — a client cannot target another user's
      // enrollment by passing an arbitrary protocolId.
      const enrollment = await findOwnVisionEnrollment(user.id)
      if (!enrollment || enrollment.status !== 'active') {
        return NextResponse.json({ error: 'No active vision enrollment' }, { status: 404 })
      }
      protocolId = enrollment.id

      if (dailyReminderTime !== undefined && dailyReminderTime !== null) {
        if (typeof dailyReminderTime !== 'string' || !HH_MM_RE.test(dailyReminderTime)) {
          return NextResponse.json({ error: 'dailyReminderTime must be HH:mm (24h)' }, { status: 400 })
        }
      }
      if (timezone !== undefined && timezone !== null) {
        if (typeof timezone !== 'string' || !isValidTimezone(timezone)) {
          return NextResponse.json({ error: 'Invalid timezone' }, { status: 400 })
        }
      }
    } else {
      // Existing peptide behavior — untouched.
      if (!body.protocolId) {
        return NextResponse.json({ error: 'Protocol ID required' }, { status: 400 })
      }
      protocolId = body.protocolId
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
        protocolType: protocolType === 'vision' ? 'vision' : 'peptide',
        pushEnabled: pushEnabled ?? true,
        emailEnabled: emailEnabled ?? false,
        reminderMinutes: reminderMinutes ?? existingPreference?.reminderMinutes ?? 15,
        timezone: fallbackTimezone,
        dailyReminderTime: protocolType === 'vision' ? (dailyReminderTime ?? existingPreference?.dailyReminderTime ?? null) : null
      },
      update: {
        pushEnabled,
        emailEnabled,
        reminderMinutes,
        timezone: fallbackTimezone,
        ...(protocolType === 'vision' && dailyReminderTime !== undefined ? { dailyReminderTime } : {})
      }
    })

    if (protocolType === 'vision') {
      // Nothing is pre-materialized for vision — PASS 2 computes on-demand.
      return NextResponse.json({ success: true, preference })
    }

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
