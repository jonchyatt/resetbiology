import { type PitchforksBossRecitalState } from './pitchforksBossRecital'
import { type WorldId } from './pitchforks3WorldRegistry'
import { drawStormHeart, selectStormHeartState } from './pitchforksStormHeart'
import { selectPitchforksChargePose } from './pitchforksChargePose'

/** The existing boss identities; the view does not create or persist them. */
export type PitchforksBossChamberBossId = 'torchmaster' | 'bellringer' | 'choirmaster'

export type PitchforksBossChamberFrankMeta = Readonly<{
  frame_w: number
  frame_h: number
  frames: number
  rod_tip: Readonly<{ x: number; y: number }>
}>

export type PitchforksBossChamberVillagerMeta = Readonly<{
  frame_w: number
  frame_h: number
  source_frame_w?: number
  source_frame_h?: number
}>

export type PitchforksBossChamberAssets = Readonly<{
  /** Existing sprites and plates supplied by PitchforksIII's loader. */
  frankIdle?: CanvasImageSource
  frankCharge?: CanvasImageSource
  stormHeart?: CanvasImageSource
  bellringerRest?: CanvasImageSource
  torchmasterChamberPlate?: CanvasImageSource
  villageGatePlate?: CanvasImageSource
  bellTowerPlate?: CanvasImageSource
  cathedralPlate?: CanvasImageSource
  /** Compatibility lane for the existing private Bellringer demo. */
  bellringerChamberPlate?: CanvasImageSource
  frankMeta: PitchforksBossChamberFrankMeta
  walkLeft?: Partial<Record<1 | 2 | 3 | 4, CanvasImageSource | undefined>>
  villagerMeta?: Partial<Record<1 | 2 | 3 | 4, PitchforksBossChamberVillagerMeta | undefined>>
}>

/** Recording-friendly subset of Canvas 2D used by this pure renderer. */
export type PitchforksBossChamberCanvasContext = Pick<CanvasRenderingContext2D,
  | 'beginPath'
  | 'drawImage'
  | 'ellipse'
  | 'fill'
  | 'fillRect'
  | 'fillText'
  | 'lineTo'
  | 'moveTo'
  | 'restore'
  | 'save'
  | 'setTransform'
  | 'stroke'
  | 'strokeRect'
> & Pick<CanvasRenderingContext2D,
  | 'fillStyle'
  | 'font'
  | 'imageSmoothingEnabled'
  | 'lineCap'
  | 'lineJoin'
  | 'lineWidth'
  | 'strokeStyle'
  | 'textAlign'
  | 'textBaseline'
> & Partial<Pick<CanvasRenderingContext2D, 'globalAlpha' | 'shadowBlur' | 'shadowColor'>>

export const PITCHFORKS_BOSS_CHAMBER_CANVAS = Object.freeze({ width: 720, height: 405 })

const W = PITCHFORKS_BOSS_CHAMBER_CANVAS.width
const H = PITCHFORKS_BOSS_CHAMBER_CANVAS.height
const FRANK_X = 54
const FRANK_Y = 196
const GROUND_Y = 330
const SPRITE_SCALE = 3
const FRANK_SPRITE_SCALE = 1
const FRANK_CLOUD_X_OFFSET = 26
const FRANK_CLOUD_Y = 88
const CHARGE_LEADER_START = 0.18
const CHARGE_DISCHARGE_START = 0.42

type PlateKey = 'torchmasterChamberPlate' | 'villageGatePlate' | 'bellTowerPlate' | 'cathedralPlate'

type ChamberVisual = Readonly<{
  worldLabel: string
  bossLabel: string
  plateKey: PlateKey
  accent: string
  wash: string
  role: string
}>

const CHAMBER_VISUALS: Readonly<Record<WorldId, ChamberVisual>> = Object.freeze({
  dungeon: {
    worldLabel: 'THE DUNGEON', bossLabel: 'TORCHMASTER', plateKey: 'torchmasterChamberPlate',
    accent: '#f59e0b', wash: 'rgba(117, 54, 20, 0.13)', role: 'FIRE RECITAL',
  },
  'village-gate': {
    worldLabel: 'THE VILLAGE GATE', bossLabel: 'CHOIRMASTER', plateKey: 'villageGatePlate',
    accent: '#f2c572', wash: 'rgba(176, 120, 50, 0.12)', role: 'CHORUS RECITAL',
  },
  'bell-tower': {
    worldLabel: 'THE BELL TOWER', bossLabel: 'BELLRINGER', plateKey: 'bellTowerPlate',
    accent: '#67e8f9', wash: 'rgba(26, 105, 143, 0.14)', role: 'BELL RECITAL',
  },
  cathedral: {
    worldLabel: 'THE CATHEDRAL', bossLabel: 'MAESTRO', plateKey: 'cathedralPlate',
    accent: '#c4b5fd', wash: 'rgba(92, 63, 150, 0.13)', role: 'FINAL STORM',
  },
})

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
}

