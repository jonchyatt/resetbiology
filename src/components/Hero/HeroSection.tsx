"use client"


import { MuscleWarning } from "./MuscleWarning"
import { QuizCTA } from "./QuizCTA"
import { WhenToStart } from "./WhenToStart"
import { TestimonialCarousel } from "./TestimonialCarousel"
import { ValuePropSection } from "./ValuePropSection"

export function HeroSection() {
  return (
    <div className="relative bg-slate-950">

      {/* Hero Section */}
      <section className="flex items-center justify-center px-4 py-12 sm:py-16">
        <div className="mx-auto w-full max-w-5xl space-y-10">

          {/* Vertical Stack Layout: Quiz CTA | STOP | When to Start */}
          <div className="mx-auto flex max-w-4xl flex-col items-center gap-8">
            {/* 1. Main Quiz CTA - Takes center stage */}
            <div className="w-full">
              <QuizCTA />
            </div>

            {/* 2. Value Proposition - From Get Started Page */}
            <div className="w-full">
              <ValuePropSection />
            </div>

            {/* 3. STOP Warning - Underneath */}
            <div className="w-full max-w-2xl">
              <MuscleWarning />
            </div>

            {/* 3. When to Start - Bottom */}
            <div className="w-full max-w-2xl">
              <WhenToStart />
            </div>
          </div>

          {/* Bottom: Testimonials Carousel */}
          <div className="mx-auto max-w-5xl">
            <TestimonialCarousel />
          </div>
        </div>


      </section>
    </div>
  )
}
