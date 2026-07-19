'use client'

/**
 * FocusRhythmEngine (W1.2) — serves 'focus-pushups' and 'focus-trombone'.
 * Plan: docs/plans/vision-training-interactive-overhaul.md §Tier 1
 *
 * A full-container canvas animates a letter-bearing depth-target card that
 * grows (simulating near approach) and shrinks (far) on a breath-paced
 * rhythm from prescription.bpm. At each far-position hold, a small letter
 * appears on the target; the user taps the matching letter from 3 touch
 * choices. This is a screen-guided companion to the PHYSICAL bead/card drill
 * — the real exercise happens in the user's hand at the same rhythm.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Pause, Play, Volume2, VolumeX, X } from 'lucide-react'
import type { EngineProps, EngineResult } from './types'
import { clampScore } from './types'
import { fitCanvasToElement } from '@/lib/vision/canvasKit'
import { SpeechQueue, playTone, unlockAudio, subscribeSharedMuted, getSharedMuted } from '@/lib/vision/audioKit'

type DepthPhase = 'far-hold' | 'growing' | 'near-hold' | 'shrinking'

const LETTER_POOL = ['C', 'D', 'E', 'F', 'H', 'K', 'N', 'P', 'R', 'S', 'V', 'Z']

function pickLetterChoices(): { target: string; choices: string[] } {
  const pool = [...LETTER_POOL]
  const target = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]
  const distractors: string[] = []
  while (distractors.length < 2) {
    const candidate = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]
    if (candidate) distractors.push(candidate)
  }
  const choices = [target, ...distractors]
  // shuffle
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[choices[i], choices[j]] = [choices[j], choices[i]]
  }
  return { target, choices }
}

function easeInOut(t: number): number {
  return t * t * (3 - 2 * t)
}

const NPC_PROMPT_INTERVAL_SEC = 60

type Flash = 'correct' | 'wrong' | null

export default function FocusRhythmEngine({ exercise, prescription, onProgress, onComplete, onExit }: EngineProps) {
  // bpm is a per-beat rate (matches SaccadeEngine + the doctrine text: "metronome
  // at 50 bpm" / "one respiratory cycle per switch") — each beat is ONE movement
  // (far->near or near->far), not a full round trip. A full rep is 2 beats.
  const bpm = Math.max(6, prescription.bpm || 30)
  const halfSeconds = useMemo(() => (60 / bpm) * (1 / Math.max(0.5, prescription.speedMultiplier || 1)), [bpm, prescription.speedMultiplier])
  const cycleSeconds = halfSeconds * 2
  const holdSeconds = Math.min(halfSeconds * 0.45, 2.5)
  const transitionSeconds = Math.max(0.4, halfSeconds - holdSeconds)
  const targetSeconds = Math.max(30, prescription.targetSeconds || 180)

  const [running, setRunning] = useState(false)
  // T7: read shared mute state directly — see DownshiftEngine.tsx.
  const isMuted = useSyncExternalStore(subscribeSharedMuted, getSharedMuted, getSharedMuted)
  const [finished, setFinished] = useState(false)
  const [elapsedDisplay, setElapsedDisplay] = useState(0)
  const [phaseUi, setPhaseUi] = useState<DepthPhase>('far-hold')
  const [choices, setChoices] = useState<string[]>([])
  const [answered, setAnswered] = useState(false)
  const [flash, setFlash] = useState<Flash>(null)
  const [accuracyPct, setAccuracyPct] = useState(0)
  const [repsCompleted, setRepsCompleted] = useState(0)
  const [cueText, setCueText] = useState('')
  const [npcPromptOpen, setNpcPromptOpen] = useState(false)
  const [npcSlider, setNpcSlider] = useState(15)
  const [npcCm, setNpcCm] = useState<number | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | undefined>(undefined)
  const startRef = useRef<number>(0)
  const pausedAccumRef = useRef<number>(0)
  const pauseStartRef = useRef<number | null>(null)
  const completedRef = useRef(false)
  const elapsedRef = useRef(0)
  const attemptsRef = useRef(0)
  const correctRef = useRef(0)
  const repsRef = useRef(0)
  const npcCmRef = useRef<number | null>(null)
  const lastPhaseRef = useRef<DepthPhase | null>(null)
  const targetLetterRef = useRef('')
  const answeredRef = useRef(false)
  const cueIndexRef = useRef(0)
  const lastCueAtRef = useRef(0)
  const lastNpcPromptMinuteRef = useRef(0)
  const npcPausedForPromptRef = useRef(false)
  const speechRef = useRef<SpeechQueue | null>(null)
  if (!speechRef.current) speechRef.current = new SpeechQueue()

  const checkpoints = exercise.checkpoints.length > 0 ? exercise.checkpoints : [exercise.summary]

  const stopLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = undefined
  }, [])

  useEffect(() => stopLoop, [stopLoop])
  useEffect(() => {
    const queue = speechRef.current
    return () => queue?.stop()
  }, [])

  const finish = useCallback((completedFully: boolean) => {
    if (completedRef.current) return
    completedRef.current = true
    stopLoop()
    setRunning(false)
    setFinished(true)
    speechRef.current?.speak('Session complete. Nice focus work.', { interrupt: true })
    const accuracy = attemptsRef.current > 0 ? (correctRef.current / attemptsRef.current) * 100 : 100
    const completionPct = Math.min(100, (elapsedRef.current / targetSeconds) * 100)
    const score = clampScore(accuracy * 0.7 + completionPct * 0.3)
    const result: EngineResult = {
      exerciseId: exercise.id,
      durationSec: Math.round(elapsedRef.current),
      completed: completedFully,
      score,
      metrics: {
        accuracyPct: Math.round(accuracy),
        npcCm: npcCmRef.current ?? 0,
        tempoBpm: Math.round(bpm),
        repsCompleted: repsRef.current,
      },
    }
    onComplete(result)
  }, [bpm, exercise.id, onComplete, stopLoop, targetSeconds])

  const drawTarget = useCallback((phase: DepthPhase, phaseProgress: number, letter: string, showLetter: boolean) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { width, height } = fitCanvasToElement(canvas)
    ctx.clearRect(0, 0, width, height)

    const cx = width / 2
    const cy = height / 2
    const nearSize = Math.min(width, height) * 0.5
    const farSize = nearSize * 0.32

    let size = farSize
    if (phase === 'far-hold') size = farSize
    else if (phase === 'near-hold') size = nearSize
    else if (phase === 'growing') size = farSize + (nearSize - farSize) * easeInOut(phaseProgress)
    else size = nearSize - (nearSize - farSize) * easeInOut(phaseProgress)

    // Depth guide rings
    ctx.strokeStyle = 'rgba(63,191,181,0.15)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(cx, cy, nearSize * 0.62, 0, Math.PI * 2)
    ctx.stroke()

    // Card
    const half = size / 2
    const radius = Math.max(6, size * 0.12)
    ctx.save()
    ctx.shadowColor = 'rgba(63,191,181,0.45)'
    ctx.shadowBlur = size * 0.18
    ctx.fillStyle = 'rgba(17,24,39,0.92)'
    ctx.strokeStyle = 'rgba(94,234,212,0.85)'
    ctx.lineWidth = Math.max(2, size * 0.02)
    ctx.beginPath()
    ctx.roundRect(cx - half, cy - half, size, size, radius)
    ctx.fill()
    ctx.stroke()
    ctx.restore()

    if (showLetter) {
      ctx.fillStyle = '#f0fdfc'
      ctx.font = `bold ${Math.max(14, size * 0.42)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(letter, cx, cy)
    }
  }, [])

  const tick = useCallback((now: number) => {
    const elapsedMs = now - startRef.current - pausedAccumRef.current
    const elapsedSec = Math.max(0, elapsedMs / 1000)
    elapsedRef.current = elapsedSec

    if (elapsedSec >= targetSeconds) {
      finish(true)
      return
    }

    const cyclePos = elapsedSec % cycleSeconds
    let phase: DepthPhase
    let phaseProgress = 0
    if (cyclePos < holdSeconds) {
      phase = 'far-hold'
      phaseProgress = holdSeconds > 0 ? cyclePos / holdSeconds : 1
    } else if (cyclePos < holdSeconds + transitionSeconds) {
      phase = 'growing'
      phaseProgress = (cyclePos - holdSeconds) / transitionSeconds
    } else if (cyclePos < holdSeconds + transitionSeconds + holdSeconds) {
      phase = 'near-hold'
      phaseProgress = (cyclePos - holdSeconds - transitionSeconds) / holdSeconds
    } else {
      phase = 'shrinking'
      phaseProgress = (cyclePos - holdSeconds * 2 - transitionSeconds) / transitionSeconds
    }

    if (phase !== lastPhaseRef.current) {
      const prevPhase = lastPhaseRef.current
      lastPhaseRef.current = phase
      setPhaseUi(phase)
      playTone(phase === 'far-hold' ? 330 : phase === 'near-hold' ? 440 : 380, 70, isMuted ? 0 : 0.18)

      if (phase === 'far-hold') {
        const { target, choices: opts } = pickLetterChoices()
        targetLetterRef.current = target
        answeredRef.current = false
        attemptsRef.current += 1
        setChoices(opts)
        setAnswered(false)
        setFlash(null)
        if (prevPhase === 'shrinking') {
          repsRef.current += 1
          setRepsCompleted(repsRef.current)
        }
      } else if (phase === 'growing' && !answeredRef.current) {
        // far-hold ended with no answer = timeout
        answeredRef.current = true
        speechRef.current?.speak('Move closer, reset.')
        setFlash(null)
      }

      const accuracy = attemptsRef.current > 0 ? (correctRef.current / attemptsRef.current) * 100 : 100
      setAccuracyPct(Math.round(accuracy))
      onProgress?.({
        accuracyPct: Math.round(accuracy),
        npcCm: npcCmRef.current ?? 0,
        tempoBpm: Math.round(bpm),
        repsCompleted: repsRef.current,
      })
    }

    drawTarget(phase, Math.max(0, Math.min(1, phaseProgress)), targetLetterRef.current, phase === 'far-hold')

    // Cue line rotation + spoken physical instruction, every ~12s
    if (elapsedSec - lastCueAtRef.current >= 12) {
      lastCueAtRef.current = elapsedSec
      const cue = checkpoints[cueIndexRef.current % checkpoints.length]
      cueIndexRef.current += 1
      setCueText(cue)
      speechRef.current?.speak(cue)
    }

    // NPC blur-point prompt, once per ~60s window
    const minuteBucket = Math.floor(elapsedSec / NPC_PROMPT_INTERVAL_SEC)
    if (minuteBucket > lastNpcPromptMinuteRef.current && !npcPausedForPromptRef.current) {
      lastNpcPromptMinuteRef.current = minuteBucket
      npcPausedForPromptRef.current = true
      pauseStartRef.current = performance.now()
      setNpcPromptOpen(true)
      setRunning(false)
      stopLoop()
      return
    }

    setElapsedDisplay(prev => (Math.floor(elapsedSec) !== prev ? Math.floor(elapsedSec) : prev))
    rafRef.current = requestAnimationFrame(tick)
  }, [bpm, checkpoints, cycleSeconds, drawTarget, finish, holdSeconds, isMuted, onProgress, stopLoop, targetSeconds, transitionSeconds])

  const handleStart = () => {
    unlockAudio()
    if (completedRef.current) return
    if (startRef.current === 0) {
      startRef.current = performance.now()
      pausedAccumRef.current = 0
      speechRef.current?.speak(checkpoints[0] || 'Hold your card at arm’s length and follow the rhythm.', { interrupt: true })
    } else if (pauseStartRef.current !== null) {
      pausedAccumRef.current += performance.now() - pauseStartRef.current
      pauseStartRef.current = null
    }
    setRunning(true)
    rafRef.current = requestAnimationFrame(tick)
  }

  const handlePause = () => {
    pauseStartRef.current = performance.now()
    setRunning(false)
    stopLoop()
  }

  const handleFinish = () => {
    finish(elapsedRef.current >= targetSeconds * 0.9)
  }

  const handleChoice = (letter: string) => {
    if (answeredRef.current || phaseUi !== 'far-hold') return
    answeredRef.current = true
    setAnswered(true)
    const correct = letter === targetLetterRef.current
    if (correct) {
      correctRef.current += 1
      setFlash('correct')
      playTone(660, 100, isMuted ? 0 : 0.25)
      speechRef.current?.speak('Nice.')
    } else {
      setFlash('wrong')
      speechRef.current?.speak('Move closer, reset.')
    }
    const accuracy = attemptsRef.current > 0 ? (correctRef.current / attemptsRef.current) * 100 : 100
    setAccuracyPct(Math.round(accuracy))
  }

  const submitNpc = () => {
    npcCmRef.current = npcSlider
    setNpcCm(npcSlider)
    setNpcPromptOpen(false)
    npcPausedForPromptRef.current = false
    handleStart()
  }

  const skipNpc = () => {
    setNpcPromptOpen(false)
    npcPausedForPromptRef.current = false
    handleStart()
  }

  const progressPct = Math.min(100, Math.round((elapsedDisplay / targetSeconds) * 100))
  const showChoices = phaseUi === 'far-hold' && choices.length > 0 && !npcPromptOpen

  return (
    <div className="relative w-full min-h-[80vh] rounded-xl overflow-hidden border border-primary-400/20 shadow-lg bg-gradient-to-br from-gray-800/90 to-gray-900/90 flex flex-col">
      <div className="flex items-center justify-between p-4">
        <button
          onClick={onExit}
          aria-label="Exit exercise"
          className="p-2 rounded-lg bg-gray-800/40 backdrop-blur-sm hover:bg-gray-700/50 text-gray-300 hover:text-white transition-all min-w-11 min-h-11 flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="text-center">
          <h2 className="text-white font-semibold text-lg">{exercise.title}</h2>
          <p className="text-gray-400 text-xs">
            Week {prescription.week || 1} · {Math.round(bpm)} bpm · Accuracy {accuracyPct}%
          </p>
        </div>
        <button
          onClick={() => {
            if (speechRef.current) speechRef.current.muted = !getSharedMuted()
          }}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
          className="p-2 rounded-lg bg-gray-800/40 backdrop-blur-sm hover:bg-gray-700/50 text-gray-300 hover:text-white transition-all min-w-11 min-h-11 flex items-center justify-center"
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>

      <div ref={containerRef} className="relative w-full flex-1" style={{ minHeight: '42vh' }}>
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        {flash && (
          <div
            className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${
              flash === 'correct' ? 'bg-secondary-400/20' : 'bg-red-500/15'
            }`}
          />
        )}
        {!running && !finished && !npcPromptOpen && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/40">
            <p className="text-white text-lg font-medium px-6 text-center">Ready when you are</p>
          </div>
        )}
      </div>

      <p className="text-gray-400 text-sm text-center px-6 py-2 min-h-[2.5rem]">{cueText}</p>

      <div className="px-6 pb-3 min-h-[76px] flex items-center justify-center gap-3">
        {showChoices &&
          choices.map(letter => (
            <button
              key={letter}
              onClick={() => handleChoice(letter)}
              disabled={answered}
              className={`min-w-14 min-h-14 px-4 py-3 rounded-xl text-2xl font-bold border transition-all duration-200 ${
                answered && letter === targetLetterRef.current
                  ? 'bg-secondary-400 border-secondary-300 text-white'
                  : 'bg-gray-700/80 border-primary-400/30 text-white hover:bg-gray-600/80 active:scale-95'
              }`}
            >
              {letter}
            </button>
          ))}
      </div>

      <div className="px-6 pb-4">
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-400 to-secondary-400 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-gray-500 text-xs text-center mt-1">
          {elapsedDisplay}s / {targetSeconds}s · {repsCompleted} reps{npcCm !== null ? ` · NPC ${npcCm}cm` : ''}
        </p>
      </div>

      <div className="flex gap-4 justify-center pb-6">
        {!finished && !npcPromptOpen && (
          <button
            onClick={running ? handlePause : handleStart}
            className={`px-8 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all duration-300 min-h-11 ${
              running ? 'bg-yellow-500 hover:bg-yellow-600 text-gray-900' : 'bg-primary-500 hover:bg-primary-600 text-white'
            }`}
          >
            {running ? (
              <>
                <Pause className="w-5 h-5" /> Pause
              </>
            ) : (
              <>
                <Play className="w-5 h-5" /> {elapsedDisplay > 0 ? 'Resume' : 'Start'}
              </>
            )}
          </button>
        )}
        {!finished && elapsedDisplay > 5 && !npcPromptOpen && (
          <button
            onClick={handleFinish}
            className="px-6 py-3 bg-gray-700/80 hover:bg-gray-600/80 text-white rounded-lg font-semibold transition-all duration-300 min-h-11"
          >
            Finish
          </button>
        )}
      </div>

      {npcPromptOpen && (
        <div className="absolute inset-0 bg-gray-900/95 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 rounded-xl p-6 border border-primary-400/30 shadow-2xl max-w-sm w-full">
            <h3 className="text-white font-semibold text-lg mb-2 text-center">Quick check</h3>
            <p className="text-gray-300 text-sm mb-4 text-center">How close before the letters blur?</p>
            <input
              type="range"
              min={3}
              max={30}
              value={npcSlider}
              onChange={e => setNpcSlider(Number(e.target.value))}
              className="w-full mb-2 accent-primary-400 h-11"
            />
            <p className="text-primary-300 text-center font-semibold mb-4">{npcSlider} cm</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={skipNpc}
                className="px-5 py-3 bg-gray-700/80 hover:bg-gray-600/80 text-white rounded-lg font-semibold min-h-11 transition-all duration-300"
              >
                Skip
              </button>
              <button
                onClick={submitNpc}
                className="px-5 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-semibold min-h-11 transition-all duration-300"
              >
                Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
