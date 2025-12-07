'use client'

import { useState, useEffect } from 'react'
import {
  Calendar,
  Play,
  Zap,
  BarChart3,
  Eye,
  ChevronRight,
  Sparkles
} from 'lucide-react'
import { PortalHeader } from '@/components/Navigation/PortalHeader'
import CurriculumOverview from './Training/CurriculumOverview'
import DailyPractice from './Training/DailyPractice'
import QuickPractice from './Training/QuickPractice'
import ProgressDashboard from './Training/ProgressDashboard'
import TrainingSession from './Training/TrainingSession'

type TabMode = 'curriculum' | 'today' | 'practice' | 'trainer' | 'progress'

interface TabConfig {
  id: TabMode
  label: string
  icon: any
  description: string
}

const TABS: TabConfig[] = [
  { id: 'curriculum', label: '12-Week Program', icon: Calendar, description: 'Full program overview' },
  { id: 'today', label: "Today's Session", icon: Play, description: 'Daily guided training' },
  { id: 'practice', label: 'Quick Practice', icon: Zap, description: 'Individual exercises' },
  { id: 'trainer', label: 'Snellen Trainer', icon: Eye, description: 'Vision testing' },
  { id: 'progress', label: 'Progress', icon: BarChart3, description: 'Your stats' },
]

