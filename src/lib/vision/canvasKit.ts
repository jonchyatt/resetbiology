/**
 * Canvas kit (W0.3) — shared drawing + path math for vision engines.
 * Extracted/upgraded from GuidedExercise v1 (Gabor renderer) with:
 *  - DPR-correct full-bleed canvas sizing
 *  - Gabor patch CACHING (v1 rebuilt an ImageData per patch per frame — expensive)
 *  - Parametric paths with tangent angles for orientation-following stimuli
 * Plan: docs/plans/vision-training-interactive-overhaul.md §Tier 0
 */

export type Point = { x: number; y: number }

/** Size a canvas to its CSS box at devicePixelRatio; returns logical (CSS) size. */
export function fitCanvasToElement(canvas: HTMLCanvasElement): { width: number; height: number; dpr: number } {
  const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1
  const rect = canvas.getBoundingClientRect()
  const width = Math.max(1, Math.round(rect.width))
  const height = Math.max(1, Math.round(rect.height))
  if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
    canvas.width = width * dpr
    canvas.height = height * dpr
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  return { width, height, dpr }
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
}

// ---------------------------------------------------------------------------
// Gabor patch rendering (scientifically-shaped stimulus, cached)
// ---------------------------------------------------------------------------

export type GaborOpts = {
  size: number
  /** degrees */
  orientation?: number
  /** cycles across the patch */
  frequency?: number
  /** 0-1 */
  contrast?: number
  /** degrees */
  phase?: number
}

const gaborCache = new Map<string, HTMLCanvasElement>()
const GABOR_CACHE_MAX = 64

function gaborKey(o: Required<GaborOpts>): string {
  // Quantize continuous params so animation frames share cache entries
  return [
    Math.round(o.size),
    Math.round(o.orientation / 5) * 5,
    Math.round(o.frequency),
    Math.round(o.contrast * 20) / 20,
    Math.round(o.phase / 20) * 20,
  ].join('|')
}

function renderGaborTile(o: Required<GaborOpts>): HTMLCanvasElement {
  const size = Math.max(4, Math.round(o.size))
  const tile = document.createElement('canvas')
  tile.width = size
  tile.height = size
  const tctx = tile.getContext('2d')!
  const imageData = tctx.createImageData(size, size)
  const data = imageData.data

  const sigma = size / 4
  const half = size / 2
  const theta = (o.orientation * Math.PI) / 180
  const cosT = Math.cos(theta)
  const sinT = Math.sin(theta)
  const phaseRad = (o.phase * Math.PI) / 180
  const freq = (2 * Math.PI * o.frequency) / size
  const bg = 128

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const xc = px - half
      const yc = py - half
      const xp = xc * cosT + yc * sinT
      const gaussian = Math.exp(-(xc * xc + yc * yc) / (2 * sigma * sigma))
      const value = gaussian * Math.cos(freq * xp + phaseRad) * o.contrast
      const pixel = Math.max(0, Math.min(255, Math.round(bg + value * 127)))
      const idx = (py * size + px) * 4
      data[idx] = pixel
      data[idx + 1] = pixel
      data[idx + 2] = pixel
      // Alpha follows the gaussian so the patch blends into ANY background
      data[idx + 3] = Math.round(gaussian * 255)
    }
  }
  tctx.putImageData(imageData, 0, 0)
  return tile
}

/** Draw a Gabor patch centered at (x, y). Cached across frames. */
export function drawGaborPatch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  opts: GaborOpts,
): void {
  const o: Required<GaborOpts> = {
    size: opts.size,
    orientation: opts.orientation ?? 0,
    frequency: opts.frequency ?? 4,
    contrast: opts.contrast ?? 1,
    phase: opts.phase ?? 0,
  }
  const key = gaborKey(o)
  let tile = gaborCache.get(key)
  if (!tile) {
    tile = renderGaborTile(o)
    if (gaborCache.size >= GABOR_CACHE_MAX) {
      const firstKey = gaborCache.keys().next().value
      if (firstKey !== undefined) gaborCache.delete(firstKey)
    }
    gaborCache.set(key, tile)
  }
  const half = o.size / 2
  ctx.drawImage(tile, x - half, y - half, o.size, o.size)
}

/** Soft teal glow ring, used to highlight the active stimulus. */
export function drawGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  alpha = 0.15,
): void {
  const g = ctx.createRadialGradient(x, y, radius * 0.7, x, y, radius * 1.3)
  g.addColorStop(0, 'transparent')
  g.addColorStop(1, `rgba(63, 191, 181, ${alpha})`)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, radius * 1.3, 0, Math.PI * 2)
  ctx.fill()
}

/** Small fixation cross at center — "keep your eyes HERE". */
export function drawFixationCross(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size = 8,
  color = 'rgba(255,255,255,0.7)',
): void {
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(cx - size, cy)
  ctx.lineTo(cx + size, cy)
  ctx.moveTo(cx, cy - size)
  ctx.lineTo(cx, cy + size)
  ctx.stroke()
}

// ---------------------------------------------------------------------------
// Parametric paths (t in [0,1) → point). All centered on (cx, cy).
// ---------------------------------------------------------------------------

/** Lemniscate (infinity symbol). a = half-width, b = half-height. */
export function infinityPoint(t: number, cx: number, cy: number, a: number, b: number): Point {
  const T = t * Math.PI * 2
  const denom = 1 + Math.sin(T) * Math.sin(T)
  return {
    x: cx + (a * Math.cos(T)) / denom,
    y: cy + (b * Math.sin(T) * Math.cos(T)) / denom,
  }
}

/** Rectangle perimeter walk. */
export function rectanglePoint(t: number, cx: number, cy: number, w: number, h: number): Point {
  const perimeter = 2 * (w + h)
  const d = ((t % 1) + 1) % 1 * perimeter
  if (d < w) return { x: cx - w / 2 + d, y: cy - h / 2 }
  if (d < w + h) return { x: cx + w / 2, y: cy - h / 2 + (d - w) }
  if (d < 2 * w + h) return { x: cx + w / 2 - (d - w - h), y: cy + h / 2 }
  return { x: cx - w / 2, y: cy + h / 2 - (d - 2 * w - h) }
}

export function circlePoint(t: number, cx: number, cy: number, r: number): Point {
  const T = t * Math.PI * 2
  return { x: cx + r * Math.cos(T), y: cy + r * Math.sin(T) }
}

/** Horizontal sweep (left↔right), eased sinusoidally — for smooth pursuit lines. */
export function sweepPoint(t: number, cx: number, cy: number, halfWidth: number): Point {
  return { x: cx + Math.sin(t * Math.PI * 2) * halfWidth, y: cy }
}

/** Tangent angle (degrees) of any path fn at t — orient Gabor gratings along motion. */
export function pathTangentAngle(
  pathFn: (t: number) => Point,
  t: number,
  epsilon = 0.005,
): number {
  const p1 = pathFn(t)
  const p2 = pathFn(t + epsilon)
  return (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI
}
