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

function actualFunction(name: string): string {
  const matches: ts.FunctionDeclaration[] = []
  function visit(node: ts.Node): void {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) matches.push(node)
    ts.forEachChild(node, visit)
  }
  visit(ast)
  assert.equal(matches.length, 1, `one actual production declaration for ${name}`)
  return ts.transpileModule(`(${matches[0].getText(ast).replace(/^export\s+/, '')})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
}

function actualCallback(name: string): ts.ArrowFunction {
  const matches: ts.ArrowFunction[] = []
  function visit(node: ts.Node): void {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name && node.initializer
      && ts.isCallExpression(node.initializer)
      && node.initializer.expression.getText(ast) === 'useCallback'
      && ts.isArrowFunction(node.initializer.arguments[0])) {
      matches.push(node.initializer.arguments[0])
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  assert.equal(matches.length, 1, `one actual production callback for ${name}`)
  return matches[0]
}

function actualBeginPlayingRunReset(): string {
  const callback = actualCallback('beginPlaying')
  assert.ok(ts.isBlock(callback.body), 'beginPlaying must retain an executable body')
  const statements = [...callback.body.statements]
  const incrementIndex = statements.findIndex(statement =>
    ts.isExpressionStatement(statement)
    && ts.isBinaryExpression(statement.expression)
    && statement.expression.left.getText(ast) === 'runGenerationRef.current'
    && statement.expression.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken,
  )
  assert.ok(incrementIndex >= 0, 'beginPlaying must advance the actual run generation')
  const gateIndex = statements.findIndex((statement, index) => index > incrementIndex
    && ts.isExpressionStatement(statement)
    && ts.isBinaryExpression(statement.expression)
    && statement.expression.left.getText(ast) === 'pauseGateRef.current')
  assert.equal(gateIndex, incrementIndex + 1, 'beginPlaying must synchronize the fresh gate immediately after the run increment')
  const reset = statements.slice(incrementIndex, gateIndex + 1).map(statement => statement.getText(ast)).join('\n')
  return ts.transpileModule(`(() => { ${reset} })`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
}

const togglePauseCode = extract('togglePause')
const loopCode = extract('loop')
const guideCode = extract('setCloseSmashGuideDisclosure')
type PauseGate = { paused: boolean; generation: number; fence: number }
const createPauseGate = runInNewContext(actualFunction('createPitchforksPauseGate'), {}) as (generation?: number) => PauseGate
const transitionPauseGate = runInNewContext(actualFunction('transitionPitchforksPauseGate'), {}) as (
  gate: PauseGate,
  action: 'pause' | 'resume',
) => PauseGate
const acceptsPauseCallback = runInNewContext(actualFunction('acceptsPitchforksPauseCallback'), {}) as (
  gate: PauseGate,
  generation: number,
  fence: number,
) => boolean
type Ref<T> = { current: T }
const ref = <T>(current: T): Ref<T> => ({ current })

function makeHarness() {
  let rafId = 0
  const rafQueue = new Map<number, (timestamp: number) => void>()
  const counters = { frames: 0, movement: 0, guide: [] as boolean[] }
  let now = 0
  const runGenerationRef = ref(0)
  const pauseGateRef = ref(createPauseGate())
  const env: Record<string, any> = {
    phaseRef: ref('playing'), pausedRef: ref(false), pauseGateRef,
    timersPausedRef: ref(false), runGenerationRef, runtimeRef: ref({ nextWavePending: false }),
    lockGenerationRef: ref({}), bossPitchGenerationRef: ref({}), pitchGenerationRef: ref(1), lastTimeRef: ref(0),
    rafRef: ref<number | null>(null), loopRef: ref<((ts: number, fence?: number) => void) | null>(null),
    bossControllerRef: ref({}), closeSmashGuidePausedBeforeOpenRef: ref(false), artReviewRef: ref(false),
    requestAnimationFrame: (callback: (timestamp: number) => void) => { const id = ++rafId; rafQueue.set(id, callback); return id },
    cancelAnimationFrame: (id: number) => rafQueue.delete(id), performance: { now: () => now },
    setPaused: () => {}, setCloseSmashGuideOpen: (value: boolean) => { counters.guide.push(value) },
    stepBossChamber: () => { counters.frames += 1 }, updateGame: () => { counters.movement += 1 },
    canvasRef: ref({ getContext: () => ({}) }), document: { hidden: false },
  }
  const resetActiveGeneration = runInNewContext(actualBeginPlayingRunReset(), {
    runGenerationRef,
    pauseGateRef,
    createPitchforksPauseGate: createPauseGate,
  }) as () => void
  resetActiveGeneration()
  assert.equal(runGenerationRef.current, 1, 'production beginPlaying starts generation one')
  assert.equal(pauseGateRef.current.generation, 1, 'production beginPlaying stamps the active pause gate')
  env.loop = runInNewContext(loopCode, env); env.loopRef.current = env.loop
  env.transitionPitchforksPauseGate = transitionPauseGate
  env.togglePause = runInNewContext(togglePauseCode, env)
  env.setCloseSmashGuideDisclosure = runInNewContext(guideCode, env)
  const runNext = (timestamp: number) => { const next = rafQueue.entries().next().value as [number, (timestamp: number) => void] | undefined; if (!next) throw new Error('expected RAF'); rafQueue.delete(next[0]); next[1](timestamp) }
  return { env, rafQueue, counters, runNext, resetActiveGeneration }
}

const h = makeHarness()
assert.equal(acceptsPauseCallback(h.env.pauseGateRef.current, h.env.runGenerationRef.current, h.env.pauseGateRef.current.fence), true, 'fresh active callback identity is accepted')
h.env.loop(16, h.env.pauseGateRef.current.fence)
assert.equal(h.rafQueue.size, 1)
const baselineFrames = h.counters.frames
const oldEntry = [...h.rafQueue.entries()][0]
const oldGeneration = h.env.runGenerationRef.current
const oldFence = h.env.pauseGateRef.current.fence
h.env.togglePause();
assert.equal(acceptsPauseCallback(h.env.pauseGateRef.current, oldGeneration, oldFence), false, 'paused gate rejects the stale callback')
h.rafQueue.delete(oldEntry[0]); oldEntry[1](32)
assert.equal(h.counters.frames, baselineFrames, 'old callback cannot advance a frame')
assert.equal(h.counters.movement, 0, 'old callback cannot move gameplay')
h.env.togglePause(); h.runNext(48)
assert.equal(h.counters.frames, baselineFrames + 1, 'fresh callback advances the encounter loop')
assert.equal(h.counters.movement, 0, 'boss loop does not call battlefield movement')
assert.equal(acceptsPauseCallback(h.env.pauseGateRef.current, oldGeneration, oldFence), false, 'pre-pause callback remains stale after resume')
assert.equal(acceptsPauseCallback(h.env.pauseGateRef.current, h.env.runGenerationRef.current, h.env.pauseGateRef.current.fence), true, 'resumed generation accepts fresh callbacks')

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

// Re-enter the actual beginPlaying reset scope without fabricating its gate.
const restart = makeHarness()
const previousGeneration = restart.env.runGenerationRef.current
const previousFence = restart.env.pauseGateRef.current.fence
restart.resetActiveGeneration()
assert.equal(restart.env.runGenerationRef.current, previousGeneration + 1, 'restart advances the run generation')
assert.equal(restart.env.pauseGateRef.current.generation, restart.env.runGenerationRef.current, 'restart stamps the current generation')
assert.equal(acceptsPauseCallback(restart.env.pauseGateRef.current, previousGeneration, previousFence), false, 'restart rejects callbacks from the prior run even when the fence matches')
assert.equal(acceptsPauseCallback(restart.env.pauseGateRef.current, restart.env.runGenerationRef.current, restart.env.pauseGateRef.current.fence), true, 'restart accepts fresh callbacks')

console.log('pitchforks pause independent behavior: production callbacks executed with mocked RAF; stale frames blocked, resume frames advance, guide pause preserved: PASS')
