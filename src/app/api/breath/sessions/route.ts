import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'

// POST: Save completed breath session from client
export async function POST(request: Request) {
  try {
    const session = await auth0.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find user by Auth0 sub
    const user = await prisma.user.findUnique({
      where: { auth0Sub: session.user.sub }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const { sessionData } = body

    if (!sessionData || !sessionData.cycles || !sessionData.cyclesCompleted) {
      return NextResponse.json({
        error: 'Invalid session data. Must include cycles and cyclesCompleted.'
      }, { status: 400 })
    }

    // Calculate session metrics
    const totalDuration = sessionData.cycles.reduce((total: number, cycle: any) => {
      return total +
        (cycle.breathing?.actualDurationMs || 0) +
        (cycle.exhaleHold?.durationMs || 0) +
        (cycle.inhaleHold?.durationMs || 0)
    }, 0)

    const longestExhaleHold = Math.max(...sessionData.cycles.map((c: any) => c.exhaleHold?.durationMs || 0), 0)
    const longestInhaleHold = Math.max(...sessionData.cycles.map((c: any) => c.inhaleHold?.durationMs || 0), 0)

    // Store breath session in MongoDB
    const breathSession = await prisma.breathSession.create({
      data: {
        userId: user.id,
        sessionType: `${sessionData.settings?.breathsPerCycle || 30} breaths x ${sessionData.cyclesCompleted} cycles`,
        duration: Math.round(totalDuration / 1000), // Convert ms to seconds
        cycles: sessionData.cyclesCompleted,
        progressScore: longestExhaleHold / 1000 // Use longest exhale as progress metric (in seconds)
      }
    })

    // Mark 'breath' daily task as completed
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    await prisma.dailyTask.upsert({
      where: {
        userId_date_taskName: {
          userId: user.id,
          date: today,
          taskName: 'breath'
        }
      },
      update: {
        completed: true
      },
      create: {
        userId: user.id,
        date: today,
        taskName: 'breath',
        completed: true
      }
    })

    // Award gamification points
    await prisma.gamificationPoint.create({
      data: {
        userId: user.id,
        pointType: 'breath_session',
        amount: 25,
        activitySource: `Completed ${sessionData.cyclesCompleted} breath cycles`
      }
    })

    return NextResponse.json({
      success: true,
      session: breathSession
    })

  } catch (error) {
    console.error('POST /api/breath/sessions error:', error)
    return NextResponse.json({
      error: 'Failed to save breath session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET: Load user's breath session history
export async function GET(request: Request) {
  try {
    const session = await auth0.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find user by Auth0 sub
    const user = await prisma.user.findUnique({
      where: { auth0Sub: session.user.sub }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    // Load breath sessions
    const sessions = await prisma.breathSession.findMany({
      where: {
        userId: user.id
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    })

    return NextResponse.json({
      success: true,
      sessions
    })

  } catch (error) {
    console.error('GET /api/breath/sessions error:', error)
    return NextResponse.json({
      error: 'Failed to load breath sessions',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
