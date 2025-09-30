import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'

// POST: Log a peptide dose
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
      protocolId,
      dosage,
      time,
      notes,
      sideEffects,
      doseDate
    } = body

    if (!protocolId || !dosage) {
      return NextResponse.json({
        error: 'Missing required fields: protocolId, dosage'
      }, { status: 400 })
    }

    // Verify protocol belongs to user
    const protocol = await prisma.user_peptide_protocols.findUnique({
      where: { id: protocolId },
      include: { peptides: true }
    })

    if (!protocol || protocol.userId !== user.id) {
      return NextResponse.json({
        error: 'Protocol not found or access denied'
      }, { status: 404 })
    }

    // Create dose entry
    const dose = await prisma.peptide_doses.create({
      data: {
        protocolId,
        dosage,
        time: time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        notes: notes || null,
        sideEffects: sideEffects || null,
        doseDate: doseDate ? new Date(doseDate) : new Date()
      }
    })

    // Mark 'peptides' daily task as completed
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    await prisma.dailyTask.upsert({
      where: {
        userId_date_taskName: {
          userId: user.id,
          date: today,
          taskName: 'peptides'
        }
      },
      update: {
        completed: true
      },
      create: {
        userId: user.id,
        date: today,
        taskName: 'peptides',
        completed: true
      }
    })

    // Award gamification points
    await prisma.gamificationPoint.create({
      data: {
        userId: user.id,
        pointType: 'peptide_dose',
        amount: 25,
        activitySource: `Logged ${protocol.peptides.name} dose`
      }
    })

    return NextResponse.json({
      success: true,
      dose
    })

  } catch (error) {
    console.error('POST /api/peptides/doses error:', error)
    return NextResponse.json({
      error: 'Failed to log peptide dose',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET: Load dose history for a protocol or all protocols
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

    // Parse query params
    const { searchParams } = new URL(request.url)
    const protocolId = searchParams.get('protocolId')
    const limit = parseInt(searchParams.get('limit') || '100', 10)

    if (protocolId) {
      // Verify protocol belongs to user
      const protocol = await prisma.user_peptide_protocols.findUnique({
        where: { id: protocolId }
      })

      if (!protocol || protocol.userId !== user.id) {
        return NextResponse.json({
          error: 'Protocol not found or access denied'
        }, { status: 404 })
      }

      // Load doses for specific protocol
      const doses = await prisma.peptide_doses.findMany({
        where: {
          protocolId
        },
        orderBy: {
          doseDate: 'desc'
        },
        take: limit
      })

      return NextResponse.json({
        success: true,
        doses
      })

    } else {
      // Load all doses for user's protocols
      const userProtocols = await prisma.user_peptide_protocols.findMany({
        where: { userId: user.id },
        select: { id: true }
      })

      const protocolIds = userProtocols.map(p => p.id)

      const doses = await prisma.peptide_doses.findMany({
        where: {
          protocolId: {
            in: protocolIds
          }
        },
        include: {
          user_peptide_protocols: {
            include: {
              peptides: true
            }
          }
        },
        orderBy: {
          doseDate: 'desc'
        },
        take: limit
      })

      return NextResponse.json({
        success: true,
        doses
      })
    }

  } catch (error) {
    console.error('GET /api/peptides/doses error:', error)
    return NextResponse.json({
      error: 'Failed to load peptide doses',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
