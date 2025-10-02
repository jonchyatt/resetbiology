"use client"

import { useState } from "react"
import { Plus, Save, Trash2, Edit } from "lucide-react"

interface AdminPeptide {
  id?: string
  name: string
  purpose: string
  dosage: string
  timing: string
  frequency: string
  duration: string
  vialAmount: string
  reconstitution: string
  syringeUnits: number
  description?: string
  sideEffects?: string[]
  contraindications?: string[]
}

export default function AdminPeptidesPage() {
  const [peptides, setPeptides] = useState<AdminPeptide[]>([
    {
      id: "admin-1",
      name: "Ipamorelin",
      purpose: "Fat Loss",
      dosage: "300mcg",
      timing: "PM (or AM - your choice)",
      frequency: "5 days on, 2 days off",
      duration: "8-12 weeks",
      vialAmount: "10mg",
      reconstitution: "2ml BAC water",
      syringeUnits: 12,
      description: "Growth hormone secretagogue that stimulates natural GH release without affecting other hormones",
      sideEffects: ["Injection site irritation", "Mild fatigue"],
      contraindications: ["Pregnancy", "Active cancer"]
    },
    {
      id: "admin-2",
      name: "BPC-157",
      purpose: "Healing",
      dosage: "250-500mcg",
      timing: "AM/PM",
      frequency: "Daily",
      duration: "4-6 weeks",
      vialAmount: "10mg",
      reconstitution: "3ml BAC water",
      syringeUnits: 8,
      description: "Body Protection Compound - Promotes healing across various tissues, wound healing, and musculoskeletal recovery",
      sideEffects: ["Minimal - well tolerated"],
      contraindications: ["Active cancer", "Pregnancy"]
    },
    {
      id: "admin-3",
      name: "TB-500",
      purpose: "Recovery",
      dosage: "2.5mg",
      timing: "Twice weekly",
      frequency: "2x per week",
      duration: "4-8 weeks",
      vialAmount: "10mg",
      reconstitution: "2ml BAC water",
      syringeUnits: 25,
      description: "Thymosin Beta-4 fragment - Accelerates healing, reduces inflammation, increases flexibility",
      sideEffects: ["Head rush", "Mild lethargy"],
      contraindications: ["Active cancer"]
    },
    {
      id: "admin-4",
      name: "DSIP",
      purpose: "Other",
      dosage: "100-200mcg",
      timing: "Before meals",
      frequency: "Daily",
      duration: "2-4 weeks",
      vialAmount: "5mg",
      reconstitution: "2.5ml BAC water",
      syringeUnits: 5,
      description: "Delta Sleep-Inducing Peptide - Promotes deep restorative sleep and recovery",
      sideEffects: ["Drowsiness", "Vivid dreams"],
      contraindications: ["Sleep apnea", "Respiratory issues"]
    },
    {
      id: "admin-5",
      name: "Epithalon",
      purpose: "Anti-Aging",
      dosage: "5-10mg",
      timing: "AM",
      frequency: "Daily",
      duration: "10-20 days",
      vialAmount: "20mg",
      reconstitution: "2ml BAC water",
      syringeUnits: 25,
      description: "Anti-aging tetrapeptide - Influences telomere length and activates telomerase",
      sideEffects: ["Very minimal"],
      contraindications: ["Active cancer"]
    },
    {
      id: "admin-6",
      name: "GHK-Cu",
      purpose: "Anti-Aging",
      dosage: "1-2mg",
      timing: "AM",
      frequency: "Daily",
      duration: "3-4 weeks",
      vialAmount: "50mg",
      reconstitution: "5ml BAC water",
      syringeUnits: 10,
      description: "Copper peptide complex - Promotes collagen synthesis and skin regeneration",
      sideEffects: ["Temporary skin irritation"],
      contraindications: ["Copper sensitivity"]
    },
    {
      id: "admin-7",
      name: "MOTS-c",
      purpose: "Other",
      dosage: "10mg",
      timing: "AM",
      frequency: "3x per week",
      duration: "4-8 weeks",
      vialAmount: "10mg",
      reconstitution: "1ml BAC water",
      syringeUnits: 100,
      description: "Mitochondrial peptide - Enhances metabolic function and insulin sensitivity",
      sideEffects: ["Mild nausea", "Injection site reaction"],
      contraindications: ["Type 1 diabetes"]
    },
    {
      id: "admin-8",
      name: "5-Amino-1MQ",
      purpose: "Fat Loss",
      dosage: "50-150mg",
      timing: "AM",
      frequency: "Daily",
      duration: "8-12 weeks",
      vialAmount: "10mg",
      reconstitution: "Oral - no reconstitution",
      syringeUnits: 0,
      description: "NNMT inhibitor - Supports metabolic health and fat loss",
      sideEffects: ["Mild GI upset"],
      contraindications: ["Liver disease"]
    },
    {
      id: "admin-9",
      name: "HGH Fragment 176-191",
      purpose: "Fat Loss",
      dosage: "TBD - Add dosing later",
      timing: "TBD - Add timing later",
      frequency: "TBD - Add frequency later",
      duration: "TBD - Add duration later",
      vialAmount: "5mg",
      reconstitution: "TBD - Add reconstitution info",
      syringeUnits: 0,
      description: "Fragment of human growth hormone that stimulates fat metabolism and enhances lipolysis without affecting insulin sensitivity",
      sideEffects: ["TBD"],
      contraindications: ["TBD"]
    },
    {
      id: "admin-10",
      name: "Tesamorelin",
      purpose: "Fat Loss",
      dosage: "TBD - Add dosing later",
      timing: "TBD - Add timing later",
      frequency: "TBD - Add frequency later",
      duration: "TBD - Add duration later",
      vialAmount: "2mg",
      reconstitution: "TBD - Add reconstitution info",
      syringeUnits: 0,
      description: "GHRH analog that stimulates growth hormone release and effectively reduces visceral adipose tissue",
      sideEffects: ["TBD"],
      contraindications: ["TBD"]
    },
    {
      id: "admin-11",
      name: "CJC-1295 with DAC",
      purpose: "Anti-Aging",
      dosage: "TBD - Add dosing later",
      timing: "TBD - Add timing later",
      frequency: "TBD - Add frequency later",
      duration: "TBD - Add duration later",
      vialAmount: "2mg",
      reconstitution: "TBD - Add reconstitution info",
      syringeUnits: 0,
      description: "Long-acting GHRH analog that increases growth hormone and IGF-1 levels for extended periods",
      sideEffects: ["TBD"],
      contraindications: ["TBD"]
    },
    {
      id: "admin-12",
      name: "CJC-1295 without DAC",
      purpose: "Anti-Aging",
      dosage: "TBD - Add dosing later",
      timing: "TBD - Add timing later",
      frequency: "TBD - Add frequency later",
      duration: "TBD - Add duration later",
      vialAmount: "2mg",
      reconstitution: "TBD - Add reconstitution info",
      syringeUnits: 0,
      description: "Modified GHRH that stimulates growth hormone release with shorter duration of action",
      sideEffects: ["TBD"],
      contraindications: ["TBD"]
    },
    {
      id: "admin-13",
      name: "Kisspeptin-10",
      purpose: "Other",
      dosage: "TBD - Add dosing later",
      timing: "TBD - Add timing later",
      frequency: "TBD - Add frequency later",
      duration: "TBD - Add duration later",
      vialAmount: "5mg",
      reconstitution: "TBD - Add reconstitution info",
      syringeUnits: 0,
      description: "Neuropeptide that stimulates gonadotropin release and supports reproductive health and hormone regulation",
      sideEffects: ["TBD"],
      contraindications: ["TBD"]
    },
    {
      id: "admin-14",
      name: "Selank",
      purpose: "Cognitive",
      dosage: "TBD - Add dosing later",
      timing: "TBD - Add timing later",
      frequency: "TBD - Add frequency later",
      duration: "TBD - Add duration later",
      vialAmount: "5mg",
      reconstitution: "TBD - Add reconstitution info",
      syringeUnits: 0,
      description: "Anxiolytic peptide that enhances cognitive function, reduces anxiety, and supports stress management",
      sideEffects: ["TBD"],
      contraindications: ["TBD"]
    },
    {
      id: "admin-15",
      name: "Semax",
      purpose: "Cognitive",
      dosage: "TBD - Add dosing later",
      timing: "TBD - Add timing later",
      frequency: "TBD - Add frequency later",
      duration: "TBD - Add duration later",
      vialAmount: "5mg",
      reconstitution: "TBD - Add reconstitution info",
      syringeUnits: 0,
      description: "Nootropic peptide derived from ACTH that enhances cognitive performance, memory, and neuroprotection",
      sideEffects: ["TBD"],
      contraindications: ["TBD"]
    },
    {
      id: "admin-16",
      name: "PT-141 (Bremelanotide)",
      purpose: "Other",
      dosage: "TBD - Add dosing later",
      timing: "TBD - Add timing later",
      frequency: "TBD - Add frequency later",
      duration: "TBD - Add duration later",
      vialAmount: "10mg",
      reconstitution: "TBD - Add reconstitution info",
      syringeUnits: 0,
      description: "Melanocortin receptor agonist that enhances sexual arousal and libido in both men and women",
      sideEffects: ["TBD"],
      contraindications: ["TBD"]
    }
  ])

  const [editingPeptide, setEditingPeptide] = useState<AdminPeptide | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<AdminPeptide>({
    name: "",
    purpose: "",
    dosage: "",
    timing: "",
    frequency: "",
    duration: "",
    vialAmount: "",
    reconstitution: "",
    syringeUnits: 0,
    description: "",
    sideEffects: [],
    contraindications: []
  })

  const purposes = ["Fat Loss", "Muscle Building", "Recovery", "Anti-Aging", "Cognitive", "Healing", "Other"]
  const frequencies = ["Daily", "Every other day", "3x per week", "5 days on, 2 days off", "Custom cycle"]
  const timings = ["AM", "PM", "AM/PM", "Twice daily", "Before meals", "After meals", "Custom timing"]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (editingPeptide) {
      // Update existing peptide
      setPeptides(prev => prev.map(p => 
        p.id === editingPeptide.id ? { ...formData, id: editingPeptide.id } : p
      ))
    } else {
      // Add new peptide
      const newPeptide: AdminPeptide = {
        ...formData,
        id: `admin-${Date.now()}`
      }
      setPeptides(prev => [...prev, newPeptide])
    }
    
    resetForm()
  }

  const resetForm = () => {
    setFormData({
      name: "",
      purpose: "",
      dosage: "",
      timing: "",
      frequency: "",
      duration: "",
      vialAmount: "",
      reconstitution: "",
      syringeUnits: 0,
      description: "",
      sideEffects: [],
      contraindications: []
    })
    setEditingPeptide(null)
    setShowForm(false)
  }

  const editPeptide = (peptide: AdminPeptide) => {
    setFormData({ ...peptide })
    setEditingPeptide(peptide)
    setShowForm(true)
  }

  const deletePeptide = (id: string) => {
    if (confirm("Are you sure you want to delete this peptide?")) {
      setPeptides(prev => prev.filter(p => p.id !== id))
    }
  }

  const exportPeptides = () => {
    const dataStr = JSON.stringify(peptides, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    const exportFileDefaultName = 'peptides-export.json'
    
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
      <div className="relative z-10">
        <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 mb-8 shadow-xl hover:shadow-primary-400/20 transition-all duration-300">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">Admin: Peptide Management</h1>
              <p className="text-gray-300 mt-1">Add, edit, and manage peptides in the library</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={exportPeptides}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Save className="w-4 h-4" />
                Export
              </button>
              <button
                onClick={() => setShowForm(!showForm)}
                className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Peptide
              </button>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Form Section */}
          {showForm && (
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-teal-400/30 shadow-xl hover:shadow-teal-400/20 transition-all duration-300">
              <h2 className="text-xl font-bold text-white mb-6">
                {editingPeptide ? 'Edit Peptide' : 'Add New Peptide'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full bg-primary-600/10 backdrop-blur-sm border border-primary-400/30 rounded-lg px-3 py-2 text-white focus:border-primary-400 focus:outline-none placeholder-gray-400"
                      placeholder="e.g., Ipamorelin"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Purpose *</label>
                    <select
                      required
                      value={formData.purpose}
                      onChange={(e) => setFormData({...formData, purpose: e.target.value})}
                      className="w-full bg-primary-600/10 backdrop-blur-sm border border-primary-400/30 rounded-lg px-3 py-2 text-white focus:border-primary-400 focus:outline-none placeholder-gray-400"
                    >
                      <option value="">Select purpose...</option>
                      {purposes.map(purpose => (
                        <option key={purpose} value={purpose}>{purpose}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Dosage *</label>
                    <input
                      type="text"
                      required
                      value={formData.dosage}
                      onChange={(e) => setFormData({...formData, dosage: e.target.value})}
                      className="w-full bg-primary-600/10 backdrop-blur-sm border border-primary-400/30 rounded-lg px-3 py-2 text-white focus:border-primary-400 focus:outline-none placeholder-gray-400"
                      placeholder="e.g., 300mcg"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Timing *</label>
                    <select
                      required
                      value={formData.timing}
                      onChange={(e) => setFormData({...formData, timing: e.target.value})}
                      className="w-full bg-primary-600/10 backdrop-blur-sm border border-primary-400/30 rounded-lg px-3 py-2 text-white focus:border-primary-400 focus:outline-none placeholder-gray-400"
                    >
                      <option value="">Select timing...</option>
                      {timings.map(timing => (
                        <option key={timing} value={timing}>{timing}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Frequency *</label>
                    <select
                      required
                      value={formData.frequency}
                      onChange={(e) => setFormData({...formData, frequency: e.target.value})}
                      className="w-full bg-primary-600/10 backdrop-blur-sm border border-primary-400/30 rounded-lg px-3 py-2 text-white focus:border-primary-400 focus:outline-none placeholder-gray-400"
                    >
                      <option value="">Select frequency...</option>
                      {frequencies.map(freq => (
                        <option key={freq} value={freq}>{freq}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Duration *</label>
                    <input
                      type="text"
                      required
                      value={formData.duration}
                      onChange={(e) => setFormData({...formData, duration: e.target.value})}
                      className="w-full bg-primary-600/10 backdrop-blur-sm border border-primary-400/30 rounded-lg px-3 py-2 text-white focus:border-primary-400 focus:outline-none placeholder-gray-400"
                      placeholder="e.g., 8-12 weeks"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Vial Amount *</label>
                    <input
                      type="text"
                      required
                      value={formData.vialAmount}
                      onChange={(e) => setFormData({...formData, vialAmount: e.target.value})}
                      className="w-full bg-primary-600/10 backdrop-blur-sm border border-primary-400/30 rounded-lg px-3 py-2 text-white focus:border-primary-400 focus:outline-none placeholder-gray-400"
                      placeholder="e.g., 5mg"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Reconstitution *</label>
                    <input
                      type="text"
                      required
                      value={formData.reconstitution}
                      onChange={(e) => setFormData({...formData, reconstitution: e.target.value})}
                      className="w-full bg-primary-600/10 backdrop-blur-sm border border-primary-400/30 rounded-lg px-3 py-2 text-white focus:border-primary-400 focus:outline-none placeholder-gray-400"
                      placeholder="e.g., 2ml BAC"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Syringe Units *</label>
                    <input
                      type="number"
                      required
                      value={formData.syringeUnits}
                      onChange={(e) => setFormData({...formData, syringeUnits: parseInt(e.target.value)})}
                      className="w-full bg-primary-600/10 backdrop-blur-sm border border-primary-400/30 rounded-lg px-3 py-2 text-white focus:border-primary-400 focus:outline-none placeholder-gray-400"
                      placeholder="12"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                  <textarea
                    value={formData.description || ""}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full bg-primary-600/10 backdrop-blur-sm border border-primary-400/30 rounded-lg px-3 py-2 text-white focus:border-primary-400 focus:outline-none placeholder-gray-400"
                    placeholder="Brief description of the peptide and its effects"
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
                    className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    {editingPeptide ? 'Update Peptide' : 'Add Peptide'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Peptides List */}
          <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-blue-500/30 shadow-xl hover:shadow-blue-400/20 transition-all duration-300">
            <h2 className="text-xl font-bold text-white mb-6">Peptide Library ({peptides.length})</h2>
            
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {peptides.map((peptide) => {
                // Remove "- peptide" and "Package" suffix from display name
                const displayName = peptide.name
                  .replace(/\s*-\s*peptide\s*$/i, '')
                  .replace(/\s+Package\s*$/i, '')
                  .trim();

                return (
                  <div key={peptide.id} className="bg-gradient-to-br from-gray-700/60 to-gray-800/60 backdrop-blur-sm rounded-lg p-4 border border-primary-400/20 shadow-lg hover:shadow-primary-400/10 transition-all duration-300">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-white">{displayName}</h3>
                        <span className="text-sm text-primary-300 bg-primary-500/20 px-2 py-1 rounded-full">
                          {peptide.purpose}
                        </span>
                      </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => editPeptide(peptide)}
                        className="text-blue-400 hover:text-blue-300 p-1"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deletePeptide(peptide.id!)}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-300">
                    <div><strong>Dosage:</strong> {peptide.dosage}</div>
                    <div><strong>Timing:</strong> {peptide.timing}</div>
                    <div><strong>Frequency:</strong> {peptide.frequency}</div>
                    <div><strong>Duration:</strong> {peptide.duration}</div>
                  </div>
                  
                  {peptide.description && (
                    <p className="text-sm text-gray-400 mt-2">{peptide.description}</p>
                  )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}