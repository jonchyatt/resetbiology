import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire, registerHooks } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (error) {
      if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[a-z]+$/i.test(specifier)) {
        return nextResolve(`${specifier}.ts`, context)
      }
      throw error
    }
  },
})

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const require = createRequire(import.meta.url)
const ts = require('typescript')

class LocalStorageMock {
  #data = new Map()

  reset(values = {}) {
    this.#data = new Map(Object.entries(values).map(([key, value]) => [key, String(value)]))
  }

  getItem(key) {
    return this.#data.has(key) ? this.#data.get(key) : null
  }

  setItem(key, value) {
    this.#data.set(key, String(value))
  }

  removeItem(key) {
    this.#data.delete(key)
  }

  clear() {
    this.#data.clear()
  }

  snapshot() {
    return Object.fromEntries(this.#data)
  }
}

const localStorage = new LocalStorageMock()
globalThis.localStorage = localStorage

const fsrs = await import(new URL('../../src/lib/fsrs.ts', import.meta.url))
const family = await import(new URL('../../src/lib/fsrsFamily.ts', import.meta.url))
const engine = await import(new URL('../../src/components/PitchDefender/retroBlasterEngine.ts', import.meta.url))
const curriculum = await import(new URL('../../src/components/PitchDefender/retroBlasterCurriculum.ts', import.meta.url))
const gameTypes = await import(new URL('../../src/components/PitchDefender/types.ts', import.meta.url))

function loadRealShell() {
  const filename = resolve(root, 'src/components/PitchDefender/RetroBlasterII.tsx')
  const source = readFileSync(filename, 'utf8')
  const compiled = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText

  const stubs = new Map([
    ['react', require('react')],
    ['react/jsx-runtime', require('react/jsx-runtime')],
    ['@/lib/fsrs', fsrs],
    ['@/lib/fsrsFamily', family],
    ['./types', gameTypes],
    ['./retroBlasterEngine', engine],
    ['./retroBlasterCurriculum', curriculum],
    ['./usePitchDetection', { usePitchDetection() { throw new Error('Component mount is outside this fixture') } }],
    ['./audioEngine', { initAudio() {}, loadPianoSamples() {}, playPianoNote() {} }],
    ['./retroBlasterRenderer', { render() {} }],
  ])
  const shellRequire = specifier => stubs.has(specifier) ? stubs.get(specifier) : require(specifier)
  const module = { exports: {} }
  Function('require', 'module', 'exports', '__filename', '__dirname', compiled)(
    shellRequire, module, module.exports, filename, dirname(filename),
  )
  return module.exports
}

const shell = loadRealShell()

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function memory(note, { reviewed = true, weak = false } = {}) {
  const value = fsrs.createNote(note)
  if (!reviewed) return value
  return {
    ...value,
    S: weak ? 0.1 : 1000,
    due: weak ? 1 : Date.now() + 86400000,
    lastReview: weak ? Date.now() - 365 * 86400000 : Date.now() - 1000,
    phase: 'review',
    learningReps: 2,
  }
}

function alien(note = 'C4') {
  return {
    alienId: 'fixture-game:alien:1:0', visualId: 'fixture:0', visualKind: 0,
    x: 120, y: 120, entering: false, entryT: 1, entryTargetX: 120,
    formationSlot: 0, formationX: 120, formationY: 120,
    note, hue: 0, alive: true, frame: 0, hitTimer: 0,
  }
}

function playableState() {
  const state = engine.createInitialState('easy', ['C4', 'A4', 'G4', 'E4'], 1000, 'fixture-game')
  state.aliens = [alien()]
  state.activeAttack = {
    attackId: 'fixture-game:attack:1', alienId: state.aliens[0].alienId,
    note: state.aliens[0].note, side: 1, phase: 'outbound',
    telegraphStartedAtMs: state.directorClockMs - engine.DIVE_TELEGRAPH_MS,
    demandAtMs: state.directorClockMs,
    deadlineAtMs: state.directorClockMs + engine.DIVE_RESPONSE_DEADLINE_MS,
    outboundT: 0, returnFromT: 0, returnStartedAtMs: null,
    outcome: null, resolvedAtMs: null,
  }
  state.waveIntroTimer = 0
  state.spawnQueue = []
  state.alienCountThisWave = 1
  state.nextSpawnAt = Number.POSITIVE_INFINITY
  state.lastProgressAt = state.clockMs
  return state
}

function applyEngineEvents(events, inputMode, stores) {
  for (const event of events) shell.applyRetroBlasterFamilyEvent(event, inputMode, stores)
}

function driveClick(stores) {
  const state = playableState()
  const result = engine.tick(state, {
    inputMode: 'click', isListening: false, pitch: null,
    pendingAnswer: {
      note: 'C4', inputMode: 'click', gameId: state.gameId,
      alienId: state.activeAttack.alienId, attackId: state.activeAttack.attackId,
    },
    latencyMs: 800,
    fsrs: shell.activeLaneStore(stores, 'click'),
  }, 0, () => 0.5)
  applyEngineEvents(result.events, 'click', stores)
  assert(result.events.some(event => event.kind === 'grade'), 'engine emitted no click grade event')
}

function driveMicLock(stores) {
  const onPitch = {
    note: 'C4', frequency: 261.6255653005986, cents: 0, confidence: 1, isActive: true,
  }
  let state = playableState()
  const events = []
  for (const dtMs of [0, 100, 100, 100]) {
    const result = engine.tick(state, {
      inputMode: 'mic', isListening: true, pitch: onPitch, latencyMs: 900,
      fsrs: shell.activeLaneStore(stores, 'mic'),
    }, dtMs, () => 0.5)
    state = result.state
    events.push(...result.events)
    applyEngineEvents(result.events, 'mic', stores)
  }
  assert(events.some(event => event.kind === 'grade'), 'engine emitted no completed mic-lock grade event')
}

function changedKeys(before, after) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter(key => before[key] !== after[key])
    .sort()
}

