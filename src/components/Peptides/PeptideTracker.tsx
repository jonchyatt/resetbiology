"use client"

import { useState, useEffect } from "react"
import { Syringe, Calendar, AlertCircle, Plus, Clock, Calculator, X, Check, Edit2, Trash2 } from "lucide-react"

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
  isActive: boolean
}

interface DoseEntry {
  id: string
  protocolId: string
  dosage: string
  time: string
  doseDate: string
  notes?: string
  sideEffects?: string
  createdAt: string
}

export function PeptideTracker() {
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current')
  const [currentProtocols, setCurrentProtocols] = useState<PeptideProtocol[]>([])
  const [doseHistory, setDoseHistory] = useState<DoseEntry[]>([])
  const [showAddProtocolModal, setShowAddProtocolModal] = useState(false)
  const [showDoseModal, setShowDoseModal] = useState(false)
  const [selectedProtocol, setSelectedProtocol] = useState<PeptideProtocol | null>(null)
  const [doseNotes, setDoseNotes] = useState('')
  const [doseSideEffects, setDoseSideEffects] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form fields for new protocol
  const [selectedPeptideName, setSelectedPeptideName] = useState('')
  const [customDosage, setCustomDosage] = useState('')
  const [customFrequency, setCustomFrequency] = useState('Daily')
  const [customTiming, setCustomTiming] = useState('AM')

  // Available peptides (simplified for now)
  const availablePeptides = [
    { name: "Semaglutide", purpose: "Fat Loss", defaultDosage: "0.25mg", vialAmount: "3mg", reconstitution: "2ml" },
    { name: "BPC-157", purpose: "Healing", defaultDosage: "250mcg", vialAmount: "5mg", reconstitution: "2ml" },
    { name: "TB-500", purpose: "Healing", defaultDosage: "2.5mg", vialAmount: "10mg", reconstitution: "3ml" },
    { name: "CJC-1295", purpose: "Growth", defaultDosage: "2mg", vialAmount: "5mg", reconstitution: "2ml" },
    { name: "Ipamorelin", purpose: "Growth", defaultDosage: "200mcg", vialAmount: "5mg", reconstitution: "2ml" },
    { name: "Retatrutide", purpose: "Fat Loss", defaultDosage: "2mg", vialAmount: "10mg", reconstitution: "2ml" },
    { name: "Tirzepatide", purpose: "Fat Loss", defaultDosage: "2.5mg", vialAmount: "10mg", reconstitution: "2ml" },
    { name: "PT-141", purpose: "Libido", defaultDosage: "1.75mg", vialAmount: "10mg", reconstitution: "2ml" },
    { name: "Melanotan II", purpose: "Tanning", defaultDosage: "0.5mg", vialAmount: "10mg", reconstitution: "2ml" },
    { name: "GHK-Cu", purpose: "Anti-Aging", defaultDosage: "2mg", vialAmount: "50mg", reconstitution: "10ml" }
  ]

  // Load user's protocols and dose history
  useEffect(() => {
    fetchProtocols()
    fetchDoseHistory()
  }, [])

  const fetchProtocols = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/peptides/protocols')
      const data = await response.json()

      if (data.success && data.protocols) {
        const formattedProtocols = data.protocols.map((p: any) => ({
          id: p.id,
          name: p.peptides?.name || 'Unknown',
          purpose: p.peptides?.category || 'General',
          dosage: p.dosage,
          timing: p.notes?.includes('PM') ? 'PM' : 'AM',
          frequency: p.frequency,
          duration: '8 weeks',
          vialAmount: p.peptides?.vialAmount || '10mg',
          reconstitution: p.peptides?.reconstitution || '2ml',
          syringeUnits: 10,
          startDate: new Date(p.startDate).toISOString().split('T')[0],
          isActive: p.isActive
        }))
        setCurrentProtocols(formattedProtocols)
      }
    } catch (error) {
      console.error('Error fetching protocols:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchDoseHistory = async () => {
    try {
      const response = await fetch('/api/peptides/doses')
      const data = await response.json()

      if (data.success && data.doses) {
        setDoseHistory(data.doses)
      }
    } catch (error) {
      console.error('Error fetching dose history:', error)
    }
  }

  const addProtocol = async () => {
    if (!selectedPeptideName || !customDosage) {
      alert('Please select a peptide and enter dosage')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/peptides/protocols', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          peptideName: selectedPeptideName,
          dosage: customDosage,
          frequency: customFrequency,
          notes: `Timing: ${customTiming}`
        })
      })

      const data = await response.json()

      if (data.success) {
        await fetchProtocols() // Reload protocols
        setShowAddProtocolModal(false)
        resetForm()
      } else {
        alert(`Failed to add protocol: ${data.error}`)
      }
    } catch (error) {
      console.error('Error adding protocol:', error)
      alert('Failed to add protocol. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const logDose = async () => {
    if (!selectedProtocol) return

    setSaving(true)
    try {
      const response = await fetch('/api/peptides/doses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          protocolId: selectedProtocol.id,
          dosage: selectedProtocol.dosage,
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          notes: doseNotes || null,
          sideEffects: doseSideEffects || null
        })
      })

      const data = await response.json()

      if (data.success) {
        await fetchDoseHistory() // Reload history
        setShowDoseModal(false)
        setDoseNotes('')
        setDoseSideEffects('')
        alert('Dose logged successfully!')
      } else {
        alert(`Failed to log dose: ${data.error}`)
      }
    } catch (error) {
      console.error('Error logging dose:', error)
      alert('Failed to log dose. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const deleteProtocol = async (protocolId: string) => {
    if (!confirm('Are you sure you want to delete this protocol?')) return

    try {
      const response = await fetch('/api/peptides/protocols', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          protocolId,
          isActive: false
        })
      })

      const data = await response.json()

      if (data.success) {
        await fetchProtocols()
      } else {
        alert(`Failed to delete protocol: ${data.error}`)
      }
    } catch (error) {
      console.error('Error deleting protocol:', error)
      alert('Failed to delete protocol.')
    }
  }

  const resetForm = () => {
    setSelectedPeptideName('')
    setCustomDosage('')
    setCustomFrequency('Daily')
    setCustomTiming('AM')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm shadow-xl border-b border-primary-400/30">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Syringe className="w-8 h-8 text-primary-400 mr-3" />
              <h1 className="text-2xl font-bold text-white">Peptide Tracker</h1>
            </div>
            <a href="/portal" className="text-primary-300 hover:text-primary-200 transition-colors">
              ← Back to Portal
            </a>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex justify-center mb-8">
          <div className="bg-gray-800/50 rounded-xl p-1 backdrop-blur-sm">
            <button
              onClick={() => setActiveTab('current')}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                activeTab === 'current'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Current Protocols
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                activeTab === 'history'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Dose History
            </button>
          </div>
        </div>

        {/* Current Protocols Tab */}
        {activeTab === 'current' && (
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Active Protocols</h2>
              <button
                onClick={() => setShowAddProtocolModal(true)}
                className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Protocol
              </button>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-primary-400 border-t-transparent rounded-full mx-auto"></div>
                <p className="text-gray-400 mt-4">Loading protocols...</p>
              </div>
            ) : currentProtocols.length === 0 ? (
              <div className="bg-gray-800/50 rounded-xl p-12 text-center backdrop-blur-sm">
                <Syringe className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">No Active Protocols</h3>
                <p className="text-gray-400 mb-6">Start tracking your peptide therapy</p>
                <button
                  onClick={() => setShowAddProtocolModal(true)}
                  className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  Add Your First Protocol
                </button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {currentProtocols.map((protocol) => (
                  <div key={protocol.id} className="bg-gray-800/50 rounded-xl p-6 backdrop-blur-sm border border-gray-700">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-white">{protocol.name}</h3>
                        <span className="inline-block bg-primary-600/20 text-primary-300 text-sm px-2 py-1 rounded mt-1">
                          {protocol.purpose}
                        </span>
                      </div>
                      <button
                        onClick={() => deleteProtocol(protocol.id)}
                        className="text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-2 text-sm mb-4">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Dosage:</span>
                        <span className="text-white">{protocol.dosage}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Frequency:</span>
                        <span className="text-white">{protocol.frequency}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Timing:</span>
                        <span className="text-white">{protocol.timing}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedProtocol(protocol)
                        setShowDoseModal(true)
                      }}
                      className="w-full bg-secondary-600 hover:bg-secondary-700 text-white font-medium py-2 rounded-lg transition-colors"
                    >
                      Log Dose
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl font-bold text-white mb-6">Dose History</h2>

            {doseHistory.length === 0 ? (
              <div className="bg-gray-800/50 rounded-xl p-12 text-center backdrop-blur-sm">
                <Clock className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">No Dose History</h3>
                <p className="text-gray-400">Your logged doses will appear here</p>
              </div>
            ) : (
              <div className="bg-gray-800/50 rounded-xl overflow-hidden backdrop-blur-sm">
                <table className="w-full">
                  <thead className="bg-gray-900/50">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-300 font-medium">Date</th>
                      <th className="text-left px-4 py-3 text-gray-300 font-medium">Time</th>
                      <th className="text-left px-4 py-3 text-gray-300 font-medium">Peptide</th>
                      <th className="text-left px-4 py-3 text-gray-300 font-medium">Dosage</th>
                      <th className="text-left px-4 py-3 text-gray-300 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {doseHistory.map((dose) => (
                      <tr key={dose.id} className="hover:bg-gray-700/30 transition-colors">
                        <td className="px-4 py-3 text-white">
                          {new Date(dose.doseDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-gray-300">{dose.time}</td>
                        <td className="px-4 py-3 text-white">
                          {currentProtocols.find(p => p.id === dose.protocolId)?.name || 'Unknown'}
                        </td>
                        <td className="px-4 py-3 text-gray-300">{dose.dosage}</td>
                        <td className="px-4 py-3 text-gray-400 text-sm">
                          {dose.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Protocol Modal */}
      {showAddProtocolModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-900/98 to-slate-800/98 rounded-xl p-6 max-w-md w-full shadow-2xl border border-slate-700/50">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Add New Protocol</h3>
              <button
                onClick={() => {
                  setShowAddProtocolModal(false)
                  resetForm()
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Select Peptide
                </label>
                <select
                  value={selectedPeptideName}
                  onChange={(e) => {
                    const name = e.target.value
                    setSelectedPeptideName(name)
                    const peptide = availablePeptides.find(p => p.name === name)
                    if (peptide) {
                      setCustomDosage(peptide.defaultDosage)
                    }
                  }}
                  className="w-full bg-gray-800/50 text-white border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-primary-400"
                >
                  <option value="">Choose a peptide...</option>
                  {availablePeptides.map(p => (
                    <option key={p.name} value={p.name}>
                      {p.name} - {p.purpose}
                    </option>
                  ))}
                </select>
              </div>

              {selectedPeptideName && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Dosage
                    </label>
                    <input
                      type="text"
                      value={customDosage}
                      onChange={(e) => setCustomDosage(e.target.value)}
                      placeholder="e.g., 250mcg"
                      className="w-full bg-gray-800/50 text-white border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-primary-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Frequency
                    </label>
                    <select
                      value={customFrequency}
                      onChange={(e) => setCustomFrequency(e.target.value)}
                      className="w-full bg-gray-800/50 text-white border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-primary-400"
                    >
                      <option value="Daily">Daily</option>
                      <option value="Twice daily">Twice daily</option>
                      <option value="Every other day">Every other day</option>
                      <option value="3x per week">3x per week</option>
                      <option value="Weekly">Weekly</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Timing
                    </label>
                    <select
                      value={customTiming}
                      onChange={(e) => setCustomTiming(e.target.value)}
                      className="w-full bg-gray-800/50 text-white border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-primary-400"
                    >
                      <option value="AM">Morning (AM)</option>
                      <option value="PM">Evening (PM)</option>
                      <option value="AM & PM">Morning & Evening</option>
                    </select>
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowAddProtocolModal(false)
                    resetForm()
                  }}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addProtocol}
                  disabled={!selectedPeptideName || !customDosage || saving}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-600 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition-colors"
                >
                  {saving ? 'Adding...' : 'Add Protocol'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Log Dose Modal */}
      {showDoseModal && selectedProtocol && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-900/98 to-slate-800/98 rounded-xl p-6 max-w-md w-full shadow-2xl border border-slate-700/50">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Log Dose</h3>
              <button
                onClick={() => {
                  setShowDoseModal(false)
                  setDoseNotes('')
                  setDoseSideEffects('')
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-2">{selectedProtocol.name}</h4>
                <div className="text-sm text-gray-300 space-y-1">
                  <div>Dosage: {selectedProtocol.dosage}</div>
                  <div>Time: {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Notes (optional)
                </label>
                <textarea
                  value={doseNotes}
                  onChange={(e) => setDoseNotes(e.target.value)}
                  placeholder="Any observations or comments..."
                  rows={3}
                  className="w-full bg-gray-800/50 text-white border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-primary-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Side Effects (optional)
                </label>
                <input
                  type="text"
                  value={doseSideEffects}
                  onChange={(e) => setDoseSideEffects(e.target.value)}
                  placeholder="e.g., Nausea, Headache"
                  className="w-full bg-gray-800/50 text-white border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-primary-400"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDoseModal(false)
                    setDoseNotes('')
                    setDoseSideEffects('')
                  }}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={logDose}
                  disabled={saving}
                  className="flex-1 bg-secondary-600 hover:bg-secondary-700 disabled:bg-gray-600 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition-colors"
                >
                  {saving ? 'Logging...' : 'Log Dose'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}