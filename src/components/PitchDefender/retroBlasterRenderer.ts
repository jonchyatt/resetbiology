import {
  ALIEN_H, ALIEN_W, H, LASER_H, LASER_W, MIC_CONFIDENCE_FLOOR, MIC_TOLERANCE_CENTS,
  noteButtonRects, noteClass, PLAYER_W, PLAYER_Y, SPACE_SCALE, STARTING_SHIELDS, W,
  type Alien, type EnginePitch, type InputMode, type ViewState, type VisualKind,
} from './retroBlasterEngine'
import { noteToFreq, octaveFoldedCents } from './pitchMath'
import { drawAtlasSprite, loadSpriteAtlas, type AtlasLoadResult, type SpriteAtlas } from './spriteAtlas'

export const MIC_VFX_STALE_FRAME_GRACE = 3
export const SOUL_WOBBLE_PX = 1
export const SOUL_WOBBLE_RADIANS_PER_SECOND = 1.35
export const SOUL_SLOT_PHASE_RADIANS = 0.73
export const SOUL_CALM_DAMPING = 0.7
export const SOUL_VERTICAL_RATIO = 0.35

export function deriveSoulRenderOffset(
  alien: Pick<Alien, 'formationSlot' | 'soul' | 'entering' | 'alive'>,
  nowMs: number,
  reducedMotion: boolean,
  isActive: boolean,
): { x: number; y: number } {
  if (reducedMotion || isActive || alien.entering || !alien.alive || !alien.soul) return { x: 0, y: 0 }
  const raw = alien.soul.agitation * SOUL_WOBBLE_PX * Math.sin(
    (nowMs / 1000) * SOUL_WOBBLE_RADIANS_PER_SECOND +
      alien.formationSlot * SOUL_SLOT_PHASE_RADIANS,
  )
  const x = raw * (1 - alien.soul.calm * SOUL_CALM_DAMPING)
  return { x, y: x * SOUL_VERTICAL_RATIO }
}

export interface MicLockSignalInput {
  inputMode: InputMode
  isListening: boolean
  isVisible: boolean
  targetNote: string | null
  micSourceHealth: {
    audioContextState: string
    trackReadyState: MediaStreamTrackState | 'unavailable'
    trackMuted: boolean
  }
  hasFreshGeneration: boolean
  pitch: EnginePitch | null
}

export interface WeaponVfxSnapshot {
  charge: null | { attackId: string; alienId: string; fraction: number; hue: number }
  tracer: null | {
    attackId: string
    alienId: string
    laserIndex: number
    flightProgress: number
  }
  hitLockAttackId: string | null
  impactAlienIds: string[]
}

export interface MicVfxFreshnessState {
  lastGeneration: number
  hasObservedMicGeneration: boolean
  staleGameFrames: number
}

export function advanceMicVfxFreshness(
  previous: MicVfxFreshnessState,
  generation: number,
  sourceEligible: boolean,
): { state: MicVfxFreshnessState; hasFreshGeneration: boolean } {
  if (!sourceEligible) {
    return {
      state: {
        lastGeneration: generation,
        hasObservedMicGeneration: false,
        staleGameFrames: 0,
      },
      hasFreshGeneration: false,
    }
  }

  const generationChanged = generation > 0 && generation !== previous.lastGeneration
  const state: MicVfxFreshnessState = generationChanged
    ? {
        lastGeneration: generation,
        hasObservedMicGeneration: true,
        staleGameFrames: 0,
      }
    : {
        lastGeneration: previous.lastGeneration,
        hasObservedMicGeneration: previous.hasObservedMicGeneration,
        staleGameFrames: previous.hasObservedMicGeneration
          ? previous.staleGameFrames + 1
          : previous.staleGameFrames,
      }
  return {
    state,
    hasFreshGeneration: state.hasObservedMicGeneration &&
      state.staleGameFrames <= MIC_VFX_STALE_FRAME_GRACE,
  }
}

export function deriveMicLockSignalActive(input: MicLockSignalInput): boolean {
  const { micSourceHealth, pitch, targetNote } = input
  return input.inputMode === 'mic' &&
    input.isListening &&
    input.isVisible &&
    targetNote !== null &&
    micSourceHealth.audioContextState === 'running' &&
    micSourceHealth.trackReadyState === 'live' &&
    micSourceHealth.trackMuted === false &&
    input.hasFreshGeneration &&
    pitch?.isActive === true &&
    pitch.confidence >= MIC_CONFIDENCE_FLOOR &&
    pitch.frequency > 0 &&
    Math.abs(octaveFoldedCents(pitch.frequency, noteToFreq(targetNote))) <= MIC_TOLERANCE_CENTS
}

export function deriveWeaponVfx(
  viewState: ViewState,
  micLockSignalActive: boolean,
): WeaponVfxSnapshot {
  const attack = viewState.activeAttack
  const activeAlien = attack
    ? viewState.aliens.find(alien => alien.alienId === attack.alienId)
    : undefined
  const chargeTarget = viewState.charge.targetNote
  const charge = micLockSignalActive &&
    viewState.inputMode === 'mic' &&
    viewState.charge.fraction > 0 &&
    chargeTarget !== null &&
    attack?.phase === 'outbound' &&
    attack.outcome === null &&
    activeAlien?.alive === true &&
    activeAlien.alienId === attack.alienId &&
    noteClass(activeAlien.note) === noteClass(chargeTarget)
    ? {
        attackId: attack.attackId,
        alienId: attack.alienId,
        fraction: Math.max(0, Math.min(1, viewState.charge.fraction)),
        hue: activeAlien.hue,
      }
    : null

  const canonicalTracers = viewState.lasers
    .map((laser, laserIndex) => ({ laser, laserIndex }))
    .filter(({ laser }) =>
      laser.active &&
      laser.hits === true &&
      laser.attackId !== null &&
      laser.targetAlienId !== null &&
      attack?.attackId === laser.attackId &&
      attack.alienId === laser.targetAlienId &&
      attack.phase === 'hit-locked' &&
      attack.outcome === 'correct')

  let tracer: WeaponVfxSnapshot['tracer'] = null
  let hitLockAttackId: string | null = null
  if (canonicalTracers.length === 1 && attack) {
    const { laser, laserIndex } = canonicalTracers[0]
    const flightProgress = Math.max(0, Math.min(
      1,
      (PLAYER_Y - laser.y) / Math.max(1, PLAYER_Y - laser.targetY),
    ))
    tracer = {
      attackId: attack.attackId,
      alienId: attack.alienId,
      laserIndex,
      flightProgress,
    }
    if (flightProgress >= 0.55) hitLockAttackId = attack.attackId
  }

  return {
    charge,
    tracer,
    hitLockAttackId,
    impactAlienIds: viewState.aliens
      .filter(alien => !alien.alive && alien.hitTimer > 0)
      .map(alien => alien.alienId),
  }
}

