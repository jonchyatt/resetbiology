"use client"

import Link from "next/link"
import Image from "next/image"

export function QuizCTA() {
  return (
    <Link href="/get-started">
      <div className="text-center space-y-6 cursor-pointer group">
        {/* Main heading with enhanced gradient */}
        <h1 className="text-3xl md:text-5xl lg:text-6xl font-black leading-tight">
          <span className="block bg-gradient-to-r from-gray-100 via-white to-gray-100 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">
            Feeling frustrated with your body?
          </span>
          <span className="block mt-2 text-lg md:text-xl lg:text-2xl bg-gradient-to-r from-[#3FBFB5] via-[#5dd9cc] to-[#72C247] bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(63,191,181,0.5)]">
            (even though you're trying to do everything right?)
          </span>
        </h1>

        {/* Logo - centered */}
        <div className="flex justify-center py-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary-400 to-secondary-400 blur-2xl opacity-30 animate-pulse"></div>
            <div className="relative bg-white rounded-2xl p-4 shadow-2xl transform group-hover:scale-105 transition-transform duration-500">
              <Image
                src="/logo1.png"
                alt="Reset Biology Logo"
                width={150}
                height={150}
                className="w-32 h-32 md:w-40 md:h-40 object-contain"
              />
            </div>
          </div>
        </div>

        {/* Subheading with arrow */}
        <p className="text-xl md:text-2xl font-bold text-gray-300 flex items-center justify-center gap-3">
          Answer 15 questions to discover the 3 cellular optimization gaps keeping you stuck—and what to do about them.
          <svg className="w-6 h-6 text-primary-300 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </p>

        {/* CTA Button */}
        <div className="pt-6">
          <div className="inline-block bg-gradient-to-r from-[#3FBFB5] to-[#72C247] rounded-full p-1 shadow-2xl group-hover:shadow-[0_0_40px_rgba(63,191,181,0.8)] transition-all duration-500">
            <div className="bg-gray-900 rounded-full px-12 py-4 group-hover:bg-transparent transition-colors duration-500">
              <span className="text-2xl md:text-3xl font-black text-white group-hover:text-gray-900 transition-colors">
                Start Your Free Assessment
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
