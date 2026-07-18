import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'
import { utcMidnightToDayKey } from '@/lib/localDay'
import { deriveOnboarding } from '@/lib/onboarding'

/**
 * GET /api/onboarding/status
 * STRICTLY read-only (FLOW-SPEC v2 GRANDFATHER MED-2). Session-scoped only —
 * every query below is filtered by the session user's own id (AUTH SCOPING
 * HIGH-1), never a client-supplied identity.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth0.getSession(request)
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [foodLogCount, dailyTaskDates, journalDates] = await Promise.all([
      prisma.foodLog.count({ where: { userId: user.id } }),
      prisma.dailyTask.findMany({ where: { userId: user.id }, select: { date: true } }),
      prisma.journalEntry.findMany({ where: { userId: user.id }, select: { date: true } }),
    ])

    // DailyTask.date and JournalEntry.date are both day-keys stamped at UTC
    // midnight (no dedicated localDate column on either — see localDay.ts).
    const historyDayKeys = [...dailyTaskDates, ...journalDates].map((row) => utcMidnightToDayKey(row.date))

    const result = deriveOnboarding({
      onboardingComplete: user.onboardingComplete,
      driveConnected: Boolean(user.googleDriveConnectedAt),
      firstWinDone: foodLogCount > 0 || dailyTaskDates.length > 0,
      historyDayKeys,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to load onboarding status:', error)
    return NextResponse.json({ error: 'Failed to load onboarding status' }, { status: 500 })
  }
}
