import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
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

    // Find the food log and verify ownership
    const existingLog = await prisma.foodLog.findFirst({
      where: {
        id: params.id,
        userId: user.id
      }
    })

    if (!existingLog) {
      return NextResponse.json(
        { error: 'Food log not found or unauthorized' },
        { status: 404 }
      )
    }

    // Prepare update data
    const updateData: any = {}

    // Update basic fields
    if (data.itemName !== undefined) updateData.itemName = data.itemName
    if (data.mealType !== undefined) updateData.mealType = data.mealType
    if (data.brand !== undefined) updateData.brand = data.brand
    if (data.quantity !== undefined) updateData.quantity = data.quantity
    if (data.unit !== undefined) updateData.unit = data.unit

    // Update nutrients if provided (merge with existing)
    if (data.nutrients) {
      const existingNutrients = (existingLog.nutrients as any) || {}
      updateData.nutrients = {
        ...existingNutrients,
        ...data.nutrients
      }
    }

    // Update the food log
    const updatedLog = await prisma.foodLog.update({
      where: { id: params.id },
      data: updateData
    })

    return NextResponse.json({
      success: true,
      data: updatedLog
    })

  } catch (error: any) {
    console.error('Error updating food entry:', error)
    return NextResponse.json(
      { error: 'Failed to update food entry' },
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

    const user = await resolveUser(session.user)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Find the food log and verify ownership
    const existingLog = await prisma.foodLog.findFirst({
      where: {
        id: params.id,
        userId: user.id
      }
    })

    if (!existingLog) {
      return NextResponse.json(
        { error: 'Food log not found or unauthorized' },
        { status: 404 }
      )
    }

    // Delete the food log
    await prisma.foodLog.delete({
      where: { id: params.id }
    })

    return NextResponse.json({
      success: true,
      message: 'Food entry deleted successfully'
    })

  } catch (error: any) {
    console.error('Error deleting food entry:', error)
    return NextResponse.json(
      { error: 'Failed to delete food entry' },
      { status: 500 }
    )
  }
}