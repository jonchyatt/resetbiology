import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { enqueueDriveSync } from '@/lib/driveSyncQueue'
import { validatePeptideDoseSlotKey } from '@/lib/peptide-dose-slot'
import { appendPeptideDoseToJournal } from '@/lib/peptideDoseJournal'
import { dayKeyToUtcMidnight, formatNoteTime, isValidDayKey, localDayKey } from '@/lib/localDay'

// POST: Log a peptide dose
export async function POST(request: Request) {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      protocolId,
      dosage,
      time,
      notes,
      sideEffects,
      doseDate,
      localDate,
      localTime,
      slotKey
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

    const slotValidation = validatePeptideDoseSlotKey(
      { protocolId, localDate, slotKey },
      protocol,
    )
    if (!slotValidation.ok) {
      return NextResponse.json({ error: slotValidation.error }, { status: slotValidation.status })
    }

    // Create dose entry with protocol metadata for history preservation
    const dose = await prisma.peptide_doses.create({
      data: {
        protocolId,
        protocolName: protocol.peptides.name,  // Store name for history preservation
        protocolSnapshot: {                     // Store full snapshot
          peptideName: protocol.peptides.name,
          dosage: protocol.dosage,
          frequency: protocol.frequency,
          notes: protocol.notes
        },
        dosage,
        // T1 R4: never fabricate a time server-side — server tz != member
        // tz. Client sends canonical 24h "HH:MM" derived from the log
        // moment; if absent, store null and let the UI render from the
        // ISO `doseDate` timestamp instead (R2).
        time: time || null,
        notes: notes || null,
        sideEffects: sideEffects || null,
        doseDate: doseDate ? new Date(doseDate) : new Date(),
        localDate,
        localTime: localTime || null,
        slotKey: slotValidation.slotKey,
      }
    })

    try {
      await appendPeptideDoseToJournal(prisma, user.id, dose.doseDate, localDate, {
        peptideName: protocol.peptides.name,
        dosage,
        timeLabel: formatNoteTime(localTime || time, dose.doseDate),
      })
    } catch (err) {
      console.error('journal append failed', err)
    }

    // Mark 'peptides' daily task as completed
    // RB-FIX-2: the member's day, not the server's (UTC on Vercel).
    const today = dayKeyToUtcMidnight(isValidDayKey(localDate) ? localDate : localDayKey(dose.doseDate))
    await prisma.dailyTask.upsert({
      where: {
        userId_date_taskName: {
          userId: user.id,
          date: today,
          taskName: 'peptides'
        }
      },
      update: { completed: true },
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

    // Queue Google Drive sync (awaited — Vercel freezes the lambda after the response, killing un-awaited work)
    await enqueueDriveSync(user.id, new Date(), ['peptides']).catch(err => console.error('Drive enqueue failed:', err))

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
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

// DELETE: Delete a specific dose
export async function DELETE(request: Request) {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const doseId = searchParams.get('id')

    if (!doseId) {
      return NextResponse.json({ error: 'Dose ID required' }, { status: 400 })
    }

    // Get the dose to verify ownership
    const dose = await prisma.peptide_doses.findUnique({
      where: { id: doseId },
      include: {
        user_peptide_protocols: true
      }
    })

    if (!dose) {
      return NextResponse.json({ error: 'Dose not found' }, { status: 404 })
    }

    // Verify the protocol belongs to the user
    if (dose.user_peptide_protocols.userId !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Delete the dose
    await prisma.peptide_doses.delete({
      where: { id: doseId }
    })

    return NextResponse.json({
      success: true,
      message: 'Dose deleted successfully'
    })

  } catch (error) {
    console.error('DELETE /api/peptides/doses error:', error)
    return NextResponse.json({
      error: 'Failed to delete dose',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
