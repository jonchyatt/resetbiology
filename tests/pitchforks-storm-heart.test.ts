import assert from 'node:assert/strict'

import {
  type StormHeartCanvasContext,
  drawStormHeart,
  selectStormHeartState,
} from '../src/components/PitchDefender/pitchforksStormHeart'

type Call = Readonly<{ op: string; args: readonly unknown[] }>

type RecordingContext = StormHeartCanvasContext & Readonly<{ calls: Call[] }>

function createRecordingContext(): RecordingContext {
  const calls: Call[] = []
  const record = (op: string, ...args: unknown[]) => calls.push({ op, args })
  let fillStyle: CanvasRenderingContext2D['fillStyle'] = ''
  let strokeStyle: CanvasRenderingContext2D['strokeStyle'] = ''
  let lineWidth = 1
  let lineJoin: CanvasRenderingContext2D['lineJoin'] = 'miter'

  return {
    calls,
    beginPath: () => record('beginPath'),
    ellipse: (...args: number[]) => record('ellipse', ...args),
    fill: () => record('fill'),
    lineTo: (...args: number[]) => record('lineTo', ...args),
    moveTo: (...args: number[]) => record('moveTo', ...args),
    restore: () => record('restore'),
    save: () => record('save'),
    stroke: () => record('stroke'),
    get fillStyle() { return fillStyle },
    set fillStyle(value: CanvasRenderingContext2D['fillStyle']) {
      fillStyle = value
      record('fillStyle', value)
    },
    get lineJoin() { return lineJoin },
    set lineJoin(value: CanvasRenderingContext2D['lineJoin']) {
      lineJoin = value
      record('lineJoin', value)
    },
    get lineWidth() { return lineWidth },
    set lineWidth(value: number) {
      lineWidth = value
      record('lineWidth', value)
    },
    get strokeStyle() { return strokeStyle },
    set strokeStyle(value: CanvasRenderingContext2D['strokeStyle']) {
      strokeStyle = value
      record('strokeStyle', value)
    },
  } as RecordingContext
}

let checks = 0
const check = (fn: () => void) => {
  fn()
  checks += 1
}

const stateInput = (overrides: Partial<Parameters<typeof selectStormHeartState>[0]> = {}) => ({
  listening: false,
  chargeProgress: 0,
  hasBolt: false,
  spent: false,
  ...overrides,
})

check(() => assert.equal(selectStormHeartState(stateInput({ listening: true, chargeProgress: Number.NaN })), 'listen'))
check(() => assert.equal(selectStormHeartState(stateInput()), 'dormant'))
check(() => assert.equal(selectStormHeartState(stateInput({ chargeProgress: 0.01 })), 'gather-1'))
check(() => assert.equal(selectStormHeartState(stateInput({ chargeProgress: 0.33 })), 'gather-2'))
check(() => assert.equal(selectStormHeartState(stateInput({ chargeProgress: 0.66 })), 'gather-3'))
check(() => assert.equal(selectStormHeartState(stateInput({ hasBolt: true })), 'gather-3'))
check(() => assert.equal(selectStormHeartState(stateInput({ hasBolt: true, spent: true })), 'spent'))
check(() => assert.equal(selectStormHeartState(stateInput({ chargeProgress: 0.5, hasBolt: true, spent: true })), 'gather-2'))
check(() => assert.equal(selectStormHeartState(stateInput({ spent: true })), 'dormant'))
check(() => assert.equal(selectStormHeartState(stateInput({ chargeProgress: Number.NaN })), 'dormant'))
check(() => assert.equal(selectStormHeartState(stateInput({ chargeProgress: Number.POSITIVE_INFINITY })), 'dormant'))

check(() => {
  const ctx = createRecordingContext()
  drawStormHeart(ctx, 'listen', 128, 91)
  assert.deepEqual(ctx.calls, [])
})

check(() => {
  const ctx = createRecordingContext()
  drawStormHeart(ctx, 'dormant', 128, 91)
  assert.ok(ctx.calls.some(call => call.op === 'ellipse'))
  assert.equal(ctx.calls.some(call => call.op === 'fillStyle' && String(call.args[0]).includes('154, 239, 255')), false)
  assert.equal(ctx.calls.some(call => call.op === 'lineTo' && call.args[0] === 123), false)
})

check(() => {
  const ctx = createRecordingContext()
  drawStormHeart(ctx, 'gather-3', 128, 91)
  const numericArgs = ctx.calls
    .filter(call => ['ellipse', 'moveTo', 'lineTo'].includes(call.op))
    .flatMap(call => call.args)
    .filter(value => typeof value === 'number')
  assert.ok(numericArgs.length > 0)
  assert.equal(numericArgs.every(Number.isFinite), true)
  assert.equal(ctx.calls.some(call => call.op === 'strokeStyle' && String(call.args[0]).includes('154, 239, 255')), true)
  assert.equal(ctx.calls.some(call => call.op === 'ellipse' && call.args[2] === 7 && call.args[3] === 7), true)
})

check(() => {
  const first = createRecordingContext()
  const second = createRecordingContext()
  drawStormHeart(first, 'gather-2', 128, 91)
  drawStormHeart(second, 'gather-2', 128, 91)
  assert.deepEqual(first.calls, second.calls)
})

check(() => {
  const ctx = createRecordingContext()
  drawStormHeart(ctx, 'dormant', 300, 200)
  const firstCloudTuft = ctx.calls.find(call => call.op === 'ellipse')
  assert.deepEqual(firstCloudTuft?.args.slice(0, 2), [267, 185])
})

console.log(`pitchforks Storm Heart state selection and cloud drawing: ${checks}/${checks} PASS`)
