import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  PitchforksSongcraftPanel,
  type SongcraftPanelProps,
  type SongcraftPanelView,
} from '../src/components/PitchDefender/PitchforksSongcraftPanel'

const noop = () => {}

function baseProps(overrides: Partial<SongcraftPanelProps> = {}): SongcraftPanelProps {
  return {
    songs: [
      { sourceKey: 'pd_composed_alpha', title: 'First Light' },
      { sourceKey: 'pd_composed_beta', title: 'Night Walk' },
    ],
    selectedKey: 'pd_composed_alpha',
    onSelect: noop,
    lane: 'voice',
    onLaneChange: noop,
    onBegin: noop,
    onStartMic: noop,
    onHear: noop,
    onHint: noop,
    onAnswer: noop,
    onAcknowledge: noop,
    onRetrySave: noop,
    onRetryNote: noop,
    onReturn: noop,
    ...overrides,
  }
}

function view(overrides: Partial<SongcraftPanelView> = {}): SongcraftPanelView {
  return {
    title: 'First Light',
    position: 1,
    total: 4,
    kind: 'note',
    noteLabel: 'C4',
    message: 'Caller status',
    progress01: 0.25,
    assisted: false,
    micStatus: 'off',
    busy: false,
    canAnswer: true,
    answerOptions: ['C4', 'D4', 'E4'],
    pendingSave: false,
    needsRetry: false,
    ...overrides,
  }
}

function render(props: SongcraftPanelProps): string {
  return renderToStaticMarkup(createElement(PitchforksSongcraftPanel, props))
}

function assertNo(markup: string, pattern: RegExp, message: string): void {
  assert.doesNotMatch(markup, pattern, message)
}

