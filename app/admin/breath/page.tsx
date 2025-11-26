"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Wind, Plus, Edit2, Trash2, Play, Pause, Music, Save, X, ChevronDown, ChevronUp } from "lucide-react"

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
  backgroundMusic: string | null
  musicVolume: number
  guidedAudio: string | null
  isSample: boolean
  isActive: boolean
  sortOrder: number
}

const CATEGORIES = [
  { value: 'relaxation', label: 'Relaxation', color: 'text-blue-400' },
  { value: 'energizing', label: 'Energizing', color: 'text-orange-400' },
  { value: 'vagal', label: 'Vagal Reset', color: 'text-teal-400' },
  { value: 'sample', label: 'Sample (Hero)', color: 'text-purple-400' },
]

const PRESET_MUSIC = [
  { value: '', label: 'No Music' },
  { value: '/audio/ambient-calm.mp3', label: 'Ambient Calm' },
  { value: '/audio/nature-sounds.mp3', label: 'Nature Sounds' },
  { value: '/audio/ocean-waves.mp3', label: 'Ocean Waves' },
  { value: '/audio/meditation-bells.mp3', label: 'Meditation Bells' },
]

const defaultExercise: Partial<BreathExercise> = {
  name: '',
  slug: '',
  description: '',
  category: 'relaxation',
  inhaleMs: 4000,
  exhaleMs: 4000,
  inhaleHoldMs: 0,
  exhaleHoldMs: 0,
  breathsPerCycle: 10,
  cyclesTarget: 3,
  postCycleExhaleHoldMs: 0,
  postCycleInhaleHoldMs: 0,
  backgroundMusic: null,
  musicVolume: 0.5,
  guidedAudio: null,
  isSample: false,
  isActive: true,
  sortOrder: 0
}

