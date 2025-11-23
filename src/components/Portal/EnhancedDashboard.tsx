"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { Trophy, Calendar, ChevronRight, Target, Dumbbell, Apple, Brain, Wind, BookOpen, ShoppingBag, Check, Flame, Sparkles, X } from "lucide-react"
import { PortalHeader } from "@/components/Navigation/PortalHeader"
import { useUser } from "@auth0/nextjs-auth0"
import { useRouter } from "next/navigation"
import TrialSubscription from "@/components/Subscriptions/TrialSubscription"

interface DailyJournalData {
  weight: number | null
  mood: string
  reasonsValidation: string
  affirmationGoal: string
  affirmationBecause: string
  affirmationMeans: string
  peptideNotes: string
  workoutNotes: string
  nutritionNotes: string
  breathNotes: string
  moduleNotes: string
}

export function EnhancedDashboard() {
  const { user } = useUser()
  const router = useRouter()
  const [totalPoints] = useState(1250)
  const [currentStreak, setCurrentStreak] = useState(0)
  const [hasActiveSubscription, setHasActiveSubscription] = useState<boolean | null>(null)
  const [showTrialModal, setShowTrialModal] = useState(false)
  const [showTrialBanner, setShowTrialBanner] = useState(true)

  // Daily tasks state
  const [dailyTasks, setDailyTasks] = useState({
    peptides: false,
    journal: false,
    workout: false,
    meals: false,
    module: false,
    breath: false
  })

  // Journal data that auto-populates
  const [journalData, setJournalData] = useState<DailyJournalData>({
    weight: null,
    mood: "",
    reasonsValidation: "",
    affirmationGoal: "",
    affirmationBecause: "",
    affirmationMeans: "",
    peptideNotes: "",
    workoutNotes: "",
    nutritionNotes: "",
    breathNotes: "",
    moduleNotes: "",
  })

  // Mood options
  const moodOptions = ["Amazing 🚀", "Great 😊", "Good 👍", "Okay 😐", "Challenging 😔", "Tough 😟"]
  const appendNote = (current: string, note: string) => {
    if (!note) {
      return current
    }
    return current ? `${current}\n${note}` : note
  }


  // Handle task checkbox change
  const handleTaskChange = async (taskName: keyof typeof dailyTasks) => {
    const newState = { ...dailyTasks, [taskName]: !dailyTasks[taskName] }
    setDailyTasks(newState)
    
    // Save to database via API
    try {
      await fetch('/api/daily-tasks', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskName, completed: newState[taskName] }) 
      })
      
      // Auto-update journal when task is completed
      if (newState[taskName]) {
        const timestamp = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

        if (taskName === 'peptides') {
          const note = `Completed peptide protocol at ${timestamp}`
          setJournalData(prev => ({
            ...prev,
            peptideNotes: appendNote(prev.peptideNotes, note),
          }))
        } else if (taskName === 'workout') {
          const note = `Workout session completed at ${timestamp}`
          setJournalData(prev => ({
            ...prev,
            workoutNotes: appendNote(prev.workoutNotes, note),
          }))
        } else if (taskName === 'meals') {
          const note = `Nutrition tracked at ${timestamp}`
          setJournalData(prev => ({
            ...prev,
            nutritionNotes: appendNote(prev.nutritionNotes, note),
          }))
        } else if (taskName === 'breath') {
          const note = `Breath practice logged at ${timestamp}`
          setJournalData(prev => ({
            ...prev,
            breathNotes: appendNote(prev.breathNotes, note),
          }))
        } else if (taskName === 'module') {
          const note = `Mental mastery module completed at ${timestamp}`
          setJournalData(prev => ({
            ...prev,
            moduleNotes: appendNote(prev.moduleNotes, note),
          }))
        }
      }
    } catch (error) {
      console.error('Failed to update task:', error)
    }
  }

  // Save journal data
  const saveJournalEntry = async () => {
    try {
      const payload = {
        ...journalData,
        date: new Date().toISOString(),
        tasksCompleted: dailyTasks
      }
      console.log('Saving journal entry:', payload)

      const response = await fetch('/api/journal/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      console.log('Journal save response status:', response.status)
      const result = await response.json().catch((e) => {
        console.error('Failed to parse JSON response:', e)
        return null
      })
      console.log('Journal save result:', result)

      if (response.ok && result?.success) {
        setDailyTasks(prev => ({ ...prev, journal: true }))
        const bonus = result?.pointsAwarded ? ` +${result.pointsAwarded} pts` : ''
        alert(`Daily journal entry saved!${bonus}`)
      } else {
        const message = result?.error || 'Unknown error'
        console.error('Journal save failed:', { status: response.status, result })
        alert(`Failed to save journal: ${message}`)
      }
    } catch (error) {
      console.error('Failed to save journal - exception:', error)
      alert(`Failed to save journal entry: ${error instanceof Error ? error.message : 'Please try again.'}`)
    }
  }

  // Check subscription status on mount
  useEffect(() => {
    const checkSubscription = async () => {
      try {
        const response = await fetch('/api/subscriptions/status')
        if (response.ok) {
          const data = await response.json()
          setHasActiveSubscription(data.hasActiveSubscription)
        } else {
          setHasActiveSubscription(false)
        }
      } catch (error) {
        console.error('Failed to check subscription:', error)
        setHasActiveSubscription(false)
      }
    }
    checkSubscription()
  }, [])

  // Load tasks on mount
  useEffect(() => {
    const loadTasks = async () => {
      try {
        const response = await fetch('/api/daily-tasks')
        if (response.ok) {
          const data = await response.json()
          const taskStates = { ...dailyTasks }
          data.tasks.forEach((task: any) => {
            if (task.taskName in taskStates) {
              taskStates[task.taskName as keyof typeof dailyTasks] = task.completed
            }
          })
          setDailyTasks(taskStates)
          if (data.streak !== undefined) {
            setCurrentStreak(data.streak)
          }
        }
      } catch (error) {
        console.error('Failed to load tasks:', error)
      }
    }
    loadTasks()
  }, [])

  useEffect(() => {
    const loadJournalPrefill = async () => {
      try {
        const response = await fetch('/api/journal/entry', { cache: 'no-store' })
        if (!response.ok) return
        const data = await response.json()
        if (!data) return
        const entry = data.entry || {}
        setJournalData((prev) => ({
          ...prev,
          weight: typeof data.weight === 'number' ? data.weight : prev.weight,
          mood: typeof data.mood === 'string' ? data.mood : prev.mood,
          reasonsValidation: entry.reasonsValidation ?? prev.reasonsValidation,
          affirmationGoal: entry.affirmationGoal ?? prev.affirmationGoal,
          affirmationBecause: entry.affirmationBecause ?? prev.affirmationBecause,
          affirmationMeans: entry.affirmationMeans ?? prev.affirmationMeans,
          peptideNotes: entry.peptideNotes ?? prev.peptideNotes,
          workoutNotes: entry.workoutNotes ?? prev.workoutNotes,
          nutritionNotes: entry.nutritionNotes ?? prev.nutritionNotes,
          breathNotes: entry.breathNotes ?? prev.breathNotes,
          moduleNotes: entry.moduleNotes ?? prev.moduleNotes,
        }))
      } catch (error) {
        console.error('Failed to load journal entry:', error)
      }
    }

    loadJournalPrefill()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{
        pointsAwarded?: number
        journalNote?: string
        dailyTaskCompleted?: boolean
      }>).detail

      if (!detail) return

      if (detail.dailyTaskCompleted) {
        setDailyTasks((prev) => (prev.meals ? prev : { ...prev, meals: true }))
      }

      if (detail.journalNote) {
        const note = detail.journalNote
        setJournalData((prev) => ({
          ...prev,
          nutritionNotes: prev.nutritionNotes
            ? `${prev.nutritionNotes}\n${note}`
            : note,
        }))
      }
    }

    window.addEventListener('nutrition:log-success', handler)
    return () => {
      window.removeEventListener('nutrition:log-success', handler)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{
        pointsAwarded?: number
        journalNote?: string
        dailyTaskCompleted?: boolean
      }>).detail

      if (!detail) return

      if (detail.dailyTaskCompleted) {
        setDailyTasks((prev) => (prev.workout ? prev : { ...prev, workout: true }))
      }

      if (detail.journalNote) {
        const note = detail.journalNote
        setJournalData((prev) => ({
          ...prev,
          workoutNotes: appendNote(prev.workoutNotes, note),
        }))
      }
    }

    window.addEventListener('workout:log-success', handler)
    return () => {
      window.removeEventListener('workout:log-success', handler)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{
        pointsAwarded?: number
        journalNote?: string
        dailyTaskCompleted?: boolean
      }>).detail

      if (!detail) return

      if (detail.dailyTaskCompleted) {
        setDailyTasks((prev) => (prev.breath ? prev : { ...prev, breath: true }))
      }

      if (detail.journalNote) {
        const note = detail.journalNote
        setJournalData((prev) => ({
          ...prev,
          breathNotes: appendNote(prev.breathNotes, note),
        }))
      }
    }

    window.addEventListener('breath:session-complete', handler)
    return () => {
      window.removeEventListener('breath:session-complete', handler)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{
        moduleId?: string
        pointsAwarded?: number
        journalNote?: string
        dailyTaskCompleted?: boolean
      }>).detail

      if (!detail) return

      setDailyTasks((prev) => (prev.module ? prev : { ...prev, module: true }))

      if (detail.journalNote) {
        const note = detail.journalNote
        setJournalData((prev) => ({
          ...prev,
          moduleNotes: appendNote(prev.moduleNotes, note),
        }))
      }
    }

    window.addEventListener('module:completion', handler)
    return () => {
      window.removeEventListener('module:completion', handler)
    }
  }, [])

  const TaskRow = ({ 
    icon, 
    title, 
    points, 
    description, 
    taskKey, 
    linkTo,
    cardColor,
    cardIcon: CardIcon
  }: { 
    icon?: React.ReactNode
    title: string
    points: number
    description: string
    taskKey: keyof typeof dailyTasks
    linkTo: string
    cardColor: string
    cardIcon: React.ComponentType<any>
  }) => (
    <div className="flex items-center gap-4 p-4 bg-gray-800/30 rounded-lg border border-gray-600/30 hover:bg-gray-700/30 transition-all group">
      <label className="flex items-center flex-1 cursor-pointer">
        <input
          type="checkbox"
          checked={dailyTasks[taskKey]}
          onChange={() => handleTaskChange(taskKey)}
          className="w-5 h-5 text-primary-500 rounded border-gray-600 focus:ring-primary-500"
        />
        <div className="ml-4 flex-1">
          <div className="flex items-center">
            <span className="font-medium text-white">{title}</span>
            <span className="ml-2 text-xs text-primary-300 px-2 py-1 bg-primary-600/20 rounded">+{points} points</span>
          </div>
          <p className="text-sm text-gray-400">{description}</p>
        </div>
      </label>
      
      {/* Integrated card button on the right */}
      <Link href={linkTo} 
        className={`px-3 py-3 ${cardColor} rounded-lg border transform transition duration-200 flex flex-col items-center justify-center min-w-[96px] group-hover:shadow-lg hover:-translate-y-1 hover:shadow-primary-500/20`}
      >
        <CardIcon className="w-8 h-8 text-white mb-2" />
        <span className="text-xs text-white font-medium">{title.split(' ')[1] || title}</span>
      </Link>
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
      <div className="relative z-10">
        <PortalHeader
          section="Daily Check-in"
          subtitle="Track your wellness journey"
          showOrderPeptides={false}
          showBackLink={false}
        />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Welcome Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 text-shadow-lg animate-fade-in">
              Welcome back, <span className="text-primary-400">{user?.name || user?.email || "Wellness Warrior"}</span>
            </h1>
            {currentStreak > 0 && (
              <div className="mt-3 inline-flex items-center px-4 py-2 bg-secondary-600/20 rounded-full border border-secondary-400/30">
                <span className="text-secondary-300 font-medium">🔥 Current streak: {currentStreak} days</span>
              </div>
            )}
          </div>

          {/* Trial Subscription Banner */}
          {hasActiveSubscription === false && showTrialBanner && (
            <div className="mb-8 bg-gradient-to-r from-primary-600/20 via-secondary-600/20 to-primary-600/20 border-2 border-primary-400/40 rounded-xl p-6 shadow-lg backdrop-blur-sm relative overflow-hidden">
              {/* Close button */}
              <button
                onClick={() => setShowTrialBanner(false)}
                className="absolute top-3 right-3 text-gray-300 hover:text-white transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Animated background gradient */}
              <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 to-secondary-500/10 animate-pulse opacity-50"></div>

              <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
                {/* Icon */}
                <div className="flex-shrink-0 bg-gradient-to-br from-primary-500/30 to-secondary-500/30 p-4 rounded-full">
                  <Sparkles className="w-10 h-10 text-primary-300" />
                </div>

                {/* Content */}
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-2xl font-bold text-white mb-2">
                    Unlock Full Access with $1 Trial
                  </h3>
                  <p className="text-gray-200 mb-1">
                    Get 14 days of complete access to all premium features for just $1
                  </p>
                  <p className="text-sm text-gray-300">
                    Then $29.99/month • Cancel anytime during trial
                  </p>
                </div>

                {/* CTA Button */}
                <button
                  onClick={() => setShowTrialModal(true)}
                  className="flex-shrink-0 px-6 py-3 bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white font-bold rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-primary-500/50"
                >
                  Start $1 Trial →
                </button>
              </div>
            </div>
          )}

          {/* Main Portal Section - Matching Portalview.png */}
          <div className="card-hover-primary mb-8">
            <div className="text-center mb-6">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">📋 Daily Check-in</h2>
            </div>

            {/* Quick Access Cards (2x3 Grid) */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
                <Link href="/peptides" className="group">
                  <div className="p-6 bg-gradient-to-br from-teal-600/30 to-teal-700/30 border border-teal-400/30 rounded-lg hover:scale-[1.02] hover:shadow-lg hover:shadow-teal-500/20 transition-all text-center">
                    <Target className="w-8 h-8 text-teal-300 mx-auto mb-2" />
                    <span className="text-white font-medium">Peptides</span>
                  </div>
                </Link>

                <Link href="/workout" className="group">
                  <div className="p-6 bg-gradient-to-br from-green-600/30 to-green-700/30 border border-green-400/30 rounded-lg hover:scale-[1.02] hover:shadow-lg hover:shadow-green-500/20 transition-all text-center">
                    <Dumbbell className="w-8 h-8 text-green-300 mx-auto mb-2" />
                    <span className="text-white font-medium">Workout</span>
                  </div>
                </Link>

                <Link href="/nutrition" className="group">
                  <div className="p-6 bg-gradient-to-br from-amber-600/30 to-amber-700/30 border border-amber-400/30 rounded-lg hover:scale-[1.02] hover:shadow-lg hover:shadow-amber-500/20 transition-all text-center">
                    <Apple className="w-8 h-8 text-amber-300 mx-auto mb-2" />
                    <span className="text-white font-medium">Nutrition</span>
                  </div>
                </Link>

                <Link href="/modules" className="group">
                  <div className="p-6 bg-gradient-to-br from-purple-600/30 to-purple-700/30 border border-purple-400/30 rounded-lg hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-500/20 transition-all text-center">
                    <Brain className="w-8 h-8 text-purple-300 mx-auto mb-2" />
                    <span className="text-white font-medium">Modules</span>
                  </div>
                </Link>
                
                <Link href="/breath" className="group">
                  <div className="p-6 bg-gradient-to-br from-blue-600/30 to-blue-700/30 border border-blue-400/30 rounded-lg hover:scale-[1.02] hover:shadow-lg hover:shadow-blue-500/20 transition-all text-center">
                    <Wind className="w-8 h-8 text-blue-300 mx-auto mb-2" />
                    <span className="text-white font-medium">Breathe</span>
                  </div>
                </Link>

                <Link href="#journal" className="group">
                  <div className="p-6 bg-gradient-to-br from-secondary-600/30 to-secondary-700/30 border border-secondary-400/30 rounded-lg hover:scale-[1.02] hover:shadow-lg hover:shadow-secondary-500/20 transition-all text-center">
                    <BookOpen className="w-8 h-8 text-secondary-300 mx-auto mb-2" />
                    <span className="text-white font-medium">Journal</span>
                  </div>
                </Link>
              </div>

            {/* Secondary Action */}
            <div className="mt-6 pt-6 border-t border-gray-600/30">
              <Link href="/order"
                className="flex items-center p-4 bg-purple-600/20 rounded-lg border border-purple-400/30 hover:bg-purple-600/30 transition-colors"
              >
                <ShoppingBag className="w-5 h-5 text-purple-300 mr-3" />
                <div className="flex-1">
                  <span className="font-medium text-white">Order Peptides</span>
                  <p className="text-sm text-gray-300">Browse and order wellness peptides</p>
                </div>
                <ChevronRight className="w-5 h-5 text-purple-300" />
              </Link>
            </div>
            
            {/* Progress bar */}
            <div className="mt-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-300">Daily Progress</span>
                <span className="text-primary-300 font-medium">
                  {Object.values(dailyTasks).filter(Boolean).length} of 6 completed
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-primary-500 to-secondary-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(Object.values(dailyTasks).filter(Boolean).length / 6) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Journal Section Below Portal Layout */}
          <div className="card-hover-secondary" id="journal">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Daily Journal Entry</h3>
              <Link href="/journal" className="text-sm text-primary-300 hover:text-primary-200 font-semibold mt-2 md:mt-0">
                View History
              </Link>
            </div>
            
            {/* Weight and Mood */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Today's Weight</label>
                <input
                  type="number"
                  step="0.1"
                  value={journalData.weight || ""}
                  onChange={(e) => setJournalData({...journalData, weight: parseFloat(e.target.value)})}
                  className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  placeholder="Enter weight"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Current Mood</label>
                <select
                  value={journalData.mood}
                  onChange={(e) => setJournalData({...journalData, mood: e.target.value})}
                  className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white"
                >
                  <option value="">Select mood...</option>
                  {moodOptions.map(mood => (
                    <option key={mood} value={mood}>{mood}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Reasons Validation */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Why I'm Going to Be Successful Today
              </label>
              <textarea
                value={journalData.reasonsValidation}
                onChange={(e) => setJournalData({...journalData, reasonsValidation: e.target.value})}
                className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white"
                rows={3}
                placeholder="Write your reasons for success..."
              />
            </div>

            {/* David Snyder Affirmation Format */}
            <div className="space-y-3 p-4 bg-primary-600/10 rounded-lg border border-primary-400/30 mb-4">
              <h4 className="font-medium text-primary-300">Daily Affirmation</h4>
              
              <div>
                <label className="block text-sm text-gray-300 mb-1">I am...</label>
                <input
                  type="text"
                  value={journalData.affirmationGoal}
                  onChange={(e) => setJournalData({...journalData, affirmationGoal: e.target.value})}
                  className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  placeholder="e.g., achieving my ideal weight and health"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-300 mb-1">Because...</label>
                <input
                  type="text"
                  value={journalData.affirmationBecause}
                  onChange={(e) => setJournalData({...journalData, affirmationBecause: e.target.value})}
                  className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  placeholder="e.g., I am committed to my daily protocols"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-300 mb-1">And that means...</label>
                <input
                  type="text"
                  value={journalData.affirmationMeans}
                  onChange={(e) => setJournalData({...journalData, affirmationMeans: e.target.value})}
                  className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  placeholder="e.g., I have more energy and confidence every day"
                />
              </div>
            </div>

            {/* Auto-populated Activity Notes */}
            <div className="space-y-3 mb-4">
              {journalData.peptideNotes && (
                <div className="text-sm text-gray-300 p-2 bg-teal-600/10 rounded">
                  <Check className="w-4 h-4 inline mr-2 text-teal-400" />
                  {journalData.peptideNotes}
                </div>
              )}
              {journalData.workoutNotes && (
                <div className="text-sm text-gray-300 p-2 bg-green-600/10 rounded">
                  <Check className="w-4 h-4 inline mr-2 text-green-400" />
                  {journalData.workoutNotes}
                </div>
              )}
              {journalData.nutritionNotes && (
                <div className="text-sm text-gray-300 p-2 bg-amber-600/10 rounded">
                  <Check className="w-4 h-4 inline mr-2 text-amber-400" />
                  {journalData.nutritionNotes}
                </div>
              )}
              {journalData.breathNotes && (
                <div className="text-sm text-gray-300 p-2 bg-blue-600/10 rounded">
                  <Check className="w-4 h-4 inline mr-2 text-blue-400" />
                  {journalData.breathNotes}
                </div>
              )}
              {journalData.moduleNotes && (
                <div className="text-sm text-gray-300 p-2 bg-purple-600/10 rounded">
                  <Check className="w-4 h-4 inline mr-2 text-purple-400" />
                  {journalData.moduleNotes}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Save Button */}
              <button
                onClick={saveJournalEntry}
                className="lg:col-span-2 bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 rounded-lg transition-colors"
              >
                Save Daily Journal Entry
              </button>

              {/* Today's Summary */}
              <div className="bg-gray-700/30 rounded-lg p-4">
                <h4 className="text-sm font-bold text-white mb-2 text-center">Today's Summary</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center p-2 bg-primary-600/20 rounded">
                    <div className="text-lg font-bold text-primary-400">
                      {Object.values(dailyTasks).filter(Boolean).length}/6
                    </div>
                    <div className="text-xs text-gray-400">Tasks Complete</div>
                  </div>
                  <div className="text-center p-2 bg-secondary-600/20 rounded">
                    <div className="text-lg font-bold text-secondary-400">
                      {currentStreak}
                    </div>
                    <div className="text-xs text-gray-400">Day Streak</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trial Subscription Modal */}
      {showTrialModal && (
        <TrialSubscription
          onClose={() => setShowTrialModal(false)}
          redirectUrl="/portal"
        />
      )}
    </div>
  )
}