export const ENEMY_ROSTER = [
  {
    id: 'enemy-scout', displayName: 'Signal Scout', chipAnchor: [0.5, 0.5] as [number, number],
    focusSize: [12, 21] as [number, number], idleBounds: [[18, 20, 12, 16], [18, 15, 12, 20]] as const,
  },
  {
    id: 'enemy-twin-interceptor', displayName: 'Twin Interceptor', chipAnchor: [0.5, 0.66] as [number, number],
    focusSize: [27, 22] as [number, number], idleBounds: [[11, 14, 26, 22], [10, 14, 27, 22]] as const,
  },
  {
    id: 'enemy-chord-carrier', displayName: 'Chord Carrier', chipAnchor: [0.5, 0.58] as [number, number],
    focusSize: [25, 36] as [number, number], idleBounds: [[11, 1, 25, 35], [11, 0, 25, 36]] as const,
  },
  {
    id: 'enemy-choir-captain', displayName: 'Choir Captain', chipAnchor: [0.5, 0.48] as [number, number],
    focusSize: [43, 35] as [number, number], idleBounds: [[2, 1, 43, 35], [2, 1, 43, 35]] as const,
  },
] as const

type EnemyAtlasState = AtlasLoadResult | null
export type EnemyRenderSource = 'kind-atlas' | 'scout-atlas' | 'procedural'
const enemyAtlases: EnemyAtlasState[] = ENEMY_ROSTER.map(() => null)
const enemyRenderSources = new Map<string, EnemyRenderSource>()

export function chooseEnemyRenderSource(
  visualKind: VisualKind,
  kindState: EnemyAtlasState,
  scoutState: EnemyAtlasState,
): EnemyRenderSource {
  if (kindState?.status === 'ready') return 'kind-atlas'
  if (visualKind !== 0 && scoutState?.status === 'ready') return 'scout-atlas'
  return 'procedural'
}

export function latchEnemyRenderSource(
  latches: Map<string, EnemyRenderSource>,
  visualId: string,
  visualKind: VisualKind,
  kindState: EnemyAtlasState,
  scoutState: EnemyAtlasState,
): EnemyRenderSource {
  const latched = latches.get(visualId)
  if (latched) return latched
  const source = chooseEnemyRenderSource(visualKind, kindState, scoutState)
  latches.set(visualId, source)
  return source
}

export function resetEnemyRenderLatches(): void {
  enemyRenderSources.clear()
}

export function enemyRenderSourceSnapshot(): Record<string, EnemyRenderSource> {
  return Object.fromEntries(enemyRenderSources)
}

export function isEnemySourceVisible(
  x: number,
  y: number,
  visualKind: VisualKind,
  isActive: boolean,
  now: number,
  source: EnemyRenderSource,
): boolean {
  const s = SPACE_SCALE
  const offsetX = isActive ? (ALIEN_W * 0.2) / 2 : 0
  const offsetY = isActive ? (ALIEN_H * 0.2) / 2 : 0
  let left: number
  let top: number
  let width: number
  let height: number
  if (source === 'procedural') {
    const scale = (isActive ? 2.4 : 2) * s
    left = x - offsetX + scale
    top = y - offsetY
    width = 10 * scale
    height = 9 * scale
  } else {
    const scale = (isActive ? 1.2 : 1) * s
    const rosterKind = source === 'scout-atlas' ? 0 : visualKind
    const frameIndex = Math.sin(now / 200) >= 0 ? 0 : 1
    const [boundX, boundY, boundW, boundH] = ENEMY_ROSTER[rosterKind].idleBounds[frameIndex]
    const atlasX = x - offsetX - 12 * s
    const atlasY = y - offsetY - 9 * s
    left = atlasX + boundX * scale
    top = atlasY + boundY * scale
    width = boundW * scale
    height = boundH * scale
  }
  return left + width >= 0 && left <= W && top + height >= 0 && top <= H
}

type BackdropState =
  | { status: 'loading' }
  | { status: 'ready'; image: HTMLImageElement }
  | { status: 'failed' }

let spaceBackdrop: BackdropState = { status: 'loading' }
if (typeof window !== 'undefined') {
  for (let index = 0; index < ENEMY_ROSTER.length; index++) {
    const { id } = ENEMY_ROSTER[index]
    void loadSpriteAtlas(`/sprites/${id}-atlas.json`, `/sprites/${id}-atlas.png`, index === 0 ? undefined : id)
      .then(result => { enemyAtlases[index] = result })
  }

  const image = new Image()
  image.onload = () => { spaceBackdrop = { status: 'ready', image } }
  image.onerror = () => {
    spaceBackdrop = { status: 'failed' }
    console.error('[Retro Blaster] space backdrop failed to load; using starfield fallback')
  }
  image.src = '/sprites/retro-blaster-space-backdrop-r15a.png'
}

