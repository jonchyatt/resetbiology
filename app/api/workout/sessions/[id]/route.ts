import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession} from '@/lib/getUserFromSession'
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

    // Find the workout session and verify ownership
    const existingSession = await prisma.workoutSession.findFirst({
      where: {
        id: params.id,
        userId: user.id
      }
    })

    if (!existingSession) {
      return NextResponse.json(
        { error: 'Workout session not found or unauthorized' },
        { status: 404 }
      )
    }

    // Prepare update data
    const updateData: any = {}

    // Update fields if provided
    if (data.duration !== undefined) updateData.duration = data.duration
    if (data.notes !== undefined) updateData.notes = data.notes
    if (data.exercises !== undefined) updateData.exercises = data.exercises
    if (data.programId !== undefined) updateData.programId = data.programId

    // Update the workout session
    const updatedSession = await prisma.workoutSession.update({
      where: { id: params.id },
      data: updateData
    })

    return NextResponse.json({
      success: true,
      data: updatedSession
    })

  } catch (error: any) {
    console.error('Error updating workout session:', error)
    return NextResponse.json(
      { error: 'Failed to update workout session' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    // Find the workout session and verify ownership
    const existingSession = await prisma.workoutSession.findFirst({
      where: {
        id: params.id,
        userId: user.id
      }
    })

    if (!existingSession) {
      return NextResponse.json(
        { error: 'Workout session not found or unauthorized' },
        { status: 404 }
      )
    }

    // Delete the workout session
    await prisma.workoutSession.delete({
      where: { id: params.id }
    })

    return NextResponse.json({
      success: true,
      message: 'Workout session deleted successfully'
    })

  } catch (error: any) {
    console.error('Error deleting workout session:', error)
    return NextResponse.json(
      { error: 'Failed to delete workout session' },
      { status: 500 }
    )
  }
}