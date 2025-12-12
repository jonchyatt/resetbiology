'use client'

import { useState, useEffect } from 'react'
import {
  Calendar,
  Play,
  Eye,
  ChevronRight,
  BarChart3,
  Flame,
  Award,
  Clock,
  CheckCircle,
  Target
} from 'lucide-react'
import { PortalHeader } from '@/components/Navigation/PortalHeader'
import CurriculumOverview from './Training/CurriculumOverview'
import DailyPractice from './Training/DailyPractice'
import QuickPractice from './Training/QuickPractice'
import ProgressDashboard from './Training/ProgressDashboard'
import TrainingSession from './Training/TrainingSession'

type TabMode = 'home' | 'today' | 'trainer' | 'exercises' | 'progress'

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

interface TodaySessionData {
  week: number
  day: number
  isRestDay: boolean
  completed: boolean
  weekTitle: string
  phase: string
  session: {
    title: string
    totalMinutes: number
  } | null
}

export function VisionTraining() {
  const [activeTab, setActiveTab] = useState<TabMode>('home')
  const [isEnrolled, setIsEnrolled] = useState(false)
  const [enrolling, setEnrolling] = useState(false)
  const [loading, setLoading] = useState(true)
  const [enrollmentData, setEnrollmentData] = useState<EnrollmentData | null>(null)
  const [todaySession, setTodaySession] = useState<TodaySessionData | null>(null)

  // Trainer settings
  const [trainerVisionType, setTrainerVisionType] = useState<'near' | 'far'>('near')
  const [trainerExerciseType, setTrainerExerciseType] = useState<'letters' | 'e-directional'>('letters')
  const [trainerDeviceMode, setTrainerDeviceMode] = useState<'phone' | 'desktop'>('phone')

  useEffect(() => {
    checkEnrollment()
  }, [])

  const checkEnrollment = async () => {
    try {
      const response = await fetch('/api/vision/program')
      const data = await response.json()
      if (data.success && data.enrolled) {
        setIsEnrolled(true)
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
        setTodaySession(data.todaySession)
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
        checkEnrollment()
      }
    } catch (error) {
      console.error('Failed to enroll:', error)
    } finally {
      setEnrolling(false)
    }
  }

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

  // Calculate progress
  const progressPercent = enrollmentData
    ? ((enrollmentData.currentWeek - 1) * 5 + enrollmentData.currentDay) / 60 * 100
    : 0

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
        <div className="text-center py-6">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-2">
            <Eye className="inline-block w-10 h-10 mr-3 text-primary-400" />
            <span className="text-primary-400">Vision</span> Training
          </h2>
          <p className="text-gray-300">
            {isEnrolled
              ? 'Your 12-week vision improvement journey'
              : 'Transform your eyesight naturally'}
          </p>
        </div>

        {/* Tab Navigation - Simplified */}
        <div className="flex justify-center gap-2 md:gap-4 mb-6 px-4 flex-wrap">
          {[
            { id: 'home' as TabMode, label: 'Overview', icon: Target },
            ...(isEnrolled ? [{ id: 'today' as TabMode, label: "Today's Session", icon: Play }] : []),
            { id: 'trainer' as TabMode, label: 'Snellen Trainer', icon: Eye },
            { id: 'exercises' as TabMode, label: 'Quick Exercises', icon: Calendar },
            ...(isEnrolled ? [{ id: 'progress' as TabMode, label: 'Progress', icon: BarChart3 }] : []),
          ].map(tab => {
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
              </button>
            )
          })}
        </div>

        {/* Tab Content */}
        <div className="container mx-auto px-4 pb-12 flex-1">
          <div className="max-w-6xl mx-auto">

            {/* HOME TAB - Program Overview & Quick Start */}
            {activeTab === 'home' && (
              <div className="space-y-6">
                {isEnrolled && enrollmentData && todaySession ? (
                  <>
                    {/* Enrolled User Dashboard */}
                    <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-lg">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                        <div>
                          <h3 className="text-2xl font-bold text-white mb-1">
                            Week {enrollmentData.currentWeek} of 12
                          </h3>
                          <p className="text-gray-300">
                            {todaySession.phase} - {todaySession.weekTitle}
                          </p>
                        </div>
                        <div className="flex gap-4">
                          <div className="text-center">
                            <div className="flex items-center gap-1 text-orange-400">
                              <Flame className="w-5 h-5" />
                              <span className="text-2xl font-bold">{enrollmentData.streakDays}</span>
                            </div>
                            <div className="text-xs text-gray-400">Day Streak</div>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center gap-1 text-secondary-400">
                              <Award className="w-5 h-5" />
                              <span className="text-2xl font-bold">{enrollmentData.sessionsCompleted}</span>
                            </div>
                            <div className="text-xs text-gray-400">Sessions</div>
                          </div>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="bg-gray-700 rounded-full h-3 overflow-hidden mb-2">
                        <div
                          className="h-full bg-gradient-to-r from-primary-500 to-secondary-500 transition-all duration-500"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-sm text-gray-400 mb-6">
                        <span>Day {(enrollmentData.currentWeek - 1) * 5 + Math.min(enrollmentData.currentDay, 5)} of 60</span>
                        <span>{progressPercent.toFixed(0)}% complete</span>
                      </div>

                      {/* Today's Session Card */}
                      {!todaySession.isRestDay && todaySession.session && (
                        <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-5 border border-primary-400/20">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <div className="text-primary-400 text-sm font-semibold mb-1">
                                Today's Session
                              </div>
                              <h4 className="text-xl font-bold text-white">
                                {todaySession.session.title}
                              </h4>
                            </div>
                            <div className="flex items-center gap-1 text-gray-400">
                              <Clock className="w-4 h-4" />
                              <span>{todaySession.session.totalMinutes} min</span>
                            </div>
                          </div>

                          {todaySession.completed ? (
                            <div className="flex items-center gap-2 text-secondary-400 bg-secondary-500/20 rounded-lg px-4 py-3">
                              <CheckCircle className="w-5 h-5" />
                              <span className="font-semibold">Session completed!</span>
                            </div>
                          ) : (
                            <button
                              onClick={() => setActiveTab('today')}
                              className="w-full py-3 bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                              <Play className="w-5 h-5" />
                              Start Today's Session
                            </button>
                          )}
                        </div>
                      )}

                      {todaySession.isRestDay && (
                        <div className="bg-blue-500/20 backdrop-blur-sm rounded-xl p-5 border border-blue-400/30 text-center">
                          <div className="text-blue-400 text-lg font-semibold mb-1">Rest Day</div>
                          <p className="text-gray-300 text-sm">Take a break and let your eyes recover</p>
                        </div>
                      )}
                    </div>

                    {/* Quick Actions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button
                        onClick={() => setActiveTab('trainer')}
                        className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-5 border border-primary-400/20 text-left hover:border-primary-400/40 transition-all group"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 bg-primary-500/20 rounded-lg group-hover:bg-primary-500/30 transition-colors">
                            <Eye className="w-6 h-6 text-primary-400" />
                          </div>
                          <div>
                            <h4 className="text-white font-bold">Snellen Vision Test</h4>
                            <p className="text-gray-400 text-sm">Check your current vision level</p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-500 ml-auto" />
                      </button>

                      <button
                        onClick={() => setActiveTab('exercises')}
                        className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-5 border border-primary-400/20 text-left hover:border-primary-400/40 transition-all group"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 bg-secondary-500/20 rounded-lg group-hover:bg-secondary-500/30 transition-colors">
                            <Calendar className="w-6 h-6 text-secondary-400" />
                          </div>
                          <div>
                            <h4 className="text-white font-bold">Quick Exercises</h4>
                            <p className="text-gray-400 text-sm">Individual eye exercises</p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-500 ml-auto" />
                      </button>
                    </div>
                  </>
                ) : (
                  /* Not Enrolled - Show Program Overview */
                  <CurriculumOverview onEnroll={handleEnroll} enrolling={enrolling} />
                )}
              </div>
            )}

            {/* TODAY'S SESSION TAB */}
            {activeTab === 'today' && isEnrolled && (
              <DailyPractice />
            )}

            {/* SNELLEN TRAINER TAB */}
            {activeTab === 'trainer' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-6 border border-primary-400/20 shadow-lg">
                  <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                    <Eye className="w-6 h-6 text-primary-400" />
                    Snellen Vision Trainer
                  </h3>
                  <p className="text-gray-300 mb-4">
                    Train at your edge of clarity - where text is just barely readable.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Device Mode */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-3">Device Mode</label>
                      <div className="flex gap-2">
                        {(['phone', 'desktop'] as const).map(mode => (
                          <button
                            key={mode}
                            onClick={() => setTrainerDeviceMode(mode)}
                            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${trainerDeviceMode === mode
                              ? 'bg-primary-600 text-white'
                              : 'bg-gray-700/30 text-gray-300 hover:bg-gray-600/30'
                            }`}
                          >
                            {mode === 'phone' ? "Phone" : 'Desktop'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Vision Type */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-3">Training Focus</label>
                      <div className="flex gap-2">
                        {(['near', 'far'] as const).map(type => (
                          <button
                            key={type}
                            onClick={() => setTrainerVisionType(type)}
                            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${trainerVisionType === type
                              ? 'bg-primary-600 text-white'
                              : 'bg-gray-700/30 text-gray-300 hover:bg-gray-600/30'
                            }`}
                          >
                            {type === 'near' ? 'Nearsighted' : 'Farsighted'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Chart Type */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-3">Chart Type</label>
                      <div className="flex gap-2">
                        {([
                          { id: 'letters', label: 'Letters' },
                          { id: 'e-directional', label: 'E Chart' }
                        ] as const).map(type => (
                          <button
                            key={type.id}
                            onClick={() => setTrainerExerciseType(type.id)}
                            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${trainerExerciseType === type.id
                              ? 'bg-secondary-600 text-white'
                              : 'bg-gray-700/30 text-gray-300 hover:bg-gray-600/30'
                            }`}
                          >
                            {type.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <TrainingSession
                  visionType={trainerVisionType}
                  exerciseType={trainerExerciseType}
                  deviceMode={trainerDeviceMode}
                />
              </div>
            )}

            {/* QUICK EXERCISES TAB */}
            {activeTab === 'exercises' && (
              <QuickPractice />
            )}

            {/* PROGRESS TAB */}
            {activeTab === 'progress' && isEnrolled && (
              <ProgressDashboard />
            )}

            {/* Not enrolled notice for restricted tabs */}
            {!isEnrolled && (activeTab === 'today' || activeTab === 'progress') && (
              <div className="bg-gradient-to-r from-yellow-600/20 to-amber-600/20 backdrop-blur-sm rounded-xl p-8 border border-yellow-400/30 shadow-2xl text-center">
                <Eye className="w-16 h-16 text-yellow-400/60 mx-auto mb-6" />
                <h3 className="text-2xl font-bold text-white mb-4">Program Required</h3>
                <p className="text-gray-200 mb-8">
                  Enroll in the 12-week program to access daily sessions and progress tracking.
                </p>
                <button
                  onClick={() => setActiveTab('home')}
                  className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-3 px-6 rounded-xl transition-all flex items-center gap-2 mx-auto"
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

export default VisionTraining
