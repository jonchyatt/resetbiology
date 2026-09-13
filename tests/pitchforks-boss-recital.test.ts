import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { createNote, type NoteMemory } from '../src/lib/fsrs'
import {
  createPitchforksBossRecital,
  type PitchforksBossRecitalController,
  type PitchforksBossRecitalIdentity,
  type PitchforksBossRecitalInputLane,
  type PitchforksBossRecitalLane,
  type PitchforksBossRecitalResolution,
  type PitchforksBossRecitalStorage,
} from '../src/components/PitchDefender/pitchforksBossRecital'

type Stores = Record<PitchforksBossRecitalLane, Record<string, NoteMemory>>

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

class MemoryStorage implements PitchforksBossRecitalStorage {
  stores: Stores = { voice: {}, ear: {} }
  saveResults: boolean[] = []
  saveCalls = 0
  loadCalls = 0
  readbackCalls = 0
  readbackOverride: ((lane: PitchforksBossRecitalLane, note: string, memory: NoteMemory | null) => NoteMemory | null) | null = null

  loadStore(lane: PitchforksBossRecitalLane): Record<string, NoteMemory> {
    this.loadCalls += 1
    return copy(this.stores[lane])
  }

  saveStore(lane: PitchforksBossRecitalLane, store: Record<string, NoteMemory>): boolean {
    this.saveCalls += 1
    const result = this.saveResults.length > 0 ? this.saveResults.shift() as boolean : true
    if (result) this.stores[lane] = copy(store)
    return result
  }

  readback(lane: PitchforksBossRecitalLane, note: string): NoteMemory | null {
    this.readbackCalls += 1
    const memory = this.stores[lane][note] ?? null
    return this.readbackOverride
      ? this.readbackOverride(lane, note, copy(memory))
      : copy(memory)
  }
}

function makeStorage(): MemoryStorage {
  return new MemoryStorage()
}

function identityFor(
  controller: PitchforksBossRecitalController,
  note?: string,
  lane?: PitchforksBossRecitalInputLane,
  cursor?: number,
  claimId?: string,
): PitchforksBossRecitalIdentity {
  const state = controller.state()
  const currentClaim = claimId ?? state.claimId
  if (!state.currentNote || !currentClaim) throw new Error('expected an active recital claim')
  return {
    attempt: state.attempt,
    lane: lane ?? state.lane,
    note: note ?? state.currentNote,
    cursor: cursor ?? state.cursor,
    claimId: currentClaim,
  }
}

function resolutionFor(
  controller: PitchforksBossRecitalController,
  correct: boolean,
  options: {
    note?: string
    lane?: PitchforksBossRecitalInputLane
    cursor?: number
    claimId?: string
    latencyMs?: number
  } = {},
): PitchforksBossRecitalResolution {
  return {
    ...identityFor(controller, options.note, options.lane, options.cursor, options.claimId),
    correct,
    latencyMs: options.latencyMs ?? 800,
  }
}

