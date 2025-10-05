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

    // Find the food entry and verify ownership
    const existingEntry = await prisma.foodEntry.findFirst({
      where: {
        id: params.id,
        userId: user.id
      }
    })

    if (!existingEntry) {
      return NextResponse.json(
        { error: 'Food entry not found or unauthorized' },
        { status: 404 }
      )
    }

    // Prepare update data
    const updateData: any = {}

    // Update basic fields
    if (data.itemName !== undefined) updateData.itemName = data.itemName
    if (data.mealType !== undefined) updateData.mealType = data.mealType
    if (data.quantity !== undefined) updateData.quantity = data.quantity
    if (data.unit !== undefined) updateData.unit = data.unit

    // Update nutrients if provided
    if (data.nutrients) {
      updateData.nutrients = {
        ...(existingEntry.nutrients as any || {}),
        ...data.nutrients
      }
    }

    // Update the food entry
    const updatedEntry = await prisma.foodEntry.update({
      where: { id: params.id },
      data: updateData
    })

    return NextResponse.json({
      success: true,
      data: updatedEntry
    })

  } catch (error: any) {
    console.error('Error updating food entry:', error)
    return NextResponse.json(
      { error: 'Failed to update food entry' },
      { status: 500 }
    )
  }
}