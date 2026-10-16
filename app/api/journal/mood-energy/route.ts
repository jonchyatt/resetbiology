import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'

const datePattern = /^\d{4}-\d{2}-\d{2}$/
const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

function tags(value: unknown) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item): item is string => typeof item === 'string').map(item => item.trim().toLowerCase()).filter(Boolean))].slice(0, 20)
}

function validScale(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 10
}

async function userFor(request: NextRequest) {
  return getUserFromSession(await auth0.getSession(request))
}

export async function GET(request: NextRequest) {
  const user = await userFor(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const params = new URL(request.url).searchParams
  const today = new Date().toISOString().slice(0, 10)
  const from = datePattern.test(params.get('from') || '') ? params.get('from')! : `${today.slice(0, 8)}01`
  const to = datePattern.test(params.get('to') || '') ? params.get('to')! : today
  const tag = (params.get('tag') || '').trim().toLowerCase()
  const entries = await prisma.moodEnergyEntry.findMany({ where: { userId: user.id, localDate: { gte: from, lte: to } }, orderBy: { recordedAt: 'asc' } })
  return NextResponse.json({ entries: tag ? entries.filter(entry => entry.tags.includes(tag)) : entries, range: { from, to } })
}

export async function POST(request: NextRequest) {
  const user = await userFor(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const mood = body.mood
  const energy = body.energy
  const localDate = typeof body.localDate === 'string' && datePattern.test(body.localDate) ? body.localDate : ''
  const recordedAt = typeof body.recordedAt === 'string' && timestampPattern.test(body.recordedAt) ? new Date(body.recordedAt) : null
  const clientKey = typeof body.clientKey === 'string' ? body.clientKey.trim() : ''
  if (!validScale(mood) || !validScale(energy) || !localDate || !recordedAt || Number.isNaN(recordedAt.getTime()) || !clientKey) return NextResponse.json({ error: 'Mood, energy, localDate, recordedAt, and clientKey are required' }, { status: 400 })
  const existing = await prisma.moodEnergyEntry.findFirst({ where: { userId: user.id, clientKey } })
  if (existing) return NextResponse.json({ entry: existing, duplicate: true })
  const entry = await prisma.moodEnergyEntry.create({ data: { userId: user.id, clientKey, mood, energy, localDate, recordedAt, note: typeof body.note === 'string' ? body.note.trim().slice(0, 2000) || null : null, tags: tags(body.tags) } })
  return NextResponse.json({ entry }, { status: 201 })
}