// Pixel sprite data and canvas renderer extracted from RetroBlaster v1.

const ALIEN_SPRITE_A = [
  '....1111....',
  '..11111111..',
  '.1111111111.',
  '.11.1111.11.',
  '.1111111111.',
  '...11..11...',
  '..11.11.11..',
  '.11......11.',
  '....1111....',
]

const ALIEN_SPRITE_B = [
  '....1111....',
  '..11111111..',
  '.1111111111.',
  '.11.1111.11.',
  '.1111111111.',
  '..1..11..1..',
  '.11.1..1.11.',
  '..11....11..',
  '....1111....',
]

const PLAYER_SPRITE = [
  '......11......',
  '.....1111.....',
  '.....1111.....',
  '.111111111111.',
  '11111111111111',
  '11111111111111',
  '.111.1111.111.',
]

const EXPLOSION_SPRITE = [
  '.1...1...1.',
  '..1.111.1..',
  '...11111...',
  '.111.1.111.',
  '1111.1.1111',
  '.111.1.111.',
  '...11111...',
  '..1.111.1..',
  '.1...1...1.',
]

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: string[],
  x: number,
  y: number,
  color: string,
  scale = 2,
) {
  ctx.fillStyle = color
  for (let row = 0; row < sprite.length; row++) {
    for (let col = 0; col < sprite[row].length; col++) {
      if (sprite[row][col] === '1') {
        ctx.fillRect(Math.floor(x + col * scale), Math.floor(y + row * scale), scale, scale)
      }
    }
  }
}

function drawSpace(ctx: CanvasRenderingContext2D, now: number, reducedMotion: boolean): void {
  ctx.fillStyle = '#02000d'
  ctx.fillRect(0, 0, W, H)
  if (spaceBackdrop.status === 'ready') {
    ctx.drawImage(spaceBackdrop.image, 0, 0, W, H)
    ctx.fillStyle = 'rgba(2,0,16,0.28)'
    ctx.fillRect(0, 0, W, H)
  }

  const phase = reducedMotion ? 0 : now
  for (let i = 0; i < 24; i++) {
    const x = (i * 137 + 29) % W
    const y = ((i * 71 + 11 + phase * 0.006) % (H - 64)) + 24
    ctx.fillStyle = i % 5 === 0 ? 'rgba(113,245,255,0.65)' : 'rgba(196,206,255,0.42)'
    ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1)
  }
  for (let i = 0; i < 12; i++) {
    const x = (i * 211 + 47) % W
    const y = ((i * 97 + 31 + phase * 0.018) % (H - 72)) + 24
    ctx.fillStyle = i % 3 === 0 ? 'rgba(255,111,235,0.8)' : 'rgba(226,235,255,0.72)'
    ctx.fillRect(Math.floor(x), Math.floor(y), 2, 2)
  }
}

type ResolvedEnemyAtlas = { atlas: SpriteAtlas, anchor: [number, number], focusSize: [number, number] }

function atlasForAlien(visualId: string, visualKind: VisualKind): ResolvedEnemyAtlas | null {
  const source = latchEnemyRenderSource(
    enemyRenderSources,
    visualId,
    visualKind,
    enemyAtlases[visualKind],
    enemyAtlases[0],
  )
  const state = source === 'kind-atlas'
    ? enemyAtlases[visualKind]
    : source === 'scout-atlas'
      ? enemyAtlases[0]
      : null
  if (state?.status !== 'ready') return null
  const rosterKind = source === 'scout-atlas' ? 0 : visualKind
  return {
    atlas: state.atlas,
    anchor: state.atlas.meta?.chipAnchors[0] ?? ENEMY_ROSTER[rosterKind].chipAnchor,
    focusSize: ENEMY_ROSTER[rosterKind].focusSize,
  }
}

function drawNoteChip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hue: number,
  colorHints: boolean,
  scale: number,
): void {
  const radius = Math.max(2, 2.4 * scale)
  ctx.fillStyle = '#080b16'
  ctx.fillRect(Math.floor(x - radius - 1), Math.floor(y - radius - 1), Math.ceil(radius * 2 + 2), Math.ceil(radius * 2 + 2))
  ctx.fillStyle = colorHints ? `hsl(${hue}, 95%, 68%)` : '#d8e5ef'
  ctx.fillRect(Math.floor(x - radius), Math.floor(y - radius), Math.ceil(radius * 2), Math.ceil(radius * 2))
  ctx.fillStyle = colorHints ? `hsla(${hue}, 100%, 86%, 0.9)` : 'rgba(255,255,255,0.92)'
  ctx.fillRect(Math.floor(x - 1), Math.floor(y - 1), 2, 2)
}

function drawAtlasFacing(
  ctx: CanvasRenderingContext2D,
  atlas: SpriteAtlas,
  frameName: string,
  x: number,
  y: number,
  scale: number,
  side: -1 | 1,
): boolean {
  if (side === 1) return drawAtlasSprite(ctx, atlas, frameName, x, y, scale)
  const frame = atlas.frames[frameName as keyof typeof atlas.frames]
  if (!frame) return false
  ctx.save()
  ctx.translate(x + frame.w * scale, 0)
  ctx.scale(-1, 1)
  const drew = drawAtlasSprite(ctx, atlas, frameName, 0, y, scale)
  ctx.restore()
  return drew
}

function drawInsideBracket(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  scale: number,
): void {
  const inset = 2 * scale
  const leg = 5 * scale
  const left = x + inset
  const right = x + width - inset
  const top = y + inset
  const bottom = y + height - inset
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1, scale)
  ctx.beginPath()
  ctx.moveTo(left, top + leg); ctx.lineTo(left, top); ctx.lineTo(left + leg, top)
  ctx.moveTo(right - leg, top); ctx.lineTo(right, top); ctx.lineTo(right, top + leg)
  ctx.moveTo(right, bottom - leg); ctx.lineTo(right, bottom); ctx.lineTo(right - leg, bottom)
  ctx.moveTo(left + leg, bottom); ctx.lineTo(left, bottom); ctx.lineTo(left, bottom - leg)
  ctx.stroke()
}

