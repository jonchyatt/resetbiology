import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'

// GET: Load user's workout history
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
    const programId = searchParams.get('programId')

    // Build filter
    const where: any = { userId: user.id }
    if (programId) where.programId = programId

    // Load workout sessions
    const sessions = await prisma.workoutSession.findMany({
      where,
      orderBy: { completedAt: 'desc' },
      take: limit,
      skip: offset
    })

    // Get total count for pagination
    const total = await prisma.workoutSession.count({ where })

    return NextResponse.json({
      success: true,
      sessions,
      total,
      limit,
      offset
    })

  } catch (error) {
    console.error('GET /api/workout/sessions error:', error)
    return NextResponse.json({
      error: 'Failed to load workout sessions',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST: Save new workout session
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
      exercises,
      duration,
      programId,
      notes,
      completedAt
    } = body

    if (!exercises || !Array.isArray(exercises)) {
      return NextResponse.json({
        error: 'Missing required field: exercises (must be an array)'
      }, { status: 400 })
    }

    // Create workout session
    const workoutSession = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        exercises: exercises, // Store as JSON
        duration: duration || 0,
        programId: programId || null,
        completedAt: completedAt ? new Date(completedAt) : new Date()
      }
    })

    // Award gamification points for completing workout
    await prisma.gamificationPoint.create({
      data: {
        userId: user.id,
        amount: 50, // 50 points per workout
        pointType: 'workout',
        activitySource: 'Completed workout session',
        earnedAt: new Date()
      }
    })

    // Update daily task if exists
    const today = new Date().toISOString().split('T')[0]
    const todayDate = new Date(today + 'T00:00:00.000Z')
    const dailyTask = await prisma.dailyTask.findFirst({
      where: {
        userId: user.id,
        date: todayDate,
        taskName: 'workout'
      }
    })

    if (dailyTask && !dailyTask.completed) {
      await prisma.dailyTask.update({
        where: { id: dailyTask.id },
        data: { completed: true }
      })
    }

    return NextResponse.json({
      success: true,
      session: workoutSession,
      pointsAwarded: 50
    })

  } catch (error) {
    console.error('POST /api/workout/sessions error:', error)
    return NextResponse.json({
      error: 'Failed to save workout session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// PATCH: Update existing workout session
export async function PATCH(request: Request) {
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
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const { sessionId, exercises, duration, notes } = body

    if (!sessionId) {
      return NextResponse.json({
        error: 'Missing sessionId'
      }, { status: 400 })
    }

    // Verify ownership
    const workoutSession = await prisma.workoutSession.findUnique({
      where: { id: sessionId }
    })

    if (!workoutSession || workoutSession.userId !== user.id) {
      return NextResponse.json({
        error: 'Session not found or access denied'
      }, { status: 404 })
    }

    // Build update data
    const updateData: any = {}
    if (exercises !== undefined) updateData.exercises = exercises
    if (duration !== undefined) updateData.duration = duration

    // Update session
    const updated = await prisma.workoutSession.update({
      where: { id: sessionId },
      data: updateData
    })

    return NextResponse.json({
      success: true,
      session: updated
    })

  } catch (error) {
    console.error('PATCH /api/workout/sessions error:', error)
    return NextResponse.json({
      error: 'Failed to update workout session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}