import { type RainState, type TorchState } from './pitchforksRainEcology'

export type RainViewCanvasContext = Pick<CanvasRenderingContext2D,
  'beginPath' | 'ellipse' | 'fill' | 'lineTo' | 'moveTo' | 'restore' | 'save' | 'stroke'
> & Pick<CanvasRenderingContext2D, 'fillStyle' | 'lineJoin' | 'lineWidth' | 'strokeStyle'> & {
  readonly drawImage?: CanvasRenderingContext2D['drawImage']
}

const COLORS = Object.freeze({
  stone: '#2a2a3a', stoneDark: '#1a1a2a', stoneLight: '#606070', stoneCarve: '#11111d',
  water: 'rgba(154, 239, 255, 0.72)', waterBright: 'rgba(154, 239, 255, 0.98)',
  cloud: 'rgba(32, 45, 66, 0.92)', cloudEdge: 'rgba(78, 112, 139, 0.96)', seam: 'rgba(119, 220, 244, 0.9)',
  wood: '#6b4226', woodEdge: '#a66a38', spent: '#20202c', spentEdge: '#536274',
  flame: '#e8a838', flameCore: '#ffc83c', steam: 'rgba(180, 195, 230, 0.6)',
})

const RAIN_STREAKS: readonly (readonly [x: number, seed: number, length: number])[] = [
  [318, 8, 13], [342, 73, 17], [371, 32, 11], [398, 126, 15], [427, 52, 12],
  [455, 186, 16], [482, 95, 11], [511, 224, 17], [540, 18, 13], [568, 144, 15],
  [597, 81, 12], [626, 204, 16], [654, 46, 13], [678, 168, 11],
]
// Short, separated drops travel through the measured cloud-alpha/gutter gap
// (y=20..39). They are drawn behind both masks, so neither endpoint becomes a
// beam or a new gameplay path.
const RAIN_FEED_STREAKS: readonly (readonly [x: number, seed: number, length: number])[] = [
  [484, 3, 5], [495, 29, 4], [507, 67, 6], [520, 101, 5],
  [532, 143, 4], [544, 181, 6], [556, 227, 5], [565, 263, 4],
]
const RAIN_FEED_TOP_Y = 20
const RAIN_FEED_LIP_Y = 39
const GARGOYLES = [
  { x: 401, y: 64, mouthX: 401, mouthY: 81 }, { x: 591, y: 64, mouthX: 591, mouthY: 81 },
] as const
type RainPhase = RainState['phase']
type TorchPhase = TorchState['phase']
type RainStateWithClock = RainState & { readonly clockMs?: unknown }

function isRainPhase(value: unknown): value is RainPhase {
  return ['charging', 'ready', 'gutter_fill', 'gargoyle_release', 'raining', 'cooldown'].includes(value as string)
}
function isTorchPhase(value: unknown): value is TorchPhase {
  return ['lit', 'holding', 'steaming', 'wet', 'spent'].includes(value as string)
}
function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
}
function polygon(ctx: RainViewCanvasContext, points: readonly (readonly [number, number])[], fill: string): void {
  ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1])
  for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index][0], points[index][1])
  ctx.fillStyle = fill; ctx.fill()
}
function line(ctx: RainViewCanvasContext, points: readonly (readonly [number, number])[], color: string, width: number): void {
  ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1])
  for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index][0], points[index][1])
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.stroke()
}
function ellipse(ctx: RainViewCanvasContext, x: number, y: number, radiusX: number, radiusY: number, fill: string, outline?: string): void {
  ctx.beginPath(); ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill()
  if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = 2; ctx.stroke() }
}
function rainClockMs(state: RainState): number {
  const candidate = (state as RainStateWithClock).clockMs
  if (typeof candidate === 'number' && Number.isFinite(candidate)) return Math.max(0, candidate)
  const receipts = Array.isArray(state.recentTransitions) ? state.recentTransitions : []
  const last = receipts.at(-1)?.atMs
  return Math.max(0, (typeof last === 'number' && Number.isFinite(last) ? last : 0)
    + (Number.isFinite(state.elapsedMs) ? state.elapsedMs : 0))
}

