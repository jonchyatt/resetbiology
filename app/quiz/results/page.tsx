"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  QuizResponses,
  loadQuizFromStorage,
  clearQuizFromStorage,
  determineQuizOutcome,
  QuizOutcome
} from "@/types/quiz"

export default function QuizResultsPage() {
  const router = useRouter()
  const [quiz, setQuiz] = useState<QuizResponses | null>(null)
  const [outcome, setOutcome] = useState<QuizOutcome | null>(null)

  useEffect(() => {
    const savedQuiz = loadQuizFromStorage()
    if (!savedQuiz || !savedQuiz.completedAt) {
      // No quiz found or not completed - redirect to start
      router.push('/quiz')
      return
    }

    setQuiz(savedQuiz)
    setOutcome(determineQuizOutcome(savedQuiz))
  }, [router])

  const handleCreateAccount = () => {
    // Redirect to Auth0 login which will create account
    router.push('/api/auth/login?returnTo=/portal')
  }

  if (!quiz || !outcome) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-white">Loading your results...</div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 px-4 py-8 md:py-12"
      style={{
        backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6 md:mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 md:mb-4">
            Your Personalized Results, {quiz.preferredName}!
          </h1>
          <p className="text-gray-300 text-base md:text-lg">
            Based on your responses, here's what we recommend for your journey
          </p>
        </div>

        {/* Results Card */}
        <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-8 border border-primary-400/30 shadow-2xl">

          {/* Outcome: Peptides Only - High margin, majority of customers */}
          {outcome === 'peptides-only' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold text-white mb-4">
                  Direct Access Protocol
                </h2>
                <p className="text-primary-300 font-semibold text-lg">
                  You Know What You Need
                </p>
              </div>

              <div className="bg-primary-500/10 border border-primary-400/30 rounded-lg p-6">
                <p className="text-gray-200 text-lg leading-relaxed mb-4">
                  Based on your responses, it seems like you know what you're seeking and are ready to utilize peptides with minimal assistance.
                </p>
                <p className="text-gray-300 leading-relaxed mb-4">
                  You, like us, know that peptides can be powerful tools, but they work best when combined with lifestyle changes, support systems, and a commitment to the process.
                </p>
                <p className="text-gray-300 leading-relaxed">
                  We will continue to provide access so when you're open to exploring a more holistic approach, we'd love to help you succeed when you are ready. But it seems like you are ready to just purchase your research peptides and get started.
                </p>
                <p className="text-primary-300 font-semibold mt-4">
                  We will be here if you need us. You will have full access.
                </p>
              </div>

              <div className="bg-gradient-to-br from-secondary-600/20 to-primary-600/20 border border-secondary-400/30 rounded-lg p-6">
                <h3 className="text-white font-bold text-xl mb-3">Your Direct Access Includes:</h3>
                <ul className="space-y-2 text-gray-200 mb-4">
                  <li>💊 Immediate access to premium research peptides</li>
                  <li>📋 Basic protocol documentation included</li>
                  <li>🚀 Fast checkout and priority shipping</li>
                  <li>✅ Quality certificates with every order</li>
                  <li>🔄 Reorder reminders and tracking</li>
                  <li>🎯 Optional: Full platform access if you need it later</li>
                </ul>
              </div>

              <button
                onClick={() => router.push('/order')}
                className="w-full bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-400 hover:to-secondary-400 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-primary-400/20 text-lg"
              >
                Go to Peptide & Protocol Ordering Gateway →
              </button>
            </div>
          )}

          {/* Outcome: IRB Partnership (Cellular Peptide) */}
          {outcome === 'irb-partnership' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold text-white mb-4">
                  Premium Partnership: Cellular Peptide
                </h2>
                <p className="text-primary-300 font-semibold text-lg">
                  Full IRB-Backed Research Protocol
                </p>
              </div>

              <div className="bg-primary-500/10 border border-primary-400/30 rounded-lg p-6">
                <h3 className="text-white font-bold text-xl mb-4">You Value:</h3>
                <ul className="space-y-2 text-gray-200">
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-primary-400 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Complete guidance and structured protocols</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-primary-400 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>IRB research backing and medical oversight</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-primary-400 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Holistic approach to health and wellness</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-primary-400 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Partnership and support throughout your journey</span>
                  </li>
                </ul>
              </div>

              <div className="bg-gradient-to-br from-secondary-600/20 to-primary-600/20 border border-secondary-400/30 rounded-lg p-6">
                <h3 className="text-white font-bold text-xl mb-3">What's Included:</h3>
                <ul className="space-y-2 text-gray-200 mb-4">
                  <li>✨ Full IRB research protocol and documentation</li>
                  <li>💊 Premium peptide compounds with verified quality</li>
                  <li>📋 Personalized dosing schedules and tracking</li>
                  <li>🎯 Access to all Reset Biology tools and resources</li>
                  <li>👨‍⚕️ Medical oversight and consultation</li>
                  <li>📊 Regular progress monitoring and adjustments</li>
                </ul>
                <p className="text-primary-300 font-bold text-lg">
                  Partner with Cellular Peptide for the most comprehensive support
                </p>
              </div>

              <div className="bg-primary-500/10 border border-primary-400/30 rounded-lg p-6 mb-6">
                <p className="text-white font-semibold text-xl mb-2 text-center">
                  Ready to see your personalized results?
                </p>
                <p className="text-gray-300 text-sm text-center">
                  Create your free account to access your custom dashboard and all our tools
                </p>
              </div>

              <button
                onClick={handleCreateAccount}
                className="w-full bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-400 hover:to-secondary-400 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-primary-400/20 text-lg"
              >
                Create Free Account →
              </button>
            </div>
          )}

          {/* Outcome: Reset Biology Partnership */}
          {outcome === 'reset-biology-partner' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-secondary-500 to-primary-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold text-white mb-4">
                  Perfect Fit: Reset Biology Partnership
                </h2>
                <p className="text-secondary-300 font-semibold text-lg">
                  Affordable Support with More Control
                </p>
              </div>

              <div className="bg-secondary-500/10 border border-secondary-400/30 rounded-lg p-6">
                <h3 className="text-white font-bold text-xl mb-4">You're Looking For:</h3>
                <ul className="space-y-2 text-gray-200">
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-secondary-400 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>A balance between guidance and independence</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-secondary-400 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>More affordable options without sacrificing support</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-secondary-400 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Tools and resources to enhance your journey</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-secondary-400 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Control over your health decisions</span>
                  </li>
                </ul>
              </div>

              <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 border border-primary-400/30 rounded-lg p-6">
                <h3 className="text-white font-bold text-xl mb-3">What You'll Get:</h3>
                <ul className="space-y-2 text-gray-200 mb-4">
                  <li>🎯 Access to all Reset Biology free tools</li>
                  <li>📊 Peptide tracking, dosage calculators, and protocols</li>
                  <li>💪 Workout and nutrition tracking</li>
                  <li>🧘 Breathwork and mental strength exercises</li>
                  <li>📝 Journal and goal tracking systems</li>
                  <li>🎮 Gamification and progress rewards</li>
                  <li>💊 Option to purchase peptides directly at lower cost</li>
                  <li>📚 Educational resources and community support</li>
                </ul>
                <p className="text-secondary-300 font-bold text-lg">
                  This is our sweet spot - support without the premium price tag
                </p>
              </div>

              <button
                onClick={handleCreateAccount}
                className="w-full bg-gradient-to-r from-secondary-500 to-primary-500 hover:from-secondary-400 hover:to-primary-400 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-secondary-400/20 text-lg"
              >
                Create Account & Start Your Journey
              </button>
            </div>
          )}

          {/* Outcome: Free Tools Only - Clever outlier */}
          {outcome === 'free-tools-only' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold text-white mb-4">
                  The Clever Path
                </h2>
                <p className="text-purple-300 font-semibold text-lg">
                  Real Change Through Free Tools
                </p>
              </div>

              <div className="bg-purple-500/10 border border-purple-400/30 rounded-lg p-6">
                <p className="text-gray-200 text-lg leading-relaxed mb-4">
                  You've discovered something most people miss - our free tools alone can create real, lasting change in your health journey.
                </p>
                <p className="text-gray-300 leading-relaxed mb-4">
                  Nutrition tracking, workout planning, breathwork, mental exercises, and journaling - when used consistently, these tools are powerful catalysts for transformation.
                </p>
                <p className="text-purple-300 font-semibold">
                  No peptides needed. No payment required. Just commitment and consistency.
                </p>
              </div>

              <div className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-indigo-400/30 rounded-lg p-6">
                <h3 className="text-white font-bold text-xl mb-3">Your Free Toolkit:</h3>
                <ul className="space-y-2 text-gray-200 mb-4">
                  <li>🍎 Complete nutrition tracking and analysis</li>
                  <li>💪 Workout planning and progress tracking</li>
                  <li>🧘 Breathwork exercises with scientific backing</li>
                  <li>🧠 Mental strength modules and exercises</li>
                  <li>📝 Journaling system for reflection and growth</li>
                  <li>🎮 Gamification to keep you motivated</li>
                  <li>📊 Progress analytics and insights</li>
                </ul>
                <p className="text-indigo-300 font-semibold">
                  Everything you need. Nothing you don't.
                </p>
              </div>

              <button
                onClick={handleCreateAccount}
                className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-purple-400/20 text-lg"
              >
                Access Your Free Tools Dashboard →
              </button>
            </div>
          )}

        </div>

        {/* Footer note */}
        <div className="text-center mt-6">
          <p className="text-gray-400 text-sm">
            Your quiz responses are saved. You can always change your approach later.
          </p>
        </div>
      </div>
    </div>
  )
}
