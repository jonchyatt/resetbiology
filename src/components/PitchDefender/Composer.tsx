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
// VexFlow 4.x's package type entry does `export * from` + `export * as default from`
// which breaks TypeScript's named-import resolution in Next.js. Import the
// entire namespace and destructure to sidestep the re-export chain issue.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import * as VexFlowNS from 'vexflow'
const VF = VexFlowNS as unknown as {
  Renderer: any; Stave: any; StaveNote: any; Voice: any; Formatter: any;
  Beam: any; Accidental: any; Dot: any; Tuplet: any; Articulation: any;
  Modifier: any; Annotation: any; Barline: any; Volta: any; Repetition: any;
  StaveConnector: any; Curve: any; StaveHairpin: any;
}
const {
  Renderer, Stave, StaveNote, Voice, Formatter, Beam, Accidental, Dot, Tuplet,
  Articulation, Modifier, Annotation, Barline, Volta, Repetition,
  StaveConnector, Curve, StaveHairpin,
} = VF
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
  lyric?: string          // syllable shown under the notehead
  staff?: 0 | 1           // for grand staff: 0=top, 1=bottom
  isRest?: boolean        // true → render as rest at this duration
}

interface Slur {
  fromId: number
  toId: number
}

interface Hairpin {
  fromId: number
  toId: number
  type: 'cresc' | 'dim'
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
  clef: Clef               // top staff clef (or only-staff clef if not grand staff)
  bassClef: Clef           // bottom staff clef (only used when grandStaff is true)
  grandStaff: boolean      // render treble + bass with brace
  pickupBeats: number      // anacrusis: 0 = no pickup, otherwise beat count
  timeNum: number          // e.g. 4
  timeDen: number          // e.g. 4
  keyName: string          // VexFlow key name: 'C', 'G', 'D', 'F', 'Bb', etc.
  tempoBpm: number
  tempoMark: string        // 'Andante', 'Allegro', etc.
  measures: Measure[]
  slurs: Slur[]
  hairpins: Hairpin[]
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
  const [setupBassClef, setSetupBassClef] = useState<Clef>('bass')
  const [setupGrandStaff, setSetupGrandStaff] = useState(false)
  const [setupPickupBeats, setSetupPickupBeats] = useState(0)
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
  const [showOpenModal, setShowOpenModal] = useState(false)

  // Pending slur / hairpin in progress (set first endpoint, click second to commit)
  const [pendingSlurFromId, setPendingSlurFromId] = useState<number | null>(null)
  const [pendingHairpin, setPendingHairpin] = useState<{ fromId: number; type: 'cresc' | 'dim' } | null>(null)
  // Tools: 'place' = click empty staff to drop a note, 'rest' = drop a rest instead
  const [toolMode, setToolMode] = useState<'place' | 'rest'>('place')