function drawGargoyle(ctx: RainViewCanvasContext, gargoyle: (typeof GARGOYLES)[number], gargoyleArt?: CanvasImageSource | null): void {
  if (gargoyleArt && typeof ctx.drawImage === 'function') {
    // The 32x24 source is rendered at 2x. Its measured mouth center (15.5, 18.5)
    // stays exactly on the existing world-space mouth anchor.
    ctx.drawImage(gargoyleArt, gargoyle.mouthX - 31, gargoyle.mouthY - 37, 64, 48)
    return
  }
  const { x, y } = gargoyle
  ellipse(ctx, x, y, 27, 20, COLORS.stone, COLORS.stoneLight)
  polygon(ctx, [[x - 22, y - 13], [x - 29, y - 25], [x - 10, y - 18]], COLORS.stoneDark)
  polygon(ctx, [[x + 22, y - 13], [x + 29, y - 25], [x + 10, y - 18]], COLORS.stoneDark)
  line(ctx, [[x - 15, y - 7], [x - 5, y - 10]], COLORS.stoneLight, 2)
  line(ctx, [[x + 5, y - 10], [x + 15, y - 7]], COLORS.stoneLight, 2)
  ellipse(ctx, x - 9, y - 4, 3, 3, COLORS.stoneCarve); ellipse(ctx, x + 9, y - 4, 3, 3, COLORS.stoneCarve)
  line(ctx, [[x - 12, y + 9], [x, y + 13], [x + 12, y + 9]], COLORS.stoneCarve, 3)
}
function drawGutter(ctx: RainViewCanvasContext, fill: number): void {
  polygon(ctx, [[300, 43], [690, 43], [684, 82], [306, 82]], COLORS.stoneDark)
  polygon(ctx, [[300, 39], [690, 39], [690, 49], [300, 49]], COLORS.stone)
  line(ctx, [[300, 39], [690, 39]], COLORS.stoneLight, 3); line(ctx, [[313, 77], [677, 77]], COLORS.stoneLight, 2)
  line(ctx, [[347, 50], [347, 77]], COLORS.stone, 2); line(ctx, [[651, 50], [651, 77]], COLORS.stone, 2)
  if (fill <= 0) return
  const right = 316 + 358 * fill
  polygon(ctx, [[316, 58], [right, 58], [right, 74], [316, 74]], COLORS.water)
  line(ctx, [[316, 58], [right, 58]], COLORS.waterBright, 2)
}
function drawCloud(
  ctx: RainViewCanvasContext,
  phase: RainPhase,
  fill: number,
  rainCloudArt?: CanvasImageSource | null,
): void {
  if (phase !== 'gutter_fill' && phase !== 'gargoyle_release' && phase !== 'raining') return
  if (rainCloudArt && typeof ctx.drawImage === 'function') {
    // The Nano Banana 96x32 source has measured alpha bounds x=4..91, y=6..25.
    // Render at native size so its visible alpha ends at world y=20 above the feed gap.
    ctx.drawImage(rainCloudArt, 476, -6, 96, 32)
    return
  }
  const alpha = phase === 'gutter_fill' ? 0.62 + fill * 0.25 : 0.92
  // Keep the procedural fallback inside the same x=480..567 / y=0..20
  // footprint as the native art, leaving the cloud-to-gutter feed readable.
  ellipse(ctx, 493, 14, 13, 6, `rgba(32, 45, 66, ${alpha.toFixed(2)})`, COLORS.cloudEdge)
  ellipse(ctx, 516, 10, 24, 10, COLORS.cloud, COLORS.cloudEdge)
  ellipse(ctx, 546, 14, 21, 6, COLORS.cloud, COLORS.cloudEdge)
  // The low shelf retains the established fallback body anchor at (516,18).
  ellipse(ctx, 516, 18, 25, 2, COLORS.cloud, COLORS.cloudEdge)
  line(ctx, [[480, 19], [567, 19]], COLORS.stoneDark, 4)
  // Quiet seam stays inside the cloud; it never becomes a bolt or target connector.
  line(ctx, [[510, 15], [520, 19], [530, 15], [541, 19]], COLORS.seam, 3)
}
function drawSpouts(ctx: RainViewCanvasContext, phase: RainPhase): void {
  const length = phase === 'raining' ? 52 : 20
  for (const gargoyle of GARGOYLES) {
    line(ctx, [[gargoyle.mouthX, gargoyle.mouthY], [gargoyle.mouthX + 3, gargoyle.mouthY + length]], COLORS.water, 4)
    line(ctx, [[gargoyle.mouthX - 2, gargoyle.mouthY], [gargoyle.mouthX + 3, gargoyle.mouthY + length]], COLORS.waterBright, 1)
  }
}
function drawRain(ctx: RainViewCanvasContext, clockMs: number, reducedMotion: boolean): void {
  const timeStep = reducedMotion ? 0 : Math.floor(clockMs / 40) * 3
  for (const [x, seed, length] of RAIN_STREAKS) {
    const y = 86 + ((seed + timeStep) % 267)
    line(ctx, [[x, y], [x + 1, Math.min(360, y + length)]], COLORS.waterBright, 1)
  }
}
function drawRainFeed(ctx: RainViewCanvasContext, phase: RainPhase, clockMs: number, reducedMotion: boolean): void {
  if (phase !== 'gutter_fill' && phase !== 'gargoyle_release' && phase !== 'raining') return
  const timeStep = reducedMotion ? 0 : Math.floor(clockMs / 40)
  for (const [x, seed, length] of RAIN_FEED_STREAKS) {
    const maxStart = RAIN_FEED_LIP_Y - length
    const startY = RAIN_FEED_TOP_Y + ((seed + timeStep) % (maxStart - RAIN_FEED_TOP_Y + 1))
    line(ctx, [[x, startY], [x + 1, Math.min(RAIN_FEED_LIP_Y, startY + length)]], COLORS.waterBright, 2)
  }
}

