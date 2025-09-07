import { getServerSession } from "next-auth/next"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Authentication required. Please sign in with Google." },
        { status: 401 }
      )
    }

    // Calculate trial end date (7 days from now)
    const trialEndDate = new Date()
    trialEndDate.setDate(trialEndDate.getDate() + 7)

    // Update or create user in database with trial permissions
    const user = await prisma.user.upsert({
      where: { email: session.user.email },
      update: {
        accessLevel: "trial",
        subscriptionStatus: "trial",
        trialStartDate: new Date(),
        trialEndDate: trialEndDate,
      },
      create: {
        email: session.user.email,
        name: session.user.name || "",
        image: session.user.image,
        accessLevel: "trial",
        subscriptionStatus: "trial",
        trialStartDate: new Date(),
        trialEndDate: trialEndDate,
      }
    })

    return NextResponse.json({
      success: true,
      message: "🎉 7-day trial activated!\n\nYou now have access to:\n• Mental Mastery audio modules\n• Basic peptide tracking features\n• Workout and nutrition planning\n• Educational content\n• Gamification rewards\n\nEnjoy exploring the Reset Biology platform!",
      user: {
        accessLevel: user.accessLevel,
        subscriptionStatus: user.subscriptionStatus,
        trialEndDate: user.trialEndDate
      }
    })

  } catch (error) {
    console.error("Trial activation error:", error)
    return NextResponse.json(
      { error: "Failed to activate trial. Please try again." },
      { status: 500 }
    )
  }
}