'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { NOTE_COLORS, createNote, reviewNote, autoGrade, type NoteMemory } from '@/lib/fsrs'
import {
  type GameState, type AlienState, type GameProgress,
  INTRO_ORDER, KEYBOARD_ORDER, UNLOCK_THRESHOLDS,
} from './types'
import {
  createInitialState, getWaveConfig, spawnAlien,
  processAnswer, checkAlienEscaped, ensureNoteMemory,
} from './gameEngine'
import Alien from './Alien'
import NoteButtons from './NoteButtons'
import GameHUD from './GameHUD'
import WaveIntro from './WaveIntro'
import GameOver from './GameOver'
import './animations.css'

// Lazy-load Star Nest (heavy WebGL)
const StarNestBackground = dynamic(() => import('./StarNestBackground'), { ssr: false })

// ─── Storage Keys ────────────────────────────────────────────────────────────
const FSRS_KEY = 'pitch_fsrs_memory'
const PROGRESS_KEY = 'pitch_defender_progress'

// ─── Audio ───────────────────────────────────────────────────────────────────
let _audioCtx: AudioContext | null = null
function getAudioCtx(): AudioContext {
  if (!_audioCtx) _audioCtx = new AudioContext()
  if (_audioCtx.state === 'suspended') _audioCtx.resume()
  return _audioCtx
}

