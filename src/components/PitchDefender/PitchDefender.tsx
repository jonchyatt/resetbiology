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
  checkAlienEscaped, ensureNoteMemory,
} from './gameEngine'
import Alien from './Alien'
import NoteButtons from './NoteButtons'
import PitchGuidance from './PitchGuidance'
import StaffDisplay from './StaffDisplay'
import GameHUD from './GameHUD'
import WaveIntro from './WaveIntro'
import GameOver from './GameOver'
import { usePitchDetection, notesMatch } from './usePitchDetection'
import './animations.css'

export type GameMode = 'noteBlaster' | 'echoCannon' | 'staffDefender'

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
  const [gameMode, setGameMode] = useState<GameMode>('noteBlaster')
  const [screenShake, setScreenShake] = useState(false)
  const [lockProgress, setLockProgress] = useState(0)
  const [laser, setLaser] = useState<{ fromX: number; fromY: number; toX: number; toY: number; hue: number } | null>(null)
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; tx: number; ty: number; size: number; hue: number; duration: number }[]>([])

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
  const particleIdRef = useRef(0)
  const notePlayTimeRef = useRef(0)
  const lockStartRef = useRef(0)          // when pitch lock began
  const lockDurationRef = useRef(600)     // ms needed to hold pitch (beginner: 600ms)

  // Pitch detection for Echo Cannon mode
  const { isListening, pitch, error: micError, pitchRef: livePitchRef, startListening, stopListening } = usePitchDetection()
  const countdownTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])

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

    // ─── Echo Cannon: check pitch match ─────────────────────────────────
    if (gameMode === 'echoCannon') {
      const activeAlien = s.aliens.find(a => a.lifecycle === 'descending')
      const currentPitch = livePitchRef.current
      if (activeAlien && currentPitch?.isActive) {
        const isMatch = notesMatch(currentPitch.note, activeAlien.note, {
          octaveFlexible: true, // beginner: any octave counts
          centsThreshold: 50,
        }) && Math.abs(currentPitch.cents) <= 50

        if (isMatch) {
          if (lockStartRef.current === 0) lockStartRef.current = Date.now()
          const held = Date.now() - lockStartRef.current
          const progress = Math.min(held / lockDurationRef.current, 1)
          setLockProgress(progress)

          if (progress >= 1) {
            // FIRE! Treat as correct answer
            lockStartRef.current = 0
            setLockProgress(0)
            handleAnswerInner(activeAlien.note)
          }
        } else {
          lockStartRef.current = 0
          setLockProgress(0)
        }
      } else {
        lockStartRef.current = 0
        setLockProgress(0)
      }
    }
  }, [gameMode])

  // ─── Start Game ──────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    // Clear ALL pending timers to prevent ghost callbacks from previous game
    countdownTimersRef.current.forEach(clearTimeout)
    countdownTimersRef.current = []
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
    if (spawnTimerRef.current) { clearTimeout(spawnTimerRef.current); spawnTimerRef.current = null }

    getAudioCtx()
    // Start microphone for Echo Cannon
    if (gameMode === 'echoCannon') startListening()
    setState({ ...createInitialState(), phase: 'countdown' })
    setStarPreset('darkWorld1')
    setCountdown(3)

    countdownTimersRef.current = [
      setTimeout(() => setCountdown(2), 1000),
      setTimeout(() => setCountdown(1), 2000),
      setTimeout(() => { setCountdown(null); startWave(1) }, 3000),
    ]
  }, [])

  // ─── World → Star Nest preset mapping ────────────────────────────────────
  const WORLD_PRESETS: Record<string, string> = {
    'Sound Scouts': 'darkWorld1',
    'Frequency Fighters': 'greenNebula1',
    'Echo Station': 'hotSuns',
    'Harmonic Ridge': 'purple2',
    'The Frontier': 'crazyFractal',
  }

  // ─── Start Wave ──────────────────────────────────────────────────────────
  const startWave = useCallback((waveNum: number) => {
    const config = getWaveConfig(waveNum)

    // Ensure FSRS memory exists for all unlocked notes
    const currentState = stateRef.current
    fsrsRef.current = ensureNoteMemory(fsrsRef.current, currentState.unlockedNotes)

    // Change skybox per world
    setStarPreset(WORLD_PRESETS[config.worldName] ?? 'darkWorld1')

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

      // Play note for first/new active alien (skip in Staff Defender — player reads notation)
      if (isFirstAlien && gameMode !== 'staffDefender') {
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
      // Number keys → octave 4
      '1': 'C4', '2': 'D4', '3': 'E4', '4': 'F4',
      '5': 'G4', '6': 'A4', '7': 'B4', '8': 'C5',
      // Letter keys → octave 4
      'c': 'C4', 'd': 'D4', 'e': 'E4', 'f': 'F4',
      'g': 'G4', 'a': 'A4', 'b': 'B4',
      // Shift+letter → octave 3
      'C': 'C3', 'D': 'D3', 'E': 'E3', 'F': 'F3',
      'G': 'G3', 'A': 'A3', 'B': 'B3',
    }
    function onKeyDown(ev: KeyboardEvent) {
      const note = keyMap[ev.key] || keyMap[ev.key.toLowerCase()]
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
    if (processingRef.current) return
    processingRef.current = true
    setTimeout(() => { processingRef.current = false }, 120)

    // Read state snapshot for decision-making
    const s = stateRef.current
    if (s.phase !== 'wave_active') { processingRef.current = false; return }

    // Find the first DESCENDING alien
    const alien = s.aliens.find(a => a.lifecycle === 'descending')
    if (!alien) { processingRef.current = false; return }

    const correct = answeredNote === alien.note
    const latency = notePlayTimeRef.current > 0 ? Date.now() - notePlayTimeRef.current : 2000
    const alienId = alien.id
    const alienNote = alien.note

    // FSRS grade (side effect — outside setState)
    const grade = autoGrade(correct, latency)
    if (!fsrsRef.current[alienNote]) fsrsRef.current[alienNote] = createNote(alienNote)
    fsrsRef.current[alienNote] = reviewNote(fsrsRef.current[alienNote], grade)
    try { localStorage.setItem(FSRS_KEY, JSON.stringify(fsrsRef.current)) } catch {}

    if (correct) {
      // ─── CORRECT — side effects first ───
      playSfx('correct')
      setTimeout(() => playSfx('explosion'), 100)
      setLastCorrectNote(answeredNote)
      setTimeout(() => setLastCorrectNote(null), 300)
      setShowScorePop(true)
      setTimeout(() => setShowScorePop(false), 300)

      // Laser beam + explosion particles — DOM measurement for exact visual position
      const fieldEl2 = fieldRef.current
      const alienEl = fieldEl2?.querySelector(`[data-alien-id="${alienId}"]`)
      if (fieldEl2 && alienEl) {
        const fieldRect = fieldEl2.getBoundingClientRect()
        const alienRect = alienEl.getBoundingClientRect()
        const ax = alienRect.left - fieldRect.left + alienRect.width / 2
        const ay = alienRect.top - fieldRect.top + alienRect.height / 2
        const fx = fieldRect.width / 2
        const fy = fieldRect.height

        setLaser({ fromX: fx, fromY: fy, toX: ax, toY: ay, hue: alien.noteHue })
        setTimeout(() => setLaser(null), 350)

        const newIds: number[] = []
        const newParts: typeof particles = []
        for (let i = 0; i < 16; i++) {
          const angle = (i / 16) * Math.PI * 2 + (Math.random() - 0.5) * 0.5
          const dist = 30 + Math.random() * 90
          const id = ++particleIdRef.current
          newIds.push(id)
          newParts.push({
            id, x: ax, y: ay,
            tx: Math.cos(angle) * dist,
            ty: Math.sin(angle) * dist,
            size: 2 + Math.random() * 5,
            hue: alien.noteHue,
            duration: 350 + Math.random() * 300,
          })
        }
        setParticles(prev => [...prev, ...newParts])
        setTimeout(() => setParticles(prev => prev.filter(p => !newIds.includes(p.id))), 700)
      }

      // Remove alien after explosion animation
      setTimeout(() => {
        setState(inner => ({ ...inner, aliens: inner.aliens.filter(a => a.id !== alienId) }))
      }, 500)

      // ─── CORRECT — pure state update ───
      setState(prev => {
        const newCombo = prev.combo + 1
        const comboMult = newCombo >= 20 ? 4 : newCombo >= 10 ? 3 : newCombo >= 5 ? 2 : 1
        const scoreGained = 100 * comboMult

        // Floating score
        const fieldEl = fieldRef.current
        if (fieldEl) {
          const fid = ++floatIdRef.current
          setFloatingScores(fs => [...fs, { id: fid, score: scoreGained, x: fieldEl.clientWidth / 2, y: fieldEl.clientHeight / 3 }])
          setTimeout(() => setFloatingScores(fs => fs.filter(f => f.id !== fid)), 800)
        }

        const newAliens = prev.aliens.map(a =>
          a.id === alienId ? { ...a, lifecycle: 'exploding' as const } : a
        )

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
          }
        }

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
          activeAlienIndex: -1, // recalculated by render
        }
      })

      // Post-state side effects
      if (s.unlockedNotes.length < INTRO_ORDER.length) {
        const threshold = UNLOCK_THRESHOLDS[s.unlockedNotes.length] ?? 5
        if (s.consecutiveCorrect + 1 >= threshold) playSfx('levelup')
      }

      // Play next alien's note or spawn one
      const nextAlien = s.aliens.find(a => a.id !== alienId && a.lifecycle === 'descending')
      if (nextAlien) {
        setTimeout(() => playNote(pianoRef.current, nextAlien.note), 400)
        notePlayTimeRef.current = Date.now() + 400
      } else {
        // Cancel any pending spawn timer to prevent double-fire
        if (spawnTimerRef.current) { clearTimeout(spawnTimerRef.current); spawnTimerRef.current = null }
        setTimeout(() => spawnNextAlien(), 150)
      }

    } else {
      // ─── WRONG — side effects first ───
      playSfx('wrong')
      setLastWrongNote(answeredNote)
      setTimeout(() => setLastWrongNote(null), 400)
      setTimeout(() => playNote(pianoRef.current, alienNote), 600)
      notePlayTimeRef.current = Date.now() + 600

      // Flash city damage + screen shake on wrong answer
      setCityFlash(true)
      setTimeout(() => setCityFlash(false), 400)
      setScreenShake(true)
      setTimeout(() => setScreenShake(false), 400)
      playSfx('damage')

      // ─── WRONG — pure state update ───
      setState(prev => {
        const newHealth = Math.max(0, prev.cityHealth - 1)
        if (newHealth <= 0) setTimeout(() => {
          if (stateRef.current.phase === 'wave_active') endGame()
        }, 300)
        return {
          ...prev,
          combo: 0,
          consecutiveCorrect: 0,
          totalAttempts: prev.totalAttempts + 1,
          lastAnswerCorrect: false,
          cityHealth: newHealth,
        }
      })
    }
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
      if (s.phase !== 'wave_complete') return // guard: game already restarted
      if (s.wave >= 10) {
        endGame(true) // Victory!
      } else {
        startWave(s.wave + 1)
      }
    }, 1500)
  }, [startWave])

  // ─── End Game ────────────────────────────────────────────────────────────
  const endGame = useCallback((victory: boolean = false) => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
    if (spawnTimerRef.current) { clearTimeout(spawnTimerRef.current); spawnTimerRef.current = null }

    // Compute high score BEFORE mutating progress
    const s = stateRef.current
    const newHighScore = s.score > progressRef.current.highScore && s.score > 0

    setState(prev => ({ ...prev, phase: 'game_over', didWin: victory, isNewHighScore: newHighScore }))
    setStarPreset('galaxies')
    stopListening()

    // Update progress (after snapshotting high score comparison)
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
    const activeAlien = s.aliens.find(a => a.lifecycle === 'descending')
    if (activeAlien) {
      playNote(pianoRef.current, activeAlien.note)
      notePlayTimeRef.current = Date.now()
    }
  }, [])

  // ─── Render ──────────────────────────────────────────────────────────────
  const config = getWaveConfig(state.wave || 1)
  const fieldHeight = typeof window !== 'undefined' ? window.innerHeight : 700
  const isNewHighScore = state.isNewHighScore

  return (
    <div className="fixed inset-0 overflow-hidden select-none" style={{ background: '#000', animation: screenShake ? 'screenShake 0.4s ease-out' : undefined }}>
      {/* Star Nest Background */}
      <StarNestBackground presetKey={starPreset} />

      {/* City damage flash */}
      {cityFlash && (
        <div className="fixed inset-0 z-40 pointer-events-none"
          style={{ animation: 'cityDamage 0.4s ease-out forwards' }} />
      )}

      {/* Combo intensity border glow */}
      {state.combo >= 5 && state.phase === 'wave_active' && (
        <div className="fixed inset-0 pointer-events-none" style={{
          zIndex: 35,
          boxShadow: `inset 0 0 ${Math.min(30 + state.combo * 3, 80)}px ${
            state.combo >= 20 ? 'rgba(255, 64, 96, 0.3)' :
            state.combo >= 10 ? 'rgba(232, 168, 56, 0.25)' :
            'rgba(114, 194, 71, 0.2)'
          }`,
          animation: 'comboGlow 1.5s ease-in-out infinite',
        }} />
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

          {/* Mode selector */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setGameMode('noteBlaster')}
              className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{
                background: gameMode === 'noteBlaster'
                  ? 'linear-gradient(135deg, #3FBFB5, #2a8a82)'
                  : 'rgba(40, 40, 60, 0.6)',
                color: gameMode === 'noteBlaster' ? 'white' : '#888',
                border: gameMode === 'noteBlaster'
                  ? '2px solid #3FBFB5'
                  : '2px solid rgba(80, 80, 100, 0.3)',
                boxShadow: gameMode === 'noteBlaster' ? '0 0 15px #3FBFB530' : 'none',
              }}
            >
              NOTE BLASTER
              <div className="text-xs font-normal mt-0.5 opacity-70">Tap to identify</div>
            </button>
            <button
              onClick={() => setGameMode('echoCannon')}
              className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{
                background: gameMode === 'echoCannon'
                  ? 'linear-gradient(135deg, #C060E0, #8a3aaa)'
                  : 'rgba(40, 40, 60, 0.6)',
                color: gameMode === 'echoCannon' ? 'white' : '#888',
                border: gameMode === 'echoCannon'
                  ? '2px solid #C060E0'
                  : '2px solid rgba(80, 80, 100, 0.3)',
                boxShadow: gameMode === 'echoCannon' ? '0 0 15px #C060E030' : 'none',
              }}
            >
              ECHO CANNON
              <div className="text-xs font-normal mt-0.5 opacity-70">Sing to destroy</div>
            </button>
            <button
              onClick={() => setGameMode('staffDefender')}
              className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{
                background: gameMode === 'staffDefender'
                  ? 'linear-gradient(135deg, #E8A838, #b87a1a)'
                  : 'rgba(40, 40, 60, 0.6)',
                color: gameMode === 'staffDefender' ? 'white' : '#888',
                border: gameMode === 'staffDefender'
                  ? '2px solid #E8A838'
                  : '2px solid rgba(80, 80, 100, 0.3)',
                boxShadow: gameMode === 'staffDefender' ? '0 0 15px #E8A83830' : 'none',
              }}
            >
              STAFF DEFENDER
              <div className="text-xs font-normal mt-0.5 opacity-70">Read notation</div>
            </button>
          </div>

          <button
            onClick={startGame}
            className="px-10 py-4 rounded-2xl text-xl font-bold text-white transition-all active:scale-95"
            style={{
              background: gameMode === 'echoCannon'
                ? 'linear-gradient(135deg, #C060E0, #8a3aaa)'
                : gameMode === 'staffDefender'
                ? 'linear-gradient(135deg, #E8A838, #b87a1a)'
                : 'linear-gradient(135deg, #3FBFB5, #2a8a82)',
              boxShadow: '0 0 30px rgba(100,100,100,0.3), 0 4px 20px rgba(0,0,0,0.4)',
            }}
          >
            START MISSION
          </button>

          <p className="text-xs text-gray-600 mt-6 text-center">
            {KEYBOARD_ORDER.length} notes &middot; 10 waves &middot; {gameMode === 'echoCannon' ? 'Sing to match pitch' : 'FSRS-powered learning'}
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
            style={{ top: 60, bottom: 120, overflow: 'hidden' }}
          >
            {state.aliens
              .filter(a => a.lifecycle !== 'escaped')
              .map((alien) => {
                const isActiveAlien = alien.lifecycle === 'descending' && alien === state.aliens.find(a => a.lifecycle === 'descending')
                return (
                <div key={alien.id} className="relative">
                  <Alien
                    alien={alien}
                    fieldHeight={fieldHeight - 180}
                    isActive={isActiveAlien}
                    onAnimationEnd={() => {
                      setState(prev => ({
                        ...prev,
                        aliens: prev.aliens.filter(a => a.id !== alien.id),
                      }))
                    }}
                  />
                  {/* Staff display — Staff Defender only, active alien */}
                  {gameMode === 'staffDefender' && isActiveAlien && (
                    <div className="absolute pointer-events-none" style={{ left: -10, top: -10 }}>
                      <StaffDisplay
                        note={alien.note}
                        clef="treble"
                        size={1}
                        glowColor={`hsl(${alien.noteHue}, 80%, 60%)`}
                      />
                    </div>
                  )}
                  {/* Pitch guidance overlay — Echo Cannon only, active alien only */}
                  {gameMode === 'echoCannon' && isActiveAlien && (
                    <PitchGuidance
                      targetNote={alien.note}
                      pitch={pitch}
                      isLocking={lockProgress > 0}
                      lockProgress={lockProgress}
                    />
                  )}
                </div>
              )})}

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

            {/* Laser beam */}
            {laser && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ zIndex: 25, animation: 'laserFlash 0.3s ease-out forwards' }}>
                <line x1={laser.fromX} y1={laser.fromY} x2={laser.toX} y2={laser.toY}
                  stroke={`hsl(${laser.hue}, 70%, 50%)`} strokeWidth="8" opacity="0.3" strokeLinecap="round" />
                <line x1={laser.fromX} y1={laser.fromY} x2={laser.toX} y2={laser.toY}
                  stroke={`hsl(${laser.hue}, 80%, 70%)`} strokeWidth="4" opacity="0.6" strokeLinecap="round" />
                <line x1={laser.fromX} y1={laser.fromY} x2={laser.toX} y2={laser.toY}
                  stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}

            {/* Shockwave ring at impact */}
            {laser && (
              <div className="absolute rounded-full pointer-events-none"
                style={{
                  left: laser.toX, top: laser.toY,
                  width: 100, height: 100,
                  border: `2px solid hsl(${laser.hue}, 80%, 70%)`,
                  zIndex: 26,
                  animation: 'shockwave 0.4s ease-out forwards',
                }} />
            )}

            {/* Explosion particles */}
            {particles.map(p => (
              <div key={p.id} className="absolute rounded-full pointer-events-none"
                style={{
                  left: p.x, top: p.y,
                  width: p.size, height: p.size,
                  background: `hsl(${p.hue}, 80%, 70%)`,
                  boxShadow: `0 0 ${p.size * 2}px hsl(${p.hue}, 80%, 60%)`,
                  '--tx': `${p.tx}px`,
                  '--ty': `${p.ty}px`,
                  animation: `particleFly ${p.duration}ms ease-out forwards`,
                } as React.CSSProperties}
              />
            ))}
          </div>

          {/* Note unlock notification — pointer-events: none so it never blocks buttons */}
          {state.newNoteUnlocked && (
            <div
              className="absolute left-0 right-0 z-30 text-center pointer-events-none"
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

          {/* Bottom panel: Note buttons (Note Blaster) or Mic status (Echo Cannon) */}
          <div className="absolute bottom-0 left-0 right-0 z-20"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 60%, transparent)' }}>

            {gameMode === 'echoCannon' ? (
              /* ── Echo Cannon: mic pitch display ── */
              <div className="text-center py-4 px-4">
                <div className="text-xs uppercase tracking-wider mb-2" style={{
                  color: micError ? '#f87171' : isListening ? '#4ade80' : '#666',
                }}>
                  {micError ? `MIC ERROR: ${micError}` : isListening ? 'LISTENING' : 'MIC OFF'}
                </div>
                {pitch?.isActive ? (
                  <div className="flex items-center justify-center gap-4">
                    <div className="text-3xl font-bold text-white" style={{
                      textShadow: lockProgress > 0
                        ? `0 0 ${10 + lockProgress * 20}px #4ade80`
                        : '0 0 8px rgba(255,255,255,0.3)',
                      color: lockProgress > 0.5 ? '#4ade80' : 'white',
                    }}>
                      {pitch.note}
                    </div>
                    <div className="text-sm" style={{
                      color: Math.abs(pitch.cents) <= 15 ? '#4ade80' : Math.abs(pitch.cents) <= 30 ? '#e8a838' : '#f87171',
                    }}>
                      {pitch.cents > 0 ? '+' : ''}{pitch.cents}c
                    </div>
                    {lockProgress > 0 && (
                      <div className="w-20 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(40,40,60,0.6)' }}>
                        <div className="h-full rounded-full transition-all" style={{
                          width: `${lockProgress * 100}%`,
                          background: lockProgress >= 0.8 ? '#4ade80' : '#3FBFB5',
                          boxShadow: `0 0 8px ${lockProgress >= 0.8 ? '#4ade80' : '#3FBFB5'}`,
                        }} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-lg text-gray-600">Sing a note...</div>
                )}
                <button
                  onClick={replayNote}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-3 py-1 mt-2"
                >
                  TAP TO REPLAY TARGET
                </button>
              </div>
            ) : (
              /* ── Note Blaster: tap buttons ── */
              <>
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
              </>
            )}
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
          didWin={state.didWin}
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
