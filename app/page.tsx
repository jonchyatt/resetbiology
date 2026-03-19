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
      <div className="relative overflow-hidden bg-gradient-to-r from-gray-900/95 via-primary-900/90 to-gray-900/95 backdrop-blur-md border-b border-primary-400/30 py-4 px-4 shadow-[0_4px_30px_rgba(63,191,181,0.15)]">
        {/* Animated glow accent */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary-400/10 to-transparent animate-[shimmer_3s_ease-in-out_infinite]" />
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <p className="text-base md:text-lg font-medium text-gray-100 leading-relaxed">
            <span className="inline-block mr-2 text-xl align-middle">🎁</span>
            <strong className="text-transparent bg-clip-text bg-gradient-to-r from-primary-300 to-secondary-300 text-lg md:text-xl tracking-wide">
              FREE for 6 Months
            </strong>
            <span className="mx-2 text-primary-400/60">|</span>
            Thanks to a generous grant from the{' '}
            <span className="text-primary-200 font-semibold">Satori Living Foundation</span>,
            register today for full access — completely free.{' '}
            <Link
              href="/auth/login"
              className="inline-flex items-center ml-2 px-4 py-1.5 bg-gradient-to-r from-primary-500/30 to-secondary-500/30 hover:from-primary-500/50 hover:to-secondary-500/50 border border-primary-400/40 hover:border-primary-300/60 rounded-lg text-white font-bold text-sm transition-all duration-300 hover:shadow-[0_0_20px_rgba(63,191,181,0.3)] hover:scale-105 backdrop-blur-sm"
            >
              Register now →
            </Link>
          </p>
        </div>
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
