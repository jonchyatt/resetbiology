"use client"

import { useState, useEffect } from "react"
import { TrendingUp, AlertTriangle, CheckCircle, Target, Calendar } from "lucide-react"
import type { SuccessDeposit } from "@/types"

interface DepositTrackerProps {
  userId: string
  onDepositUpdate?: (deposit: SuccessDeposit) => void
}

export function DepositTracker({ userId, onDepositUpdate }: DepositTrackerProps) {
  const [deposit, setDeposit] = useState<SuccessDeposit | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    // Mock deposit data with psychological pressure points
    const mockDeposit: SuccessDeposit = {
      id: 'deposit-1',
      amount: 500,
      status: 'earning',
      payoutConditions: {
        modulesRequired: 5, // Required modules only
        checkinsRequired: 30,
        timeframe: 90
      },
      partnerShare: 1.1, // 110% Silver tier
      progress: {
        modulesCompleted: 2, // Only 40% complete - creates urgency
        checkinStreak: 7,
        daysRemaining: 47 // Less than 60 days - medium urgency
      }
    }
    
    setDeposit(mockDeposit)
    onDepositUpdate?.(mockDeposit)
  }, [onDepositUpdate])

  if (!deposit) return null

  const moduleProgress = (deposit.progress.modulesCompleted / deposit.payoutConditions.modulesRequired) * 100
  const checkinProgress = Math.min((deposit.progress.checkinStreak / deposit.payoutConditions.checkinsRequired) * 100, 100)
  const overallProgress = (moduleProgress + checkinProgress) / 2

  const securedAmount = Math.round(deposit.amount * (overallProgress / 100))
  const atRiskAmount = deposit.amount - securedAmount

  const getUrgencyLevel = () => {
    if (overallProgress < 50) return 'high'
    if (overallProgress < 80) return 'medium'
    return 'low'
  }

  const getUrgencyMessage = () => {
    const urgency = getUrgencyLevel()
    const modulesLeft = deposit.payoutConditions.modulesRequired - deposit.progress.modulesCompleted
    
    if (urgency === 'high') {
      return {
        title: '🚨 Your Stake is At Risk!',
        message: `Complete ${modulesLeft} more modules or risk losing your $${deposit.amount} investment.`,
        color: 'red'
      }
    } else if (urgency === 'medium') {
      return {
        title: '⚡ Secure Your Investment',
        message: `You're making progress! ${modulesLeft} modules left to guarantee your payout.`,
        color: 'yellow'
      }
    } else {
      return {
        title: '🎉 Payout Nearly Secured!',
        message: `Your $${deposit.amount} partner payout is almost guaranteed!`,
        color: 'green'
      }
    }
  }

  const urgencyInfo = getUrgencyMessage()

  const getPotentialPayout = () => {
    const baseAmount = deposit.amount
    const tierMultiplier = deposit.partnerShare || 1.0
    return Math.round(baseAmount * tierMultiplier)
  }

  return (
    <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-1 border border-primary-400/30 shadow-2xl hover:shadow-primary-400/20 transition-all duration-300">
      {/* Main Stake Display */}
      <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">
            💰 Your ${deposit.amount} Partner Stake
          </h2>
          <div className={`px-4 py-2 rounded-full text-sm font-bold ${
            deposit.progress.daysRemaining < 30 ? 'bg-red-100 text-red-800' :
            deposit.progress.daysRemaining < 60 ? 'bg-yellow-100 text-yellow-800' :
            'bg-green-100 text-green-800'
          }`}>
            {deposit.progress.daysRemaining} Days Remaining
          </div>
        </div>

        {/* Loss Aversion Visualization */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <span className="text-lg font-semibold text-gray-200">Stake Security Status</span>
            <span className="text-sm text-gray-300">{Math.round(overallProgress)}% Complete</span>
          </div>
          
          {/* Secured vs At Risk Progress Bar */}
          <div className="relative">
            <div className="h-8 bg-red-100 rounded-lg overflow-hidden border border-red-200">
              <div 
                className="h-full bg-gradient-to-r from-green-400 to-green-500 transition-all duration-1000 flex items-center justify-center text-white text-sm font-bold"
                style={{ width: `${overallProgress}%` }}
              >
                {overallProgress > 20 && `$${securedAmount} Secured`}
              </div>
            </div>
            
            <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-200 pointer-events-none">
              {overallProgress <= 20 && `$${securedAmount} Secured • $${atRiskAmount} At Risk`}
            </div>
          </div>
        </div>

        {/* Urgency Psychology Message */}
        <div className={`p-4 rounded-lg mb-6 border ${{
          red: 'bg-red-50 border-red-200',
          yellow: 'bg-yellow-50 border-yellow-200', 
          green: 'bg-green-50 border-green-200'
        }[urgencyInfo.color]}`}>
          <div className={`text-${urgencyInfo.color === 'red' ? 'red' : urgencyInfo.color === 'yellow' ? 'yellow' : 'green'}-800`}>
            <h3 className="font-bold mb-2">{urgencyInfo.title}</h3>
            <p className="text-sm">{urgencyInfo.message}</p>
          </div>
        </div>

        {/* Progress Breakdown */}
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          <div className="text-center p-4 bg-gradient-to-br from-primary-600/20 to-secondary-600/30 rounded-lg border border-primary-400/30 hover:shadow-primary-400/20 transition-all duration-300">
            <div className="text-2xl font-bold text-primary-600 mb-1">
              {deposit.progress.modulesCompleted}/{deposit.payoutConditions.modulesRequired}
            </div>
            <div className="text-sm text-gray-300">Audio Modules</div>
            <div className="w-full bg-gray-600 rounded-full h-2 mt-2">
              <div 
                className="bg-primary-400 h-2 rounded-full transition-all duration-500"
                style={{ width: `${moduleProgress}%` }}
              />
            </div>
          </div>
          
          <div className="text-center p-4 bg-gradient-to-br from-primary-600/20 to-secondary-600/30 rounded-lg border border-secondary-400/30 hover:shadow-secondary-400/20 transition-all duration-300">
            <div className="text-2xl font-bold text-secondary-400 mb-1">
              {deposit.progress.checkinStreak}/{deposit.payoutConditions.checkinsRequired}
            </div>
            <div className="text-sm text-gray-300">Check-in Progress</div>
            <div className="w-full bg-gray-600 rounded-full h-2 mt-2">
              <div 
                className="bg-secondary-400 h-2 rounded-full transition-all duration-500"
                style={{ width: `${checkinProgress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Payout Potential Psychology */}
        <div className="bg-gradient-to-r from-primary-500 to-secondary-500 text-white p-4 rounded-lg text-center">
          <h3 className="font-bold mb-2">🏆 Your Earning Potential</h3>
          <div className="text-2xl font-bold mb-1">${getPotentialPayout()}</div>
          <div className="text-sm text-primary-100">
            {deposit.partnerShare && deposit.partnerShare > 1 ? 
              `${Math.round((deposit.partnerShare - 1) * 100)}% bonus for ${getCurrentTierName(deposit.partnerShare)} performance!` :
              'Base partner payout secured'
            }
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6">
          <button 
            onClick={() => setShowDetails(!showDetails)}
            className="flex-1 px-4 py-2 bg-gray-700/80 hover:bg-gray-600/80 text-gray-200 rounded-lg font-semibold transition-colors border border-gray-600/30 hover:shadow-gray-400/20"
          >
            {showDetails ? 'Hide Details' : 'View Details'}
          </button>
          
          <button className="flex-1 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-semibold transition-colors">
            Continue Learning →
          </button>
        </div>
      </div>

      {/* Detailed Breakdown */}
      {showDetails && (
        <div className="border-t border-gray-600/30 p-6 bg-gradient-to-br from-primary-600/20 to-secondary-600/30 backdrop-blur-sm rounded-b-xl">
          <h3 className="font-bold text-white mb-4">📊 Detailed Progress Breakdown</h3>
          
          <div className="space-y-4 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-300">Stake placed:</span>
              <span className="font-semibold">${deposit.amount} on {new Date(Date.now() - (90 - deposit.progress.daysRemaining) * 24 * 60 * 60 * 1000).toLocaleDateString()}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-300">Current tier:</span>
              <span className="font-semibold text-primary-600">{getCurrentTierName(deposit.partnerShare || 1)} Partner</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-300">Completion deadline:</span>
              <span className="font-semibold">{new Date(Date.now() + deposit.progress.daysRemaining * 24 * 60 * 60 * 1000).toLocaleDateString()}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-300">If completed today:</span>
              <span className="font-semibold text-green-600">${getPotentialPayout()} payout</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-300">If incomplete:</span>
              <span className="font-semibold text-red-600">$0 (stake forfeited)</span>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-gradient-to-br from-blue-600/20 to-blue-700/20 rounded-lg border border-blue-400/30 hover:shadow-blue-400/20 transition-all duration-300">
            <p className="text-blue-200 text-sm">
              <strong>Psychology Note:</strong> Your brain works 2.5x harder to avoid losing something you have 
              vs. earning something new. This system leverages that natural motivation for your success.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function getCurrentTierName(multiplier: number): string {
  if (multiplier >= 1.5) return 'Platinum'
  if (multiplier >= 1.25) return 'Gold' 
  if (multiplier >= 1.1) return 'Silver'
  return 'Bronze'
}