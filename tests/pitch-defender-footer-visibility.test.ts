import assert from 'node:assert/strict'

import { shouldHideFooter } from '../src/components/Navigation/Footer'

assert.equal(shouldHideFooter('/pitch-defender'), true)
assert.equal(shouldHideFooter('/pitch-defender/pitchforks-3'), true)
assert.equal(shouldHideFooter('/pitch-defenderish'), false)
assert.equal(shouldHideFooter('/portal'), false)
assert.equal(shouldHideFooter(null), false)

console.log('pitch-defender footer visibility: 5/5 PASS')
