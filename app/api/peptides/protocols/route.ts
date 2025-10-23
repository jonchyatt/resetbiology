import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'
import { getUserFromSession } from '@/lib/getUserFromSession'

// GET: Load user's active peptide protocols
export async function GET(request: Request) {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

        // Generate a slug from the peptide name
        const slug = peptideName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

        peptide = await prisma.peptide.create({
          data: {
            name: peptideName,
            slug: slug,
            category: 'Custom',
            dosage: dosage || '250mcg',
            price: 0, // Required field, set to 0 for custom peptides
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
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
