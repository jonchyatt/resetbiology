import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const userId = session.user.sub

    // Save journal entry
    const journalEntry = await prisma.journalEntry.create({
      data: {
        userId,
        weight: data.weight,
        mood: data.mood,
        entry: JSON.stringify({
          reasonsValidation: data.reasonsValidation,
          affirmationGoal: data.affirmationGoal,
          affirmationBecause: data.affirmationBecause,
          affirmationMeans: data.affirmationMeans,
          peptideNotes: data.peptideNotes,
          workoutNotes: data.workoutNotes,
          nutritionNotes: data.nutritionNotes,
          tasksCompleted: data.tasksCompleted
        }),
        date: new Date(data.date)
      }
    })

    return NextResponse.json({ 
      success: true, 
      journalEntry 
    })
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
    const session = await auth0.getSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.sub
    
    // Get today's journal entry
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const journalEntry = await prisma.journalEntry.findFirst({
      where: {
        userId,
        date: {
          gte: today,
          lt: tomorrow
        }
      }
    })

    if (journalEntry) {
      return NextResponse.json({
        ...journalEntry,
        entry: JSON.parse(journalEntry.entry as string)
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