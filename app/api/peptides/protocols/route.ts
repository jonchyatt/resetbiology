import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'
import { getUserFromSession } from '@/lib/getUserFromSession'
import {
  scheduleNotificationsForProtocol,
  cancelNotificationsForProtocol,
} from '@/lib/scheduleNotifications'
import {
  archiveProtocol,
  createProtocol,
  listActiveProtocols,
  updateProtocol,
} from '@/lib/protocols-store'
import { isVaultConnected } from '@/lib/vaultService'

// GET: Load user's active peptide protocols (Drive-primary when connected)
export async function GET() {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const protocols = await listActiveProtocols(user.id)
    return NextResponse.json({ success: true, protocols })
  } catch (error) {
    console.error('GET /api/peptides/protocols error:', error)
    return NextResponse.json(
      {
        error: 'Failed to load peptide protocols',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
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
    const result = await createProtocol(user.id, {
      peptideId: body.peptideId,
      peptideName: body.peptideName,
      dosage: body.dosage,
      frequency: body.frequency,
      timing: body.timing,
      notes: body.notes,
      startDate: body.startDate,
      endDate: body.endDate,
      timezone: body.timezone || body.clientTimezone,
      administrationType: body.administrationType,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const userTimezone = body.timezone || body.clientTimezone || null
    const driveConnected = await isVaultConnected(user.id)

    // Notification preferences are stored in Mongo regardless of storage path
    // — they're per-user UI state, not protocol definition data.
    try {
      await prisma.notificationPreference.create({
        data: {
          userId: user.id,
          protocolId: result.protocol.id,
          pushEnabled: true,
          emailEnabled: false,
          reminderMinutes: 15,
          timezone: userTimezone,
        },
      })

      // P2.3 contract: for Drive-connected users we DO NOT pre-generate
      // ScheduledNotification rows. P2.4 will compute reminders on-demand
      // from Drive data on each /api/notifications/send tick.
      if (!driveConnected) {
        await scheduleNotificationsForProtocol(user.id, result.protocol.id, {
          daysAhead: 30,
          timezone: userTimezone ?? undefined,
        })
      }
    } catch (error) {
      console.error('Error setting up notifications for new protocol:', error)
      // Don't fail the request if notification setup fails
    }

    return NextResponse.json({
      success: true,
      protocol: result.protocol,
    })
  } catch (error) {
    console.error('POST /api/peptides/protocols error:', error)
    return NextResponse.json(
      {
        error: 'Failed to create peptide protocol',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
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
    const protocolId: string | undefined = body.protocolId

    if (!protocolId) {
      return NextResponse.json({ error: 'Missing protocolId' }, { status: 400 })
    }

    const result = await updateProtocol(user.id, protocolId, {
      isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
      dosage: body.dosage,
      frequency: body.frequency,
      timing: body.timing,
      notes: body.notes,
      endDate: body.endDate,
      administrationType: body.administrationType,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const driveConnected = await isVaultConnected(user.id)

    if (typeof body.isActive === 'boolean' || result.timingChanged) {
      try {
        if (body.isActive === false) {
          await cancelNotificationsForProtocol(user.id, protocolId)
        } else if (!driveConnected && (body.isActive === true || result.timingChanged)) {
          await scheduleNotificationsForProtocol(user.id, protocolId, {
            daysAhead: 30,
            forceReschedule: true,
          })
        }
      } catch (error) {
        console.error('Error updating notifications after protocol change:', error)
      }
    }

    return NextResponse.json({ success: true, protocol: result.protocol })
  } catch (error) {
    console.error('PATCH /api/peptides/protocols error:', error)
    return NextResponse.json(
      {
        error: 'Failed to update peptide protocol',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

// DELETE: Archive a protocol (preserves dose history)
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

    const result = await archiveProtocol(user.id, protocolId)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    try {
      await cancelNotificationsForProtocol(user.id, protocolId)
    } catch (error) {
      console.error('Error canceling notifications:', error)
    }

    return NextResponse.json({
      success: true,
      message: 'Protocol archived successfully. Dose history preserved.',
    })
  } catch (error) {
    console.error('DELETE /api/peptides/protocols error:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete protocol',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
