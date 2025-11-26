import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/subscriptionHelpers'

/**
 * GET /api/breath/exercises
 * Returns all active breath exercises, or all exercises for admin
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)
    const userIsAdmin = isAdmin(user)

    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const includeInactive = searchParams.get('includeInactive') === 'true' && userIsAdmin

    const whereClause: any = {}

    // Non-admins only see active exercises
    if (!includeInactive) {
      whereClause.isActive = true
    }

    // Filter by category if specified
    if (category) {
      whereClause.category = category
    }

    const exercises = await prisma.breathExercise.findMany({
      where: whereClause,
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' }
      ]
    })

    return NextResponse.json({
      exercises,
      isAdmin: userIsAdmin
    })
  } catch (error: any) {
    console.error('Error fetching breath exercises:', error)
    return NextResponse.json(
      { error: 'Failed to fetch breath exercises', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/breath/exercises
 * Create a new breath exercise (admin only)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)

    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await req.json()
    const {
      name,
      slug,
      description,
      category,
      inhaleMs,
      exhaleMs,
      inhaleHoldMs,
      exhaleHoldMs,
      breathsPerCycle,
      cyclesTarget,
      postCycleExhaleHoldMs,
      postCycleInhaleHoldMs,
      backgroundMusic,
      musicVolume,
      guidedAudio,
      isSample,
      isActive,
      sortOrder
    } = body

    // Validate required fields
    if (!name || !slug || !description || !category) {
      return NextResponse.json(
        { error: 'Missing required fields: name, slug, description, category' },
        { status: 400 }
      )
    }

    // Check for duplicate slug
    const existing = await prisma.breathExercise.findUnique({
      where: { slug }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'An exercise with this slug already exists' },
        { status: 400 }
      )
    }

    const exercise = await prisma.breathExercise.create({
      data: {
        name,
        slug,
        description,
        category,
        inhaleMs: inhaleMs || 4000,
        exhaleMs: exhaleMs || 4000,
        inhaleHoldMs: inhaleHoldMs || 0,
        exhaleHoldMs: exhaleHoldMs || 0,
        breathsPerCycle: breathsPerCycle || 10,
        cyclesTarget: cyclesTarget || 3,
        postCycleExhaleHoldMs: postCycleExhaleHoldMs || 0,
        postCycleInhaleHoldMs: postCycleInhaleHoldMs || 0,
        backgroundMusic: backgroundMusic || null,
        musicVolume: musicVolume ?? 0.5,
        guidedAudio: guidedAudio || null,
        isSample: isSample ?? false,
        isActive: isActive ?? true,
        sortOrder: sortOrder ?? 0,
        createdBy: user.id
      }
    })

    return NextResponse.json({ success: true, exercise })
  } catch (error: any) {
    console.error('Error creating breath exercise:', error)
    return NextResponse.json(
      { error: 'Failed to create breath exercise', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/breath/exercises
 * Update an existing breath exercise (admin only)
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)

    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await req.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'Exercise ID is required' }, { status: 400 })
    }

    // If slug is being changed, check for duplicates
    if (updateData.slug) {
      const existing = await prisma.breathExercise.findFirst({
        where: {
          slug: updateData.slug,
          id: { not: id }
        }
      })

      if (existing) {
        return NextResponse.json(
          { error: 'An exercise with this slug already exists' },
          { status: 400 }
        )
      }
    }

    const exercise = await prisma.breathExercise.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json({ success: true, exercise })
  } catch (error: any) {
    console.error('Error updating breath exercise:', error)
    return NextResponse.json(
      { error: 'Failed to update breath exercise', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/breath/exercises
 * Delete a breath exercise (admin only)
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)

    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Exercise ID is required' }, { status: 400 })
    }

    await prisma.breathExercise.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting breath exercise:', error)
    return NextResponse.json(
      { error: 'Failed to delete breath exercise', details: error.message },
      { status: 500 }
    )
  }
}
