import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  acknowledgePitchforksSongcraftRenderedState,
  advancePitchforksSongcraftVoiceSample,
  cleanupPitchforksSongcraftAsyncWork,
  getPitchforksSongcraftComposerStorage,
  isPitchforksSongcraftAdmittedNote,
  loadPitchforksSongcraftPhrases,
  loadPitchforksSongcraftLibrary,
  isPitchforksSongcraftPresetReady,
  observePitchforksSongcraftGeneration,
  pitchforksSongcraftTargetFrequency,
  resetPitchforksSongcraftVisibilityState,
  SONGCRAFT_AUDIO_BUSY_MS,
  SONGCRAFT_CONFIDENCE_FLOOR,
  SONGCRAFT_HOLD_MS,
  SONGCRAFT_MATCH_TOLERANCE_CENTS,
  SONGCRAFT_STALE_AFTER_MS,
} from '../src/components/PitchDefender/PitchforksSongcraft'
import {
  SONGCRAFT_PHRASE_NORMALIZATION_VERSION,
  type SongcraftPhrase,
} from '../src/components/PitchDefender/pitchforksSongcraftPhrase'
import { createPitchforksSongcraftPractice } from '../src/components/PitchDefender/pitchforksSongcraftPractice'
import { type NoteMemory } from '../src/lib/fsrs'

let checks = 0
const check = (run: () => void) => {
  run()
  checks += 1
}

const note = (pitchName: string, midi: number) => ({
  isRest: false,
  pitchName,
  midi,
})

const rest = {
  isRest: true,
  pitchName: null,
  midi: null,
}

const healthyC4 = {
  note: 'C4',
  frequency: 261.6255653005986,
  cents: 0,
  confidence: 0.95,
  isActive: true,
}

const restAndUnsupportedPhrase: SongcraftPhrase = {
  sourceKey: 'pd_composed_ack_boundary',
  title: 'Acknowledgement boundary',
  sourceSha256: 'a'.repeat(64),
  provenance: {
    source: 'composer',
    normalizationVersion: SONGCRAFT_PHRASE_NORMALIZATION_VERSION,
  },
  occurrences: [
    {
      ordinal: 0,
      isRest: true,
      beats: 1,
      semi: null,
      pitchName: null,
      octave: null,
      midi: null,
      measureIdx: 1,
      beatOffset: 0,
    },
    {
      ordinal: 1,
      isRest: false,
      beats: 1,
      semi: 24,
      pitchName: 'C6',
      octave: 6,
      midi: 84,
      measureIdx: 1,
      beatOffset: 1,
    },
  ],
}

const singleC4Phrase: SongcraftPhrase = {
  sourceKey: 'pd_composed_voice_boundary',
  title: 'Voice matching boundary',
  sourceSha256: 'b'.repeat(64),
  provenance: {
    source: 'composer',
    normalizationVersion: SONGCRAFT_PHRASE_NORMALIZATION_VERSION,
  },
  occurrences: [{
    ordinal: 0,
    isRest: false,
    beats: 1,
    semi: 0,
    pitchName: 'C4',
    octave: 4,
    midi: 60,
    measureIdx: 1,
    beatOffset: 0,
  }],
}

