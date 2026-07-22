/**
 * Canvas kit (W0.3) — shared drawing + path math for vision engines.
 * Extracted/upgraded from GuidedExercise v1 (Gabor renderer) with:
 *  - DPR-correct full-bleed canvas sizing
 *  - Gabor patch CACHING (v1 rebuilt an ImageData per patch per frame — expensive)
 *  - Parametric paths with tangent angles for orientation-following stimuli
 * Plan: docs/plans/vision-training-interactive-overhaul.md §Tier 0
 */

export type Point = { x: number; y: number }

const fittedCanvasDpr = new WeakMap<HTMLCanvasElement, number>()

/** Size a canvas to its CSS box at devicePixelRatio; returns logical (CSS) size. */
export function fitCanvasToElement(canvas: HTMLCanvasElement): { width: number; height: number; dpr: number } {
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio
  if (!Number.isFinite(dpr) || dpr <= 0) throw new RangeError('devicePixelRatio must be finite and positive')

  const rect = canvas.getBoundingClientRect()
  const width = rect.width
  const height = rect.height
  const backingWidth = Math.round(width * dpr)
  const backingHeight = Math.round(height * dpr)
  const dprChanged = fittedCanvasDpr.get(canvas) !== dpr

  // A DPR change must reset the backing store even where rounding leaves the
  // integer dimensions unchanged. No CSS dimensions are touched here.
  if (dprChanged || canvas.width !== backingWidth || canvas.height !== backingHeight) {
    canvas.width = backingWidth
    canvas.height = backingHeight
  }
  fittedCanvasDpr.set(canvas, dpr)

  const ctx = canvas.getContext('2d')
  if (ctx) ctx.setTransform(backingWidth / width, 0, 0, backingHeight / height, 0, 0)
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
  /** Logical-pixel Gaussian sigma. Defaults to one quarter of the patch size. */
  sigma?: number
  /** Raster/compositing identity. Defaults to the receiving context's current mode. */
  compositingMode?: GlobalCompositeOperation
  /** degrees */
  phase?: number
  /** Animation-only cache bucket. Threshold stimuli leave this unset for exact phase identity. */
  phaseQuantizationDegrees?: number
}

const gaborCache = new Map<string, HTMLCanvasElement>()
const GABOR_CACHE_MAX = 64

type ResolvedGaborOpts = {
  size: number
  orientation: number
  frequency: number
  contrast: number
  sigma: number
  compositingMode: GlobalCompositeOperation
  phase: number
}

type GaborRaster = ResolvedGaborOpts & {
  backingWidth: number
  backingHeight: number
  rasterScaleX: number
  rasterScaleY: number
}

/** Keep animation reuse explicit; threshold calls retain their requested phase exactly. */
export function normalizeGaborPhase(phase: number, phaseQuantizationDegrees?: number): number {
  if (!Number.isFinite(phaseQuantizationDegrees) || phaseQuantizationDegrees === undefined || phaseQuantizationDegrees <= 0) return phase
  return Math.round(phase / phaseQuantizationDegrees) * phaseQuantizationDegrees
}

function gaborKey(o: GaborRaster): string {
  // Therapeutic values remain exact by default. The animation caller opts in
  // to phase normalization before this key and the raster are both created.
  return JSON.stringify([
    o.size,
    o.backingWidth,
    o.backingHeight,
    o.rasterScaleX,
    o.rasterScaleY,
    o.orientation,
    o.frequency,
    o.contrast,
    o.sigma,
    o.compositingMode,
    o.phase,
  ])
}

function renderGaborTile(o: GaborRaster): HTMLCanvasElement {
  const tile = document.createElement('canvas')
  tile.width = o.backingWidth
  tile.height = o.backingHeight
  const tctx = tile.getContext('2d')!
  const imageData = tctx.createImageData(o.backingWidth, o.backingHeight)
  const data = imageData.data

  const half = o.size / 2
  const theta = (o.orientation * Math.PI) / 180
  const cosT = Math.cos(theta)
  const sinT = Math.sin(theta)
  const phaseRad = (o.phase * Math.PI) / 180
  const freq = (2 * Math.PI * o.frequency) / o.size
  const bg = 128

  for (let py = 0; py < o.backingHeight; py++) {
    for (let px = 0; px < o.backingWidth; px++) {
      const xc = px / o.rasterScaleX - half
      const yc = py / o.rasterScaleY - half
      const xp = xc * cosT + yc * sinT
      const gaussian = Math.exp(-(xc * xc + yc * yc) / (2 * o.sigma * o.sigma))
      const value = gaussian * Math.cos(freq * xp + phaseRad) * o.contrast
      const pixel = Math.max(0, Math.min(255, Math.round(bg + value * 127)))
      const idx = (py * o.backingWidth + px) * 4
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

function releaseGaborTile(tile: HTMLCanvasElement): void {
  tile.width = 0
  tile.height = 0
}

/** Focused-test seam: cache ownership remains private in production code. */
export function __resetGaborCacheForTest(): void {
  for (const tile of gaborCache.values()) releaseGaborTile(tile)
  gaborCache.clear()
}

/** Draw a Gabor patch centered at (x, y). Cached across frames. */
export function drawGaborPatch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  opts: GaborOpts,
): void {
  const transform = ctx.getTransform?.()
  const backingScaleX = Math.abs(transform?.a ?? 1) || 1
  const backingScaleY = Math.abs(transform?.d ?? 1) || 1
  const backingWidth = Math.max(1, Math.round(opts.size * backingScaleX))
  const backingHeight = Math.max(1, Math.round(opts.size * backingScaleY))
  const phase = normalizeGaborPhase(opts.phase ?? 0, opts.phaseQuantizationDegrees)
  const o: GaborRaster = {
    size: opts.size,
    orientation: opts.orientation ?? 0,
    frequency: opts.frequency ?? 4,
    contrast: opts.contrast ?? 1,
    sigma: opts.sigma ?? opts.size / 4,
    compositingMode: opts.compositingMode ?? ctx.globalCompositeOperation ?? 'source-over',
    phase,
    backingWidth,
    backingHeight,
    rasterScaleX: backingWidth / opts.size,
    rasterScaleY: backingHeight / opts.size,
  }
  const key = gaborKey(o)
  let tile = gaborCache.get(key)
  if (!tile) {
    tile = renderGaborTile(o)
    if (gaborCache.size >= GABOR_CACHE_MAX) {
      const firstKey = gaborCache.keys().next().value
      if (firstKey !== undefined) {
        const evicted = gaborCache.get(firstKey)
        if (evicted) releaseGaborTile(evicted)
        gaborCache.delete(firstKey)
      }
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
