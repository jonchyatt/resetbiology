'use client'

// =============================================================================
// ScoreEngraving — lean OSMD engraver + "sung-out" highlight for VocalTrainer III.
// =============================================================================
//
// Code Blue primitives `score-panel` (render) + `sing-out-highlight` (the cursor
// that lights up the note being sung, synced to the RECORDING clock).
//
// Renders a part-isolated MusicXML score as engraved notation (dark mode). When a
// sync map (syncUrl) + currentTime are supplied, it drives OSMD's NATIVE cursor to
// the note whose recording window contains currentTime — the cursor both marks the
// note and auto-scrolls it into view (follow:true), which is why we use it instead
// of plotting pitch onto the non-linear staff (Argus's HIGH coordinate trap).
//
// Deliberately MINIMAL — no mic/practice/+cents UI. The live mic feedback in VT3
// stays the existing Pitchforks-v1 slider; this component only draws + tracks the
// score. Follows the recording clock, never a metronome (FLW hard rule).
// =============================================================================

import { useRef, useEffect, useState, useCallback } from 'react'

interface SyncNote { pitchMidi: number; startTimeSeconds: number; durationSeconds: number }

interface ScoreEngravingProps {
  musicXMLUrl: string
  title?: string
  zoom?: number
  syncUrl?: string        // per-note recording timestamps (lida-rose-lead-sync.json)
  currentTime?: number    // VT3 practiceTime (audio clock seconds)
}

// Dark palette — matches the site's #0a0a14 surface (same values as SheetMusicViewer).
const DARK = {
  background: '#0a0a14',
  music: '#c8d7f5',
  staff: '#4a5578',
  title: '#e2e8f4',
  label: '#8898c0',
  cursor: '#fbbf24',     // amber — the "sung-out" position highlight
  cursorAlpha: 0,
  activeNote: '#fbbf24',
}

