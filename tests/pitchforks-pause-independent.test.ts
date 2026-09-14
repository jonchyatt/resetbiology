/** Harness pass: execute production pause callbacks extracted from PitchforksIII.tsx. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const sourcePath = new URL('../src/components/PitchDefender/PitchforksIII.tsx', import.meta.url)
const source = readFileSync(sourcePath, 'utf8')
const ast = ts.createSourceFile(sourcePath.pathname, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

function extract(name: string): string {
  const found: ts.Node[] = []
  function visit(node: ts.Node): void {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name && node.initializer) {
      const initializer = node.initializer
      found.push(ts.isCallExpression(initializer) && initializer.expression.getText(ast) === 'useCallback'
        ? initializer.arguments[0]
        : initializer)
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  assert.equal(found.length, 1, `unique production callback: ${name}`)
  return ts.transpileModule(`(${found[0].getText(ast)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
}

const togglePauseCode = extract('togglePause')
const loopCode = extract('loop')
const guideCode = extract('setCloseSmashGuideDisclosure')
type Ref<T> = { current: T }
const ref = <T>(current: T): Ref<T> => ({ current })

function makeHarness() {
  let rafId = 0
  const rafQueue = new Map<number, (timestamp: number) => void>()
  const counters = { frames: 0, movement: 0, guide: [] as boolean[] }
  let now = 0
  const env: Record<string, any> = {
    phaseRef: ref('playing'), pausedRef: ref(false), pauseGateRef: ref({ paused: false, generation: 0, fence: 0 }),
    timersPausedRef: ref(false), runGenerationRef: ref(1), runtimeRef: ref({ nextWavePending: false }),
    lockGenerationRef: ref({}), bossPitchGenerationRef: ref({}), pitchGenerationRef: ref(1), lastTimeRef: ref(0),
    rafRef: ref<number | null>(null), loopRef: ref<((ts: number, fence?: number) => void) | null>(null),
    bossControllerRef: ref({}), closeSmashGuidePausedBeforeOpenRef: ref(false),
    requestAnimationFrame: (callback: (timestamp: number) => void) => { const id = ++rafId; rafQueue.set(id, callback); return id },
    cancelAnimationFrame: (id: number) => rafQueue.delete(id), performance: { now: () => now },
    setPaused: () => {}, setCloseSmashGuideOpen: (value: boolean) => { counters.guide.push(value) },
    stepBossChamber: () => { counters.frames += 1 }, updateGame: () => { counters.movement += 1 },
    canvasRef: ref({ getContext: () => ({}) }), document: { hidden: false },
  }
  env.transitionPitchforksPauseGate = (gate: any, action: 'pause' | 'resume') => ({ paused: action === 'pause', generation: action === 'resume' ? gate.generation + 1 : gate.generation, fence: gate.fence + 1 })
  env.loop = runInNewContext(loopCode, env); env.loopRef.current = env.loop
  env.togglePause = runInNewContext(togglePauseCode, env)
  env.setCloseSmashGuideDisclosure = runInNewContext(guideCode, env)
  const runNext = (timestamp: number) => { const next = rafQueue.entries().next().value as [number, (timestamp: number) => void] | undefined; if (!next) throw new Error('expected RAF'); rafQueue.delete(next[0]); next[1](timestamp) }
  return { env, rafQueue, counters, runNext }
}

const h = makeHarness()
h.env.loop(16, h.env.pauseGateRef.current.fence)
assert.equal(h.rafQueue.size, 1)
const baselineFrames = h.counters.frames
const oldEntry = [...h.rafQueue.entries()][0]
h.env.togglePause(); h.rafQueue.delete(oldEntry[0]); oldEntry[1](32)
assert.equal(h.counters.frames, baselineFrames, 'old callback cannot advance a frame')
assert.equal(h.counters.movement, 0, 'old callback cannot move gameplay')
h.env.togglePause(); h.runNext(48)
assert.equal(h.counters.frames, baselineFrames + 1, 'fresh callback advances the encounter loop')
assert.equal(h.counters.movement, 0, 'boss loop does not call battlefield movement')

for (let cycle = 0; cycle < 2; cycle += 1) {
  const staleEntry = [...h.rafQueue.entries()][0]
  h.env.togglePause(); h.rafQueue.delete(staleEntry[0]); staleEntry[1](64 + cycle)
  assert.equal(h.counters.frames, baselineFrames + cycle + 1)
  h.env.togglePause(); h.runNext(80 + cycle)
  assert.equal(h.counters.frames, baselineFrames + cycle + 2)
}

h.env.setCloseSmashGuideDisclosure(true)
assert.equal(h.env.pausedRef.current, true, 'guide pauses active run')
h.env.setCloseSmashGuideDisclosure(false)
assert.equal(h.env.pausedRef.current, false, 'guide close resumes what it paused')
h.env.togglePause(); h.env.setCloseSmashGuideDisclosure(true); h.env.setCloseSmashGuideDisclosure(false)
assert.equal(h.env.pausedRef.current, true, 'guide close preserves prior pause')

console.log('pitchforks pause independent behavior: production callbacks executed with mocked RAF; stale frames blocked, resume frames advance, guide pause preserved: PASS')
