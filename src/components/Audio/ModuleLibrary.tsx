"use client"

import { useState } from "react"
import { Play, Lock, CheckCircle, Star, Clock } from "lucide-react"
import { AudioPlayer } from "./AudioPlayer"
import type { MentalMasteryModule } from "@/types"

interface ModuleLibraryProps {
  userId: string
}

export function ModuleLibrary({ userId }: ModuleLibraryProps) {
  const [selectedModule, setSelectedModule] = useState<MentalMasteryModule | null>(null)
  const [completedModules, setCompletedModules] = useState<string[]>([])

  // Mock Mental Mastery modules with psychological progression
  const modules: MentalMasteryModule[] = [
    {
      id: 'module-1',
      title: 'Mental Mastery Module 1',
      description: 'Foundation: Reset your relationship with food, body, and medication dependency.',
      audioUrl: '/1mmm1.mp3', // Real audio file
      duration: 1800, // Estimated 30 minutes - will be updated after listening
      category: 'Foundation',
      requiredForDeposit: true,
      order: 1
    },
    {
      id: 'module-2', 
      title: 'Breaking the Shame-Hunger Cycle',
      description: 'Foundation: How shame creates hunger signals and perpetuates medication dependency.',
      audioUrl: '/audio/foundation-shame-cycle.mp3',
      duration: 2100, // 35 minutes
      category: 'Foundation',
      requiredForDeposit: true,
      order: 2
    },
    {
      id: 'module-3',
      title: 'Your Identity Beyond the Scale',
      description: 'Foundation: Building an identity that supports long-term metabolic health independent of medications.',
      audioUrl: '/audio/foundation-identity.mp3',
      duration: 1650, // 27.5 minutes
      category: 'Foundation',
      requiredForDeposit: true,
      order: 3
    },
    {
      id: 'module-4',
      title: 'Stress Biology & Cortisol Mastery',
      description: 'Integration: Advanced stress management techniques that work synergistically with Retatrutide.',
      audioUrl: '/audio/integration-stress-mastery.mp3',
      duration: 2400, // 40 minutes
      category: 'Integration',
      requiredForDeposit: true,
      order: 4
    },
    {
      id: 'module-5',
      title: 'The Confidence Protocol',
      description: 'Integration: Building unshakeable confidence as your body transforms.',
      audioUrl: '/audio/integration-confidence.mp3',
      duration: 1950, // 32.5 minutes
      category: 'Integration',
      requiredForDeposit: false,
      order: 5
    },
    {
      id: 'module-6',
      title: 'Metabolic Freedom Formula',
      description: 'Mastery: The complete system for maintaining results after tapering off Retatrutide.',
      audioUrl: '/audio/mastery-freedom-formula.mp3',
      duration: 3600, // 60 minutes - flagship module
      category: 'Mastery',
      requiredForDeposit: true,
      order: 6
    },
    {
      id: 'module-7',
      title: 'The Graduate Protocol',
      description: 'Mastery: Advanced strategies for helping others achieve metabolic freedom.',
      audioUrl: '/audio/mastery-graduate-protocol.mp3',
      duration: 2700, // 45 minutes
      category: 'Mastery',
      requiredForDeposit: false,
      order: 7
    }
  ]

  const handleModuleProgress = (moduleId: string, progress: number) => {
    console.log(`Module ${moduleId} progress: ${progress}%`)
    // TODO: Save progress to database/Google Drive
  }

  const handleModuleComplete = (moduleId: string) => {
    setCompletedModules(prev => [...prev, moduleId])
    setSelectedModule(null)
    
    // TODO: Award points and update deposit progress
    console.log(`Module ${moduleId} completed - awarding points`)
    
    // Celebration psychology
    alert('🎉 Module Complete! +100 points earned. Your partner stake is more secure!')
  }

  const isModuleAccessible = (module: MentalMasteryModule) => {
    // Foundation modules: Always accessible
    if (module.category === 'Foundation') return true
    
    // Integration modules: Need 2 foundation modules
    if (module.category === 'Integration') {
      const foundationComplete = modules
        .filter(m => m.category === 'Foundation')
        .filter(m => completedModules.includes(m.id))
        .length
      return foundationComplete >= 2
    }
    
    // Mastery modules: Need 4 total modules
    if (module.category === 'Mastery') {
      return completedModules.length >= 4
    }
    
    return false
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    return `${mins} min`
  }

  if (selectedModule) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setSelectedModule(null)}
            className="text-primary-600 hover:text-primary-700 font-semibold"
          >
            ← Back to Library
          </button>
          <div className="text-sm text-gray-500">
            Module {selectedModule.order} of {modules.length}
          </div>
        </div>
        
        <AudioPlayer 
          module={selectedModule}
          onProgress={(progress) => handleModuleProgress(selectedModule.id, progress)}
          onComplete={() => handleModuleComplete(selectedModule.id)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Library Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Mental Mastery Library</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Transform your relationship with food, body, and medications through psychology-based audio coaching.
          Complete modules to secure your partner stake and unlock advanced protocols.
        </p>
      </div>

      {/* Progress Overview */}
      <div className="bg-gradient-to-r from-primary-50 to-secondary-50 rounded-lg p-6 border border-primary-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Your Learning Progress</h2>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary-600">{completedModules.length}</p>
            <p className="text-sm text-gray-600">/ {modules.filter(m => m.requiredForDeposit).length} Required</p>
          </div>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
          <div 
            className="bg-gradient-to-r from-primary-400 to-secondary-400 h-3 rounded-full transition-all duration-500"
            style={{ width: `${(completedModules.length / modules.filter(m => m.requiredForDeposit).length) * 100}%` }}
          />
        </div>
        
        <p className="text-sm text-gray-600 text-center">
          {modules.filter(m => m.requiredForDeposit).length - completedModules.length} modules remaining to secure your stake
        </p>
      </div>

      {/* Module Categories */}
      {['Foundation', 'Integration', 'Mastery'].map(category => {
        const categoryModules = modules.filter(m => m.category === category)
        
        return (
          <div key={category} className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              {category === 'Foundation' && <span className="text-green-600 mr-2">🌱</span>}
              {category === 'Integration' && <span className="text-blue-600 mr-2">🔗</span>}
              {category === 'Mastery' && <span className="text-purple-600 mr-2">👑</span>}
              {category} Phase
            </h2>
            
            <div className="grid gap-4">
              {categoryModules.map(module => {
                const isCompleted = completedModules.includes(module.id)
                const isAccessible = isModuleAccessible(module)
                
                return (
                  <div 
                    key={module.id}
                    className={`bg-white rounded-lg p-4 border transition-all ${
                      isCompleted ? 'border-green-200 bg-green-50' :
                      isAccessible ? 'border-gray-200 hover:border-primary-200 cursor-pointer' :
                      'border-gray-100 bg-gray-50'
                    }`}
                    onClick={() => isAccessible && setSelectedModule(module)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          {isCompleted ? (
                            <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                          ) : isAccessible ? (
                            <Play className="w-5 h-5 text-primary-500 mr-2" />
                          ) : (
                            <Lock className="w-5 h-5 text-gray-400 mr-2" />
                          )}
                          
                          <h3 className={`text-lg font-semibold ${
                            isCompleted ? 'text-green-800' :
                            isAccessible ? 'text-gray-900' : 'text-gray-500'
                          }`}>
                            {module.title}
                          </h3>
                          
                          {module.requiredForDeposit && (
                            <Star className="w-4 h-4 text-yellow-500 ml-2" />
                          )}
                        </div>
                        
                        <p className={`text-sm mb-2 ${
                          isAccessible ? 'text-gray-600' : 'text-gray-400'
                        }`}>
                          {module.description}
                        </p>
                        
                        <div className="flex items-center text-xs text-gray-500">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatDuration(module.duration)}
                          {module.requiredForDeposit && (
                            <span className="ml-3 bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                              Required for Payout
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right ml-4">
                        {isCompleted ? (
                          <div className="text-green-600 font-semibold text-sm">
                            ✓ Complete
                          </div>
                        ) : isAccessible ? (
                          <div className="text-primary-600 font-semibold text-sm">
                            Start →
                          </div>
                        ) : (
                          <div className="text-gray-400 text-sm">
                            Locked
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Library Footer Psychology */}
      <div className="bg-gray-800 text-white rounded-lg p-6 text-center">
        <h3 className="text-lg font-bold mb-2">🎯 Your Mental Mastery Journey</h3>
        <p className="text-gray-300 mb-4">
          Each module builds on the last, creating lasting change that works with or without medications.
          Complete the required modules to secure your partner stake and unlock true metabolic freedom.
        </p>
        <div className="flex justify-center space-x-6 text-sm">
          <div>
            <span className="text-green-400 font-semibold">{completedModules.length}</span> Completed
          </div>
          <div>
            <span className="text-yellow-400 font-semibold">{modules.filter(m => isModuleAccessible(m) && !completedModules.includes(m.id)).length}</span> Available
          </div>
          <div>
            <span className="text-gray-400 font-semibold">{modules.filter(m => !isModuleAccessible(m)).length}</span> Locked
          </div>
        </div>
      </div>
    </div>
  )
}