'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// RhythmClap — Rhythm Sight-Reading / Clap Trainer
// ═══════════════════════════════════════════════════════════════════════════════
//
// Audition prep: they hand you a rhythm sheet, you clap it.
// No pitch — pure timing. Tap/click/spacebar in time with scrolling rhythm.
//
// Features:
// - Rhythm notation on a single percussion line
// - Metronome click track (toggleable)
// - Tap scoring: early / on-time / late / missed
// - Random rhythm generation by difficulty
// - Load rhythms from MusicXML (extract timing, ignore pitch)
// - Visual "now line" with scrolling notation (Synthesia-style for rhythm)
// - Progressive difficulty: quarters → eighths → syncopation → ties → triplets
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useEffect } from 'react'
import { initAudio } from './audioEngine'

// ─── Types ──────────────────────────────────────────────────────────────────

type Difficulty = 'basic' | 'intermediate' | 'advanced'
type Phase = 'menu' | 'countdown' | 'playing' | 'results'
type HitQuality = 'perfect' | 'good' | 'early' | 'late' | 'miss'

interface RhythmEvent {
  beat: number          // beat position (0-based, 1.0 = one quarter note)
  duration: number      // in beats (1 = quarter, 0.5 = eighth, 2 = half, etc.)
  type: 'note' | 'rest'
  hitQuality?: HitQuality
  tapTime?: number      // when player tapped (ms offset from perfect)
}

interface RhythmPattern {
  name: string
  timeSignature: [number, number]  // e.g. [4, 4]
  measures: number
  events: RhythmEvent[]
  bpm: number
}

// ─── Note Value Symbols (text-based for simplicity) ─────────────────────────

function noteSymbol(duration: number): string {
  if (duration >= 4) return '𝅝'   // whole
  if (duration >= 2) return '𝅗𝅥'   // half
  if (duration >= 1.5) return '♩.'  // dotted quarter
  if (duration >= 1) return '♩'    // quarter
  if (duration >= 0.75) return '♪.' // dotted eighth
  if (duration >= 0.5) return '♪'  // eighth
  if (duration >= 0.25) return '𝅘𝅥𝅯' // sixteenth
  return '♩'
}

function restSymbol(duration: number): string {
  if (duration >= 4) return '𝄻'
  if (duration >= 2) return '𝄼'
  if (duration >= 1) return '𝄽'
  if (duration >= 0.5) return '𝄾'
  return '𝄿'
}

// ─── Rhythm Generator ───────────────────────────────────────────────────────

function generateRhythm(difficulty: Difficulty, measures: number, bpm: number): RhythmPattern {
  const events: RhythmEvent[] = []
  const beatsPerMeasure = 4

  // Available note values by difficulty
  const noteValues: Record<Difficulty, number[]> = {
    basic: [1, 2],                          // quarters and halves only
    intermediate: [0.5, 1, 1.5, 2],        // add eighths and dotted quarters
    advanced: [0.25, 0.5, 0.75, 1, 1.5, 2, 3], // add sixteenths, dotted, etc.
  }

  // Rest probability by difficulty
  const restProb: Record<Difficulty, number> = {
    basic: 0.1,
    intermediate: 0.15,
    advanced: 0.2,
  }

  const values = noteValues[difficulty]

  for (let m = 0; m < measures; m++) {
    let beatPos = m * beatsPerMeasure
    const measureEnd = (m + 1) * beatsPerMeasure

    while (beatPos < measureEnd) {
      const remaining = measureEnd - beatPos

      // Pick a random note value that fits
      const validValues = values.filter(v => v <= remaining)
      if (validValues.length === 0) break

      const duration = validValues[Math.floor(Math.random() * validValues.length)]
      const isRest = Math.random() < restProb[difficulty]

      events.push({
        beat: beatPos,
        duration,
        type: isRest ? 'rest' : 'note',
      })

      beatPos += duration
    }
  }

  const names: Record<Difficulty, string> = {
    basic: 'Basic Rhythm',
    intermediate: 'Syncopated Rhythm',
    advanced: 'Complex Rhythm',
  }

  return {
    name: names[difficulty],
    timeSignature: [4, 4],
    measures,
    events,
    bpm,
  }
}

