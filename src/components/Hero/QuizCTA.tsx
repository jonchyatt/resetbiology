"use client"

import Link from "next/link"
import { Sparkles, ArrowRight } from "lucide-react"

export function QuizCTA() {
  return (
    <div className="relative">
      {/* Glowing container */}
      <div className="relative">
        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-secondary-500 to-primary-500 rounded-2xl blur-xl opacity-50 animate-pulse"></div>

        {/* Main CTA Box */}
        <Link href="/quiz" className="block relative">
          <div className="relative bg-gradient-to-br from-secondary-600/20 to-primary-600/20 backdrop-blur-sm border-2 border-primary-400 rounded-2xl p-8 hover:border-primary-300 transition-all duration-500 hover:shadow-[0_0_50px_rgba(114,194,71,0.4)] group">
            {/* Sparkle decorations */}
            <Sparkles className="absolute top-4 right-4 w-6 h-6 text-primary-300 animate-pulse" />
            <Sparkles className="absolute bottom-4 left-4 w-5 h-5 text-secondary-300 animate-pulse delay-300" />

            {/* Main heading */}
            <div className="text-center space-y-4">
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold">
                <span className="bg-gradient-to-r from-secondary-300 to-primary-300 bg-clip-text text-transparent">
                  Is it too crazy to upgrade
                </span>
                <br />
                <span className="bg-gradient-to-r from-primary-300 to-secondary-300 bg-clip-text text-transparent">
                  Your GLP-1 protocol?
                </span>
              </h2>

              {/* Subtext */}
              <div className="flex items-center justify-center gap-2 mt-6">
                <p className="text-white text-lg md:text-xl font-medium">
                  Take our readiness quiz now
                </p>
                <ArrowRight className="w-5 h-5 text-primary-300 group-hover:translate-x-2 transition-transform" />
              </div>

              {/* Button effect */}
              <div className="mt-6">
                <span className="inline-block bg-gradient-to-r from-primary-500 to-secondary-500 text-white font-bold px-8 py-3 rounded-full hover:from-primary-400 hover:to-secondary-400 transition-all duration-300 shadow-[0_0_20px_rgba(114,194,71,0.3)] hover:shadow-[0_0_30px_rgba(114,194,71,0.5)]">
                  Start Your Quiz
                </span>
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Animated glow ring */}
      <div className="absolute inset-0 rounded-2xl animate-ping-slow">
        <div className="h-full w-full border-2 border-primary-400/30 rounded-2xl"></div>
      </div>
    </div>
  )
}