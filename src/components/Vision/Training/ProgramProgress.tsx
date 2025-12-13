'use client'

import { useState } from 'react'
import {
  Calendar,
  Clock,
  Target,
  Zap,
  Eye,
  Brain,
  Award,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Circle,
  Sparkles,
  TrendingUp,
  Timer,
  Play,
  Lock
} from 'lucide-react'
import { visionMasterProgram } from '@/data/visionProtocols'

interface CompletedSession {
  week: number
  day: number
  sessionTitle: string
  completedAt: string
  localDate: string
}

interface ProgramProgressProps {
  enrollment: {
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
  completedSessions: CompletedSession[]
  onMarkComplete: (week: number, day: number) => Promise<void>
  onStartSession: (week: number, day: number) => void
}

// Phase colors and icons
const PHASE_CONFIG = {
  'Foundation': { color: 'from-blue-500 to-cyan-500', bgColor: 'bg-blue-600', icon: Eye, phaseNum: 1 },
  'Integration': { color: 'from-cyan-500 to-teal-500', bgColor: 'bg-cyan-600', icon: Brain, phaseNum: 2 },
  'Speed & Resilience': { color: 'from-teal-500 to-green-500', bgColor: 'bg-teal-600', icon: Zap, phaseNum: 3 },
  'Advanced': { color: 'from-green-500 to-yellow-500', bgColor: 'bg-green-600', icon: Target, phaseNum: 4 },
  'Distance Mastery': { color: 'from-yellow-500 to-orange-500', bgColor: 'bg-yellow-600', icon: TrendingUp, phaseNum: 5 },
  'Integration & Maintenance': { color: 'from-orange-500 to-red-500', bgColor: 'bg-orange-600', icon: Award, phaseNum: 6 },
}

export default function ProgramProgress({
  enrollment,
  completedSessions,
  onMarkComplete,
  onStartSession
}: ProgramProgressProps) {
  const [expandedWeek, setExpandedWeek] = useState<number | null>(enrollment.currentWeek)
  const [markingComplete, setMarkingComplete] = useState<string | null>(null)

  const program = visionMasterProgram

  // Create a set for quick lookup of completed sessions
  const completedSet = new Set(
    completedSessions.map(s => `${s.week}-${s.day}`)
  )

  // Check if a session is completed
  const isSessionCompleted = (week: number, day: number) => {
    return completedSet.has(`${week}-${day}`)
  }

  // Check if session is in the past (can be marked complete retroactively)
  const isSessionPast = (week: number, day: number) => {
    if (week < enrollment.currentWeek) return true
    if (week === enrollment.currentWeek && day < enrollment.currentDay) return true
    return false
  }

  // Check if session is today's session
  const isToday = (week: number, day: number) => {
    return week === enrollment.currentWeek && day === enrollment.currentDay
  }

  // Check if session is future (locked)
  const isFuture = (week: number, day: number) => {
    if (week > enrollment.currentWeek) return true
    if (week === enrollment.currentWeek && day > enrollment.currentDay) return true
    return false
  }

  // Handle marking a past session as complete
  const handleMarkComplete = async (week: number, day: number) => {
    const key = `${week}-${day}`
    setMarkingComplete(key)
    try {
      await onMarkComplete(week, day)
    } finally {
      setMarkingComplete(null)
    }
  }

  // Group weeks by phase
  const phases = program.weeklyPlans.reduce((acc, week) => {
    if (!acc[week.phase]) {
      acc[week.phase] = []
    }
    acc[week.phase].push(week)
    return acc
  }, {} as Record<string, typeof program.weeklyPlans>)

  // Calculate overall progress
  const totalSessions = 60 // 12 weeks * 5 days
  const progressPercent = Math.round((enrollment.sessionsCompleted / totalSessions) * 100)

  return (
    <div className="space-y-6">
      {/* Progress Overview Card */}
      <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-secondary-400" />
              Your Progress
            </h2>
            <p className="text-sm text-gray-400">Week {enrollment.currentWeek}, Day {enrollment.currentDay}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-white">{progressPercent}%</p>
            <p className="text-xs text-gray-400">{enrollment.sessionsCompleted}/60 sessions</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-700/50 rounded-full h-3 mb-4">
          <div
            className="bg-gradient-to-r from-primary-500 to-secondary-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-800/30 backdrop-blur-sm rounded-lg p-3 text-center">
            <Timer className="w-5 h-5 text-primary-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-white">{enrollment.totalPracticeMinutes}</p>
            <p className="text-xs text-gray-400">Minutes</p>
          </div>
          <div className="bg-gray-800/30 backdrop-blur-sm rounded-lg p-3 text-center">
            <Zap className="w-5 h-5 text-secondary-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-white">{enrollment.streakDays}</p>
            <p className="text-xs text-gray-400">Day Streak</p>
          </div>
          <div className="bg-gray-800/30 backdrop-blur-sm rounded-lg p-3 text-center">
            <Award className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-white">
              {Object.values(enrollment.phaseProgress).filter(Boolean).length}/6
            </p>
            <p className="text-xs text-gray-400">Phases Done</p>
          </div>
        </div>
      </div>

      {/* 12-Week Plan with Completion Status */}
      <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-6 border border-primary-400/20 shadow-lg">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary-400" />
          12-Week Program
        </h2>

        <div className="space-y-4">
          {Object.entries(phases).map(([phaseName, weeks], phaseIdx) => {
            const config = PHASE_CONFIG[phaseName as keyof typeof PHASE_CONFIG] || PHASE_CONFIG['Foundation']
            const PhaseIcon = config.icon
            const phaseComplete = enrollment.phaseProgress[`phase${config.phaseNum}` as keyof typeof enrollment.phaseProgress]

            // Calculate phase completion percentage
            const phaseSessions = weeks.flatMap(w => w.sessions)
            const phaseCompleted = phaseSessions.filter(s => {
              const weekNum = weeks.find(w => w.sessions.includes(s))?.week || 0
              return isSessionCompleted(weekNum, s.day)
            }).length
            const phasePercent = Math.round((phaseCompleted / phaseSessions.length) * 100)

            return (
              <div key={phaseName} className="relative">
                {/* Phase Header */}
                <div className={`bg-gradient-to-r ${config.color} p-0.5 rounded-xl ${phaseComplete ? 'opacity-100' : 'opacity-80'}`}>
                  <div className="bg-gray-900 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${config.bgColor} ${phaseComplete ? '' : 'opacity-70'}`}>
                          {phaseComplete ? (
                            <CheckCircle className="w-5 h-5 text-white" />
                          ) : (
                            <PhaseIcon className="w-5 h-5 text-white" />
                          )}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            Phase {phaseIdx + 1}: {phaseName}
                            {phaseComplete && (
                              <span className="text-xs bg-green-600/30 text-green-300 px-2 py-0.5 rounded-full">
                                Complete
                              </span>
                            )}
                          </h3>
                          <p className="text-sm text-gray-400">
                            Weeks {weeks[0].week}-{weeks[weeks.length - 1].week}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-white">{phasePercent}%</p>
                        <p className="text-xs text-gray-400">{phaseCompleted}/{phaseSessions.length}</p>
                      </div>
                    </div>

                    {/* Phase progress bar */}
                    <div className="w-full bg-gray-700/30 rounded-full h-1.5 mb-3">
                      <div
                        className={`bg-gradient-to-r ${config.color} h-1.5 rounded-full transition-all duration-500`}
                        style={{ width: `${phasePercent}%` }}
                      />
                    </div>

                    {/* Weeks in this phase */}
                    <div className="space-y-2">
                      {weeks.map(week => {
                        const weekCompleted = week.sessions.filter(s => isSessionCompleted(week.week, s.day)).length
                        const weekPercent = Math.round((weekCompleted / week.sessions.length) * 100)

                        return (
                          <div key={week.week}>
                            <button
                              onClick={() => setExpandedWeek(expandedWeek === week.week ? null : week.week)}
                              className="w-full flex items-center justify-between p-3 rounded-lg bg-gray-800/30 hover:bg-gray-800/50 backdrop-blur-sm transition-all duration-300"
                            >
                              <div className="flex items-center gap-3">
                                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                  weekPercent === 100
                                    ? 'bg-green-600 text-white'
                                    : week.week === enrollment.currentWeek
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-gray-700 text-white'
                                }`}>
                                  {weekPercent === 100 ? <CheckCircle className="w-4 h-4" /> : week.week}
                                </span>
                                <div className="text-left">
                                  <p className="text-white font-medium">{week.title}</p>
                                  <p className="text-xs text-gray-400">
                                    {weekCompleted}/{week.sessions.length} sessions completed
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-medium ${
                                  weekPercent === 100 ? 'text-green-400' : 'text-gray-400'
                                }`}>
                                  {weekPercent}%
                                </span>
                                {expandedWeek === week.week ? (
                                  <ChevronDown className="w-5 h-5 text-gray-400" />
                                ) : (
                                  <ChevronRight className="w-5 h-5 text-gray-400" />
                                )}
                              </div>
                            </button>

                            {/* Expanded week details */}
                            {expandedWeek === week.week && (
                              <div className="mt-2 ml-11 space-y-2 animate-in slide-in-from-top-2 duration-200">
                                {/* Daily sessions with completion status */}
                                {week.sessions.map(session => {
                                  const completed = isSessionCompleted(week.week, session.day)
                                  const past = isSessionPast(week.week, session.day)
                                  const today = isToday(week.week, session.day)
                                  const future = isFuture(week.week, session.day)
                                  const isMarking = markingComplete === `${week.week}-${session.day}`

                                  return (
                                    <div
                                      key={session.day}
                                      className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-200 ${
                                        completed
                                          ? 'bg-green-600/20 border-green-400/30'
                                          : today
                                          ? 'bg-primary-600/20 border-primary-400/30'
                                          : past
                                          ? 'bg-yellow-600/10 border-yellow-400/20'
                                          : 'bg-gray-800/30 border-gray-600/20 opacity-50'
                                      }`}
                                    >
                                      <div className="flex items-center gap-3">
                                        {completed ? (
                                          <CheckCircle className="w-5 h-5 text-green-400" />
                                        ) : future ? (
                                          <Lock className="w-5 h-5 text-gray-500" />
                                        ) : (
                                          <Circle className="w-5 h-5 text-gray-500" />
                                        )}
                                        <div>
                                          <p className={`font-medium ${completed ? 'text-green-300' : 'text-white'}`}>
                                            Day {session.day}: {session.title}
                                          </p>
                                          <p className="text-xs text-gray-400">
                                            {session.baselineMinutes + session.exerciseMinutes} min
                                          </p>
                                        </div>
                                      </div>

                                      {/* Action buttons */}
                                      <div className="flex items-center gap-2">
                                        {completed ? (
                                          <span className="text-xs text-green-400 px-2 py-1 bg-green-600/20 rounded">
                                            Done
                                          </span>
                                        ) : today ? (
                                          <button
                                            onClick={() => onStartSession(week.week, session.day)}
                                            className="flex items-center gap-1 text-xs text-primary-300 px-3 py-1.5 bg-primary-600/30 hover:bg-primary-600/50 rounded transition-colors"
                                          >
                                            <Play className="w-3 h-3" />
                                            Start
                                          </button>
                                        ) : past && !completed ? (
                                          <button
                                            onClick={() => handleMarkComplete(week.week, session.day)}
                                            disabled={isMarking}
                                            className="flex items-center gap-1 text-xs text-yellow-300 px-3 py-1.5 bg-yellow-600/20 hover:bg-yellow-600/30 rounded transition-colors disabled:opacity-50"
                                          >
                                            {isMarking ? (
                                              <div className="w-3 h-3 border border-yellow-300 border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                              <CheckCircle className="w-3 h-3" />
                                            )}
                                            Mark Done
                                          </button>
                                        ) : (
                                          <span className="text-xs text-gray-500">Upcoming</span>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}

                                {/* Weekend recovery info */}
                                <div className="bg-blue-600/10 backdrop-blur-sm border border-blue-400/20 rounded-lg p-3 mt-2">
                                  <p className="text-xs font-semibold text-blue-400 mb-1">WEEKEND RECOVERY</p>
                                  <p className="text-xs text-blue-200/70">
                                    {week.weekendRecovery.join(' • ')}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
