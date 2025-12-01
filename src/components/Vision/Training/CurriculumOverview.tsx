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
  Play,
  Sparkles,
  TrendingUp,
  Timer
} from 'lucide-react'
import { visionMasterProgram } from '@/data/visionProtocols'
import { visionExercises } from '@/data/visionExercises'

interface CurriculumOverviewProps {
  onEnroll: () => void
  enrolling?: boolean
}

// Phase colors and icons
const PHASE_CONFIG = {
  'Foundation': { color: 'from-blue-500 to-cyan-500', bgColor: 'bg-blue-600', icon: Eye, description: 'Build neural pathways' },
  'Integration': { color: 'from-cyan-500 to-teal-500', bgColor: 'bg-cyan-600', icon: Brain, description: 'Connect vision & movement' },
  'Speed & Resilience': { color: 'from-teal-500 to-green-500', bgColor: 'bg-teal-600', icon: Zap, description: 'Build speed & endurance' },
  'Advanced': { color: 'from-green-500 to-yellow-500', bgColor: 'bg-green-600', icon: Target, description: 'Peak performance' },
  'Distance Mastery': { color: 'from-yellow-500 to-orange-500', bgColor: 'bg-yellow-600', icon: TrendingUp, description: 'Maximize range' },
  'Integration & Maintenance': { color: 'from-orange-500 to-red-500', bgColor: 'bg-orange-600', icon: Award, description: 'Lock in gains' },
}

