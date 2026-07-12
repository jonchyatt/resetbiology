import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'

/**
 * Measured-progress trends (additive; W2.5).
 * engineResults are persisted on `vision_daily_sessions` via $runCommandRaw
 * $set and are NOT part of the Prisma schema — the typed client will never
 * return them, so we must read them back with a raw find + manual unwrap.
 * Metrics here are training-performance proxies, never clinical measurements
 * (plan §4.9) — this file only shapes numbers, it does not add acuity copy.
 */
type RawEngineResult = {
  exerciseId?: unknown
  score?: unknown
  metrics?: unknown
}

type MetricPoint = { date: string; value: number; exerciseId: string }
type SnellenPoint = { date: string; value: number; raw: string }

/** MongoDB raw commands return Extended JSON — dates may arrive as Date, ISO string, or {$date}. */
function extractIsoDate(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>
    if (typeof v.$date === 'string') return v.$date
    if (typeof v.$date === 'number') return new Date(v.$date).toISOString()
    if (v.$date && typeof v.$date === 'object') {
      const inner = (v.$date as Record<string, unknown>).$numberLong
      if (typeof inner === 'string') return new Date(Number(inner)).toISOString()
    }
  }
  return null
}

/** "20/40" -> 40 (bigger denominator = worse acuity self-test result). */
function snellenDenominator(raw: unknown): number | null {
  if (typeof raw !== 'string') return null
  const match = raw.match(/^20\/(\d+)$/)
  if (!match) return null
  const denom = Number(match[1])
  return Number.isFinite(denom) ? denom : null
}

async function buildMetricTrends(userId: string) {
  const empty = {
    snellenTrend: { near: [] as SnellenPoint[], far: [] as SnellenPoint[] },
    sessionScores: [] as { date: string; score: number }[],
  }

  try {
    const raw = (await prisma.$runCommandRaw({
      find: 'vision_daily_sessions',
      filter: { userId: { $oid: userId } },
      projection: {
        engineResults: 1,
        nearSnellenResult: 1,
        farSnellenResult: 1,
        completedAt: 1,
        localDate: 1,
        week: 1,
      },
      sort: { completedAt: -1 },
      limit: 60,
    })) as { cursor?: { firstBatch?: unknown[] } }

    const firstBatch = Array.isArray(raw?.cursor?.firstBatch) ? raw.cursor!.firstBatch : []
    // Reverse to chronological order (oldest -> newest) for time-series plotting.
    const docs = [...firstBatch].reverse() as Record<string, unknown>[]

    const metricSeries: Record<string, MetricPoint[]> = {}
    const sessionScores: { date: string; score: number; week?: number }[] = []
    const nearPoints: SnellenPoint[] = []
    const farPoints: SnellenPoint[] = []

    for (const doc of docs) {
      const date =
        (typeof doc.localDate === 'string' && doc.localDate) || extractIsoDate(doc.completedAt)
      if (!date) continue

      const engineResults = Array.isArray(doc.engineResults) ? (doc.engineResults as RawEngineResult[]) : []
      const scoresThisSession: number[] = []

      for (const result of engineResults) {
        if (!result || typeof result !== 'object') continue
        const exerciseId = typeof result.exerciseId === 'string' ? result.exerciseId : 'unknown'

        if (typeof result.score === 'number' && Number.isFinite(result.score)) {
          scoresThisSession.push(result.score)
        }

        const metrics = result.metrics
        if (metrics && typeof metrics === 'object' && !Array.isArray(metrics)) {
          for (const [key, value] of Object.entries(metrics as Record<string, unknown>)) {
            if (typeof value !== 'number' || !Number.isFinite(value)) continue
            if (!metricSeries[key]) metricSeries[key] = []
            metricSeries[key].push({ date, value, exerciseId })
          }
        }
      }

      if (scoresThisSession.length > 0) {
        const meanScore = scoresThisSession.reduce((a, b) => a + b, 0) / scoresThisSession.length
        const week = typeof doc.week === 'number' ? doc.week : undefined
        sessionScores.push({ date, score: Math.round(meanScore), ...(week !== undefined ? { week } : {}) })
      }

      const nearDenom = snellenDenominator(doc.nearSnellenResult)
      if (nearDenom !== null) nearPoints.push({ date, value: nearDenom, raw: doc.nearSnellenResult as string })

      const farDenom = snellenDenominator(doc.farSnellenResult)
      if (farDenom !== null) farPoints.push({ date, value: farDenom, raw: doc.farSnellenResult as string })
    }

    return {
      ...metricSeries,
      snellenTrend: { near: nearPoints, far: farPoints },
      sessionScores,
    }
  } catch (error) {
    console.error('buildMetricTrends failed (non-fatal, progress payload continues):', error)
    return empty
  }
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

    // Calculate weekly trend
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    const weekSessions = recentSessions.filter(
      s => new Date(s.createdAt) >= weekAgo
    )

    const metricTrends = await buildMetricTrends(user.id)

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
      },
      metricTrends
    })

  } catch (error) {
    console.error('GET /api/vision/progress error:', error)
    return NextResponse.json({
      error: 'Failed to load vision progress',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
