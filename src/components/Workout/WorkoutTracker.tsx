"use client"

import { useState, useEffect } from "react"
import { Dumbbell, Target, Plus, X, Calendar, TrendingUp, Clock, Play, Pause, StopCircle } from "lucide-react"

export interface WorkoutProgram {
  id: string
  name: string
  programType: string
  template: any // JSON
  description?: string
  notes?: string
  isActive: boolean
}

export interface WorkoutSession {
  id: string
  exercises: any // JSON
  duration: number
  programId?: string
  completedAt: string
  notes?: string
}

export interface ExerciseEntry {
  id: string
  name: string
  category: string
  sets: { reps: number; weight: number; completed: boolean }[]
}

export interface SetEntry {
  reps: number
  weight: number
  completed: boolean
}

export function WorkoutTracker() {
  const [activeTab, setActiveTab] = useState<'current' | 'programs' | 'history'>('current')
  const [workoutPrograms, setWorkoutPrograms] = useState<WorkoutProgram[]>([])
  const [currentSession, setCurrentSession] = useState<WorkoutSession | null>(null)
  const [sessionExercises, setSessionExercises] = useState<ExerciseEntry[]>([])
  const [history, setHistory] = useState<WorkoutSession[]>([])
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [timerStartTime, setTimerStartTime] = useState<number | null>(null)

  // Form state for adding exercise
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false)
  const [exerciseName, setExerciseName] = useState('')
  const [exerciseCategory, setExerciseCategory] = useState('Chest')

  useEffect(() => {
    fetchPrograms()
    fetchHistory()
  }, [])

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout

    if (isTimerRunning && timerStartTime) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - timerStartTime) / 1000))
      }, 1000)
    }

    return () => clearInterval(interval)
  }, [isTimerRunning, timerStartTime])

  const fetchPrograms = async () => {
    try {
      const response = await fetch('/api/workout/programs', {
        credentials: 'include'
      })
      const data = await response.json()

      if (data.success && data.programs) {
        setWorkoutPrograms(data.programs)
      }
    } catch (error) {
      console.error('Error loading programs:', error)
    }
  }

  const fetchHistory = async () => {
    try {
      const response = await fetch('/api/workout/sessions', {
        credentials: 'include'
      })
      const data = await response.json()

      if (data.success && data.sessions) {
        setHistory(data.sessions)
      }
    } catch (error) {
      console.error('Error loading history:', error)
    }
  }

  const startWorkout = () => {
    const now = Date.now()
    setTimerStartTime(now)
    setIsTimerRunning(true)
    setSessionExercises([])
  }

  const pauseWorkout = () => {
    setIsTimerRunning(false)
  }

  const resumeWorkout = () => {
    if (timerStartTime) {
      const now = Date.now()
      setTimerStartTime(now - elapsedTime * 1000)
      setIsTimerRunning(true)
    }
  }

  const endWorkout = async () => {
    if (sessionExercises.length === 0) {
      alert('Add at least one exercise before ending workout')
      return
    }

    try {
      const response = await fetch('/api/workout/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          exercises: sessionExercises,
          duration: elapsedTime,
          completedAt: new Date().toISOString()
        })
      })

      const data = await response.json()

      if (data.success) {
        console.log(`✅ Workout saved! +${data.pointsAwarded} points`)
        setSessionExercises([])
        setElapsedTime(0)
        setIsTimerRunning(false)
        setTimerStartTime(null)
        fetchHistory()
      } else {
        alert(`Failed to save workout: ${data.error}`)
      }
    } catch (error) {
      console.error('Error saving workout:', error)
      alert('Failed to save workout')
    }
  }

  const addExercise = () => {
    if (!exerciseName) {
      alert('Enter exercise name')
      return
    }

    const newExercise: ExerciseEntry = {
      id: crypto.randomUUID(),
      name: exerciseName,
      category: exerciseCategory,
      sets: [{ reps: 8, weight: 0, completed: false }]
    }

    setSessionExercises([...sessionExercises, newExercise])
    setExerciseName('')
    setShowAddExerciseModal(false)
  }

  const addSet = (exerciseId: string) => {
    setSessionExercises(prev => prev.map(ex =>
      ex.id === exerciseId
        ? { ...ex, sets: [...ex.sets, { reps: 8, weight: 0, completed: false }] }
        : ex
    ))
  }

  const updateSet = (exerciseId: string, setIndex: number, field: 'reps' | 'weight' | 'completed', value: any) => {
    setSessionExercises(prev => prev.map(ex =>
      ex.id === exerciseId
        ? {
            ...ex,
            sets: ex.sets.map((set, idx) =>
              idx === setIndex ? { ...set, [field]: value } : set
            )
          }
        : ex
    ))
  }

  const removeExercise = (exerciseId: string) => {
    setSessionExercises(prev => prev.filter(ex => ex.id !== exerciseId))
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const ProgramCard = ({ program }: { program: WorkoutProgram }) => (
    <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/30 rounded-lg p-6 border border-primary-400/30 backdrop-blur-sm shadow-xl hover:shadow-primary-400/20 transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-white">{program.name}</h3>
          <span className="text-xs text-secondary-300 bg-secondary-500/20 px-2 py-1 rounded-full mt-2 inline-block">
            {program.programType}
          </span>
        </div>
        {program.isActive && (
          <span className="text-xs text-green-300 bg-green-500/20 px-3 py-1 rounded-full">
            Active
          </span>
        )}
      </div>

      <div className="space-y-3 text-sm">
        {program.description && (
          <p className="text-gray-300">{program.description}</p>
        )}

        {program.notes && (
          <div className="border-t border-gray-600 pt-3">
            <p className="text-gray-400 text-xs italic">{program.notes}</p>
          </div>
        )}

        <button
          onClick={() => {
            // Load program exercises into current session
            startWorkout()
          }}
          className="w-full bg-secondary-600/30 hover:bg-secondary-600/50 text-secondary-200 font-medium py-2 px-4 rounded-lg transition-colors"
        >
          Start This Program
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative"
         style={{
           backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
           backgroundSize: 'cover',
           backgroundPosition: 'center',
           backgroundAttachment: 'fixed'
         }}>
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm shadow-2xl border-b border-primary-400/30 mt-16">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <img src="/logo1.png" alt="Reset Biology" className="h-8 w-auto mr-3 drop-shadow-lg" />
              <div>
                <h1 className="text-xl font-bold text-white drop-shadow-lg">Portal</h1>
                <span className="text-lg text-gray-200 drop-shadow-sm">• Workout Tracker</span>
              </div>
            </div>
            <a href="/portal" className="text-primary-300 hover:text-primary-200 font-medium text-sm transition-colors drop-shadow-sm">
              ← Back to Portal
            </a>
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="text-center py-8">
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
          <span className="text-secondary-400">Workout</span> Tracker
        </h2>
        <p className="text-xl md:text-2xl text-gray-200 max-w-3xl mx-auto">
          Program-based sessions, timers, and progress for peptide-optimized training
        </p>
      </div>

      {/* Tabs */}
      <div className="container mx-auto px-4 pb-8">
        <div className="flex justify-center mb-8">
          <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-1 border border-primary-400/30 hover:shadow-primary-400/20 transition-all duration-300">
            {(['current', 'programs', 'history'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 rounded-lg font-medium transition-all capitalize ${
                  activeTab === tab
                    ? 'bg-secondary-500 text-white shadow-lg'
                    : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'current' && (
          <div className="max-w-6xl mx-auto grid gap-6 lg:grid-cols-3">
            {/* Main content */}
            <div className="lg:col-span-2">
              <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-2xl hover:shadow-primary-400/20 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white flex items-center">
                    <Dumbbell className="h-5 w-5 mr-2 text-secondary-400"/>Current Session
                  </h3>
                  <div className="flex gap-2">
                    {!isTimerRunning && elapsedTime === 0 && (
                      <button
                        onClick={startWorkout}
                        className="bg-secondary-600 hover:bg-secondary-700 text-white font-medium py-2 px-4 rounded-lg flex items-center"
                      >
                        <Play className="h-4 w-4 mr-1"/>Start
                      </button>
                    )}
                    {isTimerRunning && (
                      <button
                        onClick={pauseWorkout}
                        className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg flex items-center"
                      >
                        <Pause className="h-4 w-4 mr-1"/>Pause
                      </button>
                    )}
                    {!isTimerRunning && elapsedTime > 0 && (
                      <button
                        onClick={resumeWorkout}
                        className="bg-secondary-600 hover:bg-secondary-700 text-white font-medium py-2 px-4 rounded-lg flex items-center"
                      >
                        <Play className="h-4 w-4 mr-1"/>Resume
                      </button>
                    )}
                    {elapsedTime > 0 && (
                      <button
                        onClick={endWorkout}
                        className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg flex items-center"
                      >
                        <StopCircle className="h-4 w-4 mr-1"/>End
                      </button>
                    )}
                  </div>
                </div>

                {elapsedTime === 0 ? (
                  <p className="text-gray-300">No active workout. Start a session to begin tracking.</p>
                ) : (
                  <div className="space-y-4">
                    <button
                      onClick={() => setShowAddExerciseModal(true)}
                      className="w-full bg-primary-600/30 hover:bg-primary-600/50 text-primary-200 font-medium py-2 px-4 rounded-lg transition-colors"
                    >
                      <Plus className="inline h-4 w-4 mr-1"/>Add Exercise
                    </button>

                    {sessionExercises.map((exercise) => (
                      <div key={exercise.id} className="bg-gray-700/30 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="text-white font-bold">{exercise.name}</h4>
                            <p className="text-gray-400 text-xs">{exercise.category}</p>
                          </div>
                          <button
                            onClick={() => removeExercise(exercise.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="space-y-2">
                          {exercise.sets.map((set, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                              <span className="text-gray-400 text-sm w-12">Set {idx + 1}</span>
                              <input
                                type="number"
                                value={set.reps}
                                onChange={(e) => updateSet(exercise.id, idx, 'reps', parseInt(e.target.value))}
                                className="w-16 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                                placeholder="Reps"
                              />
                              <span className="text-gray-500 text-xs">reps</span>
                              <input
                                type="number"
                                value={set.weight}
                                onChange={(e) => updateSet(exercise.id, idx, 'weight', parseInt(e.target.value))}
                                className="w-20 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                                placeholder="Weight"
                              />
                              <span className="text-gray-500 text-xs">lbs</span>
                              <input
                                type="checkbox"
                                checked={set.completed}
                                onChange={(e) => updateSet(exercise.id, idx, 'completed', e.target.checked)}
                                className="ml-auto"
                              />
                            </div>
                          ))}
                          <button
                            onClick={() => addSet(exercise.id)}
                            className="text-primary-400 hover:text-primary-300 text-sm"
                          >
                            + Add Set
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-2xl hover:shadow-secondary-400/20 transition-all duration-300">
                <h4 className="text-white font-semibold mb-2 flex items-center">
                  <Clock className="h-5 w-5 mr-2 text-secondary-400"/>Timer
                </h4>
                <p className="text-white text-4xl font-bold">{formatTime(elapsedTime)}</p>
              </div>

              <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-2xl hover:shadow-secondary-400/20 transition-all duration-300">
                <h4 className="text-white font-semibold mb-2 flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2 text-secondary-400"/>Progress
                </h4>
                <p className="text-gray-300 text-sm">Personal records and graphs coming soon.</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'programs' && (
          <div className="max-w-5xl mx-auto">
            <div className="mb-6 flex justify-between items-center">
              <h3 className="text-2xl font-bold text-white">Workout Programs</h3>
              <a
                href="/admin/workouts"
                className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                <Plus className="inline h-4 w-4 mr-1"/>Create Program
              </a>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {workoutPrograms.map((program) => (
                <ProgramCard key={program.id} program={program} />
              ))}
            </div>

            {workoutPrograms.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-400">No programs yet. Create one to get started!</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="max-w-5xl mx-auto">
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-2xl hover:shadow-secondary-400/20 transition-all duration-300">
              <h3 className="text-xl font-bold text-white mb-4">History</h3>
              {history.length === 0 ? (
                <p className="text-gray-300">No workouts yet.</p>
              ) : (
                <div className="space-y-3">
                  {history.map((session) => (
                    <div key={session.id} className="bg-gray-700/30 rounded-lg p-4">
                      <p className="text-white font-medium">{new Date(session.completedAt).toLocaleString()}</p>
                      <p className="text-gray-400 text-sm">
                        {session.exercises.length} exercises • {formatTime(session.duration)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Exercise Modal */}
      {showAddExerciseModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 max-w-md w-full border border-primary-400/30 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Add Exercise</h3>
              <button
                onClick={() => setShowAddExerciseModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Exercise Name</label>
                <input
                  type="text"
                  value={exerciseName}
                  onChange={(e) => setExerciseName(e.target.value)}
                  className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-primary-400 focus:outline-none"
                  placeholder="e.g., Bench Press"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Category</label>
                <select
                  value={exerciseCategory}
                  onChange={(e) => setExerciseCategory(e.target.value)}
                  className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-primary-400 focus:outline-none"
                >
                  <option value="Chest">Chest</option>
                  <option value="Back">Back</option>
                  <option value="Legs">Legs</option>
                  <option value="Shoulders">Shoulders</option>
                  <option value="Arms">Arms</option>
                  <option value="Core">Core</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowAddExerciseModal(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addExercise}
                  className="flex-1 bg-secondary-600 hover:bg-secondary-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Add Exercise
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
