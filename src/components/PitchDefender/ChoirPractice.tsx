'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// ChoirPractice — Choir Audition Practice Coach
// ═══════════════════════════════════════════════════════════════════════════════
//
// Built for a 4-day sprint: Jon's son has a chamber choir tryout.
//
// Features:
// - Load any MusicXML (upload or sample SATB scores)
// - Extract notes per part (Soprano/Alto/Tenor/Bass)
// - Guided sing-along with adjustable speed
// - Pause-until-correct mode (Synthesia mechanic)
// - Flow mode with scoring
// - Real-time pitch tracking with visual feedback
// - Section looping (repeat hard measures)
// - Self-feedback audio (hear your own voice)
// - Guide audio with note-length-aware playback
//
// STANDALONE SIBLING — does not modify SheetMusicViewer or NoteRunner.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useEffect } from 'react'
import { NOTE_COLORS } from '@/lib/fsrs'
import { PitchFusion, type FusedPitch, DEFAULT_FUSION_CONFIG } from './pitchFusion'
import { initAudio, playPianoNote } from './audioEngine'
import { extractMelodyFromComposition, compositionHasNotes } from './composerExtract'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ExtractedNote {
  pitch: string         // e.g., "C4", "D#5"
  semitones: number     // from C4 (0 = C4, 2 = D4, etc.)
  frequency: number     // Hz
  duration: number      // beats (1 = quarter, 0.5 = eighth, etc.)
  measure: number       // measure number (1-based)
  partIndex: number     // which SATB part
  partName: string      // "Soprano", "Alto", etc.
  isRest: boolean
}

interface PracticeConfig {
  speed: number         // 0.25 to 2.0 (1.0 = original tempo)
  baseTempo: number     // BPM from score or user setting
  mode: 'pause' | 'flow'  // pause = wait for correct, flow = keep going + score
  loopStart: number     // measure number (0 = disabled)
  loopEnd: number       // measure number (0 = disabled)
  guideVolume: number   // 0 to 1
  selfFeedback: boolean // mic → speaker
  guidePan: number      // -1 = left, 0 = center, 1 = right
  voicePan: number      // -1 = left, 0 = center, 1 = right
}

type Phase = 'upload' | 'setup' | 'practicing' | 'complete'

// ─── Note/Frequency Helpers ─────────────────────────────────────────────────

const NOTE_NAMES_ALL = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

function pitchToSemitones(step: string, octave: number, accidental: number): number {
  const baseIdx = ['C', 'D', 'E', 'F', 'G', 'A', 'B'].indexOf(step)
  const semitoneMap = [0, 2, 4, 5, 7, 9, 11]
  return semitoneMap[baseIdx] + accidental + (octave - 4) * 12
}

function semitonesToFreq(semi: number): number {
  return 261.63 * Math.pow(2, semi / 12) // C4 = 261.63
}

function semitonesToName(semi: number): string {
  const idx = ((Math.round(semi) % 12) + 12) % 12
  const oct = 4 + Math.floor(semi / 12)
  return `${NOTE_NAMES_ALL[idx]}${oct}`
}

// ─── Guide Audio (Web Audio synth with duration awareness) ──────────────────

let _guideCtx: AudioContext | null = null
let _guidePanner: StereoPannerNode | null = null
let _feedbackPanner: StereoPannerNode | null = null
let _feedbackSource: MediaStreamAudioSourceNode | null = null
let _feedbackGain: GainNode | null = null
let _feedbackStream: MediaStream | null = null

function getGuideCtx(): AudioContext {
  if (!_guideCtx) {
    _guideCtx = new AudioContext()
    _guidePanner = _guideCtx.createStereoPanner()
    _guidePanner.connect(_guideCtx.destination)
  }
  if (_guideCtx.state === 'suspended') _guideCtx.resume()
  return _guideCtx
}

function playGuideNote(semi: number, durationMs: number, volume: number, pan: number) {
  const ctx = getGuideCtx()
  const now = ctx.currentTime
  const freq = semitonesToFreq(semi)
  const durSec = durationMs / 1000

  // Triangle + slight detune for warm tone
  const osc1 = ctx.createOscillator()
  osc1.type = 'triangle'
  osc1.frequency.setValueAtTime(freq, now)

  const osc2 = ctx.createOscillator()
  osc2.type = 'sine'
  osc2.frequency.setValueAtTime(freq, now)
  osc2.detune.setValueAtTime(3, now)

  // Envelope
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(volume * 0.2, now + 0.02)
  gain.gain.setValueAtTime(volume * 0.15, now + Math.min(durSec * 0.8, durSec - 0.05))
  gain.gain.exponentialRampToValueAtTime(0.001, now + durSec)

  // Panning
  const panner = ctx.createStereoPanner()
  panner.pan.setValueAtTime(pan, now)

  osc1.connect(gain)
  osc2.connect(gain)
  gain.connect(panner)
  panner.connect(ctx.destination)

  osc1.start(now)
  osc2.start(now)
  osc1.stop(now + durSec)
  osc2.stop(now + durSec)
}

let _feedbackRequestId = 0 // [FIX HIGH] Guard async mic resolution

function startSelfFeedback(pan: number) {
  stopSelfFeedback()
  const ctx = getGuideCtx()
  const requestId = ++_feedbackRequestId
  navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    .then(stream => {
      // [FIX HIGH] If feedback was stopped before mic resolved, kill the stream
      if (requestId !== _feedbackRequestId) {
        stream.getTracks().forEach(t => t.stop())
        return
      }
      _feedbackStream = stream
      _feedbackSource = ctx.createMediaStreamSource(stream)
      _feedbackGain = ctx.createGain()
      _feedbackGain.gain.value = 0.7
      _feedbackPanner = ctx.createStereoPanner()
      _feedbackPanner.pan.value = pan
      _feedbackSource.connect(_feedbackGain)
      _feedbackGain.connect(_feedbackPanner)
      _feedbackPanner.connect(ctx.destination)
    })
    .catch(() => { /* mic denied */ })
}

function stopSelfFeedback() {
  _feedbackRequestId++ // invalidate any pending getUserMedia
  if (_feedbackSource) { try { _feedbackSource.disconnect() } catch {} _feedbackSource = null }
  if (_feedbackGain) { try { _feedbackGain.disconnect() } catch {} _feedbackGain = null }
  if (_feedbackPanner) { try { _feedbackPanner.disconnect() } catch {} _feedbackPanner = null }
  if (_feedbackStream) { _feedbackStream.getTracks().forEach(t => t.stop()); _feedbackStream = null }
}