// ─── Metronome + SFX ────────────────────────────────────────────────────────

let _metCtx: AudioContext | null = null

function getMetCtx(): AudioContext {
  if (!_metCtx) _metCtx = new AudioContext()
  if (_metCtx.state === 'suspended') _metCtx.resume()
  return _metCtx
}

function playClick(accent: boolean = false) {
  const ctx = getMetCtx()
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(accent ? 1200 : 800, now)
  osc.frequency.exponentialRampToValueAtTime(accent ? 600 : 400, now + 0.03)
  gain.gain.setValueAtTime(accent ? 0.3 : 0.15, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.05)
}

function playTapFeedback(quality: HitQuality) {
  const ctx = getMetCtx()
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  if (quality === 'perfect' || quality === 'good') {
    osc.type = 'sine'
    osc.frequency.setValueAtTime(quality === 'perfect' ? 880 : 660, now)
    gain.gain.setValueAtTime(0.12, now)
  } else {
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(200, now)
    gain.gain.setValueAtTime(0.08, now)
  }
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.08)
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function RhythmClap() {
  const [phase, setPhase] = useState<Phase>('menu')
  const [difficulty, setDifficulty] = useState<Difficulty>('basic')
  const [measures, setMeasures] = useState(4)
  const [bpm, setBpm] = useState(80)
  const [metronome, setMetronome] = useState(true)
  const [countIn, setCountIn] = useState(true)

  const [pattern, setPattern] = useState<RhythmPattern | null>(null)
  const [currentBeat, setCurrentBeat] = useState(0)
  const [countdown, setCountdown] = useState(0)
  const [tapFlash, setTapFlash] = useState(false)
  const [lastQuality, setLastQuality] = useState<HitQuality | null>(null)
  const [stats, setStats] = useState({ perfect: 0, good: 0, early: 0, late: 0, miss: 0, total: 0 })

  // Refs
  const patternRef = useRef<RhythmPattern | null>(null)
  const startTimeRef = useRef(0)
  const nextEventIdxRef = useRef(0)
  const tapWindowRef = useRef<number[]>([])  // timestamps of player taps
  const rafRef = useRef(0)
  const lastMetBeatRef = useRef(-1)
  const statsRef = useRef(stats)

  useEffect(() => { statsRef.current = stats }, [stats])

  // ─── Start Game ───────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    initAudio()
    const p = generateRhythm(difficulty, measures, bpm)
    setPattern(p)
    patternRef.current = p
    nextEventIdxRef.current = 0
    tapWindowRef.current = []
    lastMetBeatRef.current = -1
    setStats({ perfect: 0, good: 0, early: 0, late: 0, miss: 0, total: p.events.filter(e => e.type === 'note').length })

    if (countIn) {
      // 4-beat count-in
      setPhase('countdown')
      setCountdown(4)
      const msPerBeat = 60000 / bpm

      let count = 4
      const countInterval = setInterval(() => {
        count--
        playClick(count === 0)
        setCountdown(count)
        if (count <= 0) {
          clearInterval(countInterval)
          beginPlayback(p)
        }
      }, msPerBeat)
    } else {
      beginPlayback(p)
    }
  }, [difficulty, measures, bpm, countIn])

  const beginPlayback = useCallback((p: RhythmPattern) => {
    startTimeRef.current = performance.now()
    setPhase('playing')
    setCurrentBeat(0)
    playbackLoop()
  }, [])

  // ─── Playback Loop ────────────────────────────────────────────────────
  const playbackLoop = useCallback(() => {
    const p = patternRef.current
    if (!p) return

    const elapsed = performance.now() - startTimeRef.current
    const msPerBeat = 60000 / p.bpm
    const currentBeatPos = elapsed / msPerBeat
    const totalBeats = p.measures * p.timeSignature[0]

    setCurrentBeat(currentBeatPos)

    // Metronome clicks
    if (metronome) {
      const beatInt = Math.floor(currentBeatPos)
      if (beatInt > lastMetBeatRef.current && beatInt < totalBeats) {
        lastMetBeatRef.current = beatInt
        playClick(beatInt % p.timeSignature[0] === 0)
      }
    }

    // Check for missed notes (past the late window)
    const idx = nextEventIdxRef.current
    if (idx < p.events.length) {
      const event = p.events[idx]
      if (event.type === 'note') {
        const eventTimeMs = event.beat * msPerBeat
        const lateThreshold = eventTimeMs + msPerBeat * 0.4 // 40% of a beat late = miss

        if (elapsed > lateThreshold && !event.hitQuality) {
          // Missed
          event.hitQuality = 'miss'
          setStats(prev => ({ ...prev, miss: prev.miss + 1 }))
          setLastQuality('miss')
          nextEventIdxRef.current++
        }
      } else {
        // Rest — auto-advance
        if (elapsed > event.beat * msPerBeat + event.duration * msPerBeat) {
          nextEventIdxRef.current++
        }
      }
    }

    // Check end
    if (currentBeatPos >= totalBeats + 0.5) {
      // Mark any remaining notes as missed
      for (let i = nextEventIdxRef.current; i < p.events.length; i++) {
        if (p.events[i].type === 'note' && !p.events[i].hitQuality) {
          p.events[i].hitQuality = 'miss'
          setStats(prev => ({ ...prev, miss: prev.miss + 1 }))
        }
      }
      setPhase('results')
      return
    }

    rafRef.current = requestAnimationFrame(playbackLoop)
  }, [metronome])

  // ─── Handle Tap ───────────────────────────────────────────────────────
  const handleTap = useCallback(() => {
    if (phase !== 'playing') return
    const p = patternRef.current
    if (!p) return

    const elapsed = performance.now() - startTimeRef.current
    const msPerBeat = p.bpm > 0 ? 60000 / p.bpm : 750

    // Visual flash
    setTapFlash(true)
    setTimeout(() => setTapFlash(false), 100)

    // Find the nearest unscored note event
    const idx = nextEventIdxRef.current
    if (idx >= p.events.length) return

    const event = p.events[idx]
    if (event.type !== 'note' || event.hitQuality) return

    const eventTimeMs = event.beat * msPerBeat
    const offset = elapsed - eventTimeMs // positive = late, negative = early

    // Scoring windows (as fraction of a beat in ms)
    const perfectWindow = msPerBeat * 0.12  // ±12% of beat
    const goodWindow = msPerBeat * 0.25     // ±25% of beat
    const acceptWindow = msPerBeat * 0.4    // ±40% of beat

    let quality: HitQuality
    if (Math.abs(offset) <= perfectWindow) {
      quality = 'perfect'
    } else if (Math.abs(offset) <= goodWindow) {
      quality = 'good'
    } else if (offset < -acceptWindow) {
      // Way too early — don't consume the event
      return
    } else if (Math.abs(offset) <= acceptWindow) {
      quality = offset < 0 ? 'early' : 'late'
    } else {
      return // outside window
    }

    event.hitQuality = quality
    event.tapTime = offset
    playTapFeedback(quality)
    setLastQuality(quality)
    nextEventIdxRef.current++

    setStats(prev => ({ ...prev, [quality]: prev[quality] + 1 }))
  }, [phase])

  // Keyboard + click handlers
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault()
        handleTap()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleTap])

  // Cleanup
  useEffect(() => {
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  // ─── MENU ─────────────────────────────────────────────────────────────
  if (phase === 'menu') {
    return (
      <div className="fixed inset-0 bg-[#08080f] flex flex-col items-center justify-center px-6">
        <h1 className="text-3xl font-black text-white mb-1" style={{ textShadow: '0 0 30px rgba(239,68,68,0.3)' }}>
          RHYTHM CLAP
        </h1>
        <p className="text-gray-500 text-sm mb-6">See the rhythm. Tap it out. Nail the timing.</p>

        {/* Difficulty */}
        <div className="mb-4 w-full max-w-sm">
          <div className="text-xs text-gray-600 uppercase tracking-wider mb-2">Difficulty</div>
          <div className="flex gap-2">
            {([
              { key: 'basic', label: 'Basic', desc: '♩ and 𝅗𝅥 only' },
              { key: 'intermediate', label: 'Intermediate', desc: '+ ♪ and dotted' },
              { key: 'advanced', label: 'Advanced', desc: '+ 𝅘𝅥𝅯 and syncopation' },
            ] as const).map(d => (
              <button key={d.key} onClick={() => setDifficulty(d.key)}
                className="flex-1 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: difficulty === d.key ? 'rgba(239,68,68,0.15)' : 'rgba(20,20,35,0.6)',
                  border: `2px solid ${difficulty === d.key ? 'rgba(239,68,68,0.4)' : 'rgba(40,40,60,0.3)'}`,
                  color: difficulty === d.key ? '#f87171' : '#888',
                }}>
                <div>{d.label}</div>
                <div className="text-[10px] opacity-60 mt-0.5">{d.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* BPM */}
        <div className="mb-4 w-full max-w-sm">
          <div className="flex justify-between mb-1">
            <span className="text-xs text-gray-600">Tempo</span>
            <span className="text-xs text-red-300 font-mono">{bpm} BPM</span>
          </div>
          <input type="range" min={40} max={160} value={bpm}
            onChange={e => setBpm(Number(e.target.value))}
            className="w-full h-1.5 accent-red-500" />
        </div>

        {/* Measures + options */}
        <div className="mb-6 w-full max-w-sm flex gap-4">
          <div className="flex-1">
            <div className="text-xs text-gray-600 mb-1">Measures</div>
            <div className="flex gap-1">
              {[2, 4, 8].map(n => (
                <button key={n} onClick={() => setMeasures(n)}
                  className="flex-1 px-2 py-1 rounded text-xs transition-all"
                  style={{
                    background: measures === n ? 'rgba(239,68,68,0.15)' : 'transparent',
                    border: `1px solid ${measures === n ? 'rgba(239,68,68,0.3)' : 'rgba(40,40,60,0.3)'}`,
                    color: measures === n ? '#f87171' : '#666',
                  }}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={metronome} onChange={() => setMetronome(!metronome)}
                className="w-3.5 h-3.5 accent-red-500" />
              <span className="text-xs text-gray-400">Metronome</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={countIn} onChange={() => setCountIn(!countIn)}
                className="w-3.5 h-3.5 accent-red-500" />
              <span className="text-xs text-gray-400">Count-in</span>
            </label>
          </div>
        </div>

        <button onClick={startGame}
          className="px-10 py-4 rounded-2xl text-xl font-bold text-white transition-all active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
            boxShadow: '0 0 30px rgba(239,68,68,0.3), 0 4px 20px rgba(0,0,0,0.4)',
          }}>
          GO
        </button>

        <a href="/pitch-defender" className="mt-8 text-xs text-gray-600 hover:text-gray-400 transition-colors">
          ← Back to Pitch Defender
        </a>
      </div>
    )
  }

  // ─── COUNTDOWN ────────────────────────────────────────────────────────
  if (phase === 'countdown') {
    return (
      <div className="fixed inset-0 bg-[#08080f] flex items-center justify-center">
        <div className="text-8xl font-black text-white animate-pulse" style={{
          textShadow: '0 0 40px rgba(239,68,68,0.5)',
        }}>
          {countdown}
        </div>
      </div>
    )
  }

  // ─── RESULTS ──────────────────────────────────────────────────────────
  if (phase === 'results' && pattern) {
    const noteEvents = pattern.events.filter(e => e.type === 'note')
    const scored = noteEvents.filter(e => e.hitQuality === 'perfect' || e.hitQuality === 'good')
    const accuracy = noteEvents.length > 0 ? Math.round((scored.length / noteEvents.length) * 100) : 0

    return (
      <div className="fixed inset-0 bg-[#08080f] flex flex-col items-center justify-center px-6">
        <div className="text-4xl font-black text-white mb-3" style={{
          textShadow: accuracy >= 90 ? '0 0 30px rgba(100,255,160,0.4)' : '0 0 20px rgba(255,200,60,0.3)',
        }}>
          {accuracy >= 95 ? 'PERFECT TIMING!' : accuracy >= 80 ? 'SOLID RHYTHM!' : accuracy >= 60 ? 'GETTING THERE' : 'KEEP CLAPPING'}
        </div>

        <div className="grid grid-cols-3 gap-6 mb-4">
          <div className="text-center">
            <div className="text-xs text-gray-500">ACCURACY</div>
            <div className="text-3xl font-bold" style={{ color: accuracy >= 80 ? '#64ffa0' : '#ffc83c' }}>{accuracy}%</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">PERFECT</div>
            <div className="text-3xl font-bold text-green-400">{stats.perfect}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">MISSED</div>
            <div className="text-3xl font-bold text-red-400">{stats.miss}</div>
          </div>
        </div>

        {/* Timing breakdown */}
        <div className="flex gap-2 mb-6">
          {[
            { label: 'Perfect', count: stats.perfect, color: '#4ade80' },
            { label: 'Good', count: stats.good, color: '#a3e635' },
            { label: 'Early', count: stats.early, color: '#fbbf24' },
            { label: 'Late', count: stats.late, color: '#fb923c' },
            { label: 'Miss', count: stats.miss, color: '#f87171' },
          ].map(s => (
            <div key={s.label} className="text-center px-3 py-2 rounded-lg" style={{
              background: `${s.color}10`, border: `1px solid ${s.color}30`,
            }}>
              <div className="text-lg font-bold" style={{ color: s.color }}>{s.count}</div>
              <div className="text-[10px] text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Note-by-note timeline */}
        <div className="flex gap-0.5 mb-6 flex-wrap justify-center max-w-md">
          {noteEvents.map((e, i) => {
            const colors: Record<string, string> = {
              perfect: '#4ade80', good: '#a3e635', early: '#fbbf24', late: '#fb923c', miss: '#f87171',
            }
            return (
              <div key={i} className="w-6 h-6 rounded flex items-center justify-center text-[9px] font-bold"
                style={{
                  background: `${colors[e.hitQuality || 'miss']}20`,
                  border: `1px solid ${colors[e.hitQuality || 'miss']}40`,
                  color: colors[e.hitQuality || 'miss'],
                }}>
                {e.hitQuality === 'perfect' ? '✓' : e.hitQuality === 'good' ? '~' : e.hitQuality === 'miss' ? '✗' : e.hitQuality?.[0]}
              </div>
            )
          })}
        </div>

        <div className="flex gap-3">
          <button onClick={startGame}
            className="px-8 py-3 rounded-xl font-bold text-white active:scale-95 transition-all"
            style={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)' }}>
            NEW RHYTHM
          </button>
          <button onClick={() => setPhase('menu')}
            className="px-6 py-3 rounded-xl font-medium text-gray-400 border border-gray-700 active:scale-95 transition-all">
            MENU
          </button>
        </div>
      </div>
    )
  }

  // ─── PLAYING ──────────────────────────────────────────────────────────
  if (!pattern) return null

  const totalBeats = pattern.measures * pattern.timeSignature[0]
  const progress = currentBeat / totalBeats
  const msPerBeat = 60000 / pattern.bpm
  const noteEvents = pattern.events.filter(e => e.type === 'note')

  // Quality color
  const qualityColors: Record<HitQuality, string> = {
    perfect: '#4ade80', good: '#a3e635', early: '#fbbf24', late: '#fb923c', miss: '#f87171',
  }

  return (
    <div className="fixed inset-0 bg-[#08080f] flex flex-col select-none"
      onClick={handleTap}
      style={{ cursor: 'pointer' }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 pointer-events-none">
        <div className="text-sm text-gray-400 font-mono">
          {Math.floor(currentBeat / pattern.timeSignature[0]) + 1} / {pattern.measures}
        </div>
        <div className="text-sm text-gray-500">
          {stats.perfect + stats.good} / {stats.total}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 mx-4 rounded-full overflow-hidden pointer-events-none" style={{ background: 'rgba(40,40,60,0.4)' }}>
        <div className="h-full rounded-full transition-all" style={{
          width: `${progress * 100}%`,
          background: 'linear-gradient(90deg, #ef4444, #f97316)',
        }} />
      </div>

      {/* Rhythm notation display */}
      <div className="px-4 mt-4 pointer-events-none">
        <div className="relative h-20 overflow-hidden rounded-xl" style={{ background: 'rgba(15,15,25,0.6)' }}>
          {/* Beat grid lines */}
          {Array.from({ length: totalBeats + 1 }).map((_, i) => {
            const x = (i / totalBeats) * 100
            const isMeasure = i % pattern.timeSignature[0] === 0
            return (
              <div key={i} className="absolute top-0 bottom-0" style={{
                left: `${x}%`,
                width: 1,
                background: isMeasure ? 'rgba(100,100,140,0.3)' : 'rgba(60,60,80,0.15)',
              }} />
            )
          })}

          {/* Now line */}
          <div className="absolute top-0 bottom-0 z-10 transition-all" style={{
            left: `${progress * 100}%`,
            width: 2,
            background: '#ef4444',
            boxShadow: '0 0 8px rgba(239,68,68,0.5)',
          }} />

          {/* Rhythm events */}
          {pattern.events.map((event, i) => {
            const x = (event.beat / totalBeats) * 100
            const w = (event.duration / totalBeats) * 100
            const isPast = event.beat < currentBeat
            const isNote = event.type === 'note'

            return (
              <div key={i} className="absolute flex items-center justify-center" style={{
                left: `${x}%`,
                width: `${Math.max(w, 1.5)}%`,
                top: isNote ? '20%' : '35%',
                height: isNote ? '60%' : '30%',
                opacity: isPast ? 0.4 : 1,
              }}>
                {isNote ? (
                  <div className="w-full h-full rounded-lg flex items-center justify-center" style={{
                    background: event.hitQuality
                      ? `${qualityColors[event.hitQuality]}20`
                      : isPast ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.15)',
                    border: `2px solid ${event.hitQuality
                      ? qualityColors[event.hitQuality]
                      : isPast ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.4)'}`,
                  }}>
                    <span className="text-lg" style={{
                      color: event.hitQuality ? qualityColors[event.hitQuality] : '#f87171',
                    }}>
                      {noteSymbol(event.duration)}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-gray-600">{restSymbol(event.duration)}</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Main tap area */}
      <div className="flex-1 flex flex-col items-center justify-center pointer-events-none">
        {/* Tap flash circle */}
        <div className="w-40 h-40 rounded-full flex items-center justify-center transition-all duration-75" style={{
          background: tapFlash
            ? 'radial-gradient(circle, rgba(239,68,68,0.3) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(40,40,60,0.2) 0%, transparent 70%)',
          border: tapFlash ? '3px solid rgba(239,68,68,0.6)' : '2px solid rgba(60,60,80,0.3)',
          boxShadow: tapFlash ? '0 0 40px rgba(239,68,68,0.3)' : 'none',
          transform: tapFlash ? 'scale(0.95)' : 'scale(1)',
        }}>
          <div className="text-center">
            <div className="text-2xl font-bold" style={{
              color: lastQuality ? qualityColors[lastQuality] : '#666',
            }}>
              {lastQuality ? lastQuality.toUpperCase() : 'TAP'}
            </div>
            <div className="text-xs text-gray-600 mt-1">click / spacebar</div>
          </div>
        </div>

        {/* Beat counter */}
        <div className="mt-4 flex gap-2">
          {Array.from({ length: pattern.timeSignature[0] }).map((_, i) => {
            const beatInMeasure = currentBeat % pattern.timeSignature[0]
            const isActive = Math.floor(beatInMeasure) === i
            return (
              <div key={i} className="w-4 h-4 rounded-full transition-all" style={{
                background: isActive ? '#ef4444' : 'rgba(60,60,80,0.3)',
                boxShadow: isActive ? '0 0 8px rgba(239,68,68,0.5)' : 'none',
              }} />
            )
          })}
        </div>
      </div>

      {/* Bottom — stop button */}
      <div className="flex justify-center pb-5 pointer-events-auto">
        <button onClick={(e) => {
          e.stopPropagation()
          if (rafRef.current) cancelAnimationFrame(rafRef.current)
          setPhase('results')
        }} className="px-4 py-2 rounded-xl text-sm text-gray-500 border border-gray-700 active:scale-95">
          Stop
        </button>
      </div>
    </div>
  )
}