function playSfx(type: 'correct' | 'wrong' | 'levelup' | 'damage' | 'explosion') {
  try {
    const ctx = getAudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    const now = ctx.currentTime

    switch (type) {
      case 'correct':
        osc.type = 'sine'
        osc.frequency.setValueAtTime(880, now)
        osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08)
        gain.gain.setValueAtTime(0.1, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
        osc.start(now); osc.stop(now + 0.15)
        break
      case 'wrong':
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(220, now)
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.15)
        gain.gain.setValueAtTime(0.06, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
        osc.start(now); osc.stop(now + 0.25)
        break
      case 'levelup':
        osc.type = 'sine'
        osc.frequency.setValueAtTime(523, now)
        osc.frequency.setValueAtTime(659, now + 0.1)
        osc.frequency.setValueAtTime(784, now + 0.2)
        osc.frequency.setValueAtTime(1047, now + 0.3)
        gain.gain.setValueAtTime(0.12, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
        osc.start(now); osc.stop(now + 0.5)
        break
      case 'damage':
        osc.type = 'square'
        osc.frequency.setValueAtTime(100, now)
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.3)
        gain.gain.setValueAtTime(0.08, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
        osc.start(now); osc.stop(now + 0.35)
        break
      case 'explosion': {
        // White noise burst
        const bufferSize = ctx.sampleRate * 0.15
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
        const data = buffer.getChannelData(0)
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
        const noise = ctx.createBufferSource()
        noise.buffer = buffer
        const noiseGain = ctx.createGain()
        noise.connect(noiseGain)
        noiseGain.connect(ctx.destination)
        noiseGain.gain.setValueAtTime(0.1, now)
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
        noise.start(now); noise.stop(now + 0.15)
        break
      }
    }
  } catch { /* Audio not available */ }
}

// ─── Piano Sample Loader ─────────────────────────────────────────────────────
async function loadPianoSamples(): Promise<Map<string, AudioBuffer>> {
  const ctx = getAudioCtx()
  const cache = new Map<string, AudioBuffer>()
  const notes = KEYBOARD_ORDER

  await Promise.all(notes.map(async (note) => {
    try {
      const resp = await fetch(`/sounds/nback/piano/${note}.wav`)
      const buf = await resp.arrayBuffer()
      const audio = await ctx.decodeAudioData(buf)
      cache.set(note, audio)
    } catch { /* Skip missing samples */ }
  }))

  return cache
}

function playNote(cache: Map<string, AudioBuffer>, note: string) {
  try {
    const buf = cache.get(note)
    if (!buf) return
    const ctx = getAudioCtx()
    const src = ctx.createBufferSource()
    const gain = ctx.createGain()
    src.buffer = buf
    src.connect(gain)
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5)
    src.start()
  } catch { /* Audio not available */ }
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PitchDefender() {
  const [state, setState] = useState<GameState>(createInitialState)
  const [showScorePop, setShowScorePop] = useState(false)
  const [cityFlash, setCityFlash] = useState(false)
  const [floatingScores, setFloatingScores] = useState<{ id: number; score: number; x: number; y: number }[]>([])
  const [lastCorrectNote, setLastCorrectNote] = useState<string | null>(null)
  const [lastWrongNote, setLastWrongNote] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [starPreset, setStarPreset] = useState('darkWorld1')

  // Refs for mutable data
  const stateRef = useRef(state)
  const pianoRef = useRef<Map<string, AudioBuffer>>(new Map())
  const fsrsRef = useRef<Record<string, NoteMemory>>({})
  const progressRef = useRef<GameProgress>({
    highScore: 0, bestWave: 0, bestCombo: 0,
    totalGamesPlayed: 0, totalAliensDestroyed: 0,
  })
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const spawnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fieldRef = useRef<HTMLDivElement>(null)
  const floatIdRef = useRef(0)
  const notePlayTimeRef = useRef(0)

  // Keep ref in sync
  useEffect(() => { stateRef.current = state }, [state])

  // ─── Load persisted data ─────────────────────────────────────────────────
  useEffect(() => {
    // FSRS memory
    try {
      const raw = localStorage.getItem(FSRS_KEY)
      if (raw) fsrsRef.current = JSON.parse(raw)
    } catch { /* fresh start */ }

    // Game progress
    try {
      const raw = localStorage.getItem(PROGRESS_KEY)
      if (raw) progressRef.current = JSON.parse(raw)
    } catch { /* fresh start */ }

    // Preload piano samples
    loadPianoSamples().then(cache => { pianoRef.current = cache })
  }, [])

  // ─── Persist FSRS memory ─────────────────────────────────────────────────
  const saveFsrs = useCallback(() => {
    try { localStorage.setItem(FSRS_KEY, JSON.stringify(fsrsRef.current)) } catch { /* */ }
  }, [])

  const saveProgress = useCallback(() => {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progressRef.current)) } catch { /* */ }
  }, [])

  // ─── Game Tick (check escapes, wave completion) ──────────────────────────
  const gameTick = useCallback(() => {
    const s = stateRef.current
    if (s.phase !== 'wave_active') return

    let changed = false
    let healthLost = 0
    const updatedAliens = s.aliens.map(alien => {
      if (alien.lifecycle === 'exploding' || alien.lifecycle === 'escaped' || alien.lifecycle === 'hit') {
        return alien
      }
      if (checkAlienEscaped(alien)) {
        changed = true
        healthLost++
        return { ...alien, lifecycle: 'escaped' as const }
      }
      return alien
    })

    if (changed) {
      if (healthLost > 0) {
        playSfx('damage')
        setCityFlash(true)
        setTimeout(() => setCityFlash(false), 400)
      }

      const newHealth = Math.max(0, s.cityHealth - healthLost)

      setState(prev => ({
        ...prev,
        aliens: updatedAliens,
        cityHealth: newHealth,
        combo: 0,
        consecutiveCorrect: 0,
        // Move to next alien if active one escaped
        activeAlienIndex: getNextActiveIndex(updatedAliens, prev.activeAlienIndex),
      }))

      // Play next alien's note
      const nextIdx = getNextActiveIndex(updatedAliens, s.activeAlienIndex)
      if (nextIdx >= 0 && updatedAliens[nextIdx]) {
        setTimeout(() => playNote(pianoRef.current, updatedAliens[nextIdx].note), 300)
        notePlayTimeRef.current = Date.now() + 300
      }

      // Game over check
      if (newHealth <= 0) {
        endGame()
        return
      }
    }

    // Check wave complete
    const livingAliens = s.aliens.filter(a => a.lifecycle !== 'exploding' && a.lifecycle !== 'escaped')
    if (s.aliensSpawned >= s.aliensInWave && livingAliens.length === 0) {
      completeWave()
    }
  }, [])

  // ─── Start Game ──────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    // Ensure audio context is active (requires user gesture)
    getAudioCtx()

    // Countdown
    setState(prev => ({ ...createInitialState(), phase: 'countdown' }))
    setStarPreset('darkWorld1')
    setCountdown(3)

    const c2 = setTimeout(() => setCountdown(2), 1000)
    const c1 = setTimeout(() => setCountdown(1), 2000)
    const go = setTimeout(() => {
      setCountdown(null)
      startWave(1)
    }, 3000)

    return () => { clearTimeout(c2); clearTimeout(c1); clearTimeout(go) }
  }, [])

  // ─── Start Wave ──────────────────────────────────────────────────────────
  const startWave = useCallback((waveNum: number) => {
    const config = getWaveConfig(waveNum)

    // Ensure FSRS memory exists for all unlocked notes
    const currentState = stateRef.current
    fsrsRef.current = ensureNoteMemory(fsrsRef.current, currentState.unlockedNotes)

    setState(prev => ({
      ...prev,
      phase: 'wave_intro',
      wave: waveNum,
      aliens: [],
      activeAlienIndex: -1,
      aliensSpawned: 0,
      aliensInWave: config.alienCount,
      waveScore: 0,
      lastAnswerCorrect: null,
      newNoteUnlocked: null,
    }))
  }, [])

  // ─── Wave Intro Complete → Start Spawning ────────────────────────────────
  const onWaveIntroComplete = useCallback(() => {
    setState(prev => ({ ...prev, phase: 'wave_active' }))

    // Start game tick
    if (tickRef.current) clearInterval(tickRef.current)
    tickRef.current = setInterval(gameTick, 100)

    // Spawn first alien immediately
    spawnNextAlien()
  }, [gameTick])

  // ─── Spawn Next Alien ────────────────────────────────────────────────────
  const spawnNextAlien = useCallback(() => {
    const s = stateRef.current
    const config = getWaveConfig(s.wave)

    if (s.aliensSpawned >= config.alienCount) return

    fsrsRef.current = ensureNoteMemory(fsrsRef.current, s.unlockedNotes)
    const alien = spawnAlien(s, config, fsrsRef.current)

    setState(prev => {
      const newAliens = [...prev.aliens, { ...alien, lifecycle: 'descending' as const }]
      const isFirstAlien = prev.activeAlienIndex < 0

      // Play note for first/new active alien
      if (isFirstAlien) {
        setTimeout(() => playNote(pianoRef.current, alien.note), 400)
        notePlayTimeRef.current = Date.now() + 400
      }

      return {
        ...prev,
        aliens: newAliens,
        aliensSpawned: prev.aliensSpawned + 1,
        activeAlienIndex: isFirstAlien ? newAliens.length - 1 : prev.activeAlienIndex,
      }
    })

    // Schedule next spawn
    if (s.aliensSpawned + 1 < config.alienCount) {
      spawnTimerRef.current = setTimeout(spawnNextAlien, config.spawnInterval)
    }
  }, [])

  // ─── Keyboard Support ─────────────────────────────────────────────────────
  useEffect(() => {
    const keyMap: Record<string, string> = {
      '1': 'C4', '2': 'D4', '3': 'E4', '4': 'F4',
      '5': 'G4', '6': 'A4', '7': 'B4', '8': 'C5',
      'c': 'C4', 'd': 'D4', 'e': 'E4', 'f': 'F4',
      'g': 'G4', 'a': 'A4', 'b': 'B4',
    }
    function onKeyDown(ev: KeyboardEvent) {
      const note = keyMap[ev.key.toLowerCase()]
      if (note && stateRef.current.phase === 'wave_active') {
        handleAnswerInner(note)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // ─── Processing lock to prevent double-clicks ────────────────────────────
  const processingRef = useRef(false)

  // ─── Handle Player Answer ────────────────────────────────────────────────
  const handleAnswerInner = useCallback((answeredNote: string) => {
    // Use functional setState to always read fresh state — no stale refs
    if (processingRef.current) return
    processingRef.current = true
    setTimeout(() => { processingRef.current = false }, 150) // debounce

    setState(prev => {
      if (prev.phase !== 'wave_active') return prev

      // Find the first DESCENDING alien (the active target)
      const alienIdx = prev.aliens.findIndex(a => a.lifecycle === 'descending')
      if (alienIdx < 0) return prev
      const alien = prev.aliens[alienIdx]

      const correct = answeredNote === alien.note
      const latency = notePlayTimeRef.current > 0 ? Date.now() - notePlayTimeRef.current : 2000

      // FSRS grade
      const grade = autoGrade(correct, latency)
      if (!fsrsRef.current[alien.note]) fsrsRef.current[alien.note] = createNote(alien.note)
      fsrsRef.current[alien.note] = reviewNote(fsrsRef.current[alien.note], grade)
      try { localStorage.setItem(FSRS_KEY, JSON.stringify(fsrsRef.current)) } catch {}

      if (correct) {
        // ─── CORRECT ───
        playSfx('correct')
        setTimeout(() => playSfx('explosion'), 100)
        setLastCorrectNote(answeredNote)
        setTimeout(() => setLastCorrectNote(null), 300)
        setShowScorePop(true)
        setTimeout(() => setShowScorePop(false), 300)

        // Floating score
        const comboMult = prev.combo >= 20 ? 4 : prev.combo >= 10 ? 3 : prev.combo >= 5 ? 2 : 1
        const scoreGained = 100 * comboMult
        const fieldEl = fieldRef.current
        if (fieldEl) {
          const fid = ++floatIdRef.current
          setFloatingScores(fs => [...fs, { id: fid, score: scoreGained, x: fieldEl.clientWidth / 2, y: fieldEl.clientHeight / 3 }])
          setTimeout(() => setFloatingScores(fs => fs.filter(f => f.id !== fid)), 800)
        }

        // Mark alien as exploding immediately (no intermediate 'hit' state)
        const newAliens = prev.aliens.map((a, i) =>
          i === alienIdx ? { ...a, lifecycle: 'exploding' as const } : a
        )

        // Remove exploded alien after animation
        setTimeout(() => {
          setState(inner => ({
            ...inner,
            aliens: inner.aliens.filter(a => a.id !== alien.id),
          }))
        }, 500)

        // Find next descending alien and play its note
        const nextAlien = newAliens.find(a => a.lifecycle === 'descending')
        if (nextAlien) {
          setTimeout(() => playNote(pianoRef.current, nextAlien.note), 400)
          notePlayTimeRef.current = Date.now() + 400
        } else {
          // No alien available yet — force spawn
          setTimeout(() => spawnNextAlien(), 200)
        }

        // Check note unlock
        const newConsecutive = prev.consecutiveCorrect + 1
        const currentPool = prev.unlockedNotes.length
        let newUnlocked = prev.unlockedNotes
        let noteUnlocked: string | null = null
        if (currentPool < INTRO_ORDER.length) {
          const threshold = UNLOCK_THRESHOLDS[currentPool] ?? 5
          if (newConsecutive >= threshold) {
            noteUnlocked = INTRO_ORDER[currentPool]
            newUnlocked = [...prev.unlockedNotes, noteUnlocked]
            playSfx('levelup')
          }
        }

        const newCombo = prev.combo + 1
        return {
          ...prev,
          aliens: newAliens,
          score: prev.score + scoreGained,
          combo: newCombo,
          maxCombo: Math.max(prev.maxCombo, newCombo),
          consecutiveCorrect: noteUnlocked ? 0 : newConsecutive,
          totalCorrect: prev.totalCorrect + 1,
          totalAttempts: prev.totalAttempts + 1,
          lastAnswerCorrect: true,
          unlockedNotes: newUnlocked,
          newNoteUnlocked: noteUnlocked,
          waveScore: prev.waveScore + scoreGained,
          activeAlienIndex: newAliens.findIndex(a => a.lifecycle === 'descending'),
        }
      } else {
        // ─── WRONG ───
        playSfx('wrong')
        setLastWrongNote(answeredNote)
        setTimeout(() => setLastWrongNote(null), 400)

        // Replay the correct note
        setTimeout(() => playNote(pianoRef.current, alien.note), 600)
        notePlayTimeRef.current = Date.now() + 600

        return {
          ...prev,
          combo: 0,
          consecutiveCorrect: 0,
          totalAttempts: prev.totalAttempts + 1,
          lastAnswerCorrect: false,
        }
      }
    })
  }, [])

  // Wrap for both click and keyboard use
  const handleAnswer = useCallback((note: string) => handleAnswerInner(note), [handleAnswerInner])

  // ─── Wave Complete ───────────────────────────────────────────────────────
  const completeWave = useCallback(() => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
    if (spawnTimerRef.current) { clearTimeout(spawnTimerRef.current); spawnTimerRef.current = null }

    setState(prev => ({ ...prev, phase: 'wave_complete' }))

    // Brief pause then next wave
    setTimeout(() => {
      const s = stateRef.current
      if (s.wave >= 10) {
        // Victory!
        endGame()
      } else {
        startWave(s.wave + 1)
      }
    }, 1500)
  }, [startWave])

  // ─── End Game ────────────────────────────────────────────────────────────
  const endGame = useCallback(() => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
    if (spawnTimerRef.current) { clearTimeout(spawnTimerRef.current); spawnTimerRef.current = null }

    setState(prev => ({ ...prev, phase: 'game_over' }))
    setStarPreset('galaxies')

    // Update progress
    const s = stateRef.current
    const p = progressRef.current
    p.totalGamesPlayed++
    p.totalAliensDestroyed += s.totalCorrect
    if (s.score > p.highScore) p.highScore = s.score
    if (s.wave > p.bestWave) p.bestWave = s.wave
    if (s.maxCombo > p.bestCombo) p.bestCombo = s.maxCombo
    progressRef.current = p
    saveProgress()
    saveFsrs()
  }, [saveProgress, saveFsrs])

  // ─── Cleanup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
      if (spawnTimerRef.current) clearTimeout(spawnTimerRef.current)
    }
  }, [])

  // ─── Replay note on tap ──────────────────────────────────────────────────
  const replayNote = useCallback(() => {
    const s = stateRef.current
    if (s.activeAlienIndex >= 0 && s.aliens[s.activeAlienIndex]) {
      playNote(pianoRef.current, s.aliens[s.activeAlienIndex].note)
      notePlayTimeRef.current = Date.now()
    }
  }, [])

  // ─── Render ──────────────────────────────────────────────────────────────
  const config = getWaveConfig(state.wave || 1)
  const fieldHeight = typeof window !== 'undefined' ? window.innerHeight - 160 : 600
  const isNewHighScore = state.score > (progressRef.current.highScore ?? 0) && state.score > 0

  return (
    <div className="fixed inset-0 overflow-hidden select-none" style={{ background: '#000' }}>
      {/* Star Nest Background */}
      <StarNestBackground presetKey={starPreset} />

      {/* City damage flash */}
      {cityFlash && (
        <div className="fixed inset-0 z-40 pointer-events-none"
          style={{ animation: 'cityDamage 0.4s ease-out forwards' }} />
      )}

      {/* ─── MENU ──────────────────────────────────────────────────────── */}
      {state.phase === 'menu' && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center px-4">
          <h1
            className="text-5xl font-black text-white mb-2 tracking-wide"
            style={{ textShadow: '0 0 40px #3FBFB560, 0 0 80px #3FBFB530' }}
          >
            PITCH DEFENDER
          </h1>
          <p className="text-gray-400 text-lg mb-8 text-center max-w-sm">
            Defend your city. Identify alien frequencies. Train your ear.
          </p>

          {/* High score */}
          {progressRef.current.highScore > 0 && (
            <div className="text-sm text-gray-500 mb-4">
              High Score: <span className="text-gray-300 font-bold">{progressRef.current.highScore.toLocaleString()}</span>
              {' '}&middot;{' '}Best Wave: <span className="text-gray-300 font-bold">{progressRef.current.bestWave}</span>
            </div>
          )}

          <button
            onClick={startGame}
            className="px-10 py-4 rounded-2xl text-xl font-bold text-white transition-all active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #3FBFB5, #2a8a82)',
              boxShadow: '0 0 30px #3FBFB540, 0 4px 20px rgba(0,0,0,0.4)',
            }}
          >
            START MISSION
          </button>

          <p className="text-xs text-gray-600 mt-6 text-center">
            {KEYBOARD_ORDER.length} notes &middot; 10 waves &middot; FSRS-powered learning
          </p>
        </div>
      )}

      {/* ─── COUNTDOWN ─────────────────────────────────────────────────── */}
      {state.phase === 'countdown' && countdown !== null && (
        <div className="absolute inset-0 z-40 flex items-center justify-center">
          <div
            key={countdown}
            className="text-8xl font-black text-white"
            style={{
              animation: 'countdownPulse 1s ease-out forwards',
              textShadow: '0 0 40px #3FBFB5, 0 0 80px #3FBFB560',
            }}
          >
            {countdown}
          </div>
        </div>
      )}

      {/* ─── WAVE INTRO ────────────────────────────────────────────────── */}
      {state.phase === 'wave_intro' && (
        <WaveIntro
          wave={state.wave}
          worldName={config.worldName}
          worldColor={config.worldColor}
          onComplete={onWaveIntroComplete}
        />
      )}

      {/* ─── GAME ACTIVE ───────────────────────────────────────────────── */}
      {(state.phase === 'wave_active' || state.phase === 'wave_complete') && (
        <>
          <GameHUD
            score={state.score}
            combo={state.combo}
            wave={state.wave}
            worldName={config.worldName}
            worldColor={config.worldColor}
            cityHealth={state.cityHealth}
            maxCityHealth={state.maxCityHealth}
            showScorePop={showScorePop}
          />

          {/* Alien field */}
          <div
            ref={fieldRef}
            className="absolute left-0 right-0"
            style={{ top: 60, bottom: 100, overflow: 'hidden' }}
          >
            {state.aliens
              .filter(a => a.lifecycle !== 'escaped')
              .map((alien, i) => (
                <div key={alien.id} data-alien-id={alien.id}>
                  <Alien
                    alien={alien}
                    fieldHeight={fieldHeight - 160}
                    isActive={state.aliens.indexOf(alien) === state.activeAlienIndex}
                    onAnimationEnd={() => {
                      // Remove fully animated aliens
                      setState(prev => ({
                        ...prev,
                        aliens: prev.aliens.filter(a => a.id !== alien.id),
                      }))
                    }}
                  />
                </div>
              ))}

            {/* Floating score numbers */}
            {floatingScores.map(fs => (
              <div
                key={fs.id}
                className="absolute text-xl font-bold text-yellow-300 pointer-events-none"
                style={{
                  left: fs.x, top: fs.y,
                  animation: 'floatUp 0.8s ease-out forwards',
                  textShadow: '0 0 8px #e8a838',
                  transform: 'translateX(-50%)',
                }}
              >
                +{fs.score}
              </div>
            ))}
          </div>

          {/* Note unlock notification */}
          {state.newNoteUnlocked && (
            <div
              className="absolute left-0 right-0 z-30 text-center"
              style={{ bottom: 110, animation: 'noteUnlock 0.6s ease-out forwards' }}
            >
              <span className="px-4 py-2 rounded-full text-sm font-bold text-white"
                style={{
                  background: `linear-gradient(135deg, hsl(${NOTE_COLORS[state.newNoteUnlocked]?.hue ?? 0}, 70%, 40%), hsl(${NOTE_COLORS[state.newNoteUnlocked]?.hue ?? 0}, 60%, 25%))`,
                  boxShadow: `0 0 20px hsl(${NOTE_COLORS[state.newNoteUnlocked]?.hue ?? 0}, 70%, 50%)60`,
                }}>
                NEW NOTE: {state.newNoteUnlocked}
              </span>
            </div>
          )}

          {/* Bottom panel: Note buttons + replay */}
          <div className="absolute bottom-0 left-0 right-0 z-20"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 60%, transparent)' }}>

            {/* Replay button */}
            <div className="text-center mb-1">
              <button
                onClick={replayNote}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-3 py-1"
                disabled={state.phase !== 'wave_active'}
              >
                TAP TO REPLAY NOTE
              </button>
            </div>

            <NoteButtons
              unlockedNotes={state.unlockedNotes}
              onNoteSelected={handleAnswer}
              disabled={state.phase !== 'wave_active'}
              lastCorrectNote={lastCorrectNote}
              lastWrongNote={lastWrongNote}
            />
          </div>
        </>
      )}

      {/* ─── GAME OVER ─────────────────────────────────────────────────── */}
      {state.phase === 'game_over' && (
        <GameOver
          score={state.score}
          wave={state.wave}
          totalCorrect={state.totalCorrect}
          totalAttempts={state.totalAttempts}
          maxCombo={state.maxCombo}
          unlockedNotes={state.unlockedNotes}
          fsrsMemory={fsrsRef.current}
          isNewHighScore={isNewHighScore}
          onPlayAgain={startGame}
          onMenu={() => setState(createInitialState())}
        />
      )}
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getNextActiveIndex(aliens: AlienState[], currentIdx: number): number {
  // Find next living alien after current
  for (let i = currentIdx + 1; i < aliens.length; i++) {
    if (aliens[i].lifecycle === 'descending' || aliens[i].lifecycle === 'spawning') {
      return i
    }
  }
  // Wrap around
  for (let i = 0; i < aliens.length; i++) {
    if (aliens[i].lifecycle === 'descending' || aliens[i].lifecycle === 'spawning') {
      return i
    }
  }
  return -1
}
