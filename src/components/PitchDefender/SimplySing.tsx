'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// SimplySing — karaoke-style sing-along to Composer-saved songs
// ═══════════════════════════════════════════════════════════════════════════════
//
// Sister to NoteRunner. Built per docs/simply-sing-paradigm.md (Phase 1+2 MVP).
// NOT a NoteRunner rewrite. Both coexist; different pedagogies:
//   NoteRunner   = pause-and-wait staff drill
//   SimplySing   = continuous play-along to a song with pitch trail
//
// Phase 1+2 features (this commit):
//   ✓ Horizontal scrolling pitch ribbons (canvas, 1280x480 logical)
//   ✓ Continuous teal playhead at 35% from left
//   ✓ Loads compositions from pd_composed_* via composerExtract
//   ✓ Backing audio = scheduled piano sampler notes (audioEngine.playPianoNote)
//   ✓ Tempo slider, semitone shift, mic on/off
//   ✓ Mic input via PitchFusion + on-pitch ribbon glow
//   ✓ Pitch trail behind the playhead (last ~1.5s of singer's voice)
//   ✓ Score = % of ribbon-time the singer was on pitch
//
// Phase 3+ (future):
//   - Lyric phrase display (big text at bottom)
//   - Section chips (verse/chorus navigation)
//   - VocalTrainer-uploaded backing audio (instead of just piano)
//   - Voice-range onboarding flow
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useEffect } from 'react'
import { PitchFusion, type FusedPitch } from './pitchFusion'
import { initAudio, loadPianoSamples, playPianoNote, markToneEmitted } from './audioEngine'
import { extractMelodyFromComposition, type ExtractedNote, compositionHasNotes } from './composerExtract'
import { noteToFreq, octaveFoldedCents, PITCH_ON_TOLERANCE_CENTS } from './pitchMath'

// ─── Layout constants (logical pixels) ─────────────────────────────────────

const W = 1280
const H = 480
const TOP_PAD = 60                // top of pitch field (below song title)
const BOTTOM_PAD = 90             // bottom of pitch field (above lyric line)
const FIELD_TOP = TOP_PAD
const FIELD_BOTTOM = H - BOTTOM_PAD
const FIELD_HEIGHT = FIELD_BOTTOM - FIELD_TOP

const PLAYHEAD_X = W * 0.34
const PIXELS_PER_BEAT = 96         // horizontal scale (1 beat = 96 px)
const RIBBON_HEIGHT = 14
const RIBBON_GAP = 6

// Vocal field range — semitones above/below the song's median
const SEMI_RANGE = 18              // ±18 semitones around median

// Pitch trail
const TRAIL_LENGTH_BEATS = 1.6     // seconds-equivalent of trail behind the playhead

// Mic match tolerance — looser than the games (sing-along forgiveness)
const SING_TOLERANCE_CENTS = 90

// ─── Types ──────────────────────────────────────────────────────────────────

interface Song {
  key: string                      // localStorage key
  title: string
  tempoBpm: number
  notes: ExtractedNote[]           // includes rests for timing accuracy
  totalBeats: number
  medianSemi: number               // for centering the field vertically
}

interface PitchTrailPoint {
  beat: number                     // song beat at the time of capture
  semi: number                     // detected pitch (semitones from C4)
  on: boolean                      // true if within tolerance of current ribbon
}

