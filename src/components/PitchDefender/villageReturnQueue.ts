import { getVillageLessonCandidates } from './villageLessonSelector'

/** A return waits for three intervening completed encounters. */
export const VILLAGE_RETURN_REQUIRED_OTHER_ENCOUNTERS = 3
/** A return also waits for this much monotonic caller time. */
export const VILLAGE_RETURN_DELAY_MS = 90_000

export type VillageReturnObjective =
  | 'minor-third'
  | 'major-third'
  | 'perfect-fifth'

export type VillageReturnSupport = 'SUPPORTED' | 'UNAIDED_RETURN'
export type VillageReturnAttempt = 'initial' | 'retry'
export type VillageReturnEntryStatus = 'pending' | 'done' | 'exhausted'

export type VillageReturnCandidateEligibility = Readonly<{
  admittedNotes: readonly string[]
  introducedNotes: readonly string[]
  comfortableRange: Readonly<{
    lowNote: string
    highNote: string
  }>
}>

/** The run-local record retained for each directed pair, including terminal markers. */
export type VillageReturnQueueEntry = Readonly<{
  runId: string
  objective: VillageReturnObjective
  contextNote: string
  targetNote: string
  /** Caller-supplied count after a completed note encounter. */
  enqueuedAtCompletedEncounterCount: number
  /** Caller-supplied monotonic time, not wall-clock time. */
  enqueuedAtMs: number
  revision: number
  attempt: VillageReturnAttempt
  status: VillageReturnEntryStatus
}>

export type VillageReturnQueueState = Readonly<{
  runId: string
  /** The next positive offer revision. */
  nextRevision: number
  /** Insertion order is presentation order when targets are shared. */
  entries: readonly VillageReturnQueueEntry[]
}>

/** A selected offer is the exact directed pair stored by the queue. */
export type VillageReturnOffer = Readonly<{
  kind: 'village-return'
  runId: string
  objective: VillageReturnObjective
  contextNote: string
  targetNote: string
  revision: number
  attempt: VillageReturnAttempt
  /** Initial returns are unaided; the one retry is explicitly supported. */
  support: VillageReturnSupport
  enqueuedAtCompletedEncounterCount: number
  enqueuedAtMs: number
}>

export type VillageReturnEnqueueInput = Readonly<{
  runId: string
  objective: VillageReturnObjective
  contextNote: string
  targetNote: string
  completedEncounterCount: number
  nowMs: number
  /** The successful source response must be the existing supported kind. */
  support: 'SUPPORTED'
  candidateEligibility: VillageReturnCandidateEligibility
}>

export type VillageReturnSelectionInput = Readonly<{
  runId: string
  /** The exact target already selected by FSRS; this helper never changes it. */
  targetNote: string
  completedEncounterCount: number
  nowMs: number
  candidateEligibility: VillageReturnCandidateEligibility
}>

export type VillageReturnResolveInput = Readonly<{
  runId: string
  offer: VillageReturnOffer
  completedEncounterCount: number
  nowMs: number
  correct: boolean
  /** A hint makes this attempt supported even if the selected offer was unaided. */
  hinted?: boolean
}>

export type VillageReturnResolveReason =
  | 'done'
  | 'retry-scheduled'
  | 'invalid-input'
  | 'stale-run'
  | 'stale-offer'
  | 'not-due'

export type VillageReturnResolveDecision = Readonly<{
  state: VillageReturnQueueState
  accepted: boolean
  reason: VillageReturnResolveReason
  /** Classification of the attempt that was actually resolved. */
  support: VillageReturnSupport | null
  outcome: 'DONE' | 'RETRY_SCHEDULED' | null
}>

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value
}

function isEncounterCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isMonotonicTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isObjective(value: unknown): value is VillageReturnObjective {
  return value === 'minor-third' || value === 'major-third' || value === 'perfect-fifth'
}

function isAttempt(value: unknown): value is VillageReturnAttempt {
  return value === 'initial' || value === 'retry'
}

function isStatus(value: unknown): value is VillageReturnEntryStatus {
  return value === 'pending' || value === 'done' || value === 'exhausted'
}

function pairKey(contextNote: string, targetNote: string): string {
  return `${contextNote}\u0000${targetNote}`
}

