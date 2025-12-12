"use client"

import { useState, useEffect, useCallback } from "react"
import { BreathTrainingApp } from "./BreathTrainingApp"
import { Plus, Wind, Play, Trash2, X, Clock, RotateCcw, Library, Zap } from "lucide-react"
import { PortalHeader } from "@/components/Navigation/PortalHeader"

interface BreathExercise {
  id: string
  name: string
  slug: string
  description: string
  category: string
  inhaleMs: number
  exhaleMs: number
  inhaleHoldMs: number
  exhaleHoldMs: number
  breathsPerCycle: number
  cyclesTarget: number
  postCycleExhaleHoldMs: number
  postCycleInhaleHoldMs: number
  backgroundMusic?: string | null
  musicVolume?: number
  guidedAudio?: string | null
  isSample?: boolean
  isActive?: boolean
  sortOrder?: number
}

interface UserBreathExercise extends BreathExercise {
  exerciseId: string
  customName?: string | null
  createdAt: string
  updatedAt: string
}

export function BreathPage() {
  const [activeTab, setActiveTab] = useState<"my-protocols" | "library" | "training">("my-protocols")
  const [userExercises, setUserExercises] = useState<UserBreathExercise[]>([])
  const [exerciseLibrary, setExerciseLibrary] = useState<BreathExercise[]>([])
  const [loadingExercises, setLoadingExercises] = useState(true)
  const [loadingLibrary, setLoadingLibrary] = useState(true)
  const [selectedExercise, setSelectedExercise] = useState<UserBreathExercise | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>("all")

  // Keep header/subnav visible when switching tabs
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }, [activeTab])

  // Fetch user's active exercises
  const fetchUserExercises = useCallback(async () => {
    try {
      setLoadingExercises(true)
      const response = await fetch('/api/breath/user-exercises')
      const data = await response.json()
      if (data.success) {
        setUserExercises(data.exercises || [])
      }
    } catch (error) {
      console.error('Error fetching user exercises:', error)
    } finally {
      setLoadingExercises(false)
    }
  }, [])

  // Fetch exercise library
  const fetchExerciseLibrary = useCallback(async () => {
    try {
      setLoadingLibrary(true)
      const response = await fetch('/api/breath/exercises')
      const data = await response.json()
      if (data.exercises) {
        setExerciseLibrary(data.exercises)
      }
    } catch (error) {
      console.error('Error fetching exercise library:', error)
    } finally {
      setLoadingLibrary(false)
    }
  }, [])

  useEffect(() => {
    fetchUserExercises()
    fetchExerciseLibrary()
  }, [fetchUserExercises, fetchExerciseLibrary])

  // Add exercise from library
  const addExercise = async (exerciseId: string) => {
    try {
      const response = await fetch('/api/breath/user-exercises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exerciseId })
      })
      const data = await response.json()
      if (data.success) {
        await fetchUserExercises()
      }
    } catch (error) {
      console.error('Error adding exercise:', error)
    }
  }

  // Remove exercise
  const removeExercise = async (id: string) => {
    if (!confirm('Remove this exercise from your active list?')) return
    try {
      const response = await fetch(`/api/breath/user-exercises?id=${id}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (data.success) {
        await fetchUserExercises()
      }
    } catch (error) {
      console.error('Error removing exercise:', error)
    }
  }

  // Start training with selected exercise
  const startTraining = (exercise: UserBreathExercise) => {
    setSelectedExercise(exercise)
    setActiveTab("training")
  }

  // Get unique categories from library
  const categories = Array.from(new Set(exerciseLibrary.map(e => e.category)))

  // Filter library by category
  const filteredLibrary = filterCategory === "all"
    ? exerciseLibrary
    : exerciseLibrary.filter(e => e.category === filterCategory)

  // Check if exercise is already added
  const isExerciseAdded = (exerciseId: string) => {
    return userExercises.some(ue => ue.exerciseId === exerciseId)
  }

  // Format time display
  const formatMs = (ms: number) => {
    const seconds = ms / 1000
    return seconds === Math.floor(seconds) ? `${seconds}s` : `${seconds.toFixed(1)}s`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800"
      style={{
        backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}>
      <div className="relative z-10 min-h-screen flex flex-col pt-32">
        <PortalHeader
          section="Breath Training"
          secondaryBackLink="/daily-history"
          secondaryBackText="Daily History"
        />

        {/* Page Title */}
        <div className="text-center py-8">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            <Wind className="inline-block w-10 h-10 mr-3 text-primary-400" />
            <span className="text-primary-400">Breath</span> Training
          </h2>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Master your nervous system through conscious breathing techniques
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center gap-2 md:gap-4 mb-8 px-4">
          <button
            onClick={() => setActiveTab("my-protocols")}
            className={`px-4 md:px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2 ${activeTab === "my-protocols"
              ? "bg-primary-600 text-white shadow-lg"
              : "bg-gray-800/50 text-gray-300 hover:bg-gray-700/50"
              }`}
          >
            <Zap className="w-5 h-5" />
            <span className="hidden sm:inline">My Protocols</span>
            <span className="sm:hidden">Protocols</span>
          </button>
          <button
            onClick={() => setActiveTab("library")}
            className={`px-4 md:px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2 ${activeTab === "library"
              ? "bg-primary-600 text-white shadow-lg"
              : "bg-gray-800/50 text-gray-300 hover:bg-gray-700/50"
              }`}
          >
            <Library className="w-5 h-5" />
            <span className="hidden sm:inline">Protocol Library</span>
            <span className="sm:hidden">Library</span>
          </button>
          <button
            onClick={() => setActiveTab("training")}
            className={`px-4 md:px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2 ${activeTab === "training"
              ? "bg-primary-600 text-white shadow-lg"
              : "bg-gray-800/50 text-gray-300 hover:bg-gray-700/50"
              }`}
          >
            <Play className="w-5 h-5" />
            Training
          </button>
        </div>

        {/* My Protocols Tab - Quick Access */}
        {activeTab === "my-protocols" && (
          <div className="container mx-auto px-4 pb-12">
            <div className="max-w-5xl mx-auto">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-white">My Breath Protocols</h3>
                  <p className="text-gray-400 text-sm">Click any protocol to start training</p>
                </div>
                <button
                  onClick={() => setActiveTab("library")}
                  className="bg-gray-700/50 hover:bg-gray-600/50 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add from Library
                </button>
              </div>

              {/* Quick Access Protocols Grid */}
              {loadingExercises ? (
                <div className="text-center py-12">
                  <div className="animate-spin w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full mx-auto mb-3"></div>
                  <p className="text-gray-300">Loading your protocols...</p>
                </div>
              ) : userExercises.length === 0 ? (
                <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-8 border border-primary-400/30 shadow-2xl text-center">
                  <Wind className="w-16 h-16 text-primary-400 mx-auto mb-6" />
                  <h3 className="text-2xl font-bold text-white mb-4">
                    No Protocols Added Yet
                  </h3>
                  <p className="text-gray-200 mb-8">
                    Add breath protocols from our library for quick access. We recommend starting with the <strong>Autophagy/VO2-max Builder</strong> - our signature protocol.
                  </p>
                  <button
                    onClick={() => setActiveTab("library")}
                    className="bg-primary-500 hover:bg-primary-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 hover:scale-105 shadow-2xl"
                  >
                    Browse Protocol Library
                  </button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {userExercises.map((exercise) => (
                    <div
                      key={exercise.id}
                      className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-5 border border-primary-400/20 hover:border-primary-400/40 transition-all shadow-lg group cursor-pointer"
                      onClick={() => startTraining(exercise)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="text-lg font-bold text-white group-hover:text-primary-300 transition-colors">{exercise.name}</h4>
                          <span className="text-xs px-2 py-1 rounded-full bg-primary-600/30 text-primary-300 capitalize">
                            {exercise.category}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            removeExercise(exercise.id)
                          }}
                          className="p-2 text-gray-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                          title="Remove from My Protocols"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                        {exercise.description}
                      </p>

                      {/* Quick Stats */}
                      <div className="flex gap-3 text-xs text-gray-400 mb-4">
                        <span>{formatMs(exercise.inhaleMs)} in / {formatMs(exercise.exhaleMs)} out</span>
                        <span>•</span>
                        <span>{exercise.breathsPerCycle} breaths × {exercise.cyclesTarget} cycles</span>
                      </div>

                      <div className="flex items-center justify-center gap-2 text-primary-400 font-semibold group-hover:text-primary-300">
                        <Play className="w-5 h-5" />
                        Start Training
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Protocol Library Tab */}
        {activeTab === "library" && (
          <div className="container mx-auto px-4 pb-12">
            <div className="max-w-5xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-white">Breath Protocol Library</h3>
                  <p className="text-gray-400 text-sm">Add protocols to My Protocols for quick access</p>
                </div>
              </div>

              {/* Category Filter */}
              <div className="flex flex-wrap gap-2 mb-6">
                <button
                  onClick={() => setFilterCategory("all")}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filterCategory === "all"
                    ? "bg-primary-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    }`}
                >
                  All
                </button>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${filterCategory === cat
                      ? "bg-primary-600 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Exercise List */}
              {loadingLibrary ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full mx-auto mb-3"></div>
                  <p className="text-gray-300">Loading protocols...</p>
                </div>
              ) : filteredLibrary.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  No protocols found in this category.
                </div>
              ) : (
                <div className="grid gap-4">
                  {filteredLibrary.map((exercise) => {
                    const added = isExerciseAdded(exercise.id)
                    return (
                      <div
                        key={exercise.id}
                        className={`bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-5 border transition-all ${added
                          ? "border-green-500/40"
                          : "border-primary-400/20 hover:border-primary-400/40"
                          }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="text-lg font-semibold text-white">{exercise.name}</h4>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-primary-600/30 text-primary-300 capitalize">
                                {exercise.category}
                              </span>
                              {added && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-600/30 text-green-300 flex items-center gap-1">
                                  ✓ In My Protocols
                                </span>
                              )}
                            </div>
                            <p className="text-gray-300 text-sm mb-3">{exercise.description}</p>
                            <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatMs(exercise.inhaleMs)} in / {formatMs(exercise.exhaleMs)} out
                              </span>
                              <span className="flex items-center gap-1">
                                <RotateCcw className="w-3 h-3" />
                                {exercise.breathsPerCycle} breaths × {exercise.cyclesTarget} cycles
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2 ml-4">
                            {added ? (
                              <button
                                onClick={() => {
                                  const userEx = userExercises.find(ue => ue.exerciseId === exercise.id)
                                  if (userEx) removeExercise(userEx.id)
                                }}
                                className="px-4 py-2 rounded-lg font-medium bg-red-600/20 hover:bg-red-600/40 text-red-300 transition-colors"
                              >
                                Remove
                              </button>
                            ) : (
                              <button
                                onClick={() => addExercise(exercise.id)}
                                className="px-4 py-2 rounded-lg font-medium bg-primary-600 hover:bg-primary-700 text-white transition-colors"
                              >
                                Add to My Protocols
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Training Tab */}
        {activeTab === "training" && (
          <div className="flex-1">
            {selectedExercise && (
              <div className="container mx-auto px-4 mb-4">
                <div className="max-w-3xl mx-auto bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-lg p-4 border border-primary-400/30 flex items-center justify-between">
                  <div>
                    <span className="text-gray-300 text-sm">Currently Training:</span>
                    <h4 className="text-white font-semibold">{selectedExercise.name}</h4>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedExercise(null)
                      setActiveTab("my-protocols")
                    }}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
            <BreathTrainingApp />
          </div>
        )}
      </div>
    </div>
  )
}
