import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'
import { validateWeight } from '@/lib/inputValidators'
import { journalAfterDelete } from '@/lib/journalDelete'
import { enqueueDriveSync } from '@/lib/driveSyncQueue'
import { hasEntryJsonChanges, mergeJournalEntryJson } from '@/lib/journalEntryMerge'

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

    // Find the journal entry and verify ownership
    const existingEntry = await prisma.journalEntry.findFirst({
      where: {
        id: params.id,
        userId: user.id
      }
    })

    if (!existingEntry) {
      return NextResponse.json(
        { error: 'Journal entry not found or unauthorized' },
        { status: 404 }
      )
    }

    if (typeof data.weight === 'number') {
      const werr = validateWeight(data.weight, 'lb')
      if (werr) return NextResponse.json({ error: werr }, { status: 400 })
    }

    // Prepare update data
    const updateData: any = {}

    // Update fields if provided
    if (data.mood !== undefined) updateData.mood = data.mood
    if (data.weight !== undefined) updateData.weight = data.weight

    // Update the entry field (nested JSON)
    if (hasEntryJsonChanges(data)) {
      updateData.entry = mergeJournalEntryJson(existingEntry.entry as string | null, data)
    }

    // Update the journal entry
    const updatedEntry = await prisma.journalEntry.update({
      where: { id: params.id },
      data: updateData
    })

    return NextResponse.json({
      success: true,
      data: updatedEntry
    })

  } catch (error: any) {
    console.error('Error updating journal entry:', error)
    return NextResponse.json(
      { error: 'Failed to update journal entry' },
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
    const existing = await prisma.journalEntry.findFirst({ where: { id: params.id, userId: user.id } })
    if (!existing) {
      return NextResponse.json({ error: 'Journal entry not found or unauthorized' }, { status: 404 })
    }
    const after = journalAfterDelete(existing.entry as string | null)
    if (after.keep) {
      await prisma.journalEntry.update({
        where: { id: existing.id },
        data: { entry: after.entryJson, mood: null, weight: null },
      })
    } else {
      await prisma.journalEntry.deleteMany({ where: { id: existing.id, userId: user.id } })
    }
    // Journal tick clears; Peptides tick stays only if dose lines remain.
    const names = after.keep ? ['journal'] : ['journal', 'peptides']
    await prisma.dailyTask.updateMany({
      where: { userId: user.id, date: existing.date, taskName: { in: names } },
      data: { completed: false },
    })
    await enqueueDriveSync(user.id, existing.date, ['journal']).catch(err => console.error('Drive enqueue failed:', err))
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Error deleting journal entry:', error)
    return NextResponse.json({ error: 'Failed to delete journal entry' }, { status: 500 })
  }
}
