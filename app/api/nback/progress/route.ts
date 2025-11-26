import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Helper to find user by auth0Sub or email
async function resolveUser(session: any) {
  const authUser = session?.user
  if (!authUser) return null

  let user = authUser.sub
    ? await prisma.user.findUnique({ where: { auth0Sub: authUser.sub } })
    : null

  if (!user && authUser.email) {
    user = await prisma.user.findUnique({ where: { email: authUser.email } })
    if (user && authUser.sub && user.auth0Sub !== authUser.sub) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { auth0Sub: authUser.sub }
      })
    }
  }

  return user
}

/**
 * GET /api/nback/progress
 * Fetch user's N-Back progress and stats
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth0.getSession()
    const user = await resolveUser(session)

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get progress records for both game modes
    const progress = await prisma.nBackProgress.findMany({
      where: { userId: user.id }
    })

    // Get recent sessions
    const recentSessions = await prisma.nBackSession.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20
    })

    // Calculate weekly stats
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const weekSessions = await prisma.nBackSession.findMany({
      where: {
        userId: user.id,
        createdAt: { gte: oneWeekAgo }
      }
    })

    const weeklyStats = {
      sessionsThisWeek: weekSessions.length,
      avgAccuracyThisWeek: weekSessions.length > 0
        ? Math.round(weekSessions.reduce((sum, s) => sum + s.overallAccuracy, 0) / weekSessions.length)
        : 0,
      advancementsThisWeek: weekSessions.filter(s => s.levelAdvanced).length,
      totalTrialsThisWeek: weekSessions.reduce((sum, s) => sum + s.totalTrials, 0),
      totalTimeThisWeek: weekSessions.reduce((sum, s) => sum + s.durationSeconds, 0)
    }

    // Calculate accuracy trends (last 10 sessions per mode)
    const dualSessions = recentSessions
      .filter(s => s.gameMode === 'dual')
      .slice(0, 10)
      .reverse()

    const tripleSessions = recentSessions
      .filter(s => s.gameMode === 'triple')
      .slice(0, 10)
      .reverse()

    const trends = {
      dual: dualSessions.map(s => ({
        date: s.createdAt,
        accuracy: s.overallAccuracy,
        nLevel: s.nLevel
      })),
      triple: tripleSessions.map(s => ({
        date: s.createdAt,
        accuracy: s.overallAccuracy,
        nLevel: s.nLevel
      }))
    }

    // Get all-time stats
    const allSessions = await prisma.nBackSession.findMany({
      where: { userId: user.id },
      select: {
        nLevel: true,
        overallAccuracy: true,
        levelAdvanced: true,
        durationSeconds: true,
        gameMode: true
      }
    })

    const allTimeStats = {
      totalSessions: allSessions.length,
      totalTimeMinutes: Math.round(allSessions.reduce((sum, s) => sum + s.durationSeconds, 0) / 60),
      highestNLevel: allSessions.length > 0 ? Math.max(...allSessions.map(s => s.nLevel)) : 2,
      totalAdvancements: allSessions.filter(s => s.levelAdvanced).length,
      avgAccuracy: allSessions.length > 0
        ? Math.round(allSessions.reduce((sum, s) => sum + s.overallAccuracy, 0) / allSessions.length)
        : 0
    }

    return NextResponse.json({
      success: true,
      progress,
      recentSessions,
      weeklyStats,
      trends,
      allTimeStats
    })
  } catch (error: any) {
    console.error('GET /api/nback/progress error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch progress' },
      { status: 500 }
    )
  }
}
