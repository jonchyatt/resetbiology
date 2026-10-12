import assert from 'node:assert/strict'
import { StableDirectionWords } from '../src/lib/speech/StableDirectionWords'

const stream = new StableDirectionWords()
assert.deepEqual(stream.read(0, 'left', false), ['left'], 'a single live word must not wait for silence or final text')
assert.deepEqual(stream.read(0, 'left right', false), ['right'])
assert.deepEqual(stream.read(0, 'left right left', false), ['left'])
assert.deepEqual(stream.read(0, 'left right left right up down', false), ['right', 'up', 'down'])
assert.deepEqual(stream.read(0, 'left right left right up down', true), [], 'final text must not replay live words')
assert.deepEqual(stream.read(0, 'left right left right up down', true), [], 'repeated final result does not replay commands')

const revision = new StableDirectionWords()
assert.deepEqual(revision.read(0, 'left light', false), ['left'])
assert.deepEqual(revision.read(0, 'left right', false), ['right'], 'an unfinished non-command tail can be corrected')
assert.deepEqual(revision.read(0, 'left right', true), [])
assert.deepEqual(revision.read(1, 'up', true), ['up'], 'a new result segment starts a new sequence')

const unfinished = new StableDirectionWords()
assert.deepEqual(unfinished.read(0, 'up do', false), ['up'])
assert.deepEqual(unfinished.read(0, 'up down', false), ['down'], 'a partial word is not skipped when completed')
assert.deepEqual(unfinished.read(0, 'up down', true), [])
