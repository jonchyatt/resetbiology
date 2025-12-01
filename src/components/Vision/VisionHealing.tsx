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
        setActiveTab('today') // Go to today's session if enrolled
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
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading vision program...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Eye className="w-7 h-7 text-primary-400" />
            Vision Training
          </h1>
          <p className="text-gray-400 mt-1">
            {isEnrolled
              ? 'Continue your vision improvement journey'
              : 'Explore the program and start your journey'}
          </p>
        </div>
        {isEnrolled && (
          <div className="flex items-center gap-2 px-4 py-2 bg-secondary-500/10 border border-secondary-400/30 rounded-full">
            <Sparkles className="w-4 h-4 text-secondary-400" />
            <span className="text-secondary-400 text-sm font-medium">Program Active</span>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="bg-gray-900/40 border border-primary-400/20 rounded-2xl p-2">
        <div className="flex flex-wrap gap-2">
          {visibleTabs.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-primary-500/20 to-secondary-500/20 border border-primary-400/40 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-primary-400' : ''}`} />
                <span className="font-medium hidden sm:inline">{tab.label}</span>
                <span className="font-medium sm:hidden">{tab.label.split(' ')[0]}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[500px]">
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
            {/* Trainer Settings */}
            <div className="bg-gray-900/40 border border-primary-400/30 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Eye className="w-6 h-6 text-primary-400" />
                Snellen Vision Trainer
              </h2>
              <p className="text-gray-400 mb-6">
                Test and train your vision with adaptive difficulty. The trainer adjusts
                based on your performance - get 60%+ accuracy to advance to smaller letters.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                        className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
                          trainerVisionType === type
                            ? 'bg-primary-500/20 border border-primary-400/50 text-white'
                            : 'bg-gray-800/50 border border-gray-700/50 text-gray-400 hover:text-white hover:border-gray-600'
                        }`}
                      >
                        <span className="text-lg mr-2">{type === 'near' ? '📱' : '🖥️'}</span>
                        {type === 'near' ? 'Near Vision' : 'Far Vision'}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {trainerVisionType === 'near'
                      ? 'Best for phone/tablet - hold at arm\'s length (~40cm)'
                      : 'Best for computer/TV - sit 2+ meters away'}
                  </p>
                </div>

                {/* Exercise Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Chart Type
                  </label>
                  <div className="flex gap-2">
                    {([
                      { id: 'letters', label: 'Letters', emoji: '🔤' },
                      { id: 'e-directional', label: 'E Chart', emoji: '👁️' }
                    ] as const).map(type => (
                      <button
                        key={type.id}
                        onClick={() => setTrainerExerciseType(type.id)}
                        className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
                          trainerExerciseType === type.id
                            ? 'bg-secondary-500/20 border border-secondary-400/50 text-white'
                            : 'bg-gray-800/50 border border-gray-700/50 text-gray-400 hover:text-white hover:border-gray-600'
                        }`}
                      >
                        <span className="text-lg mr-2">{type.emoji}</span>
                        {type.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {trainerExerciseType === 'letters'
                      ? 'Identify the letter shown (E, F, P, T, O, Z, L, D)'
                      : 'Identify which direction the E is pointing'}
                  </p>
                </div>
              </div>
            </div>

            {/* Training Session */}
            <TrainingSession
              visionType={trainerVisionType}
              exerciseType={trainerExerciseType}
            />
          </div>
        )}

        {activeTab === 'progress' && isEnrolled && (
          <ProgressDashboard />
        )}

        {/* Not enrolled notice for certain tabs */}
        {!isEnrolled && (activeTab === 'today' || activeTab === 'progress') && (
          <div className="bg-yellow-500/10 border border-yellow-400/30 rounded-xl p-8 text-center">
            <Eye className="w-12 h-12 text-yellow-400/50 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Program Required</h3>
            <p className="text-gray-300 mb-6 max-w-md mx-auto">
              Enroll in the 12-week program to access daily sessions and progress tracking.
            </p>
            <button
              onClick={() => setActiveTab('curriculum')}
              className="px-6 py-3 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-400/50 text-yellow-300 rounded-xl font-medium flex items-center gap-2 mx-auto transition-all"
            >
              View Program Details
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default VisionHealing
