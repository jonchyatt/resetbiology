"use client"

import { useState } from "react"
import { Trophy, Target, Play, Calendar, TrendingUp, Gift } from "lucide-react"
import { PortalHeader } from "@/components/Navigation/PortalHeader"

export function Dashboard() {
  const [totalPoints] = useState(0)
  const [currentTier] = useState<'bronze' | 'silver' | 'gold' | 'platinum'>('bronze')
  const [dailyRewardAvailable] = useState(true)
  const [checkInStreak] = useState(0)

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
        <PortalHeader 
          section="Dashboard"
          subtitle="Your comprehensive wellness command center"
        />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Dynamic Portal Title */}
          <div className="text-center py-8">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 text-shadow-lg animate-fade-in">
              <span className="text-primary-400">Wellness</span> Command Center
            </h2>
            <p className="text-xl md:text-2xl text-gray-200 max-w-4xl mx-auto font-medium leading-relaxed drop-shadow-sm mb-6">
              Your comprehensive dashboard for metabolic optimization and wellness tracking
            </p>
            {userAccessLevel === 'trial' && (
              <div className="max-w-md mx-auto card-hover-secondary">
                <p className="text-primary-200 font-medium">
                  <strong>Trial Account:</strong> {remainingTrialDays} days remaining to upgrade
                </p>
              </div>
            )}
          </div>

          {/* Core Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="stat-card-hover p-6">
              <div className="flex items-center">
                <div className="p-2 bg-primary-600/30 rounded-lg border border-primary-400/40">
                  <Trophy className="w-6 h-6 text-primary-300" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-300">Breath Sessions</p>
                  <p className="text-2xl font-bold text-white">0</p>
                </div>
              </div>
            </div>

            <div className="stat-card-hover p-6">
              <div className="flex items-center">
                <div className="p-2 bg-amber-600/30 rounded-lg border border-amber-400/40">
                  <Target className="w-6 h-6 text-amber-300" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-300">Modules Completed</p>
                  <p className="text-2xl font-bold text-white">0/30</p>
                </div>
              </div>
            </div>

            <div className="stat-card-hover p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-600/30 rounded-lg border border-green-400/40">
                  <Calendar className="w-6 h-6 text-green-300" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-300">Workout Streak</p>
                  <p className="text-2xl font-bold text-white">{checkInStreak} days</p>
                </div>
              </div>
            </div>

            <div className="stat-card-hover p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-600/30 rounded-lg border border-purple-400/40">
                  <Gift className="w-6 h-6 text-purple-300" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-300">Protocol Days</p>
                  <p className="text-2xl font-bold text-white">0</p>
                </div>
              </div>
            </div>
          </div>

          {/* Core Training Modules */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="card-hover-primary">
              <h2 className="text-lg font-bold text-white mb-4">🧠 Mental Mastery Modules</h2>
              <div className="space-y-3">
                <a href="/modules/foundation" className="quick-action-hover w-full flex items-center p-3 text-left">
                  <Play className="w-5 h-5 text-primary-300 mr-3" />
                  <div>
                    <p className="font-medium text-white">Foundation Series</p>
                    <p className="text-sm text-gray-300">30 core modules for metabolic awakening</p>
                  </div>
                </a>
                
                <a href="/modules/integration" className="quick-action-hover w-full flex items-center p-3 text-left">
                  <TrendingUp className="w-5 h-5 text-blue-300 mr-3" />
                  <div>
                    <p className="font-medium text-white">Integration Series</p>
                    <p className="text-sm text-gray-300">Advanced real-world application modules</p>
                  </div>
                </a>
                
                <a href="/modules/mastery" className="quick-action-hover w-full flex items-center p-3 text-left">
                  <Target className="w-5 h-5 text-amber-300 mr-3" />
                  <div>
                    <p className="font-medium text-white">Mastery Series</p>
                    <p className="text-sm text-gray-300">Peptide independence & maintenance</p>
                  </div>
                </a>
              </div>
            </div>

            <div className="card-hover-primary">
              <h2 className="text-lg font-bold text-white mb-4">💪 Exercise & Fitness</h2>
              <div className="space-y-3">
                <a href="/breath" className="quick-action-hover w-full flex items-center p-3 text-left">
                  <Play className="w-5 h-5 text-primary-300 mr-3" />
                  <div>
                    <p className="font-medium text-white">Breath Training</p>
                    <p className="text-sm text-gray-300">Advanced breathing protocols</p>
                  </div>
                </a>
                
                <a href="/workouts" className="quick-action-hover w-full flex items-center p-3 text-left">
                  <TrendingUp className="w-5 h-5 text-green-300 mr-3" />
                  <div>
                    <p className="font-medium text-white">Exercise Database</p>
                    <p className="text-sm text-gray-300">Custom workout plans & tracking</p>
                  </div>
                </a>
                
                <a href="/nutrition" className="quick-action-hover w-full flex items-center p-3 text-left">
                  <Calendar className="w-5 h-5 text-green-300 mr-3" />
                  <div>
                    <p className="font-medium text-white">Nutrition Tracking</p>
                    <p className="text-sm text-gray-300">Meal planning & macro optimization</p>
                  </div>
                </a>
              </div>
            </div>

          </div>

          {/* Additional Portal Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
            <div className="card-hover-primary">
              <h2 className="text-lg font-bold text-white mb-4">📊 Progress Analytics</h2>
              <div className="space-y-3">
                <div className="flex items-center p-3 rounded-lg bg-primary-600/20 border border-primary-400/30">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-3"></div>
                  <div>
                    <p className="text-sm font-medium text-white">Completed Module 12: Advanced Breathing</p>
                    <p className="text-xs text-gray-300">2 hours ago</p>
                  </div>
                </div>
                
                <div className="flex items-center p-3 rounded-lg bg-primary-600/20 border border-primary-400/30">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mr-3"></div>
                  <div>
                    <p className="text-sm font-medium text-white">Updated workout plan</p>
                    <p className="text-xs text-gray-300">1 day ago</p>
                  </div>
                </div>
                
                <div className="flex items-center p-3 rounded-lg bg-primary-600/20 border border-primary-400/30">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full mr-3"></div>
                  <div>
                    <p className="text-sm font-medium text-white">Protocol day 23 completed</p>
                    <p className="text-xs text-gray-300">3 days ago</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="card-hover-primary">
              <h2 className="text-lg font-bold text-white mb-4">🎯 Upcoming Goals</h2>
              <div className="space-y-3">
                <div className="flex items-center p-3 rounded-lg bg-secondary-600/20 border border-secondary-400/30">
                  <div className="w-2 h-2 bg-secondary-400 rounded-full mr-3"></div>
                  <div>
                    <p className="text-sm font-medium text-white">Complete Module 13 tomorrow</p>
                    <p className="text-xs text-gray-300">Foundation Series progress</p>
                  </div>
                </div>
                
                <div className="flex items-center p-3 rounded-lg bg-amber-600/20 border border-amber-400/30">
                  <div className="w-2 h-2 bg-amber-400 rounded-full mr-3"></div>
                  <div>
                    <p className="text-sm font-medium text-white">Weekly workout check-in</p>
                    <p className="text-xs text-gray-300">Track strength progress</p>
                  </div>
                </div>
                
                <div className="flex items-center p-3 rounded-lg bg-purple-600/20 border border-purple-400/30">
                  <div className="w-2 h-2 bg-purple-400 rounded-full mr-3"></div>
                  <div>
                    <p className="text-sm font-medium text-white">30-day protocol milestone</p>
                    <p className="text-xs text-gray-300">7 days remaining</p>
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