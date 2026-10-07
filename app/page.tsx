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
    <main className="rb-page">
      {/* Satori Living Foundation Grant Announcement */}
      <div className="border-b border-slate-800 bg-slate-900 px-4 py-3">
        <div className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-2 text-center sm:flex-row sm:gap-3">
          <p className="text-sm text-slate-300">Free habit tracking, journaling, and hypnosis tools.</p>
          <Link href="/get-started" className="text-sm font-semibold text-primary-300 hover:text-primary-200">
            Get started →
          </Link>
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
