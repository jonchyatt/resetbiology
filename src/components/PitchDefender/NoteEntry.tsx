'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// NoteEntry — Tap Piano Keys to Build Custom Songs
// ═══════════════════════════════════════════════════════════════════════════════
//
// Quick entry: tap notes on a visual piano → builds a song → save to localStorage
// → available in NoteRunner, Pitchforks, and Choir Practice.
//
// Also: paste from photo → human enters what they see.
// No AI, no OMR API, 100% reliable.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useEffect } from 'react'
import { NOTE_COLORS } from '@/lib/fsrs'
import { initAudio, playPianoNote, loadPianoSamples } from './audioEngine'

// ─── Types ──────────────────────────────────────────────────────────────────

interface EnteredNote {
  name: string       // e.g. "C4", "F#3"
  semitones: number  // from C4
  duration: number   // beats (1 = quarter, 0.5 = eighth, 2 = half)
}

const STORAGE_KEY = 'pitch_custom_songs'

// Piano layout: 3 octaves (C3 to B5)
const OCTAVES = [3, 4, 5]
const WHITE_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const BLACK_NOTES: Record<string, string> = { 'C': 'C#', 'D': 'D#', 'F': 'F#', 'G': 'G#', 'A': 'A#' }
const SEMITONE_MAP: Record<string, number> = {
  'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
  'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11,
}

