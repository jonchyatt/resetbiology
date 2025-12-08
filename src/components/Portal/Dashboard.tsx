"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { Trophy, Target, Calendar, TrendingUp, ChevronRight, Dumbbell, Apple, Brain, Wind, ShoppingBag, BookOpen } from "lucide-react"
import { PortalHeader } from "@/components/Navigation/PortalHeader"
import { useUser } from "@auth0/nextjs-auth0"

export function Dashboard() {
  const { user } = useUser()
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
    } catch (error) {
      console.error('Failed to update task:', error)
    }
  }
  
  // Load tasks on mount
  useEffect(() => {
    const loadTasks = async () => {
      try {
        const response = await fetch('/api/daily-tasks')
        if (response.ok) {
          const data = await response.json()
          // Update state based on saved tasks
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative pt-28"
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
          {/* Personalized Welcome Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 text-shadow-lg animate-fade-in">
              Welcome back, <span className="text-primary-400">{user?.name || user?.nickname || (user?.email ? user.email.split('@')[0] : "Wellness Warrior")}</span>
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

          {/* Main Daily Check-in Section */}
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
            
            <div className="space-y-3">
              {/* Log Peptides */}
              <label className="flex items-center p-4 bg-gray-800/30 rounded-lg border border-gray-600/30 hover:bg-gray-700/30 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={dailyTasks.peptides}
                  onChange={() => handleTaskChange('peptides')}
                  className="w-5 h-5 text-primary-500 rounded border-gray-600 focus:ring-primary-500"
                />
                <div className="ml-4 flex-1">
                  <div className="flex items-center">
                    <span className="font-medium text-white">Log Peptides</span>
                    <span className="ml-2 text-xs text-primary-300 px-2 py-1 bg-primary-600/20 rounded">+25 points</span>
                  </div>
                  <p className="text-sm text-gray-400">Track your peptide doses and timing</p>
                </div>
                <Link href="/peptides" className="ml-4 text-primary-400 hover:text-primary-300 transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </label>

              {/* Daily Journal */}
              <label className="flex items-center p-4 bg-gray-800/30 rounded-lg border border-gray-600/30 hover:bg-gray-700/30 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={dailyTasks.journal}
                  onChange={() => handleTaskChange('journal')}
                  className="w-5 h-5 text-primary-500 rounded border-gray-600 focus:ring-primary-500"
                />
                <div className="ml-4 flex-1">
                  <div className="flex items-center">
                    <span className="font-medium text-white">Daily Journal</span>
                    <span className="ml-2 text-xs text-primary-300 px-2 py-1 bg-primary-600/20 rounded">+20 points</span>
                  </div>
                  <p className="text-sm text-gray-400">Reflect on your progress and mindset</p>
                </div>
                <Link href="/journal" className="ml-4 text-primary-400 hover:text-primary-300 transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </label>

              {/* Log Workout */}
              <label className="flex items-center p-4 bg-gray-800/30 rounded-lg border border-gray-600/30 hover:bg-gray-700/30 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={dailyTasks.workout}
                  onChange={() => handleTaskChange('workout')}
                  className="w-5 h-5 text-primary-500 rounded border-gray-600 focus:ring-primary-500"
                />
                <div className="ml-4 flex-1">
                  <div className="flex items-center">
                    <span className="font-medium text-white">Log Workout</span>
                    <span className="ml-2 text-xs text-primary-300 px-2 py-1 bg-primary-600/20 rounded">+30 points</span>
                  </div>
                  <p className="text-sm text-gray-400">Track exercises, sets, and progress</p>
                </div>
                <Link href="/workout" className="ml-4 text-primary-400 hover:text-primary-300 transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </label>

              {/* Log Meals */}
              <label className="flex items-center p-4 bg-gray-800/30 rounded-lg border border-gray-600/30 hover:bg-gray-700/30 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={dailyTasks.meals}
                  onChange={() => handleTaskChange('meals')}
                  className="w-5 h-5 text-primary-500 rounded border-gray-600 focus:ring-primary-500"
                />
                <div className="ml-4 flex-1">
                  <div className="flex items-center">
                    <span className="font-medium text-white">Log Meals</span>
                    <span className="ml-2 text-xs text-primary-300 px-2 py-1 bg-primary-600/20 rounded">+20 points</span>
                  </div>
                  <p className="text-sm text-gray-400">Track nutrition and macros</p>
                </div>
                <Link href="/nutrition" className="ml-4 text-primary-400 hover:text-primary-300 transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </label>

              {/* Complete Mental Mastery Module */}
              <label className="flex items-center p-4 bg-gray-800/30 rounded-lg border border-gray-600/30 hover:bg-gray-700/30 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={dailyTasks.module}
                  onChange={() => handleTaskChange('module')}
                  className="w-5 h-5 text-primary-500 rounded border-gray-600 focus:ring-primary-500"
                />
                <div className="ml-4 flex-1">
                  <div className="flex items-center">
                    <span className="font-medium text-white">Complete Mental Mastery Module</span>
                    <span className="ml-2 text-xs text-primary-300 px-2 py-1 bg-primary-600/20 rounded">+50 points</span>
                  </div>
                  <p className="text-sm text-gray-400">Listen to today's audio training</p>
                </div>
                <Link href="/modules" className="ml-4 text-primary-400 hover:text-primary-300 transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </label>

              {/* Launch Breath Training */}
              <label className="flex items-center p-4 bg-gray-800/30 rounded-lg border border-gray-600/30 hover:bg-gray-700/30 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={dailyTasks.breath}
                  onChange={() => handleTaskChange('breath')}
                  className="w-5 h-5 text-primary-500 rounded border-gray-600 focus:ring-primary-500"
                />
                <div className="ml-4 flex-1">
                  <div className="flex items-center">
                    <span className="font-medium text-white">Launch Breath Training</span>
                    <span className="ml-2 text-xs text-primary-300 px-2 py-1 bg-primary-600/20 rounded">+25 points</span>
                  </div>
                  <p className="text-sm text-gray-400">Complete a breathing session</p>
                </div>
                <Link href="/breath" className="ml-4 text-primary-400 hover:text-primary-300 transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </label>
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

          {/* Secondary Actions */}
          <div className="mb-8">
            <div className="card-hover-secondary">
              <h3 className="text-lg font-bold text-white mb-4">🛒 Secondary Actions</h3>
              <div className="space-y-3">
                <Link href="/store" className="flex items-center p-4 bg-purple-600/20 rounded-lg border border-purple-400/30 hover:bg-purple-600/30 transition-colors">
                  <ShoppingBag className="w-5 h-5 text-purple-300 mr-3" />
                  <div className="flex-1">
                    <span className="font-medium text-white">Order Peptides</span>
                    <p className="text-sm text-gray-300">Browse and order wellness peptides</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-purple-300" />
                </Link>
              </div>
            </div>
          </div>

          {/* Quick Access Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Link href="/peptides" className="quick-access-card">
              <div className="p-4 bg-primary-600/20 rounded-lg border border-primary-400/30 hover:bg-primary-600/30 transition-colors text-center">
                <Target className="w-8 h-8 text-primary-300 mx-auto mb-2" />
                <span className="text-sm text-white">Peptides</span>
              </div>
            </Link>
            
            <Link href="/workout" className="quick-access-card">
              <div className="p-4 bg-green-600/20 rounded-lg border border-green-400/30 hover:bg-green-600/30 transition-colors text-center">
                <Dumbbell className="w-8 h-8 text-green-300 mx-auto mb-2" />
                <span className="text-sm text-white">Workout</span>
              </div>
            </Link>
            
            <Link href="/nutrition" className="quick-access-card">
              <div className="p-4 bg-amber-600/20 rounded-lg border border-amber-400/30 hover:bg-amber-600/30 transition-colors text-center">
                <Apple className="w-8 h-8 text-amber-300 mx-auto mb-2" />
                <span className="text-sm text-white">Nutrition</span>
              </div>
            </Link>
            
            <Link href="/modules" className="quick-access-card">
              <div className="p-4 bg-purple-600/20 rounded-lg border border-purple-400/30 hover:bg-purple-600/30 transition-colors text-center">
                <Brain className="w-8 h-8 text-purple-300 mx-auto mb-2" />
                <span className="text-sm text-white">Modules</span>
              </div>
            </Link>
            
            <Link href="/breath" className="quick-access-card">
              <div className="p-4 bg-blue-600/20 rounded-lg border border-blue-400/30 hover:bg-blue-600/30 transition-colors text-center">
                <Wind className="w-8 h-8 text-blue-300 mx-auto mb-2" />
                <span className="text-sm text-white">Breathe</span>
              </div>
            </Link>
            
            <Link href="/journal" className="quick-access-card">
              <div className="p-4 bg-secondary-600/20 rounded-lg border border-secondary-400/30 hover:bg-secondary-600/30 transition-colors text-center">
                <BookOpen className="w-8 h-8 text-secondary-300 mx-auto mb-2" />
                <span className="text-sm text-white">Journal</span>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
