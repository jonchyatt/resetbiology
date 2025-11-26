import { NextRequest, NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'
import { getUserFromSession } from '@/lib/getUserFromSession'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/assessment/my-results
 * Get the logged-in user's most recent assessment results
 * This allows returning users to see their quiz results after logging in
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth0.getSession()
    const user = await getUserFromSession(session)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Look up assessment by user's email
    const assessment = await prisma.assessmentResponse.findFirst({
      where: { email: user.email || '' },
      orderBy: { completedAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        score: true,
        scoreCategory: true,
        recommendedTier: true,
        completedAt: true,
        viewedResults: true,
        clickedCTA: true,
        bookedCall: true,
        convertedToCustomer: true,
        // Include questions for reference but not full details
        q15_current_situation: true,
        q16_desired_outcome: true,
        q17_biggest_obstacle: true,
        q18_ideal_solution: true
      }
    })

    if (!assessment) {
      return NextResponse.json({
        found: false,
        message: 'No assessment found for this account'
      })
    }

    // Mark results as viewed if not already
    if (!assessment.viewedResults) {
      await prisma.assessmentResponse.update({
        where: { id: assessment.id },
        data: { viewedResults: true }
      })
    }

    return NextResponse.json({
      found: true,
      assessment: {
        id: assessment.id,
        name: assessment.name,
        score: assessment.score,
        scoreCategory: assessment.scoreCategory,
        recommendedTier: assessment.recommendedTier,
        completedAt: assessment.completedAt,
        summary: {
          currentSituation: assessment.q15_current_situation,
          desiredOutcome: assessment.q16_desired_outcome,
          biggestObstacle: assessment.q17_biggest_obstacle,
          idealSolution: assessment.q18_ideal_solution
        }
      }
    })
  } catch (error: any) {
    console.error('Error fetching user assessment:', error)
    return NextResponse.json(
      { error: 'Failed to fetch assessment results', details: error.message },
      { status: 500 }
    )
  }
}
