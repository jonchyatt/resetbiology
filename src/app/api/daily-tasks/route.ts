import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'

// GET: Load today's tasks for authenticated user
export async function GET() {
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

    // Get today's date at midnight (local timezone)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Load today's tasks
    const tasks = await prisma.dailyTask.findMany({
      where: {
        userId: user.id,
        date: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        }
      }
    })

    // Calculate current streak
    const streak = await calculateStreak(user.id)

    return NextResponse.json({
      success: true,
      tasks,
      streak
    })

  } catch (error) {
    console.error('GET /api/daily-tasks error:', error)
    return NextResponse.json({
      error: 'Failed to load tasks',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST: Save/update task completion
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
    const { taskName, completed } = body

    if (!taskName || typeof completed !== 'boolean') {
      return NextResponse.json({
        error: 'Invalid request body. Required: taskName (string), completed (boolean)'
      }, { status: 400 })
    }

    // Valid task names
    const validTasks = ['peptides', 'journal', 'workout', 'meals', 'module', 'breath']
    if (!validTasks.includes(taskName)) {
      return NextResponse.json({
        error: `Invalid task name. Must be one of: ${validTasks.join(', ')}`
      }, { status: 400 })
    }

    // Get today's date at midnight
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Upsert task (create or update)
    const task = await prisma.dailyTask.upsert({
      where: {
        userId_date_taskName: {
          userId: user.id,
          date: today,
          taskName: taskName
        }
      },
      update: {
        completed: completed
      },
      create: {
        userId: user.id,
        date: today,
        taskName: taskName,
        completed: completed
      }
    })

    // Award gamification points if task is being marked as completed
    if (completed) {
      const pointsMap: Record<string, number> = {
        peptides: 25,
        journal: 20,
        workout: 30,
        meals: 20,
        module: 50,
        breath: 25
      }

      await prisma.gamificationPoint.create({
        data: {
          userId: user.id,
          pointType: `daily_${taskName}`,
          amount: pointsMap[taskName] || 10,
          activitySource: `Completed daily task: ${taskName}`
        }
      })
    }

    // Recalculate streak
    const streak = await calculateStreak(user.id)

    return NextResponse.json({
      success: true,
      task,
      streak
    })

  } catch (error) {
    console.error('POST /api/daily-tasks error:', error)
    return NextResponse.json({
      error: 'Failed to save task',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Helper: Calculate current streak
async function calculateStreak(userId: string): Promise<number> {
  try {
    let streak = 0
    let checkDate = new Date()
    checkDate.setHours(0, 0, 0, 0)

    // Check backwards day by day
    while (true) {
      const startOfDay = new Date(checkDate)
      const endOfDay = new Date(checkDate.getTime() + 24 * 60 * 60 * 1000)

      const tasksForDay = await prisma.dailyTask.findMany({
        where: {
          userId: userId,
          date: {
            gte: startOfDay,
            lt: endOfDay
          },
          completed: true
        }
      })

      // If user completed at least 3 tasks that day, count it
      if (tasksForDay.length >= 3) {
        streak++
        // Check previous day
        checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000)
      } else {
        // Streak broken
        break
      }

      // Safety limit: don't go back more than 365 days
      if (streak >= 365) break
    }

    return streak

  } catch (error) {
    console.error('Error calculating streak:', error)
    return 0
  }
}
