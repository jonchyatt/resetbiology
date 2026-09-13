/** Measured original right bell: native 15x18 crop at (84,8), displayed at 3x. */
export const PITCHFORKS_BELL_ANCHOR = Object.freeze({
  cropX: 252, cropY: 24, width: 45, height: 54,
  pivotX: 273, pivotY: 24, localPivotX: 21,
  waveX: 274.5, waveY: 61.5,
})

export const PITCHFORKS_BELL_SWING_MS = 2400

/** Caller supplies the same pause-aware elapsed time used by the release wave. */
export function pitchforksBellSwingAngle(elapsedMs: number, reducedMotion: boolean): number {
  if (reducedMotion || !Number.isFinite(elapsedMs) || elapsedMs < 0
    || elapsedMs >= PITCHFORKS_BELL_SWING_MS) return 0
  // A bounded damped swing preserves the measured attachment point and arch clearance.
  const fade = Math.pow(1 - elapsedMs / PITCHFORKS_BELL_SWING_MS, 2)
  return Math.sin(elapsedMs * Math.PI * 2 / 640) * (12 * Math.PI / 180) * fade
}

export function drawPitchforksBellSwing(
  ctx: CanvasRenderingContext2D,
  input: Readonly<{
    active: boolean
    elapsedMs: number
    reducedMotion: boolean
    bell?: HTMLImageElement
    backdrop?: HTMLImageElement
    renderResting?: boolean
  }>,
): void {
  const validElapsed = Number.isFinite(input.elapsedMs) && input.elapsedMs >= 0
  const activeSwing = input.active && validElapsed && input.elapsedMs < PITCHFORKS_BELL_SWING_MS
  const resting = input.renderResting === true && validElapsed
    && (!input.active || input.elapsedMs >= PITCHFORKS_BELL_SWING_MS)
  if ((!activeSwing && !resting)
    || !input.bell?.complete || input.bell.naturalWidth !== 15 || input.bell.naturalHeight !== 18
    || !input.backdrop?.complete || input.backdrop.naturalWidth !== 15 || input.backdrop.naturalHeight !== 18) return
  const a = PITCHFORKS_BELL_ANCHOR
  ctx.save()
  try {
    ctx.imageSmoothingEnabled = false
    // Erase only the original bell's measured crop before rotating its identical pixels.
    ctx.drawImage(input.backdrop, a.cropX, a.cropY, a.width, a.height)
    ctx.translate(a.pivotX, a.pivotY)
    ctx.rotate(activeSwing ? pitchforksBellSwingAngle(input.elapsedMs, input.reducedMotion) : 0)
    ctx.drawImage(input.bell, -a.localPivotX, 0, a.width, a.height)
  } finally {
    ctx.restore()
  }
}
