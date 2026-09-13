import assert from 'node:assert/strict'
import { schedulePitchforksBellRing, PITCHFORKS_BELL_RING_MS } from '../src/components/PitchDefender/pitchforksBellAudio'

const oscillators: any[] = []
const gains: any[] = []
const param = () => ({
  events: [] as unknown[][],
  setValueAtTime(...args: number[]) { this.events.push(['set', ...args]) },
  linearRampToValueAtTime(...args: number[]) { this.events.push(['linear', ...args]) },
  exponentialRampToValueAtTime(...args: number[]) { this.events.push(['exponential', ...args]) },
})
const ctx = {
  currentTime: 10, sampleRate: 48000, state: 'running',
  createOscillator() {
    const node = { frequency: param(), type: '', onended: null as (() => void) | null,
      startAt: -1, stopAt: -1, disconnected: false,
      connect() {}, disconnect() { this.disconnected = true },
      start(time: number) { this.startAt = time }, stop(time: number) { this.stopAt = time } }
    oscillators.push(node); return node
  },
  createGain() {
    const node = { gain: param(), disconnected: false,
      connect() {}, disconnect() { this.disconnected = true } }
    gains.push(node); return node
  },
} as unknown as AudioContext
schedulePitchforksBellRing(ctx, {} as AudioNode, 440)
assert.equal(oscillators.length, 4)
assert.deepEqual(oscillators[0].frequency.events, [['set', 440, 10]])
for (let i = 0; i < oscillators.length; i++) {
  assert.equal(oscillators[i].startAt, 10)
  assert.equal(oscillators[i].stopAt, 10 + PITCHFORKS_BELL_RING_MS / 1000)
  assert.deepEqual(gains[i].gain.events.at(-1), ['linear', 0, 11.2])
  oscillators[i].onended()
  assert.equal(oscillators[i].disconnected && gains[i].disconnected, true)
}
for (const frequency of [NaN, Infinity, -1, 0]) schedulePitchforksBellRing(ctx, {} as AudioNode, frequency)
assert.equal(oscillators.length, 4)
schedulePitchforksBellRing({ ...ctx, state: 'closed' } as AudioContext, {} as AudioNode, 440)
assert.equal(oscillators.length, 4)
schedulePitchforksBellRing({ ...ctx, currentTime: NaN } as AudioContext, {} as AudioNode, 440)
assert.equal(oscillators.length, 4)
schedulePitchforksBellRing(ctx, {} as AudioNode, 24000)
assert.equal(oscillators.length, 4, 'Nyquist and higher partials are omitted')
schedulePitchforksBellRing(ctx, {} as AudioNode, 12000)
assert.equal(oscillators.length, 5, 'Only the sub-Nyquist fundamental remains')
oscillators[4].onended()
assert.equal(oscillators[4].disconnected && gains[4].disconnected, true)
console.log('Bell audio schedule: partials, finite duration, silence endpoint, cleanup and invalid inputs PASS (harness only; timbre/echo not accepted)')
