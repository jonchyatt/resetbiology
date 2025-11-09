'use client'

import { useState, useEffect } from 'react'
import { PortalHeader } from '@/components/Navigation/PortalHeader'
import { Crown, CheckCircle, Calendar, CreditCard, ExternalLink, Sparkles } from 'lucide-react'

interface SubscriptionStatus {
  subscriptionStatus: string
  subscriptionExpiry: Date | null
  hasActiveSubscription: boolean
  tier: 'free' | 'premium'
  daysRemaining: number | null
}

export default function SubscriptionPage() {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSubscriptionStatus()
  }, [])

  const fetchSubscriptionStatus = async () => {
    try {
      const response = await fetch('/api/subscriptions/status')
      const data = await response.json()

      if (response.ok) {
        setStatus(data)
      }
    } catch (error) {
      console.error('Error fetching subscription status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubscribe = async () => {
    try {
      // Use a default price ID - you'll need to replace this with your actual Stripe price ID
      const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID || 'price_xxx'

      const response = await fetch('/api/subscriptions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId })
      })

      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error('Error creating checkout session:', error)
      alert('Failed to start subscription. Please try again.')
    }
  }

  const handleManageSubscription = async () => {
    try {
      const response = await fetch('/api/subscriptions/portal')
      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error('Error opening customer portal:', error)
      alert('Failed to open subscription management. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative"
         style={{
           backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
           backgroundSize: 'cover',
           backgroundPosition: 'center',
           backgroundAttachment: 'fixed'
         }}>
      <div className="relative z-10">
        <PortalHeader
          section="Subscription"
          subtitle="Manage your membership"
          showOrderPeptides={false}
        />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Current Status Card */}
          <div className="card-hover-primary mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Crown className="w-6 h-6 text-yellow-400" />
                Your Membership
              </h2>
              <div className={`px-4 py-2 rounded-full text-sm font-semibold ${
                status?.hasActiveSubscription
                  ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                  : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
              }`}>
                {status?.hasActiveSubscription ? 'Premium Member' : 'Free Account'}
              </div>
            </div>

            {status?.hasActiveSubscription ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <div>
                    <div className="text-white font-medium">Active Subscription</div>
                    <div className="text-sm text-gray-300">
                      You have full access to all premium features
                    </div>
                  </div>
                </div>

                {status.subscriptionExpiry && (
                  <div className="flex items-center gap-3 p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <Calendar className="w-5 h-5 text-blue-400" />
                    <div>
                      <div className="text-white font-medium">Next Billing Date</div>
                      <div className="text-sm text-gray-300">
                        {new Date(status.subscriptionExpiry).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                        {status.daysRemaining && ` (${status.daysRemaining} days)`}
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleManageSubscription}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors"
                >
                  <CreditCard className="w-5 h-5" />
                  Manage Subscription
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="p-6 bg-purple-600/20 rounded-lg border border-purple-400/30">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-yellow-400" />
                    Upgrade to Premium
                  </h3>
                  <ul className="space-y-3 mb-6">
                    <li className="flex items-start gap-3 text-gray-200">
                      <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Full access to all 90+ Mental Mastery audio modules</span>
                    </li>
                    <li className="flex items-start gap-3 text-gray-200">
                      <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Advanced Breathing App with custom protocols</span>
                    </li>
                    <li className="flex items-start gap-3 text-gray-200">
                      <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Priority support and exclusive updates</span>
                    </li>
                    <li className="flex items-start gap-3 text-gray-200">
                      <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Track progress across all modules and features</span>
                    </li>
                  </ul>

                  <div className="mb-6 p-4 bg-white/5 rounded-lg">
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-4xl font-bold text-white">$29</span>
                      <span className="text-gray-300">/month</span>
                    </div>
                    <p className="text-sm text-gray-400">Cancel anytime. No long-term contracts.</p>
                  </div>

                  <button
                    onClick={handleSubscribe}
                    className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold text-lg rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    Subscribe Now
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card-hover-primary">
              <div className="text-center mb-4">
                <div className="text-4xl mb-3">🧠</div>
                <h3 className="text-xl font-bold text-white mb-2">Mental Mastery</h3>
                <p className="text-gray-300">90+ audio modules for metabolic transformation</p>
              </div>
              <div className={`mt-4 px-4 py-2 rounded-lg text-center ${
                status?.hasActiveSubscription
                  ? 'bg-green-500/20 text-green-300'
                  : 'bg-gray-500/20 text-gray-400'
              }`}>
                {status?.hasActiveSubscription ? 'Full Access' : 'Premium Required'}
              </div>
            </div>

            <div className="card-hover-primary">
              <div className="text-center mb-4">
                <div className="text-4xl mb-3">🫁</div>
                <h3 className="text-xl font-bold text-white mb-2">Breathing App</h3>
                <p className="text-gray-300">Master your nervous system through guided breathing</p>
              </div>
              <div className={`mt-4 px-4 py-2 rounded-lg text-center ${
                status?.hasActiveSubscription
                  ? 'bg-green-500/20 text-green-300'
                  : 'bg-gray-500/20 text-gray-400'
              }`}>
                {status?.hasActiveSubscription ? 'Full Access' : 'Premium Required'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
