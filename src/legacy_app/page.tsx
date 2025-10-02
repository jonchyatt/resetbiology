import { HeroSection } from "@/components/Hero/HeroSection"
import { ProblemSolution } from "@/components/Hero/ProblemSolution"
import { MissionSection } from "@/components/Hero/MissionSection"
import { SolutionSection } from "@/components/Hero/SolutionSection"
import { ComparisonSection } from "@/components/Hero/ComparisonSection"
import { PortalTeaser } from "@/components/Hero/PortalTeaser"
import { ReferralSection } from "@/components/Hero/ReferralSection"
import { FAQSection } from "@/components/Hero/FAQSection"

export default function Home() {
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
