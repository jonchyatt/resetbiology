import { autoGrade, type FsrsGrade, type NoteMemory } from '../../lib/fsrs'
import { gradeEar, gradeVoice } from '../../lib/fsrsFamily'
import { PITCHFORKS_RANGE_NOTES } from './pitchforksRange'

/** The two persisted review authorities used by the recital. */
export type PitchforksBossRecitalLane = 'voice' | 'ear'

/** `buttons` is accepted at the game boundary and is normalized to EAR. */
export type PitchforksBossRecitalInputLane = PitchforksBossRecitalLane | 'buttons'

export type PitchforksBossRecitalStatus = 'active' | 'pending-save' | 'complete' | 'cancelled'

export type PitchforksBossRecitalIgnoreReason =
  | 'invalid'
  | 'stale'
  | 'other-lane'
  | 'wrong-note'
  | 'wrong-octave'
  | 'hint'
  | 'silence'
  | 'cancelled'
  | 'navigation'
  | 'pending-save'
  | 'complete'

export interface PitchforksBossRecitalIdentity {
  readonly attempt: string
  readonly lane: PitchforksBossRecitalInputLane
  readonly note: string
  readonly cursor: number
  /** Opaque controller-issued one-shot generation/token from `state().claimId`. */
  readonly claimId: string
}

export interface PitchforksBossRecitalResolution extends PitchforksBossRecitalIdentity {
  /**
   * Caller-earned review decision. `correct: true` may be submitted only by
   * the existing exact-lock voice path or a deliberate EAR answer. `false`
   * is also a deliberate review action, never an inference from silence,
   * pitch search, a wrong note, or a wrong octave; those inputs use guidance
   * events and must not call `resolve`.
   */
  readonly correct: boolean
  readonly latencyMs?: number
}

export interface PitchforksBossRecitalStorage {
  /** Return the current family store. The controller clones it before grading. */
  readonly loadStore: (lane: PitchforksBossRecitalLane) => Record<string, NoteMemory>
  /** Persist the candidate family store and report the actual write result. */
  readonly saveStore: (lane: PitchforksBossRecitalLane, store: Record<string, NoteMemory>) => boolean
  /** Read the durable note after a save; never substitute the candidate in memory. */
  readonly readback: (lane: PitchforksBossRecitalLane, note: string) => NoteMemory | null | undefined
}

export interface PitchforksBossRecitalReceipt {
  readonly version: 1
  readonly claimId: string
  readonly attempt: string
  readonly lane: PitchforksBossRecitalLane
  readonly note: string
  readonly cursor: number
  readonly correct: boolean
  readonly grade: FsrsGrade
  readonly supported: boolean
  readonly before: NoteMemory | null
  readonly after: NoteMemory
  readonly saveResult: boolean
  readonly readback: NoteMemory | null
  readonly persisted: boolean
}

export interface PitchforksBossRecitalSupportProvenance {
  readonly source: 'hint'
  readonly claimId: string
  readonly attempt: string
  readonly lane: PitchforksBossRecitalLane
  readonly note: string
  readonly cursor: number
}

export interface PitchforksBossRecitalState {
  readonly attempt: string
  readonly lane: PitchforksBossRecitalLane
  readonly sequence: readonly string[]
  readonly cursor: number
  readonly currentNote: string | null
  readonly status: PitchforksBossRecitalStatus
  /** The current externally checked one-shot generation, or null while consumed. */
  readonly claimId: string | null
  readonly hinted: boolean
  /** The consumed receipt remains visible while a save is awaiting repair. */
  readonly pendingReceipt: PitchforksBossRecitalReceipt | null
  readonly lastReceipt: PitchforksBossRecitalReceipt | null
}

export interface CreatePitchforksBossRecitalInput {
  readonly attempt: string
  readonly lane: PitchforksBossRecitalInputLane
  readonly sequence: readonly string[]
  /** Existing-world admitted notes. The caller must provide this explicit list. */
  readonly admittedNotes: readonly string[]
  readonly storage: PitchforksBossRecitalStorage
}