async function main(): Promise<void> {
  // Admission is explicit and closed over the finite comfortable range;
  // pitchMath's permissive frequency fallback cannot admit arbitrary strings.
  assert.throws(() => createPitchforksBossRecital({
    attempt: 'missing-admitted', lane: 'voice', sequence: ['C4'], storage: makeStorage(),
  } as never), /Invalid boss recital configuration/)
  assert.throws(() => createPitchforksBossRecital({
    attempt: 'invalid-note', lane: 'voice', sequence: ['H9'], admittedNotes: ['H9'], storage: makeStorage(),
  }), /outside the admitted comfortable range/)
  assert.throws(() => createPitchforksBossRecital({
    attempt: 'not-admitted', lane: 'voice', sequence: ['C4', 'A4'], admittedNotes: ['C4'], storage: makeStorage(),
  }), /outside the admitted comfortable range/)
  assert.throws(() => createPitchforksBossRecital({
    attempt: 'bad-literal', lane: 'voice', sequence: ['C#4'], admittedNotes: ['C#4'], storage: makeStorage(),
  }), /outside the admitted comfortable range/)
  console.log('[PASS] explicit admitted list rejects omission, invalid literals and non-admitted sequence notes')

  // A hinted success is supported practice, not an FSRS review; a wrong
  // octave never reaches a grader.
  const storage = makeStorage()
  storage.stores.voice.C4 = createNote('C4')
  const memoryBeforeSupported = copy(storage.stores)
  const recital = createPitchforksBossRecital({
    attempt: 'attempt-success',
    lane: 'voice',
    sequence: ['C4', 'D4', 'E4'],
    admittedNotes: ['C4', 'C5', 'D4', 'E4'],
    storage,
  })
  const firstIdentity = identityFor(recital)
  const wrongOctave = recital.resolve({ ...firstIdentity, note: 'C5', correct: true, latencyMs: 800 })
  assert.equal(wrongOctave.kind, 'ignored')
  assert.equal(wrongOctave.reason, 'wrong-octave')
  const wrongNote = recital.resolve({ ...firstIdentity, note: 'E4', correct: true, latencyMs: 800 })
  assert.equal(wrongNote.kind, 'ignored')
  assert.equal(wrongNote.reason, 'wrong-note')
  const stale = recital.resolve({ ...firstIdentity, cursor: 1, correct: true, latencyMs: 800 })
  assert.equal(stale.kind, 'ignored')
  assert.equal(stale.reason, 'stale')
  assert.equal(storage.saveCalls, 0)

  const hint = recital.hint(firstIdentity)
  assert.equal(hint.kind, 'ignored')
  assert.equal(hint.reason, 'hint')
  assert.equal(hint.state.hinted, true)
  assert.equal(storage.saveCalls, 0)

  const supported = recital.resolve({ ...firstIdentity, correct: true, latencyMs: 800 })
  assert.equal(supported.kind, 'supported-practice')
  if (supported.kind !== 'supported-practice') throw new Error('supported result narrowed incorrectly')
  assert.equal(supported.outcome, 'success')
  assert.equal(supported.supportive, true)
  assert.equal(supported.completed, false)
  assert.equal(supported.grade, null)
  assert.equal(supported.provenance.source, 'hint')
  assert.equal(supported.provenance.claimId, firstIdentity.claimId)
  assert.equal(supported.provenance.attempt, 'attempt-success')
  assert.equal(supported.provenance.lane, 'voice')
  assert.equal(supported.provenance.note, 'C4')
  assert.equal(supported.provenance.cursor, 0)
  assert.equal(supported.state.cursor, 1)
  assert.equal(supported.state.currentNote, 'D4')
  assert.equal(supported.state.hinted, false)
  assert.equal(supported.state.lastReceipt, null)
  assert.equal(supported.state.pendingReceipt, null)
  assert.notEqual(supported.state.claimId, firstIdentity.claimId)
  assert.equal(storage.loadCalls, 0)
  assert.equal(storage.saveCalls, 0)
  assert.equal(storage.readbackCalls, 0)
  assert.deepEqual(storage.stores, memoryBeforeSupported)

  // The consumed callback is stale even when a deliberate failure leaves the
  // cursor in place; other-lane events, silence and guidance are no-effects.
  const duplicate = recital.resolve({ ...firstIdentity, correct: true, latencyMs: 800 })
  assert.equal(duplicate.kind, 'ignored')
  assert.equal(duplicate.reason, 'stale')
  const otherLane = recital.resolve(resolutionFor(recital, true, {
    lane: 'ear', note: 'D4', cursor: 1,
  }))
  assert.equal(otherLane.kind, 'ignored')
  assert.equal(otherLane.reason, 'other-lane')
  const silence = recital.handle({ type: 'silence' })
  assert.equal(silence.kind, 'ignored')
  assert.equal(silence.reason, 'silence')

  // Once the next claim is fresh and unaided, it earns the normal persisted
  // family grade and advances to the final note.
  const success = recital.resolve(resolutionFor(recital, true))
  assert.equal(success.kind, 'persisted')
  if (success.kind !== 'persisted') throw new Error('success result narrowed incorrectly')
  assert.equal(success.outcome, 'success')
  assert.equal(success.supportive, false)
  assert.equal(success.receipt.supported, false)
  assert.equal(success.receipt.before, null)
  assert.equal(success.receipt.after.phase, 'learning')
  assert.equal(success.receipt.after.learningReps, 1)
  assert.equal(success.receipt.grade, 4)
  assert.equal(success.receipt.persisted, true)
  assert.equal(success.receipt.readback?.lastReview, success.receipt.after.lastReview)
  assert.equal(success.state.cursor, 2)
  assert.equal(success.state.currentNote, 'E4')
  assert.equal(success.state.status, 'active')
  assert.notEqual(success.receipt.claimId, firstIdentity.claimId)
  assert.equal(storage.loadCalls, 1)
  assert.equal(storage.saveCalls, 1)
  assert.equal(storage.readbackCalls, 1)

  const voiceMemoryBeforeFinalSupported = copy(storage.stores)
  const voiceFinalIdentity = identityFor(recital)
  assert.equal(recital.hint(voiceFinalIdentity).kind, 'ignored')
  const voiceFinalSupported = recital.resolve({ ...voiceFinalIdentity, correct: true, latencyMs: 800 })
  assert.equal(voiceFinalSupported.kind, 'supported-practice')
  if (voiceFinalSupported.kind !== 'supported-practice') throw new Error('VOICE final supported result narrowed incorrectly')
  assert.equal(voiceFinalSupported.completed, true)
  assert.equal(voiceFinalSupported.grade, null)
  assert.equal(voiceFinalSupported.state.status, 'complete')
  assert.equal(voiceFinalSupported.state.cursor, 3)
  assert.equal(voiceFinalSupported.state.currentNote, null)
  assert.equal('receipt' in voiceFinalSupported, false)
  assert.equal(storage.loadCalls, 1)
  assert.equal(storage.saveCalls, 1)
  assert.equal(storage.readbackCalls, 1)
  assert.deepEqual(storage.stores, voiceMemoryBeforeFinalSupported)
  console.log('[PASS] VOICE hinted practice is no-grade, duplicate-safe, followed by unaided grading and truthful supported completion')

  // EAR follows the same no-grade support contract. A supported first note
  // leaves durable memory untouched, the duplicate is one-shot stale, a fresh
  // unaided note earns normally, and a final supported note completes honestly.
  const earStorage = makeStorage()
  earStorage.stores.ear.C4 = createNote('C4')
  const earMemoryBeforeSupported = copy(earStorage.stores)
  const earRecital = createPitchforksBossRecital({
    attempt: 'attempt-ear-supported',
    lane: 'ear',
    sequence: ['C4', 'D4', 'E4'],
    admittedNotes: ['C4', 'D4', 'E4'],
    storage: earStorage,
  })
  const earFirstIdentity = identityFor(earRecital)
  assert.equal(earRecital.hint(earFirstIdentity).kind, 'ignored')
  const earSupported = earRecital.resolve({ ...earFirstIdentity, correct: true, latencyMs: 800 })
  assert.equal(earSupported.kind, 'supported-practice')
  if (earSupported.kind !== 'supported-practice') throw new Error('EAR supported result narrowed incorrectly')
  assert.equal(earSupported.grade, null)
  assert.equal(earSupported.provenance.source, 'hint')
  assert.equal(earSupported.provenance.lane, 'ear')
  assert.equal(earSupported.provenance.note, 'C4')
  assert.equal(earSupported.state.cursor, 1)
  assert.equal(earSupported.state.currentNote, 'D4')
  assert.equal(earSupported.state.status, 'active')
  assert.equal('receipt' in earSupported, false)
  assert.equal(earStorage.loadCalls, 0)
  assert.equal(earStorage.saveCalls, 0)
  assert.equal(earStorage.readbackCalls, 0)
  assert.deepEqual(earStorage.stores, earMemoryBeforeSupported)

  const earDuplicate = earRecital.resolve({ ...earFirstIdentity, correct: true, latencyMs: 800 })
  assert.equal(earDuplicate.kind, 'ignored')
  assert.equal(earDuplicate.reason, 'stale')

  const earUnaided = earRecital.resolve(resolutionFor(earRecital, true))
  assert.equal(earUnaided.kind, 'persisted')
  if (earUnaided.kind !== 'persisted') throw new Error('EAR unaided result narrowed incorrectly')
  assert.equal(earUnaided.outcome, 'success')
  assert.equal(earUnaided.supportive, false)
  assert.equal(earUnaided.receipt.supported, false)
  assert.equal(earUnaided.receipt.grade, 4)
  assert.equal(earUnaided.state.cursor, 2)
  assert.equal(earStorage.loadCalls, 1)
  assert.equal(earStorage.saveCalls, 1)
  assert.equal(earStorage.readbackCalls, 1)

  const earMemoryBeforeFinalSupported = copy(earStorage.stores)
  const earFinalIdentity = identityFor(earRecital)
  assert.equal(earRecital.hint(earFinalIdentity).kind, 'ignored')
  const earFinalSupported = earRecital.resolve({ ...earFinalIdentity, correct: true, latencyMs: 800 })
  assert.equal(earFinalSupported.kind, 'supported-practice')
  if (earFinalSupported.kind !== 'supported-practice') throw new Error('EAR final supported result narrowed incorrectly')
  assert.equal(earFinalSupported.completed, true)
  assert.equal(earFinalSupported.grade, null)
  assert.equal(earFinalSupported.state.status, 'complete')
  assert.equal(earFinalSupported.state.cursor, 3)
  assert.equal(earFinalSupported.state.currentNote, null)
  assert.equal('receipt' in earFinalSupported, false)
  assert.equal(earStorage.loadCalls, 1)
  assert.equal(earStorage.saveCalls, 1)
  assert.equal(earStorage.readbackCalls, 1)
  assert.deepEqual(earStorage.stores, earMemoryBeforeFinalSupported)
  console.log('[PASS] EAR hinted practice is no-grade, duplicate-safe, followed by unaided grading and truthful supported completion')

  // Deliberate failure uses the actual family grader once and remains on the
  // same note. The old claim is stale until an explicit fresh RetryNote.
  const failureStorage = makeStorage()
  const failureRecital = createPitchforksBossRecital({
    attempt: 'attempt-failure', lane: 'voice', sequence: ['C4', 'C4'], admittedNotes: ['C4'], storage: failureStorage,
  })
  const failureIdentity = identityFor(failureRecital)
  const failure = failureRecital.resolve({ ...failureIdentity, correct: false, latencyMs: 800 })
  assert.equal(failure.kind, 'persisted')
  if (failure.kind !== 'persisted') throw new Error('failure result narrowed incorrectly')
  assert.equal(failure.outcome, 'failed')
  assert.equal(failure.supportive, false)
  assert.equal(failure.state.cursor, 0)
  assert.equal(failure.state.currentNote, 'C4')
  assert.equal(failure.state.claimId, null)
  assert.equal(failure.receipt.grade, 1)
  assert.equal(failure.receipt.after.phase, 'learning')
  assert.equal(failure.receipt.after.lapses, 0)
  assert.equal(failureStorage.stores.voice.C4.lapses, 0)

  const duplicateFailure = failureRecital.resolve({ ...failureIdentity, correct: false, latencyMs: 800 })
  assert.equal(duplicateFailure.kind, 'ignored')
  assert.equal(duplicateFailure.reason, 'stale')
  assert.equal(failureStorage.saveCalls, 1)

  const retryNote = failureRecital.retryNote()
  assert.equal(retryNote.kind, 'retry-note')
  assert.equal(retryNote.state.cursor, 0)
  assert.notEqual(retryNote.state.claimId, failureIdentity.claimId)
  assert.equal(failureStorage.saveCalls, 1)
  const staleAfterFreshRetry = failureRecital.resolve({ ...failureIdentity, correct: true, latencyMs: 800 })
  assert.equal(staleAfterFreshRetry.kind, 'ignored')
  assert.equal(staleAfterFreshRetry.reason, 'stale')

  const freshRetry = failureRecital.resolve(resolutionFor(failureRecital, true))
  assert.equal(freshRetry.kind, 'persisted')
  if (freshRetry.kind !== 'persisted') throw new Error('fresh retry result narrowed incorrectly')
  assert.equal(freshRetry.outcome, 'success')
  assert.notEqual(freshRetry.receipt.claimId, failure.receipt.claimId)
  assert.equal(failureStorage.stores.voice.C4.phase, 'learning')
  const secondFreshReview = failureRecital.resolve(resolutionFor(failureRecital, true))
  assert.equal(secondFreshReview.kind, 'persisted')
  assert.equal(failureStorage.stores.voice.C4.phase, 'review')
  assert.equal(failureStorage.saveCalls, 3)
  console.log('[PASS] deliberate false grades once, reports actual grade 1, and fresh retry gets a new claim')

  // A false save keeps the actual after-image and consumed claim. RetryNote
  // cannot release it; RetrySave writes/readbacks that image without grading.
  const retryStorage = makeStorage()
  retryStorage.saveResults = [false, true]
  const retryRecital = createPitchforksBossRecital({
    attempt: 'attempt-save-retry', lane: 'voice', sequence: ['C4'], admittedNotes: ['C4'], storage: retryStorage,
  })
  const retryIdentity = identityFor(retryRecital)
  const saveFailed = retryRecital.resolve({ ...retryIdentity, correct: true, latencyMs: 800 })
  assert.equal(saveFailed.kind, 'save-failed')
  if (saveFailed.kind !== 'save-failed') throw new Error('save failure result narrowed incorrectly')
  assert.equal(saveFailed.receipt.saveResult, false)
  assert.equal(saveFailed.receipt.persisted, false)
  assert.equal(saveFailed.receipt.after.learningReps, 1)
  assert.equal(saveFailed.state.cursor, 0)
  assert.equal(saveFailed.state.pendingReceipt?.after.learningReps, 1)
  const retryNoteWhilePending = retryRecital.retryNote()
  assert.equal(retryNoteWhilePending.kind, 'ignored')
  assert.equal(retryNoteWhilePending.reason, 'pending-save')
  const duplicatePending = retryRecital.resolve({ ...retryIdentity, correct: true, latencyMs: 800 })
  assert.equal(duplicatePending.kind, 'ignored')
  assert.equal(duplicatePending.reason, 'pending-save')
  assert.equal(retryStorage.saveCalls, 1)

  const retried = retryRecital.retrySave()
  assert.equal(retried.kind, 'persisted')
  if (retried.kind !== 'persisted') throw new Error('retry result narrowed incorrectly')
  assert.equal(retried.outcome, 'success')
  assert.equal(retried.receipt.claimId, saveFailed.receipt.claimId)
  assert.equal(retried.receipt.after.lastReview, saveFailed.receipt.after.lastReview)
  assert.equal(retryStorage.stores.voice.C4.lastReview, saveFailed.receipt.after.lastReview)
  assert.equal(retryStorage.saveCalls, 2)
  assert.equal(retryStorage.readbackCalls, 1)
  console.log('[PASS] false save then RetrySave persists one actual grade; pending RetryNote cannot regrade')

  // A truthful write with a lying/missing readback is not persistence. Once
  // readback is repaired, RetrySave certifies the same EAR review.
  const mismatchStorage = makeStorage()
  mismatchStorage.readbackOverride = (_lane, _note, memory) => memory ? { ...memory, D: memory.D + 1 } : null
  const mismatchRecital = createPitchforksBossRecital({
    attempt: 'attempt-readback', lane: 'ear', sequence: ['C4'], admittedNotes: ['C4'], storage: mismatchStorage,
  })
  const mismatch = mismatchRecital.resolve(resolutionFor(mismatchRecital, true))
  assert.equal(mismatch.kind, 'readback-mismatch')
  if (mismatch.kind !== 'readback-mismatch') throw new Error('readback result narrowed incorrectly')
  assert.equal(mismatch.receipt.persisted, false)
  assert.equal(mismatch.state.cursor, 0)
  const actualAfter = mismatch.receipt.after
  mismatchStorage.readbackOverride = null
  const mismatchRetry = mismatchRecital.retrySave()
  assert.equal(mismatchRetry.kind, 'persisted')
  if (mismatchRetry.kind !== 'persisted') throw new Error('readback retry result narrowed incorrectly')
  assert.equal(mismatchRetry.receipt.after.lastReview, actualAfter.lastReview)
  assert.equal(mismatchRetry.receipt.claimId, mismatch.receipt.claimId)
  assert.equal(mismatchStorage.stores.ear.C4.lastReview, actualAfter.lastReview)
  assert.equal(mismatchStorage.stores.voice.C4, undefined)
  console.log('[PASS] readback mismatch blocks cursor and RetrySave certifies the same EAR review')

  // A newer durable review is a conflict, never an overwrite. No save call is
  // made while refusing the stale receipt.
  const conflictStorage = makeStorage()
  conflictStorage.saveResults = [false, true]
  const conflictRecital = createPitchforksBossRecital({
    attempt: 'attempt-conflict', lane: 'voice', sequence: ['C4'], admittedNotes: ['C4'], storage: conflictStorage,
  })
  const conflictPending = conflictRecital.resolve(resolutionFor(conflictRecital, true))
  assert.equal(conflictPending.kind, 'save-failed')
  const newer = { ...conflictStorage.stores.voice.C4, due: 9999999999999, lastReview: 9999999999998 }
  conflictStorage.stores.voice.C4 = newer
  const saveCallsBeforeConflict = conflictStorage.saveCalls
  const conflict = conflictRecital.retrySave()
  assert.equal(conflict.kind, 'conflict')
  assert.equal(conflictStorage.saveCalls, saveCallsBeforeConflict)
  assert.equal(conflictStorage.stores.voice.C4.due, newer.due)
  assert.equal(conflictRecital.state().cursor, 0)
  console.log('[PASS] RetrySave refuses a newer conflicting review without overwrite')

  // Reentrant resolution sees the consumed claim before the load port can
  // re-enter. Only the outer authority grades, saves and advances once.
  const reentrantStorage = makeStorage()
  let reentrantRecital!: PitchforksBossRecitalController
  let nestedResult: ReturnType<PitchforksBossRecitalController['resolve']> | null = null
  let reentrantIdentity!: PitchforksBossRecitalIdentity
  const reentrantLoad = reentrantStorage.loadStore.bind(reentrantStorage)
  reentrantStorage.loadStore = lane => {
    nestedResult = reentrantRecital.resolve({ ...reentrantIdentity, correct: true, latencyMs: 800 })
    return reentrantLoad(lane)
  }
  reentrantRecital = createPitchforksBossRecital({
    attempt: 'attempt-reentrant', lane: 'voice', sequence: ['C4'], admittedNotes: ['C4'], storage: reentrantStorage,
  })
  reentrantIdentity = identityFor(reentrantRecital)
  const reentrantOuter = reentrantRecital.resolve({ ...reentrantIdentity, correct: true, latencyMs: 800 })
  const nested = nestedResult as unknown as ReturnType<PitchforksBossRecitalController['resolve']>
  if (!nested || nested.kind !== 'ignored') throw new Error('reentrant resolve unexpectedly had an effect')
  assert.equal(nested.reason, 'stale')
  assert.equal(reentrantOuter.kind, 'persisted')
  assert.equal(reentrantStorage.saveCalls, 1)
  assert.equal(reentrantRecital.state().cursor, 1)
  assert.equal(reentrantRecital.state().status, 'complete')
  console.log('[PASS] reentrant resolve cannot consume or grade a claim twice')

  // Navigation/cancel is permanent and is checked after every synchronous
  // storage boundary. A cancellation in a readback preserves any real receipt
  // but never advances a cancelled attempt.
  const loadCancelStorage = makeStorage()
  let loadCancelRecital!: PitchforksBossRecitalController
  const loadCancelBase = loadCancelStorage.loadStore.bind(loadCancelStorage)
  loadCancelStorage.loadStore = lane => {
    const result = loadCancelRecital.cancel()
    if (result.kind !== 'ignored') throw new Error('cancel did not close the load boundary')
    assert.equal(result.reason, 'cancelled')
    return loadCancelBase(lane)
  }
  loadCancelRecital = createPitchforksBossRecital({
    attempt: 'attempt-load-cancel', lane: 'voice', sequence: ['C4'], admittedNotes: ['C4'], storage: loadCancelStorage,
  })
  const loadCancelled = loadCancelRecital.resolve(resolutionFor(loadCancelRecital, true))
  if (loadCancelled.kind !== 'ignored') throw new Error('load cancellation was overwritten')
  assert.equal(loadCancelled.reason, 'cancelled')
  assert.equal(loadCancelRecital.state().status, 'cancelled')
  assert.equal(loadCancelStorage.saveCalls, 0)

  const saveNavigationStorage = makeStorage()
  let saveNavigationRecital!: PitchforksBossRecitalController
  const saveNavigationBase = saveNavigationStorage.saveStore.bind(saveNavigationStorage)
  saveNavigationStorage.saveStore = (lane, store) => {
    const result = saveNavigationRecital.handle({ type: 'navigation' })
    if (result.kind !== 'ignored') throw new Error('navigation did not close the save boundary')
    assert.equal(result.reason, 'navigation')
    return saveNavigationBase(lane, store)
  }
  saveNavigationRecital = createPitchforksBossRecital({
    attempt: 'attempt-save-navigation', lane: 'voice', sequence: ['C4'], admittedNotes: ['C4'], storage: saveNavigationStorage,
  })
  const saveNavigated = saveNavigationRecital.resolve(resolutionFor(saveNavigationRecital, true))
  if (saveNavigated.kind !== 'ignored') throw new Error('save navigation was overwritten')
  assert.equal(saveNavigated.reason, 'cancelled')
  assert.equal(saveNavigationRecital.state().status, 'cancelled')
  assert.equal(saveNavigationRecital.state().cursor, 0)
  assert.equal(saveNavigationStorage.saveCalls, 1)
  assert.equal(saveNavigationStorage.readbackCalls, 0)
  assert.equal(saveNavigationRecital.state().lastReceipt?.note, 'C4')
  assert.equal(saveNavigationRecital.state().lastReceipt?.after.learningReps, 1)
  assert.equal(saveNavigationRecital.state().lastReceipt?.saveResult, true)
  assert.equal(saveNavigationRecital.state().lastReceipt?.readback, null)
  assert.equal(saveNavigationRecital.state().lastReceipt?.persisted, false)

  const readbackCancelStorage = makeStorage()
  let readbackCancelRecital!: PitchforksBossRecitalController
  const readbackCancelBase = readbackCancelStorage.readback.bind(readbackCancelStorage)
  readbackCancelStorage.readback = (lane, note) => {
    const result = readbackCancelRecital.cancel()
    if (result.kind !== 'ignored') throw new Error('cancel did not close the readback boundary')
    assert.equal(result.reason, 'cancelled')
    return readbackCancelBase(lane, note)
  }
  readbackCancelRecital = createPitchforksBossRecital({
    attempt: 'attempt-readback-cancel', lane: 'ear', sequence: ['C4'], admittedNotes: ['C4'], storage: readbackCancelStorage,
  })
  const readbackCancelled = readbackCancelRecital.resolve(resolutionFor(readbackCancelRecital, true))
  if (readbackCancelled.kind !== 'ignored') throw new Error('readback cancellation was overwritten')
  assert.equal(readbackCancelled.reason, 'cancelled')
  assert.equal(readbackCancelRecital.state().status, 'cancelled')
  assert.equal(readbackCancelRecital.state().cursor, 0)
  assert.equal(readbackCancelRecital.state().lastReceipt?.persisted, true)
  console.log('[PASS] active navigation/cancel fences load, save and readback reentry permanently')

  // A failed load has no after-image and cannot grade, save an empty store, or
  // erase durable history. The controller issues a fresh claim for recovery.
  const loadFailureStorage = makeStorage()
  const existingC4 = createNote('C4')
  loadFailureStorage.stores.voice.C4 = existingC4
  loadFailureStorage.loadStore = () => { throw new Error('durable read failed') }
  const loadFailureRecital = createPitchforksBossRecital({
    attempt: 'attempt-load-failure', lane: 'voice', sequence: ['C4'], admittedNotes: ['C4'], storage: loadFailureStorage,
  })
  const loadFailureClaim = loadFailureRecital.state().claimId
  const loadFailure = loadFailureRecital.resolve(resolutionFor(loadFailureRecital, true))
  assert.equal(loadFailure.kind, 'storage-error')
  if (loadFailure.kind !== 'storage-error') throw new Error('load failure result narrowed incorrectly')
  assert.equal(loadFailure.operation, 'load')
  assert.equal(loadFailureRecital.state().status, 'active')
  assert.equal(loadFailureRecital.state().cursor, 0)
  assert.notEqual(loadFailureRecital.state().claimId, loadFailureClaim)
  assert.deepEqual(loadFailureStorage.stores.voice.C4, existingC4)
  assert.equal(loadFailureStorage.saveCalls, 0)
  assert.equal(loadFailureStorage.readbackCalls, 0)
  console.log('[PASS] thrown load is a truthful no-effect storage error and preserves existing family history')

  // RetrySave retains its consumed claim when its repair load fails.
  const retryLoadStorage = makeStorage()
  retryLoadStorage.saveResults = [false]
  let retryLoadFailure = false
  const retryLoadBase = retryLoadStorage.loadStore.bind(retryLoadStorage)
  retryLoadStorage.loadStore = lane => {
    if (retryLoadFailure) throw new Error('retry durable read failed')
    return retryLoadBase(lane)
  }
  const retryLoadRecital = createPitchforksBossRecital({
    attempt: 'attempt-retry-load-failure', lane: 'voice', sequence: ['C4'], admittedNotes: ['C4'], storage: retryLoadStorage,
  })
  const retryLoadPending = retryLoadRecital.resolve(resolutionFor(retryLoadRecital, true))
  assert.equal(retryLoadPending.kind, 'save-failed')
  if (retryLoadPending.kind !== 'save-failed') throw new Error('retry-load setup narrowed incorrectly')
  retryLoadFailure = true
  const retryLoadError = retryLoadRecital.retrySave()
  assert.equal(retryLoadError.kind, 'storage-error')
  if (retryLoadError.kind !== 'storage-error') throw new Error('retry-load result narrowed incorrectly')
  assert.equal(retryLoadError.operation, 'retry-load')
  assert.equal(retryLoadRecital.state().status, 'pending-save')
  assert.equal(retryLoadRecital.state().pendingReceipt?.claimId, retryLoadPending.receipt.claimId)
  assert.equal(retryLoadStorage.saveCalls, 1)
  console.log('[PASS] RetrySave load failure retains the pending consumed claim without regrading')

  // RetrySave has its own in-flight fence. A storage reentry cannot recurse
  // into a second persistence attempt or settle the same receipt twice.
  const retryReentrantStorage = makeStorage()
  retryReentrantStorage.saveResults = [false, true]
  let retryReentrantRecital!: PitchforksBossRecitalController
  let nestedRetrySave: ReturnType<PitchforksBossRecitalController['retrySave']> | null = null
  const retryReentrantBase = retryReentrantStorage.loadStore.bind(retryReentrantStorage)
  retryReentrantStorage.loadStore = lane => {
    if (retryReentrantRecital.state().status === 'pending-save' && !nestedRetrySave) {
      nestedRetrySave = retryReentrantRecital.retrySave()
    }
    return retryReentrantBase(lane)
  }
  retryReentrantRecital = createPitchforksBossRecital({
    attempt: 'attempt-retry-reentrant', lane: 'voice', sequence: ['C4'], admittedNotes: ['C4'], storage: retryReentrantStorage,
  })
  const retryReentrantPending = retryReentrantRecital.resolve(resolutionFor(retryReentrantRecital, true))
  assert.equal(retryReentrantPending.kind, 'save-failed')
  const retryReentrantResult = retryReentrantRecital.retrySave()
  const nestedRetry = nestedRetrySave as unknown as ReturnType<PitchforksBossRecitalController['retrySave']>
  if (nestedRetry.kind !== 'ignored') throw new Error('reentrant RetrySave unexpectedly had an effect')
  assert.equal(nestedRetry.reason, 'stale')
  assert.equal(retryReentrantResult.kind, 'persisted')
  assert.equal(retryReentrantStorage.saveCalls, 2)
  assert.equal(retryReentrantRecital.state().cursor, 1)
  console.log('[PASS] reentrant RetrySave is fenced before its load/save/readback ports')

  // Caller-owned config is snapshotted before the first claim. Mutating the
  // source arrays, strings, storage object, or methods cannot rewrite it.
  const immutableStorage = makeStorage()
  const alternateStorage = makeStorage()
  const mutableConfig = {
    attempt: 'immutable-attempt',
    lane: 'voice' as PitchforksBossRecitalInputLane,
    sequence: ['C4'],
    admittedNotes: ['C4'],
    storage: immutableStorage,
  }
  const immutableRecital = createPitchforksBossRecital(mutableConfig)
  const immutableIdentity = identityFor(immutableRecital)
  mutableConfig.attempt = 'mutated-attempt'
  mutableConfig.lane = 'ear'
  mutableConfig.sequence[0] = 'D4'
  mutableConfig.admittedNotes[0] = 'D4'
  mutableConfig.storage = alternateStorage
  immutableStorage.loadStore = () => { throw new Error('mutated storage method must not be used') }
  const immutableResult = immutableRecital.resolve({ ...immutableIdentity, correct: true, latencyMs: 800 })
  assert.equal(immutableResult.kind, 'persisted')
  assert.equal(immutableResult.state.attempt, 'immutable-attempt')
  assert.equal(immutableResult.state.lane, 'voice')
  assert.equal(immutableResult.receipt.note, 'C4')
  assert.equal(immutableStorage.saveCalls, 1)
  assert.equal(alternateStorage.saveCalls, 0)

  const resolutionMutationStorage = makeStorage()
  let submittedResolution!: PitchforksBossRecitalResolution
  const resolutionMutationBase = resolutionMutationStorage.loadStore.bind(resolutionMutationStorage)
  resolutionMutationStorage.loadStore = lane => {
    const mutable = submittedResolution as unknown as { note: string; correct: boolean; latencyMs?: number }
    mutable.note = 'D4'
    mutable.correct = false
    mutable.latencyMs = 5000
    return resolutionMutationBase(lane)
  }
  const resolutionMutationRecital = createPitchforksBossRecital({
    attempt: 'attempt-resolution-snapshot', lane: 'voice', sequence: ['C4'], admittedNotes: ['C4'], storage: resolutionMutationStorage,
  })
  submittedResolution = resolutionFor(resolutionMutationRecital, true, { latencyMs: 800 })
  const resolutionMutationResult = resolutionMutationRecital.resolve(submittedResolution)
  assert.equal(resolutionMutationResult.kind, 'persisted')
  if (resolutionMutationResult.kind !== 'persisted') throw new Error('resolution mutation result narrowed incorrectly')
  assert.equal(resolutionMutationResult.receipt.note, 'C4')
  assert.equal(resolutionMutationResult.receipt.correct, true)
  assert.equal(resolutionMutationResult.receipt.grade, 4)
  assert.equal(resolutionMutationStorage.stores.voice.C4.learningReps, 1)
  console.log('[PASS] attempt, lane, sequence, admitted list and storage ports are immutable snapshots')

  // The module owns no progression/world writer or durable browser storage;
  // contract text keeps correct=true caller-earned and never infers silence.
  const source = await readFile(new URL('../src/components/PitchDefender/pitchforksBossRecital.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /pitchforksLevelProgress|WORLD_REGISTRY|localStorage|scheduler/i)
  assert.match(source, /gradeVoice/)
  assert.match(source, /gradeEar/)
  assert.match(source, /correct: true[\s\S]{0,240}exact-lock/)
  assert.doesNotMatch(source, /catch\s*\{\s*store\s*=\s*\{\}\s*\}/)
  console.log('[PASS] controller has direct family-grader imports, caller-earned resolution contract and no world/progression/durable writer')

  console.log('pitchforks boss recital: all PASS')
}

void main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
