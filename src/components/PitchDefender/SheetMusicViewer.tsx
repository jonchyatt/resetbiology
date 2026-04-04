'use client'

// =============================================================================
// SheetMusicViewer — Professional Notation via OpenSheetMusicDisplay
// =============================================================================
//
// Production-quality OSMD wrapper with:
// - Native dark mode (EngravingRules colors, no CSS invert)
// - MusicXML file upload (drag-and-drop + file picker)
// - Part isolation (toggle SATB voices)
// - Cursor/playback (step through notes, auto-play with tempo)
//
// This is the PROFESSIONAL tier — game modes use the custom Canvas renderer.
// =============================================================================

import { useRef, useEffect, useState, useCallback } from 'react'
import { usePitchDetection, type PitchInfo } from './usePitchDetection'

interface SheetMusicViewerProps {
  musicXML?: string
  musicXMLUrl?: string
  zoom?: number
  darkMode?: boolean
}

// Dark mode color palette — matches the site's #0a0a14 background
const DARK_COLORS = {
  background: '#0a0a14',
  music: '#c8d7f5',         // soft blue-white for notes/stems
  staff: '#4a5578',         // muted staff lines
  title: '#e2e8f4',         // bright for titles
  label: '#8898c0',         // part names, dynamics
  cursor: '#6366f1',        // indigo cursor highlight
  cursorAlpha: 0.3,
}

const LIGHT_COLORS = {
  background: '#ffffff',
  music: '#000000',
  staff: '#000000',
  title: '#000000',
  label: '#333333',
  cursor: '#3b82f6',
  cursorAlpha: 0.2,
}

