import {
  projectPitchforksMastery,
  type PitchforksMasteryProjectionInput,
} from './pitchforksMasteryProjection'
import { getVillageLessonCandidates } from './villageLessonSelector'
import type { VillagePracticeReceipt } from './villagePractice'
import { VILLAGE_RETURN_REQUIRED_OTHER_ENCOUNTERS } from './villageReturnQueue'

export type VillageClearBinding = Readonly<Pick<
  VillagePracticeReceipt, 'objective' | 'contextNote' | 'targetNote'
>>

export type VillageClearEligibilityInput = Readonly<{
  /** Existing Village practice identity: presentation journey.startedAt. */
  journeyId: string
  /** Caller chooses the curriculum; this projection never selects bindings. */
  bindings: readonly VillageClearBinding[]
  admittedNotes: readonly string[]
  comfortableRange: Readonly<{ lowNote: string; highNote: string }>
  practiceReceipts: readonly VillagePracticeReceipt[]
  voiceMemory: PitchforksMasteryProjectionInput['voiceMemory']
  masteryRecords: PitchforksMasteryProjectionInput['masteryRecords']
  nowMs: number
  normalVoice: boolean
  demo: boolean
  simulated: boolean
}>

export type VillageClearEligibility = Readonly<{ eligible: boolean; reason: string }>

const RECEIPT_KEYS: readonly (keyof VillagePracticeReceipt)[] = [
  'kind', 'eventId', 'journeyId', 'sessionId', 'encounterIndex',
  'introducedEncounterIndex', 'timestampMs', 'objective', 'contextNote',
  'targetNote', 'support', 'cueFree',
]

// MAIN advances the completed counter before writing the return receipt. The
// queue's three "other encounter" delay therefore occupies n+1..n+3, and the
// unaided return itself is recorded at n+4 or later.
const MIN_UNAIDED_RETURN_INDEX_DISTANCE = VILLAGE_RETURN_REQUIRED_OTHER_ENCOUNTERS + 1

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function identifier(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value
}

function denseArray(value: unknown): value is readonly unknown[] {
  if (!Array.isArray(value)) return false
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) return false
  }
  return true
}

function counter(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function matches(left: VillageClearBinding, right: VillageClearBinding): boolean {
  return left.objective === right.objective
    && left.contextNote === right.contextNote && left.targetNote === right.targetNote
}

/** First-clear eligibility only; never awards or revokes an earned entitlement. */
export function projectVillageClearEligibility(
  input: VillageClearEligibilityInput,
): VillageClearEligibility {
  const result = (eligible: boolean, reason: string): VillageClearEligibility =>
    Object.freeze({ eligible, reason })

  if (!isRecord(input) || !identifier(input.journeyId)
    || !Number.isFinite(input.nowMs) || input.nowMs < 0
    || !denseArray(input.bindings) || input.bindings.length === 0
    || !denseArray(input.admittedNotes) || !input.admittedNotes.every(identifier)
    || !denseArray(input.practiceReceipts)
  ) return result(false, 'A valid journey, time, admitted notes and nonempty binding are required.')

  if (input.normalVoice !== true || input.demo !== false || input.simulated !== false) {
    return result(false, 'First clear requires normal voice input without demonstration or simulation.')
  }

  // Both endpoints are admitted, so no extra introduced-note policy is needed.
  const candidates = getVillageLessonCandidates({
    admittedNotes: input.admittedNotes,
    introducedNotes: input.admittedNotes,
    comfortableRange: input.comfortableRange,
  })
  const endpoints = new Set<string>()
  const bindingKeys = new Set<string>()
  for (const binding of input.bindings) {
    if (!isRecord(binding) || !candidates.some(candidate =>
      candidate.bothVoiceAdmitted && matches(candidate, binding),
    )) return result(false, 'Every binding must match an admitted directed interval within the assessed range.')
    const bindingKey = `${binding.objective}\u0000${binding.contextNote}\u0000${binding.targetNote}`
    if (bindingKeys.has(bindingKey)) {
      return result(false, 'Village clear bindings must name each directed interval only once.')
    }
    bindingKeys.add(bindingKey)
    endpoints.add(binding.contextNote)
    endpoints.add(binding.targetNote)
  }

  const mastery = projectPitchforksMastery({
    admittedNotes: [...endpoints],
    voiceMemory: input.voiceMemory,
    masteryRecords: input.masteryRecords,
    nowMs: input.nowMs,
  })
  // This API validates historical evidence only. Neither review phase nor
  // !voiceDue is a source-defined current Q1 mastery predicate.
  if (!mastery.worldClear) {
    return result(false, 'Every bound note needs valid voice memory and earned mastery evidence.')
  }

  const evidence: VillagePracticeReceipt[] = []
  const eventIds = new Set<string>()
  for (const receipt of input.practiceReceipts) {
    // Match the persisted Village receipt shape. In particular, raw attempt
    // objects carrying demo/simulated flags are not validated practice receipts.
    if (!isRecord(receipt) || Object.keys(receipt).length !== RECEIPT_KEYS.length
      || !RECEIPT_KEYS.every(key => Object.prototype.hasOwnProperty.call(receipt, key))
      || receipt.kind !== 'practice' || !identifier(receipt.eventId)
      || !identifier(receipt.journeyId) || !identifier(receipt.sessionId)
      || !counter(receipt.encounterIndex) || !counter(receipt.introducedEncounterIndex)
      || !Number.isFinite(receipt.timestampMs) || receipt.timestampMs < 0
      || receipt.timestampMs > input.nowMs
      || typeof receipt.cueFree !== 'boolean'
      || (receipt.support !== 'SUPPORTED' && receipt.support !== 'UNAIDED_RETURN')
      || !candidates.some(candidate => matches(candidate, receipt))
      || (receipt.support === 'SUPPORTED'
        ? receipt.encounterIndex < receipt.introducedEncounterIndex
        : receipt.encounterIndex - receipt.introducedEncounterIndex < MIN_UNAIDED_RETURN_INDEX_DISTANCE
          || !receipt.cueFree)
    ) return result(false, 'Village practice contains an invalid receipt.')

    if (receipt.journeyId !== input.journeyId) continue
    if (eventIds.has(receipt.eventId)) {
      return result(false, 'A repeated practice event cannot supply clear coverage.')
    }
    eventIds.add(receipt.eventId)
    if (receipt.support === 'UNAIDED_RETURN') evidence.push(receipt)
  }

  if (!input.bindings.every(binding => evidence.some(receipt => matches(binding, receipt)))) {
    return result(false, 'Every bound directed interval needs unaided return practice in this journey.')
  }
  // Fable157 resolves the read-side authority to the existing Dungeon
  // projection. A due review does not introduce a second mastery threshold.
  return result(true, 'The bound notes have earned mastery and every interval has unaided practice.')
}
