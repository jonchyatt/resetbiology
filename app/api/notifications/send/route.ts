import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendDoseReminderEmail } from '@/lib/email'
import { CronHealthMonitor } from '@/lib/cronHealthMonitoring'
import { isVaultConnected } from '@/lib/vaultService'
import { listActiveProtocolsLite } from '@/lib/protocols-store'
import { computeDueReminders } from '@/lib/computeReminders'
import webpush from 'web-push'

export const dynamic = 'force-dynamic'

// Vercel cron runs this every 5 min. The Drive on-demand path uses a
// 15-min lookback window so a single missed tick doesn't drop reminders
// (NotificationDelivery dedup prevents double-sends within the lookback).
const DRIVE_LOOKBACK_MINUTES = 15

// Set VAPID keys lazily to prevent build-time errors when env vars missing
let vapidConfigured = false
function ensureVapid(): boolean {
  if (vapidConfigured) return true
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (pub && pub.length > 0 && priv && priv.length > 0) {
    try {
      webpush.setVapidDetails('mailto:admin@resetbiology.com', pub, priv)
      vapidConfigured = true
      return true
    } catch { return false }
  }
  return false
}

// ---------------------------------------------------------------------------
// PASS 1 — Legacy Mongo path (pre-Drive users + protocols still in Mongo)
// ---------------------------------------------------------------------------

async function sendMongoNotifications() {
  const now = new Date()

  // Defensive: exclude any pre-generated row whose protocol now routes to
  // Drive. The Drive on-demand pass is the source of truth for those, and
  // `createProtocol`/`updateProtocol` already skip pre-generation when
  // connected — but a future migration / replenish bug could leave stragglers.
  // Codex P2.4-HIGH-2 fix.
  const notifications = await prisma.scheduledNotification.findMany({
    where: {
      reminderTime: { lte: now },
      sent: false,
      protocol: { driveProtocolId: null },
    },
    include: {
      user: {
        include: { pushSubscriptions: true },
      },
    },
  })

  console.log(`📬 [mongo] Found ${notifications.length} pending notifications`)

  const results: Array<{ id: string; status: string }> = []
  const errors: Array<{ id: string; error: string; statusCode?: number }> = []

  for (const notification of notifications) {
    const subscriptionsToDelete: string[] = []
    let notificationSent = false

    if (notification.type === 'push') {
      if (!ensureVapid()) {
        errors.push({ id: notification.id, error: 'VAPID keys not configured' })
        continue
      }
      if (notification.user.pushSubscriptions.length === 0) {
        errors.push({ id: notification.id, error: 'No push subscriptions' })
        continue
      }

      const isTestNotification = notification.protocolId === '000000000000000000000000'
      for (const sub of notification.user.pushSubscriptions) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: sub.keys as any },
            JSON.stringify({
              title: isTestNotification ? '🧪 Test Notification' : '💊 Dose Reminder',
              body: isTestNotification
                ? 'Test notification sent successfully! Your notification system is working.'
                : 'Time for your peptide dose!',
              url: '/peptides',
              tag: `dose-${notification.id}`,
            }),
          )
          results.push({ id: notification.id, status: 'sent' })
          notificationSent = true
        } catch (error: any) {
          if (error.statusCode === 410 || error.statusCode === 404) {
            subscriptionsToDelete.push(sub.id)
          }
          errors.push({
            id: notification.id,
            error: error.message,
            statusCode: error.statusCode,
          })
        }
      }

      if (subscriptionsToDelete.length > 0) {
        await prisma.pushSubscription.deleteMany({
          where: { id: { in: subscriptionsToDelete } },
        })
      }
    } else if (notification.type === 'email') {
      if (!notification.user.email) {
        errors.push({ id: notification.id, error: 'No email on file' })
      } else {
        try {
          const isTestNotification = notification.protocolId === '000000000000000000000000'
          const peptideName = isTestNotification ? 'your peptide protocol' : 'your scheduled peptide'
          await sendDoseReminderEmail({
            email: notification.user.email,
            name: notification.user.name || 'Reset Biology member',
            peptideName,
            dosage: undefined,
            reminderTime: notification.reminderTime,
          })
          results.push({ id: notification.id, status: 'sent-email' })
          notificationSent = true
        } catch (error: any) {
          errors.push({ id: notification.id, error: error.message })
          continue
        }
      }
    }

    if (notificationSent) {
      await prisma.scheduledNotification.update({
        where: { id: notification.id },
        data: { sent: true, sentAt: new Date() },
      })
    }
  }

  return { found: notifications.length, sent: results.length, failed: errors.length, results, errors }
}

