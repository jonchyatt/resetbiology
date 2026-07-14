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
import { initAudio, loadPianoSamples, playPianoNote } from './audioEngine'
import {
  H, INITIAL_UNLOCK, MIC_CONFIDENCE_FLOOR, STARTING_SHIELDS, W,
  beginWave, createInitialState, isTargetableAlien, noteButtonRects, noteForKeyboardInput, tick, toViewState,
  type Difficulty, type EngineEvent, type GameState, type InputMode,
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

  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  const reducedMotionRef = useRef(reducedMotion)
  const [phase, setPhase] = useState<Phase>('menu')
  const [inputMode, setInputMode] = useState<InputMode>('click')
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [crtEnabled, setCrtEnabled] = useState(false)
  const [colorHints, setColorHints] = useState(true)
  const [displayView, setDisplayView] = useState<ViewState | null>(null)
  const [finalStats, setFinalStats] = useState({ score: 0, wave: 0, maxCombo: 0 })

  const {
    isListening,
    startListening,
    stopListening,
    pitchRef: livePitchRef,
    micSourceHealthRef,
    pitchGenerationRef,
  } = usePitchDetection({ noiseGateDb: -45 })

  useEffect(() => { inputModeRef.current = inputMode }, [inputMode])
  useEffect(() => { listeningRef.current = isListening }, [isListening])

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
      } else if (event.kind === 'gameOver') {
        setFinalStats({ score: gs.score, wave: gs.wave, maxCombo: gs.maxCombo })
        if (inputModeRef.current === 'mic') stopListening()
        setPhase('game_over')
      }
    }
  }, [stopListening])

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
        directorClockMs: result.state.directorClockMs,
        gameId: result.state.gameId,
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
    if (result.state.phase === 'playing') rafRef.current = requestAnimationFrame(gameLoop)
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
    initAudio()
    if (inputMode === 'mic') startListening()
    const gs = buildState()
    stateRef.current = gs
    const view = toViewState(gs, inputMode)
    setDisplayView(view)
    setPhase('playing')
    lastTimeRef.current = performance.now()
    rafRef.current = requestAnimationFrame(gameLoop)
  }, [inputMode, startListening, buildState, gameLoop, pitchGenerationRef])

  const handleInsertCoin = useCallback(() => {
    let seen = false
    try { seen = localStorage.getItem(TUTORIAL_KEY) === '1' } catch {}
    if (seen) startGame()
    else setPhase('tutorial')
  }, [startGame])

  const finishTutorial = useCallback(() => {
    try { localStorage.setItem(TUTORIAL_KEY, '1') } catch {}
    startGame()
  }, [startGame])

  const replayActiveNote = useCallback(() => {
    const gs = stateRef.current
    if (!gs) return
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
    if (!gs || pendingAnswerRef.current || !visibilityActiveRef.current || !focusActiveRef.current ||
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
    if (!gs || !canvasRef.current) return
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
      if (!gs) return
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
          <button onClick={startGame}
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

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-start pt-3 px-3 overflow-y-auto"
      style={{
        fontFamily: 'monospace',
        background: 'radial-gradient(circle at 50% 0%, #1b0b34 0%, #05010d 42%, #000 82%)',
      }}>
      <div className="w-full max-w-[960px] mb-2 text-center">
        <div className="text-[11px] text-cyan-300 tracking-wider mb-1">
          LISTEN FOR THE NOTE → PRESS THE MATCHING KEY (or click its button)
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
        </div>
      </div>
      {inputMode === 'mic' && matchProgress > 0 && (
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
      <div className="hidden" data-retro-roster-state
        data-visual-kinds={displayView?.aliens.filter(alien => alien.alive).map(alien => alien.visualKind).join(',') ?? ''}
        data-visual-ids={displayView?.aliens.filter(alien => alien.alive).map(alien => alien.visualId).join(',') ?? ''}>
        {displayView?.hud.score}{displayView?.hud.wave}{displayView?.hud.combo}{displayView?.hud.shields}{STARTING_SHIELDS}
      </div>
    </div>
  )
}