interface RibbonStats {
  onMs: number                     // accumulated time the singer was on-pitch
  totalMs: number                  // accumulated total ribbon time elapsed so far
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
function semiToName(semi: number): string {
  const idx = ((Math.round(semi) % 12) + 12) % 12
  const oct = 4 + Math.floor(semi / 12)
  return `${NOTE_NAMES[idx]}${oct}`
}

function loadAllComposerSongs(): Song[] {
  const out: Song[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key || !key.startsWith('pd_composed_')) continue
    try {
      const comp = JSON.parse(localStorage.getItem(key) || '{}')
      if (!compositionHasNotes(comp)) continue
      const notes = extractMelodyFromComposition(comp, { skipRests: false })
      if (notes.length === 0) continue
      const noteOnly = notes.filter(n => !n.isRest)
      if (noteOnly.length === 0) continue
      const sorted = noteOnly.map(n => n.semi).sort((a, b) => a - b)
      const medianSemi = sorted[Math.floor(sorted.length / 2)]
      const last = notes[notes.length - 1]
      const totalBeats = last.beatOffset + last.beats
      out.push({
        key,
        title: comp.title || 'Untitled',
        tempoBpm: comp.tempoBpm || comp.tempo || 100,
        notes,
        totalBeats,
        medianSemi,
      })
    } catch {}
  }
  out.sort((a, b) => a.title.localeCompare(b.title))
  return out
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function SimplySing() {
  const [phase, setPhase] = useState<'menu' | 'playing' | 'complete'>('menu')
  const [songs, setSongs] = useState<Song[]>([])
  const [selectedSong, setSelectedSong] = useState<Song | null>(null)
  const [playing, setPlaying] = useState(false)
  const [tempoMul, setTempoMul] = useState(1.0)         // 0.5..1.5 multiplier on song's tempo
  const [semitoneShift, setSemitoneShift] = useState(0) // -12..+12 transposition
  const [micEnabled, setMicEnabled] = useState(true)
  const [score, setScore] = useState(0)
  const [progress, setProgress] = useState(0)            // 0..1 fraction of song
  const [finalScore, setFinalScore] = useState(0)

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fusionRef = useRef<PitchFusion | null>(null)
  const pitchRef = useRef<FusedPitch | null>(null)
  const startPerfRef = useRef(0)                         // performance.now() when play started
  const pausedAtBeatRef = useRef(0)                      // beat offset when paused
  const nextNoteIdxRef = useRef(0)                       // next note index to schedule audio for
  const trailRef = useRef<PitchTrailPoint[]>([])
  const ribbonStatsRef = useRef<Map<number, RibbonStats>>(new Map())  // key = note index in song.notes
  const rafRef = useRef(0)
  const lastTickRef = useRef(0)

  // Load composer songs on mount
  useEffect(() => {
    loadPianoSamples()
    setSongs(loadAllComposerSongs())
  }, [])

  // Refresh song list when returning to menu
  useEffect(() => {
    if (phase === 'menu') setSongs(loadAllComposerSongs())
  }, [phase])

  // ─── Mic startup / teardown ───────────────────────────────────────────────
  const startMic = useCallback(async () => {
    if (fusionRef.current) return
    try {
      const fusion = new PitchFusion({ enableML: false, noiseGateDb: -45 })
      fusionRef.current = fusion
      await fusion.start(p => { pitchRef.current = p })
    } catch (err) {
      console.error('[SimplySing] mic start failed:', err)
    }
  }, [])
  const stopMic = useCallback(() => {
    fusionRef.current?.stop()
    fusionRef.current = null
    pitchRef.current = null
  }, [])

  // ─── Start / pause / stop the song ────────────────────────────────────────
  const startSong = useCallback(async (song: Song) => {
    initAudio()
    setSelectedSong(song)
    setPhase('playing')
    setScore(0)
    setProgress(0)
    setFinalScore(0)
    nextNoteIdxRef.current = 0
    trailRef.current = []
    ribbonStatsRef.current.clear()
    pausedAtBeatRef.current = 0
    startPerfRef.current = performance.now()
    setPlaying(true)
    if (micEnabled) await startMic()
    lastTickRef.current = performance.now()
    rafRef.current = requestAnimationFrame(loop)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micEnabled])

  const pauseSong = useCallback(() => {
    if (!selectedSong) return
    const beat = currentBeat(selectedSong)
    pausedAtBeatRef.current = beat
    setPlaying(false)
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0 }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSong])