  const staffContainerRef = useRef<HTMLDivElement>(null)
  // Drag-pitch state — held in a ref so mousemove doesn't trigger setState every frame
  const dragRef = useRef<{
    noteId: number
    startY: number
    startKey: string
    startAcc: Accid
    moved: boolean
  } | null>(null)

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
      bassClef: setupBassClef,
      grandStaff: setupGrandStaff,
      pickupBeats: setupPickupBeats,
      timeNum: setupTimeNum,
      timeDen: setupTimeDen,
      keyName: setupKey,
      tempoBpm: setupTempoBpm,
      tempoMark: setupTempoMark,
      measures: [newMeasure()],
      slurs: [],
      hairpins: [],
      savedAt: new Date().toISOString(),
    }
    setComp(composition)
    setPhase('editing')
  }, [setupTitle, setupComposer, setupClef, setupBassClef, setupGrandStaff, setupPickupBeats, setupTimeNum, setupTimeDen, setupKey, setupTempoBpm, setupTempoMark])

  // ─── Load saved → editor ──────────────────────────────────────────────────
  // Re-IDs measures + notes so re-loading the same composition doesn't clash
  // with the existing ID counters. Builds a id-translation map so slurs and
  // hairpins (which reference note IDs) get remapped instead of stripped —
  // previously they were silently dropped on load.
  const loadComposition = useCallback((key: string) => {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return
      const parsed = JSON.parse(raw)
      // Backfill fields added in later versions so old saves still load
      const c: Composition = {
        bassClef: 'bass',
        grandStaff: false,
        pickupBeats: 0,
        slurs: [],
        hairpins: [],
        ...parsed,
      }
      // Re-ID measures + notes, building old→new id map for slur/hairpin remap
      const noteIdMap = new Map<number, number>()
      c.measures.forEach(m => {
        m.id = ++measureIdCounter
        m.notes.forEach(n => {
          const newId = ++noteIdCounter
          noteIdMap.set(n.id, newId)
          n.id = newId
        })
      })
      // Remap slur/hairpin endpoints. Drop any that reference notes that
      // didn't survive the re-ID (corrupted saves).
      c.slurs = (c.slurs || [])
        .map(s => ({ fromId: noteIdMap.get(s.fromId) ?? -1, toId: noteIdMap.get(s.toId) ?? -1 }))
        .filter(s => s.fromId !== -1 && s.toId !== -1)
      c.hairpins = (c.hairpins || [])
        .map(h => ({
          fromId: noteIdMap.get(h.fromId) ?? -1,
          toId: noteIdMap.get(h.toId) ?? -1,
          type: h.type,
        }))
        .filter(h => h.fromId !== -1 && h.toId !== -1)
      setComp(c)
      setPhase('editing')
      setShowOpenModal(false)
      setSelectedNoteId(null)
      setEditPopup(null)
      setStatusMsg(`Loaded "${c.title || 'Untitled'}"`)
      setTimeout(() => setStatusMsg(''), 2500)
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
  const addNoteAtSemi = useCallback((semi: number, staff: 0 | 1 = 0) => {
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
      isRest: toolMode === 'rest',
      staff: comp.grandStaff ? staff : undefined,
    }
    // Append to last measure; if it's full, start a new one
    setComp(prev => {
      if (!prev) return prev
      const measures = [...prev.measures]
      // Pickup measure has reduced capacity; otherwise full bar capacity
      const fullCapacity = prev.timeNum * (4 / prev.timeDen)
      let lastMeasure = measures[measures.length - 1]
      const isFirstMeasure = measures.length === 1
      const measureCapacity = (isFirstMeasure && prev.pickupBeats > 0)
        ? prev.pickupBeats
        : fullCapacity
      // For grand staff, only count notes on the same staff toward fill (each
      // staff fills independently)
      const sameStaffNotes = prev.grandStaff
        ? lastMeasure.notes.filter(n => (n.staff ?? 0) === staff)
        : lastMeasure.notes
      const usedBeats = sameStaffNotes.reduce((s, n) => s + noteBeats(n), 0)
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
    // Audio feedback (skip for rests)
    if (toolMode !== 'rest') playPianoNote(vexKeyToName(key, finalAcc))
  }, [comp, selectedDuration, selectedDotted, selectedTriplet, selectedAccid, toolMode])

  // Add a note to an existing note's keys array (chord build)
  const addChordTone = useCallback((noteId: number, semi: number) => {
    setComp(prev => {
      if (!prev) return prev
      const { key, accidental } = semiToVexKey(semi)
      const measures = prev.measures.map(m => ({
        ...m,
        notes: m.notes.map(n => {
          if (n.id !== noteId) return n
          if (n.isRest) return n
          if (n.keys.includes(key)) return n // already in chord
          return {
            ...n,
            keys: [...n.keys, key],
            accidentals: [...n.accidentals, accidental],
          }
        }),
      }))
      return { ...prev, measures }
    })
    const { key, accidental } = semiToVexKey(semi)
    playPianoNote(vexKeyToName(key, accidental))
  }, [])

  // Remove one tone from a chord (or whole note if last tone)
  const removeChordTone = useCallback((noteId: number, keyIdx: number) => {
    setComp(prev => {
      if (!prev) return prev
      const measures = prev.measures.map(m => ({
        ...m,
        notes: m.notes.map(n => {
          if (n.id !== noteId) return n
          if (n.keys.length <= 1) return n // refuse — use deleteNote instead
          return {
            ...n,
            keys: n.keys.filter((_, i) => i !== keyIdx),
            accidentals: n.accidentals.filter((_, i) => i !== keyIdx),
          }
        }),
      }))
      return { ...prev, measures }
    })
  }, [])

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
      // Drop slurs / hairpins that referenced the deleted note
      const slurs = prev.slurs.filter(s => s.fromId !== id && s.toId !== id)
      const hairpins = prev.hairpins.filter(h => h.fromId !== id && h.toId !== id)
      return { ...prev, measures: measures.length > 0 ? measures : [newMeasure()], slurs, hairpins }
    })
    setSelectedNoteId(null)
    setEditPopup(null)
  }, [])

  // Commit a slur from pendingSlurFromId → toId
  const commitSlur = useCallback((toId: number) => {
    if (pendingSlurFromId == null || pendingSlurFromId === toId) {
      setPendingSlurFromId(null)
      return
    }
    setComp(prev => {
      if (!prev) return prev
      // Avoid duplicates
      if (prev.slurs.some(s => s.fromId === pendingSlurFromId && s.toId === toId)) return prev
      return { ...prev, slurs: [...prev.slurs, { fromId: pendingSlurFromId, toId }] }
    })
    setPendingSlurFromId(null)
    setStatusMsg('Slur added')
    setTimeout(() => setStatusMsg(''), 1500)
  }, [pendingSlurFromId])

  // Commit a hairpin from pendingHairpin → toId
  const commitHairpin = useCallback((toId: number) => {
    if (!pendingHairpin || pendingHairpin.fromId === toId) {
      setPendingHairpin(null)
      return
    }
    setComp(prev => {
      if (!prev) return prev
      if (prev.hairpins.some(h => h.fromId === pendingHairpin.fromId && h.toId === toId)) return prev
      return { ...prev, hairpins: [...prev.hairpins, { fromId: pendingHairpin.fromId, toId, type: pendingHairpin.type }] }
    })
    setPendingHairpin(null)
    setStatusMsg(`${pendingHairpin.type === 'cresc' ? 'Crescendo' : 'Decrescendo'} added`)
    setTimeout(() => setStatusMsg(''), 1500)
  }, [pendingHairpin])

  const removeSlur = useCallback((fromId: number, toId: number) => {
    setComp(prev => prev ? { ...prev, slurs: prev.slurs.filter(s => !(s.fromId === fromId && s.toId === toId)) } : prev)
  }, [])

  const removeHairpin = useCallback((fromId: number, toId: number) => {
    setComp(prev => prev ? { ...prev, hairpins: prev.hairpins.filter(h => !(h.fromId === fromId && h.toId === toId)) } : prev)
  }, [])

  const updateMeasure = useCallback((id: number, patch: Partial<Measure>) => {
    setComp(prev => {
      if (!prev) return prev
      const measures = prev.measures.map(m => m.id === id ? { ...m, ...patch } : m)
      return { ...prev, measures }
    })
  }, [])

  // ─── VexFlow rendering ────────────────────────────────────────────────────

  // Hit-test record stores everything needed for click routing + drag
  const noteHitboxesRef = useRef<{
    id: number
    x: number
    y: number
    w: number
    h: number
    staffIdx: 0 | 1
    midY: number
    lineSpacing: number
    clef: Clef
  }[]>([])

  // Per-row staff geometry — used to find which staff a click landed on
  const staffRectsRef = useRef<{
    rowIdx: number
    staffIdx: 0 | 1
    x: number
    y: number      // top of stave
    w: number
    h: number      // approx full stave height (5 lines)
    midY: number   // center line
    lineSpacing: number
    clef: Clef
  }[]>([])

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
    // Grand staff needs more vertical room per row (two staves + brace + space)
    const rowHeight = comp.grandStaff ? 280 : 200
    const totalHeight = lines * rowHeight + 80

    const renderer = new Renderer(container, Renderer.Backends.SVG)
    renderer.resize(totalWidth, totalHeight)
    const context = renderer.getContext()
    context.setFont('Arial', 12)

    noteHitboxesRef.current = []
    staffRectsRef.current = []

    // staveNoteByMNoteId — map from MNote.id to {staveNote, stave} for slur/hairpin lookup later
    const staveNoteByMNoteId = new Map<number, { sn: any; stave: any; staffIdx: 0 | 1 }>()

    // Iterate measures, but for each measure render up to 2 staves if grandStaff
    comp.measures.forEach((measure, mIdx) => {
      const lineIdx = Math.floor(mIdx / measuresPerLine)
      const colIdx = mIdx % measuresPerLine
      const x = startX + colIdx * measureWidth
      const yTop = startY + lineIdx * rowHeight
      const isFirstInLine = colIdx === 0

      // Determine stave Y positions for this row
      const staffYs: number[] = comp.grandStaff ? [yTop, yTop + 110] : [yTop]
      const staffClefs: Clef[] = comp.grandStaff ? [comp.clef, comp.bassClef] : [comp.clef]

      const stavesThisMeasure: any[] = []

      staffYs.forEach((sy, staffIdx) => {
        const stave = new Stave(x, sy, measureWidth)
        if (isFirstInLine) {
          stave.addClef(staffClefs[staffIdx])
          stave.addKeySignature(comp.keyName)
          if (mIdx === 0) {
            stave.addTimeSignature(`${comp.timeNum}/${comp.timeDen}`)
            if (staffIdx === 0 && (comp.tempoMark || comp.tempoBpm)) {
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
        // Volta on top stave only
        if (measure.voltaNumber && staffIdx === 0) {
          stave.setVoltaType(
            measure.voltaNumber === 1 ? Volta.type.BEGIN : Volta.type.BEGIN_END,
            measure.voltaNumber.toString() + '.',
            0,
          )
        }
        if (measure.hasCoda && staffIdx === 0) stave.setRepetitionType(Repetition.type.CODA_LEFT)
        if (measure.hasSegno && staffIdx === 0) stave.setRepetitionType(Repetition.type.SEGNO_LEFT)

        stave.setContext(context).draw()
        stavesThisMeasure.push(stave)

        // Record stave geometry for click hit-testing
        const STAVE_LINE_SPACING_PX = 10 // VexFlow default
        const staveTopLineY = sy + 40    // VexFlow draws first line ~40px below stave Y
        const staveMidY = staveTopLineY + STAVE_LINE_SPACING_PX * 2
        staffRectsRef.current.push({
          rowIdx: lineIdx,
          staffIdx: staffIdx as 0 | 1,
          x,
          y: staveTopLineY,
          w: measureWidth,
          h: STAVE_LINE_SPACING_PX * 4 + 20,
          midY: staveMidY,
          lineSpacing: STAVE_LINE_SPACING_PX,
          clef: staffClefs[staffIdx],
        })
      })

      // Connect grand staff with brace + thin lines on first measure of each row
      if (comp.grandStaff && stavesThisMeasure.length === 2) {
        try {
          const brace = new StaveConnector(stavesThisMeasure[0], stavesThisMeasure[1])
          // SINGLE_LEFT thin line, BRACE
          brace.setType(StaveConnector.type.BRACE).setContext(context).draw()
          new StaveConnector(stavesThisMeasure[0], stavesThisMeasure[1])
            .setType(StaveConnector.type.SINGLE_LEFT).setContext(context).draw()
          new StaveConnector(stavesThisMeasure[0], stavesThisMeasure[1])
            .setType(StaveConnector.type.SINGLE_RIGHT).setContext(context).draw()
        } catch {}
      }

      if (measure.notes.length === 0) return

      // Build notes per staff
      stavesThisMeasure.forEach((stave, staffIdx) => {
        const staffNotes = comp.grandStaff
          ? measure.notes.filter(n => (n.staff ?? 0) === staffIdx)
          : measure.notes
        if (staffNotes.length === 0) {
          // Render a whole rest as visual placeholder so VexFlow doesn't blow up
          try {
            const rest = new StaveNote({
              keys: ['b/4'],
              duration: 'wr',
              clef: staffClefs[staffIdx],
            })
            const v = new Voice({ num_beats: comp.timeNum, beat_value: comp.timeDen })
            v.setMode(Voice.Mode.SOFT)
            v.addTickables([rest])
            new Formatter().joinVoices([v]).format([v], measureWidth - 50)
            v.draw(context, stave)
          } catch {}
          return
        }
        const staveNotes: any[] = []
        const tripletGroups = new Map<number, any[]>()

        staffNotes.forEach(n => {
          let staveNote: any
          try {
            // Rest: append 'r' to duration. VexFlow uses key 'b/4' for centered rests.
            const dur = n.isRest ? `${n.duration}r` : n.duration
            const restKeys = staffClefs[staffIdx] === 'treble' ? ['b/4']
              : staffClefs[staffIdx] === 'bass' ? ['d/3']
              : ['c/4']
            staveNote = new StaveNote({
              keys: n.isRest ? restKeys : n.keys,
              duration: dur,
              clef: staffClefs[staffIdx],
              auto_stem: true,
            })
          } catch (err) {
            console.error('StaveNote failed for', n, err)
            return
          }
          if (!n.isRest) {
            n.accidentals.forEach((a, ki) => {
              if (a) {
                try { staveNote.addModifier(new Accidental(a), ki) } catch {}
              }
            })
          }
          if (n.dotted) {
            try { Dot.buildAndAttach([staveNote], { all: true }) } catch {}
          }
          if (n.articulation !== 'none' && !n.fermata && !n.isRest) {
            const map: Record<string, string> = {
              staccato: 'a.', accent: 'a>', tenuto: 'a-', marcato: 'a^', fermata: 'a@a',
            }
            const code = map[n.articulation]
            if (code) {
              try { staveNote.addModifier(new Articulation(code).setPosition(Modifier.Position.ABOVE)) } catch {}
            }
          }
          if (n.fermata) {
            try { staveNote.addModifier(new Articulation('a@a').setPosition(Modifier.Position.ABOVE)) } catch {}
          }
          if (n.dynamic !== 'none') {
            try {
              const dyn = new Annotation(n.dynamic)
                .setFont('Arial', 12, 'bold italic')
                .setVerticalJustification(Annotation.VerticalJustify.BOTTOM)
              staveNote.addModifier(dyn)
            } catch {}
          }
          // Lyric (under the note)
          if (n.lyric && !n.isRest) {
            try {
              const lyr = new Annotation(n.lyric)
                .setFont('Arial', 11)
                .setVerticalJustification(Annotation.VerticalJustify.BOTTOM)
              staveNote.addModifier(lyr)
            } catch {}
          }
          if (n.tripletGroup != null) {
            if (!tripletGroups.has(n.tripletGroup)) tripletGroups.set(n.tripletGroup, [])
            tripletGroups.get(n.tripletGroup)!.push(staveNote)
          }
          staveNotes.push(staveNote)
          staveNoteByMNoteId.set(n.id, { sn: staveNote, stave, staffIdx: staffIdx as 0 | 1 })
        })

        try {
          const voice = new Voice({ num_beats: comp.timeNum, beat_value: comp.timeDen })
          voice.setMode(Voice.Mode.SOFT)
          voice.addTickables(staveNotes)
          new Formatter().joinVoices([voice]).format([voice], measureWidth - 50)
          voice.draw(context, stave)

          const beams = Beam.generateBeams(staveNotes)
          beams.forEach((b: any) => b.setContext(context).draw())

          tripletGroups.forEach((group: any[]) => {
            if (group.length >= 3) {
              const tuplet = new Tuplet(group)
              tuplet.setContext(context).draw()
            }
          })

          // Hit-test rectangles + selection highlight
          staveNotes.forEach((sn, i) => {
            try {
              const bbox = sn.getBoundingBox()
              if (bbox) {
                const rect = staffRectsRef.current.find(r => r.staffIdx === staffIdx && r.x === x && r.y >= yTop && r.y <= yTop + 200)
                noteHitboxesRef.current.push({
                  id: staffNotes[i].id,
                  x: bbox.getX(),
                  y: bbox.getY(),
                  w: bbox.getW(),
                  h: bbox.getH(),
                  staffIdx: staffIdx as 0 | 1,
                  midY: rect?.midY ?? 0,
                  lineSpacing: rect?.lineSpacing ?? 10,
                  clef: staffClefs[staffIdx],
                })
                if (staffNotes[i].id === selectedNoteId) {
                  context.save()
                  // Different highlight if it's the slur/hairpin start
                  const isSlurStart = pendingSlurFromId === staffNotes[i].id
                  const isHpStart = pendingHairpin?.fromId === staffNotes[i].id
                  context.setFillStyle(
                    isSlurStart ? 'rgba(34,197,94,0.25)'
                    : isHpStart ? 'rgba(251,146,60,0.25)'
                    : 'rgba(220, 38, 38, 0.18)'
                  )
                  context.fillRect(bbox.getX() - 4, bbox.getY() - 4, bbox.getW() + 8, bbox.getH() + 8)
                  context.restore()
                }
              }
            } catch {}
          })
        } catch (err) {
          console.error('Voice format failed:', err)
        }
      })
    })

    // ─── Slurs (Curve) ──────────────────────────────────────────────────────
    // VexFlow's Curve takes two endpoint notes and auto-spans whatever's
    // between them on the rendered staff — so the DATA only needs {fromId, toId}
    // to cover 2, 3, 4, or N notes. Jon's complaint ("can only join 2 notes")
    // was actually a visual rendering issue: position: 1 (NEAR_HEAD) put the
    // curve near the notehead which looked wrong for multi-note spans, and
    // the fixed y:10 control points produced a flat line regardless of span.
    //
    // Fix: always arch ABOVE the notes (position: 2 = NEAR_TOP), and scale
    // the control-point y offset by the count of notes between the endpoints
    // so 4-note slurs arch higher than 2-note slurs. We count intermediate
    // notes by walking the flattened melody in composition order.
    const allNotesInOrder: { id: number }[] = []
    comp.measures.forEach(m => m.notes.forEach(n => allNotesInOrder.push({ id: n.id })))
    const noteIdxById = new Map<number, number>()
    allNotesInOrder.forEach((n, i) => noteIdxById.set(n.id, i))

    comp.slurs.forEach(slur => {
      const a = staveNoteByMNoteId.get(slur.fromId)
      const b = staveNoteByMNoteId.get(slur.toId)
      if (!a || !b) return
      try {
        // How many notes does this slur span (including endpoints)?
        const fromIdx = noteIdxById.get(slur.fromId) ?? 0
        const toIdx = noteIdxById.get(slur.toId) ?? 0
        const span = Math.max(2, Math.abs(toIdx - fromIdx) + 1)
        // Curve arc depth scales with span — clamped so it doesn't go crazy
        // for very long slurs. 2 notes → 14, 4 notes → 22, 6+ notes → 30.
        const arcDepth = Math.min(30, 10 + span * 3.5)
        const curve = new Curve(a.sn, b.sn, {
          spacing: 2,
          thickness: 2,
          x_shift: 0,
          y_shift: -arcDepth,       // negative = above the notes
          position: 2,              // 2 = NEAR_TOP (curve above the staff)
          invert: false,
          cps: [
            { x: 0, y: -arcDepth },
            { x: 0, y: -arcDepth },
          ],
        })
        curve.setContext(context).draw()
      } catch (err) {
        console.error('Slur draw failed:', err)
      }
    })

    // ─── Hairpins (StaveHairpin) ────────────────────────────────────────────
    comp.hairpins.forEach(hp => {
      const a = staveNoteByMNoteId.get(hp.fromId)
      const b = staveNoteByMNoteId.get(hp.toId)
      if (!a || !b) return
      try {
        const hairpin = new StaveHairpin(
          { first_note: a.sn, last_note: b.sn },
          hp.type === 'cresc' ? StaveHairpin.type.CRESC : StaveHairpin.type.DECRESC,
        )
        hairpin.setContext(context).setPosition(Modifier.Position.BELOW).draw()
      } catch (err) {
        console.error('Hairpin draw failed:', err)
      }
    })
  }, [comp, selectedNoteId, pendingSlurFromId, pendingHairpin])

  useEffect(() => { renderStaff() }, [renderStaff])

  // ─── Mouse handlers — supports click, shift-click chord, drag-pitch ───────
  // mousedown: pick up a note for drag, OR record start of click
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!comp) return
    if (e.button !== 0) return
    const container = staffContainerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    for (const hb of noteHitboxesRef.current) {
      if (x >= hb.x - 4 && x <= hb.x + hb.w + 4 && y >= hb.y - 4 && y <= hb.y + hb.h + 4) {
        // Find the note's first key/accidental for drag origin
        for (const m of comp.measures) {
          for (const n of m.notes) {
            if (n.id === hb.id && !n.isRest) {
              dragRef.current = {
                noteId: hb.id,
                startY: e.clientY,
                startKey: n.keys[0],
                startAcc: n.accidentals[0],
                moved: false,
              }
              return
            }
          }
        }
        return
      }
    }
  }, [comp])

  // mousemove: if dragging, update pitch live
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || !comp) return
    const dy = e.clientY - drag.startY
    if (Math.abs(dy) < 4 && !drag.moved) return
    drag.moved = true
    // ~5 px per diatonic step (half a line spacing). Compute new semi from start.
    const stepDelta = -Math.round(dy / 5) // up = negative dy = positive step
    const startSemi = vexKeyToSemi(drag.startKey, drag.startAcc)
    // Walk diatonically: each step changes letter by 1, semis variable
    const letterOrder = ['c', 'd', 'e', 'f', 'g', 'a', 'b']
    const startLetter = drag.startKey.match(/^([a-g])/i)![1].toLowerCase()
    const startLetterIdx = letterOrder.indexOf(startLetter)
    const startOctave = parseInt(drag.startKey.match(/\/(-?\d+)$/)![1])
    const newLetterPos = startLetterIdx + stepDelta
    const newLetterIdx = ((newLetterPos % 7) + 7) % 7
    const octaveDelta = Math.floor(newLetterPos / 7)
    const newLetter = letterOrder[newLetterIdx]
    const newOctave = startOctave + octaveDelta
    let newAcc: Accid = ''
    if (drag.startKey.includes('#')) newAcc = '#'
    else if (drag.startKey.includes('b/') === false && drag.startAcc === '#') newAcc = '#'
    // Update the note's first key. Keep accidental neutral by default after drag.
    setComp(prev => {
      if (!prev) return prev
      const measures = prev.measures.map(m => ({
        ...m,
        notes: m.notes.map(n => {
          if (n.id !== drag.noteId) return n
          if (n.isRest) return n
          const newKeys = [`${newLetter}/${newOctave}`, ...n.keys.slice(1)]
          const newAccs = ['' as Accid, ...n.accidentals.slice(1)]
          return { ...n, keys: newKeys, accidentals: newAccs }
        }),
      }))
      return { ...prev, measures }
    })
  }, [comp])

  // mouseup: finalize drag or treat as click
  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!comp) return
    const drag = dragRef.current
    if (drag && drag.moved) {
      // Drag finished — find the note and play its new pitch
      for (const m of comp.measures) {
        for (const n of m.notes) {
          if (n.id === drag.noteId && !n.isRest) {
            playPianoNote(vexKeyToName(n.keys[0], n.accidentals[0]))
          }
        }
      }
      dragRef.current = null
      return
    }
    dragRef.current = null

    // Plain click — same logic as before
    const container = staffContainerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Hit-test existing notes
    for (const hb of noteHitboxesRef.current) {
      if (x >= hb.x - 4 && x <= hb.x + hb.w + 4 && y >= hb.y - 4 && y <= hb.y + hb.h + 4) {
        // Pending slur or hairpin endpoint?
        if (pendingSlurFromId != null) {
          commitSlur(hb.id)
          return
        }
        if (pendingHairpin) {
          commitHairpin(hb.id)
          return
        }
        // Shift-click → add to chord using staff Y
        if (e.shiftKey) {
          const semi = yToSemi(y, hb.midY, hb.lineSpacing, hb.clef)
          addChordTone(hb.id, semi)
          return
        }
        setSelectedNoteId(hb.id)
        setEditPopup({ noteId: hb.id, x: e.clientX, y: e.clientY })
        for (const m of comp.measures) {
          for (const n of m.notes) {
            if (n.id === hb.id && !n.isRest) {
              playPianoNote(vexKeyToName(n.keys[0], n.accidentals[0]))
              return
            }
          }
        }
        return
      }
    }

    // Empty click — find which staff this click landed on by Y proximity
    let closestStaff: typeof staffRectsRef.current[number] | null = null
    let bestDist = Infinity
    for (const sr of staffRectsRef.current) {
      const d = Math.abs(y - sr.midY)
      if (d < bestDist) { bestDist = d; closestStaff = sr }
    }
    if (!closestStaff) return
    const semi = yToSemi(y, closestStaff.midY, closestStaff.lineSpacing, closestStaff.clef)
    addNoteAtSemi(semi, closestStaff.staffIdx)
    setEditPopup(null)
  }, [comp, addNoteAtSemi, addChordTone, pendingSlurFromId, pendingHairpin, commitSlur, commitHairpin])

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

  // ─── Rebalance measures ──────────────────────────────────────────────────
  // Flatten all notes in order, then re-split across measures so each bar
  // respects the time signature capacity. Preserves measure metadata by
  // index (startBar, endBar, volta, coda, segno).
  //
  // 2026-04-08 fixes (Jon: "struggled with rest beats"):
  //   - Trailing underfilled measure is auto-padded with rests so the last
  //     bar always sums to full capacity. Without this, VexFlow renders
  //     a half-empty bar that LOOKS like rest beats were dropped.
  //   - Tightened epsilon from 0.001 to 1e-6 (the old value was loose
  //     enough that a 4-beat measure could overflow without triggering).
  //   - Grand staff now pads top + bot voices to the SAME measure count
  //     before merging, so neither voice silently truncates the other.
  const rebalanceMeasures = useCallback(() => {
    if (!comp) return
    const fullCapacity = comp.timeNum * (4 / comp.timeDen)
    const EPS = 1e-6

    // Build a properly-shaped rest of an arbitrary beat count by stacking
    // the largest power-of-two duration that fits. Used to pad underfilled
    // trailing measures so the score always renders cleanly.
    const REST_DURATIONS: { dur: DurationKey; beats: number; dotted: boolean }[] = [
      { dur: 'w',  beats: 4,    dotted: false },
      { dur: 'h',  beats: 3,    dotted: true  },
      { dur: 'h',  beats: 2,    dotted: false },
      { dur: 'q',  beats: 1.5,  dotted: true  },
      { dur: 'q',  beats: 1,    dotted: false },
      { dur: '8',  beats: 0.75, dotted: true  },
      { dur: '8',  beats: 0.5,  dotted: false },
      { dur: '16', beats: 0.25, dotted: false },
      { dur: '32', beats: 0.125, dotted: false },
    ]
    const buildRestsForBeats = (beats: number, staff?: 0 | 1): MNote[] => {
      const out: MNote[] = []
      let remaining = beats
      let safety = 32  // hard cap to prevent any infinite loop on weird inputs
      while (remaining > EPS && safety-- > 0) {
        const fit = REST_DURATIONS.find(r => r.beats <= remaining + EPS)
        if (!fit) break  // smaller than 32nd note — round down (acceptable rounding loss)
        out.push({
          id: ++noteIdCounter,
          keys: ['b/4'],
          accidentals: [''],
          duration: fit.dur,
          dotted: fit.dotted,
          articulation: 'none',
          dynamic: 'none',
          tieToNext: false,
          fermata: false,
          isRest: true,
          staff: comp.grandStaff ? (staff ?? 0) : undefined,
        })
        remaining -= fit.beats
      }
      return out
    }

    const splitIntoMeasures = (notes: MNote[], staffForPad?: 0 | 1): MNote[][] => {
      const result: MNote[][] = []
      let current: MNote[] = []
      let used = 0
      let isFirst = true
      for (const note of notes) {
        const nb = noteBeats(note)
        const cap = (isFirst && comp.pickupBeats > 0) ? comp.pickupBeats : fullCapacity
        if (used + nb > cap + EPS) {
          if (current.length > 0) result.push(current)
          current = []
          used = 0
          isFirst = false
        }
        current.push(note)
        used += nb
      }
      if (current.length > 0) result.push(current)

      // Pad the trailing measure with rests so it sums to full capacity.
      // Without this, the last bar renders half-empty and Jon's complaint
      // ("struggled with rest beats") shows up as missing tail rests.
      if (result.length > 0) {
        const last = result[result.length - 1]
        const lastUsed = last.reduce((s, n) => s + noteBeats(n), 0)
        // Determine the capacity this final bar SHOULD have (pickup if it's
        // also the first measure, otherwise full)
        const finalCap = (result.length === 1 && comp.pickupBeats > 0)
          ? comp.pickupBeats
          : fullCapacity
        const shortBy = finalCap - lastUsed
        if (shortBy > EPS) {
          const padding = buildRestsForBeats(shortBy, staffForPad)
          last.push(...padding)
        }
      }
      return result
    }

    let newGroups: MNote[][]
    if (!comp.grandStaff) {
      const all: MNote[] = []
      comp.measures.forEach(m => m.notes.forEach(n => all.push(n)))
      if (all.length === 0) return
      newGroups = splitIntoMeasures(all)
    } else {
      // Grand staff: rebalance top + bottom independently. Then PAD whichever
      // voice has fewer measures with whole-bar rests so the merge produces a
      // matching pair for every bar (otherwise one voice silently truncates).
      const top: MNote[] = []
      const bot: MNote[] = []
      comp.measures.forEach(m => m.notes.forEach(n => {
        if ((n.staff ?? 0) === 0) top.push(n)
        else bot.push(n)
      }))
      if (top.length === 0 && bot.length === 0) return
      const topSplit = splitIntoMeasures(top, 0)
      const botSplit = splitIntoMeasures(bot, 1)
      const maxCount = Math.max(topSplit.length, botSplit.length, 1)
      while (topSplit.length < maxCount) topSplit.push(buildRestsForBeats(fullCapacity, 0))
      while (botSplit.length < maxCount) botSplit.push(buildRestsForBeats(fullCapacity, 1))
      newGroups = []
      for (let i = 0; i < maxCount; i++) {
        const merged: MNote[] = [...(topSplit[i] || []), ...(botSplit[i] || [])]
        newGroups.push(merged)
      }
    }

    const newMeasures: Measure[] = newGroups.map((notes, i) => {
      const orig = comp.measures[i]
      return {
        id: ++measureIdCounter,
        notes,
        startBar: orig?.startBar ?? 'normal',
        endBar: orig?.endBar ?? 'normal',
        voltaNumber: orig?.voltaNumber,
        hasCoda: orig?.hasCoda ?? false,
        hasSegno: orig?.hasSegno ?? false,
        tempoMark: orig?.tempoMark,
        rehearsalMark: orig?.rehearsalMark,
      }
    })

    const oldCount = comp.measures.length
    const newCount = newMeasures.length
    setComp(prev => prev ? { ...prev, measures: newMeasures } : prev)
    setStatusMsg(
      oldCount === newCount
        ? `Balanced ${newCount} bars — notes redistributed`
        : `Balanced: ${oldCount} → ${newCount} bars`
    )
    setTimeout(() => setStatusMsg(''), 3500)
  }, [comp])

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

          {/* Grand staff toggle */}
          <div className="mb-6">
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Staff Layout</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSetupGrandStaff(false)}
                className="px-4 py-3 rounded-lg text-sm font-bold transition-all"
                style={{
                  background: !setupGrandStaff ? 'rgba(99,102,241,0.25)' : 'rgba(40,40,60,0.5)',
                  border: `2px solid ${!setupGrandStaff ? '#6366f1' : 'rgba(60,60,80,0.5)'}`,
                  color: !setupGrandStaff ? '#a5b4fc' : '#888',
                }}
              >
                <div className="text-2xl mb-0.5">𝄚</div>
                <div>Single Staff</div>
                <div className="text-[10px] opacity-70">one voice / instrument</div>
              </button>
              <button
                onClick={() => { setSetupGrandStaff(true); if (!setupClef) setSetupClef('treble') }}
                className="px-4 py-3 rounded-lg text-sm font-bold transition-all"
                style={{
                  background: setupGrandStaff ? 'rgba(99,102,241,0.25)' : 'rgba(40,40,60,0.5)',
                  border: `2px solid ${setupGrandStaff ? '#6366f1' : 'rgba(60,60,80,0.5)'}`,
                  color: setupGrandStaff ? '#a5b4fc' : '#888',
                }}
              >
                <div className="text-2xl mb-0.5">𝄞𝄢</div>
                <div>Grand Staff (Piano)</div>
                <div className="text-[10px] opacity-70">treble + bass with brace</div>
              </button>
            </div>
          </div>

          {/* Clef (top staff) */}
          <div className="mb-8">
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
              {setupGrandStaff ? 'Top Staff Clef' : 'Clef'} <span className="text-red-400">*required</span>
            </label>
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
            {setupGrandStaff && (
              <div className="mt-3">
                <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Bottom Staff Clef</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {(['treble', 'alto', 'tenor', 'bass'] as Clef[]).map(c => (
                    <button
                      key={c}
                      onClick={() => setSetupBassClef(c)}
                      className="px-3 py-2 rounded text-xs font-bold transition-all"
                      style={{
                        background: setupBassClef === c ? 'rgba(99,102,241,0.25)' : 'rgba(40,40,60,0.5)',
                        border: `2px solid ${setupBassClef === c ? '#6366f1' : 'rgba(60,60,80,0.5)'}`,
                        color: setupBassClef === c ? '#a5b4fc' : '#888',
                      }}
                    >
                      <div className="text-2xl">{c === 'treble' ? '𝄞' : c === 'bass' ? '𝄢' : '𝄡'}</div>
                      <div className="capitalize">{c}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
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

          {/* Pickup measure */}
          <div className="mb-8">
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1">Pickup Measure (Anacrusis)</label>
            <p className="text-[11px] text-gray-500 mb-2">Many hymns + folk songs start on a partial measure. Set to 0 if your piece starts on the downbeat.</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={8}
                step={0.5}
                value={setupPickupBeats}
                onChange={e => setSetupPickupBeats(parseFloat(e.target.value) || 0)}
                className="w-24 px-3 py-2 bg-[#15152a] border border-[#3a3a55] rounded text-base text-white text-center"
              />
              <span className="text-xs text-gray-500">beats (in quarters)</span>
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
          <button
            onClick={rebalanceMeasures}
            className="text-xs px-3 py-1.5 rounded bg-[#15152a] border border-amber-700 text-amber-300 hover:bg-amber-950/40"
            title="Flatten all notes and re-split them across measures to fit the time signature"
          >
            ⚖ Balance Bars
          </button>
          <button
            onClick={() => { refreshSavedList(); setShowOpenModal(true) }}
            className="text-xs px-3 py-1.5 rounded font-bold text-amber-300 border border-amber-700 hover:bg-amber-950/40"
            title="Open a previously saved composition (loads it into this editor for further editing)"
          >
            📂 Open…
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
        <span className="text-gray-500 uppercase tracking-wider ml-2">Tool</span>
        {([
          { t: 'place' as const, glyph: '♩', title: 'Place note (click to add at clicked pitch)' },
          { t: 'rest' as const, glyph: '𝄽', title: 'Place rest (click to add a rest at current duration)' },
        ]).map(p => (
          <button
            key={p.t}
            onClick={() => setToolMode(p.t)}
            className="px-2 py-1.5 rounded font-bold transition-all"
            style={{
              background: toolMode === p.t ? 'rgba(99,102,241,0.25)' : 'rgba(40,40,60,0.5)',
              border: `1px solid ${toolMode === p.t ? '#6366f1' : 'rgba(60,60,80,0.5)'}`,
              color: toolMode === p.t ? '#a5b4fc' : '#888',
            }}
            title={p.title}
          >
            <span className="text-lg">{p.glyph}</span>
          </button>
        ))}
      </div>

      {/* Second toolbar row — slurs, hairpins, hints */}
      <div className="px-4 py-1.5 border-b border-gray-800/40 bg-[#0a0a14] flex items-center gap-2 flex-wrap text-xs">
        <span className="text-gray-500 uppercase tracking-wider">Phrase Marks</span>
        <button
          onClick={() => {
            if (selectedNoteId == null) return setStatusMsg('Click a note first, then click Slur')
            setPendingSlurFromId(selectedNoteId)
            setPendingHairpin(null)
            setStatusMsg('Slur start set — click the END note')
            setTimeout(() => setStatusMsg(''), 3500)
          }}
          className="px-2 py-1 rounded font-bold transition-all"
          style={{
            background: pendingSlurFromId != null ? 'rgba(34,197,94,0.25)' : 'rgba(40,40,60,0.5)',
            border: `1px solid ${pendingSlurFromId != null ? '#22c55e' : 'rgba(60,60,80,0.5)'}`,
            color: pendingSlurFromId != null ? '#86efac' : '#888',
          }}
          title="Click to start slur from selected note, then click end note"
        >
          ⌒ Slur
        </button>
        <button
          onClick={() => {
            if (selectedNoteId == null) return setStatusMsg('Click a note first, then click Crescendo')
            setPendingHairpin({ fromId: selectedNoteId, type: 'cresc' })
            setPendingSlurFromId(null)
            setStatusMsg('Crescendo start set — click the END note')
            setTimeout(() => setStatusMsg(''), 3500)
          }}
          className="px-2 py-1 rounded font-bold transition-all"
          style={{
            background: pendingHairpin?.type === 'cresc' ? 'rgba(251,146,60,0.25)' : 'rgba(40,40,60,0.5)',
            border: `1px solid ${pendingHairpin?.type === 'cresc' ? '#fb923c' : 'rgba(60,60,80,0.5)'}`,
            color: pendingHairpin?.type === 'cresc' ? '#fdba74' : '#888',
          }}
          title="Crescendo hairpin"
        >
          &lt; cresc.
        </button>
        <button
          onClick={() => {
            if (selectedNoteId == null) return setStatusMsg('Click a note first, then click Decrescendo')
            setPendingHairpin({ fromId: selectedNoteId, type: 'dim' })
            setPendingSlurFromId(null)
            setStatusMsg('Decrescendo start set — click the END note')
            setTimeout(() => setStatusMsg(''), 3500)
          }}
          className="px-2 py-1 rounded font-bold transition-all"
          style={{
            background: pendingHairpin?.type === 'dim' ? 'rgba(251,146,60,0.25)' : 'rgba(40,40,60,0.5)',
            border: `1px solid ${pendingHairpin?.type === 'dim' ? '#fb923c' : 'rgba(60,60,80,0.5)'}`,
            color: pendingHairpin?.type === 'dim' ? '#fdba74' : '#888',
          }}
          title="Decrescendo hairpin"
        >
          &gt; dim.
        </button>
        {(pendingSlurFromId != null || pendingHairpin) && (
          <button
            onClick={() => { setPendingSlurFromId(null); setPendingHairpin(null) }}
            className="px-2 py-1 rounded text-red-300 border border-red-700 hover:bg-red-900/30"
          >
            Cancel
          </button>
        )}

        <span className="text-gray-500 uppercase tracking-wider ml-3">Pickup</span>
        <input
          type="number"
          min={0}
          max={8}
          step={0.5}
          value={comp.pickupBeats}
          onChange={e => setComp(prev => prev ? { ...prev, pickupBeats: parseFloat(e.target.value) || 0 } : prev)}
          className="w-14 px-2 py-1 bg-[#15152a] border border-[#3a3a55] rounded text-white text-center"
          title="Pickup measure (anacrusis) beats"
        />
        <span className="text-gray-600">beats</span>

        <div className="ml-auto text-[10px] text-gray-600">
          Click empty staff = add note · Click note = edit · Drag note = change pitch · Shift-click note = add to chord · 1-6 dur · . dot · T triplet · # ♭ accidental
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
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { dragRef.current = null }}
          style={{ cursor: pendingSlurFromId != null ? 'crosshair' : pendingHairpin ? 'crosshair' : 'pointer', minHeight: 250 }}
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
          onRemoveChordTone={(ki) => removeChordTone(selNote.id, ki)}
          onStartSlur={() => {
            setPendingSlurFromId(selNote.id)
            setStatusMsg('Slur start set — click the END note')
            setTimeout(() => setStatusMsg(''), 3500)
            setEditPopup(null)
          }}
          onStartCresc={() => {
            setPendingHairpin({ fromId: selNote.id, type: 'cresc' })
            setStatusMsg('Crescendo start set — click the END note')
            setTimeout(() => setStatusMsg(''), 3500)
            setEditPopup(null)
          }}
          onStartDim={() => {
            setPendingHairpin({ fromId: selNote.id, type: 'dim' })
            setStatusMsg('Decrescendo start set — click the END note')
            setTimeout(() => setStatusMsg(''), 3500)
            setEditPopup(null)
          }}
        />
      )}

      {/* ── Open Saved Composition modal ──
          Triggered by the 📂 Open… button in the top toolbar. Lists every
          pd_composed_* entry in localStorage and lets the user click one to
          load it into the current editor (without going back to the setup
          phase). loadComposition() handles the re-ID, slur/hairpin remap,
          and modal close. */}
      {showOpenModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setShowOpenModal(false)}
        >
          <div
            className="bg-[#15152a] border-2 border-amber-700 rounded-xl shadow-2xl w-[min(640px,90vw)] max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
              <h2 className="text-lg font-bold text-amber-300">📂 Open Saved Composition</h2>
              <button
                onClick={() => setShowOpenModal(false)}
                className="text-gray-500 hover:text-gray-300 text-2xl leading-none"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {savedList.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  No saved compositions yet. Save one with the 💾 SAVE button first.
                </div>
              ) : (
                savedList.map(({ key, comp: c }) => (
                  <div
                    key={key}
                    className="flex items-center gap-2 p-3 bg-[#0a0a14] border border-[#3a3a55] rounded-lg hover:border-amber-700 transition-colors"
                  >
                    <button
                      onClick={() => loadComposition(key)}
                      className="flex-1 text-left text-indigo-300 hover:text-indigo-200"
                    >
                      <div className="font-bold text-base">{c.title || 'Untitled'}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {c.clef} clef · {c.timeNum}/{c.timeDen} · {c.keyName} · {c.measures?.length || 0} measures
                        {c.savedAt && ` · saved ${new Date(c.savedAt).toLocaleDateString()}`}
                      </div>
                    </button>
                    <button
                      onClick={() => deleteSavedComposition(key, c.title)}
                      className="text-xs text-red-500 hover:text-red-400 px-3 py-1 rounded border border-red-900 hover:bg-red-950/40"
                      title="Delete this saved composition"
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="px-4 py-3 border-t border-gray-700 text-xs text-gray-500">
              Loading replaces what&apos;s currently in the editor. Save your current work first if you want to keep it.
            </div>
          </div>
        </div>
      )}

      {/* ── Floating SAVE button — always visible, bottom-right ──
          Jon's ask 2x: the small Save button in the top toolbar is easy to
          miss. This big floating one can't be missed, and it stays put no
          matter what you scroll or how the toolbar wraps. */}
      <button
        onClick={handleSave}
        className="fixed bottom-6 right-6 z-40 px-6 py-4 rounded-2xl font-bold text-white text-base shadow-2xl transition-transform active:scale-95 hover:scale-105"
        style={{
          background: 'linear-gradient(135deg, #4ade80, #22c55e)',
          boxShadow: '0 0 24px rgba(74,222,128,0.5), 0 8px 24px rgba(0,0,0,0.6)',
          border: '2px solid #86efac',
        }}
        title="Save composition to localStorage — reads in all Pitch Defender games"
      >
        💾 SAVE
      </button>

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
  note, x, y, onClose, onUpdate, onDelete, onRemoveChordTone,
  onStartSlur, onStartCresc, onStartDim,
}: {
  note: MNote
  x: number
  y: number
  onClose: () => void
  onUpdate: (patch: Partial<MNote>) => void
  onDelete: () => void
  onRemoveChordTone: (keyIdx: number) => void
  onStartSlur: () => void
  onStartCresc: () => void
  onStartDim: () => void
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

  // ─── Compute placement: flip above if no room below, clamp height to fit ──
  const MARGIN = 16
  const WIDTH = 340
  const PREFERRED_H = 560
  const MIN_H = 240
  const winW = typeof window !== 'undefined' ? window.innerWidth : 1200
  const winH = typeof window !== 'undefined' ? window.innerHeight : 800
  const spaceBelow = winH - y - MARGIN * 2
  const spaceAbove = y - MARGIN * 2
  const openBelow = spaceBelow >= MIN_H || spaceBelow >= spaceAbove
  const popupMaxHeight = Math.min(
    PREFERRED_H,
    Math.max(MIN_H, openBelow ? spaceBelow : spaceAbove)
  )
  const computedTop = openBelow
    ? Math.min(y + MARGIN, winH - popupMaxHeight - MARGIN)
    : Math.max(MARGIN, y - MARGIN - popupMaxHeight)
  const computedLeft = Math.min(Math.max(MARGIN, x), winW - WIDTH - MARGIN)

  return (
    <div
      data-note-popup
      className="fixed z-50 bg-[#15152a] border-2 border-indigo-600 rounded-lg shadow-2xl text-xs flex flex-col"
      style={{
        left: computedLeft,
        top: computedTop,
        width: WIDTH,
        maxHeight: popupMaxHeight,
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Sticky header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-[#15152a] rounded-t-lg flex-shrink-0">
        <span className="text-indigo-300 font-bold">
          Edit {note.isRest ? 'Rest' : note.keys.length > 1 ? 'Chord' : 'Note'}
          {note.staff != null && (
            <span className="ml-2 text-[10px] text-gray-500">
              {note.staff === 0 ? 'top staff' : 'bottom staff'}
            </span>
          )}
        </span>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-base leading-none">✕</button>
      </div>

      {/* Scrollable body */}
      <div className="space-y-2 px-3 py-2 overflow-y-auto flex-1">
        {/* Chord tones — only when there are multiple */}
        {!note.isRest && note.keys.length > 0 && (
          <div>
            <div className="text-gray-500 uppercase tracking-wider mb-1">Pitches in chord</div>
            <div className="flex flex-wrap gap-1">
              {note.keys.map((k, ki) => (
                <span
                  key={`${k}-${ki}`}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-900/30 border border-indigo-700 text-indigo-200 font-mono"
                >
                  {k.toUpperCase()}{note.accidentals[ki] || ''}
                  {note.keys.length > 1 && (
                    <button
                      onClick={() => onRemoveChordTone(ki)}
                      className="ml-1 text-red-400 hover:text-red-300"
                      title="Remove this tone"
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
            <div className="text-[10px] text-gray-600 mt-1">
              Tip: shift-click on the staff to add another pitch to this chord.
            </div>
          </div>
        )}

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

        <div className="flex gap-3 flex-wrap">
          <label className="flex items-center gap-1 text-gray-300">
            <input type="checkbox" checked={note.dotted} onChange={e => onUpdate({ dotted: e.target.checked })} />
            Dotted
          </label>
          <label className="flex items-center gap-1 text-gray-300">
            <input type="checkbox" checked={note.tripletGroup != null} onChange={e => onUpdate({ tripletGroup: e.target.checked ? Date.now() : undefined })} />
            Triplet
          </label>
          {!note.isRest && (
            <>
              <label className="flex items-center gap-1 text-gray-300">
                <input type="checkbox" checked={note.fermata} onChange={e => onUpdate({ fermata: e.target.checked })} />
                Fermata
              </label>
              <label className="flex items-center gap-1 text-gray-300">
                <input type="checkbox" checked={note.tieToNext} onChange={e => onUpdate({ tieToNext: e.target.checked })} />
                Tie
              </label>
            </>
          )}
          <label className="flex items-center gap-1 text-gray-300">
            <input type="checkbox" checked={note.isRest === true} onChange={e => onUpdate({ isRest: e.target.checked })} />
            Rest
          </label>
        </div>

        {!note.isRest && (
          <>
            <div>
              <div className="text-gray-500 uppercase tracking-wider mb-1">Accidental (top tone)</div>
              <div className="flex gap-1">
                {(['', '#', 'b', 'n', '##', 'bb'] as Accid[]).map(a => (
                  <button
                    key={a || 'none'}
                    onClick={() => {
                      // Update only the first key's accidental, leave chord tones alone
                      const newAccs = [...note.accidentals]
                      newAccs[0] = a
                      onUpdate({ accidentals: newAccs })
                    }}
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

            <div>
              <div className="text-gray-500 uppercase tracking-wider mb-1">Lyric (syllable)</div>
              <input
                type="text"
                value={note.lyric || ''}
                onChange={e => onUpdate({ lyric: e.target.value })}
                placeholder="e.g. love, mer-, -cy"
                className="w-full px-2 py-1.5 bg-[#1f1f3a] border border-[#3a3a55] rounded text-sm text-white"
              />
            </div>

            <div>
              <div className="text-gray-500 uppercase tracking-wider mb-1">Phrase Marks</div>
              <div className="flex gap-1">
                <button
                  onClick={onStartSlur}
                  className="px-2 py-1 rounded text-[11px] font-bold bg-[#1f1f3a] hover:bg-[#2d2d4f] text-emerald-300 border border-emerald-800"
                  title="Start slur from this note — then click the end note"
                >
                  ⌒ Slur
                </button>
                <button
                  onClick={onStartCresc}
                  className="px-2 py-1 rounded text-[11px] font-bold bg-[#1f1f3a] hover:bg-[#2d2d4f] text-orange-300 border border-orange-800"
                  title="Start crescendo from this note"
                >
                  &lt; cresc.
                </button>
                <button
                  onClick={onStartDim}
                  className="px-2 py-1 rounded text-[11px] font-bold bg-[#1f1f3a] hover:bg-[#2d2d4f] text-orange-300 border border-orange-800"
                  title="Start decrescendo from this note"
                >
                  &gt; dim.
                </button>
              </div>
            </div>
          </>
        )}

      </div>

      {/* ── Sticky footer — Delete button always visible regardless of scroll ──
          Jon's ask 2x: previously the Delete button was inside the scrollable
          body (last child), so when the popup content exceeded popupMaxHeight
          the button fell below the body scroll fold and you had to scroll
          inside the popup to reach it. Sticky footer fixes that permanently. */}
      <div className="flex-shrink-0 border-t border-red-900/50 bg-[#15152a] rounded-b-lg px-3 py-2">
        <button
          onClick={onDelete}
          className="w-full px-3 py-2 rounded bg-red-900/60 border border-red-600 text-red-200 hover:bg-red-900/80 font-bold text-sm"
        >
          🗑  Delete {note.isRest ? 'Rest' : 'Note'}
        </button>
      </div>
    </div>
  )
}
