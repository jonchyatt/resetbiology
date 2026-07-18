'use client'

/**
 * DownshiftEngine (W1.1) — serves 'palming-reset' and 'box-breath-vision'.
 * Plan: docs/plans/vision-training-interactive-overhaul.md §Tier 1
 *
 * A large centered breathing orb paces inhale/hold/exhale/hold from the
 * exercise's breathingCue (or the classic 4/4/4/4 box for box-breath-vision).
 * For palming-reset, the surface dims to near-black after a 20s guided intro
 * ("now cup your palms") and pacing continues by VOICE + tone only — the
 * user's eyes are covered, so the screen going dark is the point, not a bug.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Pause, Play, Volume2, VolumeX, X } from 'lucide-react'
import type { EngineProps, EngineResult } from './types'
import { clampScore } from './types'
import { SpeechQueue, playTone, unlockAudio, subscribeSharedMuted, getSharedMuted } from '@/lib/vision/audioKit'

type BreathPhase = 'inhale' | 'hold' | 'exhale' | 'hold2'
type BreathPattern = { inhale: number; hold: number; exhale: number; hold2: number }

const PHASE_LABEL: Record<BreathPhase, string> = {
  inhale: 'Breathe in…',
  hold: 'Hold…',
  exhale: 'Breathe out…',
  hold2: 'Hold…',
}

const PHASE_SPOKEN: Record<BreathPhase, string> = {
  inhale: 'Breathe in',
  hold: 'Hold',
  exhale: 'Breathe out',
  hold2: 'Hold',
}

const PHASE_TONE: Record<BreathPhase, number> = {
  inhale: 392,
  hold: 523,
  exhale: 294,
  hold2: 523,
}

const PHASE_ORDER: BreathPhase[] = ['inhale', 'hold', 'exhale', 'hold2']

/** "Inhale 4 sec nose • hold 2 • exhale 6 through lips." → {4,2,6,0}. box-breath-vision always gets the classic 4/4/4/4 square. */
function parseBreathPattern(exerciseId: string, breathingCue?: string): BreathPattern {
  if (exerciseId === 'box-breath-vision') {
    return { inhale: 4, hold: 4, exhale: 4, hold2: 4 }
  }
  const text = (breathingCue || '').toLowerCase()
  const grab = (keyword: string, fallback: number) => {
    const m = text.match(new RegExp(`${keyword}[^0-9]*(\\d+(?:\\.\\d+)?)`))
    return m ? parseFloat(m[1]) : fallback
  }
  return { inhale: grab('inhale', 4), hold: grab('hold', 2), exhale: grab('exhale', 6), hold2: 0 }
}

function easeInOut(t: number): number {
  return t * t * (3 - 2 * t)
}

const PALMING_DIM_AT_SEC = 20

