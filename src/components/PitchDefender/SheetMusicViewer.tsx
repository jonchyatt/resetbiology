'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// SheetMusicViewer — Professional Notation via OpenSheetMusicDisplay
// ═══════════════════════════════════════════════════════════════════════════════
//
// Renders MusicXML with professional engraving quality using OSMD (VexFlow-based).
// Supports all clef types: treble, bass, alto (C3), tenor (C4), soprano, mezzo-soprano.
// This is the PROFESSIONAL tier — game modes use the custom Canvas renderer.
//
// Architecture: OSMD renders the notation → our study overlay adds pitch tracking,
// synesthesia colors, voice guidance on top.
// ═══════════════════════════════════════════════════════════════════════════════

import { useRef, useEffect, useState, useCallback } from 'react'

interface SheetMusicViewerProps {
  musicXML?: string       // MusicXML string to render
  musicXMLUrl?: string    // OR a URL to fetch MusicXML from
  zoom?: number           // zoom level (default 1.0)
  darkMode?: boolean      // dark background mode
}

export default function SheetMusicViewer({
  musicXML,
  musicXMLUrl,
  zoom = 1.0,
  darkMode = true,
}: SheetMusicViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const osmdRef = useRef<any>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  const initOSMD = useCallback(async () => {
    if (!containerRef.current) return

    try {
      setStatus('loading')

      // Dynamic import to avoid SSR issues
      const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay')

      const osmd = new OpenSheetMusicDisplay(containerRef.current, {
        autoResize: true,
        drawTitle: true,
        drawSubtitle: true,
        drawComposer: true,
        drawCredits: true,
        drawPartNames: true,
        drawPartAbbreviations: true,
        drawingParameters: 'default',
      })

      // Apply zoom
      osmd.Zoom = zoom

      osmdRef.current = osmd

      // Load MusicXML
      let xmlData = musicXML
      if (!xmlData && musicXMLUrl) {
        const resp = await fetch(musicXMLUrl)
        xmlData = await resp.text()
      }

      if (!xmlData) {
        // Load the built-in demo if no data provided
        xmlData = DEMO_SATB_MUSICXML
      }

      await osmd.load(xmlData)
      osmd.render()

      setStatus('ready')
    } catch (err: any) {
      console.error('OSMD init error:', err)
      setError(err.message || 'Failed to load sheet music')
      setStatus('error')
    }
  }, [musicXML, musicXMLUrl, zoom])

  useEffect(() => {
    initOSMD()
  }, [initOSMD])

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (osmdRef.current && status === 'ready') {
        osmdRef.current.render()
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [status])

  return (
    <div className={`relative ${darkMode ? 'bg-[#0a0a14]' : 'bg-white'}`}>
      {status === 'loading' && (
        <div className="flex items-center justify-center py-20">
          <div className="text-gray-400 text-sm">Loading sheet music...</div>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center justify-center py-20">
          <div className="text-red-400 text-sm">Error: {error}</div>
        </div>
      )}

      <div
        ref={containerRef}
        className="w-full overflow-x-auto"
        style={{
          // OSMD renders SVG — in dark mode, invert the colors
          ...(darkMode ? { filter: 'invert(0.88) hue-rotate(180deg)' } : {}),
          minHeight: status === 'ready' ? undefined : 0,
        }}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Demo Score — SATB "Ode to Joy" with 4 clef types
// ═══════════════════════════════════════════════════════════════════════════════
// Soprano: Treble clef (G on line 2)
// Alto: Alto clef (C on line 3) — demonstrates movable C clef
// Tenor: Tenor clef (C on line 4) — demonstrates second C clef position
// Bass: Bass clef (F on line 4)
// ═══════════════════════════════════════════════════════════════════════════════

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

  <!-- SOPRANO — Treble Clef -->
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

  <!-- ALTO — Alto Clef (C clef on line 3) -->
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

  <!-- TENOR — Tenor Clef (C clef on line 4) -->
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

  <!-- BASS — Bass Clef -->
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
