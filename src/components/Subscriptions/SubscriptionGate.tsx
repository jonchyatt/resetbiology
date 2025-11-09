'use client'

import { useState, useEffect } from 'react'
import { Lock, Sparkles } from 'lucide-react'

interface SubscriptionGateProps {
  children: React.ReactNode
  featureName: string
}

export default function SubscriptionGate({ children, featureName }: SubscriptionGateProps) {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkSubscription()
  }, [])

  const checkSubscription = async () => {
    try {
      const response = await fetch('/api/subscriptions/status')
      const data = await response.json()

      if (response.ok) {
        setHasAccess(data.hasActiveSubscription)
      } else {
        setHasAccess(false)
      }
    } catch (error) {
      console.error('Error checking subscription:', error)
      setHasAccess(false)
    } finally {
      setLoading(false)
    }
  }

  const handleSubscribe = async () => {
    try {
      // Use a default price ID for now - you'll need to replace this with your actual Stripe price ID
      const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID || 'price_xxx'

      const response = await fetch('/api/subscriptions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId })
      })

      const data = await response.json()

      if (data.url) {
        // Redirect to Stripe checkout
        window.location.href = data.url
      }
    } catch (error) {
      console.error('Error creating checkout session:', error)
      alert('Failed to start subscription. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative"
           style={{
             backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
             backgroundSize: 'cover',
             backgroundPosition: 'center',
             backgroundAttachment: 'fixed'
           }}>
        <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
          <div className="max-w-2xl w-full bg-gradient-to-br from-purple-900/40 to-blue-900/40 backdrop-blur-sm rounded-2xl border border-purple-400/30 p-8 md:p-12 text-center">
            {/* Lock Icon */}
            <div className="mb-6 flex justify-center">
              <div className="w-20 h-20 bg-purple-600/40 rounded-full flex items-center justify-center border-2 border-purple-400/50">
                <Lock className="w-10 h-10 text-purple-300" />
              </div>
            </div>

            {/* Heading */}
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Premium Feature
            </h1>

            {/* Description */}
            <p className="text-xl text-gray-200 mb-6 leading-relaxed">
              {featureName} is available exclusively to premium members.
            </p>

            <p className="text-gray-300 mb-8">
              Upgrade to unlock unlimited access to all Mental Mastery modules, the Breathing App, and premium features.
            </p>

            {/* Benefits List */}
            <div className="bg-white/5 rounded-xl p-6 mb-8 text-left">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-400" />
                Premium Benefits
              </h3>
              <ul className="space-y-3 text-gray-200">
                <li className="flex items-start gap-3">
                  <span className="text-green-400 mt-1">✓</span>
                  <span>Full access to all 90+ Mental Mastery audio modules</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-400 mt-1">✓</span>
                  <span>Advanced Breathing App with custom protocols</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-400 mt-1">✓</span>
                  <span>Priority support and exclusive updates</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-400 mt-1">✓</span>
                  <span>Track progress across all modules and features</span>
                </li>
              </ul>
            </div>

            {/* CTA Button */}
            <button
              onClick={handleSubscribe}
              className="w-full md:w-auto px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold text-lg rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Upgrade to Premium
            </button>

            <p className="mt-6 text-sm text-gray-400">
              Cancel anytime. No long-term contracts.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // User has access, show the content
  return <>{children}</>
}
