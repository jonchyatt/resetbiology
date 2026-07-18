import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'
import { resolveReason } from '@/lib/reason'

/**
 * GET /api/user/reason
 * Session-scoped read of the member's "why" per REASON CONTRACT v1.1:
 * latest NEPQSubmission via quizSubmissionId, falling back to an exact
 * case-insensitive match on the SESSION user's verified email. Never trusts
 * a client-supplied id/email — the only identity here is the Auth0 session.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth0.getSession(request)
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [linked, byEmail] = await Promise.all([
      user.quizSubmissionId
        ? prisma.nEPQSubmission.findUnique({ where: { id: user.quizSubmissionId } })
        : Promise.resolve(null),
      // Email fallback ONLY for a session whose email is VERIFIED (Auth0 claim):
      // an unverified signup with someone else's address must never read that
      // person's funnel submission (REASON CONTRACT v1.1 / verifier F1).
      user.email && session?.user?.email_verified === true
        ? prisma.nEPQSubmission.findMany({
            where: { email: { equals: user.email, mode: 'insensitive' } },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),
    ])

    const submissions = linked ? [linked, ...byEmail.filter((s) => s.id !== linked.id)] : byEmail
    const result = resolveReason(user, submissions)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to resolve reason:', error)
    return NextResponse.json({ error: 'Failed to load reason' }, { status: 500 })
  }
}
