"use client"

import { useState } from "react"
import { Plus, Save, Trash2, Edit, Dumbbell } from "lucide-react"

interface AdminExercise {
  id?: string
  name: string
  category: string
  muscle_groups: string[]
  equipment: string
  difficulty: string
  instructions: string
  form_cues?: string[]
  common_mistakes?: string[]
  variations?: string[]
}

interface AdminWorkoutProgram {
  id?: string
  name: string
  description: string
  duration_weeks: number
  sessions_per_week: number
  difficulty: string
  goals: string[]
  exercises: {
    exerciseId: string
    sets: number
    reps: string
    weight_guidance?: string
  }[]
}

export default function AdminWorkoutsPage() {
  const [activeTab, setActiveTab] = useState<'exercises' | 'programs'>('exercises')
  const [exercises, setExercises] = useState<AdminExercise[]>([
    // Example exercises
    {
      id: "ex-1",
      name: "Barbell Bench Press",
      category: "Chest",
      muscle_groups: ["Chest", "Triceps", "Shoulders"],
      equipment: "Barbell",
      difficulty: "Intermediate",
      instructions: "Lie on bench, grip barbell wider than shoulders, lower to chest, press up",
      form_cues: ["Retract shoulder blades", "Keep feet planted", "Control the negative"],
      common_mistakes: ["Bouncing off chest", "Flaring elbows too wide"],
      variations: ["Incline", "Decline", "Close-grip"]
    }
  ])

  const [programs, setPrograms] = useState<AdminWorkoutProgram[]>([
    {
      id: "prog-1",
      name: "Beginner Full Body",
      description: "3-day full body routine for beginners",
      duration_weeks: 8,
      sessions_per_week: 3,
      difficulty: "Beginner",
      goals: ["Strength", "Muscle Building"],
      exercises: [
        { exerciseId: "ex-1", sets: 3, reps: "8-10", weight_guidance: "Start light, focus on form" }
      ]
    }
  ])

  const [editingItem, setEditingItem] = useState<AdminExercise | AdminWorkoutProgram | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [exerciseFormData, setExerciseFormData] = useState<AdminExercise>({
    name: "",
    category: "",
    muscle_groups: [],
    equipment: "",
    difficulty: "",
    instructions: "",
    form_cues: [],
    common_mistakes: [],
    variations: []
  })

  const categories = ["Chest", "Back", "Shoulders", "Arms", "Legs", "Core", "Cardio", "Full Body"]
  const muscleGroups = ["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Quadriceps", "Hamstrings", "Glutes", "Calves", "Core"]
  const equipment = ["Bodyweight", "Barbell", "Dumbbell", "Cable", "Machine", "Kettlebell", "Resistance Band"]
  const difficulties = ["Beginner", "Intermediate", "Advanced"]

  const handleExerciseSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (editingItem && 'muscle_groups' in editingItem) {
      // Update existing exercise
      setExercises(prev => prev.map(ex => 
        ex.id === editingItem.id ? { ...exerciseFormData, id: editingItem.id } : ex
      ))
    } else {
      // Add new exercise
      const newExercise: AdminExercise = {
        ...exerciseFormData,
        id: `ex-${Date.now()}`
      }
      setExercises(prev => [...prev, newExercise])
    }
    
    resetForm()
  }

  const resetForm = () => {
    setExerciseFormData({
      name: "",
      category: "",
      muscle_groups: [],
      equipment: "",
      difficulty: "",
      instructions: "",
      form_cues: [],
      common_mistakes: [],
      variations: []
    })
    setEditingItem(null)
    setShowForm(false)
  }

  const editExercise = (exercise: AdminExercise) => {
    setExerciseFormData({ ...exercise })
    setEditingItem(exercise)
    setShowForm(true)
  }

  const deleteExercise = (id: string) => {
    if (confirm("Are you sure you want to delete this exercise?")) {
      setExercises(prev => prev.filter(ex => ex.id !== id))
    }
  }

  const exportData = () => {
    const data = { exercises, programs }
    const dataStr = JSON.stringify(data, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    const exportFileDefaultName = 'workout-data-export.json'
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative"
         style={{
           backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
           backgroundSize: 'cover',
           backgroundPosition: 'center',
           backgroundAttachment: 'fixed'
         }}>
      {/* Navigation Header */}
      <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm shadow-2xl border-b border-primary-400/30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <img src="/logo1.png" alt="Reset Biology" className="h-8 w-auto mr-3 drop-shadow-lg" />
              <div className="flex items-center">
                <h1 className="text-xl font-bold text-white drop-shadow-lg">Admin</h1>
                <span className="mx-2 text-primary-300">•</span>
                <span className="text-lg text-gray-200 drop-shadow-sm">Workout Management</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <a href="/admin" className="text-primary-300 hover:text-primary-200 font-medium text-sm transition-colors drop-shadow-sm">
                ← Back to Admin
              </a>
              <a href="/portal" className="text-primary-300 hover:text-primary-200 font-medium text-sm transition-colors drop-shadow-sm">
                ← Back to Portal
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10">
        <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-secondary-400/30 mb-8 shadow-xl hover:shadow-secondary-400/20 transition-all duration-300">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">Exercise & Program Library</h1>
              <p className="text-gray-300 mt-1">Manage exercises and workout programs</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={exportData}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Save className="w-4 h-4" />
                Export
              </button>
              <button
                onClick={() => setShowForm(!showForm)}
                className="bg-secondary-600 hover:bg-secondary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Exercise
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-8">
          <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-1 border border-secondary-400/30 shadow-xl hover:shadow-secondary-400/20 transition-all duration-300 shadow-xl">
            {(['exercises', 'programs'] as const).map((tab) => (
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

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Form Section */}
          {showForm && activeTab === 'exercises' && (
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-secondary-400/30 shadow-xl hover:shadow-secondary-400/20 transition-all duration-300">
              <h2 className="text-xl font-bold text-white mb-6">
                {editingItem ? 'Edit Exercise' : 'Add New Exercise'}
              </h2>
              
              <form onSubmit={handleExerciseSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Name *</label>
                    <input
                      type="text"
                      required
                      value={exerciseFormData.name}
                      onChange={(e) => setExerciseFormData({...exerciseFormData, name: e.target.value})}
                      className="w-full bg-primary-600/10 backdrop-blur-sm border border-primary-400/30 rounded-lg px-3 py-2 text-white focus:border-secondary-400 focus:outline-none placeholder-gray-400"
                      placeholder="e.g., Barbell Bench Press"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Category *</label>
                    <select
                      required
                      value={exerciseFormData.category}
                      onChange={(e) => setExerciseFormData({...exerciseFormData, category: e.target.value})}
                      className="w-full bg-primary-600/10 backdrop-blur-sm border border-primary-400/30 rounded-lg px-3 py-2 text-white focus:border-secondary-400 focus:outline-none placeholder-gray-400"
                    >
                      <option value="">Select category...</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Equipment *</label>
                    <select
                      required
                      value={exerciseFormData.equipment}
                      onChange={(e) => setExerciseFormData({...exerciseFormData, equipment: e.target.value})}
                      className="w-full bg-primary-600/10 backdrop-blur-sm border border-primary-400/30 rounded-lg px-3 py-2 text-white focus:border-secondary-400 focus:outline-none placeholder-gray-400"
                    >
                      <option value="">Select equipment...</option>
                      {equipment.map(eq => (
                        <option key={eq} value={eq}>{eq}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Difficulty *</label>
                    <select
                      required
                      value={exerciseFormData.difficulty}
                      onChange={(e) => setExerciseFormData({...exerciseFormData, difficulty: e.target.value})}
                      className="w-full bg-primary-600/10 backdrop-blur-sm border border-primary-400/30 rounded-lg px-3 py-2 text-white focus:border-secondary-400 focus:outline-none placeholder-gray-400"
                    >
                      <option value="">Select difficulty...</option>
                      {difficulties.map(diff => (
                        <option key={diff} value={diff}>{diff}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Instructions *</label>
                  <textarea
                    required
                    value={exerciseFormData.instructions}
                    onChange={(e) => setExerciseFormData({...exerciseFormData, instructions: e.target.value})}
                    className="w-full bg-primary-600/10 backdrop-blur-sm border border-primary-400/30 rounded-lg px-3 py-2 text-white focus:border-secondary-400 focus:outline-none placeholder-gray-400"
                    placeholder="Step-by-step exercise instructions"
                    rows={3}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-secondary-600 hover:bg-secondary-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    {editingItem ? 'Update Exercise' : 'Add Exercise'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Exercise List */}
          {activeTab === 'exercises' && (
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-secondary-400/30 shadow-xl hover:shadow-secondary-400/20 transition-all duration-300">
              <h2 className="text-xl font-bold text-white mb-6">Exercise Library ({exercises.length})</h2>
              
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {exercises.map((exercise) => (
                  <div key={exercise.id} className="bg-gradient-to-br from-gray-700/60 to-gray-800/60 backdrop-blur-sm rounded-lg p-4 border border-secondary-400/30 shadow-xl hover:shadow-secondary-400/20 transition-all duration-300">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-white">{exercise.name}</h3>
                        <div className="flex gap-2 mt-1">
                          <span className="text-xs text-secondary-300 bg-secondary-500/20 px-2 py-1 rounded-full">
                            {exercise.category}
                          </span>
                          <span className="text-xs text-gray-300 bg-gray-500/20 px-2 py-1 rounded-full">
                            {exercise.difficulty}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => editExercise(exercise)}
                          className="text-blue-400 hover:text-blue-300 p-1"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteExercise(exercise.id!)}
                          className="text-red-400 hover:text-red-300 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-300">
                      <div><strong>Equipment:</strong> {exercise.equipment}</div>
                      <div><strong>Muscles:</strong> {exercise.muscle_groups.join(", ")}</div>
                    </div>
                    
                    <p className="text-sm text-gray-400 mt-2">{exercise.instructions}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Programs Tab Content */}
          {activeTab === 'programs' && (
            <div className="lg:col-span-2">
              <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-secondary-400/30 shadow-xl hover:shadow-secondary-400/20 transition-all duration-300">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                  <Dumbbell className="w-5 h-5 mr-2 text-secondary-400" />
                  Workout Programs ({programs.length})
                </h2>
                
                <div className="space-y-4">
                  {programs.map((program) => (
                    <div key={program.id} className="bg-gradient-to-br from-gray-700/60 to-gray-800/60 backdrop-blur-sm rounded-lg p-4 border border-secondary-400/30 shadow-xl hover:shadow-secondary-400/20 transition-all duration-300">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-bold text-white">{program.name}</h3>
                          <p className="text-gray-300 text-sm mt-1">{program.description}</p>
                        </div>
                        <div className="flex gap-2">
                          <button className="text-blue-400 hover:text-blue-300 p-1">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button className="text-red-400 hover:text-red-300 p-1">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm text-gray-300 mb-3">
                        <div><strong>Duration:</strong> {program.duration_weeks} weeks</div>
                        <div><strong>Frequency:</strong> {program.sessions_per_week}x/week</div>
                        <div><strong>Level:</strong> {program.difficulty}</div>
                      </div>
                      
                      <div className="text-sm text-gray-400">
                        <strong>Goals:</strong> {program.goals.join(", ")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  )
}