export type PitchforksBossRecitalStorageErrorOperation = 'load' | 'retry-load'

export type PitchforksBossRecitalResult =
  | {
      readonly kind: 'ignored'
      readonly reason: PitchforksBossRecitalIgnoreReason
      readonly state: PitchforksBossRecitalState
    }
  | {
      readonly kind: 'persisted'
      readonly outcome: 'success' | 'failed'
      readonly supportive: boolean
      readonly completed: boolean
      readonly receipt: PitchforksBossRecitalReceipt
      readonly state: PitchforksBossRecitalState
    }
  | {
      /** A hinted success advances the untimed recital but earns no FSRS grade. */
      readonly kind: 'supported-practice'
      readonly outcome: 'success'
      readonly supportive: true
      readonly completed: boolean
      readonly grade: null
      readonly provenance: PitchforksBossRecitalSupportProvenance
      readonly state: PitchforksBossRecitalState
    }
  | {
      readonly kind: 'save-failed' | 'readback-mismatch' | 'conflict'
      readonly receipt: PitchforksBossRecitalReceipt
      readonly state: PitchforksBossRecitalState
    }
  | {
      /** No review, save, or readback was fabricated after a load failure. */
      readonly kind: 'storage-error'
      readonly operation: PitchforksBossRecitalStorageErrorOperation
      readonly state: PitchforksBossRecitalState
    }
  | {
      readonly kind: 'retry-note'
      readonly state: PitchforksBossRecitalState
    }

export type PitchforksBossRecitalEvent =
  | { readonly type: 'resolve'; readonly resolution: PitchforksBossRecitalResolution }
  | { readonly type: 'hint'; readonly identity: PitchforksBossRecitalIdentity }
  | { readonly type: 'cancel' }
  | { readonly type: 'navigation' }
  | { readonly type: 'retry-note' }
  | { readonly type: 'wrong-note' | 'wrong-octave' | 'silence' | 'stale' | 'other-lane' }

export interface PitchforksBossRecitalController {
  readonly state: () => PitchforksBossRecitalState
  readonly resolve: (resolution: PitchforksBossRecitalResolution) => PitchforksBossRecitalResult
  readonly hint: (identity: PitchforksBossRecitalIdentity) => PitchforksBossRecitalResult
  readonly retrySave: () => PitchforksBossRecitalResult
  readonly retryNote: () => PitchforksBossRecitalResult
  readonly cancel: () => PitchforksBossRecitalResult
  readonly handle: (event: PitchforksBossRecitalEvent) => PitchforksBossRecitalResult
}

const canonicalFields: ReadonlyArray<keyof NoteMemory> = [
  'note', 'S', 'D', 'due', 'lastReview', 'lapses', 'phase', 'learningReps',
]

function cloneMemory(memory: NoteMemory | null | undefined): NoteMemory | null {
  return memory ? { ...memory } : null
}

function cloneReceipt(receipt: PitchforksBossRecitalReceipt | null): PitchforksBossRecitalReceipt | null {
  if (!receipt) return null
  return {
    ...receipt,
    before: cloneMemory(receipt.before),
    after: { ...receipt.after },
    readback: cloneMemory(receipt.readback),
  }
}

function cloneStore(store: Record<string, NoteMemory>): Record<string, NoteMemory> {
  const copy: Record<string, NoteMemory> = {}
  for (const [note, memory] of Object.entries(store)) copy[note] = { ...memory }
  return copy
}

function normalizeLane(lane: unknown): PitchforksBossRecitalLane | null {
  if (lane === 'voice') return 'voice'
  if (lane === 'ear' || lane === 'buttons') return 'ear'
  return null
}

