import { getVillageLessonCandidates } from './villageLessonSelector'

type VillagePracticeObjective = 'minor-third' | 'major-third' | 'perfect-fifth'
type VillagePracticeSupport = 'SUPPORTED' | 'UNAIDED_RETURN'

type VillagePracticeCandidateEligibility = Readonly<{
  admittedNotes: readonly string[]
  introducedNotes: readonly string[]
  comfortableRange: Readonly<{
    lowNote: string
    highNote: string
  }>
}>

type VillagePracticeInput = Readonly<{
  eventId: string
  journeyId: string
  sessionId: string
  encounterIndex: number
  introducedEncounterIndex: number
  timestampMs: number
  objective: VillagePracticeObjective
  contextNote: string
  targetNote: string
  support: VillagePracticeSupport
  correct: boolean
  normalVoice: boolean
  demo: boolean
  simulated: boolean
  cueFree?: boolean
  candidateEligibility: VillagePracticeCandidateEligibility
}>

export type VillagePracticeReceipt = Readonly<{
  kind: 'practice'
  eventId: string
  journeyId: string
  sessionId: string
  encounterIndex: number
  introducedEncounterIndex: number
  timestampMs: number
  objective: VillagePracticeObjective
  contextNote: string
  targetNote: string
  support: VillagePracticeSupport
  cueFree: boolean
}>

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isTrimmedIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

/**
 * Record one successful, normal Village lesson response as practice evidence.
 * This is deliberately a pure append-only transform: the caller owns any
 * persistence and must keep this practice receipt separate from mastery.
 */
export function recordVillagePractice(
  previous: readonly VillagePracticeReceipt[],
  input: VillagePracticeInput,
): readonly VillagePracticeReceipt[] {
  if (!Array.isArray(previous) || !isRecord(input)) return previous

  if (!isTrimmedIdentifier(input.eventId)
    || !isTrimmedIdentifier(input.journeyId)
    || !isTrimmedIdentifier(input.sessionId)
    || !isNonNegativeSafeInteger(input.encounterIndex)
    || !isNonNegativeSafeInteger(input.introducedEncounterIndex)
    || !isFiniteNonNegative(input.timestampMs)
    || input.correct !== true
    || input.normalVoice !== true
    || input.demo !== false
    || input.simulated !== false
    || (input.cueFree !== undefined && typeof input.cueFree !== 'boolean')
    || (input.support !== 'SUPPORTED' && input.support !== 'UNAIDED_RETURN')
  ) return previous

  if (previous.some(receipt => isRecord(receipt)
    && receipt.eventId === input.eventId
    && receipt.journeyId === input.journeyId
  )) {
    return previous
  }

  // A replay can carry a fresh event id. Keep the first valid receipt for the
  // exact journey/pair/support key, while allowing the other support mode for
  // the same directed pair.
  if (previous.some(receipt => isRecord(receipt)
    && receipt.journeyId === input.journeyId
    && receipt.contextNote === input.contextNote
    && receipt.targetNote === input.targetNote
    && receipt.support === input.support
  )) {
    return previous
  }

  let candidates: readonly {
    objective: VillagePracticeObjective
    contextNote: string
    targetNote: string
    bothVoiceAdmitted: boolean
  }[]
  try {
    candidates = getVillageLessonCandidates(input.candidateEligibility)
  } catch {
    return previous
  }

  const candidate = candidates.find(value =>
    value.objective === input.objective
      && value.contextNote === input.contextNote
      && value.targetNote === input.targetNote,
  )
  if (!candidate) return previous

  if (input.support === 'SUPPORTED') {
    if (input.encounterIndex < input.introducedEncounterIndex) return previous
  } else if (
    input.encounterIndex <= input.introducedEncounterIndex
    || candidate.bothVoiceAdmitted !== true
    || input.cueFree !== true
  ) return previous

  const receipt: VillagePracticeReceipt = Object.freeze({
    kind: 'practice',
    eventId: input.eventId,
    journeyId: input.journeyId,
    sessionId: input.sessionId,
    encounterIndex: input.encounterIndex,
    introducedEncounterIndex: input.introducedEncounterIndex,
    timestampMs: input.timestampMs,
    objective: input.objective,
    contextNote: input.contextNote,
    targetNote: input.targetNote,
    support: input.support,
    cueFree: input.cueFree === true,
  })

  return Object.freeze([...previous, receipt])
}
