import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createNote, type NoteMemory } from '../src/lib/fsrs'
import {
  createPitchforksSongcraftPractice,
  type SongcraftPracticeController,
  type SongcraftPracticeOccurrenceIdentity,
  type SongcraftPracticeLane,
  type SongcraftPracticeResolution,
} from '../src/components/PitchDefender/pitchforksSongcraftPractice'
import {
  SONGCRAFT_PHRASE_NORMALIZATION_VERSION,
  type SongcraftPhrase,
  type SongcraftPhraseOccurrence,
} from '../src/components/PitchDefender/pitchforksSongcraftPhrase'
import type {
  PitchforksBossRecitalLane,
  PitchforksBossRecitalStorage,
} from '../src/components/PitchDefender/pitchforksBossRecital'

let checks = 0
const check = (run: () => void) => { run(); checks += 1 }

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

const occurrence = (
  ordinal: number,
  pitchName: string,
  semi: number,
  octave: number,
  beatOffset: number,
  beats = 1,
): SongcraftPhraseOccurrence => ({
  ordinal,
  isRest: false,
  semi,
  pitchName,
  octave,
  midi: semi + 60,
  beats,
  measureIdx: 1,
  beatOffset,
})

const rest = (ordinal: number, beatOffset: number, beats = 1): SongcraftPhraseOccurrence => ({
  ordinal,
  isRest: true,
  semi: null,
  pitchName: null,
  octave: null,
  midi: null,
  beats,
  measureIdx: 1,
  beatOffset,
})

function phraseWith(occurrences: readonly SongcraftPhraseOccurrence[]): SongcraftPhrase {
  return {
    sourceKey: 'pd_composed_songcraft_practice',
    title: 'Practice Fixture',
    sourceSha256: 'a'.repeat(64),
    provenance: {
      source: 'composer',
      normalizationVersion: SONGCRAFT_PHRASE_NORMALIZATION_VERSION,
    },
    occurrences,
  }
}

function identityFor(controller: SongcraftPracticeController): SongcraftPracticeOccurrenceIdentity {
  const current = controller.state().current
  if (current.kind === 'complete' || current.kind === 'cancelled') throw new Error('expected active occurrence')
  return current.identity
}

function resolutionFor(
  controller: SongcraftPracticeController,
  correct: boolean,
  options: { note?: string; identity?: SongcraftPracticeOccurrenceIdentity } = {},
): SongcraftPracticeResolution {
  const identity = options.identity ?? identityFor(controller)
  const current = controller.state().current
  const expected = current.kind === 'note' ? current.occurrence.pitchName : null
  if (!expected) throw new Error('expected a note occurrence')
  return {
    ...identity,
    note: options.note ?? expected,
    correct,
    latencyMs: 800,
  }
}

function mixedPhrase(): SongcraftPhrase {
  return phraseWith([
    occurrence(0, 'C4', 0, 4, 0),
    rest(1, 1),
    // C5 is an authored exact octave but is not in the supplied admission list.
    occurrence(2, 'C5', 12, 5, 2),
    occurrence(3, 'C4', 0, 4, 3),
    occurrence(4, 'D4', 2, 4, 4),
  ])
}

function makePractice(
  phrase: SongcraftPhrase,
  storage: MemoryStorage,
  attemptId = 'practice-attempt-1',
  admittedNotes: readonly string[] = ['C4', 'D4'],
): SongcraftPracticeController {
  return createPitchforksSongcraftPractice({
    phrase,
    attemptId,
    lane: 'voice',
    admittedNotes,
    storage,
  })
}

