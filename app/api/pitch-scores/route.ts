import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type IncomingScore = {
  gameKey: string
  payload: Prisma.InputJsonValue
  updatedAt: Date
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function parseUpdatedAt(value: unknown): Date | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function parseJsonPayload(value: unknown): Prisma.InputJsonValue | null {
  if (value === null || value === undefined) return null
  try {
    JSON.stringify(value)
  } catch {
    return null
  }
  return value as Prisma.InputJsonValue
}

function normalizeScores(body: unknown): IncomingScore[] | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'Request body required' }

  const raw = body as {
    gameKey?: unknown
    payload?: unknown
    updatedAt?: unknown
    scores?: unknown
  }

  const source = raw.scores === undefined
    ? [{ gameKey: raw.gameKey, payload: raw.payload, updatedAt: raw.updatedAt }]
    : Array.isArray(raw.scores)
      ? raw.scores
      : Object.entries(raw.scores && typeof raw.scores === 'object' ? raw.scores : {})
          .map(([gameKey, value]) => ({
            gameKey,
            payload: value && typeof value === 'object' && 'payload' in value
              ? (value as { payload: unknown }).payload
              : value,
            updatedAt: value && typeof value === 'object' && 'updatedAt' in value
              ? (value as { updatedAt: unknown }).updatedAt
              : undefined,
          }))

  const normalized: IncomingScore[] = []
  for (const item of source) {
    if (!item || typeof item !== 'object') return { error: 'Each score must be an object' }
    const score = item as { gameKey?: unknown; payload?: unknown; updatedAt?: unknown }
    if (typeof score.gameKey !== 'string' || score.gameKey.trim().length === 0) {
      return { error: 'Each score requires a gameKey' }
    }
    if (score.gameKey.length > 160) return { error: 'gameKey is too long' }
    const payload = parseJsonPayload(score.payload)
    if (payload === null) return { error: 'Each score requires a JSON payload' }
    const updatedAt = parseUpdatedAt(score.updatedAt)
    if (!updatedAt) return { error: 'Each score requires a valid updatedAt' }
    normalized.push({
      gameKey: score.gameKey,
      payload,
      updatedAt,
    })
  }

  if (normalized.length === 0) return { error: 'At least one score is required' }
  if (normalized.length > 100) return { error: 'Too many scores in one request' }
  return normalized
}

async function resolveUser() {
  const session = await auth0.getSession()

  if (!session?.user?.sub) {
    return null
  }

  let user = await prisma.user.findUnique({
    where: { auth0Sub: session.user.sub },
  })

  if (!user && session.user.email) {
    user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { auth0Sub: session.user.sub },
      })
    }
  }

  if (!user) {
    user = await prisma.user.create({
      data: {
        auth0Sub: session.user.sub,
        email: session.user.email ?? null,
        name: session.user.name ?? null,
        image: session.user.picture ?? null,
      },
    })
  }

  return user
}

async function writeScore(userId: string, score: IncomingScore) {
  const existing = await prisma.gameScore.findUnique({
    where: {
      userId_gameKey: {
        userId,
        gameKey: score.gameKey,
      },
    },
  })

  if (existing && existing.localUpdatedAt > score.updatedAt) {
    return existing
  }

  if (existing) {
    return prisma.gameScore.update({
      where: { id: existing.id },
      data: {
        payload: score.payload,
        localUpdatedAt: score.updatedAt,
      },
    })
  }

  try {
    return await prisma.gameScore.create({
      data: {
        userId,
        gameKey: score.gameKey,
        payload: score.payload,
        localUpdatedAt: score.updatedAt,
      },
    })
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') {
      return prisma.gameScore.update({
        where: {
          userId_gameKey: {
            userId,
            gameKey: score.gameKey,
          },
        },
        data: {
          payload: score.payload,
          localUpdatedAt: score.updatedAt,
        },
      })
    }
    throw error
  }
}

export async function GET() {
  try {
    const user = await resolveUser()
    if (!user) return errorResponse('Unauthorized', 401)

    const rows = await prisma.gameScore.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
    })

    const scores = Object.fromEntries(rows.map(row => [
      row.gameKey,
      {
        payload: row.payload,
        updatedAt: row.localUpdatedAt.toISOString(),
        serverUpdatedAt: row.updatedAt.toISOString(),
      },
    ]))

    return NextResponse.json({ success: true, scores })
  } catch (error) {
    console.error('GET /api/pitch-scores error:', error)
    return errorResponse('Failed to load pitch scores', 500)
  }
}

export async function POST(request: Request) {
  try {
    const user = await resolveUser()
    if (!user) return errorResponse('Unauthorized', 401)

    const normalized = normalizeScores(await request.json())
    if ('error' in normalized) return errorResponse(normalized.error, 400)

    const rows = []
    for (const score of normalized) {
      rows.push(await writeScore(user.id, score))
    }

    return NextResponse.json({
      success: true,
      scores: Object.fromEntries(rows.map(row => [
        row.gameKey,
        {
          payload: row.payload,
          updatedAt: row.localUpdatedAt.toISOString(),
          serverUpdatedAt: row.updatedAt.toISOString(),
        },
      ])),
    })
  } catch (error) {
    console.error('POST /api/pitch-scores error:', error)
    return errorResponse('Failed to save pitch scores', 500)
  }
}

export const PUT = POST

export async function DELETE(request: Request) {
  try {
    const user = await resolveUser()
    if (!user) return errorResponse('Unauthorized', 401)

    const body = await request.json() as { gameKey?: unknown }
    if (typeof body.gameKey !== 'string' || body.gameKey.trim().length === 0) {
      return errorResponse('gameKey required', 400)
    }

    await prisma.gameScore.deleteMany({
      where: {
        userId: user.id,
        gameKey: body.gameKey,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/pitch-scores error:', error)
    return errorResponse('Failed to delete pitch score', 500)
  }
}
