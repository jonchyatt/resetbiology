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
      <div className="bg-gradient-to-r from-teal-700 to-emerald-700 border-b border-teal-400/50 py-4 px-4 text-center shadow-lg">
        <p className="text-white text-base font-semibold">
          🎁 <strong className="text-yellow-300">FREE for 6 Months</strong> — Thanks to a generous grant from the{' '}
          <span className="text-yellow-200 font-bold">Satori Living Foundation</span>,
          register today and get full access — completely free.{' '}
          <Link href="/auth/login" className="underline text-yellow-300 hover:text-white font-bold ml-1">
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