const fixtures = [
  ['1', 'EAR answer preserves VOICE bytes', () => {
    const voiceRaw = JSON.stringify({ C4: memory('C4') }, null, 2)
    localStorage.reset({
      [family.FSRS_VOICE_KEY]: voiceRaw,
      [family.FSRS_EAR_KEY]: '{}',
    })
    const stores = shell.loadRetroBlasterFamilyStores()
    driveClick(stores)
    const ear = JSON.parse(localStorage.getItem(family.FSRS_EAR_KEY))
    assert(localStorage.getItem(family.FSRS_VOICE_KEY) === voiceRaw, 'VOICE bytes changed after EAR event')
    assert(ear.C4?.lastReview > 0, 'EAR store did not receive the click grade')
    return 'VOICE byte-identical; EAR C4 graded'
  }],
  ['2', 'mic-lock preserves EAR bytes', () => {
    const earRaw = JSON.stringify({ A4: memory('A4') }, null, 2)
    localStorage.reset({
      [family.FSRS_VOICE_KEY]: '{}',
      [family.FSRS_EAR_KEY]: earRaw,
    })
    const stores = shell.loadRetroBlasterFamilyStores()
    driveMicLock(stores)
    const voice = JSON.parse(localStorage.getItem(family.FSRS_VOICE_KEY))
    assert(localStorage.getItem(family.FSRS_EAR_KEY) === earRaw, 'EAR bytes changed after mic event')
    assert(voice.C4?.lastReview > 0, 'VOICE store did not receive the mic-lock grade')
    return 'EAR byte-identical; VOICE C4 graded'
  }],
  ['3', 'debug-key isolation', () => {
    const voiceRaw = JSON.stringify({ C4: memory('C4') })
    const earRaw = JSON.stringify({ A4: memory('A4') })
    localStorage.reset({
      [family.FSRS_VOICE_KEY]: voiceRaw,
      [family.FSRS_EAR_KEY]: earRaw,
      [family.FSRS_VOICE_DEBUG_KEY]: '{}',
      [family.FSRS_EAR_DEBUG_KEY]: '{}',
    })
    const before = localStorage.snapshot()
    const voiceDebug = family.loadStore(family.FSRS_VOICE_DEBUG_KEY)
    const earDebug = family.loadStore(family.FSRS_EAR_DEBUG_KEY)
    voiceDebug.C4 = memory('C4')
    earDebug.A4 = memory('A4')
    family.saveStore(family.FSRS_VOICE_DEBUG_KEY, voiceDebug)
    family.saveStore(family.FSRS_EAR_DEBUG_KEY, earDebug)
    const after = localStorage.snapshot()
    const changed = changedKeys(before, after)
    assert(JSON.stringify(changed) === JSON.stringify([
      family.FSRS_EAR_DEBUG_KEY, family.FSRS_VOICE_DEBUG_KEY,
    ].sort()), `unexpected changed keys: ${changed.join(', ')}`)
    assert(after[family.FSRS_VOICE_KEY] === voiceRaw && after[family.FSRS_EAR_KEY] === earRaw, 'production key changed')
    return `changed only ${changed.join(' + ')}`
  }],
  ['4', 'fresh-init independence', () => {
    localStorage.reset()
    const stores = shell.loadRetroBlasterFamilyStores()
    assert(Object.keys(stores.voice).length === 0 && Object.keys(stores.ear).length === 0, 'fresh stores were not independent empties')
    driveClick(stores)
    assert(localStorage.getItem(family.FSRS_VOICE_KEY) === null, 'fresh EAR grade seeded VOICE')
    assert(JSON.parse(localStorage.getItem(family.FSRS_EAR_KEY)).C4, 'fresh EAR store was not persisted')
    return 'independent {}; EAR created without VOICE seed'
  }],
  ['5', 'sibling regression sweep', () => {
    const protectedBase = process.env.RETRO_PROTECTED_BASE || 'origin/master'
    const siblingPaths = [
      'src/components/PitchDefender/RetroBlaster.tsx',
      'src/components/PitchDefender/DrillMode.tsx',
      'src/components/PitchDefender/PitchforksIII.tsx',
      'src/components/PitchDefender/PitchDefender.tsx',
      'src/components/NBack/PitchRecognition.tsx',
    ]
    const diff = execFileSync('git', ['diff', '--name-only', protectedBase], { cwd: root, encoding: 'utf8' })
      .split(/\r?\n/).filter(Boolean).map(path => path.replaceAll('\\', '/'))
    const changedSibling = siblingPaths.filter(path => diff.includes(path))
    assert(changedSibling.length === 0, `sibling diff detected: ${changedSibling.join(', ')}`)
    for (const path of siblingPaths.slice(1)) {
      const current = readFileSync(resolve(root, path), 'utf8').replaceAll('\r\n', '\n')
      const baseline = execFileSync('git', ['show', `${protectedBase}:${path}`], { cwd: root, encoding: 'utf8' })
        .replaceAll('\r\n', '\n')
      assert(current === baseline, `${path} differs from origin/master`)
      assert(current.includes("'pitch_fsrs_memory'"), `${path} lost its VOICE key literal`)
    }
    return `git diff clean for siblings against ${protectedBase}; 4 legacy literals intact`
  }],
  ['6', 'active-lane store selector with explicit session rosters', () => {
    const earNotes = gameTypes.INTRO_ORDER.slice(0, 7)
    const voiceNotes = gameTypes.INTRO_ORDER.slice(0, 6)
    const earStore = Object.fromEntries(earNotes.map((note, index) => [note, memory(note, { weak: index === 0 })]))
    const voiceStore = Object.fromEntries(voiceNotes.map((note, index) => [note, memory(note, { weak: index === 1 })]))
    localStorage.reset({
      [family.FSRS_EAR_KEY]: JSON.stringify(earStore),
      [family.FSRS_VOICE_KEY]: JSON.stringify(voiceStore),
    })
    const stores = shell.loadRetroBlasterFamilyStores()
    const clickState = shell.buildRetroBlasterState('easy', 'click', stores, earNotes, 1000)
    const micState = shell.buildRetroBlasterState('easy', 'mic', stores, voiceNotes, 1000)
    assert(clickState.unlockedNotes.length === 7, `click roster used ${clickState.unlockedNotes.length} notes instead of EAR's 7`)
    assert(micState.unlockedNotes.length === 6, `mic roster used ${micState.unlockedNotes.length} notes instead of VOICE's 6`)
    assert(shell.activeLaneStore(stores, 'click') === stores.ear, 'click selector did not return EAR store')
    assert(shell.activeLaneStore(stores, 'mic') === stores.voice, 'mic selector did not return VOICE store')
    return `click EAR ${clickState.unlockedNotes.length} notes [${clickState.spawnQueue.join(',')}]; mic VOICE ${micState.unlockedNotes.length} [${micState.spawnQueue.join(',')}]`
  }],
  ['7', 'corruption recovery', () => {
    const corruptRaw = '{ definitely-not-valid-json'
    localStorage.reset({
      [family.FSRS_VOICE_KEY]: corruptRaw,
      [family.FSRS_EAR_KEY]: '{}',
    })
    const stores = shell.loadRetroBlasterFamilyStores()
    assert(Object.keys(stores.voice).length === 0, 'gameplay did not receive the corruption fallback')
    assert(localStorage.getItem(family.FSRS_VOICE_KEY) === corruptRaw, 'load overwrote corrupt source bytes')
    assert(localStorage.getItem(`${family.FSRS_VOICE_KEY}.bak`) === corruptRaw, 'corrupt bytes were not backed up')
    shell.buildRetroBlasterState('easy', 'mic', stores, gameTypes.INTRO_ORDER.slice(0, 2), 1000)
    const saved = family.saveStore(family.FSRS_VOICE_KEY, stores.voice)
    assert(saved === false, 'dirty-load latch allowed fallback persistence without a grade')
    assert(localStorage.getItem(family.FSRS_VOICE_KEY) === corruptRaw, 'gameplay overwrote corrupt source bytes')
    return 'gameplay {}; source byte-identical; .bak copied; dirty save refused'
  }],
]

