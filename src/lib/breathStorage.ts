import Dexie, { Table } from 'dexie'
import { v4 as uuidv4 } from 'uuid'
import { SessionData, SessionSummary, CycleData } from '@/types/breath'

export class BreathDatabase extends Dexie {
  sessions!: Table<SessionData>
  summaries!: Table<SessionSummary>

  constructor() {
    super('BreathTrainingDB')
    this.version(1).stores({
      sessions: 'sessionId, startedAt, endedAt, cyclesCompleted',
      summaries: 'sessionId, startedAt, endedAt, cyclesTarget'
    })
  }
}

export const breathDB = new BreathDatabase()

// Storage interface
export class BreathStorage {
  private static instance: BreathStorage
  
  static getInstance(): BreathStorage {
    if (!BreathStorage.instance) {
      BreathStorage.instance = new BreathStorage()
    }
    return BreathStorage.instance
  }

  async saveSession(sessionData: SessionData): Promise<void> {
    try {
      await breathDB.sessions.put(sessionData)
      
      // Create summary
      const summary = this.createSummary(sessionData)
      await breathDB.summaries.put(summary)
      
      // Also save to localStorage as backup
      localStorage.setItem(`breath_session_${sessionData.sessionId}`, JSON.stringify(sessionData))
      
    } catch (error) {
      console.error('Failed to save to IndexedDB, using localStorage:', error)
      // Fallback to localStorage
      localStorage.setItem(`breath_session_${sessionData.sessionId}`, JSON.stringify(sessionData))
      
      const summary = this.createSummary(sessionData)
      localStorage.setItem(`breath_summary_${sessionData.sessionId}`, JSON.stringify(summary))
    }
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      const session = await breathDB.sessions.get(sessionId)
      return session || null
    } catch (error) {
      console.error('Failed to get from IndexedDB, trying localStorage:', error)
      const stored = localStorage.getItem(`breath_session_${sessionId}`)
      return stored ? JSON.parse(stored) : null
    }
  }

  async getAllSessions(limit = 50): Promise<SessionData[]> {
    try {
      return await breathDB.sessions
        .orderBy('startedAt')
        .reverse()
        .limit(limit)
        .toArray()
    } catch (error) {
      console.error('Failed to get sessions from IndexedDB:', error)
      // Fallback to localStorage
      const sessions: SessionData[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('breath_session_')) {
          const data = localStorage.getItem(key)
          if (data) {
            sessions.push(JSON.parse(data))
          }
        }
      }
      return sessions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()).slice(0, limit)
    }
  }

  async getSummaries(limit = 20): Promise<SessionSummary[]> {
    try {
      return await breathDB.summaries
        .orderBy('startedAt')
        .reverse()
        .limit(limit)
        .toArray()
    } catch (error) {
      console.error('Failed to get summaries from IndexedDB:', error)
      const summaries: SessionSummary[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('breath_summary_')) {
          const data = localStorage.getItem(key)
          if (data) {
            summaries.push(JSON.parse(data))
          }
        }
      }
      return summaries.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()).slice(0, limit)
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      await breathDB.sessions.delete(sessionId)
      await breathDB.summaries.delete(sessionId)
    } catch (error) {
      console.error('Failed to delete from IndexedDB:', error)
    }
    
    // Also remove from localStorage
    localStorage.removeItem(`breath_session_${sessionId}`)
    localStorage.removeItem(`breath_summary_${sessionId}`)
  }

  createSummary(sessionData: SessionData): SessionSummary {
    const exhaleHolds = sessionData.cycles.map(c => c.exhaleHold.durationMs)
    const inhaleHolds = sessionData.cycles.map(c => c.inhaleHold.durationMs)
    
    const longestExhaleHoldMs = Math.max(...exhaleHolds, 0)
    const longestInhaleHoldMs = Math.max(...inhaleHolds, 0)
    const avgExhaleHoldMs = exhaleHolds.length > 0 ? exhaleHolds.reduce((a, b) => a + b, 0) / exhaleHolds.length : 0
    const avgInhaleHoldMs = inhaleHolds.length > 0 ? inhaleHolds.reduce((a, b) => a + b, 0) / inhaleHolds.length : 0
    
    const totalBreathTimeMs = sessionData.cycles.reduce((total, cycle) => total + cycle.breathing.actualDurationMs, 0)
    const totalHoldTimeMs = sessionData.cycles.reduce((total, cycle) => 
      total + cycle.exhaleHold.durationMs + cycle.inhaleHold.durationMs, 0)
    
    const cyclesAborted = Math.max(0, sessionData.settings.cyclesTarget - sessionData.cyclesCompleted)

    return {
      sessionId: sessionData.sessionId,
      startedAt: sessionData.startedAt,
      endedAt: sessionData.endedAt,
      cyclesTarget: sessionData.settings.cyclesTarget,
      breathsPerCycle: sessionData.settings.breathsPerCycle,
      pace: sessionData.settings.pace,
      cyclesCompleted: sessionData.cyclesCompleted,
      longestExhaleHoldMs,
      longestInhaleHoldMs,
      avgExhaleHoldMs,
      avgInhaleHoldMs,
      totalBreathTimeMs,
      totalHoldTimeMs,
      cyclesAborted
    }
  }

  generateSessionId(): string {
    return uuidv4()
  }

  exportToCSV(sessions: SessionData[]): string {
    const headers = [
      'Session ID',
      'Date',
      'Duration (min)',
      'Cycles Completed',
      'Breaths Per Cycle',
      'Pace',
      'Longest Exhale Hold (s)',
      'Longest Inhale Hold (s)',
      'Avg Exhale Hold (s)',
      'Avg Inhale Hold (s)'
    ]

    const rows = sessions.map(session => {
      const summary = this.createSummary(session)
      const startTime = new Date(session.startedAt)
      const endTime = new Date(session.endedAt)
      const duration = (endTime.getTime() - startTime.getTime()) / 60000 // minutes

      return [
        session.sessionId,
        startTime.toLocaleDateString(),
        duration.toFixed(1),
        session.cyclesCompleted,
        session.settings.breathsPerCycle,
        session.settings.pace.label,
        (summary.longestExhaleHoldMs / 1000).toFixed(2),
        (summary.longestInhaleHoldMs / 1000).toFixed(2),
        (summary.avgExhaleHoldMs / 1000).toFixed(2),
        (summary.avgInhaleHoldMs / 1000).toFixed(2)
      ]
    })

    return [headers, ...rows].map(row => row.join(',')).join('\n')
  }
}