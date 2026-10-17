import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'
import { enqueueDriveSync } from '@/lib/driveSyncQueue'
import { dayKeyToUtcMidnight, formatNoteTime } from '@/lib/localDay'
import { appendJournalNote, resolveDayKey } from '@/lib/journalDay'

async function appendBreathToJournal(userId: string, timestamp: Date, summary: { cycles: number; durationSeconds: number }, localDate: unknown, localTime?: unknown): Promise<string> {
  const minutes = Math.max(1, Math.round(summary.durationSeconds / 60))
  const note = `Breath session - ${summary.cycles} cycles - ${minutes} min at ${formatNoteTime(localTime, timestamp)}`
  await appendJournalNote(prisma, userId, resolveDayKey(localDate), 'breathNotes', note, 'breath')
  return note
}

// POST: Save completed breath session from client
export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession(request)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getUserFromSession(session)

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
        localDate: dayKey,
        localTime: sessionData.localTime || null,
      }
    })

    // Mark 'breath' daily task as completed
    // Member's local day (not the server's): keyed the same as the journal entry.
    const dayKey = resolveDayKey(sessionData.localDate)
    const today = dayKeyToUtcMidnight(dayKey)

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
        localDate: dayKey
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
    }, sessionData.localDate, sessionData.localTime)

    // Queue Google Drive sync (awaited — Vercel freezes the lambda after the response, killing un-awaited work)
    await enqueueDriveSync(user.id, new Date(), ['breath']).catch(err => console.error('Drive enqueue failed:', err))

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

    const user = await getUserFromSession(session)

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

