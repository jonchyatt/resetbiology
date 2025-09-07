"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Trophy, Target, Play, Calendar, TrendingUp, Gift } from "lucide-react"
import { PermissionGate } from "@/components/Auth/PermissionGate"
import { getRemainingTrialDays, getAccessLevel } from "@/lib/permissions"
import type { SuccessDeposit, GamificationPoint } from "@/types"

export function Dashboard() {
  const { data: session } = useSession()
  const [deposit, setDeposit] = useState<SuccessDeposit | null>(null)
  const [totalPoints, setTotalPoints] = useState(0)
  const [currentTier, setCurrentTier] = useState<'bronze' | 'silver' | 'gold' | 'platinum'>('bronze')
  const [dailyRewardAvailable, setDailyRewardAvailable] = useState(true)
  const [checkInStreak, setCheckInStreak] = useState(7)

  const userAccessLevel = getAccessLevel(session)
  const remainingTrialDays = getRemainingTrialDays(session)

  // Mock data for demonstration
  useEffect(() => {
    setDeposit({
      id: '1',
      amount: 500,
      status: 'earning',
      payoutConditions: {
        modulesRequired: 10,
        checkinsRequired: 30,
        timeframe: 90
      },
      progress: {
        modulesCompleted: 6,
        checkinStreak: 7,
        daysRemaining: 47 // Creates urgency - less than 60 days
      }
    })
    setTotalPoints(1250)
  }, [])

  const depositProgress = deposit ? 
    ((deposit.progress.modulesCompleted / deposit.payoutConditions.modulesRequired) + 
     (deposit.progress.checkinStreak / deposit.payoutConditions.checkinsRequired)) / 2 * 100 : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative"
         style={{
           backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
           backgroundSize: 'cover',
           backgroundPosition: 'center',
           backgroundAttachment: 'fixed'
         }}>
      <div className="relative z-10">
        {/* Header - Added mt-20 to create space below fixed nav (nav is h-16 = 64px) */}
        <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm shadow-2xl border-b border-primary-400/30 mt-20">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <img src="/logo1.png" alt="Reset Biology" className="h-8 w-auto mr-3 rounded-lg drop-shadow-lg bg-white/10 backdrop-blur-sm p-1 border border-white/20" />
                <div>
                  <h1 className="text-2xl font-bold text-white drop-shadow-lg">Portal</h1>
                  {session?.user && (
                    <p className="text-sm text-gray-300 drop-shadow-sm">Welcome back, {session.user.name}</p>
                  )}
                </div>
              </div>
            <div className="flex items-center space-x-4">
              {userAccessLevel === 'trial' && remainingTrialDays && (
                <div className="text-right bg-gradient-to-r from-yellow-500/20 to-orange-500/20 backdrop-blur-sm px-3 py-2 rounded-lg border border-yellow-400/50">
                  <p className="text-sm text-yellow-300 font-medium">
                    Trial: {remainingTrialDays} days left
                  </p>
                </div>
              )}
              <div className="text-right">
                <p className="text-sm text-gray-300">Access Level</p>
                <p className="font-semibold text-primary-300 capitalize">{userAccessLevel}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-300">Total Points</p>
                <p className="font-semibold text-secondary-300">{totalPoints.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-12">
          
          {/* Main Content */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Daily Check-in - Restructured for better space allocation */}
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-primary-400/30">
              <h2 className="text-xl font-bold text-white mb-4 drop-shadow-sm">📋 Daily Check-in</h2>
              <p className="text-gray-300 mb-6 text-sm">Complete your daily activities to maximize progress and earn rewards</p>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                
                {/* Core Daily Activities - Exact Breath Training Style */}
                <div className="bg-gradient-to-br from-primary-600/20 to-primary-700/30 backdrop-blur-sm p-6 rounded-xl border border-primary-400/30 shadow-2xl hover:shadow-primary-400/20 transition-all duration-300">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-white text-lg">📅 Daily Essentials</h3>
                    <Calendar className="w-6 h-6 text-primary-300" />
                  </div>
                  <p className="text-sm text-gray-300 mb-4">Current streak: {checkInStreak} days</p>
                  <div className="space-y-3">
                    <a href="/peptides" className="bg-gradient-to-br from-teal-500/20 to-teal-600/30 hover:from-teal-400/30 hover:to-teal-500/40 text-white font-medium py-3 px-4 rounded-lg w-full text-center block transition-all backdrop-blur-sm border border-teal-400/30 shadow-xl hover:shadow-teal-400/20">
                      💉 Log Peptides (+25 points)
                    </a>
                    <a href="/order" className="bg-gradient-to-br from-purple-600/20 to-purple-700/30 hover:from-purple-500/30 hover:to-purple-600/40 text-white font-medium py-3 px-4 rounded-lg w-full text-center block transition-all backdrop-blur-sm border border-purple-500/30 shadow-xl hover:shadow-purple-400/20">
                      🛒 Order Peptides
                    </a>
                    <a href="/workout" className="bg-gradient-to-br from-blue-600/20 to-blue-700/30 hover:from-blue-500/30 hover:to-blue-600/40 text-white font-medium py-3 px-4 rounded-lg w-full text-center block transition-all backdrop-blur-sm border border-blue-500/30 shadow-xl hover:shadow-blue-400/20">
                      💪 Track Workout (+50 points)
                    </a>
                    <a href="/nutrition" className="bg-gradient-to-br from-green-600/20 to-green-700/30 hover:from-green-500/30 hover:to-green-600/40 text-white font-medium py-3 px-4 rounded-lg w-full text-center block transition-all backdrop-blur-sm border border-green-500/30 shadow-xl hover:shadow-green-400/20">
                      🍎 Log Meals (+25 points)
                    </a>
                  </div>
                </div>

                {/* Mental Mastery - Major Component */}
                <PermissionGate 
                  permission="audioModules"
                  fallback={
                    <div className="bg-gradient-to-br from-primary-600/10 to-secondary-600/10 backdrop-blur-sm p-6 rounded-lg border border-gray-600/30 shadow-xl">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-gray-400 text-lg">🎧 Mental Mastery</h3>
                        <Play className="w-6 h-6 text-gray-500" />
                      </div>
                      <p className="text-sm text-gray-500 mb-4">Premium Feature</p>
                      <div className="text-center">
                        <p className="text-xs text-gray-500 mb-2">
                          {userAccessLevel === 'guest' ? 'Start your free trial' : 'Upgrade access'}
                        </p>
                      </div>
                    </div>
                  }
                >
                  <div className="bg-gradient-to-br from-amber-600/20 to-amber-700/30 backdrop-blur-sm p-6 rounded-lg border border-amber-400/30 shadow-xl hover:shadow-amber-400/20 transition-all duration-300">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-white text-lg">🎧 Mental Mastery</h3>
                      <Play className="w-6 h-6 text-amber-400" />
                    </div>
                    <p className="text-sm text-gray-300 mb-4">Next: &ldquo;Mental Mastery Module 1&rdquo;</p>
                    <a href="/audio" className="bg-gradient-to-br from-amber-500/20 to-amber-600/30 hover:from-amber-400/30 hover:to-amber-500/40 text-white font-bold py-4 px-4 rounded-lg w-full text-center block transition-all hover:scale-105 shadow-xl backdrop-blur-sm border border-amber-400/30 hover:shadow-amber-400/20">
                      Start Module (+100 points)
                    </a>
                  </div>
                </PermissionGate>

                {/* Breath Training - Major Component */}
                <div className="bg-gradient-to-br from-green-600/20 to-green-700/30 backdrop-blur-sm p-6 rounded-lg border border-green-500/30 shadow-xl hover:shadow-green-400/20 transition-all duration-300">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-white text-lg">🌬️ Breath Training</h3>
                    <TrendingUp className="w-6 h-6 text-green-500" />
                  </div>
                  <p className="text-sm text-gray-300 mb-4">Production-grade breathing app with precise timing & data tracking</p>
                  <a href="/breath" className="bg-gradient-to-br from-green-600/20 to-green-700/30 hover:from-green-500/30 hover:to-green-600/40 text-white font-bold py-4 px-4 rounded-lg w-full text-center block transition-all hover:scale-105 shadow-xl backdrop-blur-sm border border-green-500/30 hover:shadow-green-400/20">
                    Launch Breath App (+50 points)
                  </a>
                </div>

              </div>
            </div>
            
            {/* Partner Stake - Shrunk (not yet coded system) */}
            {deposit && (
              <div className="bg-gradient-to-br from-yellow-600/20 to-yellow-700/30 backdrop-blur-sm rounded-xl p-4 shadow-xl border border-yellow-400/30">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-white">🎯 Partner Stake: ${deposit.amount}</h3>
                  <div className="text-xs text-yellow-300">{deposit.progress.daysRemaining} Days Left</div>
                </div>
                <div className="h-2 bg-gray-900/50 rounded-full overflow-hidden relative backdrop-blur-sm border border-gray-600/30">
                  <div 
                    className="h-full bg-gradient-to-r from-green-500/70 to-green-600/70 rounded-full transition-all duration-1000 shadow-lg shadow-green-500/30"
                    style={{ width: `${depositProgress}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-300 mt-1">
                  <span>${Math.round(deposit.amount * (depositProgress / 100))} Secured</span>
                  <span>${Math.round(deposit.amount * ((100 - depositProgress) / 100))} At Risk</span>
                </div>
              </div>
            )}


            {/* Progress Overview */}
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-primary-400/30">
              <h2 className="text-xl font-bold text-white mb-4 drop-shadow-sm">Your Progress Journey</h2>
              
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h3 className="font-semibold text-gray-200 mb-3">Mental Mastery Modules</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Foundation Phase</span>
                      <span className="text-primary-600">6/10 Complete</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: '60%' }}></div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold text-gray-200 mb-3">Metabolic Metrics</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Energy Level</span>
                      <span className="text-secondary-600">8.2/10</span>
                    </div>
                    <div className="progress-bar">
                      <div className="bg-gradient-to-r from-secondary-400/70 to-secondary-500/70 h-full rounded-full transition-all duration-500 shadow-lg shadow-secondary-400/30" style={{ width: '82%' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Daily Spinner - Small Side Note */}
            {dailyRewardAvailable && (
              <div className="bg-gradient-to-br from-amber-600/20 to-amber-700/30 backdrop-blur-sm rounded-xl p-4 border border-amber-400/30 shadow-2xl hover:shadow-amber-400/20 transition-all duration-300">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-white text-sm">🎰 Daily Spinner</h4>
                  <Gift className="w-5 h-5 text-amber-400" />
                </div>
                <p className="text-xs text-gray-300 mb-3">Win 5-50 bonus points!</p>
                <button className="bg-gradient-to-br from-amber-500/20 to-amber-600/30 hover:from-amber-400/30 hover:to-amber-500/40 text-white font-semibold py-2 px-4 rounded-lg w-full text-xs transition-all shadow-xl backdrop-blur-sm border border-amber-400/30 hover:shadow-amber-400/20">
                  Spin Now ✨
                </button>
              </div>
            )}

            {/* Achievement Status */}
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-primary-400/30">
              <h3 className="text-lg font-bold text-white mb-4 drop-shadow-sm">Achievement Status</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-200">Bronze Tier</span>
                  <Trophy className="w-5 h-5 text-yellow-400" />
                </div>
                
                <div className="text-sm text-gray-500">
                  <p>Next: Silver Tier</p>
                  <div className="progress-bar mt-1">
                    <div className="progress-fill" style={{ width: '83%' }}></div>
                  </div>
                  <p className="mt-1">250 points to go</p>
                </div>

                <div className="bg-gradient-to-br from-primary-500/20 to-primary-600/30 p-3 rounded-lg border border-primary-400/30 shadow-xl backdrop-blur-sm hover:shadow-primary-400/20 transition-all duration-300">
                  <p className="text-sm text-white">
                    <strong>Silver Tier Benefits:</strong><br />
                    110% deposit return + free consultation
                  </p>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-primary-400/30">
              <h3 className="text-lg font-bold text-white mb-4 drop-shadow-sm">Recent Activity</h3>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-200">Module: &ldquo;Food Freedom&rdquo;</span>
                  <span className="text-secondary-400 font-semibold">+100 pts</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">7-day check-in streak</span>
                  <span className="text-primary-600 font-semibold">+50 pts</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Daily spinner</span>
                  <span className="text-yellow-600 font-semibold">+25 pts</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Breath session completed</span>
                  <span className="text-gray-600 font-semibold">+50 pts</span>
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