// ---------------------------------------------------------------------------
// PASS 2 — Drive on-demand compute (Phase 2.4)
// ---------------------------------------------------------------------------

async function sendDriveReminders() {
  const now = new Date()
  const windowStart = new Date(now.getTime() - DRIVE_LOOKBACK_MINUTES * 60 * 1000)

  // Gather all preferences for protocols that route to Drive. The cheapest
  // filter is `where protocol.driveProtocolId is set` — Mongo doesn't support
  // joins in Prisma's where clause, so query prefs first and join in memory.
  const allPrefs = await prisma.notificationPreference.findMany({
    where: {
      OR: [{ pushEnabled: true }, { emailEnabled: true }],
    },
  })

  if (allPrefs.length === 0) {
    return { found: 0, sent: 0, failed: 0, results: [], errors: [] }
  }

  // Group by user — one Drive read per user, not per protocol
  const prefsByUser = new Map<string, typeof allPrefs>()
  for (const pref of allPrefs) {
    const arr = prefsByUser.get(pref.userId) ?? []
    arr.push(pref)
    prefsByUser.set(pref.userId, arr)
  }

  const results: Array<{ userId: string; protocolId: string; status: string; doseTime: string }> = []
  const errors: Array<{ userId: string; protocolId?: string; error: string }> = []
  let totalDue = 0

  for (const [userId, prefs] of prefsByUser) {
    let connected: boolean
    try {
      connected = await isVaultConnected(userId)
    } catch (err: any) {
      errors.push({ userId, error: `vault status check failed: ${err.message}` })
      continue
    }
    if (!connected) continue

    let activeProtocols: Awaited<ReturnType<typeof listActiveProtocolsLite>>
    try {
      activeProtocols = await listActiveProtocolsLite(userId)
    } catch (err: any) {
      errors.push({ userId, error: `Drive read failed: ${err.message}` })
      continue
    }

    // Only consider protocols that actually live in Drive
    const driveProtocols = activeProtocols.filter((p) => p.driveProtocolId)
    if (driveProtocols.length === 0) continue

    const protocolById = new Map(driveProtocols.map((p) => [p.protocolId, p]))

    for (const pref of prefs) {
      const protocol = protocolById.get(pref.protocolId)
      if (!protocol) continue // pref orphaned (protocol archived) — skip

      const due = computeDueReminders({
        protocol: {
          startDate: protocol.startDate,
          endDate: protocol.endDate,
          frequency: protocol.frequency,
          timing: protocol.timing,
        },
        prefs: {
          pushEnabled: pref.pushEnabled,
          emailEnabled: pref.emailEnabled,
          reminderMinutes: pref.reminderMinutes ?? 15,
          timezone: pref.timezone ?? null,
        },
        windowStart,
        windowEnd: now,
      })

      if (due.length === 0) continue
      totalDue += due.length

      // Load user + subscriptions once for this protocol's reminders
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { pushSubscriptions: true },
      })
      if (!user) {
        errors.push({ userId, protocolId: pref.protocolId, error: 'user vanished' })
        continue
      }

      for (const reminder of due) {
        // Idempotency check — if we already delivered this dose+type, skip
        try {
          await prisma.notificationDelivery.create({
            data: {
              userId,
              protocolId: pref.protocolId,
              doseTime: reminder.doseTime,
              type: reminder.type,
            },
          })
        } catch (err: any) {
          // Unique constraint violation = already sent. That's the happy path.
          if (err.code === 'P2002') continue
          errors.push({
            userId,
            protocolId: pref.protocolId,
            error: `dedup write failed: ${err.message}`,
          })
          continue
        }

        // Past the dedup gate — actually send
        try {
          if (reminder.type === 'push') {
            if (!ensureVapid()) {
              errors.push({ userId, protocolId: pref.protocolId, error: 'VAPID not configured' })
              continue
            }
            if (user.pushSubscriptions.length === 0) {
              errors.push({ userId, protocolId: pref.protocolId, error: 'No push subscriptions' })
              continue
            }
            const subscriptionsToDelete: string[] = []
            for (const sub of user.pushSubscriptions) {
              try {
                await webpush.sendNotification(
                  { endpoint: sub.endpoint, keys: sub.keys as any },
                  JSON.stringify({
                    title: '💊 Dose Reminder',
                    body: `Time for your ${protocol.peptideName} dose`,
                    url: '/peptides',
                    tag: `dose-drive-${pref.protocolId}-${reminder.doseTime.getTime()}`,
                  }),
                )
                results.push({
                  userId,
                  protocolId: pref.protocolId,
                  status: 'sent',
                  doseTime: reminder.doseTime.toISOString(),
                })
              } catch (error: any) {
                if (error.statusCode === 410 || error.statusCode === 404) {
                  subscriptionsToDelete.push(sub.id)
                }
                errors.push({
                  userId,
                  protocolId: pref.protocolId,
                  error: `push: ${error.message} [${error.statusCode}]`,
                })
              }
            }
            if (subscriptionsToDelete.length > 0) {
              await prisma.pushSubscription.deleteMany({
                where: { id: { in: subscriptionsToDelete } },
              })
            }
          } else if (reminder.type === 'email') {
            if (!user.email) {
              errors.push({ userId, protocolId: pref.protocolId, error: 'No email on file' })
              continue
            }
            await sendDoseReminderEmail({
              email: user.email,
              name: user.name || 'Reset Biology member',
              peptideName: protocol.peptideName,
              dosage: protocol.dosage,
              reminderTime: reminder.reminderTime,
            })
            results.push({
              userId,
              protocolId: pref.protocolId,
              status: 'sent-email',
              doseTime: reminder.doseTime.toISOString(),
            })
          }
        } catch (error: any) {
          errors.push({
            userId,
            protocolId: pref.protocolId,
            error: `send failed: ${error.message}`,
          })
        }
      }
    }
  }

  return { found: totalDue, sent: results.length, failed: errors.length, results, errors }
}

