import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'

export async function GET(request: NextRequest) {
  try {
    const session = await auth0.getSession(request)
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Get today's tasks
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
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
    const streak = await calculateStreak(user.id)
    
    return NextResponse.json({ 
      tasks,
      streak,
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
    const { taskName, completed } = body
    
    // Get today's date at midnight
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
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

async function calculateStreak(userId: string): Promise<number> {
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
  
  let streak = 0
  let currentDate = new Date()
  currentDate.setHours(0, 0, 0, 0)
  
  // Check if user has completed at least one task today
  const todayTasks = tasks.filter(t => {
    const taskDate = new Date(t.date)
    taskDate.setHours(0, 0, 0, 0)
    return taskDate.getTime() === currentDate.getTime()
  })
  
  if (todayTasks.length === 0) {
    // No tasks today, check if yesterday had tasks
    currentDate.setDate(currentDate.getDate() - 1)
  }
  
  // Count consecutive days
  for (const task of tasks) {
    const taskDate = new Date(task.date)
    taskDate.setHours(0, 0, 0, 0)
    
    if (taskDate.getTime() === currentDate.getTime()) {
      streak++
      currentDate.setDate(currentDate.getDate() - 1)
    } else if (taskDate.getTime() < currentDate.getTime()) {
      break
    }
  }
  
  return streak
}