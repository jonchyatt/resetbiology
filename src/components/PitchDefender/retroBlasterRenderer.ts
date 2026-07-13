import {
  ALIEN_H, ALIEN_W, CHARGE_FULL_MS, H, LASER_H, LASER_W,
  noteButtonRects, PLAYER_W, PLAYER_Y, SPACE_SCALE, STARTING_SHIELDS, W,
  type ViewState, type VisualKind,
} from './retroBlasterEngine'
import { drawAtlasSprite, loadSpriteAtlas, type AtlasLoadResult, type SpriteAtlas } from './spriteAtlas'

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
  const bob = isActive ? Math.sin(now / 200) * 3 * s : 0
  let left: number
  let top: number
  let width: number
  let height: number
  if (source === 'procedural') {
    const scale = (isActive ? 2.4 : 2) * s
    left = x - offsetX + scale
    top = y - offsetY + bob
    width = 10 * scale
    height = 9 * scale
  } else {
    const scale = (isActive ? 1.2 : 1) * s
    const rosterKind = source === 'scout-atlas' ? 0 : visualKind
    const frameIndex = Math.sin(now / 200) >= 0 ? 0 : 1
    const [boundX, boundY, boundW, boundH] = ENEMY_ROSTER[rosterKind].idleBounds[frameIndex]
    const atlasX = x - offsetX - 12 * s
    const atlasY = y - offsetY + bob - 9 * s
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

export interface RetroRenderOptions {
  reducedMotion?: boolean
  colorHints?: boolean
}

export function render(
  ctx: CanvasRenderingContext2D,
  viewState: ViewState,
  options: RetroRenderOptions = {},
): void {
  const reducedMotion = options.reducedMotion ?? false
  const colorHints = options.colorHints ?? true
  const now = viewState.nowMs
  const s = SPACE_SCALE
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

  for (let i = 0; i < viewState.aliens.length; i++) {
    const alien = viewState.aliens[i]
    if (!alien.alive && alien.hitTimer <= 0) continue
    const isActive = i === viewState.spotlightIdx
    const existingSource = enemyRenderSources.get(alien.visualId)
    const proposedSource = existingSource ?? chooseEnemyRenderSource(
      alien.visualKind,
      enemyAtlases[alien.visualKind],
      enemyAtlases[0],
    )
    if (!existingSource && !isEnemySourceVisible(
      alien.x, alien.y, alien.visualKind, isActive, now, proposedSource,
    )) continue
    const resolvedAtlas = atlasForAlien(alien.visualId, alien.visualKind)
    const atlas = resolvedAtlas?.atlas ?? null
    if (alien.hitTimer > 0) {
      const alpha = alien.hitTimer / 0.4
      ctx.globalAlpha = alpha
      const explosionFrame = alien.hitTimer >= 0.2 ? 'explode-a' : 'explode-b'
      const drewAtlas = atlas && drawAtlasSprite(ctx, atlas, explosionFrame, alien.x - 12 * s, alien.y - 9 * s, s)
      if (!drewAtlas) {
        const explosionColor = colorHints ? `hsl(${alien.hue}, 80%, 60%)` : '#b8d9e8'
        drawSprite(ctx, EXPLOSION_SPRITE, alien.x + s, alien.y, explosionColor, 2 * s)
      }
      ctx.globalAlpha = 1
      continue
    }

    const sprite = alien.frame === 0 ? ALIEN_SPRITE_A : ALIEN_SPRITE_B
    // ponytail: R2 has no dive state; R3 can route the validated dive frames once that state exists.
    const bobPhase = Math.sin(now / 200)
    const idleFrame = bobPhase >= 0 ? 'idle-a' : 'idle-b'
    const color = colorHints
      ? isActive ? `hsl(${alien.hue}, 95%, 70%)` : `hsl(${alien.hue}, 50%, 40%)`
      : isActive ? '#c7f5ff' : '#61758b'
    const anchor = resolvedAtlas?.anchor ?? ENEMY_ROSTER[alien.visualKind].chipAnchor

    if (isActive) {
      const bob = bobPhase * 3 * s
      const scale = 2.4 * s
      const offsetX = (ALIEN_W * 0.2) / 2
      const offsetY = (ALIEN_H * 0.2) / 2
      const pulse = Math.sin(now / 150) * 0.3 + 0.6
      const atlasX = alien.x - offsetX - 12 * s
      const atlasY = alien.y - offsetY + bob - 9 * s
      const atlasScale = 1.2 * s
      const atlasFocusW = resolvedAtlas?.focusSize[0] ?? 0
      const atlasFocusH = resolvedAtlas?.focusSize[1] ?? 0
      const focusX = atlas ? atlasX + ((48 - atlasFocusW) / 2) * atlasScale : alien.x - offsetX
      const focusY = atlas ? atlasY + (36 - atlasFocusH) * atlasScale : alien.y - offsetY + bob
      const focusW = atlas ? atlasFocusW * atlasScale : ALIEN_W * 1.2
      const focusH = atlas ? atlasFocusH * atlasScale : ALIEN_H * 1.2
      ctx.fillStyle = colorHints
        ? `hsla(${alien.hue}, 90%, 55%, ${pulse * 0.25})`
        : `rgba(121,224,255,${pulse * 0.2})`
      ctx.fillRect(focusX - 4 * s, focusY - 4 * s, focusW + 8 * s, focusH + 8 * s)
      const drewAtlas = atlas && drawAtlasSprite(ctx, atlas, idleFrame, atlasX, atlasY, atlasScale)
      if (!drewAtlas) drawSprite(ctx, sprite, alien.x - offsetX, alien.y - offsetY + bob, color, scale)
      const chipX = drewAtlas ? atlasX + 48 * atlasScale * anchor[0] : alien.x + ALIEN_W / 2
      const chipY = drewAtlas ? atlasY + 36 * atlasScale * anchor[1] : alien.y + ALIEN_H * 0.55 + bob
      drawNoteChip(ctx, chipX, chipY, alien.hue, colorHints, 1.15 * s)
      ctx.fillStyle = '#ffe34c'
      ctx.font = `bold ${Math.round(20 * s)}px monospace`
      ctx.textAlign = 'center'
      const qBob = Math.sin(now / 180) * 2 * s
      ctx.fillText('?', focusX + focusW / 2, focusY - 5 * s + qBob)
      ctx.strokeStyle = colorHints ? `hsla(${alien.hue}, 90%, 65%, ${pulse})` : `rgba(165,235,255,${pulse})`
      ctx.lineWidth = 2 * s
      ctx.strokeRect(focusX - 2 * s, focusY - 2 * s, focusW + 4 * s, focusH + 4 * s)
    } else {
      const atlasX = alien.x - 12 * s
      const atlasY = alien.y - 9 * s
      const drewAtlas = atlas && drawAtlasSprite(ctx, atlas, idleFrame, atlasX, atlasY, s)
      if (!drewAtlas) drawSprite(ctx, sprite, alien.x, alien.y, color, 2 * s)
      const chipX = drewAtlas ? atlasX + 48 * s * anchor[0] : alien.x + ALIEN_W / 2
      const chipY = drewAtlas ? atlasY + 36 * s * anchor[1] : alien.y + ALIEN_H * 0.55
      drawNoteChip(ctx, chipX, chipY, alien.hue, colorHints, s)
      ctx.fillStyle = colorHints ? `hsla(${alien.hue}, 60%, 70%, 0.9)` : 'rgba(221,236,245,0.88)'
      ctx.font = `bold ${Math.round(9 * s)}px monospace`
      ctx.textAlign = 'center'
      ctx.fillText(alien.note.replace(/\d/, ''), alien.x + ALIEN_W / 2, alien.y - 3 * s)
    }
  }

  for (const laser of viewState.lasers) {
    if (!laser.active) continue
    const col = laser.hits ? colorHints ? `hsl(${laser.hue}, 95%, 70%)` : '#c8f5ff' : '#ff5555'
    const glow = laser.hits ? colorHints ? `hsla(${laser.hue}, 95%, 80%, 0.4)` : 'rgba(171,235,255,0.4)' : 'rgba(255,80,80,0.4)'
    ctx.fillStyle = col
    ctx.fillRect(laser.x - s, laser.y, LASER_W, LASER_H)
    ctx.fillStyle = glow
    ctx.fillRect(laser.x - 2 * s, laser.y - s, LASER_W + 2 * s, LASER_H + 2 * s)
  }

  for (const p of viewState.particles) {
    const alpha = Math.max(0, p.life * 2)
    ctx.fillStyle = colorHints ? `hsla(${p.hue}, 80%, 60%, ${alpha})` : `rgba(174,220,237,${alpha})`
    ctx.fillRect(Math.floor(p.x), Math.floor(p.y), 3 * s, 3 * s)
  }

  const chargeProgress = viewState.charge.fraction * CHARGE_FULL_MS
  if (viewState.inputMode === 'mic' && chargeProgress > CHARGE_FULL_MS * 0.7) {
    const chargePct = chargeProgress / CHARGE_FULL_MS
    const glowAlpha = (chargePct - 0.7) / 0.3
    ctx.fillStyle = `rgba(74,222,128,${glowAlpha * 0.35})`
    ctx.fillRect(viewState.playerX - 6 * s, PLAYER_Y - 6 * s, 12 * s, 6 * s)
    const pulse = 0.5 + Math.sin(now / 80) * 0.3
    ctx.fillStyle = `rgba(74,222,128,${glowAlpha * pulse})`
    ctx.fillRect(viewState.playerX - 3 * s, PLAYER_Y - 4 * s, 6 * s, 4 * s)
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
}
