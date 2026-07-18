import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const session = await auth0.getSession(request)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const data = await request.json()

    // Find the journal entry and verify ownership
    const existingEntry = await prisma.journalEntry.findFirst({
      where: {
        id: params.id,
        userId: user.id
      }
    })

    if (!existingEntry) {
      return NextResponse.json(
        { error: 'Journal entry not found or unauthorized' },
        { status: 404 }
      )
    }

    // Prepare update data
    const updateData: any = {}

    // Update fields if provided
    if (data.mood !== undefined) updateData.mood = data.mood
    if (data.weight !== undefined) updateData.weight = data.weight

    // Update the entry field (nested JSON)
    if (data.reasonsValidation !== undefined ||
        data.affirmationGoal !== undefined ||
        data.affirmationBecause !== undefined ||
        data.affirmationMeans !== undefined ||
        data.peptideNotes !== undefined ||
        data.workoutNotes !== undefined ||
        data.nutritionNotes !== undefined ||
        data.breathNotes !== undefined ||
        data.moduleNotes !== undefined) {

      const currentEntry = existingEntry.entry as any || {}

      updateData.entry = {
        ...currentEntry,
        ...(data.reasonsValidation !== undefined && { reasonsValidation: data.reasonsValidation }),
        ...(data.affirmationGoal !== undefined && { affirmationGoal: data.affirmationGoal }),
        ...(data.affirmationBecause !== undefined && { affirmationBecause: data.affirmationBecause }),
        ...(data.affirmationMeans !== undefined && { affirmationMeans: data.affirmationMeans }),
        ...(data.peptideNotes !== undefined && { peptideNotes: data.peptideNotes }),
        ...(data.workoutNotes !== undefined && { workoutNotes: data.workoutNotes }),
        ...(data.nutritionNotes !== undefined && { nutritionNotes: data.nutritionNotes }),
        ...(data.breathNotes !== undefined && { breathNotes: data.breathNotes }),
        ...(data.moduleNotes !== undefined && { moduleNotes: data.moduleNotes })
      }
    }

    // Update the journal entry
    const updatedEntry = await prisma.journalEntry.update({
      where: { id: params.id },
      data: updateData
    })

    return NextResponse.json({
      success: true,
      data: updatedEntry
    })

  } catch (error: any) {
    console.error('Error updating journal entry:', error)
    return NextResponse.json(
      { error: 'Failed to update journal entry' },
      { status: 500 }
    )
  }
}