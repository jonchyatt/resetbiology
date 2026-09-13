/**
 * Deterministic Storm Heart cloud primitive.
 *
 * This is deliberately only the cloud layer. The existing renderer remains
 * authoritative for Frankenstein, leader/discharge bolts, target tines, and
 * game state. Every point below is a fixed logical pixel from the accepted
 * thundercloud proof; `coreX`/`coreY` translate that proof anchor as a unit.
 */

export type StormHeartState =
  | 'listen'
  | 'dormant'
  | 'gather-1'
  | 'gather-2'
  | 'gather-3'
  | 'spent'

export type StormHeartStateInput = Readonly<{
  listening: boolean
  chargeProgress: number
  hasBolt: boolean
  spent: boolean
}>

/** The subset of Canvas 2D used by this pure, recording-friendly helper. */
export type StormHeartCanvasContext = Pick<
  CanvasRenderingContext2D,
  | 'beginPath'
  | 'ellipse'
  | 'fill'
  | 'lineTo'
  | 'moveTo'
  | 'restore'
  | 'save'
  | 'stroke'
> & Pick<
  CanvasRenderingContext2D,
  'fillStyle' | 'lineJoin' | 'lineWidth' | 'strokeStyle'
> & Partial<Pick<
  CanvasRenderingContext2D,
  'drawImage' | 'globalAlpha' | 'imageSmoothingEnabled'
>>

export type StormHeartImage = HTMLImageElement | CanvasImageSource

export const STORM_HEART_CORE = Object.freeze({ x: 128, y: 91 })
export const STORM_HEART_SEAM_WIDTH = 4
export const STORM_HEART_CORE_DIAMETER = 14
const STORM_HEART_SPRITE_X = 72
const STORM_HEART_SPRITE_Y = 38
const STORM_HEART_SPRITE_WIDTH = 112
const STORM_HEART_SPRITE_HEIGHT = 64
export const STORM_HEART_GATHER_THRESHOLDS = Object.freeze({
  first: 0,
  second: 0.33,
  third: 0.66,
})

type Point = readonly [x: number, y: number]
type Ellipse = readonly [cx: number, cy: number, radiusX: number, radiusY: number]
type Polyline = readonly Point[]

type CloudBody = Readonly<{
  tufts: readonly Ellipse[]
  body: Ellipse
  fill: string
  outline: string
  undersideY: number
}>

function rgba(red: number, green: number, blue: number, alpha: number): string {
  return `rgba(${red}, ${green}, ${blue}, ${(alpha / 255).toFixed(6)})`
}

function ellipseBounds(
  left: number,
  top: number,
  right: number,
  bottom: number,
): Ellipse {
  return [
    (left + right) / 2,
    (top + bottom) / 2,
    (right - left) / 2,
    (bottom - top) / 2,
  ]
}

const COLORS = Object.freeze({
  dormantFill: rgba(23, 31, 47, 255),
  dormantOutline: rgba(66, 78, 99, 255),
  chargedFill: rgba(32, 45, 66, 255),
  chargedOutline: rgba(78, 112, 139, 255),
  spentFill: rgba(14, 22, 35, 235),
  spentOutline: rgba(55, 68, 89, 245),
  underside: rgba(7, 12, 22, 255),
  rimEarly: rgba(55, 166, 205, 230),
  rimFinal: rgba(92, 218, 245, 255),
  seamShadow: rgba(51, 124, 159, 255),
  seam: rgba(154, 239, 255, 255),
  branch: rgba(119, 220, 244, 255),
  coreHalo: rgba(45, 178, 226, 70),
  core: rgba(211, 250, 255, 255),
  coreOutline: rgba(75, 210, 244, 255),
})

// These are the proof's fixed bounding boxes translated to Canvas ellipse
// center/radius arguments. They stay module-level so a render does not create
// geometry arrays or invent a second animation path.
const DORMANT_TUFTS: readonly Ellipse[] = [
  ellipseBounds(79, 61, 111, 91),
  ellipseBounds(96, 48, 135, 91),
  ellipseBounds(121, 42, 159, 91),
  ellipseBounds(145, 57, 178, 92),
]
const CHARGED_BODY: Ellipse = ellipseBounds(77, 71, 180, 101)
const DORMANT_BODY: CloudBody = {
  tufts: DORMANT_TUFTS,
  body: CHARGED_BODY,
  fill: COLORS.dormantFill,
  outline: COLORS.dormantOutline,
  undersideY: 98,
}
const GATHERING_BODY: CloudBody = {
  tufts: DORMANT_TUFTS,
  body: CHARGED_BODY,
  fill: COLORS.chargedFill,
  outline: COLORS.chargedOutline,
  undersideY: 98,
}
const SPENT_BODY: CloudBody = {
  tufts: [
    ellipseBounds(83, 67, 112, 89),
    ellipseBounds(101, 60, 137, 88),
    ellipseBounds(126, 65, 158, 89),
    ellipseBounds(148, 70, 174, 89),
  ],
  body: ellipseBounds(80, 75, 176, 98),
  fill: COLORS.spentFill,
  outline: COLORS.spentOutline,
  undersideY: 96,
}

