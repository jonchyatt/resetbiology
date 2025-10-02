import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'

// GET: Load workout programs for authenticated user
export async function GET(request: Request) {
  try {
    const session = await auth0.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { auth0Sub: session.user.sub }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const programs = await prisma.workoutProgram.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      success: true,
      programs
    })

  } catch (error) {
    console.error('GET /api/workout/programs error:', error)
    return NextResponse.json({
      error: 'Failed to load workout programs',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST: Create new workout program
export async function POST(request: Request) {
  try {
    const session = await auth0.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { auth0Sub: session.user.sub }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const { name, programType, template, description, notes } = body

    if (!name || !programType || !template) {
      return NextResponse.json({
        error: 'Invalid request body. Required: name, programType, template'
      }, { status: 400 })
    }

    // Create workout program
    const program = await prisma.workoutProgram.create({
      data: {
        userId: user.id,
        name,
        programType,
        template,
        description: description || '',
        notes: notes || '',
        isActive: true
      }
    })

    // Award gamification points
    const pointsAwarded = 30
    await prisma.gamificationPoint.create({
      data: {
        userId: user.id,
        pointType: 'program_created',
        amount: pointsAwarded,
        activitySource: `Created workout program: ${name}`
      }
    })

    return NextResponse.json({
      success: true,
      program,
      pointsAwarded
    })

  } catch (error) {
    console.error('POST /api/workout/programs error:', error)
    return NextResponse.json({
      error: 'Failed to create workout program',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// PATCH: Update existing workout program
export async function PATCH(request: Request) {
  try {
    const session = await auth0.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { auth0Sub: session.user.sub }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Program ID required' }, { status: 400 })
    }

    // Verify ownership before updating
    const existingProgram = await prisma.workoutProgram.findUnique({
      where: { id }
    })

    if (!existingProgram || existingProgram.userId !== user.id) {
      return NextResponse.json({ error: 'Program not found or unauthorized' }, { status: 404 })
    }

    const program = await prisma.workoutProgram.update({
      where: { id },
      data: updates
    })

    return NextResponse.json({
      success: true,
      program
    })

  } catch (error) {
    console.error('PATCH /api/workout/programs error:', error)
    return NextResponse.json({
      error: 'Failed to update workout program',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// DELETE: Remove workout program
export async function DELETE(request: Request) {
  try {
    const session = await auth0.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { auth0Sub: session.user.sub }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Program ID required' }, { status: 400 })
    }

    // Verify ownership before deleting
    const program = await prisma.workoutProgram.findUnique({
      where: { id }
    })

    if (!program || program.userId !== user.id) {
      return NextResponse.json({ error: 'Program not found or unauthorized' }, { status: 404 })
    }

    await prisma.workoutProgram.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: 'Program deleted'
    })

  } catch (error) {
    console.error('DELETE /api/workout/programs error:', error)
    return NextResponse.json({
      error: 'Failed to delete program',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
