import assert from 'node:assert/strict'
import { StableDirectionWords } from '../src/lib/speech/StableDirectionWords'

const stream = new StableDirectionWords()
assert.deepEqual(stream.read(0, 'left', false), [])
assert.deepEqual(stream.read(0, 'left right', false), ['left'])
assert.deepEqual(stream.read(0, 'left right left', false), ['right'])
assert.deepEqual(stream.read(0, 'left right left right up down', true), ['left', 'right', 'up', 'down'])
assert.deepEqual(stream.read(0, 'left right left right up down', true), [], 'repeated final result does not replay commands')

const revision = new StableDirectionWords()
assert.deepEqual(revision.read(0, 'left light', false), [])
assert.deepEqual(revision.read(0, 'left right', false), ['left'], 'the changing last word is not scored')
assert.deepEqual(revision.read(0, 'left right', true), ['right'])
assert.deepEqual(revision.read(1, 'up', true), ['up'], 'a new result segment starts a new sequence')
