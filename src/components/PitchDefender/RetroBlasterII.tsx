'use client'

// Sibling of RetroBlaster v1. R0 view-seam build.
// Rail: data/retro-blaster-rework/VANGUARD-SPEC-R0-view-seam.md

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  NOTE_COLORS, createNote,
  type NoteMemory,
} from '@/lib/fsrs'
import {
  FSRS_EAR_KEY, FSRS_VOICE_KEY,
  gradeEar, gradeVoice, loadStore, saveStore,
} from '@/lib/fsrsFamily'
import { INTRO_ORDER } from './types'
import { usePitchDetection } from './usePitchDetection'
import { getPianoReadiness, initAudio, loadPianoSamples, playPianoNote } from './audioEngine'
import {
  H, INITIAL_UNLOCK, MIC_CONFIDENCE_FLOOR, STARTING_SHIELDS, W,
  beginWave, createInitialState, isTargetableAlien, noteButtonRects, noteForKeyboardInput, tick, toViewState,
  type CeremonyToneAck, type Difficulty, type EngineEvent, type GameState, type InputMode,
  type PendingAttackAnswer, type Phase, type ViewState,
} from './retroBlasterEngine'
import {
  advanceMicVfxFreshness,
  deriveMicLockSignalActive,
  enemyRenderSourceSnapshot,
  render,
  resetEnemyRenderLatches,
  type MicVfxFreshnessState,
} from './retroBlasterRenderer'

const TUTORIAL_KEY = 'retro_tutorial_seen'
const RETRO_DIFFICULTY_KEY = 'retro_difficulty'
const CRT_KEY = 'retro_blaster_crt'
const COLOR_HINTS_KEY = 'retro_blaster_color_hints'
const RADIO_CHECK_NOTE = INTRO_ORDER[0]
const RADIO_CHECK_ROSTER = INTRO_ORDER.slice(0, INITIAL_UNLOCK)