const DORMANT_UNDERSIDE: Polyline = [[87, 98], [170, 98]]
const SPENT_UNDERSIDE: Polyline = [[87, 96], [170, 96]]
const GATHERING_RIM: Polyline = [[92, 96], [164, 96]]

const GATHER_ONE_SEAM: Polyline = [
  [121, 58],
  [132, 67],
  [123, 75],
]
const GATHER_TWO_SEAM: Polyline = [
  [121, 58],
  [132, 67],
  [123, 76],
  [133, 82],
]
const GATHER_THREE_SEAM: Polyline = [
  [121, 58],
  [132, 67],
  [123, 76],
  [135, 83],
  [STORM_HEART_CORE.x, STORM_HEART_CORE.y],
]
const GATHER_BRANCH: Polyline = [
  [132, 67],
  [145, 65],
  [140, 75],
]

function isStormHeartState(value: unknown): value is StormHeartState {
  return value === 'listen'
    || value === 'dormant'
    || value === 'gather-1'
    || value === 'gather-2'
    || value === 'gather-3'
    || value === 'spent'
}

/**
 * Select a static cloud state from already-authoritative view inputs.
 *
 * A live positive charge always wins over Spent. An active bolt with no live
 * charge keeps the cloud saturated until the existing bolt lifetime marks it
 * spent; `spent` is ignored without that bolt so malformed combinations cannot
 * create a phantom cloud. Listening is checked first and is always empty.
 */
export function selectStormHeartState(input: StormHeartStateInput): StormHeartState {
  if (typeof input !== 'object' || input === null || typeof input.listening !== 'boolean') {
    return 'dormant'
  }
  if (input.listening) return 'listen'
  if (
    typeof input.hasBolt !== 'boolean'
    || typeof input.spent !== 'boolean'
    || !Number.isFinite(input.chargeProgress)
  ) {
    return 'dormant'
  }

  const chargeProgress = input.chargeProgress
  if (chargeProgress >= STORM_HEART_GATHER_THRESHOLDS.third) return 'gather-3'
  if (chargeProgress >= STORM_HEART_GATHER_THRESHOLDS.second) return 'gather-2'
  if (chargeProgress > STORM_HEART_GATHER_THRESHOLDS.first) return 'gather-1'

  if (input.hasBolt) return input.spent ? 'spent' : 'gather-3'
  return 'dormant'
}

function drawEllipse(
  ctx: StormHeartCanvasContext,
  ellipse: Ellipse,
  offsetX: number,
  offsetY: number,
  fill: string,
  outline: string | null,
  lineWidth: number,
): void {
  drawEllipseAt(
    ctx,
    ellipse[0],
    ellipse[1],
    ellipse[2],
    ellipse[3],
    offsetX,
    offsetY,
    fill,
    outline,
    lineWidth,
  )
}

function drawEllipseAt(
  ctx: StormHeartCanvasContext,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  offsetX: number,
  offsetY: number,
  fill: string,
  outline: string | null,
  lineWidth: number,
): void {
  ctx.beginPath()
  ctx.ellipse(
    centerX + offsetX,
    centerY + offsetY,
    radiusX,
    radiusY,
    0,
    0,
    Math.PI * 2,
  )
  ctx.fillStyle = fill
  ctx.fill()
  if (outline !== null && lineWidth > 0) {
    ctx.strokeStyle = outline
    ctx.lineWidth = lineWidth
    ctx.stroke()
  }
}

function drawPolyline(
  ctx: StormHeartCanvasContext,
  points: Polyline,
  offsetX: number,
  offsetY: number,
  color: string,
  lineWidth: number,
): void {
  ctx.beginPath()
  const first = points[0]
  ctx.moveTo(first[0] + offsetX, first[1] + offsetY)
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]
    ctx.lineTo(point[0] + offsetX, point[1] + offsetY)
  }
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineJoin = 'round'
  ctx.stroke()
}

function drawCloudBody(
  ctx: StormHeartCanvasContext,
  body: CloudBody,
  offsetX: number,
  offsetY: number,
): void {
  for (const tuft of body.tufts) {
    drawEllipse(ctx, tuft, offsetX, offsetY, body.fill, body.outline, 3)
  }
  drawEllipse(ctx, body.body, offsetX, offsetY, body.fill, body.outline, 3)
  drawPolyline(
    ctx,
    body.undersideY === 96 ? SPENT_UNDERSIDE : DORMANT_UNDERSIDE,
    offsetX,
    offsetY,
    COLORS.underside,
    5,
  )
}

