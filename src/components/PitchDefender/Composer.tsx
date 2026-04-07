'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// Composer — Manual Music Entry for Pitch Defender
// ═══════════════════════════════════════════════════════════════════════════════
//
// Built because OCR-from-photos is unreliable: typed compositions are the
// canonical source. Click to place notes on the staff with the selected
// duration; save to localStorage so any other game (Synthesia, NoteRunner,
// ChoirPractice, SheetMusicViewer) can load and use them.
//
// V1 scope:
//   - Single voice, treble OR bass clef (toggle)
//   - All standard durations: whole, half, quarter, eighth, sixteenth
//   - Dotted variant for any duration
//   - Triplet groups for quarter/eighth/sixteenth
//   - Sharp / natural / flat accidental picker
//   - Auto-flow: notes advance left-to-right, bar lines snap by time signature
//   - Click placed note to select; Delete/Backspace removes
//   - Save → localStorage (`pd_composed_{slug}`); Download → .musicxml file
//   - Load saved compositions back into the editor
//
// SIBLING — does not modify any existing game.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useEffect } from 'react'
import { initAudio, playPianoNote, loadPianoSamples } from './audioEngine'

// ─── Types ──────────────────────────────────────────────────────────────────

type DurationName = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth'
type Accidental = 'natural' | 'sharp' | 'flat'
type Clef = 'treble' | 'bass'

interface ComposerNote {
  id: number
  semitones: number     // from C4
  pitchName: string     // e.g. "F#5"
  duration: DurationName
  dotted: boolean
  triplet: boolean
  beats: number         // total duration in beats (1 = quarter)
}

interface SavedComposition {
  title: string
  clef: Clef
  keyFifths: number     // -7..+7 (negative = flats)
  timeBeats: number     // numerator
  timeBeatType: number  // denominator (2/4/8/16)
  tempo: number
  notes: ComposerNote[]
  savedAt: string
}

const STORAGE_PREFIX = 'pd_composed_'

