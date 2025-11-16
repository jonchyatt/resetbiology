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
