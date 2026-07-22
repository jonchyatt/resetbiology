'use client'

// Sibling of RetroBlaster v1. R0 view-seam build.
// Rail: data/retro-blaster-rework/VANGUARD-SPEC-R0-view-seam.md

import { useState, useRef, useCallback, useEffect } from 'react'
import { flushSync } from 'react-dom'
import {
  NOTE_COLORS, createNote,
  type NoteMemory,
} from '@/lib/fsrs'
import {
  FSRS_EAR_KEY, FSRS_VOICE_KEY,
  gradeEar, gradeVoice, loadStore, saveStore,
} from '@/lib/fsrsFamily'
import { INTRO_ORDER } from './types'
import {
  RETRO_CURRICULUM_KEY,
  commitRetroCurriculum,
  commitRetroCurriculumExtension,
  resolveRetroCurriculumSession,
  type RetroCurriculumExtensionFields,
} from './retroBlasterCurriculum'
import { noteToFreq, octaveFoldedCents } from './pitchMath'
import {
  RETRO_PACES,
  manualRetroPlacement,
  placeRetroPace,
  placementExtensionPatch,
  placementForLane,
  resolveRetroPlayPace,
  retroPaceConfig,
  type RetroPace,
  type RetroPlacementLane,
  type RetroPlacementSummary,
  type RetroPlacementTrial,
} from './retroBlasterPlacement'
import { usePitchDetection } from './usePitchDetection'
import { getPianoReadiness, initAudio, loadPianoSamples, playPianoNote } from './audioEngine'
import {
  H, MIC_CONFIDENCE_FLOOR, STARTING_SHIELDS, W,
  beginWave, createInitialState, isTargetableAlien, noteButtonRects, noteForKeyboardInput, requestFullCueHelp,
  resetOrdinaryCueSupport, tick, toViewState,
  type BlindStimulusAck, type CeremonyToneAck, type CurriculumUnlockAck, type Difficulty, type EngineEvent, type GameState, type InputMode,
  type PendingAttackAnswer, type Phase, type PianoReadinessObservation, type ViewState,
} from './retroBlasterEngine'
import {
  advanceMicVfxFreshness,
  deriveMicLockSignalActive,
  enemyRenderSourceSnapshot,
  render,
  resetEnemyRenderLatches,
  type MicVfxFreshnessState,
} from './retroBlasterRenderer'

const TUTORIAL_KEY = 'retro_tutorial_v2_seen'
const RETRO_DIFFICULTY_KEY = 'retro_difficulty'
const CRT_KEY = 'retro_blaster_crt'
const COLOR_HINTS_KEY = 'retro_blaster_color_hints'
const RADIO_CHECK_NOTE = INTRO_ORDER[0]
const FIRST_SESSION_ROSTER = INTRO_ORDER.slice(0, 2)
const PLACEMENT_SEQUENCE = ['C4', 'A4', 'A4', 'C4'] as const

type ShellPhase = Phase | 'readiness' | 'practice' | 'placement'
type ReadinessStatus =
  | 'idle'
  | 'loading-audio'
  | 'playing-audio'
  | 'awaiting-ear'
  | 'awaiting-map'
  | 'audio-error'
  | 'starting-mic'
  | 'awaiting-voice'
  | 'voice-error'

function placementLane(inputMode: InputMode): RetroPlacementLane {
  return inputMode === 'mic' ? 'voice' : 'ear'
}

interface RetroAudioReceipt {
  sequence: number
  kind: 'piano' | 'sfx'
  note: string | null
  guard: string
  requestId: string | null
  gameId: string | null
  attackId: string | null
  ceremonyId: string | null
  terminalAlreadyRecorded: boolean
}

function clearRetroAudioReceipt(canvas: HTMLCanvasElement | null): void {
  delete document.documentElement.dataset.retroAudioReceipt
  if (canvas) delete canvas.dataset.retroAudioReceipt
}

type PendingSafeTryAudioReceipt = Omit<RetroAudioReceipt, 'sequence'>

function flushPendingSafeTryAudioReceipt(
  pending: { current: PendingSafeTryAudioReceipt | null },
  publish: (receipt: PendingSafeTryAudioReceipt) => void,
): boolean {
  const receipt = pending.current
  if (!receipt) return false
  pending.current = null
  publish(receipt) // publish-after-reveal
  return true
}

function discardPendingSafeTryAudioReceipt(
  pending: { current: PendingSafeTryAudioReceipt | null },
): void {
  pending.current = null
}

export interface RetroBlasterFamilyStores {
  voice: Record<string, NoteMemory>
  ear: Record<string, NoteMemory>
}

export function loadRetroBlasterFamilyStores(): RetroBlasterFamilyStores {
  return {
    voice: loadStore(FSRS_VOICE_KEY),
    ear: loadStore(FSRS_EAR_KEY),
  }
}

export function activeLaneStore(
  stores: RetroBlasterFamilyStores,
  inputMode: InputMode,
): Record<string, NoteMemory> {
  return inputMode === 'mic' ? stores.voice : stores.ear
}

/** Apply the persistence-bearing part of the real engine-event shell seam. */
export function applyRetroBlasterFamilyEvent(
  event: EngineEvent,
  inputMode: InputMode,
  stores: RetroBlasterFamilyStores,
): boolean {
  const eventInputMode = event.kind === 'grade' || event.kind === 'unlock'
    ? event.inputMode
    : inputMode
  const store = activeLaneStore(stores, eventInputMode)
  const key = eventInputMode === 'mic' ? FSRS_VOICE_KEY : FSRS_EAR_KEY

  if (event.kind === 'grade') {
    if (eventInputMode === 'mic') gradeVoice(store, event.note, event.correct, event.latencyMs)
    else gradeEar(store, event.note, event.correct, event.latencyMs)
    saveStore(key, store)
    return true
  }
  if (event.kind === 'unlock') {
    if (!store[event.note]) store[event.note] = createNote(event.note)
    return true
  }
  return false
}

export function buildRetroBlasterState(
  difficulty: Difficulty,
  inputMode: InputMode,
  stores: RetroBlasterFamilyStores,
  sessionRoster: readonly string[],
  clockMs: number,
  gameId = `fixture:${clockMs}`,
  memoryEpochMs = 0,
  pace: RetroPace | null = null,
): GameState {
  const store = activeLaneStore(stores, inputMode)
  const unlocked = [...sessionRoster]
  for (const note of unlocked) {
    if (!store[note]) store[note] = createNote(note)
  }
  const state = createInitialState(difficulty, unlocked, clockMs, gameId, pace)
  beginWave(state, store, memoryEpochMs)
  return state
}

let _sfxCtx: AudioContext | null = null
function sfxCtx(): AudioContext {
  if (!_sfxCtx) _sfxCtx = new AudioContext()
  if (_sfxCtx.state === 'suspended') _sfxCtx.resume()
  return _sfxCtx
}

function sfxShoot() {
  const c = sfxCtx(); const now = c.currentTime
  const o = c.createOscillator(); const g = c.createGain()
  o.type = 'square'; o.frequency.setValueAtTime(880, now)
  o.frequency.exponentialRampToValueAtTime(110, now + 0.1)
  g.gain.setValueAtTime(0.15, now); g.gain.linearRampToValueAtTime(0, now + 0.1)
  o.connect(g); g.connect(c.destination); o.start(now); o.stop(now + 0.1)
}

function sfxWrong() {
  const c = sfxCtx(); const now = c.currentTime
  const o = c.createOscillator(); const g = c.createGain()
  o.type = 'sawtooth'; o.frequency.setValueAtTime(150, now)
  o.frequency.linearRampToValueAtTime(80, now + 0.2)
  g.gain.setValueAtTime(0.12, now); g.gain.linearRampToValueAtTime(0, now + 0.2)
  o.connect(g); g.connect(c.destination); o.start(now); o.stop(now + 0.2)
}

function sfxExplosion() {
  const c = sfxCtx(); const now = c.currentTime
  const dur = 0.2; const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.max(0, 1 - i / data.length)
  const src = c.createBufferSource(); src.buffer = buf
  const g = c.createGain(); g.gain.setValueAtTime(0.15, now); g.gain.linearRampToValueAtTime(0, now + dur)
  src.connect(g); g.connect(c.destination); src.start(now)
}

