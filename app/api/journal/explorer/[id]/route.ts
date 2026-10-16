import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'

function cleanTags(value: unknown) {
  if (!Array.isArray(value)) return undefined
  return [...new Set(value.filter((tag): tag is string => typeof tag === 'string').map(tag => tag.trim().toLowerCase()).filter(Boolean))].slice(0, 20)
}

async function ownedRecord(request: NextRequest, id: string) {
  const user = await getUserFromSession(await auth0.getSession(request))
  if (!user) return { user: null, record: null }
  return { user, record: await prisma.journalRecord.findFirst({ where: { id, userId: user.id } }) }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const { user, record } = await ownedRecord(request, id)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!record) return NextResponse.json({ error: 'Journal record not found' }, { status: 404 })
  const body = await request.json().catch(() => ({}))
  const data: { title?: string; body?: string; tags?: string[]; localDate?: string; isPinned?: boolean } = {}
  if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim()
  if (typeof body.body === 'string' && body.body.trim()) data.body = body.body.trim()
  const tags = cleanTags(body.tags)
  if (tags) data.tags = tags
  if (typeof body.localDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.localDate)) data.localDate = body.localDate
  if (typeof body.isPinned === 'boolean') data.isPinned = body.isPinned
  const updated = await prisma.journalRecord.update({ where: { id }, data })
  return NextResponse.json({ record: updated })
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const { user, record } = await ownedRecord(request, id)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!record) return NextResponse.json({ error: 'Journal record not found' }, { status: 404 })
  await prisma.journalRecord.delete({ where: { id } })
  return NextResponse.json({ deleted: true, id })
}
