import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { resolveUserFromSession } from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'
import { enqueueDriveSync, drainDriveSyncRowsNow } from '@/lib/driveSyncQueue'
import { dayKeyToUtcMidnight, formatNoteTime } from '@/lib/localDay'
import { appendJournalNote, resolveDayKey } from '@/lib/journalDay'
import { moduleTitle } from '@/data/audio-library'

async function appendModuleToJournal(userId: string, timestamp: Date, moduleId: string, localDate: unknown, localTime?: unknown): Promise<string> {
  const note = `Mental mastery module ${moduleTitle(moduleId)} completed at ${formatNoteTime(localTime, timestamp)}`
  await appendJournalNote(prisma, userId, resolveDayKey(localDate), 'moduleNotes', note, 'module')
  return note
}

// POST: Mark a Mental Mastery module as completed
export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession(request)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolution = await resolveUserFromSession(session)

    if (resolution?.status === 'unverified_email') {
      return NextResponse.json({ error: 'verify_email' }, { status: 403 })
    }

    if (!resolution) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = resolution.user

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
    const dayKey = resolveDayKey(localDate)
    const today = dayKeyToUtcMidnight(dayKey)

    const existingCompletion = await prisma.moduleCompletion.findFirst({
      where: {
        userId: user.id,
        moduleId,
        localDate: dayKey
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
        localDate: dayKey,
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

    const journalNote = await appendModuleToJournal(user.id, new Date(), moduleId, localDate, localTime)

    // Queue Google Drive sync (awaited — Vercel freezes the lambda after the response, killing un-awaited work) — this route also appends a note to
    // today's journal entry, so sync that too
    const syncNow = new Date()
    await enqueueDriveSync(user.id, syncNow, ['modules', 'journal']).catch(err => console.error('Drive enqueue failed:', err))

    // Immediate targeted drain of the rows just enqueued (also awaited — same
    // reason as above). The durable outbox row is already persisted regardless
    // of what happens here, so this is a best-effort accelerator, not the source
    // of truth: on failure the row is left exactly where the shared retry/backoff
    // logic would leave it and the cron drain (/api/cron/drive-sync-drain) picks
    // it up on its next tick. Root-cause: enqueue-only was awaited (3e047b19) but
    // nothing ever awaited the drain half in-request, so delivery depended
    // entirely on the cron actually firing — unverified until this ticket.
    await drainDriveSyncRowsNow(user.id, syncNow, ['modules', 'journal']).catch(err =>
      console.error('Drive immediate drain failed (cron will retry):', err)
    )

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

    const resolution = await resolveUserFromSession(session)

    if (resolution?.status === 'unverified_email') {
      return NextResponse.json({ error: 'verify_email' }, { status: 403 })
    }

    if (!resolution) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = resolution.user

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

