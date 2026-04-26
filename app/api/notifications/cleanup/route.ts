import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const RETENTION_DAYS = 7
// Drive on-demand idempotency rows are tiny but only useful within a few
// ticks of the dose. 48h is enough to cover any clock skew / late retry.
const DELIVERY_RETENTION_HOURS = 48

/**
 * Cleanup stale notification rows. Runs daily at 3 AM UTC via Vercel Cron.
 *
 * - scheduledNotification: legacy Mongo path, deleted after RETENTION_DAYS.
 *   Without this the queue grows unbounded (replenish adds 30-days-ahead per
 *   active protocol, which exhausted Atlas M0's 512MB on 2026-04-26).
 *
 * - notificationDelivery: P2.4 idempotency log for Drive-primary users,
 *   deleted after DELIVERY_RETENTION_HOURS. Bounded daily cardinality so
 *   it never grows large, but no reason to keep it forever.
 */
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

  const scheduledCutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
  const deliveryCutoff = new Date(Date.now() - DELIVERY_RETENTION_HOURS * 60 * 60 * 1000)

  try {
    const [scheduledBefore, deliveryBefore] = await Promise.all([
      prisma.scheduledNotification.count(),
      prisma.notificationDelivery.count(),
    ])

    const [scheduledDeleted, deliveryDeleted] = await Promise.all([
      prisma.scheduledNotification.deleteMany({
        where: { reminderTime: { lt: scheduledCutoff } },
      }),
      prisma.notificationDelivery.deleteMany({
        where: { sentAt: { lt: deliveryCutoff } },
      }),
    ])

    const [scheduledAfter, deliveryAfter] = await Promise.all([
      prisma.scheduledNotification.count(),
      prisma.notificationDelivery.count(),
    ])

    console.log(
      `🧹 cleanup: scheduled ${scheduledBefore}→${scheduledAfter} (-${scheduledDeleted.count}), delivery ${deliveryBefore}→${deliveryAfter} (-${deliveryDeleted.count})`,
    )

    return NextResponse.json({
      success: true,
      scheduled: {
        retentionDays: RETENTION_DAYS,
        cutoff: scheduledCutoff.toISOString(),
        before: scheduledBefore,
        deleted: scheduledDeleted.count,
        after: scheduledAfter,
      },
      delivery: {
        retentionHours: DELIVERY_RETENTION_HOURS,
        cutoff: deliveryCutoff.toISOString(),
        before: deliveryBefore,
        deleted: deliveryDeleted.count,
        after: deliveryAfter,
      },
    })
  } catch (error: any) {
    console.error('💥 cleanup cron failed:', error)
    return NextResponse.json(
      { error: 'Cleanup failed', details: error.message },
      { status: 500 },
    )
  }
}
