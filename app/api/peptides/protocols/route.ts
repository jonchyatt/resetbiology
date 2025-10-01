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

    // Find user by Auth0 sub
    const user = await prisma.user.findUnique({
      where: { auth0Sub: session.user.sub }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Load active protocols with their doses
    const protocols = await prisma.user_peptide_protocols.findMany({
      where: {
        userId: user.id
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

    // Find user by Auth0 sub
    const user = await prisma.user.findUnique({
      where: { auth0Sub: session.user.sub }
    })

    if (!user) {
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

    // Find peptide by ID or name
    let peptide
    if (peptideId) {
      peptide = await prisma.peptide.findUnique({
        where: { id: peptideId }
      })
    } else if (peptideName) {
      peptide = await prisma.peptide.findFirst({
        where: {
          name: {
            equals: peptideName,
            mode: 'insensitive'
          }
        }
      })
    }

    if (!peptide) {
      return NextResponse.json({
        error: 'Peptide not found'
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

    // Find user by Auth0 sub
    const user = await prisma.user.findUnique({
      where: { auth0Sub: session.user.sub }
    })

    if (!user) {
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
