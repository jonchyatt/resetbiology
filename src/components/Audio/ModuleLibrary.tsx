"use client"

import { useState, useEffect } from "react"
import { Play, CheckCircle } from "lucide-react"
import { AudioPlayer } from "./AudioPlayer"
import { useToast } from "@/components/ui/Toast"
import { useUser } from "@auth0/nextjs-auth0"
import { AUDIO_LIBRARY, type AudioLibraryEntry } from "@/data/audio-library"

export function ModuleLibrary() {
  const toast = useToast()
  const { user } = useUser()
  const isAdmin = ((user as any)?.['https://resetbiology.com/claims/role'] ?? (user as any)?.role) === 'admin'
  const [selectedModule, setSelectedModule] = useState<AudioLibraryEntry | null>(null)
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

  const modules: AudioLibraryEntry[] = AUDIO_LIBRARY

  // Members see released entries only; admins also see unreleased ones as a preview.
  const visibleModules = modules.filter(m => m.available && (m.released || isAdmin))

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

  // Nothing is locked: every listed recording plays.
  const isModuleAccessible = (module: AudioLibraryEntry) => module.available

  const POS_KEY = (id: string) => `rb_audio_pos_${id}`
  const savePosition = (id: string, seconds: number) => {
    try { localStorage.setItem(POS_KEY(id), String(Math.floor(seconds))) } catch {}
  }
  const loadPosition = (id: string) => {
    try { return Number(localStorage.getItem(POS_KEY(id))) || 0 } catch { return 0 }
  }

  const completedAvailableCount = visibleModules.filter(module => completedModules.includes(module.id)).length

  if (selectedModule) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setSelectedModule(null)}
          className="text-primary-600 hover:text-primary-700 font-semibold"
        >
          ← Back to Library
        </button>
        <AudioPlayer
          module={selectedModule}
          startAt={loadPosition(selectedModule.id)}
          onProgress={(percent) => {
            if (selectedModule.duration && percent > 0 && percent < 98) {
              savePosition(selectedModule.id, (percent / 100) * selectedModule.duration)
            }
          }}
          onComplete={() => void handleModuleComplete(selectedModule.id)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Guided Audio</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Psychology-based audio coaching for food, body, and medication-related habits.
        </p>
        <p className="mt-2 text-sm font-semibold text-primary-600">
          {completedAvailableCount} of {visibleModules.length} listened
        </p>
      </div>

      {loadError && (
        <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {loadError}
        </div>
      )}

      {visibleModules.length === 0 && (
        <p className="text-center text-gray-600">New guided audio is on its way. Check back soon.</p>
      )}

      {['Foundation', 'Integration', 'Mastery', 'Bonus'].map(category => {
        const categoryModules = visibleModules
          .filter(m => m.category === category)
          .sort((x, y) => x.order - y.order)
        if (!categoryModules.length) return null

        return (
          <div key={category} className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              {category === 'Foundation' && <span className="text-green-600 mr-2">🌱</span>}
              {category === 'Integration' && <span className="text-blue-600 mr-2">🔗</span>}
              {category === 'Mastery' && <span className="text-purple-600 mr-2">👑</span>}
              {category === 'Bonus' && <span className="text-yellow-600 mr-2">⭐</span>}
              {category} <span className="ml-2 text-sm font-normal text-gray-500">({categoryModules.length})</span>
            </h2>

            <div className="grid gap-4">
              {categoryModules.map(module => {
                const isCompleted = completedModules.includes(module.id)
                const isFirst = module.id === 'mmm1-reset-relationship-food'
                return (
                  <div
                    key={module.id}
                    className={`rounded-lg p-4 border transition-all cursor-pointer ${
                      isCompleted ? 'border-green-200 bg-green-50' : 'bg-white border-gray-200 hover:border-primary-200'
                    }`}
                    onClick={() => isModuleAccessible(module) && setSelectedModule(module)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          {isCompleted ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : (
                            <Play className="w-5 h-5 text-primary-500" />
                          )}
                          <h3 className={`text-lg font-semibold ${isCompleted ? 'text-green-800' : 'text-gray-900'}`}>
                            {module.title}
                          </h3>
                          {isFirst && (
                            <span className="bg-primary-100 text-primary-700 px-2 py-1 rounded-full text-xs">Start here</span>
                          )}
                          {!module.released && (
                            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">
                              Preview: not released
                            </span>
                          )}
                        </div>
                        <p className="text-sm mb-2 text-gray-600">{module.description}</p>
                        {module.duration ? (
                          <p className="text-xs text-gray-500">{Math.round(module.duration / 60)} min</p>
                        ) : null}
                      </div>
                      <div className="text-right ml-4">
                        {isCompleted ? (
                          <div className="text-green-600 font-semibold text-sm">✓ Listened</div>
                        ) : (
                          <div className="text-primary-600 font-semibold text-sm">Play →</div>
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
    </div>
  )
}
