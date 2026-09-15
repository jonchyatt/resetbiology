'use client'

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type RefObject,
} from 'react'

import {
  PitchforksSongcraftPanel,
  type PitchforksSongcraftLane,
  type PitchforksSongcraftPanelProps,
  type PitchforksSongcraftSong,
  type SongcraftPanelView,
} from './PitchforksSongcraftPanel'
import {
  loadSongcraftPhrases,
  type SongcraftPhrase,
  type SongcraftPhraseOccurrence,
  type SongcraftPhraseStorage,
} from './pitchforksSongcraftPhrase'
import {
  createPitchforksSongcraftPractice,
  type SongcraftPracticeController,
  type SongcraftPracticeResult,
  type SongcraftPracticeState,
} from './pitchforksSongcraftPractice'
import {
  type PitchforksBossRecitalStorage,
} from './pitchforksBossRecital'
import {
  type MicSourceHealthSnapshot,
  type PitchInfo,
} from './usePitchDetection'
import { PITCHFORKS_PITCH_PROFILE } from './pitchDetectionSmoothing'
import { advanceExactPitchHold, exactPitchSampleState } from './pitchMath'
import { PITCHFORKS_RANGE_NOTES } from './pitchforksRange'
import { pitchforksMicUnreliable } from './pitchforksTunerFeedback'
import { loadSongcraftPresets } from './pitchforksSongcraftPresets'
import { SONGCRAFT_PRESET_CATALOG } from './pitchforksSongcraftPresetCatalog'
import type { PitchforksMasteryProjection } from './pitchforksMasteryProjection'
import { canEnterTempoEncore } from './pitchforksTempoEncore'

// Keep the untimed Songcraft route free of the optional panel's runtime cycle:
// PitchforksTempoEncorePanel imports Songcraft's detector helpers. Loading it
// only after the untimed gate is true keeps the real Tempo Encore surface while
// preventing its module from being evaluated during Ear start.
const PitchforksTempoEncore = lazy(async () => {
  const tempoEncoreModule = await import('./PitchforksTempoEncorePanel')
  return { default: tempoEncoreModule.PitchforksTempoEncore }
})

/** The only microphone surface this leaf accepts: the parent owns the hook. */
export interface PitchforksSongcraftMicrophone {
  readonly pitchRef: RefObject<PitchInfo | null>
  readonly healthRef: RefObject<MicSourceHealthSnapshot>
  readonly generationRef: RefObject<number>
  readonly isListening: boolean
  readonly error: string | null
  readonly start: () => Promise<void>
  readonly stop: () => void
}

export interface PitchforksSongcraftConnectorProps {
  /** Read-only existing mastery snapshot; omission keeps Tempo Encore unavailable. */
  readonly masteryProjection?: PitchforksMasteryProjection
  /** The parent's already-admitted comfortable-range notes, snapshotted at Begin. */
  readonly admittedNotes: readonly string[]
  /** Existing family persistence ports; the connector never grades or writes directly. */
  readonly storage: PitchforksBossRecitalStorage
  readonly microphone: PitchforksSongcraftMicrophone
  readonly onReturn: () => void
  /** Parent-owned global piano/echo suppression window. */
  readonly matchingSuppressed: () => boolean
  readonly referenceReady: boolean
  /** Parent-owned exact reference playback. */
  readonly playReference: (note: string) => void
}

export type PitchforksSongcraftProps = PitchforksSongcraftConnectorProps

/** Additive controlled actions consumed by the parallel Songcraft panel leaf. */
export interface PitchforksSongcraftConnectedPanelProps extends PitchforksSongcraftPanelProps {
  readonly paused: boolean
  readonly hasNextSong: boolean
  readonly onTogglePause: () => void
  readonly onReplayPhrase: () => void
  readonly onNextSong: () => void
}

export const SONGCRAFT_CONFIDENCE_FLOOR = 0.75
export const SONGCRAFT_MATCH_TOLERANCE_CENTS = 70
export const SONGCRAFT_HOLD_MS = 300
export const SONGCRAFT_AUDIO_BUSY_MS = 1800
export const SONGCRAFT_STALE_AFTER_MS = 1000

type SongcraftTimer = ReturnType<typeof setTimeout>

const EMPTY_MIC_HEALTH: MicSourceHealthSnapshot = Object.freeze({
  audioContextState: 'closed',
  trackReadyState: 'unavailable',
  trackMuted: true,
})

export interface PitchforksSongcraftHoldState {
  readonly heldMs: number
  readonly matched: boolean
}

export interface PitchforksSongcraftGenerationState {
  readonly lastGeneration: number | null
  readonly generationObserved: boolean
  readonly generationObservedAt: number
}

export interface PitchforksSongcraftGenerationObservation {
  readonly state: PitchforksSongcraftGenerationState
  readonly generationAdvanced: boolean
  readonly staleRecovery: boolean
  /** Elapsed time since the previous fresh detector observation, never stale-gap time. */
  readonly freshElapsedMs: number
}

/**
 * Songcraft has its own route-level pause because the parent's ordinary-wave
 * pause control is not rendered while the game is in the Songcraft phase.
 * The shape mirrors the existing parent pause fence without importing the
 * parent component or changing its owned surface.
 */
export type PitchforksSongcraftPauseGate = Readonly<{
  paused: boolean
  generation: number
  fence: number
}>

export function createPitchforksSongcraftPauseGate(): PitchforksSongcraftPauseGate {
  return { paused: false, generation: 0, fence: 0 }
}

export function transitionPitchforksSongcraftPauseGate(
  gate: PitchforksSongcraftPauseGate,
  action: 'pause' | 'resume',
): PitchforksSongcraftPauseGate {
  return {
    paused: action === 'pause',
    generation: action === 'resume' ? gate.generation + 1 : gate.generation,
    fence: gate.fence + 1,
  }
}

export function acceptsPitchforksSongcraftPauseCallback(
  gate: PitchforksSongcraftPauseGate,
  generation: number,
  fence: number,
): boolean {
  return !gate.paused && gate.generation === generation && gate.fence === fence
}

/**
 * Observe detector freshness independently from the browser RAF cadence.
 * A matching pitch in a ref is not a new sample unless the parent generation
 * has advanced. A long gap fences the next observation so it cannot complete
 * a held note in one stale jump.
 */
