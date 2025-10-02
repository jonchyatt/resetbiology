"use client"
import { useEffect, useMemo, useState } from "react"
import { Dumbbell, Target, TrendingUp, Clock, Calendar, Plus, Play, Pause, StopCircle, History } from "lucide-react"
import { ExerciseLibrary } from "./ExerciseLibrary"
import { WorkoutSessionView } from "./WorkoutSession"
import { ProgramSelection } from "./ProgramSelection"
import { workoutPrograms } from "@/data/workoutPrograms"
import type { ExerciseDef } from "./ExerciseLibrary"

export interface SetEntry { reps: number; weight: number; completed: boolean }
export interface ExerciseEntry { id: string; name: string; category: string; sets: SetEntry[] }
export interface WorkoutSession { id: string; date: string; exercises: ExerciseEntry[]; duration: number; notes?: string }

export function WorkoutTracker() {
  const [activeTab, setActiveTab] = useState<'current' | 'history' | 'programs'>('current')
  const [current, setCurrent] = useState<WorkoutSession | null>(null)
  const [history, setHistory] = useState<WorkoutSession[]>([])
  const [isLibraryOpen, setLibraryOpen] = useState(false)
  const [startTs, setStartTs] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)

  // Load workout history on mount
  useEffect(() => {
    fetchWorkoutHistory()
  }, [])

  const fetchWorkoutHistory = async () => {
    try {
      setLoadingHistory(true)
      const response = await fetch('/api/workout/sessions', {
        credentials: 'include'
      })
      const data = await response.json()

      if (data.success && data.sessions) {
        // Transform the data to match our interface
        const formattedSessions = data.sessions.map((session: any) => ({
          id: session.id,
          date: session.completedAt,
          exercises: session.exercises,
          duration: session.duration,
          notes: session.notes
        }))
        setHistory(formattedSessions)
      }
    } catch (error) {
      console.error('Error loading workout history:', error)
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    if (!current) return
    const id = setInterval(() => {
      if (startTs) {
        const duration = Math.floor((Date.now() - startTs) / 1000)
        setCurrent(prev => prev ? { ...prev, duration } : prev)
      }
    }, 1000)
    return () => clearInterval(id)
  }, [startTs, current])

  const startWorkout = () => {
    setCurrent({ id: crypto.randomUUID(), date: new Date().toISOString(), exercises: [], duration: 0 })
    setStartTs(Date.now())
  }
  const pauseWorkout = () => setStartTs(null)
  const resumeWorkout = () => setStartTs(Date.now() - (current?.duration ?? 0) * 1000)
  const endWorkout = async () => {
    if (!current) return

    setIsSaving(true)
    try {
      // Save to database
      const response = await fetch('/api/workout/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          exercises: current.exercises,
          duration: current.duration,
          completedAt: new Date().toISOString()
        })
      })

      const data = await response.json()

      if (data.success) {
        // Add to history with the real ID from database
        const savedSession = {
          ...current,
          id: data.session.id
        }
        setHistory(prev => [savedSession, ...prev])
        setCurrent(null)
        setStartTs(null)

        // Show success message with points
        if (data.pointsAwarded) {
          console.log(`✅ Workout saved! +${data.pointsAwarded} points earned!`)
        }
      } else {
        console.error('Failed to save workout:', data.error)
        // Still add to local history even if save failed
        setHistory(prev => [current, ...prev])
        setCurrent(null)
        setStartTs(null)
      }
    } catch (error) {
      console.error('Error saving workout:', error)
      // Still add to local history even if save failed
      setHistory(prev => [current, ...prev])
      setCurrent(null)
      setStartTs(null)
    } finally {
      setIsSaving(false)
    }
  }

  const addExerciseFromDef = (def: ExerciseDef) => setCurrent(prev => prev ? ({
    ...prev,
    exercises: [...prev.exercises, { id: crypto.randomUUID(), name: def.name, category: def.category, sets: [{ reps: 8, weight: 0, completed: false }] }]
  }) : prev)

  const updateSet = (exId: string, idx: number, patch: Partial<SetEntry>) => setCurrent(prev => {
    if (!prev) return prev
    return {
      ...prev,
      exercises: prev.exercises.map(ex => ex.id !== exId ? ex : ({
        ...ex,
        sets: ex.sets.map((s, i) => i !== idx ? s : { ...s, ...patch })
      }))
    }
  })

  const addSet = (exId: string) => setCurrent(prev => prev ? ({
    ...prev,
    exercises: prev.exercises.map(ex => ex.id !== exId ? ex : ({ ...ex, sets: [...ex.sets, { reps: 8, weight: 0, completed: false }] }))
  }) : prev)

  const removeExercise = (exId: string) => setCurrent(prev => prev ? ({
    ...prev,
    exercises: prev.exercises.filter(ex => ex.id !== exId)
  }) : prev)

  const loadProgram = (programKey: string) => {
    const program = workoutPrograms.find(p => p.key === programKey)
    if (!program) return
    setCurrent({ 
      id: crypto.randomUUID(), 
      date: new Date().toISOString(), 
      exercises: program.template.map(t => ({ 
        id: crypto.randomUUID(), 
        name: t.name, 
        category: t.category, 
        sets: t.sets.map(s => ({ ...s, completed: false })) 
      })), 
      duration: 0 
    })
    setActiveTab('current')
    setStartTs(Date.now())
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative"
         style={{
           backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
           backgroundSize: 'cover',
           backgroundPosition: 'center',
           backgroundAttachment: 'fixed'
         }}>
      {/* Header Pattern - Added mt-16 to create proper space below fixed nav (nav is h-16 = 64px) */}
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
          Program-based sessions, timers, and progress for peptide-optimized training.
        </p>
      </div>

      {/* Tabs */}
      <div className="container mx-auto px-4 pb-8">
        <div className="flex justify-center mb-8">
          <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-1 border border-primary-400/30 hover:shadow-primary-400/20 transition-all duration-300">
            {(['current', 'history', 'programs'] as const).map((tab) => (
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
            <div className="lg:col-span-2">
              <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-2xl hover:shadow-primary-400/20 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white flex items-center">
                    <Dumbbell className="h-5 w-5 mr-2 text-secondary-400"/>Current Session
                  </h3>
                  <div className="flex gap-2">
                    {!current && (
                      <button 
                        onClick={startWorkout} 
                        className="bg-secondary-600 hover:bg-secondary-700 text-white font-medium py-2 px-4 rounded-lg flex items-center"
                      >
                        <Play className="h-4 w-4 mr-1"/>Start
                      </button>
                    )}
                    {current && startTs && (
                      <button 
                        onClick={pauseWorkout} 
                        className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg flex items-center"
                      >
                        <Pause className="h-4 w-4 mr-1"/>Pause
                      </button>
                    )}
                    {current && !startTs && (
                      <button 
                        onClick={resumeWorkout} 
                        className="bg-secondary-600 hover:bg-secondary-700 text-white font-medium py-2 px-4 rounded-lg flex items-center"
                      >
                        <Play className="h-4 w-4 mr-1"/>Resume
                      </button>
                    )}
                    {current && (
                      <button 
                        onClick={endWorkout} 
                        className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg flex items-center"
                      >
                        <StopCircle className="h-4 w-4 mr-1"/>End
                      </button>
                    )}
                  </div>
                </div>

                {!current && (
                  <div className="text-gray-300">No active workout. Load a program or start a blank session.</div>
                )}

                {current && (
                  <WorkoutSessionView
                    session={current}
                    onAddSet={addSet}
                    onUpdateSet={updateSet}
                    onRemoveExercise={removeExercise}
                    onOpenLibrary={() => setLibraryOpen(true)}
                  />
                )}
              </div>
            </div>

            <div>
              <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-2xl hover:shadow-secondary-400/20 transition-all duration-300">
                <h4 className="text-white font-semibold mb-2 flex items-center">
                  <Clock className="h-5 w-5 mr-2 text-secondary-400"/>Timer
                </h4>
                <p className="text-gray-200 text-3xl font-bold">{formatSec(current?.duration ?? 0)}</p>
              </div>

              <div className="mt-6 bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-2xl hover:shadow-secondary-400/20 transition-all duration-300">
                <h4 className="text-white font-semibold mb-2 flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2 text-secondary-400"/>Progress
                </h4>
                <p className="text-gray-300 text-sm">Personal Records and graphs coming soon.</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="max-w-5xl mx-auto">
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-2xl hover:shadow-secondary-400/20 transition-all duration-300">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                <History className="h-5 w-5 mr-2 text-secondary-400"/>History
              </h3>
              {history.length === 0 ? (
                <p className="text-gray-300">No sessions yet.</p>
              ) : (
                <ul className="space-y-3">
                  {history.map(h => (
                    <li key={h.id} className="p-3 border border-gray-700 rounded-lg flex justify-between">
                      <div>
                        <p className="text-white font-medium">{new Date(h.date).toLocaleString()}</p>
                        <p className="text-gray-400 text-sm">{h.exercises.length} exercises • {formatSec(h.duration)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {activeTab === 'programs' && (
          <ProgramSelection programs={workoutPrograms} onSelect={loadProgram} />
        )}
      </div>

      {isLibraryOpen && (
        <ExerciseLibrary onClose={() => setLibraryOpen(false)} onPick={addExerciseFromDef} />
      )}
    </div>
  )
}

function formatSec(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}