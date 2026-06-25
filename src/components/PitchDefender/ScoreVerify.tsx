'use client'

// =============================================================================
// ScoreVerify — score-vs-engraving verification board (note-by-note audit).
// =============================================================================
//
// Built 2026-06-24 after the engraving was shipped + claimed "green" WITHOUT anyone
// ever visually comparing the rendered engraving to the printed page. This surface
// makes that comparison undeniable: the scanned pages and the OSMD-rendered per-part
// engravings are FREE-DRAGGED, resizable, opacity-blendable panes on one canvas, so
// an engraving can be laid directly ON TOP of the scan and checked note-for-note.
//
// Engravings render with COLORED noteheads on a transparent background so that, when
// overlaid on the black-on-white scan, matching notes sit on the scan's notes and any
// mismatch jumps out. Jon arranges the panes, then screenshots to define the canonical
// layout (the arrangement persists to localStorage).
//
// Additive: new component + new route, touches nothing in VocalTrainerIII. Only Lead +
// Baritone musicxml exist today — Tenor/Bass need extraction before they can be panes.
// =============================================================================

import { useRef, useEffect, useState, useCallback, type PointerEvent as ReactPointerEvent } from 'react'

interface PaneState {
  id: string
  kind: 'scan' | 'engraving'
  label: string
  src: string // scan: image url ; engraving: musicxml url
  color: string // engraving note color (ignored for scans)
  x: number
  y: number
  w: number
  h: number
  z: number
  opacity: number
  zoom: number // engraving: OSMD zoom ; scan: image width multiplier
}

const LS_KEY = 'scoreVerifyLayout.v1'

const DEFAULT_PANES: PaneState[] = [
  { id: 'scan-196', kind: 'scan', label: 'Scan p.196 — bars 1–9 (SATB)', src: '/score/page-196.jpg', color: '#000', x: 16, y: 16, w: 560, h: 760, z: 1, opacity: 1, zoom: 1 },
  { id: 'scan-197', kind: 'scan', label: 'Scan p.197 — bars 10–21', src: '/score/page-197.jpg', color: '#000', x: 596, y: 16, w: 560, h: 760, z: 1, opacity: 1, zoom: 1 },
  { id: 'scan-198', kind: 'scan', label: 'Scan p.198 — bars 22–34', src: '/score/page-198.jpg', color: '#000', x: 1176, y: 16, w: 560, h: 760, z: 1, opacity: 1, zoom: 1 },
  { id: 'eng-lead', kind: 'engraving', label: 'Engraving · Lead (EWART, treble-8vb)', src: '/musicxml/lida-rose-lead.musicxml', color: '#dc2626', x: 16, y: 800, w: 1120, h: 320, z: 2, opacity: 1, zoom: 0.62 },
  { id: 'eng-bari', kind: 'engraving', label: 'Engraving · Baritone (OLIVER, bass)', src: '/musicxml/lida-rose-baritone.musicxml', color: '#2563eb', x: 16, y: 1140, w: 1120, h: 320, z: 2, opacity: 1, zoom: 0.62 },
]

function clampZoom(z: number) {
  return Math.min(2.5, Math.max(0.2, +z.toFixed(2)))
}

// ─── OSMD engraving pane (colored notes, transparent bg, for overlay) ─────────
function EngravingBody({ url, color, zoom }: { url: string; color: string; zoom: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const osmdRef = useRef<any>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const mod = await import('opensheetmusicdisplay')
        if (cancelled || !ref.current) return
        ref.current.innerHTML = ''
        const osmd = new mod.OpenSheetMusicDisplay(ref.current, {
          autoResize: false,
          backend: 'svg',
          drawTitle: false,
          drawPartNames: false,
          drawingParameters: 'compacttight',
        })
        osmdRef.current = osmd
        const r = osmd.EngravingRules
        try { r.PageBackgroundColor = 'transparent' } catch { /* older OSMD */ }
        r.DefaultColorMusic = color
        r.DefaultColorNotehead = color
        r.DefaultColorStem = color
        r.DefaultColorRest = color
        r.DefaultColorLabel = color
        r.StaffLineColor = color
        r.LedgerLineColorDefault = color
        const resp = await fetch(url, { cache: 'no-store' })
        if (!resp.ok) throw new Error(`fetch ${resp.status}`)
        const xml = await resp.text()
        if (cancelled) return
        await osmd.load(xml)
        if (cancelled) return
        osmd.zoom = clampZoom(zoom)
        osmd.render()
        setErr(null)
      } catch (e: any) {
        if (!cancelled) setErr(String(e?.message || e))
      }
    })()
    return () => { cancelled = true }
    // re-mount when the score or color changes
  }, [url, color])

  // zoom-only change → just re-render (no refetch)
  useEffect(() => {
    const osmd = osmdRef.current
    if (!osmd) return
    try { osmd.zoom = clampZoom(zoom); osmd.render() } catch { /* not ready */ }
  }, [zoom])

  if (err) return <div className="p-2 text-xs text-red-400">OSMD error: {err}</div>
  return <div ref={ref} style={{ background: 'transparent' }} />
}

