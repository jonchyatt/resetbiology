import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  PitchforksBellTowerLesson,
  type PitchforksBellTowerLessonProps,
} from '../src/components/PitchDefender/PitchforksBellTowerLesson'

const noop = () => {}

function baseProps(overrides: Partial<PitchforksBellTowerLessonProps> = {}): PitchforksBellTowerLessonProps {
  return {
    open: false,
    onOpenChange: noop,
    voiceMode: true,
    charge: 0,
    requiredResponses: 3,
    taughtPair: ['D4', 'E4'],
    powerPhase: 'charging',
    wavePhase: 'idle',
    contactCount: 0,
    ...overrides,
  }
}

function render(props: PitchforksBellTowerLessonProps): string {
  return renderToStaticMarkup(createElement(PitchforksBellTowerLesson, props))
}

function assertNo(markup: string, pattern: RegExp, message: string): void {
  assert.doesNotMatch(markup, pattern, message)
}

const closed = render(baseProps())
assert.match(closed, /data-testid="pitchforks-bell-tower-lesson"/)
assert.match(closed, /data-testid="pitchforks-bell-tower-lesson-toggle"[^>]*aria-expanded="false"/)
assert.match(closed, /How it works/)
assert.match(closed, /3 voice responses → 2-note pair → expanding wave/)
assertNo(closed, /data-testid="pitchforks-bell-tower-lesson-status"/, 'closed disclosure must not render the lesson body')
assertNo(closed, /Charge with real combat/, 'closed disclosure must stay compact')

const open = render(baseProps({
  open: true,
  charge: 3,
  powerPhase: 'pending',
  taughtPair: ['D4', 'E4'],
}))
assert.match(open, /data-testid="pitchforks-bell-tower-lesson-toggle"[^>]*aria-expanded="true"[^>]*aria-controls="pitchforks-bell-tower-lesson-panel"/)
assert.match(open, /Close lesson/)
assert.match(open, /id="pitchforks-bell-tower-lesson-panel"[^>]*role="region"[^>]*aria-labelledby="pitchforks-bell-tower-lesson-heading"/)
assert.match(open, /Voice only, on an unlocked normal Village Gate, Bell Tower, or Cathedral run after Dungeon clear: the Bell stores accepted exact voice-combat responses/)
assert.match(open, /PAIR READY · D4 → E4 · RING BELLS/)
assert.match(open, /Earn 3 accepted exact voice-combat responses/)
assert.match(open, /exact octave/)
assert.match(open, /TEACH PAIR/)
assert.match(open, /Sing and hold the first note, then the second/)
assert.match(open, /PAIR READY, press RING BELLS/)
assert.match(open, /contacts each live walking villager from the release snapshot/)
assert.match(open, /bounded knockback/)
assert.match(open, /never grants tine credit/)
assert.match(open, /adds mastery, unlocks notes, or creates an extra musical hit/)
assert.match(open, /failed release keeps the receipt available for retry/)

const charging = render(baseProps({ open: true, charge: 2, powerPhase: 'charging' }))
assert.match(charging, /CHARGE 2\/3 · D4 → E4/)
assert.match(charging, /When the Bell dock says READY/)

const activating = render(baseProps({ open: true, powerPhase: 'activating' }))
assert.match(activating, /ACTIVATING · SING THE PAIR IN ORDER/)
assert.match(activating, /wrong note or octave clears only this attempt, not the earned charge/)

const wave = render(baseProps({ open: true, powerPhase: 'charging', wavePhase: 'active', contactCount: 2 }))
assert.match(wave, /WAVE ACTIVE · 2 contacts/)
assert.match(wave, /causal crowd control, not an instant board clear/)

const buttons = render(baseProps({ open: true, voiceMode: false, powerPhase: null, charge: undefined }))
assert.match(buttons, /VOICE ONLY · switch to voice mode to charge, activate, or ring/)
assert.match(buttons, /button responses cannot charge, activate, or ring it/)

const source = readFileSync(
  new URL('../src/components/PitchDefender/PitchforksBellTowerLesson.tsx', import.meta.url),
  'utf8',
)
assert.match(source, /export interface PitchforksBellTowerLessonProps/)
assert.match(source, /readonly open: boolean/)
assert.match(source, /readonly onOpenChange: \(open: boolean\) => void/)
assert.match(source, /aria-expanded=\{open\}/)
assert.match(source, /aria-controls=\{PANEL_ID\}/)
assert.match(source, /onClick=\{\(\) => onOpenChange\(!open\)\}/)
assert.doesNotMatch(source, /PitchforksIII/)
assert.doesNotMatch(source, /useState|useEffect|localStorage|sessionStorage|MediaRecorder|navigator\.mediaDevices|grade[A-Z]|unlock[A-Z]/)
assert.equal((source.match(/<button/g) ?? []).length, (source.match(/type="button"/g) ?? []).length, 'every lesson button must declare type=button')

console.log('pitchforks Bell Tower lesson: PASS — controlled accessible disclosure, exact voice recipe, live readiness, wave result, and truthful limits')
