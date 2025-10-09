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

          {/* Main content layout */}
          <div className="space-y-8">
            {/* Top: Muscle Warning Sidebar */}
            <div className="flex justify-start">
              <div className="w-full max-w-sm">
                <MuscleWarning />
              </div>
            </div>

            {/* Center: Quiz CTA with smaller WhenToStart beside it */}
            <div className="flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-8">
              {/* Main Quiz CTA - Centered */}
              <div className="w-full lg:w-auto lg:flex-shrink-0">
                <QuizCTA />
              </div>

              {/* Smaller WhenToStart beside it */}
              <div className="w-full lg:w-80 lg:flex-shrink-0">
                <WhenToStart />
              </div>
            </div>

            {/* Bottom: Testimonials Carousel */}
            <div className="max-w-4xl mx-auto">
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