export function drawRainArchitecture(
  ctx: RainViewCanvasContext,
  state: RainState,
  reducedMotion: boolean,
  gargoyleArt?: CanvasImageSource | null,
  rainCloudArt?: CanvasImageSource | null,
): void {
  if (!state || typeof state !== 'object' || !isRainPhase(state.phase)) return
  const fill = clamp01(state.fill)
  const activeFill = state.phase === 'gutter_fill' || state.phase === 'gargoyle_release' || state.phase === 'raining' ? fill : 0
  ctx.save()
  try {
    // Feed is deliberately behind the cloud and gutter masks. Native art and
    // the bounded fallback both cover the origins; the lip covers endpoints.
    drawRainFeed(ctx, state.phase, rainClockMs(state), reducedMotion === true)
    drawGutter(ctx, activeFill)
    for (const gargoyle of GARGOYLES) drawGargoyle(ctx, gargoyle, gargoyleArt)
    drawCloud(ctx, state.phase, activeFill, rainCloudArt)
    if (state.phase === 'gargoyle_release' || state.phase === 'raining') drawSpouts(ctx, state.phase)
    if (state.phase === 'raining') drawRain(ctx, rainClockMs(state), reducedMotion === true)
  } finally { ctx.restore() }
}

export function drawVillagerTorch(ctx: RainViewCanvasContext, torch: TorchState, x: number, y: number, reducedMotion: boolean): void {
  if (!torch || typeof torch !== 'object' || !isTorchPhase(torch.phase) || !Number.isFinite(x) || !Number.isFinite(y)) return
  ctx.save()
  try {
    const extinguished = torch.phase === 'wet' || torch.phase === 'spent'
    const shaft = extinguished ? COLORS.spent : COLORS.wood; const edge = extinguished ? COLORS.spentEdge : COLORS.woodEdge
    polygon(ctx, [[x - 3, y + 2], [x + 3, y + 2], [x + 2, y - 26], [x - 2, y - 26]], shaft)
    line(ctx, [[x - 3, y + 2], [x + 3, y + 2]], edge, 2)
    if (torch.phase === 'lit' || torch.phase === 'holding') {
      polygon(ctx, [[x, y - 26], [x - 7, y - 34], [x - 2, y - 47], [x + 5, y - 35]], COLORS.flame)
      polygon(ctx, [[x, y - 29], [x - 3, y - 36], [x + 1, y - 42], [x + 4, y - 35]], COLORS.flameCore)
    } else if (torch.phase === 'steaming') {
      line(ctx, [[x - 2, y - 31], [x - 7, y - 37], [x - 3, y - 43]], COLORS.steam, 2)
      line(ctx, [[x + 3, y - 31], [x + 8, y - 37], [x + 4, y - 44]], COLORS.steam, 2)
    } else line(ctx, [[x - 4, y - 24], [x - 7, y - 18]], COLORS.spentEdge, 2)
    void reducedMotion
  } finally { ctx.restore() }
}
