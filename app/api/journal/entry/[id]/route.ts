import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function resolveUser(auth0User: any) {
  if (!auth0User) return null

  const auth0Id = auth0User.sub
  const email = auth0User.email

  // Try to find by Auth0 ID first
  let user = await prisma.user.findUnique({
    where: { auth0Sub: auth0Id }
  })

  // If not found, try by email
  if (!user && email) {
    user = await prisma.user.findUnique({
      where: { email }
    })

    // Update Auth0 ID if user found by email
    if (user && !user.auth0Sub) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { auth0Sub: auth0Id }
      })
    }
  }

  return user
}

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

    const user = await resolveUser(session.user)

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