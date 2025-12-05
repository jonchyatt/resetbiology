import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'
import { syncUserDataForDate } from '@/lib/google-drive'

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

async function appendBreathToJournal(userId: string, timestamp: Date, summary: { cycles: number; durationSeconds: number }): Promise<string> {
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

  const minutes = Math.max(1, Math.round(summary.durationSeconds / 60))
  const note = `Breath session - ${summary.cycles} cycles - ${minutes} min at ${timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`

  if (existing) {
    let entryData: any = {}
    try {
      entryData = existing.entry ? JSON.parse(existing.entry as string) : {}
    } catch {
      entryData = {}
    }

    const previous = typeof entryData.breathNotes === 'string' && entryData.breathNotes.length > 0 ? `${entryData.breathNotes}
` : ''
    entryData.breathNotes = `${previous}${note}`

    const tasksCompleted = typeof entryData.tasksCompleted === 'object' && entryData.tasksCompleted !== null
      ? { ...entryData.tasksCompleted }
      : {}
    tasksCompleted.breath = true
    entryData.tasksCompleted = tasksCompleted

    await prisma.journalEntry.update({
      where: { id: existing.id },
      data: {
        entry: JSON.stringify(entryData),
      },
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
      breathNotes: note,
      moduleNotes: '',
      tasksCompleted: { breath: true },
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

// POST: Save completed breath session from client
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
        progressScore: longestExhaleHold / 1000, // Use longest exhale as progress metric (in seconds)
        localDate: sessionData.localDate || null,
        localTime: sessionData.localTime || null,
      }
    })

    // Mark 'breath' daily task as completed
    const today = startOfDay(new Date())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

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

    // Award gamification points on first breath session of the day
    const sessionsToday = await prisma.breathSession.count({
      where: {
        userId: user.id,
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      }
    })

    let pointsAwarded = 0
    if (sessionsToday === 1) {
      await prisma.gamificationPoint.create({
        data: {
          userId: user.id,
          pointType: 'breath_session',
          amount: 25,
          activitySource: `Completed ${sessionData.cyclesCompleted} breath cycles`
        }
      })
      pointsAwarded = 25
    }

    // Update journal entry with breath summary
    const journalNote = await appendBreathToJournal(user.id, new Date(), {
      cycles: sessionData.cyclesCompleted,
      durationSeconds: totalDuration / 1000,
    })

    // Sync to Google Drive (non-blocking)
    syncUserDataForDate(user.id, new Date()).catch(err => {
      console.error('Drive sync failed:', err)
    })

    return NextResponse.json({
      success: true,
      session: breathSession,
      pointsAwarded,
      journalNote,
      dailyTaskCompleted: true
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

