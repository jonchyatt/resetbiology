/**
 * Deterministic Bell sound-wave presentation.
 *
 * The caller owns activation, clocking, radius, and progress. This helper is
 * only the warm brass/gold canvas layer; it does not create time, contacts,
 * physics, or gameplay state.
 */
export type PitchforksBellWaveViewInput = Readonly<{
  active: boolean
  originX: number
  originY: number
  radius: number
  progress: number
  reducedMotion: boolean
}>

export type PitchforksBellWaveCanvasContext = Pick<
  CanvasRenderingContext2D,
  'arc' | 'beginPath' | 'restore' | 'save' | 'stroke'
> & Pick<CanvasRenderingContext2D, 'lineWidth' | 'strokeStyle'> & Partial<
  Pick<CanvasRenderingContext2D, 'globalAlpha'>
>

const TWO_PI = Math.PI * 2
const COLORS = Object.freeze({
  trailFar: 'rgba(196, 137, 49, 0.34)',
  trailNear: 'rgba(232, 175, 73, 0.58)',
  leading: 'rgba(255, 215, 125, 0.98)',
})

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isValidInput(value: unknown): value is PitchforksBellWaveViewInput {
  if (!isRecord(value)) return false
  return value.active === true
    && typeof value.originX === 'number'
    && Number.isFinite(value.originX)
    && value.originX >= 0
    && typeof value.originY === 'number'
    && Number.isFinite(value.originY)
    && value.originY >= 0
    && typeof value.radius === 'number'
    && Number.isFinite(value.radius)
    && value.radius >= 0
    && typeof value.progress === 'number'
    && Number.isFinite(value.progress)
    && value.progress >= 0
    && typeof value.reducedMotion === 'boolean'
}

function drawRing(
  ctx: PitchforksBellWaveCanvasContext,
  originX: number,
  originY: number,
  radius: number,
  color: string,
  lineWidth: number,
  alpha: number | undefined,
): void {
  ctx.beginPath()
  ctx.arc(originX, originY, radius, 0, TWO_PI)
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  if (alpha !== undefined) ctx.globalAlpha = alpha
  ctx.stroke()
}

/**
 * Draw the current Bell wave front and, when motion is allowed, two quiet
 * trailing rings. The final/strongest stroke is always exactly `input.radius`.
 */
export function drawPitchforksBellWave(
  ctx: PitchforksBellWaveCanvasContext,
  input: PitchforksBellWaveViewInput,
): void {
  if (
    !ctx
    || typeof ctx.save !== 'function'
    || typeof ctx.restore !== 'function'
    || typeof ctx.beginPath !== 'function'
    || typeof ctx.arc !== 'function'
    || typeof ctx.stroke !== 'function'
    || !isValidInput(input)
  ) return

  const progress = Math.min(1, input.progress)
  const callerAlpha = typeof ctx.globalAlpha === 'number' && Number.isFinite(ctx.globalAlpha)
    ? ctx.globalAlpha
    : undefined

  ctx.save()
  try {
    if (!input.reducedMotion) {
      drawRing(
        ctx,
        input.originX,
        input.originY,
        input.radius * (0.5 + progress * 0.12),
        COLORS.trailFar,
        1,
        callerAlpha === undefined ? undefined : callerAlpha * (0.34 + progress * 0.08),
      )
      drawRing(
        ctx,
        input.originX,
        input.originY,
        input.radius * (0.72 + progress * 0.12),
        COLORS.trailNear,
        2,
        callerAlpha === undefined ? undefined : callerAlpha * (0.52 + progress * 0.12),
      )
    }

    drawRing(
      ctx,
      input.originX,
      input.originY,
      input.radius,
      COLORS.leading,
      3,
      callerAlpha === undefined ? undefined : callerAlpha * (0.88 + progress * 0.1),
    )
  } finally {
    if (callerAlpha !== undefined) ctx.globalAlpha = callerAlpha
    ctx.restore()
  }
}
