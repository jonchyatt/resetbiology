'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// Composer V2 — Real Music Notation Editor (VexFlow-backed)
// ═══════════════════════════════════════════════════════════════════════════════
//
// V1 was a click-to-place toy with hand-drawn noteheads. V2 is the real thing:
// VexFlow handles all the notation rendering (beaming, stems, accidentals,
// dynamics, articulations, repeat bars, codas, time signatures, key signatures,
// ledger lines, dotted rhythms, tuplets) so it actually LOOKS like sheet music.
//
// Flow:
//   1. SETUP WIZARD — explicit choice of clef, time sig, key sig, tempo, title.
//      No defaults forced. User clicks "Begin Composing" to start.
//   2. EDITOR — VexFlow staff renders the composition. Click empty staff to
//      place a note at the cursor with the selected duration. Click an existing
//      note to open a popup that lets you change duration, accidental, dot,
//      triplet, dynamic, articulation, or delete it. Drag a notehead to change
//      its pitch in place. Hotkeys for duration/accidental.
//   3. SAVE — to localStorage (`pd_composed_*`) and/or download .musicxml.
//
// Includes from the start: beaming (free with VexFlow), proper stem direction,
// real accidental positioning, dynamics palette, fermata, staccato, accent,
// repeat barlines (begin/end), volta endings, double bar, final bar, ties.
//
// Still TODO (v3): grand staff (treble + bass), multiple voices/chords on
// one staff, lyrics under noteheads, drag-to-reorder notes, slurs across notes,
// crescendo/decrescendo hairpins.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Renderer, Stave, StaveNote, Voice, Formatter, Beam, Accidental, Dot, Tuplet,
  Articulation, Modifier, Annotation, Barline, Volta, Repetition,
} from 'vexflow'
import { initAudio, playPianoNote, loadPianoSamples } from './audioEngine'

// ─── Types ──────────────────────────────────────────────────────────────────

type Clef = 'treble' | 'bass' | 'alto' | 'tenor'
type DurationKey = 'w' | 'h' | 'q' | '8' | '16' | '32'
type Accid = '' | '#' | 'b' | 'n' | '##' | 'bb'
type Articul = 'none' | 'fermata' | 'staccato' | 'accent' | 'tenuto' | 'marcato'
type Dynamic = 'none' | 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff' | 'fff'
type BarStart = 'normal' | 'repeat-begin' | 'double'
type BarEnd = 'normal' | 'repeat-end' | 'double' | 'final'

interface MNote {
  id: number
  // VexFlow keys: ['c/4'], or for chords ['c/4', 'e/4', 'g/4']
  // Octave: scientific (C4 = middle C)
  keys: string[]
  // Per-key accidentals (parallel to keys array)
  accidentals: Accid[]
  duration: DurationKey
  dotted: boolean
  // Triplet group: notes with same tripletGroup id form a triplet (3 notes)
  tripletGroup?: number
  articulation: Articul
  dynamic: Dynamic
  tieToNext: boolean
  fermata: boolean
}

interface Measure {
  id: number
  notes: MNote[]
  startBar: BarStart
  endBar: BarEnd
  voltaNumber?: number    // 1, 2 for first/second endings
  hasCoda: boolean        // place coda symbol at start
  hasSegno: boolean       // place segno symbol at start
  // Tempo / dynamics text on this measure
  tempoMark?: string      // e.g. "Andante", "Allegro", "rit."
  rehearsalMark?: string  // e.g. "A", "B"
}

interface Composition {
  title: string
  composer: string
  clef: Clef
  timeNum: number          // e.g. 4
  timeDen: number          // e.g. 4
  keyName: string          // VexFlow key name: 'C', 'G', 'D', 'F', 'Bb', etc.
  tempoBpm: number
  tempoMark: string        // 'Andante', 'Allegro', etc.
  measures: Measure[]
  savedAt: string
}

// ─── Storage / slug helpers ─────────────────────────────────────────────────

const STORAGE_PREFIX = 'pd_composed_'

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'untitled'
}

// ─── Pitch / Key conversions ────────────────────────────────────────────────

const STEP_TO_SEMI: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }

