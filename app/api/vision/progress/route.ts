import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'

const PHASE_BOUNDARY_WEEKS = [2, 4, 6, 8, 10]

interface SnellenTrendPoint {
  x: number
  week: number | null
  day: number | null
  date: Date
  baseline?: boolean
  denominator: number
  display: string
  label: string
}

function parseSnellenDenominator(value?: string | null) {
  if (!value) return null
  const match = value.match(/^20\s*\/\s*(\d+)/i)
  if (!match) return null

  const denominator = Number(match[1])
  return Number.isFinite(denominator) ? denominator : null
}

function dailySessionX(week: number, day: number) {
  const normalizedWeek = Math.max(1, Math.min(12, week))
  const normalizedDay = Math.max(1, Math.min(5, day || 1))
  return normalizedWeek - 1 + normalizedDay / 5
}

function weekFromProgramStart(startDate: Date, eventDate: Date) {
  const dayMs = 24 * 60 * 60 * 1000
  const elapsedDays = Math.max(0, Math.floor((eventDate.getTime() - startDate.getTime()) / dayMs))
  return Math.max(1, Math.min(12, Math.floor(elapsedDays / 7) + 1))
}

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

    const trendSessions = await prisma.visionSession.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      take: 200
    })

    const enrollment = await prisma.visionProgramEnrollment.findUnique({
      where: { userId: user.id },
      include: {
        dailySessions: {
          orderBy: [
            { week: 'asc' },
            { day: 'asc' },
            { completedAt: 'asc' }
          ]
        }
      }
    })

    const dailySessions = enrollment?.dailySessions || []
    const snellenNear: SnellenTrendPoint[] = []
    const snellenFar: SnellenTrendPoint[] = []

    const addSnellenPoint = (
      series: SnellenTrendPoint[],
      value: string | null | undefined,
      point: { x: number; week: number | null; day: number | null; date: Date; baseline?: boolean }
    ) => {
      const denominator = parseSnellenDenominator(value)
      if (!denominator || !value) return

      series.push({
        ...point,
        denominator,
        display: value,
        label: point.baseline ? 'Baseline' : `W${point.week}D${point.day}`
      })
    }

    if (enrollment) {
      addSnellenPoint(snellenNear, enrollment.initialNearSnellen, {
        x: 0,
        week: null,
        day: null,
        date: enrollment.startDate,
        baseline: true
      })
      addSnellenPoint(snellenFar, enrollment.initialFarSnellen, {
        x: 0,
        week: null,
        day: null,
        date: enrollment.startDate,
        baseline: true
      })
    }

    dailySessions.forEach((dailySession) => {
      const point = {
        x: dailySessionX(dailySession.week, dailySession.day),
        week: dailySession.week,
        day: dailySession.day,
        date: dailySession.completedAt,
        baseline: false
      }

      addSnellenPoint(snellenNear, dailySession.nearSnellenResult, point)
      addSnellenPoint(snellenFar, dailySession.farSnellenResult, point)
    })

    const weeklyMinutes = Array.from({ length: 12 }, (_, index) => ({
      week: index + 1,
      baselineMinutes: 0,
      exerciseMinutes: 0,
      totalMinutes: 0,
      sessions: 0
    }))

    dailySessions.forEach((dailySession) => {
      if (dailySession.week < 1 || dailySession.week > 12) return
      const weekly = weeklyMinutes[dailySession.week - 1]
      weekly.baselineMinutes += dailySession.baselineMinutes || 0
      weekly.exerciseMinutes += dailySession.exerciseMinutes || 0
      weekly.totalMinutes += dailySession.totalMinutes || 0
      weekly.sessions += 1
    })

    const accuracyTrend = trendSessions.map((visionSession, index) => {
      const eventDate = new Date(visionSession.createdAt)
      const week = enrollment ? weekFromProgramStart(enrollment.startDate, eventDate) : null

      return {
        x: week || Math.min(12, index + 1),
        week,
        date: eventDate,
        label: week ? `Week ${week}` : `Session ${index + 1}`,
        accuracy: visionSession.accuracy,
        visionType: visionSession.visionType,
        exerciseType: visionSession.exerciseType
      }
    })

    dailySessions.forEach((dailySession) => {
      if (dailySession.accuracy === null || dailySession.accuracy === undefined) return
      accuracyTrend.push({
        x: dailySessionX(dailySession.week, dailySession.day),
        week: dailySession.week,
        date: dailySession.completedAt,
        label: `W${dailySession.week}D${dailySession.day}`,
        accuracy: dailySession.accuracy,
        visionType: 'daily',
        exerciseType: 'program'
      })
    })

    accuracyTrend.sort((a, b) => a.date.getTime() - b.date.getTime())

    const trendData = {
      phaseBoundaries: PHASE_BOUNDARY_WEEKS,
      snellen: {
        near: snellenNear,
        far: snellenFar
      },
      accuracy: accuracyTrend,
      weeklyMinutes
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
      trendData,
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
