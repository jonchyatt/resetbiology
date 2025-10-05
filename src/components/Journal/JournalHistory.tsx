"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { ChevronsLeft, ChevronsRight, Flame, NotebookPen, Utensils, Droplets, Activity, BrainCircuit, Wind } from "lucide-react"

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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-gray-100">
      <div className="container mx-auto px-4 py-12">
        <header className="mb-10">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-4xl font-bold text-white">Daily History</h1>
              <p className="text-gray-300 mt-2 max-w-2xl">
                Review everything you completed in a dayâ€”peptides, nutrition, workouts, breath practice, mindset modulesâ€”and your journal notes.
              </p>
            </div>
            <Link
              href="/portal"
              className="inline-flex items-center gap-2 rounded-lg border border-secondary-400/40 bg-secondary-500/10 px-4 py-2 text-sm font-medium text-secondary-200 transition hover:border-secondary-300 hover:bg-secondary-500/20"
            >
              Back to Portal
            </Link>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
          <div className="bg-gradient-to-br from-primary-600/10 to-secondary-600/10 rounded-xl border border-primary-400/20 shadow-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={handlePrevMonth}
                className="rounded-lg border border-primary-400/30 bg-primary-500/10 p-2 text-primary-200 transition hover:border-primary-400/50 hover:bg-primary-500/20"
                aria-label="Previous month"
              >
                <ChevronsLeft className="h-5 w-5" />
              </button>
              <div className="text-center">
                <p className="text-sm text-gray-400">Month</p>
                <p className="text-lg font-semibold text-white">{formatMonth(currentMonth)}</p>
              </div>
              <button
                onClick={handleNextMonth}
                className="rounded-lg border border-primary-400/30 bg-primary-500/10 p-2 text-primary-200 transition hover:border-primary-400/50 hover:bg-primary-500/20"
                aria-label="Next month"
              >
                <ChevronsRight className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-7 text-center text-xs font-medium text-gray-400 mb-2">
              {weekdayLabels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-sm text-gray-300">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-secondary-300 border-t-transparent mb-3" />
                Loading history...
              </div>
            ) : error ? (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-2">
                {calendarCells.map((cell, idx) => {
                  if (!cell.inMonth) {
                    return <div key={`blank-${idx}`} className="h-16 rounded-lg bg-gray-800/40" />
                  }

                  const isSelected = selectedDayKey === cell.date
                  const density = cell.count ?? 0
                  let intensity = 'bg-gray-800/40 border-transparent'
                  if (density > 0 && density <= 2) intensity = 'bg-secondary-500/20 border-secondary-400/30'
                  if (density > 2 && density <= 5) intensity = 'bg-secondary-500/40 border-secondary-400/40'
                  if (density > 5) intensity = 'bg-secondary-500/60 border-secondary-400/60'

                  return (
                    <button
                      key={cell.date}
                      onClick={() => setSelectedDayKey(cell.date as string)}
                      className={`h-16 rounded-lg border text-left transition flex flex-col justify-between px-2 py-1 ${intensity} ${isSelected ? 'ring-2 ring-secondary-300' : ''}`}
                    >
                      <span className="text-sm font-semibold text-white">{new Date(cell.iso ?? '').getDate()}</span>
                      <span className="text-[11px] text-gray-300">{density} entries</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="space-y-6">
            {selectedDay ? (
              <DayDetail day={selectedDay} />
            ) : (
              <div className="rounded-xl border border-primary-400/20 bg-primary-500/10 p-8 text-center text-gray-300">
                Select a day on the calendar to view the full history.
              </div>
            )}
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

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-secondary-400/30 bg-gray-900/70 shadow-xl p-6">
        <header className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-gray-400">Selected Day</p>
            <h2 className="text-2xl font-bold text-white">{displayDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h2>
          </div>
          <div className="text-right text-secondary-200">
            <p className="text-xs uppercase tracking-wide">Total Logged</p>
            <p className="text-xl font-semibold">{day.eventCount}</p>
          </div>
        </header>

        {day.journalEntry ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-primary-400/20 bg-primary-500/10 p-4">
              <h3 className="flex items-center text-sm font-semibold text-primary-200 uppercase tracking-wide"><NotebookPen className="mr-2 h-4 w-4" />Journal</h3>
              <ul className="mt-3 space-y-2 text-sm text-gray-200">
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

            <div className="rounded-lg border border-secondary-400/20 bg-secondary-500/10 p-4">
              <h3 className="flex items-center text-sm font-semibold text-secondary-200 uppercase tracking-wide"><Activity className="mr-2 h-4 w-4" />Activity Snapshot</h3>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-gray-400">Meals Logged</dt>
                  <dd className="text-white font-semibold">{day.nutrition.logs.length}</dd>
                </div>
                <div>
                  <dt className="text-gray-400">Peptide Doses</dt>
                  <dd className="text-white font-semibold">{day.peptideDoses.length}</dd>
                </div>
                <div>
                  <dt className="text-gray-400">Workouts</dt>
                  <dd className="text-white font-semibold">{day.workouts.length}</dd>
                </div>
                <div>
                  <dt className="text-gray-400">Breath Sessions</dt>
                  <dd className="text-white font-semibold">{day.breathSessions.length}</dd>
                </div>
                <div>
                  <dt className="text-gray-400">Modules</dt>
                  <dd className="text-white font-semibold">{day.modules.length}</dd>
                </div>
                <div>
                  <dt className="text-gray-400">Calories</dt>
                  <dd className="text-white font-semibold">{Math.round(day.nutrition.totals.calories)} kcal</dd>
                </div>
              </dl>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-700/40 bg-gray-800/40 p-4 text-sm text-gray-300">
            No journal entry saved for this day.
          </div>
        )}
      </section>

      <section className="rounded-xl border border-primary-400/30 bg-gray-900/70 shadow-xl p-6 space-y-4">
        <h3 className="flex items-center text-sm font-semibold uppercase tracking-wide text-primary-200"><Utensils className="mr-2 h-4 w-4" />Nutrition</h3>
        {day.nutrition.logs.length === 0 ? (
          <p className="text-sm text-gray-400">No meals logged.</p>
        ) : (
          <div className="space-y-3">
            {day.nutrition.logs.map((item: any) => {
              const nutrients = item.nutrients as any
              return (
                <div key={item.id} className="rounded-lg border border-gray-700/40 bg-gray-800/40 px-4 py-3 text-sm text-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-white">{item.itemName}</p>
                      <p className="text-xs text-gray-400">{new Date(item.loggedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} â€¢ {item.mealType ?? 'meal'}</p>
                    </div>
                    <span className="text-amber-300 font-semibold">{Math.round(typeof nutrients?.kcal === 'number' ? nutrients.kcal : 0)} kcal</span>
                  </div>
                  <p className="mt-2 text-xs text-gray-400">
                    P {Math.round(typeof nutrients?.protein_g === 'number' ? nutrients.protein_g : 0)}g â€¢
                    C {Math.round(typeof nutrients?.carb_g === 'number' ? nutrients.carb_g : 0)}g â€¢
                    F {Math.round(typeof nutrients?.fat_g === 'number' ? nutrients.fat_g : 0)}g
                  </p>
                </div>
              )
            })}
          </div>
        )}
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
            secondary: `${Math.round((workout.duration ?? 0) / 60)} min â€¢ ${new Date(workout.completedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
            meta: workout.notes || ''
          }))}
        />

        <ActivityList
          title="Breath Sessions"
          icon={<Wind className="h-4 w-4" />}
          colorClass="text-sky-300"
          borderClass="border-sky-400/30"
          items={day.breathSessions.map((session: any) => ({
            id: session.id,
            primary: session.sessionType,
            secondary: `${Math.round((session.duration ?? 0) / 60)} min â€¢ ${session.cycles ?? 0} cycles`,
            meta: new Date(session.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
          }))}
        />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <ActivityList
          title="Peptide Doses"
          icon={<Droplets className="h-4 w-4" />}
          colorClass="text-emerald-300"
          borderClass="border-emerald-400/30"
          items={day.peptideDoses.map((dose: any) => ({
            id: dose.id,
            primary: dose.user_peptide_protocols?.peptides?.name || 'Peptide dose',
            secondary: dose.dosage,
            meta: `${dose.time || ''} ${new Date(dose.doseDate).toLocaleDateString()}`.trim()
          }))}
        />

        <ActivityList
          title="Mental Modules"
          icon={<BrainCircuit className="h-4 w-4" />}
          colorClass="text-purple-300"
          borderClass="border-purple-400/30"
          items={day.modules.map((module: any) => ({
            id: module.id,
            primary: module.moduleId,
            secondary: `${module.fullCompletion ? 'Completed' : 'Partial'}${module.audioDuration ? ` â€¢ ${Math.round(module.audioDuration / 60)} min audio` : ''}`,
            meta: new Date(module.completedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
          }))}
        />
      </section>

      <section className="rounded-xl border border-secondary-400/30 bg-gray-900/70 shadow-xl p-6">
        <h3 className="flex items-center text-sm font-semibold uppercase tracking-wide text-secondary-200 mb-3"><Flame className="mr-2 h-4 w-4" />Journal Notes</h3>
        <div className="space-y-2 text-sm text-gray-200">
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
            <p className="text-gray-400">No activity notes logged yet. Entries will appear here automatically as you complete tasks.</p>
          )}
        </div>
      </section>
    </div>
  )
}

function ActivityList({ title, icon, colorClass, borderClass, items }: { title: string; icon: React.ReactNode; colorClass: string; borderClass: string; items: Array<{ id: string; primary: string; secondary?: string; meta?: string }> }) {
  return (
    <div className={`rounded-xl border ${borderClass} bg-gray-900/70 shadow-xl p-6`}>
      <h3 className={`flex items-center text-sm font-semibold uppercase tracking-wide ${colorClass}`}>
        <span className="mr-2">{icon}</span>{title}
      </h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-gray-400">No entries logged.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border border-gray-700/40 bg-gray-800/40 px-4 py-3 text-sm text-gray-200">
              <p className="font-semibold text-white">{item.primary}</p>
              {item.secondary && <p className="text-xs text-gray-400 mt-1">{item.secondary}</p>}
              {item.meta && <p className="text-[11px] text-gray-500 mt-1 uppercase tracking-wide">{item.meta}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
