import {
  derivePitchforksTargetContour,
  type PitchforksTargetContour,
} from './pitchforksTargetContour'

/**
 * The already-selected walking target's sprite frame and world placement.
 *
 * The caller supplies the current target after its normal body pass. This
 * adapter deliberately has no target-selection, ordering, movement, grading,
 * pitch, or animation responsibilities.
 */
export type PitchforksTargetContourDescriptor = Readonly<{
  image: HTMLImageElement
  sourceX: number
  sourceY: number
  sourceWidth: number
  sourceHeight: number
  destinationX: number
  destinationY: number
  scale: number
}>

type CachedGeometry =
  | Readonly<{ ok: true; geometry: PitchforksTargetContour }>
  | Readonly<{ ok: false }>

const FAILED_GEOMETRY: CachedGeometry = Object.freeze({ ok: false })
const geometryCache = new WeakMap<object, Map<string, CachedGeometry>>()

// Fixed neutral colors keep this presentation independent of correctness or
// pitch state. The seam is deliberately dark so it reads as a quiet footrest.
const CONTOUR_COLOR = '#f1f5f9'
const FOOT_SEAM_COLOR = '#1e293b'

type Frame = Readonly<{
  sourceX: number
  sourceY: number
  sourceWidth: number
  sourceHeight: number
}>

const isObjectLike = (value: unknown): value is object =>
  (typeof value === 'object' && value !== null) || typeof value === 'function'

const isValidFrame = (frame: Frame): boolean =>
  Number.isSafeInteger(frame.sourceX) &&
  frame.sourceX >= 0 &&
  Number.isSafeInteger(frame.sourceY) &&
  frame.sourceY >= 0 &&
  Number.isSafeInteger(frame.sourceWidth) &&
  frame.sourceWidth > 0 &&
  Number.isSafeInteger(frame.sourceHeight) &&
  frame.sourceHeight > 0

const isValidPlacement = (descriptor: PitchforksTargetContourDescriptor): boolean =>
  Number.isFinite(descriptor.destinationX) &&
  Number.isFinite(descriptor.destinationY) &&
  Number.isFinite(descriptor.scale) &&
  descriptor.scale > 0

const frameKey = (frame: Frame): string =>
  [frame.sourceX, frame.sourceY, frame.sourceWidth, frame.sourceHeight].join(':')

function frameFromDescriptor(descriptor: PitchforksTargetContourDescriptor): Frame {
  return {
    sourceX: descriptor.sourceX,
    sourceY: descriptor.sourceY,
    sourceWidth: descriptor.sourceWidth,
    sourceHeight: descriptor.sourceHeight,
  }
}

/**
 * Read a native-resolution frame once and retain its alpha geometry by image
 * and frame rectangle. A temporary canvas is used only on a cache miss; no
 * per-frame image or canvas read occurs after that.
 *
 * This is intentionally SSR-safe. In a server render, or when a browser
 * cannot create/read the temporary canvas or image asset, it returns `null`
 * and remembers that failed frame so repeated render attempts stay quiet.
 */
function readCachedGeometry(
  descriptor: PitchforksTargetContourDescriptor,
): PitchforksTargetContour | null {
  const image = descriptor.image as unknown
  if (!isObjectLike(image)) return null

  const frame = frameFromDescriptor(descriptor)
  const key = frameKey(frame)
  let frames = geometryCache.get(image)
  if (!frames) {
    frames = new Map<string, CachedGeometry>()
    geometryCache.set(image, frames)
  }

  const cached = frames.get(key)
  if (cached) return cached.ok ? cached.geometry : null

  const rememberFailure = (): null => {
    frames?.set(key, FAILED_GEOMETRY)
    return null
  }

  if (!isValidFrame(frame) || typeof document === 'undefined') return rememberFailure()

  try {
    const canvas = document.createElement('canvas')
    canvas.width = frame.sourceWidth
    canvas.height = frame.sourceHeight
    const extractionContext = canvas.getContext('2d')
    if (!extractionContext) return rememberFailure()

    extractionContext.imageSmoothingEnabled = false
    extractionContext.drawImage(
      descriptor.image,
      frame.sourceX,
      frame.sourceY,
      frame.sourceWidth,
      frame.sourceHeight,
      0,
      0,
      frame.sourceWidth,
      frame.sourceHeight,
    )
    const rgba = extractionContext.getImageData(
      0,
      0,
      frame.sourceWidth,
      frame.sourceHeight,
    ).data
    const geometry = derivePitchforksTargetContour(
      frame.sourceWidth,
      frame.sourceHeight,
      rgba,
    )
    frames.set(key, { ok: true, geometry })
    return geometry
  } catch {
    return rememberFailure()
  }
}

type IntegerRectangle = Readonly<{
  x: number
  y: number
  width: number
  height: number
}>

/** Return the nearest-integer destination rectangle for native pixel bounds. */
function destinationRectangle(
  x: number,
  y: number,
  width: number,
  height: number,
  descriptor: PitchforksTargetContourDescriptor,
): IntegerRectangle | null {
  const left = Math.round(descriptor.destinationX + x * descriptor.scale)
  const top = Math.round(descriptor.destinationY + y * descriptor.scale)
  const right = Math.round(descriptor.destinationX + (x + width) * descriptor.scale)
  const bottom = Math.round(descriptor.destinationY + (y + height) * descriptor.scale)
  if (
    !Number.isFinite(left) ||
    !Number.isFinite(top) ||
    !Number.isFinite(right) ||
    !Number.isFinite(bottom) ||
    right <= left ||
    bottom <= top
  ) return null
  return { x: left, y: top, width: right - left, height: bottom - top }
}

/**
 * Draw the supplied active target's cached one-native-pixel contour and
 * bottom seam. The caller owns the full body pass and decides which target is
 * active; this function draws no other entity and changes no gameplay state.
 *
 * The canvas state is restored even if a browser draw operation fails. The
 * boolean reports whether the requested presentation was available; missing
 * DOM/canvas/image access is a quiet `false`, never an SSR exception.
 */
export function drawPitchforksTargetContour(
  ctx: CanvasRenderingContext2D,
  descriptor: PitchforksTargetContourDescriptor,
): boolean {
  try {
    if (!ctx || typeof ctx.save !== 'function' || typeof ctx.restore !== 'function') return false
    if (
      !descriptor ||
      !isObjectLike(descriptor.image) ||
      !isValidPlacement(descriptor)
    ) return false

    const geometry = readCachedGeometry(descriptor)
    if (geometry === null) return false

    ctx.save()
    try {
      ctx.fillStyle = CONTOUR_COLOR
      for (const point of geometry.contour) {
        const rectangle = destinationRectangle(point.x, point.y, 1, 1, descriptor)
        if (rectangle) ctx.fillRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height)
      }

      ctx.fillStyle = FOOT_SEAM_COLOR
      for (const interval of geometry.footSeam) {
        const rectangle = destinationRectangle(
          interval.xStart,
          interval.y + 1,
          interval.xEnd - interval.xStart + 1,
          1,
          descriptor,
        )
        if (rectangle) ctx.fillRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height)
      }
    } finally {
      ctx.restore()
    }
    return true
  } catch {
    return false
  }
}