function vfxExtent(value: number): number {
  return Math.max(1, Math.round(value))
}

function fillVfxRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  ctx.fillRect(Math.floor(x), Math.floor(y), vfxExtent(width), vfxExtent(height))
}

function drawMicCharge(
  ctx: CanvasRenderingContext2D,
  viewState: ViewState,
  charge: NonNullable<WeaponVfxSnapshot['charge']>,
  reducedMotion: boolean,
  colorHints: boolean,
): void {
  const s = SPACE_SCALE
  const c = Math.max(0, Math.min(1, charge.fraction))
  const motionAlpha = reducedMotion ? 1 : 0.82 + 0.18 * Math.sin(viewState.nowMs / 80)
  const layerColor = (alpha: number) => colorHints
    ? `hsla(${charge.hue}, 92%, 72%, ${alpha})`
    : `rgba(200,245,255,${alpha})`

  const outerWidth = (12 + 18 * c) * s
  ctx.fillStyle = layerColor((0.06 + 0.18 * c) * motionAlpha)
  fillVfxRect(
    ctx,
    viewState.playerX - outerWidth / 2,
    PLAYER_Y - (7 + 2 * c) * s,
    outerWidth,
    (7 + 4 * c) * s,
  )

  const innerWidth = (6 + 10 * c) * s
  ctx.fillStyle = layerColor((0.14 + 0.30 * c) * motionAlpha)
  fillVfxRect(
    ctx,
    viewState.playerX - innerWidth / 2,
    PLAYER_Y - (5 + c) * s,
    innerWidth,
    (4 + 2 * c) * s,
  )

  const railOffset = (3 + 4 * c) * s
  const railLength = (3 + 3 * c) * s
  ctx.fillStyle = layerColor((0.28 + 0.42 * c) * motionAlpha)
  fillVfxRect(ctx, viewState.playerX - railOffset, PLAYER_Y - railLength, s, railLength)
  fillVfxRect(ctx, viewState.playerX + railOffset, PLAYER_Y - railLength, s, railLength)
}

function drawCorrectTracer(
  ctx: CanvasRenderingContext2D,
  viewState: ViewState,
  tracer: NonNullable<WeaponVfxSnapshot['tracer']>,
  reducedMotion: boolean,
  colorHints: boolean,
): void {
  const laser = viewState.lasers[tracer.laserIndex]
  if (!laser?.active) return
  const s = SPACE_SCALE
  const tail = Math.min(24 * s, Math.max(LASER_H, PLAYER_Y - laser.y))
  const tailBottom = Math.min(PLAYER_Y, laser.y + tail)
  const middleAlpha = reducedMotion ? 0.42 : 0.42 + 0.08 * Math.sin(viewState.nowMs / 64)

  ctx.fillStyle = colorHints
    ? `hsla(${laser.hue},95%,78%,0.16)`
    : 'rgba(200,245,255,0.16)'
  fillVfxRect(ctx, laser.x - 3.5 * s, laser.y, 7 * s, tailBottom - laser.y)

  ctx.fillStyle = colorHints
    ? `hsla(${laser.hue},95%,82%,${middleAlpha})`
    : `rgba(200,245,255,${middleAlpha})`
  fillVfxRect(ctx, laser.x - 2 * s, laser.y, 4 * s, 0.72 * tail)

  ctx.fillStyle = colorHints ? `hsl(${laser.hue},95%,70%)` : '#c8f5ff'
  fillVfxRect(ctx, laser.x - s, laser.y, LASER_W, LASER_H)

  ctx.fillStyle = colorHints
    ? `hsla(${laser.hue},98%,86%,0.72)`
    : 'rgba(220,250,255,0.72)'
  fillVfxRect(ctx, laser.x - 2.5 * s, laser.y - 2.5 * s, 5 * s, 5 * s)
}

function drawTightHitLock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  hue: number,
  nowMs: number,
  reducedMotion: boolean,
  colorHints: boolean,
): void {
  const s = SPACE_SCALE
  const inset = 2 * s
  const leg = vfxExtent(5 * s)
  const left = Math.floor(x + inset)
  const top = Math.floor(y + inset)
  const right = Math.floor(x + width - inset)
  const bottom = Math.floor(y + height - inset)
  const alpha = reducedMotion ? 0.84 : 0.76 + 0.16 * Math.sin(nowMs / 70)
  ctx.strokeStyle = colorHints
    ? `hsla(${hue},96%,82%,${alpha})`
    : `rgba(207,244,255,${alpha})`
  ctx.lineWidth = vfxExtent(s)
  ctx.beginPath()
  ctx.moveTo(left, top + leg); ctx.lineTo(left, top); ctx.lineTo(left + leg, top)
  ctx.moveTo(right - leg, bottom); ctx.lineTo(right, bottom); ctx.lineTo(right, bottom - leg)
  ctx.stroke()
}