export default function ScoreEngraving({ musicXMLUrl, title, zoom: initialZoom = 0.8, syncUrl, currentTime }: ScoreEngravingProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const osmdRef = useRef<any>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(initialZoom)
  const [syncReady, setSyncReady] = useState(false)

  // sing-out cursor state (refs — driven imperatively, no re-render)
  const syncNotesRef = useRef<SyncNote[]>([])
  const stepOrdinalRef = useRef<number[]>([]) // cursor-step ordinal of each pitched note
  const curStepRef = useRef(0)                // cursor's current absolute step
  const curIdxRef = useRef(-1)                // last highlighted sync-note index
  const activeGNotesRef = useRef<any[]>([])   // currently colored OSMD graphical notes
  const wrapperRef = useRef<HTMLDivElement | null>(null)  // nearest stable anchor for score scrolling

  const applyColors = useCallback((osmd: any) => {
    const r = osmd.EngravingRules
    r.PageBackgroundColor = DARK.background
    r.DefaultColorMusic = DARK.music
    r.DefaultColorNotehead = DARK.music
    r.DefaultColorStem = DARK.music
    r.DefaultColorRest = DARK.music
    r.DefaultColorLabel = DARK.label
    r.DefaultColorTitle = DARK.title
    r.DefaultColorCursor = DARK.cursor
    r.StaffLineColor = DARK.staff
    r.LedgerLineColorDefault = DARK.staff
  }, [])

  // ─── Load + render (refetch only when the score URL changes) ─────────
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!containerRef.current) return
      try {
        setStatus('loading')
        setError(null)
        setSyncReady(false)
        curIdxRef.current = -1
        curStepRef.current = 0
        activeGNotesRef.current = []

        const resp = await fetch(musicXMLUrl)
        if (!resp.ok) throw new Error(`fetch ${resp.status} ${resp.statusText}`)
        const xml = await resp.text()
        if (cancelled || !containerRef.current) return

        const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay')
        if (cancelled || !containerRef.current) return

        if (osmdRef.current) { try { osmdRef.current.clear() } catch { /* ok */ } }
        containerRef.current.innerHTML = ''

        const osmd = new OpenSheetMusicDisplay(containerRef.current, {
          autoResize: true,
          drawTitle: true,
          drawPartNames: false,
          drawingParameters: 'default',
          cursorsOptions: [{ type: 0, color: DARK.cursor, alpha: DARK.cursorAlpha, follow: true }],
        })
        osmd.Zoom = zoom
        applyColors(osmd)
        await osmd.load(xml)
        if (cancelled) return
        osmd.render()
        osmdRef.current = osmd
        setStatus('ready')

        // ── sing-out setup: fetch sync map + index the pitched notes ──
        if (syncUrl) {
          try {
            const sresp = await fetch(syncUrl)
            if (sresp.ok) {
              const sj = await sresp.json()
              if (cancelled) return
              syncNotesRef.current = sj.notes || []
              stepOrdinalRef.current = buildStepOrdinals(osmd, syncNotesRef.current)
              const np = stepOrdinalRef.current.length
              const ns = syncNotesRef.current.length
              if (np !== ns) console.warn(`ScoreEngraving: aligned cursor notes ${np} != sync notes ${ns} - highlight may drift`)
              const cur = osmd.cursor
              if (cur) { cur.reset(); cur.show(); try { cur.update() } catch { /* ok */ }; curStepRef.current = 0; curIdxRef.current = -1 }
              setSyncReady(true)
            }
          } catch (e) { console.warn('ScoreEngraving sync load failed:', e) }
        }
      } catch (err: any) {
        if (cancelled) return
        console.error('ScoreEngraving load error:', err)
        setError(err?.message || 'Failed to render score')
        setStatus('error')
      }
    }
    load()
    return () => {
      cancelled = true
      if (osmdRef.current) { try { osmdRef.current.clear() } catch { /* ok */ } osmdRef.current = null }
      if (containerRef.current) containerRef.current.innerHTML = ''
    }
    // zoom handled by the re-zoom effect (no refetch); currentTime by the sing-out effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicXMLUrl, syncUrl, applyColors])

  // ─── Sing-out: drive the cursor to the note at currentTime ───────────
  useEffect(() => {
    if (status !== 'ready' || !syncReady || currentTime == null || !osmdRef.current) return
    const sn = syncNotesRef.current
    const ord = stepOrdinalRef.current
    if (!sn.length || !ord.length) return

    // active note = the one whose recording window contains currentTime (mirror of VT3 currentTargetNote)
    let idx = -1
    for (let i = 0; i < sn.length; i++) {
      if (sn[i].startTimeSeconds <= currentTime && currentTime < sn[i].startTimeSeconds + sn[i].durationSeconds) { idx = i; break }
    }
    if (idx === -1) {
      if (currentTime < (sn[0]?.startTimeSeconds ?? 0)) idx = 0 // before the first sung note → park at start
      else return // between/after notes → hold the last highlight
    }
    if (idx === curIdxRef.current) return
    curIdxRef.current = idx

    const target = ord[idx]
    if (target == null) return
    try {
      const cur = osmdRef.current.cursor
      let s = curStepRef.current
      if (target < s) { while (s > target) { cur.previous(); s-- } }
      else { while (s < target && !cur.Iterator?.EndReached) { cur.next(); s++ } }
      try { cur.update() } catch { /* ok */ } // refresh OSMD cursor position after the move
      curStepRef.current = s

      clearGraphicalNotes(activeGNotesRef.current)
      const gNotes = typeof cur.GNotesUnderCursor === 'function' ? (cur.GNotesUnderCursor() || []) : []
      colorGraphicalNotes(gNotes, DARK.activeNote)
      activeGNotesRef.current = gNotes
      publishActiveNoteTelemetry(idx, sn[idx], s)

      // Use OSMD's invisible cursor as a layout-aware position source for scroll.
      const cel = cur.cursorElement || document.getElementById('cursorImg-0')
      const wrap = wrapperRef.current
      if (cel && wrap) {
        const cr = cel.getBoundingClientRect()
        try {
          let sc: HTMLElement | null = wrap.parentElement
          while (sc && sc.scrollHeight <= sc.clientHeight + 4) sc = sc.parentElement
          if (sc) {
            const scRect = sc.getBoundingClientRect()
            const target = sc.scrollTop + (cr.top - scRect.top) - sc.clientHeight * 0.38
            const clamped = Math.max(0, Math.min(sc.scrollHeight - sc.clientHeight, target))
            if (Math.abs(clamped - sc.scrollTop) > 10) sc.scrollTo({ top: clamped, behavior: 'smooth' })
          }
        } catch { /* ok */ }
      }
    } catch { /* ok */ }
  }, [currentTime, status, syncReady])

  // ─── Re-zoom without refetch ─────────────────────────────────────────
  useEffect(() => {
    if (osmdRef.current && status === 'ready') {
      try {
        clearGraphicalNotes(activeGNotesRef.current)
        activeGNotesRef.current = []
        curIdxRef.current = -1
        osmdRef.current.Zoom = zoom
        osmdRef.current.render()
        osmdRef.current.cursor?.show?.()
      } catch { /* ok */ }
    }
  }, [zoom, status])

  // ─── Re-render on resize ─────────────────────────────────────────────
  useEffect(() => {
    const onResize = () => { if (osmdRef.current && status === 'ready') { try { osmdRef.current.render() } catch { /* ok */ } } }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [status])

  return (
    <div className="rounded-lg border border-cyan-500/20 bg-[#0a0a14] p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400">
          {title || 'Engraved score'}{status === 'ready' ? (syncReady ? ' · sings out with the track' : ' · live notation (OSMD)') : ''}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))}
            className="px-2 py-0.5 text-sm bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-200"
            aria-label="Zoom out"
          >−</button>
          <span className="text-xs text-gray-500 w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))}
            className="px-2 py-0.5 text-sm bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-200"
            aria-label="Zoom in"
          >+</button>
        </div>
      </div>
      {status === 'loading' && <p className="text-sm text-gray-500 py-8 text-center">Rendering score…</p>}
      {status === 'error' && <p className="text-sm text-red-400 py-8 text-center">Could not render score: {error}</p>}
      <div ref={wrapperRef} className="relative">
        <div ref={containerRef} className="overflow-x-auto" />
      </div>
    </div>
  )
}

