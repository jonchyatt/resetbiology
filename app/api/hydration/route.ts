import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'
import { getLocalDateTime, isLocalDate } from '@/lib/nutrition/localEntry'

const FL_OZ_TO_ML = 29.5735295625
const MAX_AMOUNT = 100000

function parseAmount(value: unknown) {
  const amount = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) return null
  return amount
}

function toMl(amount: number, unit: string) {
  if (unit === 'ml') return Math.round(amount)
  if (unit === 'fl-oz') return Math.round(amount * FL_OZ_TO_ML)
  return null
}

function localDateTime(body: any, loggedAt: Date) {
  const fallback = getLocalDateTime(loggedAt)
  return {
    localDate: isLocalDate(body?.localDate) ? body.localDate : fallback.localDate,
    localTime: typeof body?.localTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(body.localTime) ? body.localTime : fallback.localTime,
  }
}

async function currentUser(request: NextRequest) {
  return getUserFromSession(await auth0.getSession(request))
}

export async function GET(request: NextRequest) {
  const user = await currentUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const requested = searchParams.get('localDate')
  const localDate = isLocalDate(requested) ? requested : getLocalDateTime().localDate
  const [entries, target] = await Promise.all([
    prisma.hydrationEntry.findMany({ where: { userId: user.id, localDate, deletedAt: null }, orderBy: { loggedAt: 'asc' } }),
    prisma.hydrationTarget.findUnique({ where: { userId: user.id } }),
  ])
  return NextResponse.json({ success: true, localDate, entries, targetMl: target?.amountMl ?? null, totalMl: entries.reduce((sum, entry) => sum + entry.amountMl, 0) })
}

export async function POST(request: NextRequest) {
  const user = await currentUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null)
  const amount = parseAmount(body?.amount)
  const unit = body?.unit === 'ml' || body?.unit === 'fl-oz' ? body.unit : null
  const amountMl = amount && unit ? toMl(amount, unit) : null
  if (!amount || !unit || !amountMl || amountMl <= 0 || amountMl > MAX_AMOUNT) return NextResponse.json({ error: 'Enter a positive amount no larger than 100,000 mL or fl oz.' }, { status: 400 })
  const loggedAt = body?.loggedAt ? new Date(body.loggedAt) : new Date()
  if (Number.isNaN(loggedAt.getTime())) return NextResponse.json({ error: 'Invalid time' }, { status: 400 })
  const { localDate, localTime } = localDateTime(body, loggedAt)
  const requestId = typeof body?.requestId === 'string' && body.requestId.length <= 120 ? body.requestId : crypto.randomUUID()
  const data = { userId: user.id, requestId, drinkName: typeof body?.drinkName === 'string' && body.drinkName.trim() ? body.drinkName.trim().slice(0, 80) : 'Water', amount, unit, amountMl, loggedAt, localDate, localTime }
  try {
    const entry = await prisma.hydrationEntry.create({ data })
    await prisma.hydrationSnapshot.create({ data: { userId: user.id, entryId: entry.id, action: 'created', localDate, snapshot: entry } })
    return NextResponse.json({ success: true, entry }, { status: 201 })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      const existing = await prisma.hydrationEntry.findUnique({ where: { requestId } })
      if (existing?.userId === user.id) return NextResponse.json({ success: true, entry: existing, idempotent: true })
    }
    console.error('POST /api/hydration error:', error)
    return NextResponse.json({ error: 'Failed to save hydration entry' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const user = await currentUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null)
  const amount = parseAmount(body?.amount)
  const unit = body?.unit === 'ml' || body?.unit === 'fl-oz' ? body.unit : null
  const amountMl = amount && unit ? toMl(amount, unit) : null
  if (!amount || !unit || !amountMl || amountMl <= 0 || amountMl > MAX_AMOUNT || typeof body?.id !== 'string') return NextResponse.json({ error: 'Invalid hydration entry' }, { status: 400 })
  const existing = await prisma.hydrationEntry.findFirst({ where: { id: body.id, userId: user.id, deletedAt: null } })
  if (!existing) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
  const loggedAt = body?.loggedAt ? new Date(body.loggedAt) : existing.loggedAt
  if (Number.isNaN(loggedAt.getTime())) return NextResponse.json({ error: 'Invalid time' }, { status: 400 })
  const { localDate, localTime } = localDateTime(body, loggedAt)
  const entry = await prisma.hydrationEntry.update({ where: { id: existing.id }, data: { amount, unit, amountMl, loggedAt, localDate, localTime, drinkName: typeof body?.drinkName === 'string' && body.drinkName.trim() ? body.drinkName.trim().slice(0, 80) : existing.drinkName } })
  await prisma.hydrationSnapshot.create({ data: { userId: user.id, entryId: entry.id, action: 'updated', localDate, snapshot: entry } })
  return NextResponse.json({ success: true, entry })
}

export async function PATCH(request: NextRequest) {
  const user = await currentUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null)
  const amount = parseAmount(body?.targetMl)
  if (!amount || !Number.isInteger(amount)) return NextResponse.json({ error: 'Target must be a positive whole number of mL.' }, { status: 400 })
  const target = await prisma.hydrationTarget.upsert({ where: { userId: user.id }, update: { amountMl: amount }, create: { userId: user.id, amountMl: amount } })
  return NextResponse.json({ success: true, targetMl: target.amountMl })
}
