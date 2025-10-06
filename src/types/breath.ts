// Breath Training App Types

export type BreathState = 
  | 'idle'
  | 'breathing_active'
  | 'exhale_hold_ready'
  | 'exhale_hold_active'
  | 'inhale_hold_ready'
  | 'inhale_hold_active'
  | 'cycle_complete'
  | 'paused'
  | 'session_complete'

export type PaceType = 'slow' | 'medium' | 'fast' | 'custom'

export interface PaceSettings {
  label: string
  inhaleMs: number
  exhaleMs: number
}

export interface BreathSettings {
  cyclesTarget: number
  breathsPerCycle: number
  pace: PaceSettings
  audioEnabled: boolean
  theme: 'light' | 'dark'
  motionReduced: boolean
}

export interface CycleData {
  cycleIndex: number
  breathing: {
    targetBreaths: number
    actualBreaths: number
    startAt: string
    endAt: string
    actualDurationMs: number
  }
  exhaleHold: {
    startAt: string
    durationMs: number
  }
  inhaleHold: {
    startAt: string
    durationMs: number
  }
  notes?: string
}

export interface SessionData {
  sessionId: string
  startedAt: string
  endedAt: string
  settings: BreathSettings
  cycles: CycleData[]
  cyclesCompleted: number
  localDate?: string
  localTime?: string
}

export interface SessionSummary {
  sessionId: string
  startedAt: string
  endedAt: string
  cyclesTarget: number
  breathsPerCycle: number
  pace: PaceSettings
  cyclesCompleted: number
  longestExhaleHoldMs: number
  longestInhaleHoldMs: number
  avgExhaleHoldMs: number
  avgInhaleHoldMs: number
  totalBreathTimeMs: number
  totalHoldTimeMs: number
  cyclesAborted: number
}

export interface BreathingPhase {
  isInhale: boolean
  breathCount: number
  targetBreaths: number
  currentBreathStartTime: number
}

export interface HoldPhase {
  type: 'exhale' | 'inhale'
  startTime: number
  duration: number
}

export const DEFAULT_PACES: Record<PaceType, PaceSettings> = {
  slow: { label: 'Slow', inhaleMs: 4000, exhaleMs: 4000 },
  medium: { label: 'Medium', inhaleMs: 3000, exhaleMs: 3000 },
  fast: { label: 'Fast', inhaleMs: 2000, exhaleMs: 2000 },
  custom: { label: 'Custom', inhaleMs: 3000, exhaleMs: 3000 }
}

export const DEFAULT_SETTINGS: BreathSettings = {
  cyclesTarget: 3,
  breathsPerCycle: 40,
  pace: DEFAULT_PACES.medium,
  audioEnabled: false,
  theme: 'light',
  motionReduced: false
}