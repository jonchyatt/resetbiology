import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'
import { getUserFromSession } from '@/lib/getUserFromSession'

export async function GET(req: NextRequest) {
  const session = await auth0.getSession()
  const user = await getUserFromSession(session)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    const { protocolId, pushEnabled, emailEnabled, reminderMinutes } = await req.json()

    if (!protocolId) {
      return NextResponse.json({ error: 'Protocol ID required' }, { status: 400 })
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
        pushEnabled: pushEnabled ?? true,
        emailEnabled: emailEnabled ?? false,
        reminderMinutes: reminderMinutes ?? 15
      },
      update: {
        pushEnabled,
        emailEnabled,
        reminderMinutes
      }
    })

    // Create scheduled notifications if push is enabled
    if (pushEnabled) {
      try {
        // Get the protocol to understand the dose schedule
        const protocol = await prisma.user_peptide_protocols.findUnique({
          where: { id: protocolId }
        })

        if (protocol) {
          // Delete existing unsent notifications for this protocol
          await prisma.scheduledNotification.deleteMany({
            where: {
              userId: user.id,
              protocolId: protocolId,
              sent: false
            }
          })

          // Parse timing from protocol.timing field (e.g., "08:00" or "08:00/20:00")
          const timing = protocol.timing || 'AM'
          const frequency = protocol.frequency.toLowerCase()

          // Calculate dose times for the next 7 days
          const doseSchedule = calculateDoseSchedule(timing, frequency)

          // Create scheduled notifications
          const notifications = doseSchedule.map(doseTime => {
            const reminderTime = new Date(doseTime.getTime() - (reminderMinutes ?? 15) * 60 * 1000)
            return {
              userId: user.id,
              protocolId,
              doseTime,
              reminderTime,
              type: 'push'
            }
          })

          if (notifications.length > 0) {
            await prisma.scheduledNotification.createMany({
              data: notifications
            })
          }
        }
      } catch (scheduleError) {
        console.error('Error scheduling notifications:', scheduleError)
        // Don't fail the whole request if scheduling fails
      }
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

// Helper function to calculate dose schedule
function calculateDoseSchedule(timing: string, frequency: string): Date[] {
  const schedule: Date[] = []
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // Parse timing into hour(s)
  let hours: number[] = []

  // Check if timing contains HH:MM format (e.g., "08:00" or "14:30/20:00")
  const timeRegex = /(\d{1,2}):(\d{2})/g
  const timeMatches = [...timing.matchAll(timeRegex)]

  if (timeMatches.length > 0) {
    // Parse HH:MM format times
    hours = timeMatches.map(match => parseInt(match[1], 10))
  } else {
    // Fallback to text-based timing
    const timeMap: Record<string, number[]> = {
      'am': [8],
      'pm': [20],
      'twice daily': [8, 20],
      'morning': [8],
      'evening': [20],
      'before bed': [22],
      'upon waking': [7]
    }
    hours = timeMap[timing.toLowerCase()] || [8]
  }

  // Calculate doses for next 7 days
  for (let day = 0; day < 7; day++) {
    const shouldDoseToday = frequency === 'daily' ||
      (frequency === 'every other day' && day % 2 === 0) ||
      (frequency === '3x per week' && [0, 2, 4].includes(day)) ||
      (frequency === '2x per week' && [0, 3].includes(day))

    if (shouldDoseToday) {
      hours.forEach(hour => {
        const doseTime = new Date(startOfToday)
        doseTime.setDate(doseTime.getDate() + day)
        doseTime.setHours(hour, 0, 0, 0)

        // Only schedule future doses
        if (doseTime > now) {
          schedule.push(doseTime)
        }
      })
    }
  }

  return schedule
}