function drawImpactBloom(
  ctx: CanvasRenderingContext2D,
  alien: ViewState['aliens'][number],
  reducedMotion: boolean,
  colorHints: boolean,
): void {
  const s = SPACE_SCALE
  const progress = Math.max(0, Math.min(1, 1 - alien.hitTimer / 0.4))
  const innerRadius = (reducedMotion ? 11 : 5 + 10 * progress) * s
  const outerRadius = (reducedMotion ? 18 : 9 + 18 * progress) * s
  const innerAlpha = (1 - progress) * 0.68
  const outerAlpha = (1 - progress) * 0.34
  const centerX = alien.x + ALIEN_W / 2
  const centerY = alien.y + ALIEN_H / 2

  ctx.strokeStyle = colorHints
    ? `hsla(${alien.hue},92%,68%,${outerAlpha})`
    : `rgba(174,220,237,${outerAlpha})`
  ctx.lineWidth = vfxExtent(s)
  ctx.strokeRect(
    Math.floor(centerX - outerRadius),
    Math.floor(centerY - outerRadius),
    vfxExtent(2 * outerRadius),
    vfxExtent(2 * outerRadius),
  )

  ctx.strokeStyle = colorHints
    ? `hsla(${alien.hue},96%,82%,${innerAlpha})`
    : `rgba(220,250,255,${innerAlpha})`
  ctx.lineWidth = vfxExtent(2 * s)
  ctx.strokeRect(
    Math.floor(centerX - innerRadius),
    Math.floor(centerY - innerRadius),
    vfxExtent(2 * innerRadius),
    vfxExtent(2 * innerRadius),
  )
}

function drawSoulSignal(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  y: number,
  footprintWidth: number,
  alien: Alien,
  colorHints: boolean,
  scale: number,
): void {
  const litWidth = footprintWidth * (0.25 + alien.soul.agitation * 0.5)
  const alpha = Math.max(
    0.35,
    0.35 + 0.45 * alien.soul.agitation * (1 - alien.soul.calm * SOUL_CALM_DAMPING),
  )
  const left = Math.round(centerX - litWidth / 2)
  const width = Math.max(scale, Math.round(litWidth))
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = colorHints ? `hsl(${alien.hue}, 92%, 82%)` : '#d9f7ff'
  ctx.fillRect(left, Math.round(y), width, Math.max(1, Math.round(scale)))
  if (alien.soul.due) {
    ctx.globalAlpha = Math.max(0.55, alpha)
    ctx.fillRect(left, Math.round(y + 2 * scale), width, Math.max(1, Math.round(scale)))
  }
  ctx.restore()
}

function drawIntroductionCeremony(
  ctx: CanvasRenderingContext2D,
  viewState: ViewState,
  reducedMotion: boolean,
  colorHints: boolean,
): void {
  const ceremony = viewState.introductionCeremony
  if (!ceremony) return

  const s = SPACE_SCALE
  const noteHue = viewState.noteButtons.find(button => button.note === ceremony.note)?.hue ?? 180
  const accent = colorHints ? `hsl(${noteHue}, 88%, 70%)` : '#d9f7ff'
  const accentSoft = colorHints ? `hsla(${noteHue}, 88%, 66%, 0.22)` : 'rgba(217,247,255,0.18)'
  const pulse = reducedMotion ? 1 : 0.88 + Math.sin(ceremony.elapsedMs / 180) * 0.12
  const centerX = W / 2
  const renderedHeight = ctx.canvas.getBoundingClientRect().height || ctx.canvas.clientHeight
  const compact = renderedHeight > 0 && renderedHeight <= 220
  const panelInset = (compact ? 32 : 76) * s
  const panelHeight = compact ? H - 44 * s : H - 84 * s
  const preflightFontPx = compact
    ? Math.ceil(9 * H / renderedHeight)
    : Math.round(9 * s)
  const sourceToCssY = renderedHeight > 0 ? renderedHeight / H : 1
  const notScoredFontPx = Math.max(Math.round(11 * s), Math.ceil(18 / sourceToCssY))

  ctx.save()
  ctx.fillStyle = 'rgba(1,4,12,0.92)'
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = 'rgba(3,12,25,0.96)'
  ctx.strokeStyle = 'rgba(116,238,255,0.72)'
  ctx.lineWidth = 1.5 * s
  ctx.fillRect(panelInset, 42 * s, W - panelInset * 2, panelHeight)
  ctx.strokeRect(panelInset, 42 * s, W - panelInset * 2, panelHeight)

  ctx.fillStyle = '#79f2cf'
  ctx.font = `bold ${preflightFontPx}px monospace`
  ctx.textAlign = 'center'
  ctx.fillText('PRE-FLIGHT', centerX, (compact ? 45 : 72) * s)

  ctx.fillStyle = '#f3fbff'
  ctx.font = `bold ${Math.round(24 * s)}px monospace`
  ctx.fillText('NEW SIGNAL', centerX, (compact ? 65 : 101) * s)

  ctx.globalAlpha = pulse
  ctx.fillStyle = accentSoft
  ctx.fillRect(centerX - 48 * s, (compact ? 74 : 116) * s, 96 * s, (compact ? 34 : 62) * s)
  ctx.strokeStyle = accent
  ctx.lineWidth = 2 * s
  ctx.strokeRect(centerX - 48 * s, (compact ? 74 : 116) * s, 96 * s, (compact ? 34 : 62) * s)
  ctx.fillStyle = accent
  ctx.font = `bold ${Math.round(34 * s)}px monospace`
  ctx.fillText(ceremony.note.replace(/\d/, ''), centerX, (compact ? 101 : 158) * s)
  ctx.globalAlpha = 1

  ctx.strokeStyle = accent
  ctx.lineWidth = 1.5 * s
  ctx.beginPath()
  const barCount = 21
  const waveformY = compact ? 116 : 207
  for (let i = 0; i < barCount; i++) {
    const x = centerX - 116 * s + i * 11.6 * s
    const distance = Math.abs(i - (barCount - 1) / 2)
    const height = (compact
      ? 4 + Math.max(0, 18 - distance * 2)
      : 6 + Math.max(0, 30 - distance * 3.2)) * s
    ctx.moveTo(x, waveformY * s - height / 2)
    ctx.lineTo(x, waveformY * s + height / 2)
  }
  ctx.stroke()

  ctx.fillStyle = '#c8d8e2'
  ctx.font = `bold ${Math.round(10 * s)}px monospace`
  ctx.fillText('REFERENCE INTRODUCTION', centerX, (compact ? 129 : 226) * s)
  ctx.fillStyle = '#d9f7ff'
  ctx.font = `bold ${notScoredFontPx}px "Arial Narrow", Arial, sans-serif`
  ctx.fillText(
    'INTRODUCTION ONLY - NOT SCORED',
    centerX,
    (compact ? 160 : 244) * s,
    W - 60 * s,
  )

  const railWidth = 190 * s
  const progress = Math.max(0, Math.min(1, ceremony.elapsedMs / ceremony.durationMs))
  ctx.fillStyle = 'rgba(130,160,178,0.2)'
  ctx.fillRect(centerX - railWidth / 2, (compact ? 173 : 260) * s, railWidth, 2 * s)
  ctx.fillStyle = accent
  ctx.fillRect(centerX - railWidth / 2, (compact ? 173 : 260) * s, railWidth * progress, 2 * s)
  ctx.restore()
}