export default function RetroBlasterII() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const lastCanvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<GameState | null>(null)
  const familyStoresRef = useRef<RetroBlasterFamilyStores>({ voice: {}, ear: {} })
  const rafRef = useRef(0)
  const lastTimeRef = useRef(0)
  const notePlayTimeRef = useRef(0)
  const pendingAnswerRef = useRef<PendingAttackAnswer | null>(null)
  const inputModeRef = useRef<InputMode>('click')
  const listeningRef = useRef(false)
  const colorHintsRef = useRef(true)
  const visibilityActiveRef = useRef(false)
  const focusActiveRef = useRef(false)
  const micVfxFreshnessRef = useRef<MicVfxFreshnessState>({
    lastGeneration: 0,
    hasObservedMicGeneration: false,
    staleGameFrames: 0,
  })
  const lastWeaponVfxDatasetRef = useRef('')
  const lastMicAuthorityDatasetRef = useRef('')
  const lastSoulDatasetRef = useRef('')
  const phaseRef = useRef<ShellPhase>('menu')
  const readinessIdRef = useRef(0)
  const readinessBusyRef = useRef(false)
  const readinessToneArmedRef = useRef(false)
  const readinessHeardConfirmedRef = useRef(false)
  const readinessVoiceHeardRef = useRef(false)
  const readinessGenerationBaselineRef = useRef(0)
  const activePaceRef = useRef<RetroPace>('cadet')
  const practiceToneArmedRef = useRef(false)
  const practiceHoldStartedRef = useRef(0)
  const placementSignalStartedAtRef = useRef(0)
  const placementSignalArmedRef = useRef(false)
  const placementHoldStartedRef = useRef(0)
  const placementWrongHoldStartedRef = useRef(0)
  const firstKillStartedAtRef = useRef(0)
  const pendingCeremonyToneAckRef = useRef<CeremonyToneAck | null>(null)
  const pendingBlindStimulusAckRef = useRef<BlindStimulusAck | null>(null)
  const pendingCurriculumUnlockAckRef = useRef<CurriculumUnlockAck | null>(null)
  const sessionRosterRef = useRef<string[]>(INTRO_ORDER.slice(0, 2))
  const curriculumSessionIdRef = useRef(0)
  const curriculumControllersRef = useRef(new Set<AbortController>())
  const lastDurableRosterRef = useRef<string[]>([])
  const lastCurriculumExtensionsRef = useRef<RetroCurriculumExtensionFields>({})
  const pianoObservationIdRef = useRef(0)
  const audioReceiptSequenceRef = useRef(0)
  const pendingSafeTryAudioReceiptRef = useRef<PendingSafeTryAudioReceipt | null>(null)
  const safeTryFocusRef = useRef<HTMLDivElement>(null)
  const previousAnswerMaskRef = useRef(false)
  const renderedAnswerMaskRef = useRef(false)
  const ceremonyAttemptIdRef = useRef(0)
  const ceremonyBusyRef = useRef(false)
  const bindCanvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas
    if (canvas) lastCanvasRef.current = canvas
  }, [])

  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  const reducedMotionRef = useRef(reducedMotion)
  const [phase, setPhase] = useState<ShellPhase>('menu')
  const [inputMode, setInputMode] = useState<InputMode>('click')
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [crtEnabled, setCrtEnabled] = useState(false)
  const [colorHints, setColorHints] = useState(true)
  const [displayView, setDisplayView] = useState<ViewState | null>(null)
  const [finalStats, setFinalStats] = useState({ score: 0, wave: 0, maxCombo: 0 })
  const [readinessStatus, setReadinessStatus] = useState<ReadinessStatus>('idle')
  const [readinessMessage, setReadinessMessage] = useState('')
  const [readinessToneArmed, setReadinessToneArmed] = useState(false)
  const [readinessHeardConfirmed, setReadinessHeardConfirmed] = useState(false)
  const [readinessVoiceHeard, setReadinessVoiceHeard] = useState(false)
  const [ceremonyMessage, setCeremonyMessage] = useState('')
  const [, setSessionRoster] = useState<string[]>(() => INTRO_ORDER.slice(0, 2))
  const [curriculumSavePaused, setCurriculumSavePaused] = useState(false)
  const [savedPlacement, setSavedPlacement] = useState<RetroPlacementSummary | null>(null)
  const [activePace, setActivePace] = useState<RetroPace>('cadet')
  const [practiceStage, setPracticeStage] = useState<'listen' | 'answer' | 'success'>('listen')
  const [practiceMessage, setPracticeMessage] = useState('STEP 1 - PLAY THE C SIGNAL.')
  const [placementTrialIndex, setPlacementTrialIndex] = useState(0)
  const [placementAttempt, setPlacementAttempt] = useState(0)
  const [placementSignalArmed, setPlacementSignalArmed] = useState(false)
  const [placementTrials, setPlacementTrials] = useState<RetroPlacementTrial[]>([])
  const [placementMessage, setPlacementMessage] = useState('PRESS PLAY WHEN YOU ARE READY. THERE IS NO TIMER.')
  const [placementResult, setPlacementResult] = useState<RetroPlacementSummary | null>(null)

  const {
    isListening,
    pitch,
    error: micError,
    startListening,
    stopListening,
    pitchRef: livePitchRef,
    micSourceHealthRef,
    pitchGenerationRef,
  } = usePitchDetection({ noiseGateDb: -45 })

  const abortCurriculumSession = useCallback(() => {
    curriculumSessionIdRef.current++
    for (const controller of curriculumControllersRef.current) controller.abort()
    curriculumControllersRef.current.clear()
    pendingCurriculumUnlockAckRef.current = null
  }, [])

  const runCurriculumCommit = useCallback((
    sessionCandidateRoster: readonly string[],
    purpose: 'initial' | 'unlock',
    request: Extract<EngineEvent, { kind: 'curriculumUnlockRequest' }> | null,
    sessionId: number,
  ) => {
    const controller = new AbortController()
    curriculumControllersRef.current.add(controller)
    const locks = typeof navigator !== 'undefined' && 'locks' in navigator
      ? navigator.locks
      : undefined
    const exactLiveRequest = () => {
      if (!request || curriculumSessionIdRef.current !== sessionId) return false
      const pending = stateRef.current?.pendingCurriculumUnlock
      return Boolean(pending && pending.requestId === request.requestId && pending.gameId === request.gameId &&
        pending.note === request.note &&
        pending.sessionCandidateRoster.length === request.sessionCandidateRoster.length &&
        pending.sessionCandidateRoster.every((note, index) => note === request.sessionCandidateRoster[index]))
    }
    const queueAck = (committed: boolean) => {
      if (!request || !exactLiveRequest()) return
      pendingCurriculumUnlockAckRef.current = {
        requestId: request.requestId,
        gameId: request.gameId,
        note: request.note,
        sessionCandidateRoster: [...request.sessionCandidateRoster],
        committed,
      }
    }

    void commitRetroCurriculum({
      storage: localStorage,
      locks,
      signal: controller.signal,
      sessionCandidateRoster,
      getLastDurableRoster: () => lastDurableRosterRef.current,
      getLastExtensionFields: () => lastCurriculumExtensionsRef.current,
    }).then(result => {
      if (curriculumSessionIdRef.current !== sessionId) return
      if (result.ok) {
        lastDurableRosterRef.current = [...result.durableRoster]
        lastCurriculumExtensionsRef.current = { ...result.extensionFields }
        if (purpose === 'unlock') setCurriculumSavePaused(false)
      }
      if (purpose === 'unlock') queueAck(result.ok)
    }).catch(error => {
      if ((error as { name?: unknown } | null)?.name === 'AbortError') return
      if (purpose === 'unlock') queueAck(false)
    }).finally(() => {
      curriculumControllersRef.current.delete(controller)
    })
  }, [])

  const runPlacementCommit = useCallback(async (
    summary: RetroPlacementSummary,
    lane = placementLane(inputModeRef.current),
  ): Promise<boolean> => {
    const controller = new AbortController()
    curriculumControllersRef.current.add(controller)
    const locks = typeof navigator !== 'undefined' && 'locks' in navigator
      ? navigator.locks
      : undefined
    const extensionPatch = placementExtensionPatch(lastCurriculumExtensionsRef.current, lane, summary)
    try {
      const result = await commitRetroCurriculumExtension({
        storage: localStorage,
        locks,
        signal: controller.signal,
        extensionPatch,
        getLastDurableRoster: () => lastDurableRosterRef.current.length > 0
          ? lastDurableRosterRef.current
          : FIRST_SESSION_ROSTER,
        getLastExtensionFields: () => lastCurriculumExtensionsRef.current,
      })
      if (!result.ok) return false
      lastDurableRosterRef.current = [...result.durableRoster]
      lastCurriculumExtensionsRef.current = { ...result.extensionFields }
      if (lane === placementLane(inputModeRef.current)) setSavedPlacement(summary)
      return true
    } catch (error) {
      if ((error as { name?: unknown } | null)?.name === 'AbortError') return false
      return false
    } finally {
      curriculumControllersRef.current.delete(controller)
    }
  }, [])

  useEffect(() => { inputModeRef.current = inputMode }, [inputMode])
  useEffect(() => {
    const placement = placementForLane(lastCurriculumExtensionsRef.current, placementLane(inputMode))
    setSavedPlacement(placement)
    const nextPace = placement?.pace ?? 'cadet'
    activePaceRef.current = nextPace
    setActivePace(nextPace)
  }, [inputMode])
  useEffect(() => { listeningRef.current = isListening }, [isListening])
  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { activePaceRef.current = activePace }, [activePace])
  useEffect(() => () => {
    ++readinessIdRef.current
    readinessBusyRef.current = false
    readinessToneArmedRef.current = false
    ++ceremonyAttemptIdRef.current
    ceremonyBusyRef.current = false
    pendingCeremonyToneAckRef.current = null
    pendingBlindStimulusAckRef.current = null
    abortCurriculumSession()
    discardPendingSafeTryAudioReceipt(pendingSafeTryAudioReceiptRef)
    clearRetroAudioReceipt(lastCanvasRef.current)
    lastCanvasRef.current = null
  }, [abortCurriculumSession])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncReducedMotion = (matches: boolean) => {
      reducedMotionRef.current = matches
      setReducedMotion(matches)
    }
    const onChange = (event: MediaQueryListEvent) => syncReducedMotion(event.matches)
    syncReducedMotion(mediaQuery.matches)
    mediaQuery.addEventListener('change', onChange)
    return () => mediaQuery.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const stores = loadRetroBlasterFamilyStores()
    familyStoresRef.current = stores
    let initialCrt = window.innerWidth >= 768
    try {
      const d = localStorage.getItem(RETRO_DIFFICULTY_KEY)
      if (d === 'easy' || d === 'true') setDifficulty(d)
      const savedCrt = localStorage.getItem(CRT_KEY)
      if (savedCrt !== null) initialCrt = savedCrt === '1'
      const savedColorHints = localStorage.getItem(COLOR_HINTS_KEY)
      if (savedColorHints !== null) {
        const enabled = savedColorHints === '1'
        colorHintsRef.current = enabled
        setColorHints(enabled)
      }
      const resolution = resolveRetroCurriculumSession(
        localStorage.getItem(RETRO_CURRICULUM_KEY),
        activeLaneStore(stores, 'click'),
      )
      sessionRosterRef.current = [...resolution.sessionRoster]
      setSessionRoster([...resolution.sessionRoster])
      lastDurableRosterRef.current = [...resolution.durableRoster]
      lastCurriculumExtensionsRef.current = { ...resolution.extensionFields }
      const placement = placementForLane(resolution.extensionFields, 'ear')
      setSavedPlacement(placement)
      const initialPace = placement?.pace ?? 'cadet'
      activePaceRef.current = initialPace
      setActivePace(initialPace)
    } catch {}
    setCrtEnabled(initialCrt)
    loadPianoSamples()
  }, [])

  const writeAudioReceipt = useCallback((receipt: Omit<RetroAudioReceipt, 'sequence'>) => {
    const value: RetroAudioReceipt = {
      sequence: ++audioReceiptSequenceRef.current,
      ...receipt,
    }
    const encoded = JSON.stringify(value)
    document.documentElement.dataset.retroAudioReceipt = encoded
    const canvas = canvasRef.current
    if (canvas) canvas.dataset.retroAudioReceipt = encoded
  }, [])

  const revealSafeTryForLifecycle = useCallback(() => {
    const state = stateRef.current
    if (!state || !resetOrdinaryCueSupport(state)) return false
    flushSync(() => setDisplayView(toViewState(state, inputModeRef.current, colorHintsRef.current)))
    renderedAnswerMaskRef.current = false
    flushPendingSafeTryAudioReceipt(pendingSafeTryAudioReceiptRef, writeAudioReceipt)
    return true
  }, [writeAudioReceipt])

  useEffect(() => {
    const syncActivity = () => {
      visibilityActiveRef.current = document.visibilityState === 'visible'
      focusActiveRef.current = document.hasFocus()
      if (!visibilityActiveRef.current || !focusActiveRef.current) revealSafeTryForLifecycle()
      if (visibilityActiveRef.current && focusActiveRef.current) {
        lastTimeRef.current = performance.now()
        if (stateRef.current?.phase === 'ceremony') setCeremonyMessage('')
      } else if (phaseRef.current === 'readiness' && inputModeRef.current === 'click') {
        readinessToneArmedRef.current = false
        setReadinessToneArmed(false)
        setReadinessMessage('SIGNAL PAUSED - return here, then replay C.')
      } else {
        const activeCeremony = stateRef.current?.introductionCeremony
        if (activeCeremony?.toneStatus === 'pending') {
          pendingCeremonyToneAckRef.current = {
            ceremonyId: activeCeremony.ceremonyId,
            note: activeCeremony.note,
            dispatched: false,
          }
          setCeremonyMessage('SIGNAL PAUSED - RETURN HERE, THEN RETRY OR REPLAY.')
        }
      }
    }
    const resetForViewportChange = () => { revealSafeTryForLifecycle() }
    syncActivity()
    document.addEventListener('visibilitychange', syncActivity)
    window.addEventListener('focus', syncActivity)
    window.addEventListener('blur', syncActivity)
    window.addEventListener('resize', resetForViewportChange)
    window.addEventListener('orientationchange', resetForViewportChange)
    return () => {
      document.removeEventListener('visibilitychange', syncActivity)
      window.removeEventListener('focus', syncActivity)
      window.removeEventListener('blur', syncActivity)
      window.removeEventListener('resize', resetForViewportChange)
      window.removeEventListener('orientationchange', resetForViewportChange)
    }
  }, [revealSafeTryForLifecycle])

  const dispatchCeremonyTone = useCallback((ceremonyId: string, note: string) => {
    const live = stateRef.current?.introductionCeremony
    if (!live || live.ceremonyId !== ceremonyId || live.note !== note) return false
    const active = document.visibilityState === 'visible' && document.hasFocus()
    const readiness = getPianoReadiness(note)
    const dispatched = active && readiness.sampleReady && readiness.contextState === 'running'
    if (dispatched) {
      writeAudioReceipt({
        kind: 'piano', note, guard: 'ceremony', requestId: null,
        gameId: stateRef.current?.gameId ?? null, attackId: null, ceremonyId,
        terminalAlreadyRecorded: false,
      })
      playPianoNote(note)
      setCeremonyMessage('REFERENCE SENT - NEXT WAVE READY.')
    } else {
      setCeremonyMessage('SIGNAL PATH NOT READY - RETRY SIGNAL.')
    }
    pendingCeremonyToneAckRef.current = { ceremonyId, note, dispatched }
    return dispatched
  }, [writeAudioReceipt])

  const applyEvents = useCallback((events: EngineEvent[], gs: GameState) => {
    for (const event of events) {
      if (applyRetroBlasterFamilyEvent(event, inputModeRef.current, familyStoresRef.current)) continue
      if (event.kind === 'curriculumUnlockRequest') {
        runCurriculumCommit(
          event.sessionCandidateRoster,
          'unlock',
          event,
          curriculumSessionIdRef.current,
        )
      } else if (event.kind === 'curriculumSaveBlocked') {
        setCurriculumSavePaused(true)
      } else if (event.kind === 'sfx') {
        writeAudioReceipt({
          kind: 'sfx', note: null, guard: event.name, requestId: null,
          gameId: gs.gameId, attackId: gs.activeAttack?.attackId ?? null, ceremonyId: null,
          terminalAlreadyRecorded: true,
        })
        if (event.name === 'shoot') sfxShoot()
        else if (event.name === 'wrong') sfxWrong()
        else sfxExplosion()
      } else if (event.kind === 'playNote') {
        setTimeout(() => {
          const cur = stateRef.current
          if (!cur) return
          if (event.guard === 'attack') {
            const attack = cur.activeAttack
            const alien = cur.aliens.find(item => item.alienId === event.targetAlienId)
            if (!attack || attack.attackId !== event.attackId ||
                attack.alienId !== event.targetAlienId || !isTargetableAlien(alien)) return
          }
          const liveAttack = cur.activeAttack
          const receipt: PendingSafeTryAudioReceipt = {
            kind: 'piano', note: event.note, guard: event.guard, requestId: null,
            gameId: cur.gameId, attackId: event.attackId, ceremonyId: null,
            terminalAlreadyRecorded: event.terminalAlreadyRecorded || Boolean(liveAttack?.outcome),
          }
          const deferForSafeTry = liveAttack?.cuePolicy === 'safe-try' &&
            liveAttack.attackId === event.attackId && liveAttack.outcome === null
          if (deferForSafeTry) {
            pendingSafeTryAudioReceiptRef.current = receipt // defer-safe-try-receipt
          } else {
            writeAudioReceipt(receipt)
          }
          playPianoNote(event.note)
          if (event.guard === 'attack') notePlayTimeRef.current = Date.now()
        }, event.delayMs)
      } else if (event.kind === 'blindStimulusRequest') {
        const cur = stateRef.current
        const attack = cur?.activeAttack
        const target = cur?.aliens.find(item => item.alienId === event.alienId)
        const request = attack?.stimulusRequest
        const active = document.visibilityState === 'visible' && document.hasFocus()
        const readiness = getPianoReadiness(event.note)
        const exactLiveTuple = Boolean(cur && attack && request &&
          cur.gameId === event.gameId && attack.attackId === event.attackId &&
          attack.alienId === event.alienId && attack.note === event.note &&
          attack.phase === 'awaiting-stimulus' && attack.outcome === null &&
          request.requestId === event.requestId &&
          request.requestedAtDirectorClockMs === event.requestedAtDirectorClockMs &&
          isTargetableAlien(target))
        const dispatched = exactLiveTuple && active && readiness.sampleReady && readiness.contextState === 'running'
        if (dispatched) {
          writeAudioReceipt({
            kind: 'piano', note: event.note, guard: 'blind-stimulus', requestId: event.requestId,
            gameId: event.gameId, attackId: event.attackId, ceremonyId: null,
            terminalAlreadyRecorded: false,
          })
          playPianoNote(event.note)
          notePlayTimeRef.current = Date.now()
        }
        pendingBlindStimulusAckRef.current = {
          requestId: event.requestId,
          gameId: event.gameId,
          attackId: event.attackId,
          alienId: event.alienId,
          note: event.note,
          requestedAtDirectorClockMs: event.requestedAtDirectorClockMs,
          dispatched,
          dispatchedAtDirectorClockMs: event.requestedAtDirectorClockMs,
        }
      } else if (event.kind === 'ceremonyToneRequest') {
        setCeremonyMessage('REFERENCE SIGNAL PENDING...')
        dispatchCeremonyTone(event.ceremonyId, event.note)
      } else if (event.kind === 'paceAdjusted') {
        activePaceRef.current = event.to
        setActivePace(event.to)
      } else if (event.kind === 'gameOver') {
        abortCurriculumSession()
        setFinalStats({ score: gs.score, wave: gs.wave, maxCombo: gs.maxCombo })
        if (inputModeRef.current === 'mic') stopListening()
        setPhase('game_over')
      }
    }
  }, [abortCurriculumSession, dispatchCeremonyTone, runCurriculumCommit, stopListening, writeAudioReceipt])

  const gameLoop = useCallback((now: number) => {
    const gs = stateRef.current
    if (!gs) return
    const wasCeremony = gs.phase === 'ceremony'
    const dtMs = Math.max(0, now - lastTimeRef.current)
    lastTimeRef.current = now
    const pendingAnswer = pendingAnswerRef.current
    pendingAnswerRef.current = null
    const memoryEpochMs = Date.now()
    const latencyMs = notePlayTimeRef.current > 0 ? memoryEpochMs - notePlayTimeRef.current : 2000
    const laneStore = activeLaneStore(familyStoresRef.current, inputModeRef.current)
    const capturedPitch = livePitchRef.current
    const capturedMicSourceHealth = micSourceHealthRef.current
    const capturedPitchGeneration = pitchGenerationRef.current
    const micSourceEligible = inputModeRef.current === 'mic' &&
      listeningRef.current &&
      visibilityActiveRef.current &&
      capturedMicSourceHealth.audioContextState === 'running' &&
      capturedMicSourceHealth.trackReadyState === 'live' &&
      capturedMicSourceHealth.trackMuted === false
    const freshness = advanceMicVfxFreshness(
      micVfxFreshnessRef.current,
      capturedPitchGeneration,
      micSourceEligible,
    )
    micVfxFreshnessRef.current = freshness.state
    const gameplayActive = visibilityActiveRef.current && focusActiveRef.current
    let pianoReadiness: PianoReadinessObservation | null = null
    if (gameplayActive && gs.phase === 'playing') {
      const readinessRows = gs.unlockedNotes.map(note => [note, getPianoReadiness(note)] as const)
      pianoReadiness = {
        observationId: ++pianoObservationIdRef.current,
        contextState: readinessRows[0]?.[1].contextState ?? 'uninitialized',
        sampleReadyByNote: Object.fromEntries(
          readinessRows.map(([note, readiness]) => [note, readiness.sampleReady]),
        ),
      }
    }
    const ceremonyToneAck = gameplayActive ? pendingCeremonyToneAckRef.current : null
    if (gameplayActive) pendingCeremonyToneAckRef.current = null
    const blindStimulusAck = gameplayActive ? pendingBlindStimulusAckRef.current : null
    if (gameplayActive) pendingBlindStimulusAckRef.current = null
    const curriculumUnlockAck = gameplayActive ? pendingCurriculumUnlockAckRef.current : null
    if (gameplayActive) pendingCurriculumUnlockAckRef.current = null
    const voiceHealthy = inputModeRef.current === 'mic' &&
      listeningRef.current &&
      gameplayActive &&
      capturedMicSourceHealth.audioContextState === 'running' &&
      capturedMicSourceHealth.trackReadyState === 'live' &&
      capturedMicSourceHealth.trackMuted === false &&
      freshness.hasFreshGeneration
    const voiceHeard = capturedPitch?.isActive === true &&
      capturedPitch.confidence >= MIC_CONFIDENCE_FLOOR &&
      capturedPitch.frequency > 0
    const result = tick(gs, {
      inputMode: inputModeRef.current,
      isListening: listeningRef.current,
      reducedMotion: reducedMotionRef.current,
      pitch: capturedPitch,
      pendingAnswer,
      latencyMs,
      fsrs: laneStore,
      isActive: gameplayActive,
      memoryEpochMs,
      voiceTimeoutObservation: { healthy: voiceHealthy, heard: voiceHeard },
      ceremonyToneAck,
      pianoReadiness,
      blindStimulusAck,
      curriculumUnlockAck,
      colorHints: colorHintsRef.current,
    }, dtMs, Math.random)
    stateRef.current = result.state
    if (result.viewState.answerMaskActive && !renderedAnswerMaskRef.current) {
      // A previous guided tone can be the same note as this safe try. Scrub its
      // public receipt before the first masked frame; the new receipt stays in
      // pendingSafeTryAudioReceiptRef until reveal.
      clearRetroAudioReceipt(canvasRef.current)
    }
    const micLockSignalActive = deriveMicLockSignalActive({
      inputMode: inputModeRef.current,
      isListening: listeningRef.current,
      isVisible: visibilityActiveRef.current,
      targetNote: result.viewState.charge.targetNote,
      micSourceHealth: capturedMicSourceHealth,
      hasFreshGeneration: freshness.hasFreshGeneration,
      pitch: capturedPitch,
    })
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) {
      ctx.imageSmoothingEnabled = false
      const weaponVfx = render(ctx, result.viewState, {
        reducedMotion: reducedMotionRef.current,
        colorHints: colorHintsRef.current,
        micLockSignalActive,
      })
      const weaponVfxDataset = JSON.stringify(weaponVfx)
      if (weaponVfxDataset !== lastWeaponVfxDatasetRef.current) {
        canvas.dataset.retroWeaponVfx = weaponVfxDataset
        lastWeaponVfxDatasetRef.current = weaponVfxDataset
      }
      const micAuthorityDataset = JSON.stringify({
        isListening: listeningRef.current,
        isVisible: visibilityActiveRef.current,
        audioContextState: capturedMicSourceHealth.audioContextState,
        trackReadyState: capturedMicSourceHealth.trackReadyState,
        trackMuted: capturedMicSourceHealth.trackMuted,
        generation: capturedPitchGeneration,
        staleGameFrames: freshness.state.staleGameFrames,
        hasFreshGeneration: freshness.hasFreshGeneration,
        signalActive: micLockSignalActive,
      })
      if (micAuthorityDataset !== lastMicAuthorityDatasetRef.current) {
        canvas.dataset.retroMicAuthority = micAuthorityDataset
        lastMicAuthorityDatasetRef.current = micAuthorityDataset
      }
      canvas.dataset.retroRenderSources = JSON.stringify(
        result.viewState.answerMaskActive ? [] : enemyRenderSourceSnapshot(),
      )
      canvas.dataset.retroSignalCheck = JSON.stringify(result.viewState.signalCheck)
      canvas.dataset.retroIdentityMask = result.viewState.identityMaskActive ? 'active' : 'inactive'
      canvas.dataset.retroSupportMode = result.viewState.supportMode
      canvas.dataset.retroAnswerMask = result.viewState.answerMaskActive ? 'active' : 'inactive'
      canvas.dataset.retroFormationState = JSON.stringify({
        phase: result.viewState.phase,
        wave: result.viewState.hud.wave,
        directorClockMs: result.viewState.nowMs,
        gameId: result.viewState.answerMaskActive ? null : result.state.gameId,
        introductionCeremony: result.viewState.introductionCeremony,
        pendingIntroductions: result.viewState.answerMaskActive ? [] : result.state.pendingIntroductions,
        activeAttack: result.viewState.activeAttack,
        requiredAnswerEventsMs: result.viewState.requiredAnswerEventsMs,
        lastCompletedWavePacing: result.viewState.lastCompletedWavePacing,
        ships: result.viewState.aliens.map(alien => ({
          alienId: alien.alienId,
          visualId: alien.visualId,
          slot: alien.formationSlot,
          x: alien.x,
          y: alien.y,
          formationX: alien.formationX,
          formationY: alien.formationY,
          entering: alien.entering,
          alive: alien.alive,
          flightState: result.viewState.activeAttack?.alienId === alien.alienId
            ? result.viewState.activeAttack.phase
            : 'formation',
        })),
      })
      const soulDataset = JSON.stringify(result.viewState.aliens.map(alien => ({
        alienId: alien.alienId,
        formationSlot: alien.formationSlot,
        soul: alien.soul,
        diveServiceCount: alien.diveServiceCount,
      })))
      if (soulDataset !== lastSoulDatasetRef.current) {
        canvas.dataset.retroSoulState = soulDataset
        lastSoulDatasetRef.current = soulDataset
      }
    }
    const revealsSafeTry = renderedAnswerMaskRef.current && !result.viewState.answerMaskActive
    if ((wasCeremony && result.state.phase === 'playing') || revealsSafeTry) {
      flushSync(() => setDisplayView(result.viewState))
    } else {
      setDisplayView(result.viewState)
    }
    renderedAnswerMaskRef.current = result.viewState.answerMaskActive
    if (!result.viewState.answerMaskActive) {
      // Covers answer/help, timeout, life loss, gameOver, and waveComplete after reveal.
      flushPendingSafeTryAudioReceipt(pendingSafeTryAudioReceiptRef, writeAudioReceipt)
    }
    applyEvents(result.events, result.state)
    if (result.state.phase === 'playing' || result.state.phase === 'ceremony') {
      rafRef.current = requestAnimationFrame(gameLoop)
    }
    else rafRef.current = 0
  }, [applyEvents, livePitchRef, micSourceHealthRef, pitchGenerationRef, writeAudioReceipt])

  const buildState = useCallback((): GameState => {
    return buildRetroBlasterState(
      difficulty,
      inputMode,
      familyStoresRef.current,
      sessionRosterRef.current,
      performance.now(),
      crypto.randomUUID(),
      Date.now(),
      activePaceRef.current,
    )
  }, [difficulty, inputMode])

  const prepareEarReadiness = useCallback(async (readinessId = readinessIdRef.current) => {
    if (readinessBusyRef.current || readinessId !== readinessIdRef.current) return
    readinessBusyRef.current = true
    readinessToneArmedRef.current = false
    setReadinessToneArmed(false)
    readinessHeardConfirmedRef.current = false
    setReadinessHeardConfirmed(false)
    setReadinessStatus('loading-audio')
    setReadinessMessage('TUNING THE C CHANNEL...')
    try {
      initAudio()
      await loadPianoSamples()
      if (readinessId !== readinessIdRef.current || phaseRef.current !== 'readiness') return
      const ready = getPianoReadiness(RADIO_CHECK_NOTE)
      const active = document.visibilityState === 'visible' && document.hasFocus()
      if (!active || !ready.sampleReady || ready.contextState !== 'running') {
        setReadinessStatus('audio-error')
        setReadinessMessage(!active
          ? 'SIGNAL PAUSED - focus this window and retry audio.'
          : 'SIGNAL PATH NOT READY - retry audio.')
        return
      }
      writeAudioReceipt({
        kind: 'piano', note: RADIO_CHECK_NOTE, guard: 'radio-check', requestId: null,
        gameId: null, attackId: null, ceremonyId: null, terminalAlreadyRecorded: false,
      })
      setReadinessStatus('playing-audio')
      setReadinessMessage('PLAYING TEST NOTE C...')
      playPianoNote(RADIO_CHECK_NOTE)
      await new Promise(resolve => window.setTimeout(resolve, 450))
      if (readinessId !== readinessIdRef.current || phaseRef.current !== 'readiness') return
      readinessToneArmedRef.current = true
      setReadinessToneArmed(true)
      setReadinessStatus('awaiting-ear')
      setReadinessMessage('DID YOU HEAR THE TEST NOTE C?')
    } catch {
      if (readinessId === readinessIdRef.current) {
        setReadinessStatus('audio-error')
        setReadinessMessage('SIGNAL PATH NOT READY - retry audio.')
      }
    } finally {
      if (readinessId === readinessIdRef.current) readinessBusyRef.current = false
    }
  }, [writeAudioReceipt])

  const replayEarReadiness = useCallback(() => {
    if (phaseRef.current !== 'readiness' || inputModeRef.current !== 'click') return
    if (readinessBusyRef.current) return
    const ready = getPianoReadiness(RADIO_CHECK_NOTE)
    const active = document.visibilityState === 'visible' && document.hasFocus()
    if (!active || !ready.sampleReady || ready.contextState !== 'running') {
      void prepareEarReadiness()
      return
    }
    readinessBusyRef.current = true
    writeAudioReceipt({
      kind: 'piano', note: RADIO_CHECK_NOTE, guard: 'radio-check-replay', requestId: null,
      gameId: null, attackId: null, ceremonyId: null, terminalAlreadyRecorded: false,
    })
    setReadinessStatus('playing-audio')
    setReadinessMessage('PLAYING TEST NOTE C...')
    playPianoNote(RADIO_CHECK_NOTE)
    readinessHeardConfirmedRef.current = false
    setReadinessHeardConfirmed(false)
    const readinessId = readinessIdRef.current
    window.setTimeout(() => {
      if (readinessId !== readinessIdRef.current || phaseRef.current !== 'readiness' || inputModeRef.current !== 'click') return
      readinessToneArmedRef.current = true
      setReadinessToneArmed(true)
      setReadinessStatus('awaiting-ear')
      setReadinessMessage('DID YOU HEAR THE TEST NOTE C?')
      readinessBusyRef.current = false
    }, 450)
  }, [prepareEarReadiness, writeAudioReceipt])

  const confirmEarReadiness = useCallback(() => {
    if (phaseRef.current !== 'readiness' || inputModeRef.current !== 'click' || !readinessToneArmedRef.current) return
    readinessHeardConfirmedRef.current = true
    setReadinessHeardConfirmed(true)
    setReadinessStatus('awaiting-map')
    setReadinessMessage('STEP 2 - PRESS C [1] TO PROVE THE CONTROL MAPPING.')
  }, [])

  const retryMissingEarSignal = useCallback(() => {
    if (phaseRef.current !== 'readiness' || inputModeRef.current !== 'click') return
    readinessBusyRef.current = false
    readinessToneArmedRef.current = false
    setReadinessToneArmed(false)
    readinessHeardConfirmedRef.current = false
    setReadinessHeardConfirmed(false)
    setReadinessMessage('NO SOUND CONFIRMED - RETRYING TEST NOTE C...')
    void prepareEarReadiness()
  }, [prepareEarReadiness])

  const prepareVoiceReadiness = useCallback(async (readinessId = readinessIdRef.current) => {
    if (readinessBusyRef.current || readinessId !== readinessIdRef.current) return
    readinessBusyRef.current = true
    readinessVoiceHeardRef.current = false
    setReadinessVoiceHeard(false)
    readinessGenerationBaselineRef.current = pitchGenerationRef.current
    setReadinessStatus('starting-mic')
    setReadinessMessage('OPENING VOICE CHANNEL...')
    try {
      if (listeningRef.current) stopListening()
      await startListening()
      if (readinessId !== readinessIdRef.current || phaseRef.current !== 'readiness') {
        stopListening()
        return
      }
      setReadinessStatus('awaiting-voice')
      setReadinessMessage('VOICE CHANNEL OPEN - hum or sing anything.')
    } catch {
      stopListening()
      if (readinessId === readinessIdRef.current) {
        setReadinessStatus('voice-error')
        setReadinessMessage('VOICE CHANNEL CLOSED - retry microphone.')
      }
    } finally {
      if (readinessId === readinessIdRef.current) readinessBusyRef.current = false
    }
  }, [pitchGenerationRef, startListening, stopListening])

  const enterReadiness = useCallback(() => {
    abortCurriculumSession()
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0 }
    if (listeningRef.current) stopListening()
    stateRef.current = null
    pendingAnswerRef.current = null
    pendingCeremonyToneAckRef.current = null
    pendingBlindStimulusAckRef.current = null
    discardPendingSafeTryAudioReceipt(pendingSafeTryAudioReceiptRef)
    clearRetroAudioReceipt(canvasRef.current)
    ++ceremonyAttemptIdRef.current
    ceremonyBusyRef.current = false
    setCeremonyMessage('')
    readinessBusyRef.current = false
    readinessToneArmedRef.current = false
    setReadinessToneArmed(false)
    readinessHeardConfirmedRef.current = false
    setReadinessHeardConfirmed(false)
    readinessVoiceHeardRef.current = false
    setReadinessVoiceHeard(false)
    practiceToneArmedRef.current = false
    practiceHoldStartedRef.current = 0
    placementSignalStartedAtRef.current = 0
    placementSignalArmedRef.current = false
    placementHoldStartedRef.current = 0
    setPracticeStage('listen')
    setPracticeMessage('STEP 1 - PLAY THE C SIGNAL.')
    setPlacementTrialIndex(0)
    setPlacementAttempt(0)
    setPlacementSignalArmed(false)
    setPlacementTrials([])
    setPlacementResult(null)
    setPlacementMessage('PRESS PLAY WHEN YOU ARE READY. THERE IS NO TIMER.')
    setCurriculumSavePaused(false)
    const stores = loadRetroBlasterFamilyStores()
    familyStoresRef.current = stores
    let rawPolicy: string | null = null
    try { rawPolicy = localStorage.getItem(RETRO_CURRICULUM_KEY) } catch {}
    const resolution = resolveRetroCurriculumSession(rawPolicy, activeLaneStore(stores, inputMode))
    sessionRosterRef.current = [...resolution.sessionRoster]
    setSessionRoster([...resolution.sessionRoster])
    lastDurableRosterRef.current = [...resolution.durableRoster]
    lastCurriculumExtensionsRef.current = { ...resolution.extensionFields }
    const placement = placementForLane(resolution.extensionFields, placementLane(inputMode))
    setSavedPlacement(placement)
    const nextPace = resolveRetroPlayPace(placement?.pace ?? 'cadet', difficulty)
    activePaceRef.current = nextPace
    setActivePace(nextPace)
    const curriculumSessionId = curriculumSessionIdRef.current
    if (resolution.needsWrite) {
      runCurriculumCommit(resolution.sessionRoster, 'initial', null, curriculumSessionId)
    }
    const readinessId = ++readinessIdRef.current
    phaseRef.current = 'readiness'
    setPhase('readiness')
    setReadinessStatus('idle')
    setReadinessMessage(inputMode === 'mic'
      ? 'STEP 1 - PRESS START MICROPHONE. WE WILL ONLY CHECK FOR A LIVE SIGNAL.'
      : 'STEP 1 - PRESS PLAY TEST NOTE C.')
    void readinessId
  }, [abortCurriculumSession, difficulty, inputMode, runCurriculumCommit, stopListening])

  const retryVoiceReadiness = useCallback(() => {
    if (phaseRef.current !== 'readiness' || inputModeRef.current !== 'mic') return
    readinessBusyRef.current = false
    const readinessId = ++readinessIdRef.current
    void prepareVoiceReadiness(readinessId)
  }, [prepareVoiceReadiness])

  const exitReadiness = useCallback(() => {
    abortCurriculumSession()
    ++readinessIdRef.current
    readinessBusyRef.current = false
    readinessToneArmedRef.current = false
    setReadinessToneArmed(false)
    readinessHeardConfirmedRef.current = false
    setReadinessHeardConfirmed(false)
    readinessVoiceHeardRef.current = false
    setReadinessVoiceHeard(false)
    setReadinessStatus('idle')
    setReadinessMessage('')
    pendingAnswerRef.current = null
    pendingCeremonyToneAckRef.current = null
    pendingBlindStimulusAckRef.current = null
    discardPendingSafeTryAudioReceipt(pendingSafeTryAudioReceiptRef)
    clearRetroAudioReceipt(canvasRef.current)
    ++ceremonyAttemptIdRef.current
    ceremonyBusyRef.current = false
    setCeremonyMessage('')
    stateRef.current = null
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0 }
    if (listeningRef.current || inputModeRef.current === 'mic') stopListening()
    phaseRef.current = 'menu'
    setPhase('menu')
  }, [abortCurriculumSession, stopListening])

  const startGame = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0 }
    resetEnemyRenderLatches()
    micVfxFreshnessRef.current = {
      lastGeneration: pitchGenerationRef.current,
      hasObservedMicGeneration: false,
      staleGameFrames: 0,
    }
    lastWeaponVfxDatasetRef.current = ''
    lastMicAuthorityDatasetRef.current = ''
    lastSoulDatasetRef.current = ''
    pendingCeremonyToneAckRef.current = null
    pendingBlindStimulusAckRef.current = null
    discardPendingSafeTryAudioReceipt(pendingSafeTryAudioReceiptRef)
    clearRetroAudioReceipt(canvasRef.current)
    pianoObservationIdRef.current = 0
    ++ceremonyAttemptIdRef.current
    ceremonyBusyRef.current = false
    setCeremonyMessage('')
    ++readinessIdRef.current
    readinessBusyRef.current = false
    readinessToneArmedRef.current = false
    setReadinessToneArmed(false)
    initAudio()
    if (inputMode === 'mic' && !listeningRef.current) startListening()
    const gs = buildState()
    stateRef.current = gs
    const view = toViewState(gs, inputMode, colorHintsRef.current)
    setDisplayView(view)
    phaseRef.current = 'playing'
    setPhase('playing')
    lastTimeRef.current = performance.now()
    rafRef.current = requestAnimationFrame(gameLoop)
  }, [inputMode, startListening, buildState, gameLoop, pitchGenerationRef])

  const advanceFromReadiness = useCallback(() => {
    firstKillStartedAtRef.current = performance.now()
    const placement = placementForLane(
      lastCurriculumExtensionsRef.current,
      placementLane(inputModeRef.current),
    )
    if (placement) {
      startGame()
      return
    }
    practiceToneArmedRef.current = false
    practiceHoldStartedRef.current = 0
    setPracticeStage('listen')
    setPracticeMessage(inputModeRef.current === 'mic'
      ? 'STEP 1 - LISTEN TO C. THEN SING AND HOLD THAT PITCH.'
      : 'STEP 1 - LISTEN TO C. THEN PRESS C [1].')
    phaseRef.current = 'practice'
    setPhase('practice')
  }, [startGame])

  const retryCeremonySignal = useCallback(async () => {
    const live = stateRef.current?.introductionCeremony
    if (!live || ceremonyBusyRef.current) return
    const attemptId = ++ceremonyAttemptIdRef.current
    const { ceremonyId, note } = live
    ceremonyBusyRef.current = true
    setCeremonyMessage('LOADING REFERENCE SIGNAL...')
    try {
      initAudio()
      await loadPianoSamples()
      const current = stateRef.current?.introductionCeremony
      if (attemptId !== ceremonyAttemptIdRef.current || !current ||
          current.ceremonyId !== ceremonyId || current.note !== note) return
      dispatchCeremonyTone(ceremonyId, note)
    } catch {
      const current = stateRef.current?.introductionCeremony
      if (attemptId === ceremonyAttemptIdRef.current && current?.ceremonyId === ceremonyId) {
        pendingCeremonyToneAckRef.current = { ceremonyId, note, dispatched: false }
        setCeremonyMessage('SIGNAL PATH NOT READY - RETRY SIGNAL.')
      }
    } finally {
      if (attemptId === ceremonyAttemptIdRef.current) ceremonyBusyRef.current = false
    }
  }, [dispatchCeremonyTone])

  const replayCeremonySignal = useCallback(() => {
    const live = stateRef.current?.introductionCeremony
    if (!live || ceremonyBusyRef.current) return
    dispatchCeremonyTone(live.ceremonyId, live.note)
  }, [dispatchCeremonyTone])

  const quitCeremony = useCallback(() => {
    const state = stateRef.current
    if (state?.phase !== 'ceremony') return
    abortCurriculumSession()
    ++ceremonyAttemptIdRef.current
    ceremonyBusyRef.current = false
    pendingCeremonyToneAckRef.current = null
    pendingAnswerRef.current = null
    pendingBlindStimulusAckRef.current = null
    discardPendingSafeTryAudioReceipt(pendingSafeTryAudioReceiptRef)
    clearRetroAudioReceipt(canvasRef.current)
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0 }
    if (listeningRef.current || inputModeRef.current === 'mic') stopListening()
    stateRef.current = null
    setDisplayView(null)
    setCeremonyMessage('')
    phaseRef.current = 'menu'
    setPhase('menu')
  }, [abortCurriculumSession, stopListening])

  const answerEarReadiness = useCallback((note: string) => {
    if (phaseRef.current !== 'readiness' || inputModeRef.current !== 'click') return
    if (!visibilityActiveRef.current || !focusActiveRef.current) {
      readinessToneArmedRef.current = false
      setReadinessToneArmed(false)
      setReadinessMessage('SIGNAL PAUSED - return here, then replay C.')
      return
    }
    if (!readinessToneArmedRef.current) {
      setReadinessMessage('PLAY SIGNAL C FIRST.')
      return
    }
    if (!readinessHeardConfirmedRef.current) {
      setReadinessMessage('FIRST TELL US WHETHER YOU HEARD C.')
      return
    }
    if (note !== RADIO_CHECK_NOTE) {
      setReadinessMessage('USE THE NAMED C [1] CONTROL - no score, just a radio check.')
      return
    }
    readinessToneArmedRef.current = false
    setReadinessToneArmed(false)
    readinessHeardConfirmedRef.current = false
    setReadinessHeardConfirmed(false)
    readinessVoiceHeardRef.current = false
    setReadinessVoiceHeard(false)
    advanceFromReadiness()
  }, [advanceFromReadiness])

  useEffect(() => {
    if (phase !== 'readiness' || inputMode !== 'mic') return
    if (micError) {
      setReadinessStatus('voice-error')
      setReadinessMessage(`VOICE CHANNEL CLOSED - ${micError}`)
      return
    }
    const health = micSourceHealthRef.current
    const fresh = pitchGenerationRef.current > readinessGenerationBaselineRef.current
    const healthy = isListening && visibilityActiveRef.current && focusActiveRef.current &&
      health.audioContextState === 'running' && health.trackReadyState === 'live' &&
      health.trackMuted === false
    const heard = pitch?.isActive === true && pitch.confidence >= MIC_CONFIDENCE_FLOOR && pitch.frequency > 0
    if (healthy && fresh && heard) {
      readinessVoiceHeardRef.current = true
      setReadinessVoiceHeard(true)
      setReadinessMessage('LIVE SIGNAL HEARD - PRESS CONTINUE TO PRACTICE.')
    }
  }, [phase, inputMode, isListening, micError, pitch, micSourceHealthRef, pitchGenerationRef])

  const continueVoiceReadiness = useCallback(() => {
    if (phaseRef.current !== 'readiness' || inputModeRef.current !== 'mic' || !readinessVoiceHeardRef.current) return
    advanceFromReadiness()
  }, [advanceFromReadiness])

  useEffect(() => {
    if (phase !== 'readiness' || inputMode !== 'click') return
    const onReadinessKey = (event: KeyboardEvent) => {
      if (event.key !== '1' && event.key.toLowerCase() !== 'c') return
      event.preventDefault()
      answerEarReadiness(RADIO_CHECK_NOTE)
    }
    window.addEventListener('keydown', onReadinessKey)
    return () => window.removeEventListener('keydown', onReadinessKey)
  }, [phase, inputMode, answerEarReadiness])

  const handleInsertCoin = useCallback(() => {
    let seen = false
    try { seen = localStorage.getItem(TUTORIAL_KEY) === '1' } catch {}
    if (seen) enterReadiness()
    else setPhase('tutorial')
  }, [enterReadiness])

  const finishTutorial = useCallback(() => {
    try { localStorage.setItem(TUTORIAL_KEY, '1') } catch {}
    enterReadiness()
  }, [enterReadiness])

  const playCoachingSignal = useCallback(async (
    note: string,
    guard: 'practice' | 'placement',
  ): Promise<boolean> => {
    try {
      initAudio()
      await loadPianoSamples()
      if (phaseRef.current !== guard) return false
      const ready = getPianoReadiness(note)
      if (!visibilityActiveRef.current || !focusActiveRef.current ||
          !ready.sampleReady || ready.contextState !== 'running') return false
      writeAudioReceipt({
        kind: 'piano', note, guard, requestId: null,
        gameId: null, attackId: null, ceremonyId: null, terminalAlreadyRecorded: false,
      })
      playPianoNote(note)
      notePlayTimeRef.current = Date.now()
      return true
    } catch {
      return false
    }
  }, [writeAudioReceipt])

  const markPracticeSuccess = useCallback(() => {
    if (practiceStage === 'success') return
    practiceToneArmedRef.current = false
    practiceHoldStartedRef.current = 0
    setPracticeStage('success')
    setPracticeMessage('DIRECT HIT - YOU LISTENED, ANSWERED, AND FIRED.')
    sfxShoot()
    window.setTimeout(sfxExplosion, 180)
    const completedAt = performance.now()
    document.documentElement.dataset.retroFirstKill = JSON.stringify({
      readinessPassedAt: firstKillStartedAtRef.current,
      tutorialKillAt: completedAt,
      activeDurationMs: Math.max(0, completedAt - firstKillStartedAtRef.current),
      lane: placementLane(inputModeRef.current),
    })
  }, [practiceStage])

  const playPracticeSignal = useCallback(async () => {
    setPracticeMessage('PLAYING C - LISTEN FIRST...')
    const played = await playCoachingSignal('C4', 'practice')
    if (!played) {
      setPracticeMessage('SIGNAL PATH NOT READY - RETRY C.')
      return
    }
    practiceToneArmedRef.current = true
    practiceHoldStartedRef.current = 0
    setPracticeStage('answer')
    setPracticeMessage(inputModeRef.current === 'mic'
      ? 'YOUR TURN - SING AND HOLD THE C YOU HEARD.'
      : 'YOUR TURN - PRESS C [1].')
  }, [playCoachingSignal])

  const answerPractice = useCallback((note: 'C4' | 'A4') => {
    if (phaseRef.current !== 'practice' || inputModeRef.current !== 'click') return
    if (!practiceToneArmedRef.current || practiceStage !== 'answer') {
      setPracticeMessage('PLAY C FIRST, THEN ANSWER.')
      return
    }
    if (note !== 'C4') {
      practiceToneArmedRef.current = false
      setPracticeStage('listen')
      setPracticeMessage('NOT THAT ONE - NO SHIELD LOST. PLAY C AND TRY AGAIN.')
      sfxWrong()
      return
    }
    markPracticeSuccess()
  }, [markPracticeSuccess, practiceStage])

  const beginPlacement = useCallback(() => {
    setPlacementTrialIndex(0)
    setPlacementAttempt(0)
    placementSignalArmedRef.current = false
    setPlacementSignalArmed(false)
    setPlacementTrials([])
    setPlacementResult(null)
    setPlacementMessage('TRIAL 1 OF 4 - PRESS PLAY WHEN READY. THERE IS NO TIMER.')
    phaseRef.current = 'placement'
    setPhase('placement')
  }, [])

  const finishPlacement = useCallback(async (trials: RetroPlacementTrial[]) => {
    const summary = placeRetroPace(trials, Date.now())
    setPlacementMessage('SAVING YOUR COMFORTABLE STARTING PACE...')
    const committed = await runPlacementCommit(summary)
    if (!committed) {
      setPlacementResult(null)
      setPlacementMessage('LOCAL SAVE PAUSED - RETRY SAVE OR START AT CADET.')
      return
    }
    setPlacementResult(summary)
    setPlacementMessage(`PACE FOUND: ${summary.pace.toUpperCase()} - YOU CAN CHANGE IT BEFORE LAUNCH.`)
  }, [runPlacementCommit])

  const acceptPlacementAnswer = useCallback((answeredNote: 'C4' | 'A4') => {
    if (phaseRef.current !== 'placement' || !placementSignalArmedRef.current || placementResult) return
    const target = PLACEMENT_SEQUENCE[placementTrialIndex]
    const latencyMs = Math.max(0, performance.now() - placementSignalStartedAtRef.current)
    if (answeredNote !== target) {
      placementSignalArmedRef.current = false
      setPlacementSignalArmed(false)
      setPlacementAttempt(value => value + 1)
      setPlacementMessage('NOT THAT ONE - NO PENALTY. PLAY THE SAME SIGNAL AGAIN.')
      sfxWrong()
      return
    }
    placementSignalArmedRef.current = false
    setPlacementSignalArmed(false)
    const nextTrials = [...placementTrials, {
      note: target,
      firstAttemptCorrect: placementAttempt === 0,
      latencyMs,
    }]
    setPlacementTrials(nextTrials)
    sfxShoot()
    if (placementTrialIndex >= PLACEMENT_SEQUENCE.length - 1) {
      void finishPlacement(nextTrials)
      return
    }
    const nextIndex = placementTrialIndex + 1
    setPlacementTrialIndex(nextIndex)
    setPlacementAttempt(0)
    setPlacementMessage(`GOOD. TRIAL ${nextIndex + 1} OF 4 - PLAY THE NEXT SIGNAL WHEN READY.`)
  }, [finishPlacement, placementAttempt, placementResult, placementTrialIndex, placementTrials])

  const playPlacementSignal = useCallback(async () => {
    if (placementResult) return
    const target = PLACEMENT_SEQUENCE[placementTrialIndex]
    setPlacementMessage(`PLAYING TRIAL ${placementTrialIndex + 1} - LISTEN...`)
    const played = await playCoachingSignal(target, 'placement')
    if (!played) {
      setPlacementMessage('SIGNAL PATH NOT READY - RETRY THIS TRIAL.')
      return
    }
    placementSignalStartedAtRef.current = performance.now()
    placementHoldStartedRef.current = 0
    placementWrongHoldStartedRef.current = 0
    placementSignalArmedRef.current = true
    setPlacementSignalArmed(true)
    setPlacementMessage(inputModeRef.current === 'mic'
      ? 'YOUR TURN - SING AND HOLD THE NOTE YOU HEARD.'
      : 'YOUR TURN - CHOOSE C [1] OR A [2].')
  }, [placementResult, placementTrialIndex, playCoachingSignal])

  const choosePlacementPace = useCallback(async (pace: RetroPace) => {
    const summary = manualRetroPlacement(pace, Date.now())
    setPlacementMessage(`SAVING ${pace.toUpperCase()} PACE...`)
    const committed = await runPlacementCommit(summary)
    if (!committed) {
      setPlacementMessage('LOCAL SAVE PAUSED - RETRY YOUR PACE SELECTION.')
      return
    }
    setPlacementResult(summary)
    setPlacementMessage(`PACE SET: ${pace.toUpperCase()}.`)
  }, [runPlacementCommit])

  const startFirstTimedSession = useCallback(() => {
    const placement = placementResult ?? savedPlacement
    if (!placement) return
    const pace = resolveRetroPlayPace(placement.pace, difficulty)
    activePaceRef.current = pace
    setActivePace(pace)
    sessionRosterRef.current = [...FIRST_SESSION_ROSTER]
    setSessionRoster([...FIRST_SESSION_ROSTER])
    startGame()
  }, [difficulty, placementResult, savedPlacement, startGame])

  useEffect(() => {
    if (inputMode !== 'mic' || (phase !== 'practice' && phase !== 'placement')) return
    const now = performance.now()
    const echoClear = Date.now() - notePlayTimeRef.current >= 650
    const healthyPitch = echoClear && pitch?.isActive === true &&
      pitch.confidence >= MIC_CONFIDENCE_FLOOR && pitch.frequency > 0
    const target = phase === 'practice' ? 'C4' : PLACEMENT_SEQUENCE[placementTrialIndex]
    const matches = healthyPitch && Math.abs(octaveFoldedCents(pitch.frequency, noteToFreq(target))) <= 70

    if (phase === 'practice') {
      if (!practiceToneArmedRef.current || practiceStage !== 'answer') return
      if (matches) {
        if (practiceHoldStartedRef.current === 0) practiceHoldStartedRef.current = now
        if (now - practiceHoldStartedRef.current >= 300) markPracticeSuccess()
      } else if (healthyPitch) {
        practiceHoldStartedRef.current = 0
        setPracticeMessage('KEEP LISTENING - THAT PITCH IS DIFFERENT. REPLAY C AND TRY AGAIN.')
      }
      return
    }

    if (!placementSignalArmedRef.current || placementResult) return
    if (matches) {
      placementWrongHoldStartedRef.current = 0
      if (placementHoldStartedRef.current === 0) placementHoldStartedRef.current = now
      if (now - placementHoldStartedRef.current >= 300) acceptPlacementAnswer(target)
    } else if (healthyPitch) {
      placementHoldStartedRef.current = 0
      if (placementWrongHoldStartedRef.current === 0) placementWrongHoldStartedRef.current = now
      if (now - placementWrongHoldStartedRef.current >= 300) {
        placementWrongHoldStartedRef.current = 0
        placementSignalArmedRef.current = false
        setPlacementSignalArmed(false)
        setPlacementAttempt(value => value + 1)
        setPlacementMessage('THAT WAS A DIFFERENT PITCH - NO PENALTY. REPLAY AND TRY AGAIN.')
      }
    }
  }, [acceptPlacementAnswer, inputMode, markPracticeSuccess, phase, pitch, placementResult, placementTrialIndex, practiceStage])

  useEffect(() => {
    if (inputMode !== 'click' || (phase !== 'practice' && phase !== 'placement')) return
    const onCoachKey = (event: KeyboardEvent) => {
      const note = event.key === '1' || event.key.toLowerCase() === 'c'
        ? 'C4'
        : event.key === '2' || event.key.toLowerCase() === 'a'
          ? 'A4'
          : null
      if (!note) return
      event.preventDefault()
      if (phase === 'practice') answerPractice(note)
      else acceptPlacementAnswer(note)
    }
    window.addEventListener('keydown', onCoachKey)
    return () => window.removeEventListener('keydown', onCoachKey)
  }, [acceptPlacementAnswer, answerPractice, inputMode, phase])

  const replayActiveNote = useCallback(() => {
    const gs = stateRef.current
    if (!gs || gs.phase !== 'playing') return
    const attack = gs.activeAttack
    if (!visibilityActiveRef.current || !focusActiveRef.current ||
        attack?.phase !== 'outbound' || attack.outcome !== null || attack.cuePolicy === 'blind' ||
        attack.demandAtMs === null) return
    const alien = gs.aliens.find(candidate => candidate.alienId === attack.alienId)
    if (!isTargetableAlien(alien)) return
    const receipt: PendingSafeTryAudioReceipt = {
      kind: 'piano', note: alien.note, guard: 'manual-replay', requestId: null,
      gameId: gs.gameId, attackId: attack.attackId, ceremonyId: null,
      terminalAlreadyRecorded: false,
    }
    if (attack.cuePolicy === 'safe-try') {
      pendingSafeTryAudioReceiptRef.current = receipt // tone-replay-answer-neutral
    } else {
      writeAudioReceipt(receipt)
    }
    playPianoNote(alien.note)
    notePlayTimeRef.current = Date.now()
  }, [writeAudioReceipt])

  const revealFullCueHelp = useCallback(() => {
    const gs = stateRef.current
    const attack = gs?.activeAttack
    if (!gs || !attack || !requestFullCueHelp(gs, attack.attackId)) return
    flushSync(() => setDisplayView(toViewState(gs, inputModeRef.current, colorHintsRef.current)))
    renderedAnswerMaskRef.current = false
    flushPendingSafeTryAudioReceipt(pendingSafeTryAudioReceiptRef, writeAudioReceipt)
  }, [writeAudioReceipt])

  const processHit = useCallback((answeredNote: string) => {
    const gs = stateRef.current
    const attack = gs?.activeAttack
    if (!gs || gs.phase !== 'playing' || inputModeRef.current !== 'click' || pendingAnswerRef.current ||
        !visibilityActiveRef.current || !focusActiveRef.current ||
        attack?.phase !== 'outbound' || attack.outcome !== null || attack.demandAtMs === null) return
    pendingAnswerRef.current = {
      note: answeredNote,
      inputMode: 'click',
      gameId: gs.gameId,
      alienId: attack.alienId,
      attackId: attack.attackId,
    }
  }, [])

  const toggleCrt = useCallback(() => {
    setCrtEnabled(enabled => {
      const next = !enabled
      try { localStorage.setItem(CRT_KEY, next ? '1' : '0') } catch {}
      return next
    })
  }, [])

  const toggleColorHints = useCallback(() => {
    setColorHints(enabled => {
      const next = !enabled
      colorHintsRef.current = next
      try { localStorage.setItem(COLOR_HINTS_KEY, next ? '1' : '0') } catch {}
      return next
    })
  }, [])

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const gs = stateRef.current
    if (!gs || gs.phase !== 'playing' || !canvasRef.current) return
    if (toViewState(gs, inputModeRef.current, colorHintsRef.current).answerMaskActive) {
      return // canvas-answer-inert: DOM choices are the sole live safe-try answers.
    }
    const rect = canvasRef.current.getBoundingClientRect()
    const scaleX = W / rect.width
    const scaleY = H / rect.height
    const cx = (e.clientX - rect.left) * scaleX
    const cy = (e.clientY - rect.top) * scaleY
    const unlocked = gs.unlockedNotes
    const buttonRects = noteButtonRects(unlocked.length)
    for (let i = 0; i < buttonRects.length; i++) {
      const rect = buttonRects[i]
      if (cx >= rect.x && cx <= rect.x + rect.width && cy >= rect.y && cy <= rect.y + rect.height) {
          processHit(unlocked[i])
          return
      }
    }
  }, [processHit])

  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      const gs = stateRef.current
      if (!gs || gs.phase !== 'playing') return
      if (ev.key === ' ' || ev.key === 'r' || ev.key === 'R') {
        ev.preventDefault()
        replayActiveNote()
        return
      }
      if (ev.key === 'h' || ev.key === 'H') {
        ev.preventDefault()
        revealFullCueHelp()
        return
      }
      const note = noteForKeyboardInput(ev.key, gs.unlockedNotes)
      if (note && gs.unlockedNotes.includes(note)) processHit(note)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [processHit, replayActiveNote, revealFullCueHelp])

  useEffect(() => {
    const answerMaskActive = displayView?.answerMaskActive === true
    if (answerMaskActive && !previousAnswerMaskRef.current) {
      safeTryFocusRef.current?.focus({ preventScroll: true })
    }
    previousAnswerMaskRef.current = answerMaskActive
  }, [displayView?.answerMaskActive])

  useEffect(() => {
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  if (phase === 'menu') {
    return (
      <div className="fixed inset-0 overflow-y-auto bg-black px-5 py-8 text-white"
        style={{ fontFamily: 'monospace' }} data-retro-first-player-menu>
        <main className="mx-auto flex min-h-full w-full max-w-3xl flex-col items-center justify-center">
        <h1 className="mb-2 text-center text-4xl font-black text-[#3FBFB5] sm:text-5xl"
          style={{ textShadow: '0 0 20px rgba(60,191,181,0.5)', letterSpacing: '0.2em' }}>
          RETRO BLASTER
        </h1>
        <p className="mb-7 text-center text-base font-bold tracking-wider text-cyan-100">LISTEN. ANSWER. FIRE.</p>
        <h2 className="mb-3 text-sm font-black tracking-[0.22em] text-cyan-200">HOW YOU ANSWER</h2>
        <div className="mb-5 grid w-full gap-3 sm:grid-cols-2">
          <button onClick={() => setInputMode('click')}
            className="min-h-20 border p-4 text-left transition-all"
            style={{
              background: inputMode === 'click' ? '#3FBFB5' : '#111',
              color: inputMode === 'click' ? '#000' : '#d7e7eb',
              border: `1px solid ${inputMode === 'click' ? '#3FBFB5' : '#333'}`,
            }}>
            <span className="block text-base font-black">KEYS / TAP</span>
            <span className="mt-1 block text-sm leading-5 opacity-80">Hear a note, then press its number key or tap its note button.</span>
          </button>
          <button onClick={() => setInputMode('mic')}
            className="min-h-20 border p-4 text-left transition-all"
            style={{
              background: inputMode === 'mic' ? '#8b5cf6' : '#111',
              color: inputMode === 'mic' ? '#fff' : '#d7e7eb',
              border: `1px solid ${inputMode === 'mic' ? '#8b5cf6' : '#333'}`,
            }}>
            <span className="block text-base font-black">VOICE</span>
            <span className="mt-1 block text-sm leading-5 opacity-80">Hear a note, then sing and hold that pitch to fire.</span>
          </button>
        </div>
        <h2 className="mb-3 text-sm font-black tracking-[0.22em] text-emerald-200">CHALLENGE</h2>
        <div className="mb-2 grid w-full gap-3 sm:grid-cols-2">
          <button onClick={() => {
            setDifficulty('easy')
            try { localStorage.setItem(RETRO_DIFFICULTY_KEY, 'easy') } catch {}
          }} className="min-h-20 border p-4 text-left transition-all"
            style={{
              background: difficulty === 'easy' ? '#7dffb0' : '#111',
              color: difficulty === 'easy' ? '#000' : '#d7e7eb',
              border: `1px solid ${difficulty === 'easy' ? '#7dffb0' : '#333'}`,
            }}>
            <span className="block text-base font-black">COACHED / EASY</span>
            <span className="mt-1 block text-sm leading-5 opacity-80">Your placed pace, generous listening time, and two protected early misses.</span>
          </button>
          <button onClick={() => {
            setDifficulty('true')
            try { localStorage.setItem(RETRO_DIFFICULTY_KEY, 'true') } catch {}
          }} className="min-h-20 border p-4 text-left transition-all"
            style={{
              background: difficulty === 'true' ? '#ff6090' : '#111',
              color: difficulty === 'true' ? '#fff' : '#d7e7eb',
              border: `1px solid ${difficulty === 'true' ? '#ff6090' : '#333'}`,
            }}>
            <span className="block text-base font-black">ARCADE / TRUE PLAY</span>
            <span className="mt-1 block text-sm leading-5 opacity-80">One pace hotter than your placement; never under 2.4 seconds.</span>
          </button>
        </div>
        <p className="mb-5 max-w-xl text-center text-sm leading-6 text-gray-300">
          {difficulty === 'easy'
            ? 'Recommended: your placed pace, generous listening time, and early coaching saves.'
            : 'Your placed pace, one level hotter. Recommended after the coached path.'}
        </p>
        <section className="mb-6 w-full border border-white/10 bg-white/5 p-4 text-center" aria-label="Starting pace">
          {savedPlacement ? (
            <>
              <div className="text-sm font-bold tracking-wider">STARTING PACE: <span className="text-yellow-200">{savedPlacement.pace.toUpperCase()}</span></div>
              <div className="mt-1 text-sm text-gray-300">{retroPaceConfig(resolveRetroPlayPace(savedPlacement.pace, difficulty)).responseWindowMs / 1000} seconds to answer in this challenge.</div>
              <div className="mt-3 flex flex-wrap justify-center gap-2" aria-label="Change starting pace">
                {RETRO_PACES.map(pace => (
                  <button key={pace} onClick={() => void choosePlacementPace(pace)}
                    className="min-h-11 border border-white/25 px-3 py-2 text-sm font-bold text-gray-200"
                    aria-pressed={savedPlacement.pace === pace}>{pace.toUpperCase()}</button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-bold tracking-wider text-yellow-200">FIRST LAUNCH: FIND YOUR PACE</div>
              <div className="mt-2 text-sm leading-6 text-gray-300">Check your gear, destroy one practice alien, then answer four untimed C/A signals. This finds a comfortable starting pace; it does not grade talent.</div>
            </>
          )}
        </section>
        <button onClick={handleInsertCoin}
          className="min-h-14 px-10 py-3 text-lg font-bold tracking-widest transition-all active:scale-95"
          style={{ background: '#3FBFB5', color: '#000', border: '2px solid #5dddd3', boxShadow: '0 0 24px rgba(60,191,181,0.4)' }}>
          INSERT COIN - START
        </button>
        <button onClick={() => { try { localStorage.removeItem(TUTORIAL_KEY) } catch {}; setPhase('tutorial') }}
          className="mt-4 min-h-11 px-4 text-sm text-gray-300 hover:text-white tracking-wider">
          HOW TO PLAY
        </button>
        <a href="/pitch-defender" className="mt-8 text-xs text-gray-700 hover:text-gray-500 transition-colors tracking-wider">
          ← BACK TO PITCH DEFENDER
        </a>
        </main>
      </div>
    )
  }

  if (phase === 'tutorial') {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center px-6 overflow-y-auto py-8"
        style={{ fontFamily: 'monospace' }}>
        <h2 className="text-3xl font-black text-[#3FBFB5] mb-2"
          style={{ textShadow: '0 0 20px rgba(60,191,181,0.4)', letterSpacing: '0.15em' }}>
          WELCOME TO RETRO BLASTER
        </h2>
        <p className="mb-6 text-sm font-bold tracking-widest text-gray-300">YOUR FIRST MISSION</p>
        <div className="mb-6 max-w-2xl space-y-5 text-base leading-6">
          <div className="flex items-start gap-3">
            <div className="text-2xl">👾</div>
            <div>
              <div className="text-base text-[#3FBFB5] font-bold">One active alien shows a glowing ?</div>
              <div className="text-sm text-gray-300">That alien sends the target note. Ignore the other formation ships until a new target becomes active.</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="text-2xl">🔊</div>
            <div>
              <div className="text-base text-yellow-300 font-bold">Listen, answer, fire</div>
              <div className="text-sm text-gray-300">{inputMode === 'mic' ? 'Hear the active alien, then sing and hold the same pitch.' : 'Hear the active alien, then press its number key or tap its note button.'} Replay is always available before you answer.</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="text-2xl">⌨️</div>
            <div>
              <div className="text-base text-purple-300 font-bold">Your first two signals</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-center">
                {[
                  { k: '1', n: 'C' }, { k: '2', n: 'A' },
                ].map((x) => (
                  <div key={x.k} className="min-h-14 border border-cyan-700 px-4 py-2">
                    <div className="text-cyan-200 text-lg font-bold">{x.n}</div>
                    <div className="text-gray-300 text-sm">KEY [{x.k}]</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="text-2xl">🛡️</div>
            <div>
              <div className="text-base text-emerald-300 font-bold">Practice is safe</div>
              <div className="text-sm text-gray-300">Your practice alien and four pace signals are untimed and unscored. Wrong answers teach and replay; they never remove a shield or write a grade.</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="text-2xl">🐢</div>
            <div>
              <div className="text-base text-gray-100 font-bold">The game finds a comfortable pace</div>
              <div className="text-sm text-gray-300">Four untimed C/A signals choose a provisional pace. EASY uses it; TRUE PLAY goes one level hotter. Two early misses are protected and can slow the run automatically.</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="text-2xl">🎯</div>
            <div>
              <div className="text-base text-cyan-300 font-bold">Answer only the active target</div>
              <div className="text-sm text-gray-300">The cannon aims automatically after your answer. The alien marked <span className="font-black text-yellow-200">?</span> is the one you are answering now.</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="text-2xl" aria-hidden="true">RADIO</div>
            <div>
              <div className="text-base text-emerald-300 font-bold">First: prove the gear works</div>
              <div className="text-sm text-gray-300">{inputMode === 'mic' ? 'You start the microphone, prove a fresh live signal, then explicitly continue.' : 'You play test note C, tell us whether you heard it, then press C [1].'} This checks hardware and controls, never ability.</div>
            </div>
          </div>
        </div>
        <button onClick={finishTutorial}
          className="px-12 py-4 text-lg font-bold tracking-widest transition-all active:scale-95"
          style={{ background: '#3FBFB5', color: '#000', border: '2px solid #5dddd3', boxShadow: '0 0 24px rgba(60,191,181,0.4)' }}>
          BEGIN PRE-FLIGHT
        </button>
        <button onClick={() => {
          abortCurriculumSession()
          pendingBlindStimulusAckRef.current = null
          discardPendingSafeTryAudioReceipt(pendingSafeTryAudioReceiptRef)
          clearRetroAudioReceipt(canvasRef.current)
          stateRef.current = null
          setPhase('menu')
        }}
          className="mt-3 text-xs text-gray-600 hover:text-gray-400 transition-colors">
          ← BACK TO MENU
        </button>
      </div>
    )
  }

  if (phase === 'readiness') {
    const isEar = inputMode === 'click'
    const radioHue = NOTE_COLORS[RADIO_CHECK_NOTE]?.hue ?? 174
    const voiceSignalActive = pitch?.isActive === true &&
      pitch.confidence >= MIC_CONFIDENCE_FLOOR && pitch.frequency > 0
    return (
      <div className="retro-readiness-shell fixed inset-0 overflow-y-auto bg-black px-4 py-6 sm:px-6"
        data-retro-readiness
        data-readiness-lane={isEar ? 'ear' : 'voice'}
        data-readiness-status={readinessStatus}
        data-readiness-tone-armed={readinessToneArmed ? 'true' : 'false'}
        style={{ fontFamily: 'monospace' }}>
        <div className="retro-readiness-frame mx-auto flex min-h-full w-full max-w-2xl items-center justify-center">
          <section className="retro-readiness-card relative w-full overflow-hidden border-2 border-cyan-300/70 bg-[#050812] p-5 sm:p-8"
            aria-labelledby="radio-check-title"
            style={{ boxShadow: '0 0 0 1px rgba(255,67,219,0.38), 0 0 36px rgba(62,214,255,0.18), inset 0 0 42px rgba(0,0,0,0.9)' }}>
            <div className="pointer-events-none absolute inset-0 opacity-30" aria-hidden="true"
              style={{ backgroundImage: 'linear-gradient(rgba(88,232,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(88,232,255,0.06) 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
            <div className="relative">
              <div className="retro-readiness-meta mb-5 flex items-center justify-between gap-3 text-[10px] tracking-[0.24em]">
                <span className="text-fuchsia-300" data-retro-cabinet-unit>
                  {isEar ? 'EAR DEFENSE UNIT' : 'VOICE DEFENSE UNIT'}
                </span>
                <span className={isEar ? 'text-cyan-300' : 'text-violet-300'}>
                  {isEar ? 'EAR CHANNEL' : 'VOICE CHANNEL'}
                </span>
              </div>
              <div className="retro-readiness-preflight mb-2 text-center text-[11px] font-bold tracking-[0.35em] text-emerald-300">PRE-FLIGHT</div>
              <h2 id="radio-check-title" className="retro-readiness-title mb-3 text-center text-3xl font-black tracking-[0.18em] text-white sm:text-4xl"
                style={{ textShadow: '0 0 18px rgba(94,234,212,0.42)' }}>
                RADIO CHECK
              </h2>
              <p className="retro-readiness-copy mx-auto mb-7 max-w-lg text-center text-base leading-7 text-gray-200">
                {isEar
                  ? '1. Play test note C. 2. Tell us whether you heard it. 3. Press C [1]. This checks audio and controls, never your musical ability.'
                  : 'Start the microphone, make any comfortable sound, wait for LIVE SIGNAL HEARD, then explicitly continue. This is not a singing score.'}
              </p>

              {isEar ? (
                <>
                  <div className="retro-readiness-signal mx-auto mb-6 flex h-28 w-28 items-center justify-center border-2 bg-black/70"
                    aria-label="Named radio-check signal C"
                    style={{ borderColor: `hsl(${radioHue}, 80%, 62%)`, boxShadow: `0 0 28px hsla(${radioHue}, 80%, 55%, 0.22)` }}>
                    <span className="text-6xl font-black" style={{ color: `hsl(${radioHue}, 92%, 74%)` }}>C</span>
                  </div>
                  <div className="retro-readiness-replay flex flex-wrap justify-center gap-3">
                    <button onClick={replayEarReadiness}
                      className="min-h-12 border border-yellow-300 px-5 py-3 text-sm font-bold tracking-widest text-yellow-100 outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-95">
                      {readinessStatus === 'audio-error' ? 'RETRY AUDIO' : 'PLAY TEST NOTE C'}
                    </button>
                    {readinessToneArmed && !readinessHeardConfirmed && (
                      <>
                        <button onClick={confirmEarReadiness}
                          className="min-h-12 border border-emerald-300 bg-emerald-300/15 px-5 py-3 text-sm font-bold text-emerald-100">YES, I HEARD IT</button>
                        <button onClick={retryMissingEarSignal}
                          className="min-h-12 border border-red-300 px-5 py-3 text-sm font-bold text-red-100">NO SOUND - RETRY</button>
                      </>
                    )}
                  </div>
                  {readinessHeardConfirmed && (
                    <button onClick={() => answerEarReadiness(RADIO_CHECK_NOTE)}
                      className="mx-auto mt-5 block min-h-16 min-w-48 border-2 border-cyan-300 bg-cyan-300/15 px-8 py-3 text-xl font-black text-cyan-100"
                      aria-label="C, key 1">C <span className="text-base">[1]</span></button>
                  )}
                </>
              ) : (
                <div className="retro-readiness-voice mb-6">
                  <div className="retro-readiness-voice-meter mx-auto mb-5 flex h-28 max-w-sm items-end justify-center gap-2 border border-violet-400/50 bg-black/70 px-5 py-5"
                    data-retro-readiness-voice-signal={voiceSignalActive ? 'active' : 'waiting'}
                    aria-label={voiceSignalActive ? 'Live voice signal heard' : 'Waiting for a live voice signal'}>
                    {Array.from({ length: 9 }, (_, index) => (
                      <span key={index} className="w-3"
                        style={{
                          height: voiceSignalActive ? `${18 + ((index * 13) % 42)}px` : '8px',
                          background: voiceSignalActive ? '#a78bfa' : '#242033',
                          boxShadow: voiceSignalActive ? '0 0 8px rgba(167,139,250,0.65)' : 'none',
                          transition: reducedMotion ? 'none' : 'height 100ms ease-out',
                        }} />
                    ))}
                  </div>
                  <div className="text-center text-base font-bold tracking-[0.18em] text-violet-100">
                    {readinessVoiceHeard ? 'LIVE SIGNAL HEARD' : readinessStatus === 'idle' ? 'MICROPHONE NOT STARTED' : 'HUM OR SING ANYTHING'}
                  </div>
                  <div className="mt-5 flex flex-wrap justify-center gap-3">
                    {!readinessVoiceHeard && (
                      <button onClick={retryVoiceReadiness}
                        className="min-h-12 border border-violet-300 px-5 py-3 text-sm font-bold tracking-widest text-violet-100 outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-95">
                        {readinessStatus === 'idle' ? 'START MICROPHONE' : 'RETRY MICROPHONE'}
                      </button>
                    )}
                    {readinessVoiceHeard && (
                      <button onClick={continueVoiceReadiness}
                        className="min-h-12 border border-emerald-300 bg-emerald-300/15 px-5 py-3 text-sm font-bold text-emerald-100">CONTINUE TO PRACTICE</button>
                    )}
                    <button onClick={() => { stopListening(); setInputMode('click'); inputModeRef.current = 'click'; setPhase('menu') }}
                      className="min-h-12 border border-cyan-300 px-5 py-3 text-sm font-bold text-cyan-100">USE KEYS / TAP INSTEAD</button>
                  </div>
                </div>
              )}

              <div className="retro-readiness-message mt-6 min-h-12 border border-white/10 bg-black/60 px-3 py-3 text-center text-base font-bold leading-6 tracking-wide text-cyan-100"
                role="status" aria-live="polite">
                {readinessMessage || (isEar ? 'PREPARING SIGNAL C...' : 'PREPARING VOICE CHANNEL...')}
              </div>
              <div className="retro-readiness-back mt-5 text-center">
                <button onClick={exitReadiness}
                  className="min-h-11 px-4 text-xs tracking-widest text-gray-500 outline-none hover:text-gray-300 focus-visible:ring-2 focus-visible:ring-white">
                  BACK TO MENU
                </button>
              </div>
            </div>
          </section>
        </div>
        <style jsx>{`
          @media (orientation: landscape) and (max-height: 500px) {
            .retro-readiness-shell { padding: 4px 12px; }
            .retro-readiness-card { padding: 8px 18px; }
            .retro-readiness-meta { margin-bottom: 2px; }
            .retro-readiness-preflight { margin-bottom: 0; }
            .retro-readiness-title { margin-bottom: 2px; font-size: 22px; line-height: 26px; }
            .retro-readiness-copy { margin-bottom: 6px; line-height: 16px; }
            .retro-readiness-signal { width: 52px; height: 52px; margin-bottom: 6px; }
            .retro-readiness-signal span { font-size: 34px; }
            .retro-readiness-grid { margin-bottom: 6px; }
            .retro-readiness-grid button { min-height: 44px; padding-top: 4px; padding-bottom: 4px; }
            .retro-readiness-voice { margin-bottom: 6px; }
            .retro-readiness-voice-meter { height: 58px; margin-bottom: 4px; padding-top: 8px; padding-bottom: 8px; }
            .retro-readiness-message { min-height: 32px; margin-top: 6px; padding-top: 4px; padding-bottom: 4px; }
            .retro-readiness-back { margin-top: 0; }
          }
        `}</style>
      </div>
    )
  }

  if (phase === 'practice') {
    return (
      <div className="fixed inset-0 overflow-y-auto bg-black px-5 py-8 text-white" style={{ fontFamily: 'monospace' }} data-retro-practice={practiceStage}>
        <main className="mx-auto flex min-h-full w-full max-w-2xl flex-col items-center justify-center">
          <div className="mb-2 text-sm font-bold tracking-[0.3em] text-emerald-300">SAFE PRACTICE - NO TIMER - NO SHIELDS</div>
          <h2 className="mb-5 text-center text-3xl font-black tracking-[0.16em] text-cyan-200">DESTROY ONE C ALIEN</h2>
          <div className="relative mb-5 flex h-56 w-full items-center justify-center overflow-hidden border-2 border-cyan-300/50 bg-[#050812]">
            <div className={`absolute top-7 flex h-20 w-20 items-center justify-center border-2 text-4xl font-black ${practiceStage === 'success' ? 'border-red-300 text-red-300 opacity-30' : 'border-yellow-300 text-yellow-200'}`}
              style={{ transform: practiceStage === 'success' ? 'scale(1.4) rotate(18deg)' : 'none', transition: reducedMotion ? 'none' : 'all 300ms ease-out' }}>
              {practiceStage === 'success' ? '✦' : '?'}
            </div>
            <div className="absolute bottom-5 text-5xl text-cyan-300">▲</div>
            {practiceStage === 'success' && <div className="absolute bottom-14 h-24 w-1 bg-cyan-100 shadow-[0_0_18px_#67e8f9]" aria-hidden="true" />}
          </div>

          <div className="mb-5 grid w-full gap-3 sm:grid-cols-2">
            <div className={`border p-4 ${practiceStage === 'listen' ? 'border-yellow-300 bg-yellow-300/10' : 'border-white/15'}`}>
              <div className="text-sm font-black text-yellow-200">1 - LISTEN</div>
              <div className="mt-1 text-sm text-gray-200">Play the known C signal. Replay whenever you need it.</div>
            </div>
            <div className={`border p-4 ${practiceStage === 'answer' ? 'border-cyan-300 bg-cyan-300/10' : 'border-white/15'}`}>
              <div className="text-sm font-black text-cyan-200">2 - ANSWER</div>
              <div className="mt-1 text-sm text-gray-200">{inputMode === 'mic' ? 'Sing and hold C.' : 'Press C [1] or tap C.'}</div>
            </div>
          </div>

          <div className="mb-5 min-h-14 w-full border border-white/15 bg-white/5 p-4 text-center text-base font-bold text-white" role="status" aria-live="polite">{practiceMessage}</div>
          {practiceStage !== 'success' && (
            <div className="flex flex-wrap justify-center gap-3">
              <button onClick={() => void playPracticeSignal()}
                className="min-h-12 border border-yellow-300 px-5 py-3 text-sm font-black text-yellow-100">{practiceStage === 'answer' ? 'REPLAY C' : 'PLAY C SIGNAL'}</button>
              {inputMode === 'click' && (
                <>
                  <button onClick={() => answerPractice('C4')} disabled={practiceStage !== 'answer'}
                    className="min-h-14 min-w-28 border-2 border-cyan-300 px-6 py-3 text-lg font-black text-cyan-100 disabled:opacity-35">C [1]</button>
                  <button onClick={() => answerPractice('A4')} disabled={practiceStage !== 'answer'}
                    className="min-h-14 min-w-28 border border-violet-300 px-6 py-3 text-lg font-black text-violet-100 disabled:opacity-35">A [2]</button>
                </>
              )}
            </div>
          )}
          {practiceStage === 'success' && (
            <button onClick={beginPlacement}
              className="min-h-14 border-2 border-emerald-300 bg-emerald-300/15 px-8 py-3 text-lg font-black text-emerald-100">FIND MY PACE - 4 UNTIMED SIGNALS</button>
          )}
          <button onClick={() => { if (listeningRef.current) stopListening(); phaseRef.current = 'menu'; setPhase('menu') }}
            className="mt-5 min-h-11 px-4 text-sm text-gray-400">BACK TO MENU</button>
        </main>
      </div>
    )
  }

  if (phase === 'placement') {
    const displayedTrial = Math.min(PLACEMENT_SEQUENCE.length, placementTrialIndex + 1)
    return (
      <div className="fixed inset-0 overflow-y-auto bg-black px-5 py-8 text-white" style={{ fontFamily: 'monospace' }} data-retro-placement={placementResult ? 'result' : 'trial'}>
        <main className="mx-auto flex min-h-full w-full max-w-2xl flex-col items-center justify-center">
          <div className="mb-2 text-sm font-bold tracking-[0.3em] text-emerald-300">FIND YOUR PACE - NOT A TALENT SCORE</div>
          <h2 className="mb-3 text-center text-3xl font-black tracking-[0.14em] text-cyan-200">{placementResult ? 'STARTING PACE READY' : `UNTIMED SIGNAL ${displayedTrial} OF 4`}</h2>
          <p className="mb-5 max-w-xl text-center text-sm leading-6 text-gray-300">Listen first. The target stays hidden until you answer. Wrong answers simply replay the same trial.</p>

          <div className="mb-5 flex gap-3" aria-label={`${placementTrials.length} of 4 trials complete`}>
            {PLACEMENT_SEQUENCE.map((_, index) => <span key={index} className={`h-4 w-10 border ${index < placementTrials.length ? 'border-emerald-300 bg-emerald-300' : index === placementTrialIndex && !placementResult ? 'border-yellow-300 bg-yellow-300/20' : 'border-gray-600'}`} />)}
          </div>

          {!placementResult && (
            <div className="mb-5 flex h-40 w-40 items-center justify-center border-2 border-yellow-300/70 bg-[#050812] text-6xl font-black text-yellow-200"
              aria-label="Target identity hidden until response">?</div>
          )}
          {placementResult && (
            <div className="mb-5 border-2 border-emerald-300 bg-emerald-300/10 px-10 py-6 text-center">
              <div className="text-sm tracking-widest text-emerald-200">COMFORTABLE START</div>
              <div className="mt-2 text-4xl font-black text-white">{placementResult.pace.toUpperCase()}</div>
              <div className="mt-2 text-sm text-gray-200">{retroPaceConfig(resolveRetroPlayPace(placementResult.pace, difficulty)).responseWindowMs / 1000} seconds to answer in {difficulty === 'true' ? 'True Play' : 'Easy'}.</div>
            </div>
          )}

          <div className="mb-5 min-h-14 w-full border border-white/15 bg-white/5 p-4 text-center text-base font-bold" role="status" aria-live="polite">{placementMessage}</div>
          {!placementResult ? (
            <div className="flex flex-wrap justify-center gap-3">
              <button onClick={() => void playPlacementSignal()} disabled={placementSignalArmed}
                className="min-h-12 border border-yellow-300 px-5 py-3 text-sm font-black text-yellow-100 disabled:opacity-40">{placementAttempt > 0 ? 'REPLAY SAME SIGNAL' : 'PLAY SIGNAL'}</button>
              {inputMode === 'click' && (
                <>
                  <button onClick={() => acceptPlacementAnswer('C4')} disabled={!placementSignalArmed}
                    className="min-h-14 min-w-28 border-2 border-cyan-300 px-6 py-3 text-lg font-black text-cyan-100 disabled:opacity-35">C [1]</button>
                  <button onClick={() => acceptPlacementAnswer('A4')} disabled={!placementSignalArmed}
                    className="min-h-14 min-w-28 border-2 border-violet-300 px-6 py-3 text-lg font-black text-violet-100 disabled:opacity-35">A [2]</button>
                </>
              )}
              <button onClick={() => void choosePlacementPace('cadet')}
                className="min-h-12 border border-gray-500 px-5 py-3 text-sm font-bold text-gray-200">START AT CADET</button>
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap justify-center gap-2" aria-label="Override starting pace">
                {RETRO_PACES.map(pace => <button key={pace} onClick={() => void choosePlacementPace(pace)}
                  className="min-h-11 border border-white/25 px-3 py-2 text-sm font-bold text-gray-100" aria-pressed={placementResult.pace === pace}>{pace.toUpperCase()}</button>)}
              </div>
              <button onClick={startFirstTimedSession}
                className="min-h-14 border-2 border-cyan-300 bg-cyan-300/15 px-8 py-3 text-lg font-black text-cyan-100">LAUNCH FIRST C/A WAVE</button>
            </>
          )}
          <button onClick={() => { if (listeningRef.current) stopListening(); phaseRef.current = 'menu'; setPhase('menu') }}
            className="mt-5 min-h-11 px-4 text-sm text-gray-400">BACK TO MENU</button>
        </main>
      </div>
    )
  }

  if (phase === 'game_over') {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center px-6"
        style={{ fontFamily: 'monospace' }}>
        <div className="text-4xl font-black text-red-500 mb-4 tracking-widest"
          style={{ textShadow: '0 0 20px rgba(255,60,60,0.4)' }}>
          GAME OVER
        </div>
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="text-center"><div className="text-xs text-gray-600">SCORE</div><div className="text-2xl text-white font-bold">{finalStats.score}</div></div>
          <div className="text-center"><div className="text-xs text-gray-600">WAVE</div><div className="text-2xl text-[#3FBFB5] font-bold">{finalStats.wave}</div></div>
          <div className="text-center"><div className="text-xs text-gray-600">MAX COMBO</div><div className="text-2xl text-purple-400 font-bold">{finalStats.maxCombo}</div></div>
        </div>
        <div className="flex gap-4">
          <button onClick={enterReadiness}
            className="px-6 py-2 text-sm font-bold tracking-widest active:scale-95 transition-all"
            style={{ background: '#3FBFB5', color: '#000', border: '2px solid #5dddd3' }}>
            CONTINUE?
          </button>
          <button onClick={() => {
            abortCurriculumSession()
            pendingBlindStimulusAckRef.current = null
            discardPendingSafeTryAudioReceipt(pendingSafeTryAudioReceiptRef)
            clearRetroAudioReceipt(canvasRef.current)
            stateRef.current = null
            setPhase('menu')
          }}
            className="px-6 py-2 text-sm text-gray-500 border border-gray-700 tracking-wider active:scale-95 transition-all">
            MENU
          </button>
        </div>
      </div>
    )
  }

  const identityMaskActive = displayView?.identityMaskActive === true
  const answerMaskActive = displayView?.answerMaskActive === true
  const supportMode = displayView?.supportMode ?? 'guided'
  const showTargetIdentity = colorHints && !identityMaskActive && !answerMaskActive
  const activeAlien = displayView?.aliens[displayView.spotlightIdx]
  const activeNoteName = showTargetIdentity && activeAlien?.alive ? activeAlien.note.replace(/\d/, '') : null
  const matchProgress = displayView?.charge.fraction ?? 0
  const matchTargetNote = displayView?.charge.targetNote ?? null
  const displayUnlocked = displayView?.hud.unlockedNotes ?? []
  const liveChoiceNames = displayUnlocked
    .map((note, index) => `${note.replace(/\d/, '')} [${index + 1}]`)
    .join(' / ')
  const activeCeremony = displayView?.introductionCeremony ?? null
  const isCeremony = displayView?.phase === 'ceremony' && activeCeremony !== null
  const activeLane = inputMode === 'mic' ? 'voice' : 'ear'
  const activeAttack = displayView?.activeAttack
  const responseOpen = activeAttack?.phase === 'outbound' &&
    activeAttack.outcome === null && activeAttack.demandAtMs !== null
  const blindResponseOpen = activeAttack?.cuePolicy === 'blind' && activeAttack.outcome === null &&
    (activeAttack.phase === 'awaiting-stimulus' || responseOpen)
  const replayLocked = activeLane === 'ear' && identityMaskActive
  const cabinetUnit = activeLane === 'voice' ? 'VOICE DEFENSE UNIT' : 'EAR DEFENSE UNIT'
  const instructionCopy = isCeremony
    ? 'NEW SIGNAL → REFERENCE INTRODUCTION ONLY → NOT SCORED'
    : answerMaskActive
      ? responseOpen
        ? `SAFE TRY → TONE PLAYED → CHOOSE ${liveChoiceNames}. REPLAY THE TONE OR ASK FOR FULL HELP ANY TIME.`
        : `SAFE TRY → LISTEN FOR THE TONE. YOUR LIVE CHOICES ARE ${liveChoiceNames}.`
    : activeLane === 'voice'
      ? responseOpen
        ? 'SING OR HUM THE TARGET NOTE → HOLD IT STEADY TO FIRE'
        : 'VOICE CANNON ARMED → WAIT FOR THE TARGET SIGNAL'
      : identityMaskActive
        ? responseOpen
          ? 'SIGNAL CHECK → LISTEN ONCE → PRESS THE MATCHING KEY (OR TAP ITS BUTTON)'
          : blindResponseOpen
            ? 'SIGNAL CHECK → LISTEN ONCE → BUTTONS ARM AFTER THE TONE'
            : 'SIGNAL CHECK ARMED → FORMATION IDENTITIES HIDDEN'
        : responseOpen
          ? activeNoteName
            ? `ANSWER NOW → PRESS ${activeNoteName} [${displayUnlocked.findIndex(note => note.replace(/\d/, '') === activeNoteName) + 1}]`
            : 'ANSWER NOW → PRESS THE MATCHING NOTE (OR TAP ITS BUTTON)'
          : 'STAND BY → LISTEN FOR THE NEXT TARGET SIGNAL'
  const helperCopy = !isCeremony && answerMaskActive
    ? 'THE PLAYFIELD IS HIDDEN ON PURPOSE · EVERY NAMED CHOICE BELOW IS LIVE · FULL HELP REVEALS NORMAL GUIDANCE'
    : !isCeremony && blindResponseOpen
    ? 'FORMATION IDENTITIES HIDDEN · REPLAY LOCKED UNTIL ANSWER'
    : !isCeremony && responseOpen
      ? activeLane === 'voice'
        ? 'ACTIVE ALIEN SHOWS ? · SPACE REPLAYS THE REFERENCE'
        : 'ACTIVE ALIEN SHOWS ? · SPACE REPLAYS THE NOTE'
      : null
  const ceremonyStatus = ceremonyMessage || (
    activeCeremony?.toneStatus === 'acknowledged'
      ? 'REFERENCE SENT - NEXT WAVE READY.'
      : activeCeremony?.toneStatus === 'blocked'
        ? 'SIGNAL PATH NOT READY - RETRY SIGNAL.'
        : 'REFERENCE SIGNAL PENDING...'
  )

  return (
    <div className="fixed inset-0 min-w-0 flex flex-col items-center justify-start pt-3 px-3 overflow-x-hidden overflow-y-auto"
      data-retro-active-lane={activeLane}
      data-retro-identity-mask={identityMaskActive ? 'active' : 'inactive'}
      data-retro-support-mode={supportMode}
      data-retro-answer-mask={answerMaskActive ? 'active' : 'inactive'}
      data-retro-signal-check={JSON.stringify(displayView?.signalCheck ?? null)}
      style={{
        fontFamily: 'monospace',
        background: 'radial-gradient(circle at 50% 0%, #1b0b34 0%, #05010d 42%, #000 82%)',
      }}>
      {curriculumSavePaused && (
        <div className="fixed bottom-2 left-1/2 z-50 max-w-[calc(100vw-24px)] -translate-x-1/2 border border-amber-300 bg-black/95 px-3 py-2 text-center text-[11px] font-bold tracking-wide text-amber-200"
          role="status" aria-live="polite" data-retro-curriculum-status="save-paused">
          LOCAL SAVE PAUSED - KEEP PLAYING; THE NEXT UNLOCK WILL RETRY.
        </div>
      )}
      <div className="w-full min-w-0 max-w-[960px] mb-2 px-2 py-1 text-center"
        data-retro-instruction-rail
        style={{ background: '#02050d', borderBlock: '1px solid rgba(103,232,249,0.22)' }}>
        <div ref={safeTryFocusRef} tabIndex={-1}
          className="mb-2 min-w-0 max-w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
          data-retro-safe-try-focus aria-labelledby="retro-instruction-copy">
          <div id="retro-instruction-copy"
            className="break-words text-lg font-black tracking-wide text-cyan-100"
            data-retro-instruction
            data-retro-safe-try-status={answerMaskActive ? 'active' : 'inactive'}
            role="status" aria-live="polite" aria-atomic="true">
            {instructionCopy}
          </div>
        </div>
        <div className="mb-2 text-sm font-bold text-emerald-200" data-retro-active-pace>
          PACE {activePace.toUpperCase()} · {retroPaceConfig(activePace).responseWindowMs / 1000}s ANSWER WINDOW
        </div>
        <div className="flex justify-center gap-2 flex-wrap text-sm">
          {displayUnlocked.map((note, i) => {
            const hue = NOTE_COLORS[note]?.hue ?? 0
            const isActiveNote = showTargetIdentity && activeNoteName === note.replace(/\d/, '')
            const noteLabel = `${note.replace(/\d/, '')}=${i + 1}`
            const neutralAnswerChoice = answerMaskActive
            const responseStyle = {
              borderColor: !neutralAnswerChoice && colorHints ? `hsl(${hue}, 70%, 55%)` : '#607080',
              background: isActiveNote
                ? `hsla(${hue}, 70%, 35%, 0.6)`
                : 'transparent',
              color: !neutralAnswerChoice && colorHints ? `hsl(${hue}, 90%, 75%)` : '#dce9ef',
              fontWeight: isActiveNote ? 700 : 400,
            }
            if (activeLane === 'voice') {
              return (
                <span key={note} className="rounded border px-2 py-0.5" style={responseStyle}>
                  {noteLabel}
                </span>
              )
            }
            return (
              <button key={note} type="button" data-retro-response-button data-note={note}
                aria-label={`Answer ${note.replace(/\d/, '')} with key ${i + 1}`}
                aria-keyshortcuts={String(i + 1)}
                disabled={!responseOpen}
                onClick={() => processHit(note)}
                className="min-h-11 min-w-11 touch-manipulation rounded border px-3 py-2 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                style={responseStyle}>
                {noteLabel}
              </button>
            )
          })}
        </div>
        {helperCopy && (
          <div className="mt-1 min-w-0 max-w-full break-words text-sm font-bold text-slate-200" data-retro-helper>
            {helperCopy}
          </div>
        )}
        {displayView?.wrongMessage && (
          <div className="mt-2 min-h-11 border border-red-300/50 bg-red-300/10 px-3 py-2 text-base font-black text-red-100"
            role="status" aria-live="assertive" data-retro-feedback>{displayView.wrongMessage}</div>
        )}
      </div>
      <div className="relative w-full min-w-0 max-w-[960px] md:border-2 md:p-3"
        data-retro-cabinet
        style={{
          width: 'min(100%, calc((100dvh - 210px) * 16 / 9 + 28px))',
          borderColor: 'rgba(90,236,255,0.72)',
          background: 'linear-gradient(145deg, rgba(27,12,48,0.96), rgba(4,5,18,0.98))',
          boxShadow: '0 0 0 1px rgba(255,67,219,0.45), 0 0 28px rgba(62,214,255,0.18), inset 0 0 28px rgba(0,0,0,0.85)',
        }}>
        <div className="hidden md:flex items-center justify-between px-1 pb-2 text-[9px] tracking-[0.24em]">
          <span className="text-fuchsia-300">RETRO BLASTER</span>
          <span className="text-cyan-300" data-retro-cabinet-unit>{cabinetUnit}</span>
        </div>
        <div className="relative overflow-hidden border border-cyan-300/30 bg-black"
          style={{ boxShadow: 'inset 0 0 32px rgba(0,0,0,0.82)' }}>
          <canvas ref={bindCanvasRef} width={W} height={H} onClick={handleCanvasClick}
            data-retro-canvas-answer={answerMaskActive ? 'inert' : 'active'}
            className="block w-full"
            style={{ imageRendering: 'pixelated', cursor: 'pointer', aspectRatio: `${W} / ${H}`, maxHeight: 'calc(100vh - 210px)' }} />
          {answerMaskActive && (
            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center border border-cyan-200/30 bg-[#02050d] text-center"
              data-retro-safe-try-scrim aria-hidden="true">
              <div className="text-xl font-black tracking-[0.3em] text-cyan-100">SAFE TRY</div>
              <div className="mt-3 text-xs font-bold tracking-[0.2em] text-slate-300">LISTENING CHANNEL OPEN</div>
              <div className="mt-5 flex gap-2 opacity-70">
                {Array.from({ length: 7 }, (_, index) => (
                  <span key={index} className="h-1 w-5 bg-cyan-200/50" />
                ))}
              </div>
            </div>
          )}
          {crtEnabled && (
            <div className="absolute inset-0 pointer-events-none" data-retro-crt-overlay aria-hidden="true"
              style={{
                backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0, rgba(0,0,0,0.18) 1px, transparent 1px, transparent 3px), radial-gradient(ellipse at center, transparent 58%, rgba(0,0,0,0.34) 100%)',
                boxShadow: 'inset 0 0 20px rgba(70,231,255,0.08)',
              }} />
          )}
          {isCeremony && activeCeremony && (
            <section className="retro-new-signal pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-end overflow-hidden text-center"
              data-retro-ceremony
              data-ceremony-id={activeCeremony.ceremonyId}
              data-ceremony-note={activeCeremony.note}
              data-ceremony-status={activeCeremony.toneStatus}
              aria-labelledby="new-signal-title"
              aria-describedby="new-signal-copy new-signal-status">
              <h2 id="new-signal-title" className="sr-only">
                NEW SIGNAL
              </h2>
              <p id="new-signal-copy" className="sr-only">
                REFERENCE INTRODUCTION. NOT SCORED.
              </p>
              <div className="pointer-events-none w-full border-t border-cyan-300/70 bg-[#02050d] px-1 pb-1"
                data-retro-ceremony-shelf>
                <div id="new-signal-status" role="status" aria-live="polite"
                  className="retro-new-signal-status mb-1 h-4 whitespace-nowrap text-[12px] font-bold leading-4 tracking-normal text-cyan-100"
                  style={{ fontFamily: 'Arial Narrow, Arial, sans-serif' }}>
                  {ceremonyStatus}
                </div>
                <div className="retro-new-signal-actions pointer-events-auto flex flex-nowrap justify-center gap-1">
                  <button onClick={() => void retryCeremonySignal()}
                    className="min-h-11 border border-yellow-300 bg-[#02050d] px-2 py-2 text-[12px] font-bold tracking-wide text-yellow-200 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                    RETRY SIGNAL
                  </button>
                  <button onClick={replayCeremonySignal}
                    className="min-h-11 border border-cyan-300 bg-[#02050d] px-2 py-2 text-[12px] font-bold tracking-wide text-cyan-200 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                    REPLAY SIGNAL
                  </button>
                  <button onClick={quitCeremony}
                    className="min-h-11 border border-slate-500 bg-[#02050d] px-2 py-2 text-[12px] font-bold tracking-wide text-slate-300 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                    QUIT
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
      {!isCeremony && inputMode === 'mic' && matchProgress > 0 && (
        <div className="mt-2 w-full max-w-[960px] flex items-center justify-center gap-3"
          data-retro-vocal-meter
          style={{ fontFamily: 'monospace' }}>
          {matchTargetNote && (
            <span className="text-[12px] font-bold tracking-widest"
              style={{
                color: matchProgress >= 0.8 ? '#4ade80' : '#fbbf24',
                textShadow: matchProgress >= 0.8
                  ? '0 0 8px rgba(74,222,128,0.7)'
                  : '0 0 6px rgba(251,191,36,0.5)',
              }}>
              SING {matchTargetNote.replace(/\d/, '')}
            </span>
          )}
          <div className="h-3 w-48 rounded-full overflow-hidden border"
            style={{ background: 'rgba(20,20,35,0.85)', borderColor: 'rgba(80,80,120,0.6)' }}>
            <div className="h-full rounded-full"
              style={{
                width: `${matchProgress * 100}%`,
                background: matchProgress >= 0.8 ? '#4ade80' : '#fbbf24',
                boxShadow: matchProgress >= 0.8
                  ? '0 0 10px #4ade80, 0 0 20px rgba(74,222,128,0.4)'
                  : '0 0 8px rgba(251,191,36,0.45)',
                transition: 'width 0.05s linear',
              }} />
          </div>
        </div>
      )}
      {!isCeremony && (
      <div className="mt-3 flex gap-3 flex-wrap justify-center pb-3">
        <button onClick={replayActiveNote} disabled={replayLocked}
          onMouseDown={event => { if (answerMaskActive) event.preventDefault() }}
          aria-label={replayLocked ? 'Signal check replay locked until answer' : 'Play target note'}
          className="px-4 py-2 text-xs font-bold tracking-widest active:scale-95 transition-all disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background: 'rgba(255,227,76,0.15)', color: '#ffe34c', border: '1px solid #ffe34c' }}>
          {replayLocked
            ? 'SIGNAL CHECK - REPLAY LOCKED'
            : answerMaskActive
              ? 'TONE REPLAY [SPACE / R]'
              : 'PLAY NOTE [SPACE]'}
        </button>
        {answerMaskActive && (
          <button onClick={revealFullCueHelp}
            className="min-h-11 border border-cyan-200 bg-cyan-200/10 px-4 py-2 text-xs font-bold tracking-widest text-cyan-100 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            FULL HELP [H]
          </button>
        )}
        <button onClick={() => {
          abortCurriculumSession()
          if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0 }
          if (inputMode === 'mic') stopListening()
          pendingBlindStimulusAckRef.current = null
          discardPendingSafeTryAudioReceipt(pendingSafeTryAudioReceiptRef)
          clearRetroAudioReceipt(canvasRef.current)
          stateRef.current = null
          setPhase('menu')
        }} className="px-4 py-2 text-xs text-gray-500 border border-gray-700 tracking-wider active:scale-95">
          QUIT
        </button>
        <button onClick={toggleCrt} aria-pressed={crtEnabled}
          className="px-4 py-2 text-xs tracking-wider active:scale-95 transition-all"
          style={{
            color: crtEnabled ? '#f0abfc' : '#6b7280',
            border: `1px solid ${crtEnabled ? '#e879f9' : '#374151'}`,
            background: crtEnabled ? 'rgba(217,70,239,0.12)' : 'rgba(17,24,39,0.55)',
          }}>
          CRT {crtEnabled ? 'ON' : 'OFF'}
        </button>
        <button onClick={toggleColorHints} aria-pressed={colorHints} data-retro-color-hints
          className="px-4 py-2 text-xs tracking-wider active:scale-95 transition-all"
          style={{
            color: colorHints ? '#7dd3fc' : '#d8e5ef',
            border: `1px solid ${colorHints ? '#38bdf8' : '#64748b'}`,
            background: colorHints ? 'rgba(14,165,233,0.12)' : 'rgba(30,41,59,0.64)',
          }}>
          COLOR HINTS {colorHints ? 'ON' : 'OFF'}
        </button>
      </div>
      )}
      <div className="hidden" data-retro-roster-state
        data-visual-kinds={displayView?.aliens.filter(alien => alien.alive).map(alien => alien.visualKind).join(',') ?? ''}
        data-visual-ids={displayView?.aliens.filter(alien => alien.alive).map(alien => alien.visualId).join(',') ?? ''}>
        {displayView?.hud.score}{displayView?.hud.wave}{displayView?.hud.combo}{displayView?.hud.shields}{STARTING_SHIELDS}
      </div>
    </div>
  )
}
