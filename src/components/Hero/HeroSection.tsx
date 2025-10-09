"use client"

import Link from "next/link"
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
      <section className="min-h-screen flex items-center justify-center px-4 pt-20">
        <div className="max-w-7xl mx-auto w-full">
          {/* Logo */}
          <div className="mb-12 text-center">
            <img
              src="/logo1.png"
              alt="Reset Biology - DNA Reset Science"
              className="h-24 md:h-32 lg:h-36 w-auto mx-auto rounded-2xl drop-shadow-2xl hover:drop-shadow-[0_0_40px_rgba(63,191,181,0.3)] transition-all duration-500 bg-white/5 backdrop-blur-sm p-4 border border-white/10"
            />
          </div>

          {/* Two-column layout */}
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
            {/* Left Column */}
            <div className="space-y-8">
              {/* Muscle Warning (smaller, with tooltip) */}
              <MuscleWarning />

              {/* When to Start graphic */}
              <WhenToStart />
            </div>

            {/* Right Column */}
            <div className="space-y-8">
              {/* Quiz CTA (prominent, glowing) */}
              <QuizCTA />

              {/* Testimonials Carousel */}
              <TestimonialCarousel />
            </div>
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