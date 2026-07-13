import {
  ALIEN_H, ALIEN_W, CHARGE_FULL_MS, H, LASER_H, LASER_W,
  PLAYER_W, PLAYER_Y, STARTING_SHIELDS, W, type ViewState,
} from './retroBlasterEngine'
import { drawAtlasSprite, loadSpriteAtlas, type AtlasLoadResult } from './spriteAtlas'

let enemyScoutAtlas: AtlasLoadResult | null = null
if (typeof window !== 'undefined') {
  void loadSpriteAtlas(
    '/sprites/enemy-scout-atlas.json',
    '/sprites/enemy-scout-atlas.png',
  ).then(result => { enemyScoutAtlas = result })
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

export function render(ctx: CanvasRenderingContext2D, viewState: ViewState): void {
  const now = viewState.nowMs
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = '#333'
  for (let i = 0; i < 50; i++) {
    const sx = (i * 97 + 13) % W
    const sy = (i * 53 + 7) % (H - 60)
    ctx.fillRect(sx, sy, 1, 1)
  }

  if (viewState.waveIntroTimer > 0) {
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 24px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`WAVE ${viewState.hud.wave}`, W / 2, H / 2 - 8)
    ctx.fillStyle = '#3FBFB5'
    ctx.font = 'bold 12px monospace'
    const count = viewState.alienCountThisWave
    ctx.fillText(`${count} ${count === 1 ? 'ALIEN' : 'ALIENS'}`, W / 2, H / 2 + 10)
  }

  for (let i = 0; i < viewState.aliens.length; i++) {
    const alien = viewState.aliens[i]
    if (!alien.alive && alien.hitTimer <= 0) continue
    if (alien.hitTimer > 0) {
      const alpha = alien.hitTimer / 0.4
      ctx.globalAlpha = alpha
      const explosionFrame = alien.hitTimer >= 0.2 ? 'explode-a' : 'explode-b'
      const drewAtlas = enemyScoutAtlas?.status === 'ready'
        && drawAtlasSprite(ctx, enemyScoutAtlas.atlas, explosionFrame, alien.x + 1, alien.y, 1)
      if (!drewAtlas) {
        drawSprite(ctx, EXPLOSION_SPRITE, alien.x + 1, alien.y, `hsl(${alien.hue}, 80%, 60%)`, 2)
      }
      ctx.globalAlpha = 1
      continue
    }

    const isActive = i === viewState.spotlightIdx
    const sprite = alien.frame === 0 ? ALIEN_SPRITE_A : ALIEN_SPRITE_B
    // ponytail: R2 has no dive state; R3 can route the validated dive frames once that state exists.
    const bobPhase = Math.sin(now / 200)
    const idleFrame = bobPhase >= 0 ? 'idle-a' : 'idle-b'
    const color = isActive
      ? `hsl(${alien.hue}, 95%, 70%)`
      : `hsl(${alien.hue}, 50%, 40%)`

    if (isActive) {
      const bob = bobPhase * 3
      const scale = 2.4
      const offsetX = (ALIEN_W * 0.2) / 2
      const offsetY = (ALIEN_H * 0.2) / 2
      const pulse = Math.sin(now / 150) * 0.3 + 0.6
      ctx.fillStyle = `hsla(${alien.hue}, 90%, 55%, ${pulse * 0.25})`
      ctx.fillRect(alien.x - 8, alien.y - 8 + bob, ALIEN_W + 16, ALIEN_H + 16)
      const drewAtlas = enemyScoutAtlas?.status === 'ready'
        && drawAtlasSprite(
          ctx, enemyScoutAtlas.atlas, idleFrame,
          alien.x - offsetX - 12, alien.y - offsetY + bob - 9, 1.2,
        )
      if (!drewAtlas) drawSprite(ctx, sprite, alien.x - offsetX, alien.y - offsetY + bob, color, scale)
      ctx.fillStyle = '#ffe34c'
      ctx.font = 'bold 20px monospace'
      ctx.textAlign = 'center'
      const qBob = Math.sin(now / 180) * 2
      ctx.fillText('?', alien.x + ALIEN_W / 2, alien.y - 14 + qBob)
      ctx.strokeStyle = `hsla(${alien.hue}, 90%, 65%, ${pulse})`
      ctx.lineWidth = 2
      ctx.strokeRect(alien.x - 6, alien.y - 6 + bob, ALIEN_W + 12 + offsetX * 2, ALIEN_H + 12 + offsetY * 2)
    } else {
      const drewAtlas = enemyScoutAtlas?.status === 'ready'
        && drawAtlasSprite(ctx, enemyScoutAtlas.atlas, idleFrame, alien.x - 12, alien.y - 9, 1)
      if (!drewAtlas) drawSprite(ctx, sprite, alien.x, alien.y, color, 2)
      ctx.fillStyle = `hsla(${alien.hue}, 50%, 55%, 0.6)`
      ctx.font = 'bold 9px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(alien.note.replace(/\d/, ''), alien.x + ALIEN_W / 2, alien.y - 3)
    }
  }

  for (const laser of viewState.lasers) {
    if (!laser.active) continue
    const col = laser.hits ? `hsl(${laser.hue}, 95%, 70%)` : '#ff5555'
    const glow = laser.hits ? `hsla(${laser.hue}, 95%, 80%, 0.4)` : 'rgba(255,80,80,0.4)'
    ctx.fillStyle = col
    ctx.fillRect(laser.x - 1, laser.y, LASER_W, LASER_H)
    ctx.fillStyle = glow
    ctx.fillRect(laser.x - 2, laser.y - 1, LASER_W + 2, LASER_H + 2)
  }

  for (const p of viewState.particles) {
    const alpha = Math.max(0, p.life * 2)
    ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${alpha})`
    ctx.fillRect(Math.floor(p.x), Math.floor(p.y), 3, 3)
  }

  const chargeProgress = viewState.charge.fraction * CHARGE_FULL_MS
  if (viewState.inputMode === 'mic' && chargeProgress > CHARGE_FULL_MS * 0.7) {
    const chargePct = chargeProgress / CHARGE_FULL_MS
    const glowAlpha = (chargePct - 0.7) / 0.3
    ctx.fillStyle = `rgba(74,222,128,${glowAlpha * 0.35})`
    ctx.fillRect(viewState.playerX - 6, PLAYER_Y - 6, 12, 6)
    const pulse = 0.5 + Math.sin(now / 80) * 0.3
    ctx.fillStyle = `rgba(74,222,128,${glowAlpha * pulse})`
    ctx.fillRect(viewState.playerX - 3, PLAYER_Y - 4, 6, 4)
  }
  drawSprite(ctx, PLAYER_SPRITE, viewState.playerX - PLAYER_W / 2, PLAYER_Y, '#3FBFB5', 2)

  ctx.fillStyle = 'rgba(0,0,0,0.7)'
  ctx.fillRect(0, 0, W, 24)
  ctx.strokeStyle = '#222'
  ctx.lineWidth = 1
  ctx.strokeRect(0, 0, W, 24)
  ctx.fillStyle = '#aaa'
  ctx.font = 'bold 14px monospace'
  ctx.textAlign = 'left'
  ctx.fillText(`SCORE ${viewState.hud.score}`, 8, 16)
  ctx.textAlign = 'right'
  ctx.fillText(`WAVE ${viewState.hud.wave}`, W - 8, 16)
  if (viewState.hud.combo >= 3) {
    ctx.fillStyle = viewState.hud.combo >= 10 ? '#ff6090' : '#ffc83c'
    ctx.textAlign = 'center'
    ctx.font = 'bold 14px monospace'
    ctx.fillText(`${viewState.hud.combo}x COMBO`, W / 2, 16)
  }

  ctx.fillStyle = '#888'
  ctx.font = 'bold 9px monospace'
  ctx.textAlign = 'left'
  ctx.fillText('SHIELDS', 8, 36)
  for (let h = 0; h < STARTING_SHIELDS; h++) {
    ctx.fillStyle = h < viewState.hud.shields ? '#3FBFB5' : '#222'
    ctx.fillRect(64 + h * 16, 28, 12, 8)
    ctx.strokeStyle = '#3FBFB5'
    ctx.lineWidth = 0.5
    ctx.strokeRect(64 + h * 16, 28, 12, 8)
  }

  if (viewState.wrongMessage && viewState.wrongTimer > 0) {
    const fade = Math.min(1, viewState.wrongTimer / 0.5)
    ctx.fillStyle = `rgba(0,0,0,${0.7 * fade})`
    ctx.fillRect(0, H / 2 - 24, W, 40)
    ctx.fillStyle = `rgba(255,80,80,${fade})`
    ctx.font = 'bold 14px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(viewState.wrongMessage, W / 2, H / 2 + 4)
  }

  if (viewState.flashTimer > 0) {
    ctx.fillStyle = `rgba(255,0,0,${(viewState.flashTimer / 0.4) * 0.3})`
    ctx.fillRect(0, 0, W, H)
  }

  const unlocked = viewState.noteButtons
  const btnGap = 4
  const maxBtnW = 50
  const availW = W - 16
  const btnW = Math.min(maxBtnW, Math.floor((availW - (unlocked.length - 1) * btnGap) / unlocked.length))
  const btnH = 22
  const totalBtnW = unlocked.length * btnW + (unlocked.length - 1) * btnGap
  const btnStartX = Math.floor((W - totalBtnW) / 2)
  const btnY = H - 30

  for (let i = 0; i < unlocked.length; i++) {
    const { note, hue, active, keyNum } = unlocked[i]
    const bx = btnStartX + i * (btnW + btnGap)
    ctx.fillStyle = `hsl(${hue}, 50%, ${active ? 35 : 22}%)`
    ctx.fillRect(bx, btnY, btnW, btnH)
    ctx.strokeStyle = `hsl(${hue}, 80%, 65%)`
    ctx.lineWidth = active ? 2 : 1
    ctx.strokeRect(bx, btnY, btnW, btnH)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 11px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(note.replace(/\d/, ''), bx + btnW / 2, btnY + 12)
    ctx.fillStyle = '#888'
    ctx.font = 'bold 7px monospace'
    ctx.fillText(`[${keyNum}]`, bx + btnW / 2, btnY + 20)
  }
}
