"use client"

import { useState, useEffect } from "react"
import { User, Settings, Calendar, TrendingUp, Shield, CreditCard, Download, LogOut, Bell, Lock, Eye, EyeOff } from "lucide-react"
import { PortalHeader } from "@/components/Navigation/PortalHeader"
import { useUser } from "@auth0/nextjs-auth0"
import { useRouter } from "next/navigation"

export default function ProfilePage() {
  const { user, isLoading } = useUser()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("account")
  const [showPassword, setShowPassword] = useState(false)
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    marketing: false
  })
  
  // Form state for editable fields
  const [formData, setFormData] = useState({
    name: "",
    email: ""
  })
  
  // Load user data when available
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        email: user.email || ""
      })
    }
  }, [user])

  // Handle save changes
  const handleSaveChanges = async () => {
    try {
      const response = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      })
      
      if (response.ok) {
        alert("Profile updated successfully!")
      } else {
        alert("Failed to update profile")
      }
    } catch (error) {
      console.error("Error updating profile:", error)
      alert("Error updating profile")
    }
  }

  // Handle sign out
  const handleSignOut = () => {
    window.location.href = "/auth/logout"
  }

  const tabs = [
    { id: "account", name: "Account", icon: User },
    { id: "subscription", name: "Subscription", icon: CreditCard },
    { id: "progress", name: "Progress", icon: TrendingUp },
    { id: "settings", name: "Settings", icon: Settings },
    { id: "privacy", name: "Privacy", icon: Shield }
  ]

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-white text-2xl">Loading...</div>
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
          section="Account Management"
          subtitle="Manage your wellness journey settings"
        />

        {/* Profile Title */}
        <div className="text-center py-8">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 text-shadow-lg animate-fade-in">
            <span className="text-primary-400">Profile</span> Management
          </h2>
          <p className="text-xl md:text-2xl text-gray-200 max-w-4xl mx-auto font-medium leading-relaxed drop-shadow-sm">
            Control your account, track progress, and manage subscription preferences
          </p>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* User Overview */}
          <div className="card-hover-primary mb-8">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center">
                <User className="w-12 h-12 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-white mb-2">
                  {user?.name || "User"}
                </h3>
                <p className="text-primary-300 mb-2">
                  {user?.email || "No email provided"}
                </p>
                <div className="flex items-center gap-4 text-sm text-gray-300">
                  <span>Member Account</span>
                </div>
              </div>
              <div className="text-right">
                <button 
                  onClick={handleSignOut}
                  className="action-btn-primary px-6 py-3"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="card-hover-secondary mb-8">
            <div className="flex flex-wrap gap-2">
              {tabs.map(tab => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
                      activeTab === tab.id
                        ? 'bg-primary-500/30 text-primary-200 border border-primary-400/40 shadow-lg'
                        : 'text-gray-300 hover:bg-gray-700/30 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tab Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2">
              {activeTab === "account" && (
                <div className="card-hover-primary">
                  <h3 className="text-xl font-bold text-white mb-6">Account Information</h3>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="input-primary"
                        placeholder="Enter your full name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="input-primary"
                        placeholder="Enter your email"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          defaultValue="••••••••••"
                          className="input-primary pr-12"
                          disabled
                        />
                        <button
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Password management via Auth0</p>
                    </div>
                    <div className="pt-4">
                      <button 
                        onClick={handleSaveChanges}
                        className="action-btn-primary px-6 py-3"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "subscription" && (
                <div className="space-y-6">
                  <div className="card-hover-primary">
                    <h3 className="text-xl font-bold text-white mb-6">Current Subscription</h3>
                    <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 rounded-lg p-6 border border-primary-400/30">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="text-lg font-bold text-white">Member Account</h4>
                          <p className="text-primary-300">Access to wellness features</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center text-sm text-gray-200">
                          <span className="text-green-400 mr-2">✓</span>
                          <span>Mental Mastery Modules</span>
                        </div>
                        <div className="flex items-center text-sm text-gray-200">
                          <span className="text-green-400 mr-2">✓</span>
                          <span>Breath Training & Exercise Database</span>
                        </div>
                        <div className="flex items-center text-sm text-gray-200">
                          <span className="text-green-400 mr-2">✓</span>
                          <span>Progress Tracking & Analytics</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "progress" && (
                <div className="space-y-6">
                  <div className="card-hover-primary">
                    <h3 className="text-xl font-bold text-white mb-6">Wellness Progress</h3>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-primary-400">0/30</div>
                        <p className="text-gray-300">Modules Completed</p>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-secondary-400">0</div>
                        <p className="text-gray-300">Breath Sessions</p>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-amber-400">0</div>
                        <p className="text-gray-300">Protocol Days</p>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-green-400">0</div>
                        <p className="text-gray-300">Day Streak</p>
                      </div>
                    </div>
                  </div>
                  <div className="card-hover-primary">
                    <h4 className="text-lg font-bold text-white mb-4">Data Export</h4>
                    <p className="text-gray-300 mb-4">Download your complete wellness data and progress reports</p>
                    <button className="action-btn-primary px-6 py-3">
                      <Download className="w-4 h-4 mr-2" />
                      Export Data
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "settings" && (
                <div className="card-hover-primary">
                  <h3 className="text-xl font-bold text-white mb-6">Notification Preferences</h3>
                  <div className="space-y-4">
                    {Object.entries(notifications).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-600/30">
                        <div>
                          <h4 className="font-medium text-white capitalize">{key} Notifications</h4>
                          <p className="text-sm text-gray-300">
                            {key === 'email' && 'Receive progress updates and reminders via email'}
                            {key === 'push' && 'Browser notifications for session reminders'}
                            {key === 'marketing' && 'Updates about new features and protocols'}
                          </p>
                        </div>
                        <button
                          onClick={() => setNotifications(prev => ({...prev, [key]: !value}))}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            value ? 'bg-primary-500' : 'bg-gray-600'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              value ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "privacy" && (
                <div className="card-hover-primary">
                  <h3 className="text-xl font-bold text-white mb-6">Privacy & Security</h3>
                  <div className="space-y-6">
                    <div className="bg-green-600/20 border border-green-400/30 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <Shield className="w-6 h-6 text-green-400" />
                        <div>
                          <h4 className="font-medium text-white">Account Security</h4>
                          <p className="text-sm text-gray-300">Your account is secured with Auth0 authentication</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <button className="w-full flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-600/30 hover:bg-gray-700/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <Lock className="w-5 h-5 text-primary-400" />
                          <span className="text-white">Two-Factor Authentication</span>
                        </div>
                        <span className="text-gray-400">Managed by Auth0</span>
                      </button>
                      <button className="w-full flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-600/30 hover:bg-gray-700/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <Download className="w-5 h-5 text-primary-400" />
                          <span className="text-white">Download Your Data</span>
                        </div>
                        <span className="text-gray-400">Request</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <div className="card-hover-secondary">
                <h4 className="text-lg font-bold text-white mb-4">Quick Stats</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Account Type</span>
                    <span className="text-primary-400 font-medium">Member</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Auth Provider</span>
                    <span className="text-white">Auth0</span>
                  </div>
                </div>
              </div>

              <div className="card-hover-secondary">
                <h4 className="text-lg font-bold text-white mb-4">Support</h4>
                <div className="space-y-3">
                  <a href="/education" className="block text-primary-400 hover:text-primary-300 transition-colors">
                    📚 Help Center
                  </a>
                  <a href="mailto:support@resetbiology.com" className="block text-primary-400 hover:text-primary-300 transition-colors">
                    📧 Contact Support
                  </a>
                  <a href="/education" className="block text-primary-400 hover:text-primary-300 transition-colors">
                    🔬 Scientific Research
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}