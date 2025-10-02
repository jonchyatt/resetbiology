import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'

// POST: Save daily journal entry
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
      weight,
      mood,
      reasonsValidation,
      affirmationGoal,
      affirmationBecause,
      affirmationMeans,
      peptideNotes,
      workoutNotes,
      nutritionNotes,
      date,
      tasksCompleted
    } = body

    // Prepare journal entry JSON (store all form data)
    const entryData = {
      weight,
      mood,
      reasonsValidation,
      affirmationGoal,
      affirmationBecause,
      affirmationMeans,
      peptideNotes,
      workoutNotes,
      nutritionNotes,
      tasksCompleted
    }

    // Get the date for this entry (use provided date or today)
    const entryDate = date ? new Date(date) : new Date()
    entryDate.setHours(0, 0, 0, 0)

    // Create journal entry
    const journalEntry = await prisma.journalEntry.create({
      data: {
        userId: user.id,
        entry: JSON.stringify(entryData),
        mood: mood || null,
        weight: weight ? parseFloat(weight) : null,
        date: entryDate
      }
    })

    // Mark 'journal' daily task as completed
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    await prisma.dailyTask.upsert({
      where: {
        userId_date_taskName: {
          userId: user.id,
          date: today,
          taskName: 'journal'
        }
      },
      update: {
        completed: true
      },
      create: {
        userId: user.id,
        date: today,
        taskName: 'journal',
        completed: true
      }
    })

    // Award gamification points for journaling
    await prisma.gamificationPoint.create({
      data: {
        userId: user.id,
        pointType: 'daily_journal',
        amount: 20,
        activitySource: 'Completed daily journal entry'
      }
    })

    return NextResponse.json({
      success: true,
      entry: journalEntry
    })

  } catch (error) {
    console.error('POST /api/journal error:', error)
    return NextResponse.json({
      error: 'Failed to save journal entry',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET: Load recent journal entries
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

    // Parse query params for limit
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '30', 10)

    // Load recent journal entries
    const entries = await prisma.journalEntry.findMany({
      where: {
        userId: user.id
      },
      orderBy: {
        date: 'desc'
      },
      take: limit
    })

    return NextResponse.json({
      success: true,
      entries
    })

  } catch (error) {
    console.error('GET /api/journal error:', error)
    return NextResponse.json({
      error: 'Failed to load journal entries',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