export default function CurriculumOverview({ onEnroll, enrolling }: CurriculumOverviewProps) {
  const [expandedWeek, setExpandedWeek] = useState<number | null>(1)
  const [showAllExercises, setShowAllExercises] = useState(false)

  const program = visionMasterProgram

  // Group weeks by phase
  const phases = program.weeklyPlans.reduce((acc, week) => {
    if (!acc[week.phase]) {
      acc[week.phase] = []
    }
    acc[week.phase].push(week)
    return acc
  }, {} as Record<string, typeof program.weeklyPlans>)

  // Get unique exercises used in the program
  const allExerciseIds = new Set<string>()
  program.weeklyPlans.forEach(week => {
    week.sessions.forEach(session => {
      session.exerciseIds.forEach(id => allExerciseIds.add(id))
    })
  })
  const usedExercises = visionExercises.filter(e => allExerciseIds.has(e.id))

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-8 border border-primary-400/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-secondary-500/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-primary-500/20 to-transparent rounded-full blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-secondary-400" />
                <span className="text-sm font-semibold text-secondary-300 uppercase tracking-wider">
                  Complete Vision Program
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
                {program.name}
              </h1>
              <p className="text-gray-300 max-w-2xl text-lg">
                {program.description}
              </p>
            </div>
            <div className="flex-shrink-0">
              <Eye className="w-20 h-20 text-primary-400/30" />
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <StatCard icon={Calendar} label="Duration" value="12 Weeks" />
            <StatCard icon={Timer} label="Sessions" value="60 Total" />
            <StatCard icon={Clock} label="Per Session" value="15-25 min" />
            <StatCard icon={Target} label="Exercises" value={`${usedExercises.length} Types`} />
          </div>
        </div>
      </div>

      {/* Program Timeline */}
      <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-6 border border-primary-400/20 shadow-lg">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary-400" />
          Your 12-Week Journey
        </h2>

        <div className="space-y-6">
          {Object.entries(phases).map(([phaseName, weeks], phaseIdx) => {
            const config = PHASE_CONFIG[phaseName as keyof typeof PHASE_CONFIG] || PHASE_CONFIG['Foundation']
            const PhaseIcon = config.icon

            return (
              <div key={phaseName} className="relative">
                {/* Phase Header */}
                <div className={`bg-gradient-to-r ${config.color} p-0.5 rounded-xl`}>
                  <div className="bg-gray-900 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${config.bgColor}`}>
                          <PhaseIcon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white">Phase {phaseIdx + 1}: {phaseName}</h3>
                          <p className="text-sm text-gray-400">
                            Weeks {weeks[0].week}-{weeks[weeks.length - 1].week} • {config.description}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Weeks in this phase */}
                    <div className="mt-4 space-y-2">
                      {weeks.map(week => (
                        <div key={week.week}>
                          <button
                            onClick={() => setExpandedWeek(expandedWeek === week.week ? null : week.week)}
                            className="w-full flex items-center justify-between p-3 rounded-lg bg-gray-800/30 hover:bg-gray-800/50 backdrop-blur-sm transition-all duration-300"
                          >
                            <div className="flex items-center gap-3">
                              <span className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-white">
                                {week.week}
                              </span>
                              <div className="text-left">
                                <p className="text-white font-medium">{week.title}</p>
                                <p className="text-xs text-gray-400">{week.sessions.length} sessions</p>
                              </div>
                            </div>
                            {expandedWeek === week.week ? (
                              <ChevronDown className="w-5 h-5 text-gray-400" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-gray-400" />
                            )}
                          </button>

                          {/* Expanded week details */}
                          {expandedWeek === week.week && (
                            <div className="mt-2 ml-11 space-y-3 animate-in slide-in-from-top-2 duration-200">
                              {/* Goals */}
                              <div className="bg-gray-800/30 backdrop-blur-sm rounded-lg p-3 border border-primary-400/10">
                                <p className="text-xs font-semibold text-primary-400 mb-2">WEEK GOALS</p>
                                <ul className="space-y-1">
                                  {week.goals.map((goal, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                                      <CheckCircle className="w-4 h-4 text-secondary-400 flex-shrink-0 mt-0.5" />
                                      {goal}
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              {/* Daily sessions preview */}
                              <div className="grid grid-cols-5 gap-2">
                                {week.sessions.map(session => (
                                  <div
                                    key={session.day}
                                    className="bg-gray-800/30 backdrop-blur-sm rounded-lg p-2 text-center border border-primary-400/10"
                                  >
                                    <p className="text-xs text-gray-500">Day {session.day}</p>
                                    <p className="text-xs font-medium text-white truncate" title={session.title}>
                                      {session.title.split(' ').slice(0, 2).join(' ')}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                      {session.baselineMinutes + session.exerciseMinutes}m
                                    </p>
                                  </div>
                                ))}
                              </div>

                              {/* Weekend recovery */}
                              <div className="bg-blue-600/20 backdrop-blur-sm border border-blue-400/20 rounded-lg p-3">
                                <p className="text-xs font-semibold text-blue-400 mb-1">WEEKEND RECOVERY</p>
                                <p className="text-xs text-blue-200/70">
                                  {week.weekendRecovery.join(' • ')}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Exercise Library Preview */}
      <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-6 border border-primary-400/20 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-secondary-400" />
            Exercises You'll Master
          </h2>
          <button
            onClick={() => setShowAllExercises(!showAllExercises)}
            className="text-sm text-primary-400 hover:text-primary-300 transition-colors"
          >
            {showAllExercises ? 'Show less' : 'Show all'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(showAllExercises ? usedExercises : usedExercises.slice(0, 6)).map(exercise => (
            <div
              key={exercise.id}
              className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-4 border border-primary-400/20 hover:border-primary-400/30 hover:shadow-lg hover:shadow-primary-500/20 transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-white">{exercise.title}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  exercise.intensity === 'low' ? 'bg-green-600/30 text-green-300' :
                  exercise.intensity === 'moderate' ? 'bg-yellow-600/30 text-yellow-300' :
                  'bg-red-600/30 text-red-300'
                }`}>
                  {exercise.intensity}
                </span>
              </div>
              <p className="text-sm text-gray-400 mb-3 line-clamp-2">{exercise.summary}</p>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {exercise.duration}
                </span>
                <span className="capitalize px-2 py-0.5 bg-gray-700/30 rounded">
                  {exercise.category}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* What's Included */}
      <div className="bg-gradient-to-r from-secondary-600/20 to-primary-600/20 backdrop-blur-sm rounded-xl p-6 border border-secondary-400/30 shadow-lg">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <Award className="w-5 h-5 text-secondary-400" />
          What's Included
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { icon: Calendar, text: '60 guided daily sessions over 12 weeks' },
            { icon: Eye, text: 'Daily Snellen baseline tracking (near + far)' },
            { icon: Zap, text: '11 progressive exercises with coaching cues' },
            { icon: TrendingUp, text: 'Reader glasses progression system' },
            { icon: Brain, text: 'Audio-guided eye movement exercises' },
            { icon: Target, text: 'Peripheral vision expansion drills' },
            { icon: Timer, text: 'Speed & saccade training with metronome' },
            { icon: Award, text: 'Progress analytics & milestone tracking' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 text-gray-300">
              <item.icon className="w-5 h-5 text-secondary-400 flex-shrink-0" />
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sample Session Preview */}
      <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-6 border border-primary-400/20 shadow-lg">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Play className="w-5 h-5 text-primary-400" />
          Sample Session Preview
        </h2>
        <p className="text-gray-400 mb-6">Here's what a typical daily session looks like:</p>

        <div className="space-y-4">
          {[
            { phase: 'Baseline', time: '3-5 min', desc: 'Quick Snellen test to track your starting point for the day', color: 'blue' },
            { phase: 'Downshift', time: '3-4 min', desc: 'Palming reset and breathing to calm the nervous system', color: 'cyan' },
            { phase: 'Exercises', time: '10-15 min', desc: 'Guided drills with coaching cues and audio guidance', color: 'green' },
            { phase: 'Integration', time: '3-5 min', desc: 'Apply skills to real-world scenarios', color: 'purple' },
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-full bg-${step.color}-600/30 flex items-center justify-center flex-shrink-0`}>
                <span className="text-white font-bold">{i + 1}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-white">{step.phase}</h4>
                  <span className="text-xs text-gray-500">{step.time}</span>
                </div>
                <p className="text-sm text-gray-400">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-primary-600/30 to-secondary-600/30 backdrop-blur-sm rounded-xl p-8 border border-primary-400/30 shadow-2xl text-center">
        <h2 className="text-2xl font-bold text-white mb-3">Ready to Transform Your Vision?</h2>
        <p className="text-gray-300 mb-6 max-w-xl mx-auto">
          Join the 12-week program and follow a proven methodology for improving your eyesight naturally.
        </p>
        <button
          onClick={onEnroll}
          disabled={enrolling}
          className="px-8 py-4 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white font-bold text-lg rounded-xl transition-all duration-300 hover:scale-105 shadow-lg shadow-primary-500/30 flex items-center gap-2 mx-auto"
        >
          {enrolling ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Starting Program...
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              Start 12-Week Program
            </>
          )}
        </button>
        <p className="text-gray-500 text-sm mt-4">
          Earn 100 points for enrolling + points for every completed session
        </p>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-4 text-center border border-primary-400/20 hover:shadow-lg hover:shadow-primary-500/20 transition-all duration-300">
      <Icon className="w-6 h-6 text-primary-400 mx-auto mb-2" />
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  )
}
