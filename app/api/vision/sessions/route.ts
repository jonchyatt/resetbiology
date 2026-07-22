import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'
import { enqueueDriveSync } from '@/lib/driveSyncQueue'
import { parseEngineResults, performanceBonusFor } from '@/lib/vision/engineResultsPayload'
import { validateVisionLocalDayInput } from '@/lib/vision/localDayInput'
import { awardVisionPoints } from '@/lib/vision/visionPoints'

// GET: Load user's vision training history
export async function GET(request: Request) {
  try {
    const session = await auth0.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '30')
    const offset = parseInt(searchParams.get('offset') || '0')
    const visionType = searchParams.get('visionType') // "near" | "far"

    // Build filter
    const where: any = { userId: user.id }
    if (visionType) where.visionType = visionType

    // Load vision sessions
    const sessions = await prisma.visionSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    })

    // Get total count for pagination
    const total = await prisma.visionSession.count({ where })

    // Calculate stats
    const stats = {
      totalSessions: total,
      successRate: sessions.length > 0
        ? (sessions.filter(s => s.success).length / sessions.length) * 100
        : 0,
      avgAccuracy: sessions.length > 0
        ? sessions.reduce((sum, s) => sum + s.accuracy, 0) / sessions.length
        : 0,
      maxDistance: sessions.length > 0
        ? Math.max(...sessions.map(s => s.distanceCm))
        : 0
    }

    return NextResponse.json({
      success: true,
      sessions,
      stats,
      total,
      limit,
      offset
    })

  } catch (error) {
    console.error('GET /api/vision/sessions error:', error)
    return NextResponse.json({
      error: 'Failed to load vision sessions',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST: Save new vision training session
export async function POST(request: Request) {
  try {
    const session = await auth0.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
    }
    const localDay = validateVisionLocalDayInput(body)
    if (!localDay.ok) {
      return NextResponse.json({ error: localDay.error }, { status: 400 })
    }
    const {
      visionType,
      exerciseType,
      distanceCm,
      accuracy,
      chartSize,
      duration,
      success
    } = body

    const engineResults = body.engineResults === undefined
      ? undefined
      : parseEngineResults(body.engineResults)

    if (engineResults === null) {
      return NextResponse.json({
        error: 'engineResults must be an array of valid engine result objects'
      }, { status: 400 })
    }

    const performanceBonus = performanceBonusFor(engineResults)

    // Validate required fields
    if (!visionType || !exerciseType || distanceCm === undefined || accuracy === undefined) {
      return NextResponse.json({
        error: 'Missing required fields: visionType, exerciseType, distanceCm, accuracy'
      }, { status: 400 })
    }

    // Create vision session
    const visionSession = await prisma.visionSession.create({
      data: {
        userId: user.id,
        visionType,
        exerciseType,
        distanceCm,
        accuracy,
        chartSize: chartSize || '20/20',
        duration: duration || 0,
        success: success || false
      }
    })

    // MongoDB is schemaless, but this work package owns only this route and cannot
    // add a Prisma column. Persist the additive payload on the created document;
    // typed legacy fields and callers remain untouched.
    if (engineResults !== undefined) {
      await prisma.$runCommandRaw({
        update: 'vision_sessions',
        updates: [{
          q: { _id: { $oid: visionSession.id } },
          u: { $set: { engineResults } }
        }]
      })
    }

    // Update or create progress record
    const existingProgress = await prisma.visionProgress.findUnique({
      where: {
        userId_visionType: {
          userId: user.id,
          visionType
        }
      }
    })

    if (existingProgress) {
      await prisma.visionProgress.update({
        where: {
          userId_visionType: {
            userId: user.id,
            visionType
          }
        },
        data: {
          lastSessionDate: new Date(),
          totalSessions: existingProgress.totalSessions + 1,
          maxDistanceCm: Math.max(existingProgress.maxDistanceCm, distanceCm),
          currentLevel: success
            ? Math.min(existingProgress.currentLevel + 1, 10)
            : existingProgress.currentLevel
        }
      })
    } else {
      await prisma.visionProgress.create({
        data: {
          userId: user.id,
          visionType,
          currentLevel: success ? 2 : 1,
          maxDistanceCm: distanceCm,
          lastSessionDate: new Date(),
          totalSessions: 1
        }
      })
    }

    const award = await awardVisionPoints({
      userId: user.id,
      dayKey: localDay.value.localDate,
      awardType: 'vision_free_training_session',
      visionType,
      success: Boolean(success),
      performanceBonus,
    })

    // Queue Google Drive sync (awaited — Vercel freezes the lambda after the response, killing un-awaited work)
    await enqueueDriveSync(user.id, new Date(), ['vision']).catch(err => console.error('Drive enqueue failed:', err))

    return NextResponse.json({
      success: true,
      session: engineResults === undefined ? visionSession : { ...visionSession, engineResults },
      pointsAwarded: award.points,
      performanceBonus
    })

  } catch (error) {
    console.error('POST /api/vision/sessions error:', error)
    return NextResponse.json({
      error: 'Failed to save vision session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