type ShellPhase = Phase | 'readiness'
type ReadinessStatus =
  | 'idle'
  | 'loading-audio'
  | 'awaiting-ear'
  | 'audio-error'
  | 'starting-mic'
  | 'awaiting-voice'
  | 'voice-error'

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
  clockMs: number,
  gameId = `fixture:${clockMs}`,
  memoryEpochMs = 0,
): GameState {
  const store = activeLaneStore(stores, inputMode)
  const reviewed = new Set(
    Object.entries(store).filter(([, memory]) => memory.lastReview > 0).map(([note]) => note)
  )
  const restored: string[] = []
  for (const note of INTRO_ORDER) {
    if (reviewed.has(note)) restored.push(note)
    else break
  }
  const unlocked = restored.length >= INITIAL_UNLOCK
    ? restored
    : INTRO_ORDER.slice(0, INITIAL_UNLOCK) as unknown as string[]
  for (const note of unlocked) {
    if (!store[note]) store[note] = createNote(note)
  }
  const state = createInitialState(difficulty, unlocked, clockMs, gameId)
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
  const readinessGenerationBaselineRef = useRef(0)
  const pendingCeremonyToneAckRef = useRef<CeremonyToneAck | null>(null)
  const ceremonyAttemptIdRef = useRef(0)
  const ceremonyBusyRef = useRef(false)

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
  const [ceremonyMessage, setCeremonyMessage] = useState('')

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

  useEffect(() => { inputModeRef.current = inputMode }, [inputMode])
  useEffect(() => { listeningRef.current = isListening }, [isListening])
  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => () => {
    ++readinessIdRef.current
    readinessBusyRef.current = false
    readinessToneArmedRef.current = false
    ++ceremonyAttemptIdRef.current
    ceremonyBusyRef.current = false
    pendingCeremonyToneAckRef.current = null
  }, [])

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
    const syncActivity = () => {
      visibilityActiveRef.current = document.visibilityState === 'visible'
      focusActiveRef.current = document.hasFocus()
      if (visibilityActiveRef.current && focusActiveRef.current) {
        lastTimeRef.current = performance.now()
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
          setCeremonyMessage('SIGNAL PAUSED - return here, then retry or replay.')
        }
      }
    }
    syncActivity()
    document.addEventListener('visibilitychange', syncActivity)
    window.addEventListener('focus', syncActivity)
    window.addEventListener('blur', syncActivity)
    return () => {
      document.removeEventListener('visibilitychange', syncActivity)
      window.removeEventListener('focus', syncActivity)
      window.removeEventListener('blur', syncActivity)
    }
  }, [])

  useEffect(() => {
    familyStoresRef.current = loadRetroBlasterFamilyStores()
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
    } catch {}
    setCrtEnabled(initialCrt)
    loadPianoSamples()
  }, [])

  const dispatchCeremonyTone = useCallback((ceremonyId: string, note: string) => {
    const live = stateRef.current?.introductionCeremony
    if (!live || live.ceremonyId !== ceremonyId || live.note !== note) return false
    const active = document.visibilityState === 'visible' && document.hasFocus()
    const readiness = getPianoReadiness(note)
    const dispatched = active && readiness.sampleReady && readiness.contextState === 'running'
    if (dispatched) {
      playPianoNote(note)
      setCeremonyMessage('REFERENCE TONE DISPATCHED - next wave standing by.')
    } else {
      setCeremonyMessage('SIGNAL PATH NOT READY - retry signal.')
    }
    pendingCeremonyToneAckRef.current = { ceremonyId, note, dispatched }
    return dispatched
  }, [])

  const applyEvents = useCallback((events: EngineEvent[], gs: GameState) => {
    for (const event of events) {
      if (applyRetroBlasterFamilyEvent(event, inputModeRef.current, familyStoresRef.current)) continue
      if (event.kind === 'sfx') {
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
          playPianoNote(event.note)
          if (event.guard === 'attack') notePlayTimeRef.current = Date.now()
        }, event.delayMs)
      } else if (event.kind === 'ceremonyToneRequest') {
        setCeremonyMessage('REFERENCE SIGNAL PENDING...')
        dispatchCeremonyTone(event.ceremonyId, event.note)
      } else if (event.kind === 'gameOver') {
        setFinalStats({ score: gs.score, wave: gs.wave, maxCombo: gs.maxCombo })
        if (inputModeRef.current === 'mic') stopListening()
        setPhase('game_over')
      }
    }
  }, [dispatchCeremonyTone, stopListening])

  const gameLoop = useCallback((now: number) => {
    const gs = stateRef.current
    if (!gs) return
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
    const ceremonyToneAck = gameplayActive ? pendingCeremonyToneAckRef.current : null
    if (gameplayActive) pendingCeremonyToneAckRef.current = null
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
    }, dtMs, Math.random)
    stateRef.current = result.state
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
      canvas.dataset.retroRenderSources = JSON.stringify(enemyRenderSourceSnapshot())
      canvas.dataset.retroFormationState = JSON.stringify({
        phase: result.state.phase,
        wave: result.state.wave,
        directorClockMs: result.state.directorClockMs,
        gameId: result.state.gameId,
        introductionCeremony: result.state.introductionCeremony,
        pendingIntroductions: result.state.pendingIntroductions,
        activeAttack: result.state.activeAttack,
        requiredAnswerEventsMs: result.state.requiredAnswerEventsMs,
        lastCompletedWavePacing: result.state.lastCompletedWavePacing,
        ships: result.state.aliens.map(alien => ({
          alienId: alien.alienId,
          visualId: alien.visualId,
          slot: alien.formationSlot,
          x: alien.x,
          y: alien.y,
          formationX: alien.formationX,
          formationY: alien.formationY,
          entering: alien.entering,
          alive: alien.alive,
          flightState: result.state.activeAttack?.alienId === alien.alienId
            ? result.state.activeAttack.phase
            : 'formation',
        })),
      })
      const soulDataset = JSON.stringify(result.state.aliens.map(alien => ({
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
    setDisplayView(result.viewState)
    applyEvents(result.events, result.state)
    if (result.state.phase === 'playing' || result.state.phase === 'ceremony') {
      rafRef.current = requestAnimationFrame(gameLoop)
    }
    else rafRef.current = 0
  }, [applyEvents, livePitchRef, micSourceHealthRef, pitchGenerationRef])

  const buildState = useCallback((): GameState => {
    return buildRetroBlasterState(
      difficulty,
      inputMode,
      familyStoresRef.current,
      performance.now(),
      crypto.randomUUID(),
      Date.now(),
    )
  }, [difficulty, inputMode])

  const prepareEarReadiness = useCallback(async (readinessId = readinessIdRef.current) => {
    if (readinessBusyRef.current || readinessId !== readinessIdRef.current) return
    readinessBusyRef.current = true
    readinessToneArmedRef.current = false
    setReadinessToneArmed(false)
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
      playPianoNote(RADIO_CHECK_NOTE)
      readinessToneArmedRef.current = true
      setReadinessToneArmed(true)
      setReadinessStatus('awaiting-ear')
      setReadinessMessage('SIGNAL C SENT - press C [1].')
    } catch {
      if (readinessId === readinessIdRef.current) {
        setReadinessStatus('audio-error')
        setReadinessMessage('SIGNAL PATH NOT READY - retry audio.')
      }
    } finally {
      if (readinessId === readinessIdRef.current) readinessBusyRef.current = false
    }
  }, [])

  const replayEarReadiness = useCallback(() => {
    if (phaseRef.current !== 'readiness' || inputModeRef.current !== 'click') return
    if (readinessBusyRef.current) return
    const ready = getPianoReadiness(RADIO_CHECK_NOTE)
    const active = document.visibilityState === 'visible' && document.hasFocus()
    if (!active || !ready.sampleReady || ready.contextState !== 'running') {
      void prepareEarReadiness()
      return
    }
    playPianoNote(RADIO_CHECK_NOTE)
    readinessToneArmedRef.current = true
    setReadinessToneArmed(true)
    setReadinessStatus('awaiting-ear')
    setReadinessMessage('SIGNAL C SENT - press C [1].')
  }, [prepareEarReadiness])

  const prepareVoiceReadiness = useCallback(async (readinessId = readinessIdRef.current) => {
    if (readinessBusyRef.current || readinessId !== readinessIdRef.current) return
    readinessBusyRef.current = true
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
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0 }
    if (listeningRef.current) stopListening()
    stateRef.current = null
    pendingAnswerRef.current = null
    pendingCeremonyToneAckRef.current = null
    ++ceremonyAttemptIdRef.current
    ceremonyBusyRef.current = false
    setCeremonyMessage('')
    readinessBusyRef.current = false
    readinessToneArmedRef.current = false
    setReadinessToneArmed(false)
    const readinessId = ++readinessIdRef.current
    phaseRef.current = 'readiness'
    setPhase('readiness')
    if (inputMode === 'mic') void prepareVoiceReadiness(readinessId)
    else void prepareEarReadiness(readinessId)
  }, [inputMode, prepareEarReadiness, prepareVoiceReadiness, stopListening])

  const retryVoiceReadiness = useCallback(() => {
    if (phaseRef.current !== 'readiness' || inputModeRef.current !== 'mic') return
    readinessBusyRef.current = false
    const readinessId = ++readinessIdRef.current
    void prepareVoiceReadiness(readinessId)
  }, [prepareVoiceReadiness])

  const exitReadiness = useCallback(() => {
    ++readinessIdRef.current
    readinessBusyRef.current = false
    readinessToneArmedRef.current = false
    setReadinessToneArmed(false)
    setReadinessStatus('idle')
    setReadinessMessage('')
    pendingAnswerRef.current = null
    pendingCeremonyToneAckRef.current = null
    ++ceremonyAttemptIdRef.current
    ceremonyBusyRef.current = false
    setCeremonyMessage('')
    stateRef.current = null
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0 }
    if (listeningRef.current || inputModeRef.current === 'mic') stopListening()
    phaseRef.current = 'menu'
    setPhase('menu')
  }, [stopListening])

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
    const view = toViewState(gs, inputMode)
    setDisplayView(view)
    phaseRef.current = 'playing'
    setPhase('playing')
    lastTimeRef.current = performance.now()
    rafRef.current = requestAnimationFrame(gameLoop)
  }, [inputMode, startListening, buildState, gameLoop, pitchGenerationRef])

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
        setCeremonyMessage('SIGNAL PATH NOT READY - retry signal.')
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
    ++ceremonyAttemptIdRef.current
    ceremonyBusyRef.current = false
    pendingCeremonyToneAckRef.current = null
    pendingAnswerRef.current = null
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0 }
    if (listeningRef.current || inputModeRef.current === 'mic') stopListening()
    stateRef.current = null
    setDisplayView(null)
    setCeremonyMessage('')
    phaseRef.current = 'menu'
    setPhase('menu')
  }, [stopListening])

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
    if (note !== RADIO_CHECK_NOTE) {
      setReadinessMessage('USE THE NAMED C [1] CONTROL - no score, just a radio check.')
      return
    }
    readinessToneArmedRef.current = false
    setReadinessToneArmed(false)
    startGame()
  }, [startGame])

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
    if (healthy && fresh && heard) startGame()
  }, [phase, inputMode, isListening, micError, pitch, micSourceHealthRef, pitchGenerationRef, startGame])

  useEffect(() => {
    if (phase !== 'readiness' || inputMode !== 'click') return
    const onReadinessKey = (event: KeyboardEvent) => {
      if (!/^[1-4]$/.test(event.key)) return
      event.preventDefault()
      answerEarReadiness(RADIO_CHECK_ROSTER[Number(event.key) - 1])
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

  const replayActiveNote = useCallback(() => {
    const gs = stateRef.current
    if (!gs || gs.phase !== 'playing') return
    const attack = gs.activeAttack
    if (!visibilityActiveRef.current || !focusActiveRef.current ||
        attack?.phase !== 'outbound' || attack.outcome !== null ||
        attack.demandAtMs === null) return
    const alien = gs.aliens.find(candidate => candidate.alienId === attack.alienId)
    if (!isTargetableAlien(alien)) return
    playPianoNote(alien.note)
    notePlayTimeRef.current = Date.now()
  }, [])

  const processHit = useCallback((answeredNote: string) => {
    const gs = stateRef.current
    const attack = gs?.activeAttack
    if (!gs || gs.phase !== 'playing' || pendingAnswerRef.current ||
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
      const note = noteForKeyboardInput(ev.key, gs.unlockedNotes)
      if (note && gs.unlockedNotes.includes(note)) processHit(note)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [processHit, replayActiveNote])

  useEffect(() => {
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  if (phase === 'menu') {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center px-6"
        style={{ fontFamily: 'monospace' }}>
        <h1 className="text-4xl font-black text-[#3FBFB5] mb-2"
          style={{ textShadow: '0 0 20px rgba(60,191,181,0.5)', letterSpacing: '0.2em' }}>
          RETRO BLASTER
        </h1>
        <p className="text-gray-500 text-xs mb-8 tracking-wider">PIXEL-ART EAR TRAINING</p>
        <div className="flex gap-2 mb-3">
          <button onClick={() => setInputMode('click')}
            className="px-4 py-2 text-xs tracking-wider transition-all"
            style={{
              background: inputMode === 'click' ? '#3FBFB5' : '#111',
              color: inputMode === 'click' ? '#000' : '#555',
              border: `1px solid ${inputMode === 'click' ? '#3FBFB5' : '#333'}`,
            }}>
            KEYBOARD
          </button>
          <button onClick={() => setInputMode('mic')}
            className="px-4 py-2 text-xs tracking-wider transition-all"
            style={{
              background: inputMode === 'mic' ? '#8b5cf6' : '#111',
              color: inputMode === 'mic' ? '#fff' : '#555',
              border: `1px solid ${inputMode === 'mic' ? '#8b5cf6' : '#333'}`,
            }}>
            MICROPHONE
          </button>
        </div>
        <div className="flex gap-2 mb-1">
          <button onClick={() => {
            setDifficulty('easy')
            try { localStorage.setItem(RETRO_DIFFICULTY_KEY, 'easy') } catch {}
          }} className="px-4 py-2 text-xs tracking-wider transition-all"
            style={{
              background: difficulty === 'easy' ? '#7dffb0' : '#111',
              color: difficulty === 'easy' ? '#000' : '#555',
              border: `1px solid ${difficulty === 'easy' ? '#7dffb0' : '#333'}`,
            }}>
            EASY
          </button>
          <button onClick={() => {
            setDifficulty('true')
            try { localStorage.setItem(RETRO_DIFFICULTY_KEY, 'true') } catch {}
          }} className="px-4 py-2 text-xs tracking-wider transition-all"
            style={{
              background: difficulty === 'true' ? '#ff6090' : '#111',
              color: difficulty === 'true' ? '#fff' : '#555',
              border: `1px solid ${difficulty === 'true' ? '#ff6090' : '#333'}`,
            }}>
            TRUE PLAY
          </button>
        </div>
        <p className="text-[10px] text-gray-600 mb-6 tracking-wider text-center max-w-xs">
          {difficulty === 'easy'
            ? 'Gentle training — slower descent, fewer aliens, every wave beatable.'
            : 'Full speed — faster ramp, more aliens, harder formations. No mercy.'}
        </p>
        <button onClick={handleInsertCoin}
          className="px-10 py-3 text-lg font-bold tracking-widest transition-all active:scale-95"
          style={{ background: '#3FBFB5', color: '#000', border: '2px solid #5dddd3', boxShadow: '0 0 24px rgba(60,191,181,0.4)' }}>
          INSERT COIN
        </button>
        <button onClick={() => { try { localStorage.removeItem(TUTORIAL_KEY) } catch {}; setPhase('tutorial') }}
          className="mt-4 text-xs text-gray-600 hover:text-gray-400 tracking-wider">
          HOW TO PLAY
        </button>
        <a href="/pitch-defender" className="mt-8 text-xs text-gray-700 hover:text-gray-500 transition-colors tracking-wider">
          ← BACK TO PITCH DEFENDER
        </a>
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
        <p className="text-xs text-gray-500 mb-6 tracking-widest">HOW TO PLAY</p>
        <div className="max-w-lg space-y-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="text-2xl">👾</div>
            <div>
              <div className="text-sm text-[#3FBFB5] font-bold">Aliens are descending</div>
              <div className="text-xs text-gray-400">Each alien plays a musical note. The alien with the glowing <span className="text-yellow-300 font-bold">?</span> is your active target.</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="text-2xl">🔊</div>
            <div>
              <div className="text-sm text-yellow-300 font-bold">Listen, then press the matching key</div>
              <div className="text-xs text-gray-400">When the active alien plays its note, hit the matching number key (or click its colored button) to fire your laser. Press <span className="text-white font-bold">SPACE</span> any time to replay the note.</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="text-2xl">⌨️</div>
            <div>
              <div className="text-sm text-purple-300 font-bold">Keyboard layout</div>
              <div className="mt-1 grid grid-cols-8 gap-1 text-center">
                {[
                  { k: '1', n: 'C' }, { k: '2', n: 'D' }, { k: '3', n: 'E' }, { k: '4', n: 'F' },
                  { k: '5', n: 'G' }, { k: '6', n: 'A' }, { k: '7', n: 'B' }, { k: '8', n: 'C' },
                ].map((x) => (
                  <div key={x.k} className="px-2 py-1 border border-cyan-700 rounded">
                    <div className="text-cyan-300 text-sm font-bold">{x.n}</div>
                    <div className="text-gray-500 text-[9px]">[{x.k}]</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="text-2xl">🛡️</div>
            <div>
              <div className="text-sm text-red-300 font-bold">Wrong answers cost a shield</div>
              <div className="text-xs text-gray-400">You start with 5 shields. A wrong key drops one shield AND replays the correct note so you learn it. Lose all 5 = game over.</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="text-2xl">🐢</div>
            <div>
              <div className="text-sm text-gray-300 font-bold">Aliens come one at a time</div>
              <div className="text-xs text-gray-400">Aliens drop in slowly. EASY mode caps how many are on screen so every wave is beatable. TRUE PLAY ramps up faster — try EASY first.</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="text-2xl">🎯</div>
            <div>
              <div className="text-sm text-cyan-300 font-bold">Aim is automatic</div>
              <div className="text-xs text-gray-400">Sing or click ANY alien&apos;s note — the cannon swings to the most-urgent matching alien and fires. The glowing alien is the one to beat.</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="text-2xl" aria-hidden="true">RADIO</div>
            <div>
              <div className="text-sm text-emerald-300 font-bold">First: a quick radio check</div>
              <div className="text-xs text-gray-400">Keyboard mode sends a visibly named C signal, then asks for C [1]. Microphone mode asks you to hum or sing anything. It is untimed, unscored, and never measures ability.</div>
            </div>
          </div>
        </div>
        <button onClick={finishTutorial}
          className="px-12 py-4 text-lg font-bold tracking-widest transition-all active:scale-95"
          style={{ background: '#3FBFB5', color: '#000', border: '2px solid #5dddd3', boxShadow: '0 0 24px rgba(60,191,181,0.4)' }}>
          START GAME
        </button>
        <button onClick={() => setPhase('menu')}
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
                <span className="text-fuchsia-300">EAR DEFENSE UNIT</span>
                <span className={isEar ? 'text-cyan-300' : 'text-violet-300'}>
                  {isEar ? 'EAR CHANNEL' : 'VOICE CHANNEL'}
                </span>
              </div>
              <div className="retro-readiness-preflight mb-2 text-center text-[11px] font-bold tracking-[0.35em] text-emerald-300">PRE-FLIGHT</div>
              <h2 id="radio-check-title" className="retro-readiness-title mb-3 text-center text-3xl font-black tracking-[0.18em] text-white sm:text-4xl"
                style={{ textShadow: '0 0 18px rgba(94,234,212,0.42)' }}>
                RADIO CHECK
              </h2>
              <p className="retro-readiness-copy mx-auto mb-7 max-w-lg text-center text-xs leading-5 text-gray-400">
                {isEar
                  ? 'Signal C is visibly named. Hear the ping, then operate C [1]. This is a systems check, not a score.'
                  : 'Hum or sing anything. We only need a fresh live signal - no target note, range judgment, or score.'}
              </p>

              {isEar ? (
                <>
                  <div className="retro-readiness-signal mx-auto mb-6 flex h-28 w-28 items-center justify-center border-2 bg-black/70"
                    aria-label="Named radio-check signal C"
                    style={{ borderColor: `hsl(${radioHue}, 80%, 62%)`, boxShadow: `0 0 28px hsla(${radioHue}, 80%, 55%, 0.22)` }}>
                    <span className="text-6xl font-black" style={{ color: `hsl(${radioHue}, 92%, 74%)` }}>C</span>
                  </div>
                  <div className="retro-readiness-grid mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Radio check response controls">
                    {RADIO_CHECK_ROSTER.map((note, index) => {
                      const hue = NOTE_COLORS[note]?.hue ?? 0
                      return (
                        <button key={note} onClick={() => answerEarReadiness(note)}
                          className="min-h-14 border px-3 py-2 text-sm font-bold tracking-wider outline-none transition-transform focus-visible:ring-2 focus-visible:ring-white active:scale-95"
                          style={{
                            color: colorHints ? `hsl(${hue}, 90%, 78%)` : '#e7f5fa',
                            borderColor: colorHints ? `hsl(${hue}, 72%, 55%)` : '#718694',
                            background: colorHints ? `hsla(${hue}, 70%, 30%, 0.18)` : '#111923',
                          }}
                          aria-label={`${note.replace(/\d/, '')}, key ${index + 1}`}>
                          {note.replace(/\d/, '')} <span className="text-[10px] opacity-60">[{index + 1}]</span>
                        </button>
                      )
                    })}
                  </div>
                  <div className="retro-readiness-replay flex flex-wrap justify-center gap-3">
                    <button onClick={replayEarReadiness}
                      className="min-h-11 border border-yellow-300 px-5 py-2 text-xs font-bold tracking-widest text-yellow-200 outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-95">
                      {readinessStatus === 'audio-error' ? 'RETRY AUDIO' : 'PLAY C SIGNAL'}
                    </button>
                  </div>
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
                  <div className="text-center text-sm font-bold tracking-[0.18em] text-violet-200">
                    {voiceSignalActive ? 'SIGNAL HEARD' : 'HUM OR SING ANYTHING'}
                  </div>
                  {(readinessStatus === 'voice-error' || readinessStatus === 'awaiting-voice') && (
                    <div className="mt-5 flex justify-center">
                      <button onClick={retryVoiceReadiness}
                        className="min-h-11 border border-violet-300 px-5 py-2 text-xs font-bold tracking-widest text-violet-200 outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-95">
                        RETRY MIC
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="retro-readiness-message mt-6 min-h-10 border border-white/10 bg-black/60 px-3 py-2 text-center text-[11px] leading-5 tracking-wider text-cyan-100"
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
          <button onClick={() => setPhase('menu')}
            className="px-6 py-2 text-sm text-gray-500 border border-gray-700 tracking-wider active:scale-95 transition-all">
            MENU
          </button>
        </div>
      </div>
    )
  }

  const activeAlien = displayView?.aliens[displayView.spotlightIdx]
  const activeNoteName = activeAlien?.alive ? activeAlien.note.replace(/\d/, '') : null
  const matchProgress = displayView?.charge.fraction ?? 0
  const matchTargetNote = displayView?.charge.targetNote ?? null
  const displayUnlocked = displayView?.hud.unlockedNotes ?? []
  const activeCeremony = displayView?.introductionCeremony ?? null
  const isCeremony = displayView?.phase === 'ceremony' && activeCeremony !== null
  const ceremonyStatus = ceremonyMessage || (
    activeCeremony?.toneStatus === 'acknowledged'
      ? 'REFERENCE TONE DISPATCHED - next wave standing by.'
      : activeCeremony?.toneStatus === 'blocked'
        ? 'SIGNAL PATH NOT READY - retry signal.'
        : 'REFERENCE SIGNAL PENDING...'
  )

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-start pt-3 px-3 overflow-y-auto"
      style={{
        fontFamily: 'monospace',
        background: 'radial-gradient(circle at 50% 0%, #1b0b34 0%, #05010d 42%, #000 82%)',
      }}>
      <div className="w-full max-w-[960px] mb-2 text-center">
        <div className="text-[11px] text-cyan-300 tracking-wider mb-1">
          {isCeremony
            ? 'NEW SIGNAL → reference introduction only → not scored'
            : 'LISTEN FOR THE NOTE → PRESS THE MATCHING KEY (or click its button)'}
        </div>
        <div className="flex justify-center gap-2 flex-wrap text-[10px]">
          {displayUnlocked.map((note, i) => {
            const hue = NOTE_COLORS[note]?.hue ?? 0
            const isActiveNote = activeNoteName === note.replace(/\d/, '')
            return (
              <span key={note} className="px-2 py-0.5 rounded border"
                style={{
                  borderColor: colorHints ? `hsl(${hue}, 70%, 55%)` : isActiveNote ? '#c8f5ff' : '#607080',
                  background: isActiveNote
                    ? colorHints ? `hsla(${hue}, 70%, 35%, 0.6)` : 'rgba(39,78,94,0.72)'
                    : 'transparent',
                  color: colorHints ? `hsl(${hue}, 90%, 75%)` : '#dce9ef',
                  fontWeight: isActiveNote ? 700 : 400,
                }}>
                {note.replace(/\d/, '')}={i + 1}
              </span>
            )
          })}
        </div>
        <div className="text-[10px] text-gray-500 mt-1">
          Active alien is highlighted with <span className="text-yellow-300 font-bold">?</span> · SPACE to replay note
        </div>
      </div>
      <div className="relative w-full max-w-[960px] md:border-2 md:p-3"
        data-retro-cabinet
        style={{
          width: 'min(100%, calc((100dvh - 210px) * 16 / 9 + 28px))',
          borderColor: 'rgba(90,236,255,0.72)',
          background: 'linear-gradient(145deg, rgba(27,12,48,0.96), rgba(4,5,18,0.98))',
          boxShadow: '0 0 0 1px rgba(255,67,219,0.45), 0 0 28px rgba(62,214,255,0.18), inset 0 0 28px rgba(0,0,0,0.85)',
        }}>
        <div className="hidden md:flex items-center justify-between px-1 pb-2 text-[9px] tracking-[0.24em]">
          <span className="text-fuchsia-300">RETRO BLASTER</span>
          <span className="text-cyan-300">EAR DEFENSE UNIT</span>
        </div>
        <div className="relative overflow-hidden border border-cyan-300/30 bg-black"
          style={{ boxShadow: 'inset 0 0 32px rgba(0,0,0,0.82)' }}>
          <canvas ref={canvasRef} width={W} height={H} onClick={handleCanvasClick}
            className="block w-full"
            style={{ imageRendering: 'pixelated', cursor: 'pointer', aspectRatio: `${W} / ${H}`, maxHeight: 'calc(100vh - 210px)' }} />
          {crtEnabled && (
            <div className="absolute inset-0 pointer-events-none" data-retro-crt-overlay aria-hidden="true"
              style={{
                backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0, rgba(0,0,0,0.18) 1px, transparent 1px, transparent 3px), radial-gradient(ellipse at center, transparent 58%, rgba(0,0,0,0.34) 100%)',
                boxShadow: 'inset 0 0 20px rgba(70,231,255,0.08)',
              }} />
          )}
          {isCeremony && activeCeremony && (
            <section className="retro-new-signal pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-end overflow-hidden px-3 pb-2 text-center"
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
                Reference tone dispatched. Signal introduced - not scored.
              </p>
              <div id="new-signal-status" role="status" aria-live="polite"
                className="retro-new-signal-status mb-1 min-h-4 bg-black/75 px-2 text-[10px] font-bold tracking-wide text-cyan-100">
                {ceremonyStatus}
              </div>
              <div className="retro-new-signal-actions pointer-events-auto flex flex-wrap justify-center gap-2">
                <button onClick={() => void retryCeremonySignal()}
                  className="min-h-11 border border-yellow-300 bg-black/85 px-3 py-2 text-[10px] font-bold tracking-widest text-yellow-200 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                  RETRY SIGNAL
                </button>
                <button onClick={replayCeremonySignal}
                  className="min-h-11 border border-cyan-300 bg-black/85 px-3 py-2 text-[10px] font-bold tracking-widest text-cyan-200 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                  REPLAY SIGNAL
                </button>
                <button onClick={quitCeremony}
                  className="min-h-11 border border-slate-500 bg-black/85 px-3 py-2 text-[10px] font-bold tracking-widest text-slate-300 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                  QUIT
                </button>
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
        <button onClick={replayActiveNote}
          className="px-4 py-2 text-xs font-bold tracking-widest active:scale-95 transition-all"
          style={{ background: 'rgba(255,227,76,0.15)', color: '#ffe34c', border: '1px solid #ffe34c' }}>
          🔊 PLAY NOTE [SPACE]
        </button>
        <button onClick={() => {
          if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0 }
          if (inputMode === 'mic') stopListening()
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
      <style>{`
        @media (orientation: landscape) and (max-height: 500px) {
          .retro-new-signal { padding-bottom: 4px; }
          .retro-new-signal-status { position: absolute; bottom: 50px; margin-bottom: 0; font-size: 9px; }
          .retro-new-signal-actions { gap: 4px; }
        }
      `}</style>
    </div>
  )
}
