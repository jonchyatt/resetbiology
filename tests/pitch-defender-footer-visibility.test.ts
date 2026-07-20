import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { shouldHideFooter } from '../src/components/Navigation/Footer'

assert.equal(shouldHideFooter('/pitch-defender'), true)
assert.equal(shouldHideFooter('/pitch-defender/pitchforks-3'), true)
assert.equal(shouldHideFooter('/pitch-defenderish'), false)
assert.equal(shouldHideFooter('/portal'), false)
assert.equal(shouldHideFooter(null), false)

const source = readFileSync(new URL('../src/components/Navigation/Footer.tsx', import.meta.url), 'utf8')
assert.match(source, /<img[^>]+src="\/reset-logo-pro\.png"[^>]+draggable=\{false\}/)

console.log('pitch-defender footer visibility: 6/6 PASS')