export function observePitchforksSongcraftGeneration(
  current: PitchforksSongcraftGenerationState,
  generation: number,
  now: number,
  staleAfterMs = SONGCRAFT_STALE_AFTER_MS,
): PitchforksSongcraftGenerationObservation {
  const safeNow = Number.isFinite(now) ? now : 0
  const safeGeneration = Number.isFinite(generation) ? generation : 0
  const previousGeneration = current.lastGeneration
  if (previousGeneration === null) {
    return {
      state: {
        lastGeneration: safeGeneration,
        generationObserved: false,
        generationObservedAt: 0,
      },
      generationAdvanced: false,
      staleRecovery: false,
      freshElapsedMs: 0,
    }
  }

  if (safeGeneration < previousGeneration) {
    return {
      state: {
        lastGeneration: safeGeneration,
        generationObserved: false,
        generationObservedAt: 0,
      },
      generationAdvanced: false,
      staleRecovery: false,
      freshElapsedMs: 0,
    }
  }

  const generationAdvanced = safeGeneration > previousGeneration
  if (!generationAdvanced) {
    return {
      state: current,
      generationAdvanced: false,
      staleRecovery: false,
      freshElapsedMs: 0,
    }
  }

  const threshold = Number.isFinite(staleAfterMs) ? Math.max(0, staleAfterMs) : SONGCRAFT_STALE_AFTER_MS
  const elapsed = current.generationObserved
    && Number.isFinite(current.generationObservedAt)
    ? Math.max(0, safeNow - current.generationObservedAt)
    : Number.POSITIVE_INFINITY
  const staleRecovery = elapsed > threshold
  return {
    state: {
      lastGeneration: safeGeneration,
      generationObserved: true,
      generationObservedAt: safeNow,
    },
    generationAdvanced: true,
    staleRecovery,
    freshElapsedMs: staleRecovery || !Number.isFinite(elapsed) ? 0 : Math.min(100, elapsed),
  }
}

export interface PitchforksSongcraftVoiceSampleStep {
  readonly hold: PitchforksSongcraftHoldState
  readonly sampleState: 'unavailable' | 'match' | 'wrong'
}

/** Run the exact pitch gate only for a newly observed detector generation. */
export function advancePitchforksSongcraftVoiceSample(
  current: PitchforksSongcraftHoldState,
  observation: Pick<PitchforksSongcraftGenerationObservation, 'generationAdvanced' | 'staleRecovery' | 'freshElapsedMs'>,
  source: PitchInfo | null,
  targetFrequency: number | null,
  sourceReady: boolean,
): PitchforksSongcraftVoiceSampleStep {
  const sampleState = sourceReady && targetFrequency !== null
    ? exactPitchSampleState(
      source,
      targetFrequency,
      SONGCRAFT_CONFIDENCE_FLOOR,
      SONGCRAFT_MATCH_TOLERANCE_CENTS,
    )
    : 'unavailable'

  if (observation.staleRecovery || sampleState === 'wrong') {
    return { hold: { heldMs: 0, matched: false }, sampleState }
  }
  if (!observation.generationAdvanced || sampleState !== 'match') {
    return { hold: current, sampleState }
  }
  return {
    hold: advanceExactPitchHold(
      current,
      sampleState,
      observation.freshElapsedMs,
      SONGCRAFT_HOLD_MS,
    ),
    sampleState,
  }
}

export interface PitchforksSongcraftVisibilityReset {
  readonly hold: PitchforksSongcraftHoldState
  readonly holdProgress: number
  readonly dropoutFrames: number
  readonly generation: PitchforksSongcraftGenerationState
}

/** Re-arm voice freshness after a hidden document without touching EAR state. */
export function resetPitchforksSongcraftVisibilityState(
  generation: number,
): PitchforksSongcraftVisibilityReset {
  return {
    hold: { heldMs: 0, matched: false },
    holdProgress: 0,
    dropoutFrames: 0,
    generation: {
      lastGeneration: Number.isFinite(generation) ? generation : 0,
      generationObserved: false,
      generationObservedAt: 0,
    },
  }
}

export interface PitchforksSongcraftAsyncHandles {
  readonly rafId: number | null
  readonly cueTimer: SongcraftTimer | null
  readonly answerArmTimer: SongcraftTimer | null
}

export interface PitchforksSongcraftCleanupControls {
  readonly cancelAnimationFrame: (id: number) => void
  readonly clearTimeout: (id: SongcraftTimer) => void
  readonly stopMicrophone: () => void
}

/**
 * Cancel every asynchronous connector resource before a session disappears.
 * The helper is deliberately dependency-injected so cleanup stays testable
 * without a browser or a second microphone implementation.
 */
export function cleanupPitchforksSongcraftAsyncWork(
  handles: PitchforksSongcraftAsyncHandles,
  controls: PitchforksSongcraftCleanupControls,
): void {
  try {
    if (handles.rafId !== null) controls.cancelAnimationFrame(handles.rafId)
  } catch {
    // One stale browser callback must not prevent the remaining cleanup.
  }
  try {
    if (handles.cueTimer !== null) controls.clearTimeout(handles.cueTimer)
  } catch {
    // Timers are best-effort during teardown.
  }
  try {
    if (handles.answerArmTimer !== null) controls.clearTimeout(handles.answerArmTimer)
  } catch {
    // Timers are best-effort during teardown.
  }
  try {
    controls.stopMicrophone()
  } catch {
    // Parent stop is expected to be idempotent; never strand teardown on it.
  }
}

/**
 * Resolve the browser's real Composer storage only after a guarded access.
 * There is intentionally no in-memory/demo source fallback.
 */
export function getPitchforksSongcraftComposerStorage(): SongcraftPhraseStorage | null {
  if (typeof window === 'undefined') return null
  try {
    const storage = window.localStorage
    if (!storage
      || typeof storage.length !== 'number'
      || typeof storage.key !== 'function'
      || typeof storage.getItem !== 'function') return null
    return storage
  } catch {
    return null
  }
}

/** Read Composer's exact local sources, failing closed when storage is unavailable. */
export async function loadPitchforksSongcraftPhrases(
  storage: SongcraftPhraseStorage | null | undefined = undefined,
): Promise<readonly SongcraftPhrase[]> {
  const source = storage === undefined ? getPitchforksSongcraftComposerStorage() : storage
  if (!source) return Object.freeze([])
  try {
    return await loadSongcraftPhrases(source)
  } catch {
    return Object.freeze([])
  }
}

export function isPitchforksSongcraftPresetReady(phrase: SongcraftPhrase, admittedNotes: readonly string[]): boolean {
  if (phrase.provenance.source !== 'builtin') return true
  const notes = phrase.occurrences.filter(occurrence => !occurrence.isRest)
  return notes.length > 0 && notes.every(occurrence => occurrence.pitchName !== null
    && isPitchforksSongcraftAdmittedNote(occurrence.pitchName, admittedNotes))
}

