import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { enqueueDriveSync } from '@/lib/driveSyncQueue'
import { todayLocalKey, dayKeyToUtcMidnight, utcMidnightToDayKey } from '@/lib/localDay'

export async function GET(request: NextRequest) {
  try {
    const session = await auth0.getSession(request)
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // DailyTask has no localDate column (schema.prisma:384-394) — `date` is
    // the day-key stamped at UTC midnight instead (F1.3 NEW-8 pattern).
    const { searchParams } = new URL(request.url)
    const dayKey = searchParams.get('localDate') || todayLocalKey()
    const today = dayKeyToUtcMidnight(dayKey)
    const tomorrow = new Date(today)
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)

    const tasks = await prisma.dailyTask.findMany({
      where: {
        userId: user.id,
        date: {
          gte: today,
          lt: tomorrow
        }
      }
    })

    // Calculate streak
    const streak = await calculateStreak(user.id, dayKey)

    const pointsAgg = await prisma.gamificationPoint.aggregate({
      where: { userId: user.id },
      _sum: { amount: true }
    })
    const totalPoints = pointsAgg._sum.amount ?? 0

    return NextResponse.json({
      tasks,
      streak,
      totalPoints,
      date: today.toISOString()
    })

  } catch (error) {
    console.error('Error fetching daily tasks:', error)
    return NextResponse.json({
      error: 'Failed to fetch daily tasks'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession(request)
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = await request.json()
    const { taskName, completed, localDate } = body

    const dayKey = typeof localDate === 'string' && localDate ? localDate : todayLocalKey()
    const today = dayKeyToUtcMidnight(dayKey)

    // Upsert the task
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
    
    // Award points if task was completed
    if (completed) {
      const pointValues: Record<string, number> = {
        peptides: 25,
        journal: 20,
        workout: 30,
        meals: 20,
        module: 50,
        breath: 25
      }
      
      const points = pointValues[taskName] || 10
      
      await prisma.gamificationPoint.create({
        data: {
          userId: user.id,
          pointType: 'daily_task',
          amount: points,
          activitySource: taskName
        }
      })
    }

    // Queue Google Drive sync (awaited — Vercel freezes the lambda after the response, killing un-awaited work)
    await enqueueDriveSync(user.id, new Date(), ['dailyTasks']).catch(err => console.error('Drive enqueue failed:', err))

    return NextResponse.json({ 
      success: true,
      task
    })
    
  } catch (error) {
    console.error('Error updating daily task:', error)
    return NextResponse.json({ 
      error: 'Failed to update daily task' 
    }, { status: 500 })
  }
}

async function calculateStreak(userId: string, todayKey: string): Promise<number> {
  // Get all completed tasks for the user, ordered by date
  const tasks = await prisma.dailyTask.findMany({
    where: {
      userId: userId,
      completed: true
    },
    orderBy: {
      date: 'desc'
    },
    distinct: ['date']
  })

  if (tasks.length === 0) return 0

  const completedDayKeys = new Set(tasks.map((t) => utcMidnightToDayKey(new Date(t.date))))

  let cursorKey = todayKey
  if (!completedDayKeys.has(cursorKey)) {
    // No tasks completed yet today — start counting from yesterday so an
    // in-progress day doesn't zero out an otherwise-live streak.
    cursorKey = utcMidnightToDayKey(shiftDayKey(todayKey, -1))
  }

  let streak = 0
  let cursor = dayKeyToUtcMidnight(cursorKey)
  while (completedDayKeys.has(utcMidnightToDayKey(cursor))) {
    streak++
    cursor = shiftDayKey(utcMidnightToDayKey(cursor), -1)
  }

  return streak
}

function shiftDayKey(key: string, deltaDays: number): Date {
  const d = dayKeyToUtcMidnight(key)
  d.setUTCDate(d.getUTCDate() + deltaDays)
  return d
}