function copyEntry(value: VillageReturnQueueEntry): VillageReturnQueueEntry {
  return Object.freeze({
    runId: value.runId,
    objective: value.objective,
    contextNote: value.contextNote,
    targetNote: value.targetNote,
    enqueuedAtCompletedEncounterCount: value.enqueuedAtCompletedEncounterCount,
    enqueuedAtMs: value.enqueuedAtMs,
    revision: value.revision,
    attempt: value.attempt,
    status: value.status,
  })
}

function makeState(
  runId: string,
  nextRevision: number,
  entries: readonly VillageReturnQueueEntry[],
): VillageReturnQueueState {
  return Object.freeze({
    runId,
    nextRevision,
    entries: Object.freeze(entries.map(copyEntry)),
  })
}

function makeEntry(values: Omit<VillageReturnQueueEntry, 'runId'> & { runId: string }): VillageReturnQueueEntry {
  return copyEntry(values)
}

function isValidEntry(value: unknown, runId: string): value is VillageReturnQueueEntry {
  if (!isRecord(value)
    || value.runId !== runId
    || !isIdentifier(value.runId)
    || !isObjective(value.objective)
    || !isIdentifier(value.contextNote)
    || !isIdentifier(value.targetNote)
    || !isEncounterCount(value.enqueuedAtCompletedEncounterCount)
    || !isMonotonicTime(value.enqueuedAtMs)
    || !Number.isSafeInteger(value.revision)
    || value.revision < 1
    || !isAttempt(value.attempt)
    || !isStatus(value.status)) return false

  // A terminal marker can never be offered again, and a retry is the only
  // second attempt this run may carry.
  return value.status === 'pending'
    || (value.status === 'done' && value.attempt === 'initial')
    || (value.status === 'exhausted' && value.attempt === 'retry')
}

function isValidState(value: unknown): value is VillageReturnQueueState {
  if (!isRecord(value)
    || !isIdentifier(value.runId)
    || !Number.isSafeInteger(value.nextRevision)
    || value.nextRevision < 1
    || !Array.isArray(value.entries)) return false

  const pairKeys = new Set<string>()
  const revisions = new Set<number>()
  for (const entry of value.entries) {
    if (!isValidEntry(entry, value.runId)
      || pairKeys.has(pairKey(entry.contextNote, entry.targetNote))
      || revisions.has(entry.revision)
      || entry.revision >= value.nextRevision) return false
    pairKeys.add(pairKey(entry.contextNote, entry.targetNote))
    revisions.add(entry.revision)
  }
  return true
}

function candidateFor(
  input: Readonly<{
    objective: unknown
    contextNote: unknown
    targetNote: unknown
    candidateEligibility: unknown
  }>,
): VillageReturnObjective | null {
  if (!isObjective(input.objective)
    || !isIdentifier(input.contextNote)
    || !isIdentifier(input.targetNote)
    || !isRecord(input.candidateEligibility)) return null

  const candidate = getVillageLessonCandidates(input.candidateEligibility as VillageReturnCandidateEligibility)
    .find(value => value.objective === input.objective
      && value.contextNote === input.contextNote
      && value.targetNote === input.targetNote
      && value.bothVoiceAdmitted === true)
  return candidate?.objective ?? null
}

function latestEnqueuedCount(state: VillageReturnQueueState): number {
  return state.entries.reduce(
    (latest, entry) => Math.max(latest, entry.enqueuedAtCompletedEncounterCount),
    0,
  )
}

function latestEnqueuedTime(state: VillageReturnQueueState): number {
  return state.entries.reduce(
    (latest, entry) => Math.max(latest, entry.enqueuedAtMs),
    0,
  )
}

function isDue(
  entry: VillageReturnQueueEntry,
  completedEncounterCount: number,
  nowMs: number,
): boolean {
  return completedEncounterCount >= entry.enqueuedAtCompletedEncounterCount
    && completedEncounterCount - entry.enqueuedAtCompletedEncounterCount
      >= VILLAGE_RETURN_REQUIRED_OTHER_ENCOUNTERS
    && nowMs >= entry.enqueuedAtMs
    && nowMs - entry.enqueuedAtMs >= VILLAGE_RETURN_DELAY_MS
}