  const resumeSong = useCallback(() => {
    if (!selectedSong) return
    const beat = pausedAtBeatRef.current
    const beatsPerSec = (selectedSong.tempoBpm * tempoMul) / 60
    startPerfRef.current = performance.now() - (beat / beatsPerSec) * 1000
    setPlaying(true)
    lastTickRef.current = performance.now()
    rafRef.current = requestAnimationFrame(loop)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSong, tempoMul])

  const stopSong = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0 }
    setPlaying(false)
    stopMic()
    setPhase('menu')
  }, [stopMic])

  // ─── Compute current beat from playhead time ──────────────────────────────
  const currentBeat = useCallback((song: Song) => {
    if (!playing) return pausedAtBeatRef.current
    const elapsedMs = performance.now() - startPerfRef.current
    const beatsPerSec = (song.tempoBpm * tempoMul) / 60
    return (elapsedMs / 1000) * beatsPerSec
  }, [playing, tempoMul])

  // ─── Game loop ────────────────────────────────────────────────────────────
  const loop = useCallback(() => {
    const song = selectedSong
    if (!song || !playing) return
    const now = performance.now()
    const dt = now - lastTickRef.current
    lastTickRef.current = now

    const beat = currentBeat(song)
    setProgress(Math.min(1, beat / song.totalBeats))

    // ── Schedule audio: play any notes whose beatOffset has passed since last tick
    while (nextNoteIdxRef.current < song.notes.length) {
      const n = song.notes[nextNoteIdxRef.current]
      if (n.beatOffset > beat) break
      if (!n.isRest) {
        const shifted = n.semi + semitoneShift
        try { playPianoNote(semiToName(shifted)) } catch {}
        markToneEmitted(280)
      }
      nextNoteIdxRef.current++
    }

    // ── Mic match against the current ribbon
    let currentRibbonIdx = -1
    for (let i = 0; i < song.notes.length; i++) {
      const n = song.notes[i]
      if (n.isRest) continue
      if (beat >= n.beatOffset && beat < n.beatOffset + n.beats) {
        currentRibbonIdx = i
        break
      }
    }

    if (currentRibbonIdx >= 0) {
      const target = song.notes[currentRibbonIdx]
      const targetSemi = target.semi + semitoneShift
      const stats = ribbonStatsRef.current.get(currentRibbonIdx) ?? { onMs: 0, totalMs: 0 }
      stats.totalMs += dt

      const p = pitchRef.current
      let onPitch = false
      if (micEnabled && p?.isActive && p.frequency > 0) {
        const targetFreq = noteToFreq(semiToName(targetSemi))
        const cents = octaveFoldedCents(p.frequency, targetFreq)
        onPitch = Math.abs(cents) <= SING_TOLERANCE_CENTS
        // Convert detected freq to a semi value relative to C4 for the trail
        const detectedSemi = 12 * Math.log2(p.frequency / 261.625565)
        trailRef.current.push({ beat, semi: detectedSemi, on: onPitch })
        // Trim trail to TRAIL_LENGTH_BEATS behind the playhead
        const cutoffBeat = beat - TRAIL_LENGTH_BEATS
        while (trailRef.current.length > 0 && trailRef.current[0].beat < cutoffBeat) {
          trailRef.current.shift()
        }
        if (onPitch) stats.onMs += dt
      }
      ribbonStatsRef.current.set(currentRibbonIdx, stats)
    }

    // ── Update score (running average across all touched ribbons)
    let totalOn = 0
    let totalAll = 0
    ribbonStatsRef.current.forEach(s => { totalOn += s.onMs; totalAll += s.totalMs })
    setScore(totalAll > 0 ? Math.round((totalOn / totalAll) * 100) : 0)

    // ── End of song?
    if (beat >= song.totalBeats + 0.5) {
      const final = totalAll > 0 ? Math.round((totalOn / totalAll) * 100) : 0
      setFinalScore(final)
      setPlaying(false)
      stopMic()
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0 }
      setPhase('complete')
      return
    }

    // ── Render ──
    render(song, beat)

    rafRef.current = requestAnimationFrame(loop)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSong, playing, semitoneShift, micEnabled, tempoMul, currentBeat, stopMic])

  // ─── Render ───────────────────────────────────────────────────────────────
  const render = useCallback((song: Song, beat: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#1a0f3d')
    grad.addColorStop(0.5, '#2b1264')
    grad.addColorStop(1, '#3d1a7a')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)

    // Field bounds for vertical pitch mapping
    const fieldMidSemi = song.medianSemi + semitoneShift
    const semiToY = (semi: number): number => {
      const offset = semi - fieldMidSemi
      // Clamp to field
      const clamped = Math.max(-SEMI_RANGE, Math.min(SEMI_RANGE, offset))
      const norm = (clamped + SEMI_RANGE) / (SEMI_RANGE * 2)
      // Higher pitch = lower y (top of screen)
      return FIELD_BOTTOM - norm * FIELD_HEIGHT
    }

    // Faint horizontal gridlines every 12 semis (octave markers)
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 1
    for (let s = -SEMI_RANGE; s <= SEMI_RANGE; s += 12) {
      const y = semiToY(fieldMidSemi + s)
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
      ctx.stroke()
    }

    // ── Ribbons ──
    for (let i = 0; i < song.notes.length; i++) {
      const n = song.notes[i]
      if (n.isRest) continue
      const x = PLAYHEAD_X + (n.beatOffset - beat) * PIXELS_PER_BEAT
      const w = n.beats * PIXELS_PER_BEAT - 4
      if (x + w < -50 || x > W + 50) continue   // off-screen cull

      const y = semiToY(n.semi + semitoneShift) - RIBBON_HEIGHT / 2
      const isCurrent = beat >= n.beatOffset && beat < n.beatOffset + n.beats
      const isPast = beat >= n.beatOffset + n.beats
      const stats = ribbonStatsRef.current.get(i)
      const onPct = stats && stats.totalMs > 0 ? stats.onMs / stats.totalMs : 0

      // Pill body
      let fill: string
      let border: string
      if (isCurrent) {
        // Bright white with a subtle teal hint when on-pitch
        const lit = onPct > 0.5
        fill = lit ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.65)'
        border = '#ffffff'
        if (lit) {
          ctx.shadowColor = '#7df0ff'
          ctx.shadowBlur = 18
        }
      } else if (isPast) {
        // Faded — color reflects accuracy on this ribbon
        const hue = onPct >= 0.7 ? 160 : onPct >= 0.4 ? 50 : 0
        fill = `hsla(${hue}, 70%, 55%, ${0.25 + onPct * 0.35})`
        border = `hsla(${hue}, 80%, 65%, 0.6)`
      } else {
        // Upcoming
        fill = 'rgba(125,240,255,0.18)'
        border = 'rgba(125,240,255,0.5)'
      }
      ctx.fillStyle = fill
      ctx.strokeStyle = border
      ctx.lineWidth = isCurrent ? 2 : 1
      const radius = RIBBON_HEIGHT / 2
      ctx.beginPath()
      // Rounded rect (pill)
      ctx.moveTo(x + radius, y)
      ctx.lineTo(x + w - radius, y)
      ctx.arc(x + w - radius, y + radius, radius, -Math.PI / 2, Math.PI / 2)
      ctx.lineTo(x + radius, y + RIBBON_HEIGHT)
      ctx.arc(x + radius, y + radius, radius, Math.PI / 2, (3 * Math.PI) / 2)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.shadowBlur = 0

      // Lyric syllable below the pill
      if (n.lyric) {
        ctx.fillStyle = isCurrent
          ? 'rgba(255,255,255,0.95)'
          : isPast
          ? 'rgba(255,255,255,0.35)'
          : 'rgba(255,255,255,0.55)'
        ctx.font = '12px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(n.lyric, x + w / 2, y + RIBBON_HEIGHT + 14)
      }
    }

    // ── Pitch trail (singer's voice) ──
    if (trailRef.current.length > 1) {
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      // Two passes: shadow glow under, sharp line on top
      ctx.shadowColor = '#ffffff'
      ctx.shadowBlur = 8
      ctx.beginPath()
      for (let i = 0; i < trailRef.current.length; i++) {
        const pt = trailRef.current[i]
        const x = PLAYHEAD_X + (pt.beat - beat) * PIXELS_PER_BEAT
        const y = semiToY(pt.semi + semitoneShift)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'
      ctx.stroke()
      ctx.shadowBlur = 0
    }

    // ── Playhead vertical line ──
    ctx.strokeStyle = '#3FBFB5'
    ctx.lineWidth = 2
    ctx.shadowColor = '#3FBFB5'
    ctx.shadowBlur = 12
    ctx.beginPath()
    ctx.moveTo(PLAYHEAD_X, FIELD_TOP - 8)
    ctx.lineTo(PLAYHEAD_X, FIELD_BOTTOM + 8)
    ctx.stroke()
    ctx.shadowBlur = 0
    // Sparkle dots top + bottom
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(PLAYHEAD_X, FIELD_TOP - 8, 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(PLAYHEAD_X, FIELD_BOTTOM + 8, 3, 0, Math.PI * 2)
    ctx.fill()

    // ── Top bar: section + title ──
    ctx.fillStyle = 'rgba(0,0,0,0.4)'
    ctx.fillRect(0, 0, W, TOP_PAD)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 22px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(song.title, 24, 36)
    ctx.font = '13px sans-serif'
    ctx.fillStyle = '#a78bfa'
    ctx.fillText(`SCORE  ${score}%`, W - 140, 28)
    ctx.fillStyle = '#7df0ff'
    ctx.fillText(`${Math.round(progress * 100)}% complete`, W - 140, 46)
  }, [score, progress, semitoneShift])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      fusionRef.current?.stop()
    }
  }, [])

  // ═══ MENU ══════════════════════════════════════════════════════════════════
  if (phase === 'menu') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center px-6"
        style={{ background: 'radial-gradient(ellipse at center, #2b1264, #0a0817 80%)' }}>
        <h1 className="text-5xl font-black text-white mb-2 tracking-tight"
          style={{ textShadow: '0 0 30px rgba(125,240,255,0.4)' }}>
          Simply Sing
        </h1>
        <p className="text-cyan-300 text-sm mb-8">Sing along to your composer songs</p>

        {songs.length === 0 ? (
          <div className="text-center max-w-md">
            <p className="text-gray-400 mb-3">No saved compositions yet.</p>
            <p className="text-xs text-gray-500 mb-6">Open the Composer, write a song, and click 💾 SAVE. Your saved songs will show up here.</p>
            <a href="/pitch-defender/composer"
              className="inline-block px-6 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all">
              Open Composer →
            </a>
          </div>
        ) : (
          <div className="w-full max-w-2xl">
            <h2 className="text-xs uppercase tracking-widest text-gray-500 mb-3">Pick a song</h2>
            <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-2">
              {songs.map(s => (
                <button
                  key={s.key}
                  onClick={() => startSong(s)}
                  className="w-full flex items-center justify-between p-4 rounded-xl text-left transition-all hover:scale-[1.02]"
                  style={{
                    background: 'rgba(99,102,241,0.15)',
                    border: '2px solid rgba(125,240,255,0.4)',
                    boxShadow: '0 0 12px rgba(125,240,255,0.1)',
                  }}
                >
                  <div>
                    <div className="text-lg font-bold text-white">★ {s.title}</div>
                    <div className="text-xs text-cyan-300/70 mt-0.5">
                      {s.notes.filter(n => !n.isRest).length} notes · {Math.round(s.totalBeats / 4)} bars · ♩={s.tempoBpm}
                    </div>
                  </div>
                  <div className="text-cyan-300 text-2xl">▶</div>
                </button>
              ))}
            </div>

            {/* Tempo + transpose pre-game tweaks */}
            <div className="mt-6 flex items-center gap-4 text-xs text-gray-400">
              <label className="flex items-center gap-2">
                Tempo
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.05"
                  value={tempoMul}
                  onChange={e => setTempoMul(parseFloat(e.target.value))}
                  className="w-32"
                />
                <span className="text-cyan-300 font-mono w-10">{Math.round(tempoMul * 100)}%</span>
              </label>
              <label className="flex items-center gap-2">
                Key shift
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="1"
                  value={semitoneShift}
                  onChange={e => setSemitoneShift(parseInt(e.target.value))}
                  className="w-32"
                />
                <span className="text-cyan-300 font-mono w-10">{semitoneShift > 0 ? '+' : ''}{semitoneShift}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={micEnabled}
                  onChange={e => setMicEnabled(e.target.checked)}
                  className="w-4 h-4 accent-cyan-400"
                />
                Mic on
              </label>
            </div>
          </div>
        )}

        <a href="/pitch-defender" className="mt-10 text-xs text-gray-600 hover:text-gray-400">
          ← Back to Pitch Defender
        </a>
      </div>
    )
  }

  // ═══ COMPLETE ══════════════════════════════════════════════════════════════
  if (phase === 'complete') {
    const grade = finalScore >= 90 ? 'PERFECT'
      : finalScore >= 75 ? 'GREAT'
      : finalScore >= 60 ? 'GOOD'
      : finalScore >= 40 ? 'KEEP PRACTICING'
      : 'JUST GETTING STARTED'
    const gradeColor = finalScore >= 75 ? '#7dffb0' : finalScore >= 50 ? '#fbbf24' : '#f87171'
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center px-6"
        style={{ background: 'radial-gradient(ellipse at center, #2b1264, #0a0817 80%)' }}>
        <div className="text-6xl font-black mb-2" style={{ color: gradeColor, textShadow: `0 0 30px ${gradeColor}80` }}>
          {finalScore}%
        </div>
        <div className="text-xl font-bold text-white mb-1">{grade}</div>
        <div className="text-sm text-gray-400 mb-8">{selectedSong?.title}</div>
        <div className="flex gap-3">
          <button
            onClick={() => selectedSong && startSong(selectedSong)}
            className="px-6 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all"
          >
            Sing Again
          </button>
          <button
            onClick={() => setPhase('menu')}
            className="px-6 py-3 rounded-xl font-medium text-gray-300 border border-gray-700 hover:bg-gray-800 transition-all"
          >
            Pick Another
          </button>
        </div>
      </div>
    )
  }

  // ═══ PLAYING ════════════════════════════════════════════════════════════════
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-black"
      style={{ background: 'linear-gradient(135deg, #0a0817, #1a0f3d)' }}>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="max-w-full max-h-[80vh]"
        style={{ aspectRatio: `${W} / ${H}` }}
      />

      {/* Bottom controls */}
      <div className="mt-4 flex items-center gap-4">
        <button
          onClick={() => playing ? pauseSong() : resumeSong()}
          className="px-4 py-2 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all"
        >
          {playing ? '⏸  Pause' : '▶  Play'}
        </button>
        <button
          onClick={stopSong}
          className="px-4 py-2 rounded-xl text-sm text-gray-300 border border-gray-700 hover:bg-gray-800 transition-all"
        >
          Stop
        </button>
        <label className="flex items-center gap-2 text-xs text-gray-400">
          Key
          <input
            type="range"
            min="-12"
            max="12"
            step="1"
            value={semitoneShift}
            onChange={e => setSemitoneShift(parseInt(e.target.value))}
            className="w-24"
          />
          <span className="font-mono text-cyan-300 w-10">{semitoneShift > 0 ? '+' : ''}{semitoneShift}</span>
        </label>
      </div>
    </div>
  )
}