function updateFeedbackPan(pan: number) {
  if (_feedbackPanner) _feedbackPanner.pan.value = pan
}

// ─── OSMD Note Extraction ───────────────────────────────────────────────────

async function extractNotesFromXML(xmlData: string | Uint8Array): Promise<{
  notes: ExtractedNote[]
  parts: string[]
  tempo: number
  title: string
}> {
  const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay')

  // Create a hidden container for OSMD parsing
  const container = document.createElement('div')
  container.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:800px'
  document.body.appendChild(container)

  try {

  const osmd = new OpenSheetMusicDisplay(container, {
    autoResize: false,
    drawTitle: false,
    drawingParameters: 'compact',
    disableCursor: false,
  })

  if (xmlData instanceof Uint8Array) {
    await osmd.load(xmlData as any)
  } else {
    await osmd.load(xmlData)
  }
  osmd.render()

  const notes: ExtractedNote[] = []
  const partNames: string[] = []

  // Extract part names
  const sheetParts = osmd.Sheet?.Parts || []
  for (const p of sheetParts) {
    partNames.push(p.Name || p.NameLabel?.text || 'Part')
  }

  // Extract tempo
  let tempo = 100 // default
  try {
    const firstMeasure = osmd.Sheet?.SourceMeasures?.[0]
    if (firstMeasure?.TempoInBPM) tempo = firstMeasure.TempoInBPM
  } catch {}

  // Title
  const title = osmd.Sheet?.TitleString || 'Untitled'

  // Walk the cursor to extract notes in order
  const cursor = osmd.cursor
  cursor.show()
  cursor.reset()

  let measureNum = 1
  let lastMeasureIdx = -1

  while (!cursor.Iterator.EndReached) {
    const iter = cursor.Iterator
    const currentMeasureIdx = iter.CurrentMeasureIndex
    if (currentMeasureIdx !== lastMeasureIdx) {
      measureNum = currentMeasureIdx + 1
      lastMeasureIdx = currentMeasureIdx
    }

    try {
      const voiceEntries = iter.CurrentVoiceEntries || []
      for (const ve of voiceEntries) {
        const veNotes = ve.Notes || []
        for (const note of veNotes) {
          if (!note.Pitch && !note.isRest()) continue

          // Find which part this note belongs to
          let partIdx = 0
          try {
            const staff = note.ParentStaffEntry?.ParentStaff
            if (staff) {
              partIdx = sheetParts.findIndex((p: any) =>
                p.Staves?.includes(staff)
              )
              if (partIdx < 0) partIdx = 0
            }
          } catch {}

          if (note.isRest()) {
            const durBeats = note.Length?.RealValue ? note.Length.RealValue * 4 : 1
            notes.push({
              pitch: 'rest',
              semitones: 0,
              frequency: 0,
              duration: durBeats,
              measure: measureNum,
              partIndex: partIdx,
              partName: partNames[partIdx] || 'Part',
              isRest: true,
            })
          } else if (note.Pitch) {
            const step = ['C', 'D', 'E', 'F', 'G', 'A', 'B'][note.Pitch.FundamentalNote] || 'C'
            const acc = note.Pitch.Accidental || 0
            const oct = note.Pitch.Octave + 3
            const accStr = acc > 0 ? '#' : acc < 0 ? 'b' : ''
            const pitchName = `${step}${accStr}${oct}`
            const semi = pitchToSemitones(step, oct, acc)
            const durBeats = note.Length?.RealValue ? note.Length.RealValue * 4 : 1

            notes.push({
              pitch: pitchName,
              semitones: semi,
              frequency: semitonesToFreq(semi),
              duration: durBeats,
              measure: measureNum,
              partIndex: partIdx,
              partName: partNames[partIdx] || 'Part',
              isRest: false,
            })
          }
        }
      }
    } catch {}

    cursor.next()
  }

  return { notes, parts: partNames, tempo, title }

  } finally {
    // [FIX HIGH] Always remove hidden container, even on error
    try { document.body.removeChild(container) } catch {}
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ChoirPractice() {
  const [phase, setPhase] = useState<Phase>('upload')
  const [allNotes, setAllNotes] = useState<ExtractedNote[]>([])
  const [partNames, setPartNames] = useState<string[]>([])
  const [selectedPart, setSelectedPart] = useState(0)
  const [scoreTitle, setScoreTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Raw score data so OSMD can render the sheet during practice
  const [scoreXml, setScoreXml] = useState<string | Uint8Array | null>(null)
  const sheetContainerRef = useRef<HTMLDivElement>(null)
  const sheetOsmdRef = useRef<any>(null)
  // Compositions saved via the Composer tool
  const [composedList, setComposedList] = useState<{ key: string; title: string; noteCount: number }[]>([])

  // Practice state
  const [currentIdx, setCurrentIdx] = useState(0)
  const [matchProgress, setMatchProgress] = useState(0)
  const [practiceStats, setPracticeStats] = useState({
    notesHit: 0, notesMissed: 0, totalNotes: 0, streak: 0, maxStreak: 0,
    measureAccuracy: {} as Record<number, { hit: number; total: number }>,
  })
  const [config, setConfig] = useState<PracticeConfig>({
    speed: 1.0,
    baseTempo: 100,
    mode: 'pause',
    loopStart: 0,
    loopEnd: 0,
    guideVolume: 0.8,
    selfFeedback: false,
    guidePan: -0.7,   // guide in left ear
    voicePan: 0.7,     // self in right ear
  })

  // Refs
  const fusionRef = useRef<PitchFusion | null>(null)
  const pitchRef = useRef<FusedPitch | null>(null)
  const rafRef = useRef(0)
  const lastTimeRef = useRef(0)
  const matchStartRef = useRef(0)
  const flowTimerRef = useRef(0)
  const practiceNotesRef = useRef<ExtractedNote[]>([])
  const currentIdxRef = useRef(0)
  const configRef = useRef(config)
  const statsRef = useRef(practiceStats)

  useEffect(() => { configRef.current = config }, [config])
  useEffect(() => { statsRef.current = practiceStats }, [practiceStats])
  useEffect(() => { currentIdxRef.current = currentIdx }, [currentIdx])

  // Refresh saved-composition list whenever we're in upload phase.
  // Uses the shared composerExtract module — handles BOTH the new measures
  // format AND the legacy flat-notes fallback. Previous reader only checked
  // c.notes (legacy) and silently dropped every modern Composer save.
  useEffect(() => {
    if (phase !== 'upload') return
    try {
      const out: { key: string; title: string; noteCount: number }[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key || !key.startsWith('pd_composed_')) continue
        try {
          const c = JSON.parse(localStorage.getItem(key) || '{}')
          if (!compositionHasNotes(c)) continue
          // Note count via the extractor so the displayed count matches what
          // ChoirPractice will actually load.
          const extracted = extractMelodyFromComposition(c, { skipRests: true })
          out.push({ key, title: c.title || 'Untitled', noteCount: extracted.length })
        } catch {}
      }
      out.sort((a, b) => a.title.localeCompare(b.title))
      setComposedList(out)
    } catch {}
  }, [phase])

  // Load a composition from localStorage as if it were a sample score
  const loadComposition = useCallback((storageKey: string) => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return
      const c = JSON.parse(raw)
      // Convert via the shared extractor (handles both new measures format
      // AND legacy flat notes). Includes rests so timing in Choir Practice
      // stays correct — singer needs the silent beats too.
      const melody = extractMelodyFromComposition(c, { skipRests: false })
      const extracted: ExtractedNote[] = melody.map(n => ({
        pitch: n.pitchName || 'C4',
        semitones: n.semi,
        frequency: 261.63 * Math.pow(2, n.semi / 12),
        duration: n.beats,
        measure: n.measureIdx,
        partIndex: 0,
        partName: 'Voice',
        isRest: n.isRest,
      }))
      if (extracted.length === 0) {
        setError('Composition has no playable notes')
        return
      }
      setAllNotes(extracted)
      setPartNames(['Voice'])
      setScoreTitle(c.title || 'Untitled')
      setScoreXml(null) // composer compositions don't have raw XML
      // Composer's tempo field is `tempoBpm` (new) or `tempo` (legacy fallback)
      setConfig(prev => ({ ...prev, baseTempo: c.tempoBpm || c.tempo || 100 }))
      setPhase('setup')
    } catch (err: any) {
      setError(err.message || 'Failed to load composition')
    }
  }, [])

  // ─── File Upload ──────────────────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    setLoading(true)
    setError(null)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase()
      let data: string | Uint8Array
      if (ext === 'mxl') {
        data = new Uint8Array(await file.arrayBuffer())
      } else {
        data = await file.text()
      }
      const result = await extractNotesFromXML(data)
      setAllNotes(result.notes)
      setPartNames(result.parts)
      setScoreTitle(result.title)
      setScoreXml(data) // keep raw XML so OSMD can render the sheet later
      setConfig(prev => ({ ...prev, baseTempo: result.tempo }))
      setPhase('setup')
    } catch (err: any) {
      setError(err.message || 'Failed to parse score')
    }
    setLoading(false)
  }, [])

  const loadSample = useCallback(async (url: string, name: string) => {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch(url)
      // Handle both .musicxml/.xml (text) and .mxl (binary)
      const isBinary = url.toLowerCase().endsWith('.mxl')
      const data: string | Uint8Array = isBinary
        ? new Uint8Array(await resp.arrayBuffer())
        : await resp.text()
      const result = await extractNotesFromXML(data)
      setAllNotes(result.notes)
      setPartNames(result.parts)
      setScoreTitle(name)
      setScoreXml(data)
      setConfig(prev => ({ ...prev, baseTempo: result.tempo }))
      setPhase('setup')
    } catch (err: any) {
      setError(err.message || 'Failed to load sample')
    }
    setLoading(false)
  }, [])

  // Render the sheet via OSMD when entering practice phase.
  // Highlights stay in sync via the cursor as currentIdx changes.
  useEffect(() => {
    if (phase !== 'practicing' || !scoreXml || !sheetContainerRef.current) return
    let cancelled = false
    ;(async () => {
      try {
        const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay')
        if (cancelled || !sheetContainerRef.current) return
        // Clean previous render if any
        sheetContainerRef.current.innerHTML = ''
        const osmd = new OpenSheetMusicDisplay(sheetContainerRef.current, {
          autoResize: true,
          drawTitle: false,
          drawSubtitle: false,
          drawComposer: false,
          drawCredits: false,
          drawPartNames: false,
          drawingParameters: 'compact',
          backend: 'svg',
          followCursor: true,
        })
        if (scoreXml instanceof Uint8Array) {
          await osmd.load(scoreXml as any)
        } else {
          await osmd.load(scoreXml)
        }
        if (cancelled) return
        osmd.render()
        try { osmd.cursor.show(); osmd.cursor.reset() } catch {}
        sheetOsmdRef.current = osmd
      } catch (err) {
        console.error('Sheet render failed:', err)
      }
    })()
    return () => { cancelled = true }
  }, [phase, scoreXml])

  // Advance the OSMD cursor to follow currentIdx (rough sync — one tick per practice note).
  useEffect(() => {
    const osmd = sheetOsmdRef.current
    if (!osmd || phase !== 'practicing') return
    try {
      osmd.cursor.reset()
      // step the cursor forward currentIdx times
      for (let i = 0; i < currentIdx; i++) {
        if (osmd.cursor.Iterator?.EndReached) break
        osmd.cursor.next()
      }
    } catch {}
  }, [currentIdx, phase])

  // Space replays the current guide tone — promised in the help banner.
  useEffect(() => {
    if (phase !== 'practicing') return
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      e.preventDefault()
      const note = practiceNotesRef.current[currentIdxRef.current]
      if (!note) return
      const cfg = configRef.current
      const msPerBeat = (60000 / cfg.baseTempo) / cfg.speed
      playGuideNote(note.semitones, note.duration * msPerBeat, cfg.guideVolume, cfg.guidePan)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase])

  // ─── Start Practice ───────────────────────────────────────────────────
  const startPractice = useCallback(async () => {
    initAudio()

    // Filter notes for selected part, skip rests
    let partNotes = allNotes.filter(n => n.partIndex === selectedPart && !n.isRest)

    // Apply loop if set
    if (config.loopStart > 0 && config.loopEnd > 0) {
      partNotes = partNotes.filter(n => n.measure >= config.loopStart && n.measure <= config.loopEnd)
    }

    if (partNotes.length === 0) {
      setError('No notes found for this part. Try another voice.')
      return
    }

    practiceNotesRef.current = partNotes
    currentIdxRef.current = 0
    setCurrentIdx(0)
    setMatchProgress(0)
    setPracticeStats({
      notesHit: 0, notesMissed: 0, totalNotes: partNotes.length,
      streak: 0, maxStreak: 0, measureAccuracy: {},
    })
    matchStartRef.current = 0
    flowTimerRef.current = 0

    // Start pitch detection
    const fusion = new PitchFusion({ enableML: false, noiseGateDb: -55 }) // ML disabled. Lower gate so quiet singing registers.
    fusionRef.current = fusion
    await fusion.start(p => { pitchRef.current = p })

    // Start self-feedback if enabled
    if (config.selfFeedback) {
      startSelfFeedback(config.voicePan)
    }

    setPhase('practicing')

    // Play first guide note
    const first = partNotes[0]
    const msPerBeat = (60000 / config.baseTempo) / config.speed
    setTimeout(() => {
      playGuideNote(first.semitones, first.duration * msPerBeat, config.guideVolume, config.guidePan)
    }, 300)

    lastTimeRef.current = performance.now()
    practiceLoop()
  }, [allNotes, selectedPart, config])

  // ─── Practice Loop ────────────────────────────────────────────────────
  const practiceLoop = useCallback(() => {
    const now = performance.now()
    const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05)
    lastTimeRef.current = now

    const notes = practiceNotesRef.current
    const idx = currentIdxRef.current
    const cfg = configRef.current

    if (idx >= notes.length) {
      // Practice complete
      stopSelfFeedback()
      fusionRef.current?.stop()
      setPhase('complete')
      return
    }

    const currentNote = notes[idx]
    const pitch = pitchRef.current
    const msPerBeat = (60000 / cfg.baseTempo) / cfg.speed

    // Octave-flexible deviation: kid might sing C4 when target is C3
    function octaveFlexDev(sung: number, target: number): number {
      const tMod = ((target % 12) + 12) % 12
      const sMod = ((Math.round(sung) % 12) + 12) % 12
      const raw = Math.abs(tMod - sMod)
      const pcDiff = Math.min(raw, 12 - raw)
      return Math.min(Math.abs(sung - target), pcDiff)
    }

    if (cfg.mode === 'pause') {
      // ── Pause Mode: wait until pitch matches ──
      if (pitch?.isActive) {
        const deviation = octaveFlexDev(pitch.staffPosition, currentNote.semitones)
        if (deviation <= 2.5) { // ~2.5 semitone tolerance (forgiving for practice)
          if (matchStartRef.current === 0) matchStartRef.current = performance.now()
          const held = performance.now() - matchStartRef.current
          const holdNeeded = Math.max(300, currentNote.duration * msPerBeat * 0.4) // at least 300ms, or 40% of note duration
          const progress = Math.min(1, held / holdNeeded)
          setMatchProgress(progress)

          if (progress >= 1) {
            // Note matched!
            advanceNote(true)
          }
        } else {
          matchStartRef.current = 0
          setMatchProgress(prev => Math.max(0, prev - dt * 3))
        }
      }
      // NOTE: removed `else` reset on !pitch.isActive — pitch flickers between
      // detection frames and resetting on every flicker prevented progress from
      // ever accumulating to 1. Now progress only decays on wrong-pitch frames.
    } else {
      // ── Flow Mode: note plays for its duration, score timing ──
      flowTimerRef.current += dt * 1000
      const noteDurationMs = currentNote.duration * msPerBeat

      if (pitch?.isActive) {
        const deviation = octaveFlexDev(pitch.staffPosition, currentNote.semitones)
        if (deviation <= 2.5) {
          setMatchProgress(prev => Math.min(1, prev + dt * 4))
        } else {
          setMatchProgress(prev => Math.max(0, prev - dt * 2))
        }
      }

      if (flowTimerRef.current >= noteDurationMs) {
        // Time's up — score based on matchProgress
        const hit = matchProgress >= 0.5 // needed to hold pitch for ~50% of note
        advanceNote(hit)
      }
    }

    rafRef.current = requestAnimationFrame(practiceLoop)
  }, [])

  // ─── Advance to Next Note ─────────────────────────────────────────────
  const advanceNote = useCallback((hit: boolean) => {
    const notes = practiceNotesRef.current
    const idx = currentIdxRef.current
    const cfg = configRef.current
    const note = notes[idx]

    // Update stats
    setPracticeStats(prev => {
      const newStreak = hit ? prev.streak + 1 : 0
      const ma = { ...prev.measureAccuracy }
      if (!ma[note.measure]) ma[note.measure] = { hit: 0, total: 0 }
      ma[note.measure].total++
      if (hit) ma[note.measure].hit++
      const updated = {
        ...prev,
        notesHit: prev.notesHit + (hit ? 1 : 0),
        notesMissed: prev.notesMissed + (hit ? 0 : 1),
        streak: newStreak,
        maxStreak: Math.max(prev.maxStreak, newStreak),
        measureAccuracy: ma,
      }
      statsRef.current = updated
      return updated
    })

    // Check for loop
    const nextIdx = idx + 1
    const msPerBeat = (60000 / cfg.baseTempo) / cfg.speed

    if (nextIdx >= notes.length) {
      // Check loop
      if (cfg.loopStart > 0 && cfg.loopEnd > 0) {
        // Restart from beginning of loop
        currentIdxRef.current = 0
        setCurrentIdx(0)
        setMatchProgress(0)
        matchStartRef.current = 0
        flowTimerRef.current = 0
        const first = notes[0]
        playGuideNote(first.semitones, first.duration * msPerBeat, cfg.guideVolume, cfg.guidePan)
        return
      }
      // Done
      currentIdxRef.current = nextIdx
      setCurrentIdx(nextIdx)
      return
    }

    // Advance
    currentIdxRef.current = nextIdx
    setCurrentIdx(nextIdx)
    setMatchProgress(0)
    matchStartRef.current = 0
    flowTimerRef.current = 0

    // Play next guide note
    const nextNote = notes[nextIdx]
    playGuideNote(nextNote.semitones, nextNote.duration * msPerBeat, cfg.guideVolume, cfg.guidePan)
  }, [])

  // ─── Stop Practice ────────────────────────────────────────────────────
  const stopPractice = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0 }
    fusionRef.current?.stop()
    stopSelfFeedback()
    setPhase('setup')
  }, [])

  // Cleanup
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      fusionRef.current?.stop()
      stopSelfFeedback()
    }
  }, [])

  // ─── Get practice notes for display ───────────────────────────────────
  const practiceNotes = practiceNotesRef.current
  const currentNote = practiceNotes[currentIdx]
  const prevNotes = practiceNotes.slice(Math.max(0, currentIdx - 3), currentIdx)
  const nextNotes = practiceNotes.slice(currentIdx + 1, currentIdx + 6)
  const pitch = pitchRef.current

  // ─── UPLOAD PHASE ─────────────────────────────────────────────────────
  if (phase === 'upload') {
    return (
      <div className="fixed inset-0 bg-[#08080f] flex flex-col items-center justify-center px-6">
        <h1 className="text-3xl font-black text-white mb-1" style={{ textShadow: '0 0 30px rgba(99,102,241,0.4)' }}>
          CHOIR PRACTICE
        </h1>
        <p className="text-gray-500 text-sm mb-8">Load your music. Pick your part. Nail the audition.</p>

        {/* Upload */}
        <label className="w-full max-w-md cursor-pointer mb-6">
          <div className="flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-dashed transition-all hover:border-indigo-500/50"
            style={{ borderColor: 'rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.05)' }}>
            <div className="text-3xl">📄</div>
            <div className="text-sm text-indigo-300 font-medium">Upload MusicXML</div>
            <div className="text-xs text-gray-500">.xml, .musicxml, or .mxl</div>
          </div>
          <input type="file" accept=".xml,.musicxml,.mxl" onChange={e => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
            e.target.value = ''
          }} className="hidden" />
        </label>

        {/* Composer-saved compositions (canonical user library) */}
        {composedList.length > 0 && (
          <div className="w-full max-w-md mb-4">
            <div className="text-xs text-indigo-300 uppercase tracking-wider mb-2 text-center">★ Your Compositions</div>
            <div className="space-y-1.5">
              {composedList.map(c => (
                <button key={c.key} onClick={() => loadComposition(c.key)}
                  className="w-full text-left px-4 py-2.5 rounded-xl transition-all hover:bg-indigo-500/15"
                  style={{ background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.40)' }}>
                  <div className="text-sm text-indigo-200">★ {c.title}</div>
                  <div className="text-[10px] text-indigo-400">Composed · {c.noteCount} notes</div>
                </button>
              ))}
            </div>
            <div className="text-[10px] text-gray-500 mt-2 text-center">
              Composed in <a href="/pitch-defender/composer" className="text-indigo-400 hover:text-indigo-300">Composer</a>
            </div>
          </div>
        )}

        {/* Sample scores (public-domain SATB) */}
        <div className="w-full max-w-md">
          <div className="text-xs text-gray-600 uppercase tracking-wider mb-2 text-center">Or try a sample</div>
          <div className="space-y-1.5">
            {[
              { url: '/musicxml/farewell-dear-love-jones.mxl', name: 'Farewell, Dear Love — Jones original (SATB)' },
              { url: '/musicxml/barnby-crossing-the-bar-satb.musicxml', name: 'Barnby — Crossing the Bar (SATB)' },
              { url: '/musicxml/bach-bwv-244-03-chorale.musicxml', name: 'Bach — St. Matthew Passion Chorale' },
              { url: '/musicxml/bach-bwv-140-07-chorale.musicxml', name: 'Bach — Sleepers Awake Chorale' },
              { url: '/musicxml/mozart-requiem-kyrie-satb.musicxml', name: 'Mozart — Requiem Kyrie (SATB)' },
              { url: '/musicxml/amazing-grace-hymn.xml', name: 'Amazing Grace (Hymn)' },
            ].map(s => (
              <button key={s.url} onClick={() => loadSample(s.url, s.name)}
                className="w-full text-left px-4 py-2.5 rounded-xl transition-all hover:bg-indigo-500/10"
                style={{ background: 'rgba(20,20,35,0.6)', border: '1px solid rgba(99,102,241,0.15)' }}>
                <div className="text-sm text-gray-300">{s.name}</div>
              </button>
            ))}
          </div>
          <div className="text-[10px] text-gray-600 mt-3 text-center">
            Don't see your piece?{' '}
            <a href="/pitch-defender/composer" className="text-indigo-400 hover:text-indigo-300">Type it in by hand →</a>
          </div>
        </div>

        {loading && <div className="mt-6 text-indigo-400 animate-pulse">Parsing score...</div>}
        {error && <div className="mt-4 text-red-400 text-sm">{error}</div>}

        <a href="/pitch-defender" className="mt-8 text-xs text-gray-600 hover:text-gray-400 transition-colors">
          ← Back to Pitch Defender
        </a>
      </div>
    )
  }

  // ─── SETUP PHASE ──────────────────────────────────────────────────────
  if (phase === 'setup') {
    const partNoteCounts = partNames.map((_, i) => allNotes.filter(n => n.partIndex === i && !n.isRest).length)
    const maxMeasure = Math.max(...allNotes.map(n => n.measure), 1)
    const selectedNotes = allNotes.filter(n => n.partIndex === selectedPart && !n.isRest)
    const noteRange = selectedNotes.length > 0
      ? `${semitonesToName(Math.min(...selectedNotes.map(n => n.semitones)))} — ${semitonesToName(Math.max(...selectedNotes.map(n => n.semitones)))}`
      : 'N/A'

    return (
      <div className="fixed inset-0 bg-[#08080f] flex flex-col items-center justify-center px-6 overflow-y-auto py-8">
        <h2 className="text-2xl font-bold text-white mb-1">{scoreTitle}</h2>
        <p className="text-gray-500 text-sm mb-6">{allNotes.filter(n => !n.isRest).length} notes · {maxMeasure} measures · {partNames.length} parts</p>

        {/* Part selector */}
        <div className="mb-6 w-full max-w-md">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Select Your Part</div>
          <div className="grid grid-cols-2 gap-2">
            {partNames.map((name, i) => (
              <button key={i} onClick={() => setSelectedPart(i)}
                className="px-4 py-3 rounded-xl text-left transition-all"
                style={{
                  background: selectedPart === i ? 'rgba(99,102,241,0.15)' : 'rgba(20,20,35,0.6)',
                  border: `2px solid ${selectedPart === i ? 'rgba(99,102,241,0.5)' : 'rgba(40,40,60,0.3)'}`,
                }}>
                <div className="font-medium" style={{ color: selectedPart === i ? '#a5b4fc' : '#999' }}>
                  {name}
                </div>
                <div className="text-xs" style={{ color: selectedPart === i ? '#6b7fbb' : '#555' }}>
                  {partNoteCounts[i]} notes
                </div>
              </button>
            ))}
          </div>
          {selectedNotes.length > 0 && (
            <div className="mt-2 text-xs text-gray-500 text-center">Range: {noteRange}</div>
          )}
        </div>

        {/* Practice mode */}
        <div className="mb-4 w-full max-w-md">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Practice Mode</div>
          <div className="flex gap-2">
            <button onClick={() => setConfig(p => ({ ...p, mode: 'pause' }))}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm transition-all"
              style={{
                background: config.mode === 'pause' ? 'rgba(34,197,94,0.15)' : 'rgba(20,20,35,0.6)',
                border: `2px solid ${config.mode === 'pause' ? 'rgba(34,197,94,0.4)' : 'rgba(40,40,60,0.3)'}`,
                color: config.mode === 'pause' ? '#4ade80' : '#888',
              }}>
              <div className="font-medium">Pause Mode</div>
              <div className="text-xs opacity-60">Waits for correct pitch</div>
            </button>
            <button onClick={() => setConfig(p => ({ ...p, mode: 'flow' }))}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm transition-all"
              style={{
                background: config.mode === 'flow' ? 'rgba(234,179,8,0.15)' : 'rgba(20,20,35,0.6)',
                border: `2px solid ${config.mode === 'flow' ? 'rgba(234,179,8,0.4)' : 'rgba(40,40,60,0.3)'}`,
                color: config.mode === 'flow' ? '#fbbf24' : '#888',
              }}>
              <div className="font-medium">Flow Mode</div>
              <div className="text-xs opacity-60">Keeps going, scores timing</div>
            </button>
          </div>
        </div>

        {/* Speed control */}
        <div className="mb-4 w-full max-w-md">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">Speed</span>
            <span className="text-xs text-indigo-300 font-mono">{Math.round(config.speed * 100)}% ({Math.round(config.baseTempo * config.speed)} BPM)</span>
          </div>
          <input type="range" min={25} max={150} value={config.speed * 100}
            onChange={e => setConfig(p => ({ ...p, speed: Number(e.target.value) / 100 }))}
            className="w-full h-1.5 accent-indigo-500" />
          <div className="flex justify-between text-[10px] text-gray-600">
            <span>25%</span><span>50%</span><span>100%</span><span>150%</span>
          </div>
        </div>

        {/* Loop section */}
        <div className="mb-4 w-full max-w-md">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-500">Loop Section</span>
            {config.loopStart > 0 && (
              <button onClick={() => setConfig(p => ({ ...p, loopStart: 0, loopEnd: 0 }))}
                className="text-[10px] text-red-400 hover:text-red-300">Clear</button>
            )}
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-gray-600">From measure</label>
              <input type="number" min={0} max={maxMeasure} value={config.loopStart}
                onChange={e => setConfig(p => ({ ...p, loopStart: Number(e.target.value) }))}
                className="w-full px-2 py-1 rounded text-sm bg-gray-900 text-gray-300 border border-gray-700" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-gray-600">To measure</label>
              <input type="number" min={0} max={maxMeasure} value={config.loopEnd}
                onChange={e => setConfig(p => ({ ...p, loopEnd: Number(e.target.value) }))}
                className="w-full px-2 py-1 rounded text-sm bg-gray-900 text-gray-300 border border-gray-700" />
            </div>
          </div>
        </div>

        {/* Audio settings */}
        <div className="mb-6 w-full max-w-md">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Audio</div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Guide volume</span>
              <input type="range" min={0} max={100} value={config.guideVolume * 100}
                onChange={e => setConfig(p => ({ ...p, guideVolume: Number(e.target.value) / 100 }))}
                className="w-32 h-1 accent-indigo-500" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Self-feedback (hear yourself)</span>
              <button onClick={() => setConfig(p => ({ ...p, selfFeedback: !p.selfFeedback }))}
                className="px-3 py-1 rounded text-xs transition-all"
                style={{
                  background: config.selfFeedback ? 'rgba(99,102,241,0.2)' : 'rgba(40,40,60,0.4)',
                  border: `1px solid ${config.selfFeedback ? 'rgba(99,102,241,0.4)' : 'rgba(60,60,80,0.3)'}`,
                  color: config.selfFeedback ? '#a5b4fc' : '#666',
                }}>
                {config.selfFeedback ? 'ON' : 'OFF'}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Stereo: Guide</span>
              <div className="flex gap-1">
                {[{ label: 'L', val: -0.9 }, { label: 'C', val: 0 }, { label: 'R', val: 0.9 }].map(o => (
                  <button key={o.label} onClick={() => setConfig(p => ({ ...p, guidePan: o.val }))}
                    className="px-2 py-0.5 rounded text-[10px] transition-all"
                    style={{
                      background: Math.abs(config.guidePan - o.val) < 0.2 ? 'rgba(99,102,241,0.2)' : 'transparent',
                      border: `1px solid ${Math.abs(config.guidePan - o.val) < 0.2 ? 'rgba(99,102,241,0.4)' : 'rgba(60,60,80,0.3)'}`,
                      color: Math.abs(config.guidePan - o.val) < 0.2 ? '#a5b4fc' : '#666',
                    }}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            {config.selfFeedback && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Stereo: Voice</span>
                <div className="flex gap-1">
                  {[{ label: 'L', val: -0.9 }, { label: 'C', val: 0 }, { label: 'R', val: 0.9 }].map(o => (
                    <button key={o.label} onClick={() => setConfig(p => ({ ...p, voicePan: o.val }))}
                      className="px-2 py-0.5 rounded text-[10px] transition-all"
                      style={{
                        background: Math.abs(config.voicePan - o.val) < 0.2 ? 'rgba(99,102,241,0.2)' : 'transparent',
                        border: `1px solid ${Math.abs(config.voicePan - o.val) < 0.2 ? 'rgba(99,102,241,0.4)' : 'rgba(60,60,80,0.3)'}`,
                        color: Math.abs(config.voicePan - o.val) < 0.2 ? '#a5b4fc' : '#666',
                      }}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {error && <div className="mb-4 text-red-400 text-sm">{error}</div>}

        <button onClick={startPractice}
          className="px-10 py-4 rounded-2xl text-xl font-bold text-white transition-all active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #6366f1, #4338ca)',
            boxShadow: '0 0 30px rgba(99,102,241,0.3), 0 4px 20px rgba(0,0,0,0.4)',
          }}>
          START PRACTICING
        </button>

        <div className="flex gap-4 mt-4">
          <button onClick={() => setPhase('upload')} className="text-xs text-gray-600 hover:text-gray-400">
            ← Change Score
          </button>
        </div>
      </div>
    )
  }

  // ─── COMPLETE PHASE ───────────────────────────────────────────────────
  if (phase === 'complete') {
    const accuracy = practiceStats.totalNotes > 0
      ? Math.round((practiceStats.notesHit / practiceStats.totalNotes) * 100) : 0

    // Find weak measures
    const weakMeasures = Object.entries(practiceStats.measureAccuracy)
      .filter(([, v]) => v.total > 0 && v.hit / v.total < 0.7)
      .map(([m]) => Number(m))
      .sort((a, b) => a - b)

    return (
      <div className="fixed inset-0 bg-[#08080f] flex flex-col items-center justify-center px-6">
        <div className="text-4xl font-black text-white mb-3" style={{
          textShadow: accuracy >= 90 ? '0 0 30px rgba(100,255,160,0.4)' : '0 0 20px rgba(255,200,60,0.3)',
        }}>
          {accuracy >= 95 ? 'OUTSTANDING!' : accuracy >= 80 ? 'GREAT WORK!' : accuracy >= 60 ? 'GOOD PROGRESS' : 'KEEP PRACTICING'}
        </div>

        <div className="grid grid-cols-3 gap-6 mb-6">
          <div className="text-center">
            <div className="text-xs text-gray-500">ACCURACY</div>
            <div className="text-3xl font-bold" style={{ color: accuracy >= 80 ? '#64ffa0' : '#ffc83c' }}>{accuracy}%</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">NOTES HIT</div>
            <div className="text-3xl font-bold text-white">{practiceStats.notesHit}/{practiceStats.totalNotes}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">BEST STREAK</div>
            <div className="text-3xl font-bold text-purple-400">{practiceStats.maxStreak}</div>
          </div>
        </div>

        {weakMeasures.length > 0 && (
          <div className="mb-6 px-4 py-3 rounded-xl text-center" style={{
            background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)',
          }}>
            <div className="text-xs text-yellow-500 mb-1">MEASURES TO PRACTICE MORE</div>
            <div className="text-sm text-yellow-300 font-mono">
              {weakMeasures.map(m => `m.${m}`).join(', ')}
            </div>
            <button onClick={() => {
              setConfig(p => ({ ...p, loopStart: weakMeasures[0], loopEnd: weakMeasures[weakMeasures.length - 1] }))
              setPhase('setup')
            }} className="mt-2 px-4 py-1.5 rounded-lg text-xs font-medium text-yellow-300 border border-yellow-600 hover:bg-yellow-600/20 transition-all">
              Loop These Measures
            </button>
          </div>
        )}

        <div className="flex gap-4">
          <button onClick={() => { setPhase('setup') }}
            className="px-8 py-3 rounded-xl font-bold text-white active:scale-95 transition-all"
            style={{ background: 'linear-gradient(135deg, #6366f1, #4338ca)' }}>
            PRACTICE AGAIN
          </button>
          <button onClick={() => setPhase('upload')}
            className="px-6 py-3 rounded-xl font-medium text-gray-400 border border-gray-700 active:scale-95 transition-all">
            CHANGE SCORE
          </button>
        </div>
      </div>
    )
  }

  // ─── PRACTICING PHASE ─────────────────────────────────────────────────
  const progress = practiceNotes.length > 0 ? currentIdx / practiceNotes.length : 0
  const currentMeasure = currentNote?.measure ?? 0
  const currentHue = currentNote ? (NOTE_COLORS[currentNote.pitch]?.hue ?? 200) : 200
  const voicePitch = pitchRef.current
  const isOnPitch = voicePitch?.isActive &&
    currentNote && Math.abs(voicePitch.staffPosition - currentNote.semitones) <= 2.5

  return (
    <div className="fixed inset-0 bg-[#08080f] flex flex-col overflow-y-auto">
      {/* HELP / GUIDE BANNER */}
      <div className="px-4 pt-2 pb-1">
        <div className="rounded-lg px-3 py-2 text-[11px] leading-snug"
          style={{ background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.30)', color: '#c7d2fe' }}>
          <span className="font-bold text-white">HOW IT WORKS:</span> Sing the highlighted note.
          The orb turns <span className="text-green-300 font-bold">GREEN</span> when you're on pitch — hold for ~½ sec to advance.
          Mode <span className="text-green-300 font-bold">PAUSE</span> waits for you; <span className="text-yellow-300 font-bold">FLOW</span> keeps moving.
          The guide tone plays the target note. Press <kbd className="px-1 rounded bg-black/40 border border-white/10">Space</kbd> to replay it.
        </div>
      </div>

      {/* SHEET MUSIC (OSMD-rendered) */}
      <div className="mx-4 mt-1 mb-2 rounded-xl p-2"
        style={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(99,102,241,0.30)', maxHeight: '34vh', overflowY: 'auto' }}>
        <div ref={sheetContainerRef} style={{ width: '100%' }} />
      </div>

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-1 pb-2">
        <div className="text-sm text-gray-400">
          m.{currentMeasure} · {currentIdx + 1}/{practiceNotes.length}
        </div>
        <div className="flex items-center gap-3">
          {practiceStats.streak >= 3 && (
            <div className="text-sm font-bold" style={{
              color: practiceStats.streak >= 10 ? '#ff6090' : '#ffc83c',
            }}>
              {practiceStats.streak} streak
            </div>
          )}
          <div className="text-sm text-gray-500">
            {practiceStats.notesHit}/{currentIdx}
          </div>
          <div className="text-xs px-2 py-0.5 rounded font-mono" style={{
            background: config.mode === 'pause' ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)',
            color: config.mode === 'pause' ? '#4ade80' : '#fbbf24',
          }}>
            {config.mode === 'pause' ? 'PAUSE' : 'FLOW'}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 mx-4 rounded-full overflow-hidden" style={{ background: 'rgba(40,40,60,0.4)' }}>
        <div className="h-full rounded-full transition-all duration-300" style={{
          width: `${progress * 100}%`,
          background: 'linear-gradient(90deg, #6366f1, #a78bfa)',
        }} />
      </div>

      {/* Note sequence display */}
      <div className="flex items-center justify-center gap-1 px-4 mt-4 mb-2 overflow-hidden" style={{ height: 48 }}>
        {/* Previous notes (faded) */}
        {prevNotes.map((n, i) => {
          const h = NOTE_COLORS[n.pitch]?.hue ?? 200
          return (
            <div key={`prev-${i}`} className="flex flex-col items-center opacity-30" style={{ minWidth: 36 }}>
              <div className="text-xs font-mono" style={{ color: `hsl(${h}, 50%, 50%)` }}>{n.pitch}</div>
            </div>
          )
        })}

        {/* Current note (large, highlighted) */}
        {currentNote && (
          <div className="flex flex-col items-center mx-3" style={{ minWidth: 60 }}>
            <div className="text-2xl font-black transition-all" style={{
              color: isOnPitch ? '#64ffa0' : `hsl(${currentHue}, 70%, 65%)`,
              textShadow: isOnPitch ? '0 0 20px rgba(100,255,160,0.5)' : `0 0 15px hsl(${currentHue}, 60%, 40%, 0.4)`,
            }}>
              {currentNote.pitch}
            </div>
          </div>
        )}

        {/* Next notes (faded) */}
        {nextNotes.map((n, i) => {
          const h = NOTE_COLORS[n.pitch]?.hue ?? 200
          return (
            <div key={`next-${i}`} className="flex flex-col items-center" style={{ minWidth: 36, opacity: 0.15 + i * -0.02 }}>
              <div className="text-xs font-mono" style={{ color: `hsl(${h}, 50%, 50%)` }}>{n.pitch}</div>
            </div>
          )
        })}
      </div>

      {/* Main visual — pitch orb */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="relative w-40 h-40 rounded-full flex items-center justify-center transition-all duration-200" style={{
          background: isOnPitch
            ? 'radial-gradient(circle, rgba(100,255,160,0.2) 0%, rgba(100,255,160,0.05) 60%, transparent 100%)'
            : `radial-gradient(circle, hsl(${currentHue}, 50%, 20%) 0%, hsl(${currentHue}, 30%, 8%) 60%, transparent 100%)`,
          boxShadow: isOnPitch
            ? '0 0 60px rgba(100,255,160,0.3), 0 0 120px rgba(100,255,160,0.1)'
            : `0 0 40px hsl(${currentHue}, 50%, 30%, 0.2)`,
          border: isOnPitch
            ? '3px solid rgba(100,255,160,0.5)'
            : `2px solid hsl(${currentHue}, 40%, 30%)`,
        }}>
          {/* Target note */}
          <div className="text-center">
            {currentNote ? (
              <>
                <div className="text-4xl font-black" style={{
                  color: isOnPitch ? '#64ffa0' : `hsl(${currentHue}, 60%, 60%)`,
                }}>
                  {currentNote.pitch.replace(/\d/, '')}
                </div>
                <div className="text-sm text-gray-500">{currentNote.pitch}</div>
              </>
            ) : (
              <div className="text-lg text-gray-500">Done!</div>
            )}
          </div>

          {/* Match progress ring */}
          {matchProgress > 0 && (
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(100,255,160,0.15)" strokeWidth="3" />
              <circle cx="50" cy="50" r="48" fill="none"
                stroke={isOnPitch ? '#64ffa0' : `hsl(${currentHue}, 60%, 50%)`}
                strokeWidth="3"
                strokeDasharray={`${matchProgress * 301.6} 301.6`}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
                style={{ transition: 'stroke-dasharray 0.1s linear' }}
              />
            </svg>
          )}
        </div>

        {/* Voice feedback */}
        <div className="mt-4 text-center h-8">
          {voicePitch?.isActive ? (
            <div className="text-sm">
              <span style={{ color: isOnPitch ? '#64ffa0' : '#f87171' }}>
                {voicePitch.note || '...'}
              </span>
              <span className="text-gray-600 ml-2">
                {voicePitch.cents > 0 ? '+' : ''}{voicePitch.cents}¢
              </span>
              {!isOnPitch && currentNote && (
                <span className="text-gray-500 ml-2">
                  {voicePitch.staffPosition < currentNote.semitones ? '↑ higher' : '↓ lower'}
                </span>
              )}
            </div>
          ) : (
            <div className="text-xs text-gray-600">Sing the note...</div>
          )}
        </div>

        {/* Replay guide button */}
        {currentNote && (
          <button onClick={() => {
            const msPerBeat = (60000 / config.baseTempo) / config.speed
            playGuideNote(currentNote.semitones, currentNote.duration * msPerBeat, config.guideVolume, config.guidePan)
          }}
            className="mt-2 px-4 py-1.5 rounded-lg text-xs text-gray-400 border border-gray-700 active:scale-95 transition-all">
            🔊 Replay Guide
          </button>
        )}
      </div>

      {/* Bottom controls */}
      <div className="px-4 pb-4">
        {/* Speed slider */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-gray-600 w-12">Speed</span>
          <input type="range" min={25} max={150} value={config.speed * 100}
            onChange={e => setConfig(p => ({ ...p, speed: Number(e.target.value) / 100 }))}
            className="flex-1 h-1 accent-indigo-500" />
          <span className="text-xs text-indigo-300 font-mono w-10">{Math.round(config.speed * 100)}%</span>
        </div>

        <div className="flex justify-center gap-3">
          <button onClick={stopPractice}
            className="px-5 py-2 rounded-xl text-sm text-gray-500 border border-gray-700 active:scale-95 transition-all">
            Stop
          </button>
        </div>
      </div>
    </div>
  )
}
