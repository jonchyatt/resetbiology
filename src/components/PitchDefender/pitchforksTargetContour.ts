/**
 * A point in the one-pixel padded coordinate space around an RGBA frame.
 *
 * Source pixels are in `0 <= x < width`, `0 <= y < height`. Contour points
 * may also be on the exterior padding: `x === -1 || x === width` and/or
 * `y === -1 || y === height`.
 */
export interface TargetContourPoint {
  readonly x: number
  readonly y: number
}

/**
 * One contiguous run of alpha-bearing pixels on the frame's lowest occupied
 * row. Endpoints are inclusive and remain in source-frame coordinates.
 */
export interface FootSeamInterval {
  readonly y: number
  readonly xStart: number
  readonly xEnd: number
}

export interface PitchforksTargetContour {
  /** Transparent padded pixels with a four-neighbor alpha-bearing source pixel. */
  readonly contour: readonly TargetContourPoint[]
  /** Inclusive runs on the lowest row containing at least one alpha-bearing pixel. */
  readonly footSeam: readonly FootSeamInterval[]
}

export type RgbaByteArray = Uint8Array | Uint8ClampedArray

const isRgbaByteArray = (value: unknown): value is RgbaByteArray =>
  value instanceof Uint8Array || value instanceof Uint8ClampedArray

const assertDimension = (name: string, value: number): void => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer`)
  }
}

/**
 * Derive the one-native-pixel target contour and bottom foot seam from an
 * RGBA frame's alpha channel.
 *
 * Alpha greater than zero is treated as occupied. Contour candidates are
 * scanned in padded row-major order and are included only when the candidate
 * itself is transparent/outside the frame and one of its four (not diagonal)
 * neighbors is occupied. This intentionally outlines transparent internal
 * holes as well as the outside silhouette when a hole touches an occupied
 * pixel by an orthogonal edge; it does not dilate diagonally.
 *
 * The input is read but never changed. No canvas, DOM, timers, scoring, or
 * image-processing dependency is involved, so the result is deterministic
 * and safe to cache for a native-resolution frame.
 */
export function derivePitchforksTargetContour(
  width: number,
  height: number,
  rgba: RgbaByteArray,
): PitchforksTargetContour {
  assertDimension('width', width)
  assertDimension('height', height)

  if (!isRgbaByteArray(rgba)) {
    throw new TypeError('rgba must be a Uint8Array or Uint8ClampedArray')
  }

  const expectedLength = width * height * 4
  if (!Number.isSafeInteger(expectedLength)) {
    throw new RangeError('width and height are too large for an RGBA frame')
  }
  if (rgba.length !== expectedLength) {
    throw new RangeError(`rgba length must equal width * height * 4 (${expectedLength})`)
  }

  const isOccupied = (x: number, y: number): boolean =>
    x >= 0 && x < width && y >= 0 && y < height && rgba[(y * width + x) * 4 + 3] > 0

  const contour: TargetContourPoint[] = []
  for (let y = -1; y <= height; y += 1) {
    for (let x = -1; x <= width; x += 1) {
      if (isOccupied(x, y)) continue
      if (
        isOccupied(x - 1, y) ||
        isOccupied(x + 1, y) ||
        isOccupied(x, y - 1) ||
        isOccupied(x, y + 1)
      ) {
        contour.push({ x, y })
      }
    }
  }

  let bottomY: number | null = null
  for (let y = height - 1; y >= 0 && bottomY === null; y -= 1) {
    for (let x = 0; x < width; x += 1) {
      if (isOccupied(x, y)) {
        bottomY = y
        break
      }
    }
  }

  const footSeam: FootSeamInterval[] = []
  if (bottomY !== null) {
    let runStart: number | null = null
    for (let x = 0; x <= width; x += 1) {
      const occupied = x < width && isOccupied(x, bottomY)
      if (occupied && runStart === null) {
        runStart = x
      } else if (!occupied && runStart !== null) {
        footSeam.push({ y: bottomY, xStart: runStart, xEnd: x - 1 })
        runStart = null
      }
    }
  }

  return { contour, footSeam }
}