function isAdmittedLiteralNote(note: unknown): note is string {
  return typeof note === 'string' && PITCHFORKS_RANGE_NOTES.includes(note)
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function memoriesEqual(a: NoteMemory | null | undefined, b: NoteMemory | null | undefined): boolean {
  if (!a || !b) return !a && !b
  return canonicalFields.every(field => a[field] === b[field])
}

function noteReason(expected: string, actual: string): 'wrong-note' | 'wrong-octave' {
  const expectedLetter = expected[0]
  const actualLetter = actual[0]
  return expectedLetter === actualLetter ? 'wrong-octave' : 'wrong-note'
}

function cloneState(state: PitchforksBossRecitalState): PitchforksBossRecitalState {
  return {
    ...state,
    sequence: [...state.sequence],
    pendingReceipt: cloneReceipt(state.pendingReceipt),
    lastReceipt: cloneReceipt(state.lastReceipt),
  }
}

type InternalClaim = Readonly<{
  claimId: string
  identity: PitchforksBossRecitalIdentity
}>

/**
 * Construct one ephemeral, untimed boss recital.
 *
 * The caller supplies the existing world's explicit admitted sequence and
 * routes only an explicit review action to `resolve`. Before calling it, the
 * existing voice exact-lock path must have earned `correct: true`, or the EAR
 * lane must have received a deliberate answer. Detector silence, pitch search,
 * wrong-note feedback, navigation, and cancellation are guidance/lifecycle
 * events; none is inferred as a review failure. Persistence ports must read
 * the durable family store and perform a real readback. This controller owns
 * no durable history, mastery, XP, timers, or world unlocks.
 */
export function createPitchforksBossRecital(
  input: CreatePitchforksBossRecitalInput,
): PitchforksBossRecitalController {
  if (
    !input ||
    typeof input.attempt !== 'string' ||
    input.attempt.trim().length === 0 ||
    normalizeLane(input.lane) === null ||
    !Array.isArray(input.sequence) ||
    input.sequence.length === 0 ||
    !Array.isArray(input.admittedNotes) ||
    input.admittedNotes.length === 0 ||
    !input.storage ||
    typeof input.storage.loadStore !== 'function' ||
    typeof input.storage.saveStore !== 'function' ||
    typeof input.storage.readback !== 'function'
  ) {
    throw new TypeError('Invalid boss recital configuration')
  }

  const attempt = input.attempt
  const lane = normalizeLane(input.lane) as PitchforksBossRecitalLane
  const admitted = Object.freeze([...input.admittedNotes])
  const admittedSet = new Set(admitted)
  if (
    admitted.some(note => !isAdmittedLiteralNote(note)) ||
    input.sequence.some(note => !isAdmittedLiteralNote(note) || !admittedSet.has(note))
  ) {
    throw new TypeError('Boss recital sequence contains a note outside the admitted comfortable range')
  }

  const sequence = Object.freeze([...input.sequence])
  // Snapshot the callable ports too. A caller mutating its config object after
  // construction cannot redirect an in-flight review to another store/method.
  const storage = Object.freeze({
    loadStore: input.storage.loadStore.bind(input.storage),
    saveStore: input.storage.saveStore.bind(input.storage),
    readback: input.storage.readback.bind(input.storage),
  })

  let cursor = 0
  let status: PitchforksBossRecitalStatus = 'active'
  let hinted = false
  let activeClaim: InternalClaim | null = null
  let consumedClaim: InternalClaim | null = null
  let pendingReceipt: PitchforksBossRecitalReceipt | null = null
  let lastReceipt: PitchforksBossRecitalReceipt | null = null
  let claimCounter = 0
  let resolving = false

  const issueClaim = (): void => {
    const note = sequence[cursor]
    if (!note) {
      activeClaim = null
      return
    }
    const claimId = `${attempt}:${lane}:${cursor}:${++claimCounter}`
    const identity = Object.freeze({ attempt, lane, note, cursor, claimId })
    activeClaim = Object.freeze({ claimId, identity })
  }

  const snapshot = (): PitchforksBossRecitalState => cloneState({
    attempt,
    lane,
    sequence,
    cursor,
    currentNote: sequence[cursor] ?? null,
    status,
    claimId: activeClaim?.claimId ?? null,
    hinted,
    pendingReceipt,
    lastReceipt,
  })

  const ignored = (reason: PitchforksBossRecitalIgnoreReason): PitchforksBossRecitalResult => ({
    kind: 'ignored',
    reason,
    state: snapshot(),
  })

  const storageError = (operation: PitchforksBossRecitalStorageErrorOperation): PitchforksBossRecitalResult => ({
    kind: 'storage-error',
    operation,
    state: snapshot(),
  })

  const identityReason = (identity: unknown): PitchforksBossRecitalIgnoreReason | null => {
    if (!identity || typeof identity !== 'object') return 'invalid'
    const value = identity as Partial<PitchforksBossRecitalIdentity>
    if (value.attempt !== attempt) return 'stale'
    if (normalizeLane(value.lane) !== lane) return 'other-lane'
    if (!activeClaim || consumedClaim || value.claimId !== activeClaim.claimId) return 'stale'
    if (!Number.isInteger(value.cursor) || value.cursor !== cursor) return 'stale'
    if (!isAdmittedLiteralNote(value.note) || !admittedSet.has(value.note)) return 'invalid'
    const expected = sequence[cursor]
    if (!expected) return 'stale'
    if (value.note !== expected) return noteReason(expected, value.note)
    return null
  }

  const statusReason = (): PitchforksBossRecitalIgnoreReason | null => {
    if (status === 'cancelled') return 'cancelled'
    if (status === 'complete') return 'complete'
    if (status === 'pending-save') return 'pending-save'
    return null
  }

  const isCancelled = (): boolean => status === 'cancelled'

  const receiptFor = (
    claim: InternalClaim,
    resolution: PitchforksBossRecitalResolution,
    before: NoteMemory | null,
    after: NoteMemory,
    grade: FsrsGrade,
    saveResult: boolean,
    readback: NoteMemory | null,
  ): PitchforksBossRecitalReceipt => ({
    version: 1,
    claimId: claim.claimId,
    attempt,
    lane,
    note: resolution.note,
    cursor,
    correct: resolution.correct,
    grade,
    supported: hinted,
    before: cloneMemory(before),
    after: { ...after },
    saveResult,
    readback: cloneMemory(readback),
    persisted: saveResult && memoriesEqual(after, readback),
  })

  const settleReceipt = (receipt: PitchforksBossRecitalReceipt): PitchforksBossRecitalResult => {
    lastReceipt = receipt
    if (!receipt.persisted) {
      pendingReceipt = receipt
      status = 'pending-save'
      return {
        kind: receipt.saveResult ? 'readback-mismatch' : 'save-failed',
        receipt: cloneReceipt(receipt) as PitchforksBossRecitalReceipt,
        state: snapshot(),
      }
    }

    pendingReceipt = null
    consumedClaim = null
    if (receipt.correct) {
      cursor += 1
      hinted = false
      status = cursor >= sequence.length ? 'complete' : 'active'
      issueClaim()
      return {
        kind: 'persisted',
        outcome: 'success',
        supportive: receipt.supported,
        completed: status === 'complete',
        receipt: cloneReceipt(receipt) as PitchforksBossRecitalReceipt,
        state: snapshot(),
      }
    }

    // A deliberate miss is a real grade-1 review. The consumed claim remains
    // closed; retryNote is the only path that creates a new generation.
    activeClaim = null
    status = 'active'
    return {
      kind: 'persisted',
      outcome: 'failed',
      supportive: receipt.supported,
      completed: false,
      receipt: cloneReceipt(receipt) as PitchforksBossRecitalReceipt,
      state: snapshot(),
    }
  }

  const preserveCancelledReceipt = (receipt: PitchforksBossRecitalReceipt): PitchforksBossRecitalResult => {
    lastReceipt = receipt
    pendingReceipt = receipt.persisted ? null : receipt
    return ignored('cancelled')
  }

  const resolve = (resolution: PitchforksBossRecitalResolution): PitchforksBossRecitalResult => {
    const closedReason = statusReason()
    if (closedReason) return ignored(closedReason)
    const reason = identityReason(resolution)
    if (reason) return ignored(reason)
    if (typeof resolution.correct !== 'boolean') return ignored('invalid')
    if (resolution.latencyMs !== undefined && !isFiniteNonNegative(resolution.latencyMs)) return ignored('invalid')

    const claim = activeClaim
    if (!claim) return ignored('stale')

    // Copy primitive decision fields before any storage port can re-enter and
    // mutate the caller's resolution object.
    const acceptedResolution: PitchforksBossRecitalResolution = {
      ...claim.identity,
      note: resolution.note,
      correct: resolution.correct,
      latencyMs: resolution.latencyMs,
    }

    // Consume before the first port call. Reentrant resolve/hint callbacks see
    // no active claim; cancel/navigation remain allowed to close the attempt.
    activeClaim = null
    consumedClaim = claim
    resolving = true
    try {
      const latencyMs = acceptedResolution.latencyMs ?? 2000
      const note = acceptedResolution.note
      const correct = acceptedResolution.correct

      if (hinted && correct) {
        const provenance: PitchforksBossRecitalSupportProvenance = {
          source: 'hint',
          claimId: claim.claimId,
          attempt,
          lane,
          note,
          cursor,
        }
        // Supported practice is deliberately not a review boundary: do not
        // load, grade, save, read back, or fabricate a persisted receipt.
        consumedClaim = null
        cursor += 1
        hinted = false
        status = cursor >= sequence.length ? 'complete' : 'active'
        issueClaim()
        return {
          kind: 'supported-practice',
          outcome: 'success',
          supportive: true,
          completed: status === 'complete',
          grade: null,
          provenance,
          state: snapshot(),
        }
      }

      let store: Record<string, NoteMemory>
      try {
        store = cloneStore(storage.loadStore(lane))
      } catch {
        if (isCancelled()) return ignored('cancelled')
        consumedClaim = null
        issueClaim()
        return storageError('load')
      }
      if (isCancelled()) return ignored('cancelled')

      const before = cloneMemory(store[note])
      const after = lane === 'voice'
        ? gradeVoice(store, note, correct, latencyMs)
        : gradeEar(store, note, correct, latencyMs)
      const detachedAfter = { ...after }
      const grade = autoGrade(correct, latencyMs)
      if (isCancelled()) return ignored('cancelled')

      let saveResult = false
      try {
        saveResult = storage.saveStore(lane, cloneStore(store))
      } catch {
        saveResult = false
      }
      if (isCancelled()) {
        return preserveCancelledReceipt(receiptFor(
          claim, acceptedResolution, before, detachedAfter, grade, saveResult, null,
        ))
      }

      let readback: NoteMemory | null = null
      if (saveResult) {
        try {
          readback = cloneMemory(storage.readback(lane, note))
        } catch {
          readback = null
        }
      }
      const receipt = receiptFor(claim, acceptedResolution, before, detachedAfter, grade, saveResult, readback)
      if (isCancelled()) return preserveCancelledReceipt(receipt)
      return settleReceipt(receipt)
    } finally {
      resolving = false
    }
  }

  const hint = (identity: PitchforksBossRecitalIdentity): PitchforksBossRecitalResult => {
    const closedReason = statusReason()
    if (closedReason) return ignored(closedReason)
    const reason = identityReason(identity)
    if (reason) return ignored(reason)
    if (resolving) return ignored('stale')
    hinted = true
    return ignored('hint')
  }

  const retrySave = (): PitchforksBossRecitalResult => {
    if (status === 'cancelled') return ignored('cancelled')
    if (status === 'complete') return ignored('complete')
    if (resolving) return ignored('stale')
    if (
      status !== 'pending-save' ||
      !pendingReceipt ||
      !consumedClaim ||
      consumedClaim.claimId !== pendingReceipt.claimId
    ) return ignored('invalid')

    resolving = true
    try {
      const receipt = pendingReceipt
      let currentStore: Record<string, NoteMemory>
      try {
        currentStore = cloneStore(storage.loadStore(lane))
      } catch {
        if (isCancelled()) return ignored('cancelled')
        return storageError('retry-load')
      }
      if (isCancelled()) return ignored('cancelled')

      const current = cloneMemory(currentStore[receipt.note])
      // A different durable review arrived after the original claim. Never
      // replace it with this older receipt, even if the save port would permit it.
      if (!memoriesEqual(current, receipt.before) && !memoriesEqual(current, receipt.after)) {
        return {
          kind: 'conflict',
          receipt: cloneReceipt(receipt) as PitchforksBossRecitalReceipt,
          state: snapshot(),
        }
      }

      currentStore[receipt.note] = { ...receipt.after }
      let saveResult = false
      try {
        saveResult = storage.saveStore(lane, cloneStore(currentStore))
      } catch {
        saveResult = false
      }

      // Save may have been durable even though navigation/cancel re-entered
      // before readback. Preserve that truthful after-image without settling.
      let retriedReceipt: PitchforksBossRecitalReceipt = {
        ...receipt,
        saveResult,
        readback: null,
        persisted: false,
      }
      if (isCancelled()) return preserveCancelledReceipt(retriedReceipt)

      let readback: NoteMemory | null = null
      if (saveResult) {
        try {
          readback = cloneMemory(storage.readback(lane, receipt.note))
        } catch {
          readback = null
        }
      }
      retriedReceipt = {
        ...receipt,
        saveResult,
        readback,
        persisted: saveResult && memoriesEqual(receipt.after, readback),
      }
      if (isCancelled()) return preserveCancelledReceipt(retriedReceipt)
      return settleReceipt(retriedReceipt)
    } finally {
      resolving = false
    }
  }

  const retryNote = (): PitchforksBossRecitalResult => {
    const closedReason = statusReason()
    if (closedReason) return ignored(closedReason)
    if (resolving) return ignored('stale')
    // A pending receipt owns the consumed claim until RetrySave certifies it;
    // RetryNote cannot abandon it or cause a second family grade.
    if (status === 'pending-save') return ignored('pending-save')
    if (
      status !== 'active' ||
      activeClaim ||
      consumedClaim ||
      !lastReceipt ||
      lastReceipt.correct ||
      !lastReceipt.persisted ||
      lastReceipt.cursor !== cursor
    ) return ignored('invalid')

    hinted = false
    issueClaim()
    return { kind: 'retry-note', state: snapshot() }
  }

  const cancel = (): PitchforksBossRecitalResult => {
    if (status === 'cancelled') return ignored('cancelled')
    if (status === 'complete') return ignored('complete')
    activeClaim = null
    status = 'cancelled'
    // Do not erase a real pending receipt; cancellation only fences callbacks.
    return ignored('cancelled')
  }

  const navigation = (): PitchforksBossRecitalResult => {
    if (status === 'cancelled') return ignored('cancelled')
    if (status === 'complete') return ignored('complete')
    activeClaim = null
    status = 'cancelled'
    return ignored('navigation')
  }

  issueClaim()

  const handle = (event: PitchforksBossRecitalEvent): PitchforksBossRecitalResult => {
    if (!event || typeof event !== 'object') return ignored('invalid')
    switch (event.type) {
      case 'resolve': return resolve(event.resolution)
      case 'hint': return hint(event.identity)
      case 'cancel': return cancel()
      case 'navigation': return navigation()
      case 'retry-note': return retryNote()
      case 'wrong-note': return ignored('wrong-note')
      case 'wrong-octave': return ignored('wrong-octave')
      case 'silence': return ignored('silence')
      case 'stale': return ignored('stale')
      case 'other-lane': return ignored('other-lane')
      default: return ignored('invalid')
    }
  }

  return {
    state: snapshot,
    resolve,
    hint,
    retrySave,
    retryNote,
    cancel,
    handle,
  }
}
