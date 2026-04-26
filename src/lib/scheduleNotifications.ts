import { prisma } from './prisma'
import { fromZonedTime } from 'date-fns-tz'

/**
 * Schedules push notifications for a protocol based on user preferences
 * Called when:
 * - A new protocol is created
 * - Notification preferences are updated
 * - A protocol is resumed/reactivated
 */
type NotificationChannel = 'push' | 'email'

export async function scheduleNotificationsForProtocol(
  userId: string,
  protocolId: string,
  options?: {
    daysAhead?: number // How many days ahead to schedule (default: 30)
    forceReschedule?: boolean // Delete existing and reschedule
    timezone?: string
    reminderMinutes?: number
  }
) {
  const { daysAhead = 30, forceReschedule = false, timezone: overrideTimezone, reminderMinutes: overrideReminder } = options || {}

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

    if (!prefs) {
      console.log(`No notification preferences found for protocol ${protocolId}`)
      return { scheduled: 0, message: 'No preferences' }
    }

    const channels: NotificationChannel[] = []
    if (prefs.pushEnabled) channels.push('push')
    if (prefs.emailEnabled) channels.push('email')

    if (channels.length === 0) {
      console.log(`No notification channels enabled for protocol ${protocolId}`)
      await prisma.scheduledNotification.deleteMany({
        where: {
          userId,
          protocolId
        }
      })
      return { scheduled: 0, message: 'No channels enabled' }
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

    // Skip notification scheduling for "as needed" medications
    const timingLower = (protocol.timing || '').toLowerCase()
    const frequencyLower = (protocol.frequency || '').toLowerCase()
    if (timingLower.includes('as needed') || frequencyLower.includes('as needed')) {
      console.log(`Protocol ${protocolId} is "as needed" - skipping notification scheduling`)
      return { scheduled: 0, message: 'As-needed medications do not have scheduled notifications' }
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

    const timezone = overrideTimezone || prefs.timezone || 'UTC'
    const reminderMinutes = overrideReminder ?? prefs.reminderMinutes ?? 15

    const now = new Date()
    // Create scheduled notifications
    const notifications: Array<{
      userId: string
      protocolId: string
      doseTime: Date
      reminderTime: Date
      type: NotificationChannel
      sent: boolean
    }> = []
    for (const doseDate of doseDates) {
      for (const doseTime of doseTimes) {
        const doseDateTime = toUtcFromLocal(doseDate, doseTime, timezone)
        const reminderTime = new Date(doseDateTime.getTime() - reminderMinutes * 60 * 1000)

        // Only schedule if reminder time is in the future
        if (reminderTime > now) {
          channels.forEach((type) => {
            notifications.push({
              userId,
              protocolId,
              doseTime: doseDateTime,
              reminderTime,
              type,
              sent: false
            })
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
 * Also handles: "AM & PM (twice daily)", "AM", "PM", "twice daily"
 */
export function parseDoseTimes(text: string): string[] {
  const times: string[] = []

  // First, try to match explicit time patterns like 08:00, 8:00 AM, etc.
  const timeRegex = /\b(\d{1,2}):(\d{2})\b/g
  let match

  while ((match = timeRegex.exec(text)) !== null) {
    const hours = match[1].padStart(2, '0')
    const minutes = match[2]
    times.push(`${hours}:${minutes}`)
  }

  // If no explicit times found, parse keywords
  if (times.length === 0) {
    const lowerText = text.toLowerCase()

    // Check for "twice daily" or variations
    if (lowerText.includes('twice') || (lowerText.includes('am') && lowerText.includes('pm'))) {
      times.push('08:00', '20:00') // Morning and evening
    }
    // Check for AM only
    else if (lowerText.includes('am') || lowerText.includes('morning')) {
      times.push('08:00')
    }
    // Check for PM only
    else if (lowerText.includes('pm') || lowerText.includes('evening')) {
      times.push('20:00')
    }
    // Default to midday if nothing else matches
    else if (lowerText.includes('daily') || lowerText.includes('once')) {
      times.push('12:00')
    }
  }

  return [...new Set(times)] // Remove duplicates
}

/**
 * Convert a local date + time within a timezone to an absolute UTC Date
 */
export function toUtcFromLocal(date: Date, time: string, timeZone: string): Date {
  const pad = (value: number) => value.toString().padStart(2, '0')
  const localDate = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${time}:00`
  return fromZonedTime(localDate, timeZone)
}

/**
 * Pure rule: should a dose fire on this calendar day given the protocol's
 * frequency? Exported so the on-demand Drive cron can reuse the same logic
 * as the legacy Mongo path without duplication.
 */
export function shouldScheduleOnDate(
  protocol: { startDate?: Date | null; frequency: string },
  date: Date,
): boolean {
  const frequency = (protocol.frequency || '').toLowerCase()
  const startDate = protocol.startDate ? new Date(protocol.startDate) : new Date()
  startDate.setHours(0, 0, 0, 0)

  if (frequency.includes('daily') || frequency.includes('every day')) {
    return true
  }
  if (frequency.includes('every other day')) {
    const daysSinceStart = Math.floor((date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    return daysSinceStart >= 0 && daysSinceStart % 2 === 0
  }
  const dayOfWeek = date.getDay()
  if (frequency.includes('3x per week') || frequency.includes('3x/week')) {
    return [1, 3, 5].includes(dayOfWeek)
  }
  if (frequency.includes('2x per week') || frequency.includes('2x/week')) {
    return [1, 4].includes(dayOfWeek)
  }
  if (frequency.includes('mon-fri') || frequency.includes('5 days on')) {
    return dayOfWeek >= 1 && dayOfWeek <= 5
  }
  if (frequency.includes('once per week')) {
    return dayOfWeek === 1
  }
  // Default to daily if frequency is unrecognized
  return true
}

/**
 * Generate dose dates based on protocol frequency.
 *
 * `daysBefore` lets the on-demand Drive cron look back across UTC midnight
 * for users in negative-offset timezones whose late-evening local dose
 * lands on the next UTC day. The legacy Mongo replenish path leaves it at
 * 0 (the default) and behaves exactly as before.
 */
export function generateDoseDates(
  protocol: { startDate?: Date | null; frequency: string },
  daysAhead: number,
  daysBefore: number = 0,
): Date[] {
  const dates: Date[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const startDate = protocol.startDate ? new Date(protocol.startDate) : new Date()
  startDate.setHours(0, 0, 0, 0)

  const earliest = new Date(today.getTime() - daysBefore * 24 * 60 * 60 * 1000)
  let currentDate = new Date(Math.max(earliest.getTime(), startDate.getTime()))
  const endDate = new Date(today.getTime() + daysAhead * 24 * 60 * 60 * 1000)

  while (currentDate <= endDate) {
    if (shouldScheduleOnDate(protocol, currentDate)) {
      dates.push(new Date(currentDate))
    }
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