function noteToSemitones(name: string): number {
  const match = name.match(/^([A-G]#?)(\d)$/)
  if (!match) return 0
  return SEMITONE_MAP[match[1]] + (parseInt(match[2]) - 4) * 12
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function NoteEntry() {
  const [notes, setNotes] = useState<EnteredNote[]>([])
  const [songName, setSongName] = useState('My Piece')
  const [currentDuration, setCurrentDuration] = useState(1) // quarter note default
  const [savedSongs, setSavedSongs] = useState<{ name: string; notes: number[] }[]>([])
  const [showSaved, setShowSaved] = useState(false)
  const [lastTapped, setLastTapped] = useState<string | null>(null)
  const audioInitRef = useRef(false)

  // Load saved songs
  useEffect(() => {
    loadPianoSamples()
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setSavedSongs(JSON.parse(raw))
    } catch {}
  }, [])

  // ─── Tap Note ─────────────────────────────────────────────────────────
  const tapNote = useCallback((noteName: string) => {
    if (!audioInitRef.current) { initAudio(); audioInitRef.current = true }

    // Play the note
    if (!noteName.includes('#')) {
      playPianoNote(noteName)
    } else {
      // Sharps — synthesize since we may not have samples
      const ctx = new AudioContext()
      const freq = 261.63 * Math.pow(2, noteToSemitones(noteName) / 12)
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, ctx.currentTime)
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.5)
    }

    setNotes(prev => [...prev, {
      name: noteName,
      semitones: noteToSemitones(noteName),
      duration: currentDuration,
    }])

    setLastTapped(noteName)
    setTimeout(() => setLastTapped(null), 200)
  }, [currentDuration])

  // ─── Undo ─────────────────────────────────────────────────────────────
  const undoLast = useCallback(() => {
    setNotes(prev => prev.slice(0, -1))
  }, [])

  const clearAll = useCallback(() => {
    setNotes([])
  }, [])

  // ─── Add Rest ─────────────────────────────────────────────────────────
  const addRest = useCallback(() => {
    setNotes(prev => [...prev, {
      name: 'rest',
      semitones: 0,
      duration: currentDuration,
    }])
  }, [currentDuration])

  // ─── Save Song ────────────────────────────────────────────────────────
  const saveSong = useCallback(() => {
    if (notes.length === 0) return
    const songData = {
      name: songName || 'Untitled',
      notes: notes.filter(n => n.name !== 'rest').map(n => n.semitones),
    }
    const updated = [...savedSongs, songData]
    setSavedSongs(updated)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)) } catch {}
  }, [notes, songName, savedSongs])

  // ─── Delete Saved Song ────────────────────────────────────────────────
  const deleteSong = useCallback((idx: number) => {
    const updated = savedSongs.filter((_, i) => i !== idx)
    setSavedSongs(updated)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)) } catch {}
  }, [savedSongs])

  // ─── Playback ─────────────────────────────────────────────────────────
  const playBack = useCallback(() => {
    if (!audioInitRef.current) { initAudio(); audioInitRef.current = true }
    let delay = 0
    const msPerBeat = 500 // 120 BPM
    for (const note of notes) {
      if (note.name !== 'rest') {
        setTimeout(() => {
          if (!note.name.includes('#')) playPianoNote(note.name)
        }, delay)
      }
      delay += note.duration * msPerBeat
    }
  }, [notes])

  // ─── Duration symbols ─────────────────────────────────────────────────
  const durations = [
    { value: 0.25, label: '𝅘𝅥𝅯', name: '16th' },
    { value: 0.5, label: '♪', name: '8th' },
    { value: 1, label: '♩', name: 'Quarter' },
    { value: 1.5, label: '♩.', name: 'Dotted Q' },
    { value: 2, label: '𝅗𝅥', name: 'Half' },
    { value: 4, label: '𝅝', name: 'Whole' },
  ]

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-[#08080f] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div>
          <input
            value={songName}
            onChange={e => setSongName(e.target.value)}
            className="text-lg font-bold text-white bg-transparent border-b border-gray-700 focus:border-indigo-500 outline-none px-1"
            placeholder="Song name..."
          />
          <div className="text-xs text-gray-500 mt-0.5">{notes.length} notes entered</div>
        </div>
        <div className="flex gap-2">
          <button onClick={playBack} disabled={notes.length === 0}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-300 border border-indigo-600 disabled:opacity-30 active:scale-95 transition-all">
            ▶ Play
          </button>
          <button onClick={saveSong} disabled={notes.length === 0}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-green-300 border border-green-600 disabled:opacity-30 active:scale-95 transition-all">
            Save
          </button>
          <button onClick={() => setShowSaved(!showSaved)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 border border-gray-700 active:scale-95 transition-all">
            {showSaved ? 'Hide' : 'Saved'} ({savedSongs.length})
          </button>
        </div>
      </div>

      {/* Saved songs panel */}
      {showSaved && savedSongs.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-800/50">
          <div className="flex gap-2 flex-wrap">
            {savedSongs.map((s, i) => (
              <div key={i} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)' }}>
                <span className="text-indigo-300">{s.name}</span>
                <span className="text-gray-500">({s.notes.length})</span>
                <button onClick={() => deleteSong(i)} className="text-red-400 hover:text-red-300 ml-1">×</button>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-gray-600 mt-1">
            Saved songs appear in NoteRunner → "Load Your Music" section
          </div>
        </div>
      )}

      {/* Note sequence display (scrollable) */}
      <div className="px-4 py-2 overflow-x-auto" style={{ minHeight: 60 }}>
        <div className="flex gap-1 items-end">
          {notes.map((note, i) => {
            const hue = note.name === 'rest' ? 0 : (NOTE_COLORS[note.name]?.hue ?? 200)
            const isRest = note.name === 'rest'
            return (
              <div key={i} className="flex flex-col items-center" style={{ minWidth: 28 }}>
                <div className="text-[10px] text-gray-600">
                  {note.duration === 0.25 ? '𝅘𝅥𝅯' : note.duration === 0.5 ? '♪' : note.duration === 1 ? '♩' : note.duration === 2 ? '𝅗𝅥' : note.duration === 4 ? '𝅝' : '♩.'}
                </div>
                <div className="w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold"
                  style={{
                    background: isRest ? 'rgba(60,60,80,0.3)' : `hsla(${hue}, 50%, 25%, 0.6)`,
                    border: `1px solid ${isRest ? 'rgba(80,80,100,0.3)' : `hsla(${hue}, 50%, 45%, 0.5)`}`,
                    color: isRest ? '#555' : `hsl(${hue}, 60%, 65%)`,
                  }}>
                  {isRest ? '–' : note.name.replace(/\d/, '')}
                </div>
                <div className="text-[8px] text-gray-700">{isRest ? '' : note.name}</div>
              </div>
            )
          })}
          {notes.length === 0 && (
            <div className="text-xs text-gray-700 py-3">Tap piano keys below to enter notes...</div>
          )}
        </div>
      </div>

      {/* Duration selector */}
      <div className="flex items-center justify-center gap-1 px-4 py-1">
        <span className="text-[10px] text-gray-600 mr-1">Duration:</span>
        {durations.map(d => (
          <button key={d.value} onClick={() => setCurrentDuration(d.value)}
            className="px-2 py-1 rounded text-sm transition-all"
            style={{
              background: currentDuration === d.value ? 'rgba(99,102,241,0.2)' : 'transparent',
              border: `1px solid ${currentDuration === d.value ? 'rgba(99,102,241,0.4)' : 'rgba(40,40,60,0.3)'}`,
              color: currentDuration === d.value ? '#a5b4fc' : '#555',
            }}>
            {d.label}
          </button>
        ))}
        <button onClick={addRest}
          className="px-2 py-1 rounded text-xs text-gray-500 border border-gray-700 ml-2 active:scale-95">
          Rest
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex justify-center gap-2 px-4 py-1">
        <button onClick={undoLast} disabled={notes.length === 0}
          className="px-3 py-1 rounded text-xs text-gray-400 border border-gray-700 disabled:opacity-30 active:scale-95">
          Undo
        </button>
        <button onClick={clearAll} disabled={notes.length === 0}
          className="px-3 py-1 rounded text-xs text-red-400 border border-red-900 disabled:opacity-30 active:scale-95">
          Clear
        </button>
      </div>

      {/* Piano keyboard */}
      <div className="flex-1 flex flex-col justify-end px-2 pb-2">
        {OCTAVES.slice().reverse().map(oct => (
          <div key={oct} className="relative flex" style={{ height: 52 }}>
            {/* White keys */}
            <div className="flex w-full gap-px">
              {WHITE_NOTES.map(note => {
                const name = `${note}${oct}`
                const hue = NOTE_COLORS[name]?.hue ?? 200
                const isTapped = lastTapped === name
                return (
                  <button key={name}
                    onClick={() => tapNote(name)}
                    className="flex-1 rounded-b-lg flex items-end justify-center pb-1 transition-all active:scale-[0.98]"
                    style={{
                      background: isTapped
                        ? `linear-gradient(to bottom, hsl(${hue}, 50%, 35%), hsl(${hue}, 40%, 25%))`
                        : 'linear-gradient(to bottom, #2a2a3a, #1a1a28)',
                      border: `1px solid ${isTapped ? `hsl(${hue}, 60%, 50%)` : 'rgba(60,60,80,0.4)'}`,
                      boxShadow: isTapped ? `0 0 8px hsl(${hue}, 60%, 40%)` : 'none',
                    }}>
                    <span className="text-[9px] font-mono" style={{
                      color: isTapped ? `hsl(${hue}, 60%, 70%)` : '#555',
                    }}>{name}</span>
                  </button>
                )
              })}
            </div>

            {/* Black keys (overlaid) */}
            <div className="absolute top-0 left-0 right-0 flex pointer-events-none" style={{ height: 32 }}>
              {WHITE_NOTES.map((note, i) => {
                const sharp = BLACK_NOTES[note]
                if (!sharp) return <div key={i} className="flex-1" />
                const name = `${sharp}${oct}`
                const hue = NOTE_COLORS[name]?.hue ?? 200
                const isTapped = lastTapped === name
                // Position black key between white keys
                const leftPct = ((i + 0.65) / WHITE_NOTES.length) * 100
                return (
                  <button key={name}
                    onClick={() => tapNote(name)}
                    className="absolute pointer-events-auto rounded-b-md flex items-end justify-center pb-0.5 active:scale-[0.97]"
                    style={{
                      left: `${leftPct}%`,
                      width: `${100 / WHITE_NOTES.length * 0.6}%`,
                      height: '100%',
                      background: isTapped
                        ? `linear-gradient(to bottom, hsl(${hue}, 50%, 30%), hsl(${hue}, 40%, 18%))`
                        : 'linear-gradient(to bottom, #111, #080810)',
                      border: `1px solid ${isTapped ? `hsl(${hue}, 60%, 45%)` : 'rgba(40,40,50,0.6)'}`,
                      zIndex: 10,
                    }}>
                    <span className="text-[7px] font-mono" style={{ color: '#444' }}>{sharp}{oct}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom nav */}
      <div className="flex justify-center pb-3">
        <a href="/pitch-defender" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
          ← Back to Pitch Defender
        </a>
      </div>
    </div>
  )
}