export function VisionHealing() {
  const [activeTab, setActiveTab] = useState<TabMode>('curriculum')
  const [isEnrolled, setIsEnrolled] = useState(false)
  const [enrolling, setEnrolling] = useState(false)
  const [loading, setLoading] = useState(true)

  // Trainer settings
  const [trainerVisionType, setTrainerVisionType] = useState<'near' | 'far'>('near')
  const [trainerExerciseType, setTrainerExerciseType] = useState<'letters' | 'e-directional'>('letters')
  const [trainerDeviceMode, setTrainerDeviceMode] = useState<'phone' | 'desktop'>('phone')

  // Check enrollment status on mount
  useEffect(() => {
    checkEnrollment()
  }, [])

  const checkEnrollment = async () => {
    try {
      const response = await fetch('/api/vision/program')
      const data = await response.json()
      if (data.success && data.enrolled) {
        setIsEnrolled(true)
        setActiveTab('today')
      }
    } catch (error) {
      console.error('Failed to check enrollment:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEnroll = async () => {
    setEnrolling(true)
    try {
      const response = await fetch('/api/vision/program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enroll', data: {} })
      })
      const data = await response.json()
      if (data.success) {
        setIsEnrolled(true)
        setActiveTab('today')
      }
    } catch (error) {
      console.error('Failed to enroll:', error)
    } finally {
      setEnrolling(false)
    }
  }

  // Filter tabs based on enrollment status
  const visibleTabs = isEnrolled
    ? TABS
    : TABS.filter(t => ['curriculum', 'practice', 'trainer'].includes(t.id))

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary-400/30 border-t-primary-400 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-300">Loading vision program...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800"
      style={{
        backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}>
      <div className="relative z-10 min-h-screen flex flex-col pt-32">
        <PortalHeader
          section="Vision Training"
          secondaryBackLink="/daily-history"
          secondaryBackText="Daily History"
        />

        {/* Page Title */}
        <div className="text-center py-8">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            <Eye className="inline-block w-10 h-10 mr-3 text-primary-400" />
            <span className="text-primary-400">Vision</span> Training
          </h2>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            {isEnrolled
              ? 'Continue your vision improvement journey'
              : 'Transform your eyesight with our 12-week program'}
          </p>
          {isEnrolled && (
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => setActiveTab('today')}
                className="px-4 py-2 rounded-lg bg-primary-600 text-white font-semibold shadow-lg shadow-primary-500/30 hover:bg-primary-500 transition"
              >
                Go to Today’s Session
              </button>
              <button
                onClick={() => setActiveTab('trainer')}
                className="px-4 py-2 rounded-lg bg-gray-800/70 text-primary-200 border border-primary-500/30 hover:border-primary-400 transition"
              >
                Run Snellen Check
              </button>
              <button
                onClick={() => setActiveTab('curriculum')}
                className="px-4 py-2 rounded-lg bg-gray-800/70 text-secondary-200 border border-secondary-500/30 hover:border-secondary-400 transition"
              >
                View 12-Week Overview
              </button>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center gap-2 md:gap-4 mb-8 px-4 flex-wrap">
          {visibleTabs.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 md:px-6 py-3 rounded-lg font-semibold transition-all duration-300 flex items-center gap-2 ${isActive
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20'
                  : 'bg-gray-800/30 backdrop-blur-sm text-gray-300 hover:bg-gray-700/30'
                  }`}
              >
                <Icon className="w-5 h-5" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              </button>
            )
          })}
        </div>

        {/* Tab Content */}
        <div className="container mx-auto px-4 pb-12 flex-1">
          <div className="max-w-6xl mx-auto">
            {activeTab === 'curriculum' && (
              <CurriculumOverview onEnroll={handleEnroll} enrolling={enrolling} />
            )}

            {activeTab === 'today' && isEnrolled && (
              <DailyPractice />
            )}

            {activeTab === 'practice' && (
              <QuickPractice />
            )}

            {activeTab === 'trainer' && (
              <div className="space-y-6">
                {/* Trainer Settings Card */}
                <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-6 border border-primary-400/20 shadow-lg">
                  <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                    <Eye className="w-6 h-6 text-primary-400" />
                    Snellen Vision Trainer
                  </h3>
                  <p className="text-gray-300 mb-4">
                    Phone-first: arm’s length, shrink text until readable, then add +1.0 readers and repeat, then +2.0. Desktop: pick a distance and aim for smaller lines.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Device Mode */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-3">
                        Device Mode
                      </label>
                      <div className="flex gap-2">
                        {(['phone', 'desktop'] as const).map(mode => (
                          <button
                            key={mode}
                            onClick={() => setTrainerDeviceMode(mode)}
                            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-300 ${trainerDeviceMode === mode
                              ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20'
                              : 'bg-gray-700/30 backdrop-blur-sm text-gray-300 hover:bg-gray-600/30'
                              }`}
                          >
                            {mode === 'phone' ? "Phone (arm's length)" : 'Desktop (set distance)'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Vision Type */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-3">
                        Vision Type
                      </label>
                      <div className="flex gap-2">
                        {(['near', 'far'] as const).map(type => (
                          <button
                            key={type}
                            onClick={() => setTrainerVisionType(type)}
                            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-300 ${trainerVisionType === type
                              ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20'
                              : 'bg-gray-700/30 backdrop-blur-sm text-gray-300 hover:bg-gray-600/30'
                              }`}
                          >
                            {type === 'near' ? '📱 Near' : '🖥️ Far'}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        {trainerVisionType === 'near'
                          ? "Start at arm's length; move back only if easy"
                          : 'Start at comfortable distance; aim to move out with readers'}
                      </p>
                    </div>

                    {/* Chart Type */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-3">
                        Chart Type
                      </label>
                      <div className="flex gap-2">
                        {([
                          { id: 'letters', label: '🔤 Letters' },
                          { id: 'e-directional', label: '👁️ E Chart' }
                        ] as const).map(type => (
                          <button
                            key={type.id}
                            onClick={() => setTrainerExerciseType(type.id)}
                            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-300 ${trainerExerciseType === type.id
                              ? 'bg-secondary-600 text-white shadow-lg shadow-secondary-500/20'
                              : 'bg-gray-700/30 backdrop-blur-sm text-gray-300 hover:bg-gray-600/30'
                              }`}
                          >
                            {type.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        {trainerExerciseType === 'letters'
                          ? 'Identify letters (E, F, P, T, O, Z, L, D)'
                          : 'Identify E direction (up, down, left, right)'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Training Session */}
                <TrainingSession
                  visionType={trainerVisionType}
                  exerciseType={trainerExerciseType}
                  deviceMode={trainerDeviceMode}
                />
              </div>
            )}

            {activeTab === 'progress' && isEnrolled && (
              <ProgressDashboard />
            )}

            {/* Not enrolled notice */}
            {!isEnrolled && (activeTab === 'today' || activeTab === 'progress') && (
              <div className="bg-gradient-to-r from-yellow-600/20 to-amber-600/20 backdrop-blur-sm rounded-xl p-8 border border-yellow-400/30 shadow-2xl text-center">
                <Eye className="w-16 h-16 text-yellow-400/60 mx-auto mb-6" />
                <h3 className="text-2xl font-bold text-white mb-4">Program Required</h3>
                <p className="text-gray-200 mb-8">
                  Enroll in the 12-week program to access daily sessions and progress tracking.
                </p>
                <button
                  onClick={() => setActiveTab('curriculum')}
                  className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-3 px-6 rounded-xl transition-all duration-300 hover:scale-105 shadow-lg flex items-center gap-2 mx-auto"
                >
                  View Program Details
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default VisionHealing
