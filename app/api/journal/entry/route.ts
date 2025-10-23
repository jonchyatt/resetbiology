import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'

type TasksPayload = Record<string, boolean>

type EntryPayload = {
  reasonsValidation: string
  affirmationGoal: string
  affirmationBecause: string
  affirmationMeans: string
  peptideNotes: string
  workoutNotes: string
  nutritionNotes: string
  breathNotes: string
  moduleNotes: string
  tasksCompleted: TasksPayload
}

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function normalizeString(value: unknown): string {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return ''
  return String(value)
}

function normalizeTasks(value: unknown): TasksPayload {
  if (!value || typeof value !== 'object') return {}
  const out: TasksPayload = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (typeof val === 'boolean') {
      out[key] = val
    }
  }
  return out
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession(request)
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const entryDate = body?.date ? new Date(body.date) : new Date()
    const dayStart = startOfDay(entryDate)
    const nextDay = new Date(dayStart)
    nextDay.setDate(nextDay.getDate() + 1)

    const entryPayload: EntryPayload = {
      reasonsValidation: normalizeString(body?.reasonsValidation),
      affirmationGoal: normalizeString(body?.affirmationGoal),
      affirmationBecause: normalizeString(body?.affirmationBecause),
      affirmationMeans: normalizeString(body?.affirmationMeans),
      peptideNotes: normalizeString(body?.peptideNotes),
      workoutNotes: normalizeString(body?.workoutNotes),
      nutritionNotes: normalizeString(body?.nutritionNotes),
      breathNotes: normalizeString(body?.breathNotes),
      moduleNotes: normalizeString(body?.moduleNotes),
      tasksCompleted: normalizeTasks(body?.tasksCompleted)
    }

    const existingEntry = await prisma.journalEntry.findFirst({
      where: {
        userId: user.id,
        date: {
          gte: dayStart,
          lt: nextDay
        }
      }
    })

    let tasksMerged = { ...entryPayload.tasksCompleted }
    let journalEntry

    if (existingEntry) {
      let previous: EntryPayload | Record<string, unknown> = {}
      try {
        previous = existingEntry.entry ? JSON.parse(existingEntry.entry as string) : {}
      } catch (error) {
        previous = {}
      }

      tasksMerged = {
        ...(typeof (previous as any)?.tasksCompleted === 'object' ? (previous as any).tasksCompleted : {}),
        ...entryPayload.tasksCompleted,
      }

      const mergedEntry = {
        ...previous,
        ...entryPayload,
        tasksCompleted: tasksMerged,
      }

      journalEntry = await prisma.journalEntry.update({
        where: { id: existingEntry.id },
        data: {
          entry: JSON.stringify(mergedEntry),
          mood: normalizeString(body?.mood) || null,
          weight: typeof body?.weight === 'number' ? body.weight : body?.weight ? Number(body.weight) : null,
        }
      })
    } else {
      journalEntry = await prisma.journalEntry.create({
        data: {
          userId: user.id,
          entry: JSON.stringify(entryPayload),
          mood: normalizeString(body?.mood) || null,
          weight: typeof body?.weight === 'number' ? body.weight : body?.weight ? Number(body.weight) : null,
          date: entryDate,
        }
      })
      tasksMerged = entryPayload.tasksCompleted
    }

    // Mark journal daily task as completed and award points once per day
    const existingTask = await prisma.dailyTask.findUnique({
      where: {
        userId_date_taskName: {
          userId: user.id,
          date: dayStart,
          taskName: 'journal'
        }
      }
    })

    let pointsAwarded = 0

    if (!existingTask || !existingTask.completed) {
      await prisma.dailyTask.upsert({
        where: {
          userId_date_taskName: {
            userId: user.id,
            date: dayStart,
            taskName: 'journal'
          }
        },
        update: { completed: true },
        create: {
          userId: user.id,
          date: dayStart,
          taskName: 'journal',
          completed: true
        }
      })

      await prisma.gamificationPoint.create({
        data: {
          userId: user.id,
          pointType: 'daily_task',
          amount: 20,
          activitySource: 'journal'
        }
      })
      pointsAwarded = 20
    }

    let entryJson: any = {}
    try {
      entryJson = journalEntry.entry ? JSON.parse(journalEntry.entry as string) : {}
    } catch {
      entryJson = {}
    }

    const responsePayload = {
      success: true,
      journalEntry: {
        ...journalEntry,
        entry: entryJson,
      },
      pointsAwarded,
    }

    return NextResponse.json(responsePayload)

  } catch (error) {
    console.error('Failed to save journal entry:', error)
    return NextResponse.json(
      { error: 'Failed to save journal entry' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth0.getSession(request)
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const today = startOfDay(new Date())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const journalEntry = await prisma.journalEntry.findFirst({
      where: {
        userId: user.id,
        date: {
          gte: today,
          lt: tomorrow
        }
      }
    })

    if (journalEntry) {
      return NextResponse.json({
        ...journalEntry,
        entry: journalEntry.entry ? JSON.parse(journalEntry.entry as string) : null,
      })
    }

    return NextResponse.json({ entry: null })
  } catch (error) {
    console.error('Failed to load journal entry:', error)
    return NextResponse.json(
      { error: 'Failed to load journal entry' },
      { status: 500 }
    )
  }
}


