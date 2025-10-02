"use client"

import { useState, useEffect } from "react"
import { TrendingUp, DollarSign, Users, Target, ExternalLink } from "lucide-react"

interface AffiliateStats {
  totalConversions: number
  totalCommissions: number
  pendingCommissions: number
  conversionRate: number
  topConversionSources: string[]
  recentConversions: Array<{
    userId: string
    value: number
    date: string
    status: 'confirmed' | 'pending'
  }>
  performance: {
    thisMonth: { conversions: number, commissions: number }
    lastMonth: { conversions: number, commissions: number }
    growth: string
  }
}

interface AffiliateTrackerProps {
  affiliateCode: string
  onEarningsUpdate?: (earnings: number) => void
}

export function AffiliateTracker({ affiliateCode, onEarningsUpdate }: AffiliateTrackerProps) {
  const [stats, setStats] = useState<AffiliateStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [shareCode, setShareCode] = useState('')

  useEffect(() => {
    loadAffiliateStats()
    generateShareCode()
  }, [affiliateCode])

  const loadAffiliateStats = async () => {
    try {
      const response = await fetch(`/api/affiliates?code=${affiliateCode}`)
      if (response.ok) {
        const data = await response.json()
        setStats(data.affiliate)
        onEarningsUpdate?.(data.affiliate.totalCommissions)
      }
    } catch (error) {
      console.error('Failed to load affiliate stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const generateShareCode = () => {
    const baseUrl = window.location.origin
    const trackingUrl = `${baseUrl}/?ref=${affiliateCode}&utm_source=affiliate&utm_medium=referral&utm_campaign=reset-biology`
    setShareCode(trackingUrl)
  }

  const trackConversion = async (userId: string, value: number, type: string = 'deposit') => {
    try {
      await fetch('/api/affiliates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          affiliateCode,
          referredUserId: userId,
          conversionData: {
            type,
            value,
            source: 'direct'
          }
        })
      })
    } catch (error) {
      console.error('Conversion tracking error:', error)
    }
  }

  const copyShareCode = () => {
    navigator.clipboard.writeText(shareCode)
    alert('🎯 Your tracking link copied! Share it to start earning 30% commissions on all partner investments.')
  }

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-primary-400/30">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-600 rounded w-3/4 mb-4"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-600 rounded"></div>
            <div className="h-3 bg-gray-600 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="bg-gradient-to-br from-red-600/20 to-red-700/20 border border-red-400/30 rounded-xl p-4 text-center hover:shadow-red-400/20 transition-all duration-300">
        <p className="text-red-200">Failed to load affiliate statistics</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-500 to-secondary-500 text-white rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center mb-2">
              <img src="/logo.png" alt="Reset Biology" className="h-8 w-auto mr-3" />
              <h2 className="text-2xl font-bold">💰 Affiliate Performance</h2>
            </div>
            <p className="text-primary-100">
              Your Code: <span className="font-bold">{affiliateCode}</span>
            </p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold">${stats.totalCommissions.toLocaleString()}</div>
            <div className="text-sm text-primary-200">Total Earned</div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/30 p-4 rounded-lg shadow-xl border border-primary-400/30 hover:shadow-blue-400/20 transition-all duration-300">
          <div className="flex items-center">
            <Users className="w-5 h-5 text-blue-500 mr-2" />
            <span className="text-sm text-gray-300">Conversions</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.totalConversions}</div>
          <div className="text-xs text-gray-400">
            {stats.conversionRate}% conversion rate
          </div>
        </div>

        <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/30 p-4 rounded-lg shadow-xl border border-primary-400/30 hover:shadow-blue-400/20 transition-all duration-300">
          <div className="flex items-center">
            <DollarSign className="w-5 h-5 text-green-500 mr-2" />
            <span className="text-sm text-gray-300">Confirmed</span>
          </div>
          <div className="text-2xl font-bold text-green-600">
            ${(stats.totalCommissions - stats.pendingCommissions).toLocaleString()}
          </div>
          <div className="text-xs text-gray-400">Ready for payout</div>
        </div>

        <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/30 p-4 rounded-lg shadow-xl border border-primary-400/30 hover:shadow-blue-400/20 transition-all duration-300">
          <div className="flex items-center">
            <Target className="w-5 h-5 text-orange-500 mr-2" />
            <span className="text-sm text-gray-300">Pending</span>
          </div>
          <div className="text-2xl font-bold text-orange-600">
            ${stats.pendingCommissions.toLocaleString()}
          </div>
          <div className="text-xs text-gray-400">Awaiting completion</div>
        </div>

        <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/30 p-4 rounded-lg shadow-xl border border-primary-400/30 hover:shadow-blue-400/20 transition-all duration-300">
          <div className="flex items-center">
            <TrendingUp className="w-5 h-5 text-purple-500 mr-2" />
            <span className="text-sm text-gray-300">Growth</span>
          </div>
          <div className="text-2xl font-bold text-purple-600">
            {stats.performance.growth}
          </div>
          <div className="text-xs text-gray-400">vs last month</div>
        </div>
      </div>

      {/* Share Your Link */}
      <div className="bg-gradient-to-br from-yellow-600/20 to-yellow-700/20 border border-yellow-400/30 rounded-xl p-6 hover:shadow-yellow-400/20 transition-all duration-300">
        <h3 className="text-lg font-bold text-yellow-200 mb-3">🔗 Your Affiliate Tracking Link</h3>
        <div className="flex space-x-2 mb-3">
          <input
            type="text"
            value={shareCode}
            readOnly
            className="flex-1 p-2 border border-gray-300 rounded text-sm"
          />
          <button
            onClick={copyShareCode}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded font-semibold"
          >
            Copy Link
          </button>
        </div>
        <p className="text-yellow-200 text-sm">
          Share this link to earn <strong>30% commission</strong> on all partner investments from people who join through your referral.
        </p>
      </div>

      {/* Recent Conversions */}
      <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 shadow-2xl hover:shadow-secondary-400/20 transition-all duration-300 border border-secondary-400/30">
        <h3 className="text-lg font-bold text-white mb-4">💸 Recent Conversions</h3>
        
        <div className="space-y-3">
          {stats.recentConversions.map((conversion, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gradient-to-br from-primary-600/20 to-secondary-600/30 rounded-lg border border-gray-600/30 hover:shadow-gray-400/20 transition-all duration-300">
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-3 ${
                  conversion.status === 'confirmed' ? 'bg-green-400' : 'bg-orange-400'
                }`}></div>
                <div>
                  <div className="text-sm font-medium text-white">
                    Partner Investment • {new Date(conversion.date).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-gray-400">
                    Status: {conversion.status === 'confirmed' ? '✅ Confirmed' : '⏳ Pending completion'}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-green-600">
                  +${Math.round(conversion.value * 0.30)}
                </div>
                <div className="text-xs text-gray-400">
                  30% of ${conversion.value}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Insights */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-gradient-to-br from-blue-600/20 to-blue-700/20 border border-blue-400/30 rounded-lg p-4 hover:shadow-blue-400/20 transition-all duration-300">
          <h3 className="font-bold text-blue-200 mb-2">📈 This Month's Performance</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-blue-300">Conversions:</span>
              <span className="font-semibold">{stats.performance.thisMonth.conversions}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-300">Commissions:</span>
              <span className="font-semibold">${stats.performance.thisMonth.commissions}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-300">Growth:</span>
              <span className="font-semibold text-green-600">{stats.performance.growth}</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-600/20 to-green-700/20 border border-green-400/30 rounded-lg p-4 hover:shadow-green-400/20 transition-all duration-300">
          <h3 className="font-bold text-green-200 mb-2">🎯 Optimization Tips</h3>
          <ul className="text-sm text-green-200 space-y-1">
            <li>• Share success stories from your referrals</li>
            <li>• Focus on the medical benefits (Retatrutide)</li>
            <li>• Emphasize the refundable investment model</li>
            <li>• Target people frustrated with failed diets</li>
          </ul>
        </div>
      </div>

      {/* Payout Information */}
      <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-primary-400/30 hover:shadow-primary-400/20 transition-all duration-300">
        <h3 className="text-lg font-bold text-white mb-4">💳 Commission Payouts</h3>
        
        <div className="grid gap-4 md:grid-cols-2 mb-4">
          <div className="p-4 bg-gradient-to-br from-green-600/20 to-green-700/20 rounded-lg border border-green-400/30">
            <div className="text-sm text-green-300 mb-1">Ready for Payout</div>
            <div className="text-2xl font-bold text-green-600">
              ${(stats.totalCommissions - stats.pendingCommissions).toLocaleString()}
            </div>
          </div>
          <div className="p-4 bg-gradient-to-br from-orange-600/20 to-orange-700/20 rounded-lg border border-orange-400/30">
            <div className="text-sm text-orange-300 mb-1">Pending Completion</div>
            <div className="text-2xl font-bold text-orange-600">
              ${stats.pendingCommissions.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/30 p-4 rounded-lg border border-gray-600/30">
          <h4 className="font-semibold text-white mb-2">🏦 Payout Schedule</h4>
          <p className="text-sm text-gray-300 mb-2">
            Commissions are paid monthly on the 1st, provided you meet the $100 minimum threshold.
          </p>
          <p className="text-xs text-gray-400">
            Pending commissions become confirmed when referred users complete their 90-day program requirements.
          </p>
        </div>
      </div>

      {/* Psychology: Social Proof */}
      <div className="bg-gradient-to-r from-purple-400 to-pink-400 text-white rounded-lg p-6 text-center">
        <h3 className="text-xl font-bold mb-2">🏆 Top Affiliate This Month</h3>
        <p className="text-purple-100 mb-3">
          "I've earned over $8,000 helping people access real medical-grade peptides instead of the dangerous alternatives. 
          The Reset Biology system works - people get results, stay committed, and everyone wins."
        </p>
        <div className="text-sm text-purple-200">
          - Sarah K., Top Reset Biology Affiliate
        </div>
      </div>
    </div>
  )
}