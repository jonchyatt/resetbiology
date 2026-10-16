import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'

const datePattern = /^\d{4}-\d{2}-\d{2}$/

function asDate(value: unknown, fallback: string) {
  if (typeof value === 'string' && datePattern.test(value)) return value
  return fallback
}

function parseTags(value: unknown) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((tag): tag is string => typeof tag === 'string').map(tag => tag.trim().toLowerCase()).filter(Boolean))].slice(0, 20)
}

async function currentUser(request: NextRequest) {
  const session = await auth0.getSession(request)
  return getUserFromSession(session)
}

export async function GET(request: NextRequest) {
  const user = await currentUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const params = new URL(request.url).searchParams
  const today = new Date().toISOString().slice(0, 10)
  const from = asDate(params.get('from'), `${today.slice(0, 8)}01`)
  const to = asDate(params.get('to'), today)
  const query = (params.get('q') || '').trim().toLowerCase()
  const tag = (params.get('tag') || '').trim().toLowerCase()
  const type = params.get('type') || 'all'

  const [records, meals, peptides, modules] = await Promise.all([
    prisma.journalRecord.findMany({ where: { userId: user.id, localDate: { gte: from, lte: to } }, orderBy: [{ isPinned: 'desc' }, { localDate: 'desc' }, { updatedAt: 'desc' }] }),
    prisma.foodLog.findMany({ where: { userId: user.id, OR: [{ localDate: { gte: from, lte: to } }, { localDate: null, loggedAt: { gte: new Date(`${from}T00:00:00.000Z`), lte: new Date(`${to}T23:59:59.999Z`) } }] }, orderBy: { loggedAt: 'desc' } }),
    prisma.peptide_doses.findMany({ where: { user_peptide_protocols: { userId: user.id }, doseDate: { gte: new Date(`${from}T00:00:00.000Z`), lte: new Date(`${to}T23:59:59.999Z`) } }, include: { user_peptide_protocols: { include: { peptides: true } } }, orderBy: { doseDate: 'desc' } }),
    prisma.moduleCompletion.findMany({ where: { userId: user.id, completedAt: { gte: new Date(`${from}T00:00:00.000Z`), lte: new Date(`${to}T23:59:59.999Z`) } }, orderBy: { completedAt: 'desc' } }),
  ])

  const activity = [
    ...meals.map((item: any) => ({ id: item.id, kind: 'meal', localDate: item.localDate || new Date(item.loggedAt).toISOString().slice(0, 10), label: item.itemName || 'Meal', href: `/daily-history?date=${item.localDate || new Date(item.loggedAt).toISOString().slice(0, 10)}&focus=meal&id=${item.id}` })),
    ...peptides.map((item: any) => ({ id: item.id, kind: 'peptide', localDate: item.localDate || new Date(item.doseDate).toISOString().slice(0, 10), label: item.user_peptide_protocols?.peptides?.name || 'Peptide dose', href: `/daily-history?date=${item.localDate || new Date(item.doseDate).toISOString().slice(0, 10)}&focus=peptide&id=${item.id}` })),
    ...modules.map((item: any) => ({ id: item.id, kind: 'hypnosis', localDate: item.localDate || new Date(item.completedAt).toISOString().slice(0, 10), label: item.moduleId || 'Hypnosis module', href: `/daily-history?date=${item.localDate || new Date(item.completedAt).toISOString().slice(0, 10)}&focus=hypnosis&id=${item.id}` })),
  ]

  const filteredRecords = records.filter(record => {
    const text = `${record.title} ${record.body} ${record.tags.join(' ')}`.toLowerCase()
    return (!query || text.includes(query)) && (!tag || record.tags.includes(tag)) && (type === 'all' || type === 'journal')
  })

  const filteredActivity = activity.filter(item => {
    const text = item.label.toLowerCase()
    return (!query || text.includes(query)) && (type === 'all' || type === item.kind)
  })

  const allTags = [...new Set(records.flatMap(record => record.tags))].sort()
  return NextResponse.json({ records: filteredRecords, activity: filteredActivity, allTags, range: { from, to } })
}

export async function POST(request: NextRequest) {
  const user = await currentUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const text = typeof body.body === 'string' ? body.body.trim() : ''
  const localDate = asDate(body.localDate, new Date().toISOString().slice(0, 10))
  const clientKey = typeof body.clientKey === 'string' ? body.clientKey.trim() : ''
  if (!title || !text || !clientKey) return NextResponse.json({ error: 'Title, body, and clientKey are required' }, { status: 400 })

  const existing = await prisma.journalRecord.findFirst({ where: { userId: user.id, clientKey } })
  if (existing) return NextResponse.json({ record: existing, duplicate: true }, { status: 200 })
  const record = await prisma.journalRecord.create({ data: { userId: user.id, clientKey, title, body: text, tags: parseTags(body.tags), localDate, isPinned: Boolean(body.isPinned) } })
  return NextResponse.json({ record }, { status: 201 })
}
