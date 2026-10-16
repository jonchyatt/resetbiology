import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const user = await getUserFromSession(await auth0.getSession(request))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const from = typeof body.from === 'string' ? body.from.trim().toLowerCase() : ''
  const to = typeof body.to === 'string' ? body.to.trim().toLowerCase() : ''
  if (!from || !to) return NextResponse.json({ error: 'Both from and to tags are required' }, { status: 400 })
  const records = await prisma.journalRecord.findMany({ where: { userId: user.id, tags: { has: from } }, select: { id: true, tags: true } })
  for (const record of records) {
    const tags = [...new Set(record.tags.map(tag => tag === from ? to : tag))]
    await prisma.journalRecord.update({ where: { id: record.id }, data: { tags } })
  }
  return NextResponse.json({ renamed: records.length, from, to })
}
