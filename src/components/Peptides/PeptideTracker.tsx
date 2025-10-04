"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Syringe, Calendar, AlertCircle, TrendingUp, Plus, Clock, X } from "lucide-react"
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
  dateKey: string
}

export function PeptideTracker() {
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current')
  const [currentProtocols, setCurrentProtocols] = useState<PeptideProtocol[]>([])
  const [todaysDoses, setTodaysDoses] = useState<DoseEntry[]>([])
  const getTodayKey = () => new Date().toISOString().split('T')[0]
  const [todayKey, setTodayKey] = useState<string>(getTodayKey)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [selectedProtocol, setSelectedProtocol] = useState<(PeptideProtocol & { scheduledDoseId?: string }) | null>(null)
  const [showDoseModal, setShowDoseModal] = useState(false)
  const [showCalculatorModal, setShowCalculatorModal] = useState(false)
  const [showAddProtocolModal, setShowAddProtocolModal] = useState(false)
  const [doseNotes, setDoseNotes] = useState('')
  const [doseSideEffects, setDoseSideEffects] = useState<string[]>([])
  const [selectedPeptideName, setSelectedPeptideName] = useState('')
  const [customDosage, setCustomDosage] = useState('')
  const [customFrequency, setCustomFrequency] = useState('')
  const [customTiming, setCustomTiming] = useState('')
  const [customDuration, setCustomDuration] = useState('')
  const [peptideLibrary, setPeptideLibrary] = useState<Omit<PeptideProtocol, 'startDate' | 'currentCycle' | 'isActive'>[]>([])
  const [loadingLibrary, setLoadingLibrary] = useState(true)
  const [doseHistory, setDoseHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyMonth, setHistoryMonth] = useState<Date>(() => new Date())
  const bootstrapped = useRef(false)

  const fetchTodaysDoses = useCallback(async (dayKey: string = todayKey) => {
    try {
      const response = await fetch(`/api/peptides/doses?date=${dayKey}`, {
        credentials: 'include'
      })
      const data = await response.json()

      if (data.success && data.doses) {
        const completedToday = data.doses
          .map((dose: any) => {
            const doseDateKey = dose.doseDate
              ? new Date(dose.doseDate).toISOString().split('T')[0]
              : dayKey
            if (doseDateKey !== dayKey) return null

            return {
              id: dose.id,
              peptideId: dose.protocolId,
              scheduledTime: dose.time,
              completed: true,
              actualTime: dose.doseDate,
              notes: dose.notes || dose.sideEffects || '',
              sideEffects: dose.sideEffects ? String(dose.sideEffects).split(',').map((s: string) => s.trim()).filter(Boolean) : undefined,
              dateKey: doseDateKey,
            } as DoseEntry | null
          })
          .filter(Boolean) as DoseEntry[]

        setTodaysDoses((currentDoses: DoseEntry[]) => {
          const relevantPending = currentDoses.filter(
            (dose) => !dose.completed && dose.dateKey === dayKey
          )

          const merged = new Map<string, DoseEntry>()
          for (const dose of [...completedToday, ...relevantPending]) {
            merged.set(dose.id, dose)
          }
          return Array.from(merged.values())
        })
      }
    } catch (error) {
      console.error('Error fetching today\'s doses:', error)
    }
  }, [todayKey])

  const parseTimeToMinutes = useCallback((time: string) => {
    const [hoursStr, minutesStr] = time.split(':')
    const hours = Number.parseInt(hoursStr, 10)
    const minutes = Number.parseInt(minutesStr ?? '0', 10)
    if (!Number.isFinite(hours)) return 24 * 60
    return hours * 60 + (Number.isFinite(minutes) ? minutes : 0)
  }, [])

  const todaysDoseBuckets = useMemo(() => {
    const pending = todaysDoses
      .filter((dose) => !dose.completed)
      .sort((a, b) => parseTimeToMinutes(a.scheduledTime) - parseTimeToMinutes(b.scheduledTime))

    const completed = todaysDoses
      .filter((dose) => dose.completed)
      .sort((a, b) => {
        const fallbackA = parseTimeToMinutes(a.scheduledTime) * 60 * 1000
        const fallbackB = parseTimeToMinutes(b.scheduledTime) * 60 * 1000
        const timeA = a.actualTime ? new Date(a.actualTime).getTime() : fallbackA
        const timeB = b.actualTime ? new Date(b.actualTime).getTime() : fallbackB
        return timeB - timeA
      })

    return { pending, completed }
  }, [todaysDoses, parseTimeToMinutes])

  const doseHistoryByDate = useMemo(() => {
    const map = new Map<string, { count: number; labels: Set<string> }>()

    doseHistory.forEach((dose: any) => {
      const rawDate = dose?.doseDate || dose?.createdAt || dose?.updatedAt
      if (!rawDate) return

      const key = new Date(rawDate).toISOString().split('T')[0]
      if (!map.has(key)) {
        map.set(key, { count: 0, labels: new Set<string>() })
      }

      const entry = map.get(key)!
      entry.count += 1
      const protocolName = dose?.user_peptide_protocols?.peptides?.name ?? dose?.protocolName ?? ''
      if (protocolName) {
        entry.labels.add(protocolName)
      }
    })

    return map
  }, [doseHistory])

  const historyCalendar = useMemo(() => {
    const year = historyMonth.getFullYear()
    const month = historyMonth.getMonth()
    const firstOfMonth = new Date(year, month, 1)
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const leadingBlanks = firstOfMonth.getDay()
    const cells: Array<{
      key: string
      label: string
      count: number
      items: string[]
      date: Date
    } | null> = []

    for (let i = 0; i < leadingBlanks; i += 1) {
      cells.push(null)
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day)
      const key = date.toISOString().split('T')[0]
      const summary = doseHistoryByDate.get(key)

      cells.push({
        key,
        label: String(day),
        count: summary?.count ?? 0,
        items: summary ? Array.from(summary.labels) : [],
        date,
      })
    }

    while (cells.length % 7 !== 0) {
      cells.push(null)
    }

    return cells
  }, [historyMonth, doseHistoryByDate])

  const calendarDensityClass = (count: number, isToday: boolean) => {
    if (count <= 0) {
      return isToday
        ? 'border-primary-400/50 text-primary-200 bg-gray-800/40'
        : 'border-gray-700/40 text-gray-500 bg-gray-800/30'
    }

    if (count === 1) return 'bg-primary-500/15 border-primary-400/40 text-primary-100'
    if (count === 2) return 'bg-primary-500/30 border-primary-400/60 text-primary-50'
    return 'bg-primary-500/50 border-primary-300 text-white shadow-inner'
  }

  const goToPreviousMonth = () => {
    setHistoryMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setHistoryMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const historyMonthLabel = historyMonth.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  // Fetch peptide library and user protocols from database
  useEffect(() => {
    if (bootstrapped.current) return
    bootstrapped.current = true

    const loadData = async () => {
      fetchPeptideLibrary()
      // Load doses first, then protocols (so doses are in state when protocols generate pending)
      await fetchTodaysDoses()
      await fetchUserProtocols()
      fetchDoseHistory()
    }
    loadData()
  }, [fetchTodaysDoses])

  // Auto-generate today's doses when protocols change (preserve existing logged doses)
  useEffect(() => {
    if (currentProtocols.length === 0) {
      setTodaysDoses((current) => current.filter((dose) => dose.completed && dose.dateKey === todayKey))
      return
    }

    generateTodaysDosesPreservingLogged(currentProtocols, todayKey)
  }, [currentProtocols, todayKey])

  useEffect(() => {
    const interval = setInterval(() => {
      const key = getTodayKey()
      if (key !== todayKey) {
        setTodaysDoses([])
        setTodayKey(key)
      }
    }, 60_000)

    return () => clearInterval(interval)
  }, [todayKey])

  useEffect(() => {
    fetchTodaysDoses(todayKey)
  }, [todayKey, fetchTodaysDoses])

  const fetchUserProtocols = async () => {
    try {
      const response = await fetch('/api/peptides/protocols', {
        credentials: 'include'
      })
      const data = await response.json()

      if (data.success && data.protocols) {
        // Transform API data to match our interface
        const formattedProtocols = data.protocols.map((protocol: any) => ({
          id: protocol.id,
          name: protocol.peptides?.name || 'Unknown',
          purpose: protocol.peptides?.category || 'General',
          dosage: protocol.dosage,
          timing: protocol.notes?.replace('Timing: ', '') || 'AM',
          frequency: protocol.frequency,
          duration: '8 weeks',
          vialAmount: '10mg',
          reconstitution: protocol.peptides?.reconstitution || '2ml',
          syringeUnits: 10,
          startDate: protocol.startDate ? new Date(protocol.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          currentCycle: 1,
          isActive: protocol.isActive
        }))
        setCurrentProtocols(formattedProtocols)
        console.log(`✅ Loaded ${formattedProtocols.length} protocols from database`)
      } else if (response.status === 401) {
        console.log('⚠️ User not logged in - cannot load protocols')
      } else {
        console.error('Failed to fetch protocols:', data.error)
      }
    } catch (error) {
      console.error('Error fetching user protocols:', error)
    }
  }

  const fetchPeptideLibrary = async () => {
    try {
      setLoadingLibrary(true)
      const response = await fetch('/api/peptides', {
        credentials: 'include'
      })
      const data = await response.json()

      if (data.success && data.data) {
        // Transform API data to match our interface
        const formattedLibrary = data.data.map((peptide: any) => ({
          id: peptide.id,
          name: peptide.name,
          purpose: peptide.category || 'General',
          dosage: peptide.dosage || '250mcg',
          timing: 'AM',
          frequency: 'Daily',
          duration: '8 weeks',
          vialAmount: '10mg',
          reconstitution: peptide.reconstitution || '2ml',
          syringeUnits: 10
        }))
        setPeptideLibrary(formattedLibrary)
      } else {
        console.error('Failed to fetch peptide library:', data.error)
        // Fallback to hardcoded library if API fails
        setPeptideLibrary(fallbackLibrary)
      }
    } catch (error) {
      console.error('Error fetching peptide library:', error)
      // Fallback to hardcoded library if API fails
      setPeptideLibrary(fallbackLibrary)
    } finally {
      setLoadingLibrary(false)
    }
  }

  const fetchDoseHistory = async () => {
    try {
      setLoadingHistory(true)
      const response = await fetch('/api/peptides/doses?limit=50', {
        credentials: 'include'
      })
      const data = await response.json()

      if (data.success && data.doses) {
        setDoseHistory(data.doses)
        console.log(`✅ Loaded ${data.doses.length} historical doses`)
      }
    } catch (error) {
      console.error('Error fetching dose history:', error)
    } finally {
      setLoadingHistory(false)
    }
  }

  // Fallback library in case API fails
  const fallbackLibrary: Omit<PeptideProtocol, 'startDate' | 'currentCycle' | 'isActive'>[] = [
    {
      id: 'fallback-1',
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
      id: 'fallback-2',
      name: "BPC-157",
      purpose: "Healing",
      dosage: "500mcg",
      timing: "AM & PM (twice daily)",
      frequency: "Daily",
      duration: "4-6 weeks",
      vialAmount: "10mg",
      reconstitution: "3ml",
      syringeUnits: 10
    }
  ]

  const handleSaveProtocol = async (protocolData: {
    peptideId?: string;
    peptideName: string;
    dosage: string;
    schedule: {
      days: string[];
      times: string[];
      frequency: string;
    };
    duration: string;
    vialAmount: string;
    reconstitution: string;
    notes?: string;
  }) => {
    // Check if protocol already exists
    const existingProtocol = currentProtocols.find(protocol => protocol.name === protocolData.peptideName)
    if (existingProtocol) {
      alert(`${protocolData.peptideName} is already in your active protocols. Only one instance per peptide is allowed.`)
      return
    }

    // Save to database
    try {
      const response = await fetch('/api/peptides/protocols', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          peptideName: protocolData.peptideName,
          dosage: protocolData.dosage,
          frequency: protocolData.schedule.frequency,
          notes: protocolData.notes || `Schedule: ${protocolData.schedule.frequency}`
        })
      })

      const data = await response.json()

      if (data.success) {
        // Find peptide details from library
        const peptide = peptideLibrary.find(p => p.name === protocolData.peptideName)

        // Add to local state
        const newProtocol: PeptideProtocol = {
          id: data.protocol.id,
          name: protocolData.peptideName,
          purpose: peptide?.purpose || 'General',
          dosage: protocolData.dosage,
          timing: protocolData.schedule.times.join('/'),
          frequency: protocolData.schedule.frequency,
          duration: protocolData.duration,
          vialAmount: protocolData.vialAmount,
          reconstitution: protocolData.reconstitution,
          syringeUnits: 10,
          startDate: new Date().toISOString().split('T')[0],
          currentCycle: 1,
          isActive: true
        }

        setCurrentProtocols([...currentProtocols, newProtocol])

        // Modal will be closed by DosageCalculator onClose callback
        console.log(`✅ Protocol added: ${protocolData.peptideName}`)
      } else {
        alert(`Failed to add protocol: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error adding protocol:', error)
      alert('Failed to add protocol. Please try again.')
      throw error // Re-throw so DosageCalculator can handle it
    }
  }

  const generateTodaysDosesPreservingLogged = (protocols: PeptideProtocol[], dayKey: string) => {
    const slotsForProtocol = (protocol: PeptideProtocol) => {
      if (protocol.timing.toLowerCase().includes('twice daily')) {
        return [
          { id: 'am', time: '08:00', period: 'am' as const },
          { id: 'pm', time: '20:00', period: 'pm' as const },
        ]
      }

      const defaultTime = protocol.timing.includes('AM')
        ? '08:00'
        : protocol.timing.includes('PM')
          ? '20:00'
          : '12:00'

      return [{ id: '0', time: defaultTime, period: 'any' as const }]
    }

    setTodaysDoses((current) => {
      const activeProtocols = protocols.filter((protocol) => protocol.isActive)
      const activeIds = new Set(activeProtocols.map((protocol) => protocol.id))

      const logged = current.filter(
        (dose) => dose.completed && dose.dateKey === dayKey && activeIds.has(dose.peptideId)
      )

      const pendingMap = new Map(
        current
          .filter(
            (dose) => !dose.completed && dose.dateKey === dayKey && activeIds.has(dose.peptideId)
          )
          .map((dose) => [dose.id, dose])
      )

      const hasLoggedForSlot = (protocolId: string, slot: { period: 'am' | 'pm' | 'any'; time: string }) => {
        return logged.some((dose) => {
          if (dose.peptideId !== protocolId) return false
          if (!dose.actualTime) return slot.period === 'any'

          const loggedHour = new Date(dose.actualTime).getHours()
          if (slot.period === 'am') return loggedHour < 12
          if (slot.period === 'pm') return loggedHour >= 12
          return true
        })
      }

      activeProtocols.forEach((protocol) => {
        slotsForProtocol(protocol).forEach((slot) => {
          const pendingId = `${protocol.id}-${dayKey}-${slot.id}`
          const alreadyLogged = hasLoggedForSlot(protocol.id, slot)
          const alreadyPending = pendingMap.has(pendingId)

          if (!alreadyLogged && !alreadyPending) {
            pendingMap.set(pendingId, {
              id: pendingId,
              peptideId: protocol.id,
              scheduledTime: slot.time,
              completed: false,
              dateKey: dayKey,
            })
          }
        })
      })

      const pending = Array.from(pendingMap.values())
        .filter((dose) => activeIds.has(dose.peptideId))

      return [...logged, ...pending]
    })
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
    setSelectedProtocol({ ...protocol, scheduledDoseId: doseId })
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

  const logDose = async () => {
    if (!selectedProtocol) return

    const now = new Date()
    const currentTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

    // Save dose to database
    try {
      const response = await fetch('/api/peptides/doses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          protocolId: selectedProtocol.id,
          dosage: selectedProtocol.dosage,
          time: currentTime,
          notes: doseNotes || null,
          sideEffects: doseSideEffects.length > 0 ? doseSideEffects.join(', ') : null,
          doseDate: now.toISOString()
        })
      })

      const data = await response.json()

      if (data.success) {
        console.log('✅ Dose logged successfully')

        // Create the completed dose entry
        const doseKey = now.toISOString().split('T')[0]

        const newDose: DoseEntry = {
          id: data.dose?.id || `${selectedProtocol.id}-logged-${Date.now()}`,
          peptideId: selectedProtocol.id,
          scheduledTime: currentTime,
          actualTime: now.toISOString(),
          completed: true,
          notes: doseNotes || undefined,
          sideEffects: doseSideEffects.length > 0 ? doseSideEffects : undefined,
          dateKey: doseKey,
        }

        // Remove ALL pending doses for this protocol and add the completed dose
        setTodaysDoses(prev => {
          // Filter out any pending doses for this protocol
          const withoutPending = prev.filter(dose =>
            !(dose.peptideId === selectedProtocol.id && !dose.completed)
          )
          // Add the new completed dose
          return [...withoutPending.filter((dose) => dose.dateKey === doseKey), newDose]
        })

        // Refresh dose history
        fetchDoseHistory()
      } else {
        console.error('Failed to save dose:', data.error)
        alert('Failed to save dose. Please try again.')
      }
    } catch (error) {
      console.error('Error saving dose:', error)
      alert('Failed to save dose. Please try again.')
    }

    setShowDoseModal(false)
    setSelectedProtocol(null)
  }

  const deleteDose = async (doseId: string) => {
    if (!confirm('Are you sure you want to delete this dose?')) {
      return
    }

    try {
      const response = await fetch(`/api/peptides/doses?id=${doseId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      const data = await response.json()

      if (data.success) {
        console.log('✅ Dose deleted successfully')
        // Remove from local state
        setTodaysDoses(prev => prev.filter(d => d.id !== doseId))
        // Refresh history
        fetchDoseHistory()
      } else {
        console.error('Failed to delete dose:', data.error)
        alert('Failed to delete dose. Please try again.')
      }
    } catch (error) {
      console.error('Error deleting dose:', error)
      alert('Failed to delete dose. Please try again.')
    }
  }

  const deleteProtocol = async (protocolId: string) => {
    if (!confirm('Are you sure you want to delete this protocol? Your dose history will be preserved.')) {
      return
    }

    try {
      const response = await fetch(`/api/peptides/protocols?id=${protocolId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      const data = await response.json()

      if (data.success) {
        console.log('✅ Protocol deleted successfully')
        // Refresh protocols and doses
        fetchUserProtocols()
        fetchTodaysDoses()
        fetchDoseHistory()
      } else {
        console.error('Failed to delete protocol:', data.error)
        alert('Failed to delete protocol. Please try again.')
      }
    } catch (error) {
      console.error('Error deleting protocol:', error)
      alert('Failed to delete protocol. Please try again.')
    }
  }

  const SyringeScale = ({ units }: { units: number }) => {
    const numericUnits = Number(units)
    const normalizedUnits = Number.isFinite(numericUnits) ? Math.max(0, Math.min(numericUnits, 100)) : 0
    const fillPercent = Math.min(100, Math.max(0, (normalizedUnits / 100) * 100))
    const volumeMl = normalizedUnits / 100
    const displayUnits = Number(normalizedUnits.toFixed(1))
    const displayVolume = Number(volumeMl.toFixed(volumeMl < 1 ? 3 : 2))

    const pointerPosition = Math.min(Math.max(fillPercent, 0), 100)
    const pointerStyle =
      pointerPosition <= 0
        ? { left: '0%', transform: 'translateY(-50%)' }
        : pointerPosition >= 100
          ? { left: '100%', transform: 'translate(-100%, -50%)' }
          : { left: `${pointerPosition}%`, transform: 'translate(-50%, -50%)' }

    const ticks = [0, 25, 50, 75, 100]

    return (
      <div className="mt-3">
        <div className="relative mt-1 h-2 rounded-full bg-gray-700/40 overflow-hidden">
          <div className="absolute inset-y-0 left-0 bg-primary-500/70" style={{ width: `${fillPercent}%` }} />
          <div
            className="absolute top-1/2 h-4 w-[2px] bg-primary-200"
            style={pointerStyle}
          />
          {ticks.map((tick) => (
            <div
              key={tick}
              className="absolute inset-y-0 w-px bg-white/20"
              style={{ left: `${tick}%` }}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[9px] uppercase tracking-wide text-gray-500">
          {ticks.map((tick) => (
            <span key={tick}>{tick}u</span>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Draw {displayUnits} units ({displayVolume} ml)
        </p>
      </div>
    )
  }

  const PeptideCard = ({ protocol }: { protocol: PeptideProtocol }) => {
    // Remove "- peptide" and "Package" suffix from display name
    const displayName = protocol.name
      .replace(/\s*-\s*peptide\s*$/i, '')
      .replace(/\s+Package\s*$/i, '')
      .trim();

    return (
      <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/30 rounded-lg p-6 border border-primary-400/30 backdrop-blur-sm shadow-xl hover:shadow-primary-400/20 transition-all duration-300">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-white">{displayName}</h3>
          </div>
          <button
            onClick={() => deleteProtocol(protocol.id)}
            className="text-red-400 hover:text-red-300 transition-colors"
            title="Delete Protocol"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-4">
          {/* Left side - Protocol details */}
          <div className="flex-1 space-y-3 text-sm">
            <div className="space-y-2">
              <div>
                <span className="text-gray-400">Dosage:</span>
                <span className="text-white font-medium ml-2">{protocol.dosage}</span>
              </div>
              <div>
                <span className="text-gray-400">Timing:</span>
                <span className="text-white font-medium ml-2">{protocol.timing}</span>
              </div>
            </div>

            <div className="border-t border-gray-600 pt-3">
              <span className="text-gray-400">Preparation:</span>
              <p className="text-gray-300 text-xs mt-1">
                {protocol.vialAmount} vial + {protocol.reconstitution} BAC water = {protocol.syringeUnits} units per dose
              </p>
              <SyringeScale units={protocol.syringeUnits} />
            </div>
          </div>

          {/* Right side - Action buttons */}
          <div className="flex flex-col gap-2 justify-center">
            <button
              onClick={() => openScheduleModal(protocol)}
              className="bg-primary-600/30 hover:bg-primary-600/50 text-primary-200 font-medium py-2 px-4 rounded-lg transition-colors text-sm whitespace-nowrap"
            >
              View Schedule
            </button>
            <button
              onClick={() => openDoseModal(protocol)}
              className="bg-secondary-600/30 hover:bg-secondary-600/50 text-secondary-200 font-medium py-2 px-4 rounded-lg transition-colors text-sm whitespace-nowrap"
            >
              Log Dose
            </button>
            <button
              onClick={() => openCalculatorModal(protocol)}
              className="bg-amber-300/30 hover:bg-amber-300/50 text-amber-100 font-semibold py-2 px-4 rounded-lg border border-amber-200/40 backdrop-blur-sm transition-all text-sm whitespace-nowrap shadow-[0_0_20px_rgba(245,193,92,0.35)]"
            >
              Dose Calculator
            </button>
          </div>
        </div>
      </div>
    );
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
              {(['current', 'history'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-3 rounded-lg font-medium transition-all capitalize ${
                    activeTab === tab 
                      ? 'bg-primary-500 text-white shadow-lg' 
                      : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                  }`}
                >
                  {tab === 'current' ? 'Current Protocols' : 'History'}
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
                      <div className="space-y-4">
                        {todaysDoseBuckets.pending.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs uppercase tracking-wide text-gray-400/80">
                              Due soon
                            </p>
                            {todaysDoseBuckets.pending.map((dose, index) => {
                              const protocol = currentProtocols.find(p => p.id === dose.peptideId)
                              const isNext = index === 0
                              return (
                                <div
                                  key={dose.id}
                                  className={`p-3 rounded-lg border transition-all ${
                                    isNext
                                      ? 'bg-primary-900/30 border-primary-500/40 shadow-lg'
                                      : 'bg-gray-700/30 border-gray-600/30 hover:bg-gray-700/50'
                                  }`}
                                >
                                  <div className="flex justify-between items-start mb-2">
                                    <div>
                                      <span className="font-medium text-white">{protocol?.name || 'Unknown Protocol'}</span>
                                      <p className="text-xs text-gray-400">{protocol?.dosage}</p>
                                    </div>
                                    <div className="text-right">
                                      <span className="text-sm text-gray-100 font-semibold">
                                        {dose.scheduledTime}
                                      </span>
                                      <div className="flex items-center justify-end mt-1 text-xs">
                                        <div className={`w-4 h-4 rounded mr-1 flex items-center justify-center ${isNext ? 'bg-primary-500/80' : 'border border-gray-400'}`}>
                                          {isNext && <div className="w-2 h-2 bg-white rounded" />}
                                        </div>
                                        <span className={isNext ? 'text-primary-200 font-semibold uppercase tracking-wide' : 'text-gray-400'}>
                                          {isNext ? 'Next dose' : 'Scheduled'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {todaysDoseBuckets.completed.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs uppercase tracking-wide text-green-400/80">
                              Logged today
                            </p>
                            {todaysDoseBuckets.completed.map((dose) => {
                              const protocol = currentProtocols.find(p => p.id === dose.peptideId)
                              return (
                                <div key={dose.id} className="p-3 rounded-lg border transition-all bg-green-900/20 border-green-600/30">
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="flex-1">
                                      <span className="font-medium text-white">{protocol?.name || 'Unknown Protocol'}</span>
                                      <p className="text-xs text-gray-400">{protocol?.dosage}</p>
                                    </div>
                                    <div className="text-right flex items-start gap-2">
                                      <div>
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
                                      <button
                                        onClick={() => deleteDose(dose.id)}
                                        className="text-red-400 hover:text-red-300 transition-colors"
                                        title="Delete dose"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>

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
                      onClick={() => setShowAddProtocolModal(true)}
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
                        onClick={() => setShowAddProtocolModal(true)}
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


          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-8 border border-primary-400/30 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-8 h-8 text-primary-400" />
                    <h3 className="text-2xl font-bold text-white">Treatment History</h3>
                  </div>
                  <button
                    onClick={fetchDoseHistory}
                    className="bg-primary-600/20 hover:bg-primary-600/30 text-primary-300 px-4 py-2 rounded-lg transition-colors"
                  >
                    Refresh
                  </button>
                </div>

                {loadingHistory ? (
                  <div className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full mx-auto mb-3"></div>
                    <p className="text-gray-300">Loading history...</p>
                  </div>
                ) : doseHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-200 mb-4">No dose history yet</p>
                    <p className="text-sm text-gray-400">Start logging doses to build your treatment history!</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-6 rounded-xl border border-primary-400/30 bg-gray-900/40 p-4 shadow-inner">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-primary-300" />
                          <h4 className="text-lg font-semibold text-white">Calendar overview</h4>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-300">
                          <button
                            onClick={goToPreviousMonth}
                            className="h-8 w-8 rounded-full border border-primary-400/40 text-primary-200 hover:bg-primary-500/20 transition"
                            aria-label="View previous month"
                          >
                            ‹
                          </button>
                          <span className="font-medium text-primary-100">{historyMonthLabel}</span>
                          <button
                            onClick={goToNextMonth}
                            className="h-8 w-8 rounded-full border border-primary-400/40 text-primary-200 hover:bg-primary-500/20 transition"
                            aria-label="View next month"
                          >
                            ›
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-7 gap-2 text-[11px] uppercase tracking-wide text-gray-500 mb-2">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                          <div key={day} className="text-center font-medium">{day}</div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-2">
                        {historyCalendar.map((cell, index) => {
                          if (!cell) {
                            return <div key={`empty-${index}`} className="h-16 rounded-lg border border-transparent" />
                          }

                          const isToday = cell.key === todayKey
                          const densityClass = calendarDensityClass(cell.count, isToday)

                          return (
                            <div
                              key={cell.key}
                              className={`min-h-[68px] rounded-lg border px-2 py-2 text-center transition-all duration-300 ${densityClass}`}
                            >
                              <div className="text-sm font-semibold">{cell.label}</div>
                              <div className="mt-1 text-[10px] uppercase tracking-wide opacity-80">
                                {cell.count > 0 ? `${cell.count} dose${cell.count === 1 ? '' : 's'}` : '—'}
                              </div>
                              {cell.items.length > 0 && (
                                <div className="mt-1 text-[10px] text-primary-50 leading-tight overflow-hidden text-ellipsis">
                                  {cell.items.join(', ')}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {doseHistory.map((dose: any) => {
                        const doseDateSource = dose?.doseDate || dose?.createdAt || dose?.updatedAt || new Date().toISOString()
                        const doseDate = new Date(doseDateSource)
                        const protocol = dose.user_peptide_protocols
                        return (
                          <div key={dose.id} className="p-4 bg-gray-700/30 rounded-lg border border-gray-600/30">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                <h4 className="font-semibold text-white">
                                  {protocol?.peptides?.name || 'Unknown Peptide'}
                                </h4>
                                <p className="text-sm text-gray-400">
                                  {dose.dosage} - {dose.time}
                                </p>
                              </div>
                              <div className="text-right flex items-start gap-2">
                                <div>
                                  <p className="text-sm text-gray-300">
                                    {doseDate.toLocaleDateString()}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {doseDate.toLocaleTimeString()}
                                  </p>
                                </div>
                                <button
                                  onClick={() => deleteDose(dose.id)}
                                  className="text-red-400 hover:text-red-300 transition-colors"
                                  title="Delete dose"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            {dose.notes && (
                              <p className="text-sm text-gray-300 mt-2 italic">
                                Notes: {dose.notes}
                              </p>
                            )}
                            {dose.sideEffects && (
                              <p className="text-sm text-yellow-400 mt-1">
                                Side Effects: {dose.sideEffects}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
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

        {/* Add Protocol Modal - Now using Enhanced DosageCalculator */}
        {showAddProtocolModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-primary-900/95 via-gray-900/95 to-secondary-900/95 rounded-3xl max-w-7xl w-full max-h-[92vh] overflow-hidden shadow-[0_0_100px_rgba(63,191,181,0.3)] border border-primary-400/40">
              <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-md border-b border-primary-400/30 px-8 py-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-primary-300 to-secondary-300 bg-clip-text text-transparent">
                      Add Research Protocol
                    </h2>
                    <p className="text-primary-200 mt-1">Select a peptide and scheduling details for tracking</p>
                  </div>
                  <button
                    onClick={() => setShowAddProtocolModal(false)}
                    className="bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-red-200 rounded-full p-3 transition-all duration-300 hover:scale-110"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              <div className="overflow-y-auto max-h-[calc(92vh-100px)] custom-scrollbar p-8">
                <DosageCalculator
                  mode="addProtocol"
                  peptideLibrary={peptideLibrary.map(p => ({
                    id: p.id,
                    name: p.name,
                    dosage: p.dosage,
                    category: p.purpose,
                    reconstitution: p.reconstitution,
                    vialAmount: p.vialAmount
                  }))}
                  onSaveProtocol={handleSaveProtocol}
                  onClose={() => setShowAddProtocolModal(false)}
                />
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
                      Dosage Calculator
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
                    id: selectedProtocol.id || 'temp',
                    name: selectedProtocol.name,
                    vialSize: parseFloat(selectedProtocol.vialAmount.replace(/[^0-9.]/g, '')),
                    recommendedDose: parseFloat(selectedProtocol.dosage.replace(/[^0-9.]/g, ''))
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