// ---------------------------------------------------------------------------
// Dispatcher — runs both passes, aggregates, records health
// ---------------------------------------------------------------------------

async function sendNotifications() {
  const monitor = new CronHealthMonitor()
  try {
    await monitor.start('notification-send')

    const [mongoResult, driveResult] = await Promise.all([
      sendMongoNotifications().catch((err) => ({
        found: 0,
        sent: 0,
        failed: 0,
        results: [],
        errors: [{ id: 'pass-1', error: err.message }],
      })),
      sendDriveReminders().catch((err) => ({
        found: 0,
        sent: 0,
        failed: 0,
        results: [],
        errors: [{ userId: 'pass-2', error: err.message }],
      })),
    ])

    const totalFound = mongoResult.found + driveResult.found
    const totalSent = mongoResult.sent + driveResult.sent
    const totalFailed = mongoResult.failed + driveResult.failed

    console.log('📊 Send complete:', {
      mongo: { found: mongoResult.found, sent: mongoResult.sent, failed: mongoResult.failed },
      drive: { found: driveResult.found, sent: driveResult.sent, failed: driveResult.failed },
    })

    await monitor.complete({
      notificationsFound: totalFound,
      notificationsSent: totalSent,
      notificationsFailed: totalFailed,
      metadata: { mongo: mongoResult, drive: driveResult },
    })

    return {
      found: totalFound,
      sent: totalSent,
      failed: totalFailed,
      mongo: mongoResult,
      drive: driveResult,
    }
  } catch (error: any) {
    console.error('💥 Fatal error in sendNotifications:', error)
    await monitor.fail(error, { errorMessage: error.message, errorStack: error.stack })
    throw error
  }
}

// ---------------------------------------------------------------------------
// HTTP handlers
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const querySecret = req.nextUrl.searchParams.get('secret')
  const vercelCronHeader = req.headers.get('x-vercel-cron')
  const cronSecret = process.env.CRON_SECRET

  const authorized =
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (cronSecret && querySecret === cronSecret) ||
    (vercelCronHeader && process.env.CRON_ALLOW_HEADER === 'true')

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('🔔 Cron job triggered notification send')
  const result = await sendNotifications()
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const querySecret = req.nextUrl.searchParams.get('secret')
  const cronSecret = process.env.CRON_SECRET

  if (!(cronSecret && (authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('🔔 Manual notification send triggered')
  const result = await sendNotifications()
  return NextResponse.json(result)
}
