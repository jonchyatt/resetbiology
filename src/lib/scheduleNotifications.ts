import { prisma } from './prisma'

/**
 * Schedules push notifications for a protocol based on user preferences
 * Called when:
 * - A new protocol is created
 * - Notification preferences are updated
 * - A protocol is resumed/reactivated
 */
export async function scheduleNotificationsForProtocol(
  userId: string,
  protocolId: string,
  options?: {
    daysAhead?: number // How many days ahead to schedule (default: 30)
    forceReschedule?: boolean // Delete existing and reschedule
  }
) {
  const { daysAhead = 30, forceReschedule = false } = options || {}

  try {
    // Get protocol details
    const protocol = await prisma.user_peptide_protocols.findUnique({
      where: { id: protocolId },
      include: { peptides: true }
    })

    if (!protocol || protocol.userId !== userId) {
      throw new Error('Protocol not found or access denied')
    }

    // Get notification preferences
    const prefs = await prisma.notificationPreference.findUnique({
      where: {
        userId_protocolId: {
          userId,
          protocolId
        }
      }
    })

    // If no preferences or push is disabled, don't schedule
    if (!prefs || !prefs.pushEnabled) {
      console.log(`Push notifications disabled for protocol ${protocolId}`)
      return { scheduled: 0, message: 'Push notifications disabled' }
    }

    // Delete existing future notifications if forceReschedule
    if (forceReschedule) {
      await prisma.scheduledNotification.deleteMany({
        where: {
          userId,
          protocolId,
          sent: false,
          reminderTime: {
            gte: new Date()
          }
        }
      })
    }

    // Parse dose times from protocol.timing or notes
    // Expected format: "08:00" or "08:00/20:00" (multiple times separated by /)
    const doseTimes = parseDoseTimes(protocol.timing || '')

    if (doseTimes.length === 0) {
      console.log(`No dose times found for protocol ${protocolId}`)
      return { scheduled: 0, message: 'No dose times configured' }
    }

    // Generate dose dates based on frequency
    const doseDates = generateDoseDates(protocol, daysAhead)

    // Create scheduled notifications
    const notifications = []
    for (const doseDate of doseDates) {
      for (const doseTime of doseTimes) {
        // Combine date and time
        const [hours, minutes] = doseTime.split(':').map(Number)
        const doseDateTime = new Date(doseDate)
        doseDateTime.setHours(hours, minutes, 0, 0)

        // Calculate reminder time (subtract reminderMinutes)
        const reminderTime = new Date(doseDateTime)
        reminderTime.setMinutes(reminderTime.getMinutes() - prefs.reminderMinutes)

        // Only schedule if reminder time is in the future
        if (reminderTime > new Date()) {
          notifications.push({
            userId,
            protocolId,
            doseTime: doseDateTime,
            reminderTime,
            type: 'push',
            sent: false
          })
        }
      }
    }

    // Bulk insert notifications
    if (notifications.length > 0) {
      await prisma.scheduledNotification.createMany({
        data: notifications
      })
    }

    console.log(`✅ Scheduled ${notifications.length} notifications for protocol ${protocolId}`)
    return { scheduled: notifications.length, message: 'Success' }

  } catch (error) {
    console.error('Error scheduling notifications:', error)
    throw error
  }
}

/**
 * Parse dose times from protocol notes/frequency string
 * Examples: "08:00", "08:00/20:00", "Daily 08:00", "Mon-Fri 08:00/20:00"
 */
function parseDoseTimes(text: string): string[] {
  const times: string[] = []

  // Match time patterns like 08:00, 8:00 AM, etc.
  const timeRegex = /\b(\d{1,2}):(\d{2})\b/g
  let match

  while ((match = timeRegex.exec(text)) !== null) {
    const hours = match[1].padStart(2, '0')
    const minutes = match[2]
    times.push(`${hours}:${minutes}`)
  }

  return [...new Set(times)] // Remove duplicates
}

/**
 * Generate dose dates based on protocol frequency
 */
function generateDoseDates(protocol: any, daysAhead: number): Date[] {
  const dates: Date[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const startDate = protocol.startDate ? new Date(protocol.startDate) : new Date()
  startDate.setHours(0, 0, 0, 0)

  const frequency = (protocol.frequency || '').toLowerCase()
  let currentDate = new Date(Math.max(today.getTime(), startDate.getTime()))
  const endDate = new Date(currentDate)
  endDate.setDate(endDate.getDate() + daysAhead)

  while (currentDate <= endDate) {
    let shouldSchedule = false

    // Determine if dose should be scheduled based on frequency
    if (frequency.includes('daily') || frequency.includes('every day')) {
      shouldSchedule = true
    } else if (frequency.includes('every other day')) {
      const daysSinceStart = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      shouldSchedule = daysSinceStart % 2 === 0
    } else if (frequency.includes('3x per week') || frequency.includes('3x/week')) {
      const dayOfWeek = currentDate.getDay()
      shouldSchedule = [1, 3, 5].includes(dayOfWeek) // Mon, Wed, Fri
    } else if (frequency.includes('2x per week') || frequency.includes('2x/week')) {
      const dayOfWeek = currentDate.getDay()
      shouldSchedule = [1, 4].includes(dayOfWeek) // Mon, Thu
    } else if (frequency.includes('mon-fri') || frequency.includes('5 days on')) {
      const dayOfWeek = currentDate.getDay()
      shouldSchedule = dayOfWeek >= 1 && dayOfWeek <= 5 // Mon-Fri
    } else if (frequency.includes('once per week')) {
      const dayOfWeek = currentDate.getDay()
      shouldSchedule = dayOfWeek === 1 // Monday
    } else {
      // Default to daily if can't parse frequency
      shouldSchedule = true
    }

    if (shouldSchedule) {
      dates.push(new Date(currentDate))
    }

    // Move to next day
    currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
  }

  return dates
}

/**
 * Cancel all future notifications for a protocol
 */
export async function cancelNotificationsForProtocol(
  userId: string,
  protocolId: string
) {
  await prisma.scheduledNotification.deleteMany({
    where: {
      userId,
      protocolId,
      sent: false,
      reminderTime: {
        gte: new Date()
      }
    }
  })

  console.log(`✅ Cancelled notifications for protocol ${protocolId}`)
}
