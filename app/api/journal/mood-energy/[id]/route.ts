import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'

async function owned(request: NextRequest, id: string) {
  const user = getUserFromSession(await auth0.getSession(request))
  const resolved = await user
  if (!resolved) return { user: null, entry: null }
  return { user: resolved, entry: await prisma.moodEnergyEntry.findFirst({ where: { id, userId: resolved.id } }) }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const { user, entry } = await owned(request, id)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!entry) return NextResponse.json({ error: 'Mood and energy entry not found' }, { status: 404 })
  const body = await request.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  if (Number.isInteger(body.mood) && body.mood >= 1 && body.mood <= 10) data.mood = body.mood
  if (Number.isInteger(body.energy) && body.energy >= 1 && body.energy <= 10) data.energy = body.energy
  if (typeof body.note === 'string') data.note = body.note.trim().slice(0, 2000) || null
  if (typeof body.localDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.localDate)) data.localDate = body.localDate
  if (typeof body.recordedAt === 'string' && !Number.isNaN(new Date(body.recordedAt).getTime())) data.recordedAt = new Date(body.recordedAt)
  if (Array.isArray(body.tags)) data.tags = [...new Set(body.tags.filter((item: unknown): item is string => typeof item === 'string').map((item: string) => item.trim().toLowerCase()).filter(Boolean))].slice(0, 20)
  if (!Object.keys(data).length) return NextResponse.json({ error: 'No valid changes supplied' }, { status: 400 })
  return NextResponse.json({ entry: await prisma.moodEnergyEntry.update({ where: { id }, data }) })
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const { user, entry } = await owned(request, id)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!entry) return NextResponse.json({ error: 'Mood and energy entry not found' }, { status: 404 })
  await prisma.moodEnergyEntry.delete({ where: { id } })
  return NextResponse.json({ deleted: true, id })
}