export default function AdminBreathPage() {
  const [exercises, setExercises] = useState<BreathExercise[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Partial<BreathExercise>>(defaultExercise)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Load exercises
  useEffect(() => {
    fetchExercises()
  }, [])

  const fetchExercises = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/breath/exercises?includeInactive=true')
      if (response.ok) {
        const data = await response.json()
        setExercises(data.exercises || [])
      } else {
        setError('Failed to load exercises')
      }
    } catch (err) {
      setError('Error loading exercises')
    } finally {
      setLoading(false)
    }
  }

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: prev.slug || generateSlug(name)
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const url = '/api/breath/exercises'
      const method = editingId ? 'PATCH' : 'POST'
      const body = editingId ? { id: editingId, ...formData } : formData

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (response.ok) {
        await fetchExercises()
        setShowForm(false)
        setEditingId(null)
        setFormData(defaultExercise)
      } else {
        setError(data.error || 'Failed to save exercise')
      }
    } catch (err) {
      setError('Error saving exercise')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (exercise: BreathExercise) => {
    setFormData(exercise)
    setEditingId(exercise.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this exercise?')) return

    try {
      const response = await fetch(`/api/breath/exercises?id=${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchExercises()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to delete exercise')
      }
    } catch (err) {
      setError('Error deleting exercise')
    }
  }

  const handleToggleActive = async (exercise: BreathExercise) => {
    try {
      const response = await fetch('/api/breath/exercises', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: exercise.id, isActive: !exercise.isActive })
      })

      if (response.ok) {
        await fetchExercises()
      }
    } catch (err) {
      setError('Error updating exercise')
    }
  }

  const formatMs = (ms: number) => {
    return (ms / 1000).toFixed(1) + 's'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative"
         style={{
           backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
           backgroundSize: 'cover',
           backgroundPosition: 'center',
           backgroundAttachment: 'fixed'
         }}>
      <div className="relative z-10">
        {/* Header */}
        <div className="text-center py-8">
          <div className="mb-4">
            <Link href="/admin" className="inline-flex items-center text-primary-300 hover:text-primary-200 font-medium text-sm transition-colors">
              ← Back to Admin
            </Link>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            <Wind className="inline-block w-10 h-10 text-teal-400 mr-3 mb-2" />
            Breath Exercise Manager
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Create and manage breathing exercises for your users
          </p>
        </div>

        <div className="container mx-auto px-4 pb-8 max-w-6xl">
          {error && (
            <div className="bg-red-500/20 border border-red-400/30 rounded-lg p-4 mb-6 text-red-200">
              {error}
              <button onClick={() => setError(null)} className="float-right">×</button>
            </div>
          )}

          {/* Add New Button */}
          {!showForm && (
            <button
              onClick={() => {
                setFormData(defaultExercise)
                setEditingId(null)
                setShowForm(true)
              }}
              className="mb-6 flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create New Exercise
            </button>
          )}

          {/* Exercise Form */}
          {showForm && (
            <div className="bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 border border-teal-400/30 mb-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">
                  {editingId ? 'Edit Exercise' : 'Create New Exercise'}
                </h2>
                <button
                  onClick={() => {
                    setShowForm(false)
                    setEditingId(null)
                    setFormData(defaultExercise)
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Name *</label>
                    <input
                      type="text"
                      value={formData.name || ''}
                      onChange={(e) => handleNameChange(e.target.value)}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-teal-400 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Slug *</label>
                    <input
                      type="text"
                      value={formData.slug || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-teal-400 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Description *</label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-teal-400 focus:outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Category *</label>
                    <select
                      value={formData.category || 'relaxation'}
                      onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-teal-400 focus:outline-none"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Sort Order</label>
                    <input
                      type="number"
                      value={formData.sortOrder || 0}
                      onChange={(e) => setFormData(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-teal-400 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-4 pt-6">
                    <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isActive ?? true}
                        onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                        className="w-4 h-4 rounded"
                      />
                      Active
                    </label>
                    <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isSample ?? false}
                        onChange={(e) => setFormData(prev => ({ ...prev, isSample: e.target.checked }))}
                        className="w-4 h-4 rounded"
                      />
                      Sample (Hero)
                    </label>
                  </div>
                </div>

                {/* Breathing Pattern */}
                <div className="border-t border-gray-600 pt-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Breathing Pattern</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Inhale (ms)</label>
                      <input
                        type="number"
                        value={formData.inhaleMs || 4000}
                        onChange={(e) => setFormData(prev => ({ ...prev, inhaleMs: parseInt(e.target.value) || 4000 }))}
                        className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-teal-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Exhale (ms)</label>
                      <input
                        type="number"
                        value={formData.exhaleMs || 4000}
                        onChange={(e) => setFormData(prev => ({ ...prev, exhaleMs: parseInt(e.target.value) || 4000 }))}
                        className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-teal-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Inhale Hold (ms)</label>
                      <input
                        type="number"
                        value={formData.inhaleHoldMs || 0}
                        onChange={(e) => setFormData(prev => ({ ...prev, inhaleHoldMs: parseInt(e.target.value) || 0 }))}
                        className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-teal-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Exhale Hold (ms)</label>
                      <input
                        type="number"
                        value={formData.exhaleHoldMs || 0}
                        onChange={(e) => setFormData(prev => ({ ...prev, exhaleHoldMs: parseInt(e.target.value) || 0 }))}
                        className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-teal-400 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Cycles */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Breaths/Cycle</label>
                    <input
                      type="number"
                      value={formData.breathsPerCycle || 10}
                      onChange={(e) => setFormData(prev => ({ ...prev, breathsPerCycle: parseInt(e.target.value) || 10 }))}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-teal-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Total Cycles</label>
                    <input
                      type="number"
                      value={formData.cyclesTarget || 3}
                      onChange={(e) => setFormData(prev => ({ ...prev, cyclesTarget: parseInt(e.target.value) || 3 }))}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-teal-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Post-Cycle Exhale Hold (ms)</label>
                    <input
                      type="number"
                      value={formData.postCycleExhaleHoldMs || 0}
                      onChange={(e) => setFormData(prev => ({ ...prev, postCycleExhaleHoldMs: parseInt(e.target.value) || 0 }))}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-teal-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Post-Cycle Inhale Hold (ms)</label>
                    <input
                      type="number"
                      value={formData.postCycleInhaleHoldMs || 0}
                      onChange={(e) => setFormData(prev => ({ ...prev, postCycleInhaleHoldMs: parseInt(e.target.value) || 0 }))}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-teal-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Audio Settings */}
                <div className="border-t border-gray-600 pt-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Music className="w-5 h-5 text-teal-400" />
                    Audio Settings
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Background Music</label>
                      <select
                        value={formData.backgroundMusic || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, backgroundMusic: e.target.value || null }))}
                        className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-teal-400 focus:outline-none"
                      >
                        {PRESET_MUSIC.map(music => (
                          <option key={music.value} value={music.value}>{music.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Music Volume ({Math.round((formData.musicVolume || 0.5) * 100)}%)</label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={formData.musicVolume || 0.5}
                        onChange={(e) => setFormData(prev => ({ ...prev, musicVolume: parseFloat(e.target.value) }))}
                        className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Custom Music URL</label>
                      <input
                        type="text"
                        value={formData.backgroundMusic || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, backgroundMusic: e.target.value || null }))}
                        placeholder="https://..."
                        className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-teal-400 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Submit */}
                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                  >
                    <Save className="w-5 h-5" />
                    {saving ? 'Saving...' : (editingId ? 'Update Exercise' : 'Create Exercise')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false)
                      setEditingId(null)
                      setFormData(defaultExercise)
                    }}
                    className="px-6 py-3 text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Exercise List */}
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-12 text-gray-400">Loading exercises...</div>
            ) : exercises.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Wind className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No exercises yet. Create your first one!</p>
              </div>
            ) : (
              exercises.map(exercise => (
                <div
                  key={exercise.id}
                  className={`bg-gray-800/80 backdrop-blur-sm rounded-xl p-4 border ${
                    exercise.isActive ? 'border-teal-400/30' : 'border-gray-600/30 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setExpandedId(expandedId === exercise.id ? null : exercise.id)}
                        className="text-gray-400 hover:text-white"
                      >
                        {expandedId === exercise.id ? <ChevronUp /> : <ChevronDown />}
                      </button>
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold text-white">{exercise.name}</h3>
                          <span className={`text-xs px-2 py-1 rounded ${
                            CATEGORIES.find(c => c.value === exercise.category)?.color || 'text-gray-400'
                          } bg-gray-700`}>
                            {CATEGORIES.find(c => c.value === exercise.category)?.label || exercise.category}
                          </span>
                          {exercise.isSample && (
                            <span className="text-xs px-2 py-1 rounded text-purple-400 bg-purple-500/20">
                              Hero Sample
                            </span>
                          )}
                          {!exercise.isActive && (
                            <span className="text-xs px-2 py-1 rounded text-red-400 bg-red-500/20">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400">{exercise.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleActive(exercise)}
                        className={`p-2 rounded-lg transition-colors ${
                          exercise.isActive
                            ? 'text-green-400 hover:bg-green-500/20'
                            : 'text-gray-400 hover:bg-gray-700'
                        }`}
                        title={exercise.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {exercise.isActive ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                      </button>
                      <button
                        onClick={() => handleEdit(exercise)}
                        className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(exercise.id)}
                        className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedId === exercise.id && (
                    <div className="mt-4 pt-4 border-t border-gray-700 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Inhale:</span>
                        <span className="text-white ml-2">{formatMs(exercise.inhaleMs)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Exhale:</span>
                        <span className="text-white ml-2">{formatMs(exercise.exhaleMs)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Inhale Hold:</span>
                        <span className="text-white ml-2">{formatMs(exercise.inhaleHoldMs)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Exhale Hold:</span>
                        <span className="text-white ml-2">{formatMs(exercise.exhaleHoldMs)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Breaths/Cycle:</span>
                        <span className="text-white ml-2">{exercise.breathsPerCycle}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Cycles:</span>
                        <span className="text-white ml-2">{exercise.cyclesTarget}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Music:</span>
                        <span className="text-white ml-2">{exercise.backgroundMusic ? 'Yes' : 'None'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Slug:</span>
                        <span className="text-teal-300 ml-2">{exercise.slug}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