export default function ScoreVerify() {
  const [panes, setPanes] = useState<PaneState[]>(DEFAULT_PANES)
  const [loaded, setLoaded] = useState(false)
  const drag = useRef<{ id: string; mode: 'move' | 'resize'; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number } | null>(null)
  const topZ = useRef(10)

  // load saved layout
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as PaneState[]
        // merge: keep known panes, apply saved geometry, drop unknown
        const byId = new Map(saved.map((p) => [p.id, p]))
        setPanes(DEFAULT_PANES.map((d) => ({ ...d, ...(byId.get(d.id) || {}), id: d.id, kind: d.kind, src: d.src, label: d.label })))
        topZ.current = Math.max(10, ...saved.map((p) => p.z || 1)) + 1
      }
    } catch { /* ignore */ }
    setLoaded(true)
  }, [])

  // persist on change (after first load)
  useEffect(() => {
    if (!loaded) return
    try { localStorage.setItem(LS_KEY, JSON.stringify(panes)) } catch { /* ignore */ }
  }, [panes, loaded])

  const update = useCallback((id: string, patch: Partial<PaneState>) => {
    setPanes((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }, [])

  const bringFront = useCallback((id: string) => {
    topZ.current += 1
    update(id, { z: topZ.current })
  }, [update])

  const onPointerDown = (e: ReactPointerEvent, id: string, mode: 'move' | 'resize') => {
    e.preventDefault()
    e.stopPropagation()
    const p = panes.find((x) => x.id === id)
    if (!p) return
    bringFront(id)
    drag.current = { id, mode, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y, ow: p.w, oh: p.h }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.sx
    const dy = e.clientY - d.sy
    if (d.mode === 'move') update(d.id, { x: Math.round(d.ox + dx), y: Math.round(d.oy + dy) })
    else update(d.id, { w: Math.max(160, Math.round(d.ow + dx)), h: Math.max(120, Math.round(d.oh + dy)) })
  }
  const onPointerUp = () => { drag.current = null }

  const resetLayout = () => {
    setPanes(DEFAULT_PANES.map((p) => ({ ...p })))
    try { localStorage.removeItem(LS_KEY) } catch { /* ignore */ }
    topZ.current = 10
  }

  return (
    <div
      className="relative min-h-screen w-full select-none bg-neutral-200"
      style={{ touchAction: 'none' }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {/* toolbar */}
      <div className="sticky top-0 z-[9999] flex flex-wrap items-center gap-3 border-b border-neutral-400 bg-neutral-900/95 px-4 py-2 text-sm text-neutral-100">
        <span className="font-semibold">Score ⟷ Engraving — note-by-note audit</span>
        <span className="text-neutral-400">drag headers to arrange · drag ⌟ to resize · slide opacity to overlay engraving on the scan</span>
        <button onClick={resetLayout} className="ml-auto rounded border border-neutral-500 px-2 py-0.5 hover:bg-neutral-700">Reset layout</button>
      </div>

      {/* panes */}
      {panes.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-md border border-neutral-500 bg-white shadow-lg"
          style={{ left: p.x, top: p.y, width: p.w, height: p.h, zIndex: p.z, opacity: p.opacity }}
        >
          {/* header / drag handle */}
          <div
            className={`flex cursor-move items-center gap-2 rounded-t-md px-2 py-1 text-xs font-medium text-white ${p.kind === 'scan' ? 'bg-neutral-700' : ''}`}
            style={p.kind === 'engraving' ? { background: p.color } : undefined}
            onPointerDown={(e) => onPointerDown(e, p.id, 'move')}
          >
            <span className="truncate">{p.label}</span>
            <div className="ml-auto flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
              <button title="zoom out" onClick={() => update(p.id, { zoom: clampZoom(p.zoom - 0.1) })} className="rounded bg-black/25 px-1">−</button>
              <span className="w-8 text-center tabular-nums">{Math.round(p.zoom * 100)}%</span>
              <button title="zoom in" onClick={() => update(p.id, { zoom: clampZoom(p.zoom + 0.1) })} className="rounded bg-black/25 px-1">+</button>
              <input
                title="opacity"
                type="range" min={0.2} max={1} step={0.05} value={p.opacity}
                onChange={(e) => update(p.id, { opacity: Number(e.target.value) })}
                className="w-16"
              />
              <button title="bring to front" onClick={() => bringFront(p.id)} className="rounded bg-black/25 px-1">⬆</button>
            </div>
          </div>

          {/* body */}
          <div className="absolute inset-0 top-[26px] overflow-auto rounded-b-md bg-white">
            {p.kind === 'scan' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.src} alt={p.label} draggable={false} style={{ width: `${p.zoom * 100}%`, maxWidth: 'none', display: 'block' }} />
            ) : (
              <div className="p-1">
                <EngravingBody url={p.src} color={p.color} zoom={p.zoom} />
              </div>
            )}
          </div>

          {/* resize handle */}
          <div
            onPointerDown={(e) => onPointerDown(e, p.id, 'resize')}
            className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize text-neutral-500"
            style={{ lineHeight: '14px', textAlign: 'right', paddingRight: 2 }}
          >⌟</div>
        </div>
      ))}

      <div className="pointer-events-none absolute bottom-2 left-2 z-[9999] rounded bg-black/70 px-2 py-1 text-[11px] text-neutral-300">
        Lead + Baritone only have musicxml today · Tenor/Bass need extraction before they can be panes
      </div>
    </div>
  )
}
