import { prisma } from '@/lib/prisma'

export interface EmailFailureData {
  emailType: 'dose-reminder' | 'order-confirmation' | 'seller-notification' | 'shipping-confirmation'
  recipient: string
  userId?: string
  errorMessage: string
  errorCode?: string
  errorStack?: string
  payload?: any
}

export class EmailFailureLogger {
  /**
   * Log an email send failure to the database
   */
  static async logFailure(data: EmailFailureData): Promise<void> {
    try {
      await prisma.emailFailureLog.create({
        data: {
          emailType: data.emailType,
          recipient: data.recipient,
          userId: data.userId,
          errorMessage: data.errorMessage,
          errorCode: data.errorCode,
          errorStack: data.errorStack,
          payload: data.payload,
          attemptedAt: new Date(),
          retryCount: 0,
          retrySuccess: false
        }
      })

      console.error(`📧 Email failure logged: ${data.emailType} to ${data.recipient}`)
    } catch (logError: any) {
      // Don't let logging failures crash the app
      console.error('Failed to log email failure:', logError.message)
    }
  }

  /**
   * Get recent email failures
   */
  static async getRecentFailures(hours: number = 24, limit: number = 50) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)

    return await prisma.emailFailureLog.findMany({
      where: {
        attemptedAt: { gte: cutoff }
      },
      orderBy: { attemptedAt: 'desc' },
      take: limit
    })
  }

  /**
   * Get failure statistics
   */
  static async getFailureStats(hours: number = 24) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)

    const failures = await prisma.emailFailureLog.findMany({
      where: {
        attemptedAt: { gte: cutoff }
      }
    })

    const byType = failures.reduce((acc, f) => {
      acc[f.emailType] = (acc[f.emailType] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const byErrorCode = failures.reduce((acc, f) => {
      const code = f.errorCode || 'unknown'
      acc[code] = (acc[code] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      totalFailures: failures.length,
      byType,
      byErrorCode,
      mostRecentFailure: failures[0]?.attemptedAt || null
    }
  }

  /**
   * Mark a failure as retried successfully
   */
  static async markRetrySuccess(failureId: string): Promise<void> {
    await prisma.emailFailureLog.update({
      where: { id: failureId },
      data: {
        retrySuccess: true,
        retryCount: { increment: 1 }
      }
    })
  }
}