// Pre-attempt presentation has the Composer source selector, explicit lane
// choice, and one Begin action. Empty source discovery has a useful route out.
const selection = render(baseProps())
assert.match(selection, /data-testid="pitchforks-songcraft-selection"/)
assert.match(selection, /data-testid="pitchforks-songcraft-song-select"/)
assert.match(selection, /First Light/)
assert.match(selection, /Night Walk/)
assert.match(selection, /optgroup label="My Composer songs"/)
const mixedSources = renderToStaticMarkup(createElement(PitchforksSongcraftPanel, baseProps({ songs: [
  { sourceKey: 'pd_composed_alpha', title: 'My song', source: 'composer' },
  { sourceKey: 'builtin:practice:storm-studies:1:c4-d4', title: 'Lantern Steps · C4–D4', source: 'builtin' },
] })))
assert.match(mixedSources, /optgroup label="Built-in practice"/)
assert.ok(mixedSources.indexOf('My Composer songs') < mixedSources.indexOf('Built-in practice'))
assert.match(mixedSources, /★ My song/)
assert.match(mixedSources, /only your confirmed notes/)
assert.match(selection, /VOICE · SINGING/)
assert.match(selection, /EAR · LISTENING/)
assert.match(selection, /data-testid="pitchforks-songcraft-begin"/)
assert.match(selection, /min-h-12/)
assert.match(selection, /data-testid="pitchforks-songcraft-return"/)
assertNo(selection, /data-testid="pitchforks-songcraft-(?:start-mic|hear|hint|answer-)/, 'pre-attempt view must not expose practice controls')

const empty = render(baseProps({ songs: [], selectedKey: '' }))
assert.match(empty, /No Composer songs found\./)
assert.match(empty, /href="\/pitch-defender\/composer"/)
assert.match(empty, /OPEN COMPOSER/)
assertNo(empty, /data-testid="pitchforks-songcraft-begin"/, 'empty source list must not offer Begin')

// Voice note view is word-only around the microphone state and has no
// synthetic/simulate path. The supplied source title, position, note, and
// caller status remain visible.
const voiceNote = render(baseProps({ view: view() }))
assert.match(voiceNote, /data-testid="pitchforks-songcraft-active-title"[^>]*>First Light<\/p>/)
assert.match(voiceNote, /Position 1 of 4 · Voice · singing/)
assert.match(voiceNote, />C4<\/h2>/)
assert.match(voiceNote, /Practice at your pace/)
assert.match(voiceNote, /Caller status/)
assert.match(voiceNote, /data-testid="pitchforks-songcraft-start-mic"/)
assert.match(voiceNote, /data-testid="pitchforks-songcraft-mic-status"[^>]*>Off<\/span>/)
assert.match(voiceNote, /data-testid="pitchforks-songcraft-hear"/)
assert.match(voiceNote, /data-testid="pitchforks-songcraft-hint"/)
assertNo(voiceNote, /simulate|synthetic|success|Hz|cents|pitch.?error/i, 'voice view must not invent a synthetic or numeric pitch result')
assertNo(voiceNote, /data-testid="pitchforks-songcraft-answer-/, 'voice view must not show answer buttons')
assert.match(voiceNote, /role="status" aria-live="polite" aria-atomic="true"/)
assert.match(voiceNote, /data-testid="pitchforks-songcraft-progress"/)
assert.match(voiceNote, /aria-label="Practice progress"/)

const startingVoice = render(baseProps({ view: view({ micStatus: 'starting', busy: false }) }))
assert.match(startingVoice, /STARTING MIC…/)
assert.match(startingVoice, /data-testid="pitchforks-songcraft-start-mic"[^>]*\sdisabled=""/)

// EAR choices are deliberate and remain gated until the caller says they can
// be answered. The lane copy makes listening distinct from singing.
const earGated = render(baseProps({ lane: 'ear', view: view({ canAnswer: false }) }))
assert.match(earGated, />Mystery note<\/h2>/)
assertNo(earGated, />C4<\/h2>/, 'EAR heading must never reveal the target note')
assert.match(earGated, /Position 1 of 4 · Ear · listening/)
assert.match(earGated, /Listen to the challenge, then choose the note you heard\./)
assert.match(earGated, /data-testid="pitchforks-songcraft-answer-C4"[^>]*\sdisabled=""/)
assert.match(earGated, /data-testid="pitchforks-songcraft-answer-D4"[^>]*\sdisabled=""/)
assert.match(earGated, /data-testid="pitchforks-songcraft-answer-E4"[^>]*\sdisabled=""/)

const earOpen = render(baseProps({ lane: 'ear', view: view({ canAnswer: true }) }))
assertNo(earOpen, /data-testid="pitchforks-songcraft-answer-C4"[^>]*\sdisabled=""/, 'EAR answer should open only when canAnswer is true')

// A busy note disables every input action while retaining status and Return.
const busy = render(baseProps({ view: view({ busy: true }) }))
assert.match(busy, /data-testid="pitchforks-songcraft-start-mic"[^>]*\sdisabled=""/)
assert.match(busy, /data-testid="pitchforks-songcraft-hear"[^>]*\sdisabled=""/)
assert.match(busy, /data-testid="pitchforks-songcraft-hint"[^>]*\sdisabled=""/)
assert.match(busy, /data-testid="pitchforks-songcraft-return"/)

// Rest and authored out-of-range notes have only their acknowledgement path;
// neither can accidentally expose microphone or answer controls.
const rest = render(baseProps({ view: view({ kind: 'rest', noteLabel: null, message: 'rest status' }) }))
assert.match(rest, /Rest — continue when ready\./)
assert.match(rest, /data-testid="pitchforks-songcraft-acknowledge"/)
assertNo(rest, /data-testid="pitchforks-songcraft-(?:start-mic|hear|hint|answer-)/, 'rest must not expose mic, hear, hint, or answer controls')

const unsupported = render(baseProps({ view: view({ kind: 'unsupported', noteLabel: 'C8', message: 'range status' }) }))
assert.match(unsupported, />C8<\/p>/, 'The unadmitted authored octave must remain visible')
assert.match(unsupported, /This note is outside your current practice range\. Continue without credit\./)
assert.match(unsupported, /CONTINUE WITHOUT CREDIT/)
assertNo(unsupported, /data-testid="pitchforks-songcraft-(?:start-mic|hear|hint|answer-)/, 'unsupported note must not expose practice-input controls')

// Recovery actions are exclusive: pending save exposes Retry saving only;
// needsRetry exposes Try this note again only. Return remains available.
const pendingSave = render(baseProps({ view: view({ pendingSave: true }) }))
assert.match(pendingSave, /RETRY SAVING/)
assertNo(pendingSave, /data-testid="pitchforks-songcraft-(?:start-mic|hear|hint|answer-)/, 'pending save must not replay or answer')
assertNo(pendingSave, /TRY THIS NOTE AGAIN/)
assert.match(pendingSave, /data-testid="pitchforks-songcraft-return"/)

const needsRetry = render(baseProps({ view: view({ needsRetry: true }) }))
assert.match(needsRetry, /TRY THIS NOTE AGAIN/)
assertNo(needsRetry, /data-testid="pitchforks-songcraft-(?:start-mic|hear|hint|answer-)/, 'retry-note must not duplicate input controls')
assertNo(needsRetry, /RETRY SAVING/)
assert.match(needsRetry, /data-testid="pitchforks-songcraft-return"/)

// Completion wording remains truthful and comes with no mastery or unlock
// claim. The caller's completion message is the accessible status channel.
const assistedComplete = render(baseProps({ view: view({
  kind: 'complete',
  position: 4,
  progress01: 1,
  assisted: true,
  message: 'Caller completion message',
  noteLabel: null,
}) }))
assert.match(assistedComplete, /Practice complete/)
assert.match(assistedComplete, /Completed with help/)
assert.match(assistedComplete, /Caller completion message/)
assertNo(assistedComplete, /mastery|unlock|unlocked|mastered/i, 'completion must not claim mastery or unlocks')
assertNo(assistedComplete, /data-testid="pitchforks-songcraft-(?:start-mic|hear|hint|answer-|acknowledge)/, 'complete must not expose note controls')

const unaidedComplete = render(baseProps({ view: view({
  kind: 'complete',
  progress01: 1,
  assisted: false,
  message: 'Finished from caller',
  noteLabel: null,
}) }))
assert.match(unaidedComplete, /Practice finished/)
assertNo(unaidedComplete, /Completed with help/)
assert.match(unaidedComplete, /Finished from caller/)

// The presenter is intentionally a controlled, action-only leaf. Keep this
// guard close to the render tests so a future refactor cannot pull in runtime
// microphone/audio/storage or grading side effects.
const source = readFileSync(
  new URL('../src/components/PitchDefender/PitchforksSongcraftPanel.tsx', import.meta.url),
  'utf8',
)
assertNo(source, /useEffect|useState|useReducer|navigator\.mediaDevices|MediaRecorder|AudioContext|localStorage|sessionStorage|autoGrade|grade[A-Z]|simulate|synthetic/i, 'panel must stay presentational')
assert.match(source, /onStartMic/)
assert.match(source, /onHear/)
assert.match(source, /onHint/)
assert.match(source, /onAnswer/)
assert.match(source, /onAcknowledge/)
assert.match(source, /onRetrySave/)
assert.match(source, /onRetryNote/)
assert.match(source, /onReturn/)
assert.equal((source.match(/<button/g) ?? []).length, (source.match(/type="button"/g) ?? []).length, 'every button must declare type=button')

console.log('pitchforks songcraft panel: PASS — controlled selection, lane views, recovery states, completion truth, and presentational safety')