export default function SheetMusicViewer({
  musicXML,
  musicXMLUrl,
  zoom = 1.0,
  darkMode = true,
}: SheetMusicViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const osmdRef = useRef<any>(null)
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  // Part visibility state
  const [parts, setParts] = useState<{ name: string; visible: boolean }[]>([])

  // Cursor state
  const [cursorVisible, setCursorVisible] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [tempo, setTempo] = useState(80) // BPM for auto-play

  // Drag state
  const [isDragging, setIsDragging] = useState(false)

  // Practice mode state
  const [practiceActive, setPracticeActive] = useState(false)
  const [practiceResults, setPracticeResults] = useState<{ note: string; accuracy: 'perfect' | 'good' | 'miss' | 'pending' }[]>([])
  const [currentTarget, setCurrentTarget] = useState<string | null>(null)
  const [practiceScore, setPracticeScore] = useState({ perfect: 0, good: 0, miss: 0, total: 0 })
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const matchStartRef = useRef<number>(0)

  // Pitch detection
  const { isListening, pitch, startListening, stopListening } = usePitchDetection({ noiseGateDb: -45 })

  // ─── Apply Colors ──────────────────────────────────────────────────
  const applyColors = useCallback((osmd: any, dark: boolean) => {
    const colors = dark ? DARK_COLORS : LIGHT_COLORS
    const rules = osmd.EngravingRules

    rules.PageBackgroundColor = colors.background
    rules.DefaultColorMusic = colors.music
    rules.DefaultColorNotehead = colors.music
    rules.DefaultColorStem = colors.music
    rules.DefaultColorRest = colors.music
    rules.DefaultColorLabel = colors.label
    rules.DefaultColorTitle = colors.title
    rules.DefaultColorCursor = colors.cursor
    // Staff lines — use hex with alpha suffix for OSMD/VexFlow
    rules.StaffLineColor = colors.staff
    rules.LedgerLineColorDefault = colors.staff
  }, [])

  // ─── Initialize OSMD ──────────────────────────────────────────────
  const loadScore = useCallback(async (xmlData: string, name?: string) => {
    if (!containerRef.current) return

    try {
      setStatus('loading')
      setIsPlaying(false)
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current)
        playIntervalRef.current = null
      }

      const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay')

      // Clear previous instance
      if (osmdRef.current) {
        try { osmdRef.current.clear() } catch { /* ok */ }
      }
      containerRef.current.innerHTML = ''

      const osmd = new OpenSheetMusicDisplay(containerRef.current, {
        autoResize: true,
        drawTitle: true,
        drawSubtitle: true,
        drawComposer: true,
        drawCredits: true,
        drawPartNames: true,
        drawPartAbbreviations: true,
        drawingParameters: 'default',
        disableCursor: false,
        cursorsOptions: [{
          type: 0,
          color: darkMode ? DARK_COLORS.cursor : LIGHT_COLORS.cursor,
          alpha: darkMode ? DARK_COLORS.cursorAlpha : LIGHT_COLORS.cursorAlpha,
          follow: true,
        }],
      })

      osmd.Zoom = zoom
      applyColors(osmd, darkMode)

      await osmd.load(xmlData)
      osmd.render()

      osmdRef.current = osmd

      // Extract part info
      const sheetParts = osmd.Sheet?.Parts || osmd.Sheet?.Instruments || []
      const partInfo = sheetParts.map((p: any) => ({
        name: p.Name || p.NameLabel?.text || 'Part',
        visible: true,
      }))
      setParts(partInfo)
      setCursorVisible(false)

      if (name) setFileName(name)
      setStatus('ready')
    } catch (err: any) {
      console.error('OSMD load error:', err)
      setError(err.message || 'Failed to load sheet music')
      setStatus('error')
    }
  }, [zoom, darkMode, applyColors])

  // ─── Initial Load ─────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      let xmlData = musicXML
      if (!xmlData && musicXMLUrl) {
        const resp = await fetch(musicXMLUrl)
        xmlData = await resp.text()
      }
      if (!xmlData) {
        xmlData = DEMO_SATB_MUSICXML
        setFileName('Ode to Joy — SATB Demo')
      }
      await loadScore(xmlData)
    }
    init()
  }, [musicXML, musicXMLUrl, loadScore])

  // ─── Handle Resize ────────────────────────────────────────────────
  useEffect(() => {
    const handleResize = () => {
      if (osmdRef.current && status === 'ready') {
        osmdRef.current.render()
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [status])

  // ─── Cleanup on unmount ───────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current)
    }
  }, [])

  // ─── File Upload Handler ──────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !['xml', 'musicxml', 'mxl'].includes(ext)) {
      setError('Please upload a MusicXML file (.xml, .musicxml, or .mxl)')
      setStatus('error')
      return
    }

    if (ext === 'mxl') {
      // Compressed MusicXML — OSMD can load from ArrayBuffer
      const buf = await file.arrayBuffer()
      try {
        setStatus('loading')
        const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay')

        if (osmdRef.current) {
          try { osmdRef.current.clear() } catch { /* ok */ }
        }
        if (containerRef.current) containerRef.current.innerHTML = ''

        const osmd = new OpenSheetMusicDisplay(containerRef.current!, {
          autoResize: true,
          drawTitle: true,
          drawSubtitle: true,
          drawComposer: true,
          drawCredits: true,
          drawPartNames: true,
          drawPartAbbreviations: true,
          drawingParameters: 'default',
          disableCursor: false,
          cursorsOptions: [{
            type: 0,
            color: darkMode ? DARK_COLORS.cursor : LIGHT_COLORS.cursor,
            alpha: darkMode ? DARK_COLORS.cursorAlpha : LIGHT_COLORS.cursorAlpha,
            follow: true,
          }],
        })

        osmd.Zoom = zoom
        applyColors(osmd, darkMode)

        // OSMD can load MXL from ArrayBuffer
        await osmd.load(new Uint8Array(buf) as any)
        osmd.render()

        osmdRef.current = osmd

        const sheetParts = osmd.Sheet?.Parts || osmd.Sheet?.Instruments || []
        setParts(sheetParts.map((p: any) => ({
          name: p.Name || p.NameLabel?.text || 'Part',
          visible: true,
        })))
        setCursorVisible(false)
        setFileName(file.name)
        setStatus('ready')
      } catch (err: any) {
        console.error('MXL load error:', err)
        setError(err.message || 'Failed to load compressed MusicXML')
        setStatus('error')
      }
      return
    }

    // Plain XML text
    const text = await file.text()
    await loadScore(text, file.name)
  }, [loadScore, zoom, darkMode, applyColors])

  // ─── Drag and Drop ────────────────────────────────────────────────
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = '' // reset so same file can be re-uploaded
  }, [handleFile])

  // ─── Part Visibility Toggle ───────────────────────────────────────
  const togglePart = useCallback((index: number) => {
    const osmd = osmdRef.current
    if (!osmd) return

    const sheetParts = osmd.Sheet?.Parts || osmd.Sheet?.Instruments || []
    if (index >= sheetParts.length) return

    const newVisible = !parts[index].visible
    sheetParts[index].Visible = newVisible

    // Must have at least one visible part
    const wouldBeVisible = parts.filter((p, i) => i === index ? newVisible : p.visible)
    if (wouldBeVisible.every(p => !p.visible)) return // don't allow hiding all

    setParts(prev => prev.map((p, i) => i === index ? { ...p, visible: newVisible } : p))

    try {
      osmd.updateGraphic()
      osmd.render()
    } catch {
      // Fallback: full re-render
      osmd.render()
    }
  }, [parts])

  // ─── Cursor Controls ──────────────────────────────────────────────
  const showCursor = useCallback(() => {
    const osmd = osmdRef.current
    if (!osmd?.cursor) return
    osmd.cursor.show()
    osmd.cursor.reset()
    setCursorVisible(true)
  }, [])

  const hideCursor = useCallback(() => {
    const osmd = osmdRef.current
    if (!osmd?.cursor) return
    osmd.cursor.hide()
    setCursorVisible(false)
    setIsPlaying(false)
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current)
      playIntervalRef.current = null
    }
  }, [])

  const cursorNext = useCallback(() => {
    const osmd = osmdRef.current
    if (!osmd?.cursor) return
    osmd.cursor.next()
  }, [])

  const cursorPrev = useCallback(() => {
    const osmd = osmdRef.current
    if (!osmd?.cursor) return
    osmd.cursor.previous()
  }, [])

  const cursorReset = useCallback(() => {
    const osmd = osmdRef.current
    if (!osmd?.cursor) return
    osmd.cursor.reset()
  }, [])

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false)
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current)
        playIntervalRef.current = null
      }
      return
    }

    const osmd = osmdRef.current
    if (!osmd?.cursor) return

    if (!cursorVisible) {
      osmd.cursor.show()
      osmd.cursor.reset()
      setCursorVisible(true)
    }

    setIsPlaying(true)
    const msPerBeat = 60000 / tempo
    playIntervalRef.current = setInterval(() => {
      const cursor = osmdRef.current?.cursor
      if (!cursor) return

      // Check if we've reached the end
      const iter = cursor.Iterator
      if (iter?.EndReached) {
        setIsPlaying(false)
        if (playIntervalRef.current) {
          clearInterval(playIntervalRef.current)
          playIntervalRef.current = null
        }
        return
      }

      cursor.next()
    }, msPerBeat)
  }, [isPlaying, cursorVisible, tempo])

  // ─── Load Demo Score ──────────────────────────────────────────────
  const loadDemo = useCallback(() => {
    setFileName('Ode to Joy — SATB Demo')
    loadScore(DEMO_SATB_MUSICXML)
  }, [loadScore])

  // ─── Practice Mode ────────────────────────────────────────────────
  const getTargetNoteFromCursor = useCallback((): string | null => {
    const osmd = osmdRef.current
    if (!osmd?.cursor) return null
    try {
      const notes = osmd.cursor.NotesUnderCursor()
      if (!notes || notes.length === 0) return null
      // Get the first note's pitch — format: "C4", "D#5", etc.
      const note = notes[0]
      if (!note?.Pitch) return null
      const step = ['C', 'D', 'E', 'F', 'G', 'A', 'B'][note.Pitch.FundamentalNote] || 'C'
      const accidental = note.Pitch.Accidental > 0 ? '#' : note.Pitch.Accidental < 0 ? 'b' : ''
      const octave = note.Pitch.Octave + 3 // OSMD octave offset
      return `${step}${accidental}${octave}`
    } catch {
      return null
    }
  }, [])

  const startPractice = useCallback(() => {
    const osmd = osmdRef.current
    if (!osmd?.cursor) return

    osmd.cursor.show()
    osmd.cursor.reset()
    setCursorVisible(true)
    setPracticeActive(true)
    setPracticeResults([])
    setPracticeScore({ perfect: 0, good: 0, miss: 0, total: 0 })
    startListening()

    // Get first target
    const target = getTargetNoteFromCursor()
    setCurrentTarget(target)
    matchStartRef.current = 0
  }, [startListening, getTargetNoteFromCursor])

  const stopPractice = useCallback(() => {
    setPracticeActive(false)
    setCurrentTarget(null)
    stopListening()
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }, [stopListening])

  // Practice: check pitch against target and advance cursor
  useEffect(() => {
    if (!practiceActive || !pitch || !currentTarget || !pitch.isActive) return

    const detectedBase = pitch.note.replace(/\d+$/, '')
    const targetBase = currentTarget.replace(/\d+$/, '')
    const centsOff = Math.abs(pitch.cents)

    // Check note match (octave-flexible for beginners)
    if (detectedBase === targetBase) {
      if (matchStartRef.current === 0) {
        matchStartRef.current = Date.now()
      }

      // Hold for 400ms to confirm
      const held = Date.now() - matchStartRef.current
      if (held >= 400) {
        // Grade accuracy
        const accuracy: 'perfect' | 'good' = centsOff <= 15 ? 'perfect' : 'good'

        // Color the note in the score
        const osmd = osmdRef.current
        if (osmd?.cursor) {
          try {
            const gNotes = osmd.cursor.GNotesUnderCursor()
            if (gNotes?.length > 0) {
              const color = accuracy === 'perfect' ? '#22c55e' : '#eab308'
              gNotes[0].setColor(color, {
                applyToNoteheads: true,
                applyToStem: true,
              })
            }
          } catch { /* ok */ }
        }

        setPracticeResults(prev => [...prev, { note: currentTarget, accuracy }])
        setPracticeScore(prev => ({
          ...prev,
          [accuracy]: prev[accuracy] + 1,
          total: prev.total + 1,
        }))

        // Advance cursor
        matchStartRef.current = 0
        if (osmd?.cursor) {
          const iter = osmd.cursor.Iterator
          if (iter?.EndReached) {
            stopPractice()
            return
          }
          osmd.cursor.next()
          const next = getTargetNoteFromCursor()
          setCurrentTarget(next)
          if (!next) stopPractice()
        }
      }
    } else {
      matchStartRef.current = 0
    }
  }, [practiceActive, pitch, currentTarget, getTargetNoteFromCursor, stopPractice])

  // ─── Render ───────────────────────────────────────────────────────
  const colors = darkMode ? DARK_COLORS : LIGHT_COLORS
  const bgClass = darkMode ? 'bg-[#0a0a14]' : 'bg-white'
  const textClass = darkMode ? 'text-gray-300' : 'text-gray-700'
  const mutedClass = darkMode ? 'text-gray-500' : 'text-gray-400'
  const borderClass = darkMode ? 'border-gray-800/50' : 'border-gray-200'
  const btnBase = `px-3 py-1.5 rounded text-xs font-medium transition-colors`
  const btnPrimary = darkMode
    ? `${btnBase} bg-indigo-600/80 hover:bg-indigo-500 text-white`
    : `${btnBase} bg-indigo-500 hover:bg-indigo-600 text-white`
  const btnSecondary = darkMode
    ? `${btnBase} bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700`
    : `${btnBase} bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300`

  return (
    <div
      className={`relative ${bgClass}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* ── Toolbar ────────────────────────────────────────────────── */}
      <div className={`flex flex-wrap items-center gap-3 px-4 py-2 border-b ${borderClass}`}>
        {/* File upload */}
        <label className={btnSecondary + ' cursor-pointer'}>
          Open File
          <input
            type="file"
            accept=".xml,.musicxml,.mxl"
            onChange={onFileInput}
            className="hidden"
          />
        </label>

        {fileName && (
          <span className={`text-xs ${mutedClass} truncate max-w-[200px]`} title={fileName}>
            {fileName}
          </span>
        )}

        {/* Sample scores */}
        <select
          onChange={async (e) => {
            const val = e.target.value
            if (val === 'demo') { loadDemo(); e.target.value = ''; return }
            if (!val) return
            const label = e.target.options[e.target.selectedIndex].text
            e.target.value = ''
            const resp = await fetch(`/musicxml/${val}`)
            const xml = await resp.text()
            await loadScore(xml, label)
          }}
          className={`${btnSecondary} cursor-pointer bg-transparent`}
          value=""
        >
          <option value="" disabled>Sample Scores</option>
          <option value="demo">Ode to Joy (SATB Demo)</option>
          <option value="amazing-grace-hymn.xml">Amazing Grace (Hymn)</option>
          <option value="bach-bwv-244-03-chorale.musicxml">Bach — St. Matthew Passion</option>
          <option value="bach-bwv-140-07-chorale.musicxml">Bach — Sleepers Awake</option>
          <option value="mozart-requiem-kyrie-satb.musicxml">Mozart — Requiem Kyrie</option>
        </select>

        {/* Separator */}
        <div className={`w-px h-5 ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />

        {/* Part toggles */}
        {parts.length > 0 && (
          <div className="flex items-center gap-1">
            <span className={`text-xs ${mutedClass} mr-1`}>Parts:</span>
            {parts.map((part, i) => (
              <button
                key={i}
                onClick={() => togglePart(i)}
                className={`${btnBase} ${
                  part.visible
                    ? (darkMode ? 'bg-indigo-600/60 text-indigo-200 border border-indigo-500/50' : 'bg-indigo-100 text-indigo-700 border border-indigo-300')
                    : (darkMode ? 'bg-gray-800/50 text-gray-600 border border-gray-700/50' : 'bg-gray-50 text-gray-400 border border-gray-200')
                }`}
                title={part.visible ? `Hide ${part.name}` : `Show ${part.name}`}
              >
                {part.name}
              </button>
            ))}
          </div>
        )}

        {/* Separator */}
        {parts.length > 0 && (
          <div className={`w-px h-5 ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />
        )}

        {/* Cursor controls */}
        <div className="flex items-center gap-1">
          {!cursorVisible && !practiceActive ? (
            <button onClick={showCursor} className={btnSecondary}>
              Show Cursor
            </button>
          ) : !practiceActive ? (
            <>
              <button onClick={cursorReset} className={btnSecondary} title="Reset to start">
                |&laquo;
              </button>
              <button onClick={cursorPrev} className={btnSecondary} title="Previous note">
                &laquo;
              </button>
              <button
                onClick={togglePlay}
                className={isPlaying ? `${btnBase} bg-red-600/80 hover:bg-red-500 text-white` : btnPrimary}
                title={isPlaying ? 'Stop' : 'Play'}
              >
                {isPlaying ? 'Stop' : 'Play'}
              </button>
              <button onClick={cursorNext} className={btnSecondary} title="Next note">
                &raquo;
              </button>
              <button onClick={hideCursor} className={btnSecondary} title="Hide cursor">
                Hide
              </button>

              {/* Tempo control */}
              <div className="flex items-center gap-1 ml-2">
                <input
                  type="range"
                  min={30}
                  max={200}
                  value={tempo}
                  onChange={(e) => setTempo(Number(e.target.value))}
                  className="w-16 h-1 accent-indigo-500"
                  title={`Tempo: ${tempo} BPM`}
                />
                <span className={`text-xs ${mutedClass} w-12`}>{tempo} bpm</span>
              </div>
            </>
          ) : null}
        </div>

        {/* Separator */}
        <div className={`w-px h-5 ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />

        {/* Practice mode */}
        {!practiceActive ? (
          <button
            onClick={startPractice}
            className={`${btnBase} bg-emerald-600/80 hover:bg-emerald-500 text-white`}
            title="Sing along with the score — mic-based pitch tracking"
          >
            Practice
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={stopPractice}
              className={`${btnBase} bg-red-600/80 hover:bg-red-500 text-white`}
            >
              Stop Practice
            </button>
            <span className="text-xs text-emerald-400 font-mono">
              {practiceScore.perfect}
            </span>
            <span className="text-xs text-yellow-400 font-mono">
              {practiceScore.good}
            </span>
            {practiceScore.total > 0 && (
              <span className={`text-xs ${mutedClass}`}>
                / {practiceScore.total}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Status Messages ────────────────────────────────────────── */}
      {status === 'loading' && (
        <div className="flex items-center justify-center py-20">
          <div className={`text-sm animate-pulse ${mutedClass}`}>Loading sheet music...</div>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center justify-center py-20 flex-col gap-3">
          <div className="text-red-400 text-sm">Error: {error}</div>
          <button onClick={loadDemo} className={btnPrimary}>Load Demo Score</button>
        </div>
      )}

      {/* ── Drag Overlay ───────────────────────────────────────────── */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-indigo-900/40 border-2 border-dashed border-indigo-400 flex items-center justify-center rounded">
          <div className="text-indigo-200 text-lg font-medium">Drop MusicXML file here</div>
        </div>
      )}

      {/* ── OSMD Container ─────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="w-full overflow-x-auto"
        style={{
          minHeight: status === 'ready' ? undefined : 0,
        }}
      />

      {/* ── Practice Pitch Feedback ──────────────────────────────── */}
      {practiceActive && (
        <div className={`sticky bottom-0 z-40 px-4 py-3 border-t ${borderClass} ${bgClass}`}>
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            {/* Target note */}
            <div className="text-center">
              <div className={`text-xs ${mutedClass}`}>Target</div>
              <div className="text-2xl font-bold text-white">
                {currentTarget || '—'}
              </div>
            </div>

            {/* Pitch indicator */}
            <div className="flex-1 mx-6">
              {pitch?.isActive ? (
                <div className="flex items-center gap-3">
                  {/* Visual pitch bar */}
                  <div className="flex-1 h-3 bg-gray-800 rounded-full overflow-hidden relative">
                    <div className="absolute inset-y-0 left-1/2 w-0.5 bg-emerald-500/50" />
                    <div
                      className="absolute inset-y-0 w-3 rounded-full transition-all duration-75"
                      style={{
                        left: `${Math.max(5, Math.min(95, 50 + (pitch.cents / 50) * 45))}%`,
                        transform: 'translateX(-50%)',
                        background: Math.abs(pitch.cents) <= 15
                          ? '#22c55e'
                          : Math.abs(pitch.cents) <= 30
                          ? '#eab308'
                          : '#ef4444',
                      }}
                    />
                  </div>
                  <span className="text-xs font-mono w-10 text-right" style={{
                    color: Math.abs(pitch.cents) <= 15 ? '#22c55e' : Math.abs(pitch.cents) <= 30 ? '#eab308' : '#ef4444'
                  }}>
                    {pitch.cents > 0 ? '+' : ''}{pitch.cents}c
                  </span>
                </div>
              ) : (
                <div className={`text-center text-xs ${mutedClass}`}>
                  Sing the target note...
                </div>
              )}
            </div>

            {/* Your note */}
            <div className="text-center">
              <div className={`text-xs ${mutedClass}`}>You</div>
              <div className={`text-2xl font-bold ${
                pitch?.isActive
                  ? pitch.note.replace(/\d+$/, '') === currentTarget?.replace(/\d+$/, '')
                    ? 'text-emerald-400'
                    : 'text-red-400'
                  : 'text-gray-600'
              }`}>
                {pitch?.isActive ? pitch.note : '—'}
              </div>
            </div>

            {/* Score summary */}
            <div className="ml-6 text-center">
              <div className={`text-xs ${mutedClass}`}>Score</div>
              <div className="text-sm">
                <span className="text-emerald-400 font-bold">{practiceScore.perfect}</span>
                <span className="text-gray-600 mx-1">/</span>
                <span className="text-yellow-400 font-bold">{practiceScore.good}</span>
                <span className="text-gray-600 mx-1">/</span>
                <span className="text-gray-500">{practiceScore.total}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Empty state / instructions ─────────────────────────────── */}
      {status === 'ready' && !musicXML && !musicXMLUrl && !fileName?.includes('Demo') && !practiceActive && (
        <div className={`text-center py-4 ${mutedClass} text-xs`}>
          Drag and drop a MusicXML file or click Open File to load your sheet music
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Demo Score — SATB "Ode to Joy" with 4 clef types
// =============================================================================

const DEMO_SATB_MUSICXML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work>
    <work-title>Ode to Joy (SATB Demo)</work-title>
  </work>
  <identification>
    <creator type="composer">Ludwig van Beethoven</creator>
    <creator type="arranger">arr. Reset Biology</creator>
  </identification>
  <part-list>
    <score-part id="P1">
      <part-name>Soprano</part-name>
      <part-abbreviation>S</part-abbreviation>
    </score-part>
    <score-part id="P2">
      <part-name>Alto</part-name>
      <part-abbreviation>A</part-abbreviation>
    </score-part>
    <score-part id="P3">
      <part-name>Tenor</part-name>
      <part-abbreviation>T</part-abbreviation>
    </score-part>
    <score-part id="P4">
      <part-name>Bass</part-name>
      <part-abbreviation>B</part-abbreviation>
    </score-part>
  </part-list>

  <!-- SOPRANO - Treble Clef -->
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="2">
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="3">
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="4">
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><type>half</type><dot/></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <barline location="right"><bar-style>light-heavy</bar-style></barline>
    </measure>
  </part>

  <!-- ALTO - Alto Clef (C clef on line 3) -->
  <part id="P2">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>C</sign><line>3</line></clef>
      </attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="2">
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>B</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="3">
      <note><pitch><step>A</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>A</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>B</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="4">
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><type>half</type><dot/></note>
      <note><pitch><step>B</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>
      <barline location="right"><bar-style>light-heavy</bar-style></barline>
    </measure>
  </part>

  <!-- TENOR - Tenor Clef (C clef on line 4) -->
  <part id="P3">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>C</sign><line>4</line></clef>
      </attributes>
      <note><pitch><step>G</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>G</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>A</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>B</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="2">
      <note><pitch><step>B</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>A</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>G</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>G</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="3">
      <note><pitch><step>E</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>F</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>G</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>G</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="4">
      <note><pitch><step>G</step><octave>3</octave></pitch><duration>2</duration><type>half</type><dot/></note>
      <note><pitch><step>G</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>
      <barline location="right"><bar-style>light-heavy</bar-style></barline>
    </measure>
  </part>

  <!-- BASS - Bass Clef -->
  <part id="P4">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>F</sign><line>4</line></clef>
      </attributes>
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>F</step><octave>2</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>G</step><octave>2</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="2">
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>D</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>E</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>G</step><octave>2</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="3">
      <note><pitch><step>A</step><octave>2</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>F</step><octave>2</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>G</step><octave>2</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="4">
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>2</duration><type>half</type><dot/></note>
      <note><pitch><step>G</step><octave>2</octave></pitch><duration>1</duration><type>quarter</type></note>
      <barline location="right"><bar-style>light-heavy</bar-style></barline>
    </measure>
  </part>
</score-partwise>`