const rows = []
let failed = false
for (const [fixture, assertion, run] of fixtures) {
  try {
    rows.push({ fixture, assertion, detail: run(), result: 'PASS' })
  } catch (error) {
    failed = true
    rows.push({
      fixture,
      assertion,
      detail: error instanceof Error ? error.message : String(error),
      result: 'FAIL',
    })
  }
}

const widths = {
  fixture: Math.max('FIXTURE'.length, ...rows.map(row => row.fixture.length)),
  assertion: Math.max('ASSERTION'.length, ...rows.map(row => row.assertion.length)),
  detail: Math.max('DETAIL'.length, ...rows.map(row => row.detail.length)),
  result: 6,
}
const line = `+-${'-'.repeat(widths.fixture)}-+-${'-'.repeat(widths.assertion)}-+-${'-'.repeat(widths.detail)}-+-${'-'.repeat(widths.result)}-+`
console.log(line)
console.log(`| ${'FIXTURE'.padEnd(widths.fixture)} | ${'ASSERTION'.padEnd(widths.assertion)} | ${'DETAIL'.padEnd(widths.detail)} | ${'RESULT'.padEnd(widths.result)} |`)
console.log(line)
for (const row of rows) {
  console.log(`| ${row.fixture.padEnd(widths.fixture)} | ${row.assertion.padEnd(widths.assertion)} | ${row.detail.padEnd(widths.detail)} | ${row.result.padEnd(widths.result)} |`)
}
console.log(line)
console.log(failed ? 'E1 DATA PURITY: FAIL' : 'E1 DATA PURITY: ALL PASS')
if (failed) process.exitCode = 1
