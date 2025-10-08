"use client"

import { useState, useEffect } from "react"
import { Plus, Save, Trash2, Edit } from "lucide-react"
import { AdminHeader } from "@/components/Navigation/AdminHeader"

interface AdminPeptide {
  id?: string
  name: string
  purpose: string | string[]  // Support both for backwards compatibility
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
  const [peptides, setPeptides] = useState<AdminPeptide[]>([])
  const [initialPeptides] = useState<AdminPeptide[]>([
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
  const [backupData, setBackupData] = useState<AdminPeptide[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [importMode, setImportMode] = useState(false)
  const [formData, setFormData] = useState<AdminPeptide>({
    name: "",
    purpose: [],
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

  const purposes = ["Fat Loss", "Muscle Building", "Recovery", "Anti-Aging", "Cognitive", "Healing", "Longevity", "Immunity", "Cognitive Enhancement", "Other"]
  const frequencies = ["Daily", "Every other day", "Every Day", "3x per week", "2x per week", "5 days on, 2 days off", "Once per week", "Custom cycle"]
  const timings = ["AM", "PM", "AM/PM", "Twice daily", "Before meals", "After meals", "Custom timing"]

  // Fetch peptides from database on mount
  useEffect(() => {
    const fetchPeptides = async () => {
      try {
        const response = await fetch('/api/peptides')
        const data = await response.json()
        if (data.success && data.data && data.data.length > 0) {
          // Transform database format to admin format
          const transformed = data.data.map((p: any) => ({
            id: p.id,
            name: p.name,
            purpose: p.category || 'Other',
            dosage: p.dosage || '',
            timing: 'AM', // Default, not stored in DB
            frequency: 'Daily', // Default, not stored in DB
            duration: '', // Not stored in DB
            vialAmount: '', // Not stored in DB
            reconstitution: p.reconstitution || '',
            syringeUnits: 0,
            description: p.description || ''
          }))
          setPeptides(transformed)
        } else {
          // If database is empty, use initial hardcoded peptides
          console.log('No peptides in database, using initial set')
          setPeptides(initialPeptides)
        }
      } catch (error) {
        console.error('Error fetching peptides:', error)
        setPeptides(initialPeptides)
      }
    }
    fetchPeptides()
  }, [initialPeptides])

  // New peptides from PEPTIDEHUNT screenshots
  const peptidesFromScreenshots = [
    {
      name: "AOD-9604",
      purpose: "Fat Loss",
      dosage: "300mcg",
      timing: "AM",
      frequency: "5 days on, 2 days off",
      duration: "8 weeks on, 8 weeks off",
      vialAmount: "5mg",
      reconstitution: "2ml BAC water",
      syringeUnits: 11,
      description: "Fragment 177-191 of human growth hormone - promotes fat metabolism without affecting blood sugar or tissue growth"
    },
    {
      name: "Semaglutide",
      purpose: "Fat Loss",
      dosage: "250mcg",
      timing: "AM",
      frequency: "Once per week",
      duration: "8 weeks on, 8 weeks off",
      vialAmount: "3mg",
      reconstitution: "2ml BAC water",
      syringeUnits: 17,
      description: "GLP-1 receptor agonist - reduces appetite, slows gastric emptying, improves insulin sensitivity"
    },
    {
      name: "Tirzepatide",
      purpose: "Fat Loss",
      dosage: "0.5mg",
      timing: "AM",
      frequency: "3x per week",
      duration: "8 weeks on, 8 weeks off or until goal weight is reached",
      vialAmount: "10mg",
      reconstitution: "2ml BAC water",
      syringeUnits: 10,
      description: "Dual GIP and GLP-1 receptor agonist - powerful appetite suppression and metabolic improvement"
    },
    {
      name: "Retatrutide",
      purpose: "Fat Loss",
      dosage: "0.5mg",
      timing: "AM",
      frequency: "3x per week",
      duration: "8 weeks on, 8 weeks off or until goal weight is reached",
      vialAmount: "10mg",
      reconstitution: "2ml BAC water",
      syringeUnits: 10,
      description: "Triple agonist (GLP-1, GIP, and glucagon) - next generation weight loss peptide"
    },
    {
      name: "Ipamorelin/CJC-1295 No DAC",
      purpose: "Fat Loss",
      dosage: "250mcg/250mcg",
      timing: "AM/PM",
      frequency: "5 days on, 2 days off",
      duration: "8 weeks on, 8 weeks off",
      vialAmount: "5mg/5mg",
      reconstitution: "2ml BAC water",
      syringeUnits: 10,
      description: "Combined GHRP and GHRH - synergistic growth hormone release for fat loss and anti-aging"
    },
    {
      name: "CJC-1295 No DAC",
      purpose: "Longevity",
      dosage: "200mcg",
      timing: "PM",
      frequency: "5 days on, 2 days off",
      duration: "8 weeks on, 8 weeks off",
      vialAmount: "10mg",
      reconstitution: "3ml BAC water",
      syringeUnits: 6,
      description: "Modified GHRH (Mod GRF 1-29) - stimulates natural growth hormone pulses"
    },
    {
      name: "Epitalon",
      purpose: "Longevity",
      dosage: "2mg",
      timing: "PM",
      frequency: "Every day",
      duration: "20 days in a row, 3x per year",
      vialAmount: "20mg",
      reconstitution: "2ml BAC water",
      syringeUnits: 20,
      description: "Telomerase activator - extends telomeres and cellular lifespan"
    },
    {
      name: "Thymalin",
      purpose: "Longevity",
      dosage: "2mg",
      timing: "PM",
      frequency: "Every day",
      duration: "20 days in a row, 3x per year",
      vialAmount: "20mg",
      reconstitution: "2ml BAC water",
      syringeUnits: 20,
      description: "Thymus extract - immune system restoration and anti-aging"
    },
    {
      name: "Melanotan 1",
      purpose: "Cognitive Enhancement",
      dosage: "250mcg",
      timing: "AM",
      frequency: "2 days per week",
      duration: "8 weeks on, 8 weeks off",
      vialAmount: "10mg",
      reconstitution: "2ml BAC water",
      syringeUnits: 5,
      description: "Alpha-MSH analog - neuroprotective, cognitive enhancement, and melanin production"
    },
    {
      name: "Thymosin-Alpha 1",
      purpose: "Immunity",
      dosage: "1.5mg",
      timing: "AM",
      frequency: "5 days on, 2 days off",
      duration: "8 weeks on, 8 weeks off",
      vialAmount: "10mg",
      reconstitution: "2ml BAC water",
      syringeUnits: 30,
      description: "Immune modulator - enhances T-cell function and immune response"
    },
    {
      name: "LL-37",
      purpose: "Immunity",
      dosage: "125mcg",
      timing: "AM",
      frequency: "Every day",
      duration: "50 days straight, 4 weeks off",
      vialAmount: "5mg",
      reconstitution: "2ml BAC water",
      syringeUnits: 5,
      description: "Antimicrobial peptide - broad spectrum antimicrobial and immunomodulatory effects"
    }
  ]

  // Safety feature: Check for duplicates with different protocols
  const checkForDuplicates = (peptideName: string) => {
    const existing = peptides.filter(p => 
      p.name.toLowerCase() === peptideName.toLowerCase()
    )
    if (existing.length > 0) {
      const protocols = existing.map(p => `${p.dosage} - ${p.frequency}`)
      return { 
        exists: true, 
        protocols,
        message: `Found ${existing.length} existing protocol(s) for ${peptideName}`
      }
    }
    return { exists: false, protocols: [], message: '' }
  }

  // Safety feature: Create backup before major changes
  const createBackup = () => {
    setBackupData([...peptides])
    alert("Backup created successfully!")
  }

  // Safety feature: Restore from backup
  const restoreFromBackup = () => {
    if (backupData.length === 0) {
      alert("No backup available!")
      return
    }
    if (confirm("Are you sure you want to restore from backup? Current changes will be lost.")) {
      setPeptides([...backupData])
      alert("Data restored from backup!")
    }
  }

  // Import peptides from screenshots
  const importFromScreenshots = async () => {
    setImportMode(true)
    const newPeptides: AdminPeptide[] = []

    peptidesFromScreenshots.forEach(peptide => {
      const duplicate = checkForDuplicates(peptide.name)

      // Allow import if it's a different protocol or completely new
      if (!duplicate.exists ||
          !duplicate.protocols.includes(`${peptide.dosage} - ${peptide.frequency}`)) {
        newPeptides.push({
          ...peptide,
          id: `admin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        })
      }
    })

    if (newPeptides.length > 0) {
      if (confirm(`Import ${newPeptides.length} new peptide protocols?\n\nPeptides to import:\n${newPeptides.map(p => `• ${p.name} (${p.dosage})`).join('\n')}`)) {
        createBackup() // Auto-backup before import

        // Save each peptide to database
        const savedPeptides: AdminPeptide[] = []
        for (const peptide of newPeptides) {
          try {
            const response = await fetch('/api/peptides', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: peptide.name,
                dosage: peptide.dosage,
                reconstitution: peptide.reconstitution,
                category: peptide.purpose,
                purpose: peptide.purpose,
                price: 0
              })
            })

            if (response.ok) {
              const data = await response.json()
              savedPeptides.push({ ...peptide, id: data.peptide.id })
            }
          } catch (error) {
            console.error(`Failed to import ${peptide.name}:`, error)
          }
        }

        setPeptides(prev => [...prev, ...savedPeptides])
        alert(`Successfully imported ${savedPeptides.length} peptide protocols to database!`)
      }
    } else {
      alert("All peptides from screenshots already exist with the same protocols!")
    }
    setImportMode(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate that at least one purpose is selected
    const purposeArray = Array.isArray(formData.purpose) ? formData.purpose : [formData.purpose].filter(Boolean);
    if (purposeArray.length === 0) {
      alert('Please select at least one purpose for the peptide');
      return;
    }

    // Check for duplicates
    const duplicate = checkForDuplicates(formData.name)
    if (duplicate.exists && !editingPeptide) {
      const proceed = confirm(
        `${duplicate.message}\n\nExisting protocols:\n${duplicate.protocols.map(p => `• ${p}`).join('\n')}\n\nDo you want to add this as a new protocol?`
      )
      if (!proceed) return
    }

    // Convert purpose array to string for database (use first purpose as primary category)
    const primaryPurpose = purposeArray[0];
    const allPurposes = purposeArray.join(', ');

    try {
      if (editingPeptide) {
        // Update existing peptide in database
        const response = await fetch(`/api/peptides?id=${editingPeptide.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            dosage: formData.dosage,
            reconstitution: formData.reconstitution,
            category: primaryPurpose,
            price: 0
          })
        })

        if (!response.ok) throw new Error('Failed to update peptide')

        const data = await response.json()

        // Update local state (keep purposes as array)
        setPeptides(prev => prev.map(p =>
          p.id === editingPeptide.id ? { ...formData, id: editingPeptide.id } : p
        ))
        alert('Peptide updated successfully!')
      } else {
        // Add new peptide to database
        const response = await fetch('/api/peptides', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            dosage: formData.dosage,
            reconstitution: formData.reconstitution,
            category: primaryPurpose,
            purpose: primaryPurpose,
            price: 0
          })
        })

        if (!response.ok) throw new Error('Failed to create peptide')

        const data = await response.json()

        // Add to local state with database ID (keep purposes as array)
        const newPeptide: AdminPeptide = {
          ...formData,
          id: data.peptide.id
        }
        setPeptides(prev => [...prev, newPeptide])
        alert('Peptide added successfully!')
      }
    } catch (error) {
      console.error('Error saving peptide:', error)
      alert('Failed to save peptide. Please try again.')
      return
    }

    resetForm()
  }

  const resetForm = () => {
    setFormData({
      name: "",
      purpose: [],
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
    // Ensure purpose is an array for editing
    const editData = {
      ...peptide,
      purpose: Array.isArray(peptide.purpose) ? peptide.purpose : [peptide.purpose].filter(Boolean)
    };
    setFormData(editData)
    setEditingPeptide(peptide)
    setShowForm(true)
  }

  const deletePeptide = async (id: string) => {
    if (!confirm("Are you sure you want to delete this peptide?")) return

    try {
      const response = await fetch(`/api/peptides?id=${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete peptide')

      // Remove from local state
      setPeptides(prev => prev.filter(p => p.id !== id))
      alert('Peptide deleted successfully!')
    } catch (error) {
      console.error('Error deleting peptide:', error)
      alert('Failed to delete peptide. Please try again.')
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
      <AdminHeader section="Peptide Management" subtitle="Add, edit, and manage peptides in the library" />
      <div className="relative z-10">
        <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 mb-8 shadow-xl hover:shadow-primary-400/20 transition-all duration-300">
          <div className="flex justify-between items-center">
            <div className="flex-1"></div>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={importFromScreenshots}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                title="Import peptides from PEPTIDEHUNT screenshots"
              >
                <Plus className="w-4 h-4" />
                Import New
              </button>
              <button
                onClick={createBackup}
                className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                title="Create backup of current data"
              >
                <Save className="w-4 h-4" />
                Backup
              </button>
              {backupData.length > 0 && (
                <button
                  onClick={restoreFromBackup}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                  title="Restore from last backup"
                >
                  <Save className="w-4 h-4" />
                  Restore
                </button>
              )}
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
                Add Manual
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
                    <label className="block text-sm font-medium text-gray-300 mb-2">Purpose * (select all that apply)</label>
                    <div className="bg-gray-900 border border-primary-400/30 rounded-lg px-3 py-2 max-h-48 overflow-y-auto">
                      <div className="grid grid-cols-2 gap-2">
                        {purposes.map(purpose => {
                          const purposeArray = Array.isArray(formData.purpose) ? formData.purpose : [formData.purpose].filter(Boolean);
                          return (
                            <label key={purpose} className="flex items-center cursor-pointer hover:bg-primary-500/10 rounded px-2 py-1">
                              <input
                                type="checkbox"
                                checked={purposeArray.includes(purpose)}
                                onChange={(e) => {
                                  const currentPurposes = Array.isArray(formData.purpose) ? formData.purpose : [formData.purpose].filter(Boolean);
                                  if (e.target.checked) {
                                    setFormData({...formData, purpose: [...currentPurposes, purpose]});
                                  } else {
                                    setFormData({...formData, purpose: currentPurposes.filter(p => p !== purpose)});
                                  }
                                }}
                                className="mr-2 rounded border-gray-600 bg-gray-800 text-primary-600 focus:ring-primary-400"
                              />
                              <span className="text-white text-sm">{purpose}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    {Array.isArray(formData.purpose) && formData.purpose.length === 0 && (
                      <p className="text-xs text-red-400 mt-1">Please select at least one purpose</p>
                    )}
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
                      className="w-full bg-gray-900 border border-primary-400/30 rounded-lg px-3 py-2 text-white focus:border-primary-400 focus:outline-none [&>option]:bg-gray-900 [&>option]:text-white"
                    >
                      <option value="" className="text-gray-400">Select timing...</option>
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
                      className="w-full bg-gray-900 border border-primary-400/30 rounded-lg px-3 py-2 text-white focus:border-primary-400 focus:outline-none [&>option]:bg-gray-900 [&>option]:text-white"
                    >
                      <option value="" className="text-gray-400">Select frequency...</option>
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
            <h2 className="text-xl font-bold text-white mb-6">
              Peptide Library ({peptides.length} protocols)
            </h2>
            
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mb-4 text-sm">
              <div className="bg-primary-600/20 rounded-lg p-2 text-center">
                <div className="text-primary-300 font-bold">{new Set(peptides.map(p => p.name)).size}</div>
                <div className="text-gray-400 text-xs">Unique Peptides</div>
              </div>
              <div className="bg-secondary-600/20 rounded-lg p-2 text-center">
                <div className="text-secondary-300 font-bold">{peptides.length}</div>
                <div className="text-gray-400 text-xs">Total Protocols</div>
              </div>
              <div className="bg-amber-600/20 rounded-lg p-2 text-center">
                <div className="text-amber-300 font-bold">{backupData.length > 0 ? '✓' : '✗'}</div>
                <div className="text-gray-400 text-xs">Backup</div>
              </div>
            </div>
            
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {peptides.map((peptide) => {
                const duplicateCount = peptides.filter(p => p.name === peptide.name).length
                return (
                  <div key={peptide.id} className="bg-gradient-to-br from-gray-700/60 to-gray-800/60 backdrop-blur-sm rounded-lg p-4 border border-primary-400/20 shadow-lg hover:shadow-primary-400/10 transition-all duration-300">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-white">
                          {peptide.name}
                          {duplicateCount > 1 && (
                            <span className="ml-2 text-xs text-amber-400 bg-amber-600/20 px-2 py-1 rounded-full">
                              {duplicateCount} protocols
                            </span>
                          )}
                        </h3>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(Array.isArray(peptide.purpose) ? peptide.purpose : [peptide.purpose]).map((purpose, idx) => (
                            <span key={idx} className="text-xs text-primary-300 bg-primary-500/20 px-2 py-1 rounded-full">
                              {purpose}
                            </span>
                          ))}
                        </div>
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
              )
              })}
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}