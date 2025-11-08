import { NextRequest, NextResponse } from 'next/server'
import { CronHealthMonitor } from '@/lib/cronHealthMonitoring'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await auth0.getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get health stats
    const stats = await CronHealthMonitor.getHealthStats(24)
    const isHealthy = await CronHealthMonitor.isHealthy(10) // Within last 10 minutes
    const lastSuccess = await CronHealthMonitor.getLastSuccessfulRun()

    // Get recent checks
    const recentChecks = await prisma.cronHealthCheck.findMany({
      where: { cronType: 'notification-send' },
      orderBy: { startedAt: 'desc' },
      take: 10
    })

    return NextResponse.json({
      healthy: isHealthy,
      lastSuccessfulRun: lastSuccess,
      stats,
      recentChecks
    })
  } catch (error: any) {
    console.error('Error fetching cron health:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
