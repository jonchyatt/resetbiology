import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

async function resolveUser(sessionUser: any) {
  if (!sessionUser?.sub) return null

  let user = await prisma.user.findUnique({ where: { auth0Sub: sessionUser.sub } })

  if (!user && sessionUser.email) {
    user = await prisma.user.findUnique({ where: { email: sessionUser.email } })
    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { auth0Sub: sessionUser.sub },
      })
    }
  }

  return user
}

async function appendModuleToJournal(userId: string, timestamp: Date, moduleId: string): Promise<string> {
  const dayStart = startOfDay(timestamp)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)

  const existing = await prisma.journalEntry.findFirst({
    where: {
      userId,
      date: {
        gte: dayStart,
        lt: dayEnd,
      },
    },
  })

  const note = `Mental mastery module ${moduleId} completed at ${timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`

  if (existing) {
    let entryData: any = {}
    try {
      entryData = existing.entry ? JSON.parse(existing.entry as string) : {}
    } catch {
      entryData = {}
    }

    const previous = typeof entryData.moduleNotes === 'string' && entryData.moduleNotes.length > 0 ? `${entryData.moduleNotes}
` : ''
    entryData.moduleNotes = `${previous}${note}`

    const tasksCompleted = typeof entryData.tasksCompleted === 'object' && entryData.tasksCompleted !== null
      ? { ...entryData.tasksCompleted }
      : {}
    tasksCompleted.module = true
    entryData.tasksCompleted = tasksCompleted

    await prisma.journalEntry.update({
      where: { id: existing.id },
      data: { entry: JSON.stringify(entryData) },
    })
    return note
  } else {
    const entryData = {
      reasonsValidation: '',
      affirmationGoal: '',
      affirmationBecause: '',
      affirmationMeans: '',
      peptideNotes: '',
      workoutNotes: '',
      nutritionNotes: '',
      breathNotes: '',
      moduleNotes: note,
      tasksCompleted: { module: true },
    }

    await prisma.journalEntry.create({
      data: {
        userId,
        entry: JSON.stringify(entryData),
        mood: null,
        weight: null,
        date: timestamp,
      },
    })
    return note
  }
}

// POST: Mark a Mental Mastery module as completed
export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession(request)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await resolveUser(session.user)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      moduleId,
      audioDuration,
      fullCompletion = true,
      localDate,
      localTime
    } = body

    if (!moduleId) {
      return NextResponse.json({
        error: 'Missing required field: moduleId'
      }, { status: 400 })
    }

    // Check if module already completed today (prevent duplicate points)
    const today = startOfDay(new Date())
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
        fullCompletion,
        localDate: localDate || null,
        localTime: localTime || null,
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

    const journalNote = await appendModuleToJournal(user.id, new Date(), moduleId)

    return NextResponse.json({
      success: true,
      completion,
      pointsAwarded: 50,
      journalNote,
      dailyTaskCompleted: true
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
export async function GET(request: NextRequest) {
  try {
    const session = await auth0.getSession(request)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await resolveUser(session.user)

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