function worldForBoss(bossId: PitchforksBossChamberBossId): WorldId {
  if (bossId === 'choirmaster') return 'village-gate'
  if (bossId === 'bellringer') return 'bell-tower'
  return 'dungeon'
}

function bossLabelFor(bossId: PitchforksBossChamberBossId, world: WorldId): string {
  return world === 'cathedral'
    ? 'MAESTRO'
    : bossId === 'choirmaster'
      ? 'CHOIRMASTER'
      : bossId === 'bellringer'
        ? 'BELLRINGER'
        : 'TORCHMASTER'
}

function circuitNoise(seed: number, index: number, bucket: number): number {
  const wave = Math.sin(seed * 12.9898 + index * 78.233 + bucket * 37.719) * 43758.5453
  return wave - Math.floor(wave)
}

/** Existing cloud-to-Frank teaching leg, kept local because the parent helper is private. */
function drawChargeCircuit(
  ctx: PitchforksBossChamberCanvasContext,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  reveal: number,
  reducedMotion: boolean,
): void {
  const shown = clamp01(reveal)
  if (shown <= 0) return
  const dx = toX - fromX
  const dy = toY - fromY
  const distance = Math.max(1, Math.hypot(dx, dy))
  const nx = -dy / distance
  const ny = dx / distance
  const segments = Math.max(5, Math.min(14, Math.round(distance / 24)))
  const visibleSegments = Math.max(1, Math.ceil(segments * shown))
  const jitter = reducedMotion ? 0 : Math.min(16, Math.max(7, distance * 0.08))
  const bucket = Math.floor(shown * 20)

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (let pass = 0; pass < 3; pass += 1) {
    let wander = (circuitNoise(71, 0, bucket) - 0.5) * 0.8
    let priorT = 0
    let priorOffset = 0
    ctx.beginPath()
    ctx.moveTo(fromX, fromY)
    for (let index = 1; index <= visibleSegments; index += 1) {
      const spacing = (circuitNoise(100, index, bucket) - 0.5) * 0.7
      const naturalT = clamp01((index + spacing) / segments)
      const minT = priorT + 0.24 / segments
      const maxT = shown - ((visibleSegments - index) * 0.44) / segments
      const t = index === visibleSegments ? shown : Math.max(minT, Math.min(maxT, naturalT))
      const envelope = Math.sin(Math.PI * t)
      wander = Math.max(-1, Math.min(1, wander * 0.22 + (circuitNoise(112, index, bucket) - 0.5) * 1.58))
      const drift = (circuitNoise(90, index, bucket) - 0.5) * 0.24
      const harmonic = Math.sin(index * 1.47 + bucket * 0.31) * 0.3
      const candidateOffset = (wander * 0.95 + harmonic + drift) * jitter * envelope
      const maxOffsetDelta = Math.max(4, (t - priorT) * distance * 0.9)
      const offset = t >= 0.999
        ? 0
        : Math.max(priorOffset - maxOffsetDelta, Math.min(priorOffset + maxOffsetDelta, candidateOffset))
      ctx.lineTo(fromX + dx * t + nx * offset, fromY + dy * t + ny * offset)
      priorT = t
      priorOffset = offset
    }
    if (pass === 0) {
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.28)'
      ctx.lineWidth = 7
    } else if (pass === 1) {
      ctx.strokeStyle = 'rgba(147, 197, 253, 0.62)'
      ctx.lineWidth = 3
    } else {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)'
      ctx.lineWidth = 1
    }
    ctx.stroke()
  }
  ctx.restore()
}

