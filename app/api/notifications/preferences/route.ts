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
  const session = await auth0.getSession()
  const user = await getUserFromSession(session)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { protocolId, pushEnabled, emailEnabled, reminderMinutes } = await req.json()

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

  // Create scheduled notifications if push is enabled
  if (pushEnabled) {
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

      // Parse timing from notes (e.g., "Timing: AM" -> "AM")
      const timing = protocol.notes?.replace('Timing: ', '') || 'AM'
      const frequency = protocol.frequency.toLowerCase()

      // Calculate dose times for the next 7 days
      const doseSchedule = calculateDoseSchedule(timing, frequency)

      // Create scheduled notifications
      const notifications = doseSchedule.map(doseTime => {
        const reminderTime = new Date(doseTime.getTime() - reminderMinutes * 60 * 1000)
        return {
          userId: user.id,
          protocolId,
          doseTime,
          reminderTime,
          type: 'push'
        }
      })

      await prisma.scheduledNotification.createMany({
        data: notifications
      })
    }
  }

  return NextResponse.json(preference)
}

// Helper function to calculate dose schedule
function calculateDoseSchedule(timing: string, frequency: string): Date[] {
  const schedule: Date[] = []
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // Parse timing into hour(s)
  const timeMap: Record<string, number[]> = {
    'am': [8],
    'pm': [20],
    'twice daily': [8, 20],
    'morning': [8],
    'evening': [20],
    'before bed': [22],
    'upon waking': [7]
  }

  const hours = timeMap[timing.toLowerCase()] || [8]

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
