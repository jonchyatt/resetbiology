"use client"

import { useState } from "react"
import { Trophy, Target, Play, Calendar, TrendingUp, Gift } from "lucide-react"

export function Dashboard() {
  const [totalPoints] = useState(150)
  const [currentTier] = useState<'bronze' | 'silver' | 'gold' | 'platinum'>('bronze')
  const [dailyRewardAvailable] = useState(true)
  const [checkInStreak] = useState(7)

  // For now, mock user access level
  const userAccessLevel = 'trial'
  const remainingTrialDays = 14

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative"
         style={{
           backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
           backgroundSize: 'cover',
           backgroundPosition: 'center',
           backgroundAttachment: 'fixed'
         }}>
      <div className="relative z-10">
        {/* Portal Header */}
        <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm shadow-2xl border-b border-primary-400/30">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <img src="/logo1.png" alt="Reset Biology" className="h-8 w-auto mr-3 rounded-lg drop-shadow-lg bg-white/10 backdrop-blur-sm p-1 border border-white/20" />
                <div>
                  <h1 className="text-xl font-bold text-white drop-shadow-lg">Portal</h1>
                  <span className="text-lg text-gray-200 drop-shadow-sm">• Dashboard</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <a href="/breath" className="text-primary-300 hover:text-primary-200 font-medium text-sm transition-colors drop-shadow-sm">
                  Breath Training
                </a>
                <a href="/peptides" className="text-primary-300 hover:text-primary-200 font-medium text-sm transition-colors drop-shadow-sm">
                  Peptides
                </a>
                <a href="/nutrition" className="text-primary-300 hover:text-primary-200 font-medium text-sm transition-colors drop-shadow-sm">
                  Nutrition
                </a>
              </div>
            </div>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Welcome Header */}
          <div className="mb-8">
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-primary-400/30">
              <h1 className="text-2xl font-bold text-white mb-2 drop-shadow-lg">
                Welcome to Reset Biology Portal
              </h1>
              <p className="text-gray-200 drop-shadow-sm">
                Track your progress, access training materials, and manage your wellness journey.
              </p>
              {userAccessLevel === 'trial' && (
                <div className="mt-4 p-3 bg-primary-600/20 rounded-lg border border-primary-400/30">
                  <p className="text-sm text-primary-200">
                    <strong>Trial Account:</strong> {remainingTrialDays} days remaining
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-primary-400/30">
              <div className="flex items-center">
                <div className="p-2 bg-primary-600/30 rounded-lg border border-primary-400/40">
                  <Trophy className="w-6 h-6 text-primary-300" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-300">Total Points</p>
                  <p className="text-2xl font-bold text-white">{totalPoints}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-primary-400/30">
              <div className="flex items-center">
                <div className="p-2 bg-amber-600/30 rounded-lg border border-amber-400/40">
                  <Target className="w-6 h-6 text-amber-300" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-300">Current Tier</p>
                  <p className="text-2xl font-bold text-white capitalize">{currentTier}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-primary-400/30">
              <div className="flex items-center">
                <div className="p-2 bg-green-600/30 rounded-lg border border-green-400/40">
                  <Calendar className="w-6 h-6 text-green-300" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-300">Check-in Streak</p>
                  <p className="text-2xl font-bold text-white">{checkInStreak} days</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-primary-400/30">
              <div className="flex items-center">
                <div className="p-2 bg-purple-600/30 rounded-lg border border-purple-400/40">
                  <Gift className="w-6 h-6 text-purple-300" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-300">Daily Reward</p>
                  <p className="text-sm font-bold text-green-300">
                    {dailyRewardAvailable ? 'Available!' : 'Claimed'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-primary-400/30">
              <h2 className="text-lg font-bold text-white mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <a href="/breath" className="w-full flex items-center p-3 text-left rounded-lg hover:bg-primary-600/30 transition-colors border border-primary-400/20">
                  <Play className="w-5 h-5 text-primary-300 mr-3" />
                  <div>
                    <p className="font-medium text-white">Start Breath Training</p>
                    <p className="text-sm text-gray-300">Begin your daily breathing exercises</p>
                  </div>
                </a>
                
                <a href="/peptides" className="w-full flex items-center p-3 text-left rounded-lg hover:bg-primary-600/30 transition-colors border border-primary-400/20">
                  <TrendingUp className="w-5 h-5 text-blue-300 mr-3" />
                  <div>
                    <p className="font-medium text-white">View Progress</p>
                    <p className="text-sm text-gray-300">Check your wellness journey metrics</p>
                  </div>
                </a>
                
                <a href="/nutrition" className="w-full flex items-center p-3 text-left rounded-lg hover:bg-primary-600/30 transition-colors border border-primary-400/20">
                  <Calendar className="w-5 h-5 text-green-300 mr-3" />
                  <div>
                    <p className="font-medium text-white">Nutrition Tracking</p>
                    <p className="text-sm text-gray-300">Plan and track your meals</p>
                  </div>
                </a>
              </div>
            </div>

            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-primary-400/30">
              <h2 className="text-lg font-bold text-white mb-4">Recent Activity</h2>
              <div className="space-y-3">
                <div className="flex items-center p-3 rounded-lg bg-primary-600/20 border border-primary-400/30">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-3"></div>
                  <div>
                    <p className="text-sm font-medium text-white">Completed breath session</p>
                    <p className="text-xs text-gray-300">2 hours ago</p>
                  </div>
                </div>
                
                <div className="flex items-center p-3 rounded-lg bg-primary-600/20 border border-primary-400/30">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mr-3"></div>
                  <div>
                    <p className="text-sm font-medium text-white">Earned 25 points</p>
                    <p className="text-xs text-gray-300">1 day ago</p>
                  </div>
                </div>
                
                <div className="flex items-center p-3 rounded-lg bg-primary-600/20 border border-primary-400/30">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full mr-3"></div>
                  <div>
                    <p className="text-sm font-medium text-white">Achieved 7-day streak</p>
                    <p className="text-xs text-gray-300">3 days ago</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}