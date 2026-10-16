import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'
import { isValidDayKey } from '@/lib/localDay'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MODES = ['identify', 'nback', 'maze'] as const

/**
 * POST /api/ear-training/sessions
 * Save one finished ear-training session (same auth as /api/nback/sessions).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const mode = body?.mode
    const total = Number(body?.totalQuestions)
    const correct = Number(body?.correct)
    if (!MODES.includes(mode) || !Number.isFinite(total) || total < 1 || !Number.isFinite(correct) || correct < 0 || correct > total) {
      return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 400 })
    }

    const saved = await prisma.earTrainingSession.create({
      data: {
        userId: user.id,
        mode,
        totalQuestions: Math.round(total),
        correct: Math.round(correct),
        accuracy: Math.round((correct / total) * 1000) / 10,
        durationSeconds: Math.max(0, Math.round(Number(body?.durationSeconds) || 0)),
        localDate: isValidDayKey(body?.localDate) ? body.localDate : null,
        localTime: typeof body?.localTime === 'string' ? body.localTime.slice(0, 8) : null,
      },
    })

    return NextResponse.json({ success: true, session: saved })
  } catch (error) {
    console.error('POST /api/ear-training/sessions error:', error)
    return NextResponse.json({ success: false, error: 'Failed to save session' }, { status: 500 })
  }
}
