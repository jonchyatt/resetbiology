import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Get client IP for location tracking
    const forwarded = req.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0] : req.headers.get('x-real-ip') || 'unknown'

    // Get UTM parameters from headers or body
    const utmSource = body.utmSource || req.headers.get('utm_source') || null
    const utmMedium = body.utmMedium || req.headers.get('utm_medium') || null
    const utmCampaign = body.utmCampaign || req.headers.get('utm_campaign') || null
    const referrer = req.headers.get('referer') || null

    // Check if user exists, if not create them
    let user = await prisma.user.findFirst({
      where: { email: body.email }
    })

    if (!user) {
      // Create new user from assessment data
      user = await prisma.user.create({
        data: {
          email: body.email,
          name: body.name,
          // Note: auth0Sub will be added when they actually log in via Auth0
          // For now they have an account but need to complete Auth0 login
        }
      })
    }

    // Create assessment response
    const assessment = await prisma.assessmentResponse.create({
      data: {
        // Contact info
        name: body.name,
        email: body.email,
        phone: body.phone || null,
        location: ip,

        // Quiz responses
        q5_protein_tracking: body.q5_protein_tracking,
        q6_stem_cell_support: body.q6_stem_cell_support,
        q7_unified_tracking: body.q7_unified_tracking,
        q8_breathwork: body.q8_breathwork,
        q9_sleep_tracking: body.q9_sleep_tracking,
        q10_detox_protocols: body.q10_detox_protocols,
        q11_journaling: body.q11_journaling,
        q12_workout_program: body.q12_workout_program,
        q13_accountability: body.q13_accountability,
        q14_peptide_knowledge: body.q14_peptide_knowledge,
        q15_current_situation: body.q15_current_situation,
        q16_desired_outcome: body.q16_desired_outcome,
        q17_biggest_obstacle: body.q17_biggest_obstacle,
        q18_ideal_solution: body.q18_ideal_solution,
        q19_additional_info: body.q19_additional_info || null,

        // Calculated fields
        score: body.score,
        scoreCategory: body.scoreCategory,
        recommendedTier: body.recommendedTier,

        // Engagement
        timeToComplete: body.timeToComplete || null,

        // UTM tracking
        utmSource,
        utmMedium,
        utmCampaign,
        referrer,

        // Variant tracking for A/B testing
        variant: 'funnel-v1'
      }
    })

    // TODO: Send confirmation email with results
    // TODO: Add to CRM/email list
    // TODO: Trigger notifications for high-value leads

    return NextResponse.json({
      success: true,
      assessmentId: assessment.id,
      userId: user.id,
      userCreated: !user, // True if we just created the user
      message: !user ? 'Account created! Check your email for portal access.' : 'Assessment saved successfully.'
    })
  } catch (error) {
    console.error('Assessment submission error:', error)
    return NextResponse.json(
      { error: 'Failed to save assessment' },
      { status: 500 }
    )
  }
}

// Get assessment results by ID
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const email = searchParams.get('email')

    if (!id && !email) {
      return NextResponse.json(
        { error: 'Assessment ID or email required' },
        { status: 400 }
      )
    }

    let assessment
    if (id) {
      assessment = await prisma.assessmentResponse.findUnique({
        where: { id }
      })
    } else if (email) {
      assessment = await prisma.assessmentResponse.findFirst({
        where: { email },
        orderBy: { completedAt: 'desc' }
      })
    }

    if (!assessment) {
      return NextResponse.json(
        { error: 'Assessment not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(assessment)
  } catch (error) {
    console.error('Assessment retrieval error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve assessment' },
      { status: 500 }
    )
  }
}
