import { NextRequest, NextResponse } from 'next/server'
import {
  drainDriveSyncOutbox,
  reconcileDriveSyncOutbox,
} from '@/lib/driveSyncQueue'

export const dynamic = 'force-dynamic'

async function runDriveSyncDrain() {
  await reconcileDriveSyncOutbox()
  return drainDriveSyncOutbox()
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
  const result = await runDriveSyncDrain()
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await runDriveSyncDrain()
  return NextResponse.json(result)
}
