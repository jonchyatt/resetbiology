"use client"

import { useState, useEffect } from "react"
import { RotateCw, Sparkles, Trophy, Gift, Zap } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface SpinnerReward {
  pointValue: number
  probability: number
  displayText: string
  celebrationLevel: 'small' | 'medium' | 'jackpot'
  color: string
}

interface DailySpinnerProps {
  userId: string
  streakMultiplier?: number
  onRewardClaimed?: (reward: SpinnerReward) => void
}

export function DailySpinner({ userId, streakMultiplier = 1.0, onRewardClaimed }: DailySpinnerProps) {
  const [isSpinning, setIsSpinning] = useState(false)
  const [hasSpunToday, setHasSpunToday] = useState(false)
  const [currentReward, setCurrentReward] = useState<SpinnerReward | null>(null)
  const [showCelebration, setShowCelebration] = useState(false)
  const [spinRotation, setSpinRotation] = useState(0)
  const [nearMissMessage, setNearMissMessage] = useState<string | null>(null)

  // Variable ratio reward table (optimized for addiction)
  const rewardTable: SpinnerReward[] = [
    { pointValue: 5, probability: 0.40, displayText: "Keep Going!", celebrationLevel: 'small', color: 'bg-gray-400' },
    { pointValue: 15, probability: 0.30, displayText: "Nice Work!", celebrationLevel: 'small', color: 'bg-blue-400' },
    { pointValue: 30, probability: 0.15, displayText: "Great Job!", celebrationLevel: 'medium', color: 'bg-green-400' },
    { pointValue: 50, probability: 0.10, displayText: "Excellent!", celebrationLevel: 'medium', color: 'bg-yellow-400' },
    { pointValue: 100, probability: 0.04, displayText: "AMAZING!", celebrationLevel: 'jackpot', color: 'bg-orange-400' },
    { pointValue: 500, probability: 0.01, displayText: "JACKPOT!", celebrationLevel: 'jackpot', color: 'bg-red-400' }
  ]

  useEffect(() => {
    // Check if user has spun today (mock localStorage check)
    const lastSpin = localStorage.getItem(`lastSpin_${userId}`)
    const today = new Date().toDateString()
    setHasSpunToday(lastSpin === today)
  }, [userId])

  const calculateNearMiss = (actualReward: SpinnerReward) => {
    // Create near-miss psychology for non-jackpot spins
    if (actualReward.pointValue < 100) {
      const chance = Math.random()
      if (chance < 0.3) { // 30% chance of near-miss message
        return "You were ONE SPOT away from the 500-point JACKPOT! 🎯"
      } else if (chance < 0.6) {
        return "So close to the 100-point bonus! Try again tomorrow! ⚡"
      }
    }
    return null
  }

  const selectReward = (): SpinnerReward => {
    const random = Math.random()
    let cumulativeProbability = 0
    
    for (const reward of rewardTable) {
      cumulativeProbability += reward.probability
      if (random <= cumulativeProbability) {
        return reward
      }
    }
    
    // Fallback (should never hit)
    return rewardTable[0]
  }

  const handleSpin = async () => {
    if (hasSpunToday || isSpinning) return

    setIsSpinning(true)
    setNearMissMessage(null)
    
    // Spinner animation
    const reward = selectReward()
    const targetRotation = spinRotation + 1440 + Math.random() * 360 // 4+ full rotations
    setSpinRotation(targetRotation)
    
    // Wait for spin animation
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // Apply streak multiplier
    const finalPoints = Math.round(reward.pointValue * streakMultiplier)
    const finalReward = { ...reward, pointValue: finalPoints }
    
    setCurrentReward(finalReward)
    setShowCelebration(true)
    setIsSpinning(false)
    setHasSpunToday(true)
    
    // Store spin date
    localStorage.setItem(`lastSpin_${userId}`, new Date().toDateString())
    
    // Generate near-miss psychology
    const nearMiss = calculateNearMiss(reward)
    if (nearMiss) {
      setTimeout(() => setNearMissMessage(nearMiss), 2000)
    }
    
    // Call parent handler
    onRewardClaimed?.(finalReward)
    
    // TODO: Save to database
    console.log('Daily spin completed:', {
      userId,
      basePoints: reward.pointValue,
      streakMultiplier,
      finalPoints,
      celebrationLevel: reward.celebrationLevel
    })
  }

  const formatTimeUntilNextSpin = () => {
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    
    const msUntilTomorrow = tomorrow.getTime() - now.getTime()
    const hoursLeft = Math.floor(msUntilTomorrow / (1000 * 60 * 60))
    const minutesLeft = Math.floor((msUntilTomorrow % (1000 * 60 * 60)) / (1000 * 60))
    
    return `${hoursLeft}h ${minutesLeft}m`
  }

  return (
    <div className="bg-gradient-to-br from-yellow-400 via-orange-400 to-red-400 rounded-lg p-6 text-white shadow-xl">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center mb-2">
          <Sparkles className="w-6 h-6 mr-2" />
          <h2 className="text-2xl font-bold">Daily Reward Spinner</h2>
        </div>
        <p className="text-orange-100">
          Win 5-500 bonus points! {streakMultiplier > 1 && `${streakMultiplier}x streak bonus active!`}
        </p>
      </div>

      {/* Spinner Wheel */}
      <div className="relative mb-6">
        <div className="w-48 h-48 mx-auto relative">
          {/* Spinner Wheel */}
          <motion.div
            className="w-full h-full rounded-full border-8 border-white shadow-2xl"
            style={{
              background: 'conic-gradient(from 0deg, #ef4444 0deg 36deg, #f97316 36deg 108deg, #eab308 108deg 162deg, #22c55e 162deg 198deg, #3b82f6 198deg 234deg, #8b5cf6 234deg 360deg)',
              rotate: spinRotation
            }}
            animate={{ rotate: spinRotation }}
            transition={{ duration: 3, ease: "easeOut" }}
          >
            {/* Reward segments (visual only) */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-white font-bold text-lg">
                {isSpinning ? '...' : '🎯'}
              </div>
            </div>
          </motion.div>
          
          {/* Pointer */}
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-2">
            <div className="w-6 h-8 bg-white rounded-b-lg shadow-lg border-2 border-gray-300 flex items-end justify-center">
              <div className="w-2 h-2 bg-gray-800 rounded-full mb-1"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Spin Button or Result */}
      <div className="text-center">
        {!hasSpunToday ? (
          <button
            onClick={handleSpin}
            disabled={isSpinning}
            className={`px-8 py-4 rounded-lg font-bold text-lg transition-all ${
              isSpinning
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-white text-orange-600 hover:bg-gray-100 shadow-lg hover:shadow-xl transform hover:scale-105'
            }`}
          >
            {isSpinning ? (
              <div className="flex items-center">
                <RotateCw className="w-5 h-5 mr-2 animate-spin" />
                Spinning...
              </div>
            ) : (
              <div className="flex items-center">
                <Gift className="w-5 h-5 mr-2" />
                Spin for Rewards! ✨
              </div>
            )}
          </button>
        ) : (
          <div className="space-y-4">
            <div className="bg-white/20 rounded-lg p-4">
              <h3 className="font-bold text-lg mb-2">✅ Today's Spin Complete!</h3>
              <p className="text-orange-100">
                Come back tomorrow for another chance to win big!
              </p>
              <p className="text-orange-200 text-sm mt-2">
                Next spin in: {formatTimeUntilNextSpin()}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Reward Celebration */}
      <AnimatePresence>
        {showCelebration && currentReward && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowCelebration(false)}
          >
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-white rounded-lg p-8 text-center max-w-md mx-4 shadow-2xl"
            >
              <div className="mb-4">
                {currentReward.celebrationLevel === 'jackpot' && (
                  <div className="text-6xl mb-2">🎰</div>
                )}
                {currentReward.celebrationLevel === 'medium' && (
                  <div className="text-5xl mb-2">🎉</div>
                )}
                {currentReward.celebrationLevel === 'small' && (
                  <div className="text-4xl mb-2">⭐</div>
                )}
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {currentReward.displayText}
              </h2>
              
              <div className="text-4xl font-bold text-primary-600 mb-4">
                +{currentReward.pointValue} Points!
              </div>
              
              {streakMultiplier > 1 && (
                <div className="bg-primary-50 p-3 rounded-lg mb-4">
                  <p className="text-primary-800 font-semibold">
                    🔥 Streak Bonus Applied: {streakMultiplier}x multiplier!
                  </p>
                </div>
              )}
              
              <button
                onClick={() => setShowCelebration(false)}
                className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-semibold transition-colors"
              >
                Awesome! 🚀
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Near Miss Psychology */}
      {nearMissMessage && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 bg-white/20 rounded-lg p-3 text-center"
        >
          <p className="text-orange-100 text-sm font-semibold">
            {nearMissMessage}
          </p>
        </motion.div>
      )}

      {/* Reward Table Psychology */}
      <div className="mt-6 bg-white/10 rounded-lg p-4">
        <h3 className="font-bold text-white mb-3">🎰 Today's Possible Rewards</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {rewardTable.map((reward, index) => (
            <div key={index} className="flex justify-between text-orange-100">
              <span>{reward.pointValue} pts</span>
              <span>{Math.round(reward.probability * 100)}% chance</span>
            </div>
          ))}
        </div>
        
        {streakMultiplier > 1 && (
          <div className="mt-3 pt-3 border-t border-white/20">
            <p className="text-orange-200 text-xs text-center">
              🔥 Your {Math.round((streakMultiplier - 1) * 100)}% streak bonus applies to all rewards!
            </p>
          </div>
        )}
      </div>

      {/* Addiction Psychology Footer */}
      <div className="mt-4 text-center">
        <p className="text-orange-200 text-xs">
          💡 Daily spins reset at midnight • Streaks multiply your rewards • Consistency pays!
        </p>
      </div>
    </div>
  )
}

