import { NextRequest, NextResponse } from 'next/server'
import {
  backfillDriveSyncOutbox,
  drainDriveSyncOutbox,
  reconcileDriveSyncOutbox,
} from '@/lib/driveSyncQueue'

export const dynamic = 'force-dynamic'

async function runDriveSyncDrain(req: NextRequest) {
  await reconcileDriveSyncOutbox()

  // Missing-intent sweep: rides the */5 cron on the first tick of every 6th hour
  // (4x/day, no marker state). `?backfill=1` forces it — same auth guard as the
  // drain — with optional windowHours/userId for scoped runs (e.g. one user's
  // historical vault backfill).
  const url = new URL(req.url)
  const force = url.searchParams.get('backfill') === '1'
  const now = new Date()
  const scheduled = now.getUTCHours() % 6 === 0 && now.getUTCMinutes() < 5
  let backfill: { scanned: number; created: number } | null = null
  if (force || scheduled) {
    backfill = await backfillDriveSyncOutbox({
      windowHours: force ? Number(url.searchParams.get('windowHours')) || undefined : undefined,
      userId: force ? url.searchParams.get('userId') || undefined : undefined,
    })
  }

  const drain = await drainDriveSyncOutbox()
  return { ...drain, backfill }
}

// Secrets travel in the Authorization header only — never a query string, which
// leaks into access logs / browser history (FLW LOW). Vercel's own cron uses the
// x-vercel-cron header + a Bearer CRON_SECRET.
function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  const authHeader = req.headers.get('authorization')
  if (authHeader === `Bearer ${cronSecret}`) return true
  const vercelCronHeader = req.headers.get('x-vercel-cron')
  return Boolean(vercelCronHeader && process.env.CRON_ALLOW_HEADER === 'true')
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await runDriveSyncDrain(req)
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await runDriveSyncDrain(req)
  return NextResponse.json(result)
}
