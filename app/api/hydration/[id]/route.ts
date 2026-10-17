import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromSession(await auth0.getSession(request))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const existing = await prisma.hydrationEntry.findFirst({ where: { id, userId: user.id, deletedAt: null } })
  if (!existing) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
  const entry = await prisma.hydrationEntry.update({ where: { id }, data: { deletedAt: new Date() } })
  await prisma.hydrationSnapshot.create({ data: { userId: user.id, entryId: id, action: 'deleted', localDate: existing.localDate, snapshot: entry } })
  return NextResponse.json({ success: true })
}
