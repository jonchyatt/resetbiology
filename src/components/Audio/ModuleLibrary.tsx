"use client"

import { useState, useEffect } from "react"
import { Play, Lock, CheckCircle, Star, Clock } from "lucide-react"
import { AudioPlayer } from "./AudioPlayer"
import type { MentalMasteryModule } from "@/types"

interface ModuleLibraryProps {
  userId: string
}

export function ModuleLibrary({ userId }: ModuleLibraryProps) {
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
          setLoadError(error?.message || 'Failed to load module completions')
        }
      }
    }

    loadCompletions()

    return () => {
      active = false
    }
  }, [])

  // Mental Mastery Method — real 29-module audio library (Foundation/Integration/Mastery/Bonus)
  const modules: MentalMasteryModule[] = [
    {
      id: 'mmm1-reset-relationship-food',
      title: 'Reset Your Relationship with Food',
      description: 'Foundation: Food and I are on the same side — at ease, nourished.',
      audioUrl: '/audio/mmm/mmm1-reset-relationship-food.mp3',
      duration: 533,
      category: 'Foundation',
      requiredForDeposit: false,
      order: 1
    },
    {
      id: 'mmm2-appetite-detective',
      title: 'The Appetite Detective',
      description: 'Foundation: I recognize true hunger clearly — it has its own quiet, steady signal — and I easily tell it apart from boredom, stress, or habit.',
      audioUrl: '/audio/mmm/mmm2-appetite-detective.mp3',
      duration: 653,
      category: 'Foundation',
      requiredForDeposit: false,
      order: 2
    },
    {
      id: 'mmm3-midnight-kitchen',
      title: 'The Midnight Kitchen',
      description: 'Foundation: I\'m complete after dinner; the evening kitchen is closed.',
      audioUrl: '/audio/mmm/mmm3-midnight-kitchen.mp3',
      duration: 639,
      category: 'Foundation',
      requiredForDeposit: false,
      order: 3
    },
    {
      id: 'mmm4-satiety-signal',
      title: 'The Satiety Signal',
      description: 'Foundation: My body signals enough clearly and on time.',
      audioUrl: '/audio/mmm/mmm4-satiety-signal.mp3',
      duration: 644,
      category: 'Foundation',
      requiredForDeposit: false,
      order: 4
    },
    {
      id: 'mmm5-metabolic-awakening',
      title: 'The Metabolic Awakening',
      description: 'Foundation: My body is awake and alive — it runs warm and works with me.',
      audioUrl: '/audio/mmm/mmm5-metabolic-awakening.mp3',
      duration: 669,
      category: 'Foundation',
      requiredForDeposit: false,
      order: 5
    },
    {
      id: 'mmm6-craving-decoder',
      title: 'The Craving Decoder',
      description: 'Foundation: Every craving is a message I can read and meet.',
      audioUrl: '/audio/mmm/mmm6-craving-decoder.mp3',
      duration: 674,
      category: 'Foundation',
      requiredForDeposit: false,
      order: 6
    },
    {
      id: 'mmm7-energy-surge',
      title: 'The Energy Surge',
      description: 'Foundation: I wake energized; my mornings ignite with natural energy.',
      audioUrl: '/audio/mmm/mmm7-energy-surge.mp3',
      duration: 680,
      category: 'Foundation',
      requiredForDeposit: false,
      order: 7
    },
    {
      id: 'mmm8-plate-prophet',
      title: 'The Plate Prophet',
      description: 'Foundation: I know exactly how much satisfies me — I serve myself the right amount, and it\'s always plenty.',
      audioUrl: '/audio/mmm/mmm8-plate-prophet.mp3',
      duration: 700,
      category: 'Foundation',
      requiredForDeposit: false,
      order: 8
    },
    {
      id: 'mmm9-stress-dissolve',
      title: 'The Stress Dissolve',
      description: 'Foundation: When stress rises, I settle straight into calm — food and stress have come unhooked, and I have a faster, truer way home.',
      audioUrl: '/audio/mmm/mmm9-stress-dissolve.mp3',
      duration: 705,
      category: 'Foundation',
      requiredForDeposit: false,
      order: 9
    },
    {
      id: 'mmm10-restaurant-ritual',
      title: 'The Restaurant Ritual',
      description: 'Foundation: I\'m at ease in any restaurant — I order what serves me, enjoy it fully, and stay completely myself.',
      audioUrl: '/audio/mmm/mmm10-restaurant-ritual.mp3',
      duration: 700,
      category: 'Foundation',
      requiredForDeposit: false,
      order: 10
    },
    {
      id: 'mmm11-weekend-warrior',
      title: 'The Weekend Warrior',
      description: 'Integration: My patterns are who I am — portable, structure-free. My healthy self comes with me into weekends, days off, anywhere, no scaffolding required.',
      audioUrl: '/audio/mmm/mmm11-weekend-warrior.mp3',
      duration: 687,
      category: 'Integration',
      requiredForDeposit: false,
      order: 11
    },
    {
      id: 'mmm12-travel-transform',
      title: 'The Travel Transform',
      description: 'Integration: I carry my healthy self everywhere; travel is a backdrop. I\'m the same me in any airport, hotel, or restaurant — home was never the thing holding me steady; I am.',
      audioUrl: '/audio/mmm/mmm12-travel-transform.mp3',
      duration: 709,
      category: 'Integration',
      requiredForDeposit: false,
      order: 12
    },
    {
      id: 'mmm13-family-navigator',
      title: 'The Family Navigator',
      description: 'Integration: I\'m centered at any gathering; the pressure slides off. I enjoy the company, I eat what\'s right for me, and the urging and the guilt just slide off.',
      audioUrl: '/audio/mmm/mmm13-family-navigator.mp3',
      duration: 716,
      category: 'Integration',
      requiredForDeposit: false,
      order: 13
    },
    {
      id: 'mmm14-office-optimizer',
      title: 'The Office Optimizer',
      description: 'Integration: Workplace food has no grip on me — I notice it, it\'s simply not for me, and I move on, easy.',
      audioUrl: '/audio/mmm/mmm14-office-optimizer.mp3',
      duration: 698,
      category: 'Integration',
      requiredForDeposit: false,
      order: 14
    },
    {
      id: 'mmm15-exercise-enthusiast',
      title: 'The Exercise Enthusiast',
      description: 'Integration: My body craves movement — it feels good, I want it, and I move because I love how alive it makes me.',
      audioUrl: '/audio/mmm/mmm15-exercise-enthusiast.mp3',
      duration: 666,
      category: 'Integration',
      requiredForDeposit: false,
      order: 15
    },
    {
      id: 'mmm16-sleep-sculptor',
      title: 'The Sleep Sculptor',
      description: 'Integration: I sink into deep, restorative sleep easily — and through the night my body does its quiet healing and restoring work.',
      audioUrl: '/audio/mmm/mmm16-sleep-sculptor.mp3',
      duration: 705,
      category: 'Integration',
      requiredForDeposit: false,
      order: 16
    },
    {
      id: 'mmm17-hydration-highway',
      title: 'The Hydration Highway',
      description: 'Integration: Water IS satisfaction — I\'m easily, naturally hydrated, and a tall glass settles me as deeply as a meal would.',
      audioUrl: '/audio/mmm/mmm17-hydration-highway.mp3',
      duration: 682,
      category: 'Integration',
      requiredForDeposit: false,
      order: 17
    },
    {
      id: 'mmm18-grocery-guardian',
      title: 'The Grocery Guardian',
      description: 'Integration: I\'m in command at the store — my cart fills with what serves me, and the junk simply holds no pull.',
      audioUrl: '/audio/mmm/mmm18-grocery-guardian.mp3',
      duration: 691,
      category: 'Integration',
      requiredForDeposit: false,
      order: 18
    },
    {
      id: 'mmm19-prep-prophet',
      title: 'The Prep Prophet',
      description: 'Integration: Prepping food ahead is an act of caring for myself — I enjoy it, and future-me is always taken care of.',
      audioUrl: '/audio/mmm/mmm19-prep-prophet.mp3',
      duration: 679,
      category: 'Integration',
      requiredForDeposit: false,
      order: 19
    },
    {
      id: 'mmm20-progress-protector',
      title: 'The Progress Protector',
      description: 'Integration: A plateau is my body integrating the change — I hold steady, trust the process, and keep going; progress always resumes.',
      audioUrl: '/audio/mmm/mmm20-progress-protector.mp3',
      duration: 698,
      category: 'Integration',
      requiredForDeposit: false,
      order: 20
    },
    {
      id: 'mmm22-identity-integration',
      title: 'The Identity Integration',
      description: 'Mastery: This is simply who I am now — a healthy person. Not a role I\'m playing, not a diet I\'m on, not effort I\'m sustaining. My identity.',
      audioUrl: '/audio/mmm/mmm22-identity-integration.mp3',
      duration: 691,
      category: 'Mastery',
      requiredForDeposit: false,
      order: 22
    },
    {
      id: 'mmm24-celebration-circuit',
      title: 'The Celebration Circuit',
      description: 'Mastery: I celebrate fully — I enjoy all of it — and I stay completely myself; the occasion is the people and the joy, and it never derails me.',
      audioUrl: '/audio/mmm/mmm24-celebration-circuit.mp3',
      duration: 718,
      category: 'Mastery',
      requiredForDeposit: false,
      order: 24
    },
    {
      id: 'mmm25-mentor-mindset',
      title: 'The Mentor Mindset',
      description: 'Mastery: My journey is a gift I share naturally — guiding others is part of who I\'ve become, and every time I share it, my own change gets deeper.',
      audioUrl: '/audio/mmm/mmm25-mentor-mindset.mp3',
      duration: 701,
      category: 'Mastery',
      requiredForDeposit: false,
      order: 25
    },
    {
      id: 'mmm26-lifetime-learner',
      title: 'The Lifetime Learner',
      description: 'Mastery: I\'m a lifetime learner of my own body — always curious, always refining, and I genuinely enjoy it; there\'s always a next small discovery.',
      audioUrl: '/audio/mmm/mmm26-lifetime-learner.mp3',
      duration: 697,
      category: 'Mastery',
      requiredForDeposit: false,
      order: 26
    },
    {
      id: 'mmm27-resilience-response',
      title: 'The Resilience Response',
      description: 'Mastery: Any slip is just data and the next rep — I bounce back the very same day, no drama, no spiral, no self-punishment.',
      audioUrl: '/audio/mmm/mmm27-resilience-response.mp3',
      duration: 689,
      category: 'Mastery',
      requiredForDeposit: false,
      order: 27
    },
    {
      id: 'mmm28-victory-visualization',
      title: 'The Victory Visualization',
      description: 'Mastery: I see and feel my future self vividly — healthy, free, exactly where I\'m headed — and it\'s already real, already pulling me toward it.',
      audioUrl: '/audio/mmm/mmm28-victory-visualization.mp3',
      duration: 673,
      category: 'Mastery',
      requiredForDeposit: false,
      order: 28
    },
    {
      id: 'mmm29-community-champion',
      title: 'The Community Champion',
      description: 'Mastery: I naturally champion and uplift the people around me — my change is contagious, and I genuinely love being part of others\' momentum.',
      audioUrl: '/audio/mmm/mmm29-community-champion.mp3',
      duration: 668,
      category: 'Mastery',
      requiredForDeposit: false,
      order: 29
    },
    {
      id: 'mmm30-freedom-formula',
      title: 'The Freedom Formula',
      description: 'Mastery: I am completely free — food has no power over me, the war is over, and I simply get to live, and celebrate the freedom.',
      audioUrl: '/audio/mmm/mmm30-freedom-formula.mp3',
      duration: 738,
      category: 'Mastery',
      requiredForDeposit: false,
      order: 30
    },
    {
      id: 'mmm-bonus-cortisol-crusher',
      title: 'The Cortisol Crusher',
      description: 'Bonus: Stress moves through me and out — I settle back to calm quickly, and tension doesn\'t accumulate in my body.',
      audioUrl: '/audio/mmm/mmm-bonus-cortisol-crusher.mp3',
      duration: 704,
      category: 'Bonus',
      requiredForDeposit: false,
      order: 999
    }
  ]

  const handleModuleProgress = (moduleId: string, progress: number) => {
    console.log(`Module ${moduleId} progress: ${progress}%`)
    // TODO: Save progress to database/Google Drive
  }

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
      alert(`Module completion saved!${bonus}`)
    } catch (error: any) {
      console.error('Module completion failed:', error)
      alert(`Failed to record module completion: ${error?.message || 'Please try again.'}`)
    } finally {
      setIsSaving(false)
    }
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
          Transform your relationship with food, body, and medications through psychology-based audio coaching.
          Complete modules to secure your partner stake and unlock advanced protocols.
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
      {['Foundation', 'Integration', 'Mastery', 'Bonus'].map(category => {
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
