import assert from 'node:assert/strict'
import { formatAccuracy } from '../src/lib/formatAccuracy'

assert.equal(formatAccuracy(null), '\u2013')
assert.equal(formatAccuracy(undefined), '\u2013')
assert.equal(formatAccuracy(NaN), '\u2013')
assert.equal(formatAccuracy(0), '0%')
assert.equal(formatAccuracy(86.4), '86%')
console.log('format-accuracy: ok')
