import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'

// GET: Load workout sessions for authenticated user
export async function GET(request: Request) {
  try {
    const session = await auth0.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { auth0Sub: session.user.sub }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get optional query params
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit')
    const programId = searchParams.get('programId')

    let where: any = { userId: user.id }

    if (programId) {
      where.programId = programId
    }

    const sessions = await prisma.workoutSession.findMany({
      where,
      orderBy: { completedAt: 'desc' },
      take: limit ? parseInt(limit) : undefined
    })

    return NextResponse.json({
      success: true,
      sessions
    })

  } catch (error) {
    console.error('GET /api/workout/sessions error:', error)
    return NextResponse.json({
      error: 'Failed to load workout sessions',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST: Create new workout session
export async function POST(request: Request) {
  try {
    const session = await auth0.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { auth0Sub: session.user.sub }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const { exercises, duration, programId, completedAt, notes } = body

    if (!exercises || !duration) {
      return NextResponse.json({
        error: 'Invalid request body. Required: exercises, duration'
      }, { status: 400 })
    }

    // Create workout session
    const workoutSession = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        exercises,
        duration: parseInt(duration),
        programId: programId || null,
        completedAt: completedAt ? new Date(completedAt) : new Date(),
        notes: notes || ''
      }
    })

    // Award gamification points
    const pointsAwarded = 20
    await prisma.gamificationPoint.create({
      data: {
        userId: user.id,
        pointType: 'workout_completed',
        amount: pointsAwarded,
        activitySource: `Completed workout: ${exercises.length} exercises, ${Math.floor(duration / 60)} minutes`
      }
    })

    return NextResponse.json({
      success: true,
      session: workoutSession,
      pointsAwarded
    })

  } catch (error) {
    console.error('POST /api/workout/sessions error:', error)
    return NextResponse.json({
      error: 'Failed to save workout session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// DELETE: Remove workout session
export async function DELETE(request: Request) {
  try {
    const session = await auth0.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { auth0Sub: session.user.sub }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    // Verify ownership before deleting
    const workoutSession = await prisma.workoutSession.findUnique({
      where: { id }
    })

    if (!workoutSession || workoutSession.userId !== user.id) {
      return NextResponse.json({ error: 'Session not found or unauthorized' }, { status: 404 })
    }

    await prisma.workoutSession.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: 'Session deleted'
    })

  } catch (error) {
    console.error('DELETE /api/workout/sessions error:', error)
    return NextResponse.json({
      error: 'Failed to delete session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