async function main(): Promise<void> {
  check(() => assert.equal(SONGCRAFT_CONFIDENCE_FLOOR, 0.75))
  check(() => assert.equal(SONGCRAFT_MATCH_TOLERANCE_CENTS, 70))
  check(() => assert.equal(SONGCRAFT_HOLD_MS, 300))
  check(() => assert.equal(SONGCRAFT_AUDIO_BUSY_MS, 1800))
  check(() => assert.equal(SONGCRAFT_STALE_AFTER_MS, 1000))

  // The connector accepts only the parent's literal admitted range. The
  // helper also checks authored MIDI, so malformed input cannot turn into the
  // shared pitchMath 440 Hz fallback.
  check(() => assert.equal(isPitchforksSongcraftAdmittedNote('C4', ['C4']), true))
  check(() => assert.equal(isPitchforksSongcraftAdmittedNote('C6', ['C6']), false))
  check(() => assert.equal(isPitchforksSongcraftAdmittedNote('C4', ['D4']), false))
  check(() => assert.ok(Math.abs(pitchforksSongcraftTargetFrequency(note('C4', 60), ['C4'])! - 261.625565) < 0.001))
  check(() => assert.equal(pitchforksSongcraftTargetFrequency(note('C4', 61), ['C4']), null))
  check(() => assert.equal(pitchforksSongcraftTargetFrequency(note('C6', 84), ['C6']), null))
  check(() => assert.equal(pitchforksSongcraftTargetFrequency(rest, ['C4']), null))
  check(() => assert.equal(pitchforksSongcraftTargetFrequency(note('H4', 69), ['H4']), null))

  // Matching input is meaningful only when the parent detector has published
  // a newer generation. RAFs over one unchanged generation never accumulate
  // enough hold time to resolve a voice claim.
  let unchangedGeneration = {
    lastGeneration: 40,
    generationObserved: true,
    generationObservedAt: 0,
  }
  let unchangedHold = { heldMs: 0, matched: false }
  const constantController = createPitchforksSongcraftPractice({
    phrase: singleC4Phrase,
    attemptId: 'constant-generation-attempt',
    lane: 'voice',
    admittedNotes: ['C4'],
    storage: {
      loadStore: () => ({}),
      saveStore: () => false,
      readback: () => null,
    },
  })
  let constantResolveCalls = 0
  for (let now = 16; now <= 1_200; now += 16) {
    const observation = observePitchforksSongcraftGeneration(unchangedGeneration, 40, now)
    unchangedGeneration = observation.state
    unchangedHold = advancePitchforksSongcraftVoiceSample(
      unchangedHold,
      observation,
      healthyC4,
      healthyC4.frequency,
      true,
    ).hold
    if (unchangedHold.matched) {
      const live = constantController.state()
      if (live.current.kind === 'note' && live.current.identity.claimId !== null) {
        constantResolveCalls += 1
        constantController.resolve({ ...live.current.identity, note: 'C4', correct: true })
      }
    }
  }
  check(() => assert.equal(unchangedHold.matched, false))
  check(() => assert.equal(unchangedHold.heldMs, 0))
  check(() => assert.equal(constantResolveCalls, 0))

  // Advancing detector generations provide bounded fresh elapsed time and
  // resolve one genuine 300ms hold exactly once.
  let advancingGeneration = {
    lastGeneration: 0,
    generationObserved: false,
    generationObservedAt: 0,
  }
  let advancingHold = { heldMs: 0, matched: false }
  let matchedTransitions = 0
  for (let generation = 1; generation <= 5; generation += 1) {
    const observation = observePitchforksSongcraftGeneration(advancingGeneration, generation, generation * 100)
    advancingGeneration = observation.state
    const next = advancePitchforksSongcraftVoiceSample(
      advancingHold,
      observation,
      healthyC4,
      healthyC4.frequency,
      true,
    ).hold
    if (!advancingHold.matched && next.matched) matchedTransitions += 1
    advancingHold = next
  }
  check(() => assert.equal(advancingHold.matched, true))
  check(() => assert.equal(advancingHold.heldMs, SONGCRAFT_HOLD_MS))
  check(() => assert.equal(matchedTransitions, 1))

  // Feed that genuine hold through the real practice controller as the
  // connector does: one eligible claim, one deliberate resolve, then a
  // completed traversal that cannot be resolved again.
  let durableVoiceStore: Record<string, NoteMemory> = {}
  const voiceStorage = {
    loadStore: () => ({ ...durableVoiceStore }),
    saveStore: (_lane: 'voice' | 'ear', store: Record<string, NoteMemory>) => {
      durableVoiceStore = { ...store }
      return true
    },
    readback: (_lane: 'voice' | 'ear', noteName: string) => durableVoiceStore[noteName] ?? null,
  }
  const voiceController = createPitchforksSongcraftPractice({
    phrase: singleC4Phrase,
    attemptId: 'voice-boundary-attempt',
    lane: 'voice',
    admittedNotes: ['C4'],
    storage: voiceStorage,
  })
  let voiceResolveCalls = 0
  let controllerGeneration = {
    lastGeneration: 0,
    generationObserved: false,
    generationObservedAt: 0,
  }
  let controllerHold = { heldMs: 0, matched: false }
  for (let generation = 1; generation <= 5; generation += 1) {
    const observation = observePitchforksSongcraftGeneration(controllerGeneration, generation, generation * 100)
    controllerGeneration = observation.state
    controllerHold = advancePitchforksSongcraftVoiceSample(
      controllerHold,
      observation,
      healthyC4,
      healthyC4.frequency,
      true,
    ).hold
    if (controllerHold.matched) {
      const live = voiceController.state()
      if (live.current.kind === 'note' && live.current.identity.claimId !== null) {
        voiceResolveCalls += 1
        voiceController.resolve({
          ...live.current.identity,
          note: 'C4',
          correct: true,
        })
      }
    }
  }
  check(() => assert.equal(voiceResolveCalls, 1))
  check(() => assert.equal(voiceController.state().summary.traversalComplete, true))

  // A stale detector gap fences recovery; the first post-gap matching sample
  // cannot instantly lock the note or inherit the stale pre-gap hold.
  let recoveringGeneration = {
    lastGeneration: 0,
    generationObserved: false,
    generationObservedAt: 0,
  }
  let recoveringHold = { heldMs: 0, matched: false }
  for (const [generation, now] of [[1, 0], [2, 100], [3, 200]] as const) {
    const observation = observePitchforksSongcraftGeneration(recoveringGeneration, generation, now)
    recoveringGeneration = observation.state
    recoveringHold = advancePitchforksSongcraftVoiceSample(
      recoveringHold,
      observation,
      healthyC4,
      healthyC4.frequency,
      true,
    ).hold
  }
  const staleObservation = observePitchforksSongcraftGeneration(recoveringGeneration, 4, 1_401)
  recoveringGeneration = staleObservation.state
  recoveringHold = advancePitchforksSongcraftVoiceSample(
    recoveringHold,
    staleObservation,
    healthyC4,
    healthyC4.frequency,
    true,
  ).hold
  check(() => assert.equal(staleObservation.staleRecovery, true))
  check(() => assert.equal(recoveringHold.matched, false))
  check(() => assert.equal(recoveringHold.heldMs, 0))

  // Visibility reset is an event boundary, so it must work even when no RAF
  // runs while hidden. The first resumed generation is fenced at zero; only
  // the following genuinely fresh sample contributes elapsed hold time.
  const hiddenReset = resetPitchforksSongcraftVisibilityState(55)
  const resumedObservation = observePitchforksSongcraftGeneration(hiddenReset.generation, 56, 1_000)
  const resumedHold = advancePitchforksSongcraftVoiceSample(
    { heldMs: 250, matched: false },
    resumedObservation,
    healthyC4,
    healthyC4.frequency,
    true,
  ).hold
  const nextFreshObservation = observePitchforksSongcraftGeneration(resumedObservation.state, 57, 1_100)
  const nextFreshHold = advancePitchforksSongcraftVoiceSample(
    resumedHold,
    nextFreshObservation,
    healthyC4,
    healthyC4.frequency,
    true,
  ).hold
  check(() => assert.equal(hiddenReset.holdProgress, 0))
  check(() => assert.equal(hiddenReset.dropoutFrames, 0))
  check(() => assert.equal(hiddenReset.generation.lastGeneration, 55))
  check(() => assert.equal(hiddenReset.generation.generationObserved, false))
  check(() => assert.equal(resumedObservation.staleRecovery, true))
  check(() => assert.equal(resumedHold.matched, false))
  check(() => assert.equal(resumedHold.heldMs, 0))
  check(() => assert.equal(nextFreshHold.heldMs, 100))

  // The acknowledgement callback closes over its rendered identity. Calling
  // that same callback twice advances the adjacent rest/unsupported sequence
  // only once; the second call is stale and cannot consume the next item.
  const ackStorage = {
    loadStore: () => ({}),
    saveStore: () => true,
    readback: () => null,
  }
  const ackController = createPitchforksSongcraftPractice({
    phrase: restAndUnsupportedPhrase,
    attemptId: 'ack-boundary-attempt',
    lane: 'voice',
    admittedNotes: ['C4'],
    storage: ackStorage,
  })
  const renderedRest = ackController.state()
  let acknowledgementResults = 0
  const acknowledge = () => {
    const result = acknowledgePitchforksSongcraftRenderedState(ackController, renderedRest)
    if (result?.kind === 'acknowledged') acknowledgementResults += 1
  }
  acknowledge()
  acknowledge()
  check(() => assert.equal(acknowledgementResults, 1))
  check(() => assert.equal(ackController.state().cursor, 1))
  check(() => assert.equal(ackController.state().current.kind, 'unsupported'))

  // Composer discovery is a guarded read of the real browser storage. Node
  // and a throwing storage surface both fail closed without inventing a song.
  check(() => assert.equal(getPitchforksSongcraftComposerStorage(), null))
  const raw = JSON.stringify({
    title: 'Boundary Song',
    notes: [{ beats: 1, semitones: 0, pitchName: 'C4' }],
  })
  const fakeStorage = {
    length: 2,
    key(index: number): string | null {
      return index === 0 ? 'pd_composed_boundary' : 'other'
    },
    getItem(key: string): string | null {
      return key === 'pd_composed_boundary' ? raw : null
    },
  }
  const loaded = await loadPitchforksSongcraftPhrases(fakeStorage)
  check(() => assert.equal(loaded.length, 1))
  check(() => assert.equal(loaded[0]?.title, 'Boundary Song'))
  check(() => assert.equal(loaded[0]?.provenance.normalizationVersion, SONGCRAFT_PHRASE_NORMALIZATION_VERSION))
  const throwingStorage = {
    get length(): number { throw new Error('storage denied') },
    key(): string | null { return null },
    getItem(): string | null { return null },
  }
  const unavailable = await loadPitchforksSongcraftPhrases(throwingStorage)
  check(() => assert.deepEqual(unavailable, []))
  const library = await loadPitchforksSongcraftLibrary(['C4', 'D4'], fakeStorage)
  check(() => assert.equal(library[0]?.sourceKey, 'pd_composed_boundary'))
  const builtin = library.filter(value => value.provenance.source === 'builtin')
  check(() => assert.equal(builtin.length, 3))
  check(() => assert.ok(builtin[0].occurrences.some(value => value.isRest)))
  check(() => assert.deepEqual([...new Set(builtin[0].occurrences.filter(value => !value.isRest).map(value => value.pitchName))].sort(), ['C4', 'D4']))
  check(() => assert.equal(isPitchforksSongcraftPresetReady(builtin[0], ['C3', 'D3']), false))
  check(() => assert.equal(isPitchforksSongcraftPresetReady(builtin[0], ['C4']), false))
  check(() => assert.ok(Object.isFrozen(library)))
  const builtinsWithoutStorage = await loadPitchforksSongcraftLibrary(['C4', 'D4'], throwingStorage)
  check(() => assert.equal(builtinsWithoutStorage.length, 3))
  check(() => assert.equal(builtinsWithoutStorage[0]?.provenance.source, 'builtin'))
  const noConfirmedPair = await loadPitchforksSongcraftLibrary(['C4', 'A4'], null)
  check(() => assert.deepEqual(noConfirmedPair, []))

  // Cleanup is injected and deterministic: the RAF, both timer classes, and
  // parent microphone are all fenced even if one browser cancellation throws.
  const cleanupCalls: string[] = []
  cleanupPitchforksSongcraftAsyncWork(
    { rafId: 7, cueTimer: 11 as unknown as ReturnType<typeof setTimeout>, answerArmTimer: 13 as unknown as ReturnType<typeof setTimeout> },
    {
      cancelAnimationFrame: id => {
        cleanupCalls.push(`raf:${id}`)
        throw new Error('already cancelled')
      },
      clearTimeout: id => cleanupCalls.push(`timer:${String(id)}`),
      stopMicrophone: () => cleanupCalls.push('stop'),
    },
  )
  check(() => assert.deepEqual(cleanupCalls, ['raf:7', 'timer:11', 'timer:13', 'stop']))

  const source = readFileSync(
    new URL('../src/components/PitchDefender/PitchforksSongcraft.tsx', import.meta.url),
    'utf8',
  )
  check(() => assert.match(source, /window\.localStorage/))
  check(() => assert.match(source, /loadSongcraftPhrases/))
  check(() => assert.match(source, /crypto\?\.randomUUID|crypto\.randomUUID/))
  check(() => assert.match(source, /createPitchforksSongcraftPractice/))
  check(() => assert.match(source, /exactPitchSampleState/))
  check(() => assert.match(source, /advanceExactPitchHold/))
  check(() => assert.match(source, /pitchforksMicUnreliable/))
  check(() => assert.match(source, /cancelAnimationFrame/))
  check(() => assert.match(source, /clearTimeout/))
  check(() => assert.match(source, /stopMicrophone|microphoneRef\.current\.stop/))
  check(() => assert.match(source, /matchingSuppressed/))
  check(() => assert.match(source, /referenceReady/))
  check(() => assert.match(source, /view,/))
  check(() => assert.match(source, /current\.kind === 'note' && state\.lane === 'voice'[\s\S]*?: null/))
  check(() => assert.match(source, /else if \(state\.lane === 'ear'\)[\s\S]*?Press Hear Note to hear the challenge/))
  check(() => assert.match(source, /earHeardClaimRef\.current = claimId/))
  check(() => assert.match(source, /result\.state\.summary\.traversalComplete/))
  check(() => assert.match(source, /observePitchforksSongcraftGeneration/))
  check(() => assert.match(source, /generationObservation\.generationAdvanced/))
  check(() => assert.match(source, /visibilitychange/))
  check(() => assert.match(source, /removeEventListener\('visibilitychange'/))
  check(() => assert.doesNotMatch(source, /lastFrameAtRef/))
  check(() => assert.doesNotMatch(source, /latencyMs: Math\.max\(0, now/))
  check(() => assert.doesNotMatch(source, /result\.completed/))
  check(() => assert.doesNotMatch(source, /usePitchDetection\s*\(/))
  check(() => assert.doesNotMatch(source, /autoGrade|gradeVoice|gradeEar/))
  check(() => assert.doesNotMatch(source, /navigator\.mediaDevices|AudioContext|setItem\s*\(/))
  check(() => assert.doesNotMatch(source, /simulat(?:e|ed|ion)|synthetic/i))

  console.log(`pitchforks songcraft connector: ${checks}/${checks} PASS`)
}

void main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