function supportFor(entry: VillageReturnQueueEntry, hinted: boolean): VillageReturnSupport {
  return hinted || entry.attempt === 'retry' ? 'SUPPORTED' : 'UNAIDED_RETURN'
}

function offerFor(entry: VillageReturnQueueEntry): VillageReturnOffer {
  return Object.freeze({
    kind: 'village-return',
    runId: entry.runId,
    objective: entry.objective,
    contextNote: entry.contextNote,
    targetNote: entry.targetNote,
    revision: entry.revision,
    attempt: entry.attempt,
    support: entry.attempt === 'retry' ? 'SUPPORTED' : 'UNAIDED_RETURN',
    enqueuedAtCompletedEncounterCount: entry.enqueuedAtCompletedEncounterCount,
    enqueuedAtMs: entry.enqueuedAtMs,
  })
}

function decision(
  state: VillageReturnQueueState,
  accepted: boolean,
  reason: VillageReturnResolveReason,
  support: VillageReturnSupport | null = null,
  outcome: 'DONE' | 'RETRY_SCHEDULED' | null = null,
): VillageReturnResolveDecision {
  return Object.freeze({ state, accepted, reason, support, outcome })
}

/** Create a new empty queue. Saved practice rows are intentionally not read. */
export function createVillageReturnQueue(runId: string): VillageReturnQueueState {
  if (!isIdentifier(runId)) throw new TypeError('runId must be a non-empty identifier')
  return makeState(runId, 1, [])
}

/**
 * Enqueue one exact, both-admitted, successful supported pair. The original
 * anchor remains untouched when the pair is already pending or terminal.
 */
export function enqueueVillageReturn(
  state: VillageReturnQueueState,
  input: VillageReturnEnqueueInput,
): VillageReturnQueueState {
  if (!isValidState(state) || !isRecord(input)
    || !isIdentifier(input.runId)
    || input.runId !== state.runId
    || input.support !== 'SUPPORTED'
    || !isEncounterCount(input.completedEncounterCount)
    || !isMonotonicTime(input.nowMs)) return state

  if (input.completedEncounterCount < latestEnqueuedCount(state)
    || input.nowMs < latestEnqueuedTime(state)) return state

  const objective = candidateFor(input)
  if (objective === null) return state

  const key = pairKey(input.contextNote, input.targetNote)
  if (state.entries.some(entry => pairKey(entry.contextNote, entry.targetNote) === key)) return state
  if (state.nextRevision >= Number.MAX_SAFE_INTEGER) return state

  const entry = makeEntry({
    runId: state.runId,
    objective,
    contextNote: input.contextNote,
    targetNote: input.targetNote,
    enqueuedAtCompletedEncounterCount: input.completedEncounterCount,
    enqueuedAtMs: input.nowMs,
    revision: state.nextRevision,
    attempt: 'initial',
    status: 'pending',
  })
  return makeState(state.runId, state.nextRevision + 1, [...state.entries, entry])
}

/** Select the first due entry for the exact target supplied by FSRS. */
export function selectVillageReturnOffer(
  state: VillageReturnQueueState,
  input: VillageReturnSelectionInput,
): VillageReturnOffer | undefined {
  if (!isValidState(state) || !isRecord(input)
    || !isIdentifier(input.runId)
    || input.runId !== state.runId
    || !isIdentifier(input.targetNote)
    || !isEncounterCount(input.completedEncounterCount)
    || !isMonotonicTime(input.nowMs)
    || !isRecord(input.candidateEligibility)) return undefined

  const candidates: readonly {
    objective: VillageReturnObjective
    contextNote: string
    targetNote: string
    bothVoiceAdmitted: boolean
  }[] = getVillageLessonCandidates(input.candidateEligibility as VillageReturnCandidateEligibility)

  const eligiblePairs = new Set(candidates
    .filter(candidate => candidate.targetNote === input.targetNote
      && candidate.bothVoiceAdmitted === true)
    .map(candidate => `${candidate.objective}\u0000${pairKey(candidate.contextNote, candidate.targetNote)}`))

  for (const entry of state.entries) {
    if (entry.status !== 'pending'
      || entry.targetNote !== input.targetNote
      || !eligiblePairs.has(`${entry.objective}\u0000${pairKey(entry.contextNote, entry.targetNote)}`)
      || !isDue(entry, input.completedEncounterCount, input.nowMs)) continue
    return offerFor(entry)
  }
  return undefined
}

