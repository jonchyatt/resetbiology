import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'

// GET: Load user's vision training progress
export async function GET(request: Request) {
  try {
    const session = await auth0.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find user by Auth0 sub OR email
    let user = await prisma.user.findUnique({
      where: { auth0Sub: session.user.sub }
    })

    if (!user && session.user.email) {
      user = await prisma.user.findUnique({
        where: { email: session.user.email }
      })

      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { auth0Sub: session.user.sub }
        })
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Load progress for both near and far vision
    const progress = await prisma.visionProgress.findMany({
      where: { userId: user.id }
    })

    // Get recent sessions for trend data
    const recentSessions = await prisma.visionSession.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20
    })

    const binocularHistory = await prisma.visionSession.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 200
    })

    const binocularSessions = binocularHistory.filter(s => s.binocularMode)
    const modeBreakdown = binocularSessions.reduce((acc, session) => {
      const mode = session.binocularMode || 'unknown'
      const existing = acc[mode] || {
        mode,
        bouts: 0,
        totalSeconds: 0,
        fusionHeldSeconds: 0,
        focusCounts: {} as Record<string, number>,
        deviceCounts: {} as Record<string, number>
      }

      const duration = session.duration || 0
      existing.bouts += 1
      existing.totalSeconds += duration
      existing.fusionHeldSeconds += session.binocularFusionHeldSeconds || 0
      if (session.trainingFocus) {
        existing.focusCounts[session.trainingFocus] = (existing.focusCounts[session.trainingFocus] || 0) + 1
      }
      if (session.deviceMode) {
        existing.deviceCounts[session.deviceMode] = (existing.deviceCounts[session.deviceMode] || 0) + 1
      }
      acc[mode] = existing
      return acc
    }, {} as Record<string, {
      mode: string
      bouts: number
      totalSeconds: number
      fusionHeldSeconds: number
      focusCounts: Record<string, number>
      deviceCounts: Record<string, number>
    }>)

    const binocularSummary = {
      totalBouts: binocularSessions.length,
      totalSeconds: binocularSessions.reduce((sum, session) => sum + (session.duration || 0), 0),
      modeBreakdown: Object.values(modeBreakdown)
        .map(mode => ({
          ...mode,
          totalMinutes: Math.round((mode.totalSeconds / 60) * 10) / 10,
          fusionHeldMinutes: Math.round((mode.fusionHeldSeconds / 60) * 10) / 10
        }))
        .sort((a, b) => b.totalSeconds - a.totalSeconds)
    }

    // Calculate weekly trend
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    const weekSessions = recentSessions.filter(
      s => new Date(s.createdAt) >= weekAgo
    )

    return NextResponse.json({
      success: true,
      progress,
      recentSessions,
      binocularSummary,
      weeklyStats: {
        sessionsThisWeek: weekSessions.length,
        avgAccuracyThisWeek: weekSessions.length > 0
          ? weekSessions.reduce((sum, s) => sum + s.accuracy, 0) / weekSessions.length
          : 0,
        successRateThisWeek: weekSessions.length > 0
          ? (weekSessions.filter(s => s.success).length / weekSessions.length) * 100
          : 0
      }
    })

  } catch (error) {
    console.error('GET /api/vision/progress error:', error)
    return NextResponse.json({
      error: 'Failed to load vision progress',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
