import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { scheduleNotificationsForProtocol } from '@/lib/scheduleNotifications'

/**
 * Replenish notification queue for active protocols
 * Runs daily at 2 AM via Vercel Cron
 * Ensures protocols always have 30 days of notifications scheduled ahead
 */
export async function GET(req: NextRequest) {
  // Verify cron authentication
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

  console.log('🔄 Replenish queue cron job triggered')

  try {
    // Find all active protocols
    const activeProtocols = await prisma.user_peptide_protocols.findMany({
      where: {
        isActive: true
      },
      include: {
        peptides: true // Include peptide info for logging
      }
    })

    console.log(`📋 Found ${activeProtocols.length} active protocols`)

    const results = []
    const errors = []

    for (const protocol of activeProtocols) {
      try {
        // Count how many future notifications exist for this protocol
        const futureCount = await prisma.scheduledNotification.count({
          where: {
            protocolId: protocol.id,
            sent: false,
            reminderTime: {
              gte: new Date()
            }
          }
        })

        // If less than 20 days of notifications remain, replenish to 30 days
        const daysRemaining = Math.floor(futureCount / 2) // Assuming 2 notifications per day on average

        if (daysRemaining < 20) {
          console.log(`📅 Protocol ${protocol.id} has only ${daysRemaining} days remaining, replenishing...`)

          const result = await scheduleNotificationsForProtocol(
            protocol.userId,
            protocol.id,
            {
              daysAhead: 30,
              forceReschedule: false // Don't delete existing, just add more
            }
          )

          results.push({
            protocolId: protocol.id,
            peptideName: protocol.peptides?.name || 'Unknown',
            scheduled: result.scheduled,
            message: result.message
          })
        } else {
          console.log(`✅ Protocol ${protocol.id} has ${daysRemaining} days remaining, skipping`)
        }
      } catch (error: any) {
        console.error(`❌ Error replenishing protocol ${protocol.id}:`, error)
        errors.push({
          protocolId: protocol.id,
          error: error.message
        })
      }
    }

    return NextResponse.json({
      success: true,
      processed: activeProtocols.length,
      replenished: results.length,
      errorCount: errors.length,
      results,
      errors
    })

  } catch (error: any) {
    console.error('💥 Fatal error in replenish-queue:', error)
    return NextResponse.json({
      error: 'Failed to replenish queue',
      details: error.message
    }, { status: 500 })
  }
}
