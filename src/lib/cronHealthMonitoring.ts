import { prisma } from '@/lib/prisma'

interface CronHealthCheckData {
  notificationsFound?: number
  notificationsSent?: number
  notificationsFailed?: number
  errorMessage?: string
  errorStack?: string
  metadata?: any
}

export class CronHealthMonitor {
  private checkId: string | null = null

  /**
   * Start tracking a cron job execution
   */
  async start(cronType: string = 'notification-send'): Promise<string> {
    const check = await prisma.cronHealthCheck.create({
      data: {
        cronType,
        status: 'started',
        startedAt: new Date()
      }
    })

    this.checkId = check.id
    console.log(`🏥 Cron health check started: ${this.checkId}`)
    return this.checkId
  }

  /**
   * Mark cron job as successfully completed
   */
  async complete(data: CronHealthCheckData): Promise<void> {
    if (!this.checkId) {
      console.warn('⚠️  CronHealthMonitor: No active check to complete')
      return
    }

    const startedCheck = await prisma.cronHealthCheck.findUnique({
      where: { id: this.checkId }
    })

    if (!startedCheck) {
      console.warn('⚠️  CronHealthMonitor: Check not found in database')
      return
    }

    const duration = Date.now() - startedCheck.startedAt.getTime()

    await prisma.cronHealthCheck.update({
      where: { id: this.checkId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        duration,
        notificationsFound: data.notificationsFound,
        notificationsSent: data.notificationsSent,
        notificationsFailed: data.notificationsFailed,
        metadata: data.metadata
      }
    })

    console.log(`✅ Cron health check completed: ${this.checkId} (${duration}ms)`)
    this.checkId = null
  }

  /**
   * Mark cron job as failed
   */
  async fail(error: Error, data?: CronHealthCheckData): Promise<void> {
    if (!this.checkId) {
      console.warn('⚠️  CronHealthMonitor: No active check to fail')
      return
    }

    const startedCheck = await prisma.cronHealthCheck.findUnique({
      where: { id: this.checkId }
    })

    if (!startedCheck) {
      console.warn('⚠️  CronHealthMonitor: Check not found in database')
      return
    }

    const duration = Date.now() - startedCheck.startedAt.getTime()

    await prisma.cronHealthCheck.update({
      where: { id: this.checkId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        duration,
        errorMessage: error.message,
        errorStack: error.stack,
        notificationsFound: data?.notificationsFound,
        notificationsSent: data?.notificationsSent,
        notificationsFailed: data?.notificationsFailed,
        metadata: data?.metadata
      }
    })

    console.error(`❌ Cron health check failed: ${this.checkId}`, error)
    this.checkId = null
  }

  /**
   * Check if cron job is healthy (ran recently)
   */
  static async isHealthy(withinMinutes: number = 10): Promise<boolean> {
    const cutoff = new Date(Date.now() - withinMinutes * 60 * 1000)

    const recentCheck = await prisma.cronHealthCheck.findFirst({
      where: {
        cronType: 'notification-send',
        startedAt: { gte: cutoff },
        status: { in: ['started', 'completed'] }
      },
      orderBy: { startedAt: 'desc' }
    })

    return !!recentCheck
  }

  /**
   * Get the last time cron ran successfully
   */
  static async getLastSuccessfulRun(): Promise<Date | null> {
    const lastCheck = await prisma.cronHealthCheck.findFirst({
      where: {
        cronType: 'notification-send',
        status: 'completed'
      },
      orderBy: { completedAt: 'desc' }
    })

    return lastCheck?.completedAt || null
  }

  /**
   * Get health statistics
   */
  static async getHealthStats(hours: number = 24) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)

    const checks = await prisma.cronHealthCheck.findMany({
      where: {
        cronType: 'notification-send',
        startedAt: { gte: cutoff }
      },
      orderBy: { startedAt: 'desc' }
    })

    const completed = checks.filter(c => c.status === 'completed').length
    const failed = checks.filter(c => c.status === 'failed').length
    const totalNotificationsSent = checks.reduce((sum, c) => sum + (c.notificationsSent || 0), 0)
    const avgDuration = checks.length > 0
      ? checks.reduce((sum, c) => sum + (c.duration || 0), 0) / checks.length
      : 0

    return {
      totalRuns: checks.length,
      completed,
      failed,
      successRate: checks.length > 0 ? (completed / checks.length) * 100 : 0,
      totalNotificationsSent,
      avgDurationMs: Math.round(avgDuration),
      lastRun: checks[0]?.startedAt || null
    }
  }
}
