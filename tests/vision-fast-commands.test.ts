import assert from 'node:assert/strict'
import { VisionCommandGate } from '../src/lib/speech/FastVisionCommands'

const directions = new VisionCommandGate(new Set(['up', 'down', 'left', 'right']))
const quickCalls = [
  ['right', 0.92], ['right', 0.95], // held right must advance only once
  ['left', 0.89], ['left', 0.94],
  ['up', 0.84], ['up', 0.95], ['down', 0.91], ['down', 0.93], // no quiet wait between words
  ['_background_noise_', 0.97],
  ['down', 0.83], ['down', 0.88], // the same word can be called again after release
] as const
assert.deepEqual(
  quickCalls.map(([word, confidence]) => directions.push(word, confidence)).filter(Boolean),
  ['right', 'left', 'up', 'down', 'down'],
)

const repeats = new VisionCommandGate(new Set(['up']))
assert.equal(repeats.push('up', 0.91), null)
assert.equal(repeats.push('up', 0.91), 'up')
assert.equal(repeats.push('up', 0.45), null) // a weak overlapping frame is not release
assert.equal(repeats.push('up', 0.93), null)
assert.equal(repeats.push('_unknown_', 0.85), null)
assert.equal(repeats.push('up', 0.83), null)
assert.equal(repeats.push('up', 0.88), 'up')
assert.equal(repeats.push('left', 0.98), null) // disallowed labels never fire

const numbers = new VisionCommandGate(new Set(['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight']))
assert.equal(numbers.push('six', 0.77), null)
assert.equal(numbers.push('six', 0.82), null)
assert.equal(numbers.push('six', 0.88), 'six')
assert.equal(numbers.push('seven', 0.80), null)
assert.equal(numbers.push('seven', 0.91), 'seven')

console.log('Vision command gate: quick alternation, hold, release, and numbers passed')
