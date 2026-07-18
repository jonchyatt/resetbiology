import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/onboarding/complete
 * Session-scoped (AUTH SCOPING HIGH-1) — the only identity is the Auth0
 * session, never a client-supplied id. Idempotent: setting the already-true
 * flag again is a no-op write, safe to call from the grandfather auto-set
 * path and from an explicit "Done — take me to my day" click alike.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession(request)
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { onboardingComplete: true },
    })

    return NextResponse.json({ onboardingComplete: true })
  } catch (error) {
    console.error('Failed to complete onboarding:', error)
    return NextResponse.json({ error: 'Failed to complete onboarding' }, { status: 500 })
  }
}
