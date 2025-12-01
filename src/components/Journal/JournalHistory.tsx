"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { PortalHeader } from "@/components/Navigation/PortalHeader"
import { ChevronsLeft, ChevronsRight, Flame, NotebookPen, Utensils, Droplets, Activity, BrainCircuit, Wind, Dumbbell, X, Edit2, Eye } from "lucide-react"

interface JournalHistoryDay {
  date: string
  iso: string
  journalEntry: any | null
  nutrition: {
    logs: any[]
    totals: { calories: number; protein: number; carbs: number; fats: number }
  }
  workouts: any[]
  breathSessions: any[]
  peptideDoses: any[]
  modules: any[]
  eventCount: number
}

interface JournalHistoryResponse {
  success: boolean
  range: { start: string; end: string }
  days: JournalHistoryDay[]
  calendar: Array<{ date: string; iso: string; count: number }>
}

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function formatMonth(date: Date) {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function toMonthParam(date: Date) {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  return `${year}-${month}`
}

export function JournalHistory() {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()))
  const [history, setHistory] = useState<JournalHistoryResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedDayKey, setSelectedDayKey] = useState<string>(() => new Date().toISOString().split('T')[0])

  useEffect(() => {
    const controller = new AbortController()
    const loadHistory = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`/api/journal/history?month=${toMonthParam(currentMonth)}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        const data = await response.json()
        if (!response.ok || !data?.success) {
          throw new Error(data?.error || 'Failed to load journal history')
        }
        setHistory(data)
        if (data.days?.length) {
          const hasSelected = data.days.find((day: JournalHistoryDay) => day.date === selectedDayKey)
          if (!hasSelected) {
            setSelectedDayKey(data.days[data.days.length - 1].date)
          }
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return
        console.error('Failed to load journal history:', err)
        setError(err?.message || 'Failed to load journal history')
      } finally {
        setLoading(false)
      }
    }

    loadHistory()
    return () => controller.abort()
  }, [currentMonth])

  const dayLookup = useMemo(() => {
    const map = new Map<string, JournalHistoryDay>()
    if (history?.days) {
      history.days.forEach((day) => {
        map.set(day.date, day)
      })
    }
    return map
  }, [history])

  const selectedDay = selectedDayKey ? dayLookup.get(selectedDayKey) ?? null : null

  // Weight tracking data
  const weightData = useMemo(() => {
    if (!history?.days) return []
    return history.days
      .filter(day => day.journalEntry && typeof day.journalEntry.weight === 'number')
      .map(day => ({
        date: day.date,
        weight: day.journalEntry.weight,
        iso: day.iso
      }))
      .sort((a, b) => new Date(a.iso).getTime() - new Date(b.iso).getTime())
  }, [history])

  const calendarCells = useMemo(() => {
    if (!history) return []
    const start = new Date(history.range.start)
    const end = new Date(history.range.end)
    const daysInMonth = history.calendar
    const cells: Array<{ date?: string; iso?: string; count?: number; inMonth: boolean }> = []
    const leadingBlanks = start.getDay()
    for (let i = 0; i < leadingBlanks; i++) {
      cells.push({ inMonth: false })
    }
    daysInMonth.forEach((day) => {
      cells.push({ ...day, inMonth: true })
    })
    while (cells.length % 7 !== 0) {
      cells.push({ inMonth: false })
    }
    return cells
  }, [history])

  const handlePrevMonth = () => {
    const prev = new Date(currentMonth)
    prev.setMonth(prev.getMonth() - 1)
    setCurrentMonth(startOfMonth(prev))
  }

  const handleNextMonth = () => {
    const next = new Date(currentMonth)
    next.setMonth(next.getMonth() + 1)
    setCurrentMonth(startOfMonth(next))
  }

  return (

    <div className="relative min-h-screen overflow-hidden pt-28" style={{
      backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed'
    }}>

      <div className="relative z-10 min-h-screen flex flex-col text-slate-100">

        <PortalHeader
          section="Daily History"
          subtitle="Review your peptides, nutrition, workouts, breath, mindset, and notes in one place"
          showOrderPeptides={false}
        />

        {/* Title Section - Matching Tracker Pages */}
        <div className="text-center py-8">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 text-shadow-lg animate-fade-in">
            <span className="text-primary-400">Holistic Research</span> Protocol Tracker
          </h2>
          <p className="text-xl md:text-2xl text-gray-200 max-w-3xl mx-auto font-medium leading-relaxed drop-shadow-sm mb-4">
            Review everything you completed - peptides, nutrition, workouts, breath practice, mindset modules, and journal reflections.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <Link
              href="/portal"
              className="inline-flex items-center gap-2 rounded-xl border border-primary-400/40 bg-primary-500/10 px-4 py-2 text-sm font-medium text-primary-200 transition hover:border-primary-300 hover:bg-primary-500/20 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary-300/60"
            >
              Back to Portal
            </Link>
            <Link
              href="/portal#journal"
              className="inline-flex items-center gap-2 rounded-xl border border-secondary-400/40 bg-secondary-500/10 px-4 py-2 text-sm font-medium text-secondary-200 transition hover:border-secondary-300 hover:bg-secondary-500/20 hover:text-white focus:outline-none focus:ring-2 focus:ring-secondary-300/60"
            >
              Open Today's Journal
            </Link>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">



            <div className="grid gap-6 lg:grid-cols-[360px,1fr] items-start">

              <div className="rounded-2xl border border-primary-400/30 bg-slate-900/70 backdrop-blur-md shadow-2xl shadow-black/40 overflow-hidden">

                <div className="flex items-center justify-between gap-4 px-6 pt-6">

                  <button

                    onClick={handlePrevMonth}

                    className="rounded-xl border border-primary-400/40 bg-primary-500/10 p-2 text-primary-100 transition hover:border-primary-300 hover:bg-primary-500/20 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary-300/60"

                    aria-label="Previous month"

                  >

                    <ChevronsLeft className="h-5 w-5" />

                  </button>

                  <div className="text-center">

                    <p className="text-xs uppercase tracking-[0.25em] text-primary-200/80">Month</p>

                    <p className="text-lg font-semibold text-white">{formatMonth(currentMonth)}</p>

                  </div>

                  <button

                    onClick={handleNextMonth}

                    className="rounded-xl border border-primary-400/40 bg-primary-500/10 p-2 text-primary-100 transition hover:border-primary-300 hover:bg-primary-500/20 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary-300/60"

                    aria-label="Next month"

                  >

                    <ChevronsRight className="h-5 w-5" />

                  </button>

                </div>



                <div className="px-6 pt-5">

                  <div className="grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-3">

                    {weekdayLabels.map((label) => (

                      <span key={label}>{label}</span>

                    ))}

                  </div>



                  {loading ? (

                    <div className="flex flex-col items-center justify-center py-12 text-sm text-slate-300">

                      <div className="h-10 w-10 animate-spin rounded-full border-2 border-secondary-300 border-t-transparent mb-3" />

                      Loading history...

                    </div>

                  ) : error ? (

                    <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">

                      {error}

                    </div>

                  ) : (

                    <div className="grid grid-cols-7 gap-2 pb-6">

                      {calendarCells.map((cell, idx) => {

                        if (!cell.inMonth) {

                          return <div key={`blank-${idx}`} className="h-16 rounded-xl bg-slate-800/40" />

                        }



                        const isSelected = selectedDayKey === cell.date

                        const density = cell.count ?? 0

                        let intensity = 'bg-slate-800/50 border-transparent text-slate-300'

                        if (density > 0 && density <= 2) intensity = 'bg-secondary-500/20 border-secondary-400/30 text-secondary-100'

                        if (density > 2 && density <= 5) intensity = 'bg-secondary-500/40 border-secondary-400/40 text-secondary-50'

                        if (density > 5) intensity = 'bg-secondary-500/60 border-secondary-400/60 text-white'



                        return (

                          <button

                            key={cell.date}

                            onClick={() => setSelectedDayKey(cell.date as string)}

                            className={`h-16 rounded-xl border px-2 py-1 text-left transition-all duration-200 flex flex-col justify-between backdrop-blur-sm hover:-translate-y-0.5 hover:border-secondary-300/60 hover:shadow-lg hover:shadow-secondary-500/20 ${intensity} ${isSelected ? 'ring-2 ring-offset-2 ring-secondary-300 ring-offset-slate-900' : ''}`}

                          >

                            <span className="text-sm font-semibold">{new Date(cell.iso ?? '').getDate()}</span>

                            <span className="text-[11px] opacity-80">{density} entries</span>

                          </button>

                        )

                      })}

                    </div>

                  )}

                </div>

              </div>



              <div className="space-y-6">

                {/* Weight Trend Graph */}
                {weightData.length > 0 && (
                  <div className="rounded-2xl border border-amber-400/30 bg-slate-900/70 backdrop-blur-md shadow-2xl shadow-black/30 p-6">
                    <h3 className="text-lg font-semibold text-amber-300 mb-4 flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Weight Trend
                    </h3>
                    <WeightChart data={weightData} />
                  </div>
                )}

                {selectedDay ? (

                  <DayDetail day={selectedDay} />

                ) : (

                  <div className="rounded-2xl border border-primary-400/30 bg-primary-500/10 backdrop-blur-md p-10 text-center text-slate-300 shadow-xl shadow-black/30">

                    Select a day on the calendar to view the full history.

                  </div>

                )}

              </div>

            </div>

          </div>

        </div>

      </div>

    </div>

  )
}

function startOfMonth(date: Date) {
  const d = new Date(date)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

function DayDetail({ day }: { day: JournalHistoryDay }) {
  const displayDate = useMemo(() => new Date(day.iso), [day.iso])
  const entry = day.journalEntry?.entry ?? {}
  const [detailsModal, setDetailsModal] = useState<{ type: string; data: any } | null>(null)
  const [editModal, setEditModal] = useState<{ type: string; data: any } | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  return (
    <div className="space-y-6">
      {/* Modals */}
      {detailsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDetailsModal(null)}>
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-primary-400/30 max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-white">
                {detailsModal.type === 'workout' && 'Workout Details'}
                {detailsModal.type === 'breath' && 'Breath Session Details'}
                {detailsModal.type === 'peptide' && 'Peptide Dose Details'}
                {detailsModal.type === 'module' && 'Mental Module Details'}
              </h3>
              <button onClick={() => setDetailsModal(null)} className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors">
                <X className="h-5 w-5 text-slate-300" />
              </button>
            </div>
            <div className="text-slate-200 space-y-3">
              {detailsModal.type === 'workout' && (
                <>
                  <p><strong className="text-primary-300">Exercises:</strong> {detailsModal.data.exercises?.map((e: any) => e.name).join(', ') || 'N/A'}</p>
                  <p><strong className="text-primary-300">Duration:</strong> {Math.round((detailsModal.data.duration ?? 0) / 60)} minutes</p>
                  <p><strong className="text-primary-300">Completed:</strong> {new Date(detailsModal.data.completedAt).toLocaleString()}</p>
                  {detailsModal.data.notes && <p><strong className="text-primary-300">Notes:</strong> {detailsModal.data.notes}</p>}
                  {detailsModal.data.exercises && detailsModal.data.exercises.length > 0 && (
                    <div className="mt-4">
                      <strong className="text-primary-300 block mb-2">Exercise Details:</strong>
                      <ul className="space-y-2">
                        {detailsModal.data.exercises.map((ex: any, idx: number) => (
                          <li key={idx} className="bg-slate-800/50 p-3 rounded-lg">
                            <p className="font-semibold">{ex.name}</p>
                            {ex.sets && <p className="text-sm text-slate-400">Sets: {ex.sets}</p>}
                            {ex.reps && <p className="text-sm text-slate-400">Reps: {ex.reps}</p>}
                            {ex.weight && <p className="text-sm text-slate-400">Weight: {ex.weight}</p>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
              {detailsModal.type === 'breath' && (
                <>
                  <p><strong className="text-primary-300">Session Type:</strong> {detailsModal.data.sessionType}</p>
                  <p><strong className="text-primary-300">Duration:</strong> {Math.round((detailsModal.data.duration ?? 0) / 60)} minutes</p>
                  <p><strong className="text-primary-300">Cycles:</strong> {detailsModal.data.cycles ?? 'N/A'}</p>
                  <p><strong className="text-primary-300">Created:</strong> {new Date(detailsModal.data.createdAt).toLocaleString()}</p>
                </>
              )}
              {detailsModal.type === 'peptide' && (
                <>
                  <p><strong className="text-primary-300">Peptide:</strong> {detailsModal.data.user_peptide_protocols?.peptides?.name || 'N/A'}</p>
                  <p><strong className="text-primary-300">Dosage:</strong> {detailsModal.data.dosage}</p>
                  <p><strong className="text-primary-300">Time:</strong> {detailsModal.data.time || 'N/A'}</p>
                  <p><strong className="text-primary-300">Date:</strong> {new Date(detailsModal.data.doseDate).toLocaleDateString()}</p>
                  {detailsModal.data.notes && <p><strong className="text-primary-300">Notes:</strong> {detailsModal.data.notes}</p>}
                  {detailsModal.data.sideEffects && <p><strong className="text-primary-300">Side Effects:</strong> {detailsModal.data.sideEffects}</p>}
                </>
              )}
              {detailsModal.type === 'module' && (
                <>
                  <p><strong className="text-primary-300">Module ID:</strong> {detailsModal.data.moduleId}</p>
                  <p><strong className="text-primary-300">Status:</strong> {detailsModal.data.fullCompletion ? 'Fully Completed' : 'Partially Completed'}</p>
                  {detailsModal.data.audioDuration && <p><strong className="text-primary-300">Audio Duration:</strong> {Math.round(detailsModal.data.audioDuration / 60)} minutes</p>}
                  <p><strong className="text-primary-300">Completed At:</strong> {new Date(detailsModal.data.completedAt).toLocaleString()}</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {editModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEditModal(null)}>
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-primary-400/30 max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-white">
                Edit {editModal.type === 'workout' ? 'Workout' : editModal.type === 'peptide' ? 'Peptide Dose' : editModal.type === 'nutrition' ? 'Nutrition Entry' : 'Journal Entry'}
              </h3>
              <button onClick={() => { setEditModal(null); setEditForm({}); }} className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors">
                <X className="h-5 w-5 text-slate-300" />
              </button>
            </div>

            {/* Journal Edit Form */}
            {editModal.type === 'journal' && (
              <form onSubmit={async (e) => {
                e.preventDefault()
                setSaving(true)
                try {
                  const response = await fetch(`/api/journal/entry/${editModal.data.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(editForm)
                  })
                  if (response.ok) {
                    alert('Journal entry updated successfully!')
                    window.location.reload()
                  } else {
                    throw new Error('Failed to update')
                  }
                } catch (error) {
                  alert('Failed to update journal entry')
                } finally {
                  setSaving(false)
                }
              }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Mood</label>
                  <select
                    value={editForm.mood || editModal.data.mood || ''}
                    onChange={(e) => setEditForm({ ...editForm, mood: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                  >
                    <option value="">Select mood...</option>
                    <option value="Amazing 🚀">Amazing 🚀</option>
                    <option value="Great 😊">Great 😊</option>
                    <option value="Good 👍">Good 👍</option>
                    <option value="Okay 😐">Okay 😐</option>
                    <option value="Challenging 😔">Challenging 😔</option>
                    <option value="Tough 😟">Tough 😟</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Weight</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.weight ?? editModal.data.weight ?? ''}
                    onChange={(e) => setEditForm({ ...editForm, weight: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Success Today</label>
                  <textarea
                    value={editForm.reasonsValidation ?? editModal.data.entry?.reasonsValidation ?? ''}
                    onChange={(e) => setEditForm({ ...editForm, reasonsValidation: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                    rows={2}
                  />
                </div>
                <div className="flex gap-3">
                  <button type="submit" disabled={saving} className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-700 text-white rounded-lg transition-colors">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button type="button" onClick={() => { setEditModal(null); setEditForm({}); }} className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Nutrition Edit Form */}
            {editModal.type === 'nutrition' && (
              <form onSubmit={async (e) => {
                e.preventDefault()
                setSaving(true)
                try {
                  const response = await fetch(`/api/nutrition/entries/${editModal.data.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(editForm)
                  })
                  if (response.ok) {
                    alert('Nutrition entry updated successfully!')
                    window.location.reload()
                  } else {
                    throw new Error('Failed to update')
                  }
                } catch (error) {
                  alert('Failed to update nutrition entry')
                } finally {
                  setSaving(false)
                }
              }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Food Name</label>
                  <input
                    type="text"
                    value={editForm.itemName ?? editModal.data.itemName ?? ''}
                    onChange={(e) => setEditForm({ ...editForm, itemName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Meal Type</label>
                  <select
                    value={editForm.mealType ?? editModal.data.mealType ?? ''}
                    onChange={(e) => setEditForm({ ...editForm, mealType: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                  >
                    <option value="breakfast">Breakfast</option>
                    <option value="lunch">Lunch</option>
                    <option value="dinner">Dinner</option>
                    <option value="snack">Snack</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Calories</label>
                    <input
                      type="number"
                      value={editForm.nutrients?.kcal ?? editModal.data.nutrients?.kcal ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, nutrients: { ...editForm.nutrients, kcal: parseFloat(e.target.value) } })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Protein (g)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={editForm.nutrients?.protein_g ?? editModal.data.nutrients?.protein_g ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, nutrients: { ...editForm.nutrients, protein_g: parseFloat(e.target.value) } })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Carbs (g)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={editForm.nutrients?.carb_g ?? editModal.data.nutrients?.carb_g ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, nutrients: { ...editForm.nutrients, carb_g: parseFloat(e.target.value) } })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Fat (g)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={editForm.nutrients?.fat_g ?? editModal.data.nutrients?.fat_g ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, nutrients: { ...editForm.nutrients, fat_g: parseFloat(e.target.value) } })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button type="submit" disabled={saving} className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-700 text-white rounded-lg transition-colors">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button type="button" onClick={async () => {
                    if (!confirm('Are you sure you want to delete this nutrition entry?')) return
                    setSaving(true)
                    try {
                      const response = await fetch(`/api/nutrition/entries/${editModal.data.id}`, {
                        method: 'DELETE'
                      })
                      if (response.ok) {
                        alert('Nutrition entry deleted successfully!')
                        window.location.reload()
                      } else {
                        throw new Error('Failed to delete')
                      }
                    } catch (error) {
                      alert('Failed to delete nutrition entry')
                    } finally {
                      setSaving(false)
                    }
                  }} disabled={saving} className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white rounded-lg transition-colors">
                    {saving ? 'Deleting...' : 'Delete'}
                  </button>
                  <button type="button" onClick={() => { setEditModal(null); setEditForm({}); }} className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Workout Edit Form */}
            {editModal.type === 'workout' && (
              <form onSubmit={async (e) => {
                e.preventDefault()
                setSaving(true)
                try {
                  const response = await fetch(`/api/workout/sessions/${editModal.data.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(editForm)
                  })
                  if (response.ok) {
                    alert('Workout updated successfully!')
                    window.location.reload()
                  } else {
                    throw new Error('Failed to update')
                  }
                } catch (error) {
                  alert('Failed to update workout')
                } finally {
                  setSaving(false)
                }
              }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Duration (minutes)</label>
                  <input
                    type="number"
                    value={Math.round((editForm.duration ?? editModal.data.duration ?? 0) / 60)}
                    onChange={(e) => setEditForm({ ...editForm, duration: parseInt(e.target.value) * 60 })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Notes</label>
                  <textarea
                    value={editForm.notes ?? editModal.data.notes ?? ''}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                    rows={3}
                  />
                </div>
                {editModal.data.exercises && editModal.data.exercises.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Exercises</label>
                    <div className="space-y-2">
                      {editModal.data.exercises.map((ex: any, idx: number) => (
                        <div key={idx} className="bg-slate-800/50 p-3 rounded-lg">
                          <p className="font-semibold text-white">{ex.name}</p>
                          <div className="grid grid-cols-3 gap-2 mt-2">
                            <input
                              type="number"
                              placeholder="Sets"
                              value={editForm.exercises?.[idx]?.sets ?? ex.sets ?? ''}
                              onChange={(e) => {
                                const exercises = editForm.exercises || [...editModal.data.exercises]
                                exercises[idx] = { ...exercises[idx], sets: parseInt(e.target.value) }
                                setEditForm({ ...editForm, exercises })
                              }}
                              className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                            />
                            <input
                              type="number"
                              placeholder="Reps"
                              value={editForm.exercises?.[idx]?.reps ?? ex.reps ?? ''}
                              onChange={(e) => {
                                const exercises = editForm.exercises || [...editModal.data.exercises]
                                exercises[idx] = { ...exercises[idx], reps: parseInt(e.target.value) }
                                setEditForm({ ...editForm, exercises })
                              }}
                              className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                            />
                            <input
                              type="text"
                              placeholder="Weight"
                              value={editForm.exercises?.[idx]?.weight ?? ex.weight ?? ''}
                              onChange={(e) => {
                                const exercises = editForm.exercises || [...editModal.data.exercises]
                                exercises[idx] = { ...exercises[idx], weight: e.target.value }
                                setEditForm({ ...editForm, exercises })
                              }}
                              className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-3">
                  <button type="submit" disabled={saving} className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-700 text-white rounded-lg transition-colors">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button type="button" onClick={async () => {
                    if (!confirm('Are you sure you want to delete this workout?')) return
                    setSaving(true)
                    try {
                      const response = await fetch(`/api/workout/sessions/${editModal.data.id}`, {
                        method: 'DELETE'
                      })
                      if (response.ok) {
                        alert('Workout deleted successfully!')
                        window.location.reload()
                      } else {
                        throw new Error('Failed to delete')
                      }
                    } catch (error) {
                      alert('Failed to delete workout')
                    } finally {
                      setSaving(false)
                    }
                  }} disabled={saving} className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white rounded-lg transition-colors">
                    {saving ? 'Deleting...' : 'Delete'}
                  </button>
                  <button type="button" onClick={() => { setEditModal(null); setEditForm({}); }} className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Peptide Edit Form */}
            {editModal.type === 'peptide' && (
              <form onSubmit={async (e) => {
                e.preventDefault()
                setSaving(true)
                try {
                  const response = await fetch(`/api/peptides/doses/${editModal.data.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(editForm)
                  })
                  if (response.ok) {
                    alert('Peptide dose updated successfully!')
                    window.location.reload()
                  } else {
                    throw new Error('Failed to update')
                  }
                } catch (error) {
                  alert('Failed to update peptide dose')
                } finally {
                  setSaving(false)
                }
              }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Peptide Name</label>
                  <input
                    type="text"
                    value={editModal.data.user_peptide_protocols?.peptides?.name || 'Peptide'}
                    disabled
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Dosage</label>
                  <input
                    type="text"
                    value={editForm.dosage ?? editModal.data.dosage ?? ''}
                    onChange={(e) => setEditForm({ ...editForm, dosage: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                    placeholder="e.g., 250mcg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Time</label>
                  <input
                    type="text"
                    value={editForm.time ?? editModal.data.time ?? ''}
                    onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                    placeholder="e.g., 8:00 AM"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Notes</label>
                  <textarea
                    value={editForm.notes ?? editModal.data.notes ?? ''}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Side Effects</label>
                  <input
                    type="text"
                    value={editForm.sideEffects ?? editModal.data.sideEffects ?? ''}
                    onChange={(e) => setEditForm({ ...editForm, sideEffects: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                    placeholder="Any side effects noted"
                  />
                </div>
                <div className="flex gap-3">
                  <button type="submit" disabled={saving} className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-700 text-white rounded-lg transition-colors">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button type="button" onClick={() => { setEditModal(null); setEditForm({}); }} className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      <section className="rounded-2xl border border-secondary-400/30 bg-slate-900/70 backdrop-blur-md shadow-2xl shadow-black/30 p-6">
        <header className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm uppercase tracking-wide text-slate-300/80">Selected Day</p>
            <h2 className="text-2xl font-bold text-white">{displayDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h2>
          </div>
          <div className="text-right text-secondary-200/90">
            <p className="text-xs uppercase tracking-[0.3em] text-secondary-200/70">Total Logged</p>
            <p className="text-xl font-semibold">{day.eventCount}</p>
          </div>
        </header>

        {day.journalEntry ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-primary-400/30 bg-primary-500/15 p-4 shadow-inner shadow-primary-900/30 group relative">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center text-sm font-semibold text-primary-200 uppercase tracking-wide"><NotebookPen className="mr-2 h-4 w-4" />Journal</h3>
                <button
                  onClick={() => setEditModal({ type: 'journal', data: day.journalEntry })}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg bg-primary-500/20 hover:bg-primary-500/30 text-primary-300"
                  title="Edit Journal"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              </div>
              <ul className="mt-3 space-y-2 text-sm text-slate-200">
                {entry.reasonsValidation && <li><strong>Success Today:</strong> {entry.reasonsValidation}</li>}
                {entry.affirmationGoal && <li><strong>I am:</strong> {entry.affirmationGoal}</li>}
                {entry.affirmationBecause && <li><strong>Because:</strong> {entry.affirmationBecause}</li>}
                {entry.affirmationMeans && <li><strong>Which means:</strong> {entry.affirmationMeans}</li>}
                {typeof day.journalEntry.mood === 'string' && day.journalEntry.mood && (
                  <li><strong>Mood:</strong> {day.journalEntry.mood}</li>
                )}
                {typeof day.journalEntry.weight === 'number' && (
                  <li><strong>Weight:</strong> {day.journalEntry.weight}</li>
                )}
              </ul>
            </div>

            <div className="rounded-xl border border-secondary-400/30 bg-secondary-500/15 p-4 shadow-inner shadow-secondary-900/30">
              <h3 className="flex items-center text-sm font-semibold text-secondary-200 uppercase tracking-wide"><Activity className="mr-2 h-4 w-4" />Activity Snapshot</h3>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-slate-400">Meals Logged</dt>
                  <dd className="text-white font-semibold">{day.nutrition.logs.length}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Peptide Doses</dt>
                  <dd className="text-white font-semibold">{day.peptideDoses.length}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Workouts</dt>
                  <dd className="text-white font-semibold">{day.workouts.length}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Breath Sessions</dt>
                  <dd className="text-white font-semibold">{day.breathSessions.length}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Modules</dt>
                  <dd className="text-white font-semibold">{day.modules.length}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Calories</dt>
                  <dd className="text-white font-semibold">{Math.round(day.nutrition.totals.calories)} kcal</dd>
                </div>
              </dl>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-700/40 bg-slate-800/50 p-4 text-sm text-slate-300">
            No journal entry saved for this day.
          </div>
        )}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <ActivityList
          title="Nutrition"
          icon={<Utensils className="h-4 w-4" />}
          colorClass="text-amber-300"
          borderClass="border-amber-400/30"
          items={[...day.nutrition.logs].sort((a: any, b: any) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime()).map((item: any) => {
            const nutrients = item.nutrients as any
            return {
              id: item.id,
              primary: item.itemName,
              secondary: `${Math.round(typeof nutrients?.kcal === 'number' ? nutrients.kcal : 0)} kcal • P ${Math.round(typeof nutrients?.protein_g === 'number' ? nutrients.protein_g : 0)}g C ${Math.round(typeof nutrients?.carb_g === 'number' ? nutrients.carb_g : 0)}g F ${Math.round(typeof nutrients?.fat_g === 'number' ? nutrients.fat_g : 0)}g`,
              meta: `${new Date(item.loggedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} • ${item.mealType ?? 'meal'}`,
              data: item
            }
          })}
          onViewDetails={(item) => setDetailsModal({ type: 'nutrition', data: item.data })}
          onEdit={(item) => setEditModal({ type: 'nutrition', data: item.data })}
        />

        <ActivityList
          title="Peptide Doses"
          icon={<Droplets className="h-4 w-4" />}
          colorClass="text-emerald-300"
          borderClass="border-emerald-400/30"
          items={[...day.peptideDoses].sort((a: any, b: any) => new Date(b.doseDate).getTime() - new Date(a.doseDate).getTime()).map((dose: any) => ({
            id: dose.id,
            primary: dose.user_peptide_protocols?.peptides?.name || 'Peptide dose',
            secondary: dose.dosage,
            meta: `${dose.time || ''} ${new Date(dose.doseDate).toLocaleDateString()}`.trim(),
            data: dose
          }))}
          onViewDetails={(item) => setDetailsModal({ type: 'peptide', data: item.data })}
          onEdit={(item) => setEditModal({ type: 'peptide', data: item.data })}
        />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <ActivityList
          title="Workouts"
          icon={<Dumbbell className="h-4 w-4" />}
          colorClass="text-green-300"
          borderClass="border-green-400/30"
          items={day.workouts.map((workout: any) => ({
            id: workout.id,
            primary: workout.exercises?.[0]?.name || 'Workout session',
            secondary: `${Math.round((workout.duration ?? 0) / 60)} min • ${new Date(workout.completedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
            meta: workout.notes || '',
            data: workout
          }))}
          onViewDetails={(item) => setDetailsModal({ type: 'workout', data: item.data })}
          onEdit={(item) => setEditModal({ type: 'workout', data: item.data })}
        />

        <ActivityList
          title="Breath Sessions"
          icon={<Wind className="h-4 w-4" />}
          colorClass="text-sky-300"
          borderClass="border-sky-400/30"
          items={day.breathSessions.map((session: any) => ({
            id: session.id,
            primary: session.sessionType,
            secondary: `${Math.round((session.duration ?? 0) / 60)} min • ${session.cycles ?? 0} cycles`,
            meta: new Date(session.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
            data: session
          }))}
          onViewDetails={(item) => setDetailsModal({ type: 'breath', data: item.data })}
        />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <ActivityList
          title="Mental Modules"
          icon={<BrainCircuit className="h-4 w-4" />}
          colorClass="text-purple-300"
          borderClass="border-purple-400/30"
          items={day.modules.map((module: any) => ({
            id: module.id,
            primary: module.moduleId,
            secondary: `${module.fullCompletion ? 'Completed' : 'Partial'}${module.audioDuration ? ` • ${Math.round(module.audioDuration / 60)} min audio` : ''}`,
            meta: new Date(module.completedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
            data: module
          }))}
          onViewDetails={(item) => setDetailsModal({ type: 'module', data: item.data })}
        />
      </section>

      <section className="rounded-2xl border border-secondary-400/30 bg-slate-900/70 backdrop-blur-md shadow-2xl shadow-black/30 p-6">
        <h3 className="flex items-center text-sm font-semibold uppercase tracking-wide text-secondary-200 mb-3"><Flame className="mr-2 h-4 w-4" />Notes</h3>
        <div className="space-y-2 text-sm text-slate-200">
          {entry.peptideNotes && (
            <p><strong>Peptides:</strong> {entry.peptideNotes}</p>
          )}
          {entry.workoutNotes && (
            <p><strong>Workouts:</strong> {entry.workoutNotes}</p>
          )}
          {entry.nutritionNotes && (
            <p><strong>Nutrition:</strong> {entry.nutritionNotes}</p>
          )}
          {entry.breathNotes && (
            <p><strong>Breath:</strong> {entry.breathNotes}</p>
          )}
          {entry.moduleNotes && (
            <p><strong>Mental Modules:</strong> {entry.moduleNotes}</p>
          )}
          {!entry.peptideNotes && !entry.workoutNotes && !entry.nutritionNotes && !entry.breathNotes && !entry.moduleNotes && (
            <p className="text-slate-400">No activity notes logged yet. Entries will appear here automatically as you complete tasks.</p>
          )}
        </div>
      </section>
    </div>
  )
}

function WeightChart({ data }: { data: Array<{ date: string; weight: number; iso: string }> }) {
  if (data.length === 0) return null

  const weights = data.map(d => d.weight)
  const minWeight = Math.min(...weights)
  const maxWeight = Math.max(...weights)
  const range = maxWeight - minWeight || 1
  const chartHeight = 200
  const chartWidth = 600
  const padding = 40

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * (chartWidth - 2 * padding)
    const y = chartHeight - padding - ((d.weight - minWeight) / range) * (chartHeight - 2 * padding)
    return { x, y, ...d }
  })

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-400">Range: {minWeight.toFixed(1)} - {maxWeight.toFixed(1)} lbs</span>
        <span className="text-slate-400">{data.length} entries</span>
      </div>
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
          const y = chartHeight - padding - ratio * (chartHeight - 2 * padding)
          const weight = minWeight + ratio * range
          return (
            <g key={i}>
              <line
                x1={padding}
                y1={y}
                x2={chartWidth - padding}
                y2={y}
                stroke="#334155"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text x={padding - 10} y={y + 4} fill="#94a3b8" fontSize="12" textAnchor="end">
                {weight.toFixed(1)}
              </text>
            </g>
          )
        })}

        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="5" fill="#f59e0b" stroke="#1e293b" strokeWidth="2" />
            <title>{`${new Date(p.iso).toLocaleDateString()}: ${p.weight} lbs`}</title>
          </g>
        ))}

        {/* Date labels */}
        {points.filter((_, i) => i === 0 || i === points.length - 1).map((p, i) => (
          <text
            key={i}
            x={p.x}
            y={chartHeight - 10}
            fill="#94a3b8"
            fontSize="11"
            textAnchor="middle"
          >
            {new Date(p.iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </text>
        ))}
      </svg>
    </div>
  )
}

function ActivityList({
  title,
  icon,
  colorClass,
  borderClass,
  items,
  onViewDetails,
  onEdit
}: {
  title: string;
  icon: React.ReactNode;
  colorClass: string;
  borderClass: string;
  items: Array<{ id: string; primary: string; secondary?: string; meta?: string; data?: any }>
  onViewDetails?: (item: any) => void
  onEdit?: (item: any) => void
}) {
  return (
    <div className={`rounded-2xl border ${borderClass} bg-slate-900/70 backdrop-blur-md shadow-2xl shadow-black/30 p-6`}>
      <h3 className={`flex items-center text-sm font-semibold uppercase tracking-wide ${colorClass}`}>
        <span className="mr-2">{icon}</span>{title}
      </h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">No entries logged.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border border-slate-700/40 bg-slate-800/50 px-4 py-3 text-sm text-slate-200 group hover:border-slate-600/60 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-semibold text-white">{item.primary}</p>
                  {item.secondary && <p className="text-xs text-slate-400 mt-1">{item.secondary}</p>}
                  {item.meta && <p className="text-[11px] text-slate-500 mt-1 uppercase tracking-wide">{item.meta}</p>}
                </div>
                <div className="flex items-center gap-2 ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  {onViewDetails && (
                    <button
                      onClick={() => onViewDetails(item)}
                      className="p-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 transition-colors"
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  )}
                  {onEdit && (
                    <button
                      onClick={() => onEdit(item)}
                      className="p-1 rounded-lg bg-primary-500/20 hover:bg-primary-500/30 text-primary-300 transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