export interface RetroRenderOptions {
  reducedMotion?: boolean
  colorHints?: boolean
  micLockSignalActive?: boolean
}

export function render(
  ctx: CanvasRenderingContext2D,
  viewState: ViewState,
  options: RetroRenderOptions = {},
): WeaponVfxSnapshot {
  const reducedMotion = options.reducedMotion ?? false
  const colorHints = options.colorHints ?? true
  const weaponVfx = deriveWeaponVfx(viewState, options.micLockSignalActive ?? false)
  const now = viewState.nowMs
  const s = SPACE_SCALE
  const identityMaskActive = viewState.identityMaskActive
  drawSpace(ctx, now, reducedMotion)

  if (viewState.waveIntroTimer > 0) {
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${Math.round(24 * s)}px monospace`
    ctx.textAlign = 'center'
    ctx.fillText(`WAVE ${viewState.hud.wave}`, W / 2, H / 2 - 8)
    ctx.fillStyle = '#3FBFB5'
    ctx.font = `bold ${Math.round(12 * s)}px monospace`
    const count = viewState.alienCountThisWave
    ctx.fillText(`${count} ${count === 1 ? 'ALIEN' : 'ALIENS'}`, W / 2, H / 2 + 10)
  }

  const activeAlienId = viewState.activeAttack?.alienId ?? null
  const orderedAliens = [...viewState.aliens]
    .sort((left, right) =>
      Number(left.alienId === activeAlienId) - Number(right.alienId === activeAlienId))

  const impactAlienIds = new Set(weaponVfx.impactAlienIds)
  for (const alien of orderedAliens) {
    if (!impactAlienIds.has(alien.alienId)) continue
    const existingSource = enemyRenderSources.get(alien.visualId)
    const proposedSource = existingSource ?? chooseEnemyRenderSource(
      alien.visualKind,
      enemyAtlases[alien.visualKind],
      enemyAtlases[0],
    )
    if (!existingSource && !isEnemySourceVisible(
      alien.x, alien.y, alien.visualKind, false, now, proposedSource,
    )) continue
    const resolvedAtlas = atlasForAlien(alien.visualId, alien.visualKind)
    const atlas = resolvedAtlas?.atlas ?? null
    drawImpactBloom(ctx, alien, reducedMotion, colorHints)
    const alpha = alien.hitTimer / 0.4
    ctx.globalAlpha = alpha
    const explosionFrame = alien.hitTimer >= 0.2 ? 'explode-a' : 'explode-b'
    const drewAtlas = atlas && drawAtlasSprite(
      ctx, atlas, explosionFrame, alien.x - 12 * s, alien.y - 9 * s, s,
    )
    if (!drewAtlas) {
      const explosionColor = colorHints ? `hsl(${alien.hue}, 80%, 60%)` : '#b8d9e8'
      drawSprite(ctx, EXPLOSION_SPRITE, alien.x + s, alien.y, explosionColor, 2 * s)
    }
    ctx.globalAlpha = 1
  }

  for (const particle of viewState.particles) {
    const alpha = Math.max(0, particle.life * 2)
    ctx.fillStyle = colorHints
      ? `hsla(${particle.hue}, 80%, 60%, ${alpha})`
      : `rgba(174,220,237,${alpha})`
    ctx.fillRect(Math.floor(particle.x), Math.floor(particle.y), 3 * s, 3 * s)
  }

  for (const sourceAlien of orderedAliens) {
    if (!sourceAlien.alive) continue
    const attack = viewState.activeAttack?.alienId === sourceAlien.alienId
      ? viewState.activeAttack
      : null
    const isActive = attack !== null
    const soulOffset = identityMaskActive
      ? { x: 0, y: 0 }
      : deriveSoulRenderOffset(sourceAlien, now, reducedMotion, isActive)
    const alien = soulOffset.x === 0 && soulOffset.y === 0
      ? sourceAlien
      : { ...sourceAlien, x: sourceAlien.x + soulOffset.x, y: sourceAlien.y + soulOffset.y }
    const isTelegraph = attack?.phase === 'telegraph' || attack?.phase === 'awaiting-stimulus'
    const isFlightPose = Boolean(attack && (!isTelegraph || reducedMotion))
    const usesFocusScale = Boolean(isTelegraph && !reducedMotion)
    const existingSource = enemyRenderSources.get(alien.visualId)
    const proposedSource = existingSource ?? chooseEnemyRenderSource(
      alien.visualKind,
      enemyAtlases[alien.visualKind],
      enemyAtlases[0],
    )
    if (!existingSource && !isEnemySourceVisible(
      alien.x, alien.y, alien.visualKind, usesFocusScale, now, proposedSource,
    )) continue
    const resolvedAtlas = atlasForAlien(alien.visualId, alien.visualKind)
    const atlas = resolvedAtlas?.atlas ?? null

    const sprite = alien.frame === 0 ? ALIEN_SPRITE_A : ALIEN_SPRITE_B
    const bobPhase = reducedMotion ? 1 : Math.sin(now / 200)
    const idleFrame = bobPhase >= 0 ? 'idle-a' : 'idle-b'
    const color = identityMaskActive
      ? isActive ? '#d7f3f7' : '#71838d'
      : colorHints
      ? isActive ? `hsl(${alien.hue}, 95%, 70%)` : `hsl(${alien.hue}, 50%, 40%)`
      : isActive ? '#c7f5ff' : '#61758b'
    const anchor = resolvedAtlas?.anchor ?? ENEMY_ROSTER[alien.visualKind].chipAnchor

    if (isFlightPose && attack) {
      const frameName = attack.phase === 'returning' ? 'dive-bank' : 'dive-down'
      const atlasX = alien.x - 12 * s
      const atlasY = alien.y - 9 * s
      const drewAtlas = atlas && drawAtlasFacing(
        ctx, atlas, frameName, atlasX, atlasY, s, attack.side,
      )
      if (!drewAtlas) drawSprite(ctx, sprite, alien.x, alien.y, color, 2 * s)
      const chipAnchorX = attack.side === -1 ? 1 - anchor[0] : anchor[0]
      const chipX = drewAtlas ? atlasX + 48 * s * chipAnchorX : alien.x + ALIEN_W / 2
      const chipY = drewAtlas ? atlasY + 36 * s * anchor[1] : alien.y + ALIEN_H * 0.55
      if (!identityMaskActive) drawNoteChip(ctx, chipX, chipY, alien.hue, colorHints, s)
      const footprintX = drewAtlas ? atlasX : alien.x
      const footprintY = drewAtlas ? atlasY : alien.y
      const footprintW = drewAtlas ? 48 * s : ALIEN_W
      const footprintH = drewAtlas ? 36 * s : ALIEN_H
      drawInsideBracket(
        ctx,
        footprintX,
        footprintY,
        footprintW,
        footprintH,
        identityMaskActive
          ? 'rgba(207,244,255,0.94)'
          : colorHints ? `hsla(${alien.hue}, 95%, 72%, 0.92)` : 'rgba(207,244,255,0.94)',
        s,
      )
      if (weaponVfx.hitLockAttackId === attack.attackId) {
        drawTightHitLock(
          ctx,
          footprintX,
          footprintY,
          footprintW,
          footprintH,
          alien.hue,
          now,
          reducedMotion,
          colorHints,
        )
      }
      if (isTelegraph) {
        ctx.fillStyle = identityMaskActive ? '#d7f3f7' : '#ffe34c'
        ctx.font = `bold ${Math.round(16 * s)}px monospace`
        ctx.textAlign = 'center'
        ctx.fillText('?', footprintX + footprintW / 2, footprintY + 14 * s)
      }
    } else if (isActive) {
      const scale = 2.4 * s
      const offsetX = (ALIEN_W * 0.2) / 2
      const offsetY = (ALIEN_H * 0.2) / 2
      const pulse = Math.sin(now / 150) * 0.3 + 0.6
      const atlasX = alien.x - offsetX - 12 * s
      const atlasY = alien.y - offsetY - 9 * s
      const atlasScale = 1.2 * s
      const atlasFocusW = resolvedAtlas?.focusSize[0] ?? 0
      const atlasFocusH = resolvedAtlas?.focusSize[1] ?? 0
      const focusX = atlas ? atlasX + ((48 - atlasFocusW) / 2) * atlasScale : alien.x - offsetX
      const focusY = atlas ? atlasY + (36 - atlasFocusH) * atlasScale : alien.y - offsetY
      const focusW = atlas ? atlasFocusW * atlasScale : ALIEN_W * 1.2
      const focusH = atlas ? atlasFocusH * atlasScale : ALIEN_H * 1.2
      ctx.fillStyle = identityMaskActive
        ? `rgba(121,224,255,${pulse * 0.2})`
        : colorHints
        ? `hsla(${alien.hue}, 90%, 55%, ${pulse * 0.25})`
        : `rgba(121,224,255,${pulse * 0.2})`
      ctx.fillRect(focusX - 4 * s, focusY - 4 * s, focusW + 8 * s, focusH + 8 * s)
      const drewAtlas = atlas && drawAtlasSprite(ctx, atlas, idleFrame, atlasX, atlasY, atlasScale)
      if (!drewAtlas) drawSprite(ctx, sprite, alien.x - offsetX, alien.y - offsetY, color, scale)
      const chipX = drewAtlas ? atlasX + 48 * atlasScale * anchor[0] : alien.x + ALIEN_W / 2
      const chipY = drewAtlas ? atlasY + 36 * atlasScale * anchor[1] : alien.y + ALIEN_H * 0.55
      if (!identityMaskActive) drawNoteChip(ctx, chipX, chipY, alien.hue, colorHints, 1.15 * s)
      ctx.fillStyle = identityMaskActive ? '#d7f3f7' : '#ffe34c'
      ctx.font = `bold ${Math.round(20 * s)}px monospace`
      ctx.textAlign = 'center'
      const qBob = reducedMotion ? 0 : Math.sin(now / 180) * 2 * s
      ctx.fillText('?', focusX + focusW / 2, focusY - 5 * s + qBob)
      ctx.strokeStyle = identityMaskActive
        ? `rgba(165,235,255,${pulse})`
        : colorHints ? `hsla(${alien.hue}, 90%, 65%, ${pulse})` : `rgba(165,235,255,${pulse})`
      ctx.lineWidth = 2 * s
      ctx.strokeRect(focusX - 2 * s, focusY - 2 * s, focusW + 4 * s, focusH + 4 * s)
    } else {
      const atlasX = alien.x - 12 * s
      const atlasY = alien.y - 9 * s
      const drewAtlas = atlas && drawAtlasSprite(ctx, atlas, idleFrame, atlasX, atlasY, s)
      if (!drewAtlas) drawSprite(ctx, sprite, alien.x, alien.y, color, 2 * s)
      const chipX = drewAtlas ? atlasX + 48 * s * anchor[0] : alien.x + ALIEN_W / 2
      const chipY = drewAtlas ? atlasY + 36 * s * anchor[1] : alien.y + ALIEN_H * 0.55
      if (!identityMaskActive) {
        drawNoteChip(ctx, chipX, chipY, alien.hue, colorHints, s)
        ctx.fillStyle = colorHints ? `hsla(${alien.hue}, 60%, 70%, 0.9)` : 'rgba(221,236,245,0.88)'
        ctx.font = `bold ${Math.round(9 * s)}px monospace`
        ctx.textAlign = 'center'
        ctx.fillText(alien.note.replace(/\d/, ''), alien.x + ALIEN_W / 2, alien.y - 3 * s)
      }
      if (!identityMaskActive && !alien.entering && alien.soul) {
        drawSoulSignal(
          ctx,
          chipX,
          alien.y + ALIEN_H - 2 * s,
          ALIEN_W,
          alien,
          colorHints,
          s,
        )
      }
    }
  }

  for (let laserIndex = 0; laserIndex < viewState.lasers.length; laserIndex++) {
    const laser = viewState.lasers[laserIndex]
    if (!laser.active) continue
    if (laser.hits) {
      if (weaponVfx.tracer?.laserIndex === laserIndex) {
        drawCorrectTracer(ctx, viewState, weaponVfx.tracer, reducedMotion, colorHints)
      }
      continue
    }
    ctx.fillStyle = '#ff5555'
    ctx.fillRect(laser.x - s, laser.y, LASER_W, LASER_H)
    ctx.fillStyle = 'rgba(255,80,80,0.4)'
    ctx.fillRect(laser.x - 2 * s, laser.y - s, LASER_W + 2 * s, LASER_H + 2 * s)
  }

  if (weaponVfx.charge) {
    drawMicCharge(ctx, viewState, weaponVfx.charge, reducedMotion, colorHints)
  }
  drawSprite(ctx, PLAYER_SPRITE, viewState.playerX - PLAYER_W / 2, PLAYER_Y, '#3FBFB5', 2 * s)

  ctx.fillStyle = 'rgba(0,0,0,0.7)'
  ctx.fillRect(0, 0, W, 24 * s)
  ctx.strokeStyle = '#222'
  ctx.lineWidth = 1
  ctx.strokeRect(0, 0, W, 24 * s)
  ctx.fillStyle = '#aaa'
  ctx.font = `bold ${Math.round(14 * s)}px monospace`
  ctx.textAlign = 'left'
  ctx.fillText(`SCORE ${viewState.hud.score}`, 8 * s, 16 * s)
  ctx.textAlign = 'right'
  ctx.fillText(`WAVE ${viewState.hud.wave}`, W - 8 * s, 16 * s)
  if (viewState.hud.combo >= 3) {
    ctx.fillStyle = viewState.hud.combo >= 10 ? '#ff6090' : '#ffc83c'
    ctx.textAlign = 'center'
    ctx.font = `bold ${Math.round(14 * s)}px monospace`
    ctx.fillText(`${viewState.hud.combo}x COMBO`, W / 2, 16 * s)
  }

  ctx.fillStyle = '#888'
  ctx.font = `bold ${Math.round(9 * s)}px monospace`
  ctx.textAlign = 'left'
  ctx.fillText('SHIELDS', 8 * s, 36 * s)
  for (let h = 0; h < STARTING_SHIELDS; h++) {
    ctx.fillStyle = h < viewState.hud.shields ? '#3FBFB5' : '#222'
    ctx.fillRect((64 + h * 16) * s, 28 * s, 12 * s, 8 * s)
    ctx.strokeStyle = '#3FBFB5'
    ctx.lineWidth = 0.5
    ctx.strokeRect((64 + h * 16) * s, 28 * s, 12 * s, 8 * s)
  }

  if (viewState.wrongMessage && viewState.wrongTimer > 0) {
    const fade = Math.min(1, viewState.wrongTimer / 0.5)
    ctx.fillStyle = `rgba(0,0,0,${0.7 * fade})`
    ctx.fillRect(0, H / 2 - 24 * s, W, 40 * s)
    ctx.fillStyle = `rgba(255,80,80,${fade})`
    ctx.font = `bold ${Math.round(14 * s)}px monospace`
    ctx.textAlign = 'center'
    ctx.fillText(viewState.wrongMessage, W / 2, H / 2 + 4 * s)
  }

  if (viewState.flashTimer > 0) {
    ctx.fillStyle = `rgba(255,0,0,${(viewState.flashTimer / 0.4) * 0.3})`
    ctx.fillRect(0, 0, W, H)
  }

  const unlocked = viewState.noteButtons
  const buttonRects = noteButtonRects(unlocked.length)

  for (let i = 0; i < unlocked.length; i++) {
    const { note, hue, active, keyNum } = unlocked[i]
    const rect = buttonRects[i]
    ctx.fillStyle = colorHints ? `hsl(${hue}, 50%, ${active ? 35 : 22}%)` : active ? '#274e5e' : '#18212d'
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
    ctx.strokeStyle = colorHints ? `hsl(${hue}, 80%, 65%)` : active ? '#c8f5ff' : '#6f8191'
    ctx.lineWidth = active ? 2 : 1
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${Math.round(11 * s)}px monospace`
    ctx.textAlign = 'center'
    ctx.fillText(note.replace(/\d/, ''), rect.x + rect.width / 2, rect.y + 12 * s)
    ctx.fillStyle = '#888'
    ctx.font = `bold ${Math.round(7 * s)}px monospace`
    ctx.fillText(`[${keyNum}]`, rect.x + rect.width / 2, rect.y + 20 * s)
  }
  drawIntroductionCeremony(ctx, viewState, reducedMotion, colorHints)
  return weaponVfx
}