/** Resolve one current offer, preserving stale/duplicate callbacks as no-ops. */
export function resolveVillageReturnOffer(
  state: VillageReturnQueueState,
  input: VillageReturnResolveInput,
): VillageReturnResolveDecision {
  if (!isValidState(state) || !isRecord(input) || !isRecord(input.offer)
    || !isIdentifier(input.runId)
    || !isEncounterCount(input.completedEncounterCount)
    || !isMonotonicTime(input.nowMs)
    || typeof input.correct !== 'boolean'
    || (input.hinted !== undefined && typeof input.hinted !== 'boolean')) {
    return decision(state, false, 'invalid-input')
  }
  if (input.runId !== state.runId) return decision(state, false, 'stale-run')
  if (!isIdentifier(input.offer.runId) || input.offer.runId !== state.runId) {
    return decision(state, false, 'stale-run')
  }
  if (input.offer.kind !== 'village-return'
    || !isObjective(input.offer.objective)
    || !isIdentifier(input.offer.contextNote)
    || !isIdentifier(input.offer.targetNote)
    || !isEncounterCount(input.offer.enqueuedAtCompletedEncounterCount)
    || !isMonotonicTime(input.offer.enqueuedAtMs)
    || !Number.isSafeInteger(input.offer.revision)
    || input.offer.revision < 1
    || !isAttempt(input.offer.attempt)
    || (input.offer.support !== 'SUPPORTED' && input.offer.support !== 'UNAIDED_RETURN')) {
    return decision(state, false, 'invalid-input')
  }
  if (input.offer.support !== (input.offer.attempt === 'retry' ? 'SUPPORTED' : 'UNAIDED_RETURN')) {
    return decision(state, false, 'stale-offer')
  }

  const entryIndex = state.entries.findIndex(entry =>
    entry.status === 'pending'
      && entry.runId === input.offer.runId
      && entry.revision === input.offer.revision
      && entry.objective === input.offer.objective
      && entry.contextNote === input.offer.contextNote
      && entry.targetNote === input.offer.targetNote
      && entry.attempt === input.offer.attempt,
  )
  if (entryIndex < 0) return decision(state, false, 'stale-offer')

  const entry = state.entries[entryIndex]
  if (entry.enqueuedAtCompletedEncounterCount !== input.offer.enqueuedAtCompletedEncounterCount
    || entry.enqueuedAtMs !== input.offer.enqueuedAtMs) {
    return decision(state, false, 'stale-offer')
  }
  if (!isDue(entry, input.completedEncounterCount, input.nowMs)) {
    return decision(state, false, 'not-due')
  }

  const hinted = input.hinted === true
  const support = supportFor(entry, hinted)
  const shouldRetry = entry.attempt === 'initial' && (hinted || input.correct !== true)
  if (!shouldRetry) {
    const terminal: VillageReturnQueueEntry = makeEntry({
      ...entry,
      status: entry.attempt === 'retry' ? 'exhausted' : 'done',
    })
    const entries = state.entries.slice()
    entries[entryIndex] = terminal
    return decision(
      makeState(state.runId, state.nextRevision, entries),
      true,
      'done',
      support,
      'DONE',
    )
  }

  if (state.nextRevision >= Number.MAX_SAFE_INTEGER) {
    return decision(state, false, 'invalid-input')
  }

  const retry: VillageReturnQueueEntry = makeEntry({
    runId: state.runId,
    objective: entry.objective,
    contextNote: entry.contextNote,
    targetNote: entry.targetNote,
    enqueuedAtCompletedEncounterCount: input.completedEncounterCount,
    enqueuedAtMs: input.nowMs,
    revision: state.nextRevision,
    attempt: 'retry',
    status: 'pending',
  })
  const entries = state.entries.slice()
  entries[entryIndex] = retry
  return decision(
    makeState(state.runId, state.nextRevision + 1, entries),
    true,
    'retry-scheduled',
    support,
    'RETRY_SCHEDULED',
  )
}
