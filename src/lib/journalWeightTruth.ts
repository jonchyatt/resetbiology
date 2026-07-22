// Pure classifier for what a group of same-day JournalEntry weight rows
// actually means. JournalEntry.weight stays pounds/source-compatible on the
// row itself (schema.prisma:433) — this only reads candidates a caller has
// already bucketed onto one member-local day and decides, deterministically,
// whether they agree. It never picks a winner among conflicting readings.

import { isValidDayKey } from './localDay'

export type JournalWeightUnit = 'lb' | 'kg'

export type JournalWeightStatus =
  | 'removed'
  | 'resolved'
  | 'same_value_duplicates'
  | 'conflict'
  | 'unknown_day'
  | 'unknown_unit'
  | 'invalid_source'

export interface JournalWeightCandidate {
  id: string
  createdAt: Date
  dayKey?: string | null
  weight?: number | null
  unit?: JournalWeightUnit | null
  mood?: string | null
}

export interface JournalWeightResolution {
  status: JournalWeightStatus
  sourceIds: string[]
  candidates: Array<{ id: string; weight: number | null; mood: string | null }>
  normalizedKg: number | null
}

const LB_TO_KG = 0.45359237

function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}

/**
 * Classifies a set of JournalEntry weight readings believed to be for the
 * same member-local day. Ordering (createdAt ASC, then id ASC) is only for
 * reproducible output — it is never used to break a tie between candidates.
 */
export function resolveJournalWeight(candidates: JournalWeightCandidate[]): JournalWeightResolution {
  const ordered = [...candidates].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )
  const sourceIds = ordered.map((c) => c.id)
  const preserved = ordered.map((c) => ({ id: c.id, weight: c.weight ?? null, mood: c.mood ?? null }))
  const result = (status: JournalWeightStatus, normalizedKg: number | null = null): JournalWeightResolution => ({
    status,
    sourceIds,
    candidates: preserved,
    normalizedKg,
  })

  const candidateDayKeys = ordered.map((c) => c.dayKey)
  if (candidateDayKeys.length === 0 || candidateDayKeys.some((dayKey) => !isValidDayKey(dayKey))) {
    return result('unknown_day')
  }

  const dayKeys = new Set(candidateDayKeys)
  if (dayKeys.size !== 1) {
    return result('unknown_day')
  }

  const weighted = ordered.filter((c) => c.weight !== null && c.weight !== undefined)

  if (weighted.some((c) => !Number.isFinite(c.weight as number) || (c.weight as number) <= 0)) {
    return result('invalid_source')
  }

  if (weighted.length === 0) {
    return result('removed')
  }

  if (weighted.some((c) => c.unit !== 'lb' && c.unit !== 'kg')) {
    return result('unknown_unit')
  }

  const normalizedValues = weighted.map((c) =>
    round3(c.unit === 'kg' ? (c.weight as number) : (c.weight as number) * LB_TO_KG)
  )
  const distinct = new Set(normalizedValues)

  if (distinct.size > 1) {
    return result('conflict')
  }

  const status: JournalWeightStatus = weighted.length === 1 ? 'resolved' : 'same_value_duplicates'
  return result(status, normalizedValues[0])
}