function drawTorchMarker(ctx: PitchforksBossChamberCanvasContext, x: number, y: number, clock: number, reducedMotion: boolean): void {
  const flameShift = reducedMotion ? 0 : Math.sin(clock * 9.2) * 2
  ctx.save()
  ctx.strokeStyle = 'rgba(61, 46, 32, 0.78)'
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x - 10, y + 19)
  ctx.lineTo(x + 7, y + 6)
  ctx.stroke()
  ctx.fillStyle = '#3b2c20'
  ctx.fillRect(x - 14, y + 17, 18, 5)
  ctx.fillStyle = 'rgba(255, 130, 38, 0.8)'
  ctx.beginPath()
  ctx.ellipse(x, y + 2, 7, 12 + flameShift, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255, 230, 128, 0.86)'
  ctx.beginPath()
  ctx.ellipse(x + 1, y + 1, 3.5, 7 + flameShift * 0.45, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawFrank(
  ctx: PitchforksBossChamberCanvasContext,
  assets: PitchforksBossChamberAssets,
  progress: number,
  clock: number,
  reducedMotion: boolean,
  useChargePose: boolean,
): void {
  const meta = assets.frankMeta
  const pose = useChargePose
    ? selectPitchforksChargePose(progress, clock, reducedMotion, !!assets.frankCharge)
    : { pose: 'idle' as const, frame: 0 }
  const image = pose.pose === 'charge' ? assets.frankCharge : assets.frankIdle
  if (!image || !Number.isFinite(meta.frame_w) || !Number.isFinite(meta.frame_h)) return
  const frame = Math.max(0, Math.min(Math.max(0, meta.frames - 1), pose.frame))
  ctx.drawImage(image, frame * meta.frame_w, 0, meta.frame_w, meta.frame_h,
    FRANK_X, FRANK_Y, meta.frame_w * FRANK_SPRITE_SCALE, meta.frame_h * FRANK_SPRITE_SCALE)
}

function drawFrankCharge(
  ctx: PitchforksBossChamberCanvasContext,
  assets: PitchforksBossChamberAssets,
  progress: number,
  reducedMotion: boolean,
): void {
  const shown = clamp01(progress)
  const rodX = FRANK_X + assets.frankMeta.rod_tip.x * FRANK_SPRITE_SCALE
  const rodY = FRANK_Y + assets.frankMeta.rod_tip.y * FRANK_SPRITE_SCALE
  const cloudX = rodX + FRANK_CLOUD_X_OFFSET
  const cloudState = selectStormHeartState({
    listening: shown === 0,
    chargeProgress: shown,
    hasBolt: false,
    spent: false,
  })
  drawStormHeart(ctx, cloudState, cloudX, FRANK_CLOUD_Y, assets.stormHeart)
  if (shown >= CHARGE_LEADER_START) {
    const reveal = clamp01((shown - CHARGE_LEADER_START) / (CHARGE_DISCHARGE_START - CHARGE_LEADER_START))
    drawChargeCircuit(ctx, cloudX, FRANK_CLOUD_Y, rodX, rodY, reveal, reducedMotion)
  }
}

function drawBossActors(
  ctx: PitchforksBossChamberCanvasContext,
  assets: PitchforksBossChamberAssets,
  bossId: PitchforksBossChamberBossId,
  world: WorldId,
  clock: number,
  reducedMotion: boolean,
): void {
  if (world === 'bell-tower' && assets.bellringerRest) {
    ctx.drawImage(assets.bellringerRest, 540, FRANK_Y, 96, 144)
    return
  }
  if (world !== 'dungeon' && world !== 'village-gate') return
  const actor = assets.walkLeft?.[1]
  if (!actor) return
  const meta = assets.villagerMeta?.[1] ?? { frame_w: 16, frame_h: 24 }
  const sourceFrameW = meta.source_frame_w ?? meta.frame_w
  const sourceFrameH = meta.source_frame_h ?? meta.frame_h
  const count = world === 'village-gate' ? 3 : 1
  for (let index = 0; index < count; index += 1) {
    const x = 465 + index * 65
    const y = GROUND_Y - meta.frame_h * SPRITE_SCALE
    ctx.drawImage(actor, 0, 0, sourceFrameW, sourceFrameH,
      x, y, meta.frame_w * SPRITE_SCALE, meta.frame_h * SPRITE_SCALE)
    if (bossId === 'torchmaster' && index === 0) drawTorchMarker(ctx, x + 42, y + 35, clock, reducedMotion)
  }
}

function drawTextBadge(
  ctx: PitchforksBossChamberCanvasContext,
  text: string,
  x: number,
  y: number,
  accent: string,
): void {
  ctx.font = 'bold 10px monospace'
  const width = Math.max(78, text.length * 7 + 18)
  ctx.fillStyle = 'rgba(3, 7, 14, 0.88)'
  ctx.fillRect(x - width / 2, y - 11, width, 20)
  ctx.strokeStyle = accent
  ctx.lineWidth = 1
  ctx.strokeRect(x - width / 2 + 0.5, y - 10.5, width - 1, 19)
  ctx.fillStyle = '#f4f7fb'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y - 1)
}

