'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Play,
  Eye,
  BookOpen,
  Flame,
  Award,
  Smartphone,
  Monitor,
  RotateCcw
} from 'lucide-react'
import { PortalHeader } from '@/components/Navigation/PortalHeader'
import CurriculumOverview from './Training/CurriculumOverview'
import DailyPractice from './Training/DailyPractice'
import QuickPractice from './Training/QuickPractice'
import TrainingSession from './Training/TrainingSession'

type TabMode = 'today' | 'trainer' | 'exercises'

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
  const [activeTab, setActiveTab] = useState<TabMode>('today')
  const [isEnrolled, setIsEnrolled] = useState(false)
  const [enrolling, setEnrolling] = useState(false)
  const [loading, setLoading] = useState(true)
  const [enrollmentData, setEnrollmentData] = useState<EnrollmentData | null>(null)
  const [todaySession, setTodaySession] = useState<TodaySessionData | null>(null)

  // Trainer settings
  const [trainerVisionType, setTrainerVisionType] = useState<'near' | 'far'>('near')
  const [trainerExerciseType, setTrainerExerciseType] = useState<'letters' | 'e-directional'>('letters')
  const [trainerDeviceMode, setTrainerDeviceMode] = useState<'phone' | 'desktop'>('phone')
  const [binocularMode, setBinocularMode] = useState<'off' | 'duplicate' | 'redgreen' | 'grid-square' | 'grid-slanted' | 'alternating'>('off')
  const [isTrainingActive, setIsTrainingActive] = useState(false)

  // Dispatch binocular training mode events for hiding UI elements
  useEffect(() => {
    const isBinocularMode = isTrainingActive && binocularMode !== 'off'
    const event = new CustomEvent('binocular-training-mode', { detail: { active: isBinocularMode } })
    window.dispatchEvent(event)
  }, [isTrainingActive, binocularMode])

  useEffect(() => {
    checkEnrollment()
  }, [])

  // Handle ESC key to exit binocular training
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTrainingActive && binocularMode !== 'off') {
        setIsTrainingActive(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isTrainingActive, binocularMode])

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

  // Build tabs - dynamic first tab label based on enrollment
  const tabs = [
    {
      id: 'today' as TabMode,
      label: isEnrolled ? "Today's Session" : "Get Started",
      icon: Play
    },
    { id: 'trainer' as TabMode, label: 'Focus Training', icon: Eye },
    { id: 'exercises' as TabMode, label: 'Vision Library', icon: BookOpen },
  ]

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
        <div className="text-center py-4">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-1">
            <Eye className="inline-block w-8 h-8 mr-2 text-primary-400" />
            <span className="text-primary-400">Vision</span> Training
          </h2>
        </div>

        {/* Tab Navigation - 3 tabs only */}
        <div className="flex justify-center gap-2 md:gap-4 mb-6 px-4">
          {tabs.map(tab => {
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
        <div className={`mx-auto pb-12 flex-1 ${isTrainingActive && binocularMode !== 'off' ? 'px-2 w-full' : 'container px-4'}`}>
          <div className={isTrainingActive && binocularMode !== 'off' ? 'w-full' : 'max-w-6xl mx-auto'}>

            {/* TODAY'S SESSION / GET STARTED TAB */}
            {activeTab === 'today' && (
              <div className="space-y-4">
                {isEnrolled && enrollmentData && todaySession ? (
                  <>
                    {/* Compact Progress Bar */}
                    <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm rounded-xl p-4 border border-primary-400/20">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-white font-semibold">
                            Week {enrollmentData.currentWeek} of 12
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-primary-500/20 text-primary-300 rounded">
                            {todaySession.phase}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Flame className="w-4 h-4 text-orange-400" />
                            <span className="text-white font-semibold">{enrollmentData.streakDays}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Award className="w-4 h-4 text-secondary-400" />
                            <span className="text-white font-semibold">{enrollmentData.sessionsCompleted}</span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary-500 to-secondary-500 transition-all duration-500"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Day {(enrollmentData.currentWeek - 1) * 5 + Math.min(enrollmentData.currentDay, 5)} of 60</span>
                        <span>{progressPercent.toFixed(0)}%</span>
                      </div>
                    </div>

                    {/* Daily Practice Component (has session content + progress summary) */}
                    <DailyPractice />
                  </>
                ) : (
                  /* Not Enrolled - Show Curriculum Overview with enrollment */
                  <CurriculumOverview onEnroll={handleEnroll} enrolling={enrolling} />
                )}
              </div>
            )}

            {/* FOCUS TRAINING TAB (renamed from Snellen Trainer) */}
            {activeTab === 'trainer' && (
              <div className="space-y-4">
                {/* Settings card - ONLY show when NOT training */}
                {!isTrainingActive && (
                  <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-6 border border-primary-400/20 shadow-lg">
                    <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                      <Eye className="w-6 h-6 text-primary-400" />
                      Focus Training
                    </h3>
                    <p className="text-gray-300 mb-6">
                      Train at your edge of clarity - where text is just barely readable.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                      {/* Device Mode */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-3">Device Mode</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setTrainerDeviceMode('phone')}
                            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                              trainerDeviceMode === 'phone'
                                ? 'bg-primary-600 text-white shadow-lg'
                                : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
                            }`}
                          >
                            <Smartphone className="w-5 h-5" />
                            Phone
                          </button>
                          <button
                            onClick={() => setTrainerDeviceMode('desktop')}
                            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                              trainerDeviceMode === 'desktop'
                                ? 'bg-primary-600 text-white shadow-lg'
                                : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
                            }`}
                          >
                            <Monitor className="w-5 h-5" />
                            Desktop
                          </button>
                        </div>
                      </div>

                      {/* Vision Type */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-3">Training Focus</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setTrainerVisionType('near')}
                            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                              trainerVisionType === 'near'
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
                            }`}
                          >
                            <Eye className="w-5 h-5" />
                            Nearsighted
                          </button>
                          <button
                            onClick={() => setTrainerVisionType('far')}
                            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                              trainerVisionType === 'far'
                                ? 'bg-purple-600 text-white shadow-lg'
                                : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
                            }`}
                          >
                            <Eye className="w-5 h-5" />
                            Farsighted
                          </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-2 text-center">
                          {trainerVisionType === 'near'
                            ? 'Myopia: push clarity outward'
                            : 'Hyperopia: pull clarity closer'}
                        </p>
                      </div>

                      {/* Chart Type */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-3">Chart Type</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setTrainerExerciseType('letters')}
                            className={`flex-1 py-3 px-4 rounded-lg font-bold transition-all ${
                              trainerExerciseType === 'letters'
                                ? 'bg-secondary-600 text-white shadow-lg'
                                : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
                            }`}
                          >
                            ABC
                          </button>
                          <button
                            onClick={() => setTrainerExerciseType('e-directional')}
                            className={`flex-1 py-3 px-4 rounded-lg font-bold transition-all ${
                              trainerExerciseType === 'e-directional'
                                ? 'bg-secondary-600 text-white shadow-lg'
                                : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
                            }`}
                          >
                            E →
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Binocular Training Mode */}
                    <div className="border-t border-gray-700/30 pt-5">
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Binocular Training
                      </label>
                      <p className="text-xs text-gray-500 mb-3">
                        Cross-eye fusion exercises &mdash; hold phone in landscape
                      </p>
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                        {([
                          { value: 'off' as const, label: 'Off', desc: 'Single chart' },
                          { value: 'duplicate' as const, label: 'Duplicate', desc: 'Identical pair' },
                          { value: 'redgreen' as const, label: 'Red/Green', desc: 'Color split' },
                          { value: 'grid-square' as const, label: 'Grid \u25A1', desc: 'Square grid' },
                          { value: 'grid-slanted' as const, label: 'Grid \u25C7', desc: 'Diagonal grid' },
                          { value: 'alternating' as const, label: 'Alternating', desc: 'Fill-in fusion' },
                        ]).map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setBinocularMode(opt.value)}
                            className={`py-2 px-2 rounded-lg text-sm font-medium transition-all text-center ${
                              binocularMode === opt.value
                                ? 'bg-orange-600 text-white shadow-lg shadow-orange-500/20'
                                : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
                            }`}
                          >
                            <div className="text-xs font-semibold">{opt.label}</div>
                            <div className="text-[10px] opacity-70 mt-0.5">{opt.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* START BUTTON - inside settings card */}
                    <button
                      onClick={() => setIsTrainingActive(true)}
                      className="w-full py-4 rounded-xl font-bold text-xl bg-secondary-500 hover:bg-secondary-600 text-white shadow-lg shadow-secondary-500/30 flex items-center justify-center gap-3 transition-all hover:scale-[1.02]"
                    >
                      <Play className="w-6 h-6" />
                      Start Training
                    </button>
                  </div>
                )}

                {/* Training Session - ONLY show when training is active */}
                {isTrainingActive && binocularMode !== 'off' ? (
                  typeof window !== 'undefined' ? createPortal(
                    /* Fullscreen overlay for binocular — hides navbars and microphone */
                    <div className="fixed inset-0 w-full h-full z-[99999] bg-gray-900 flex flex-col overflow-auto">
                      <div className="absolute top-2 left-2 z-[100000] flex gap-2">
                        <button
                          onClick={() => setIsTrainingActive(false)}
                          className="px-4 py-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-white font-medium border border-red-500/50 backdrop-blur-sm transition-all hover:scale-105 shadow-lg"
                        >
                          <RotateCcw className="w-4 h-4 inline mr-2" />
                          Exit Training
                        </button>
                        <div className="px-3 py-2 rounded-lg bg-gray-800/80 text-gray-300 text-sm border border-gray-600/50 backdrop-blur-sm">
                          Press ESC to exit
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col justify-center p-2 pt-10">
                        <TrainingSession
                          visionType={trainerVisionType}
                          exerciseType={trainerExerciseType}
                          deviceMode={trainerDeviceMode}
                          binocularMode={binocularMode}
                          onActiveChange={(active) => {
                            if (!active) setIsTrainingActive(false)
                          }}
                        />
                      </div>
                    </div>,
                    document.body
                  ) : null
                ) : isTrainingActive ? (
                  <div className="space-y-4">
                    <button
                      onClick={() => setIsTrainingActive(false)}
                      className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Back to Settings
                    </button>
                    <TrainingSession
                      visionType={trainerVisionType}
                      exerciseType={trainerExerciseType}
                      deviceMode={trainerDeviceMode}
                      binocularMode={binocularMode}
                      onActiveChange={(active) => {
                        if (!active) setIsTrainingActive(false)
                      }}
                    />
                  </div>
                ) : null}
              </div>
            )}

            {/* VISION LIBRARY TAB (renamed from Quick Exercises) */}
            {activeTab === 'exercises' && (
              <QuickPractice />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default VisionTraining
