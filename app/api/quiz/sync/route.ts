import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { prisma } from '@/lib/prisma'

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

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { auth0Sub: session.user.sub }
    })

    // If not found by auth0Sub, try by email
    if (!user && session.user.email) {
      user = await prisma.user.findUnique({
        where: { email: session.user.email }
      })

      if (user) {
        // Update auth0Sub if found by email
        user = await prisma.user.update({
          where: { id: user.id },
          data: { auth0Sub: session.user.sub }
        })
      }
    }

    // Create user if doesn't exist
    if (!user) {
      console.log('Creating new user from quiz data:', {
        auth0Sub: session.user.sub,
        email: session.user.email || quizResponses.email,
        displayName: quizResponses.preferredName
      })

      user = await prisma.user.create({
        data: {
          auth0Sub: session.user.sub,
          email: session.user.email || quizResponses.email,
          name: session.user.name,
          displayName: quizResponses.preferredName,
          image: session.user.picture,
          quizResponses: quizResponses,
          onboardingComplete: true
        }
      })
    } else {
      // Update existing user with quiz data
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          displayName: quizResponses.preferredName || user.displayName,
          quizResponses: quizResponses,
          onboardingComplete: true
        }
      })
    }

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
