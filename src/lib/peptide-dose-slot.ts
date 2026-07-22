import {
  hasKnownSchedule,
  isDoseDayForProtocol,
  parseDoseTimes,
} from '@/lib/peptide-frequency'

export type ParsedPeptideDoseSlotKey = {
  protocolId: string
  localDay: string
  slotId: string
}

export type PeptideDoseSlotValidation =
  | { ok: true; slotKey: string | null }
  | { ok: false; status: 400; error: string }

type SlotValidationProtocol = {
  id: string
  frequency: string
  timing: string | null
  startDate: Date | string
}

function isValidLocalDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)) return false

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

function localDayToDate(localDay: string): Date {
  const [year, month, day] = localDay.split('-').map(Number)
  return new Date(year, month - 1, day, 0, 0, 0, 0)
}

function slotIdsForTiming(timing: string | null): string[] {
  const text = timing || ''
  const lower = text.toLowerCase()
  if (text.includes('/')) return parseDoseTimes(text).map((_, index) => `slot-${index}`)
  if (lower.includes('twice') || (lower.includes('am') && lower.includes('pm'))) return ['am', 'pm']
  return ['0']
}

export function buildPeptideDoseSlotKey(protocolId: string, localDay: string, slotId: string): string {
  const slotKey = `${protocolId}::${localDay}::${slotId}`
  if (!parsePeptideDoseSlotKey(slotKey)) {
    throw new Error('Cannot build a noncanonical peptide dose slot key')
  }
  return slotKey
}

export function parsePeptideDoseSlotKey(value: unknown): ParsedPeptideDoseSlotKey | null {
  if (typeof value !== 'string') return null

  const match = value.match(/^([^:]+)::(\d{4}-\d{2}-\d{2})::(am|pm|0|slot-(?:0|[1-9]\d*))$/)
  if (!match || !isValidLocalDay(match[2])) return null

  return {
    protocolId: match[1],
    localDay: match[2],
    slotId: match[3],
  }
}

export function validatePeptideDoseSlotKey(
  input: { protocolId: unknown; localDate?: unknown; slotKey?: unknown },
  protocol: SlotValidationProtocol,
): PeptideDoseSlotValidation {
  if (typeof input.protocolId !== 'string' || input.protocolId !== protocol.id) {
    return { ok: false, status: 400, error: 'Slot key protocol does not match the saved protocol' }
  }
  if (input.slotKey === undefined || input.slotKey === null) return { ok: true, slotKey: null }
  if (!isValidLocalDay(input.localDate)) {
    return { ok: false, status: 400, error: 'localDate must be a valid YYYY-MM-DD calendar day' }
  }
  if (typeof input.slotKey !== 'string') {
    return { ok: false, status: 400, error: 'slotKey must be a canonical string when provided' }
  }

  const parsed = parsePeptideDoseSlotKey(input.slotKey)
  if (!parsed) return { ok: false, status: 400, error: 'Invalid canonical slotKey' }
  if (parsed.protocolId !== protocol.id || parsed.protocolId !== input.protocolId) {
    return { ok: false, status: 400, error: 'slotKey protocolId mismatch' }
  }
  if (parsed.localDay !== input.localDate) {
    return { ok: false, status: 400, error: 'slotKey localDate mismatch or invalid day' }
  }
  if (!slotIdsForTiming(protocol.timing).includes(parsed.slotId)) {
    return { ok: false, status: 400, error: 'slotKey slotId is impossible for this protocol timing' }
  }

  const startDay = typeof protocol.startDate === 'string' && isValidLocalDay(protocol.startDate)
    ? localDayToDate(protocol.startDate)
    : new Date(protocol.startDate)
  startDay.setHours(0, 0, 0, 0)
  if (
    hasKnownSchedule(protocol.frequency)
    && !isDoseDayForProtocol(protocol.frequency, startDay, localDayToDate(parsed.localDay))
  ) {
    return { ok: false, status: 400, error: 'slotKey day is not scheduled for this protocol' }
  }

  return { ok: true, slotKey: input.slotKey }
}
