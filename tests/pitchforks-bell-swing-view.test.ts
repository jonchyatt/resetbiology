import assert from 'node:assert/strict'
import {
  drawPitchforksBellSwing, pitchforksBellSwingAngle,
  PITCHFORKS_BELL_ANCHOR, PITCHFORKS_BELL_SWING_MS,
} from '../src/components/PitchDefender/pitchforksBellSwingView'

const bell = { complete: true, naturalWidth: 15, naturalHeight: 18 } as HTMLImageElement
const backdrop = { ...bell } as HTMLImageElement
const calls: unknown[][] = []
const ctx = {
  imageSmoothingEnabled: true,
  save() { calls.push(['save', this.imageSmoothingEnabled]) },
  restore() { this.imageSmoothingEnabled = true; calls.push(['restore']) },
  drawImage(...args: unknown[]) { calls.push(['image', ...args]) },
  translate(...args: number[]) { calls.push(['translate', ...args]) },
  rotate(angle: number) { calls.push(['rotate', angle]) },
} as unknown as CanvasRenderingContext2D

assert.equal(pitchforksBellSwingAngle(0, false), 0)
assert.equal(pitchforksBellSwingAngle(PITCHFORKS_BELL_SWING_MS, false), 0)
for (let t = 0; t <= 2400; t += 5) {
  assert.ok(Math.abs(pitchforksBellSwingAngle(t, false)) <= 12 * Math.PI / 180)
  assert.equal(pitchforksBellSwingAngle(t, true), 0)
}
assert.ok(pitchforksBellSwingAngle(160, false) > 0)
assert.ok(pitchforksBellSwingAngle(480, false) < 0)
for (const invalid of [NaN, Infinity, -1]) assert.equal(pitchforksBellSwingAngle(invalid, false), 0)

drawPitchforksBellSwing(ctx, { active: true, elapsedMs: 160, reducedMotion: false, bell, backdrop })
assert.deepEqual(calls[1], ['image', backdrop, 252, 24, 45, 54])
assert.deepEqual(calls[2], ['translate', 273, 24])
assert.deepEqual(calls[4], ['image', bell, -21, 0, 45, 54])
assert.deepEqual(calls.at(-1), ['restore'])
assert.equal(ctx.imageSmoothingEnabled, true)
assert.equal(PITCHFORKS_BELL_ANCHOR.waveX, 274.5)
assert.equal(PITCHFORKS_BELL_ANCHOR.waveY, 61.5)

calls.length = 0
drawPitchforksBellSwing(ctx, {
  active: false, elapsedMs: 0, reducedMotion: false, bell, backdrop, renderResting: true,
})
assert.deepEqual(calls[1], ['image', backdrop, 252, 24, 45, 54])
assert.deepEqual(calls[3], ['rotate', 0])
assert.deepEqual(calls[4], ['image', bell, -21, 0, 45, 54])
assert.deepEqual(calls.at(-1), ['restore'])

calls.length = 0
drawPitchforksBellSwing(ctx, {
  active: true, elapsedMs: PITCHFORKS_BELL_SWING_MS, reducedMotion: false, bell, backdrop,
  renderResting: true,
})
assert.deepEqual(calls[3], ['rotate', 0])
assert.deepEqual(calls[4], ['image', bell, -21, 0, 45, 54])
assert.deepEqual(calls.at(-1), ['restore'])

calls.length = 0
const frozenRestingInput = Object.freeze({
  active: false, elapsedMs: PITCHFORKS_BELL_SWING_MS + 1, reducedMotion: true, bell, backdrop,
  renderResting: true,
})
const frozenRestingSnapshot = { ...frozenRestingInput }
drawPitchforksBellSwing(ctx, frozenRestingInput)
assert.deepEqual(calls[3], ['rotate', 0])
assert.deepEqual(calls.at(-1), ['restore'])
assert.deepEqual(frozenRestingInput, frozenRestingSnapshot)
assert.equal(ctx.imageSmoothingEnabled, true)

calls.length = 0
for (const input of [
  { active: false, elapsedMs: 160, reducedMotion: false, bell, backdrop },
  { active: true, elapsedMs: NaN, reducedMotion: false, bell, backdrop },
  { active: true, elapsedMs: 2400, reducedMotion: false, bell, backdrop },
  { active: true, elapsedMs: 160, reducedMotion: false, bell },
  { active: true, elapsedMs: 160, reducedMotion: false, bell: { ...bell, naturalWidth: 0 } as HTMLImageElement, backdrop },
  { active: true, elapsedMs: 160, reducedMotion: false, bell, backdrop: { ...backdrop, naturalHeight: 0 } as HTMLImageElement },
  { active: true, elapsedMs: 160, reducedMotion: false, bell: { ...bell, complete: false } as HTMLImageElement, backdrop },
  { active: false, elapsedMs: 0, reducedMotion: false, bell, backdrop: { ...backdrop, complete: false } as HTMLImageElement, renderResting: true },
]) drawPitchforksBellSwing(ctx, input)
assert.equal(calls.length, 0, 'Missing/broken images preserve the already-painted original plate')

const throwing = { ...ctx, drawImage() { throw new Error('paint failed') } } as CanvasRenderingContext2D
assert.throws(() => drawPitchforksBellSwing(throwing, { active: true, elapsedMs: 160, reducedMotion: false, bell, backdrop }))
assert.deepEqual(calls.at(-1), ['restore'])
console.log('Pitchforks Bell swing: bounded motion, measured geometry, reduced motion, load fallback and restore PASS (harness only)')
