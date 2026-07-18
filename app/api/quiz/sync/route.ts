import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'
import { resolveUserFromSession } from '@/lib/getUserFromSession'

/**
 * POST: Sync quiz data from localStorage to user profile after Auth0 login
 *
 * This endpoint is called from the portal page after successful login
 * to transfer quiz responses from localStorage into the user's database record.
 */
export async function POST(request: Request) {
  try {
    const session = await auth0.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { quizResponses } = body

    if (!quizResponses) {
      return NextResponse.json({
        error: 'Quiz responses required'
      }, { status: 400 })
    }

    // Route the sub<->email resolution through the guarded resolver (same
    // contract as getUserFromSession.ts: an email-fallback reattach only
    // fires when Auth0 reports the session's email as verified). Preserve
    // the original quizResponses.email fallback for the rare case where the
    // Auth0 session itself has no email claim.
    const effectiveSession = session.user.email
      ? session
      : { ...session, user: { ...session.user, email: quizResponses?.email } }

    const resolution = await resolveUserFromSession(effectiveSession as typeof session)

    if (resolution?.status === 'unverified_email') {
      return NextResponse.json({ error: 'verify_email' }, { status: 403 })
    }

    if (!resolution) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // resolveUserFromSession already found-or-created the row (sub match,
    // verified-email reattach, or fresh create); apply the quiz-specific
    // fields on top, same as the original find-or-create/update branches.
    const user = await prisma.user.update({
      where: { id: resolution.user.id },
      data: {
        displayName: quizResponses.preferredName || resolution.user.displayName,
        image: resolution.user.image || session.user.picture || null,
        quizResponses: quizResponses,
        onboardingComplete: true
      }
    })

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        displayName: user.displayName,
        onboardingComplete: user.onboardingComplete
      }
    })

  } catch (error) {
    console.error('POST /api/quiz/sync error:', error)
    return NextResponse.json({
      error: 'Failed to sync quiz data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