function clearGraphicalNotes(gNotes: any[]) {
  colorGraphicalNotes(gNotes, DARK.music)
}

function colorGraphicalNotes(gNotes: any[], color: string) {
  for (const gNote of gNotes || []) {
    try {
      if (typeof gNote?.setColor === 'function') {
        gNote.setColor(color, {
          applyToNoteheads: true,
          applyToStem: true,
        })
      }
    } catch { /* ok */ }
  }
}

function publishActiveNoteTelemetry(index: number, note: SyncNote | undefined, cursorStep: number) {
  if (typeof window === 'undefined') return
  ;(window as any).__VT3_SCORE_ACTIVE__ = {
    index,
    cursorStep,
    pitchMidi: note?.pitchMidi ?? null,
    pitchName: note ? midiName(note.pitchMidi) : null,
    startTimeSeconds: note?.startTimeSeconds ?? null,
    durationSeconds: note?.durationSeconds ?? null,
  }
}

const MIDI_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
function midiName(midi: number): string {
  return `${MIDI_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`
}

type CursorPitchStop = { step: number; pitchMidi: number }

// Walk the cursor once, keep each pitched stop's absolute cursor step plus MIDI
// pitch, then align those stops to the sync notes by pitch. This avoids assuming
// OSMD cursor stops are 1:1 with sung notes: tied/held continuation stops can be
// skipped while later sync notes keep their correct cursor step.
function buildStepOrdinals(osmd: any, syncNotes: SyncNote[]): number[] {
  const cur = osmd.cursor
  if (!cur || !syncNotes.length) return []
  cur.reset()
  const stops: CursorPitchStop[] = []
  let step = 0
  let guard = 0
  while (!cur.Iterator?.EndReached && guard < 100000) {
    let notes: any[] = []
    try { notes = cur.NotesUnderCursor() || [] } catch { notes = [] }
    const pitchMidi = firstPitchMidi(notes)
    if (pitchMidi != null) stops.push({ step, pitchMidi })
    cur.next()
    step++
    guard++
  }
  cur.reset()

  const ord: number[] = []
  let stopIdx = 0
  for (const syncNote of syncNotes) {
    while (stopIdx < stops.length && !pitchesAgree(stops[stopIdx].pitchMidi, syncNote.pitchMidi)) {
      stopIdx++
    }
    if (stopIdx >= stops.length) break
    ord.push(stops[stopIdx].step)
    stopIdx++
  }
  return ord
}

function firstPitchMidi(notes: any[]): number | null {
  for (const note of notes) {
    const midi = notePitchMidi(note)
    if (midi != null) return midi
  }
  return null
}

function notePitchMidi(note: any): number | null {
  if (!note) return null
  const pitch = note.Pitch ?? note.pitch ?? note.TransposedPitch
  const halfTone = pitchHalfTone(pitch)
  const octave = numberOrNull(pitch?.Octave ?? pitch?.octave)
  if (halfTone != null && octave != null) return halfTone + 12 * (octave + 4)

  const absoluteHalfTone = numberOrNull(note.halfTone ?? note.HalfTone)
  return absoluteHalfTone != null && absoluteHalfTone > 24 ? absoluteHalfTone : null
}

function pitchHalfTone(pitch: any): number | null {
  if (!pitch) return null
  if (typeof pitch.getHalfTone === 'function') return numberOrNull(pitch.getHalfTone())
  const halfTone = numberOrNull(pitch.halfTone ?? pitch.HalfTone)
  if (halfTone != null) return halfTone
  const fundamental = numberOrNull(pitch.FundamentalNote)
  const accidental = numberOrNull(pitch.AccidentalHalfTones) ?? 0
  return fundamental != null ? fundamental + accidental : null
}

function pitchesAgree(cursorMidi: number, syncMidi: number): boolean {
  return Math.abs(cursorMidi - syncMidi) <= 0.5 || foldedPitchDistance(cursorMidi, syncMidi) <= 0.5
}

function foldedPitchDistance(a: number, b: number): number {
  const diff = Math.abs(pitchClass(a) - pitchClass(b))
  return Math.min(diff, 12 - diff)
}

function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}
