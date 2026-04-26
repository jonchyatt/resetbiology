import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const RETENTION_DAYS = 7

/**
 * Cleanup stale scheduled notifications
 * Runs daily at 3 AM UTC via Vercel Cron (after replenish-queue at 2 AM)
 *
 * Deletes scheduledNotification rows where reminderTime is older than RETENTION_DAYS.
 * Without this, the queue grows unbounded as the daily replenish cron adds 30-days-ahead
 * for every active protocol, which exhausted Atlas M0's 512MB quota and blocked all
 * peptide-tracker writes (root cause of the 2026-04-26 outage).
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

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)

  try {
    const before = await prisma.scheduledNotification.count()
    const deleted = await prisma.scheduledNotification.deleteMany({
      where: { reminderTime: { lt: cutoff } },
    })
    const after = await prisma.scheduledNotification.count()

    console.log(
      `🧹 cleanup: deleted ${deleted.count} stale notifications older than ${cutoff.toISOString()} (${before} → ${after})`,
    )

    return NextResponse.json({
      success: true,
      retentionDays: RETENTION_DAYS,
      cutoff: cutoff.toISOString(),
      before,
      deleted: deleted.count,
      after,
    })
  } catch (error: any) {
    console.error('💥 cleanup cron failed:', error)
    return NextResponse.json(
      { error: 'Cleanup failed', details: error.message },
      { status: 500 },
    )
  }
}
