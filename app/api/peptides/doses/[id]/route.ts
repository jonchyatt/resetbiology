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

    // Find the peptide dose and verify ownership
    const existingDose = await prisma.peptideDoses.findFirst({
      where: {
        id: params.id,
        userId: user.id
      }
    })

    if (!existingDose) {
      return NextResponse.json(
        { error: 'Peptide dose not found or unauthorized' },
        { status: 404 }
      )
    }

    // Prepare update data
    const updateData: any = {}

    // Update fields if provided
    if (data.dosage !== undefined) updateData.dosage = data.dosage
    if (data.time !== undefined) updateData.time = data.time
    if (data.notes !== undefined) updateData.notes = data.notes
    if (data.sideEffects !== undefined) updateData.sideEffects = data.sideEffects
    if (data.doseDate !== undefined) updateData.doseDate = new Date(data.doseDate)

    // Update the peptide dose
    const updatedDose = await prisma.peptideDoses.update({
      where: { id: params.id },
      data: updateData
    })

    return NextResponse.json({
      success: true,
      data: updatedDose
    })

  } catch (error: any) {
    console.error('Error updating peptide dose:', error)
    return NextResponse.json(
      { error: 'Failed to update peptide dose' },
      { status: 500 }
    )
  }
}