import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

// Run the actual shared player against a controlled Web Audio boundary.
const source = readFileSync(new URL('../src/components/PitchDefender/audioEngine.ts', import.meta.url), 'utf8')
const ast = ts.createSourceFile('audioEngine.ts', source, ts.ScriptTarget.Latest, true)
const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'playPianoNote')!
assert.ok(declaration)
const code = ts.transpileModule(declaration.getText(ast).replace(/^export /, ''), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText + '\nplayPianoNote'

function fixture() {
  const result = { starts: 0, state: 'running', throws: false, rate: 0 }
  const bus = { gain: { value: 1 } }
  const sample = {}
  const cache = new Map([['D4', sample]])
  const context = {
    get state() { return result.state },
    currentTime: 0,
    createBufferSource: () => ({
      buffer: null,
      playbackRate: { set value(value: number) { result.rate = value } },
      connect() {},
      start() { if (result.throws) throw new Error('unavailable'); result.starts++ },
    }),
    createGain: () => ({ connect() {}, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } }),
  }
  const scope = {
    _pianoBus: bus as typeof bus | null,
    _pianoCache: cache,
    ctx: () => context,
    findNearestBySemitones: () => cache.size ? { buf: sample, semitones: 3 } : null,
    findPianoBuffer: () => undefined,
    duckMusic() {},
  }
  const play = runInNewContext(code, scope) as (note: string, options?: { exact: boolean }) => boolean
  return { result, bus, cache, scope, play }
}

const ready = fixture()
assert.equal(ready.play('D4', { exact: true }), true)
assert.equal(ready.result.starts, 1)
assert.equal(ready.result.rate, 1)
assert.equal(ready.play('F4', { exact: true }), true)
assert.equal(ready.result.rate, Math.pow(2, 3 / 12), 'missing exact sample retains exact pitch transposition')

for (const reason of ['bus', 'samples', 'muted', 'suspended', 'exception'] as const) {
  const test = fixture()
  if (reason === 'bus') test.scope._pianoBus = null
  if (reason === 'samples') test.cache.clear()
  if (reason === 'muted') test.bus.gain.value = 0
  if (reason === 'suspended') test.result.state = 'suspended'
  if (reason === 'exception') test.result.throws = true
  assert.equal(test.play('F4', { exact: true }), false, reason + ' must not establish emitted context')
}
console.log('Piano emission: direct, transposed, missing, muted, suspended and failed playback PASS (Web Audio harness)')