// Beat values for each base duration (1 = quarter)
const DURATION_BEATS: Record<DurationName, number> = {
  whole: 4,
  half: 2,
  quarter: 1,
  eighth: 0.5,
  sixteenth: 0.25,
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const STEP_TO_SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

function semiToName(semi: number): string {
  const idx = ((Math.round(semi) % 12) + 12) % 12
  const oct = 4 + Math.floor(semi / 12)
  return `${NOTE_NAMES[idx]}${oct}`
}

function computeBeats(duration: DurationName, dotted: boolean, triplet: boolean): number {
  let b = DURATION_BEATS[duration]
  if (dotted) b *= 1.5
  if (triplet) b *= 2 / 3
  return b
}

// ─── Staff Math ────────────────────────────────────────────────────────────
//
// Treble clef: bottom line = E4 (semi 4), top line = F5 (semi 17)
// Bass clef:   bottom line = G2 (semi -17), top line = A3 (semi -3)
//
// Each line/space = ONE diatonic step. Y-step = lineSpacing / 2.
//
// To convert a click Y to a semitone: figure out how many half-spaces above
// the staff midline the click is, then map to the nearest diatonic note in
// the current key.

const LINE_SPACING = 14
const STAFF_TOP = 80     // y of top line of the staff
const STAFF_LINES = 5
const STAFF_BOTTOM = STAFF_TOP + (STAFF_LINES - 1) * LINE_SPACING

function staffMidlineSemi(clef: Clef): number {
  // semitone of the middle line
  return clef === 'treble' ? 11 /* B4 */ : -6 /* D3 */
}

function diatonicStepFromMidline(yFromMidline: number): number {
  // Each half-space (lineSpacing/2) = 1 diatonic step. Negative = up.
  return Math.round(-yFromMidline / (LINE_SPACING / 2))
}

// Map a diatonic step (from B4 in treble, D3 in bass) → semitones from C4.
// This handles the irregular semitone gaps between E-F and B-C.
function diatonicStepToSemi(midlineSemi: number, step: number): number {
  // Walk diatonically from midline by `step` whole-letters.
  // Treble midline B4 = step 0. Going up: C5 = +1, D5 = +2, ...
  // Going down: A4 = -1, G4 = -2, ...
  const midNoteIdx = ((midlineSemi % 12) + 12) % 12 // pitch class
  // Find which letter the midline is on
  const letterOrder = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
  const midLetterIdx = letterOrder.findIndex(L => STEP_TO_SEMI[L] === midNoteIdx)
  if (midLetterIdx < 0) return midlineSemi
  // step semitone from midline letter
  const targetLetterIdx = ((midLetterIdx + step) % 7 + 7) % 7
  const octaveDelta = Math.floor((midLetterIdx + step) / 7)
  const targetLetter = letterOrder[targetLetterIdx]
  const targetSemi = STEP_TO_SEMI[targetLetter] + octaveDelta * 12 + (midlineSemi - midNoteIdx)
  return targetSemi
}

// Y position for a given semitone on a clef
function semiToY(semi: number, clef: Clef): number {
  const midSemi = staffMidlineSemi(clef)
  // Find diatonic step from midline (handle accidentals by snapping to natural letter)
  const letterOrder = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
  const semiClass = ((semi % 12) + 12) % 12
  // Find nearest natural letter for this semitone (snap accidentals to their letter)
  const letterMap = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6] // semi class -> letter index
  const letterIdx = letterMap[semiClass]
  const naturalSemi = STEP_TO_SEMI[letterOrder[letterIdx]]
  const octaveDelta = Math.floor((semi - naturalSemi) / 12)
  // Diatonic step from middle line
  const midSemiClass = ((midSemi % 12) + 12) % 12
  const midLetterIdx = letterMap[midSemiClass]
  const midOctave = Math.floor((midSemi - STEP_TO_SEMI[letterOrder[midLetterIdx]]) / 12)
  const stepDelta = (letterIdx - midLetterIdx) + (octaveDelta - midOctave) * 7
  // Convert step → Y. Each step = lineSpacing/2. Up = smaller Y.
  const midlineY = STAFF_TOP + ((STAFF_LINES - 1) / 2) * LINE_SPACING
  return midlineY - stepDelta * (LINE_SPACING / 2)
}

// Y → semitone for click placement (snaps to nearest line/space)
function yToSemi(y: number, clef: Clef): number {
  const midlineY = STAFF_TOP + ((STAFF_LINES - 1) / 2) * LINE_SPACING
  const yFromMid = y - midlineY
  const step = diatonicStepFromMidline(yFromMid)
  return diatonicStepToSemi(staffMidlineSemi(clef), step)
}

// ─── MusicXML Export ────────────────────────────────────────────────────────

