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
  RotateCcw,
  Moon,
  Sun
} from 'lucide-react'
import { PortalHeader } from '@/components/Navigation/PortalHeader'
import CurriculumOverview from './Training/CurriculumOverview'
import DailyPractice from './Training/DailyPractice'
import QuickPractice from './Training/QuickPractice'
import TrainingSession from './Training/TrainingSession'
import { currentVisionLocalDayInput } from '@/lib/vision/localDayInput'
import { useToast } from '@/components/ui/Toast'

type TabMode = 'today' | 'trainer' | 'exercises'
const NIGHT_MODE_KEY = 'visionTraining.nightMode'

export function visionTrainingFocusCopy(visionType: 'near' | 'far'): string {
  return visionType === 'near'
    ? 'Near-viewing practice: use a comfortable starting distance.'
    : 'Far-viewing practice: use a comfortable starting distance.'
}

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

type EnrollmentHttpResponse = {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

export const VISION_SIGN_IN_URL = '/auth/login?returnTo=%2Fvision-training'

export type VisionEnrollmentAttempt =
  | { kind: 'enrolled' }
  | { kind: 'sign-in' }
  | { kind: 'already-enrolled' }
  | { kind: 'retry'; message: string }

function responseRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? value as Record<string, unknown>
    : null
}

export async function runVisionEnrollmentAttempt(
  request: () => Promise<EnrollmentHttpResponse>,
  setBusy: (busy: boolean) => void,
  reconcile: () => Promise<boolean>,
): Promise<VisionEnrollmentAttempt> {
  setBusy(true)
  try {
    const response = await request()
    if (response.status === 401) return { kind: 'sign-in' }

    let data: Record<string, unknown> | null = null
    try {
      data = responseRecord(await response.json())
    } catch {
      return {
        kind: 'retry',
        message: 'We could not start your program just yet. Your preview is still here—please try again.',
      }
    }

    const error = typeof data?.error === 'string' ? data.error.toLowerCase() : ''
    const outcome: VisionEnrollmentAttempt | null = response.ok && data?.success === true
      ? { kind: 'enrolled' }
      : response.status === 400 && error.includes('already enrolled')
        ? { kind: 'already-enrolled' }
        : null

    if (outcome) {
      if (await reconcile()) return outcome
      return {
        kind: 'retry',
        message: 'Your program is saved, but we could not reopen it yet. Please try once more.',
      }
    }

    return {
      kind: 'retry',
      message: 'We could not start your program just yet. Your preview is still here—please try again.',
    }
  } catch {
    return {
      kind: 'retry',
      message: 'We could not reach the program service. Your preview is still here—please try again.',
    }
  } finally {
    setBusy(false)
  }
}