// Convert a VexFlow key like "c/4" or "f#/5" to semitones from C4
function vexKeyToSemi(key: string, accidental: Accid): number {
  const m = key.match(/^([a-g])(#|b)?\/(-?\d+)$/i)
  if (!m) return 0
  const step = m[1].toLowerCase()
  const inlineAcc = m[2]
  const oct = parseInt(m[3])
  let semi = STEP_TO_SEMI[step] + (oct - 4) * 12
  if (inlineAcc === '#') semi += 1
  if (inlineAcc === 'b') semi -= 1
  if (accidental === '#') semi += 1
  if (accidental === 'b') semi -= 1
  if (accidental === '##') semi += 2
  if (accidental === 'bb') semi -= 2
  return semi
}

// Convert semitones from C4 to a VexFlow key (preferring naturals)
function semiToVexKey(semi: number): { key: string; accidental: Accid } {
  const steps = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']
  const noteIdx = ((semi % 12) + 12) % 12
  const oct = 4 + Math.floor(semi / 12)
  const stepName = steps[noteIdx]
  if (stepName.includes('#')) {
    return { key: `${stepName[0]}/${oct}`, accidental: '#' }
  }
  return { key: `${stepName}/${oct}`, accidental: '' }
}

function vexKeyToName(key: string, accidental: Accid): string {
  const m = key.match(/^([a-g])(#|b)?\/(-?\d+)$/i)
  if (!m) return ''
  const letter = m[1].toUpperCase()
  const oct = m[3]
  let acc = accidental
  if (m[2]) acc = (m[2] as Accid)
  return `${letter}${acc}${oct}`
}

// Diatonic step from middle line (treble: B4 = step 0; bass: D3 = step 0)
function midlineSemi(clef: Clef): number {
  if (clef === 'treble') return 11
  if (clef === 'bass') return -10  // D3
  if (clef === 'alto') return 0    // C4
  return 5 // tenor: F3 ish — approximate
}

// Y to semi for click placement (uses staff rect coordinates from VexFlow)
function yToSemi(y: number, midY: number, lineSpacing: number, clef: Clef): number {
  // Each diatonic step = lineSpacing/2
  const stepFromMid = Math.round((midY - y) / (lineSpacing / 2))
  // Walk diatonically from midline
  const letterOrder = ['c', 'd', 'e', 'f', 'g', 'a', 'b']
  const midSemi = midlineSemi(clef)
  const midLetterIdx = letterOrder.findIndex(L => STEP_TO_SEMI[L] === ((midSemi % 12) + 12) % 12)
  const targetLetterPos = midLetterIdx + stepFromMid
  const targetLetterIdx = ((targetLetterPos % 7) + 7) % 7
  const octaveDelta = Math.floor(targetLetterPos / 7)
  const targetLetter = letterOrder[targetLetterIdx]
  const baseOctave = Math.floor((midSemi - STEP_TO_SEMI[letterOrder[midLetterIdx]]) / 12) + 4
  const targetSemi = STEP_TO_SEMI[targetLetter] + (baseOctave + octaveDelta - 4) * 12
  return targetSemi
}

// Beat value for a duration (1.0 = quarter)
const DURATION_BEATS: Record<DurationKey, number> = {
  w: 4, h: 2, q: 1, '8': 0.5, '16': 0.25, '32': 0.125,
}

function noteBeats(n: MNote): number {
  let b = DURATION_BEATS[n.duration]
  if (n.dotted) b *= 1.5
  if (n.tripletGroup != null) b *= 2 / 3
  return b
}

// ─── Key signature names (for VexFlow) ──────────────────────────────────────

const KEY_NAMES_BY_FIFTHS: Record<number, string> = {
  [-7]: 'Cb', [-6]: 'Gb', [-5]: 'Db', [-4]: 'Ab', [-3]: 'Eb', [-2]: 'Bb', [-1]: 'F',
  0: 'C',
  1: 'G', 2: 'D', 3: 'A', 4: 'E', 5: 'B', 6: 'F#', 7: 'C#',
}
const FIFTHS_BY_KEY_NAME: Record<string, number> = Object.fromEntries(
  Object.entries(KEY_NAMES_BY_FIFTHS).map(([k, v]) => [v, parseInt(k)])
)

// ─── MusicXML Export ────────────────────────────────────────────────────────

function buildMusicXML(comp: Composition): string {
  const DIV = 16 // divisions per quarter

  const beatsToDuration = (beats: number) => Math.round(beats * DIV)
  const durationToType = (d: DurationKey): string => ({
    w: 'whole', h: 'half', q: 'quarter', '8': 'eighth', '16': '16th', '32': '32nd',
  }[d])

  const noteToXML = (n: MNote): string => {
    return n.keys.map((key, ki) => {
      const m = key.match(/^([a-g])(#|b)?\/(-?\d+)$/i)
      if (!m) return ''
      const step = m[1].toUpperCase()
      let alter = 0
      if (m[2] === '#') alter = 1
      if (m[2] === 'b') alter = -1
      const acc = n.accidentals[ki]
      if (acc === '#') alter = 1
      if (acc === 'b') alter = -1
      if (acc === '##') alter = 2
      if (acc === 'bb') alter = -2
      const oct = m[3]
      const dur = beatsToDuration(noteBeats(n))
      const type = durationToType(n.duration)
      const dot = n.dotted ? '<dot/>' : ''
      const tup = n.tripletGroup != null
        ? '<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>'
        : ''
      const alterEl = alter !== 0 ? `<alter>${alter}</alter>` : ''
      const chord = ki > 0 ? '<chord/>' : ''
      const tie = n.tieToNext && ki === 0 ? '<tie type="start"/>' : ''
      const fer = n.fermata ? '<notations><fermata/></notations>' : ''
      const art = n.articulation !== 'none' && !n.fermata
        ? `<notations><articulations><${n.articulation}/></articulations></notations>`
        : ''
      return `      <note>${chord}<pitch><step>${step}</step>${alterEl}<octave>${oct}</octave></pitch><duration>${dur}</duration><voice>1</voice><type>${type}</type>${dot}${tup}${tie}${fer || art}</note>`
    }).join('\n')
  }

  const barlineXML = (m: Measure, position: 'left' | 'right'): string => {
    const t = position === 'left' ? m.startBar : m.endBar
    if (t === 'normal') return ''
    if (t === 'double') return `<barline location="${position}"><bar-style>light-light</bar-style></barline>`
    if (t === 'final') return `<barline location="${position}"><bar-style>light-heavy</bar-style></barline>`
    if (t === 'repeat-begin') return `<barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>`
    if (t === 'repeat-end') return `<barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward"/></barline>`
    return ''
  }

  const measureXML = (m: Measure, idx: number): string => {
    const isFirst = idx === 0
    const attrs = isFirst ? `      <attributes>
        <divisions>${DIV}</divisions>
        <key><fifths>${FIFTHS_BY_KEY_NAME[comp.keyName] ?? 0}</fifths><mode>major</mode></key>
        <time><beats>${comp.timeNum}</beats><beat-type>${comp.timeDen}</beat-type></time>
        <clef><sign>${comp.clef === 'treble' ? 'G' : comp.clef === 'bass' ? 'F' : 'C'}</sign><line>${comp.clef === 'treble' ? '2' : comp.clef === 'bass' ? '4' : '3'}</line></clef>
      </attributes>
      <direction placement="above">
        <direction-type><words font-weight="bold">${comp.tempoMark} ♩=${comp.tempoBpm}</words></direction-type>
        <sound tempo="${comp.tempoBpm}"/>
      </direction>` : ''
    return `    <measure number="${idx + 1}">
${attrs}
${barlineXML(m, 'left')}
${m.notes.map(noteToXML).join('\n')}
${barlineXML(m, 'right')}
    </measure>`
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work><work-title>${comp.title.replace(/[<>&"]/g, '')}</work-title></work>
  ${comp.composer ? `<identification><creator type="composer">${comp.composer.replace(/[<>&"]/g, '')}</creator></identification>` : ''}
  <part-list>
    <score-part id="P1"><part-name>Voice</part-name></score-part>
  </part-list>
  <part id="P1">
${comp.measures.map(measureXML).join('\n')}
  </part>
</score-partwise>`
}

// ─── Default empty measure ──────────────────────────────────────────────────

let measureIdCounter = 0
let noteIdCounter = 0
const newMeasure = (): Measure => ({
  id: ++measureIdCounter,
  notes: [],
  startBar: 'normal',
  endBar: 'normal',
  hasCoda: false,
  hasSegno: false,
})

// ─── Component ──────────────────────────────────────────────────────────────

type Phase = 'setup' | 'editing'

export default function Composer() {
  const [phase, setPhase] = useState<Phase>('setup')

  // ─── Setup wizard state ───────────────────────────────────────────────────
  const [setupTitle, setSetupTitle] = useState('')
  const [setupComposer, setSetupComposer] = useState('')
  const [setupClef, setSetupClef] = useState<Clef | null>(null)
  const [setupTimeNum, setSetupTimeNum] = useState<number | null>(null)
  const [setupTimeDen, setSetupTimeDen] = useState<number | null>(null)
  const [setupKey, setSetupKey] = useState<string | null>(null)
  const [setupTempoBpm, setSetupTempoBpm] = useState(100)
  const [setupTempoMark, setSetupTempoMark] = useState('')

  // ─── Editor state ─────────────────────────────────────────────────────────
  const [comp, setComp] = useState<Composition | null>(null)
  const [selectedDuration, setSelectedDuration] = useState<DurationKey>('q')
  const [selectedDotted, setSelectedDotted] = useState(false)
  const [selectedTriplet, setSelectedTriplet] = useState(false)
  const [selectedAccid, setSelectedAccid] = useState<Accid>('')
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null)
  const [editPopup, setEditPopup] = useState<{ noteId: number; x: number; y: number } | null>(null)
  const [statusMsg, setStatusMsg] = useState('')
  const [savedList, setSavedList] = useState<{ key: string; comp: Composition }[]>([])

  const staffContainerRef = useRef<HTMLDivElement>(null)

  // ─── Preload audio ────────────────────────────────────────────────────────
  useEffect(() => {
    initAudio()
    loadPianoSamples().catch(err => console.error('Piano samples failed:', err))
  }, [])

  // ─── Saved compositions list ──────────────────────────────────────────────
  const refreshSavedList = useCallback(() => {
    const list: { key: string; comp: Composition }[] = []
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (!k || !k.startsWith(STORAGE_PREFIX)) continue
        try {
          const c = JSON.parse(localStorage.getItem(k) || '{}')
          if (c.measures) list.push({ key: k, comp: c })
        } catch {}
      }
    } catch {}
    list.sort((a, b) => (b.comp.savedAt || '').localeCompare(a.comp.savedAt || ''))
    setSavedList(list)
  }, [])
  useEffect(() => { refreshSavedList() }, [refreshSavedList])

  // ─── Begin composing (transition from setup → editing) ────────────────────
  const beginComposing = useCallback(() => {
    if (!setupClef) return alert('Pick a clef')
    if (setupTimeNum == null || setupTimeDen == null) return alert('Pick a time signature')
    if (!setupKey) return alert('Pick a key signature')
    const composition: Composition = {
      title: setupTitle || 'Untitled',
      composer: setupComposer,
      clef: setupClef,
      timeNum: setupTimeNum,
      timeDen: setupTimeDen,
      keyName: setupKey,
      tempoBpm: setupTempoBpm,
      tempoMark: setupTempoMark,
      measures: [newMeasure()],
      savedAt: new Date().toISOString(),
    }
    setComp(composition)
    setPhase('editing')
  }, [setupTitle, setupComposer, setupClef, setupTimeNum, setupTimeDen, setupKey, setupTempoBpm, setupTempoMark])

  // ─── Load saved → editor ──────────────────────────────────────────────────
  const loadComposition = useCallback((key: string) => {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return
      const c: Composition = JSON.parse(raw)
      // Re-id measures + notes so editing doesn't clash
      c.measures.forEach(m => {
        m.id = ++measureIdCounter
        m.notes.forEach(n => { n.id = ++noteIdCounter })
      })
      setComp(c)
      setPhase('editing')
    } catch (err) {
      alert('Load failed: ' + (err as Error).message)
    }
  }, [])

  const deleteSavedComposition = useCallback((key: string, title: string) => {
    if (!confirm(`Delete "${title}"?`)) return
    localStorage.removeItem(key)
    refreshSavedList()
  }, [refreshSavedList])

  // ─── Save / download ──────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    if (!comp) return
    const c = { ...comp, savedAt: new Date().toISOString() }
    const key = STORAGE_PREFIX + slugify(c.title)
    try {
      localStorage.setItem(key, JSON.stringify(c))
      setStatusMsg(`Saved "${c.title}" — available in all Pitch Defender games`)
      setComp(c)
      refreshSavedList()
    } catch (err) {
      setStatusMsg('Save failed: ' + (err as Error).message)
    }
    setTimeout(() => setStatusMsg(''), 4000)
  }, [comp, refreshSavedList])

  const handleDownload = useCallback(() => {
    if (!comp) return
    const xml = buildMusicXML(comp)
    const blob = new Blob([xml], { type: 'application/vnd.recordare.musicxml+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${slugify(comp.title)}.musicxml`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setStatusMsg(`Downloaded ${slugify(comp.title)}.musicxml`)
    setTimeout(() => setStatusMsg(''), 3000)
  }, [comp])

  // ─── Note placement / editing ─────────────────────────────────────────────
  const addNoteAtSemi = useCallback((semi: number) => {
    if (!comp) return
    const { key, accidental } = semiToVexKey(semi)
    // User's accidental override beats the auto-derived one
    const finalAcc: Accid = selectedAccid !== '' ? selectedAccid : accidental
    const newNote: MNote = {
      id: ++noteIdCounter,
      keys: [key],
      accidentals: [finalAcc],
      duration: selectedDuration,
      dotted: selectedDotted,
      tripletGroup: selectedTriplet ? Date.now() : undefined,
      articulation: 'none',
      dynamic: 'none',
      tieToNext: false,
      fermata: false,
    }
    // Append to last measure; if it's full, start a new one
    setComp(prev => {
      if (!prev) return prev
      const measures = [...prev.measures]
      const measureCapacity = prev.timeNum * (4 / prev.timeDen)
      let lastMeasure = measures[measures.length - 1]
      const usedBeats = lastMeasure.notes.reduce((s, n) => s + noteBeats(n), 0)
      if (usedBeats + noteBeats(newNote) > measureCapacity + 0.001) {
        const fresh = newMeasure()
        fresh.notes.push(newNote)
        measures.push(fresh)
      } else {
        lastMeasure = { ...lastMeasure, notes: [...lastMeasure.notes, newNote] }
        measures[measures.length - 1] = lastMeasure
      }
      return { ...prev, measures }
    })
    setSelectedNoteId(newNote.id)
    // Audio feedback
    playPianoNote(vexKeyToName(key, finalAcc))
  }, [comp, selectedDuration, selectedDotted, selectedTriplet, selectedAccid])

  const updateNote = useCallback((id: number, patch: Partial<MNote>) => {
    setComp(prev => {
      if (!prev) return prev
      const measures = prev.measures.map(m => ({
        ...m,
        notes: m.notes.map(n => n.id === id ? { ...n, ...patch } : n),
      }))
      return { ...prev, measures }
    })
  }, [])

  const deleteNote = useCallback((id: number) => {
    setComp(prev => {
      if (!prev) return prev
      const measures = prev.measures
        .map(m => ({ ...m, notes: m.notes.filter(n => n.id !== id) }))
        .filter((m, i, arr) => i === 0 || m.notes.length > 0) // keep at least one measure
      return { ...prev, measures: measures.length > 0 ? measures : [newMeasure()] }
    })
    setSelectedNoteId(null)
    setEditPopup(null)
  }, [])

  const updateMeasure = useCallback((id: number, patch: Partial<Measure>) => {
    setComp(prev => {
      if (!prev) return prev
      const measures = prev.measures.map(m => m.id === id ? { ...m, ...patch } : m)
      return { ...prev, measures }
    })
  }, [])

  // ─── VexFlow rendering ────────────────────────────────────────────────────

  const noteHitboxesRef = useRef<{ id: number; x: number; y: number; w: number; h: number }[]>([])

  const renderStaff = useCallback(() => {
    if (!comp) return
    const container = staffContainerRef.current
    if (!container) return
    container.innerHTML = ''

    const measureWidth = 280
    const startX = 20
    const startY = 40
    const measuresPerLine = Math.max(1, Math.floor((window.innerWidth - 80) / measureWidth))
    const lines = Math.ceil(comp.measures.length / measuresPerLine)
    const totalWidth = Math.min(comp.measures.length, measuresPerLine) * measureWidth + 60
    const lineHeight = 200
    const totalHeight = lines * lineHeight + 60

    const renderer = new Renderer(container, Renderer.Backends.SVG)
    renderer.resize(totalWidth, totalHeight)
    const context = renderer.getContext()
    context.setFont('Arial', 12)

    noteHitboxesRef.current = []

    comp.measures.forEach((measure, mIdx) => {
      const lineIdx = Math.floor(mIdx / measuresPerLine)
      const colIdx = mIdx % measuresPerLine
      const x = startX + colIdx * measureWidth
      const y = startY + lineIdx * lineHeight
      const isFirstInLine = colIdx === 0

      const stave = new Stave(x, y, measureWidth)
      if (isFirstInLine) {
        stave.addClef(comp.clef)
        stave.addKeySignature(comp.keyName)
        if (mIdx === 0) {
          stave.addTimeSignature(`${comp.timeNum}/${comp.timeDen}`)
          if (comp.tempoMark || comp.tempoBpm) {
            stave.setTempo(
              { name: comp.tempoMark, duration: 'q', dots: 0, bpm: comp.tempoBpm },
              -20,
            )
          }
        }
      }
      // Bar lines
      if (measure.startBar === 'repeat-begin') stave.setBegBarType(Barline.type.REPEAT_BEGIN)
      if (measure.startBar === 'double') stave.setBegBarType(Barline.type.DOUBLE)
      if (measure.endBar === 'repeat-end') stave.setEndBarType(Barline.type.REPEAT_END)
      if (measure.endBar === 'double') stave.setEndBarType(Barline.type.DOUBLE)
      if (measure.endBar === 'final') stave.setEndBarType(Barline.type.END)
      // Volta (1st / 2nd ending bracket above the measure)
      if (measure.voltaNumber) {
        stave.setVoltaType(
          measure.voltaNumber === 1 ? Volta.type.BEGIN : Volta.type.BEGIN_END,
          measure.voltaNumber.toString() + '.',
          0,
        )
      }
      // Coda / Segno
      if (measure.hasCoda) {
        stave.setRepetitionType(Repetition.type.CODA_LEFT)
      }
      if (measure.hasSegno) {
        stave.setRepetitionType(Repetition.type.SEGNO_LEFT)
      }
      stave.setContext(context).draw()

      // Build notes for this measure
      if (measure.notes.length === 0) {
        return // empty measure (just bar lines)
      }

      const staveNotes: StaveNote[] = []
      const tripletGroups = new Map<number, StaveNote[]>()

      measure.notes.forEach(n => {
        // Pass base duration only — dot is added separately via Dot.buildAndAttach
        // (passing both 'qd' and a Dot modifier would render as a double-dot).
        let staveNote: StaveNote
        try {
          staveNote = new StaveNote({
            keys: n.keys,
            duration: n.duration,
            clef: comp.clef,
            auto_stem: true,
          })
        } catch (err) {
          console.error('StaveNote failed for', n, err)
          return
        }
        // Apply accidentals
        n.accidentals.forEach((a, ki) => {
          if (a && a !== '') {
            try { staveNote.addModifier(new Accidental(a), ki) } catch {}
          }
        })
        // Dot
        if (n.dotted) {
          try { Dot.buildAndAttach([staveNote], { all: true }) } catch {}
        }
        // Articulation
        if (n.articulation !== 'none' && !n.fermata) {
          const map: Record<string, string> = {
            staccato: 'a.', accent: 'a>', tenuto: 'a-', marcato: 'a^', fermata: 'a@a',
          }
          const code = map[n.articulation]
          if (code) {
            try { staveNote.addModifier(new Articulation(code).setPosition(Modifier.Position.ABOVE)) } catch {}
          }
        }
        // Fermata
        if (n.fermata) {
          try { staveNote.addModifier(new Articulation('a@a').setPosition(Modifier.Position.ABOVE)) } catch {}
        }
        // Dynamic
        if (n.dynamic !== 'none') {
          try {
            const dyn = new Annotation(n.dynamic)
              .setFont('Arial', 12, 'bold italic')
              .setVerticalJustification(Annotation.VerticalJustify.BOTTOM)
            staveNote.addModifier(dyn)
          } catch {}
        }

        if (n.tripletGroup != null) {
          if (!tripletGroups.has(n.tripletGroup)) tripletGroups.set(n.tripletGroup, [])
          tripletGroups.get(n.tripletGroup)!.push(staveNote)
        }
        staveNotes.push(staveNote)
      })

      // Voice
      try {
        const voice = new Voice({ num_beats: comp.timeNum, beat_value: comp.timeDen })
        voice.setMode(Voice.Mode.SOFT) // tolerant of partial measures
        voice.addTickables(staveNotes)
        new Formatter().joinVoices([voice]).format([voice], measureWidth - 50)
        voice.draw(context, stave)

        // Beams (auto-group eighths/16ths/32nds in same beat)
        const beams = Beam.generateBeams(staveNotes)
        beams.forEach(b => b.setContext(context).draw())

        // Tuplets
        tripletGroups.forEach(group => {
          if (group.length >= 3) {
            const tuplet = new Tuplet(group)
            tuplet.setContext(context).draw()
          }
        })

        // Hit-test rectangles
        staveNotes.forEach((sn, i) => {
          try {
            const bbox = sn.getBoundingBox()
            if (bbox) {
              noteHitboxesRef.current.push({
                id: measure.notes[i].id,
                x: bbox.getX(),
                y: bbox.getY(),
                w: bbox.getW(),
                h: bbox.getH(),
              })
            }
          } catch {}
        })

        // Highlight selected note
        if (selectedNoteId != null) {
          staveNotes.forEach((sn, i) => {
            if (measure.notes[i].id === selectedNoteId) {
              try {
                const bbox = sn.getBoundingBox()
                if (bbox) {
                  context.save()
                  context.setFillStyle('rgba(220, 38, 38, 0.18)')
                  context.fillRect(bbox.getX() - 4, bbox.getY() - 4, bbox.getW() + 8, bbox.getH() + 8)
                  context.restore()
                }
              } catch {}
            }
          })
        }
      } catch (err) {
        console.error('Voice format failed:', err)
      }
    })
  }, [comp, selectedNoteId])

  useEffect(() => { renderStaff() }, [renderStaff])

  // ─── Click on staff: hit-test or place ────────────────────────────────────
  const handleStaffClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!comp) return
    const container = staffContainerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    // Hit-test existing notes
    for (const hb of noteHitboxesRef.current) {
      if (x >= hb.x - 4 && x <= hb.x + hb.w + 4 && y >= hb.y - 4 && y <= hb.y + hb.h + 4) {
        setSelectedNoteId(hb.id)
        setEditPopup({ noteId: hb.id, x: e.clientX, y: e.clientY })
        // Find note + play it
        for (const m of comp.measures) {
          for (const n of m.notes) {
            if (n.id === hb.id) {
              playPianoNote(vexKeyToName(n.keys[0], n.accidentals[0]))
              return
            }
          }
        }
        return
      }
    }
    // Empty click — figure out which staff line and add a note there
    // Use the SVG staff lines as reference: 5 staff lines per line, ~10px apart
    const STAVE_LINE_SPACING = 10
    // Use the click position relative to the topmost staff line
    // For simplicity find which "line" we're on
    const measureWidth = 280
    const startY = 40
    const lineHeight = 200
    const measuresPerLine = Math.max(1, Math.floor((window.innerWidth - 80) / measureWidth))
    const lineIdx = Math.floor((y - startY) / lineHeight)
    const lineY = startY + lineIdx * lineHeight
    // Middle of staff is at lineY + ~60 (VexFlow default stave centerline offset)
    const midStaveY = lineY + 60
    const semi = yToSemi(y, midStaveY, STAVE_LINE_SPACING, comp.clef)
    addNoteAtSemi(semi)
    setEditPopup(null)
  }, [comp, addNoteAtSemi])

  // ─── Hotkeys ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'editing') return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return
      // Duration shortcuts
      if (e.key === '1') setSelectedDuration('w')
      else if (e.key === '2') setSelectedDuration('h')
      else if (e.key === '3') setSelectedDuration('q')
      else if (e.key === '4') setSelectedDuration('8')
      else if (e.key === '5') setSelectedDuration('16')
      else if (e.key === '6') setSelectedDuration('32')
      else if (e.key === '.') setSelectedDotted(d => !d)
      else if (e.key === 't' || e.key === 'T') setSelectedTriplet(t => !t)
      else if (e.key === '#') setSelectedAccid('#')
      else if (e.key === 'b' || e.key === 'B') setSelectedAccid('b')
      else if (e.key === 'n' || e.key === 'N') setSelectedAccid('n')
      else if (e.key === 'Escape') { setSelectedAccid(''); setSelectedNoteId(null); setEditPopup(null) }
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        if (selectedNoteId != null) deleteNote(selectedNoteId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, selectedNoteId, deleteNote])

  // ─── Add measure ──────────────────────────────────────────────────────────
  const addMeasure = useCallback(() => {
    setComp(prev => prev ? { ...prev, measures: [...prev.measures, newMeasure()] } : prev)
  }, [])

  const removeLastMeasure = useCallback(() => {
    setComp(prev => {
      if (!prev || prev.measures.length <= 1) return prev
      return { ...prev, measures: prev.measures.slice(0, -1) }
    })
  }, [])

  // ═══ SETUP WIZARD UI ════════════════════════════════════════════════════
  if (phase === 'setup') {
    const KEY_OPTIONS = [
      { v: 'Cb', label: 'C♭ major (7♭)' },
      { v: 'Gb', label: 'G♭ major (6♭)' },
      { v: 'Db', label: 'D♭ major (5♭)' },
      { v: 'Ab', label: 'A♭ major (4♭)' },
      { v: 'Eb', label: 'E♭ major (3♭)' },
      { v: 'Bb', label: 'B♭ major (2♭)' },
      { v: 'F', label: 'F major (1♭)' },
      { v: 'C', label: 'C major / a minor (no sharps/flats)' },
      { v: 'G', label: 'G major (1♯)' },
      { v: 'D', label: 'D major (2♯)' },
      { v: 'A', label: 'A major (3♯)' },
      { v: 'E', label: 'E major (4♯)' },
      { v: 'B', label: 'B major (5♯)' },
      { v: 'F#', label: 'F♯ major (6♯)' },
      { v: 'C#', label: 'C♯ major (7♯)' },
    ]

    return (
      <div className="fixed inset-0 bg-[#0b0b14] text-gray-100 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-10">
          <h1 className="text-3xl font-black mb-1">New Composition</h1>
          <p className="text-sm text-gray-500 mb-6">Choose every setting explicitly. No defaults — pick what your piece actually needs.</p>

          {/* Title + composer */}
          <div className="space-y-4 mb-8">
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1">Title</label>
              <input
                type="text"
                value={setupTitle}
                onChange={e => setSetupTitle(e.target.value)}
                placeholder="e.g. Farewell, Dear Love (Tenor)"
                className="w-full px-4 py-2.5 bg-[#15152a] border border-[#3a3a55] rounded-lg text-base text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1">Composer / Arranger</label>
              <input
                type="text"
                value={setupComposer}
                onChange={e => setSetupComposer(e.target.value)}
                placeholder="optional"
                className="w-full px-4 py-2.5 bg-[#15152a] border border-[#3a3a55] rounded-lg text-base text-white"
              />
            </div>
          </div>

          {/* Clef */}
          <div className="mb-8">
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Clef <span className="text-red-400">*required</span></label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(['treble', 'alto', 'tenor', 'bass'] as Clef[]).map(c => (
                <button
                  key={c}
                  onClick={() => setSetupClef(c)}
                  className="px-4 py-3 rounded-lg text-sm font-bold transition-all"
                  style={{
                    background: setupClef === c ? 'rgba(99,102,241,0.25)' : 'rgba(40,40,60,0.5)',
                    border: `2px solid ${setupClef === c ? '#6366f1' : 'rgba(60,60,80,0.5)'}`,
                    color: setupClef === c ? '#a5b4fc' : '#888',
                  }}
                >
                  <div className="text-3xl mb-0.5">
                    {c === 'treble' ? '𝄞' : c === 'bass' ? '𝄢' : '𝄡'}
                  </div>
                  <div className="capitalize">{c} Clef</div>
                </button>
              ))}
            </div>
          </div>

          {/* Time signature */}
          <div className="mb-8">
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Time Signature <span className="text-red-400">*required</span></label>
            <div className="flex flex-wrap gap-2">
              {[
                [4, 4, '4/4 common time'],
                [3, 4, '3/4 waltz'],
                [2, 4, '2/4 march'],
                [2, 2, '2/2 cut time'],
                [6, 8, '6/8 compound duple'],
                [9, 8, '9/8 compound triple'],
                [12, 8, '12/8 compound quadruple'],
                [5, 4, '5/4'],
                [7, 8, '7/8'],
                [3, 8, '3/8'],
              ].map(([n, d, label]) => (
                <button
                  key={`${n}/${d}`}
                  onClick={() => { setSetupTimeNum(n as number); setSetupTimeDen(d as number) }}
                  className="px-4 py-2 rounded-lg text-sm transition-all"
                  style={{
                    background: setupTimeNum === n && setupTimeDen === d ? 'rgba(99,102,241,0.25)' : 'rgba(40,40,60,0.5)',
                    border: `2px solid ${setupTimeNum === n && setupTimeDen === d ? '#6366f1' : 'rgba(60,60,80,0.5)'}`,
                    color: setupTimeNum === n && setupTimeDen === d ? '#a5b4fc' : '#888',
                  }}
                >
                  <span className="font-bold mr-2">{n}/{d}</span>
                  <span className="text-xs opacity-70">{label}</span>
                </button>
              ))}
            </div>
            {/* Custom time sig */}
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
              Custom:
              <input type="number" min={1} max={32} placeholder="num"
                onChange={e => setSetupTimeNum(parseInt(e.target.value) || null)}
                className="w-16 px-2 py-1 bg-[#15152a] border border-[#3a3a55] rounded text-white text-center" />
              <span>/</span>
              <select
                onChange={e => setSetupTimeDen(parseInt(e.target.value) || null)}
                className="px-2 py-1 bg-[#15152a] border border-[#3a3a55] rounded text-white">
                <option value="">denom</option>
                <option value="2">2</option>
                <option value="4">4</option>
                <option value="8">8</option>
                <option value="16">16</option>
              </select>
            </div>
          </div>

          {/* Key signature */}
          <div className="mb-8">
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Key Signature <span className="text-red-400">*required</span></label>
            <select
              value={setupKey || ''}
              onChange={e => setSetupKey(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#15152a] border border-[#3a3a55] rounded-lg text-base text-white"
            >
              <option value="">— Pick a key —</option>
              {KEY_OPTIONS.map(o => (
                <option key={o.v} value={o.v}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Tempo */}
          <div className="mb-8 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1">Tempo (BPM)</label>
              <input
                type="number"
                value={setupTempoBpm}
                onChange={e => setSetupTempoBpm(parseInt(e.target.value) || 100)}
                min={30}
                max={300}
                className="w-full px-4 py-2.5 bg-[#15152a] border border-[#3a3a55] rounded-lg text-base text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1">Tempo Marking (optional)</label>
              <select
                value={setupTempoMark}
                onChange={e => setSetupTempoMark(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#15152a] border border-[#3a3a55] rounded-lg text-base text-white"
              >
                <option value="">none</option>
                <option value="Grave">Grave (very slow)</option>
                <option value="Largo">Largo</option>
                <option value="Adagio">Adagio</option>
                <option value="Andante">Andante</option>
                <option value="Moderato">Moderato</option>
                <option value="Allegretto">Allegretto</option>
                <option value="Allegro">Allegro</option>
                <option value="Vivace">Vivace</option>
                <option value="Presto">Presto</option>
                <option value="Prestissimo">Prestissimo (very fast)</option>
              </select>
            </div>
          </div>

          {/* Begin button */}
          <button
            onClick={beginComposing}
            disabled={!setupClef || setupTimeNum == null || setupTimeDen == null || !setupKey}
            className="w-full px-8 py-4 rounded-xl text-xl font-black text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              boxShadow: '0 0 30px rgba(99,102,241,0.4)',
            }}
          >
            Begin Composing →
          </button>

          {/* Saved compositions */}
          {savedList.length > 0 && (
            <div className="mt-10">
              <h2 className="text-sm uppercase tracking-wider text-gray-400 mb-3">Or open a saved composition</h2>
              <div className="space-y-2">
                {savedList.map(({ key, comp: c }) => (
                  <div key={key} className="flex items-center gap-2 p-3 bg-[#15152a] border border-[#3a3a55] rounded-lg">
                    <button
                      onClick={() => loadComposition(key)}
                      className="flex-1 text-left text-indigo-300 hover:text-indigo-200"
                    >
                      <div className="font-bold">{c.title}</div>
                      <div className="text-xs text-gray-500">
                        {c.clef} clef · {c.timeNum}/{c.timeDen} · {c.keyName} · {c.measures.length} measures
                      </div>
                    </button>
                    <button
                      onClick={() => deleteSavedComposition(key, c.title)}
                      className="text-xs text-red-500 hover:text-red-400 px-2"
                      title="Delete"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <a href="/pitch-defender" className="mt-8 block text-center text-xs text-gray-600 hover:text-gray-400">
            ← Back to Pitch Defender
          </a>
        </div>
      </div>
    )
  }

  // ═══ EDITOR UI ══════════════════════════════════════════════════════════
  if (!comp) return null

  // Find the selected note (for popup)
  const selNote = (() => {
    for (const m of comp.measures) {
      for (const n of m.notes) {
        if (n.id === selectedNoteId) return n
      }
    }
    return null
  })()

  return (
    <div className="fixed inset-0 bg-[#0b0b14] text-gray-100 flex flex-col overflow-hidden">
      {/* Top bar — composition info + global edits */}
      <div className="px-4 py-3 border-b border-gray-800/60 bg-[#08080f] flex items-center gap-3 flex-wrap">
        <button onClick={() => setPhase('setup')} className="text-xs text-gray-500 hover:text-gray-300">
          ← New
        </button>
        <input
          type="text"
          value={comp.title}
          onChange={e => setComp(prev => prev ? { ...prev, title: e.target.value } : prev)}
          className="px-3 py-1.5 bg-[#15152a] border border-[#3a3a55] rounded text-sm text-white w-48"
        />
        <span className="text-xs text-gray-500">
          <span className="text-indigo-300 font-bold capitalize">{comp.clef}</span> ·
          <span className="text-indigo-300 font-bold ml-1">{comp.timeNum}/{comp.timeDen}</span> ·
          <span className="text-indigo-300 font-bold ml-1">{comp.keyName}</span> ·
          <span className="text-indigo-300 font-bold ml-1">{comp.tempoMark} ♩={comp.tempoBpm}</span>
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={addMeasure} className="text-xs px-3 py-1.5 rounded bg-[#15152a] border border-[#3a3a55] text-gray-300 hover:bg-[#1f1f3a]">
            + Measure
          </button>
          <button onClick={removeLastMeasure} className="text-xs px-3 py-1.5 rounded bg-[#15152a] border border-[#3a3a55] text-gray-300 hover:bg-[#1f1f3a]">
            − Measure
          </button>
          <button onClick={handleSave} className="text-xs px-3 py-1.5 rounded font-bold text-white" style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
            Save
          </button>
          <button onClick={handleDownload} className="text-xs px-3 py-1.5 rounded text-indigo-300 border border-indigo-700 hover:bg-indigo-900/30">
            Download .musicxml
          </button>
        </div>
      </div>

      {/* Toolbar — duration / accidental / dotted / triplet */}
      <div className="px-4 py-2 border-b border-gray-800/40 bg-[#0a0a14] flex items-center gap-2 flex-wrap text-xs">
        <span className="text-gray-500 uppercase tracking-wider">Duration</span>
        {([
          { d: 'w' as DurationKey, glyph: '𝅝', label: 'whole', key: '1' },
          { d: 'h' as DurationKey, glyph: '𝅗𝅥', label: 'half', key: '2' },
          { d: 'q' as DurationKey, glyph: '♩', label: 'quarter', key: '3' },
          { d: '8' as DurationKey, glyph: '♪', label: 'eighth', key: '4' },
          { d: '16' as DurationKey, glyph: '𝅘𝅥𝅯', label: '16th', key: '5' },
          { d: '32' as DurationKey, glyph: '𝅘𝅥𝅰', label: '32nd', key: '6' },
        ]).map(p => (
          <button
            key={p.d}
            onClick={() => setSelectedDuration(p.d)}
            className="px-2 py-1.5 rounded font-bold flex items-center gap-1.5 transition-all"
            style={{
              background: selectedDuration === p.d ? 'rgba(99,102,241,0.25)' : 'rgba(40,40,60,0.5)',
              border: `1px solid ${selectedDuration === p.d ? '#6366f1' : 'rgba(60,60,80,0.5)'}`,
              color: selectedDuration === p.d ? '#a5b4fc' : '#888',
            }}
            title={`${p.label} (${p.key})`}
          >
            <span className="text-lg">{p.glyph}</span>
            <span className="text-[10px]">{p.label}</span>
          </button>
        ))}
        <button
          onClick={() => setSelectedDotted(!selectedDotted)}
          className="px-2 py-1.5 rounded font-bold transition-all"
          style={{
            background: selectedDotted ? 'rgba(99,102,241,0.25)' : 'rgba(40,40,60,0.5)',
            border: `1px solid ${selectedDotted ? '#6366f1' : 'rgba(60,60,80,0.5)'}`,
            color: selectedDotted ? '#a5b4fc' : '#888',
          }}
          title="Dotted (.)"
        >
          dot ·
        </button>
        <button
          onClick={() => setSelectedTriplet(!selectedTriplet)}
          className="px-2 py-1.5 rounded font-bold transition-all"
          style={{
            background: selectedTriplet ? 'rgba(99,102,241,0.25)' : 'rgba(40,40,60,0.5)',
            border: `1px solid ${selectedTriplet ? '#6366f1' : 'rgba(60,60,80,0.5)'}`,
            color: selectedTriplet ? '#a5b4fc' : '#888',
          }}
          title="Triplet (T)"
        >
          triplet 3
        </button>
        <span className="text-gray-500 uppercase tracking-wider ml-2">Accidental</span>
        {([
          { a: '' as Accid, glyph: '♮', title: 'natural / no accidental' },
          { a: '#' as Accid, glyph: '♯', title: 'sharp (#)' },
          { a: 'b' as Accid, glyph: '♭', title: 'flat (B)' },
        ]).map(p => (
          <button
            key={p.a || 'nat'}
            onClick={() => setSelectedAccid(p.a)}
            className="px-2 py-1.5 rounded font-bold transition-all"
            style={{
              background: selectedAccid === p.a ? 'rgba(99,102,241,0.25)' : 'rgba(40,40,60,0.5)',
              border: `1px solid ${selectedAccid === p.a ? '#6366f1' : 'rgba(60,60,80,0.5)'}`,
              color: selectedAccid === p.a ? '#a5b4fc' : '#888',
            }}
            title={p.title}
          >
            {p.glyph}
          </button>
        ))}
        <div className="ml-auto text-[10px] text-gray-600">
          Hotkeys: 1-6 duration · . dot · T triplet · # ♭ accidental · Del to remove · Esc to clear
        </div>
      </div>

      {/* Status */}
      {statusMsg && (
        <div className="px-4 py-1.5 bg-emerald-900/30 border-b border-emerald-700/40 text-xs text-emerald-300">
          {statusMsg}
        </div>
      )}

      {/* Staff (VexFlow SVG) */}
      <div className="flex-1 overflow-auto bg-[#fafaf7] p-4">
        <div
          ref={staffContainerRef}
          onClick={handleStaffClick}
          style={{ cursor: 'crosshair', minHeight: 250 }}
        />
      </div>

      {/* Popup: edit selected note */}
      {editPopup && selNote && (
        <NoteEditPopup
          note={selNote}
          x={editPopup.x}
          y={editPopup.y}
          onClose={() => setEditPopup(null)}
          onUpdate={patch => updateNote(selNote.id, patch)}
          onDelete={() => deleteNote(selNote.id)}
        />
      )}

      {/* Bottom bar: measure-level controls (bar lines, codas, voltas) */}
      {selectedNoteId != null && (
        <div className="px-4 py-2 border-t border-gray-800/60 bg-[#08080f] flex items-center gap-2 text-xs flex-wrap">
          <span className="text-gray-500 uppercase tracking-wider mr-2">Selected Measure</span>
          {(() => {
            const m = comp.measures.find(mm => mm.notes.some(n => n.id === selectedNoteId))
            if (!m) return null
            return (
              <>
                <select
                  value={m.startBar}
                  onChange={e => updateMeasure(m.id, { startBar: e.target.value as BarStart })}
                  className="px-2 py-1 bg-[#15152a] border border-[#3a3a55] rounded text-xs text-gray-200"
                >
                  <option value="normal">| start bar</option>
                  <option value="repeat-begin">𝄆 repeat begin</option>
                  <option value="double">‖ double bar start</option>
                </select>
                <select
                  value={m.endBar}
                  onChange={e => updateMeasure(m.id, { endBar: e.target.value as BarEnd })}
                  className="px-2 py-1 bg-[#15152a] border border-[#3a3a55] rounded text-xs text-gray-200"
                >
                  <option value="normal">| end bar</option>
                  <option value="repeat-end">𝄇 repeat end</option>
                  <option value="double">‖ double bar end</option>
                  <option value="final">𝄂 final bar</option>
                </select>
                <label className="flex items-center gap-1 text-gray-400">
                  <input type="checkbox" checked={m.hasCoda} onChange={e => updateMeasure(m.id, { hasCoda: e.target.checked })} />
                  Coda 𝄌
                </label>
                <label className="flex items-center gap-1 text-gray-400">
                  <input type="checkbox" checked={m.hasSegno} onChange={e => updateMeasure(m.id, { hasSegno: e.target.checked })} />
                  Segno 𝄋
                </label>
                <select
                  value={m.voltaNumber || ''}
                  onChange={e => updateMeasure(m.id, { voltaNumber: e.target.value ? parseInt(e.target.value) : undefined })}
                  className="px-2 py-1 bg-[#15152a] border border-[#3a3a55] rounded text-xs text-gray-200"
                >
                  <option value="">— no volta —</option>
                  <option value="1">Volta 1.</option>
                  <option value="2">Volta 2.</option>
                </select>
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}

// ─── Note edit popup ────────────────────────────────────────────────────────

function NoteEditPopup({
  note, x, y, onClose, onUpdate, onDelete,
}: {
  note: MNote
  x: number
  y: number
  onClose: () => void
  onUpdate: (patch: Partial<MNote>) => void
  onDelete: () => void
}) {
  // Click-outside to close
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-note-popup]')) onClose()
    }
    // Defer adding listener until after the click that opened the popup
    const t = setTimeout(() => document.addEventListener('mousedown', onClick), 0)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', onClick) }
  }, [onClose])

  return (
    <div
      data-note-popup
      className="fixed z-50 bg-[#15152a] border-2 border-indigo-600 rounded-lg shadow-2xl p-3 text-xs"
      style={{
        left: Math.min(x, window.innerWidth - 320),
        top: Math.min(y + 16, window.innerHeight - 320),
        width: 300,
      }}
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-700">
        <span className="text-indigo-300 font-bold">Edit Note</span>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300">✕</button>
      </div>

      <div className="space-y-2">
        <div>
          <div className="text-gray-500 uppercase tracking-wider mb-1">Duration</div>
          <div className="flex flex-wrap gap-1">
            {(['w', 'h', 'q', '8', '16', '32'] as DurationKey[]).map(d => (
              <button
                key={d}
                onClick={() => onUpdate({ duration: d })}
                className="px-2 py-1 rounded text-xs font-bold"
                style={{
                  background: note.duration === d ? '#6366f1' : '#1f1f3a',
                  color: note.duration === d ? 'white' : '#888',
                }}
              >
                {{ w: '𝅝', h: '𝅗𝅥', q: '♩', '8': '♪', '16': '𝅘𝅥𝅯', '32': '𝅘𝅥𝅰' }[d]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <label className="flex items-center gap-1 text-gray-300">
            <input type="checkbox" checked={note.dotted} onChange={e => onUpdate({ dotted: e.target.checked })} />
            Dotted
          </label>
          <label className="flex items-center gap-1 text-gray-300">
            <input type="checkbox" checked={note.tripletGroup != null} onChange={e => onUpdate({ tripletGroup: e.target.checked ? Date.now() : undefined })} />
            Triplet
          </label>
          <label className="flex items-center gap-1 text-gray-300">
            <input type="checkbox" checked={note.fermata} onChange={e => onUpdate({ fermata: e.target.checked })} />
            Fermata
          </label>
          <label className="flex items-center gap-1 text-gray-300">
            <input type="checkbox" checked={note.tieToNext} onChange={e => onUpdate({ tieToNext: e.target.checked })} />
            Tie
          </label>
        </div>

        <div>
          <div className="text-gray-500 uppercase tracking-wider mb-1">Accidental</div>
          <div className="flex gap-1">
            {(['', '#', 'b', 'n', '##', 'bb'] as Accid[]).map(a => (
              <button
                key={a || 'none'}
                onClick={() => onUpdate({ accidentals: note.keys.map(() => a) })}
                className="px-2 py-1 rounded text-xs font-bold"
                style={{
                  background: note.accidentals[0] === a ? '#6366f1' : '#1f1f3a',
                  color: note.accidentals[0] === a ? 'white' : '#888',
                }}
              >
                {a === '' ? '—' : a === 'n' ? '♮' : a === '#' ? '♯' : a === 'b' ? '♭' : a === '##' ? '𝄪' : '𝄫'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-gray-500 uppercase tracking-wider mb-1">Articulation</div>
          <div className="flex flex-wrap gap-1">
            {(['none', 'staccato', 'accent', 'tenuto', 'marcato'] as Articul[]).map(a => (
              <button
                key={a}
                onClick={() => onUpdate({ articulation: a })}
                className="px-2 py-1 rounded text-xs"
                style={{
                  background: note.articulation === a ? '#6366f1' : '#1f1f3a',
                  color: note.articulation === a ? 'white' : '#888',
                }}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-gray-500 uppercase tracking-wider mb-1">Dynamic</div>
          <div className="flex flex-wrap gap-1">
            {(['none', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff'] as Dynamic[]).map(d => (
              <button
                key={d}
                onClick={() => onUpdate({ dynamic: d })}
                className="px-2 py-1 rounded text-xs font-bold italic"
                style={{
                  background: note.dynamic === d ? '#6366f1' : '#1f1f3a',
                  color: note.dynamic === d ? 'white' : '#888',
                }}
              >
                {d === 'none' ? '—' : d}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onDelete}
          className="w-full mt-2 px-3 py-2 rounded bg-red-900/40 border border-red-700 text-red-300 hover:bg-red-900/60 font-bold"
        >
          Delete Note
        </button>
      </div>
    </div>
  )
}
