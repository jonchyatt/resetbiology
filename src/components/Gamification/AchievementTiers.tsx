"use client"

import { useState, useEffect } from "react"
import { Trophy, Star, Crown, Diamond, TrendingUp, Gift, Lock } from "lucide-react"
import { motion } from "framer-motion"

interface TierBenefits {
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum'
  multiplier: number
  pointsRequired: number
  color: string
  icon: any
  benefits: string[]
  exclusiveFeatures: string[]
  psychologyMessage: string
}

interface AchievementTiersProps {
  currentPoints: number
  completedModules: number
  checkInStreak: number
  onTierUnlock?: (tier: string) => void
}

export function AchievementTiers({ 
  currentPoints, 
  completedModules, 
  checkInStreak, 
  onTierUnlock 
}: AchievementTiersProps) {
  const [currentTier, setCurrentTier] = useState<TierBenefits | null>(null)
  const [showTierUnlock, setShowTierUnlock] = useState(false)

  const tierSystem: TierBenefits[] = [
    {
      tier: 'Bronze',
      multiplier: 1.0,
      pointsRequired: 0,
      color: 'yellow',
      icon: Trophy,
      benefits: [
        '100% stake return guaranteed',
        'Access to Foundation modules',
        'Basic progress tracking',
        'Email support'
      ],
      exclusiveFeatures: [
        'Partner status recognition',
        'Progress milestone celebrations'
      ],
      psychologyMessage: 'You\'ve secured your foundation. Every step forward protects your investment.'
    },
    {
      tier: 'Silver',
      multiplier: 1.1,
      pointsRequired: 1500,
      color: 'gray',
      icon: Star,
      benefits: [
        '110% stake return (10% bonus!)',
        'Access to Integration modules',
        'Priority email support',
        'Group coaching calls access'
      ],
      exclusiveFeatures: [
        'Silver partner badge in community',
        'Early access to new modules',
        'Bonus reward multipliers'
      ],
      psychologyMessage: 'You\'re outperforming 70% of participants. Don\'t let others catch up.'
    },
    {
      tier: 'Gold',
      multiplier: 1.25,
      pointsRequired: 3500,
      color: 'yellow',
      icon: Crown,
      benefits: [
        '125% stake return (25% bonus!)',
        'All Mastery modules unlocked',
        'Direct coach messaging',
        'Monthly 1:1 coaching call'
      ],
      exclusiveFeatures: [
        'Gold partner status (top 20%)',
        'Exclusive mastermind group',
        'Advanced protocol access',
        'Helper/mentor opportunities'
      ],
      psychologyMessage: 'Elite performance deserves elite rewards. You\'re in the top 20%.'
    },
    {
      tier: 'Platinum',
      multiplier: 1.5,
      pointsRequired: 7500,
      color: 'purple',
      icon: Diamond,
      benefits: [
        '150% stake return (50% bonus!)',
        'Lifetime access to all content',
        'Weekly 1:1 coaching',
        'Co-coaching certification path'
      ],
      exclusiveFeatures: [
        'Platinum partner (top 5%)',
        'Revenue sharing opportunities',
        'Speaking/testimonial invitations',
        'Become a Reset Biology affiliate coach'
      ],
      psychologyMessage: 'You\'ve achieved mastery. Time to help others and earn ongoing income.'
    }
  ]

  useEffect(() => {
    // Calculate current tier based on points and activities
    const tierScore = currentPoints + (completedModules * 100) + (checkInStreak * 10)
    
    let newTier = tierSystem[0] // Default to Bronze
    for (let i = tierSystem.length - 1; i >= 0; i--) {
      if (tierScore >= tierSystem[i].pointsRequired) {
        newTier = tierSystem[i]
        break
      }
    }
    
    // Check for tier upgrade
    if (currentTier && currentTier.tier !== newTier.tier) {
      setShowTierUnlock(true)
      onTierUnlock?.(newTier.tier)
    }
    
    setCurrentTier(newTier)
  }, [currentPoints, completedModules, checkInStreak, currentTier, onTierUnlock])

  const getCurrentScore = () => {
    return currentPoints + (completedModules * 100) + (checkInStreak * 10)
  }

  const getNextTier = () => {
    const currentScore = getCurrentScore()
    return tierSystem.find(tier => tier.pointsRequired > currentScore)
  }

  const getProgressToNextTier = () => {
    const nextTier = getNextTier()
    if (!nextTier) return 100 // Already at max tier
    
    const currentScore = getCurrentScore()
    const progress = (currentScore / nextTier.pointsRequired) * 100
    return Math.min(progress, 100)
  }

  if (!currentTier) return null

  const nextTier = getNextTier()
  const progressPercent = getProgressToNextTier()

  return (
    <div className="space-y-6">
      {/* Current Tier Display */}
      <div className={`bg-gradient-to-br from-${currentTier.color}-400 to-${currentTier.color}-500 text-white rounded-lg p-6 shadow-xl`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <currentTier.icon className="w-8 h-8 mr-3" />
            <div>
              <h2 className="text-2xl font-bold">{currentTier.tier} Partner</h2>
              <p className="text-sm opacity-90">{currentTier.multiplier}x Stake Multiplier</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{getCurrentScore().toLocaleString()}</div>
            <div className="text-sm opacity-90">Total Score</div>
          </div>
        </div>
        
        <p className={`text-${currentTier.color}-100 text-center italic`}>
          {currentTier.psychologyMessage}
        </p>
      </div>

      {/* Progress to Next Tier */}
      {nextTier && (
        <div className="bg-white rounded-lg p-6 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">
              Progress to {nextTier.tier} Partner
            </h3>
            <div className="text-sm text-gray-500">
              {Math.round(progressPercent)}% Complete
            </div>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-4 mb-4 overflow-hidden">
            <motion.div 
              className={`bg-gradient-to-r from-${nextTier.color}-400 to-${nextTier.color}-500 h-4 rounded-full transition-all duration-1000`}
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
            />
          </div>
          
          <div className="grid gap-4 md:grid-cols-3 text-sm">
            <div className="text-center">
              <div className="font-bold text-gray-900">{nextTier.pointsRequired - getCurrentScore()}</div>
              <div className="text-gray-600">Points Needed</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-primary-600">+{Math.round((nextTier.multiplier - currentTier.multiplier) * 100)}%</div>
              <div className="text-gray-600">Bonus Increase</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-green-600">${Math.round(500 * (nextTier.multiplier - currentTier.multiplier))}</div>
              <div className="text-gray-600">Extra Earnings</div>
            </div>
          </div>
          
          {/* Loss Aversion Psychology */}
          <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="text-yellow-800 text-sm font-semibold">
              ⚠️ Don't let others reach {nextTier.tier} first! Only the top performers unlock these exclusive benefits.
            </p>
          </div>
        </div>
      )}

      {/* All Tiers Overview */}
      <div className="bg-white rounded-lg p-6 shadow-md">
        <h3 className="text-lg font-bold text-gray-900 mb-6">🏆 Partner Tier System</h3>
        
        <div className="space-y-4">
          {tierSystem.map((tier, index) => {
            const isCurrentTier = currentTier.tier === tier.tier
            const isUnlocked = getCurrentScore() >= tier.pointsRequired
            const IconComponent = tier.icon
            
            return (
              <div key={tier.tier} className={`p-4 rounded-lg border transition-all ${
                isCurrentTier 
                  ? `border-${tier.color}-400 bg-${tier.color}-50 ring-2 ring-${tier.color}-200` 
                  : isUnlocked 
                    ? 'border-green-200 bg-green-50'
                    : 'border-gray-200 bg-gray-50'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <IconComponent className={`w-6 h-6 mr-3 ${
                      isCurrentTier ? `text-${tier.color}-600` :
                      isUnlocked ? 'text-green-600' : 'text-gray-400'
                    }`} />
                    <div>
                      <h4 className={`text-lg font-bold ${
                        isCurrentTier ? `text-${tier.color}-800` :
                        isUnlocked ? 'text-green-800' : 'text-gray-600'
                      }`}>
                        {tier.tier} Partner
                      </h4>
                      <p className="text-sm text-gray-600">
                        {tier.pointsRequired.toLocaleString()} points • {tier.multiplier}x stake return
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    {isCurrentTier && (
                      <span className={`px-3 py-1 rounded-full text-xs font-bold bg-${tier.color}-500 text-white`}>
                        CURRENT
                      </span>
                    )}
                    {isUnlocked && !isCurrentTier && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-500 text-white">
                        UNLOCKED
                      </span>
                    )}
                    {!isUnlocked && (
                      <Lock className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h5 className="font-semibold text-gray-900 mb-2">Core Benefits</h5>
                    <ul className="text-sm text-gray-700 space-y-1">
                      {tier.benefits.map((benefit, i) => (
                        <li key={i} className="flex items-center">
                          <span className="w-1.5 h-1.5 bg-primary-400 rounded-full mr-2"></span>
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div>
                    <h5 className="font-semibold text-gray-900 mb-2">Exclusive Features</h5>
                    <ul className="text-sm text-gray-700 space-y-1">
                      {tier.exclusiveFeatures.map((feature, i) => (
                        <li key={i} className="flex items-center">
                          <Star className="w-3 h-3 text-yellow-500 mr-2" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                
                {isCurrentTier && (
                  <div className={`mt-4 p-3 bg-${tier.color}-100 rounded-lg border border-${tier.color}-200`}>
                    <p className={`text-${tier.color}-800 text-sm font-medium text-center`}>
                      🎯 {tier.psychologyMessage}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Competitive Psychology */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg p-6 text-center">
        <h3 className="text-xl font-bold mb-4">🚀 Exclusive Partner Leaderboard</h3>
        
        <div className="grid gap-4 md:grid-cols-3 mb-4">
          <div className="bg-white/20 rounded-lg p-3">
            <div className="text-2xl font-bold">23%</div>
            <div className="text-sm text-purple-100">In Silver+ Tier</div>
          </div>
          <div className="bg-white/20 rounded-lg p-3">
            <div className="text-2xl font-bold">7%</div>
            <div className="text-sm text-purple-100">In Gold+ Tier</div>
          </div>
          <div className="bg-white/20 rounded-lg p-3">
            <div className="text-2xl font-bold">2%</div>
            <div className="text-sm text-purple-100">Platinum Elite</div>
          </div>
        </div>
        
        <p className="text-purple-100 text-sm">
          You're currently performing better than <strong>
            {currentTier?.tier === 'Bronze' && '0%'}
            {currentTier?.tier === 'Silver' && '77%'}
            {currentTier?.tier === 'Gold' && '93%'}
            {currentTier?.tier === 'Platinum' && '98%'}
          </strong> of all partners. Keep climbing!
        </p>
      </div>

      {/* Tier Unlock Celebration */}
      {showTierUnlock && currentTier && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowTierUnlock(false)}
        >
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-white rounded-lg p-8 text-center max-w-md mx-4 shadow-2xl"
          >
            <div className="mb-6">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {currentTier.tier} Partner Unlocked!
              </h2>
              <div className="text-4xl font-bold text-primary-600 mb-2">
                {currentTier.multiplier}x Multiplier
              </div>
              <p className="text-gray-600">
                You've earned {Math.round((currentTier.multiplier - 1) * 100)}% bonus on your stake!
              </p>
            </div>
            
            <div className="bg-primary-50 p-4 rounded-lg mb-6">
              <h3 className="font-semibold text-primary-800 mb-2">New Benefits Unlocked:</h3>
              <ul className="text-sm text-primary-700 space-y-1">
                {currentTier.exclusiveFeatures.slice(0, 2).map((feature, i) => (
                  <li key={i}>• {feature}</li>
                ))}
              </ul>
            </div>
            
            <button
              onClick={() => setShowTierUnlock(false)}
              className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-semibold transition-colors"
            >
              Claim Benefits! 🚀
            </button>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}

export function TierProgressWidget({ currentTier, nextTier, progress }: {
  currentTier: string
  nextTier?: string
  progress: number
}) {
  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Bronze': return 'yellow'
      case 'Silver': return 'gray'
      case 'Gold': return 'yellow'
      case 'Platinum': return 'purple'
      default: return 'gray'
    }
  }

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'Bronze': return Trophy
      case 'Silver': return Star
      case 'Gold': return Crown
      case 'Platinum': return Diamond
      default: return Trophy
    }
  }

  const CurrentIcon = getTierIcon(currentTier)
  const color = getTierColor(currentTier)

  return (
    <div className="bg-white rounded-lg p-4 shadow-md">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <CurrentIcon className={`w-5 h-5 text-${color}-600 mr-2`} />
          <span className="font-semibold text-gray-900">{currentTier} Partner</span>
        </div>
        
        {nextTier && (
          <span className="text-sm text-gray-500">
            → {nextTier}
          </span>
        )}
      </div>
      
      {nextTier && (
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Progress to {nextTier}</span>
            <span className="font-semibold">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`bg-gradient-to-r from-${getTierColor(nextTier)}-400 to-${getTierColor(nextTier)}-500 h-2 rounded-full transition-all duration-500`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
      
      {!nextTier && (
        <div className="text-center">
          <span className="text-sm font-semibold text-purple-600">
            🏆 Maximum Tier Achieved!
          </span>
        </div>
      )}
    </div>
  )
}