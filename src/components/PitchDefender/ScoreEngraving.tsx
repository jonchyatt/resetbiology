'use client'

// =============================================================================
// ScoreEngraving — lean OSMD engraver for VocalTrainer III "Score" mode.
// =============================================================================
//
// Renders a part-isolated MusicXML score as real engraved notation (dark mode),
// fetched by URL. Phase-2 Code Blue primitive `score-panel`: the "see your real
// notes" surface that supersedes the 248-page page-image ScoreViewer.
//
// Deliberately MINIMAL — reuses SheetMusicViewer's proven OSMD init + dark palette
// but NONE of its mic/practice/LivePitchStaff (+cents/You) UI. Mic feedback in VT3
// stays the existing Pitchforks-v1 slider; this component only draws the score.
// The sing-out cursor highlight (primitive `sing-out-highlight`) layers on later.
// =============================================================================

import { useRef, useEffect, useState, useCallback } from 'react'

interface ScoreEngravingProps {
  musicXMLUrl: string
  title?: string
  zoom?: number
}

// Dark palette — matches the site's #0a0a14 surface (same values as SheetMusicViewer).
const DARK = {
  background: '#0a0a14',
  music: '#c8d7f5',
  staff: '#4a5578',
  title: '#e2e8f4',
  label: '#8898c0',
  cursor: '#6366f1',
  cursorAlpha: 0.3,
}

export default function ScoreEngraving({ musicXMLUrl, title, zoom: initialZoom = 0.8 }: ScoreEngravingProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const osmdRef = useRef<any>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(initialZoom)

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

  // ─── Load + render (refetch only when the URL changes) ───────────────
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!containerRef.current) return
      try {
        setStatus('loading')
        setError(null)
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
          disableCursor: false,
          cursorsOptions: [{ type: 0, color: DARK.cursor, alpha: DARK.cursorAlpha, follow: true }],
        })
        osmd.Zoom = zoom
        applyColors(osmd)
        await osmd.load(xml)
        if (cancelled) return
        osmd.render()
        osmdRef.current = osmd
        setStatus('ready')
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
    // zoom intentionally excluded — handled by the re-zoom effect below (no refetch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicXMLUrl, applyColors])

  // ─── Re-zoom without refetch ─────────────────────────────────────────
  useEffect(() => {
    if (osmdRef.current && status === 'ready') {
      try {
        osmdRef.current.Zoom = zoom
        osmdRef.current.render()
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
          {title || 'Engraved score'}{status === 'ready' ? ' · live notation (OSMD)' : ''}
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
      <div ref={containerRef} className="overflow-x-auto" />
    </div>
  )
}
