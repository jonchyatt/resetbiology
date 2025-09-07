"use client"

import { useState } from "react"
import { useSession, signIn } from "next-auth/react"
import { User, Shield, Clock, CreditCard } from "lucide-react"

export function UserManagement() {
  const { data: sessionData, update } = useSession()
  const session = sessionData as any
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  if (!session?.user) {
    return (
      <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm p-6 rounded-lg shadow-xl border border-gray-600/30">
        <p className="text-gray-300">Please sign in to view user management.</p>
      </div>
    )
  }

  const startTrial = async () => {
    setLoading(true)
    setMessage("")

    try {
      const response = await fetch("/api/user/trial", {
        method: "POST",
      })
      
      const data = await response.json()

      if (response.ok) {
        setMessage("✅ Trial activated! Updating permissions...")
        // Force session refresh to get updated permissions
        await update()
        setMessage("✅ Trial activated! All features are now enabled.")
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } catch (error) {
      setMessage("❌ Failed to start trial")
    } finally {
      setLoading(false)
    }
  }

  const getAccessLevelIcon = (level?: string) => {
    switch (level) {
      case 'guest': return <User className="w-5 h-5 text-gray-500" />
      case 'trial': return <Clock className="w-5 h-5 text-yellow-500" />
      case 'basic':
      case 'premium':
      case 'platinum': return <CreditCard className="w-5 h-5 text-green-500" />
      default: return <Shield className="w-5 h-5 text-gray-400" />
    }
  }

  const getAccessLevelColor = (level?: string) => {
    switch (level) {
      case 'guest': return 'bg-gray-100 text-gray-800'
      case 'trial': return 'bg-yellow-100 text-yellow-800'
      case 'basic': return 'bg-blue-100 text-blue-800'
      case 'premium': return 'bg-purple-100 text-purple-800'
      case 'platinum': return 'bg-gold-100 text-gold-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* User Info Card */}
      <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm p-6 rounded-lg shadow-xl border border-teal-400/30">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-teal-400" />
          Account Information
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Email:</span>
            <span className="font-medium text-white">{session.user.email}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Name:</span>
            <span className="font-medium text-white">{session.user.name || 'Not provided'}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-400">Access Level:</span>
            <div className="flex items-center gap-2">
              {getAccessLevelIcon(session.user.accessLevel)}
              <span className={`px-2 py-1 rounded-full text-sm font-medium capitalize ${getAccessLevelColor(session.user.accessLevel)}`}>
                {session.user.accessLevel || 'Guest'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-400">Subscription:</span>
            <span className={`px-2 py-1 rounded-full text-sm font-medium capitalize ${
              session.user.subscriptionStatus === 'active' ? 'bg-green-100 text-green-800' :
              session.user.subscriptionStatus === 'trial' ? 'bg-yellow-100 text-yellow-800' :
              session.user.subscriptionStatus === 'expired' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {session.user.subscriptionStatus || 'None'}
            </span>
          </div>

          {session.user.trialEndDate && (
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Trial Ends:</span>
              <span className="font-medium text-amber-400">
                {new Date(session.user.trialEndDate).toLocaleDateString()}
              </span>
            </div>
          )}

          {session.user.subscriptionExpiry && (
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Subscription Expires:</span>
              <span className="font-medium text-green-400">
                {new Date(session.user.subscriptionExpiry).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Permissions Card */}
      <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm p-6 rounded-lg shadow-xl border border-blue-500/30">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-400" />
          Feature Permissions
        </h3>
        
        {session.user.permissions ? (
          <div className="grid grid-cols-1 gap-3">
            {Object.entries(session.user.permissions).map(([feature, hasAccessRaw]) => {
              const hasAccess = hasAccessRaw as boolean
              const getFeatureLink = (featureName: string) => {
                const links: Record<string, string> = {
                  'assessment': '/assessment',
                  'breathApp': '/breath',
                  'portalPreview': '/portal',
                  'audioModules': '/portal/dashboard',
                  'peptideTracking': '/peptides',
                  'workoutPlanning': '/workout',
                  'nutritionTracking': '/nutrition',
                  'education': '/portal/education',
                  'gamification': '/portal/dashboard',
                  'affiliateSystem': '/portal/affiliate'
                }
                return links[featureName] || '#'
              }
              
              return (
                <div key={feature} className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-br from-primary-600/20 to-secondary-600/30 border border-gray-600/30">
                  <span className="text-sm text-gray-200 capitalize font-medium">
                    {feature.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      hasAccess ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {hasAccess ? 'Enabled' : 'Disabled'}
                    </span>
                    {hasAccess && (
                      <a 
                        href={getFeatureLink(feature)} 
                        className="text-xs bg-gradient-to-br from-teal-500/80 to-teal-600/80 hover:from-teal-400/90 hover:to-teal-500/90 text-white px-3 py-1 rounded-full transition-all backdrop-blur-sm border border-teal-400/30"
                      >
                        Open
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-gray-400">No permission data available.</p>
        )}
      </div>

      {/* Daily Tracker - Quick Access */}
      {session.user.permissions && session.user.accessLevel !== 'guest' && (
        <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm p-6 rounded-lg shadow-xl border border-amber-400/30 hover:shadow-amber-400/20 transition-all duration-300">
          <h3 className="text-xl font-semibold mb-4 text-white">📊 Daily Tracker Hub</h3>
          <p className="text-gray-300 mb-6">Track your progress across all areas for maximum results</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {session.user.permissions.peptideTracking && (
              <a href="/peptides" className="bg-gradient-to-br from-teal-500/20 to-teal-600/30 hover:from-teal-400/30 hover:to-teal-500/40 rounded-lg p-3 text-center transition-all backdrop-blur-sm border border-teal-400/30 hover:shadow-teal-400/20 duration-300 shadow-xl">
                <div className="text-2xl mb-2">💉</div>
                <div className="text-sm font-medium text-white">Peptides</div>
              </a>
            )}
            {session.user.permissions.workoutPlanning && (
              <a href="/workout" className="bg-gradient-to-br from-blue-600/20 to-blue-700/30 hover:from-blue-500/30 hover:to-blue-600/40 rounded-lg p-3 text-center transition-all backdrop-blur-sm border border-blue-500/30 hover:shadow-blue-400/20 duration-300 shadow-xl">
                <div className="text-2xl mb-2">💪</div>
                <div className="text-sm font-medium text-white">Workouts</div>
              </a>
            )}
            {session.user.permissions.nutritionTracking && (
              <a href="/nutrition" className="bg-gradient-to-br from-green-600/20 to-green-700/30 hover:from-green-500/30 hover:to-green-600/40 rounded-lg p-3 text-center transition-all backdrop-blur-sm border border-green-500/30 hover:shadow-green-400/20 duration-300 shadow-xl">
                <div className="text-2xl mb-2">🍎</div>
                <div className="text-sm font-medium text-white">Nutrition</div>
              </a>
            )}
            {session.user.permissions.audioModules && (
              <a href="/audio" className="bg-gradient-to-br from-amber-500/20 to-amber-600/30 hover:from-amber-400/30 hover:to-amber-500/40 rounded-lg p-3 text-center transition-all backdrop-blur-sm border border-amber-400/30 hover:shadow-amber-400/20 duration-300 shadow-xl">
                <div className="text-2xl mb-2">🎧</div>
                <div className="text-sm font-medium text-white">Mental Mastery</div>
              </a>
            )}
          </div>
        </div>
      )}

      {/* Quick Access to All Features */}
      {session.user.permissions && (
        <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm p-6 rounded-lg shadow-xl border border-green-500/30">
          <h3 className="text-lg font-semibold text-white mb-4">All Features</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(session.user.permissions)
              .filter(([feature, hasAccess]) => hasAccess && feature !== 'portalPreview') // Remove duplicate portal link
              .map(([feature, _]) => {
                const getFeatureInfo = (featureName: string) => {
                  const info: Record<string, { name: string; link: string; icon: string }> = {
                    'assessment': { name: '🔍 Assessment', link: '/assessment', icon: '🔍' },
                    'breathApp': { name: '🌬️ Breath Training', link: '/breath', icon: '🌬️' },
                    'audioModules': { name: '🎧 Mental Mastery Modules', link: '/audio', icon: '🎧' },
                    'peptideTracking': { name: '💉 Peptide Tracking', link: '/peptides', icon: '💉' },
                    'workoutPlanning': { name: '💪 Workout Planning', link: '/workout', icon: '💪' },
                    'nutritionTracking': { name: '🍎 Nutrition Tracking', link: '/nutrition', icon: '🍎' },
                    'education': { name: '📚 Education Center', link: '/portal/education', icon: '📚' },
                    'gamification': { name: '🏆 Rewards & Progress', link: '/portal/dashboard', icon: '🏆' },
                    'affiliateSystem': { name: '💰 Affiliate System', link: '/portal/affiliate', icon: '💰' }
                  }
                  return info[featureName] || { name: featureName, link: '#', icon: '⚡' }
                }
                
                const featureInfo = getFeatureInfo(feature)
                
                return (
                  <a
                    key={feature}
                    href={featureInfo.link}
                    className="flex items-center p-3 bg-gradient-to-br from-primary-600/20 to-secondary-600/30 hover:from-gray-600/80 hover:to-gray-700/80 rounded-lg transition-all border border-gray-600/30 hover:border-teal-400/30 hover:shadow-teal-400/20 duration-300 backdrop-blur-sm"
                  >
                    <span className="text-lg mr-3">{featureInfo.icon}</span>
                    <span className="font-medium text-gray-200">{featureInfo.name}</span>
                  </a>
                )
              })}
            {/* Always show portal dashboard link */}
            <a
              href="/portal"
              className="flex items-center p-3 bg-gradient-to-br from-primary-600/20 to-secondary-600/30 hover:from-gray-600/80 hover:to-gray-700/80 rounded-lg transition-all border border-gray-600/30 hover:border-teal-400/30 hover:shadow-teal-400/20 duration-300 backdrop-blur-sm"
            >
              <span className="text-lg mr-3">🏠</span>
              <span className="font-medium text-gray-200">Portal Dashboard</span>
            </a>
          </div>
        </div>
      )}

      {/* Actions Card */}
      <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm p-6 rounded-lg shadow-xl border border-amber-400/30">
        <h3 className="text-lg font-semibold text-white mb-4">Account Actions</h3>
        
        <div className="space-y-4">
          {session.user.accessLevel === 'guest' && !session.user.trialStartDate && (
            <div className="bg-gradient-to-br from-teal-500/80 to-green-500/80 backdrop-blur-sm p-6 rounded-lg text-white border border-teal-400/30 shadow-lg">
              <h4 className="text-lg font-semibold mb-2">🚀 Unlock All Features</h4>
              <p className="text-gray-100 mb-4">
                Start your free trial to access all premium features:
              </p>
              <ul className="text-sm text-gray-100 mb-4 space-y-1">
                <li>• 🎧 Mental Mastery Audio Modules</li>
                <li>• 💉 Peptide Tracking & Protocols</li>
                <li>• 💪 Custom Workout Planning</li>
                <li>• 🍎 Advanced Nutrition Tracking</li>
                <li>• 🏆 Gamification & Rewards</li>
              </ul>
              <button
                onClick={startTrial}
                disabled={loading}
                className={`w-full py-3 px-4 rounded-lg font-bold text-lg transition-all ${
                  loading
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-teal-600 hover:bg-gray-100 hover:scale-105 shadow-lg'
                }`}
              >
                {loading ? 'Activating...' : '🎯 Start 7-Day Free Trial'}
              </button>
            </div>
          )}

          {message && (
            <div className={`p-3 rounded-lg text-sm ${
              message.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}