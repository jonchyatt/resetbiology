import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/breath/user-exercises
 * Returns user's active breath exercises with full exercise details
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const activeOnly = searchParams.get('activeOnly') !== 'false'

    const whereClause: any = { userId: user.id }
    if (activeOnly) {
      whereClause.isActive = true
    }

    const userExercises = await prisma.userBreathExercise.findMany({
      where: whereClause,
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'desc' }
      ]
    })

    // Fetch the full exercise details for each user exercise
    const exerciseIds = userExercises.map(ue => ue.exerciseId)
    const exercises = await prisma.breathExercise.findMany({
      where: {
        id: { in: exerciseIds }
      }
    })

    // Create a map for quick lookup
    const exerciseMap = new Map(exercises.map(e => [e.id, e]))

    // Merge user settings with base exercise
    const enrichedExercises = userExercises.map(ue => {
      const baseExercise = exerciseMap.get(ue.exerciseId)
      if (!baseExercise) return null

      return {
        id: ue.id,
        exerciseId: ue.exerciseId,
        name: ue.customName || baseExercise.name,
        description: baseExercise.description,
        category: baseExercise.category,
        slug: baseExercise.slug,
        // Use user overrides if set, otherwise use base values
        inhaleMs: ue.inhaleMs ?? baseExercise.inhaleMs,
        exhaleMs: ue.exhaleMs ?? baseExercise.exhaleMs,
        inhaleHoldMs: ue.inhaleHoldMs ?? baseExercise.inhaleHoldMs,
        exhaleHoldMs: ue.exhaleHoldMs ?? baseExercise.exhaleHoldMs,
        breathsPerCycle: ue.breathsPerCycle ?? baseExercise.breathsPerCycle,
        cyclesTarget: ue.cyclesTarget ?? baseExercise.cyclesTarget,
        postCycleExhaleHoldMs: baseExercise.postCycleExhaleHoldMs,
        postCycleInhaleHoldMs: baseExercise.postCycleInhaleHoldMs,
        backgroundMusic: baseExercise.backgroundMusic,
        musicVolume: baseExercise.musicVolume,
        guidedAudio: baseExercise.guidedAudio,
        isActive: ue.isActive,
        sortOrder: ue.sortOrder,
        createdAt: ue.createdAt,
        updatedAt: ue.updatedAt
      }
    }).filter(Boolean)

    return NextResponse.json({
      success: true,
      exercises: enrichedExercises
    })
  } catch (error: any) {
    console.error('Error fetching user breath exercises:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user breath exercises', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/breath/user-exercises
 * Add a breath exercise to user's active exercises
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      exerciseId,
      customName,
      inhaleMs,
      exhaleMs,
      inhaleHoldMs,
      exhaleHoldMs,
      breathsPerCycle,
      cyclesTarget
    } = body

    if (!exerciseId) {
      return NextResponse.json({ error: 'exerciseId is required' }, { status: 400 })
    }

    // Verify the exercise exists
    const exercise = await prisma.breathExercise.findUnique({
      where: { id: exerciseId }
    })

    if (!exercise) {
      return NextResponse.json({ error: 'Exercise not found' }, { status: 404 })
    }

    // Check if user already has this exercise
    const existing = await prisma.userBreathExercise.findUnique({
      where: {
        userId_exerciseId: {
          userId: user.id,
          exerciseId
        }
      }
    })

    if (existing) {
      // Reactivate if inactive, otherwise return existing
      if (!existing.isActive) {
        const updated = await prisma.userBreathExercise.update({
          where: { id: existing.id },
          data: { isActive: true }
        })
        return NextResponse.json({ success: true, userExercise: updated, reactivated: true })
      }
      return NextResponse.json({ success: true, userExercise: existing, alreadyExists: true })
    }

    // Get next sort order
    const lastExercise = await prisma.userBreathExercise.findFirst({
      where: { userId: user.id },
      orderBy: { sortOrder: 'desc' }
    })
    const nextSortOrder = (lastExercise?.sortOrder ?? -1) + 1

    const userExercise = await prisma.userBreathExercise.create({
      data: {
        userId: user.id,
        exerciseId,
        customName,
        inhaleMs,
        exhaleMs,
        inhaleHoldMs,
        exhaleHoldMs,
        breathsPerCycle,
        cyclesTarget,
        sortOrder: nextSortOrder
      }
    })

    return NextResponse.json({ success: true, userExercise })
  } catch (error: any) {
    console.error('Error adding user breath exercise:', error)
    return NextResponse.json(
      { error: 'Failed to add breath exercise', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/breath/user-exercises
 * Update a user's breath exercise settings
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    // Verify ownership
    const existing = await prisma.userBreathExercise.findUnique({
      where: { id }
    })

    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: 'Exercise not found or access denied' }, { status: 404 })
    }

    const updated = await prisma.userBreathExercise.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json({ success: true, userExercise: updated })
  } catch (error: any) {
    console.error('Error updating user breath exercise:', error)
    return NextResponse.json(
      { error: 'Failed to update breath exercise', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/breath/user-exercises
 * Remove a breath exercise from user's active exercises (or deactivate)
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const permanent = searchParams.get('permanent') === 'true'

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    // Verify ownership
    const existing = await prisma.userBreathExercise.findUnique({
      where: { id }
    })

    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: 'Exercise not found or access denied' }, { status: 404 })
    }

    if (permanent) {
      await prisma.userBreathExercise.delete({
        where: { id }
      })
      return NextResponse.json({ success: true, deleted: true })
    } else {
      // Soft delete - just deactivate
      await prisma.userBreathExercise.update({
        where: { id },
        data: { isActive: false }
      })
      return NextResponse.json({ success: true, deactivated: true })
    }
  } catch (error: any) {
    console.error('Error removing user breath exercise:', error)
    return NextResponse.json(
      { error: 'Failed to remove breath exercise', details: error.message },
      { status: 500 }
    )
  }
}