async function main(): Promise<void> {
  const builtinPhrase: SongcraftPhrase = {
    ...phraseWith([occurrence(0, 'C4', 0, 4, 0), rest(1, 1)]),
    sourceKey: 'builtin:practice:storm-studies:1:c4-d4',
    provenance: {
      source: 'builtin',
      normalizationVersion: SONGCRAFT_PHRASE_NORMALIZATION_VERSION,
      packId: 'storm-studies',
      packVersion: '1',
      presetId: 'c4-d4',
      author: 'Pitchforks III original practice',
      licenseId: 'LicenseRef-Pitchforks-Original-Bundled-Use',
      licenseText: 'Original exercise created for use within Pitchforks III. No third-party melody is incorporated. No standalone public license is granted.',
      sourceReference: 'project:pitchforks-iii/storm-studies/1/c4-d4',
    },
  }
  const builtinStorage = new MemoryStorage()
  const builtinPractice = createPitchforksSongcraftPractice({ phrase: builtinPhrase, attemptId: 'builtin-proof', lane: 'voice', admittedNotes: ['C4'], storage: builtinStorage })
  check(() => assert.deepEqual(builtinPractice.state().phrase.provenance, builtinPhrase.provenance))
  check(() => assert.ok(Object.isFrozen(builtinPractice.state().phrase.provenance)))
  builtinPractice.resolve(resolutionFor(builtinPractice, true))
  check(() => assert.equal(builtinPractice.state().current.kind, 'rest'))
  check(() => assert.equal(builtinPractice.state().phrase.provenance.source, 'builtin'))
  check(() => assert.equal(builtinStorage.saveCalls, 1))
  check(() => assert.deepEqual(builtinStorage.stores.ear, {}))
  check(() => assert.throws(() => createPitchforksSongcraftPractice({ phrase: { ...builtinPhrase, sourceKey: 'pd_composed_forged' }, attemptId: 'bad-key', lane: 'voice', admittedNotes: ['C4'], storage: new MemoryStorage() }), /preset identity/))
  check(() => assert.throws(() => createPitchforksSongcraftPractice({ phrase: { ...builtinPhrase, provenance: { ...builtinPhrase.provenance, licenseId: '' } } as unknown as SongcraftPhrase, attemptId: 'bad-license', lane: 'voice', admittedNotes: ['C4'], storage: new MemoryStorage() }), /phrase snapshot/))
  const storage = new MemoryStorage()
  const sourcePhrase = mixedPhrase()
  const practice = makePractice(sourcePhrase, storage)

  check(() => assert.equal(practice.state().current.kind, 'note'))
  check(() => assert.equal(practice.state().current.occurrence.pitchName, 'C4'))
  check(() => assert.equal(practice.state().recitalState?.currentNote, 'C4'))
  check(() => assert.equal(practice.state().recitalState?.claimId !== null, true))

  // Canonical boss identity validation reports note-shape reasons only for
  // literals in the admitted set; exercise those reasons with a matching
  // admission snapshot rather than conflating them with invalid input.
  const reasonStorage = new MemoryStorage()
  const reasonPractice = makePractice(
    phraseWith([occurrence(0, 'C4', 0, 4, 0)]),
    reasonStorage,
    'identity-reasons-attempt',
    ['C4', 'C5', 'E4'],
  )
  const reasonIdentity = identityFor(reasonPractice)
  const wrongOctave = reasonPractice.resolve(resolutionFor(reasonPractice, true, {
    identity: reasonIdentity,
    note: 'C5',
  }))
  check(() => assert.equal(wrongOctave.kind, 'ignored'))
  if (wrongOctave.kind !== 'ignored') throw new Error('wrong octave did not narrow')
  check(() => assert.equal(wrongOctave.reason, 'wrong-octave'))
  const wrongNote = reasonPractice.resolve(resolutionFor(reasonPractice, true, {
    identity: reasonIdentity,
    note: 'E4',
  }))
  check(() => assert.equal(wrongNote.kind, 'ignored'))
  if (wrongNote.kind !== 'ignored') throw new Error('wrong note did not narrow')
  check(() => assert.equal(wrongNote.reason, 'wrong-note'))
  check(() => assert.equal(reasonStorage.saveCalls, 0))

  const firstIdentity = identityFor(practice)
  check(() => assert.equal(storage.saveCalls, 0))
  check(() => assert.equal(practice.state().cursor, 0))

  const hinted = practice.hint(firstIdentity)
  check(() => assert.equal(hinted.kind, 'ignored'))
  if (hinted.kind !== 'ignored') throw new Error('hint did not narrow')
  check(() => assert.equal(hinted.reason, 'hint'))
  check(() => assert.equal(practice.state().recitalState?.hinted, true))
  check(() => assert.equal(storage.loadCalls, 0))
  check(() => assert.equal(storage.saveCalls, 0))

  const supported = practice.resolve(resolutionFor(practice, true, { identity: firstIdentity }))
  check(() => assert.equal(supported.kind, 'supported-practice'))
  if (supported.kind !== 'supported-practice') throw new Error('supported result did not narrow')
  check(() => assert.equal(supported.grade, null))
  check(() => assert.equal(supported.practiceOutcome.assisted, true))
  check(() => assert.equal(supported.practiceOutcome.unaided, false))
  check(() => assert.equal(supported.practiceOutcome.sourceKey, sourcePhrase.sourceKey))
  check(() => assert.equal(supported.practiceOutcome.sourceSha256, sourcePhrase.sourceSha256))
  check(() => assert.equal(supported.practiceOutcome.normalizationVersion, SONGCRAFT_PHRASE_NORMALIZATION_VERSION))
  check(() => assert.equal(supported.practiceOutcome.ordinal, 0))
  check(() => assert.equal(supported.practiceOutcome.lane, 'voice'))
  check(() => assert.equal(supported.state.cursor, 1))
  check(() => assert.equal(supported.state.current.kind, 'rest'))
  check(() => assert.equal(supported.state.recitalState, null))
  check(() => assert.equal(storage.loadCalls, 0))
  check(() => assert.equal(storage.saveCalls, 0))
  check(() => assert.equal(storage.readbackCalls, 0))

  const staleSupported = practice.resolve({
    ...firstIdentity,
    note: 'C4',
    correct: true,
    latencyMs: 800,
  })
  check(() => assert.equal(staleSupported.kind, 'ignored'))
  if (staleSupported.kind !== 'ignored') throw new Error('stale supported callback did not narrow')
  check(() => assert.equal(staleSupported.reason, 'stale'))
  check(() => assert.equal(practice.state().cursor, 1))

  const restIdentity = identityFor(practice)
  const outOfOrderAck = practice.acknowledge({ ...restIdentity, ordinal: 4 })
  check(() => assert.equal(outOfOrderAck.kind, 'ignored'))
  if (outOfOrderAck.kind !== 'ignored') throw new Error('out-of-order ack did not narrow')
  check(() => assert.equal(outOfOrderAck.reason, 'stale'))
  check(() => assert.equal(storage.saveCalls, 0))
  const acknowledgedRest = practice.acknowledge(restIdentity)
  check(() => assert.equal(acknowledgedRest.kind, 'acknowledged'))
  if (acknowledgedRest.kind !== 'acknowledged') throw new Error('rest ack did not narrow')
  check(() => assert.equal(acknowledgedRest.outcome.kind, 'rest'))
  check(() => assert.equal(acknowledgedRest.outcome.assisted, false))
  check(() => assert.equal(acknowledgedRest.outcome.unaided, false))
  check(() => assert.equal(acknowledgedRest.state.cursor, 2))
  check(() => assert.equal(acknowledgedRest.state.current.kind, 'unsupported'))
  check(() => assert.equal(acknowledgedRest.state.current.occurrence.pitchName, 'C5'))
  check(() => assert.equal(acknowledgedRest.state.recitalState, null))
  check(() => assert.equal(storage.saveCalls, 0))

  const unsupportedIdentity = identityFor(practice)
  const prematureResolve = practice.resolve({
    ...unsupportedIdentity,
    note: 'C5',
    correct: true,
    latencyMs: 800,
  })
  check(() => assert.equal(prematureResolve.kind, 'ignored'))
  if (prematureResolve.kind !== 'ignored') throw new Error('unsupported resolve did not narrow')
  check(() => assert.equal(prematureResolve.reason, 'invalid'))
  check(() => assert.equal(practice.state().cursor, 2))
  check(() => assert.equal(storage.saveCalls, 0))

  const acknowledgedUnsupported = practice.acknowledge(unsupportedIdentity)
  check(() => assert.equal(acknowledgedUnsupported.kind, 'acknowledged'))
  if (acknowledgedUnsupported.kind !== 'acknowledged') throw new Error('unsupported ack did not narrow')
  check(() => assert.equal(acknowledgedUnsupported.outcome.kind, 'unsupported'))
  check(() => assert.equal(acknowledgedUnsupported.outcome.ordinal, 2))
  check(() => assert.equal(acknowledgedUnsupported.state.cursor, 3))
  check(() => assert.equal(acknowledgedUnsupported.state.current.kind, 'note'))
  check(() => assert.equal(acknowledgedUnsupported.state.current.occurrence.pitchName, 'C4'))
  check(() => assert.equal(acknowledgedUnsupported.state.recitalState?.currentNote, 'C4'))
  check(() => assert.equal(storage.saveCalls, 0))

  const repeatedNoteIdentity = identityFor(practice)
  const repeatedNoteSuccess = practice.resolve(resolutionFor(practice, true, {
    identity: repeatedNoteIdentity,
  }))
  check(() => assert.equal(repeatedNoteSuccess.kind, 'persisted'))
  if (repeatedNoteSuccess.kind !== 'persisted') throw new Error('persisted result did not narrow')
  check(() => assert.equal(repeatedNoteSuccess.outcome, 'success'))
  check(() => assert.equal(repeatedNoteSuccess.supportive, false))
  check(() => assert.equal(repeatedNoteSuccess.practiceOutcome?.ordinal, 3))
  check(() => assert.equal(repeatedNoteSuccess.practiceOutcome?.unaided, true))
  check(() => assert.equal(repeatedNoteSuccess.state.cursor, 4))
  check(() => assert.equal(repeatedNoteSuccess.state.current.occurrence.pitchName, 'D4'))
  check(() => assert.equal(storage.loadCalls, 1))
  check(() => assert.equal(storage.saveCalls, 1))
  check(() => assert.equal(storage.readbackCalls, 1))

  const finalIdentity = identityFor(practice)
  const deliberateFailure = practice.resolve(resolutionFor(practice, false, { identity: finalIdentity }))
  check(() => assert.equal(deliberateFailure.kind, 'persisted'))
  if (deliberateFailure.kind !== 'persisted') throw new Error('failure result did not narrow')
  check(() => assert.equal(deliberateFailure.outcome, 'failed'))
  check(() => assert.equal(deliberateFailure.practiceOutcome, null))
  check(() => assert.equal(deliberateFailure.state.cursor, 4))
  check(() => assert.equal(deliberateFailure.state.current.kind, 'note'))
  check(() => assert.equal(deliberateFailure.state.recitalState?.claimId, null))
  check(() => assert.equal(storage.saveCalls, 2))
  const duplicateFailure = practice.resolve(resolutionFor(practice, false, { identity: finalIdentity }))
  check(() => assert.equal(duplicateFailure.kind, 'ignored'))
  if (duplicateFailure.kind !== 'ignored') throw new Error('duplicate failure did not narrow')
  check(() => assert.equal(duplicateFailure.reason, 'stale'))
  check(() => assert.equal(storage.saveCalls, 2))

  const retry = practice.retryNote()
  check(() => assert.equal(retry.kind, 'retry-note'))
  check(() => assert.equal(retry.state.cursor, 4))
  if (retry.kind !== 'retry-note') throw new Error('retry result did not narrow')
  check(() => assert.notEqual(retry.state.current.identity.claimId, finalIdentity.claimId))
  const finalSuccess = practice.resolve(resolutionFor(practice, true))
  check(() => assert.equal(finalSuccess.kind, 'persisted'))
  if (finalSuccess.kind !== 'persisted') throw new Error('final result did not narrow')
  check(() => assert.equal(finalSuccess.state.status, 'complete'))
  check(() => assert.equal(finalSuccess.state.current.kind, 'complete'))
  check(() => assert.equal(finalSuccess.state.summary.traversalComplete, true))
  check(() => assert.equal(finalSuccess.state.summary.masteryEligible, false))
  check(() => assert.equal(finalSuccess.state.summary.unaidedComplete, false))
  check(() => assert.equal(finalSuccess.state.summary.assisted, true))
  check(() => assert.equal(finalSuccess.state.summary.traversedCount, 5))
  check(() => assert.equal(finalSuccess.state.summary.eligibleNoteCount, 3))
  check(() => assert.equal(finalSuccess.state.summary.unaidedNoteCount, 2))
  check(() => assert.equal(storage.saveCalls, 3))

  // Boss completion is narrower than authored traversal when non-note
  // occurrences trail the final eligible note.
  const trailingRestStorage = new MemoryStorage()
  const trailingRestPractice = makePractice(
    phraseWith([occurrence(0, 'C4', 0, 4, 0), rest(1, 1)]),
    trailingRestStorage,
    'trailing-rest-attempt',
    ['C4'],
  )
  const trailingRestResult = trailingRestPractice.resolve(resolutionFor(trailingRestPractice, true))
  check(() => assert.equal(trailingRestResult.kind, 'persisted'))
  if (trailingRestResult.kind !== 'persisted') throw new Error('trailing-rest result did not narrow')
  check(() => assert.equal(trailingRestResult.completed, false))
  check(() => assert.equal(trailingRestResult.state.current.kind, 'rest'))
  const trailingRestAck = trailingRestPractice.acknowledge(identityFor(trailingRestPractice))
  check(() => assert.equal(trailingRestAck.kind, 'acknowledged'))
  check(() => assert.equal(trailingRestAck.state.status, 'complete'))

  const trailingUnsupportedStorage = new MemoryStorage()
  const trailingUnsupportedPractice = makePractice(
    phraseWith([occurrence(0, 'C4', 0, 4, 0), occurrence(1, 'C6', 24, 6, 1)]),
    trailingUnsupportedStorage,
    'trailing-unsupported-attempt',
    ['C4'],
  )
  const trailingUnsupportedResult = trailingUnsupportedPractice.resolve(
    resolutionFor(trailingUnsupportedPractice, true),
  )
  check(() => assert.equal(trailingUnsupportedResult.kind, 'persisted'))
  if (trailingUnsupportedResult.kind !== 'persisted') throw new Error('trailing-unsupported result did not narrow')
  check(() => assert.equal(trailingUnsupportedResult.completed, false))
  check(() => assert.equal(trailingUnsupportedResult.state.current.kind, 'unsupported'))
  const trailingUnsupportedAck = trailingUnsupportedPractice.acknowledge(
    identityFor(trailingUnsupportedPractice),
  )
  check(() => assert.equal(trailingUnsupportedAck.kind, 'acknowledged'))
  check(() => assert.equal(trailingUnsupportedAck.state.status, 'complete'))

  // A failed save holds the consumed note claim. RetryNote cannot create a
  // second grade; RetrySave persists the original after-image exactly once.
  const saveFailureStorage = new MemoryStorage()
  saveFailureStorage.saveResults = [false, true]
  const saveFailurePractice = makePractice(
    phraseWith([occurrence(0, 'C4', 0, 4, 0)]),
    saveFailureStorage,
    'save-failure-attempt',
    ['C4'],
  )
  const failedSave = saveFailurePractice.resolve(resolutionFor(saveFailurePractice, true))
  check(() => assert.equal(failedSave.kind, 'save-failed'))
  if (failedSave.kind !== 'save-failed') throw new Error('save-failed result did not narrow')
  check(() => assert.equal(failedSave.state.status, 'pending-save'))
  check(() => assert.equal(failedSave.state.cursor, 0))
  check(() => assert.equal(failedSave.state.recitalState?.pendingReceipt !== null, true))
  check(() => assert.equal(saveFailureStorage.saveCalls, 1))
  const retryWhilePending = saveFailurePractice.retryNote()
  check(() => assert.equal(retryWhilePending.kind, 'ignored'))
  if (retryWhilePending.kind !== 'ignored') throw new Error('pending RetryNote did not narrow')
  check(() => assert.equal(retryWhilePending.reason, 'pending-save'))
  check(() => assert.equal(saveFailureStorage.saveCalls, 1))
  const saveRetried = saveFailurePractice.retrySave()
  check(() => assert.equal(saveRetried.kind, 'persisted'))
  if (saveRetried.kind !== 'persisted') throw new Error('retry-save result did not narrow')
  check(() => assert.equal(saveRetried.outcome, 'success'))
  check(() => assert.equal(saveRetried.practiceOutcome?.unaided, true))
  check(() => assert.equal(saveRetried.state.status, 'complete'))
  check(() => assert.equal(saveFailureStorage.saveCalls, 2))
  check(() => assert.equal(saveFailureStorage.loadCalls, 2))
  check(() => assert.equal(saveFailureStorage.readbackCalls, 1))

  // Cancellation fences the existing boss child and all later callbacks.
  const cancelStorage = new MemoryStorage()
  const cancelPractice = makePractice(
    phraseWith([occurrence(0, 'C4', 0, 4, 0)]),
    cancelStorage,
    'cancel-attempt',
    ['C4'],
  )
  const cancelIdentity = identityFor(cancelPractice)
  const cancelled = cancelPractice.cancel()
  check(() => assert.equal(cancelled.kind, 'ignored'))
  if (cancelled.kind !== 'ignored') throw new Error('cancel result did not narrow')
  check(() => assert.equal(cancelled.reason, 'cancelled'))
  check(() => assert.equal(cancelPractice.state().current.kind, 'cancelled'))
  const afterCancel = cancelPractice.resolve({
    ...cancelIdentity,
    note: 'C4',
    correct: true,
    latencyMs: 800,
  })
  check(() => assert.equal(afterCancel.kind, 'ignored'))
  if (afterCancel.kind !== 'ignored') throw new Error('cancelled callback did not narrow')
  check(() => assert.equal(afterCancel.reason, 'cancelled'))
  check(() => assert.equal(cancelStorage.saveCalls, 0))
  check(() => assert.equal(cancelPractice.retrySave().kind, 'ignored'))
  check(() => assert.equal(cancelPractice.retryNote().kind, 'ignored'))

  // All-rest and all-unsupported phrases are traversable but cannot claim
  // musical mastery and never construct a grading child.
  const restStorage = new MemoryStorage()
  const restPractice = makePractice(
    phraseWith([rest(0, 0), rest(1, 1)]),
    restStorage,
    'rest-only-attempt',
    ['C4'],
  )
  check(() => assert.equal(restPractice.state().recitalState, null))
  check(() => assert.equal(restPractice.state().summary.masteryEligible, false))
  const restAck1 = restPractice.acknowledge(identityFor(restPractice))
  check(() => assert.equal(restAck1.kind, 'acknowledged'))
  const restAck2 = restPractice.acknowledge(identityFor(restPractice))
  check(() => assert.equal(restAck2.kind, 'acknowledged'))
  if (restAck2.kind !== 'acknowledged') throw new Error('rest completion did not narrow')
  check(() => assert.equal(restAck2.state.status, 'complete'))
  check(() => assert.equal(restAck2.state.summary.traversalComplete, true))
  check(() => assert.equal(restAck2.state.summary.unaidedComplete, false))
  check(() => assert.equal(restStorage.saveCalls, 0))

  const unsupportedStorage = new MemoryStorage()
  const unsupportedPractice = makePractice(
    phraseWith([occurrence(0, 'C6', 24, 6, 0)]),
    unsupportedStorage,
    'unsupported-only-attempt',
    ['C4'],
  )
  check(() => assert.equal(unsupportedPractice.state().current.kind, 'unsupported'))
  check(() => assert.equal(unsupportedPractice.state().current.occurrence.pitchName, 'C6'))
  const unsupportedDone = unsupportedPractice.acknowledge(identityFor(unsupportedPractice))
  check(() => assert.equal(unsupportedDone.kind, 'acknowledged'))
  if (unsupportedDone.kind !== 'acknowledged') throw new Error('unsupported completion did not narrow')
  check(() => assert.equal(unsupportedDone.state.status, 'complete'))
  check(() => assert.equal(unsupportedDone.state.summary.masteryEligible, false))
  check(() => assert.equal(unsupportedStorage.saveCalls, 0))

  // A later attempt may review the same source occurrence; no lifetime
  // source-hash/ordinal dedupe is introduced by this controller.
  const freshStorage = new MemoryStorage()
  const fresh = makePractice(sourcePhrase, freshStorage, 'practice-attempt-2', ['C4', 'D4'])
  const freshResult = fresh.resolve(resolutionFor(fresh, true))
  check(() => assert.equal(freshResult.kind, 'persisted'))
  check(() => assert.equal(freshResult.state.cursor, 1))
  check(() => assert.equal(freshStorage.saveCalls, 1))
  check(() => assert.equal(freshResult.state.outcomes[0]?.attemptId, 'practice-attempt-2'))

  // Caller mutation after construction cannot rewrite the phrase or admission
  // snapshot held by a live attempt.
  const mutablePhrase = mixedPhrase()
  const mutableAdmitted = ['C4', 'D4']
  const immutableStorage = new MemoryStorage()
  const immutableInput = {
    phrase: mutablePhrase,
    attemptId: 'immutable-attempt',
    lane: 'voice' as const,
    admittedNotes: mutableAdmitted,
    storage: immutableStorage,
  }
  const immutablePractice = createPitchforksSongcraftPractice(immutableInput)
  ;(mutablePhrase.occurrences as SongcraftPhraseOccurrence[])[0].pitchName = 'D4'
  mutableAdmitted[0] = 'E4'
  check(() => assert.equal(immutablePractice.state().phrase.occurrences[0]?.pitchName, 'C4'))
  check(() => assert.deepEqual(immutablePractice.state().admittedNotes, ['C4', 'D4']))
  check(() => assert.equal(Object.isFrozen(immutablePractice.state().phrase), true))
  check(() => assert.equal(Object.isFrozen(immutablePractice.state().outcomes), true))

  const mutableAttemptInput = {
    phrase: phraseWith([occurrence(0, 'C4', 0, 4, 0)]),
    attemptId: 'captured-attempt',
    lane: 'voice' as const,
    admittedNotes: ['C4'],
    storage: new MemoryStorage(),
  }
  const capturedAttempt = createPitchforksSongcraftPractice(mutableAttemptInput)
  mutableAttemptInput.attemptId = 'caller-mutated-attempt'
  check(() => assert.equal(capturedAttempt.state().attemptId, 'captured-attempt'))
  check(() => assert.equal(capturedAttempt.state().recitalState?.attempt, 'captured-attempt'))

  const source = readFileSync(
    new URL('../src/components/PitchDefender/pitchforksSongcraftPractice.ts', import.meta.url),
    'utf8',
  )
  check(() => assert.match(source, /createPitchforksBossRecital/))
  check(() => assert.doesNotMatch(source, /from ['"].*fsrs/))
  check(() => assert.doesNotMatch(source, /localStorage|setItem|removeItem|clear\(/))
  check(() => assert.doesNotMatch(source, /tempo|countdown|scheduler|transpos/i))

  console.log(`pitchforks songcraft practice: ${checks}/${checks} PASS`)
}

void main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
