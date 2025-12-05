import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'
import { syncUserDataForDate } from '@/lib/google-drive'

// GET: Load user's vision training history
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

    const body = await request.json()
    const {
      visionType,
      exerciseType,
      distanceCm,
      accuracy,
      chartSize,
      duration,
      success
    } = body

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

    // Award gamification points for vision training
    await prisma.gamificationPoint.create({
      data: {
        userId: user.id,
        amount: success ? 30 : 15, // 30 points for success, 15 for attempt
        pointType: 'vision_training',
        activitySource: `Vision training session: ${visionType}`,
        earnedAt: new Date()
      }
    })

    // Sync to Google Drive (non-blocking)
    syncUserDataForDate(user.id, new Date()).catch(err => {
      console.error('Drive sync failed:', err)
    })

    return NextResponse.json({
      success: true,
      session: visionSession,
      pointsAwarded: success ? 30 : 15
    })

  } catch (error) {
    console.error('POST /api/vision/sessions error:', error)
    return NextResponse.json({
      error: 'Failed to save vision session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