/** Return the next actually loaded Composer/preset phrase in library order. */
export function nextPitchforksSongcraftSourceKey(
  songs: readonly Pick<SongcraftPhrase, 'sourceKey'>[],
  selectedKey: string,
): string | null {
  const index = songs.findIndex(song => song.sourceKey === selectedKey)
  return index >= 0 ? songs[index + 1]?.sourceKey ?? null : null
}

/** Composer stays first; built-in exercises must fit the already-confirmed range exactly. */
export async function loadPitchforksSongcraftLibrary(
  admittedNotes: readonly string[],
  storage: SongcraftPhraseStorage | null | undefined = undefined,
): Promise<readonly SongcraftPhrase[]> {
  const [composer, presets] = await Promise.all([
    loadPitchforksSongcraftPhrases(storage),
    loadSongcraftPresets(SONGCRAFT_PRESET_CATALOG),
  ])
  return Object.freeze([...composer, ...presets.phrases.filter(phrase => isPitchforksSongcraftPresetReady(phrase, admittedNotes))])
}

function midiForCanonicalRangeNote(note: string): number | null {
  const match = note.match(/^([A-G])([3-5])$/)
  if (!match) return null
  const semitones: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  }
  const base = semitones[match[1]]
  if (base === undefined) return null
  return (Number(match[2]) + 1) * 12 + base
}

/** True only for a literal note in both the canonical range and admission snapshot. */
export function isPitchforksSongcraftAdmittedNote(
  note: unknown,
  admittedNotes: readonly string[],
): note is string {
  return typeof note === 'string'
    && PITCHFORKS_RANGE_NOTES.includes(note)
    && Array.isArray(admittedNotes)
    && admittedNotes.includes(note)
}

/**
 * Return a frequency only for a validated eligible authored occurrence.
 * Rests, unsupported notes, malformed MIDI, and any unknown label return null;
 * none can acquire pitchMath's 440 Hz invalid-name fallback.
 */
export function pitchforksSongcraftTargetFrequency(
  occurrence: Pick<SongcraftPhraseOccurrence, 'isRest' | 'pitchName' | 'midi'> | null | undefined,
  admittedNotes: readonly string[],
): number | null {
  if (!occurrence || occurrence.isRest || !isPitchforksSongcraftAdmittedNote(occurrence.pitchName, admittedNotes)) {
    return null
  }
  if (!Number.isSafeInteger(occurrence.midi)) return null
  const expectedMidi = midiForCanonicalRangeNote(occurrence.pitchName)
  if (expectedMidi === null || occurrence.midi !== expectedMidi) return null
  const frequency = 440 * Math.pow(2, (occurrence.midi - 69) / 12)
  return Number.isFinite(frequency) && frequency > 0 ? frequency : null
}

function clockNow(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now()
}

function pageIsVisible(): boolean {
  return typeof document === 'undefined' || document.visibilityState === 'visible'
}

function safeMicHealth(microphone: PitchforksSongcraftMicrophone): MicSourceHealthSnapshot {
  try {
    return microphone.healthRef.current ?? EMPTY_MIC_HEALTH
  } catch {
    return EMPTY_MIC_HEALTH
  }
}

function safePitch(microphone: PitchforksSongcraftMicrophone): PitchInfo | null {
  try {
    return microphone.pitchRef.current ?? null
  } catch {
    return null
  }
}

function safeGeneration(microphone: PitchforksSongcraftMicrophone): number {
  try {
    const value = microphone.generationRef.current
    return Number.isFinite(value) ? value : 0
  } catch {
    return 0
  }
}

function practiceCurrentKey(state: SongcraftPracticeState | null): string {
  const current = state?.current
  if (!state || !current || current.kind !== 'note') return ''
  return `${state.attemptId}:${current.identity.ordinal}:${current.identity.claimId ?? ''}`
}

function resultNotice(result: SongcraftPracticeResult): string | null | undefined {
  if (result.kind === 'ignored') {
    // A stale/no-op action must not erase a useful current status. Hints are
    // intentionally silent because the following cue is their visible effect.
    return result.reason === 'hint' ? null : undefined
  }
  const traversalComplete = result.state.summary.traversalComplete
  switch (result.kind) {
    case 'persisted':
      return result.outcome === 'failed'
        ? 'This answer was saved for review. Try this note again when you are ready.'
        : traversalComplete
          ? result.state.summary.assisted
            ? 'Practice complete with help. Helped notes do not count as unaided recall.'
            : 'Practice complete. Your eligible notes were saved unaided.'
          : 'That note is saved. The next note is ready when you are.'
    case 'supported-practice':
      return traversalComplete
        ? 'Practice complete with help. Try again without hints when you feel ready.'
        : 'Good practice with help. The next note is ready; this did not count as unaided recall.'
    case 'save-failed':
    case 'readback-mismatch':
      return 'Your answer is held, but saving is not confirmed. Retry saving; do not answer again.'
    case 'conflict':
      return 'Newer practice was found. It has not been overwritten. Retry or return safely.'
    case 'storage-error':
      return 'Saved history could not be read. Nothing was replaced. Try again or return safely.'
    case 'retry-note':
      return 'A fresh try on the same note is ready. There is no timer.'
    case 'acknowledged':
      return null
  }
}

/**
 * Bind acknowledgement to the identity that was rendered for this callback.
 * A stale second click therefore cannot consume the next adjacent rest or
 * unsupported occurrence after the first click has advanced the controller.
 */
