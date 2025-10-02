import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'

// POST: Mark a Mental Mastery module as completed
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
    const {
      moduleId,
      audioDuration,
      fullCompletion = true
    } = body

    if (!moduleId) {
      return NextResponse.json({
        error: 'Missing required field: moduleId'
      }, { status: 400 })
    }

    // Check if module already completed today (prevent duplicate points)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const existingCompletion = await prisma.moduleCompletion.findFirst({
      where: {
        userId: user.id,
        moduleId,
        completedAt: {
          gte: today,
          lt: tomorrow
        }
      }
    })

    if (existingCompletion) {
      return NextResponse.json({
        success: true,
        message: 'Module already completed today',
        completion: existingCompletion
      })
    }

    // Create module completion
    const completion = await prisma.moduleCompletion.create({
      data: {
        userId: user.id,
        moduleId,
        audioDuration: audioDuration || null,
        fullCompletion
      }
    })

    // Mark 'module' daily task as completed
    await prisma.dailyTask.upsert({
      where: {
        userId_date_taskName: {
          userId: user.id,
          date: today,
          taskName: 'module'
        }
      },
      update: {
        completed: true
      },
      create: {
        userId: user.id,
        date: today,
        taskName: 'module',
        completed: true
      }
    })

    // Award gamification points (highest value activity)
    await prisma.gamificationPoint.create({
      data: {
        userId: user.id,
        pointType: 'module_completion',
        amount: 50,
        activitySource: `Completed Mental Mastery module: ${moduleId}`
      }
    })

    return NextResponse.json({
      success: true,
      completion
    })

  } catch (error) {
    console.error('POST /api/modules/complete error:', error)
    return NextResponse.json({
      error: 'Failed to mark module as complete',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET: Load user's module completion history
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

    // Load module completions
    const completions = await prisma.moduleCompletion.findMany({
      where: {
        userId: user.id
      },
      orderBy: {
        completedAt: 'desc'
      },
      take: limit
    })

    return NextResponse.json({
      success: true,
      completions
    })

  } catch (error) {
    console.error('GET /api/modules/complete error:', error)
    return NextResponse.json({
      error: 'Failed to load module completions',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
