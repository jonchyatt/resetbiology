'use client'

import { useState, useEffect } from 'react'
import {
  Clock,
  CheckCircle,
  Play,
  Trophy,
  Target,
  ChevronRight,
  Eye,
  Zap,
  Coffee,
  BookOpen
} from 'lucide-react'
import TrainingSession from './TrainingSession'

interface DailySession {
  day: number
  title: string
  focus: string
  baselineMinutes: number
  exerciseMinutes: number
  exerciseIds: string[]
  exercises: any[]
  coachingCues: string[]
  totalMinutes: number
}

interface Enrollment {
  id: string
  startDate: string
  currentWeek: number
  currentDay: number
  status: string
  sessionsCompleted: number
  totalPracticeMinutes: number
  streakDays: number
  longestStreak: number
  currentReaderStage: number
  initialNearSnellen: string | null
  initialFarSnellen: string | null
  currentNearSnellen: string | null
  currentFarSnellen: string | null
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
  weekGoals: string[]
  weekendRecovery: string[] | null
  session: DailySession | null
}

interface ProgramInfo {
  id: string
  name: string
  totalWeeks: number
  description: string
  phases: { name: string; weeks: string; focus: string }[]
}

export default function DailyPractice() {
  const [loading, setLoading] = useState(true)
  const [enrolled, setEnrolled] = useState(false)
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [todaySession, setTodaySession] = useState<TodaySessionData | null>(null)
  const [programInfo, setProgramInfo] = useState<ProgramInfo | null>(null)
  const [activeExercise, setActiveExercise] = useState<number>(0)
  const [sessionStarted, setSessionStarted] = useState(false)
  const [baselineComplete, setBaselineComplete] = useState(false)
  const [completedExercises, setCompletedExercises] = useState<string[]>([])
  const [showSnellenTrainer, setShowSnellenTrainer] = useState(false)
  const [sessionNotes, setSessionNotes] = useState('')
  const [nearSnellenResult, setNearSnellenResult] = useState('')
  const [farSnellenResult, setFarSnellenResult] = useState('')
  const [enrolling, setEnrolling] = useState(false)

  useEffect(() => {
    loadProgram()
  }, [])

  const loadProgram = async () => {
    try {
      const response = await fetch('/api/vision/program')
      const data = await response.json()

      if (data.success) {
        setEnrolled(data.enrolled)
        if (data.enrolled) {
          setEnrollment(data.enrollment)
          setTodaySession(data.todaySession)
        } else {
          setProgramInfo(data.program)
        }
      }
    } catch (error) {
      console.error('Failed to load program:', error)
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
        body: JSON.stringify({
          action: 'enroll',
          data: {
            initialNearSnellen: nearSnellenResult || null,
            initialFarSnellen: farSnellenResult || null
          }
        })
      })

      const data = await response.json()
      if (data.success) {
        loadProgram() // Reload to get enrollment data
      }
    } catch (error) {
      console.error('Failed to enroll:', error)
    } finally {
      setEnrolling(false)
    }
  }

  const completeExercise = (exerciseId: string) => {
    if (!completedExercises.includes(exerciseId)) {
      setCompletedExercises([...completedExercises, exerciseId])
    }
    // Move to next exercise
    if (todaySession?.session?.exercises && activeExercise < todaySession.session.exercises.length - 1) {
      setActiveExercise(activeExercise + 1)
    }
  }

  const completeSession = async () => {
    if (!todaySession?.session || !enrollment) return

    try {
      const response = await fetch('/api/vision/program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete_session',
          data: {
            week: todaySession.week,
            day: todaySession.day,
            baselineMinutes: todaySession.session.baselineMinutes,
            exerciseMinutes: todaySession.session.exerciseMinutes,
            exercisesCompleted: completedExercises,
            nearSnellenResult: nearSnellenResult || null,
            farSnellenResult: farSnellenResult || null,
            notes: sessionNotes || null
          }
        })
      })

      const data = await response.json()
      if (data.success) {
        loadProgram() // Reload to show completion
      }
    } catch (error) {
      console.error('Failed to complete session:', error)
    }
  }

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm border border-primary-400/20 rounded-xl p-8 text-center shadow-lg">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-700/50 rounded w-1/3 mx-auto mb-4"></div>
          <div className="h-4 bg-gray-700/50 rounded w-2/3 mx-auto"></div>
        </div>
      </div>
    )
  }

  // Not enrolled - show enrollment UI
  if (!enrolled && programInfo) {
    return (
      <div className="space-y-6">
        {/* Program Introduction */}
        <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 border border-primary-400/30 rounded-xl p-8 backdrop-blur-sm">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-3">{programInfo.name}</h2>
            <p className="text-gray-300 max-w-2xl mx-auto">{programInfo.description}</p>
          </div>

          {/* Phase Overview */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {programInfo.phases.map((phase, idx) => (
              <div key={idx} className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-4 text-center border border-primary-400/20">
                <div className="text-xs text-primary-400 font-semibold mb-1">Weeks {phase.weeks}</div>
                <div className="text-white font-bold mb-1">{phase.name}</div>
                <div className="text-gray-400 text-xs">{phase.focus}</div>
              </div>
            ))}
          </div>

          {/* What's included */}
          <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-6 mb-8 border border-primary-400/20">
            <h3 className="text-white font-bold mb-4">What's Included:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2 text-gray-300">
                <CheckCircle className="w-4 h-4 text-secondary-400" />
                60 guided daily sessions
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <CheckCircle className="w-4 h-4 text-secondary-400" />
                Daily Snellen baseline tracking
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <CheckCircle className="w-4 h-4 text-secondary-400" />
                11 progressive exercises
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <CheckCircle className="w-4 h-4 text-secondary-400" />
                Reader glasses progression system
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <CheckCircle className="w-4 h-4 text-secondary-400" />
                Coaching cues each session
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <CheckCircle className="w-4 h-4 text-secondary-400" />
                Progress analytics & milestones
              </div>
            </div>
          </div>

          {/* Optional baseline inputs */}
          <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-6 mb-8 border border-primary-400/20">
            <h3 className="text-white font-bold mb-4">Record Your Starting Baselines (Optional):</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-gray-300 text-sm block mb-2">Near Vision Snellen</label>
                <select
                  value={nearSnellenResult}
                  onChange={(e) => setNearSnellenResult(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                >
                  <option value="">Select...</option>
                  <option value="20/200">20/200</option>
                  <option value="20/100">20/100</option>
                  <option value="20/70">20/70</option>
                  <option value="20/50">20/50</option>
                  <option value="20/40">20/40</option>
                  <option value="20/30">20/30</option>
                  <option value="20/25">20/25</option>
                  <option value="20/20">20/20</option>
                  <option value="20/15">20/15</option>
                </select>
              </div>
              <div>
                <label className="text-gray-300 text-sm block mb-2">Far Vision Snellen</label>
                <select
                  value={farSnellenResult}
                  onChange={(e) => setFarSnellenResult(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
                >
                  <option value="">Select...</option>
                  <option value="20/200">20/200</option>
                  <option value="20/100">20/100</option>
                  <option value="20/70">20/70</option>
                  <option value="20/50">20/50</option>
                  <option value="20/40">20/40</option>
                  <option value="20/30">20/30</option>
                  <option value="20/25">20/25</option>
                  <option value="20/20">20/20</option>
                  <option value="20/15">20/15</option>
                </select>
              </div>
            </div>
            <p className="text-gray-500 text-xs mt-2">
              You can test your baselines using the Snellen trainer before enrolling, or skip and test on Day 1.
            </p>
          </div>

          {/* Enroll button */}
          <div className="text-center">
            <button
              onClick={handleEnroll}
              disabled={enrolling}
              className="px-12 py-4 bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white font-bold text-lg rounded-xl transition-all shadow-lg shadow-primary-500/30 disabled:opacity-50"
            >
              {enrolling ? 'Starting Program...' : 'Start 12-Week Program'}
            </button>
            <p className="text-gray-500 text-sm mt-3">
              Earn 100 points for enrolling + points for every completed session
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Enrolled - show today's session
  if (!todaySession || !enrollment) return null

  // Rest day view
  if (todaySession.isRestDay) {
    return (
      <div className="space-y-6">
        {/* Rest day card */}
        <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 backdrop-blur-sm border border-blue-400/30 rounded-xl p-8 text-center shadow-lg">
          <Coffee className="w-16 h-16 text-blue-400 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-white mb-2">Rest Day</h3>
          <p className="text-gray-300 mb-6">
            Week {todaySession.week} - {todaySession.weekTitle}
          </p>

          {todaySession.weekendRecovery && (
            <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-6 text-left max-w-md mx-auto border border-primary-400/20">
              <h4 className="text-white font-semibold mb-3">Weekend Recovery Activities:</h4>
              <ul className="space-y-2">
                {todaySession.weekendRecovery.map((activity, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-gray-300 text-sm">
                    <CheckCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    {activity}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Session already completed today
  if (todaySession.completed) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-secondary-600/20 to-primary-600/20 backdrop-blur-sm border border-secondary-400/30 rounded-xl p-8 text-center shadow-lg">
          <Trophy className="w-16 h-16 text-secondary-400 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-white mb-2">Session Complete!</h3>
          <p className="text-gray-300 mb-4">
            You've completed today's session: {todaySession.session?.title}
          </p>
          <div className="flex justify-center gap-4 text-sm">
            <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-lg px-4 py-2 border border-primary-400/20">
              <span className="text-gray-400">Streak:</span>
              <span className="text-secondary-400 font-bold ml-2">{enrollment.streakDays} days</span>
            </div>
            <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-lg px-4 py-2 border border-primary-400/20">
              <span className="text-gray-400">Total:</span>
              <span className="text-primary-400 font-bold ml-2">{enrollment.sessionsCompleted} sessions</span>
            </div>
          </div>
          <p className="text-gray-500 text-sm mt-6">
            Come back tomorrow for Day {todaySession.day < 5 ? todaySession.day + 1 : 1} of Week {todaySession.day < 5 ? todaySession.week : todaySession.week + 1}
          </p>
        </div>
      </div>
    )
  }

  // Active session view
  const session = todaySession.session!

  // Show Snellen trainer
  if (showSnellenTrainer) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setShowSnellenTrainer(false)}
          className="text-primary-400 hover:text-primary-300 flex items-center gap-2"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Back to session
        </button>
        <TrainingSession
          visionType="near"
          exerciseType="letters"
          initialLevel={1}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Today's session card */}
      <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm border border-primary-400/30 rounded-xl overflow-hidden shadow-lg">
        {/* Session header */}
        <div className="bg-gradient-to-r from-gray-800/80 to-gray-900/80 backdrop-blur-sm px-6 py-4 border-b border-gray-700/30">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-primary-400 uppercase tracking-wider">
                  {todaySession.phase}
                </span>
                <span className="text-gray-500">•</span>
                <span className="text-xs text-gray-400">
                  Week {todaySession.week}, Day {todaySession.day}
                </span>
              </div>
              <h3 className="text-xl font-bold text-white">{session.title}</h3>
              <p className="text-gray-400 text-sm">{session.focus}</p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 text-gray-400">
                <Clock className="w-4 h-4" />
                <span className="text-sm">{session.totalMinutes} min</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Session not started */}
          {!sessionStarted && (
            <>
              {/* Week goals */}
              <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-4 border border-primary-400/20">
                <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary-400" />
                  This Week's Goals
                </h4>
                <ul className="space-y-1">
                  {todaySession.weekGoals.map((goal, idx) => (
                    <li key={idx} className="text-gray-300 text-sm flex items-start gap-2">
                      <span className="text-primary-400">•</span>
                      {goal}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Session overview */}
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-4 border border-primary-400/20">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Eye className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <div className="text-white font-semibold">Snellen Baseline</div>
                      <div className="text-gray-400 text-sm">{session.baselineMinutes} minutes</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowSnellenTrainer(true)}
                    className="text-primary-400 hover:text-primary-300 text-sm"
                  >
                    Open Trainer
                  </button>
                </div>

                <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-4 border border-primary-400/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-secondary-500/20 rounded-lg">
                      <Zap className="w-5 h-5 text-secondary-400" />
                    </div>
                    <div>
                      <div className="text-white font-semibold">Exercises</div>
                      <div className="text-gray-400 text-sm">{session.exerciseMinutes} minutes</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {session.exercises.map((exercise: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-gray-300">
                        <span className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center text-xs">
                          {idx + 1}
                        </span>
                        {exercise.title}
                        <span className="text-gray-500">({exercise.duration})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Coaching cues */}
              <div className="bg-yellow-500/10 backdrop-blur-sm border border-yellow-500/30 rounded-xl p-4">
                <h4 className="text-yellow-300 font-semibold mb-2 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Today's Coaching Cues
                </h4>
                <ul className="space-y-1">
                  {session.coachingCues.map((cue, idx) => (
                    <li key={idx} className="text-yellow-200/80 text-sm">• {cue}</li>
                  ))}
                </ul>
              </div>

              {/* Start button */}
              <button
                onClick={() => setSessionStarted(true)}
                className="w-full py-4 bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white font-bold text-lg rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5" />
                Start Session
              </button>
            </>
          )}

          {/* Session in progress */}
          {sessionStarted && (
            <>
              {/* Phase 1: Baseline */}
              {!baselineComplete && (
                <div className="space-y-4">
                  <div className="bg-blue-500/20 backdrop-blur-sm border border-blue-400/30 rounded-xl p-6">
                    <h4 className="text-white font-bold text-lg mb-2 flex items-center gap-2">
                      <Eye className="w-5 h-5 text-blue-400" />
                      Step 1: Snellen Baseline ({session.baselineMinutes} min)
                    </h4>
                    <p className="text-gray-300 text-sm mb-4">
                      Test your current vision levels. Record your results below.
                    </p>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="text-gray-400 text-xs block mb-1">Near Vision</label>
                        <select
                          value={nearSnellenResult}
                          onChange={(e) => setNearSnellenResult(e.target.value)}
                          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                        >
                          <option value="">Select...</option>
                          <option value="20/200">20/200</option>
                          <option value="20/100">20/100</option>
                          <option value="20/70">20/70</option>
                          <option value="20/50">20/50</option>
                          <option value="20/40">20/40</option>
                          <option value="20/30">20/30</option>
                          <option value="20/25">20/25</option>
                          <option value="20/20">20/20</option>
                          <option value="20/15">20/15</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-gray-400 text-xs block mb-1">Far Vision</label>
                        <select
                          value={farSnellenResult}
                          onChange={(e) => setFarSnellenResult(e.target.value)}
                          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                        >
                          <option value="">Select...</option>
                          <option value="20/200">20/200</option>
                          <option value="20/100">20/100</option>
                          <option value="20/70">20/70</option>
                          <option value="20/50">20/50</option>
                          <option value="20/40">20/40</option>
                          <option value="20/30">20/30</option>
                          <option value="20/25">20/25</option>
                          <option value="20/20">20/20</option>
                          <option value="20/15">20/15</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowSnellenTrainer(true)}
                        className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
                      >
                        Open Snellen Trainer
                      </button>
                      <button
                        onClick={() => setBaselineComplete(true)}
                        className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-semibold"
                      >
                        Continue to Exercises
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Phase 2: Exercises */}
              {baselineComplete && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-white font-bold text-lg flex items-center gap-2">
                      <Zap className="w-5 h-5 text-secondary-400" />
                      Step 2: Exercises
                    </h4>
                    <span className="text-sm text-gray-400">
                      {completedExercises.length}/{session.exercises.length} complete
                    </span>
                  </div>

                  {/* Exercise list */}
                  <div className="space-y-3">
                    {session.exercises.map((exercise: any, idx: number) => {
                      const isCompleted = completedExercises.includes(exercise.id)
                      const isActive = idx === activeExercise

                      return (
                        <div
                          key={exercise.id}
                          className={`rounded-lg p-4 transition-all ${
                            isCompleted
                              ? 'bg-secondary-500/20 border border-secondary-400/30'
                              : isActive
                              ? 'bg-primary-500/20 border border-primary-400/50'
                              : 'bg-gray-800/30 border border-gray-700/30'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                                isCompleted ? 'bg-secondary-500' : isActive ? 'bg-primary-500' : 'bg-gray-700'
                              }`}>
                                {isCompleted ? (
                                  <CheckCircle className="w-4 h-4 text-white" />
                                ) : (
                                  <span className="text-xs text-white">{idx + 1}</span>
                                )}
                              </div>
                              <div>
                                <div className="text-white font-semibold">{exercise.title}</div>
                                <div className="text-gray-400 text-sm">{exercise.duration} • {exercise.category}</div>
                                {isActive && !isCompleted && (
                                  <p className="text-gray-300 text-sm mt-2">{exercise.summary}</p>
                                )}
                              </div>
                            </div>
                            {!isCompleted && (
                              <button
                                onClick={() => completeExercise(exercise.id)}
                                className={`px-3 py-1 rounded text-sm font-medium ${
                                  isActive
                                    ? 'bg-secondary-500 hover:bg-secondary-600 text-white'
                                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                }`}
                              >
                                {isActive ? 'Complete' : 'Mark Done'}
                              </button>
                            )}
                          </div>

                          {/* Expanded view for active exercise */}
                          {isActive && !isCompleted && exercise.checkpoints && (
                            <div className="mt-4 pt-4 border-t border-gray-700/50">
                              <div className="text-sm text-gray-400 mb-2">Checkpoints:</div>
                              <ul className="space-y-1">
                                {exercise.checkpoints.slice(0, 3).map((checkpoint: string, cidx: number) => (
                                  <li key={cidx} className="text-gray-300 text-sm flex items-start gap-2">
                                    <span className="text-primary-400">•</span>
                                    {checkpoint}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Session notes */}
                  <div className="mt-4">
                    <label className="text-gray-400 text-sm block mb-2">Session Notes (optional)</label>
                    <textarea
                      value={sessionNotes}
                      onChange={(e) => setSessionNotes(e.target.value)}
                      placeholder="How did it feel? Any observations?"
                      className="w-full bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm border border-primary-400/20 rounded-xl px-4 py-3 text-white text-sm resize-none"
                      rows={2}
                    />
                  </div>

                  {/* Complete session button */}
                  {completedExercises.length === session.exercises.length && (
                    <button
                      onClick={completeSession}
                      className="w-full py-4 bg-gradient-to-r from-secondary-500 to-primary-500 hover:from-secondary-600 hover:to-primary-600 text-white font-bold text-lg rounded-xl transition-all flex items-center justify-center gap-2 mt-4"
                    >
                      <Trophy className="w-5 h-5" />
                      Complete Today's Session
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
