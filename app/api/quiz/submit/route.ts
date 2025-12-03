import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * NEPQ Quiz Submission API
 *
 * Saves quiz responses to database and calculates personalization scores
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const {
      // Contact
      name,
      email,
      phone,
      // Audit
      audit_practices,
      auditScore,
      auditLevel,
      // Journey
      journey_stage,
      desired_outcome,
      biggest_obstacle,
      // Vision
      success_vision,
      success_feeling,
      // Amplification
      why_change,
      readiness_scale,
      why_not_lower,
      positive_outcomes,
      why_important,
      // Energy Spin
      completedEnergySpin,
      energySpinDuration,
      // Close
      selectedOffer,
      otherOfferRequest,
      // Tracking
      startedAt,
      utmSource,
      utmMedium,
      utmCampaign,
      referrer,
    } = body

    // Validate required fields
    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      )
    }

    // Calculate time to complete
    const startTime = startedAt ? new Date(startedAt).getTime() : Date.now() - 300000
    const timeToComplete = Math.round((Date.now() - startTime) / 1000)

    // Get IP and user agent from headers
    const forwardedFor = req.headers.get("x-forwarded-for")
    const ipAddress = forwardedFor?.split(",")[0]?.trim() || "unknown"
    const userAgent = req.headers.get("user-agent") || undefined

    // Create submission
    const submission = await prisma.nEPQSubmission.create({
      data: {
        // Section 1: Contact
        name,
        email,
        phone: phone || null,

        // Section 2: Audit
        bestPractices: audit_practices || [],
        auditScore: auditScore || 0,
        auditLevel: auditLevel || "beginner",

        // Section 3: Journey
        journeyStage: journey_stage || "starting",
        desiredOutcome: desired_outcome || "sustainable_system",
        biggestObstacle: biggest_obstacle || "knowledge_gap",

        // Section 4: Vision
        successVision: success_vision || "",
        successFeeling: success_feeling || "",

        // Section 5: Amplification
        whyChange: why_change || "",
        readinessScore: readiness_scale || 5,
        whyNotLower: why_not_lower || "",
        positiveOutcomes: positive_outcomes || "",
        whyImportant: why_important || "",

        // Section 6: Energy Spin
        completedEnergySpin: completedEnergySpin || false,
        energySpinDuration: energySpinDuration || null,

        // Section 7: Close
        viewedOffers: true,
        selectedOffer: selectedOffer || null,
        otherOfferRequest: otherOfferRequest || null,

        // Analytics
        completedAt: new Date(),
        timeToComplete,
        sectionsCompleted: 7,
        lastActiveSection: "close",

        // UTM Tracking
        utmSource: utmSource || null,
        utmMedium: utmMedium || null,
        utmCampaign: utmCampaign || null,
        referrer: referrer || null,
        userAgent,
        ipAddress,

        variant: "nepq-v1",
      },
    })

    // Return success with submission ID
    return NextResponse.json({
      success: true,
      submissionId: submission.id,
      selectedOffer,
      recommendedAction: getRecommendedAction(selectedOffer),
    })
  } catch (error) {
    console.error("Quiz submission error:", error)
    return NextResponse.json(
      { error: "Failed to save quiz submission" },
      { status: 500 }
    )
  }
}

/**
 * Get recommended next action based on selected offer
 */
function getRecommendedAction(offerId: string | null): {
  action: string
  url: string
  message: string
} {
  switch (offerId) {
    case "diy":
      return {
        action: "start_trial",
        url: "/auth/login?returnTo=/portal?trial=diy",
        message: "Start your $1 DIY trial",
      }
    case "guided":
      return {
        action: "start_trial",
        url: "/auth/login?returnTo=/portal?trial=guided",
        message: "Start your $1 Guided trial",
      }
    case "done-with-you":
      return {
        action: "book_call",
        url: "https://calendly.com/resetbiology/done-with-you",
        message: "Book your planning session",
      }
    case "concierge":
      return {
        action: "book_call",
        url: "https://calendly.com/resetbiology/concierge",
        message: "Book your concierge call",
      }
    case "other":
      return {
        action: "contact",
        url: "/contact?source=quiz",
        message: "We'll be in touch to discuss your needs",
      }
    default:
      return {
        action: "portal",
        url: "/portal",
        message: "Explore the portal",
      }
  }
}

/**
 * GET endpoint to retrieve quiz submission by email (for returning users)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const email = searchParams.get("email")

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    const submission = await prisma.nEPQSubmission.findFirst({
      where: { email },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        auditScore: true,
        auditLevel: true,
        journeyStage: true,
        desiredOutcome: true,
        readinessScore: true,
        selectedOffer: true,
        completedAt: true,
        createdAt: true,
      },
    })

    if (!submission) {
      return NextResponse.json(
        { error: "No submission found for this email" },
        { status: 404 }
      )
    }

    return NextResponse.json(submission)
  } catch (error) {
    console.error("Quiz lookup error:", error)
    return NextResponse.json(
      { error: "Failed to retrieve quiz submission" },
      { status: 500 }
    )
  }
}
