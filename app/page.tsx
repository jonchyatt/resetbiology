import { HeroSection } from "@/components/Hero/HeroSection"
import { ProblemSolution } from "@/components/Hero/ProblemSolution"
import { MissionSection } from "@/components/Hero/MissionSection"
import { SolutionSection } from "@/components/Hero/SolutionSection"
import { ComparisonSection } from "@/components/Hero/ComparisonSection"
import { PortalTeaser } from "@/components/Hero/PortalTeaser"
import { ReferralSection } from "@/components/Hero/ReferralSection"
import { FAQSection } from "@/components/Hero/FAQSection"
import { auth0 } from "@/lib/auth0"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"

export default async function Home() {
  // Check if user is logged in
  const session = await auth0.getSession()

  if (session?.user) {
    // User is authenticated - check if they exist in our database
    const userEmail = (session.user.email || '').toLowerCase()
    const auth0Sub = session.user.sub

    if (userEmail || auth0Sub) {
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: userEmail },
            { auth0Sub: auth0Sub }
          ]
        }
      })

      // If user exists in database, redirect to portal (they're not a new user)
      if (existingUser) {
        redirect('/portal')
      }
    }
  }

  // Show hero page for non-logged-in users or new users
  return (
    <main>
      <HeroSection />
      <ProblemSolution />
      <MissionSection />
      <SolutionSection />
      <ComparisonSection />
      <PortalTeaser />
      <ReferralSection />
      <FAQSection />
    </main>
  )
}