export function acknowledgePitchforksSongcraftRenderedState(
  controller: SongcraftPracticeController | null,
  renderedState: SongcraftPracticeState | null,
): SongcraftPracticeResult | null {
  if (!controller || !renderedState || renderedState.status !== 'active') return null
  const current = renderedState.current
  if (current.kind !== 'rest' && current.kind !== 'unsupported') return null
  return controller.acknowledge(current.identity)
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

/**
 * Connect one real parent microphone to the controlled Songcraft panel.
 * Composer parsing, review persistence, and exact reference playback remain
 * behind their injected ports; this component never invents input or grades
 * directly.
 */
export function PitchforksSongcraft(props: PitchforksSongcraftConnectorProps): ReactElement {
  const [songs, setSongs] = useState<readonly SongcraftPhrase[]>([])
  const [selectedKey, setSelectedKey] = useState('')
  const [lane, setLane] = useState<PitchforksSongcraftLane>('voice')
  const [practiceState, setPracticeState] = useState<SongcraftPracticeState | null>(null)
  const [tempoEncore, setTempoEncore] = useState(false)
  const [paused, setPaused] = useState(false)
  const [audioBusy, setAudioBusy] = useState(false)
  const [micStartPending, setMicStartPending] = useState(false)
  const [, setUiVersion] = useState(0)

  const mountedRef = useRef(false)
  const propsRef = useRef(props)
  propsRef.current = props
  const microphoneRef = useRef(props.microphone)
  microphoneRef.current = props.microphone
  const songsRef = useRef<readonly SongcraftPhrase[]>([])
  songsRef.current = songs
  const selectedKeyRef = useRef('')
  selectedKeyRef.current = selectedKey
  const laneRef = useRef<PitchforksSongcraftLane>('voice')
  laneRef.current = lane
  const practiceStateRef = useRef<SongcraftPracticeState | null>(null)
  practiceStateRef.current = practiceState
  const controllerRef = useRef<SongcraftPracticeController | null>(null)
  const pauseGateRef = useRef<PitchforksSongcraftPauseGate>(createPitchforksSongcraftPauseGate())
  const pausedRef = useRef(false)
  const sessionTokenRef = useRef(0)
  const voiceTargetKeyRef = useRef('')
  const rafRef = useRef<number | null>(null)
  const cueTimerRef = useRef<SongcraftTimer | null>(null)
  const answerArmTimerRef = useRef<SongcraftTimer | null>(null)
  const cueTokenRef = useRef(0)
  const audioBusyRef = useRef(false)
  const micStartPendingRef = useRef(false)
  const micStartErrorRef = useRef<string | null>(null)
  const holdRef = useRef<PitchforksSongcraftHoldState>({ heldMs: 0, matched: false })
  const holdProgressRef = useRef(0)
  const dropoutFramesRef = useRef(0)
  const lastGenerationRef = useRef<number | null>(null)
  const generationObservedRef = useRef(false)
  const generationObservedAtRef = useRef(0)
  const uiLastUpdatedAtRef = useRef(0)
  const earHeardClaimRef = useRef<string | null>(null)
  const earAnswerClaimRef = useRef<string | null>(null)
  const challengeStartedAtRef = useRef(0)
  const noticeRef = useRef<{ key: string; message: string } | null>(null)
  const voiceFeedbackRef = useRef<{ key: string; message: string } | null>(null)

  const requestUi = useCallback((force = false, at = clockNow()) => {
    if (!mountedRef.current) return
    if (force || at - uiLastUpdatedAtRef.current >= 80) {
      uiLastUpdatedAtRef.current = at
      setUiVersion(version => version + 1)
    }
  }, [])

  const matchingSuppressedNow = useCallback((): boolean => {
    try {
      return propsRef.current.matchingSuppressed() === true
    } catch {
      // A failed parent safety read is a suppression, never permission to grade.
      return true
    }
  }, [])

  const setPracticeSnapshot = useCallback((next: SongcraftPracticeState | null) => {
    practiceStateRef.current = next
    if (mountedRef.current) setPracticeState(next)
  }, [])

  const clearHold = useCallback((notify = true) => {
    holdRef.current = { heldMs: 0, matched: false }
    holdProgressRef.current = 0
    dropoutFramesRef.current = 0
    if (notify) requestUi(true)
  }, [requestUi])

  const setNotice = useCallback((message: string | null, key = practiceCurrentKey(practiceStateRef.current)) => {
    noticeRef.current = message ? { key, message } : null
    requestUi(true)
  }, [requestUi])

  const clearCueTimers = useCallback(() => {
    if (cueTimerRef.current !== null) clearTimeout(cueTimerRef.current)
    if (answerArmTimerRef.current !== null) clearTimeout(answerArmTimerRef.current)
    cueTimerRef.current = null
    answerArmTimerRef.current = null
    cueTokenRef.current += 1
  }, [])

  const cancelVoiceLoop = useCallback(() => {
    if (rafRef.current !== null && typeof cancelAnimationFrame === 'function') {
      try { cancelAnimationFrame(rafRef.current) } catch {}
    }
    rafRef.current = null
  }, [])

  const setLocalAudioBusy = useCallback((busy: boolean) => {
    audioBusyRef.current = busy
    if (mountedRef.current) {
      setAudioBusy(busy)
      requestUi(true)
    }
  }, [requestUi])

  /** Keep a cue's local busy lock until the parent's exact-audio suppression ends. */
  const releaseAudioWhenIdle = useCallback((fence: number) => {
    const check = () => {
      if (!mountedRef.current || pauseGateRef.current.fence !== fence) return
      if (pauseGateRef.current.paused || matchingSuppressedNow()) {
        cueTimerRef.current = setTimeout(check, 50)
        return
      }
      cueTimerRef.current = null
      setLocalAudioBusy(false)
    }
    cueTimerRef.current = setTimeout(check, 0)
  }, [matchingSuppressedNow, setLocalAudioBusy])

  const applyResult = useCallback((result: SongcraftPracticeResult) => {
    const next = result.state
    setPracticeSnapshot(next)
    clearHold()

    const nextCurrent = next.current
    const nextClaim = nextCurrent.kind === 'note' ? nextCurrent.identity.claimId : null
    if (nextClaim === null || nextClaim !== earHeardClaimRef.current) {
      earHeardClaimRef.current = null
      earAnswerClaimRef.current = null
      challengeStartedAtRef.current = 0
    }

    if (nextCurrent.kind !== 'note') {
      try { microphoneRef.current.stop() } catch {}
    }

    const message = resultNotice(result)
    if (message !== undefined) setNotice(message, practiceCurrentKey(next))
    requestUi(true)
  }, [clearHold, requestUi, setNotice, setPracticeSnapshot])

  const beginPractice = useCallback(() => {
    if (controllerRef.current) return
    const phrase = songsRef.current.find(value => value.sourceKey === selectedKeyRef.current)
    if (!phrase || !isPitchforksSongcraftPresetReady(phrase, propsRef.current.admittedNotes)) return

    pauseGateRef.current = createPitchforksSongcraftPauseGate()
    pausedRef.current = false
    if (mountedRef.current) setPaused(false)

    let attemptId: string | null = null
    try {
      const randomUUID = globalThis.crypto?.randomUUID
      if (typeof randomUUID === 'function') attemptId = randomUUID.call(globalThis.crypto)
    } catch {
      attemptId = null
    }
    if (!attemptId || attemptId.trim().length === 0) return

    const token = sessionTokenRef.current + 1
    sessionTokenRef.current = token
    clearCueTimers()
    cancelVoiceLoop()
    clearHold()
    micStartErrorRef.current = null
    micStartPendingRef.current = false
    earHeardClaimRef.current = null
    earAnswerClaimRef.current = null
    noticeRef.current = null
    voiceFeedbackRef.current = null

    const admittedSnapshot = Object.freeze([...propsRef.current.admittedNotes])
    let controller: SongcraftPracticeController
    try {
      controller = createPitchforksSongcraftPractice({
        phrase,
        attemptId,
        lane: laneRef.current,
        admittedNotes: admittedSnapshot,
        storage: propsRef.current.storage,
      })
    } catch {
      return
    }
    controllerRef.current = controller
    setPracticeSnapshot(controller.state())
    requestUi(true)
  }, [cancelVoiceLoop, clearCueTimers, clearHold, requestUi, setPracticeSnapshot])

  const selectSong = useCallback((key: string) => {
    if (controllerRef.current) return
    if (!songsRef.current.some(song => song.sourceKey === key)) return
    selectedKeyRef.current = key
    setSelectedKey(key)
  }, [])

  const changeLane = useCallback((nextLane: PitchforksSongcraftLane) => {
    if (controllerRef.current) return
    if (nextLane !== 'voice' && nextLane !== 'ear') return
    laneRef.current = nextLane
    setLane(nextLane)
  }, [])

  const startMic = useCallback(() => {
    const controller = controllerRef.current
    const state = controller?.state()
    if (pausedRef.current || !controller || !state || state.status !== 'active' || state.lane !== 'voice'
      || state.current.kind !== 'note' || state.current.identity.claimId === null) return
    const microphone = microphoneRef.current
    if (micStartPendingRef.current || microphone.isListening) return

    clearHold()
    micStartErrorRef.current = null
    micStartPendingRef.current = true
    if (mountedRef.current) setMicStartPending(true)
    requestUi(true)
    const token = sessionTokenRef.current
    const callbackGeneration = pauseGateRef.current.generation
    const callbackFence = pauseGateRef.current.fence

    let started: Promise<void>
    try {
      started = microphone.start()
    } catch (error) {
      if (!mountedRef.current || token !== sessionTokenRef.current) return
      micStartPendingRef.current = false
      setMicStartPending(false)
      micStartErrorRef.current = error instanceof Error ? error.message : 'Microphone access failed'
      requestUi(true)
      return
    }

    void Promise.resolve(started).then(
      () => {
        if (!mountedRef.current || token !== sessionTokenRef.current
          || !acceptsPitchforksSongcraftPauseCallback(pauseGateRef.current, callbackGeneration, callbackFence)) return
        micStartPendingRef.current = false
        setMicStartPending(false)
        requestUi(true)
      },
      error => {
        if (!mountedRef.current || token !== sessionTokenRef.current
          || !acceptsPitchforksSongcraftPauseCallback(pauseGateRef.current, callbackGeneration, callbackFence)) return
        micStartPendingRef.current = false
        setMicStartPending(false)
        micStartErrorRef.current = error instanceof Error ? error.message : 'Microphone access failed'
        requestUi(true)
      },
    )
  }, [clearHold, requestUi])

  const playCue = useCallback((forceHint: boolean) => {
    const controller = controllerRef.current
    const state = controller?.state()
    if (pausedRef.current || !controller || !state || state.status !== 'active' || state.current.kind !== 'note'
      || state.current.identity.claimId === null || audioBusyRef.current || matchingSuppressedNow()) return

    const current = state.current
    const target = current.occurrence.pitchName
    const frequency = pitchforksSongcraftTargetFrequency(current.occurrence, state.admittedNotes)
    if (!target || frequency === null) return
    if (!propsRef.current.referenceReady) {
      setNotice('Reference audio is not ready yet. Try again when it is available.', practiceCurrentKey(state))
      return
    }

    clearHold()
    const shouldHint = forceHint || state.lane === 'voice'
      || (state.lane === 'ear' && earHeardClaimRef.current === current.identity.claimId)
    if (shouldHint) {
      const hintResult = controller.hint(current.identity)
      if (hintResult.kind !== 'ignored' || hintResult.reason !== 'hint') {
        applyResult(hintResult)
        return
      }
      setPracticeSnapshot(hintResult.state)
    }

    const session = sessionTokenRef.current
    const callbackGeneration = pauseGateRef.current.generation
    const callbackFence = pauseGateRef.current.fence
    const claimId = current.identity.claimId
    clearCueTimers()
    const ownedCueToken = ++cueTokenRef.current
    earAnswerClaimRef.current = null
    setLocalAudioBusy(true)
    challengeStartedAtRef.current = 0

    try {
      // Parent playback is the single exact-reference route and owns global suppression.
      propsRef.current.playReference(target)
    } catch {
      setLocalAudioBusy(false)
      setNotice('Reference audio could not be played. Try again when ready.', practiceCurrentKey(state))
      return
    }

    const armEarAnswer = () => {
      if (!mountedRef.current || session !== sessionTokenRef.current || ownedCueToken !== cueTokenRef.current
        || !acceptsPitchforksSongcraftPauseCallback(pauseGateRef.current, callbackGeneration, callbackFence)) return
      const live = controllerRef.current?.state()
      if (!live || live.current.kind !== 'note' || live.current.identity.claimId !== claimId || live.lane !== 'ear') return
      if (matchingSuppressedNow() || !pageIsVisible()) {
        answerArmTimerRef.current = setTimeout(armEarAnswer, 50)
        return
      }
      // The first Hear is a recognition challenge; any later replay of this
      // claim is assistance and the controller must know that before cueing.
      earHeardClaimRef.current = claimId
      earAnswerClaimRef.current = claimId
      challengeStartedAtRef.current = clockNow()
      requestUi(true)
    }

    cueTimerRef.current = setTimeout(() => {
      if (!mountedRef.current || session !== sessionTokenRef.current || ownedCueToken !== cueTokenRef.current
        || !acceptsPitchforksSongcraftPauseCallback(pauseGateRef.current, callbackGeneration, callbackFence)) return
      cueTimerRef.current = null
      setLocalAudioBusy(false)
      if (state.lane === 'ear') armEarAnswer()
    }, SONGCRAFT_AUDIO_BUSY_MS)
  }, [applyResult, clearCueTimers, clearHold, matchingSuppressedNow, requestUi, setLocalAudioBusy, setNotice, setPracticeSnapshot])

  const hear = useCallback(() => playCue(false), [playCue])
  const hint = useCallback(() => playCue(true), [playCue])

  const answer = useCallback((answeredNote: string) => {
    const controller = controllerRef.current
    const state = controller?.state()
    if (pausedRef.current || !controller || !state || state.status !== 'active' || state.lane !== 'ear'
      || state.current.kind !== 'note' || state.current.identity.claimId === null
      || earAnswerClaimRef.current !== state.current.identity.claimId
      || audioBusyRef.current || matchingSuppressedNow() || !pageIsVisible()) return
    if (!isPitchforksSongcraftAdmittedNote(answeredNote, state.admittedNotes)) return

    const target = state.current.occurrence.pitchName
    if (!target) return
    clearHold()
    const latencyMs = challengeStartedAtRef.current > 0
      ? Math.max(0, clockNow() - challengeStartedAtRef.current)
      : undefined
    applyResult(controller.resolve({
      ...state.current.identity,
      note: answeredNote,
      correct: answeredNote === target,
      latencyMs,
    }))
  }, [applyResult, clearHold, matchingSuppressedNow])

  const acknowledge = useCallback(() => {
    if (pausedRef.current) return
    const wasListening = microphoneRef.current.isListening
    const result = acknowledgePitchforksSongcraftRenderedState(controllerRef.current, practiceState)
    if (!result) return
    applyResult(result)
    if (wasListening && result.state.lane === 'voice' && result.state.current.kind === 'note') startMic()
  }, [applyResult, practiceState, startMic])

  const retrySave = useCallback(() => {
    if (pausedRef.current) return
    const controller = controllerRef.current
    if (!controller) return
    clearHold()
    applyResult(controller.retrySave())
  }, [applyResult, clearHold])

  const retryNote = useCallback(() => {
    if (pausedRef.current) return
    const controller = controllerRef.current
    if (!controller) return
    clearHold()
    applyResult(controller.retryNote())
  }, [applyResult, clearHold])

  /** Fence a completed/abandoned attempt without touching shared mastery. */
  const resetPracticeAttempt = useCallback(() => {
    sessionTokenRef.current += 1
    try { controllerRef.current?.cancel() } catch {}
    controllerRef.current = null
    cancelVoiceLoop()
    clearCueTimers()
    clearHold()
    earHeardClaimRef.current = null
    earAnswerClaimRef.current = null
    challengeStartedAtRef.current = 0
    micStartPendingRef.current = false
    micStartErrorRef.current = null
    audioBusyRef.current = false
    pauseGateRef.current = createPitchforksSongcraftPauseGate()
    pausedRef.current = false
    if (mountedRef.current) {
      setMicStartPending(false)
      setAudioBusy(false)
      setPaused(false)
      setPracticeSnapshot(null)
    }
    try { microphoneRef.current.stop() } catch {}
  }, [cancelVoiceLoop, clearCueTimers, clearHold, setPracticeSnapshot])

  const replayPhrase = useCallback(() => {
    const state = controllerRef.current?.state()
    if (pausedRef.current || !state || state.status !== 'complete') return
    setTempoEncore(false)
    resetPracticeAttempt()
    beginPractice()
  }, [beginPractice, resetPracticeAttempt])

  const nextSong = useCallback(() => {
    const state = controllerRef.current?.state()
    if (pausedRef.current || !state || state.status !== 'complete') return
    const nextKey = nextPitchforksSongcraftSourceKey(songsRef.current, selectedKeyRef.current)
    if (!nextKey) return
    setTempoEncore(false)
    resetPracticeAttempt()
    selectedKeyRef.current = nextKey
    setSelectedKey(nextKey)
    beginPractice()
  }, [beginPractice, resetPracticeAttempt])

  const togglePause = useCallback(() => {
    const state = controllerRef.current?.state()
    if (!state || (state.status !== 'active' && state.status !== 'pending-save')) return

    const action = pauseGateRef.current.paused ? 'resume' : 'pause'
    const nextGate = transitionPitchforksSongcraftPauseGate(pauseGateRef.current, action)
    pauseGateRef.current = nextGate
    pausedRef.current = nextGate.paused
    sessionTokenRef.current += 1
    clearCueTimers()
    cancelVoiceLoop()
    clearHold()
    micStartPendingRef.current = false
    if (mountedRef.current) setMicStartPending(false)

    const reset = resetPitchforksSongcraftVisibilityState(safeGeneration(microphoneRef.current))
    holdRef.current = reset.hold
    holdProgressRef.current = reset.holdProgress
    dropoutFramesRef.current = reset.dropoutFrames
    lastGenerationRef.current = reset.generation.lastGeneration
    generationObservedRef.current = reset.generation.generationObserved
    generationObservedAtRef.current = reset.generation.generationObservedAt
    voiceFeedbackRef.current = null

    if (action === 'pause') {
      // Parent playback cannot be stopped through this connector. Keep the
      // local busy lock until its global suppression window is actually clear.
      if (!matchingSuppressedNow()) setLocalAudioBusy(false)
    } else if (audioBusyRef.current) {
      releaseAudioWhenIdle(nextGate.fence)
    }
    if (mountedRef.current) setPaused(nextGate.paused)
    requestUi(true)
  }, [cancelVoiceLoop, clearCueTimers, clearHold, matchingSuppressedNow, releaseAudioWhenIdle, requestUi, setLocalAudioBusy])

  const returnToMenu = useCallback(() => {
    resetPracticeAttempt()
    propsRef.current.onReturn()
  }, [resetPracticeAttempt])

  const resetVoiceOnVisibilityHidden = useCallback(() => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'hidden') return
    if (practiceStateRef.current?.lane !== 'voice') return
    const reset = resetPitchforksSongcraftVisibilityState(safeGeneration(microphoneRef.current))
    holdRef.current = reset.hold
    holdProgressRef.current = reset.holdProgress
    dropoutFramesRef.current = reset.dropoutFrames
    lastGenerationRef.current = reset.generation.lastGeneration
    generationObservedRef.current = reset.generation.generationObserved
    generationObservedAtRef.current = reset.generation.generationObservedAt
    voiceFeedbackRef.current = null
    requestUi(true)
  }, [requestUi])

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.addEventListener('visibilitychange', resetVoiceOnVisibilityHidden)
    return () => document.removeEventListener('visibilitychange', resetVoiceOnVisibilityHidden)
  }, [resetVoiceOnVisibilityHidden])

  useEffect(() => {
    mountedRef.current = true
    let disposed = false
    void loadPitchforksSongcraftLibrary(propsRef.current.admittedNotes).then(next => {
      if (disposed) return
      songsRef.current = next
      setSongs(next)
      setSelectedKey(current => {
        const retained = current && next.some(phrase => phrase.sourceKey === current)
        const resolved = retained ? current : next[0]?.sourceKey ?? ''
        selectedKeyRef.current = resolved
        return resolved
      })
    })
    return () => {
      disposed = true
      mountedRef.current = false
      sessionTokenRef.current += 1
      try { controllerRef.current?.cancel() } catch {}
      controllerRef.current = null
      cleanupPitchforksSongcraftAsyncWork(
        {
          rafId: rafRef.current,
          cueTimer: cueTimerRef.current,
          answerArmTimer: answerArmTimerRef.current,
        },
        {
          cancelAnimationFrame: id => {
            if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id)
          },
          clearTimeout,
          stopMicrophone: () => microphoneRef.current.stop(),
        },
      )
      rafRef.current = null
      cueTimerRef.current = null
      answerArmTimerRef.current = null
    }
  }, [])

  const voiceTargetKey = practiceState && practiceState.lane === 'voice'
    && practiceState.current.kind === 'note'
    && practiceState.current.identity.claimId !== null
    ? practiceCurrentKey(practiceState)
    : ''
  voiceTargetKeyRef.current = voiceTargetKey

  const processVoiceFrame = useCallback((timestamp: number) => {
    const controller = controllerRef.current
    const state = practiceStateRef.current
    if (pausedRef.current || !controller || !state || state.status !== 'active' || state.lane !== 'voice'
      || state.current.kind !== 'note' || state.current.identity.claimId === null
      || practiceCurrentKey(state) !== voiceTargetKeyRef.current) {
      clearHold(false)
      return
    }

    const now = Number.isFinite(timestamp) ? timestamp : clockNow()
    const microphone = microphoneRef.current
    const visible = pageIsVisible()
    if (!visible) {
      const reset = resetPitchforksSongcraftVisibilityState(safeGeneration(microphone))
      holdRef.current = reset.hold
      holdProgressRef.current = reset.holdProgress
      dropoutFramesRef.current = reset.dropoutFrames
      lastGenerationRef.current = reset.generation.lastGeneration
      generationObservedRef.current = reset.generation.generationObserved
      generationObservedAtRef.current = reset.generation.generationObservedAt
      voiceFeedbackRef.current = null
      return
    }
    const generation = safeGeneration(microphone)
    const generationObservation = observePitchforksSongcraftGeneration(
      {
        lastGeneration: lastGenerationRef.current,
        generationObserved: generationObservedRef.current,
        generationObservedAt: generationObservedAtRef.current,
      },
      generation,
      now,
    )
    lastGenerationRef.current = generationObservation.state.lastGeneration
    generationObservedRef.current = generationObservation.state.generationObserved
    generationObservedAtRef.current = generationObservation.state.generationObservedAt
    const health = safeMicHealth(microphone)
    const suppressed = matchingSuppressedNow()
    const micError = microphone.error ?? micStartErrorRef.current
    const micUnreliable = pitchforksMicUnreliable({
      hasTarget: true,
      isListening: microphone.isListening,
      micError,
      audioContextState: health.audioContextState,
      trackReadyState: health.trackReadyState,
      trackMuted: health.trackMuted,
      matchingSuppressed: suppressed,
      pageVisible: visible,
      generationObserved: generationObservedRef.current,
      generationAgeMs: generationObservedRef.current
        ? Math.max(0, now - generationObservedAtRef.current)
        : Number.POSITIVE_INFINITY,
      staleAfterMs: SONGCRAFT_STALE_AFTER_MS,
    })
    const sourceReady = microphone.isListening
      && !micError
      && health.audioContextState === 'running'
      && health.trackReadyState === 'live'
      && !health.trackMuted
      && visible
      && !suppressed
      && !micUnreliable

    const current = state.current
    const target = current.occurrence.pitchName
    const targetFrequency = pitchforksSongcraftTargetFrequency(current.occurrence, state.admittedNotes)
    if (!target || targetFrequency === null) {
      clearHold(false)
      return
    }

    const source = sourceReady ? safePitch(microphone) : null
    const sampleStep = advancePitchforksSongcraftVoiceSample(
      holdRef.current,
      generationObservation,
      source,
      targetFrequency,
      sourceReady,
    )
    const sampleState = sampleStep.sampleState
    holdRef.current = sampleStep.hold

    if (!sourceReady || sampleState === 'unavailable') {
      if (suppressed) {
        clearHold(false)
        voiceFeedbackRef.current = { key: practiceCurrentKey(state), message: 'Listen to the reference, then sing when the cue ends.' }
      } else {
        dropoutFramesRef.current += 1
        if (dropoutFramesRef.current >= PITCHFORKS_PITCH_PROFILE.dropoutResetFrames) {
          holdRef.current = { heldMs: 0, matched: false }
          holdProgressRef.current = 0
        }
        voiceFeedbackRef.current = {
          key: practiceCurrentKey(state),
          message: micUnreliable
            ? 'Microphone needs attention. Check it, then try the note again.'
            : `Sing ${target} when you are ready. Hold one clear tone.`,
        }
      }
      requestUi(false, now)
      return
    }

    dropoutFramesRef.current = 0
    if (sampleState === 'wrong') {
      holdProgressRef.current = 0
      const heard = source?.note || 'That pitch'
      voiceFeedbackRef.current = { key: practiceCurrentKey(state), message: `${heard} heard. Keep singing toward ${target}.` }
      requestUi(false, now)
      return
    }

    const nextHold = holdRef.current
    holdProgressRef.current = clampProgress(nextHold.heldMs / SONGCRAFT_HOLD_MS)
    voiceFeedbackRef.current = {
      key: practiceCurrentKey(state),
      message: nextHold.matched
        ? `${target} locked. Saving your answer.`
        : `${target} heard. Hold steady.`,
    }
    if (nextHold.matched && generationObservation.generationAdvanced && !generationObservation.staleRecovery) {
      const live = controller.state()
      if (live.current.kind === 'note' && live.current.identity.claimId === current.identity.claimId
        && !matchingSuppressedNow() && pageIsVisible()) {
        applyResult(controller.resolve({
          ...live.current.identity,
          note: target,
          correct: true,
        }))
      }
      return
    }
    requestUi(false, now)
  }, [applyResult, clearHold, matchingSuppressedNow, requestUi])

  useEffect(() => {
    if (paused || !voiceTargetKey || typeof requestAnimationFrame !== 'function') return
    const token = sessionTokenRef.current
    let running = true
    // A claim starts from the detector generation that already exists. The
    // first newer generation is a fresh observation but carries no duration;
    // RAF cadence cannot manufacture held time while the generation is still.
    lastGenerationRef.current = safeGeneration(microphoneRef.current)
    generationObservedRef.current = false
    generationObservedAtRef.current = 0

    const frame = (timestamp: number) => {
      if (!running || !mountedRef.current || token !== sessionTokenRef.current || voiceTargetKeyRef.current !== voiceTargetKey) return
      processVoiceFrame(timestamp)
      if (running && typeof requestAnimationFrame === 'function') rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)
    return () => {
      running = false
      cancelVoiceLoop()
      clearHold(false)
    }
  }, [cancelVoiceLoop, clearHold, paused, processVoiceFrame, voiceTargetKey])

  const view = useMemo<SongcraftPanelView | null>(() => {
    const state = practiceState
    if (!state || state.current.kind === 'cancelled') return null
    const current = state.current
    const total = Math.max(1, state.phrase.occurrences.length)
    const pendingSave = state.status === 'pending-save'
    const needsRetry = !pendingSave
      && current.kind === 'note'
      && current.identity.claimId === null
      && state.recitalState?.lastReceipt?.correct === false
      && state.recitalState.lastReceipt.persisted
    const busy = audioBusy || micStartPending || paused
    const currentKey = practiceCurrentKey(state)
    const micStatus: SongcraftPanelView['micStatus'] = state.lane !== 'voice'
      ? 'off'
      : micStartPending
        ? 'starting'
        : props.microphone.error || micStartErrorRef.current
          ? 'error'
          : props.microphone.isListening
            ? 'listening'
            : 'off'
    const canAnswer = state.lane === 'ear'
      && current.kind === 'note'
      && current.identity.claimId !== null
      && earAnswerClaimRef.current === current.identity.claimId
      && !busy
      && !pendingSave
      && !needsRetry
      && !paused
      && !matchingSuppressedNow()
      && pageIsVisible()
    const progress01 = current.kind === 'complete'
      ? 1
      : clampProgress((state.cursor + (state.lane === 'voice' && current.kind === 'note' ? holdProgressRef.current : 0)) / total)

    let message = ''
    if (paused) message = 'Paused. Your phrase progress and mastery are safe; resume when you are ready.'
    else if (pendingSave) message = 'Your answer is held, but saving is not confirmed. Retry saving; do not answer again.'
    else if (needsRetry) message = 'That answer was saved for review. Try this note again when you are ready.'
    else if (current.kind === 'rest') message = 'Rest — continue when ready.'
    else if (current.kind === 'unsupported') message = 'This authored note is outside your current practice range. Continue without credit.'
    else if (current.kind === 'complete') {
      message = state.summary.assisted
        ? 'Practice complete with help. Helped notes do not count as unaided recall.'
        : state.summary.unaidedComplete
          ? 'Practice complete. Your eligible notes were saved unaided.'
          : 'Practice complete. The authored phrase was traversed.'
    } else if (state.lane === 'ear') {
      message = busy || matchingSuppressedNow()
        ? 'Listen to the reference note; answers open when the cue ends.'
        : canAnswer
          ? 'Which note did you hear? Choose one deliberate answer.'
          : 'Press Hear Note to hear the challenge.'
    } else if (busy || matchingSuppressedNow()) {
      message = 'Listen to the reference, then sing when the cue ends.'
    } else if (micStatus === 'error') {
      message = 'Microphone needs attention. Check it, then start the microphone again.'
    } else if (micStatus === 'starting') {
      message = 'Starting the microphone…'
    } else if (micStatus === 'off') {
      message = 'Start the microphone, then sing the note when you are ready.'
    } else {
      const pitchLabel = current.kind === 'note' ? current.occurrence.pitchName : null
      message = (noticeRef.current?.key === currentKey ? noticeRef.current.message : null)
        ?? (voiceFeedbackRef.current?.key === currentKey ? voiceFeedbackRef.current.message : null)
        ?? `Sing ${pitchLabel ?? 'the current note'} when you are ready.`
    }

    return {
      title: state.phrase.title,
      position: current.kind === 'complete' ? state.phrase.occurrences.length : Math.min(total, state.cursor + 1),
      total,
      kind: current.kind === 'cancelled' ? 'complete' : current.kind,
      // EAR challenges must not reveal the target in the large heading.
      noteLabel: current.kind === 'unsupported'
        ? current.occurrence.pitchName
        : current.kind === 'note' && state.lane === 'voice'
          ? current.occurrence.pitchName
          : null,
      message,
      progress01,
      assisted: state.summary.assisted,
      micStatus,
      busy,
      canAnswer,
      answerOptions: state.lane === 'ear' && current.kind === 'note'
        ? Object.freeze(state.admittedNotes.filter(note => PITCHFORKS_RANGE_NOTES.includes(note)))
        : Object.freeze([] as string[]),
      pendingSave,
      needsRetry,
    }
  }, [audioBusy, matchingSuppressedNow, micStartPending, paused, practiceState, props.microphone])

  const panelProps: PitchforksSongcraftConnectedPanelProps = {
    songs: songs.map((phrase): PitchforksSongcraftSong => ({ sourceKey: phrase.sourceKey, title: phrase.title, source: phrase.provenance.source })),
    selectedKey,
    onSelect: selectSong,
    lane,
    onLaneChange: changeLane,
    onBegin: beginPractice,
    view,
    onStartMic: startMic,
    onHear: hear,
    onHint: hint,
    onAnswer: answer,
    onAcknowledge: acknowledge,
    onRetrySave: retrySave,
    onRetryNote: retryNote,
    onReturn: returnToMenu,
    paused,
    hasNextSong: nextPitchforksSongcraftSourceKey(songs, selectedKey) !== null,
    onTogglePause: togglePause,
    onReplayPhrase: replayPhrase,
    onNextSong: nextSong,
  }

  if (tempoEncore && practiceState) return <Suspense fallback={<main className="fixed inset-0 overflow-y-auto bg-[#070914] p-4 text-white"><p className="mx-auto max-w-2xl rounded-2xl border border-amber-400/40 bg-slate-950 p-4">Loading optional Tempo Encore…</p></main>}>
    <PitchforksTempoEncore
      completedPractice={practiceState}
      masteryProjection={props.masteryProjection}
      admittedNotes={props.admittedNotes}
      microphone={props.microphone}
      matchingSuppressed={props.matchingSuppressed}
      onReturnUntimed={() => setTempoEncore(false)}
    />
  </Suspense>

  const encoreEligible = practiceState && canEnterTempoEncore(practiceState.phrase, practiceState, props.masteryProjection)
  if (!encoreEligible) return <PitchforksSongcraftPanel {...panelProps} />
  return <div className="fixed inset-0 overflow-y-auto bg-[#070914] [&>main]:static">
    <PitchforksSongcraftPanel {...panelProps} />
    {practiceState && canEnterTempoEncore(practiceState.phrase, practiceState, props.masteryProjection) && <div className="mx-auto max-w-2xl p-4 text-center">
      <button type="button" onClick={() => {
        if (!canEnterTempoEncore(practiceState.phrase, practiceState, propsRef.current.masteryProjection)) return
        cancelVoiceLoop()
        clearCueTimers()
        clearHold()
        setTempoEncore(true)
      }} className="rounded-lg border border-amber-300 bg-slate-950 px-5 py-3 text-amber-100">Try optional Tempo Encore</button>
    </div>}
  </div>
}

export default PitchforksSongcraft
