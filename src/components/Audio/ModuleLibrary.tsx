"use client"

import { useState, useEffect } from "react"
import { Play, Lock, CheckCircle, Star } from "lucide-react"
import { AudioPlayer } from "./AudioPlayer"
import { useToast } from "@/components/ui/Toast"
import type { MentalMasteryModule } from "@/types"

type LibraryModule = MentalMasteryModule & { available: boolean }

export function ModuleLibrary() {
  const toast = useToast()
  const [selectedModule, setSelectedModule] = useState<MentalMasteryModule | null>(null)
  const [completedModules, setCompletedModules] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const loadCompletions = async () => {
      try {
        setLoadError(null)
        const response = await fetch('/api/modules/complete?limit=200', { cache: 'no-store' })
        const data = await response.json().catch(() => null)

        if (!response.ok || !data?.success) {
          throw new Error(data?.error || 'Failed to load module history')
        }

        if (!active) return

        const completedIds = Array.isArray(data.completions)
          ? data.completions
              .map((item: any) => item?.moduleId)
              .filter((value: unknown): value is string => typeof value === 'string')
          : []

        if (completedIds.length) {
          setCompletedModules(prev => {
            const merged = new Set(prev)
            completedIds.forEach((id: string) => merged.add(id))
            return Array.from(merged)
          })
        }
      } catch (error: any) {
        console.error('Failed to load module completions:', error)
        if (active) {
          const message = error?.message || 'Failed to load module completions'
          setLoadError(message)
          toast.error(message)
        }
      }
    }

    loadCompletions()

    return () => {
      active = false
    }
  }, [toast])

  const modules: LibraryModule[] = [
    {
      id: 'module-1',
      title: 'Mental Mastery Module 1',
      description: 'Foundation: Reset your relationship with food, body, and medication dependency.',
      audioUrl: '/1mmm1.mp3',
      category: 'Foundation',
      requiredForDeposit: true,
      order: 1,
      available: true,
    },
    {
      id: 'module-2', 
      title: 'Breaking the Shame-Hunger Cycle',
      description: 'Foundation: How shame creates hunger signals and perpetuates medication dependency.',
      audioUrl: '/audio/foundation-shame-cycle.mp3',
      category: 'Foundation',
      requiredForDeposit: true,
      order: 2,
      available: false,
    },
    {
      id: 'module-3',
      title: 'Your Identity Beyond the Scale',
      description: 'Foundation: Building an identity that supports long-term metabolic health independent of medications.',
      audioUrl: '/audio/foundation-identity.mp3',
      category: 'Foundation',
      requiredForDeposit: true,
      order: 3,
      available: false,
    },
    {
      id: 'module-4',
      title: 'Stress Biology & Cortisol Mastery',
      description: 'Integration: Advanced stress management techniques that work synergistically with Retatrutide.',
      audioUrl: '/audio/integration-stress-mastery.mp3',
      category: 'Integration',
      requiredForDeposit: true,
      order: 4,
      available: false,
    },
    {
      id: 'module-5',
      title: 'The Confidence Protocol',
      description: 'Integration: Building unshakeable confidence as your body transforms.',
      audioUrl: '/audio/integration-confidence.mp3',
      category: 'Integration',
      requiredForDeposit: false,
      order: 5,
      available: false,
    },
    {
      id: 'module-6',
      title: 'Metabolic Freedom Formula',
      description: 'Mastery: The complete system for maintaining results after tapering off Retatrutide.',
      audioUrl: '/audio/mastery-freedom-formula.mp3',
      category: 'Mastery',
      requiredForDeposit: true,
      order: 6,
      available: false,
    },
    {
      id: 'module-7',
      title: 'The Graduate Protocol',
      description: 'Mastery: Advanced strategies for helping others achieve metabolic freedom.',
      audioUrl: '/audio/mastery-graduate-protocol.mp3',
      category: 'Mastery',
      requiredForDeposit: false,
      order: 7,
      available: false,
    }
  ]

  const handleModuleComplete = async (moduleId: string) => {
    if (isSaving) return

    setIsSaving(true)
    try {
      const moduleMeta = modules.find(m => m.id === moduleId)
      const payload = {
        moduleId,
        audioDuration: moduleMeta?.duration ? Math.round(moduleMeta.duration) : undefined,
        fullCompletion: true,
      }
      console.log('Saving module completion:', payload)

      const response = await fetch('/api/modules/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      console.log('Module completion response status:', response.status)
      const data = await response.json().catch((e) => {
        console.error('Failed to parse module completion response:', e)
        return null
      })
      console.log('Module completion result:', data)

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to record module completion')
      }

      setCompletedModules(prev => (prev.includes(moduleId) ? prev : [...prev, moduleId]))

      console.log('Dispatching module:completion event with:', data)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('module:completion', {
          detail: {
            moduleId,
            pointsAwarded: data?.pointsAwarded ?? 0,
            journalNote: data?.journalNote,
            dailyTaskCompleted: Boolean(data?.dailyTaskCompleted),
          },
        }))
      }

      setSelectedModule(null)

      const bonus = data?.pointsAwarded ? ` +${data.pointsAwarded} pts` : ''
      toast.success(`Module completion saved!${bonus}`)
    } catch (error: any) {
      console.error('Module completion failed:', error)
      toast.error(`Failed to record module completion: ${error?.message || 'Please try again.'}`)
    } finally {
      setIsSaving(false)
    }
  }

  const isModuleAccessible = (module: LibraryModule) => {
    if (!module.available) return false

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

  const requiredModules = modules.filter(module => module.available && module.requiredForDeposit)
  const completedRequiredCount = requiredModules.filter(module => completedModules.includes(module.id)).length
  const completedAvailableCount = modules.filter(module => module.available && completedModules.includes(module.id)).length

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
            Module {selectedModule.order} of {modules.filter(module => module.available).length}
          </div>
        </div>
        
              <AudioPlayer 
                module={selectedModule}
                onComplete={() => void handleModuleComplete(selectedModule.id)}
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
          Explore psychology-based audio coaching for food, body, and medication-related habits.
          Complete available modules to track your learning progress.
        </p>
      </div>

      {loadError && (
        <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {loadError}
        </div>
      )}

      {/* Progress Overview */}
      <div className="bg-gradient-to-r from-primary-50 to-secondary-50 rounded-lg p-6 border border-primary-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Your Learning Progress</h2>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary-600">{completedRequiredCount}</p>
            <p className="text-sm text-gray-600">/ {requiredModules.length} Required</p>
          </div>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
          <div 
            className="bg-gradient-to-r from-primary-400 to-secondary-400 h-3 rounded-full transition-all duration-500"
            style={{ width: `${requiredModules.length ? (completedRequiredCount / requiredModules.length) * 100 : 0}%` }}
          />
        </div>
        
        <p className="text-sm text-gray-600 text-center">
          {requiredModules.length - completedRequiredCount} modules remaining to secure your stake
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
                const isComingSoon = !module.available
                const isCompleted = module.available && completedModules.includes(module.id)
                const isAccessible = isModuleAccessible(module)
                
                return (
                  <div 
                    key={module.id}
                    className={`bg-white rounded-lg p-4 border transition-all ${
                      isComingSoon ? 'border-gray-100 bg-gray-50' :
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
                          
                          {module.requiredForDeposit && module.available && (
                            <Star className="w-4 h-4 text-yellow-500 ml-2" />
                          )}
                        </div>
                        
                        <p className={`text-sm mb-2 ${
                          isAccessible ? 'text-gray-600' : 'text-gray-400'
                        }`}>
                          {module.description}
                        </p>
                        
                        <div className="flex items-center text-xs text-gray-500">
                          {module.requiredForDeposit && module.available && (
                            <span className="ml-3 bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                              Core module
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right ml-4">
                        {isCompleted ? (
                          <div className="text-green-600 font-semibold text-sm">
                            ✓ Complete
                          </div>
                        ) : isComingSoon ? (
                          <div className="text-gray-400 text-sm">
                            Coming soon
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
          Each module builds on the last to support your ongoing learning, with or without medications.
          Complete available modules to track your learning progress.
        </p>
        <div className="flex justify-center space-x-6 text-sm">
          <div>
            <span className="text-green-400 font-semibold">{completedAvailableCount}</span> Completed
          </div>
          <div>
            <span className="text-yellow-400 font-semibold">{modules.filter(m => m.available && isModuleAccessible(m) && !completedModules.includes(m.id)).length}</span> Available
          </div>
          <div>
            <span className="text-gray-400 font-semibold">{modules.filter(m => !m.available).length}</span> Coming soon
          </div>
        </div>
      </div>
    </div>
  )
}
