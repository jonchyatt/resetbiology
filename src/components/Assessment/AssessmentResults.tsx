"use client"

import { useState } from "react"
import { TrendingUp, Zap, Target, AlertTriangle, CheckCircle2, Calendar, BookOpen, Phone } from "lucide-react"
import Link from "next/link"

interface ResultsData {
  name: string
  score: number
  scoreCategory: string
  recommendedTier: string
  q15_current_situation: string
  q16_desired_outcome: string
  q17_biggest_obstacle: string
}

interface AssessmentResultsProps {
  results: ResultsData
  onBookCall?: () => void
}

export function AssessmentResults({ results, onBookCall }: AssessmentResultsProps) {
  const { name, score, scoreCategory, recommendedTier } = results

  // Score category copy
  const scoreCopy = {
    master: {
      title: "Cellular Optimization Master",
      description: "You're doing better than 95% of people!",
      color: "from-green-500 to-emerald-600",
      bgColor: "from-green-500/20 to-emerald-600/10"
    },
    strong: {
      title: "Strong Foundation, Missing Key Pieces",
      description: "You're on the right track but leaving results on the table",
      color: "from-yellow-500 to-orange-500",
      bgColor: "from-yellow-500/20 to-orange-600/10"
    },
    gaps: {
      title: "Significant Optimization Gaps Detected",
      description: "You're working hard but not working smart—yet",
      color: "from-orange-500 to-red-500",
      bgColor: "from-orange-500/20 to-red-600/10"
    },
    fresh: {
      title: "Starting Fresh - Huge Opportunity",
      description: "Perfect timing to build it right from day one",
      color: "from-blue-500 to-purple-600",
      bgColor: "from-blue-500/20 to-purple-600/10"
    }
  }

  const currentScore = scoreCopy[scoreCategory as keyof typeof scoreCopy]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 px-4 py-12">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl md:text-5xl font-black text-white">
            Your Results Are In, {name}!
          </h1>
          <p className="text-xl text-gray-300">
            Here's your personalized Cellular Weight Loss Readiness Assessment
          </p>
        </div>

        {/* Score Card */}
        <div className={`bg-gradient-to-br ${currentScore.bgColor} backdrop-blur-xl rounded-3xl p-8 md:p-12 border-2 border-white/20 shadow-2xl`}>
          <div className="text-center space-y-6">
            {/* Score Thermometer */}
            <div className="flex justify-center">
              <div className="relative">
                <svg className="w-48 h-48" viewBox="0 0 200 200">
                  {/* Background Circle */}
                  <circle
                    cx="100"
                    cy="100"
                    r="80"
                    stroke="#374151"
                    strokeWidth="20"
                    fill="none"
                  />
                  {/* Progress Circle */}
                  <circle
                    cx="100"
                    cy="100"
                    r="80"
                    stroke="url(#scoreGradient)"
                    strokeWidth="20"
                    fill="none"
                    strokeDasharray={`${(score / 100) * 502} 502`}
                    strokeLinecap="round"
                    transform="rotate(-90 100 100)"
                    className="transition-all duration-1000"
                  />
                  <defs>
                    <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" className="text-primary-500" stopColor="currentColor" />
                      <stop offset="100%" className="text-secondary-500" stopColor="currentColor" />
                    </linearGradient>
                  </defs>
                  {/* Score Text */}
                  <text
                    x="100"
                    y="95"
                    textAnchor="middle"
                    className="text-5xl font-black fill-white"
                  >
                    {score}
                  </text>
                  <text
                    x="100"
                    y="120"
                    textAnchor="middle"
                    className="text-xl fill-gray-300"
                  >
                    / 100
                  </text>
                </svg>
              </div>
            </div>

            <div>
              <h2 className="text-3xl md:text-4xl font-black text-white mb-2">
                {currentScore.title}
              </h2>
              <p className="text-xl text-gray-200">
                {currentScore.description}
              </p>
            </div>
          </div>
        </div>

        {/* Big Reveal */}
        <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-xl rounded-3xl p-8 md:p-10 border border-white/10">
          <h3 className="text-2xl md:text-3xl font-bold text-white mb-6 flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-yellow-400" />
            The Big Reveal
          </h3>

          {scoreCategory === "gaps" || scoreCategory === "fresh" ? (
            <div className="space-y-4 text-gray-300 text-lg leading-relaxed">
              <p>
                {name}, you're doing better than most people (tracking some things, working out regularly),
                but you're missing the <span className="text-primary-400 font-bold">3 CRITICAL cellular optimization systems</span> that
                separate people who plateau from people who transform permanently.
              </p>
              <p>
                The good news? Once you understand these gaps, they're surprisingly straightforward to fix.
              </p>
            </div>
          ) : scoreCategory === "strong" ? (
            <div className="space-y-4 text-gray-300 text-lg leading-relaxed">
              <p>
                {name}, you have a strong foundation—you're tracking, you're consistent, you understand the basics.
                But you're leaving <span className="text-yellow-400 font-bold">30-40% of potential results</span> on the table.
              </p>
              <p>
                A few strategic additions to your current system could unlock the results you've been working for.
              </p>
            </div>
          ) : (
            <div className="space-y-4 text-gray-300 text-lg leading-relaxed">
              <p>
                {name}, you're doing almost everything right. You're in the top 5% of people we assess.
                The question isn't "what's wrong"—it's "how can we optimize the final 10-20% for breakthrough results?"
              </p>
            </div>
          )}
        </div>

        {/* Three Key Insights */}
        <div className="space-y-6">
          <h3 className="text-2xl md:text-3xl font-bold text-white text-center mb-8">
            Your 3 Key Optimization Gaps
          </h3>

          {/* Insight 1: Cellular */}
          <div className="bg-gradient-to-br from-primary-500/10 to-primary-600/5 backdrop-blur-xl rounded-2xl p-6 md:p-8 border border-primary-500/20">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div className="space-y-3">
                <h4 className="text-xl md:text-2xl font-bold text-white">
                  1. 🧬 CELLULAR OPTIMIZATION GAP DETECTED
                </h4>
                <p className="text-gray-300">
                  You answered "No" to questions about stem cell protocols and peptide support.
                </p>
                <div className="bg-gray-900/50 rounded-xl p-4 space-y-2">
                  <p className="text-white font-semibold">What this means:</p>
                  <p className="text-gray-300">
                    Your body is working against you at the cellular level. Without stem cell mobilization
                    and peptide signaling, your metabolism stays stuck no matter how hard you work out.
                  </p>
                </div>
                <div className="bg-primary-900/20 rounded-xl p-4 space-y-2">
                  <p className="text-white font-semibold">What to do:</p>
                  <p className="text-gray-300">
                    Explore peptide protocols like BPC-157 for recovery and CJC-1295/Ipamorelin for fat metabolism.
                    Consider StemRegen Release to support cellular regeneration.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Insight 2: Tracking */}
          <div className="bg-gradient-to-br from-secondary-500/10 to-secondary-600/5 backdrop-blur-xl rounded-2xl p-6 md:p-8 border border-secondary-500/20">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-secondary-400 to-secondary-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <Target className="w-6 h-6 text-white" />
              </div>
              <div className="space-y-3">
                <h4 className="text-xl md:text-2xl font-bold text-white">
                  2. 📊 TRACKING SYSTEM FRAGMENTATION
                </h4>
                <p className="text-gray-300">
                  You're tracking some things, but not in a unified system that shows the full picture.
                </p>
                <div className="bg-gray-900/50 rounded-xl p-4 space-y-2">
                  <p className="text-white font-semibold">What this means:</p>
                  <p className="text-gray-300">
                    You can't optimize what you can't measure holistically. Scattered tracking means you miss
                    the connections between nutrition, workouts, peptide timing, sleep, and stress.
                  </p>
                </div>
                <div className="bg-secondary-900/20 rounded-xl p-4 space-y-2">
                  <p className="text-white font-semibold">What to do:</p>
                  <p className="text-gray-300">
                    Switch to an integrated tracking platform where your peptide doses, workouts, nutrition,
                    and journal entries all connect to show your complete optimization picture.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Insight 3: Nervous System */}
          <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 backdrop-blur-xl rounded-2xl p-6 md:p-8 border border-blue-500/20">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div className="space-y-3">
                <h4 className="text-xl md:text-2xl font-bold text-white">
                  3. 🎯 MISSING NERVOUS SYSTEM REGULATION
                </h4>
                <p className="text-gray-300">
                  You're not using breathwork or consistent journaling to manage stress and metabolic flexibility.
                </p>
                <div className="bg-gray-900/50 rounded-xl p-4 space-y-2">
                  <p className="text-white font-semibold">What this means:</p>
                  <p className="text-gray-300">
                    Chronic stress keeps cortisol elevated, which blocks fat burning no matter how perfect your diet is.
                    Without nervous system regulation, you're fighting an uphill battle.
                  </p>
                </div>
                <div className="bg-blue-900/20 rounded-xl p-4 space-y-2">
                  <p className="text-white font-semibold">What to do:</p>
                  <p className="text-gray-300">
                    Implement daily breathwork (10 min) and stress journaling to activate your parasympathetic
                    "rest and digest" mode where fat burning happens.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Personalized Next Steps */}
        <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-xl rounded-3xl p-8 md:p-10 border border-white/10">
          <h3 className="text-2xl md:text-3xl font-bold text-white mb-6 text-center">
            Your Personalized Next Steps
          </h3>

          <div className="space-y-6">
            {/* Primary CTA */}
            <div className="bg-gradient-to-br from-primary-500/20 to-secondary-500/10 rounded-2xl p-6 border-2 border-primary-500/30">
              <div className="flex items-start gap-4 mb-4">
                <CheckCircle2 className="w-6 h-6 text-primary-400 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="text-xl font-bold text-white mb-2">
                    Step 1: Book Your Free Cellular Assessment Call (30 min)
                  </h4>
                  <p className="text-gray-300 mb-4">
                    We'll review your quiz answers and design your personal protocol
                  </p>
                  <button
                    onClick={onBookCall}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-primary-500 to-secondary-500 text-white px-8 py-4 rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-primary-500/50 transform hover:scale-105 transition-all"
                  >
                    <Calendar className="w-5 h-5" />
                    Schedule My Free Call
                  </button>
                </div>
              </div>
            </div>

            {/* Secondary Options */}
            <div className="grid md:grid-cols-2 gap-4">
              <Link href="/portal">
                <div className="bg-gray-700/30 hover:bg-gray-700/50 rounded-xl p-6 border border-gray-600 hover:border-primary-500/50 transition-all cursor-pointer">
                  <div className="flex items-start gap-3">
                    <TrendingUp className="w-6 h-6 text-secondary-400 flex-shrink-0 mt-1" />
                    <div>
                      <h4 className="text-lg font-bold text-white mb-2">
                        Step 2: Explore the Complete System
                      </h4>
                      <p className="text-gray-400 text-sm">
                        See how our peptide + tracking + support platform works
                      </p>
                    </div>
                  </div>
                </div>
              </Link>

              <div className="bg-gray-700/30 hover:bg-gray-700/50 rounded-xl p-6 border border-gray-600 hover:border-blue-500/50 transition-all cursor-pointer">
                <div className="flex items-start gap-3">
                  <BookOpen className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="text-lg font-bold text-white mb-2">
                      Download Free Guide
                    </h4>
                    <p className="text-gray-400 text-sm">
                      "7 Cellular Optimization Mistakes Keeping You Stuck"
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Social Proof / Contact */}
        <div className="text-center space-y-4">
          <p className="text-gray-400">
            Questions? Text us at <span className="text-primary-400 font-semibold">(555) 123-4567</span>
          </p>
          <div className="flex justify-center gap-6">
            <Link href="/portal" className="text-primary-400 hover:text-primary-300 transition-colors">
              View Full Platform
            </Link>
            <Link href="/store" className="text-primary-400 hover:text-primary-300 transition-colors">
              Browse Peptides
            </Link>
            <Link href="/" className="text-primary-400 hover:text-primary-300 transition-colors">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
