"use client"

import { ChevronDown } from "lucide-react"
import { MuscleWarning } from "./MuscleWarning"
import { QuizCTA } from "./QuizCTA"
import { WhenToStart } from "./WhenToStart"
import { TestimonialCarousel } from "./TestimonialCarousel"

export function HeroSection() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative"
         style={{
           backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
           backgroundSize: 'cover',
           backgroundPosition: 'center',
           backgroundAttachment: 'fixed'
         }}>

      {/* Hero Section */}
      <section className="min-h-screen flex items-center justify-center px-4 pt-20 pb-16">
        <div className="max-w-7xl mx-auto w-full space-y-12">

          {/* Three Column Layout: STOP | Quiz CTA | When to Start */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            {/* Left: STOP Warning - Sidebar */}
            <div className="lg:col-span-3">
              <MuscleWarning />
            </div>

            {/* Center: Main Quiz CTA with Logo - Takes most space */}
            <div className="lg:col-span-6">
              <QuizCTA />
            </div>

            {/* Right: When to Start - Sidebar */}
            <div className="lg:col-span-3">
              <WhenToStart />
            </div>
          </div>

          {/* Bottom: Testimonials Carousel */}
          <div className="max-w-5xl mx-auto">
            <TestimonialCarousel />
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce-subtle">
          <ChevronDown className="w-6 h-6 text-white" />
        </div>
      </section>
    </div>
  )
}