export function SpinnerHistory({ spins }: { spins: any[] }) {
  const totalSpins = spins.length
  const totalPointsEarned = spins.reduce((sum, spin) => sum + spin.pointsEarned, 0)
  const averageReward = Math.round(totalPointsEarned / Math.max(totalSpins, 1))
  const bestSpin = Math.max(...spins.map(s => s.pointsEarned), 0)

  return (
    <div className="bg-white rounded-lg p-6 shadow-md">
      <h3 className="text-lg font-bold text-gray-900 mb-4">🎰 Your Spinner History</h3>
      
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <div className="text-center p-3 bg-yellow-50 rounded-lg">
          <div className="text-xl font-bold text-yellow-600">{totalSpins}</div>
          <div className="text-sm text-yellow-800">Total Spins</div>
        </div>
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <div className="text-xl font-bold text-green-600">{totalPointsEarned.toLocaleString()}</div>
          <div className="text-sm text-green-800">Points Won</div>
        </div>
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <div className="text-xl font-bold text-blue-600">{averageReward}</div>
          <div className="text-sm text-blue-800">Avg Reward</div>
        </div>
        <div className="text-center p-3 bg-red-50 rounded-lg">
          <div className="text-xl font-bold text-red-600">{bestSpin}</div>
          <div className="text-sm text-red-800">Best Spin</div>
        </div>
      </div>

      {/* Recent Spins */}
      {spins.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-semibold text-gray-900">Recent Spins</h4>
          {spins.slice(-7).reverse().map((spin, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-3 ${
                  spin.pointsEarned >= 100 ? 'bg-red-400' :
                  spin.pointsEarned >= 50 ? 'bg-orange-400' :
                  spin.pointsEarned >= 30 ? 'bg-yellow-400' :
                  spin.pointsEarned >= 15 ? 'bg-green-400' : 'bg-gray-400'
                }`}></div>
                <span className="text-sm font-medium">
                  {new Date(spin.spinDate).toLocaleDateString()}
                </span>
                {spin.streakMultiplier > 1 && (
                  <span className="ml-2 bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs">
                    {spin.streakMultiplier}x streak
                  </span>
                )}
              </div>
              <div className="font-bold text-primary-600">
                +{spin.pointsEarned} pts
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Streak Psychology */}
      {totalSpins >= 7 && (
        <div className="mt-6 bg-gradient-to-r from-orange-400 to-red-400 text-white p-4 rounded-lg text-center">
          <h4 className="font-bold mb-2">🔥 Spinner Streak Champion!</h4>
          <p className="text-sm text-orange-100">
            {totalSpins} consecutive daily spins! Your consistency is paying off. 
            Don't break your streak tomorrow!
          </p>
        </div>
      )}
    </div>
  )
}