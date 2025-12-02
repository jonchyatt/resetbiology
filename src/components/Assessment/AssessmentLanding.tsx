"use client"

import { useState, useEffect } from "react"
import { ChevronDown, CheckCircle2, TrendingUp, Target, Zap } from "lucide-react"
import Image from "next/image"
import { defaultAssessmentConfig } from "@/config/assessmentConfig"

interface AssessmentLandingProps {
  onStartQuiz: () => void
}

export function AssessmentLanding({ onStartQuiz }: AssessmentLandingProps) {
  const [landingCopy, setLandingCopy] = useState(defaultAssessmentConfig.landing)

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch('/api/assessment/config', { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          if (data?.landing) {
            setLandingCopy(data.landing)
          }
        }
      } catch (error) {
        console.error('Failed to load assessment landing config', error)
      }
    }
    loadConfig()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative"
         style={{
           backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
           backgroundSize: 'cover',
           backgroundPosition: 'center',
           backgroundAttachment: 'fixed'
         }}>

      {/* Main Content */}
      <section className="min-h-screen flex items-center justify-center px-4 pt-32 pb-16">
        <div className="max-w-5xl mx-auto w-full space-y-12">

          {/* Hook Section */}
          <div className="text-center space-y-6">
            {/* Frustration Hook */}
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-black leading-tight">
              <span className="block bg-gradient-to-r from-gray-100 via-white to-gray-100 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                {landingCopy.headline}
              </span>
              <span className="block mt-3 bg-gradient-to-r from-[#3FBFB5] via-[#5dd9cc] to-[#72C247] bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(63,191,181,0.5)]">
                {landingCopy.subheadline}
              </span>
            </h1>

            {/* Subheading */}
            <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto font-semibold">
              {landingCopy.supportingPoints[0] || 'Answer 15 questions to discover the 3 cellular optimization gaps keeping you stuck and what to do about them.'}
            </p>
          </div>

          {/* Logo Showcase */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary-400 to-secondary-400 blur-3xl opacity-30 animate-pulse"></div>
              <div className="relative bg-white rounded-3xl p-6 shadow-2xl">
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

          {/* Value Proposition - 3 Things We Measure */}
          <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-xl rounded-3xl p-8 md:p-10 border border-white/10">
            <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-8">
              Answer these 15 questions so we can measure and optimize:
            </h2>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Item 1 */}
              <div className="bg-gradient-to-br from-primary-500/10 to-primary-600/5 rounded-2xl p-6 border border-primary-500/20">
                <div className="w-14 h-14 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center mb-4">
                  <Zap className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  🧬 Your Cellular Fat-Burning Environment
                </h3>
                <p className="text-gray-300">
                  Peptide optimization, stem cell health, and metabolic activation protocols
                </p>
              </div>

              {/* Item 2 */}
              <div className="bg-gradient-to-br from-secondary-500/10 to-secondary-600/5 rounded-2xl p-6 border border-secondary-500/20">
                <div className="w-14 h-14 bg-gradient-to-br from-secondary-400 to-secondary-600 rounded-xl flex items-center justify-center mb-4">
                  <Target className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  📊 Your Precision Tracking Systems
                </h3>
                <p className="text-gray-300">
                  Nutrition, workouts, peptide protocols, and recovery monitoring
                </p>
              </div>

              {/* Item 3 */}
              <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-2xl p-6 border border-blue-500/20">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center mb-4">
                  <TrendingUp className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  🎯 Your Comprehensive Support Stack
                </h3>
                <p className="text-gray-300">
                  Breathwork, journaling, accountability systems, and stress management
                </p>
              </div>
            </div>

            <div className="mt-8 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
              <p className="text-yellow-200 text-center text-lg font-semibold">
                ⚠️ Most people focus on #2 and ignore #1 and #3—which is why they plateau.
              </p>
            </div>
          </div>

          {/* Credibility Section */}
          <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-xl rounded-2xl p-8 border border-white/10">
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0">
                <div className="w-20 h-20 bg-gradient-to-br from-primary-400 to-secondary-400 rounded-full flex items-center justify-center text-3xl font-bold text-white">
                  RB
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-white">
                  Created by Reset Biology's Cellular Health Optimization Team
                </h3>
                <div className="space-y-2 text-gray-300">
                  <p className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary-400 flex-shrink-0 mt-0.5" />
                    <span>Clinical peptide studies showing 15-25% body fat reduction in 12 weeks</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary-400 flex-shrink-0 mt-0.5" />
                    <span>Stem cell mobilization protocols from StemRegen research</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary-400 flex-shrink-0 mt-0.5" />
                    <span>Breathwork studies demonstrating 30% improvement in metabolic flexibility</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary-400 flex-shrink-0 mt-0.5" />
                    <span>1,000+ client transformations using the Reset Biology system</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <div className="text-center space-y-4">
            <button
              onClick={onStartQuiz}
              className="group relative inline-block"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[#3FBFB5] to-[#72C247] rounded-2xl blur-xl group-hover:blur-2xl opacity-50 group-hover:opacity-75 transition-all duration-500"></div>
              <div className="relative bg-gradient-to-r from-[#3FBFB5] to-[#72C247] rounded-2xl px-12 py-6 shadow-2xl group-hover:shadow-[0_0_60px_rgba(63,191,181,0.8)] transition-all duration-500 transform group-hover:scale-105">
                <span className="text-2xl md:text-3xl font-black text-white">
                  Start Your Free Assessment
                </span>
              </div>
            </button>

            <div className="flex flex-wrap items-center justify-center gap-6 text-gray-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <span>Only 3 minutes to complete</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <span>Completely free, no credit card</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <span>Get immediate recommendations</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <span>Discover your Cellular Optimization Score</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-6 h-6 text-white/50" />
        </div>
      </section>
    </div>
  )
}