export function VisionTraining() {
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<TabMode>('today')
  const [isEnrolled, setIsEnrolled] = useState(false)
  const [enrolling, setEnrolling] = useState(false)
  const [loading, setLoading] = useState(true)
  const [requiresSignIn, setRequiresSignIn] = useState(false)
  const [enrollmentError, setEnrollmentError] = useState<string | null>(null)
  const [enrollmentData, setEnrollmentData] = useState<EnrollmentData | null>(null)
  const [todaySession, setTodaySession] = useState<TodaySessionData | null>(null)
  const [nightMode, setNightMode] = useState(false)

  // Trainer settings
  const [trainerVisionType, setTrainerVisionType] = useState<'near' | 'far'>('near')
  const [trainerExerciseType, setTrainerExerciseType] = useState<'letters' | 'e-directional'>('letters')
  const [trainerDeviceMode, setTrainerDeviceMode] = useState<'phone' | 'desktop'>('phone')
  const [binocularMode, setBinocularMode] = useState<'off' | 'duplicate' | 'redgreen' | 'grid-square' | 'grid-slanted' | 'alternating'>('off')
  const [untimedMode, setUntimedMode] = useState(false)
  const [isTrainingActive, setIsTrainingActive] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setNightMode(window.localStorage.getItem(NIGHT_MODE_KEY) === 'true')
  }, [])

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

  const checkEnrollment = async (): Promise<boolean> => {
    try {
      const response = await fetch(`/api/vision/program?${new URLSearchParams(currentVisionLocalDayInput()).toString()}`)
      let data: Record<string, unknown> | null = null
      try {
        data = responseRecord(await response.json())
      } catch {
        setEnrollmentError('We could not check your program right now. Your free preview is still available.')
        return false
      }

      if (!response.ok || data?.success !== true) {
        setEnrollmentError('We could not check your program right now. Your free preview is still available.')
        return false
      }

      if (data.authenticated === false) {
        setRequiresSignIn(true)
        setIsEnrolled(false)
        setEnrollmentData(null)
        setTodaySession(null)
        setEnrollmentError(null)
        return false
      }

      setRequiresSignIn(false)
      setEnrollmentError(null)
      if (data.success && data.enrolled) {
        const enrollment = responseRecord(data.enrollment)
        const session = responseRecord(data.todaySession)
        setIsEnrolled(true)
        setEnrollmentData({
          currentWeek: Number(enrollment?.currentWeek || session?.week || 1),
          currentDay: Number(enrollment?.currentDay || session?.day || 1),
          sessionsCompleted: Number(enrollment?.sessionsCompleted || 0),
          totalPracticeMinutes: Number(enrollment?.totalPracticeMinutes || 0),
          streakDays: Number(enrollment?.streakDays || 0),
          phaseProgress: responseRecord(enrollment?.phaseProgress) as EnrollmentData['phaseProgress'] || {
            phase1: false, phase2: false, phase3: false,
            phase4: false, phase5: false, phase6: false
          }
        })
        setTodaySession(data.todaySession as TodaySessionData)
        return true
      }
      setIsEnrolled(false)
      setEnrollmentData(null)
      setTodaySession(null)
      return false
    } catch (error) {
      console.error('Failed to check enrollment:', error)
      setEnrollmentError('We could not reach the program service. Your free preview is still available.')
      return false
    } finally {
      setLoading(false)
    }
  }

  const handleEnroll = async () => {
    setEnrollmentError(null)
    if (requiresSignIn) {
      window.location.assign(VISION_SIGN_IN_URL)
      return
    }

    const outcome = await runVisionEnrollmentAttempt(
      () => fetch('/api/vision/program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...currentVisionLocalDayInput(), action: 'enroll', data: {} })
      }),
      setEnrolling,
      checkEnrollment,
    )

    if (outcome.kind === 'sign-in') {
      window.location.assign(VISION_SIGN_IN_URL)
      return
    }

    if (outcome.kind === 'enrolled' || outcome.kind === 'already-enrolled') {
      setActiveTab('today')
      toast.success('Your 12-week vision practice is ready.')
      return
    }

    setEnrollmentError(outcome.message)
    toast.info(outcome.message)
  }

  const toggleNightMode = () => {
    setNightMode(current => {
      const next = !current
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(NIGHT_MODE_KEY, String(next))
      }
      return next
    })
  }

  const pageShellClass = nightMode
    ? 'min-h-screen bg-[#070604]'
    : 'min-h-screen bg-gradient-to-br from-gray-900 to-gray-800'
  const pageBackgroundImage = nightMode
    ? 'linear-gradient(rgba(8, 6, 3, 0.88), rgba(5, 4, 2, 0.94)), url(/hero-background.jpg)'
    : 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)'

  if (loading) {
    return (
      <div className={pageShellClass}
        style={{
          backgroundImage: pageBackgroundImage,
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
    <div
      className={pageShellClass}
      data-vision-night-mode={nightMode ? 'true' : 'false'}
      style={{
        backgroundImage: pageBackgroundImage,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}>
      <div className="relative z-10 min-h-screen flex flex-col pt-28">
        <PortalHeader
          section="Vision Training"
          secondaryBackLink="/daily-history"
          secondaryBackText="Daily History"
        />

        {/* Page Title — compact on mobile */}
        <div className="text-center py-2">
          <h2 className="text-2xl md:text-4xl font-bold text-white mb-0">
            <Eye className="inline-block w-6 h-6 md:w-8 md:h-8 mr-1 text-primary-400" />
            <span className="text-primary-400">Vision</span> Training
          </h2>
        </div>

        {/* Tab Navigation - 3 tabs only */}
        <div className="flex flex-wrap justify-center gap-2 md:gap-4 mb-3 md:mb-6 px-4">
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
          <button
            type="button"
            onClick={toggleNightMode}
            aria-pressed={nightMode}
            className={`px-4 md:px-5 py-3 rounded-lg font-semibold transition-all duration-300 flex items-center gap-2 ${
              nightMode
                ? 'bg-amber-500/20 text-amber-100 border border-amber-500/40'
                : 'bg-gray-800/30 backdrop-blur-sm text-gray-300 hover:bg-gray-700/30'
            }`}
          >
            {nightMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            <span className="hidden sm:inline">{nightMode ? 'Day Mode' : 'Night Mode'}</span>
          </button>
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
                    <div className={`backdrop-blur-sm rounded-xl p-4 border ${
                      nightMode
                        ? 'bg-gradient-to-br from-[#17100a]/85 to-[#0c0906]/85 border-amber-900/40'
                        : 'bg-gradient-to-br from-gray-800/60 to-gray-900/60 border-primary-400/20'
                    }`}>
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
                    <DailyPractice nightMode={nightMode} />
                  </>
                ) : (
                  /* Not Enrolled - Show Curriculum Overview with enrollment */
                  <CurriculumOverview
                    onEnroll={handleEnroll}
                    enrolling={enrolling}
                    requiresSignIn={requiresSignIn}
                    enrollmentError={enrollmentError}
                  />
                )}
              </div>
            )}

            {/* FOCUS TRAINING TAB (renamed from Snellen Trainer) */}
            {activeTab === 'trainer' && (
              <div className="space-y-4">
                {/* Settings card - ONLY show when NOT training */}
                {!isTrainingActive && (
                  <div className={`backdrop-blur-sm rounded-xl p-4 sm:p-6 border shadow-lg ${
                    nightMode
                      ? 'bg-gradient-to-br from-[#17100a]/90 to-[#0c0906]/90 border-amber-900/40'
                      : 'bg-gradient-to-br from-gray-800/80 to-gray-900/80 border-primary-400/20'
                  }`}>
                    {/* Header with inline Start Training */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <h3 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                          <Eye className="w-5 h-5 sm:w-6 sm:h-6 text-primary-400" />
                          Focus Training
                        </h3>
                        <p className="text-gray-300 mt-1 text-xs sm:text-sm">
                          Train at your edge of clarity - where text is just barely readable.
                        </p>
                      </div>
                      <button
                        onClick={() => setIsTrainingActive(true)}
                        className="bg-gradient-to-r from-secondary-500 to-secondary-600 hover:from-secondary-600 hover:to-secondary-700 text-white px-6 py-3 rounded-xl font-bold text-lg flex items-center gap-2 shadow-lg shadow-secondary-500/30 hover:scale-105 active:scale-95 transition-all whitespace-nowrap"
                      >
                        <Play className="w-5 h-5" />
                        Start Training
                      </button>
                    </div>

                    {/* Settings grid — stacks on mobile, 3-col on desktop */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-3">
                      {/* Device Mode */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Device Mode</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setTrainerDeviceMode('phone')}
                            className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-sm ${
                              trainerDeviceMode === 'phone'
                                ? 'bg-primary-600 text-white shadow-md shadow-primary-500/30'
                                : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
                            }`}
                          >
                            <Smartphone className="w-4 h-4" />
                            Phone
                          </button>
                          <button
                            onClick={() => setTrainerDeviceMode('desktop')}
                            className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-sm ${
                              trainerDeviceMode === 'desktop'
                                ? 'bg-primary-600 text-white shadow-md shadow-primary-500/30'
                                : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
                            }`}
                          >
                            <Monitor className="w-4 h-4" />
                            Desktop
                          </button>
                        </div>
                      </div>

                      {/* Training Focus */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Training Focus</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setTrainerVisionType('near')}
                            className={`flex-1 py-2 px-2 sm:px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm ${
                              trainerVisionType === 'near'
                                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30'
                                : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
                            }`}
                          >
                            <Eye className="w-4 h-4 shrink-0" />
                            <span>Near</span>
                          </button>
                          <button
                            onClick={() => setTrainerVisionType('far')}
                            className={`flex-1 py-2 px-2 sm:px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm ${
                              trainerVisionType === 'far'
                                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30'
                                : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
                            }`}
                          >
                            <Eye className="w-4 h-4 shrink-0" />
                            <span>Far</span>
                          </button>
                        </div>
                      </div>

                      {/* Chart Type — full width on 2-col mobile */}
                      <div className="col-span-2 sm:col-span-1">
                        <label className="block text-sm font-medium text-gray-300 mb-2">Chart Type</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setTrainerExerciseType('letters')}
                            className={`flex-1 py-2 px-3 rounded-lg font-bold transition-all text-base ${
                              trainerExerciseType === 'letters'
                                ? 'bg-secondary-600 text-white shadow-md shadow-secondary-500/30'
                                : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
                            }`}
                          >
                            ABC
                          </button>
                          <button
                            onClick={() => setTrainerExerciseType('e-directional')}
                            className={`flex-1 py-2 px-3 rounded-lg font-bold transition-all text-base ${
                              trainerExerciseType === 'e-directional'
                                ? 'bg-secondary-600 text-white shadow-md shadow-secondary-500/30'
                                : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
                            }`}
                          >
                            E →
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Dynamic info text */}
                    <p className="text-xs sm:text-sm text-gray-400 mb-3">
                      {visionTrainingFocusCopy(trainerVisionType)}
                    </p>

                    {/* Binocular Training Mode */}
                    <div className="border-t border-gray-700/30 pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-300">Binocular Training</label>
                        <span className="text-[10px] text-gray-500">hold phone in landscape</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
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
                            className={`py-2 px-3 rounded-lg font-medium transition-all text-center ${
                              binocularMode === opt.value
                                ? 'bg-orange-600 text-white shadow-md shadow-orange-500/30'
                                : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
                            }`}
                          >
                            <div className="text-xs font-semibold">{opt.label}</div>
                            <div className="text-[10px] opacity-70 mt-0.5">{opt.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Untimed mode toggle */}
                    <div className="border-t border-gray-700/30 pt-3 mt-3">
                      <button
                        onClick={() => setUntimedMode(!untimedMode)}
                        className="flex items-center justify-between w-full"
                      >
                        <div>
                          <span className="text-sm font-medium text-gray-300">Free Practice</span>
                          <p className="text-[10px] text-gray-500 mt-0.5">No level timer, no forced resets — just train</p>
                        </div>
                        <div className={`w-11 h-6 rounded-full transition-all relative ${
                          untimedMode ? 'bg-secondary-500' : 'bg-gray-600'
                        }`}>
                          <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                            untimedMode ? 'left-[22px]' : 'left-0.5'
                          }`} />
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Training Session - ONLY show when training is active */}
                {isTrainingActive && binocularMode !== 'off' ? (
                  typeof window !== 'undefined' ? createPortal(
                    /* Fullscreen overlay for binocular — hides navbars and microphone */
                    <div className={`fixed inset-0 w-full h-full z-[99999] flex flex-col overflow-hidden ${nightMode ? 'bg-[#050403]' : 'bg-gray-900'}`}>
                      <div className="flex-1 flex flex-col">
                        <TrainingSession
                          visionType={trainerVisionType}
                          exerciseType={trainerExerciseType}
                          deviceMode={trainerDeviceMode}
                          binocularMode={binocularMode}
                          untimed={untimedMode}
                          nightMode={nightMode}
                          onExit={() => setIsTrainingActive(false)}
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
                      className={`flex items-center gap-2 transition-colors ${nightMode ? 'text-amber-100/60 hover:text-amber-100' : 'text-gray-400 hover:text-white'}`}
                    >
                      <RotateCcw className="w-4 h-4" />
                      Back to Settings
                    </button>
                    <TrainingSession
                      visionType={trainerVisionType}
                      exerciseType={trainerExerciseType}
                      deviceMode={trainerDeviceMode}
                      binocularMode={binocularMode}
                      untimed={untimedMode}
                      nightMode={nightMode}
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