function drawStormCore(
  ctx: StormHeartCanvasContext,
  radius: number,
  offsetX: number,
  offsetY: number,
  haloPadding = 4,
): void {
  drawEllipseAt(
    ctx,
    STORM_HEART_CORE.x,
    STORM_HEART_CORE.y,
    radius + haloPadding,
    radius + haloPadding,
    offsetX,
    offsetY,
    COLORS.coreHalo,
    null,
    0,
  )
  drawEllipseAt(
    ctx,
    STORM_HEART_CORE.x,
    STORM_HEART_CORE.y,
    radius,
    radius,
    offsetX,
    offsetY,
    COLORS.core,
    COLORS.coreOutline,
    2,
  )
}

function drawGathering(
  ctx: StormHeartCanvasContext,
  state: Exclude<StormHeartState, 'listen' | 'dormant' | 'spent'>,
  offsetX: number,
  offsetY: number,
  drawRim: boolean,
): void {
  const seam = state === 'gather-1'
    ? GATHER_ONE_SEAM
    : state === 'gather-2'
      ? GATHER_TWO_SEAM
      : GATHER_THREE_SEAM
  const radius = state === 'gather-1' ? 4 : state === 'gather-2' ? 6 : STORM_HEART_CORE_DIAMETER / 2
  const finalStage = state === 'gather-3'
  const contained = !drawRim
  const internalRadius = contained ? Math.max(2, radius * 0.6) : radius
  const seamShadowWidth = contained ? 3 : 8
  const seamWidth = contained ? 1.5 : STORM_HEART_SEAM_WIDTH
  const branchWidth = contained ? 2 : 3
  const drawInternal = () => {
    drawPolyline(ctx, seam, offsetX, offsetY, COLORS.seamShadow, seamShadowWidth)
    drawPolyline(ctx, seam, offsetX, offsetY, COLORS.seam, seamWidth)
    if (state !== 'gather-1') {
      drawPolyline(ctx, GATHER_BRANCH, offsetX, offsetY, COLORS.branch, branchWidth)
    }
    drawStormCore(ctx, internalRadius, offsetX, offsetY, contained ? 2 : 4)
  }

  if (drawRim) {
    drawPolyline(
      ctx,
      GATHERING_RIM,
      offsetX,
      offsetY,
      finalStage ? COLORS.rimFinal : COLORS.rimEarly,
      4,
    )
  }
  const callerAlpha = typeof ctx.globalAlpha === 'number' ? ctx.globalAlpha : undefined
  if (contained && callerAlpha !== undefined) {
    ctx.globalAlpha = callerAlpha * 0.42
    try {
      drawInternal()
    } finally {
      ctx.globalAlpha = callerAlpha
    }
  } else {
    drawInternal()
  }
}

function drawStormHeartSprite(
  ctx: StormHeartCanvasContext,
  image: StormHeartImage | undefined,
  offsetX: number,
  offsetY: number,
): boolean {
  if (!image || typeof ctx.drawImage !== 'function') return false
  try {
    if (typeof ctx.imageSmoothingEnabled === 'boolean') ctx.imageSmoothingEnabled = false
    ctx.drawImage(
      image,
      offsetX + STORM_HEART_SPRITE_X,
      offsetY + STORM_HEART_SPRITE_Y,
      STORM_HEART_SPRITE_WIDTH,
      STORM_HEART_SPRITE_HEIGHT,
    )
    return true
  } catch {
    // A not-yet-decodable image is still an optional asset. Keep the procedural
    // loading fallback instead of breaking rendering.
    return false
  }
}

/**
 * Draw only the fixed-envelope Storm Heart cloud at the supplied core anchor.
 * Listen, invalid coordinates, and unknown runtime states are true no-ops.
 */
export function drawStormHeart(
  ctx: StormHeartCanvasContext,
  state: StormHeartState,
  coreX: number,
  coreY: number,
  image?: StormHeartImage,
): void {
  if (
    state === 'listen'
    || !isStormHeartState(state)
    || !Number.isFinite(coreX)
    || !Number.isFinite(coreY)
  ) {
    return
  }

  const offsetX = coreX - STORM_HEART_CORE.x
  const offsetY = coreY - STORM_HEART_CORE.y
  const callerAlpha = typeof ctx.globalAlpha === 'number' ? ctx.globalAlpha : undefined
  ctx.save()
  try {
    if (state === 'spent' && callerAlpha !== undefined) ctx.globalAlpha = callerAlpha * 0.62
    const spriteDrawn = drawStormHeartSprite(ctx, image, offsetX, offsetY)
    const body = state === 'spent'
      ? SPENT_BODY
      : state === 'dormant'
        ? DORMANT_BODY
        : GATHERING_BODY
    if (!spriteDrawn) drawCloudBody(ctx, body, offsetX, offsetY)
    if (state === 'gather-1' || state === 'gather-2' || state === 'gather-3') {
      drawGathering(ctx, state, offsetX, offsetY, !spriteDrawn)
    }
  } finally {
    if (callerAlpha !== undefined) ctx.globalAlpha = callerAlpha
    ctx.restore()
  }
}
