import { prisma } from './prisma'
import { fromZonedTime } from 'date-fns-tz'
import { isDoseDayForProtocol, parseDoseTimes } from './peptide-frequency'

// Re-exported so existing importers (computeReminders.ts) are unaffected —
// the parse itself now lives in peptide-frequency.ts (no prisma import) so
// the client-side Weekly Schedule grid can reuse the exact same logic
// without pulling a server-only module into the browser bundle (H3).
export { parseDoseTimes }

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
 * as the legacy Mongo path without duplication. Delegates to the shared
 * (frequency, startDate, date) primitive in peptide-frequency.ts so this
 * scheduler and the Weekly Schedule display grid can never disagree (H3).
 */
export function shouldScheduleOnDate(
  protocol: { startDate?: Date | null; frequency: string },
  date: Date,
): boolean {
  const startDate = protocol.startDate ? new Date(protocol.startDate) : new Date()
  startDate.setHours(0, 0, 0, 0)

  return isDoseDayForProtocol(protocol.frequency || '', startDate, date)
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
