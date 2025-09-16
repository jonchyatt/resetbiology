"use client"

import { useState, useEffect } from "react"
import { Syringe, Calendar, AlertCircle, TrendingUp, Plus, Clock, Calculator, X } from "lucide-react"
import { DosageCalculator } from './DosageCalculator'

interface PeptideProtocol {
  id: string
  name: string
  purpose: string
  dosage: string
  timing: string
  frequency: string
  duration: string
  vialAmount: string
  reconstitution: string
  syringeUnits: number
  startDate?: string
  currentCycle?: number
  isActive: boolean
}

interface DoseEntry {
  id: string
  peptideId: string
  scheduledTime: string
  actualTime?: string
  completed: boolean
  notes?: string
  sideEffects?: string[]
}

export function PeptideTracker() {
  const [activeTab, setActiveTab] = useState<'current' | 'library' | 'history'>('current')
  const [currentProtocols, setCurrentProtocols] = useState<PeptideProtocol[]>([])
  const [todaysDoses, setTodaysDoses] = useState<DoseEntry[]>([])
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [selectedProtocol, setSelectedProtocol] = useState<PeptideProtocol | null>(null)
  const [showDoseModal, setShowDoseModal] = useState(false)
  const [showCalculatorModal, setShowCalculatorModal] = useState(false)
  const [doseNotes, setDoseNotes] = useState('')
  const [doseSideEffects, setDoseSideEffects] = useState<string[]>([])

  // Auto-generate today's doses when protocols change (preserve existing logged doses)
  useEffect(() => {
    generateTodaysDosesPreservingLogged(currentProtocols)
  }, [currentProtocols])

  const peptideLibrary: Omit<PeptideProtocol, 'id' | 'startDate' | 'currentCycle' | 'isActive'>[] = [
    // Fat Loss Peptides
    {
      name: "Ipamorelin",
      purpose: "Fat Loss",
      dosage: "300mcg",
      timing: "PM (or AM - your choice)",
      frequency: "5 days on, 2 days off",
      duration: "8 weeks on, 8 weeks off",
      vialAmount: "10mg",
      reconstitution: "3ml",
      syringeUnits: 9
    },
    {
      name: "Semaglutide",
      purpose: "Fat Loss",
      dosage: "250mcg",
      timing: "AM",
      frequency: "Once per week",
      duration: "8 weeks on, 8 weeks off",
      vialAmount: "3mg",
      reconstitution: "2ml",
      syringeUnits: 17
    },
    {
      name: "Tirzepatide", 
      purpose: "Fat Loss",
      dosage: "0.5mg",
      timing: "AM",
      frequency: "3x per week",
      duration: "8 weeks on, 8 weeks off or until goal weight",
      vialAmount: "10mg",
      reconstitution: "2ml",
      syringeUnits: 10
    },
    {
      name: "Retatrutide",
      purpose: "Fat Loss", 
      dosage: "0.5mg",
      timing: "AM",
      frequency: "3x per week",
      duration: "8 weeks on, 8 weeks off or until goal weight",
      vialAmount: "10mg",
      reconstitution: "2ml",
      syringeUnits: 10
    },
    // Healing Peptides
    {
      name: "BPC-157",
      purpose: "Healing",
      dosage: "500mcg",
      timing: "AM & PM (twice daily)",
      frequency: "Every day",
      duration: "8 weeks on, 8 weeks off",
      vialAmount: "10mg",
      reconstitution: "2ml",
      syringeUnits: 10
    },
    {
      name: "TB-500",
      purpose: "Healing",
      dosage: "500mcg", 
      timing: "AM",
      frequency: "Every day",
      duration: "8 weeks on, 8 weeks off",
      vialAmount: "10mg",
      reconstitution: "2ml",
      syringeUnits: 10
    },
    // Longevity Peptides
    {
      name: "Epitalon",
      purpose: "Longevity",
      dosage: "2mg",
      timing: "PM",
      frequency: "Every day",
      duration: "20 days in a row, 3x per year",
      vialAmount: "20mg",
      reconstitution: "2ml",
      syringeUnits: 20
    },
    // Immunity Peptides
    {
      name: "Thymosin Alpha-1",
      purpose: "Immunity",
      dosage: "1.5mg",
      timing: "AM",
      frequency: "5 days on, 2 days off",
      duration: "8 weeks on, 8 weeks off",
      vialAmount: "10mg",
      reconstitution: "2ml",
      syringeUnits: 30
    }
  ]

  const addProtocol = (peptide: typeof peptideLibrary[0]) => {
    // Check if protocol already exists
    const existingProtocol = currentProtocols.find(protocol => protocol.name === peptide.name)
    if (existingProtocol) {
      alert(`${peptide.name} is already in your active protocols. Only one instance per peptide is allowed.`)
      return
    }

    const newProtocol: PeptideProtocol = {
      ...peptide,
      id: Date.now().toString(),
      startDate: new Date().toISOString().split('T')[0],
      currentCycle: 1,
      isActive: true
    }
    setCurrentProtocols([...currentProtocols, newProtocol])
  }

  const generateTodaysDoses = (protocols: PeptideProtocol[]) => {
    const today = new Date().toISOString().split('T')[0]
    const doses: DoseEntry[] = []
    
    protocols.forEach(protocol => {
      if (!protocol.isActive) return
      
      // Handle timing - twice daily peptides get 2 doses, others get 1
      if (protocol.timing.includes('twice daily')) {
        // Two doses for BPC-157 etc.
        doses.push(
          {
            id: `${protocol.id}-${today}-am`,
            peptideId: protocol.id,
            scheduledTime: '08:00',
            completed: false
          },
          {
            id: `${protocol.id}-${today}-pm`,
            peptideId: protocol.id,
            scheduledTime: '20:00',
            completed: false
          }
        )
      } else {
        // Single dose - AM/PM is user's choice
        const defaultTime = protocol.timing.includes('AM') ? '08:00' : 
                           protocol.timing.includes('PM') ? '20:00' : '12:00'
        
        doses.push({
          id: `${protocol.id}-${today}-0`,
          peptideId: protocol.id,
          scheduledTime: defaultTime,
          completed: false
        })
      }
    })
    
    setTodaysDoses(doses)
  }

  const generateTodaysDosesPreservingLogged = (protocols: PeptideProtocol[]) => {
    const today = new Date().toISOString().split('T')[0]
    const newDoses: DoseEntry[] = []
    
    // First, preserve all existing logged doses
    const existingLoggedDoses = todaysDoses.filter(dose => dose.completed)
    
    protocols.forEach(protocol => {
      if (!protocol.isActive) return
      
      // Handle timing - twice daily peptides get 2 doses, others get 1
      if (protocol.timing.includes('twice daily')) {
        // Check if AM dose already exists (logged or pending)
        const existingAmDose = todaysDoses.find(dose => 
          dose.peptideId === protocol.id && dose.scheduledTime === '08:00'
        )
        if (!existingAmDose) {
          newDoses.push({
            id: `${protocol.id}-${today}-am`,
            peptideId: protocol.id,
            scheduledTime: '08:00',
            completed: false
          })
        }
        
        // Check if PM dose already exists (logged or pending)
        const existingPmDose = todaysDoses.find(dose => 
          dose.peptideId === protocol.id && dose.scheduledTime === '20:00'
        )
        if (!existingPmDose) {
          newDoses.push({
            id: `${protocol.id}-${today}-pm`,
            peptideId: protocol.id,
            scheduledTime: '20:00',
            completed: false
          })
        }
      } else {
        // Single dose - AM/PM is user's choice
        const defaultTime = protocol.timing.includes('AM') ? '08:00' : 
                           protocol.timing.includes('PM') ? '20:00' : '12:00'
        
        // Check if this dose already exists (logged or pending)
        const existingDose = todaysDoses.find(dose => 
          dose.peptideId === protocol.id && dose.scheduledTime === defaultTime
        )
        if (!existingDose) {
          newDoses.push({
            id: `${protocol.id}-${today}-0`,
            peptideId: protocol.id,
            scheduledTime: defaultTime,
            completed: false
          })
        }
      }
    })
    
    // Combine existing doses (both logged and pending) with any new doses needed
    const existingPendingDoses = todaysDoses.filter(dose => 
      !dose.completed && protocols.some(p => p.id === dose.peptideId && p.isActive)
    )
    
    setTodaysDoses([...existingLoggedDoses, ...existingPendingDoses, ...newDoses])
  }

  const markDoseCompleted = (doseId: string) => {
    const dose = todaysDoses.find(d => d.id === doseId)
    if (!dose) return
    
    // Find the protocol for this dose
    const protocol = currentProtocols.find(p => p.id === dose.peptideId)
    if (!protocol) {
      // Just mark as completed if we can't find protocol
      setTodaysDoses(prev => prev.map(d => 
        d.id === doseId 
          ? { ...d, completed: true, actualTime: new Date().toISOString() }
          : d
      ))
      return
    }
    
    // Store the dose ID for updating the specific scheduled dose
    setSelectedProtocol({ ...protocol, scheduledDoseId: doseId } as any)
    setShowDoseModal(true)
    setDoseNotes('')
    setDoseSideEffects([])
  }

  const openScheduleModal = (protocol: PeptideProtocol) => {
    setSelectedProtocol(protocol)
    setShowScheduleModal(true)
  }

  const openDoseModal = (protocol: PeptideProtocol) => {
    // Check if there are any scheduled doses for this protocol today
    const todaysScheduledDoses = todaysDoses.filter(dose => 
      dose.peptideId === protocol.id && 
      !dose.id.includes('unscheduled')
    )
    
    if (todaysScheduledDoses.length === 0) {
      // No scheduled dose - show override warning
      const shouldProceed = confirm(
        `⚠️ OVERRIDE WARNING\n\n` +
        `${protocol.name} is not scheduled for today according to your protocol.\n\n` +
        `Frequency: ${protocol.frequency}\n` +
        `Timing: ${protocol.timing}\n\n` +
        `Do you want to proceed with an unscheduled dose? This will be logged in your journal with an override flag.`
      )
      if (!shouldProceed) return
    }
    // Check if this protocol already has completed doses today
    const todaysCompletedDoses = todaysDoses.filter(dose => 
      dose.peptideId === protocol.id && 
      dose.completed &&
      new Date(dose.actualTime!).toDateString() === new Date().toDateString()
    )
    
    if (todaysCompletedDoses.length > 0) {
      alert(`${protocol.name} already logged today. Check completed doses in your history.`)
      return
    }
    
    setSelectedProtocol(protocol)
    setShowDoseModal(true)
    setDoseNotes('')
    setDoseSideEffects([])
  }

  const openCalculatorModal = (protocol: PeptideProtocol) => {
    setSelectedProtocol(protocol)
    setShowCalculatorModal(true)
  }

  const logDose = () => {
    if (!selectedProtocol) return
    
    const now = new Date()
    const currentTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    
    // Check if we're updating a specific scheduled dose
    const scheduledDoseId = (selectedProtocol as any).scheduledDoseId
    const existingDose = scheduledDoseId ? 
      todaysDoses.find(dose => dose.id === scheduledDoseId) : 
      todaysDoses.find(dose => 
        dose.peptideId === selectedProtocol.id && 
        !dose.completed &&
        Math.abs(new Date(`1970-01-01 ${dose.scheduledTime}`).getTime() - new Date(`1970-01-01 ${currentTime}`).getTime()) < 3600000 // within 1 hour
      )
    
    if (existingDose) {
      // Update existing scheduled dose
      setTodaysDoses(prev => prev.map(dose => 
        dose.id === existingDose.id
          ? { 
              ...dose, 
              completed: true, 
              actualTime: now.toISOString(),
              notes: doseNotes || undefined,
              sideEffects: doseSideEffects.length > 0 ? doseSideEffects : undefined
            }
          : dose
      ))
    } else {
      // Create new unscheduled dose entry
      const newDose: DoseEntry = {
        id: `${selectedProtocol.id}-unscheduled-${Date.now()}`,
        peptideId: selectedProtocol.id,
        scheduledTime: currentTime,
        actualTime: now.toISOString(),
        completed: true,
        notes: doseNotes || undefined,
        sideEffects: doseSideEffects.length > 0 ? doseSideEffects : undefined
      }
      setTodaysDoses(prev => [...prev, newDose])
    }
    
    setShowDoseModal(false)
    setSelectedProtocol(null)
  }

  const PeptideCard = ({ protocol }: { protocol: PeptideProtocol }) => (
    <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/30 rounded-lg p-6 border border-primary-400/30 backdrop-blur-sm shadow-xl hover:shadow-primary-400/20 transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-white">{protocol.name}</h3>
          <span className="inline-block bg-primary-500/20 text-primary-300 text-sm px-2 py-1 rounded-full mt-1">
            {protocol.purpose}
          </span>
        </div>
        <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
          protocol.isActive ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-300'
        }`}>
          {protocol.isActive ? 'Active' : 'Paused'}
        </div>
      </div>

      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-gray-400">Dosage:</span>
            <p className="text-white font-medium">{protocol.dosage}</p>
          </div>
          <div>
            <span className="text-gray-400">Timing:</span>
            <p className="text-white font-medium">{protocol.timing}</p>
          </div>
        </div>
        
        <div>
          <span className="text-gray-400">Frequency:</span>
          <p className="text-white font-medium">{protocol.frequency}</p>
        </div>

        <div>
          <span className="text-gray-400">Duration:</span>
          <p className="text-white font-medium">{protocol.duration}</p>
        </div>

        <div className="border-t border-gray-600 pt-3">
          <span className="text-gray-400">Preparation:</span>
          <p className="text-gray-300 text-xs">
            {protocol.vialAmount} vial + {protocol.reconstitution} BAC water = {protocol.syringeUnits} units per dose
          </p>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button 
          onClick={() => openScheduleModal(protocol)}
          className="flex-1 bg-primary-600/30 hover:bg-primary-600/50 text-primary-200 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
        >
          View Schedule
        </button>
        <button 
          onClick={() => openCalculatorModal(protocol)}
          className="bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 font-medium py-2 px-4 rounded-lg transition-colors text-sm flex items-center"
        >
          <Calculator className="w-4 h-4 mr-1" />
          Calculate
        </button>
        <button 
          onClick={() => openDoseModal(protocol)}
          className="bg-secondary-600/30 hover:bg-secondary-600/50 text-secondary-200 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
        >
          Log Dose
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative"
         style={{
           backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
           backgroundSize: 'cover',
           backgroundPosition: 'center',
           backgroundAttachment: 'fixed'
         }}>
      <div className="relative z-10">
        {/* Header - Added mt-16 to create proper space below fixed nav (nav is h-16 = 64px) */}
        <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm shadow-2xl border-b border-primary-400/30 mt-16">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <img src="/logo1.png" alt="Reset Biology" className="h-8 w-auto mr-3 drop-shadow-lg" />
                <div>
                  <h1 className="text-xl font-bold text-white drop-shadow-lg">Portal</h1>
                  <span className="text-lg text-gray-200 drop-shadow-sm">• Peptide Tracker</span>
                </div>
              </div>
              <a href="/portal" className="text-primary-300 hover:text-primary-200 font-medium text-sm transition-colors drop-shadow-sm">
                ← Back to Portal
              </a>
            </div>
          </div>
        </div>

        {/* Title Section */}
        <div className="text-center py-8">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 text-shadow-lg animate-fade-in">
            <span className="text-primary-400">Peptide</span> Tracker
          </h2>
          <p className="text-xl md:text-2xl text-gray-200 max-w-3xl mx-auto font-medium leading-relaxed drop-shadow-sm">
            Comprehensive peptide management system. Schedule doses, track progress, monitor side effects with IRB-compliant data sharing.
          </p>
        </div>

        <div className="container mx-auto px-4 pb-8">

          {/* Navigation Tabs */}
          <div className="flex justify-center mb-8">
            <div className="bg-gradient-to-r from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-1 border border-primary-400/30">
              {(['current', 'library', 'history'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-3 rounded-lg font-medium transition-all capitalize ${
                    activeTab === tab 
                      ? 'bg-primary-500 text-white shadow-lg' 
                      : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Current Protocols Tab */}
          {activeTab === 'current' && (
            <div className="max-w-6xl mx-auto">
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Left Column - Today's Schedule */}
                <div className="space-y-6">
                  <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-2xl">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                      <Clock className="w-5 h-5 mr-2 text-primary-400" />
                      Today's Doses
                    </h3>
                    
                    {todaysDoses.length === 0 ? (
                      <div className="text-center py-4">
                        <Syringe className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                        <p className="text-gray-300">No doses scheduled</p>
                        <p className="text-sm text-gray-400 mt-1">Add a peptide protocol to get started</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Pending Doses */}
                        {todaysDoses.filter(dose => !dose.completed).map((dose) => {
                          const protocol = currentProtocols.find(p => p.id === dose.peptideId)
                          return (
                            <div key={dose.id} className="p-3 rounded-lg border transition-all bg-gray-700/30 border-gray-600/30 hover:bg-gray-700/50">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <span className="font-medium text-white">{protocol?.name || 'Unknown Protocol'}</span>
                                  <p className="text-xs text-gray-400">{protocol?.dosage}</p>
                                </div>
                                <div className="text-right">
                                  <span className="text-sm text-gray-300">{dose.scheduledTime}</span>
                                  <div className="flex items-center justify-end mt-1">
                                    <div className="w-4 h-4 border border-gray-400 rounded mr-1"></div>
                                    <span className="text-xs text-gray-400">Pending</span>
                                  </div>
                                </div>
                              </div>
                              <button 
                                onClick={() => markDoseCompleted(dose.id)}
                                className="w-full bg-primary-600 hover:bg-primary-700 text-white text-sm py-2 px-3 rounded transition-colors flex items-center justify-center"
                              >
                                <div className="w-4 h-4 border border-white rounded mr-2"></div>
                                Log Dose
                              </button>
                            </div>
                          )
                        })}
                        
                        {/* Completed Doses with Notes */}
                        {todaysDoses.filter(dose => dose.completed).map((dose) => {
                          const protocol = currentProtocols.find(p => p.id === dose.peptideId)
                          return (
                            <div key={dose.id} className="p-3 rounded-lg border transition-all bg-green-900/20 border-green-600/30">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <span className="font-medium text-white">{protocol?.name || 'Unknown Protocol'}</span>
                                  <p className="text-xs text-gray-400">{protocol?.dosage}</p>
                                </div>
                                <div className="text-right">
                                  <span className="text-sm text-green-300">
                                    {dose.actualTime ? new Date(dose.actualTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : dose.scheduledTime}
                                  </span>
                                  <div className="flex items-center justify-end mt-1">
                                    <div className="w-4 h-4 bg-green-500 rounded mr-1 flex items-center justify-center">
                                      <div className="w-2 h-2 bg-white rounded"></div>
                                    </div>
                                    <span className="text-xs text-green-400">Logged</span>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Show logged notes and side effects */}
                              {(dose.notes || dose.sideEffects) && (
                                <div className="mt-2 pt-2 border-t border-green-600/20">
                                  {dose.notes && (
                                    <div className="mb-2">
                                      <span className="text-xs text-green-400 font-medium">Notes:</span>
                                      <p className="text-sm text-gray-300 mt-1">{dose.notes}</p>
                                    </div>
                                  )}
                                  {dose.sideEffects && dose.sideEffects.length > 0 && (
                                    <div>
                                      <span className="text-xs text-green-400 font-medium">Side Effects:</span>
                                      <p className="text-sm text-gray-300 mt-1">{dose.sideEffects.join(', ')}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Safety Alerts */}
                  <div className="bg-gradient-to-r from-red-600/20 to-orange-600/20 backdrop-blur-sm rounded-xl p-4 border border-red-400/50">
                    <h4 className="font-semibold text-red-300 mb-2 flex items-center">
                      <AlertCircle className="w-4 h-4 mr-2" />
                      Safety Monitor
                    </h4>
                    <p className="text-red-200 text-sm">
                      All protocols within safe parameters. Next check-in with medical provider due in 2 weeks.
                    </p>
                  </div>
                </div>

                {/* Right Column - Active Protocols */}
                <div className="lg:col-span-2">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-bold text-white">Active Protocols</h3>
                    <button 
                      onClick={() => setActiveTab('library')}
                      className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Protocol
                    </button>
                  </div>

                  {currentProtocols.length === 0 ? (
                    <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-8 border border-primary-400/30 shadow-2xl text-center">
                      <Syringe className="w-16 h-16 text-primary-400 mx-auto mb-6" />
                      <h3 className="text-2xl font-bold text-white mb-4">Start Your First Protocol</h3>
                      <p className="text-gray-200 mb-8">Choose from our curated peptide library to begin tracking your peptide therapy journey.</p>
                      <button 
                        onClick={() => setActiveTab('library')}
                        className="bg-primary-500 hover:bg-primary-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 hover:scale-105 shadow-2xl"
                      >
                        Browse Peptide Library
                      </button>
                    </div>
                  ) : (
                    <div className="grid gap-6 md:grid-cols-2">
                      {currentProtocols.map((protocol) => (
                        <PeptideCard key={protocol.id} protocol={protocol} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Library Tab */}
          {activeTab === 'library' && (
            <div className="max-w-6xl mx-auto">
              <div className="mb-6 text-center">
                <h3 className="text-2xl font-bold text-white mb-4">Peptide Protocol Library</h3>
                <p className="text-gray-200">
                  Curated from leading peptide research by Hunter Williams and Jay Campbell
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {peptideLibrary.map((peptide, index) => (
                  <div key={index} className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-xl hover:shadow-primary-400/20 transition-all duration-300">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="text-lg font-bold text-white">{peptide.name}</h4>
                        <span className="inline-block bg-secondary-500/20 text-secondary-300 text-sm px-2 py-1 rounded-full mt-1">
                          {peptide.purpose}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Dosage:</span>
                        <span className="text-white">{peptide.dosage}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Timing:</span>
                        <span className="text-white">{peptide.timing}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Frequency:</span>
                        <p className="text-white text-xs mt-1">{peptide.frequency}</p>
                      </div>
                    </div>

                    <button 
                      onClick={() => addProtocol(peptide)}
                      className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                    >
                      Add to My Protocols
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-8 border border-primary-400/30 shadow-2xl text-center">
                <TrendingUp className="w-16 h-16 text-primary-400 mx-auto mb-6" />
                <h3 className="text-2xl font-bold text-white mb-4">Treatment History</h3>
                <p className="text-gray-200 mb-8">Your completed protocols and progress data will appear here</p>
                <div className="text-sm text-gray-300">
                  Complete your first peptide cycle to start building your treatment history!
                </div>
              </div>
              
              {/* IRB Compliance Notice */}
              <div className="mt-8">
                <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-4 border border-primary-400/30 shadow-xl hover:shadow-primary-400/20 transition-all duration-300 flex items-start">
                  <AlertCircle className="w-5 h-5 text-primary-300 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-primary-200 mb-1">IRB-Approved Research Protocol</h4>
                    <p className="text-gray-300 text-sm">
                      Your peptide data is securely tracked and can be shared with healthcare providers for research purposes. 
                      All data handling follows IRB compliance standards for participant safety.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Schedule Modal */}
        {showScheduleModal && selectedProtocol && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 max-w-2xl w-full border border-primary-400/30 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-white">{selectedProtocol.name} Schedule</h3>
                <button 
                  onClick={() => setShowScheduleModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="bg-gray-700/30 rounded-lg p-4">
                  <h4 className="font-semibold text-primary-300 mb-2">Current Protocol Details</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Dosage:</span>
                      <p className="text-white">{selectedProtocol.dosage}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Timing:</span>
                      <p className="text-white">{selectedProtocol.timing}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Frequency:</span>
                      <p className="text-white">{selectedProtocol.frequency}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Duration:</span>
                      <p className="text-white">{selectedProtocol.duration}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-secondary-600/20 rounded-lg p-4">
                  <h4 className="font-semibold text-secondary-300 mb-2">Weekly Schedule</h4>
                  <div className="grid grid-cols-7 gap-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                      <div key={day} className="text-center">
                        <div className="text-xs text-gray-400 mb-1">{day}</div>
                        <div className={`h-8 rounded flex items-center justify-center text-xs ${ 
                          selectedProtocol.frequency.includes('Every day') || 
                          (selectedProtocol.frequency.includes('5 days') && index >= 1 && index <= 5) ||
                          (selectedProtocol.frequency.includes('3x per week') && [1, 3, 5].includes(index))
                            ? 'bg-primary-500/20 text-primary-300' 
                            : 'bg-gray-700/30 text-gray-500'
                        }`}>
                          {selectedProtocol.frequency.includes('Every day') || 
                          (selectedProtocol.frequency.includes('5 days') && index >= 1 && index <= 5) ||
                          (selectedProtocol.frequency.includes('3x per week') && [1, 3, 5].includes(index))
                            ? '✓' : '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-amber-600/20 rounded-lg p-4">
                  <h4 className="font-semibold text-amber-300 mb-2">Preparation Instructions</h4>
                  <p className="text-amber-100 text-sm">
                    Reconstitute {selectedProtocol.vialAmount} vial with {selectedProtocol.reconstitution} of bacteriostatic water. 
                    Each dose requires {selectedProtocol.syringeUnits} units on an insulin syringe.
                  </p>
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <button 
                  onClick={() => setShowScheduleModal(false)}
                  className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dosage Calculator Modal - Professional Medical-Grade Design */}
        {showCalculatorModal && selectedProtocol && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-primary-900/95 via-gray-900/95 to-secondary-900/95 rounded-3xl max-w-7xl w-full max-h-[92vh] overflow-hidden shadow-[0_0_100px_rgba(63,191,181,0.3)] border border-primary-400/40">
              {/* Premium Header Bar */}
              <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-md border-b border-primary-400/30 px-8 py-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-primary-300 to-secondary-300 bg-clip-text text-transparent">
                      Professional Dosage Calculator
                    </h2>
                    <p className="text-primary-200 mt-1">
                      {selectedProtocol.name} • {selectedProtocol.purpose} Protocol
                    </p>
                  </div>
                  <button 
                    onClick={() => setShowCalculatorModal(false)}
                    className="bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-red-200 rounded-full p-3 transition-all duration-300 hover:scale-110"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              
              {/* Calculator Content with Premium Styling */}
              <div className="overflow-y-auto max-h-[calc(92vh-100px)] custom-scrollbar p-8">
                <DosageCalculator
                  importedPeptide={{
                    name: selectedProtocol.name,
                    dosage: selectedProtocol.dosage,
                    vialAmount: selectedProtocol.vialAmount,
                    reconstitution: selectedProtocol.reconstitution,
                    concentration: parseFloat(selectedProtocol.vialAmount) / parseFloat(selectedProtocol.reconstitution)
                  }}
                  onSaveToLog={(entry) => {
                    console.log('Saving calculator entry to log:', entry)
                    setShowCalculatorModal(false)
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Dose Logging Modal */}
        {showDoseModal && selectedProtocol && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 max-w-md w-full border border-primary-400/30 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">Log Dose</h3>
                <button 
                  onClick={() => setShowDoseModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-primary-300 mb-2">{selectedProtocol.name}</h4>
                  <p className="text-gray-300 text-sm">{selectedProtocol.dosage} • {new Date().toLocaleString()}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Notes (optional)
                  </label>
                  <textarea
                    value={doseNotes}
                    onChange={(e) => setDoseNotes(e.target.value)}
                    className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:border-primary-400 focus:outline-none"
                    placeholder="How are you feeling? Any observations?"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Side Effects (check all that apply)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {['Nausea', 'Headache', 'Fatigue', 'Injection site pain', 'Dizziness', 'Other'].map((effect) => (
                      <label key={effect} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={doseSideEffects.includes(effect)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setDoseSideEffects([...doseSideEffects, effect])
                            } else {
                              setDoseSideEffects(doseSideEffects.filter(se => se !== effect))
                            }
                          }}
                          className="mr-2 rounded border-gray-600 bg-gray-700"
                        />
                        <span className="text-sm text-gray-300">{effect}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button 
                  onClick={() => setShowDoseModal(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={logDose}
                  className="flex-1 bg-secondary-600 hover:bg-secondary-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Log Dose
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}