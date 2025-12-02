"use client"

import { useState, useEffect } from "react"
import { TrendingUp, Zap, Target, AlertTriangle, CheckCircle2, Calendar, BookOpen, Phone, Gift, Star, Unlock } from "lucide-react"
import Link from "next/link"
import { defaultAssessmentConfig } from "@/config/assessmentConfig"

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
  const [showExitModal, setShowExitModal] = useState(false)
  const [offerConfig, setOfferConfig] = useState(defaultAssessmentConfig.resultsOffer)

  // Exit-intent detection
  useEffect(() => {
    let hasShownModal = false

    const handleMouseLeave = (e: MouseEvent) => {
      // Only trigger if mouse is leaving at the top of the page (likely closing tab)
      if (e.clientY <= 0 && !hasShownModal) {
        setShowExitModal(true)
        hasShownModal = true
      }
    }

    document.addEventListener('mouseleave', handleMouseLeave)
    return () => document.removeEventListener('mouseleave', handleMouseLeave)
  }, [])

  useEffect(() => {
    const loadOffers = async () => {
      try {
        const res = await fetch('/api/assessment/config', { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          if (data?.resultsOffer) {
            setOfferConfig(data.resultsOffer)
          }
        }
      } catch (error) {
        console.error('Failed to load assessment offer config', error)
      }
    }
    loadOffers()
  }, [])

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

        <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-xl rounded-3xl p-8 md:p-10 border border-primary-500/30 shadow-2xl shadow-primary-500/10">
          <div className="text-center space-y-2 mb-6">
            <div className="flex items-center justify-center gap-3 text-primary-300">
              <Gift className="w-7 h-7" />
              <h3 className="text-2xl md:text-3xl font-black text-white text-center">
                {offerConfig.title}
              </h3>
            </div>
            <p className="text-gray-300 text-lg">{offerConfig.subtitle}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {offerConfig.offers.map((offer) => (
              <div
                key={offer.id}
                className="bg-gray-900/60 border border-gray-700 rounded-2xl p-5 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <h4 className="text-xl font-bold text-white">{offer.title}</h4>
                    {offer.subtitle && <p className="text-gray-300 text-sm">{offer.subtitle}</p>}
                  </div>
                  {offer.badge && (
                    <span className="text-xs bg-primary-500/20 text-primary-200 px-2 py-1 rounded-full">
                      {offer.badge}
                    </span>
                  )}
                </div>

                {offer.bullets && offer.bullets.length > 0 && (
                  <ul className="space-y-2 text-gray-300 text-sm">
                    {offer.bullets.map((bullet, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-primary-300 mt-0.5" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="pt-2">
                  <Link
                    href={offer.ctaLink}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-primary-500 to-secondary-500 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-primary-500/30 transition-all"
                  >
                    <Star className="w-4 h-4" />
                    {offer.ctaText}
                  </Link>
                </div>
              </div>
            ))}
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

      {/* EXIT-INTENT MODAL */}
      {showExitModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 max-w-2xl w-full border-2 border-primary-500/50 shadow-2xl shadow-primary-500/30 relative">
            {/* Close Button */}
            <button
              onClick={() => setShowExitModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Modal Content */}
            <div className="text-center mb-6">
              <h3 className="text-3xl font-black text-white mb-3">
                ⚡ Wait! Don't Leave Yet...
              </h3>
              <p className="text-xl text-gray-200">
                Try our system <span className="text-primary-400 font-bold">FREE for 2 weeks</span> and see the difference!
              </p>
            </div>

            <div className="bg-gradient-to-br from-primary-500/20 to-secondary-500/20 rounded-xl p-6 mb-6 border border-primary-500/30">
              <h4 className="text-2xl font-bold text-white mb-4 text-center">
                🎯 Free 2-Week Trial: Peptide Tracker + Portal Access
              </h4>

              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-white font-semibold">Track Your Protocol</p>
                    <p className="text-gray-300 text-sm">Set up your peptide tracking system in minutes</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Unlock className="w-5 h-5 text-green-400 flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-white font-semibold">Unlock Breathwork App & MMM Module 1</p>
                    <p className="text-gray-300 text-sm">Complete setup to access our proven breathwork exercises</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Star className="w-5 h-5 text-primary-400 flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-white font-semibold">Earn Rewards & Discounts</p>
                    <p className="text-gray-300 text-sm">Complete modules to unlock discounts on peptide packages and coaching</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900/60 rounded-lg p-4 border border-primary-500/20">
                <p className="text-center text-gray-200 mb-2">
                  <strong className="text-white">The Goal:</strong> Create a habit of success 💪
                </p>
                <p className="text-center text-gray-400 text-sm">
                  Each completed module gives you a dopamine hit of progress and unlocks more tools for your transformation.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/portal"
                className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-primary-500 to-secondary-500 text-white px-8 py-4 rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-primary-500/50 transform hover:scale-105 transition-all"
              >
                <Zap className="w-5 h-5" />
                Start My Free Trial
              </Link>
              <button
                onClick={() => setShowExitModal(false)}
                className="sm:w-auto px-6 py-4 text-gray-400 hover:text-white transition-colors text-sm"
              >
                No thanks, I'll pass on this offer
              </button>
            </div>

            <p className="text-center text-gray-500 text-xs mt-4">
              No credit card required • Cancel anytime • Keep your progress
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
