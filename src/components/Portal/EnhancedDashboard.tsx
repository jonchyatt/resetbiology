"use client"

import { useState, useEffect } from "react"
import { Trophy, Calendar, ChevronRight, Target, Dumbbell, Apple, Brain, Wind, BookOpen, ShoppingBag, Check } from "lucide-react"
import { PortalHeader } from "@/components/Navigation/PortalHeader"
import { useUser } from "@auth0/nextjs-auth0"
import { useRouter } from "next/navigation"

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
}

export function EnhancedDashboard() {
  const { user } = useUser()
  const router = useRouter()
  const [totalPoints] = useState(1250)
  const [currentStreak, setCurrentStreak] = useState(0)
  
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
    nutritionNotes: ""
  })

  // Mood options
  const moodOptions = ["Amazing 🚀", "Great 😊", "Good 👍", "Okay 😐", "Challenging 😔", "Tough 😟"]

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
          setJournalData(prev => ({
            ...prev,
            peptideNotes: `Completed peptide protocol at ${timestamp}`
          }))
        } else if (taskName === 'workout') {
          setJournalData(prev => ({
            ...prev,
            workoutNotes: `Workout session completed at ${timestamp}`
          }))
        } else if (taskName === 'meals') {
          setJournalData(prev => ({
            ...prev,
            nutritionNotes: `Nutrition tracked at ${timestamp}`
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
      const response = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...journalData,
          date: new Date().toISOString(),
          tasksCompleted: dailyTasks
        })
      })

      if (response.ok) {
        alert('Daily journal entry saved!')
      } else {
        const error = await response.json()
        alert(`Failed to save journal: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Failed to save journal:', error)
      alert('Failed to save journal entry. Please try again.')
    }
  }

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
      <a 
        href={linkTo} 
        className={`p-4 ${cardColor} rounded-lg border hover:scale-105 transition-all flex flex-col items-center justify-center min-w-[100px] group-hover:shadow-lg`}
      >
        <CardIcon className="w-8 h-8 text-white mb-2" />
        <span className="text-xs text-white font-medium">{title.split(' ')[1] || title}</span>
      </a>
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
        />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Welcome Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 text-shadow-lg animate-fade-in">
              Welcome back, <span className="text-primary-400">{user?.name || user?.email || "Wellness Warrior"}</span>
            </h1>
            <div className="flex items-center justify-center gap-8 text-lg text-gray-200">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary-400" />
                <span className="font-medium">{totalPoints.toLocaleString()} points</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-secondary-400" />
                <span className="font-medium">{currentStreak} day streak</span>
              </div>
            </div>
          </div>

          {/* Main Portal Section - Matching Portalview.png */}
          <div className="card-hover-primary mb-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">📋 Daily Check-in</h2>
              <p className="text-gray-300">Complete your daily activities to maximize progress and earn rewards</p>
              {currentStreak > 0 && (
                <div className="mt-3 inline-flex items-center px-4 py-2 bg-secondary-600/20 rounded-full border border-secondary-400/30">
                  <span className="text-secondary-300 font-medium">🔥 Current streak: {currentStreak} days</span>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Side - Task Checkboxes */}
              <div className="space-y-3">
                <div
                  className="flex items-center p-4 bg-gray-800/30 rounded-lg border border-gray-600/30 hover:bg-gray-700/30 transition-colors cursor-pointer"
                  onClick={() => router.push('/peptides')}
                >
                  <input
                    type="checkbox"
                    checked={dailyTasks.peptides}
                    onChange={(e) => {
                      e.stopPropagation()
                      handleTaskChange('peptides')
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-5 h-5 text-primary-500 rounded border-gray-600 focus:ring-primary-500"
                  />
                  <div className="ml-4 flex-1">
                    <div className="flex items-center">
                      <span className="font-medium text-white">Log Peptides</span>
                      <span className="ml-2 text-xs text-primary-300 px-2 py-1 bg-primary-600/20 rounded">+25 points</span>
                    </div>
                    <p className="text-sm text-gray-400">Track your peptide doses and timing</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-primary-400" />
                </div>

                <div
                  className="flex items-center p-4 bg-gray-800/30 rounded-lg border border-gray-600/30 hover:bg-gray-700/30 transition-colors cursor-pointer"
                  onClick={() => {
                    const journalSection = document.querySelector('#journal')
                    if (journalSection) {
                      journalSection.scrollIntoView({ behavior: 'smooth' })
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    checked={dailyTasks.journal}
                    onChange={(e) => {
                      e.stopPropagation()
                      handleTaskChange('journal')
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-5 h-5 text-primary-500 rounded border-gray-600 focus:ring-primary-500"
                  />
                  <div className="ml-4 flex-1">
                    <div className="flex items-center">
                      <span className="font-medium text-white">Daily Journal</span>
                      <span className="ml-2 text-xs text-primary-300 px-2 py-1 bg-primary-600/20 rounded">+20 points</span>
                    </div>
                    <p className="text-sm text-gray-400">Reflect on your progress and mindset</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-primary-400" />
                </div>

                <div
                  className="flex items-center p-4 bg-gray-800/30 rounded-lg border border-gray-600/30 hover:bg-gray-700/30 transition-colors cursor-pointer"
                  onClick={() => router.push('/workout')}
                >
                  <input
                    type="checkbox"
                    checked={dailyTasks.workout}
                    onChange={(e) => {
                      e.stopPropagation()
                      handleTaskChange('workout')
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-5 h-5 text-primary-500 rounded border-gray-600 focus:ring-primary-500"
                  />
                  <div className="ml-4 flex-1">
                    <div className="flex items-center">
                      <span className="font-medium text-white">Log Workout</span>
                      <span className="ml-2 text-xs text-primary-300 px-2 py-1 bg-primary-600/20 rounded">+30 points</span>
                    </div>
                    <p className="text-sm text-gray-400">Track exercises, sets, and progress</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-primary-400" />
                </div>

                <div
                  className="flex items-center p-4 bg-gray-800/30 rounded-lg border border-gray-600/30 hover:bg-gray-700/30 transition-colors cursor-pointer"
                  onClick={() => router.push('/nutrition')}
                >
                  <input
                    type="checkbox"
                    checked={dailyTasks.meals}
                    onChange={(e) => {
                      e.stopPropagation()
                      handleTaskChange('meals')
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-5 h-5 text-primary-500 rounded border-gray-600 focus:ring-primary-500"
                  />
                  <div className="ml-4 flex-1">
                    <div className="flex items-center">
                      <span className="font-medium text-white">Log Meals</span>
                      <span className="ml-2 text-xs text-primary-300 px-2 py-1 bg-primary-600/20 rounded">+20 points</span>
                    </div>
                    <p className="text-sm text-gray-400">Track nutrition and macros</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-primary-400" />
                </div>

                <div
                  className="flex items-center p-4 bg-gray-800/30 rounded-lg border border-gray-600/30 hover:bg-gray-700/30 transition-colors cursor-pointer"
                  onClick={() => router.push('/modules')}
                >
                  <input
                    type="checkbox"
                    checked={dailyTasks.module}
                    onChange={(e) => {
                      e.stopPropagation()
                      handleTaskChange('module')
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-5 h-5 text-primary-500 rounded border-gray-600 focus:ring-primary-500"
                  />
                  <div className="ml-4 flex-1">
                    <div className="flex items-center">
                      <span className="font-medium text-white">Complete Mental Mastery Module</span>
                      <span className="ml-2 text-xs text-primary-300 px-2 py-1 bg-primary-600/20 rounded">+50 points</span>
                    </div>
                    <p className="text-sm text-gray-400">Listen to today's audio training</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-primary-400" />
                </div>

                <div
                  className="flex items-center p-4 bg-gray-800/30 rounded-lg border border-gray-600/30 hover:bg-gray-700/30 transition-colors cursor-pointer"
                  onClick={() => router.push('/breath')}
                >
                  <input
                    type="checkbox"
                    checked={dailyTasks.breath}
                    onChange={(e) => {
                      e.stopPropagation()
                      handleTaskChange('breath')
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-5 h-5 text-primary-500 rounded border-gray-600 focus:ring-primary-500"
                  />
                  <div className="ml-4 flex-1">
                    <div className="flex items-center">
                      <span className="font-medium text-white">Launch Breath Training</span>
                      <span className="ml-2 text-xs text-primary-300 px-2 py-1 bg-primary-600/20 rounded">+25 points</span>
                    </div>
                    <p className="text-sm text-gray-400">Complete a breathing session</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-primary-400" />
                </div>
              </div>

              {/* Right Side - Quick Access Cards (2x3 Grid) */}
              <div className="grid grid-cols-2 gap-4">
                <a href="/peptides" className="group">
                  <div className="p-6 bg-gradient-to-br from-teal-600/30 to-teal-700/30 border border-teal-400/30 rounded-lg hover:scale-105 transition-all text-center">
                    <Target className="w-8 h-8 text-teal-300 mx-auto mb-2" />
                    <span className="text-white font-medium">Peptides</span>
                  </div>
                </a>
                
                <a href="/workout" className="group">
                  <div className="p-6 bg-gradient-to-br from-green-600/30 to-green-700/30 border border-green-400/30 rounded-lg hover:scale-105 transition-all text-center">
                    <Dumbbell className="w-8 h-8 text-green-300 mx-auto mb-2" />
                    <span className="text-white font-medium">Workout</span>
                  </div>
                </a>
                
                <a href="/nutrition" className="group">
                  <div className="p-6 bg-gradient-to-br from-amber-600/30 to-amber-700/30 border border-amber-400/30 rounded-lg hover:scale-105 transition-all text-center">
                    <Apple className="w-8 h-8 text-amber-300 mx-auto mb-2" />
                    <span className="text-white font-medium">Nutrition</span>
                  </div>
                </a>
                
                <a href="/modules" className="group">
                  <div className="p-6 bg-gradient-to-br from-purple-600/30 to-purple-700/30 border border-purple-400/30 rounded-lg hover:scale-105 transition-all text-center">
                    <Brain className="w-8 h-8 text-purple-300 mx-auto mb-2" />
                    <span className="text-white font-medium">Modules</span>
                  </div>
                </a>
                
                <a href="/breath" className="group">
                  <div className="p-6 bg-gradient-to-br from-blue-600/30 to-blue-700/30 border border-blue-400/30 rounded-lg hover:scale-105 transition-all text-center">
                    <Wind className="w-8 h-8 text-blue-300 mx-auto mb-2" />
                    <span className="text-white font-medium">Breathe</span>
                  </div>
                </a>
                
                <a href="#journal" className="group">
                  <div className="p-6 bg-gradient-to-br from-secondary-600/30 to-secondary-700/30 border border-secondary-400/30 rounded-lg hover:scale-105 transition-all text-center">
                    <BookOpen className="w-8 h-8 text-secondary-300 mx-auto mb-2" />
                    <span className="text-white font-medium">Journal</span>
                  </div>
                </a>
              </div>
            </div>

            {/* Secondary Action */}
            <div className="mt-6 pt-6 border-t border-gray-600/30">
              <a 
                href="/store" 
                className="flex items-center p-4 bg-purple-600/20 rounded-lg border border-purple-400/30 hover:bg-purple-600/30 transition-colors"
              >
                <ShoppingBag className="w-5 h-5 text-purple-300 mr-3" />
                <div className="flex-1">
                  <span className="font-medium text-white">Order Peptides</span>
                  <p className="text-sm text-gray-300">Browse and order wellness peptides</p>
                </div>
                <ChevronRight className="w-5 h-5 text-purple-300" />
              </a>
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
            <h3 className="text-xl font-bold text-white mb-4">📔 Daily Journal Entry</h3>
            
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
              <h4 className="font-medium text-primary-300">Daily Affirmation (David Snyder Method)</h4>
              
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
    </div>
  )
}