export default function DownshiftEngine({ exercise, prescription, onProgress, onComplete, onExit }: EngineProps) {
  const isPalming = exercise.id === 'palming-reset'
  const pattern = useMemo(() => parseBreathPattern(exercise.id, exercise.breathingCue), [exercise.id, exercise.breathingCue])
  const phaseOrder = useMemo<BreathPhase[]>(() => PHASE_ORDER.filter(p => pattern[p] > 0), [pattern])
  const cycleSeconds = useMemo(() => phaseOrder.reduce((sum, p) => sum + pattern[p], 0) || 1, [phaseOrder, pattern])
  const targetSeconds = Math.max(30, prescription.targetSeconds || 180)
  const expectedCycles = Math.max(1, Math.round(targetSeconds / cycleSeconds))

  const [running, setRunning] = useState(false)
  // T7: read shared mute state directly (not local state) so this button
  // can't desync from the session-level "Mute coach" control or another
  // engine's mute button — SpeechQueue.muted is a single shared source.
  const isMuted = useSyncExternalStore(subscribeSharedMuted, getSharedMuted, getSharedMuted)
  const [phase, setPhase] = useState<BreathPhase>(phaseOrder[0] ?? 'inhale')
  const [cyclesCompleted, setCyclesCompleted] = useState(0)
  const [elapsedDisplay, setElapsedDisplay] = useState(0)
  const [dimmed, setDimmed] = useState(false)
  const [finished, setFinished] = useState(false)

  const orbRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | undefined>(undefined)
  const startRef = useRef<number>(0)
  const pausedAccumRef = useRef<number>(0)
  const pauseStartRef = useRef<number | null>(null)
  const lastPhaseRef = useRef<BreathPhase | null>(null)
  const lastCycleFloorRef = useRef<number>(0)
  const dimmedFiredRef = useRef(false)
  const completedRef = useRef(false)
  const elapsedRef = useRef(0)
  const cyclesRef = useRef(0)
  const speechRef = useRef<SpeechQueue | null>(null)
  if (!speechRef.current) speechRef.current = new SpeechQueue()

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
    speechRef.current?.speak('Session complete. Well done.', { interrupt: true })
    const result: EngineResult = {
      exerciseId: exercise.id,
      durationSec: Math.round(elapsedRef.current),
      completed: completedFully,
      score: clampScore(100 * (cyclesRef.current / expectedCycles)),
      metrics: { cyclesCompleted: cyclesRef.current, expectedCycles },
    }
    onComplete(result)
  }, [exercise.id, expectedCycles, onComplete, stopLoop])

  const tick = useCallback((now: number) => {
    const elapsedMs = now - startRef.current - pausedAccumRef.current
    const elapsedSec = Math.max(0, elapsedMs / 1000)
    elapsedRef.current = elapsedSec

    if (elapsedSec >= targetSeconds) {
      finish(true)
      return
    }

    const cyclePos = elapsedSec % cycleSeconds
    const cycleFloor = Math.floor(elapsedSec / cycleSeconds)
    if (cycleFloor > lastCycleFloorRef.current) {
      lastCycleFloorRef.current = cycleFloor
      cyclesRef.current = cycleFloor
      setCyclesCompleted(cycleFloor)
    }

    let acc = 0
    let currentPhase: BreathPhase = phaseOrder[0] ?? 'inhale'
    let phaseProgress = 0
    for (const p of phaseOrder) {
      const dur = pattern[p]
      if (cyclePos < acc + dur) {
        currentPhase = p
        phaseProgress = dur > 0 ? (cyclePos - acc) / dur : 1
        break
      }
      acc += dur
    }

    if (currentPhase !== lastPhaseRef.current) {
      lastPhaseRef.current = currentPhase
      setPhase(currentPhase)
      speechRef.current?.speak(PHASE_SPOKEN[currentPhase])
      playTone(PHASE_TONE[currentPhase], 90, isMuted ? 0 : 0.22)
      onProgress?.({ cyclesCompleted: cyclesRef.current, expectedCycles })
    }

    let scale = 0.62
    if (currentPhase === 'inhale') scale = 0.62 + 0.38 * easeInOut(phaseProgress)
    else if (currentPhase === 'hold') scale = 1.0
    else if (currentPhase === 'exhale') scale = 1.0 - 0.38 * easeInOut(phaseProgress)
    if (orbRef.current) {
      orbRef.current.style.transform = `scale(${scale.toFixed(3)})`
      const glow = 0.25 + 0.5 * scale
      orbRef.current.style.boxShadow = `0 0 ${Math.round(60 * scale)}px ${Math.round(20 * scale)}px rgba(63,191,181,${glow.toFixed(2)})`
    }

    if (isPalming && !dimmedFiredRef.current && elapsedSec >= PALMING_DIM_AT_SEC) {
      dimmedFiredRef.current = true
      setDimmed(true)
      speechRef.current?.speak('Now cup your palms gently over your eyes. Keep breathing with the count.', { interrupt: true })
    }

    setElapsedDisplay(prev => (Math.floor(elapsedSec) !== prev ? Math.floor(elapsedSec) : prev))

    rafRef.current = requestAnimationFrame(tick)
  }, [cycleSeconds, expectedCycles, finish, isMuted, isPalming, onProgress, pattern, phaseOrder, targetSeconds])

  const handleStart = () => {
    unlockAudio()
    if (completedRef.current) return
    if (startRef.current === 0) {
      startRef.current = performance.now()
      pausedAccumRef.current = 0
      speechRef.current?.speak(exercise.breathingCue || 'Settle in and follow the orb.', { interrupt: true })
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

  const progressPct = Math.min(100, Math.round((elapsedDisplay / targetSeconds) * 100))
  const cueLine = prescription.coachingCues[0] || exercise.summary

  return (
    <div
      className={`relative w-full min-h-[70vh] rounded-xl overflow-hidden border border-primary-400/20 shadow-lg transition-colors duration-1000 ${
        dimmed ? 'bg-black' : 'bg-gradient-to-br from-gray-800/90 to-gray-900/90'
      }`}
    >
      <div className={`flex items-center justify-between p-4 transition-opacity duration-1000 ${dimmed ? 'opacity-20' : 'opacity-100'}`}>
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
            Week {prescription.week || 1} · Cycle {Math.min(cyclesCompleted + 1, expectedCycles)} of ~{expectedCycles}
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

      <div className="flex flex-col items-center justify-center gap-6" style={{ minHeight: '46vh' }}>
        <div className="relative flex items-center justify-center" style={{ width: 'min(60vw, 280px)', height: 'min(60vw, 280px)' }}>
          <div
            ref={orbRef}
            className="absolute inset-0 rounded-full"
            style={{
              background:
                'radial-gradient(circle at 35% 30%, rgba(94,234,212,0.9), rgba(20,184,166,0.55) 45%, rgba(15,118,110,0.25) 75%, transparent 100%)',
              transform: 'scale(0.62)',
              transition: 'box-shadow 0.2s linear',
            }}
          />
        </div>
        <p className={`text-2xl font-medium tracking-wide transition-colors duration-300 ${dimmed ? 'text-primary-200' : 'text-white'}`}>
          {running || finished ? PHASE_LABEL[phase] : 'Ready when you are'}
        </p>
        {!dimmed && <p className="text-gray-400 text-sm max-w-md text-center px-6">{cueLine}</p>}
      </div>

      <div className={`px-6 pb-4 transition-opacity duration-1000 ${dimmed ? 'opacity-30' : 'opacity-100'}`}>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-400 to-secondary-400 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-gray-500 text-xs text-center mt-1">
          {elapsedDisplay}s / {targetSeconds}s
        </p>
      </div>

      <div className="flex gap-4 justify-center pb-6">
        {!finished && (
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
        {!finished && elapsedDisplay > 5 && (
          <button
            onClick={handleFinish}
            className="px-6 py-3 bg-gray-700/80 hover:bg-gray-600/80 text-white rounded-lg font-semibold transition-all duration-300 min-h-11"
          >
            Finish
          </button>
        )}
      </div>
    </div>
  )
}
