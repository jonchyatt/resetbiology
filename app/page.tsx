import { HeroSection } from "@/components/Hero/HeroSection"
import { ProblemSolution } from "@/components/Hero/ProblemSolution"
import { MissionSection } from "@/components/Hero/MissionSection"

import { PortalTeaser } from "@/components/Hero/PortalTeaser"
import { ReferralSection } from "@/components/Hero/ReferralSection"
import { FAQSection } from "@/components/Hero/FAQSection"
import { auth0 } from "@/lib/auth0"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"

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
      {/* Satori Living Foundation Grant Announcement */}
      <div className="bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border-b border-amber-400/30 py-3 px-4 text-center">
        <p className="text-amber-200 text-sm font-medium">
          🎁 <strong>Free Access Available</strong> — Thanks to a generous grant from the{' '}
          <span className="text-amber-300 font-semibold">Satori Living Foundation</span>,
          register today and get 6 months of full access — completely free.{' '}
          <Link href="/auth/login" className="underline text-amber-300 hover:text-amber-200">
            Register now →
          </Link>
        </p>
      </div>

      <HeroSection />
      <ProblemSolution />
      <MissionSection />

      <PortalTeaser />
      <ReferralSection />
      <FAQSection />
    </main>
  )
}
