import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'

// GET: Load user's active peptide protocols
export async function GET(request: Request) {
  try {
    const session = await auth0.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔍 Auth0 Session User:', {
      sub: session.user.sub,
      email: session.user.email,
      name: session.user.name
    })

    // Find user by Auth0 sub OR email
    let user = await prisma.user.findUnique({
      where: { auth0Sub: session.user.sub }
    })

    // If not found by auth0Sub, try by email
    if (!user && session.user.email) {
      user = await prisma.user.findUnique({
        where: { email: session.user.email }
      })

      // Update auth0Sub if found by email
      if (user) {
        console.log('📝 Updating user auth0Sub from session')
        user = await prisma.user.update({
          where: { id: user.id },
          data: { auth0Sub: session.user.sub }
        })
      }
    }

    if (!user) {
      console.log('❌ User not found. Auth0 sub:', session.user.sub, 'Email:', session.user.email)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Load active protocols with their doses
    const protocols = await prisma.user_peptide_protocols.findMany({
      where: {
        userId: user.id,
        isActive: true
      },
      include: {
        peptides: true,
        peptide_doses: {
          orderBy: {
            doseDate: 'desc'
          },
          take: 10 // Last 10 doses per protocol
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      protocols
    })

  } catch (error) {
    console.error('GET /api/peptides/protocols error:', error)
    return NextResponse.json({
      error: 'Failed to load peptide protocols',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST: Create new peptide protocol
export async function POST(request: Request) {
  try {
    const session = await auth0.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔍 Auth0 Session User:', {
      sub: session.user.sub,
      email: session.user.email,
      name: session.user.name
    })

    // Find user by Auth0 sub OR email
    let user = await prisma.user.findUnique({
      where: { auth0Sub: session.user.sub }
    })

    // If not found by auth0Sub, try by email
    if (!user && session.user.email) {
      user = await prisma.user.findUnique({
        where: { email: session.user.email }
      })

      // Update auth0Sub if found by email
      if (user) {
        console.log('📝 Updating user auth0Sub from session')
        user = await prisma.user.update({
          where: { id: user.id },
          data: { auth0Sub: session.user.sub }
        })
      }
    }

    if (!user) {
      console.log('❌ User not found. Auth0 sub:', session.user.sub, 'Email:', session.user.email)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      peptideId,
      peptideName, // May provide name instead of ID
      dosage,
      frequency,
      notes,
      startDate,
      endDate
    } = body

    if (!peptideId && !peptideName) {
      return NextResponse.json({
        error: 'Must provide either peptideId or peptideName'
      }, { status: 400 })
    }

    if (!dosage || !frequency) {
      return NextResponse.json({
        error: 'Missing required fields: dosage, frequency'
      }, { status: 400 })
    }

    // Find or create peptide by ID or name
    let peptide
    if (peptideId) {
      peptide = await prisma.peptide.findUnique({
        where: { id: peptideId }
      })
    } else if (peptideName) {
      // Try to find existing peptide by name
      peptide = await prisma.peptide.findFirst({
        where: {
          name: {
            equals: peptideName,
            mode: 'insensitive'
          }
        }
      })

      // If not found, create a new peptide entry (for storefront products or custom peptides)
      if (!peptide) {
        console.log(`📝 Creating new peptide entry for: ${peptideName}`)
        peptide = await prisma.peptide.create({
          data: {
            name: peptideName,
            category: 'Custom',
            dosage: dosage || '250mcg',
            description: `Custom/Storefront peptide: ${peptideName}`,
            updatedAt: new Date()
          }
        })
      }
    }

    if (!peptide) {
      return NextResponse.json({
        error: 'Peptide not found and unable to create'
      }, { status: 404 })
    }

    // Create protocol
    const protocol = await prisma.user_peptide_protocols.create({
      data: {
        userId: user.id,
        peptideId: peptide.id,
        dosage,
        frequency,
        notes: notes || null,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
        isActive: true,
        updatedAt: new Date()
      },
      include: {
        peptides: true
      }
    })

    return NextResponse.json({
      success: true,
      protocol
    })

  } catch (error) {
    console.error('POST /api/peptides/protocols error:', error)
    return NextResponse.json({
      error: 'Failed to create peptide protocol',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// PATCH: Update protocol (pause/resume/modify)
export async function PATCH(request: Request) {
  try {
    const session = await auth0.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔍 Auth0 Session User:', {
      sub: session.user.sub,
      email: session.user.email,
      name: session.user.name
    })

    // Find user by Auth0 sub OR email
    let user = await prisma.user.findUnique({
      where: { auth0Sub: session.user.sub }
    })

    // If not found by auth0Sub, try by email
    if (!user && session.user.email) {
      user = await prisma.user.findUnique({
        where: { email: session.user.email }
      })

      // Update auth0Sub if found by email
      if (user) {
        console.log('📝 Updating user auth0Sub from session')
        user = await prisma.user.update({
          where: { id: user.id },
          data: { auth0Sub: session.user.sub }
        })
      }
    }

    if (!user) {
      console.log('❌ User not found. Auth0 sub:', session.user.sub, 'Email:', session.user.email)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const { protocolId, isActive, dosage, frequency, notes, endDate } = body

    if (!protocolId) {
      return NextResponse.json({
        error: 'Missing protocolId'
      }, { status: 400 })
    }

    // Verify ownership
    const protocol = await prisma.user_peptide_protocols.findUnique({
      where: { id: protocolId }
    })

    if (!protocol || protocol.userId !== user.id) {
      return NextResponse.json({
        error: 'Protocol not found or access denied'
      }, { status: 404 })
    }

    // Build update data
    const updateData: any = {
      updatedAt: new Date()
    }

    if (typeof isActive === 'boolean') updateData.isActive = isActive
    if (dosage) updateData.dosage = dosage
    if (frequency) updateData.frequency = frequency
    if (notes !== undefined) updateData.notes = notes
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null

    // Update protocol
    const updatedProtocol = await prisma.user_peptide_protocols.update({
      where: { id: protocolId },
      data: updateData,
      include: {
        peptides: true
      }
    })

    return NextResponse.json({
      success: true,
      protocol: updatedProtocol
    })

  } catch (error) {
    console.error('PATCH /api/peptides/protocols error:', error)
    return NextResponse.json({
      error: 'Failed to update peptide protocol',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// DELETE: Remove a protocol
export async function DELETE(request: Request) {
  try {
    const session = await auth0.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find user
    let user = await prisma.user.findUnique({
      where: { auth0Sub: session.user.sub }
    })

    if (!user && session.user.email) {
      user = await prisma.user.findUnique({
        where: { email: session.user.email }
      })

      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { auth0Sub: session.user.sub }
        })
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const protocolId = searchParams.get('id')

    if (!protocolId) {
      return NextResponse.json({ error: 'Protocol ID required' }, { status: 400 })
    }

    // Verify protocol belongs to user
    const protocol = await prisma.user_peptide_protocols.findUnique({
      where: { id: protocolId }
    })

    if (!protocol) {
      return NextResponse.json({ error: 'Protocol not found' }, { status: 404 })
    }

    if (protocol.userId !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Set protocol to inactive instead of deleting to preserve dose history
    await prisma.user_peptide_protocols.update({
      where: { id: protocolId },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Protocol archived successfully. Dose history preserved.'
    })

  } catch (error) {
    console.error('DELETE /api/peptides/protocols error:', error)
    return NextResponse.json({
      error: 'Failed to delete protocol',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