function buildMusicXML(comp: SavedComposition): string {
  // Use divisions = 16 so all our durations divide cleanly
  const DIV = 16
  const beatsToDuration = (beats: number) => Math.round(beats * DIV)

  const durationToType = (d: DurationName): string => ({
    whole: 'whole', half: 'half', quarter: 'quarter',
    eighth: 'eighth', sixteenth: '16th',
  }[d])

  // Group notes into measures
  const measureLength = comp.timeBeats * (4 / comp.timeBeatType)
  const measures: ComposerNote[][] = [[]]
  let currentBeats = 0
  for (const n of comp.notes) {
    if (currentBeats + n.beats > measureLength + 0.001) {
      measures.push([])
      currentBeats = 0
    }
    measures[measures.length - 1].push(n)
    currentBeats += n.beats
  }

  const noteToXML = (n: ComposerNote): string => {
    const m = n.pitchName.match(/^([A-G])(#|b)?(\d)$/)
    if (!m) return ''
    const step = m[1]
    const alter = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0
    const octave = m[3]
    const dur = beatsToDuration(n.beats)
    const type = durationToType(n.duration)
    const dot = n.dotted ? '<dot/>' : ''
    const tup = n.triplet
      ? '<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>'
      : ''
    const acc = alter !== 0 ? `<alter>${alter}</alter>` : ''
    return `      <note><pitch><step>${step}</step>${acc}<octave>${octave}</octave></pitch><duration>${dur}</duration><voice>1</voice><type>${type}</type>${dot}${tup}</note>`
  }

  const measureXML = (notes: ComposerNote[], num: number, isFirst: boolean): string => {
    const attrs = isFirst ? `      <attributes>
        <divisions>${DIV}</divisions>
        <key><fifths>${comp.keyFifths}</fifths><mode>major</mode></key>
        <time><beats>${comp.timeBeats}</beats><beat-type>${comp.timeBeatType}</beat-type></time>
        <clef><sign>${comp.clef === 'treble' ? 'G' : 'F'}</sign><line>${comp.clef === 'treble' ? '2' : '4'}</line></clef>
      </attributes>
      <direction placement="above">
        <direction-type><words font-weight="bold">♩=${comp.tempo}</words></direction-type>
        <sound tempo="${comp.tempo}"/>
      </direction>` : ''
    return `    <measure number="${num}">
${attrs}
${notes.map(noteToXML).join('\n')}
    </measure>`
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work><work-title>${comp.title.replace(/[<>&"]/g, '')}</work-title></work>
  <identification>
    <encoding>
      <software>Pitch Defender Composer</software>
      <encoding-date>${comp.savedAt.slice(0, 10)}</encoding-date>
    </encoding>
  </identification>
  <part-list>
    <score-part id="P1"><part-name>Voice</part-name></score-part>
  </part-list>
  <part id="P1">
${measures.map((m, i) => measureXML(m, i + 1, i === 0)).join('\n')}
  </part>
</score-partwise>`
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function Composer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [notes, setNotes] = useState<ComposerNote[]>([])
  const [selectedDuration, setSelectedDuration] = useState<DurationName>('quarter')
  const [dotted, setDotted] = useState(false)
  const [triplet, setTriplet] = useState(false)
  const [accidental, setAccidental] = useState<Accidental>('natural')
  const [clef, setClef] = useState<Clef>('treble')
  const [title, setTitle] = useState('Untitled')
  const [tempo, setTempo] = useState(100)
  const [keyFifths, setKeyFifths] = useState(0)
  const [timeBeats, setTimeBeats] = useState(4)
  const [timeBeatType, setTimeBeatType] = useState(4)
  const [hoverY, setHoverY] = useState<number | null>(null)
  const [hoverX, setHoverX] = useState<number | null>(null)
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null)
  const [savedList, setSavedList] = useState<{ key: string; comp: SavedComposition }[]>([])
  const [statusMsg, setStatusMsg] = useState<string>('')

  const idCounterRef = useRef(0)

  // Layout constants
  const NOTE_SPACING = 36   // horizontal gap between notes
  const NOTES_START_X = 90  // first note position (after clef + key sig + time sig)
  const STAFF_W = 1400      // total drawable width

  // ─── Preload audio ──────────────────────────────────────────
  useEffect(() => {
    initAudio()
    loadPianoSamples().catch(err => console.error('Piano sample load failed:', err))
  }, [])

  // ─── Load saved compositions list ────────────────────────────
  useEffect(() => {
    refreshSavedList()
  }, [])

  const refreshSavedList = useCallback(() => {
    const list: { key: string; comp: SavedComposition }[] = []
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(STORAGE_PREFIX)) {
          try {
            const comp = JSON.parse(localStorage.getItem(key) || '{}')
            if (comp.notes) list.push({ key, comp })
          } catch {}
        }
      }
    } catch {}
    list.sort((a, b) => (b.comp.savedAt || '').localeCompare(a.comp.savedAt || ''))
    setSavedList(list)
  }, [])

  // ─── Add note (click on staff) ───────────────────────────────
  const handleStaffClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * canvas.clientWidth
    const y = ((e.clientY - rect.top) / rect.height) * canvas.clientHeight

    // Check if click is on an existing note → select it
    const beats = computeBeats(selectedDuration, dotted, triplet)
    let cursorX = NOTES_START_X
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i]
      const nY = semiToY(n.semitones, clef)
      const dx = x - cursorX
      const dy = y - nY
      if (Math.abs(dx) < 12 && Math.abs(dy) < 10) {
        setSelectedNoteId(n.id)
        // Play it
        playPianoNote(n.pitchName)
        return
      }
      cursorX += NOTE_SPACING * Math.max(0.5, n.beats)
    }

    // Otherwise add a new note at the snapped pitch
    let semi = yToSemi(y, clef)
    if (accidental === 'sharp') semi += 1
    if (accidental === 'flat') semi -= 1
    const pitchName = semiToName(semi)
    const newNote: ComposerNote = {
      id: ++idCounterRef.current,
      semitones: semi,
      pitchName,
      duration: selectedDuration,
      dotted,
      triplet,
      beats,
    }
    setNotes(prev => [...prev, newNote])
    setSelectedNoteId(newNote.id)
    // Play the note for audio feedback
    playPianoNote(pitchName)
  }, [notes, selectedDuration, dotted, triplet, accidental, clef])

  // ─── Mouse hover (ghost note preview) ────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    setHoverX(((e.clientX - rect.left) / rect.width) * canvas.clientWidth)
    setHoverY(((e.clientY - rect.top) / rect.height) * canvas.clientHeight)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setHoverX(null)
    setHoverY(null)
  }, [])

  // ─── Delete selected / last note ─────────────────────────────
  const deleteSelected = useCallback(() => {
    if (selectedNoteId != null) {
      setNotes(prev => prev.filter(n => n.id !== selectedNoteId))
      setSelectedNoteId(null)
    } else {
      // No selection — pop the last note
      setNotes(prev => prev.slice(0, -1))
    }
  }, [selectedNoteId])

  // Keyboard delete/backspace
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Don't intercept when typing in input fields
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
        e.preventDefault()
        deleteSelected()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deleteSelected])

  // ─── Save / Load / Download ──────────────────────────────────
  const slugify = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'untitled'

  const buildComposition = (): SavedComposition => ({
    title,
    clef,
    keyFifths,
    timeBeats,
    timeBeatType,
    tempo,
    notes,
    savedAt: new Date().toISOString(),
  })

  const handleSave = useCallback(() => {
    if (notes.length === 0) {
      setStatusMsg('Nothing to save — add some notes first')
      return
    }
    const comp = buildComposition()
    const key = STORAGE_PREFIX + slugify(title)
    try {
      localStorage.setItem(key, JSON.stringify(comp))
      setStatusMsg(`Saved as "${title}" — available in all Pitch Defender games`)
      refreshSavedList()
    } catch (err) {
      setStatusMsg('Save failed: ' + (err as Error).message)
    }
    setTimeout(() => setStatusMsg(''), 4000)
  }, [notes, title, clef, keyFifths, timeBeats, timeBeatType, tempo, refreshSavedList])

  const handleDownload = useCallback(() => {
    if (notes.length === 0) {
      setStatusMsg('Nothing to download — add some notes first')
      return
    }
    const comp = buildComposition()
    const xml = buildMusicXML(comp)
    const blob = new Blob([xml], { type: 'application/vnd.recordare.musicxml+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${slugify(title)}.musicxml`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setStatusMsg(`Downloaded ${slugify(title)}.musicxml`)
    setTimeout(() => setStatusMsg(''), 4000)
  }, [notes, title, clef, keyFifths, timeBeats, timeBeatType, tempo])

  const handleLoadSaved = useCallback((key: string) => {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return
      const comp: SavedComposition = JSON.parse(raw)
      setTitle(comp.title)
      setClef(comp.clef)
      setKeyFifths(comp.keyFifths)
      setTimeBeats(comp.timeBeats)
      setTimeBeatType(comp.timeBeatType)
      setTempo(comp.tempo)
      setNotes(comp.notes.map(n => ({ ...n, id: ++idCounterRef.current })))
      setSelectedNoteId(null)
      setStatusMsg(`Loaded "${comp.title}"`)
      setTimeout(() => setStatusMsg(''), 3000)
    } catch (err) {
      setStatusMsg('Load failed: ' + (err as Error).message)
    }
  }, [])

  const handleDeleteSaved = useCallback((key: string, name: string) => {
    if (!confirm(`Delete saved composition "${name}"?`)) return
    localStorage.removeItem(key)
    refreshSavedList()
    setStatusMsg(`Deleted "${name}"`)
    setTimeout(() => setStatusMsg(''), 3000)
  }, [refreshSavedList])

  const handleClear = useCallback(() => {
    if (notes.length === 0) return
    if (!confirm('Clear all notes? This cannot be undone (unless you re-load).')) return
    setNotes([])
    setSelectedNoteId(null)
  }, [notes])

  // ─── Render staff ────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const cssW = STAFF_W
    const cssH = 240
    canvas.width = cssW * dpr
    canvas.height = cssH * dpr
    canvas.style.width = `${cssW}px`
    canvas.style.height = `${cssH}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)

    // Background
    ctx.fillStyle = '#fafaf7'
    ctx.fillRect(0, 0, cssW, cssH)

    // Staff lines
    ctx.strokeStyle = '#222'
    ctx.lineWidth = 1
    for (let i = 0; i < STAFF_LINES; i++) {
      const y = STAFF_TOP + i * LINE_SPACING
      ctx.beginPath()
      ctx.moveTo(20, y)
      ctx.lineTo(cssW - 20, y)
      ctx.stroke()
    }
    // Left bar (start of staff)
    ctx.beginPath()
    ctx.moveTo(20, STAFF_TOP)
    ctx.lineTo(20, STAFF_BOTTOM)
    ctx.stroke()

    // Clef glyph (simple text version)
    ctx.fillStyle = '#222'
    ctx.font = 'bold 56px serif'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    if (clef === 'treble') {
      ctx.fillText('𝄞', 40, STAFF_TOP + 2 * LINE_SPACING + 4)
    } else {
      ctx.fillText('𝄢', 40, STAFF_TOP + 1.5 * LINE_SPACING)
    }

    // Time signature
    ctx.font = 'bold 22px serif'
    ctx.fillText(`${timeBeats}`, 70, STAFF_TOP + 1 * LINE_SPACING)
    ctx.fillText(`${timeBeatType}`, 70, STAFF_TOP + 3 * LINE_SPACING)

    // Notes + bar lines
    let cursorX = NOTES_START_X
    let beatsInMeasure = 0
    const measureLen = timeBeats * (4 / timeBeatType)

    for (let i = 0; i < notes.length; i++) {
      const n = notes[i]
      const nY = semiToY(n.semitones, clef)
      const isSelected = n.id === selectedNoteId
      drawNoteHead(ctx, cursorX, nY, n, isSelected)
      drawLedgerLines(ctx, cursorX, nY)
      cursorX += NOTE_SPACING * Math.max(0.5, n.beats)
      beatsInMeasure += n.beats
      // Bar line when measure fills
      if (beatsInMeasure >= measureLen - 0.001) {
        beatsInMeasure = 0
        ctx.strokeStyle = '#222'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(cursorX - NOTE_SPACING / 2, STAFF_TOP)
        ctx.lineTo(cursorX - NOTE_SPACING / 2, STAFF_BOTTOM)
        ctx.stroke()
      }
    }

    // Hover ghost note
    if (hoverY != null && hoverX != null && hoverX > NOTES_START_X - 20) {
      const semi = yToSemi(hoverY, clef)
      const previewSemi = semi + (accidental === 'sharp' ? 1 : accidental === 'flat' ? -1 : 0)
      const ghostY = semiToY(previewSemi, clef)
      ctx.globalAlpha = 0.35
      ctx.fillStyle = '#3b82f6'
      ctx.beginPath()
      ctx.ellipse(cursorX, ghostY, 7, 5, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
      // Pitch label
      ctx.fillStyle = '#3b82f6'
      ctx.font = 'bold 14px monospace'
      ctx.textAlign = 'left'
      ctx.fillText(semiToName(previewSemi), cursorX + 14, ghostY + 4)
    }
  }, [notes, clef, keyFifths, timeBeats, timeBeatType, hoverX, hoverY, selectedNoteId, accidental])

  // ─── Note glyph helpers ──────────────────────────────────────
  function drawNoteHead(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    n: ComposerNote,
    isSelected: boolean,
  ) {
    const filled = n.duration === 'quarter' || n.duration === 'eighth' || n.duration === 'sixteenth'
    ctx.fillStyle = isSelected ? '#dc2626' : '#111'
    ctx.strokeStyle = isSelected ? '#dc2626' : '#111'
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.ellipse(x, y, 7, 5, -0.2, 0, Math.PI * 2)
    if (filled) ctx.fill()
    else ctx.stroke()

    // Stem (skip for whole notes)
    if (n.duration !== 'whole') {
      const stemUp = y > STAFF_TOP + 2 * LINE_SPACING
      ctx.beginPath()
      if (stemUp) {
        ctx.moveTo(x + 6, y - 1)
        ctx.lineTo(x + 6, y - 30)
      } else {
        ctx.moveTo(x - 6, y + 1)
        ctx.lineTo(x - 6, y + 30)
      }
      ctx.stroke()

      // Flags for eighth/sixteenth
      if (n.duration === 'eighth' || n.duration === 'sixteenth') {
        ctx.fillStyle = isSelected ? '#dc2626' : '#111'
        const fx = stemUp ? x + 6 : x - 6
        const fyTop = stemUp ? y - 30 : y + 30
        ctx.beginPath()
        ctx.moveTo(fx, fyTop)
        ctx.quadraticCurveTo(fx + 12, fyTop + 6, fx + 8, fyTop + 12)
        ctx.lineTo(fx, fyTop + 6)
        ctx.fill()
        if (n.duration === 'sixteenth') {
          ctx.beginPath()
          ctx.moveTo(fx, fyTop + 6)
          ctx.quadraticCurveTo(fx + 12, fyTop + 12, fx + 8, fyTop + 18)
          ctx.lineTo(fx, fyTop + 12)
          ctx.fill()
        }
      }
    }

    // Dot
    if (n.dotted) {
      ctx.fillStyle = isSelected ? '#dc2626' : '#111'
      ctx.beginPath()
      ctx.arc(x + 12, y, 1.8, 0, Math.PI * 2)
      ctx.fill()
    }

    // Triplet bracket label
    if (n.triplet) {
      ctx.fillStyle = isSelected ? '#dc2626' : '#666'
      ctx.font = '11px serif'
      ctx.textAlign = 'center'
      ctx.fillText('3', x, y - 36)
    }

    // Accidental
    const m = n.pitchName.match(/(#|b)/)
    if (m) {
      ctx.fillStyle = isSelected ? '#dc2626' : '#111'
      ctx.font = 'bold 16px serif'
      ctx.textAlign = 'right'
      ctx.fillText(m[1] === '#' ? '♯' : '♭', x - 8, y + 5)
    }
  }

  function drawLedgerLines(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.strokeStyle = '#222'
    ctx.lineWidth = 1
    // Above staff
    let lineY = STAFF_TOP - LINE_SPACING
    while (lineY >= y - LINE_SPACING / 2) {
      ctx.beginPath()
      ctx.moveTo(x - 10, lineY)
      ctx.lineTo(x + 10, lineY)
      ctx.stroke()
      lineY -= LINE_SPACING
    }
    // Below staff
    lineY = STAFF_BOTTOM + LINE_SPACING
    while (lineY <= y + LINE_SPACING / 2) {
      ctx.beginPath()
      ctx.moveTo(x - 10, lineY)
      ctx.lineTo(x + 10, lineY)
      ctx.stroke()
      lineY += LINE_SPACING
    }
  }

  // ─── UI ──────────────────────────────────────────────────────

  const palette: { d: DurationName; label: string; glyph: string }[] = [
    { d: 'whole', label: 'whole', glyph: '𝅝' },
    { d: 'half', label: 'half', glyph: '𝅗𝅥' },
    { d: 'quarter', label: 'quarter', glyph: '♩' },
    { d: 'eighth', label: 'eighth', glyph: '♪' },
    { d: 'sixteenth', label: '16th', glyph: '♬' },
  ]

  const totalBeats = notes.reduce((s, n) => s + n.beats, 0)
  const measureCount = Math.max(1, Math.ceil(totalBeats / (timeBeats * (4 / timeBeatType))))

  return (
    <div className="fixed inset-0 bg-[#0b0b14] flex flex-col overflow-y-auto">
      {/* Top bar */}
      <div className="px-4 py-3 border-b border-gray-800/60 flex items-center gap-3 flex-wrap bg-[#08080f]">
        <h1 className="text-lg font-bold text-white mr-4">Composer</h1>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Title"
          className="px-3 py-1.5 bg-[#15152a] border border-[#3a3a55] rounded text-sm text-white w-48"
        />
        <select
          value={clef}
          onChange={e => setClef(e.target.value as Clef)}
          className="px-2 py-1.5 bg-[#15152a] border border-[#3a3a55] rounded text-xs text-gray-200"
        >
          <option value="treble">Treble Clef</option>
          <option value="bass">Bass Clef</option>
        </select>
        <select
          value={`${timeBeats}/${timeBeatType}`}
          onChange={e => {
            const [n, d] = e.target.value.split('/').map(Number)
            setTimeBeats(n)
            setTimeBeatType(d)
          }}
          className="px-2 py-1.5 bg-[#15152a] border border-[#3a3a55] rounded text-xs text-gray-200"
        >
          <option>4/4</option>
          <option>3/4</option>
          <option>2/4</option>
          <option>6/8</option>
          <option>2/2</option>
        </select>
        <select
          value={keyFifths}
          onChange={e => setKeyFifths(parseInt(e.target.value))}
          className="px-2 py-1.5 bg-[#15152a] border border-[#3a3a55] rounded text-xs text-gray-200"
        >
          <option value="-4">A♭ major (4♭)</option>
          <option value="-3">E♭ major (3♭)</option>
          <option value="-2">B♭ major (2♭)</option>
          <option value="-1">F major (1♭)</option>
          <option value="0">C major</option>
          <option value="1">G major (1♯)</option>
          <option value="2">D major (2♯)</option>
          <option value="3">A major (3♯)</option>
          <option value="4">E major (4♯)</option>
          <option value="5">B major (5♯)</option>
        </select>
        <label className="text-xs text-gray-400 flex items-center gap-1">
          ♩=
          <input
            type="number"
            value={tempo}
            onChange={e => setTempo(parseInt(e.target.value) || 100)}
            className="px-2 py-1 bg-[#15152a] border border-[#3a3a55] rounded text-xs text-white w-16"
            min={40}
            max={240}
          />
        </label>
        <div className="ml-auto text-xs text-gray-500">
          {notes.length} notes · {measureCount} measures · {totalBeats.toFixed(2)} beats
        </div>
      </div>

      {/* Note palette */}
      <div className="px-4 py-3 border-b border-gray-800/40 flex items-center gap-2 flex-wrap bg-[#0a0a14]">
        <span className="text-xs text-gray-500 uppercase tracking-wider mr-2">Duration</span>
        {palette.map(p => (
          <button
            key={p.d}
            onClick={() => setSelectedDuration(p.d)}
            className="px-3 py-2 rounded text-sm font-bold transition-all flex items-center gap-2"
            style={{
              background: selectedDuration === p.d ? 'rgba(99,102,241,0.25)' : 'rgba(40,40,60,0.5)',
              border: `1px solid ${selectedDuration === p.d ? '#6366f1' : 'rgba(60,60,80,0.5)'}`,
              color: selectedDuration === p.d ? '#a5b4fc' : '#888',
            }}
          >
            <span className="text-xl">{p.glyph}</span>
            <span className="text-xs">{p.label}</span>
          </button>
        ))}
        <div className="w-px h-8 bg-gray-700 mx-1" />
        <button
          onClick={() => setDotted(!dotted)}
          className="px-3 py-2 rounded text-xs font-bold transition-all"
          style={{
            background: dotted ? 'rgba(99,102,241,0.25)' : 'rgba(40,40,60,0.5)',
            border: `1px solid ${dotted ? '#6366f1' : 'rgba(60,60,80,0.5)'}`,
            color: dotted ? '#a5b4fc' : '#888',
          }}
          title="Dotted (×1.5 duration)"
        >
          dotted ·
        </button>
        <button
          onClick={() => setTriplet(!triplet)}
          className="px-3 py-2 rounded text-xs font-bold transition-all"
          style={{
            background: triplet ? 'rgba(99,102,241,0.25)' : 'rgba(40,40,60,0.5)',
            border: `1px solid ${triplet ? '#6366f1' : 'rgba(60,60,80,0.5)'}`,
            color: triplet ? '#a5b4fc' : '#888',
          }}
          title="Triplet (×2/3 duration)"
        >
          triplet 3
        </button>
        <div className="w-px h-8 bg-gray-700 mx-1" />
        <span className="text-xs text-gray-500 uppercase tracking-wider mr-1">Accidental</span>
        {(['flat', 'natural', 'sharp'] as Accidental[]).map(a => (
          <button
            key={a}
            onClick={() => setAccidental(a)}
            className="px-3 py-2 rounded text-base font-bold transition-all"
            style={{
              background: accidental === a ? 'rgba(99,102,241,0.25)' : 'rgba(40,40,60,0.5)',
              border: `1px solid ${accidental === a ? '#6366f1' : 'rgba(60,60,80,0.5)'}`,
              color: accidental === a ? '#a5b4fc' : '#888',
            }}
            title={a}
          >
            {a === 'flat' ? '♭' : a === 'sharp' ? '♯' : '♮'}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={deleteSelected}
            className="px-3 py-2 rounded text-xs font-bold text-red-300 border border-red-900/50 hover:bg-red-900/20 transition-all"
            title="Delete selected note (or last note if none selected). Hotkey: Delete/Backspace"
          >
            ← Delete
          </button>
          <button
            onClick={handleClear}
            className="px-3 py-2 rounded text-xs font-bold text-gray-400 border border-gray-700 hover:bg-gray-800 transition-all"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Help line */}
      <div className="px-4 py-1.5 bg-[#0a0a14] border-b border-gray-800/40 text-[11px] text-gray-500">
        <span className="text-cyan-400">Click on the staff</span> to place a note at the current cursor with the selected duration.
        Click an existing note to <span className="text-yellow-400">select</span> it (then Delete to remove). Notes auto-flow into measures.
      </div>

      {/* Staff canvas */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden bg-[#0b0b14] p-4 flex justify-center">
        <canvas
          ref={canvasRef}
          onClick={handleStaffClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{
            cursor: 'crosshair',
            borderRadius: 8,
            border: '1px solid rgba(99,102,241,0.3)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          }}
        />
      </div>

      {/* Save bar + saved list */}
      <div className="px-4 py-3 border-t border-gray-800/60 bg-[#08080f]">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-sm font-bold text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
          >
            Save (use in any game)
          </button>
          <button
            onClick={handleDownload}
            className="px-4 py-2 rounded-lg text-sm font-bold text-indigo-300 border border-indigo-700 hover:bg-indigo-900/30 transition-all"
          >
            Download .musicxml
          </button>
          {statusMsg && (
            <div className="text-xs text-emerald-300">{statusMsg}</div>
          )}
          <a href="/pitch-defender" className="ml-auto text-xs text-gray-600 hover:text-gray-400 transition-colors">
            ← Back
          </a>
        </div>

        {savedList.length > 0 && (
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Saved Compositions</div>
            <div className="flex flex-wrap gap-2">
              {savedList.map(({ key, comp }) => (
                <div key={key} className="flex items-center gap-1 bg-[#15152a] border border-[#3a3a55] rounded px-2 py-1">
                  <button
                    onClick={() => handleLoadSaved(key)}
                    className="text-xs text-indigo-300 hover:text-indigo-200"
                  >
                    {comp.title}
                  </button>
                  <span className="text-[10px] text-gray-600">({comp.notes.length} notes)</span>
                  <button
                    onClick={() => handleDeleteSaved(key, comp.title)}
                    className="text-[10px] text-red-500 hover:text-red-400 ml-1"
                    title="Delete this composition"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
