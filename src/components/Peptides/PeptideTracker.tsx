"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Syringe, Calendar, AlertCircle, TrendingUp, Plus, Clock, X, Edit, ChevronDown, Bell } from "lucide-react"
import { DosageCalculator } from './DosageCalculator'
import NotificationPreferences from '@/components/Notifications/NotificationPreferences'

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
  // Helper function to convert Date to local YYYY-MM-DD (not UTC)
  const dateToLocalKey = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const [activeTab, setActiveTab] = useState<'current' | 'calendar'>('current')
  const [currentProtocols, setCurrentProtocols] = useState<PeptideProtocol[]>([])
  const [todaysDoses, setTodaysDoses] = useState<DoseEntry[]>([])
  // Get today's date in user's local timezone (not UTC)
  const getTodayKey = () => dateToLocalKey(new Date())
  const [todayKey, setTodayKey] = useState<string>(getTodayKey)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [selectedProtocol, setSelectedProtocol] = useState<(PeptideProtocol & { scheduledDoseId?: string }) | null>(null)
  const [showDoseModal, setShowDoseModal] = useState(false)
  const [showCalculatorModal, setShowCalculatorModal] = useState(false)
  const [showAddProtocolModal, setShowAddProtocolModal] = useState(false)
  const [showEditProtocolModal, setShowEditProtocolModal] = useState(false)
  const [editingProtocol, setEditingProtocol] = useState<PeptideProtocol | null>(null)
  const [doseNotes, setDoseNotes] = useState('')
  const [doseSideEffects, setDoseSideEffects] = useState<string[]>([])
  const [selectedPeptideName, setSelectedPeptideName] = useState('')
  const [customDosage, setCustomDosage] = useState('')
  const [customFrequency, setCustomFrequency] = useState('')
  const [customTiming, setCustomTiming] = useState('')
  const [customDuration, setCustomDuration] = useState('')
  const [customTimesArray, setCustomTimesArray] = useState<string[]>([])
  const [newCustomTimeInput, setNewCustomTimeInput] = useState<string>('08:00')
  const [peptideLibrary, setPeptideLibrary] = useState<Omit<PeptideProtocol, 'startDate' | 'currentCycle' | 'isActive'>[]>([])
  const [loadingLibrary, setLoadingLibrary] = useState(true)
  const [doseHistory, setDoseHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyMonth, setHistoryMonth] = useState<Date>(() => new Date())
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string | null>(null)
  const [showNotificationModal, setShowNotificationModal] = useState(false)
  const [selectedProtocolForNotif, setSelectedProtocolForNotif] = useState<string | null>(null)
  const [protocolNotifications, setProtocolNotifications] = useState<Record<string, boolean>>({})
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
            // Use localDate if available (timezone-safe), otherwise fall back to doseDate conversion
            const doseDateKey = dose.localDate || (dose.doseDate
              ? new Date(dose.doseDate).toISOString().split('T')[0]
              : dayKey)
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

  // Generate future doses based on active protocols
  const generateFutureDoses = useCallback((protocols: PeptideProtocol[], endDate: Date) => {
    const futureDoses: Array<{ date: string; protocolName: string; completed: boolean }> = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    protocols.filter(p => p.isActive).forEach((protocol) => {
      const startDate = protocol.startDate ? new Date(protocol.startDate) : new Date()
      startDate.setHours(0, 0, 0, 0)

      const frequency = protocol.frequency.toLowerCase()
      let currentDate = new Date(Math.max(today.getTime(), startDate.getTime()))

      // Generate doses until endDate
      while (currentDate <= endDate) {
        let shouldSchedule = false

        // Determine if dose should be scheduled based on frequency
        if (frequency.includes('daily') || frequency.includes('every day')) {
          shouldSchedule = true
        } else if (frequency.includes('every other day')) {
          const daysSinceStart = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
          shouldSchedule = daysSinceStart % 2 === 0
        } else if (frequency.includes('3x per week')) {
          const dayOfWeek = currentDate.getDay()
          shouldSchedule = [1, 3, 5].includes(dayOfWeek) // Mon, Wed, Fri
        } else if (frequency.includes('2x per week')) {
          const dayOfWeek = currentDate.getDay()
          shouldSchedule = [1, 4].includes(dayOfWeek) // Mon, Thu
        } else if (frequency.includes('5 days on')) {
          const dayOfWeek = currentDate.getDay()
          shouldSchedule = dayOfWeek >= 1 && dayOfWeek <= 5 // Mon-Fri
        } else if (frequency.includes('once per week')) {
          const dayOfWeek = currentDate.getDay()
          shouldSchedule = dayOfWeek === 1 // Monday
        }

        if (shouldSchedule) {
          futureDoses.push({
            date: dateToLocalKey(currentDate),
            protocolName: protocol.name,
            completed: false
          })
        }

        // Move to next day
        currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
      }
    })

    return futureDoses
  }, [])

  const doseHistoryByDate = useMemo(() => {
    const map = new Map<string, { count: number; labels: Set<string>; completed: number; pending: number }>()

    // Add completed/historical doses
    doseHistory.forEach((dose: any) => {
      // Use localDate if available (timezone-safe), otherwise fall back to date conversion
      let key: string;
      if (dose?.localDate) {
        key = dose.localDate;
      } else {
        const rawDate = dose?.doseDate || dose?.createdAt || dose?.updatedAt
        if (!rawDate) return
        key = new Date(rawDate).toISOString().split('T')[0]
      }

      if (!map.has(key)) {
        map.set(key, { count: 0, labels: new Set<string>(), completed: 0, pending: 0 })
      }

      const entry = map.get(key)!
      entry.count += 1
      entry.completed += 1
      const protocolName = dose?.user_peptide_protocols?.peptides?.name ?? dose?.protocolName ?? ''
      if (protocolName) {
        entry.labels.add(protocolName)
      }
    })

    // Add future scheduled doses (60 days ahead)
    const futureEndDate = new Date()
    futureEndDate.setDate(futureEndDate.getDate() + 60)
    const futureDoses = generateFutureDoses(currentProtocols, futureEndDate)

    futureDoses.forEach((futureDose) => {
      const key = futureDose.date

      if (!map.has(key)) {
        map.set(key, { count: 0, labels: new Set<string>(), completed: 0, pending: 0 })
      }

      const entry = map.get(key)!

      // Check if this dose is already completed
      const alreadyCompleted = doseHistory.some((dose: any) => {
        // Use localDate if available, otherwise convert doseDate
        let doseDateKey: string;
        if (dose?.localDate) {
          doseDateKey = dose.localDate;
        } else {
          const doseDate = dose?.doseDate || dose?.createdAt || dose?.updatedAt
          if (!doseDate) return false
          doseDateKey = new Date(doseDate).toISOString().split('T')[0]
        }
        const doseName = dose?.user_peptide_protocols?.peptides?.name ?? dose?.protocolName ?? ''
        return doseDateKey === key && doseName === futureDose.protocolName
      })

      if (!alreadyCompleted) {
        entry.count += 1
        entry.pending += 1
        entry.labels.add(futureDose.protocolName)
      }
    })

    return map
  }, [doseHistory, currentProtocols, generateFutureDoses])

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
      completed: number
      pending: number
      items: string[]
      date: Date
    } | null> = []

    for (let i = 0; i < leadingBlanks; i += 1) {
      cells.push(null)
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day)
      const key = dateToLocalKey(date)
      const summary = doseHistoryByDate.get(key)

      cells.push({
        key,
        label: String(day),
        count: summary?.count ?? 0,
        completed: summary?.completed ?? 0,
        pending: summary?.pending ?? 0,
        items: summary ? Array.from(summary.labels) : [],
        date,
      })
    }

    while (cells.length % 7 !== 0) {
      cells.push(null)
    }

    return cells
  }, [historyMonth, doseHistoryByDate])

  const calendarDensityClass = (completed: number, pending: number, isToday: boolean, isPast: boolean) => {
    const total = completed + pending

    if (total <= 0) {
      return isToday
        ? 'border-primary-400/50 text-primary-200 bg-gray-800/40'
        : 'border-gray-700/40 text-gray-500 bg-gray-800/30'
    }

    // Past/completed doses - green
    if (isPast || (completed > 0 && pending === 0)) {
      if (completed === 1) return 'bg-green-500/15 border-green-400/40 text-green-100'
      if (completed === 2) return 'bg-green-500/30 border-green-400/60 text-green-50'
      return 'bg-green-500/50 border-green-300 text-white shadow-inner'
    }

    // Future scheduled doses - blue/amber
    if (pending > 0 && completed === 0) {
      if (pending === 1) return 'bg-blue-500/15 border-blue-400/40 text-blue-100'
      if (pending === 2) return 'bg-blue-500/30 border-blue-400/60 text-blue-50'
      return 'bg-blue-500/50 border-blue-300 text-white shadow-inner'
    }

    // Mix of completed and pending - purple
    if (completed >= 1) return 'bg-purple-500/15 border-purple-400/40 text-purple-100'
    if (completed >= 2) return 'bg-purple-500/30 border-purple-400/60 text-purple-50'
    return 'bg-purple-500/50 border-purple-300 text-white shadow-inner'
  }

  // Calculate next dose date for a protocol
  const getNextDoseDate = useCallback((protocol: PeptideProtocol): Date | null => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const startDate = protocol.startDate ? new Date(protocol.startDate) : new Date()
    startDate.setHours(0, 0, 0, 0)

    const frequency = protocol.frequency.toLowerCase()

    // Check if already completed today - use local date
    const todayKey = getTodayKey()
    const completedToday = doseHistory.some((dose: any) => {
      // Use localDate if available, otherwise convert doseDate
      let doseDateKey: string;
      if (dose?.localDate) {
        doseDateKey = dose.localDate;
      } else {
        const doseDate = dose?.doseDate || dose?.createdAt || dose?.updatedAt
        if (!doseDate) return false
        doseDateKey = new Date(doseDate).toISOString().split('T')[0]
      }
      const doseName = dose?.user_peptide_protocols?.peptides?.name ?? dose?.protocolName ?? ''
      return doseDateKey === todayKey && doseName === protocol.name
    })

    // Start from today if not completed, otherwise start from tomorrow
    let currentDate = completedToday
      ? new Date(today.getTime() + 24 * 60 * 60 * 1000)
      : new Date(today.getTime())

    // Look ahead up to 30 days to find next scheduled dose
    const maxDays = 30
    let daysChecked = 0

    while (daysChecked < maxDays) {
      let shouldSchedule = false

      if (frequency.includes('daily') || frequency.includes('every day')) {
        shouldSchedule = true
      } else if (frequency.includes('every other day')) {
        const daysSinceStart = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        shouldSchedule = daysSinceStart % 2 === 0
      } else if (frequency.includes('3x per week')) {
        const dayOfWeek = currentDate.getDay()
        shouldSchedule = [1, 3, 5].includes(dayOfWeek) // Mon, Wed, Fri
      } else if (frequency.includes('2x per week')) {
        const dayOfWeek = currentDate.getDay()
        shouldSchedule = [1, 4].includes(dayOfWeek) // Mon, Thu
      } else if (frequency.includes('5 days on')) {
        const dayOfWeek = currentDate.getDay()
        shouldSchedule = dayOfWeek >= 1 && dayOfWeek <= 5 // Mon-Fri
      } else if (frequency.includes('once per week')) {
        const dayOfWeek = currentDate.getDay()
        shouldSchedule = dayOfWeek === 1 // Monday
      }

      if (shouldSchedule) {
        return currentDate
      }

      currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
      daysChecked++
    }

    return null
  }, [doseHistory])

  // Sort protocols by next dose date (soonest first)
  const sortedProtocols = useMemo(() => {
    return [...currentProtocols].sort((a, b) => {
      const nextA = getNextDoseDate(a)
      const nextB = getNextDoseDate(b)

      if (!nextA && !nextB) return 0
      if (!nextA) return 1
      if (!nextB) return -1

      return nextA.getTime() - nextB.getTime()
    })
  }, [currentProtocols, getNextDoseDate])

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
      fetchNotificationPreferences()
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
          timing: protocol.timing || 'AM',
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

  const fetchNotificationPreferences = async () => {
    try {
      const response = await fetch('/api/notifications/preferences', {
        credentials: 'include'
      })
      const data = await response.json()

      if (data.success && data.preferences) {
        const prefsMap: Record<string, boolean> = {}
        data.preferences.forEach((pref: any) => {
          prefsMap[pref.protocolId] = pref.pushEnabled
        })
        setProtocolNotifications(prefsMap)
        console.log(`✅ Loaded notification preferences for ${data.preferences.length} protocols`)
      }
    } catch (error) {
      console.error('Error fetching notification preferences:', error)
    }
  }

  const fetchPeptideLibrary = async () => {
    try {
      setLoadingLibrary(true)
      const response = await fetch('/api/products/storefront', {
        credentials: 'include'
      })
      const products = await response.json()

      if (products && Array.isArray(products)) {
        // Transform storefront products to match our interface
        const formattedLibrary = products.map((product: any) => ({
          id: product.id,
          name: product.name,
          purpose: product.description?.substring(0, 50) || 'General',
          dosage: '250mcg', // Default dosage
          timing: 'AM',
          frequency: 'Daily',
          duration: '8 weeks',
          vialAmount: '10mg',
          reconstitution: '2ml',
          syringeUnits: 10
        }))

        // Add "Other (Custom)" option at the end
        formattedLibrary.push({
          id: 'custom',
          name: 'Other (Custom)',
          purpose: 'Custom',
          dosage: '100mcg',
          timing: 'AM',
          frequency: 'Daily',
          duration: '4 weeks',
          vialAmount: '5mg',
          reconstitution: '1ml',
          syringeUnits: 10
        })

        setPeptideLibrary(formattedLibrary)
        console.log(`✅ Loaded ${formattedLibrary.length} products from storefront (${products.length} products + 1 custom option)`)
      } else {
        console.error('Failed to fetch storefront products')
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

  const openEditModal = (protocol: PeptideProtocol) => {
    setEditingProtocol(protocol)
    setCustomDosage(protocol.dosage)
    setCustomFrequency(protocol.frequency)
    setCustomTiming(protocol.timing)
    setCustomDuration(protocol.duration)

    // Parse existing timing into times array
    // protocol.timing might be like "08:00/20:00" or "AM" or "PM"
    const timesArray: string[] = []
    if (protocol.timing.includes('/')) {
      // Already has specific times like "08:00/20:00"
      timesArray.push(...protocol.timing.split('/').map(t => t.trim()))
    } else if (protocol.timing.toLowerCase().includes('am')) {
      timesArray.push('08:00')
    } else if (protocol.timing.toLowerCase().includes('pm')) {
      timesArray.push('20:00')
    }
    setCustomTimesArray(timesArray.length > 0 ? timesArray : ['08:00'])

    setShowEditProtocolModal(true)
  }

  const saveProtocolEdits = async () => {
    if (!editingProtocol) return

    // Validate that at least one time is selected
    if (customTimesArray.length === 0) {
      alert('Please add at least one dose time')
      return
    }

    // Join times array into string for storage
    const timingString = customTimesArray.join('/')

    try {
      const response = await fetch('/api/peptides/protocols', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          protocolId: editingProtocol.id,
          dosage: customDosage,
          frequency: customFrequency,
          timing: timingString
        }),
        credentials: 'include'
      })

      if (response.ok) {
        // Update local state
        setCurrentProtocols(prev => prev.map(p =>
          p.id === editingProtocol.id
            ? { ...p, dosage: customDosage, frequency: customFrequency, timing: timingString, duration: customDuration }
            : p
        ))
        setShowEditProtocolModal(false)
        setEditingProtocol(null)
        alert('Protocol updated successfully!')
      } else {
        alert('Failed to update protocol')
      }
    } catch (error) {
      console.error('Error updating protocol:', error)
      alert('Error updating protocol')
    }
  }

  const logDose = async () => {
    if (!selectedProtocol) return

    const now = new Date()
    const currentTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

    // Get user's local date components
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const seconds = String(now.getSeconds()).padStart(2, '0')

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
          doseDate: now.toISOString(),
          localDate: `${year}-${month}-${day}`,
          localTime: `${hours}:${minutes}:${seconds}`,
        })
      })

      const data = await response.json()

      if (data.success) {
        console.log('✅ Dose logged successfully')

        // Create the completed dose entry
        // Use the same localDate we sent to the API (timezone-safe)
        const doseKey = `${year}-${month}-${day}`

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
    const [isExpanded, setIsExpanded] = useState(false);

    // Remove "- peptide" and "Package" suffix from display name
    const displayName = protocol.name
      .replace(/\s*-\s*peptide\s*$/i, '')
      .replace(/\s+Package\s*$/i, '')
      .trim();

    // Get next dose date and status
    const nextDoseDate = getNextDoseDate(protocol)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayKey = today.toISOString().split('T')[0]

    const isCompletedToday = doseHistory.some((dose: any) => {
      const doseDate = dose?.doseDate || dose?.createdAt || dose?.updatedAt
      if (!doseDate) return false
      const doseDateKey = new Date(doseDate).toISOString().split('T')[0]
      const doseName = dose?.user_peptide_protocols?.peptides?.name ?? dose?.protocolName ?? ''
      return doseDateKey === todayKey && doseName === protocol.name
    })

    // Determine status badge
    let statusBadge: { text: string; className: string } | null = null
    if (isCompletedToday) {
      statusBadge = {
        text: 'Completed',
        className: 'bg-green-500/20 text-green-300 border-green-400/40'
      }
    } else if (nextDoseDate) {
      const daysUntil = Math.floor((nextDoseDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      if (daysUntil === 0) {
        statusBadge = {
          text: 'Coming Due Today',
          className: 'bg-amber-500/20 text-amber-300 border-amber-400/40'
        }
      } else if (daysUntil === 1) {
        statusBadge = {
          text: 'Coming Due Tomorrow',
          className: 'bg-blue-500/20 text-blue-300 border-blue-400/40'
        }
      } else if (daysUntil <= 3) {
        statusBadge = {
          text: `Due in ${daysUntil} days`,
          className: 'bg-blue-500/20 text-blue-300 border-blue-400/40'
        }
      }
    }

    return (
      <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/30 rounded-lg p-6 border border-primary-400/30 backdrop-blur-sm shadow-xl hover:shadow-primary-400/20 transition-all duration-300">
        {/* Header - Always visible */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 flex-1 text-left group"
          >
            <ChevronDown
              className={`w-5 h-5 text-primary-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            />
            <div className="flex flex-col">
              <h3 className="text-xl font-bold text-white group-hover:text-primary-300 transition-colors">{displayName}</h3>
              {statusBadge && (
                <span className={`text-xs font-semibold px-2 py-1 rounded border ${statusBadge.className} inline-block w-fit mt-1`}>
                  {statusBadge.text}
                </span>
              )}
            </div>
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setSelectedProtocolForNotif(protocol.id)
                setShowNotificationModal(true)
              }}
              className={`transition-all duration-300 ${
                protocolNotifications[protocol.id]
                  ? 'text-amber-400 hover:text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)] hover:drop-shadow-[0_0_12px_rgba(251,191,36,1)]'
                  : 'text-gray-300 hover:text-gray-200 drop-shadow-[0_0_4px_rgba(209,213,219,0.4)] hover:drop-shadow-[0_0_6px_rgba(209,213,219,0.6)]'
              }`}
              title={protocolNotifications[protocol.id] ? 'Reminders Enabled' : 'Set Reminder'}
            >
              <Bell className="w-5 h-5" />
            </button>
            <button
              onClick={() => openEditModal(protocol)}
              className="text-blue-400 hover:text-blue-300 transition-colors"
              title="Edit Protocol"
            >
              <Edit className="w-5 h-5" />
            </button>
            <button
              onClick={() => deleteProtocol(protocol.id)}
              className="text-red-400 hover:text-red-300 transition-colors"
              title="Delete Protocol"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Expandable Details */}
        {isExpanded && (
          <div className="mt-4 flex gap-4 animate-fade-in">
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
              <button
                onClick={() => {
                  setSelectedProtocolForNotif(protocol.id)
                  setShowNotificationModal(true)
                }}
                className="bg-primary-600/30 hover:bg-primary-600/50 text-primary-200 font-medium py-2 px-4 rounded-lg transition-colors text-sm whitespace-nowrap flex items-center justify-center gap-2"
              >
                <Bell className="w-4 h-4" />
                Remind Me
              </button>
            </div>
          </div>
        )}
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
              <div className="flex items-center gap-3">
                <img src="/logo1.png" alt="Reset Biology" className="h-10 w-auto rounded-lg drop-shadow-lg bg-white/10 backdrop-blur-sm p-1 border border-white/20" />
                <div>
                  <div className="flex items-center">
                    <a href="/portal" className="text-xl font-bold text-white drop-shadow-lg hover:text-primary-300 transition-colors">Portal</a>
                    <span className="mx-2 text-primary-300">&gt;</span>
                    <span className="text-lg text-gray-200 drop-shadow-sm">Peptide Tracker</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <a href="/daily-history" className="text-primary-300 hover:text-primary-200 font-medium text-sm transition-colors drop-shadow-sm">
                  Daily History
                </a>
                <a href="/portal" className="text-primary-300 hover:text-primary-200 font-medium text-sm transition-colors drop-shadow-sm">
                  ← Back to Portal
                </a>
              </div>
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
              {(['current', 'calendar'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-3 rounded-lg font-medium transition-all capitalize ${
                    activeTab === tab 
                      ? 'bg-primary-500 text-white shadow-lg' 
                      : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                  }`}
                >
                  {tab === 'current' ? 'Current Protocols' : 'Dosing Calendar'}
                </button>
              ))}
            </div>
          </div>

          {/* Current Protocols Tab */}
          {activeTab === 'current' && (
            <div className="max-w-6xl mx-auto">
              <div className="grid gap-6">
                {/* Active Protocols - Full Width */}
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-bold text-white">Active Protocols</h3>
                    <button
                      onClick={() => setShowAddProtocolModal(true)}
                      className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Research Protocol
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
                      {sortedProtocols.map((protocol) => (
                        <PeptideCard key={protocol.id} protocol={protocol} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}


          {/* Dosing Calendar Tab */}
          {activeTab === 'calendar' && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-8 border border-primary-400/30 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-8 h-8 text-primary-400" />
                    <h3 className="text-2xl font-bold text-white">Dosing Calendar</h3>
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
                      <div className="flex items-center justify-center mb-3">
                        <div className="flex items-center gap-2 text-sm text-gray-300">
                          <button
                            onClick={goToPreviousMonth}
                            className="h-8 w-8 rounded-full border border-primary-400/40 text-primary-200 hover:bg-primary-500/20 transition"
                            aria-label="View previous month"
                          >
                            ‹
                          </button>
                          <span className="font-medium text-primary-100 min-w-[150px] text-center">{historyMonthLabel}</span>
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
                          const isPast = new Date(cell.key) < new Date(todayKey)
                          const densityClass = calendarDensityClass(cell.completed, cell.pending, isToday, isPast)

                          return (
                            <button
                              key={cell.key}
                              onClick={() => cell.count > 0 ? setSelectedCalendarDay(cell.key) : null}
                              className={`min-h-[68px] rounded-lg border px-2 py-1 text-center transition-all duration-300 flex flex-col ${densityClass} ${cell.count > 0 ? 'cursor-pointer hover:scale-105 hover:shadow-lg' : 'cursor-default'}`}
                            >
                              <div className="text-base font-semibold">{cell.label}</div>
                              {cell.count > 0 && (
                                <div className="flex-1 flex flex-col items-center justify-center">
                                  <div className="text-lg font-semibold">{cell.count}</div>
                                  <div className="text-[8px] uppercase tracking-tight opacity-80 leading-none">
                                    dose{cell.count === 1 ? '' : 's'}
                                  </div>
                                </div>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Day Detail Modal */}
              {selectedCalendarDay && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                  <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 max-w-2xl w-full border border-primary-400/30 shadow-2xl max-h-[80vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="text-2xl font-bold text-white">
                          {new Date(selectedCalendarDay).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </h3>
                        <p className="text-gray-400 text-sm mt-1">
                          {doseHistoryByDate.get(selectedCalendarDay)?.completed || 0} completed • {doseHistoryByDate.get(selectedCalendarDay)?.pending || 0} scheduled
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedCalendarDay(null)}
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        <X className="w-6 h-6" />
                      </button>
                    </div>

                    <div className="space-y-3">
                      {doseHistory
                        .filter((dose: any) => {
                          const doseDateSource = dose?.doseDate || dose?.createdAt || dose?.updatedAt
                          if (!doseDateSource) return false
                          const doseDateKey = new Date(doseDateSource).toISOString().split('T')[0]
                          return doseDateKey === selectedCalendarDay
                        })
                        .map((dose: any) => {
                        const doseDateSource = dose?.doseDate || dose?.createdAt || dose?.updatedAt || new Date().toISOString()
                        const doseDate = new Date(doseDateSource)
                        const protocol = dose.user_peptide_protocols
                        return (
                          <div key={dose.id} className="p-4 bg-gray-700/30 rounded-lg border border-gray-600/30">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                <h4 className="font-semibold text-white">
                                  {dose.protocolName || protocol?.peptides?.name || 'Unknown Protocol'}
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
                            {(dose.notes || dose.sideEffects) && (
                              <p className="text-sm text-gray-300 mt-2 italic">
                                Notes/Side Effects: {dose.notes || dose.sideEffects}
                              </p>
                            )}
                          </div>
                        )
                      })}

                      {/* Show future scheduled doses for this day */}
                      {doseHistoryByDate.get(selectedCalendarDay)?.labels &&
                        Array.from(doseHistoryByDate.get(selectedCalendarDay)!.labels)
                          .filter(label => {
                            // Only show labels that don't have a completed dose
                            return !doseHistory.some((dose: any) => {
                              const doseDateSource = dose?.doseDate || dose?.createdAt || dose?.updatedAt
                              if (!doseDateSource) return false
                              const doseDateKey = new Date(doseDateSource).toISOString().split('T')[0]
                              const doseName = dose?.user_peptide_protocols?.peptides?.name ?? dose?.protocolName ?? ''
                              return doseDateKey === selectedCalendarDay && doseName === label
                            })
                          })
                          .map((label, idx) => (
                            <div key={`future-${idx}`} className="p-4 bg-blue-900/20 rounded-lg border border-blue-600/30">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <h4 className="font-semibold text-blue-200">{label}</h4>
                                  <p className="text-sm text-blue-300 mt-1">Scheduled</p>
                                </div>
                                <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-500/20 text-blue-300 border border-blue-400/40">
                                  Pending
                                </span>
                              </div>
                            </div>
                          ))
                      }

                      {doseHistory.filter((dose: any) => {
                        const doseDateSource = dose?.doseDate || dose?.createdAt || dose?.updatedAt
                        if (!doseDateSource) return false
                        const doseDateKey = new Date(doseDateSource).toISOString().split('T')[0]
                        return doseDateKey === selectedCalendarDay
                      }).length === 0 && (
                        <div className="text-center py-8 text-gray-400">
                          No doses logged for this day
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

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
                  <h4 className="font-semibold text-secondary-300 mb-3">Weekly Schedule</h4>
                  <div className="grid grid-cols-7 gap-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => {
                      // Determine if this day is active based on frequency
                      const isActiveDay =
                        selectedProtocol.frequency.toLowerCase().includes('daily') ||
                        selectedProtocol.frequency.toLowerCase().includes('every day') ||
                        (selectedProtocol.frequency.includes('5 days') && index >= 1 && index <= 5) ||
                        (selectedProtocol.frequency.includes('3x per week') && [1, 3, 5].includes(index)) ||
                        (selectedProtocol.frequency.includes('2x per week') && [1, 4].includes(index)) ||
                        (selectedProtocol.frequency.toLowerCase().includes('every other day') && index % 2 === 1);

                      // Determine dose times based on timing
                      const doseTimes: string[] = [];
                      if (isActiveDay) {
                        const timing = selectedProtocol.timing.toLowerCase();
                        if (timing.includes('am/pm') || timing.includes('twice')) {
                          doseTimes.push('8:00 AM', '8:00 PM');
                        } else if (timing.includes('am')) {
                          doseTimes.push('8:00 AM');
                        } else if (timing.includes('pm')) {
                          doseTimes.push('8:00 PM');
                        } else if (timing.includes('before meals')) {
                          doseTimes.push('7:00 AM', '12:00 PM', '6:00 PM');
                        } else if (timing.includes('after meals')) {
                          doseTimes.push('9:00 AM', '2:00 PM', '8:00 PM');
                        } else {
                          doseTimes.push('Scheduled');
                        }
                      }

                      return (
                        <div key={day} className="text-center">
                          <div className="text-xs font-semibold text-gray-300 mb-2">{day}</div>
                          <div className={`min-h-[60px] rounded-lg p-2 flex flex-col items-center justify-center text-[10px] leading-tight ${
                            isActiveDay
                              ? 'bg-gradient-to-br from-primary-500/20 to-secondary-500/20 border border-primary-400/30 text-primary-200'
                              : 'bg-gray-700/20 border border-gray-600/20 text-gray-500'
                          }`}>
                            {doseTimes.length > 0 ? (
                              doseTimes.map((time, idx) => (
                                <div key={idx} className="font-medium whitespace-nowrap">
                                  {time}
                                </div>
                              ))
                            ) : (
                              <div className="text-gray-500">—</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 text-xs text-gray-400 text-center">
                    Times shown are suggested based on your protocol timing ({selectedProtocol.timing})
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
                    Notes or Side Effects
                  </label>
                  <textarea
                    value={doseNotes}
                    onChange={(e) => setDoseNotes(e.target.value)}
                    className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:border-primary-400 focus:outline-none"
                    placeholder="How are you feeling? Any observations or side effects?"
                    rows={4}
                  />
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

        {/* Edit Protocol Modal */}
        {showEditProtocolModal && editingProtocol && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 max-w-md w-full border border-primary-400/30 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">Edit Protocol</h3>
                <button
                  onClick={() => setShowEditProtocolModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-primary-300 mb-4">{editingProtocol.name}</h4>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Dosage *
                  </label>
                  <input
                    type="text"
                    value={customDosage}
                    onChange={(e) => setCustomDosage(e.target.value)}
                    className="w-full bg-primary-600/20 border border-primary-400/40 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:border-primary-400 focus:outline-none"
                    placeholder="e.g., 250mcg, 0.5mg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Frequency *
                  </label>
                  <select
                    value={customFrequency}
                    onChange={(e) => setCustomFrequency(e.target.value)}
                    className="w-full bg-primary-600/20 border border-primary-400/40 rounded-lg px-3 py-2 text-white focus:border-primary-400 focus:outline-none"
                  >
                    <option value="">Select frequency...</option>
                    <option value="Daily">Daily</option>
                    <option value="Every other day">Every other day</option>
                    <option value="3x per week">3x per week</option>
                    <option value="2x per week">2x per week</option>
                    <option value="5 days on, 2 days off">5 days on, 2 days off</option>
                    <option value="Once per week">Once per week</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Dose Times *
                  </label>

                  {/* Display selected times */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {customTimesArray.map((time) => (
                      <div
                        key={time}
                        className="flex items-center gap-2 bg-primary-500/30 text-primary-100 border border-primary-400/50 px-3 py-1.5 text-sm font-medium rounded-md"
                      >
                        <span>{time}</span>
                        <button
                          type="button"
                          onClick={() => setCustomTimesArray(prev => prev.filter(t => t !== time))}
                          className="text-primary-200 hover:text-white transition-colors"
                          aria-label={`Remove ${time}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {customTimesArray.length === 0 && (
                      <p className="text-xs text-gray-400">No dose times selected</p>
                    )}
                  </div>

                  {/* Add new time */}
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={newCustomTimeInput}
                      onChange={(e) => setNewCustomTimeInput(e.target.value)}
                      className="flex-1 bg-primary-600/20 border border-primary-400/40 rounded-lg px-3 py-2 text-white focus:border-primary-400 focus:outline-none text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newCustomTimeInput && !customTimesArray.includes(newCustomTimeInput)) {
                          setCustomTimesArray(prev => [...prev, newCustomTimeInput].sort())
                        }
                      }}
                      className="bg-primary-600/30 hover:bg-primary-600/50 text-primary-200 border border-primary-400/40 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                    >
                      + Add Time
                    </button>
                  </div>

                  <p className="text-xs text-gray-400 mt-2">
                    Add specific times for your doses (e.g., 8:00 AM, 8:00 PM)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Duration
                  </label>
                  <input
                    type="text"
                    value={customDuration}
                    onChange={(e) => setCustomDuration(e.target.value)}
                    className="w-full bg-primary-600/20 border border-primary-400/40 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:border-primary-400 focus:outline-none"
                    placeholder="e.g., 8 weeks, 30 days"
                  />
                </div>

                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mt-4">
                  <p className="text-xs text-amber-300">
                    <strong>Note:</strong> Editing this protocol will only update YOUR schedule. Your past logged doses remain unchanged for accurate history tracking.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowEditProtocolModal(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveProtocolEdits}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notification Preferences Modal */}
        {showNotificationModal && selectedProtocolForNotif && (
          <NotificationPreferences
            protocolId={selectedProtocolForNotif}
            protocolName={currentProtocols.find(p => p.id === selectedProtocolForNotif)?.name || 'Protocol'}
            onClose={() => {
              setShowNotificationModal(false)
              setSelectedProtocolForNotif(null)
              // Refresh notification preferences to update icon state
              fetchNotificationPreferences()
            }}
          />
        )}
      </div>
    </div>
  )
}

