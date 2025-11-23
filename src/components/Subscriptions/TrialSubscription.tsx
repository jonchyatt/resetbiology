'use client'

import { useState } from 'react'
import { Sparkles, Check, Lock } from 'lucide-react'

interface TrialSubscriptionProps {
  onClose?: () => void
  redirectUrl?: string
}

export default function TrialSubscription({ onClose, redirectUrl }: TrialSubscriptionProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleStartTrial = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/subscriptions/trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirectUrl })
      })

      const data = await response.json()

      if (data.url) {
        // Redirect to Stripe checkout
        window.location.href = data.url
      } else {
        throw new Error(data.error || 'Failed to start trial')
      }
    } catch (err: any) {
      console.error('Error starting trial:', err)
      setError(err.message || 'Failed to start trial. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-8 max-w-2xl w-full mx-4 shadow-2xl border border-primary-400/20">
        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        )}

        {/* Icon and Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="bg-gradient-to-r from-primary-500/20 to-secondary-500/20 p-4 rounded-full mb-4">
            <Sparkles className="w-12 h-12 text-primary-400" />
          </div>
          <h2 className="text-4xl font-bold text-white text-center mb-2">
            Start Your $1 Trial
          </h2>
          <p className="text-gray-300 text-lg text-center">
            Get full access to all premium features for just $1
          </p>
        </div>

        {/* Pricing */}
        <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 border border-primary-400/30 rounded-xl p-6 mb-6">
          <div className="flex items-baseline justify-center gap-2 mb-2">
            <span className="text-5xl font-bold text-white">$1</span>
            <span className="text-gray-300 text-lg">for 14 days</span>
          </div>
          <p className="text-center text-gray-300 text-sm">
            Then $29.99/month • Cancel anytime
          </p>
        </div>

        {/* Features */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5 text-secondary-400" />
            What You'll Get:
          </h3>
          <div className="space-y-3">
            {[
              'Full access to all peptide tracking and protocols',
              '90+ Mental Mastery audio modules',
              'Advanced Breathing App with custom protocols',
              'Vision healing and training exercises',
              'Workout and nutrition tracking',
              'Gamification system with rewards',
              'Priority support and exclusive updates'
            ].map((feature, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-secondary-500/20 rounded-full flex items-center justify-center mt-0.5">
                  <Check className="w-4 h-4 text-secondary-400" />
                </div>
                <span className="text-gray-200">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-400/30 rounded-lg">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* CTA Button */}
        <button
          onClick={handleStartTrial}
          disabled={loading}
          className="w-full bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-primary-500/50 disabled:transform-none disabled:shadow-none"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Processing...
            </span>
          ) : (
            'Start $1 Trial Now'
          )}
        </button>

        {/* Fine Print */}
        <p className="mt-6 text-xs text-gray-400 text-center">
          By starting your trial, you agree to our Terms of Service and Privacy Policy.
          You will be charged $1 today and $29.99/month after your 14-day trial ends.
          Cancel anytime before the trial ends to avoid charges.
        </p>
      </div>
    </div>
  )
}