function drawIdentityAndProgress(
  ctx: PitchforksBossChamberCanvasContext,
  state: PitchforksBossRecitalState,
  visual: ChamberVisual,
  bossName: string,
  progress: number,
): void {
  ctx.fillStyle = 'rgba(5, 10, 18, 0.93)'
  ctx.fillRect(216, 30, 288, 140)
  ctx.strokeStyle = visual.accent
  ctx.lineWidth = 2
  ctx.strokeRect(216.5, 30.5, 287, 139)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = visual.accent
  ctx.font = 'bold 10px monospace'
  ctx.fillText(`${visual.worldLabel} · ${visual.role}`, W / 2, 48)
  ctx.fillStyle = '#f4f7fb'
  ctx.font = 'bold 18px monospace'
  ctx.fillText(`THE ${bossName}`, W / 2, 70)
  ctx.fillStyle = '#c9d6df'
  ctx.font = 'bold 10px monospace'
  ctx.fillText('UNTIMED RECITAL · NO CLOCK', W / 2, 87)

  const complete = state.status === 'complete'
  const noteVisible = state.lane !== 'ear' || state.hinted || complete
  const note = complete ? '✓' : state.lane === 'ear' && !noteVisible ? '?' : state.currentNote ?? '—'
  ctx.fillStyle = complete ? '#8cf2b0' : progress > 0 ? '#8cf2b0' : '#f6d79a'
  ctx.font = 'bold 40px monospace'
  ctx.fillText(note, W / 2, 128)
  ctx.fillStyle = '#c9d6df'
  ctx.font = 'bold 9px monospace'
  ctx.fillText(complete ? 'PASS-OFF COMPLETE' : noteVisible ? 'CURRENT NOTE' : 'LISTEN FOR THE NOTE', W / 2, 143)

  ctx.fillStyle = 'rgba(138, 166, 172, 0.38)'
  ctx.fillRect(248, 151, 224, 7)
  ctx.fillStyle = complete ? '#8cf2b0' : visual.accent
  ctx.fillRect(248, 151, Math.round(224 * progress), 7)
  ctx.fillStyle = '#d8e5e9'
  ctx.font = 'bold 9px monospace'
  const cursor = Math.min(state.sequence.length, Math.max(0, state.cursor + (complete ? 0 : 1)))
  ctx.fillText(`${state.lane === 'voice' ? 'VOICE LOCK' : 'EAR RECOGNITION'} · NOTE ${Math.max(1, cursor)} OF ${Math.max(1, state.sequence.length)}`, W / 2, 168)
}

/**
 * Render one of the four existing world chambers into the caller-owned canvas.
 * This is deliberately a pure view seam: it reads supplied state/assets only,
 * creates no timers, fetches no modules/assets, grades nothing, and persists nothing.
 * The caller's logical clock is the only animation clock, so a paused caller
 * naturally re-renders the same visual truth until it resumes.
 */
export function renderBossChamber(
  ctx: PitchforksBossChamberCanvasContext,
  assets: PitchforksBossChamberAssets,
  state: PitchforksBossRecitalState,
  progressInput: number,
  clock: number,
  reducedMotion: boolean,
  bossId: PitchforksBossChamberBossId = 'torchmaster',
  campaignWorld: WorldId | null = null,
): void {
  if (!ctx || !assets || !state) return
  const progress = clamp01(progressInput)
  const world = campaignWorld ?? worldForBoss(bossId)
  const visual = CHAMBER_VISUALS[world]
  const bossName = bossLabelFor(bossId, world)
  const plate = campaignWorld === null && bossId === 'bellringer'
    ? assets.bellringerChamberPlate
    : assets[visual.plateKey]

  ctx.save()
  try {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = '#070914'
    ctx.fillRect(0, 0, W, H)
    if (plate) ctx.drawImage(plate, 0, 0, W, H)

    // Keep the approved plate visible while giving each world a quiet, readable
    // palette treatment and combat-room framing; no fallback character art.
    ctx.fillStyle = visual.wash
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(2, 5, 11, 0.55)'
    ctx.fillRect(0, H - 62, W, 62)
    ctx.fillStyle = visual.accent
    ctx.fillRect(24, H - 18, W - 48, 2)
    drawTextBadge(ctx, visual.worldLabel, 90, 25, visual.accent)
    drawTextBadge(ctx, `BOSS · ${bossName}`, W - 112, 25, visual.accent)

    drawFrank(ctx, assets, progress, Number.isFinite(clock) ? Math.max(0, clock) : 0, reducedMotion, bossId !== 'bellringer')
    if (bossId !== 'bellringer') drawFrankCharge(ctx, assets, progress, reducedMotion)
    drawBossActors(ctx, assets, bossId, world, Number.isFinite(clock) ? Math.max(0, clock) : 0, reducedMotion)
    if (world === 'village-gate') drawTextBadge(ctx, 'CHOIR', 562, 246, visual.accent)
    if (world === 'bell-tower') drawTextBadge(ctx, 'BELLRINGER', 588, 181, visual.accent)
    if (world === 'cathedral') drawTextBadge(ctx, 'MAESTRO', 588, 246, visual.accent)
    if (world === 'dungeon') drawTextBadge(ctx, 'TORCHMASTER', 489, 246, visual.accent)
    drawIdentityAndProgress(ctx, state, visual, bossName, progress)
  } finally {
    ctx.restore()
  }
}
