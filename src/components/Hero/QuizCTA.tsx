"use client"

import Link from "next/link"
import Image from "next/image"

export function QuizCTA() {
  return (
    <Link href="/quiz">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#2a9d8f] via-[#3FBFB5] to-[#72C247] p-1 shadow-2xl hover:shadow-[0_0_60px_rgba(63,191,181,0.6)] transition-all duration-500 group cursor-pointer">
        {/* Animated gradient border effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#72C247] via-[#3FBFB5] to-[#2a9d8f] opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"></div>

        {/* Main content box with glassmorphism */}
        <div className="relative bg-gradient-to-br from-gray-900/80 to-gray-800/80 backdrop-blur-xl rounded-3xl p-6 md:p-8 border border-white/10">
          {/* Decorative sparkle icons */}
          <div className="absolute top-6 right-6 text-primary-300/30 animate-pulse">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41L12 0Z" />
            </svg>
          </div>
          <div className="absolute bottom-6 left-6 text-secondary-300/30 animate-pulse delay-75">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41L12 0Z" />
            </svg>
          </div>

          <div className="space-y-6 text-center">
            {/* Main heading with enhanced gradient */}
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-black leading-tight">
              <span className="block bg-gradient-to-r from-gray-100 via-white to-gray-100 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                Is it too crazy to upgrade
              </span>
              <span className="block mt-2 bg-gradient-to-r from-[#3FBFB5] via-[#5dd9cc] to-[#72C247] bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(63,191,181,0.5)]">
                Your GLP-1 protocol?
              </span>
            </h2>

            {/* Logo - centered */}
            <div className="flex justify-center py-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary-400 to-secondary-400 blur-2xl opacity-30 animate-pulse"></div>
                <div className="relative bg-white rounded-2xl p-4 shadow-2xl transform group-hover:scale-105 transition-transform duration-500">
                  <Image
                    src="/logo1.png"
                    alt="Reset Biology Logo"
                    width={120}
                    height={120}
                    className="w-24 h-24 md:w-28 md:h-28 lg:w-32 lg:h-32 object-contain"
                  />
                </div>
              </div>
            </div>

            {/* Subheading with arrow */}
            <p className="text-lg md:text-xl font-bold text-white flex items-center justify-center gap-3">
              Take our readiness quiz now
              <svg className="w-5 h-5 md:w-6 md:h-6 text-primary-300 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </p>

            {/* CTA Button */}
            <div className="pt-3">
              <div className="inline-block bg-gradient-to-r from-[#3FBFB5] to-[#72C247] rounded-full p-1 shadow-2xl group-hover:shadow-[0_0_40px_rgba(63,191,181,0.8)] transition-all duration-500">
                <div className="bg-gray-900 rounded-full px-8 py-3 group-hover:bg-transparent transition-colors duration-500">
                  <span className="text-xl md:text-2xl font-black text-white group-hover:text-gray-900 transition-colors">
                    Start Your Quiz
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
