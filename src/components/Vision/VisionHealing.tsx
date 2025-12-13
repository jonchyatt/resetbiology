'use client'

import { useState, useEffect } from 'react'
import {
  Calendar,
  Play,
  Zap,
  BarChart3,
  Eye,
  ChevronRight,
  Sparkles,
  Smartphone,
  Monitor,
  MoveHorizontal,
  Focus
} from 'lucide-react'
import { PortalHeader } from '@/components/Navigation/PortalHeader'
import CurriculumOverview from './Training/CurriculumOverview'
import DailyPractice from './Training/DailyPractice'
import QuickPractice from './Training/QuickPractice'
import ProgressDashboard from './Training/ProgressDashboard'
import TrainingSession from './Training/TrainingSession'
import ProgramProgress from './Training/ProgramProgress'

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

interface EnrollmentData {
  currentWeek: number
  currentDay: number
  sessionsCompleted: number
  totalPracticeMinutes: number
  streakDays: number
  phaseProgress: {
    phase1: boolean
    phase2: boolean
    phase3: boolean
    phase4: boolean
    phase5: boolean
    phase6: boolean
  }
}

interface CompletedSession {
  week: number
  day: number
  sessionTitle: string
  completedAt: string
  localDate: string
}

export function VisionHealing() {
  const [activeTab, setActiveTab] = useState<TabMode>('curriculum')
  const [isEnrolled, setIsEnrolled] = useState(false)
  const [enrolling, setEnrolling] = useState(false)
  const [loading, setLoading] = useState(true)
  const [enrollmentData, setEnrollmentData] = useState<EnrollmentData | null>(null)
  const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>([])

  // Trainer settings
  const [trainerVisionType, setTrainerVisionType] = useState<'near' | 'far'>('near')
  const [trainerExerciseType, setTrainerExerciseType] = useState<'letters' | 'e-directional'>('letters')
  const [trainerDeviceMode, setTrainerDeviceMode] = useState<'phone' | 'desktop'>('phone')
  const [trainerActive, setTrainerActive] = useState(false)

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

        // Store enrollment data for progress display
        setEnrollmentData({
          currentWeek: data.enrollment.currentWeek || data.todaySession?.week || 1,
          currentDay: data.enrollment.currentDay || data.todaySession?.day || 1,
          sessionsCompleted: data.enrollment.sessionsCompleted || 0,
          totalPracticeMinutes: data.enrollment.totalPracticeMinutes || 0,
          streakDays: data.enrollment.streakDays || 0,
          phaseProgress: data.enrollment.phaseProgress || {
            phase1: false, phase2: false, phase3: false,
            phase4: false, phase5: false, phase6: false
          }
        })

        // Store completed sessions
        if (data.recentSessions) {
          setCompletedSessions(data.recentSessions.map((s: any) => ({
            week: s.week,
            day: s.day,
            sessionTitle: s.sessionTitle,
            completedAt: s.completedAt,
            localDate: s.localDate
          })))
        }
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
        // Refresh to get enrollment data
        checkEnrollment()
      }
    } catch (error) {
      console.error('Failed to enroll:', error)
    } finally {
      setEnrolling(false)
    }
  }

  // Mark a past session as complete
  const handleMarkPastComplete = async (week: number, day: number) => {
    try {
      const response = await fetch('/api/vision/program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete_past_session',
          data: { week, day }
        })
      })
      const data = await response.json()
      if (data.success) {
        // Refresh enrollment data
        await checkEnrollment()
      } else {
        console.error('Failed to mark session complete:', data.error)
      }
    } catch (error) {
      console.error('Failed to mark past session complete:', error)
    }
  }

  // Start a specific session (navigate to today's session with week/day)
  const handleStartSession = (week: number, day: number) => {
    // For now, just go to today's session tab
    // In future, could pass week/day to DailyPractice
    setActiveTab('today')
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
              isEnrolled && enrollmentData ? (
                <ProgramProgress
                  enrollment={enrollmentData}
                  completedSessions={completedSessions}
                  onMarkComplete={handleMarkPastComplete}
                  onStartSession={handleStartSession}
                />
              ) : (
                <CurriculumOverview onEnroll={handleEnroll} enrolling={enrolling} />
              )
            )}

            {activeTab === 'today' && isEnrolled && (
              <DailyPractice />
            )}

            {activeTab === 'practice' && (
              <QuickPractice />
            )}

            {activeTab === 'trainer' && (
              <div className="space-y-4">
                {/* Trainer Settings Card - Compact with icons */}
                <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-4 border border-primary-400/20 shadow-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <Focus className="w-5 h-5 text-primary-400" />
                      Focus Training
                    </h3>
                    {!trainerActive && (
                      <button
                        onClick={() => setTrainerActive(true)}
                        className="px-6 py-3 rounded-xl font-bold bg-secondary-500 hover:bg-secondary-600 text-white shadow-lg shadow-secondary-500/30 flex items-center gap-2 transition-all hover:scale-105"
                      >
                        <Play className="w-5 h-5" />
                        Start Training
                      </button>
                    )}
                  </div>

                  {/* Compact settings row with icons */}
                  <div className="flex flex-wrap gap-2">
                    {/* Device Mode - Icon buttons */}
                    <div className="flex gap-1">
                      <button
                        onClick={() => setTrainerDeviceMode('phone')}
                        title="Phone (arm's length)"
                        className={`p-3 rounded-lg transition-all ${trainerDeviceMode === 'phone'
                          ? 'bg-primary-600 text-white shadow-lg'
                          : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600/50'
                          }`}
                      >
                        <Smartphone className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setTrainerDeviceMode('desktop')}
                        title="Desktop (set distance)"
                        className={`p-3 rounded-lg transition-all ${trainerDeviceMode === 'desktop'
                          ? 'bg-primary-600 text-white shadow-lg'
                          : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600/50'
                          }`}
                      >
                        <Monitor className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="w-px bg-gray-600/50 mx-1" />

                    {/* Vision Type - Icon buttons with visual metaphor */}
                    {/* Near = arrows pointing OUT (pushing clarity away) */}
                    {/* Far = arrows pointing IN (pulling clarity closer) */}
                    <div className="flex gap-1">
                      <button
                        onClick={() => setTrainerVisionType('near')}
                        title="Nearsighted - push clarity outward"
                        className={`p-3 rounded-lg transition-all flex items-center gap-1 ${trainerVisionType === 'near'
                          ? 'bg-blue-600 text-white shadow-lg'
                          : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600/50'
                          }`}
                      >
                        {/* Eye with arrows pointing outward = myopia (can see near, training to see far) */}
                        <Eye className="w-5 h-5" />
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M7 12H3M21 12h-4M12 7V3M12 21v-4" />
                          <path d="M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setTrainerVisionType('far')}
                        title="Farsighted - pull clarity closer"
                        className={`p-3 rounded-lg transition-all flex items-center gap-1 ${trainerVisionType === 'far'
                          ? 'bg-purple-600 text-white shadow-lg'
                          : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600/50'
                          }`}
                      >
                        {/* Eye with arrows pointing inward = hyperopia (can see far, training to see near) */}
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 12h4M17 12h4M12 3v4M12 17v4" />
                          <path d="M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" />
                        </svg>
                        <Eye className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="w-px bg-gray-600/50 mx-1" />

                    {/* Chart Type */}
                    <div className="flex gap-1">
                      <button
                        onClick={() => setTrainerExerciseType('letters')}
                        title="Letter Chart"
                        className={`p-3 rounded-lg font-bold text-lg transition-all ${trainerExerciseType === 'letters'
                          ? 'bg-secondary-600 text-white shadow-lg'
                          : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600/50'
                          }`}
                      >
                        ABC
                      </button>
                      <button
                        onClick={() => setTrainerExerciseType('e-directional')}
                        title="Tumbling E Chart"
                        className={`p-3 rounded-lg font-bold text-lg transition-all ${trainerExerciseType === 'e-directional'
                          ? 'bg-secondary-600 text-white shadow-lg'
                          : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600/50'
                          }`}
                      >
                        E→
                      </button>
                    </div>
                  </div>

                  {/* Helpful text when not active */}
                  {!trainerActive && (
                    <p className="text-gray-400 text-xs mt-3">
                      {trainerDeviceMode === 'phone' ? '📱 Hold at arm\'s length' : '🖥️ Set screen distance'} •
                      {trainerVisionType === 'near' ? ' 🔵 Myopia (push clarity out)' : ' 🟣 Hyperopia (pull clarity in)'} •
                      {trainerExerciseType === 'letters' ? ' Letters' : ' E directions'}
                    </p>
                  )}
                </div>

                {/* Training Session - only show when active */}
                {trainerActive && (
                  <TrainingSession
                    visionType={trainerVisionType}
                    exerciseType={trainerExerciseType}
                    deviceMode={trainerDeviceMode}
                    onActiveChange={(active) => {
                      if (!active) setTrainerActive(false)
                    }}
                  />
                )}
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
