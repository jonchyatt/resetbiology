import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { PITCHFORKS_PRACTICE_CARDS } from '../src/components/PitchDefender/PitchforksPracticeArcade'
import { WORLD_REGISTRY, isWorldUnlocked } from '../src/components/PitchDefender/pitchforks3WorldRegistry'
import * as tempoEncore from '../src/components/PitchDefender/pitchforksTempoEncore'

// tsx does not natively consume CSS modules. Ignore only the style module so
// this test can execute the actual component render rather than a source scan.
const require = createRequire(import.meta.url)
require.extensions['.css'] = () => undefined
;(globalThis as { React?: typeof React }).React = React
const { default: PitchforksIII, pitchforksPracticeBossForWorld } = require('../src/components/PitchDefender/PitchforksIII') as typeof import('../src/components/PitchDefender/PitchforksIII')

const worldOrder = ['dungeon', 'village-gate', 'bell-tower', 'cathedral'] as const

// The practice arcade offers supported access; it must not rewrite the earned campaign ladder.
assert.deepEqual(PITCHFORKS_PRACTICE_CARDS.map(card => card.world), worldOrder)
assert.equal(new Set(PITCHFORKS_PRACTICE_CARDS.map(card => card.title)).size, worldOrder.length)
assert.equal(new Set(PITCHFORKS_PRACTICE_CARDS.map(card => card.encounter)).size, worldOrder.length)
assert.deepEqual(
  worldOrder.map(world => pitchforksPracticeBossForWorld(world)),
  ['torchmaster', 'choirmaster', 'bellringer', 'bellringer'],
)

assert.deepEqual(WORLD_REGISTRY.map(world => world.playable), [true, true, true, true])
assert.deepEqual(worldOrder.map(world => isWorldUnlocked(world)), [true, false, false, false])
assert.deepEqual(
  worldOrder.map(world => isWorldUnlocked(world, { bossClears: ['dungeon', 'village-gate'] })),
  [true, true, true, false],
)
assert.equal(typeof tempoEncore.canEnterTempoEncore, 'function', 'Songcraft must receive the Tempo Encore gate as a callable export')

// This executes the actual React component instead of treating a static card scan as acceptance.
assert.doesNotThrow(
  () => renderToStaticMarkup(React.createElement(PitchforksIII)),
  'PitchforksIII must render before any practice world can be judged playable',
)

// The real browser evaluates the callback dependency array under native ESM
// semantics. Keep the calibration callback initialized before that array so a
// practice entry cannot crash the entire four-world surface via a TDZ error.
const pitchforksSource = readFileSync(
  new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url),
  'utf8',
)
const practiceEntryOffset = pitchforksSource.indexOf('const enterPracticeArcade = useCallback')
const calibrationOffset = pitchforksSource.indexOf('const beginCalibration = useCallback')
assert.ok(practiceEntryOffset >= 0, 'practice arcade entry callback must exist')
assert.ok(calibrationOffset >= 0, 'calibration callback must exist')
assert.ok(
  calibrationOffset < practiceEntryOffset,
  'beginCalibration must initialize before enterPracticeArcade captures it in a dependency array',
)

const bossPreviewStart = pitchforksSource.indexOf("const beginBossPreview = useCallback")
const bossPreviewEnd = pitchforksSource.indexOf('const rehearseCampaignRecital = useCallback', bossPreviewStart)
const bossPreviewSource = bossPreviewStart >= 0 && bossPreviewEnd > bossPreviewStart
  ? pitchforksSource.slice(bossPreviewStart, bossPreviewEnd)
  : ''
assert.ok(bossPreviewSource.length > 0, 'boss preview source segment must exist')
assert.equal(
  /if \(earnedWorld \|\| practiceWorld\) void startListening\(\)/.test(bossPreviewSource),
  false,
  'Listen & Tap practice must not start microphone capture merely because it is a practice world',
)

console.log('pitchforks four worlds acceptance: component render, differentiated practice access, and honest gates: PASS')
